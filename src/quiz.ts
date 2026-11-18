/**
 * Contenuto del quiz: tratti, banca domande, archetipi.
 * Tutto il testo è bilingue (it / fr). Modifica liberamente questo file.
 *
 * Impianto "da psicologo", ma leggero: 5 tratti ispirati ai Big Five, letti in chiave conviviale.
 *   energia  – ricerca di stimoli e ritmo         (contemplativo ↔ esploratore)
 *   gusto    – apertura al nuovo                  (tradizione ↔ sperimentazione)
 *   social   – estroversione, dove ricarichi      (salotto ↔ festa)
 *   metodo   – bisogno di struttura               (pianificatore ↔ improvvisatore)
 *   bussola  – stile decisionale                  (testa ↔ pancia)
 * Ogni persona riceve QUESTIONS_PER_DIM domande casuali per tratto (10 in tutto), in ordine mescolato.
 * Ogni domanda ha 6 opzioni dal polo "meno" al polo "più", con punteggi -2, -1, -1, +1, +1, +2.
 * Il punteggio di un tratto va quindi da -SCORE_MAX a +SCORE_MAX.
 */

export type Locale = 'it' | 'fr';
export type L = Record<Locale, string>;

export interface Option { emoji: string; text: L; score: number }
export interface Question { id: string; dim: DimKey; text: L; options: Option[] }

export const QUESTIONS_PER_DIM = 2;
export const SCORE_MAX = 2 * QUESTIONS_PER_DIM;

export const DIMENSIONS = [
  { key: 'energia', low: { it: 'Contemplativo', fr: 'Contemplatif' }, high: { it: 'Esploratore', fr: 'Explorateur' } },
  { key: 'gusto',   low: { it: 'Tradizione',    fr: 'Tradition' },    high: { it: 'Sperimentazione', fr: 'Expérimentation' } },
  { key: 'social',  low: { it: 'Salotto',       fr: 'Salon' },        high: { it: 'Festa', fr: 'Fête' } },
  { key: 'metodo',  low: { it: 'Pianificatore', fr: 'Planificateur' }, high: { it: 'Improvvisatore', fr: 'Improvisateur' } },
  { key: 'bussola', low: { it: 'Testa',         fr: 'Tête' },         high: { it: 'Pancia', fr: 'Instinct' } },
] as const;
export type DimKey = (typeof DIMENSIONS)[number]['key'];
export const DIM_KEYS: DimKey[] = DIMENSIONS.map(d => d.key);

const q = (id: string, dim: DimKey, it: string, fr: string, options: [string, string, string, number][]): Question => ({
  id, dim, text: { it, fr },
  options: options.map(([emoji, oit, ofr, score]) => ({ emoji, text: { it: oit, fr: ofr }, score })),
});

