const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50, size: 'A4' });
const outputPath = path.join(__dirname, '100_Methodes_Exclusives_V2.pdf');

doc.pipe(fs.createWriteStream(outputPath));

// Couverture
doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1A1A2E');
doc.fillColor('#E94560').fontSize(32).text('100 MÉTHODES & FEATURES IA', 50, 150, { align: 'center' });
doc.fillColor('#FFFFFF').fontSize(16).text('Le guide ultime pour débloquer 100% du potentiel de Claude, Gemini et ChatGPT', { align: 'center' });
doc.moveDown(3);
doc.fillColor('#CF6B45').fontSize(14).text('Exclusivité Serveur Boosters 🚀', { align: 'center' });
doc.addPage();

const addSection = (title, methods) => {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill('#FFFFFF');
  doc.fillColor('#E94560').fontSize(20).text(title, { underline: true });
  doc.moveDown(1);
  
  methods.forEach((m, i) => {
    doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(`${i + 1}. ${m.title}`);
    doc.fillColor('#555555').fontSize(10).font('Helvetica').text(m.desc, { align: 'justify' });
    doc.moveDown(0.8);
    // Auto page-break handling
    if (doc.y > 700 && i < methods.length - 1) {
      doc.addPage();
      doc.fillColor('#E94560').fontSize(20).text(title + " (Suite)", { underline: true });
      doc.moveDown(1);
    }
  });
  doc.addPage();
};

const c = [
  {t: "Rubber Duck Debugging", d: "Copiez l'erreur entière avec le code et dites : 'Explique l'erreur ligne par ligne comme à un collègue'."},
  {t: "Générateur de Tests", d: "Donnez une fonction complexe et demandez : 'Génère 100% de couverture de tests avec Jest'."},
  {t: "Traducteur de Langage", d: "Demandez de traduire un vieux code PHP en Node.js moderne en gardant l'architecture logicielle."},
  {t: "Refactoring Clean Code", d: "Passez votre code et demandez : 'Applique les principes SOLID et nettoie ce code pour la production'."},
  {t: "Explicateur d'Architecture", d: "Demandez : 'Analyse ce repo GitHub et explique-moi l'architecture globale en markdown'."},
  {t: "Générateur de Regex", d: "Décrivez le motif en langage naturel (ex: 'trouve tous les numéros français') et l'IA fera la Regex."},
  {t: "Optimiseur de BDD", d: "Donnez votre schéma SQL et demandez : 'Quels index ajouter pour accélérer les requêtes de recherche ?'"},
  {t: "Créateur de Scripts Bash", d: "Demandez un script pour automatiser vos tâches (ex: 'Script bash qui sauvegarde mon dossier web tous les soirs')."},
  {t: "Réducteur de Complexité O(n)", d: "Donnez un algorithme lent et dites : 'Optimise la complexité temporelle de cet algorithme'."},
  {t: "Générateur de Dockerfile", d: "Décrivez votre app (ex: 'App Node.js avec MongoDB') et l'IA créera le Dockerfile et le docker-compose."},
  {t: "Simulateur d'API", d: "Demandez : 'Génère 50 objets JSON représentant de faux utilisateurs avec des données réalistes'."},
  {t: "Chasseur de Failles", d: "Soumettez votre code et demandez : 'Cherche des failles de sécurité courantes comme les injections SQL'."},
  {t: "Générateur de Docs", d: "Passez un fichier entier et dites : 'Génère un README professionnel expliquant comment utiliser ce module'."},
  {t: "Typage Automatique", d: "Donnez du code JavaScript pur et demandez sa conversion intégrale en TypeScript typé strictement."},
  {t: "Réviseur de Pull Request", d: "Collez le diff d'une PR et dites : 'Fais-moi une code review stricte comme un Senior Engineer'."},
  {t: "Assistant CSS/Tailwind", d: "Décrivez un design visuel complexe et l'IA générera le code Tailwind CSS complet."},
  {t: "Débugger de CI/CD", d: "Copiez les logs d'échec Github Actions et l'IA vous dira exactement où la pipeline a cassé."},
  {t: "Créateur de Schémas", d: "Demandez de générer du code 'Mermaid.js' pour visualiser des architectures ou flux de données."},
  {t: "Simulateur de Charge", d: "Demandez un script Artillery ou JMeter pour tester les limites de votre API."},
  {t: "Convertisseur de framework", d: "Demandez de réécrire un composant React en composant Vue.js 3 avec Composition API."}
];

