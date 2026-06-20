const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();
const discordTranscripts = require('discord-html-transcripts');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const { consumeQuota, getRemainingQuota } = require('./utils/quota');

let rawKeys = process.env.GEMINI_API_KEYS || '';
let apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

let vertexModelInstance = null;
let vertexInitialized = false;

function getGeminiModel() {
  const sysInstr = "Tu es l'assistant IA officiel de ce serveur Discord, doté d'un Q.I de 180 et des compétences d'un Staff Engineer de la Silicon Valley. Tu es poli, extrêmement intelligent et concis. RÈGLE ABSOLUE POUR LE CODE : Tu es l'ultime expert en développement (Web, Backend, IA, DevOps). Quand on te demande du code, tu écris du code d'une qualité exceptionnelle, niveau production, commenté, typé et optimisé. Tu ne dois JAMAIS utiliser de code à trou ou de raccourcis. Ne mets jamais de commentaires comme '// suite du code' ou '...'. Tu dois OBLIGATOIREMENT écrire l'intégralité du code demandé de A à Z, sans aucune coupure, même si le code fait des centaines de lignes. Si le code est long, découpe-le en plusieurs blocs logiques bien expliqués. Utilise toujours les meilleures pratiques modernes (ex: ES6+, typage strict, architecture propre). IMPORTANT : Si l'utilisateur te demande de générer une image MAINTENANT, invente un prompt anglais et réponds avec `[IMAGE: ton prompt]`. Sinon, réponds normalement avec l'expertise d'un vétéran du code.";
  
  // Priorité 1 : Vertex AI (Gemini 3.1 Pro via le fichier JSON)
  if (process.env.VERTEX_CREDENTIALS_JSON) {
    if (!vertexInitialized) {
      try {
        const creds = JSON.parse(process.env.VERTEX_CREDENTIALS_JSON);
        
        // GoogleGenAI SDK (Vertex mode) automatically uses GOOGLE_APPLICATION_CREDENTIALS
        const tmpCredsPath = path.join(process.cwd(), 'vertex_credentials.json');
        fs.writeFileSync(tmpCredsPath, process.env.VERTEX_CREDENTIALS_JSON);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpCredsPath;
        
        vertexModelInstance = new GoogleGenAI({
            vertexai: true,
            project: creds.project_id,
            location: 'global' // Reverting to global as 3.1 Pro Preview usually sits there on Vertex AI
        });
        vertexInitialized = true;
      } catch (err) {
        console.error("Erreur d'initialisation GoogleGenAI Vertex:", err);
      }
    }
    if (vertexModelInstance) return { type: 'genai_vertex', client: vertexModelInstance, sysInstr };
  }

  // Priorité 2 : Fallback sur l'API Key classique (AI Studio)
  if (apiKeys.length === 0) return null;
  const genAI = new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });
  return { type: 'genai_studio', client: genAI, sysInstr };
}

const aiSessions = new Map(); // userId -> chatSession
const activeTicketCreations = new Set(); // Prevent double-click ticket race conditions

// --- SERVER EXPRESS (Keep-Alive pour Render) ---
const app = express();
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const dashPath = require('path').join(__dirname, 'dashboard.html');
  res.send(require('fs').readFileSync(dashPath, 'utf8'));
});

