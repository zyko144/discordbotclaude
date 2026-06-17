const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { YoutubeTranscript } = require('youtube-transcript');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { consumeQuota } = require('../utils/quota');
require('dotenv').config();

let rawKeys = process.env.GEMINI_API_KEYS || '';
let apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);

async function callVIPAI(prompt, systemInstruction) {
  if (apiKeys.length === 0) return "Désolé, les clés VIP ne sont pas configurées.";
  
  let lastError;
  
  // Boucle rigoureuse sur TOUTES les clés
  let startIndex = Math.floor(Math.random() * apiKeys.length);
  for (let i = 0; i < apiKeys.length; i++) {
    const keyIndex = (startIndex + i) % apiKeys.length;
    try {
      const genAI = new GoogleGenerativeAI(apiKeys[keyIndex]);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest", systemInstruction });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      lastError = e;
      // On attend un peu pour ne pas spammer si Google est capricieux
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.error("VIP AI Error: Toutes les clés ont échoué.", lastError);
  throw new Error("Toutes les clés API sont actuellement épuisées ou surchargées.");
}

function checkVIP(interaction) {
  const member = interaction.member;
  if (!member) return false;
  return member.roles.cache.some(role => 
    role.name.toLowerCase().includes('premium') || 
    role.name.toLowerCase().includes('vip')
  );
}

module.exports = [
  new SlashCommandBuilder().setName('setup_verification')
    .setDescription('Installe le bouton de vérification (Anti-Raid)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('setup_vip')
    .setDescription('Affiche le panneau des avantages VIP')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('setup_roles')
    .setDescription('Installe le panneau de rôles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('setup_tickets')
    .setDescription('Installe le panneau des tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
  new SlashCommandBuilder().setName('rank')
    .setDescription('Affiche ton niveau et ton XP'),
    
  new SlashCommandBuilder().setName('giveaway')
    .setDescription('Lance un tirage au sort')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt => opt.setName('temps').setDescription('Temps en minutes').setRequired(true))
    .addStringOption(opt => opt.setName('lot').setDescription('Le lot à gagner').setRequired(true)),
    
  new SlashCommandBuilder().setName('youtube')
    .setDescription('💎 VIP: Résume une vidéo YouTube')
    .addStringOption(opt => opt.setName('lien').setDescription('Lien de la vidéo YouTube').setRequired(true)),
    
  new SlashCommandBuilder().setName('code_review')
    .setDescription('💎 VIP: Corrige et explique ton code')
    .addStringOption(opt => opt.setName('code').setDescription('Ton code avec le bug').setRequired(true)),
    
  new SlashCommandBuilder().setName('copywriter')
    .setDescription('💎 VIP: Réécrit ton texte comme un pro')
    .addStringOption(opt => opt.setName('texte').setDescription('Le texte à réécrire').setRequired(true)),
    
  new SlashCommandBuilder().setName('imagine_pro')
    .setDescription('💎 VIP: Génère une image de très haute qualité')
    .addStringOption(opt => opt.setName('prompt').setDescription('Description de l\'image').setRequired(true))
];

module.exports.execute = async (interaction) => {
  const { commandName, options, client } = interaction;
  
  if (commandName === 'setup_verification') {
    const embed = new EmbedBuilder()
      .setColor(0xCF6B45)
      .setTitle('🛡️ Vérification Anti-Raid')
      .setDescription("Pour accéder au reste du serveur, veuillez prouver que vous êtes humain en cliquant sur le bouton ci-dessous.");
      
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('verify_member').setLabel('✅ Se vérifier').setStyle(ButtonStyle.Success)
    );
    
    await interaction.channel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: '✅ Panneau de vérification installé.', ephemeral: true });
  }

  if (commandName === 'setup_vip') {
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
      
    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: '✅ Panneau VIP installé.', ephemeral: true });
  }

  if (commandName === 'setup_roles') {
    const embed = new EmbedBuilder()
      .setColor(0xCF6B45)
      .setTitle('🎭  Choisis ton Profil')
      .setDescription('Clique sur les emojis pour recevoir le rôle correspondant :\n\n💻 — **Développeur**\n🤖 — **Passionné IA**\n📖 — **Apprenant**');

    const msg = await interaction.channel.send({ embeds: [embed] });
    await msg.react('💻'); await msg.react('🤖'); await msg.react('📖');
    return interaction.reply({ content: '✅ Panneau de rôles installé.', ephemeral: true });
  }

  if (commandName === 'setup_tickets') {
    const attachment = new AttachmentBuilder('./ticket_banner_simple.png');
    
    const embed = new EmbedBuilder()
      .setColor(0xCF6B45)
      .setTitle('🎫  —  CENTRE DE SUPPORT & TICKETS')
      .setDescription("Bienvenue dans l'espace de support officiel de **Claude+**.\nCliquez sur l'un des boutons ci-dessous pour ouvrir un salon de discussion privé avec notre équipe.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
      .addFields(
        { name: "📌  Règles d'utilisation des tickets", value: "- **Pertinence :** N'ouvrez un ticket qu'en cas de besoin réel.\n- **Courtoisie :** Soyez toujours poli envers le Staff.\n- **Patience :** Ne mentionnez pas le Staff abusivement, nous répondrons au plus vite.\n- **Précision :** Décrivez votre problème clairement dès le premier message.", inline: false },
        { name: "⏱️  Délais de réponse", value: "Notre équipe répond généralement en moins de 24h.", inline: false },
        { name: "⬇️  Choisissez votre service", value: "Sélectionnez le bouton correspondant à votre demande ci-dessous.", inline: false }
      )
      .setImage('attachment://ticket_banner_simple.png');
      
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_support').setLabel('📞 Support Général').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_booster').setLabel('💜 Support Booster').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('ticket_premium').setLabel('💎 Support Premium').setStyle(ButtonStyle.Success)
    );
    
    await interaction.channel.send({ embeds: [embed], components: [row], files: [attachment] });
    return interaction.reply({ content: '✅ Panneau de tickets installé.', ephemeral: true });
  }

  if (commandName === 'rank') {
    const dbPath = './database.json';
    let db = { levels: {} };
    if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    const userId = interaction.user.id;
    if (!db.levels || !db.levels[userId]) {
      return interaction.reply({ content: "Tu n'as pas encore d'XP. Parle un peu pour en gagner !", ephemeral: true });
    }
    
    const userData = db.levels[userId];
    const nextXp = userData.level * 100;
    
    const rankEmbed = new EmbedBuilder()
      .setColor(0xCF6B45)
      .setTitle(`📊 Rang de ${interaction.user.username}`)
      .setDescription([
        `**Niveau :** ${userData.level}`,
        `**XP :** ${userData.xp} / ${nextXp}`,
        ``,
        `Continue de participer pour monter en niveau !`
      ].join('\n'))
      .setThumbnail(interaction.user.displayAvatarURL());
      
    return interaction.reply({ embeds: [rankEmbed] });
  }

  if (commandName === 'giveaway') {
    const timeInMinutes = options.getInteger('temps');
    const prize = options.getString('lot');
    
    const embed = new EmbedBuilder()
      .setColor(0xCF6B45)
      .setTitle('🎉 NOUVEAU GIVEAWAY 🎉')
      .setDescription(`**Lot à gagner :** ${prize}\n\nCliquez sur le bouton ci-dessous pour participer !\n**Tirage dans :** ${timeInMinutes} minute(s)`)
      .setTimestamp(Date.now() + timeInMinutes * 60000);
      
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('join_giveaway').setLabel('🎉 Participer').setStyle(ButtonStyle.Primary)
    );
    
    const giveawayMsg = await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: '✅ Giveaway lancé.', ephemeral: true });
    
    if (!client.giveaways) client.giveaways = {};
    client.giveaways[giveawayMsg.id] = [];
    
    setTimeout(async () => {
      try {
        const fetchedMsg = await interaction.channel.messages.fetch(giveawayMsg.id);
        const participants = client.giveaways[giveawayMsg.id] || [];
        
        if (participants.length === 0) {
          await interaction.channel.send(`🎉 Le giveaway pour **${prize}** est terminé, mais personne n'a participé...`);
          return;
        }
        
        const winner = participants[Math.floor(Math.random() * participants.length)];
        await interaction.channel.send(`🎉 Félicitations <@${winner}> ! Tu as gagné le giveaway pour : **${prize}** !`);
        
        const endEmbed = EmbedBuilder.from(fetchedMsg.embeds[0])
          .setTitle('🎉 GIVEAWAY TERMINÉ 🎉')
          .setDescription(`**Lot remporté :** ${prize}\n**Gagnant :** <@${winner}>`)
          .setColor(0x2B2D31);
        
        await fetchedMsg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
        delete client.giveaways[giveawayMsg.id];
      } catch (e) {
        console.error('Erreur Giveaway', e);
      }
    }, timeInMinutes * 60000);
  }

  // --- COMMANDES VIP IA ---

  if (commandName === 'youtube') {
    if (!checkVIP(interaction)) return interaction.reply({ content: "❌ Cette commande est réservée aux membres Premium/VIP !", ephemeral: true });
    await interaction.deferReply();
    const link = options.getString('lien');
    
    try {
      // On récupère les sous-titres de la vidéo pour donner le vrai contexte à l'IA
      const transcriptList = await YoutubeTranscript.fetchTranscript(link);
      const text = transcriptList.map(t => t.text).join(' ').substring(0, 20000); // 20000 caractères max pour rester dans la limite des tokens
      
      const prompt = `Voici la transcription exacte d'une vidéo YouTube :\n\n"${text}"\n\nFais-moi un résumé extrêmement détaillé et structuré avec des puces de cette vidéo. Sors les idées principales de cette transcription. Ne dis pas "voici le résumé de la transcription", agis comme si tu avais vu la vidéo.`;
      
      let response = await callVIPAI(prompt, "Tu es un assistant VIP expert en synthèse. Tu résumes les vidéos parfaitement.");
      const remaining = consumeQuota();
      const footer = `\n\n*⚡ ${remaining}/12000 requêtes IA restantes aujourd'hui*`;
      
      const chunks = response.match(/[\s\S]{1,1900}/g) || [];
      await interaction.editReply("🎥 **Voici le résumé détaillé de la vidéo :**");
      for (let i = 0; i < chunks.length; i++) {
        let contentToSend = chunks[i];
        if (i === chunks.length - 1) contentToSend += footer;
        await interaction.channel.send(contentToSend);
      }
    } catch (e) {
      console.error('Erreur Youtube VIP Transcript:', e);
      await interaction.editReply("❌ Impossible d'analyser cette vidéo. Assure-toi qu'elle a des sous-titres ou qu'elle n'est pas restreinte.");
    }
  }

  if (commandName === 'code_review') {
    if (!checkVIP(interaction)) return interaction.reply({ content: "❌ Cette commande est réservée aux membres Premium/VIP !", ephemeral: true });
    await interaction.deferReply();
    const code = options.getString('code');
    const prompt = `Voici un code qui contient une erreur ou qui peut être amélioré :\n\n${code}\n\nTrouve le bug, corrige-le, et explique-moi ce qui n'allait pas comme le ferait un développeur sénior.`;
    try {
      let response = await callVIPAI(prompt, "Tu es un développeur Sénior VIP (CTO). Tu es bienveillant, expert en tous les langages, et tu expliques les bugs avec pédagogie.");
      const remaining = consumeQuota();
      const footer = `\n\n*⚡ ${remaining}/12000 requêtes IA restantes aujourd'hui*`;
      
      const chunks = response.match(/[\s\S]{1,1900}/g) || [];
      await interaction.editReply("💻 **Analyse de ton code terminée :**");
      for (let i = 0; i < chunks.length; i++) {
        let contentToSend = chunks[i];
        if (i === chunks.length - 1) contentToSend += footer;
        await interaction.channel.send(contentToSend);
      }
    } catch (e) {
      await interaction.editReply("❌ Les serveurs IA sont surchargés, réessaie dans un instant.");
    }
  }

  if (commandName === 'copywriter') {
    if (!checkVIP(interaction)) return interaction.reply({ content: "❌ Cette commande est réservée aux membres Premium/VIP !", ephemeral: true });
    await interaction.deferReply();
    const texte = options.getString('texte');
    const prompt = `Voici un texte brut :\n\n${texte}\n\nRéécris ce texte de manière extrêmement professionnelle, sans aucune faute d'orthographe, avec un vocabulaire riche, persuasif et percutant.`;
    try {
      let response = await callVIPAI(prompt, "Tu es le meilleur copywriter francophone. Ton style est hypnotique, professionnel et parfait.");
      const remaining = consumeQuota();
      const footer = `\n\n*⚡ ${remaining}/12000 requêtes IA restantes aujourd'hui*`;
      
      const chunks = response.match(/[\s\S]{1,1900}/g) || [];
      await interaction.editReply("✍️ **Voici ton texte réécrit comme un pro :**");
      for (let i = 0; i < chunks.length; i++) {
        let contentToSend = chunks[i];
        if (i === chunks.length - 1) contentToSend += footer;
        await interaction.channel.send(contentToSend);
      }
    } catch (e) {
      await interaction.editReply("❌ Les serveurs IA sont surchargés, réessaie dans un instant.");
    }
  }

  if (commandName === 'imagine_pro') {
    if (!checkVIP(interaction)) return interaction.reply({ content: "❌ Cette commande est réservée aux membres Premium/VIP !", ephemeral: true });
    await interaction.deferReply();
    const prompt = options.getString('prompt');
    const enhancedPrompt = `Génère un prompt très détaillé en anglais basé sur cette idée : "${prompt}". Le prompt doit décrire une image de qualité chef-d'oeuvre, 8k resolution, highly detailed, cinematic lighting. Réponds UNIQUEMENT avec le prompt anglais. Ne dis rien d'autre.`;
    
    try {
      let englishPrompt = await callVIPAI(enhancedPrompt, "Tu es un prompteur d'images expert.");
      englishPrompt = encodeURIComponent(englishPrompt.trim());
      const imageUrl = `https://image.pollinations.ai/prompt/${englishPrompt}?width=1024&height=1024&nologo=true&model=flux`;
      
      const remaining = consumeQuota();
      const embed = new EmbedBuilder()
        .setTitle("💎 Voici ton image VIP (Haute Qualité) :")
        .setImage(imageUrl)
        .setColor('#CF6B45')
        .setFooter({ text: `⚡ ${remaining}/12000 requêtes IA restantes aujourd'hui` });
        
      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      await interaction.editReply("❌ Les serveurs IA sont surchargés, réessaie dans un instant.");
    }
  }
};