export const QUESTIONS: Question[] = [
  // ---------------- ENERGIA: ricerca di stimoli e ritmo. contemplativo (-) / esploratore (+) ----------------
  q('e1', 'energia', 'Mare o montagna?', 'Mer ou montagne ?', [
    ['🏖️', 'Mare, ombrellone e libro', 'Mer, parasol et bouquin', -2],
    ['🏞️', 'Lago, amaca e silenzio', 'Lac, hamac et silence', -1],
    ['🍷', 'Collina, passeggiata e cantina', 'Collines, balade et cave à vin', -1],
    ['⛰️', 'Montagna, rifugio e vista', 'Montagne, refuge et panorama', 1],
    ['🚣', 'Lago, ma in canoa', 'Lac, mais en canoë', 1],
    ['🏄', 'Mare, ma con la tavola sotto i piedi', 'Mer, mais avec une planche sous les pieds', 2],
  ]),
  q('e2', 'energia', 'La domenica mattina perfetta', 'Le dimanche matin parfait', [
    ['🛏️', 'Sveglia senza sveglia', 'Réveil sans réveil', -2],
    ['🥐', 'Colazione lunga al bar', 'Long petit-déj au café', -1],
    ['📰', 'Giornale e secondo caffè', 'Journal et deuxième café', -1],
    ['🛍️', 'Mercatino e passeggiata', 'Brocante et balade', 1],
    ['🏃', 'Corsetta al parco', 'Petit footing au parc', 1],
    ['🚴', 'In bici prima che la città si svegli', 'À vélo avant que la ville ne se réveille', 2],
  ]),
  q('e3', 'energia', 'Lo sport che ti rappresenta', 'Le sport qui te ressemble', [
    ['🧘', 'Yoga', 'Yoga', -2],
    ['🎱', 'Bocce o biliardo', 'Pétanque ou billard', -1],
    ['🏌️', 'Golf', 'Golf', -1],
    ['⚽', 'Calcio', 'Football', 1],
    ['🎾', 'Tennis o padel', 'Tennis ou padel', 1],
    ['🎿', 'Sci', 'Ski', 2],
  ]),
  q('e4', 'energia', 'La vacanza ideale', 'Les vacances idéales', [
    ['🏝️', 'Resort all inclusive', 'Resort tout compris', -2],
    ['🏛️', 'Città d’arte', 'Ville d’art', -1],
    ['🛳️', 'Crociera', 'Croisière', -1],
    ['🥾', 'Trekking con lo zaino', 'Trek avec le sac à dos', 1],
    ['🤿', 'Immersioni', 'Plongée', 1],
    ['🚐', 'On the road in camper', 'Road trip en camping-car', 2],
  ]),
  q('e5', 'energia', 'Ti regalano un biglietto per…', 'On t’offre un billet pour…', [
    ['🎭', 'Il teatro', 'Le théâtre', -2],
    ['🎬', 'Il cinema', 'Le cinéma', -1],
    ['🎼', 'Un concerto di classica', 'Un concert classique', -1],
    ['🎡', 'Il luna park', 'La fête foraine', 1],
    ['🏎️', 'Un giro in pista', 'Un tour sur circuit', 1],
    ['🪂', 'Un lancio col paracadute', 'Un saut en parachute', 2],
  ]),
  q('e6', 'energia', 'Hai un pomeriggio libero in una città che non conosci', 'Tu as un après-midi libre dans une ville inconnue', [
    ['☕', 'Un caffè e guardo la gente passare', 'Un café et je regarde passer les gens', -2],
    ['📖', 'Una libreria, poi un’altra', 'Une librairie, puis une autre', -1],
    ['🖼️', 'Il museo principale, con calma', 'Le grand musée, tranquillement', -1],
    ['🚶', 'Cammino finché non trovo qualcosa', 'Je marche jusqu’à trouver quelque chose', 1],
    ['🚲', 'Bici a noleggio e via', 'Vélo en libre-service et c’est parti', 1],
    ['🏔️', 'Cerco il punto più alto e ci salgo', 'Je cherche le point le plus haut et j’y monte', 2],
  ]),
  // ---------------- GUSTO: apertura al nuovo. tradizione (-) / sperimentazione (+) ----------------
  q('g1', 'gusto', 'Al ristorante, da bere?', 'Au restaurant, tu bois quoi ?', [
    ['🍷', 'Barolo, sempre', 'Barolo, toujours', -2],
    ['🥂', 'Bollicine', 'Des bulles', -1],
    ['🍺', 'Una birra, semplice', 'Une bière, simple', -1],
    ['🍸', 'Un cocktail, grazie', 'Un cocktail, merci', 1],
    ['🍶', 'Sake', 'Du saké', 1],
    ['🍊', 'Orange wine, e ne parlo per mezz’ora', 'Vin orange, et j’en parle une demi-heure', 2],
  ]),
  q('g2', 'gusto', 'La pizza', 'La pizza', [
    ['🍕', 'Margherita', 'Margherita', -2],
    ['🧀', 'Quattro formaggi', 'Quatre fromages', -1],
    ['🍄', 'Prosciutto e funghi', 'Jambon-champignons', -1],
    ['🌶️', 'La più piccante del menu', 'La plus piquante de la carte', 1],
    ['🥑', 'Quella con l’avocado', 'Celle à l’avocat', 1],
    ['🍍', 'Con l’ananas, e lo dico ad alta voce', 'À l’ananas, et je l’assume', 2],
  ]),
  q('g3', 'gusto', 'Nel menu c’è un piatto che non conosci', 'Il y a un plat inconnu sur la carte', [
    ['🙅', 'Passo oltre: il solito non tradisce', 'Je passe : le plat habituel ne trahit pas', -2],
    ['❓', 'Chiedo cos’è, poi prendo il solito', 'Je demande ce que c’est, puis je prends l’habituel', -1],
    ['🤝', 'Lo prendo se il cameriere lo garantisce', 'Je le prends si le serveur le garantit', -1],
    ['🍴', 'Lo prendo se qualcuno lo divide con me', 'Je le prends si quelqu’un le partage', 1],
    ['😏', 'Lo ordino, al massimo rubo dal vicino', 'Je le commande, au pire je pioche chez le voisin', 1],
    ['🎯', 'Lo ordino proprio perché non lo conosco', 'Je le commande justement parce que je ne le connais pas', 2],
  ]),
  q('g4', 'gusto', 'La cena ideale', 'Le dîner idéal', [
    ['👵', 'Dalla nonna, menu fisso', 'Chez mamie, menu unique', -2],
    ['🍝', 'Trattoria', 'Trattoria', -1],
    ['🍕', 'Pizzeria di fiducia', 'La pizzeria habituelle', -1],
    ['🍣', 'Sushi', 'Sushi', 1],
    ['🌮', 'Street food dall’altra parte del mondo', 'Street food de l’autre bout du monde', 1],
    ['🧪', 'Degustazione con le schiume', 'Menu dégustation avec des mousses', 2],
  ]),
  q('g5', 'gusto', 'Esce un nuovo gadget tecnologico', 'Un nouveau gadget tech vient de sortir', [
    ['📻', 'Il mio funziona ancora benissimo', 'Le mien marche encore très bien', -2],
    ['⏳', 'Aspetto la terza versione', 'J’attends la troisième version', -1],
    ['👀', 'Leggo le recensioni per un anno', 'Je lis les avis pendant un an', -1],
    ['🛒', 'Lo compro quando scende di prezzo', 'Je l’achète quand le prix baisse', 1],
    ['📦', 'Lo ordino il giorno dell’uscita', 'Je le commande le jour de la sortie', 1],
    ['🌙', 'Ero in coda la notte prima', 'J’étais dans la file la veille au soir', 2],
  ]),
  q('g6', 'gusto', 'Musica in macchina', 'Musique en voiture', [
    ['🎻', 'Classica', 'Classique', -2],
    ['🎸', 'Rock anni ’80', 'Rock des années 80', -1],
    ['🎙️', 'Cantautori italiani', 'Chanson italienne', -1],
    ['🎤', 'Rap', 'Rap', 1],
    ['🎹', 'Elettronica', 'Électro', 1],
    ['🎧', 'Playlist “scoperte della settimana”', 'Playlist « découvertes de la semaine »', 2],
  ]),
  // ---------------- SOCIAL: estroversione, dove ricarichi le energie. salotto (-) / festa (+) ----------------
  q('s1', 'social', 'L’aperitivo ideale', 'L’apéro idéal', [
    ['🛋️', 'A casa con tre amici', 'À la maison avec trois amis', -2],
    ['🍷', 'Enoteca tranquilla', 'Bar à vin tranquille', -1],
    ['🌅', 'Al tramonto, in due', 'Au coucher du soleil, à deux', -1],
    ['🍹', 'Rooftop affollato', 'Rooftop bondé', 1],
    ['🍻', 'Al bar dove conoscono tutti', 'Au bar où tout le monde se connaît', 1],
    ['🎉', 'Dove la musica è più alta', 'Là où la musique est la plus forte', 2],
  ]),
  q('s2', 'social', 'A una festa ti troviamo…', 'À une fête, on te trouve…', [
    ['🚪', 'Vicino all’uscita', 'Près de la sortie', -2],
    ['🐶', 'A parlare col cane di casa', 'En train de parler au chien', -1],
    ['📚', 'A guardare la libreria', 'À regarder la bibliothèque', -1],
    ['🍽️', 'Al buffet a fare conoscenze', 'Au buffet à faire connaissance', 1],
    ['🎧', 'Alla consolle a chiedere una canzone', 'À la console à demander une chanson', 1],
    ['🕺', 'Al centro della pista', 'Au milieu de la piste', 2],
  ]),
  q('s3', 'social', 'Karaoke?', 'Karaoké ?', [
    ['🙅', 'Mai', 'Jamais', -2],
    ['👀', 'Guardo e commento', 'Je regarde et je commente', -1],
    ['📱', 'Filmo gli altri', 'Je filme les autres', -1],
    ['🎤', 'Duetto, se mi trascinano', 'Duo, si on m’y traîne', 1],
    ['🎵', 'Solo canzoni italiane, ma tutte', 'Seulement des chansons italiennes, mais toutes', 1],
    ['🎶', 'Ho già scelto la canzone', 'J’ai déjà choisi la chanson', 2],
  ]),
  q('s4', 'social', 'Dopo una giornata intera di convegno', 'Après une journée entière de séminaire', [
    ['🛏️', 'Camera, silenzio, room service', 'Chambre, silence, room service', -2],
    ['🚶', 'Una passeggiata da solo', 'Une balade en solo', -1],
    ['🍝', 'Cena con un collega fidato', 'Dîner avec un collègue de confiance', -1],
    ['🍸', 'Aperitivo con il gruppo', 'Apéro avec le groupe', 1],
    ['🍽️', 'Cena con tutti, poi a nanna', 'Dîner avec tout le monde, puis dodo', 1],
    ['🌙', 'Cena, dopocena e ultimo a lasciare il bar', 'Dîner, after, et dernier à quitter le bar', 2],
  ]),
  q('s5', 'social', 'Nuovo gruppo WhatsApp', 'Nouveau groupe WhatsApp', [
    ['🔇', 'Silenzioso per sempre', 'En sourdine pour toujours', -2],
    ['👍', 'Reagisco con un pollice', 'Je réagis avec un pouce', -1],
    ['👋', 'Rispondo solo se mi taggano', 'Je réponds seulement si on me tague', -1],
    ['💬', 'Rispondo a tutti', 'Je réponds à tout le monde', 1],
    ['😂', 'Mando i meme', 'J’envoie les memes', 1],
    ['📸', 'Propongo subito una cena', 'Je propose direct un dîner', 2],
  ]),
  q('s6', 'social', 'In treno, il vicino attacca bottone', 'Dans le train, le voisin engage la conversation', [
    ['🎧', 'Cuffie su, anche spente', 'Casque sur les oreilles, même éteint', -2],
    ['😴', 'Finto sonno, tecnica collaudata', 'Faux sommeil, technique éprouvée', -1],
    ['🙂', 'Due frasi gentili e torno al libro', 'Deux phrases polies et je retourne à mon livre', -1],
    ['💬', 'Chiacchiero volentieri fino a Bologna', 'Je papote volontiers jusqu’à Bologne', 1],
    ['📇', 'Scambio il contatto', 'On échange nos contacts', 1],
    ['🍻', 'A fine viaggio siamo già a cena insieme', 'À l’arrivée on dîne déjà ensemble', 2],
  ]),
  // ---------------- METODO: bisogno di struttura. pianificatore (-) / improvvisatore (+) ----------------
  q('m1', 'metodo', 'La valigia', 'La valise', [
    ['📋', 'Lista fatta una settimana prima', 'Liste faite une semaine avant', -2],
    ['🧳', 'La sera prima, con calma', 'La veille, tranquillement', -1],
    ['⚖️', 'Pesata, due volte', 'Pesée, deux fois', -1],
    ['⏰', 'Un’ora prima di uscire', 'Une heure avant de partir', 1],
    ['🧦', 'Dimentico sempre qualcosa', 'J’oublie toujours quelque chose', 1],
    ['🎒', 'Compro tutto sul posto', 'J’achète tout sur place', 2],
  ]),
  q('m2', 'metodo', 'Un viaggio', 'Un voyage', [
    ['🗓️', 'Itinerario ora per ora', 'Itinéraire heure par heure', -2],
    ['📍', 'Hotel prenotati, il resto si vede', 'Hôtels réservés, le reste on verra', -1],
    ['📖', 'Guida letta, segnalibri messi', 'Guide lu, marque-pages posés', -1],
    ['🧭', 'Solo il volo di andata', 'Juste le vol aller', 1],
    ['🚂', 'Il primo treno che parte', 'Le premier train qui part', 1],
    ['🎲', 'Decido in aeroporto', 'Je décide à l’aéroport', 2],
  ]),
  q('m3', 'metodo', 'Il navigatore', 'Le GPS', [
    ['🗺️', 'Sempre, anche sotto casa', 'Toujours, même en bas de chez moi', -2],
    ['📱', 'Solo per i posti nuovi', 'Seulement pour les nouveaux endroits', -1],
    ['🚦', 'Controllo il traffico prima di partire', 'Je vérifie le trafic avant de partir', -1],
    ['🤷', 'Chiedo in giro', 'Je demande aux gens', 1],
    ['🌞', 'Mi oriento col sole', 'Je m’oriente au soleil', 1],
    ['🧠', 'Mi perdo di proposito', 'Je me perds exprès', 2],
  ]),
  q('m4', 'metodo', 'I regali di Natale', 'Les cadeaux de Noël', [
    ['🎁', 'Comprati a ottobre', 'Achetés en octobre', -2],
    ['🛒', 'Prima settimana di dicembre', 'Première semaine de décembre', -1],
    ['📝', 'Foglio Excel con i nomi', 'Un tableur avec les noms', -1],
    ['🏃', 'Il 24 pomeriggio', 'Le 24 après-midi', 1],
    ['🎄', 'Riciclo con stile', 'Je recycle avec style', 1],
    ['🤝', 'Un buono, risolto', 'Un bon cadeau, réglé', 2],
  ]),
  q('m5', 'metodo', 'La tua scrivania', 'Ton bureau', [
    ['📐', 'Ogni cosa al suo posto, sempre', 'Chaque chose à sa place, toujours', -2],
    ['🗂️', 'Ordinata il venerdì sera', 'Rangée le vendredi soir', -1],
    ['🧹', 'Ordinata quando arriva qualcuno', 'Rangée quand quelqu’un arrive', -1],
    ['📚', 'Pile ordinate di cose disordinate', 'Des piles ordonnées de choses en désordre', 1],
    ['🌪️', 'Caos creativo, ma trovo tutto', 'Chaos créatif, mais je trouve tout', 1],
    ['🗺️', 'Serve una mappa per trovare il mouse', 'Il faut une carte pour trouver la souris', 2],
  ]),
  q('m6', 'metodo', 'Il tuo frigo', 'Ton frigo', [
    ['🗂️', 'Organizzato per categorie', 'Rangé par catégories', -2],
    ['🥗', 'Spesa settimanale', 'Courses hebdomadaires', -1],
    ['🏷️', 'Etichette con la data', 'Étiquettes avec la date', -1],
    ['🍳', 'Qualcosa invento', 'J’invente un truc', 1],
    ['🧀', 'Un formaggio e una speranza', 'Un fromage et un espoir', 1],
    ['📞', 'Il delivery è una categoria', 'La livraison, c’est une catégorie', 2],
  ]),
  // ---------------- BUSSOLA: come decidi. testa (-) / pancia (+) ----------------
  q('b1', 'bussola', 'Devi scegliere il ristorante per stasera', 'Tu dois choisir le restaurant de ce soir', [
    ['📊', 'Confronto le recensioni su tre app', 'Je compare les avis sur trois applis', -2],
    ['🗣️', 'Chiedo a chi ci è già stato', 'Je demande à qui y est déjà allé', -1],
    ['📋', 'Quello con il menu online più chiaro', 'Celui dont la carte en ligne est la plus claire', -1],
    ['✨', 'Quello che mi ispira passando', 'Celui qui m’inspire en passant', 1],
    ['👥', 'Dove c’è più gente dentro', 'Là où il y a le plus de monde', 1],
    ['🕯️', 'Il primo con la luce calda', 'Le premier avec une lumière chaleureuse', 2],
  ]),
  q('b2', 'bussola', 'Un acquisto importante, tipo l’auto', 'Un gros achat, genre la voiture', [
    ['📈', 'Foglio di calcolo con pro e contro', 'Tableur avec le pour et le contre', -2],
    ['😴', 'Leggo tutto, poi ci dormo sopra', 'Je lis tout, puis je dors dessus', -1],
    ['👨‍🔧', 'Chiedo a un esperto e mi fido', 'Je demande à un expert et je lui fais confiance', -1],
    ['👀', 'Prima impressione, poi verifico', 'Première impression, puis je vérifie', 1],
    ['😊', 'Se mi fa sorridere, è quella', 'Si ça me fait sourire, c’est la bonne', 1],
    ['⚡', 'L’ho già comprata mentre leggevi la domanda', 'Je l’ai déjà achetée pendant que tu lisais la question', 2],
  ]),
  q('b3', 'bussola', 'Un amico ti racconta un problema', 'Un ami te raconte un problème', [
    ['📝', 'Gli faccio una lista di soluzioni', 'Je lui fais une liste de solutions', -2],
    ['❓', 'Faccio domande per capire bene', 'Je pose des questions pour bien comprendre', -1],
    ['🔗', 'Gli mando un articolo utile', 'Je lui envoie un article utile', -1],
    ['👂', 'Lo ascolto e basta', 'Je l’écoute, c’est tout', 1],
    ['🤗', 'Gli dico che lo capisco e lo abbraccio', 'Je lui dis que je comprends et je le serre dans mes bras', 1],
    ['😢', 'Piango prima io', 'Je pleure avant lui', 2],
  ]),
  q('b4', 'bussola', 'Film del sabato sera', 'Film du samedi soir', [
    ['🎥', 'Documentario', 'Documentaire', -2],
    ['🔍', 'Thriller con il colpo di scena', 'Thriller avec retournement final', -1],
    ['🧩', 'Quello con la trama più intelligente', 'Celui à l’intrigue la plus maligne', -1],
    ['😂', 'Commedia', 'Comédie', 1],
    ['🤝', 'Quello che mi consiglia un amico', 'Celui qu’un ami me conseille', 1],
    ['😭', 'Quello che fa piangere, e lo so già', 'Celui qui fait pleurer, et je le sais déjà', 2],
  ]),
  q('b5', 'bussola', 'Qualcuno ti fa un complimento', 'Quelqu’un te fait un compliment', [
    ['🤔', 'Chiedo in che senso', 'Je demande dans quel sens', -2],
    ['🙋', '“Grazie, lavoro di squadra”', '« Merci, travail d’équipe »', -1],
    ['🤨', 'Penso che esageri', 'Je pense qu’il exagère', -1],
    ['😊', 'Sorrido e ringrazio', 'Je souris et je remercie', 1],
    ['🔁', 'Lo ricambio subito', 'Je le lui rends aussitôt', 1],
    ['💭', 'Me lo ricordo per tre settimane', 'Je m’en souviens pendant trois semaines', 2],
  ]),
  q('b6', 'bussola', 'Devi dire di no a qualcuno', 'Tu dois dire non à quelqu’un', [
    ['📑', 'Spiego i motivi, in ordine', 'J’explique les raisons, dans l’ordre', -2],
    ['✉️', 'Per iscritto, così è chiaro', 'Par écrit, comme ça c’est clair', -1],
    ['⏳', 'Prendo tempo e poi dico no', 'Je gagne du temps puis je dis non', -1],
    ['😅', 'Dico no, poi ci penso tutta la notte', 'Je dis non, puis j’y pense toute la nuit', 1],
    ['🙈', 'Dico “forse” sperando che passi', 'Je dis « peut-être » en espérant que ça passe', 1],
    ['🫠', 'Dico sì', 'Je dis oui', 2],
  ]),
];

