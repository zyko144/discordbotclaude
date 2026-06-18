const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50 });
const outputPath = path.join(__dirname, '50_prompts_ia.pdf');

doc.pipe(fs.createWriteStream(outputPath));

// Title
doc.fontSize(24).fillColor('#CF6B45').text('50 Prompts IA Exclusifs', { align: 'center' });
doc.moveDown();
doc.fontSize(14).fillColor('#333333').text('Réservé aux Serveurs Boosters 🚀', { align: 'center' });
doc.moveDown(2);

doc.fontSize(12).fillColor('#000000').text("Ce document contient 50 prompts avancés pour exploiter toute la puissance de l'Intelligence Artificielle. Ces prompts sont conçus pour les développeurs, entrepreneurs et créateurs de contenu.", {
  align: 'left'
});
doc.moveDown(2);

const categories = [
  {
    title: "👨‍💻 Développement & Code",
    prompts: [
      "Agis en tant que développeur Senior. Audite ce code [CODE] et propose 3 optimisations de performance majeures sans changer son comportement.",
      "Génère l'architecture complète (dossiers et fichiers) pour un projet [TYPE_DE_PROJET] utilisant [TECHNOLOGIES].",
      "Écris des tests unitaires exhaustifs pour cette fonction [CODE] en gérant tous les cas limites.",
      "Explique comment résoudre l'erreur [ERREUR] comme si j'étais un développeur débutant, étape par étape.",
      "Transforme ce code [LANGAGE A] en [LANGAGE B] en respectant les conventions idiomatiques du langage cible.",
      "Agis comme un CTO. Revois mon architecture de base de données [SCHEMA] et identifie les goulots d'étranglement.",
      "Génère un script CI/CD complet pour Github Actions qui teste, build et déploie une application Node.js sur Render.",
      "Écris une expression régulière complexe pour valider [CONDITION] et explique chaque partie de la regex.",
      "Explique le concept de [CONCEPT_AVANCE] en utilisant une analogie avec le monde réel.",
      "Refactorise ce code spaghetti [CODE] en appliquant les principes SOLID."
    ]
  },
  {
    title: "📈 Business & Marketing",
    prompts: [
      "Agis comme un expert en marketing digital. Crée une stratégie de lancement sur 30 jours pour un produit [PRODUIT].",
      "Rédige une page de vente convaincante pour [PRODUIT/SERVICE] en utilisant le framework AIDA (Attention, Intérêt, Désir, Action).",
      "Génère 10 idées de titres accrocheurs pour un article de blog sur [SUJET] optimisés pour le SEO.",
      "Analyse cette description de produit [TEXTE] et réécris-la pour maximiser le taux de conversion.",
      "Crée un script de vidéo TikTok virale de 60 secondes pour promouvoir [PRODUIT] avec un hook puissant.",
      "Rédige une séquence de 3 emails de relance pour les paniers abandonnés de ma boutique e-commerce.",
      "Agis comme un business angel. Pose-moi les 10 questions les plus difficiles sur mon pitch deck [RESUME].",
      "Développe un persona client détaillé pour une entreprise vendant [PRODUIT] à [CIBLE].",
      "Propose 5 stratégies de Growth Hacking pour acquérir les 1000 premiers utilisateurs d'une application SaaS.",
      "Rédige une réponse professionnelle et empathique à cet avis client négatif : [AVIS]."
    ]
  },
  {
    title: "✍️ Création de Contenu & Rédaction",
    prompts: [
      "Rédige un article de blog de 1500 mots sur [SUJET] avec un ton conversationnel et des sous-titres clairs.",
      "Résume ce long article [TEXTE] en 5 points clés faciles à comprendre.",
      "Agis comme un éditeur professionnel. Corrige les fautes de ce texte [TEXTE] et améliore sa fluidité.",
      "Génère un fil Twitter (thread) de 7 tweets captivants racontant l'histoire de [SUJET].",
      "Rédige une introduction accrocheuse pour une vidéo YouTube sur [SUJET] qui retient l'attention dès les 5 premières secondes.",
      "Transforme cet article de blog [TEXTE] en un script de podcast interactif avec 2 animateurs.",
      "Génère 15 idées de posts LinkedIn pour asseoir mon autorité dans le domaine de [DOMAINE].",
      "Réécris cet email [TEXTE] de manière beaucoup plus formelle et respectueuse.",
      "Crée un plan détaillé pour un eBook de 50 pages sur le thème [THEME].",
      "Rédige une histoire courte de science-fiction basée sur le postulat : [IDEE]."
    ]
  },
  {
    title: "🧠 Productivité & Apprentissage",
    prompts: [
      "Explique-moi la théorie de la relativité restreinte comme si j'avais 10 ans.",
      "Crée un programme d'étude intensif de 4 semaines pour apprendre les bases de [SUJET].",
      "Génère des flashcards (recto/verso) pour mémoriser les concepts clés de [SUJET].",
      "Agis comme un tuteur socratique. Pose-moi des questions pour me faire comprendre [CONCEPT] par moi-même.",
      "Résume les idées principales du livre [TITRE_DU_LIVRE] de [AUTEUR].",
      "Crée une routine matinale optimisée pour maximiser la concentration, basée sur les neurosciences.",
      "Propose un menu de repas équilibrés pour une semaine avec la liste de courses associée.",
      "Génère un entraînement de sport à la maison de 30 minutes sans matériel.",
      "Traduis ce texte [TEXTE] en [LANGUE] en gardant les nuances culturelles.",
      "Agis comme un coach de vie. Aide-moi à définir mes objectifs pour l'année prochaine avec la méthode SMART."
    ]
  },
  {
    title: "🎨 Créativité & Divertissement",
    prompts: [
      "Invente un jeu de société original basé sur le thème de l'exploration spatiale. Donne les règles complètes.",
      "Génère un prompt détaillé pour Midjourney afin de créer une image d'une ville futuriste cyberpunk sous la pluie.",
      "Écris un poème en alexandrins sur la beauté de l'intelligence artificielle.",
      "Agis comme un Maître du Jeu de Donjons et Dragons. Décris la salle d'entrée d'un château abandonné.",
      "Propose 5 idées de cadeaux originaux pour un passionné de [PASSION] avec un budget de [BUDGET].",
      "Écris le synopsis d'une série Netflix mêlant comédie romantique et thriller psychologique.",
      "Invente une recette de cuisine fusionnant la gastronomie japonaise et mexicaine.",
      "Génère une blague intelligente sur les développeurs informatiques.",
      "Crée un quiz de 10 questions difficiles sur la culture pop des années 80.",
      "Imagine un dialogue entre Albert Einstein et Elon Musk sur le futur de l'humanité."
    ]
  }
];

let counter = 1;

categories.forEach(category => {
  doc.addPage();
  doc.fontSize(18).fillColor('#CF6B45').text(category.title, { underline: true });
  doc.moveDown();

  category.prompts.forEach(prompt => {
    doc.fontSize(12).fillColor('#CF6B45').text(`Prompt ${counter} : `,{ continued: true })
       .fillColor('#000000').text(prompt);
    doc.moveDown(0.5);
    counter++;
  });
});

doc.end();
console.log('PDF généré avec succès !');