const w = [
  {t: "Clonage de Style", d: "Donnez 3 de vos textes et dites 'Analyse mon style et rédige le texte suivant avec ma voix'."},
  {t: "Le Framework AIDA", d: "Rédigez des pages de vente en demandant la structure : Attention, Intérêt, Désir, Action."},
  {t: "Synthèse Fleuve", d: "Passez un long PDF (Gemini) et demandez un résumé exécutif de 2 pages avec puces."},
  {t: "Créateur de Hooks", d: "Demandez : 'Génère 10 accroches percutantes (hooks) pour ma prochaine vidéo TikTok/Reels'."},
  {t: "Rédacteur SEO", d: "Demandez un article de blog optimisé pour un mot-clé précis avec les balises H1, H2, H3."},
  {t: "Brainstorming Inversé", d: "Demandez : 'Quelles sont les 10 pires idées pour mon projet ?' puis inversez-les pour l'inspiration."},
  {t: "Reformulateur de Ton", d: "Transformez un email colérique en un message professionnel, calme et diplomatique."},
  {t: "Créateur de FAQ", d: "Passez la description de votre produit et demandez les 10 questions que se posent le plus les clients."},
  {t: "Storytelling", d: "Transformez une suite de faits ennuyeux en une histoire captivante avec le voyage du héros."},
  {t: "Générateur de Newsletter", d: "Donnez 3 liens de l'actualité et l'IA en fera une newsletter complète et engageante."},
  {t: "Le Rédacteur de CV", d: "Donnez votre parcours brut et la fiche de poste, l'IA optimisera le CV pour l'ATS de l'entreprise."},
  {t: "Réponse aux Avis", d: "Générez des réponses professionnelles et personnalisées aux avis Google de vos clients."},
  {t: "Créateur de Slogan", d: "Décrivez votre marque et demandez 20 slogans mémorables et courts."},
  {t: "Script de Podcast", d: "Générez une trame complète d'interview avec les transitions, l'intro et l'outro."},
  {t: "Traduction Nuancée", d: "Demandez de traduire un texte non pas littéralement, mais en gardant l'humour ou les expressions locales."},
  {t: "Générateur de Prompts", d: "Demandez à l'IA d'écrire un prompt optimisé pour un générateur d'images comme Midjourney."},
  {t: "Titres YouTube", d: "Demandez 10 titres putaclics mais éthiques pour maximiser le CTR d'une vidéo."},
  {t: "Générateur de Quiz", d: "Demandez de créer un quiz de 10 questions sur un sujet pour animer une communauté."},
  {t: "Résumé de Vidéo", d: "Passez la transcription YouTube (ou le lien via Gemini) et demandez les 3 idées clés."},
  {t: "Scénariste de Fiction", d: "Développez les arcs narratifs de vos personnages de roman avec une cohérence totale."}
];