const QUESTION_BY_ID = new Map(QUESTIONS.map(x => [x.id, x]));
export const getQuestion = (id: string) => QUESTION_BY_ID.get(id);

/** Estrae QUESTIONS_PER_DIM domande casuali per tratto e mescola l'ordine. */
export function pickQuestionIds(): string[] {
  const ids: string[] = [];
  for (const dim of DIM_KEYS) {
    const pool = QUESTIONS.filter(x => x.dim === dim).map(x => x.id).sort(() => Math.random() - 0.5);
    ids.push(...pool.slice(0, QUESTIONS_PER_DIM));
  }
  return ids.sort(() => Math.random() - 0.5);
}

export function serializeQuestions(ids: string[], locale: Locale) {
  return ids.map(id => {
    const x = QUESTION_BY_ID.get(id)!;
    return { id: x.id, text: x.text[locale], options: x.options.map(o => ({ emoji: o.emoji, text: o.text[locale] })) };
  });
}

/** Da {questionId: optionIndex} al vettore dei tratti (ordine DIM_KEYS). Lancia su input non valido. */
export function scoreAnswers(questionIds: string[], answers: Record<string, number>): number[] {
  const vec: Record<string, number> = {};
  for (const id of questionIds) {
    const x = QUESTION_BY_ID.get(id);
    if (!x) throw new Error('unknown question ' + id);
    const idx = answers[id];
    if (!Number.isInteger(idx) || idx < 0 || idx >= x.options.length) throw new Error('invalid answer for ' + id);
    vec[x.dim] = (vec[x.dim] ?? 0) + x.options[idx].score;
  }
  return DIM_KEYS.map(k => vec[k] ?? 0);
}

