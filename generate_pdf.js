const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 50 });
const outputPath = path.join(__dirname, '50_prompts_ia.pdf');

doc.pipe(fs.createWriteStream(outputPath));

// Title
doc.fontSize(24).fillColor('#CF6B45').text('50 Méga-Prompts IA Exclusifs', { align: 'center' });
doc.moveDown();
doc.fontSize(14).fillColor('#333333').text('La Bible des Serveurs Boosters 🚀', { align: 'center' });
doc.moveDown(2);

doc.fontSize(12).fillColor('#000000').text("Félicitations pour votre statut VIP ! Oubliez les requêtes basiques. Ce document contient 50 prompts d'architecture, de création de business et de développement complet pour 50 projets différents. Copiez-collez-les dans Claude ou Gemini pour déclencher un niveau de réflexion expert.", {
  align: 'left'
});
doc.moveDown(2);

const categories = [
  {
    title: "👨‍💻 Développement SaaS & Web (1 à 10)",
    prompts: [
      "Agis en tant que CTO d'une startup de la Silicon Valley. Conçois l'architecture complète d'un SaaS de gestion de facturation pour freelances. Détaille le schéma de base de données PostgreSQL, l'architecture des microservices en Node.js, la stratégie d'authentification JWT, et fournis le code d'initialisation du serveur Express avec les middlewares de sécurité indispensables.",
      "Génère le code complet d'une application React/Next.js de type 'Trello-clone'. Je veux l'architecture des dossiers, la configuration de Tailwind CSS, le composant Board avec drag-and-drop, le système de gestion d'état avec Zustand, et l'intégration d'une API mockée pour la sauvegarde des tâches.",
      "Développe un scraper web avancé en Python avec Playwright. Le script doit pouvoir contourner les protections Cloudflare basiques, extraire les prix et les titres d'un site e-commerce dynamique, gérer les proxys tournants, et sauvegarder les données nettoyées dans une base MongoDB avec gestion des doublons.",
      "Conçois un système d'authentification robuste avec NextAuth.js pour un projet Next.js 14 (App Router). Inclut la gestion des sessions JWT, la connexion OAuth avec Google et GitHub, la protection des routes API, et le middleware pour rediriger les utilisateurs non authentifiés.",
      "Crée une API REST complète en Go (Golang) avec le framework Gin pour gérer un système de réservation d'hôtel. Inclus les routes CRUD complètes, la validation des inputs, la connexion à GORM, le logging avec Zap, et la gestion propre des erreurs HTTP.",
      "Rédige un script de migration de base de données complexe en SQL pur. Le script doit transférer 1 million d'utilisateurs d'une vieille table monolithique vers un nouveau schéma normalisé (utilisateurs, profils, préférences), en gérant les transactions, les index, et en optimisant le temps d'exécution.",
      "Développe une extension Chrome avec Manifest V3 qui utilise l'IA pour résumer la page web active. Fournis le code du manifest, du background service worker, du content script pour extraire le texte, et du popup UI en HTML/CSS vanilla.",
      "Crée la configuration complète d'un cluster Kubernetes pour déployer une application full-stack. Génère les fichiers YAML pour les Deployments, Services, Ingress, ConfigMaps, Secrets, et explique la stratégie de scaling horizontal.",
      "Agis comme un expert en cybersécurité. Audite l'architecture d'une application bancaire et liste les 10 vulnérabilités OWASP les plus critiques à vérifier. Pour chaque vulnérabilité, fournis un exemple de code vulnérable et sa correction en Node.js.",
      "Génère le code TypeScript complet d'un bot Discord utilisant discord.js v14. Le bot doit avoir un gestionnaire de commandes Slash (Command Handler) dynamique, une commande de modération avancée (kick/ban avec logs), et une intégration avec une base de données SQLite."
    ]
  },
  {
    title: "🤖 Intelligence Artificielle & Data (11 à 20)",
    prompts: [
      "Agis comme un ingénieur Machine Learning. Conçois l'architecture d'un système de recommandation de films. Explique la différence entre le filtrage collaboratif et basé sur le contenu, et fournis un script Python utilisant Scikit-Learn ou PyTorch pour un modèle hybride de base.",
      "Développe un script Python complet utilisant LangChain et OpenAI API pour créer un agent autonome capable de faire des recherches web, lire des PDF, et synthétiser un rapport de recherche de 5 pages sur un sujet donné.",
      "Crée un pipeline de traitement de données (Data Engineering) avec Apache Airflow. Fournis le code d'un DAG qui extrait des données d'une API publique chaque nuit, les transforme avec Pandas pour nettoyer les valeurs nulles, et les charge dans un data warehouse BigQuery.",
      "Rédige le code Python d'une API FastAPI qui sert un modèle de machine learning pré-entraîné (HuggingFace). Inclus le système de batching des requêtes pour optimiser les performances, et l'intégration de Pydantic pour valider les inputs du modèle.",
      "Génère un notebook Jupyter complet pour l'analyse exploratoire de données (EDA) sur un jeu de données de ventes e-commerce. Inclus le code de nettoyage des données, des visualisations avancées avec Seaborn/Plotly, et l'analyse de corrélation.",
      "Agis en tant qu'expert en Prompt Engineering. Conçois une architecture de prompt dynamique (avec Few-Shot Learning et Chain-of-Thought) pour forcer une IA à analyser des contrats juridiques complexes et extraire les clauses abusives avec 99% de précision.",
      "Développe un script de Computer Vision avec OpenCV et Python qui détecte les visages en temps réel via une webcam, applique un flou gaussien de manière dynamique sur les visages détectés, et affiche le résultat avec les FPS.",
      "Conçois un système RAG (Retrieval-Augmented Generation) avancé. Explique comment intégrer une base de données vectorielle (Pinecone ou Qdrant), générer des embeddings avec OpenAI, et utiliser LangChain pour construire le système de questions-réponses sur des documents internes.",
      "Rédige un guide technique détaillé expliquant comment fine-tuner le modèle Llama 3 (8B) avec QLoRA sur un dataset personnalisé en utilisant un GPU de 24GB. Fournis le code Python pour l'entraînement avec la bibliothèque PEFT et Transformers.",
      "Crée un algorithme de trading quantitatif en Python. Utilise la librairie ccxt pour te connecter à Binance, calcule des indicateurs techniques (RSI, MACD) avec TA-Lib, et implémente une logique de backtesting basique."
    ]
  },
  {
    title: "📈 E-Commerce & Marketing Automatisé (21 à 30)",
    prompts: [
      "Agis comme le CMO d'une marque D2C (Direct-to-Consumer). Élabore une stratégie d'acquisition cross-canal pour le lancement d'une nouvelle marque de café premium. Inclus les angles publicitaires Facebook Ads, la stratégie d'emailing de bienvenue sur Klaviyo, et l'architecture du tunnel de vente.",
      "Génère un script Python qui automatise la gestion des réseaux sociaux. Le script doit utiliser l'API de Twitter/X pour poster quotidiennement des threads éducatifs générés par IA à partir d'une liste de sujets dans un Google Sheet.",
      "Rédige le contenu complet d'une Landing Page 'High-Ticket'. Utilise des structures persuasives psychologiques. Inclus le Hero Header, la section 'Agiter le problème', la présentation de la solution, l'empilement de la valeur (Value Stack), et les appels à l'action.",
      "Développe une stratégie de Growth Hacking B2B pour une agence web. Détaille un système de cold emailing automatisé (via Lemlist ou Instantly), génère 3 templates d'emails personnalisés avec des 'Icebreakers', et explique comment utiliser LinkedIn Sales Navigator pour extraire les leads.",
      "Crée une séquence de 7 emails d'abandon de panier extrêmement agressive mais élégante pour une marque de luxe, avec des déclencheurs psychologiques de rareté, d'urgence et de preuve sociale croissante à chaque étape.",
      "Conçois l'arborescence SEO complète et la stratégie sémantique pour un site e-commerce vendant du matériel de fitness. Inclus le maillage interne, la structure des URL, et génère 10 briefs de rédaction optimisés pour viser les requêtes transactionnelles de longue traîne.",
      "Agis comme un expert en copywriting. Rédige un script vidéo VSL (Video Sales Letter) de 10 minutes pour vendre une formation en ligne à 1000€. Inclus les hooks visuels, le storytelling, le changement de paradigme, et l'appel à l'action final irrésistible.",
      "Génère un plan d'A/B testing pour un site Shopify qui génère 100k€/mois mais dont le taux de conversion stagne à 1%. Liste 5 hypothèses de test radicales sur la page produit, le tiroir panier et le checkout, avec les KPI à mesurer.",
      "Élabore un programme d'affiliation et de parrainage pour une application mobile SaaS. Définis les commissions, la structure des récompenses pour le parrain et le filleul, et rédige les emails d'invitation à envoyer aux utilisateurs les plus actifs.",
      "Rédige une charte éditoriale complète pour le compte TikTok d'une marque de cosmétiques. Inclus les formats vidéo qui performent (POV, GRWM, éducatif), les règles d'utilisation des audios trends, et un calendrier de contenu sur 2 semaines."
    ]
  },
  {
    title: "🎮 Jeu Vidéo & Création 3D (31 à 40)",
    prompts: [
      "Agis comme un Game Designer senior. Conçois le GDD (Game Design Document) d'un jeu indépendant de survie roguelite. Décris la boucle de gameplay principale (Core Loop), les mécaniques de progression, l'économie du jeu, et le comportement de 3 types d'ennemis distincts.",
      "Génère le script complet d'un contrôleur de personnage à la 3ème personne en C# pour Unity 3D. Le script doit gérer les déplacements fluides basés sur la caméra, le saut avec gravité réaliste, le sprint, et un système d'état (Idle, Walk, Run, Jump).",
      "Écris un système de génération procédurale de donjons en Python. L'algorithme doit générer une grille 2D avec des pièces connectées par des couloirs, s'assurer que toutes les pièces sont accessibles, et placer une salle de boss à la fin.",
      "Conçois un système d'inventaire complet en C++ pour Unreal Engine 5. Détaille la structure des classes (UInventoryComponent, AItemBase), la gestion du drag-and-drop dans l'UI, et le système de sauvegarde de l'inventaire.",
      "Rédige le script narratif interactif (arborescent) d'une quête secondaire de RPG. La quête doit impliquer un dilemme moral difficile à la fin, avec 3 résolutions possibles qui impactent le monde du jeu. Décris les dialogues et les triggers d'événements.",
      "Développe un script Shader en GLSL (ou HLSL) pour simuler un effet d'eau réaliste (Water Shader) avec des vagues sinusoïdales, une réfraction de la lumière basée sur la profondeur, et de l'écume sur les bords.",
      "Agis comme un développeur multijoueur. Explique l'architecture d'un jeu multijoueur temps réel avec serveur dédié en utilisant l'interpolation, l'extrapolation, et la prédiction côté client (Client Prediction) pour masquer la latence.",
      "Crée un système de dialogue dynamique pour Godot Engine (GDScript). Le système doit lire un fichier JSON externe contenant l'arborescence des dialogues, afficher le texte lettre par lettre avec un effet de machine à écrire, et gérer les choix multiples.",
      "Conçois une économie in-game équilibrée pour un jeu mobile F2P (Free-to-Play). Définis les devises (Hard Currency, Soft Currency), les sources de revenus, les gouffres à devises (Sinks), et crée un modèle mathématique pour éviter l'hyperinflation.",
      "Rédige un prompt complexe pour Midjourney afin de générer une série de concept arts d'armes de science-fiction (Assault Rifle, Sniper, Pistol) avec un style 'Hard Surface' extrêmement détaillé, vue de profil sur un fond gris neutre."
    ]
  },
  {
    title: "🚀 Entrepreneuriat & Finance (41 à 50)",
    prompts: [
      "Agis comme un avocat d'affaires. Rédige un pacte d'actionnaires (modèle de base) pour une startup technologique entre 3 fondateurs. Inclus les clauses de vesting sur 4 ans avec un cliff d'un an, la clause de bad leaver/good leaver, et le droit de préemption.",
      "Construis un modèle financier prévisionnel sur 3 ans pour une startup SaaS. Détaille les formules mathématiques pour calculer le MRR, le Churn Rate, le CAC (Coût d'Acquisition Client), la LTV (Life Time Value), et génère le tableau d'hypothèses de croissance.",
      "Agis comme un investisseur en capital-risque (VC). Analyse cette idée de startup [IDEE]. Fais une critique brutale sur la taille du marché (TAM/SAM/SOM), la barrière à l'entrée (Moat), et le modèle de monétisation, puis donne 3 pivots possibles.",
      "Développe une stratégie de lancement sur Product Hunt. Crée la timeline des actions de J-30 à Jour-J. Rédige le premier commentaire du 'Maker', propose 5 variations du tag line, et explique comment mobiliser sa communauté sans paraître spammant.",
      "Conçois un plan de rémunération et d'intéressement (BSPCE / Stock Options) pour les 10 premiers employés d'une startup en phase d'amorçage (Seed). Explique comment répartir l'equity intelligemment pour retenir les talents clés sans trop diluer les fondateurs.",
      "Agis comme un conseiller en fusions-acquisitions (M&A). Explique le processus complet de due diligence financière, juridique et technique pour racheter une petite agence web générant 500k€ de CA. Liste les red flags absolus à vérifier.",
      "Crée un système automatisé de gestion financière pour un freelance (Solopreneur). Décris le stack d'outils (ex: Stripe, Shine/Qonto, Pennylane), l'automatisation Zapier pour générer les factures, et la règle de répartition du chiffre d'affaires (Impôts, Trésorerie, Salaire).",
      "Rédige le script d'un pitch vidéo de 2 minutes pour postuler à l'accélérateur Y Combinator. Le script doit être concis, se concentrer sur l'équipe, le problème, la solution unique, la traction actuelle, et pourquoi ce marché est énorme.",
      "Agis comme un expert en DeFi (Finance Décentralisée). Conçois l'architecture technique d'un protocole de Lending/Borrowing sur Ethereum. Explique le mécanisme des taux d'intérêt dynamiques, la gestion des liquidations avec les oracles Chainlink, et fournis un pseudo-code de Smart Contract en Solidity.",
      "Développe un plan stratégique à 90 jours pour faire passer une agence de services (consulting/design) à un modèle de revenus récurrents (Productized Service) avec un abonnement mensuel fixe. Décris le packaging de l'offre et la standardisation de la production."
    ]
  }
];

let counter = 1;

categories.forEach(category => {
  doc.addPage();
  doc.fontSize(16).fillColor('#CF6B45').text(category.title, { underline: true });
  doc.moveDown(1.5);

  category.prompts.forEach(prompt => {
    // We add a light gray background box for aesthetics if we wanted, but let's stick to text formatting
    doc.fontSize(11).fillColor('#CF6B45').text(`PROMPT ${counter} : `,{ continued: true, stroke: true })
       .fillColor('#222222').text(prompt, { lineGap: 3 });
    doc.moveDown(1.5);
    counter++;
  });
});

doc.end();
console.log('Nouveau PDF Méga-Prompts généré avec succès !');