const l = [
  {t: "Chain of Thought", d: "Demandez toujours : 'Pense étape par étape et détaille ton raisonnement' pour éviter les erreurs de logique."},
  {t: "Avocat du Diable", d: "Demandez : 'Trouve toutes les failles de mon idée de business et sois impitoyable'."},
  {t: "Prise de Décision", d: "Utilisez la matrice d'Eisenhower ou de SWOT pour faire classer vos tâches/idées par l'IA."},
  {t: "Détection de Biais", d: "Passez un article et demandez à l'IA de lister tous les biais cognitifs présents."},
  {t: "Créateur d'Analogies", d: "Demandez : 'Explique-moi la physique quantique en utilisant l'analogie de la cuisine'."},
  {t: "Résolution de Conflits", d: "Expliquez un conflit entre 2 collègues et demandez un plan de médiation objectif."},
  {t: "Ingénierie Inverse", d: "Montrez un produit à succès et demandez à l'IA de deviner son modèle économique complet."},
  {t: "Estimateur de Temps", d: "Listez les tâches de votre projet et demandez une estimation PERT de la durée."},
  {t: "Créateur de Process", d: "Demandez à l'IA d'écrire la procédure opérationnelle (SOP) étape par étape d'une tâche."},
  {t: "Analyse Root Cause", d: "Utilisez la méthode des '5 Pourquoi' avec l'IA pour trouver la source d'un problème."},
  {t: "Planificateur de Projet", d: "Générez un diagramme de Gantt format texte pour le lancement de votre produit."},
  {t: "Critique de Design", d: "Décrivez l'UI de votre app et demandez les problèmes d'UX potentiels."},
  {t: "Simulateur de Négociation", d: "Entraînez-vous à négocier un salaire avec l'IA jouant un recruteur tenace."},
  {t: "Optimiseur de Routine", d: "Donnez votre emploi du temps et demandez comment optimiser votre énergie."},
  {t: "Générateur de Puzzles", d: "Demandez de générer des énigmes logiques complexes pour tester des candidats."},
  {t: "Analyse Financière", d: "Passez un tableau de chiffres et demandez les tendances et anomalies principales."},
  {t: "Simulateur de Crise", d: "Créez un scénario catastrophe pour votre entreprise et demandez le plan d'urgence."},
  {t: "Traducteur de Jargon", d: "Traduisez du jargon légal ou médical en termes compréhensibles pour un patient/client."},
  {t: "Extracteur de Données", d: "Passez un texte brut et demandez d'extraire toutes les dates et noms dans un format JSON."},
  {t: "Générateur de Mindmap", d: "Demandez une structure Markdown pour générer une carte mentale sur un concept."}
];

const b = [
  {t: "Simulation de Persona", d: "Demandez à l'IA d'agir comme votre client idéal et posez-lui des questions sur ses douleurs."},
  {t: "Générateur de Niche", d: "Demandez 20 sous-niches sous-exploitées dans un marché global (ex: la fitness pour seniors)."},
  {t: "Analyse Concurrentielle", d: "Donnez les sites web de 3 concurrents et demandez un tableau de leurs forces/faiblesses."},
  {t: "Créateur d'Offre Irrésistible", d: "Utilisez l'IA pour transformer une simple prestation en une offre packagée premium."},
  {t: "Scripts de Cold Calling", d: "Générez des scripts d'appel à froid avec traitement des objections inclus."},
  {t: "Générateur de Lead Magnet", d: "Trouvez 5 idées de PDF ou outils gratuits à offrir en échange d'une adresse email."},
  {t: "Simulateur de Pitch Deck", d: "Présentez votre startup et laissez l'IA vous poser les questions qu'un VC poserait."},
  {t: "Stratégie de Pricing", d: "Demandez les meilleures méthodes psychologiques pour fixer le prix de votre produit."},
  {t: "Créateur d'Onboarding", d: "Générez la séquence d'emails exacte qu'un nouveau client doit recevoir les 7 premiers jours."},
  {t: "Planificateur de Contenu", d: "Demandez un calendrier éditorial sur 30 jours pour LinkedIn, adapté à votre secteur."},
  {t: "Analyse de Feedback", d: "Collez 100 avis clients et demandez à l'IA de catégoriser les problèmes principaux."},
  {t: "Rédacteur de Contrat", d: "Générez la base d'un contrat de prestation de service (à faire relire par un vrai juriste)."},
  {t: "Créateur de Partenariats", d: "Laissez l'IA lister les types d'entreprises idéales pour un partenariat B2B gagnant-gagnant."},
  {t: "Optimiseur de Conversion (CRO)", d: "Décrivez votre page web et demandez 10 A/B tests à réaliser d'urgence."},
  {t: "Campagne de Pub", d: "Générez 5 angles publicitaires Facebook Ads pour le même produit en ciblant des émotions différentes."},
  {t: "Générateur de Noms", d: "Demandez 50 noms de marque uniques, en évitant les clichés de votre industrie."},
  {t: "Créateur de Webinaires", d: "Demandez la structure minute par minute d'un webinaire de vente d'une heure."},
  {t: "Stratégie de Rétention", d: "Trouvez des idées pour fidéliser les clients et réduire le taux de désabonnement (churn)."},
  {t: "Lancement de Produit", d: "Générez la timeline marketing complète des 14 jours précédant votre lancement."},
  {t: "Auditeur SEO Local", d: "Demandez les stratégies spécifiques pour référencer un magasin physique dans sa ville."}
];