// ---------------- LETTURA DEI TRATTI ----------------
// Per ogni tratto, una frase per intensità: forte verso il polo "meno", lieve "meno", lieve "più", forte "più".
const TRAIT_TEXT: Record<DimKey, [L, L, L, L]> = {
  energia: [
    { it: 'Il relax è una disciplina e tu sei cintura nera.', fr: 'Le repos est une discipline et tu es ceinture noire.' },
    { it: 'Ti piace il ritmo lento, con qualche strappo quando ne vale la pena.', fr: 'Tu aimes le rythme lent, avec quelques accélérations quand ça en vaut la peine.' },
    { it: 'Hai bisogno di muoverti, ma sai anche goderti una sedia.', fr: 'Tu as besoin de bouger, mais tu sais aussi apprécier une chaise.' },
    { it: 'La calma ti annoia dopo dieci minuti: ti serve una meta.', fr: 'Le calme t’ennuie au bout de dix minutes : il te faut un but.' },
  ],
  gusto: [
    { it: 'Le cose buone sono già state inventate e tu le difendi.', fr: 'Les bonnes choses ont déjà été inventées et tu les défends.' },
    { it: 'Ami i classici, ma un’eccezione ben raccontata ti convince.', fr: 'Tu aimes les classiques, mais une exception bien racontée te convainc.' },
    { it: 'Curioso per natura: assaggi prima, giudichi poi.', fr: 'Curieux de nature : tu goûtes d’abord, tu juges ensuite.' },
    { it: 'Se una cosa non l’hai mai provata, è già un buon motivo.', fr: 'Si tu n’as jamais essayé une chose, c’est déjà une bonne raison.' },
  ],
  social: [
    { it: 'Ricarichi le energie da solo: le feste le osservi da lontano, e bene.', fr: 'Tu recharges tes batteries en solo : les fêtes, tu les observes de loin, et bien.' },
    { it: 'Poche persone, scelte bene: la qualità batte il numero.', fr: 'Peu de gens, bien choisis : la qualité bat le nombre.' },
    { it: 'Le persone ti danno energia, anche se poi ti serve un divano.', fr: 'Les gens te donnent de l’énergie, même s’il te faut ensuite un canapé.' },
    { it: 'La stanza si accende quando entri, e lo sai.', fr: 'La pièce s’allume quand tu entres, et tu le sais.' },
  ],
  metodo: [
    { it: 'Hai un piano B per il piano B. E funziona.', fr: 'Tu as un plan B pour le plan B. Et ça marche.' },
    { it: 'Ti piace sapere dove vai, ma lasci qualche spazio bianco.', fr: 'Tu aimes savoir où tu vas, mais tu laisses quelques cases vides.' },
    { it: 'Un po’ di struttura ti serve, il resto lo inventi strada facendo.', fr: 'Un peu de structure te sert, le reste tu l’inventes en route.' },
    { it: 'I piani sono per gli altri: tu arrivi lo stesso, e con storie migliori.', fr: 'Les plans, c’est pour les autres : tu arrives quand même, avec de meilleures histoires.' },
  ],
  bussola: [
    { it: 'Decidi con la testa: dati, confronto, poi si parte.', fr: 'Tu décides avec la tête : données, comparaison, puis on y va.' },
    { it: 'Ragioni prima, ma ascolti anche la pancia prima di firmare.', fr: 'Tu réfléchis d’abord, mais tu écoutes aussi ton instinct avant de signer.' },
    { it: 'Ti fidi della prima impressione, poi al massimo la verifichi.', fr: 'Tu te fies à ta première impression, puis au mieux tu la vérifies.' },
    { it: 'Decidi di pancia e di cuore, e raramente te ne penti.', fr: 'Tu décides à l’instinct et au cœur, et tu le regrettes rarement.' },
  ],
};