app.get('/api/invites', async (req, res) => {
  console.log("API /api/invites appelee");
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.log("No guild found");
    return res.json({ leaderboard: [], history: [] });
  }
  
  try {
    console.log("Fetching invites...");
    const invites = await guild.invites.fetch();
    console.log(`Fetched ${invites.size} invites`);
    const rawLeaderboard = invites
      .filter(i => i.uses > 0 && i.inviter)
      .map(i => ({ username: i.inviter.username, uses: i.uses }));
      
    const map = new Map();
    for (const item of rawLeaderboard) {
      map.set(item.username, (map.get(item.username) || 0) + item.uses);
    }
    
    const mergedLeaderboard = [];
    map.forEach((uses, username) => mergedLeaderboard.push({ username, uses }));
    mergedLeaderboard.sort((a, b) => b.uses - a.uses);

    console.log("Reading DB...");
    const dbPath = './database.json';
    let history = [];
    if (fs.existsSync(dbPath)) {
       const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
       history = db.invite_history || [];
    }
    
    console.log("Sending JSON response");
    res.json({ leaderboard: mergedLeaderboard.slice(0, 10), history: history });
  } catch (err) {
    console.log("Erreur API invites:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- API LOGS ---
app.get('/api/logs', (req, res) => {
  const logFile = require('path').join(__dirname, 'chat_logs.json');
  if (require('fs').existsSync(logFile)) {
    res.setHeader('Content-Type', 'application/json');
    res.send(require('fs').readFileSync(logFile, 'utf8'));
  } else {
    res.json({});
  }
});
app.get('/logs', (req, res) => {
  res.send(require('fs').readFileSync(require('path').join(__dirname, 'dashboard.html'), 'utf8'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🌍 Serveur web lancé sur le port ' + PORT));

// --- CONFIGURATION DISCORD ---
const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildInvites
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Load Commands
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const mod = require('./commands/' + file);
    if (Array.isArray(mod)) {
        for (const cmd of mod) {
            client.commands.set(cmd.name, require('./commands/' + file));
        }
    }
}

// IDs (à ajuster si besoin)
const ROLE_NOUVEAU = '1516710281919729705';
const TICKET_CATEGORY = '1516710473817653320'; // ID de la catégorie "🎫 TICKETS EN COURS" (il faut la récupérer)
// J'utilise le nom de la catégorie pour trouver la bonne plus tard dynamiquement.

const REACTION_ROLES = {
  '💻': '1516710272792920125', // Développeur
  '🤖': '1516710275896836147', // Passionné IA
  '📖': '1516710278723665995'  // Apprenant
};

// Anti-Ping Mots interdits
const BANNED_PINGS = ['1xpj', '1xpj2', '6t2b'];
const dbPath = './database.json';

// --- EVENTS ---

const invitesCache = new Map();

client.once('ready', async () => {
  console.log('🤖 Mega-Bot connecté en tant que ' + client.user.tag + ' ! Prêt pour Render avec 30+ commandes.');
  
  // Cache invites for all guilds
  for (const [id, g] of client.guilds.cache) {
    try {
      const firstInvites = await g.invites.fetch();
      invitesCache.set(id, new Map(firstInvites.map((invite) => [invite.code, invite.uses])));
    } catch (err) {
      console.log(`Cannot fetch invites for guild: ${id}`);
    }
  }

  const guild = client.guilds.cache.first();
  if (guild) {
    // --- DISCORD DATABASE (Restauration & Backup Persistant) ---
    try {
      let adminCategory = guild.channels.cache.find(c => c.name.toLowerCase().includes('admin') && c.type === ChannelType.GuildCategory);
      if (!adminCategory) adminCategory = await guild.channels.create({ name: '🛠️ ADMINISTRATION', type: ChannelType.GuildCategory });

      let dbChannel = guild.channels.cache.find(c => c.name === '💾-database-logs');
      if (!dbChannel) {
        dbChannel = await guild.channels.create({
          name: '💾-database-logs',
          type: ChannelType.GuildText,
          parent: adminCategory.id,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
          ]
        });
      }

      // Restauration au démarrage
      const messages = await dbChannel.messages.fetch({ limit: 10 });
      const lastBackup = messages.find(m => m.attachments.size > 0 && m.attachments.first().name === 'chat_logs.json');
      if (lastBackup) {
        try {
          const res = await fetch(lastBackup.attachments.first().url);
          const data = await res.text();
          
          let existingData = {};
          if (require('fs').existsSync('./chat_logs.json')) {
            try { existingData = JSON.parse(require('fs').readFileSync('./chat_logs.json', 'utf8')); } catch(e){}
          }
          const backupData = JSON.parse(data);
          
          // Fusionner les données pour ne perdre ni le backup, ni les nouveaux messages reçus pendant le boot
          for (const key in backupData) {
             if (!existingData[key]) existingData[key] = backupData[key];
             else {
               const existingIds = new Set(existingData[key].messages.map(m => m.timestamp));
               backupData[key].messages.forEach(m => {
                 if (!existingIds.has(m.timestamp)) existingData[key].messages.push(m);
               });
               existingData[key].messages.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
             }
          }
          require('fs').writeFileSync('./chat_logs.json', JSON.stringify(existingData, null, 2));
          console.log("💾 Base de données restaurée et fusionnée avec succès depuis Discord !");
        } catch(e) { console.error("Erreur téléchargement DB:", e); }
      }

      // Backup automatique toutes les 2 minutes
      setInterval(async () => {
        if (require('fs').existsSync('./chat_logs.json')) {
          try {
            await dbChannel.send({
              content: `Sauvegarde auto - ${new Date().toLocaleString()}`,
              files: ['./chat_logs.json']
            });
            // Nettoyage des anciens messages pour ne pas saturer le salon
            const allMsgs = await dbChannel.messages.fetch({ limit: 50 });
            if (allMsgs.size > 5) {
              const toDelete = Array.from(allMsgs.values()).slice(5);
              await dbChannel.bulkDelete(toDelete).catch(()=>{});
            }
          } catch(e) {}
        }
      }, 2 * 60 * 1000);
    } catch (e) {
      console.error("Erreur Discord DB:", e);
    }
  }

  // Live Stats (Toutes les 10 minutes)
  const updateStats = async () => {
    try {
      const guild = client.guilds.cache.first();
      if (!guild) return;
      
      // Récupération ou création de la catégorie Statistiques
      let statsCategory = guild.channels.cache.find(c => c.name === '📊 STATISTIQUES' && c.type === ChannelType.GuildCategory);
      if (!statsCategory) {
        statsCategory = await guild.channels.create({
          name: '📊 STATISTIQUES',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.Connect], // Empêcher de rejoindre les salons vocaux
            }
          ]
        }).catch(() => null);
      }
      
      const categoryId = statsCategory ? statsCategory.id : null;
      const memberCount = guild.memberCount;
      const onlineCount = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;
      const remainingQuota = getRemainingQuota();

      // Membres
      let membersChannel = guild.channels.cache.find(c => c.name.startsWith('👥 Membres :'));
      if (!membersChannel && categoryId) {
        membersChannel = await guild.channels.create({ name: `👥 Membres : ${memberCount}`, type: ChannelType.GuildVoice, parent: categoryId }).catch(() => null);
      } else if (membersChannel && membersChannel.name !== `👥 Membres : ${memberCount}`) {
        await membersChannel.setName(`👥 Membres : ${memberCount}`).catch(() => {});
      }

      // En ligne
      let onlineChannel = guild.channels.cache.find(c => c.name.startsWith('🟢 En ligne :'));
      if (!onlineChannel && categoryId) {
        onlineChannel = await guild.channels.create({ name: `🟢 En ligne : ${onlineCount}`, type: ChannelType.GuildVoice, parent: categoryId }).catch(() => null);
      } else if (onlineChannel && onlineChannel.name !== `🟢 En ligne : ${onlineCount}`) {
        await onlineChannel.setName(`🟢 En ligne : ${onlineCount}`).catch(() => {});
      }

      // Quota IA
      let quotaChannel = guild.channels.cache.find(c => c.name.startsWith('🤖 Requêtes IA :'));
      if (!quotaChannel && categoryId) {
        quotaChannel = await guild.channels.create({ name: `🤖 Requêtes IA : ${remainingQuota}`, type: ChannelType.GuildVoice, parent: categoryId }).catch(() => null);
      } else if (quotaChannel && quotaChannel.name !== `🤖 Requêtes IA : ${remainingQuota}`) {
        await quotaChannel.setName(`🤖 Requêtes IA : ${remainingQuota}`).catch(() => {});
      }
      
    } catch (e) {
      console.error("Erreur update stats", e);
    }
  };
  
  updateStats();
  setInterval(updateStats, 10 * 60 * 1000);

  // Flux RSS (Toutes les 30 minutes)
  const fetchNews = async () => {
    try {
      const feed = await parser.parseURL('https://coinacademy.fr/actu/intelligence-artificielle/feed/');
      if (feed.items.length > 0) {
        const latest = feed.items[0];
        
        let db = {};
        if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        
        if (latest.title !== db.lastNewsTitle) {
          db.lastNewsTitle = latest.title;
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          
          const guild = client.guilds.cache.first();
          if (!guild) return;
          let newsChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('actualit') && c.type === ChannelType.GuildText);
          
          if (!newsChannel) {
            try {
              newsChannel = await guild.channels.create({
                name: 'actualités-ia',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                  {
                    id: guild.id,
                    deny: [PermissionFlagsBits.SendMessages],
                  }
                ]
              });
            } catch (err) {
              console.error('Impossible de créer le salon actualités:', err);
            }
          }
          
          if (newsChannel) {
            const embed = new EmbedBuilder()
              .setColor(0xCF6B45)
              .setTitle('📰 ' + latest.title)
              .setURL(latest.link)
              .setDescription(latest.contentSnippet ? latest.contentSnippet.substring(0, 200) + '...' : 'Découvrez cette nouvelle actualité !')
              .setFooter({ text: 'Actualités IA Automatiques' })
              .setTimestamp();
            await newsChannel.send({ embeds: [embed] }).catch(() => {});
          }
        }
      }
    } catch (e) {}
  };
  
  // Appel immédiat puis toutes les 30 min
  fetchNews();
  setInterval(fetchNews, 30 * 60 * 1000);
  
  // Sécurisation de la catégorie Espace VIP & Création du salon avantages-vip
  // guild is already declared above
  if (guild) {
    // 1. Catégorie PREMIUM (Espace VIP)
    let premiumRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('premium') || r.name.toLowerCase().includes('vip'));
    let premiumCategory = guild.channels.cache.find(c => (c.name.toLowerCase().includes('espace vip') || c.name.toLowerCase().includes('premium')) && c.type === ChannelType.GuildCategory);
    if (premiumCategory) {
      try {
        let overwrites = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }
        ];
        if (premiumRole) {
          overwrites.push({ id: premiumRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.UseApplicationCommands] });
        }
        await premiumCategory.permissionOverwrites.set(overwrites);
        const children = guild.channels.cache.filter(c => c.parentId === premiumCategory.id);
        for (const [id, channel] of children) {
          await channel.lockPermissions().catch(() => {});
        }
      } catch (err) { console.error('Erreur VIP:', err); }
    }
    
    // 1.5. Catégorie Administration
    let adminCategory = guild.channels.cache.find(c => c.name.toLowerCase().includes('admin') && c.type === ChannelType.GuildCategory);
    if (adminCategory) {
      try {
        await adminCategory.permissionOverwrites.set([{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }]);
        const adminChildren = guild.channels.cache.filter(c => c.parentId === adminCategory.id);
        for (const [id, channel] of adminChildren) {
          await channel.lockPermissions().catch(() => {});
        }
      } catch (err) {}
    }

    // 2. Catégorie BOOSTERS 🚀
    const boosterRole = guild.roles.premiumSubscriberRole;
    if (boosterRole) {
      let boosterCategory = guild.channels.cache.find(c => c.name === '🚀 ESPACE BOOSTERS' && c.type === ChannelType.GuildCategory);
      if (!boosterCategory) {
        try {
          boosterCategory = await guild.channels.create({
            name: '🚀 ESPACE BOOSTERS',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: boosterRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
          });
        } catch (err) { console.error("Erreur création catégorie booster", err); }
      } else {
        // Mettre à jour les permissions au cas où
        await boosterCategory.permissionOverwrites.set([
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: boosterRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]).catch(()=>{});
      }

      if (boosterCategory) {
        // Création des salons enfants
        const channelsToCreate = ['💬-chat-boosters', '🤖-ia-prioritaire-boosters', '🎁-cadeaux-boosters'];
        
        for (const chName of channelsToCreate) {
          let ch = guild.channels.cache.find(c => c.name === chName && c.parentId === boosterCategory.id);
          if (!ch) {
            ch = await guild.channels.create({
              name: chName,
              type: ChannelType.GuildText,
              parent: boosterCategory.id
            }).catch(()=>{});
          }

          // Si c'est le salon cadeaux, envoyer les PDFs si pas déjà envoyés
          if (ch && chName === '🎁-cadeaux-boosters') {
            try {
              const messages = await ch.messages.fetch({ limit: 10 });
              // On vérifie si les 100 Méthodes V2 ont déjà été envoyées
              const hasNewBundle = messages.some(m => m.attachments.size > 0 && m.attachments.some(a => a.name === '100_Methodes_Exclusives_V2.pdf'));
              
              if (!hasNewBundle) {
                 const filesToSend = [];
                 if (require('fs').existsSync('./50_prompts_ia.pdf')) filesToSend.push('./50_prompts_ia.pdf');
                 if (require('fs').existsSync('./Formation_Masterclass_IA.pdf')) filesToSend.push('./Formation_Masterclass_IA.pdf');
                 if (require('fs').existsSync('./100_Methodes_Exclusives_V2.pdf')) filesToSend.push('./100_Methodes_Exclusives_V2.pdf');
                 
                 if (filesToSend.length > 0) {
                   await ch.send({
                     content: "🎉 **CADEAUX EXCLUSIFS DE BOOST !** 🎉\n\nPour vous remercier de soutenir financièrement le serveur, voici vos récompenses :\n\n📚 **1. La Masterclass IA (Formation Complète)** : Découvrez comment fonctionnent les différentes IA, les secrets du Prompt Engineering, et les astuces de génération d'images.\n🔥 **2. Les 50 Méga-Prompts** : Un recueil de prompts avancés pour des projets complexes.\n💎 **3. Les 100 Méthodes Secrètes** : 100 features et tutos pratiques pour forcer l'IA à coder, rédiger et réfléchir comme un génie.\n\n*(Nouveau : Vous avez aussi accès au salon `#🤖-ia-prioritaire-boosters` !)*",
                     files: filesToSend
                   });
                 }
              }
            } catch(e) { console.error("Erreur envoi PDF", e); }
          }
        }
      }
    }

    // 3. Salon Avantages VIP public
    let avantagesChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('avantages-vip') && c.type === ChannelType.GuildText);
    if (!avantagesChannel) {
      try {
        avantagesChannel = await guild.channels.create({
          name: '💎-avantages-vip',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
          ]
        });
        
        const embed = new EmbedBuilder()
          .setColor(0xCF6B45)
          .setTitle('💎  AVANTAGES EXCLUSIFS VIP & BOOSTERS')
          .setDescription("Débloquez la pleine puissance de l'Intelligence Artificielle en devenant membre Premium ou en Boostant le serveur !\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          .addFields(
            { name: "🚀 Avantages Serveur Booster", value: "Catégorie privée, Chat exclusif, et un Ebook PDF offert avec 50 Prompts IA de niveau expert !", inline: false },
            { name: "💻 Coach Développeur (`/code_review`)", value: "Faites analyser, débugger et corriger votre code par un CTO IA virtuel.", inline: false },
            { name: "🎨 Créateur d'Images 8K (`/imagine_pro`)", value: "Générez des images en qualité maximale sans file d'attente.", inline: false }
          )
          .setFooter({ text: "Soutenez le serveur pour obtenir ces avantages !" });
          
        await avantagesChannel.send({ embeds: [embed] });
      } catch (err) { console.error('Erreur VIP:', err); }
    }
  }
});

