
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = [
  new SlashCommandBuilder().setName('ticket_add').setDescription('Ajoute un membre au ticket')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('ticket_remove').setDescription('Retire un membre du ticket')
    .addUserOption(opt => opt.setName('utilisateur').setDescription('Membre').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('ticket_close').setDescription('Ferme et archive le ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
];

module.exports.execute = async (interaction) => {
  const { commandName, options, channel } = interaction;
  
  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ Ce n\'est pas un salon de ticket.', ephemeral: true });
  }

  if (commandName === 'ticket_add') {
    const target = options.getUser('utilisateur');
    await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true });
    return interaction.reply({ content: `✅ ${target} a été ajouté au ticket.` });
  }

  if (commandName === 'ticket_remove') {
    const target = options.getUser('utilisateur');
    await channel.permissionOverwrites.edit(target.id, { ViewChannel: false });
    return interaction.reply({ content: `❌ ${target} a été retiré du ticket.` });
  }

  if (commandName === 'ticket_close') {
    await interaction.reply({ content: '🔒 Ce ticket sera fermé dans 5 secondes...' });
    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 5000);
  }
};
