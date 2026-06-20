const { Client, GatewayIntentBits, Partials, EmbedBuilder, ChannelType, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- SECRETS & CONFIG ---
const TOKEN = process.env.SECURITY_TOKEN;
const DB_PATH = './database.json';

const CHAT_LOGS_PATH = './chat_logs.json';
const DM_LOGS_PATH = './dm_logs.json';

module.exports = function initSecurityBot(app, io) {

if (!TOKEN) {
    console.warn("⚠️ SECURITY_TOKEN manquant ! Le module de sécurité et le dashboard ne se connecteront pas à Discord.");
    return { logToDashboard: () => {} };
}

function getLogs(path) {
    if (!fs.existsSync(path)) return [];
    try {
        const data = fs.readFileSync(path, 'utf8');
        if (!data.trim()) return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveLog(path, logEntry) {
    const logs = getLogs(path);
    logs.push(logEntry);
    if (logs.length > 500) logs.shift(); // Garde les 500 derniers messages pour éviter un gros fichier
    fs.writeFileSync(path, JSON.stringify(logs, null, 2));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function logToDashboard(type, log) {
    if (type === 'dm') {
        saveLog(DM_LOGS_PATH, log);
        io.emit('botDM', log);
    } else if (type === 'chat') {
        saveLog(CHAT_LOGS_PATH, log);
        io.emit('chatMessage', log);
    }
    
    if (log.userId) {
        const db = getDb();
        if (!db.user_profiles) db.user_profiles = {};
        if (!db.user_profiles[log.userId]) db.user_profiles[log.userId] = { voiceTime: 0, msgCount: 0, messages: [] };
        
        db.user_profiles[log.userId].msgCount += 1;
        db.user_profiles[log.userId].messages.push({
            content: log.content,
            channel: log.channel || 'DM',
            time: new Date().toISOString()
        });
        if (db.user_profiles[log.userId].messages.length > 100) db.user_profiles[log.userId].messages.shift();
        saveDb(db);
    }
}

app.post('/api/bridge/log', (req, res) => {
    logToDashboard(req.body.type, req.body.log);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(fs.readFileSync(path.join(__dirname, 'dashboard_v2.html'), 'utf8'));
});

io.on('connection', async (socket) => {
    console.log('Un utilisateur s\'est connecté au Dashboard Sécurité.');
    
    // Récupération des vraies données Discord
    let memberCount = 0;
    let bansList = [];
    
    const guild = client.guilds.cache.first(); // Prend le premier serveur du bot
    if (guild) {
        memberCount = guild.memberCount;
        try {
            const bans = await guild.bans.fetch();
            bansList = bans.map(ban => ({
                user: ban.user.tag,
                reason: ban.reason || "Aucune raison spécifiée",
                id: ban.user.id
            }));
        } catch(e) { console.error("Erreur fetch bans", e); }
    }

    // Envoi des données complètes (Historique + Statistiques)
    socket.emit('initData', { 
        stats: getDbStats(),
        memberCount: memberCount,
        bans: bansList,
        chatHistory: getLogs(CHAT_LOGS_PATH),
        dmHistory: getLogs(DM_LOGS_PATH)
    });

    // OSINT: Recherche Utilisateur (Scraping Avancé)
    socket.on('searchUser', async (userId) => {
        try {
            const user = await client.users.fetch(userId);
            const guild = client.guilds.cache.first();
            let member = null;
            try {
                if(guild) member = await guild.members.fetch(userId);
            } catch(e) {}
            
            const db = getDb();
            const profile = (db.user_profiles && db.user_profiles[userId]) ? db.user_profiles[userId] : { voiceTime: 0, msgCount: 0, messages: [] };
            
            // 1. Scraping des vrais DMs Discord (Historique complet)
            let trueDms = [];
            try {
                // On récupère d'abord les DMs transférés par le pont depuis ClaudePlus
                const allDms = getLogs(DM_LOGS_PATH);
                trueDms = allDms.filter(d => d.userId === userId || d.author.includes(user.username)).map(m => ({
                    author: m.author,
                    content: m.content,
                    time: m.time
                }));
            } catch(e) {}
            
            // 2. Scraping des messages des salons (si la BD n'a pas tout vu)
            let trueMessages = [...(profile.messages || [])];
            if (guild && trueMessages.length < 10) {
                try {
                    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(5);
                    for (const channel of textChannels) {
                        const msgs = await channel.messages.fetch({ limit: 100 }).catch(() => new Map());
                        const userMsgs = msgs.filter(m => m.author.id === userId);
                        userMsgs.forEach(m => {
                            if (!trueMessages.find(tm => tm.content === m.content)) {
                                trueMessages.push({
                                    content: m.content,
                                    channel: channel.name,
                                    time: m.createdAt.toISOString()
                                });
                            }
                        });
                    }
                    trueMessages.sort((a, b) => new Date(a.time) - new Date(b.time));
                    trueMessages = trueMessages.slice(-100);
                } catch(e) {}
            }
            
            socket.emit('userProfileData', {
                id: user.id,
                tag: user.tag,
                avatar: user.displayAvatarURL({ dynamic: true, size: 256 }),
                createdAt: user.createdAt.toLocaleDateString(),
                voiceTime: profile.voiceTime,
                msgCount: profile.msgCount > 0 ? profile.msgCount : trueMessages.length,
                messages: trueMessages,
                dms: trueDms,
                warns: (db.warnings && db.warnings[userId]) ? db.warnings[userId] : 0,
                invites: (db.invite_history) ? db.invite_history.filter(i => i.inviterId === userId).length : 0,
                roles: member ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ name: r.name, color: r.hexColor })) : []
            });
        } catch(e) {
            socket.emit('userProfileError', 'Utilisateur introuvable via l\'API Discord.');
        }
    });

    // OSINT: Obtenir tous les membres (Annuaire interactif)
    socket.on('getMembers', async () => {
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;
            const fetchedMembers = await guild.members.fetch();
            
            const membersList = fetchedMembers.map(m => {
                return {
                    id: m.id,
                    tag: m.user.tag,
                    avatar: m.user.displayAvatarURL({ dynamic: true, size: 64 }),
                    joinedAt: m.joinedAt.toLocaleDateString(),
                    joinedTimestamp: m.joinedTimestamp || 0,
                    highestRolePosition: m.roles.highest ? m.roles.highest.position : 0,
                    roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ name: r.name, color: r.hexColor }))
                };
            }).sort((a,b) => {
                if (b.highestRolePosition !== a.highestRolePosition) {
                    return b.highestRolePosition - a.highestRolePosition; // Plus haut rôle en premier
                }
                return b.joinedTimestamp - a.joinedTimestamp; // Plus récents en premier
            });
            
            socket.emit('membersList', membersList);
        } catch(e) {
            console.error("Erreur getMembers", e);
        }
    });

    // OSINT: Actions Manuelles (Ban / Quarantaine)
    socket.on('osintAction', async (data) => {
        try {
            const guild = client.guilds.cache.first();
            if (!guild) return;
            const member = await guild.members.fetch(data.userId).catch(()=>null);
            if (!member) return;

            if (data.action === 'ban') {
                await member.ban({ reason: 'OSINT Dashboard : Bannissement Manuel' });
                const db = getDb();
                if(!db.security_logs) db.security_logs = [];
                const log = { type: 'BAN', date: new Date().toISOString(), user: member.user.tag, reason: 'Banni manuellement via OSINT Profil.' };
                db.security_logs.push(log);
                saveDb(db);
                io.emit('securityAlert', log);
            } else if (data.action === 'quarantine') {
                await member.roles.set([]);
                const db = getDb();
                if(!db.security_logs) db.security_logs = [];
                const log = { type: 'QUARANTAINE', date: new Date().toISOString(), user: member.user.tag, reason: 'Permissions retirées via OSINT Profil.' };
                db.security_logs.push(log);
                saveDb(db);
                io.emit('securityAlert', log);
            }
        } catch(e) {
            console.error("Erreur action OSINT:", e);
        }
    });
});

