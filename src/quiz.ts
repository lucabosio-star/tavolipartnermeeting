/**
 * Contenuto del quiz: dimensioni, banca domande, archetipi.
 * Tutto il testo è bilingue (it / fr). Modifica liberamente questo file
 * per cambiare domande, opzioni o nomi degli archetipi.
 *
 * Ogni domanda ha 6 opzioni, dal polo "meno" al polo "più" della dimensione,
 * con punteggi -2, -1, -1, +1, +1, +2.
 * Ogni persona riceve UNA domanda casuale per dimensione (4 clic in totale),
 * quindi i risultati sono sempre confrontabili anche se le domande sono diverse.
 */

export type Locale = 'it' | 'fr';
export type L = Record<Locale, string>;

export interface Option { emoji: string; text: L; score: number }
export interface Question { id: string; dim: DimKey; text: L; options: Option[] }

export const DIMENSIONS = [
  { key: 'energia', low: { it: 'Contemplativo', fr: 'Contemplatif' }, high: { it: 'Esploratore', fr: 'Explorateur' } },
  { key: 'gusto',   low: { it: 'Tradizione',    fr: 'Tradition' },    high: { it: 'Sperimentazione', fr: 'Expérimentation' } },
  { key: 'social',  low: { it: 'Salotto',       fr: 'Salon' },        high: { it: 'Festa', fr: 'Fête' } },
  { key: 'metodo',  low: { it: 'Pianificatore', fr: 'Planificateur' }, high: { it: 'Improvvisatore', fr: 'Improvisateur' } },
] as const;
export type DimKey = (typeof DIMENSIONS)[number]['key'];
export const DIM_KEYS: DimKey[] = DIMENSIONS.map(d => d.key);

const q = (id: string, dim: DimKey, it: string, fr: string, options: [string, string, string, number][]): Question => ({
  id, dim, text: { it, fr },
  options: options.map(([emoji, oit, ofr, score]) => ({ emoji, text: { it: oit, fr: ofr }, score })),
});