// Pareggio esatto (es. -2 e +2): lettura neutra, senza forzare un polo.
const TRAIT_NEUTRAL: Record<DimKey, L> = {
  energia: { it: 'Un giorno amaca, un giorno paracadute: dipende da chi te lo propone.', fr: 'Un jour hamac, un jour parachute : ça dépend de qui te le propose.' },
  gusto:   { it: 'Un piede nella tradizione e uno nel menu degustazione.', fr: 'Un pied dans la tradition et un dans le menu dégustation.' },
  social:  { it: 'Sai stare al centro della pista e sul divano con la stessa naturalezza.', fr: 'Tu sais être au milieu de la piste et sur le canapé avec le même naturel.' },
  metodo:  { it: 'Pianifichi quanto basta per poterti permettere di improvvisare.', fr: 'Tu planifies juste assez pour pouvoir te permettre d’improviser.' },
  bussola: { it: 'Testa e pancia votano a turno, e di solito sono d’accordo.', fr: 'Tête et instinct votent à tour de rôle, et sont généralement d’accord.' },
};

export function traitLevel(score: number): 0 | 1 | 2 | 3 {
  const strong = Math.ceil(SCORE_MAX * 0.6); // con SCORE_MAX = 4: forte da |3| in su
  if (score <= -strong) return 0;
  if (score < 0) return 1;
  if (score < strong) return 2;
  return 3;
}