// --- DISCORD CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

const invitesCache = new Map();
const ROOT_ADMINS = ['1516739861636448355']; // The main admin ID. User can add more in code.
const adminProfiles = [];

function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
    }
    return matrix[b.length][a.length];
}

function getDb() {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDb(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getDbStats() {
    const db = getDb();
    
    // Calcul du leaderboard officiel
    let leaderboard = [];
    if (db.invite_history && db.invite_history.length > 0) {
        const counts = {};
        db.invite_history.forEach(inv => {
            if (inv.valid !== false) {
                counts[inv.inviterUsername] = (counts[inv.inviterUsername] || 0) + 1;
            }
        });
        leaderboard = Object.entries(counts)
            .map(([username, uses]) => ({ username, uses }))
            .sort((a, b) => b.uses - a.uses);
    }

    return {
        invites: db.invite_history ? db.invite_history.length : 0,
        warns: db.invite_warns ? Object.keys(db.invite_warns).length : 0,
        security_logs: db.security_logs ? db.security_logs.length : 0,
        leaderboard: leaderboard
    };
}

client.once('ready', async () => {
    console.log(`🛡️  Security-Bot connecté en tant que ${client.user.tag} !`);
    
    try {
        const commands = [{
            name: 'kickdc',
            description: 'Expulse un Double Compte, avertit le compte principal et le retire du giveaway (Sécurité).',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                {
                    name: 'double_compte',
                    description: 'Le faux compte à expulser',
                    type: 6, // USER type
                    required: true
                },
                {
                    name: 'compte_principal',
                    description: 'Le compte principal du tricheur à avertir/bannir',
                    type: 6, // USER type
                    required: true
                }
            ]
        },
        {
            name: 'repondre',
            description: 'Répondre par message privé (DM) à un utilisateur depuis le bot de sécurité.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'L\'utilisateur à qui envoyer le message (ID ou @Mention)', type: 6, required: true },
                { name: 'message', description: 'Le message à envoyer', type: 3, required: true }
            ]
        },
        {
            name: 'ban',
            description: 'Bannir définitivement un membre du serveur.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à bannir', type: 6, required: true },
                { name: 'raison', description: 'La raison du bannissement', type: 3, required: false }
            ]
        },
        {
            name: 'kick',
            description: 'Expulser un membre du serveur.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à expulser', type: 6, required: true },
                { name: 'raison', description: 'La raison de l\'expulsion', type: 3, required: false }
            ]
        },
        {
            name: 'quarantine',
            description: 'Retirer tous les rôles d\'un membre pour l\'isoler.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à placer en quarantaine', type: 6, required: true },
                { name: 'raison', description: 'La raison de la mise en quarantaine', type: 3, required: false }
            ]
        },
        {
            name: 'warn',
            description: 'Avertir un membre et enregistrer l\'avertissement.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à avertir', type: 6, required: true },
                { name: 'raison', description: 'La raison de l\'avertissement', type: 3, required: true }
            ]
        },
        {
            name: 'clear',
            description: 'Supprimer un nombre précis de messages dans ce salon.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'nombre', description: 'Nombre de messages à supprimer (max 100)', type: 4, required: true }
            ]
        },
        {
            name: 'blacklistgiveaway',
            description: 'Bannir définitivement un membre des Giveaways.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à bannir des giveaways', type: 6, required: true }
            ]
        },
        {
            name: 'unbangiveaway',
            description: 'Débannir un membre des Giveaways.',
            default_member_permissions: String(PermissionFlagsBits.Administrator),
            options: [
                { name: 'utilisateur', description: 'Le membre à débannir des giveaways', type: 6, required: true }
            ]
        }];
        await client.application.commands.set(commands);
        console.log("🛡️  Slash commands de sécurité enregistrées avec succès.");
    } catch (e) {
        console.error("Erreur enregistrement slash commands sécurité:", e);
    }
    for (const [id, guild] of client.guilds.cache) {
        try {
            const invites = await guild.invites.fetch();
            invitesCache.set(id, new Map(invites.map(i => [i.code, i.uses])));
        } catch (err) {}
    }
    
    // Cache admin profiles for anti-impersonation
    for (const adminId of ROOT_ADMINS) {
        try {
            const user = await client.users.fetch(adminId);
            adminProfiles.push({
                id: user.id,
                username: user.username.toLowerCase(),
                avatar: user.avatarURL()
            });
        } catch(e) {}
    }
});