const d = [
  {t: "Le Compagnon Vocal", d: "Utilisez le mode vocal de ChatGPT pour simuler des entretiens d'embauche en marchant."},
  {t: "Chef Cuisinier", d: "Donnez la liste des 5 ingrédients qui restent dans votre frigo et demandez 3 recettes possibles."},
  {t: "Coach Sportif Perso", d: "Donnez votre poids, matériel et objectifs, et obtenez un programme de musculation sur 4 semaines."},
  {t: "Planificateur de Voyages", d: "Demandez un itinéraire détaillé de 7 jours à Tokyo incluant budget, transport et restaurants cachés."},
  {t: "Assistant Médical", d: "Donnez vos résultats sanguins (attention aux données privées) pour une explication simple avant de voir le médecin."},
  {t: "Tuteur de Langue", d: "Demandez à l'IA de discuter en espagnol et de corriger vos fautes de grammaire à chaque message."},
  {t: "Recommandateur de Livres", d: "Listez 3 livres que vous avez adorés et demandez 5 recommandations de niche similaires."},
  {t: "Explicateur de Contrats", d: "Photographiez votre contrat de location ou d'assurance et demandez un résumé des conditions."},
  {t: "Assistant Administratif", d: "Demandez de générer une lettre de résiliation d'abonnement ou de réclamation officielle."},
  {t: "Organisateur de Fête", d: "Demandez un thème, un planning et une liste de courses pour un anniversaire de 30 personnes."},
  {t: "Diagnostic Bricolage", d: "Décrivez un bruit de voiture ou une fuite de robinet et obtenez les causes les plus probables."},
  {t: "Générateur de Cadeaux", d: "Décrivez les hobbies d'un ami et demandez 10 idées de cadeaux originales à moins de 50€."},
  {t: "Coach de Vie", d: "Utilisez l'IA pour journaliser votre humeur quotidienne et obtenir des conseils de motivation."},
  {t: "Simulateur d'Achat", d: "Copiez les caractéristiques de 3 PC portables et demandez lequel choisir selon votre usage."},
  {t: "Assistant Jardinage", d: "Donnez votre région et demandez le calendrier de plantation idéal pour un potager."},
  {t: "Créateur de Jeux de Rôle", d: "Jouez à une aventure textuelle (Donjons & Dragons) où l'IA est le maître du jeu."},
  {t: "Médiateur de Couple", d: "Présentez une dispute de manière neutre et demandez le point de vue psychologique de l'autre."},
  {t: "Optimiseur de CV (Quotidien)", d: "Mettez à jour instantanément votre lettre de motivation avant de l'envoyer."},
  {t: "Traducteur de Menu", d: "Prenez en photo un menu au Japon et demandez les détails des plats et allergènes."},
  {t: "Planificateur de Déménagement", d: "Générez la checklist complète des démarches à faire (EDF, Poste) 1 mois avant de déménager."}
];

addSection('💻 Code & Développement (20 Features)', c.map(i => ({title: i.t, desc: i.d})));
addSection('✍️ Rédaction & Création (20 Features)', w.map(i => ({title: i.t, desc: i.d})));
addSection('🧠 Logique & Ingénierie (20 Features)', l.map(i => ({title: i.t, desc: i.d})));
addSection('💰 Business & Marketing (20 Features)', b.map(i => ({title: i.t, desc: i.d})));
addSection('☕ Vie Quotidienne & Productivité (20 Features)', d.map(i => ({title: i.t, desc: i.d})));

// Conclusion
doc.fillColor('#E94560').fontSize(24).text('Conclusion', { align: 'center' });
doc.moveDown();
doc.fillColor('#333333').fontSize(12).text("Vous possédez désormais l'arsenal complet pour dompter n'importe quelle IA. Expérimentez, testez, et n'oubliez jamais que l'IA est un outil qui amplifie VOS idées.", { align: 'center' });

doc.end();
console.log('100 VRAIES Méthodes générées avec succès !');
