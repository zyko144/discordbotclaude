const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50, size: 'A4' });
const outputPath = path.join(__dirname, 'Formation_Masterclass_IA.pdf');

doc.pipe(fs.createWriteStream(outputPath));

// Couverture
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0F172A'); // Dark Blue background
doc.fillColor('#38BDF8').fontSize(36).text('MASTERCLASS IA', 50, 200, { align: 'center' });
doc.fillColor('#FFFFFF').fontSize(18).text('La Formation Complète pour Maîtriser l\'Intelligence Artificielle', { align: 'center' });
doc.moveDown(3);
doc.fillColor('#94A3B8').fontSize(14).text('Offert en exclusivité aux Serveurs Boosters 🚀', { align: 'center' });
doc.addPage();

// Helper function for titles
const addTitle = (text) => {
  doc.fillColor('#CF6B45').fontSize(22).text(text, { underline: true });
  doc.moveDown(0.5);
};

// Helper function for body text
const addText = (text, isBold = false) => {
  doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#333333').fontSize(12).text(text, { align: 'justify', lineGap: 4 });
  doc.moveDown(1);
};

// Reset text to default style on new page
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');

// Chapitre 1
addTitle('Chapitre 1 : Comprendre l\'écosystème de l\'IA');
addText("L'Intelligence Artificielle générative a bouleversé le monde. Mais pour bien l'utiliser, il faut comprendre qui fait quoi.", true);
addText("1. ChatGPT (OpenAI) : Le pionnier et le plus polyvalent. GPT-4o est excellent pour la logique pure, le raisonnement et la création de contenu grand public. Son interface intègre la recherche web, la création d'images (DALL-E) et l'analyse de données en un seul endroit.");
addText("2. Claude (Anthropic) : Actuellement, Claude 4.8 Opus et Claude Fable 5 sont les références absolues pour les développeurs seniors et les tâches d'ingénierie complexes. Ils ont une plume beaucoup plus naturelle que ChatGPT et possèdent un raisonnement analytique de pointe.");
addText("3. Gemini (Google) : La force de Gemini 1.5 Pro et 3.1 Pro réside dans leur 'fenêtre de contexte' gigantesque (plus d'1 million de tokens). Vous pouvez lui donner 10 livres entiers ou une heure de vidéo, et il se souviendra de tout. Il est également le meilleur pour l'analyse vidéo et la recherche sur le web via Google.");
addText("4. Midjourney & Flux : Les rois de la génération d'images. Contrairement à DALL-E qui respecte bien les consignes mais fait des images très 'lisses', Midjourney crée des œuvres d'art photoréalistes bluffantes.");
doc.moveDown();

// Chapitre 2
addTitle('Chapitre 2 : La Science du Prompt Engineering');
addText("Un modèle d'IA n'est aussi intelligent que la personne qui lui parle. Le 'Prompt Engineering' est l'art de formuler sa demande.", true);
addText("La Règle des 5 Pilliers (Framework CREATE) :", true);
addText("- Contexte : Donnez toujours un rôle à l'IA. 'Agis comme un avocat d'affaires avec 20 ans d'expérience au barreau de Paris.'\n- Requête : Soyez ultra-précis sur la tâche. 'Rédige une mise en demeure pour impayé.'\n- Exemples : L'IA apprend par l'exemple (Few-Shot Prompting). Donnez-lui un extrait de ce que vous aimez.\n- Audience : À qui s'adresse le texte ? 'Utilise un ton formel et menaçant.'\n- Ton & Format : 'Format : Liste à puces. Pas de jargon complexe. Rédige en Markdown.'");
addText("Technique Avancée : Le Chain-of-Thought (Chaîne de Pensée)", true);
addText("Si vous posez un problème complexe de mathématiques ou de logique à une IA, elle peut se tromper si elle répond trop vite. Ajoutez toujours la phrase magique à la fin de votre prompt : 'Pense étape par étape avant de donner ta réponse finale.' Cela force l'IA à décomposer son raisonnement, ce qui augmente sa précision de 50%.");
doc.addPage();

// Chapitre 3
addTitle('Chapitre 3 : Devenir un Développeur 10x avec l\'IA');
addText("L'IA ne remplacera pas les développeurs, mais les développeurs qui utilisent l'IA remplaceront ceux qui ne l'utilisent pas.", true);
addText("Comment coder avec l'IA :", true);
addText("1. Ne lui demandez jamais de coder une application entière d'un coup. Demandez-lui d'abord l'architecture des fichiers. Puis demandez-lui fichier par fichier.");
addText("2. Utilisez l'IA pour auditer votre code : 'Trouve les failles de sécurité dans ce code et propose une optimisation O(n)'.");
addText("3. Rubber Duck Debugging : Quand vous avez une erreur incompréhensible, copiez le message d'erreur ET les 50 lignes de code autour, et demandez simplement : 'Pourquoi cette erreur se produit-elle dans ce contexte ?'");
doc.moveDown();

// Chapitre 4
addTitle('Chapitre 4 : La Génération d\'Images (Midjourney & Stable Diffusion)');
addText("Le lexique secret des créateurs d'images professionnels :", true);
addText("- Type de plan : 'Wide shot' (plan large), 'Macro photography' (gros plan extrême), 'Cinematic angle'.");
addText("- Éclairage (Crucial !) : 'Volumetric lighting', 'Cinematic lighting', 'Golden hour', 'Neon cyberpunk glow'.");
addText("- Appareil photo : Pour du réalisme, citez un vrai appareil. 'Shot on 35mm lens, Sony A7R IV, f/1.8'.");
addText("- Rendu : 'Unreal Engine 5 render', 'Octane Render', '8k resolution, ultra-detailed'.");
addText("Exemple de Prompt Parfait : 'A cinematic wide shot of a cyberpunk street vendor selling noodles in a rainy neon-lit alleyway. Volumetric fog, purple and cyan lighting. Shot on 35mm lens, f/1.8, photorealistic, 8k --ar 16:9'");
doc.moveDown();

// Conclusion
addTitle('Mot de la Fin');
addText("L'Intelligence Artificielle est comme un exosquelette pour votre cerveau. Elle ne pense pas à votre place, elle amplifie vos idées. Plus vous serez cultivé, créatif et précis dans votre vision, plus l'IA produira des miracles pour vous.");
addText("Merci de soutenir le serveur en étant Booster ! Vous avez maintenant un avantage compétitif majeur sur le reste du monde. 🚀", true);

doc.end();
console.log('Formation PDF générée avec succès !');