client.on('inviteCreate', invite => {
    const guildInvites = invitesCache.get(invite.guild.id);
    if (guildInvites) guildInvites.set(invite.code, invite.uses);
});

client.on('inviteDelete', invite => {
    const guildInvites = invitesCache.get(invite.guild.id);
    if (guildInvites) guildInvites.delete(invite.code);
});

// --- ANTI-COPY (IMPERSONATION PROTECTION) ---
async function protectAdmins(user, guildMember = null) {
    if (ROOT_ADMINS.includes(user.id)) return;
    
    for (const admin of adminProfiles) {
        const isSameName = user.username.toLowerCase() === admin.username;
        const isSameAvatar = user.avatarURL() && user.avatarURL() === admin.avatar;
        
        if (isSameName || isSameAvatar) {
            const reason = "USURPATION D'IDENTITÉ : Tentative de copie d'un Administrateur Root (Pseudo ou Avatar similaire).";
            
            const db = getDb();
            if(!db.security_logs) db.security_logs = [];
            db.security_logs.push({ type: 'ANTI_COPY', date: new Date().toISOString(), user: user.tag, reason });
            saveDb(db);
            io.emit('securityAlert', { type: 'ANTI_COPY', user: user.tag, reason });

            if (guildMember) {
                await guildMember.ban({ reason }).catch(()=>{});
            } else {
                const guild = client.guilds.cache.first();
                if (guild) {
                    const member = await guild.members.fetch(user.id).catch(()=>{});
                    if (member) await member.ban({ reason }).catch(()=>{});
                }
            }
            return true;
        }
    }
    return false;
}

client.on('userUpdate', async (oldUser, newUser) => {
    await protectAdmins(newUser);
});