export const QUESTIONS: Question[] = [
  // ---------------- ENERGIA: contemplativo (-) / esploratore (+) ----------------
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
  q('e6', 'energia', 'Il tuo animale guida', 'Ton animal totem', [
    ['🐢', 'Tartaruga', 'Tortue', -2],
    ['🐈', 'Gatto', 'Chat', -1],
    ['🦉', 'Gufo', 'Hibou', -1],
    ['🐕', 'Cane', 'Chien', 1],
    ['🐬', 'Delfino', 'Dauphin', 1],
    ['🐆', 'Ghepardo', 'Guépard', 2],
  ]),
  // ---------------- GUSTO: tradizione (-) / sperimentazione (+) ----------------
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
  q('g3', 'gusto', 'Il caffè', 'Le café', [
    ['☕', 'Espresso al banco', 'Espresso au comptoir', -2],
    ['🥛', 'Cappuccino', 'Cappuccino', -1],
    ['🏠', 'Moka di casa', 'La moka de la maison', -1],
    ['🍵', 'Matcha', 'Matcha', 1],
    ['🧊', 'Caffè shakerato', 'Café frappé', 1],
    ['🧋', 'Cold brew con qualcosa dentro', 'Cold brew avec un truc dedans', 2],
  ]),
  q('g4', 'gusto', 'La cena ideale', 'Le dîner idéal', [
    ['👵', 'Dalla nonna, menu fisso', 'Chez mamie, menu unique', -2],
    ['🍝', 'Trattoria', 'Trattoria', -1],
    ['🍕', 'Pizzeria di fiducia', 'La pizzeria habituelle', -1],
    ['🍣', 'Sushi', 'Sushi', 1],
    ['🌮', 'Street food dall’altra parte del mondo', 'Street food de l’autre bout du monde', 1],
    ['🧪', 'Degustazione con le schiume', 'Menu dégustation avec des mousses', 2],
  ]),
  q('g5', 'gusto', 'Il gelato', 'La glace', [
    ['🍦', 'Fior di latte', 'Fior di latte', -2],
    ['🟢', 'Pistacchio', 'Pistache', -1],
    ['🍫', 'Cioccolato fondente', 'Chocolat noir', -1],
    ['🫚', 'Sorbetto allo zenzero', 'Sorbet au gingembre', 1],
    ['🧀', 'Gorgonzola e pere, esiste', 'Gorgonzola-poire, ça existe', 1],
    ['🎲', 'Il gusto del mese, qualunque sia', 'Le parfum du mois, quel qu’il soit', 2],
  ]),
  q('g6', 'gusto', 'Musica in macchina', 'Musique en voiture', [
    ['🎻', 'Classica', 'Classique', -2],
    ['🎸', 'Rock anni ’80', 'Rock des années 80', -1],
    ['🎙️', 'Cantautori italiani', 'Chanson italienne', -1],
    ['🎤', 'Rap', 'Rap', 1],
    ['🎹', 'Elettronica', 'Électro', 1],
    ['🎧', 'Playlist “scoperte della settimana”', 'Playlist « découvertes de la semaine »', 2],
  ]),
  // ---------------- SOCIAL: salotto (-) / festa (+) ----------------
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
  q('s4', 'social', 'Sabato sera', 'Samedi soir', [
    ['📚', 'Libro e coperta', 'Livre et plaid', -2],
    ['🎬', 'Cinema in due', 'Ciné à deux', -1],
    ['🍿', 'Serie TV e divano', 'Série et canapé', -1],
    ['🍕', 'Cena con dieci persone', 'Dîner à dix', 1],
    ['🎲', 'Giochi da tavolo fino a tardi', 'Jeux de société jusqu’à tard', 1],
    ['🎪', 'Concerto o festival', 'Concert ou festival', 2],
  ]),
  q('s5', 'social', 'Nuovo gruppo WhatsApp', 'Nouveau groupe WhatsApp', [
    ['🔇', 'Silenzioso per sempre', 'En sourdine pour toujours', -2],
    ['👍', 'Reagisco con un pollice', 'Je réagis avec un pouce', -1],
    ['👋', 'Rispondo solo se mi taggano', 'Je réponds seulement si on me tague', -1],
    ['💬', 'Rispondo a tutti', 'Je réponds à tout le monde', 1],
    ['😂', 'Mando i meme', 'J’envoie les memes', 1],
    ['📸', 'Propongo subito una cena', 'Je propose direct un dîner', 2],
  ]),
  q('s6', 'social', 'Il tuo superpotere', 'Ton super-pouvoir', [
    ['🫥', 'Invisibilità', 'Invisibilité', -2],
    ['🧠', 'Leggere nel pensiero', 'Lire dans les pensées', -1],
    ['⏸️', 'Fermare il tempo', 'Arrêter le temps', -1],
    ['🗣️', 'Parlare tutte le lingue', 'Parler toutes les langues', 1],
    ['🧲', 'Attirare le persone giuste', 'Attirer les bonnes personnes', 1],
    ['✨', 'Far ridere chiunque', 'Faire rire n’importe qui', 2],
  ]),
  // ---------------- METODO: pianificatore (-) / improvvisatore (+) ----------------
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
  q('m5', 'metodo', 'Ordinare al ristorante', 'Commander au restaurant', [
    ['📖', 'Ho letto il menu online ieri', 'J’ai lu la carte en ligne hier', -2],
    ['👀', 'Lo leggo tutto, due volte', 'Je lis tout, deux fois', -1],
    ['🔁', 'Prendo sempre lo stesso piatto', 'Je prends toujours le même plat', -1],
    ['👋', 'Chiedo cosa consiglia', 'Je demande ce qu’on conseille', 1],
    ['🎯', 'Punto il dito a caso', 'Je pointe au hasard', 1],
    ['🙈', 'Prendo quello che prende il vicino', 'Je prends la même chose que le voisin', 2],
  ]),
  q('m6', 'metodo', 'Il tuo frigo', 'Ton frigo', [
    ['🗂️', 'Organizzato per categorie', 'Rangé par catégories', -2],
    ['🥗', 'Spesa settimanale', 'Courses hebdomadaires', -1],
    ['🏷️', 'Etichette con la data', 'Étiquettes avec la date', -1],
    ['🍳', 'Qualcosa invento', 'J’invente un truc', 1],
    ['🧀', 'Un formaggio e una speranza', 'Un fromage et un espoir', 1],
    ['📞', 'Il delivery è una categoria', 'La livraison, c’est une catégorie', 2],
  ]),
];

const QUESTION_BY_ID = new Map(QUESTIONS.map(x => [x.id, x]));
export const getQuestion = (id: string) => QUESTION_BY_ID.get(id);

/** Estrae una domanda casuale per dimensione. */
export function pickQuestionIds(): string[] {
  return DIM_KEYS.map(dim => {
    const pool = QUESTIONS.filter(x => x.dim === dim);
    return pool[Math.floor(Math.random() * pool.length)].id;
  });
}

export function serializeQuestions(ids: string[], locale: Locale) {
  return ids.map(id => {
    const x = QUESTION_BY_ID.get(id)!;
    return { id: x.id, text: x.text[locale], options: x.options.map(o => ({ emoji: o.emoji, text: o.text[locale] })) };
  });
}

/** Da {questionId: optionIndex} a vettore [energia, gusto, social, metodo]. Lancia su input non valido. */
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

// ---------------- ARCHETIPI ----------------
// Titolo = energia × gusto ; epiteto = social × metodo  → 16 combinazioni buffe.
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