/** Lettura completa dei tratti per la schermata risultato: polo, intensità, frase e risposte date. */
export function describeTraits(vector: number[], questionIds: string[], answers: Record<string, number>, locale: Locale) {
  return DIMENSIONS.map((d, i) => {
    const score = vector[i] ?? 0;
    const level = traitLevel(score);
    const picked = questionIds.map(id => QUESTION_BY_ID.get(id)).filter((x): x is Question => !!x && x.dim === d.key)
      .map(x => ({ emoji: x.options[answers[x.id]]?.emoji ?? '', text: x.options[answers[x.id]]?.text[locale] ?? '' }));
    return {
      key: d.key, low: d.low[locale], high: d.high[locale], score, max: SCORE_MAX,
      pole: score === 0 ? null : score > 0 ? d.high[locale] : d.low[locale],
      strong: level === 0 || level === 3,
      text: score === 0 ? TRAIT_NEUTRAL[d.key][locale] : TRAIT_TEXT[d.key][level][locale],
      answers: picked,
    };
  });
}

// ---------------- ARCHETIPI ----------------
// Titolo = energia × gusto ; epiteto = social × metodo ; la bussola colora la descrizione.
interface Arch { title: L; blurb: L; emoji: string }

const TITLES: Record<string, Arch> = {
  'E+G+': { emoji: '🧭', title: { it: 'L’Esploratore Fusion', fr: 'L’Explorateur Fusion' },
    blurb: { it: 'Mai lo stesso sentiero, mai lo stesso piatto. Se esiste una via nuova, l’hai già assaggiata.',
             fr: 'Jamais le même sentier, jamais le même plat. S’il existe une nouvelle voie, tu l’as déjà goûtée.' } },
  'E+G-': { emoji: '🏔️', title: { it: 'Lo Sherpa del Barolo', fr: 'Le Sherpa du Barolo' },
    blurb: { it: 'Sali in cima e poi stappi un classico. Energia da vendere, gusti da proteggere.',
             fr: 'Tu grimpes au sommet puis tu débouches un classique. De l’énergie à revendre, des goûts à protéger.' } },
  'E-G+': { emoji: '🛋️', title: { it: 'Il Sommelier da Divano', fr: 'Le Sommelier de Canapé' },
    blurb: { it: 'Ti muovi poco ma assaggi tutto. Il tuo divano ha una carta dei vini.',
             fr: 'Tu bouges peu mais tu goûtes tout. Ton canapé a une carte des vins.' } },
  'E-G-': { emoji: '🍝', title: { it: 'Il Custode della Nonna', fr: 'Le Gardien de la Recette de Mamie' },
    blurb: { it: 'Le cose buone sono già state inventate. Tu le difendi, con calma e con la forchetta.',
             fr: 'Les bonnes choses ont déjà été inventées. Tu les défends, calmement, fourchette à la main.' } },
};

const EPITHETS: Record<string, L> = {
  'S+M+': { it: 'che improvvisa karaoke', fr: 'qui improvise des karaokés' },
  'S+M-': { it: 'con l’agenda delle feste', fr: 'avec l’agenda des fêtes' },
  'S-M+': { it: 'che si perde volentieri', fr: 'qui se perd volontiers' },
  'S-M-': { it: 'con la mappa del silenzio', fr: 'avec la carte du silence' },
};

export function archetypeKey(vec: number[]): string {
  const s = (v: number) => (v >= 0 ? '+' : '-');
  return `E${s(vec[0])}G${s(vec[1])}|S${s(vec[2])}M${s(vec[3])}`;
}

export function describeArchetype(key: string, locale: Locale) {
  const [t, e] = key.split('|');
  const title = TITLES[t] ?? TITLES['E+G+'];
  const epithet = EPITHETS[e] ?? EPITHETS['S+M+'];
  return { emoji: title.emoji, name: `${title.title[locale]} ${epithet[locale]}`, blurb: title.blurb[locale] };
}