// --- ANTI DOUBLE COMPTE ---
client.on('guildMemberAdd', async member => {
    const isImpersonator = await protectAdmins(member.user, member);
    if (isImpersonator) return; // Déjà banni

    let usedInvite = null;
    try {
        const newInvites = await member.guild.invites.fetch();
        const oldInvites = invitesCache.get(member.guild.id);
        
        if (oldInvites) {
            usedInvite = newInvites.find(i => i.uses > (oldInvites.get(i.code) || 0));
            newInvites.forEach(invite => oldInvites.set(invite.code, invite.uses));
        }
    } catch (err) {}

    if (usedInvite && usedInvite.inviter) {
        const inviter = usedInvite.inviter;
        const creationAgeMs = Date.now() - member.user.createdTimestamp;
        const ageInDays = creationAgeMs / (1000 * 60 * 60 * 24);
        
        const pseudoInvited = member.user.username.toLowerCase();
        const pseudoInviter = inviter.username.toLowerCase();
        
        const isSimilar = pseudoInvited.includes(pseudoInviter) || pseudoInviter.includes(pseudoInvited) || levenshtein(pseudoInvited, pseudoInviter) <= 3;
        
        if (ageInDays < 3 || isSimilar) {
            const db = getDb();
            if (!db.invite_warns) db.invite_warns = {};
            if (!db.security_logs) db.security_logs = [];
            
            const logEntry = {
                type: 'ALT_ACCOUNT_INVITE',
                date: new Date().toISOString(),
                inviter: inviter.tag,
                inviterId: inviter.id,
                altAccount: member.user.tag,
                altId: member.user.id,
                reason: `Compte récent (${ageInDays.toFixed(1)} jours) ou pseudo similaire (${isSimilar}).`
            };
            db.security_logs.push(logEntry);
            
            if (!db.invite_warns[inviter.id]) db.invite_warns[inviter.id] = 0;
            db.invite_warns[inviter.id] += 1;
            const warns = db.invite_warns[inviter.id];
            
            saveDb(db);
            io.emit('securityAlert', logEntry);
            
            try {
                if (warns >= 3) {
                    const guildMember = await member.guild.members.fetch(inviter.id);
                    await inviter.send(`🚫 **BANNISSEMENT** : Vous avez été banni du serveur car nous avons détecté 3 fausses invitations (double comptes). Frauder le système de classement est formellement interdit.`).catch(()=>{});
                    await guildMember.ban({ reason: "Fraude massive aux invitations (3 doubles comptes détectés)" });
                    io.emit('securityAlert', { type: 'BAN', target: inviter.tag, reason: '3 avertissements double-compte.' });
                } else {
                    await inviter.send(`⚠️ **AVERTISSEMENT SÉCURITÉ (${warns}/3)** : Le compte \`${member.user.tag}\` que vous venez d'inviter a été détecté comme un faux compte (double compte ou trop récent). Cette invitation a été annulée et ne comptera pas pour le concours. Au bout de 3 avertissements, vous serez automatiquement banni du serveur !`).catch(()=>{});
                }
            } catch (err) {}
            return; 
        } else {
            const db = getDb();
            if (!db.invite_history) db.invite_history = [];
            db.invite_history.push({
                invitedUsername: member.user.username,
                invitedId: member.user.id,
                inviterUsername: inviter.username,
                inviterId: inviter.id,
                timestamp: Date.now(),
                valid: true
            });
            saveDb(db);
        }
    }
});

// --- ANTI-NUKE SYSTEM (PREMIUM) ---
const nukeCache = { bans: new Map(), channels: new Map() };
const NUKE_LIMIT = 3;
const NUKE_TIME = 10000;

async function checkNuke(guild, adminId, type) {
    if (adminId === client.user.id) return; 
    const now = Date.now();
    if (!nukeCache[type].has(adminId)) nukeCache[type].set(adminId, []);
    const actions = nukeCache[type].get(adminId);
    actions.push(now);
    
    while (actions.length > 0 && now - actions[0] > NUKE_TIME) actions.shift();
    
    if (actions.length >= NUKE_LIMIT) {
        try {
            const adminMember = await guild.members.fetch(adminId);
            await adminMember.roles.set([]); // Strip permissions
            await adminMember.ban({ reason: `🔥 SÉCURITÉ ANTI-NUKE DÉCLENCHÉE (${type})` }).catch(()=>{});
            
            const db = getDb();
            if(!db.security_logs) db.security_logs = [];
            const logEntry = { type: 'ANTI_NUKE', date: new Date().toISOString(), user: adminMember.user.tag, reason: `Tentative de destruction (${type} massif). Admin sanctionné.` };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);
            nukeCache[type].delete(adminId);
        } catch(e) {}
    }
}

client.on('guildBanAdd', async ban => {
    try {
        const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
        const log = fetchedLogs.entries.first();
        if (!log || log.target.id !== ban.user.id) return;
        await checkNuke(ban.guild, log.executor.id, 'bans');
    } catch(err) {}
});

client.on('channelDelete', async channel => {
    try {
        const fetchedLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete });
        const log = fetchedLogs.entries.first();
        if (!log || log.target.id !== channel.id) return;
        await checkNuke(channel.guild, log.executor.id, 'channels');
    } catch(err) {}
});

// --- ANTI-RENAME (PREMIUM) ---
client.on('guildUpdate', async (oldGuild, newGuild) => {
    if (oldGuild.name !== newGuild.name) {
        try {
            const fetchedLogs = await newGuild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate });
            const log = fetchedLogs.entries.first();
            if (log && log.executor.id !== client.user.id) {
                await newGuild.edit({ name: oldGuild.name });
                const db = getDb();
                if(!db.security_logs) db.security_logs = [];
                const logEntry = { type: 'ANTI_RENAME', date: new Date().toISOString(), user: log.executor.tag, reason: `Changement de nom du serveur annulé.` };
                db.security_logs.push(logEntry);
                saveDb(db);
                io.emit('securityAlert', logEntry);
            }
        } catch(e) {}
    }
});

