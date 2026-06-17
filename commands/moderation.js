
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = [
  new SlashCommandBuilder().setName('clear').setDescription('Nettoie les messages d\'un salon')
    .addIntegerOption(opt => opt.setName('nombre').setDescription('Nombre de messages à supprimer').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('kick').setDescription('Expulse un membre')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre à expulser').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('ban').setDescription('Bannit un membre')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('unban').setDescription('Débannit un membre')
    .addStringOption(opt => opt.setName('id').setDescription('ID du membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('Rend muet un membre')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutes').setDescription('Durée en minutes').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warn').setDescription('Avertit un membre')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .addStringOption(opt => opt.setName('raison').setDescription('Raison').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warnings').setDescription('Voir les avertissements d\'un membre')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('clearwarns').setDescription('Efface les avertissements')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('lock').setDescription('Verrouille un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('Déverrouille un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('slowmode').setDescription('Active le mode lent')
    .addIntegerOption(opt => opt.setName('secondes').setDescription('Délai').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('nuke').setDescription('Supprime et recrée un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
];

module.exports.execute = async (interaction) => {
  const { commandName, options, guild, member } = interaction;
  
  if (commandName === 'clear') {
    const amount = options.getInteger('nombre');
    await interaction.channel.bulkDelete(amount, true).catch(e => console.error(e));
    return interaction.reply({ content: `🗑️ ${amount} messages supprimés.`, ephemeral: true });
  }
  
  if (commandName === 'kick') {
    const target = options.getMember('utilisateur');
    const reason = options.getString('raison') || 'Aucune raison';
    if (!target) return interaction.reply({content:'Membre introuvable.', ephemeral:true});
    await target.kick(reason);
    return interaction.reply({ content: `👢 ${target.user.tag} a été expulsé. Raison: ${reason}` });
  }

  if (commandName === 'ban') {
    const target = options.getMember('utilisateur');
    const reason = options.getString('raison') || 'Aucune raison';
    if (!target) return interaction.reply({content:'Membre introuvable.', ephemeral:true});
    await target.ban({ reason });
    return interaction.reply({ content: `🔨 ${target.user.tag} a été banni. Raison: ${reason}` });
  }

  if (commandName === 'unban') {
    const id = options.getString('id');
    await guild.members.unban(id).catch(() => {});
    return interaction.reply({ content: `✅ L'utilisateur avec l'ID ${id} a été débanni.` });
  }

  if (commandName === 'timeout') {
    const target = options.getMember('utilisateur');
    const minutes = options.getInteger('minutes');
    if (!target) return interaction.reply({content:'Membre introuvable.', ephemeral:true});
    await target.timeout(minutes * 60 * 1000, 'Timeout via bot');
    return interaction.reply({ content: `🔇 ${target.user.tag} est rendu muet pour ${minutes} minutes.` });
  }

  if (commandName === 'lock') {
    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    return interaction.reply({ content: '🔒 Ce salon a été verrouillé.' });
  }

  if (commandName === 'unlock') {
    await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
    return interaction.reply({ content: '🔓 Ce salon a été déverrouillé.' });
  }

  if (commandName === 'slowmode') {
    const sec = options.getInteger('secondes');
    await interaction.channel.setRateLimitPerUser(sec);
    return interaction.reply({ content: `🐢 Mode lent activé: ${sec}s.` });
  }

  if (commandName === 'nuke') {
    const channel = interaction.channel;
    const pos = channel.position;
    const parent = channel.parentId;
    const newChannel = await channel.clone();
    await newChannel.setPosition(pos);
    await newChannel.setParent(parent);
    await channel.delete();
    return newChannel.send({ content: '💥 Ce salon a été nuké (recréé).' });
  }

  // Warnings system
  const dbPath = './database.json';
  let db = { warnings: {} };
  if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  if (commandName === 'warn') {
    const target = options.getUser('utilisateur');
    const reason = options.getString('raison');
    if (!db.warnings[target.id]) db.warnings[target.id] = [];
    db.warnings[target.id].push({ reason, by: member.user.tag, date: new Date().toISOString() });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return interaction.reply({ content: `⚠️ ${target.tag} a été averti. Raison: ${reason}` });
  }

  if (commandName === 'warnings') {
    const target = options.getUser('utilisateur');
    const warns = db.warnings[target.id] || [];
    if (warns.length === 0) return interaction.reply({ content: '✅ Aucun avertissement pour ce membre.', ephemeral: true });
    const embed = new EmbedBuilder().setTitle(`⚠️ Avertissements de ${target.tag}`).setColor(0xFF0000);
    warns.forEach((w, i) => embed.addFields({ name: `#${i+1} - ${w.date}`, value: `**Raison:** ${w.reason}\n**Par:** ${w.by}` }));
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'clearwarns') {
    const target = options.getUser('utilisateur');
    delete db.warnings[target.id];
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return interaction.reply({ content: `✅ Les avertissements de ${target.tag} ont été effacés.` });
  }
};
