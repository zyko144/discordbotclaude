const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { consumeQuota, getRemainingQuota } = require('./utils/quota');

let rawKeys = process.env.GEMINI_API_KEYS || '';
let apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
let currentKeyIndex = 0;

function getGeminiModel() {
  if (apiKeys.length === 0) return null;
  const genAI = new GoogleGenerativeAI(apiKeys[currentKeyIndex]);
  return genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: "Tu es l'assistant IA officiel de ce serveur Discord. Tu es poli, intelligent et rapide. Tu aides les utilisateurs dans leurs projets. IMPORTANT : Si l'utilisateur te demande spécifiquement de générer, dessiner ou afficher une image pour lui MAINTENANT, tu dois inventer un prompt en anglais et répondre UNIQUEMENT avec le format exact `[IMAGE: ton prompt en anglais]`. Mais attention : si l'utilisateur te demande juste de lui écrire ou de lui donner un prompt (ex: 'donne-moi un prompt pour Midjourney'), réponds normalement avec du texte sans utiliser la balise [IMAGE:]."
  });
}

const aiSessions = new Map(); // userId -> chatSession

// --- SERVER EXPRESS (Keep-Alive pour Render) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
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
    GatewayIntentBits.GuildPresences
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

client.once('ready', async () => {
  console.log('🤖 Mega-Bot connecté en tant que ' + client.user.tag + ' ! Prêt pour Render avec 30+ commandes.');

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
  const guild = client.guilds.cache.first();
  if (guild) {
    let premiumRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('premium') || r.name.toLowerCase().includes('vip'));
    
    // 1. Verrouiller la catégorie "Espace VIP"
    let vipCategory = guild.channels.cache.find(c => c.name.toLowerCase().includes('espace vip') && c.type === ChannelType.GuildCategory);
    if (vipCategory) {
      try {
        let overwrites = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel], // Caché pour les membres normaux
          }
        ];
        if (premiumRole) {
          overwrites.push({
            id: premiumRole.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages], // Visible pour les VIP
          });
        }
        await vipCategory.permissionOverwrites.set(overwrites);
        
        // Synchroniser tous les salons enfants avec la catégorie (pour être sûr qu'ils héritent de la permission)
        const children = guild.channels.cache.filter(c => c.parentId === vipCategory.id);
        for (const [id, channel] of children) {
          await channel.lockPermissions().catch(() => {});
        }
      } catch (err) {
        console.error('Impossible de sécuriser la catégorie VIP:', err);
      }
    }
    
    // 1.5. Verrouiller la catégorie "Administration"
    let adminCategory = guild.channels.cache.find(c => c.name.toLowerCase().includes('admin') && c.type === ChannelType.GuildCategory);
    if (adminCategory) {
      try {
        let overwrites = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel], // Caché pour tout le monde (sauf les admins du serveur qui voient tout par défaut)
          }
        ];
        await adminCategory.permissionOverwrites.set(overwrites);
        
        // Synchroniser tous les salons enfants avec la catégorie Administration
        const adminChildren = guild.channels.cache.filter(c => c.parentId === adminCategory.id);
        for (const [id, channel] of adminChildren) {
          await channel.lockPermissions().catch(() => {});
        }
      } catch (err) {
        console.error('Impossible de sécuriser la catégorie Admin:', err);
      }
    }

    // 2. Création ou vérification du salon avantages-vip (Visible par TOUT LE MONDE)
    let avantagesChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('avantages-vip') && c.type === ChannelType.GuildText);
    if (!avantagesChannel) {
      try {
        avantagesChannel = await guild.channels.create({
          name: '💎-avantages-vip',
          type: ChannelType.GuildText,
          permissionOverwrites: [
            {
              id: guild.id,
              allow: [PermissionFlagsBits.ViewChannel],
              deny: [PermissionFlagsBits.SendMessages], // Tout le monde voit, personne ne parle
            }
          ]
        });
        
        const embed = new EmbedBuilder()
          .setColor(0xCF6B45)
          .setTitle('💎  AVANTAGES EXCLUSIFS VIP')
          .setDescription("Débloquez la pleine puissance de l'Intelligence Artificielle en devenant membre Premium de Claude+. Voici vos super-pouvoirs :\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
          .addFields(
            { name: "🎥 Résumé YouTube (`/youtube`)", value: "Faites résumer n'importe quelle longue vidéo YouTube en quelques secondes.", inline: false },
            { name: "💻 Coach Développeur (`/code_review`)", value: "Faites analyser, débugger et corriger votre code par un CTO IA virtuel.", inline: false },
            { name: "✍️ Copywriter Pro (`/copywriter`)", value: "Réécrivez vos brouillons en textes hypnotiques, sans fautes et professionnels.", inline: false },
            { name: "🎨 Créateur d'Images 8K (`/imagine_pro`)", value: "Générez des images en qualité maximale sans file d'attente.", inline: false },
            { name: "🚀 Sans Limites", value: "Vos requêtes sont prioritaires sur le serveur !", inline: false }
          )
          .setFooter({ text: "Soutenez le serveur et obtenez le rôle Premium !" });
          
        await avantagesChannel.send({ embeds: [embed] });
      } catch (err) {
        console.error('Impossible de créer le salon avantages VIP:', err);
      }
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
      await message.channel.sendTyping();
      const userId = message.author.id;
      
      let attempt = 0;
      let success = false;
      let aiResponse = "";
      
      while (attempt < apiKeys.length && !success) {
        try {
          if (!aiSessions.has(userId)) {
            const model = getGeminiModel();
            let history = [];
            
            try {
              // Récupération intelligente de l'historique Discord pour restaurer la mémoire après un redémarrage
              const messages = await message.channel.messages.fetch({ limit: 30, before: message.id });
              
              // Discord renvoie du plus récent au plus ancien, on inverse pour l'ordre chronologique
              const validMessages = Array.from(messages.values())
                .filter(msg => msg.author.id === userId || msg.author.id === client.user.id)
                .reverse();
              
              for (const msg of validMessages) {
                let text = msg.content;
                if (!text && msg.attachments.size > 0) {
                  text = "[Fichier attaché envoyé]";
                }
                
                // Nettoyage des balises de footer pour ne pas polluer la mémoire de l'IA
                if (text) {
                  text = text.replace(/\n\n\*⚡.*requêtes IA restantes aujourd'hui\*/g, '').trim();
                  
                  // Assurer que le texte n'est pas vide après nettoyage
                  if (text.length > 0) {
                    history.push({
                      role: msg.author.id === client.user.id ? "model" : "user",
                      parts: [{ text: text }]
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Erreur lors de la récupération de l'historique Discord:", err);
            }

            const chatSession = model.startChat({ history: history });
            aiSessions.set(userId, chatSession);
          }
          
          const chatSession = aiSessions.get(userId);
          const result = await chatSession.sendMessage(message.content);
          aiResponse = result.response.text();
          success = true;
        } catch (apiError) {
          console.error(`[Clé ${currentKeyIndex}] Erreur Gemini:`, apiError.message);
          
          let preservedHistory = [];
          if (aiSessions.has(userId)) {
            try {
              preservedHistory = await aiSessions.get(userId).getHistory();
            } catch (e) {}
          }

          currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
          attempt++;
          
          const model = getGeminiModel();
          if (model) {
            const newSession = model.startChat({ history: preservedHistory });
            aiSessions.set(userId, newSession);
          } else {
            aiSessions.delete(userId);
          }
          
          // Anti-spam en cas d'erreur 503 (Server Overload)
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (success) {
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
      } else {
        await message.reply("❌ Désolé, mes serveurs sont actuellement surchargés (beaucoup de requêtes à la fois). Réessaie dans une minute ! ⚡").catch(() => {});
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

  // --- Leveling System ---
  const userId = message.author.id;
  if (!db.levels[userId]) {
    db.levels[userId] = { xp: 0, level: 1, lastMessageTime: 0 };
  }

  const now = Date.now();
  // Cooldown de 60 secondes pour gagner de l'XP
  if (now - db.levels[userId].lastMessageTime > 60000) {
    const xpGained = Math.floor(Math.random() * 11) + 15; // 15 à 25 XP
    db.levels[userId].xp += xpGained;
    db.levels[userId].lastMessageTime = now;

    const nextLevelXp = db.levels[userId].level * 100;
    if (db.levels[userId].xp >= nextLevelXp) {
      db.levels[userId].level += 1;
      db.levels[userId].xp -= nextLevelXp; // Keep leftover XP
      
      const levelUpEmbed = new EmbedBuilder()
        .setColor(0xCF6B45)
        .setTitle('🎉 Montée en Niveau !')
        .setDescription(`Félicitations <@${userId}>, tu viens d'atteindre le **Niveau ${db.levels[userId].level}** !`);
      
      await message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {});
    }
    
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  }



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

  // Anti-ping Staff in Tickets
  if (message.channel.name.startsWith('ticket-') && !message.author.bot) {
    if (message.mentions.users.size > 0 || message.mentions.roles.size > 0) {
      const warnEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⚠️  Prévention Anti-Ping')
        .setDescription([
          "Merci de ne pas mentionner le Staff dans les tickets.",
          "Une alerte automatique a déjà été envoyée lors de l'ouverture du salon.",
          "",
          "**Veuillez patienter, nous répondrons dès que possible.**"
        ].join('\n'));
      await message.channel.send({ content: "<@" + message.author.id + ">", embeds: [warnEmbed] });
    }
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
    if (interaction.customId === 'join_giveaway') {
      if (!client.giveaways) client.giveaways = {};
      if (!client.giveaways[interaction.message.id]) client.giveaways[interaction.message.id] = [];
      
      const participants = client.giveaways[interaction.message.id];
      if (!participants.includes(interaction.user.id)) {
        participants.push(interaction.user.id);
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
      
      const guild = interaction.guild;
      // Chercher la catégorie "🎫 TICKETS EN COURS"
      let category = guild.channels.cache.find(c => c.name === '🎫 TICKETS EN COURS' && c.type === ChannelType.GuildCategory);
      if(!category) category = await guild.channels.create({ name: '🎫 TICKETS EN COURS', type: ChannelType.GuildCategory });
      
      const channelName = 'ticket-' + interaction.user.username.toLowerCase();
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
      await interaction.reply({ content: '✅ Ton ticket a été ouvert : <#' + ticketChannel.id + '>', ephemeral: true });
    }
    
    if (interaction.customId === 'close_ticket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Seul le staff peut fermer un ticket.', ephemeral: true });
      }
      await interaction.reply({ content: '🔒 Le ticket se fermera dans 5 secondes...' });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
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

client.login(TOKEN);