// --- OSINT: VOICE TRACKER ---
const voiceSessions = new Map();
client.on('voiceStateUpdate', (oldState, newState) => {
    const userId = newState.id;
    if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(userId, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
        if (voiceSessions.has(userId)) {
            const durationMs = Date.now() - voiceSessions.get(userId);
            const durationMins = Math.round(durationMs / 60000);
            if (durationMins > 0) {
                const db = getDb();
                if (!db.user_profiles) db.user_profiles = {};
                if (!db.user_profiles[userId]) db.user_profiles[userId] = { voiceTime: 0, msgCount: 0, messages: [] };
                db.user_profiles[userId].voiceTime += durationMins;
                saveDb(db);
            }
            voiceSessions.delete(userId);
        }
    }
});

// --- ANTI RAID / ANTI SPAM / ANTI MENTION / OSINT MESSAGES ---
const messageCache = new Map();

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    if (message.channel.type === ChannelType.DM) {
        const dmLog = {
            author: message.author.tag,
            content: message.content,
            time: new Date().toLocaleTimeString()
        };
        saveLog(DM_LOGS_PATH, dmLog);
        io.emit('botDM', dmLog);
        return;
    }
    
    if (!message.guild) return;

    const chatLog = {
        author: message.author.tag,
        content: message.content,
        channel: message.channel.name,
        time: new Date().toLocaleTimeString()
    };
    saveLog(CHAT_LOGS_PATH, chatLog);
    io.emit('chatMessage', chatLog);

    // OSINT Message Logging
    const db = getDb();
    if (!db.user_profiles) db.user_profiles = {};
    if (!db.user_profiles[message.author.id]) db.user_profiles[message.author.id] = { voiceTime: 0, msgCount: 0, messages: [] };
    
    db.user_profiles[message.author.id].msgCount += 1;
    db.user_profiles[message.author.id].messages.push({
        content: message.content,
        channel: message.channel.name,
        time: new Date().toISOString()
    });
    if (db.user_profiles[message.author.id].messages.length > 100) db.user_profiles[message.author.id].messages.shift();
    saveDb(db);

    // 1. Anti Phishing & Scams
    const phishingRegex = /(discord-nitro\.com|dlscord\.gg|nitro-drop|steam-gift|free-nitro)/i;
    if (phishingRegex.test(message.content)) {
        await message.delete().catch(()=>{});
        const db = getDb();
        if(!db.security_logs) db.security_logs = [];
        const logEntry = { type: 'ANTI_PHISHING', date: new Date().toISOString(), user: message.author.tag, reason: `Lien malveillant bloqué et supprimé.` };
        db.security_logs.push(logEntry);
        saveDb(db);
        io.emit('securityAlert', logEntry);
        return;
    }

    // 2. Anti Mass-Mention (Anti-Ping)
    if (message.mentions.users.size > 4) {
        await message.delete().catch(()=>{});
        const db = getDb();
        if(!db.security_logs) db.security_logs = [];
        const logEntry = { type: 'ANTI_MENTION', date: new Date().toISOString(), user: message.author.tag, reason: `Mentions de masse bloquées (Ping Raid).` };
        db.security_logs.push(logEntry);
        saveDb(db);
        io.emit('securityAlert', logEntry);
        try {
            const member = await message.guild.members.fetch(message.author.id);
            await member.timeout(10 * 60 * 1000, "Anti-Mention: Pings de masse");
        } catch(e) {}
        return;
    }

    // 3. Anti Spam (Rate Limiter)
    const authorId = message.author.id;
    const now = Date.now();
    
    if (!messageCache.has(authorId)) messageCache.set(authorId, []);
    const userMessages = messageCache.get(authorId);
    userMessages.push({ content: message.content, time: now });
    
    while(userMessages.length > 0 && now - userMessages[0].time > 5000) {
        userMessages.shift();
    }
    
    if (userMessages.length >= 5) {
        try {
            const member = await message.guild.members.fetch(authorId);
            await member.timeout(10 * 60 * 1000, "Anti-Spam activé (5 messages en 5 secondes)"); 
            await message.channel.send(`⚠️ **ANTI-SPAM** : <@${authorId}> a été rendu muet pour 10 minutes. Motif : Spam intensif.`);
            
            const db = getDb();
            if(!db.security_logs) db.security_logs = [];
            const logEntry = {
                type: 'ANTI_SPAM',
                date: new Date().toISOString(),
                user: message.author.tag,
                reason: 'Spam intensif (5 messages/5sec)'
            };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);
            
            messageCache.delete(authorId);
            const messagesToDelete = await message.channel.messages.fetch({ limit: 5 });
            const spamMsgs = messagesToDelete.filter(m => m.author.id === authorId);
            await message.channel.bulkDelete(spamMsgs);
        } catch(e) {}
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, member, user } = interaction;

    // Check permissions (all of these commands are admin-only)
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Seuls les administrateurs peuvent utiliser cette commande.", ephemeral: true });
    }

    try {
        if (commandName === 'repondre') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = options.getUser('utilisateur');
            const replyMessage = options.getString('message');

            try {
                await targetUser.send(`🛡️ **Message de l'Équipe de Sécurité** :\n\n${replyMessage}`);
                
                // Log it so it appears on the dashboard
                const logEntry = {
                    id: Date.now(),
                    userId: targetUser.id,
                    username: targetUser.tag,
                    avatar: targetUser.displayAvatarURL({ dynamic: true, size: 64 }),
                    content: `(Admin Reply) ${replyMessage}`,
                    channel: 'DM (Admin -> User)',
                    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                };
                if (typeof logToDashboard === 'function') logToDashboard('dm', logEntry);
                
                await interaction.editReply({ content: `✅ Ton message a bien été envoyé en Privé à **${targetUser.username}** !` });
            } catch (e) {
                console.error(e);
                await interaction.editReply({ content: `❌ Impossible d'envoyer un message privé à **${targetUser.username}**. Ses DMs sont probablement fermés.` });
            }
        }
        else if (commandName === 'ban') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');
            const reason = options.getString('raison') || 'Aucune raison spécifiée';
            const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(()=>null);

            if (!targetMember) {
                return interaction.editReply({ content: "❌ Utilisateur introuvable sur le serveur." });
            }
            if (!targetMember.bannable) {
                return interaction.editReply({ content: "❌ Je ne peux pas bannir cet utilisateur (permissions insuffisantes)." });
            }

            await targetMember.ban({ reason: `Banni par ${user.tag} : ${reason}` });
            
            const db = getDb();
            if (!db.security_logs) db.security_logs = [];
            const logEntry = { type: 'BAN', date: new Date().toISOString(), user: targetUser.tag, reason };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);

            await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été banni du serveur.\n**Motif :** ${reason}` });
        }
        else if (commandName === 'kick') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');
            const reason = options.getString('raison') || 'Aucune raison spécifiée';
            const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(()=>null);

            if (!targetMember) {
                return interaction.editReply({ content: "❌ Utilisateur introuvable sur le serveur." });
            }
            if (!targetMember.kickable) {
                return interaction.editReply({ content: "❌ Je ne peux pas expulser cet utilisateur (permissions insuffisantes)." });
            }

            await targetMember.kick(`Expulsé par ${user.tag} : ${reason}`);

            const db = getDb();
            if (!db.security_logs) db.security_logs = [];
            const logEntry = { type: 'KICK', date: new Date().toISOString(), user: targetUser.tag, reason };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);

            await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été expulsé du serveur.\n**Motif :** ${reason}` });
        }
        else if (commandName === 'quarantine') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');
            const reason = options.getString('raison') || 'Aucune raison spécifiée';
            const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(()=>null);

            if (!targetMember) {
                return interaction.editReply({ content: "❌ Utilisateur introuvable sur le serveur." });
            }

            await targetMember.roles.set([]); // Remove all roles

            const db = getDb();
            if (!db.security_logs) db.security_logs = [];
            const logEntry = { type: 'QUARANTAINE', date: new Date().toISOString(), user: targetUser.tag, reason };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);

            await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été mis en quarantaine (tous ses rôles ont été retirés).\n**Motif :** ${reason}` });
        }
        else if (commandName === 'warn') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');
            const reason = options.getString('raison');

            const db = getDb();
            if (!db.invite_warns) db.invite_warns = {};
            if (!db.security_logs) db.security_logs = [];

            db.invite_warns[targetUser.id] = (db.invite_warns[targetUser.id] || 0) + 1;
            const warns = db.invite_warns[targetUser.id];
            
            const logEntry = {
                type: 'WARN',
                date: new Date().toISOString(),
                user: targetUser.tag,
                reason: reason + ` (Avertissement ${warns}/3)`
            };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);

            try {
                if (warns >= 3) {
                    const targetMember = guild.members.cache.get(targetUser.id) || await guild.members.fetch(targetUser.id).catch(()=>null);
                    await targetUser.send(`🚫 **BANNISSEMENT** : Vous avez été banni du serveur car vous avez atteint 3 avertissements (Motif : ${reason}).`).catch(()=>{});
                    if (targetMember && targetMember.bannable) {
                        await targetMember.ban({ reason: `3 avertissements atteints (Dernier motif : ${reason})` });
                    }
                    io.emit('securityAlert', { type: 'BAN', target: targetUser.tag, reason: '3 avertissements atteints.' });
                    await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été banni définitivement car il a atteint 3 avertissements.\n**Dernier motif :** ${reason}` });
                } else {
                    await targetUser.send(`⚠️ **AVERTISSEMENT SÉCURITÉ (${warns}/3)** : Vous avez reçu un avertissement sur le serveur.\n**Motif :** ${reason}`).catch(()=>{});
                    await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été averti (${warns}/3).\n**Motif :** ${reason}` });
                }
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été averti (${warns}/3) mais ses DMs sont fermés.\n**Motif :** ${reason}` });
            }
        }
        else if (commandName === 'clear') {
            await interaction.deferReply({ ephemeral: true });
            const amount = options.getInteger('nombre');

            if (amount < 1 || amount > 100) {
                return interaction.editReply({ content: "❌ Le nombre de messages doit être compris entre 1 et 100." });
            }

            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.editReply({ content: `✅ **${deleted.size}** messages ont été supprimés !` });
        }
        else if (commandName === 'blacklistgiveaway') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');

            const db = getDb();
            if (!db.giveaway_blacklist) db.giveaway_blacklist = [];
            
            if (!db.giveaway_blacklist.includes(targetUser.id)) {
                db.giveaway_blacklist.push(targetUser.id);
                saveDb(db);
            }

            // Remove user from the current giveaways in cache & embeds
            const mainClient = global.mainBotClient;
            if (mainClient) {
                for (const ch of guild.channels.cache.values()) {
                    if (!ch.isTextBased()) continue;
                    try {
                        const messages = await ch.messages.fetch({ limit: 30 }).catch(() => new Map());
                        for (const msg of messages.values()) {
                            if (msg.components && msg.components.length > 0 && msg.components[0].components.length > 0 && msg.components[0].components[0].customId === 'join_giveaway') {
                                if (!mainClient.giveaways) mainClient.giveaways = {};
                                let participants = mainClient.giveaways[msg.id] || [];
                                
                                const embed = EmbedBuilder.from(msg.embeds[0]);
                                let desc = embed.data.description || "";
                                const baseDescIndex = desc.indexOf('**👥 Participants');
                                
                                if (baseDescIndex !== -1) {
                                    if (participants.length === 0) {
                                        const matches = desc.match(/<@(\d+)>/g);
                                        if (matches) participants = matches.map(m => m.replace('<@', '').replace('>', ''));
                                    }
                                    participants = participants.filter(id => id !== targetUser.id);
                                    mainClient.giveaways[msg.id] = participants;
                                    
                                    let participantList = participants.map(id => `<@${id}>`).join(', ');
                                    if (participantList.length > 1000) participantList = participantList.substring(0, 1000) + '... et bien d\'autres !';
                                    
                                    const baseDesc = desc.substring(0, baseDescIndex);
                                    embed.setDescription(`${baseDesc}**👥 Participants (${participants.length}) :**\n${participantList}\n\n*(Nettoyage auto : seuls les membres ayant invité au moins 1 personne sont autorisés. ⚠️ Les Doubles Comptes (DC) = BAN DIRECT !)*`);
                                    await msg.edit({ embeds: [embed] }).catch(()=>{});
                                }
                            }
                        }
                    } catch(e){}
                }
            }

            await interaction.editReply({ content: `🛡️ **${targetUser.tag}** a été banni de tous les Giveaways.` });
        }
        else if (commandName === 'unbangiveaway') {
            await interaction.deferReply({ ephemeral: false });
            const targetUser = options.getUser('utilisateur');

            const db = getDb();
            if (!db.giveaway_blacklist) db.giveaway_blacklist = [];
            
            db.giveaway_blacklist = db.giveaway_blacklist.filter(id => id !== targetUser.id);
            saveDb(db);

            await interaction.editReply({ content: `✅ **${targetUser.tag}** a été débanni des Giveaways. Il peut à nouveau participer.` });
        }
        else if (commandName === 'kickdc') {
            await interaction.deferReply({ ephemeral: false });
            const dcUser = options.getUser('double_compte');
            const mainUser = options.getUser('compte_principal');

            // 1. Kick the DC
            const dcMember = guild.members.cache.get(dcUser.id) || await guild.members.fetch(dcUser.id).catch(()=>null);
            if (dcMember && dcMember.kickable) {
                await dcMember.kick("Double Compte identifié (Triche Giveaway)").catch(()=>{});
            }

            // 2. Warn the main account
            const db = getDb();
            if (!db.invite_warns) db.invite_warns = {};
            if (!db.security_logs) db.security_logs = [];
            if (!db.giveaway_blacklist) db.giveaway_blacklist = [];

            db.invite_warns[mainUser.id] = (db.invite_warns[mainUser.id] || 0) + 1;
            const warns = db.invite_warns[mainUser.id];

            // Blacklist from giveaways immediately
            if (!db.giveaway_blacklist.includes(mainUser.id)) {
                db.giveaway_blacklist.push(mainUser.id);
            }

            const logEntry = {
                type: 'ALT_ACCOUNT_KICK_DC',
                date: new Date().toISOString(),
                inviter: mainUser.tag,
                inviterId: mainUser.id,
                altAccount: dcUser.tag,
                altId: dcUser.id,
                reason: `Double Compte expulsé. Compte principal averti (${warns}/3) et banni des Giveaways.`
            };
            db.security_logs.push(logEntry);
            saveDb(db);
            io.emit('securityAlert', logEntry);

            // Delete all invite links generated by the cheater
            try {
                const allInvites = await guild.invites.fetch();
                let deletedCount = 0;
                for (const inv of allInvites.values()) {
                    if (inv.inviter && inv.inviter.id === mainUser.id) {
                        await inv.delete();
                        deletedCount++;
                    }
                }
                console.log(`Supprimé ${deletedCount} invitations pour ${mainUser.tag}`);
            } catch(e) {
                console.error("Erreur suppression invitations:", e);
            }

            // Remove main account from active giveaways using mainClient
            const mainClient = global.mainBotClient;
            if (mainClient) {
                for (const ch of guild.channels.cache.values()) {
                    if (!ch.isTextBased()) continue;
                    try {
                        const messages = await ch.messages.fetch({ limit: 30 }).catch(() => new Map());
                        for (const msg of messages.values()) {
                            if (msg.components && msg.components.length > 0 && msg.components[0].components.length > 0 && msg.components[0].components[0].customId === 'join_giveaway') {
                                if (!mainClient.giveaways) mainClient.giveaways = {};
                                let participants = mainClient.giveaways[msg.id] || [];
                                
                                const embed = EmbedBuilder.from(msg.embeds[0]);
                                let desc = embed.data.description || "";
                                const baseDescIndex = desc.indexOf('**👥 Participants');
                                
                                if (baseDescIndex !== -1) {
                                    if (participants.length === 0) {
                                        const matches = desc.match(/<@(\d+)>/g);
                                        if (matches) participants = matches.map(m => m.replace('<@', '').replace('>', ''));
                                    }
                                    participants = participants.filter(id => id !== mainUser.id);
                                    mainClient.giveaways[msg.id] = participants;
                                    
                                    let participantList = participants.map(id => `<@${id}>`).join(', ');
                                    if (participantList.length > 1000) participantList = participantList.substring(0, 1000) + '... et bien d\'autres !';
                                    
                                    const baseDesc = desc.substring(0, baseDescIndex);
                                    embed.setDescription(`${baseDesc}**👥 Participants (${participants.length}) :**\n${participantList}\n\n*(Nettoyage auto : seuls les membres ayant invité au moins 1 personne sont autorisés. ⚠️ Les Doubles Comptes (DC) = BAN DIRECT !)*`);
                                    await msg.edit({ embeds: [embed] }).catch(()=>{});
                                }
                            }
                        }
                    } catch(e){}
                }
            }

            // Send notification messages and handle 3-strike ban
            try {
                if (warns >= 3) {
                    const mainMember = guild.members.cache.get(mainUser.id) || await guild.members.fetch(mainUser.id).catch(()=>null);
                    await mainUser.send(`🚫 **BANNISSEMENT** : Vous avez été banni définitivement du serveur car vous avez atteint 3 avertissements pour triche (Double Comptes).`).catch(()=>{});
                    if (mainMember && mainMember.bannable) {
                        await mainMember.ban({ reason: "Triche massive aux invitations (3 doubles comptes détectés)" });
                    }
                    io.emit('securityAlert', { type: 'BAN', target: mainUser.tag, reason: '3 avertissements de triche (DC).' });
                    await interaction.editReply({ content: `🛡️ **Action effectuée :**\n- Double compte \`${dcUser.tag}\` expulsé.\n- Compte principal \`${mainUser.tag}\` **BANNI DÉFINITIVEMENT** du serveur (3/3 avertissements).\n- Toutes ses invitations ont été supprimées.` });
                } else {
                    await mainUser.send(`⚠️ **AVERTISSEMENT SÉCURITÉ (${warns}/3) & EXCLUSION GIVEAWAY** : Le compte \`${dcUser.tag}\` que vous avez invité a été identifié comme votre double compte. Il a été expulsé, vos invitations supprimées, et vous avez été **banni définitivement des Giveaways**. Au bout de 3 avertissements, vous serez banni du serveur.`).catch(()=>{});
                    await interaction.editReply({ content: `🛡️ **Action effectuée :**\n- Double compte \`${dcUser.tag}\` expulsé.\n- Compte principal \`${mainUser.tag}\` averti (**${warns}/3**) et banni définitivement des Giveaways.\n- Toutes ses invitations ont été supprimées de Discord.` });
                }
            } catch(err) {
                console.error(err);
                await interaction.editReply({ content: `🛡️ **Action effectuée :**\n- Double compte \`${dcUser.tag}\` expulsé.\n- Compte principal \`${mainUser.tag}\` averti (**${warns}/3**) (DMs fermés) et banni des Giveaways.\n- Invitations supprimées.` });
            }
        }
    } catch (error) {
        console.error("Erreur exécution commande de sécurité :", error);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ Une erreur technique est survenue lors de l'exécution de la commande." }).catch(()=>{});
        } else {
            await interaction.reply({ content: "❌ Une erreur technique est survenue lors de l'exécution de la commande.", ephemeral: true }).catch(()=>{});
        }
    }
});

client.login(TOKEN);
return { logToDashboard };
};