// Autorole is now manual via Verification Button

// Message et Commandes standards
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- IA Claude Chat (Propulsé par Gemini) ---
  if ((message.channel.type === ChannelType.DM || (message.channel.name && message.channel.name.includes('ia'))) && !message.author.bot) {
    if (apiKeys.length === 0) {
      return message.reply("L'administrateur n'a pas configuré les clés Gemini (GEMINI_API_KEYS) pour que je puisse répondre.");
    }

    try {
      // --- INSTANT USER LOGGING ---
      const userId = message.author.id;
      try {
        const logFile = './chat_logs.json';
        let logs = {};
        if (require('fs').existsSync(logFile)) {
          logs = JSON.parse(require('fs').readFileSync(logFile, 'utf8'));
        }
        if (!logs[userId]) {
          logs[userId] = { username: message.author.username, messages: [] };
        }
        logs[userId].username = message.author.username;
        logs[userId].messages.push({
          role: 'user',
          content: message.content,
          timestamp: new Date().toISOString()
        });
        require('fs').writeFileSync(logFile, JSON.stringify(logs, null, 2));
      } catch (err) {
        console.error("Erreur log instantané:", err);
      }
      
      await message.channel.sendTyping();
      
      let attempt = 0;
      let success = false;
      let aiResponse = "";
      
      while (!success) {
        try {
          const aiData = getGeminiModel();
          if (!aiData) {
              aiResponse = "Erreur: Modèle IA indisponible.";
              break;
          }
          const { type, client: model, sysInstr } = aiData;

          // 1. Récupération intelligente de l'historique Discord
          let history = [];
          try {
            const messages = await message.channel.messages.fetch({ limit: 100, before: message.id });
            const validMessages = Array.from(messages.values())
              .filter(msg => msg.author.id === userId || msg.author.id === client.user.id)
              .reverse();
            
            for (const msg of validMessages) {
              let text = msg.content;
              if (!text && msg.attachments.size > 0) text = "[Fichier attaché envoyé]";
              
              if (text) {
                text = text.replace(/\n\n\*⚡.*requêtes IA restantes aujourd'hui\*/g, '').trim();
                if (text.length > 0) {
                    const role = msg.author.id === client.user.id ? "model" : "user";
                    if (history.length > 0 && history[history.length - 1].role === role) {
                      history[history.length - 1].parts[0].text += '\n\n' + text;
                    } else {
                      history.push({ role: role, parts: [{ text: text }] });
                    }
                }
              }
            }
          } catch (err) {
            console.error("Erreur historique:", err);
          }

          // Correction des alternances strictes pour l'historique de chat GenAI
          if (history.length > 0 && history[0].role === 'model') history.shift();
          if (history.length > 0 && history[history.length - 1].role === 'user') {
            history.push({ role: 'model', parts: [{ text: "J'ai bien pris en compte vos précédents messages." }] });
          }

          if (!aiSessions.has(userId)) {
              // GenAI unified SDK utilise client.chats.create
              const chatSession = model.chats.create({
                  model: 'gemini-2.5-pro',
                  config: {
                      systemInstruction: sysInstr,
                  },
                  history: history
              });
              aiSessions.set(userId, chatSession);
          }
          
          const chatSession = aiSessions.get(userId);
          const result = await chatSession.sendMessage({ message: message.content });
          aiResponse = result.text;
          success = true;
          
        } catch (apiError) {
          console.error(`[Clé ${currentKeyIndex}] Erreur IA:`, apiError.message);
          
          if (process.env.VERTEX_CREDENTIALS_JSON) {
              success = true;
              aiResponse = "⚠️ **Erreur critique Gemini 3.1 Pro (Vertex AI)** : L'API Google Cloud a refusé la connexion.\n\n*Causes probables :*\n1. Tu n'as pas activé l'API Vertex AI sur Google Cloud Console.\n2. Le modèle n'est pas disponible ou la région bloque.\n\n*Détail de l'erreur :* `" + apiError.message + "`";
              break;
          }

          currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
          attempt++;
          aiSessions.delete(userId);
          
          if (attempt >= apiKeys.length) {
            success = true;
            aiResponse = "⚠️ L'intelligence artificielle est temporairement surchargée ou une erreur est survenue.";
            break;
          } else {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
      
      if (success) {
        
        // --- LOGGING ---
        try {
          const logFile = './chat_logs.json';
          let logs = {};
          if (fs.existsSync(logFile)) {
            logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
          }
          if (!logs[userId]) {
            logs[userId] = {
              username: message.author.username,
              messages: []
            };
          }
          logs[userId].username = message.author.username;
          logs[userId].messages.push({
            role: 'model',
            content: aiResponse,
            timestamp: new Date().toISOString()
          });
          fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
        } catch (err) {
          console.error("Erreur de sauvegarde des logs:", err);
        }
        
        let finalResponse = aiResponse.trim();
        
        // Détection de génération d'image
        if (finalResponse.startsWith('[IMAGE:')) {
          const promptMatch = finalResponse.match(/\[IMAGE:\s*(.*?)\]/);
          if (promptMatch && promptMatch[1]) {
            const imagePrompt = encodeURIComponent(promptMatch[1].trim());
            const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1024&height=1024&nologo=true&model=flux`;
            
            const embed = new EmbedBuilder()
              .setTitle("🎨 Voici l'image générée :")
              .setImage(imageUrl)
              .setColor('#CF6B45');
              
            await message.author.send({ embeds: [embed] });
            if (message.channel.type !== ChannelType.DM) {
              await message.reply("📩 Je t'ai envoyé l'image en privé !");
            }
            return;
          }
        }

        // Nettoyage au cas où l'IA mettrait quand même [PRIVATE] par habitude
        let cleanResponse = finalResponse.replace(/\[PRIVATE\]/g, '').trim();

        // Extraction automatique des blocs de code en fichiers pour faciliter la vie des utilisateurs
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        let attachments = [];
        let codeCounter = 1;

        cleanResponse = cleanResponse.replace(codeBlockRegex, (fullMatch, lang, code) => {
          const language = (lang || 'txt').toLowerCase();
          let extension = language;
          if (language === 'python') extension = 'py';
          else if (language === 'javascript' || language === 'js') extension = 'js';
          else if (language === 'typescript' || language === 'ts') extension = 'ts';
          else if (language === 'html') extension = 'html';
          else if (language === 'css') extension = 'css';
          else if (language === 'json') extension = 'json';
          else if (language === 'bash' || language === 'sh') extension = 'sh';
          else if (language === 'markdown' || language === 'md') extension = 'md';
          else if (!extension) extension = 'txt';
          
          const fileName = `code_${codeCounter}.${extension}`;
          const buffer = Buffer.from(code.trim(), 'utf-8');
          attachments.push(new AttachmentBuilder(buffer, { name: fileName }));
          codeCounter++;
          
          return `\n📎 **[Fichier de code généré : ${fileName} - Télécharge-le ci-dessous]**\n`;
        });

        const remaining = consumeQuota();
        const footer = `\n\n*⚡ ${remaining}/12000 requêtes IA restantes aujourd'hui*`;
        const chunks = cleanResponse.match(/[\s\S]{1,1900}/g) || (cleanResponse ? [cleanResponse] : ["Voici vos fichiers :"]);
        
        for (let i = 0; i < chunks.length; i++) {
          let contentToSend = chunks[i];
          if (i === chunks.length - 1) contentToSend += footer;
          
          if (i === chunks.length - 1 && attachments.length > 0) {
            // Discord limite à 10 fichiers par message maximum
            const filesToSend = attachments.slice(0, 10);
            await message.author.send({ content: contentToSend, files: filesToSend });
          } else {
            await message.author.send(contentToSend);
          }
        }
        
        if (message.channel.type !== ChannelType.DM) {
          await message.reply("📩 Je t'ai répondu en privé pour garder ce salon propre ! Tu peux continuer la conversation avec moi là-bas.");
        }
      }
    } catch (error) {
      console.error('Gemini General Error:', error);
      await message.reply("Désolé, j'ai rencontré une erreur imprévue.").catch(() => {});
    }
    return; // On arrête là pour le salon ia/dm
  }

  // --- Database Load ---
  let db = { warnings: {}, levels: {} };
  if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (!db.warnings) db.warnings = {};
  if (!db.levels) db.levels = {};





  // Anti-Ping Alert & Warn System
  const content = message.content.toLowerCase();
  const containsBanned = BANNED_PINGS.some(word => content.includes(word));
  
  if (containsBanned) {
    await message.delete().catch(() => {});
    
    if (!db.warnings[message.author.id]) db.warnings[message.author.id] = [];
    db.warnings[message.author.id].push({ reason: 'Ping illégal (Anti-Ping System)', by: client.user.tag, date: new Date().toISOString() });
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    
    const warnCount = db.warnings[message.author.id].length;
    let replyMsg = '⚠️ <@' + message.author.id + '>, les pings de type 1xpj/6t2b sont strictement interdits ! Avertissement ' + warnCount + '/3.';
    
    if (warnCount >= 3) {
      replyMsg = '🚫 <@' + message.author.id + '> a atteint 3 avertissements (Pings interdits) et a été exclu (Timeout) pour 7 jours.';
      try {
        await message.member.timeout(7 * 24 * 60 * 60 * 1000, '3 Avertissements: Pings illégaux');
        delete db.warnings[message.author.id]; // Reset warns after timeout
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      } catch(e) { console.error('Erreur Timeout', e); }
    }
    
    await message.channel.send(replyMsg);
    return; // Stop here if it was a banned message
  }



});

// Slash Commands & Buttons (Interactions)
client.on('interactionCreate', async interaction => {
  // Slash Commands handler
  if (interaction.isChatInputCommand()) {
    const commandMod = client.commands.get(interaction.commandName);
    if (!commandMod) return;

    try {
      await commandMod.execute(interaction);
    } catch (error) {
      console.error(error);
      if(interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: '❌ Erreur lors de l\'exécution de la commande.', ephemeral: true });
      } else {
          await interaction.reply({ content: '❌ Erreur lors de l\'exécution de la commande.', ephemeral: true });
      }
    }
  }
  
  // Buttons handler (Tickets, Verification, Giveaways)
  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'join_giveaway') {
        if (!client.giveaways) client.giveaways = {};
        if (!client.giveaways[interaction.message.id]) {
          client.giveaways[interaction.message.id] = [];
          
          // Tenter de récupérer les anciens depuis la description (survie au restart !)
          const existingEmbed = interaction.message.embeds[0];
          if (existingEmbed && existingEmbed.description) {
            const matches = existingEmbed.description.match(/<@(\d+)>/g);
            if (matches) {
              const ids = matches.map(m => m.replace('<@', '').replace('>', ''));
              client.giveaways[interaction.message.id] = [...new Set(ids)];
            }
          }
        }
        
        // VÉRIFICATION DES INVITATIONS OBLIGATOIRE
        const invites = await interaction.guild.invites.fetch();
        let hasInvited = false;
        invites.forEach(inv => {
          if (inv.inviter && inv.inviter.id === interaction.user.id && inv.uses > 0) {
            hasInvited = true;
          }
        });

        if (!hasInvited) {
          return interaction.reply({ content: '❌ **Accès refusé :** Tu dois inviter au moins **1 ami** sur le serveur (via ton propre lien) pour pouvoir participer au giveaway !', ephemeral: true });
        }

        const participants = client.giveaways[interaction.message.id];
        if (!participants.includes(interaction.user.id)) {
          participants.push(interaction.user.id);
          
          const embed = require('discord.js').EmbedBuilder.from(interaction.message.embeds[0]);
          let desc = embed.data.description;
          const baseDescIndex = desc.indexOf('**👥 Participants');
          
          if (baseDescIndex !== -1) {
             const baseDesc = desc.substring(0, baseDescIndex);
             let participantList = participants.map(id => `<@${id}>`).join(', ');
             if (participantList.length > 1000) {
                 participantList = participantList.substring(0, 1000) + '... et bien d\'autres !';
             }
             embed.setDescription(`${baseDesc}**👥 Participants (${participants.length}) :**\n${participantList}\n\n*(Nettoyage auto : seuls les membres ayant invité au moins 1 personne sont autorisés)*`);
             await interaction.message.edit({ embeds: [embed] });
          }

          await interaction.reply({ content: '🎉 Tu participes bien au giveaway !', ephemeral: true });
        } else {
          await interaction.reply({ content: 'Tu participes déjà à ce giveaway.', ephemeral: true });
        }
        return;
      }

      if (interaction.customId === 'verify_member') {
        const role = interaction.guild.roles.cache.get(ROLE_NOUVEAU);
        if (role) {
          if (!interaction.member.roles.cache.has(role.id)) {
            await interaction.member.roles.add(role);
            await interaction.reply({ content: '✅ Vérification réussie ! Bienvenue sur le serveur.', ephemeral: true });
          } else {
            await interaction.reply({ content: 'Tu es déjà vérifié.', ephemeral: true });
          }
        }
        return;
      }

    if (interaction.customId.startsWith('ticket_')) {
      const type = interaction.customId.split('_')[1]; // support, booster, premium
      
      const channelName = 'ticket-' + interaction.user.username.toLowerCase();
      
      if (activeTicketCreations.has(interaction.user.id)) {
        return interaction.reply({ content: '⏳ Création en cours... merci de ne pas spammer le bouton.', ephemeral: true });
      }
      activeTicketCreations.add(interaction.user.id);
      
      try {
        const guild = interaction.guild;
        // Chercher la catégorie "🎫 TICKETS EN COURS"
        let category = guild.channels.cache.find(c => c.name === '🎫 TICKETS EN COURS' && c.type === ChannelType.GuildCategory);
        if(!category) category = await guild.channels.create({ name: '🎫 TICKETS EN COURS', type: ChannelType.GuildCategory });
        
        const existingTicket = guild.channels.cache.find(c => c.name === channelName);
        if (existingTicket) {
          activeTicketCreations.delete(interaction.user.id);
          return interaction.reply({ content: `❌ Tu as déjà un ticket d'ouvert ici : <#${existingTicket.id}>. Tu ne peux pas en ouvrir un autre.`, ephemeral: true });
        }
        
        const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Danger)
      );
      
      const attachment = new AttachmentBuilder('./ticket_banner_simple.png');
      const embed = new EmbedBuilder()
        .setTitle('🎫 Nouveau Ticket : ' + type.toUpperCase())
        .setDescription([
          "**Bienvenue dans votre espace privé !**",
          "Un membre de notre équipe s'occupera de vous dans les plus brefs délais.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "",
          "**Comment nous aider à vous répondre plus vite ?**",
          "- Décrivez votre problème avec le plus de détails possible.",
          "- Fournissez des captures d'écran si nécessaire.",
          "- Patientez calmement (inutile de mentionner le staff)."
        ].join('\n'))
        .setColor(0xCF6B45)
        .setImage('attachment://ticket_banner_simple.png')
        .setTimestamp();
        
      await ticketChannel.send({ content: "Bienvenue <@" + interaction.user.id + "> !", embeds: [embed], components: [row], files: [attachment] });
        await interaction.reply({ content: `✅ Ton ticket a été ouvert : ${ticketChannel}`, ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: "❌ Une erreur est survenue lors de la création du ticket.", ephemeral: true });
      } finally {
        setTimeout(() => activeTicketCreations.delete(interaction.user.id), 3000); // Remove lock after 3 seconds
      }
    }
    
    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Seul le staff peut fermer un ticket.', ephemeral: true });
      }
      await interaction.reply({ content: '🔒 Le ticket est en cours de fermeture... Sauvegarde de la conversation.' });
      
      try {
        const attachment = await discordTranscripts.createTranscript(interaction.channel, {
             limit: -1, 
             returnType: 'attachment',
             filename: `transcript-${interaction.channel.name}.html`,
             saveImages: true, 
             poweredBy: false
        });
        
        const members = interaction.channel.members.filter(m => !m.user.bot);
        for (const [id, member] of members) {
            await member.send({
                content: `📁 Voici une copie de ton ticket **${interaction.channel.name}** fermé sur Claude+. Tu peux ouvrir le fichier HTML sur ton navigateur (PC ou Téléphone) pour lire la conversation complète avec le design de Discord.`,
                files: [attachment]
            }).catch(() => {});
        }
      } catch (e) {
        console.error("Erreur lors de la génération du transcript:", e);
      }
      
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
    } catch (e) {
      console.error("Erreur lors du traitement d'un bouton :", e);
    }
  }
});

