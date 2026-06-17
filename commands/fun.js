
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = [
  new SlashCommandBuilder().setName('8ball').setDescription('Pose une question magique')
    .addStringOption(opt => opt.setName('question').setDescription('Question').setRequired(true)),
  new SlashCommandBuilder().setName('coinflip').setDescription('Pile ou face'),
  new SlashCommandBuilder().setName('roll').setDescription('Lance un dé de 1 à 100'),
  new SlashCommandBuilder().setName('joke').setDescription('Raconte une blague aléatoire'),
  new SlashCommandBuilder().setName('meme').setDescription('Affiche un meme (simulé)'),
  new SlashCommandBuilder().setName('rps').setDescription('Pierre Feuille Ciseaux')
    .addStringOption(opt => opt.setName('choix').setDescription('pierre / feuille / ciseaux').setRequired(true)),
  new SlashCommandBuilder().setName('lovecalc').setDescription('Calcule l\'amour')
    .addUserOption(opt => opt.setName('user1').setDescription('Personne 1').setRequired(true))
    .addUserOption(opt => opt.setName('user2').setDescription('Personne 2').setRequired(true))
];

module.exports.execute = async (interaction) => {
  const { commandName, options } = interaction;
  
  if (commandName === '8ball') {
    const responses = ['Oui absolument', 'Non jamais', 'Peut-être', 'C\'est certain', 'Je ne pense pas', 'Demande plus tard'];
    const r = responses[Math.floor(Math.random() * responses.length)];
    return interaction.reply({ content: `🎱 **Question:** ${options.getString('question')}\n**Réponse:** ${r}` });
  }

  if (commandName === 'coinflip') {
    const res = Math.random() < 0.5 ? 'Pile' : 'Face';
    return interaction.reply({ content: `🪙 La pièce est tombée sur : **${res}**` });
  }

  if (commandName === 'roll') {
    const res = Math.floor(Math.random() * 100) + 1;
    return interaction.reply({ content: `🎲 Tu as lancé un **${res}** (sur 100) !` });
  }

  if (commandName === 'joke') {
    const jokes = [
      "Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tombent dans le bateau.",
      "Que fait une fraise sur un cheval ? Tagada tagada !",
      "C'est l'histoire d'un pingouin qui respire par les fesses. Un jour il s'assoit et il meurt."
    ];
    return interaction.reply({ content: `😂 ${jokes[Math.floor(Math.random() * jokes.length)]}` });
  }

  if (commandName === 'meme') {
    return interaction.reply({ content: '🖼️ *Insérer une API de memes ici : https://cataas.com/cat*' });
  }

  if (commandName === 'rps') {
    const user = options.getString('choix').toLowerCase();
    const botChoices = ['pierre', 'feuille', 'ciseaux'];
    const botC = botChoices[Math.floor(Math.random() * botChoices.length)];
    let result = 'Égalité !';
    if ((user === 'pierre' && botC === 'ciseaux') || (user === 'feuille' && botC === 'pierre') || (user === 'ciseaux' && botC === 'feuille')) result = 'Tu as gagné ! 🎉';
    else if (user !== botC) result = 'J\'ai gagné ! 🤖';
    return interaction.reply({ content: `Tu as joué **${user}**, j'ai joué **${botC}**.\n${result}` });
  }

  if (commandName === 'lovecalc') {
    const u1 = options.getUser('user1');
    const u2 = options.getUser('user2');
    const score = Math.floor(Math.random() * 101);
    return interaction.reply({ content: `💖 Le taux d'amour entre ${u1} et ${u2} est de **${score}%** !` });
  }
};
