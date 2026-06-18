require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // The bot needs a CLIENT_ID

// Extract client ID from token logic if CLIENT_ID is missing
// Typically not perfectly safe but works for bot tokens:
const getClientIdFromToken = (token) => {
    try {
        const base64Id = token.split('.')[0];
        return Buffer.from(base64Id, 'base64').toString('utf-8');
    } catch(e) {
        return null;
    }
}

const clientId = CLIENT_ID || getClientIdFromToken(TOKEN);

if (!TOKEN) {
    console.error("❌ TOKEN manquant dans le fichier .env");
    process.exit(1);
}

if (!clientId) {
    console.error("❌ CLIENT_ID introuvable. Veuillez l'ajouter dans votre fichier .env (CLIENT_ID=...)");
    process.exit(1);
}

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const mod = require('./commands/' + file);
    if (Array.isArray(mod)) {
        for (const cmd of mod) {
            // Push the slash command builder to JSON
            commands.push(cmd.toJSON());
        }
    }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log(`⏳ Début du déploiement de ${commands.length} commandes (Global)...`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );

        console.log(`✅ Succès ! ${data.length} commandes ont été enregistrées sur l'application Discord.`);
        console.log(`   (La commande /sondage est maintenant disponible dans ton serveur !)`);
    } catch (error) {
        console.error(error);
    }
})();