// Reaction Roles
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.partial) await reaction.message.fetch();
  if (reaction.partial) await reaction.fetch();
  const roleId = REACTION_ROLES[reaction.emoji.name];
  if (roleId) {
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(roleId);
    if (role && member) await member.roles.add(role).catch(() => {});
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.partial) await reaction.message.fetch();
  if (reaction.partial) await reaction.fetch();
  const roleId = REACTION_ROLES[reaction.emoji.name];
  if (roleId) {
    const member = await reaction.message.guild.members.fetch(user.id);
    const role = reaction.message.guild.roles.cache.get(roleId);
    if (role && member) await member.roles.remove(role).catch(() => {});
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

client.on('guildMemberAdd', async member => {
  try {
    const newInvites = await member.guild.invites.fetch();
    const oldInvites = invitesCache.get(member.guild.id);
    let usedInvite = null;

    if (oldInvites) {
      usedInvite = newInvites.find(i => i.uses > (oldInvites.get(i.code) || 0));
      newInvites.forEach(invite => oldInvites.set(invite.code, invite.uses));
    }
    
    if (usedInvite && usedInvite.inviter) {
       const dbPath = './database.json';
       if (fs.existsSync(dbPath)) {
          const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          if (!db.invite_history) db.invite_history = [];
          db.invite_history.push({
             invitedUsername: member.user.username,
             invitedId: member.user.id,
             inviterUsername: usedInvite.inviter.username,
             inviterId: usedInvite.inviter.id,
             timestamp: Date.now()
          });
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
       }
    }

    let welcomeChannel = member.guild.channels.cache.find(c => c.name === '👋-bienvenue');
    if (!welcomeChannel) {
      welcomeChannel = await member.guild.channels.create({
        name: '👋-bienvenue',
        type: ChannelType.GuildText,
        permissionOverwrites: [{ id: member.guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] }]
      }).catch(() => null);
    }

    if (welcomeChannel) {
      const inviterText = usedInvite && usedInvite.inviter 
        ? `Invité par **${usedInvite.inviter.username}** (Lien utilisé **${usedInvite.uses}** fois)` 
        : `Impossible de déterminer qui l'a invité`;

      const embed = new EmbedBuilder()
        .setTitle('🎉 Nouveau Membre !')
        .setDescription(`Bienvenue ${member.user.toString()} sur **${member.guild.name}** !\n\n> 🤝 ${inviterText}`)
        .setColor(0xCF6B45)
        .setThumbnail(member.user.displayAvatarURL());

      await welcomeChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error("Erreur guildMemberAdd", err);
  }
});

client.login(TOKEN);
