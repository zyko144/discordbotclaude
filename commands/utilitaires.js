
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder().setName('ping').setDescription('Affiche la latence du bot'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Stats et infos du serveur'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Infos sur un membre').addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(false)),
  new SlashCommandBuilder().setName('avatar').setDescription('Affiche la photo de profil').addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(false)),
  new SlashCommandBuilder().setName('botinfo').setDescription('Stats du bot'),
  new SlashCommandBuilder().setName('roles').setDescription('Liste tous les rôles du serveur'),
  new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('Crée un sondage à choix multiples')
    .addStringOption(opt => opt.setName('question').setDescription('La question du sondage').setRequired(true))
    .addStringOption(opt => opt.setName('choix1').setDescription('Premier choix').setRequired(true))
    .addStringOption(opt => opt.setName('choix2').setDescription('Deuxième choix').setRequired(true))
    .addStringOption(opt => opt.setName('choix3').setDescription('Troisième choix').setRequired(false))
    .addStringOption(opt => opt.setName('choix4').setDescription('Quatrième choix').setRequired(false))
    .addStringOption(opt => opt.setName('choix5').setDescription('Cinquième choix').setRequired(false)),
  new SlashCommandBuilder().setName('say').setDescription('Fait parler le bot').addStringOption(opt => opt.setName('message').setDescription('Message').setRequired(true))
];

module.exports.execute = async (interaction) => {
  const { commandName, options, guild, client } = interaction;
  
  if (commandName === 'ping') {
    return interaction.reply({ content: `🏓 Pong! Latence: ${client.ws.ping}ms` });
  }

  if (commandName === 'serverinfo') {
    const embed = new EmbedBuilder().setTitle(guild.name).setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Membres', value: `${guild.memberCount}`, inline: true },
        { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
      ).setColor(0xCF6B45);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'userinfo') {
    const target = options.getMember('utilisateur') || interaction.member;
    const embed = new EmbedBuilder().setTitle(target.user.tag).setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: 'Rejoint le serveur', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: 'Créé le compte', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true }
      ).setColor(0xCF6B45);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'avatar') {
    const target = options.getUser('utilisateur') || interaction.user;
    const embed = new EmbedBuilder().setTitle(`Avatar de ${target.tag}`).setImage(target.displayAvatarURL({ size: 512 })).setColor(0xCF6B45);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'botinfo') {
    const embed = new EmbedBuilder().setTitle('🤖 Stats du Bot').setColor(0xCF6B45)
      .addFields(
        { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)} minutes`, inline: true },
        { name: 'Mémoire', value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`, inline: true }
      );
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'roles') {
    const roles = guild.roles.cache.map(r => r.name).join(', ');
    return interaction.reply({ content: `**Rôles du serveur:**\n${roles.substring(0, 1900)}` });
  }

  if (commandName === 'sondage') {
    const question = options.getString('question');
    const choices = [];
    for (let i = 1; i <= 5; i++) {
      const choice = options.getString(`choix${i}`);
      if (choice) choices.push(choice);
    }

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    let descriptionText = `**${question}**\n\n`;
    
    choices.forEach((choice, index) => {
      descriptionText += `${emojis[index]} ${choice}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle('📊 Nouveau Sondage')
      .setDescription(descriptionText)
      .setColor(0xCF6B45)
      .setFooter({ text: `Sondage créé par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    
    for (let i = 0; i < choices.length; i++) {
      await msg.react(emojis[i]);
    }
    return;
  }

  if (commandName === 'say') {
    const msg = options.getString('message');
    if (!interaction.member.permissions.has('ManageMessages')) return interaction.reply({content:'Non autorisé.', ephemeral:true});
    await interaction.channel.send(msg);
    return interaction.reply({ content: '✅ Message envoyé', ephemeral: true });
  }
};
