/**
 * chat_project_tracker.js - androbs Universal Live Showcase & Community Queue
 * Detects, categorizes, and organizes games, tech projects, websites, handmade art and stream topics shared in live chat.
 * Requires i18n.js (UI translations) to be loaded first.
 */

const CPT_TAG_ORDER = ['GitHub', 'GitLab', 'Vercel', 'Netlify', 'Steam', 'itch.io', 'Etsy', 'Instagram', 'Web', 'App', 'Idea', 'Project'];

const CPT_CATEGORIES = {
  gaming: { icon: '🎮', link: '🕹️' },
  tech: { icon: '💻', link: '🔗' },
  web: { icon: '🌐', link: '🌐' },
  art: { icon: '🎨', link: '🛍️' },
  idea: { icon: '💡', link: '🔗' }
};
// label (chips), name (badges) and overlay (eyebrow) follow the current UI language.
Object.entries(CPT_CATEGORIES).forEach(([key, cat]) => {
  ['label', 'name', 'overlay'].forEach(field => {
    Object.defineProperty(cat, field, { enumerable: true, get: () => cptT(`cat.${key}.${field}`) });
  });
});
const CPT_CATEGORY_ORDER = Object.keys(CPT_CATEGORIES);

// Explicit chat commands -> category. Lookup is accent-insensitive ("!artesanía" == "!artesania").
const CPT_COMMANDS = {
  game: 'gaming', play: 'gaming', juego: 'gaming', jugar: 'gaming', gioco: 'gaming', jogo: 'gaming',
  project: 'tech', proyecto: 'tech', projeto: 'tech', progetto: 'tech', app: 'tech', repo: 'tech', tech: 'tech', code: 'tech',
  site: 'web', web: 'web', website: 'web', sitio: 'web', sito: 'web', portfolio: 'web',
  art: 'art', craft: 'art', handmade: 'art', arte: 'art', diy: 'art', artesania: 'art', manualidad: 'art', artigianato: 'art',
  idea: 'idea', idee: 'idea', topic: 'idea', tema: 'idea', argomento: 'idea', question: 'idea', pregunta: 'idea',
  domanda: 'idea', challenge: 'idea', reto: 'idea', sfida: 'idea'
};
const CPT_COMMAND_RE = /^!([\p{L}]+)\s+([\s\S]+)/u;

// Link hosts that decide the category on their own.
const CPT_GAMING_HOST_RE = /(?:^|\.)(?:steampowered\.com|steamcommunity\.com|itch\.io|epicgames\.com|gog\.com|roblox\.com|humblebundle\.com|gamejolt\.com|nintendo\.com|playstation\.com|xbox\.com)$/;
const CPT_ART_HOST_RE = /(?:^|\.)(?:etsy\.com|instagram\.com|artstation\.com|deviantart\.com|behance\.net|dribbble\.com|pinterest\.[a-z.]+|redbubble\.com|society6\.com|ravelry\.com)$/;
const CPT_CODE_HOST_RE = /(?:^|\.)(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|huggingface\.co|replit\.com|npmjs\.com|pypi\.org|crates\.io|chromewebstore\.google\.com|chrome\.google\.com|addons\.mozilla\.org|marketplace\.visualstudio\.com|play\.google\.com|apps\.apple\.com)$/;
// Clips and social posts are not "websites to review".
const CPT_MEDIA_HOST_RE = /(?:^|\.)(?:youtube\.com|youtu\.be|twitch\.tv|kick\.com|tiktok\.com|twitter\.com|x\.com|reddit\.com|imgur\.com|discord\.gg|discord\.com|giphy\.com|tenor\.com|facebook\.com|spotify\.com)$/;
const CPT_PLATFORM_LABELS = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

// "!vote 3", "!upvote #3", "!voto 3", "!vota 3"; "+1" votes for the project on stream (or the newest one).
const CPT_VOTE_CMD_RE = /^\s*!(?:vote|upvote|voto|vota|votar|votare)\s+#?(\d+)(?!\w)/i;
const CPT_PLUS_ONE_RE = /^\s*\+\s?1(?![\d.,])/;

// Matching runs on accent-stripped, lowercased text, so patterns only need plain ASCII.
const CPT_NOUNS = [
  // English
  'project', 'side project', 'app', 'application', 'tool', 'repo', 'repository', 'website', 'site', 'web app', 'webapp',
  'bot', 'extension', 'plugin', 'library', 'lib', 'package', 'framework', 'api', 'cli', 'dashboard', 'startup', 'saas',
  'widget', 'prototype', 'portfolio',
  // Spanish
  'proyecto', 'proyectito', 'aplicacion', 'herramienta', 'pagina', 'pagina web', 'sitio', 'sitio web', 'web', 'extension',
  'libreria', 'biblioteca', 'paquete', 'programa', 'prototipo', 'portafolio',
  // Italian
  'progetto', 'progettino', 'applicazione', 'strumento', 'sito', 'sito web', 'estensione', 'libreria', 'pacchetto',
  'programma', 'prototipo',
  // Handmade & art (EN / ES / IT)
  'painting', 'drawing', 'artwork', 'fanart', 'fan art', 'illustration', 'sculpture', 'crochet', 'amigurumi', 'amigurumis',
  'jewelry', 'pottery', 'cosplay', 'miniature', 'miniatures', 'craft', 'crafts', 'handmade',
  'cuadro', 'pintura', 'dibujo', 'ilustracion', 'escultura', 'tejido', 'tejidos', 'artesania', 'manualidad', 'manualidades',
  'joyeria', 'ceramica', 'quadro', 'dipinto', 'disegno', 'illustrazione', 'scultura', 'ricamo', 'gioielli', 'ritratto', 'retrato'
];
// Weaker nouns only count together with a "creation" verb (avoids "look at this game" on gaming streams).
const CPT_CREATION_ONLY_NOUNS = ['game', 'videogame', 'script', 'juego', 'videojuego', 'gioco', 'videogioco'];

const CPT_ATTENTION_INTROS = [
  // English
  'check out', 'check', 'look at', 'take a look at', 'have a look at', 'try', 'try out', 'here is', "here's",
  'sharing', 'i want to share', 'i wanted to share', 'let me share', 'introducing', 'presenting',
  'would love feedback on', 'would love your feedback on', 'feedback on', 'can you review', 'could you review',
  'can you check', 'could you check', 'what do you think of', 'what do you think about', 'thoughts on',
  'review', 'rate', 'roast', 'can you rate', 'can you roast', 'valora', 'puntua', 'califica', 'recensisci', 'valuta', 'giudica',
  'my new', 'my latest', 'my first', 'my own',
  // Spanish
  'mira', 'miren', 'mirad', 'echa un vistazo a', 'echale un vistazo a', 'echenle un vistazo a', 'chequea', 'chequeen',
  'checa', 'chequen', 'revisa', 'revisen', 'prueba', 'prueben', 'les comparto', 'te comparto', 'os comparto',
  'comparto', 'les dejo', 'te dejo', 'os dejo', 'aqui esta', 'aca esta', 'que opinas de', 'que opinan de',
  'podrias revisar', 'puedes revisar', 'podrias ver', 'puedes ver', 'les presento', 'te presento',
  'mi nuevo', 'mi nueva', 'mi primer', 'mi primera', 'mi propio', 'mi propia',
  // Italian
  'guarda', 'guardate', "dai un'occhiata a", "date un'occhiata a", "dai un'occhiata al", "date un'occhiata al",
  'prova', 'provate', 'vi condivido', 'ti condivido', 'condivido', 'vi presento', 'ti presento', 'ecco',
  'cosa ne pensi del', 'cosa ne pensi di', 'cosa ne pensate del', 'potresti guardare', 'puoi guardare', 'potresti provare',
  'il mio nuovo', 'la mia nuova', 'il mio primo', 'la mia prima', 'il mio', 'la mia'
];

const CPT_CREATION_INTROS = [
  // English
  'i built', 'i made', 'i created', 'i developed', 'i coded', 'i wrote', 'i launched', 'i released', 'i shipped',
  'i published', 'i open sourced', 'i open-sourced', "i've built", "i've made", "i've created", "i've developed",
  "i've been building", "i've been working on", "i'm building", "i'm working on", "i'm developing", "i'm making",
  'i am building', 'i am working on', 'just built', 'just made', 'just launched', 'just released', 'just shipped',
  'just finished', 'built', 'made',
  // Spanish
  'hice', 'he hecho', 'cree', 'he creado', 'desarrolle', 'he desarrollado', 'programe', 'he programado', 'arme',
  'construi', 'lance', 'he lanzado', 'publique', 'termine', 'estoy haciendo', 'estoy creando', 'estoy desarrollando',
  'estoy programando', 'estoy trabajando en', 'acabo de lanzar', 'acabo de crear', 'acabo de terminar',
  'acabo de publicar', 'acabo de hacer', 'creado', 'creada',
  // Italian
  'ho creato', 'ho fatto', 'ho sviluppato', 'ho realizzato', 'ho programmato', 'ho scritto', 'ho lanciato',
  'ho pubblicato', 'ho costruito', 'ho finito', 'sto creando', 'sto sviluppando', 'sto facendo', 'sto programmando',
  'sto lavorando a', 'sto lavorando su', 'ho appena lanciato', 'ho appena creato', 'ho appena finito',
  'ho appena pubblicato'
];

const CPT_IDEA_PATTERNS = [
  // English
  /\b(?:an? )?idea for (?:you|the stream|a stream|your stream|chat)\b/,
  /\bi have an? (?:project )?idea\b/,
  /\b(?:project )?(?:idea|suggestion|proposal):/,
  // Spanish
  /\bidea para (?:ti|vos|usted|el stream|el directo|el canal|un stream)\b/,
  /\btengo una idea\b/,
  /\b(?:propuesta|sugerencia|idea de proyecto):/,
  // Italian
  /\bun'idea per (?:te|voi|lo stream|la live)\b/,
  /\bidea per (?:te|voi|lo stream|la live)\b/,
  /\bho un'idea\b/,
  /\b(?:proposta|suggerimento|idea di progetto):/
];

// Suggestions only count when followed by a project noun ("you should build a bot", not "you should make a clip").
const CPT_SUGGESTION_INTROS = [
  // English
  'you should build', 'you should make', 'you should create', 'you should code', 'you should develop',
  'you could build', 'you could make', 'you could create', 'you could code', 'you can build', 'you can make',
  'we should build', 'we should make', 'we could build', 'we could make', 'what if you built', 'what if you made',
  'what if you build', 'what if you make', 'what if we built', 'what if we made', 'someone should build',
  'someone should make', 'how about building', 'how about making', 'how about creating', 'try building', 'try making',
  'it would be cool to build', 'it would be cool to make', 'would be cool to have',
  // Spanish
  'deberias hacer', 'deberias crear', 'deberias programar', 'deberias desarrollar', 'deberias armar',
  'podrias hacer', 'podrias crear', 'podrias programar', 'podrias desarrollar', 'podrias armar',
  'podes hacer', 'podes crear', 'puedes hacer', 'puedes crear', 'podriamos hacer', 'podriamos crear',
  'si haces', 'si hicieras', 'si creas', 'si crearas', 'si programas', 'si programaras', 'y si hacemos',
  'y si hicieramos', 'se podria hacer', 'se podria crear', 'estaria bueno hacer', 'estaria genial hacer',
  'estaria bueno un', 'estaria bueno una', 'seria genial un', 'seria genial una', 'que tal si haces',
  // Italian
  'potresti fare', 'potresti creare', 'potresti sviluppare', 'potresti programmare', 'potresti costruire',
  'dovresti fare', 'dovresti creare', 'dovresti sviluppare', 'dovresti programmare', 'potremmo fare',
  'potremmo creare', 'dovremmo fare', 'dovremmo creare', 'e se facessi', 'e se creassi', 'e se sviluppassi',
  'e se facessimo', 'sarebbe bello fare', 'sarebbe bello creare', 'sarebbe figo fare', 'sarebbe bello un',
  'sarebbe bello una'
];

// Hosting / code platforms that strongly suggest a shared project, even with no intro phrase.
const CPT_PROJECT_HOST_RE = /(?:^|[\s(])(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|[\w-]+\.github\.io|[\w-]+\.vercel\.app|[\w-]+\.netlify\.app|[\w-]+\.pages\.dev|[\w-]+\.glitch\.me|[\w-]+\.itch\.io|huggingface\.co\/spaces|replit\.com\/@|npmjs\.com\/package|pypi\.org\/project|chromewebstore\.google\.com|chrome\.google\.com\/webstore|addons\.mozilla\.org|marketplace\.visualstudio\.com|play\.google\.com\/store\/apps|apps\.apple\.com|store\.steampowered\.com\/app|steamcommunity\.com\/sharedfiles|store\.epicgames\.com|gog\.com\/(?:[a-z]{2}\/)?game|roblox\.com\/games|gamejolt\.com\/games|(?:[\w-]+\.)?etsy\.com|instagram\.com|(?:[\w-]+\.)?artstation\.com|deviantart\.com|behance\.net)\/?[^\s]*/i;

function cptEscapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cptAlternation(list) {
  return [...new Set(list)].sort((a, b) => b.length - a.length).map(cptEscapeRegex).join('|');
}

function cptNormalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc`´]/g, "'")
    .toLowerCase();
}

// "<intro> [up to 4 words like my/this/new/open-source] <noun>"
const CPT_GAP = "(?:\\s+[\\w'-]+){0,4}?";
const CPT_ATTENTION_RE = new RegExp(
  `(?:^|[^\\w'])(?:${cptAlternation(CPT_ATTENTION_INTROS)})${CPT_GAP}\\s+(?:${cptAlternation(CPT_NOUNS)})(?![\\w])`
);
const CPT_SUGGESTION_RE = new RegExp(
  `(?:^|[^\\w'])(?:${cptAlternation(CPT_SUGGESTION_INTROS)})${CPT_GAP}\\s+(?:${cptAlternation(CPT_NOUNS.concat(CPT_CREATION_ONLY_NOUNS))})(?![\\w])`
);
const CPT_CREATION_RE = new RegExp(
  `(?:^|[^\\w'])(?:${cptAlternation(CPT_CREATION_INTROS)})${CPT_GAP}\\s+(?:${cptAlternation(CPT_NOUNS.concat(CPT_CREATION_ONLY_NOUNS))})(?![\\w])`
);
// Any share intro + a non-media link counts as a site to review ("check this out https://my-shop.com").
const CPT_LINK_INTRO_RE = new RegExp(
  `(?:^|[^\\w'])(?:${cptAlternation(CPT_ATTENTION_INTROS.concat(CPT_CREATION_INTROS))})(?![\\w])`
);

function cptWords(list) {
  return new RegExp(`(?:^|[^\\w])(?:${cptAlternation(list)})(?![\\w])`);
}

// Keyword classes used when neither a command nor the link decides the category.
const CPT_ART_WORDS_RE = cptWords([
  'art', 'artwork', 'fanart', 'fan art', 'painting', 'paintings', 'drawing', 'drawings', 'sketch', 'illustration',
  'sculpture', 'crochet', 'knitting', 'knitted', 'amigurumi', 'amigurumis', 'handmade', 'hand made', 'craft', 'crafts',
  'diy', 'jewelry', 'jewellery', 'pottery', 'ceramics', 'embroidery', 'cosplay', 'miniature', 'miniatures', 'figurine',
  'commission', 'commissions', 'watercolor', 'portrait',
  'cuadro', 'cuadros', 'pintura', 'pinturas', 'dibujo', 'dibujos', 'ilustracion', 'escultura', 'ganchillo', 'tejido',
  'tejidos', 'artesania', 'artesanias', 'manualidad', 'manualidades', 'hecho a mano', 'hechos a mano', 'joyeria',
  'ceramica', 'bordado', 'bordados', 'acuarela', 'retrato',
  'quadro', 'quadri', 'dipinto', 'dipinti', 'disegno', 'disegni', 'illustrazione', 'scultura', 'uncinetto',
  'fatto a mano', 'fatti a mano', 'artigianato', 'gioielli', 'ricamo', 'acquerello', 'ritratto'
]);
const CPT_GAME_WORDS_RE = cptWords([
  'game', 'games', 'videogame', 'videogames', 'video game', 'indie game', 'game jam', 'gamejam', 'gameplay', 'roguelike',
  'metroidvania', 'speedrun', 'juego', 'juegos', 'videojuego', 'videojuegos', 'gioco', 'giochi', 'videogioco',
  'videogiochi', 'jogo', 'steam'
]);
const CPT_TECH_WORDS_RE = cptWords([
  'app', 'apps', 'application', 'webapp', 'web app', 'tool', 'repo', 'repository', 'bot', 'extension', 'plugin',
  'library', 'lib', 'package', 'framework', 'api', 'cli', 'script', 'dashboard', 'saas', 'widget', 'code', 'open source',
  'open-source', 'software', 'github', 'gitlab', 'aplicacion', 'herramienta', 'libreria', 'biblioteca', 'paquete',
  'programa', 'codigo', 'applicazione', 'strumento', 'pacchetto', 'programma', 'codice', 'estensione'
]);
const CPT_WEB_WORDS_RE = cptWords([
  'website', 'websites', 'site', 'web site', 'webpage', 'web page', 'homepage', 'landing page', 'portfolio', 'blog', 'web',
  'pagina web', 'pagina', 'sitio', 'sitio web', 'portafolio', 'sito', 'sito web', 'portale', 'portal'
]);

// Art shares that need no noun: "I painted this", "tejí esto", "ho dipinto questo".
const CPT_ART_VERB_RE = cptWords([
  'i painted', 'i drew', 'i sketched', 'i sculpted', 'i knitted', 'i crocheted', 'i sewed', 'i carved', 'i embroidered',
  'i illustrated', "i've painted", "i've drawn", "i've sculpted", "i've knitted", "i've crocheted", "i've sewn",
  'i have painted', 'i have drawn', 'just painted', 'just drew', 'just finished painting', 'just finished drawing',
  'pinte', 'dibuje', 'teji', 'esculpi', 'he pintado', 'he dibujado', 'he tejido', 'acabo de pintar', 'acabo de dibujar',
  'acabo de tejer', 'estoy pintando', 'estoy dibujando', 'estoy tejiendo',
  'ho dipinto', 'ho disegnato', 'ho cucito', 'ho scolpito', 'ho ricamato', 'ho lavorato a maglia', "ho fatto all'uncinetto",
  'sto dipingendo', 'sto disegnando'
]);

// "you should play <title>", "deberías jugar <title>", "dovresti giocare a <title>"
const CPT_GAME_SUGGESTION_RE = new RegExp(`(?:^|[^\\w'])(?:${cptAlternation([
  'you should play', 'you should try playing', 'you gotta play', 'you have to play', 'you need to play', 'you must play',
  'have you played', 'have you ever played', 'have you tried playing', 'try playing', 'please play', 'pls play', 'plz play',
  'can you play', 'could you play', 'will you play', 'would you play', 'game suggestion', 'game recommendation', 'game rec',
  'deberias jugar', 'tienes que jugar', 'tenes que jugar', 'teneis que jugar', 'juega al', 'juega a', 'jueguen', 'jugad',
  'has jugado', 'jugaste', 'podrias jugar', 'puedes jugar', 'podes jugar', 'te recomiendo jugar', 'te recomiendo el juego',
  'recomiendo el juego', 'juego recomendado',
  'dovresti giocare', 'devi giocare', 'hai mai giocato', 'hai giocato', 'potresti giocare', 'puoi giocare', 'gioca a',
  'prova a giocare', 'ti consiglio di giocare', 'ti consiglio il gioco', 'consiglio di gioco'
])})(?![\\w'])`);
// Words right after "play" that mean it is not a game title ("can you play that song again", "play more aggressive").
const CPT_GAME_STOP_RE = new RegExp(`^(?:${cptAlternation([
  'more', 'again', 'it', 'that', 'this', 'those', 'these', 'with', 'now', 'ranked', 'today', 'tonight', 'tomorrow',
  'something', 'anything', 'better', 'well', 'safe', 'solo', 'duo', 'music', 'song', 'songs', 'the song', 'a song',
  'some music', 'me', 'us', 'around', 'along', 'too', 'here', 'there', 'for', 'so', 'like',
  'mas', 'otra', 'otro', 'eso', 'esto', 'ahora', 'manana', 'hoy', 'bien', 'con', 'musica', 'la cancion', 'una cancion',
  'ancora', 'questo', 'quello', 'adesso', 'domani', 'oggi', 'bene', 'la canzone', 'una canzone', 'meglio'
])})(?![\\w])`);

// Stream discussion topics, challenges and Q&A questions (EN / ES / IT).
const CPT_TOPIC_PATTERNS = [
  /\b(?:stream |discussion |debate )?topic(?: idea| suggestion| for (?:the )?(?:next )?(?:stream|chat))?\s*:/,
  /\blet'?s (?:talk|chat|discuss) about\b/,
  /\b(?:we|you) should (?:talk|chat) about\b/,
  /\b(?:can|could) you (?:talk|chat) about\b/,
  /\bquestion for (?:the )?(?:streamer|stream|chat|q&a)\b\s*:?/,
  /\bq ?& ?a(?: topic| question)?\s*:/,
  /\b(?:stream |community )?challenge(?: idea)?\s*:/,
  /\byou should do (?:an?|the) (?:[\w-]+ ){0,3}challenge\b/,
  /\bdebate\s*:/,
  /\btemas? para (?:el |un )?(?:proximo )?(?:stream|directo|vivo)\b\s*:?/,
  /\btema\s*:/,
  /\bhablemos (?:de|sobre)\b/,
  /\b(?:deberias|podrias|podes|puedes) hablar (?:de|sobre)\b/,
  /\bpregunta para (?:el stream|el streamer|ti|vos|el chat)\b\s*:?/,
  /\b(?:reto|desafio)(?: para el stream)?\s*:/,
  /\b(?:deberias|podrias) hacer (?:un|el) (?:reto|desafio)\b/,
  /\bargomento(?: per (?:la live|lo stream))?\s*:/,
  /\bparliamo (?:di|del|della|dei|delle)\b/,
  /\b(?:dovresti|potresti) parlare (?:di|del|della|dei|delle)\b/,
  /\bdomanda per (?:te|la live|lo stream|lo streamer|la chat)\b\s*:?/,
  /\bsfida(?: per la live)?\s*:/,
  /\b(?:dovresti|potresti) fare una sfida\b/
];

const CPT_TITLE_FILLER_RE = /\s+(?:next|tonight|today|tomorrow|on stream|live|please|pls|plz|por favor|porfa|en el stream|en directo|en vivo|per favore|in live|stasera|domani|hoy|ma[nñ]ana|esta noche|again|sometime|lol|xd)$/i;
const CPT_TITLE_TAIL_RE = /\s+(?:it'?s|its|it is|is so|is really|is amazing|is great|es muy|es re|es buen\S*|es genial|est[aá] buen\S*|[eè] molto|[eè] bellissimo|because|porque|perch[eé]|so good|which|que es|che [eè])(?=\s|$).*$/i;

class ChatProjectTracker {
  constructor(options = {}) {
    this.containerId = options.containerId || 'chat-project-tracker-root';
    this.storageKey = options.storageKey || 'androbs_chat_project_tracker_v1';
    this.persist = options.persist !== false;
    this.onProjectAdded = options.onProjectAdded || null;
    this.onVote = options.onVote || null;
    this.overlayDuration = Number(options.overlayDuration) > 0 ? Number(options.overlayDuration) : 8000;
    this.filterState = 'all'; // 'all', 'new', 'reviewed'
    this.tagFilter = null;
    this.categoryFilter = null;
    this.searchQuery = '';
    this.sortMode = 'newest'; // 'newest' | 'votes'
    this.streamMode = 'all'; // 'all' or a category key: only that category is captured
    this.skippedCount = 0;
    this.onSkipped = options.onSkipped || null;
    this.seq = 0;
    this.onAirId = null;
    this.bumpId = null;
    this.projects = this.loadProjects();
    if (options.language) cptSetLanguage(options.language, { persist: false });
    if (typeof window !== 'undefined') {
      window.addEventListener('cpt:languagechange', () => {
        const el = document.getElementById(this.containerId);
        if (el && el.__cptTracker === this) this.initUI();
      });
    }

    this.initUI();
  }

  /**
   * Evaluates if a chat message contains something to showcase: a game, project, website, artwork or topic.
   * @param {Object} msg - { id, author, text, color, timestamp, platform }
   * @returns {Object|null} Extracted item (with `category`) or null if the message is just chat
   */
  analyzeMessage(msg) {
    if (!msg || !msg.text) return null;
    const text = String(msg.text).trim();
    if (!text) return null;
    const norm = cptNormalize(text);

    let kind = null; // 'command' | 'link' | 'intro' | 'idea' | 'game'
    let command = '';
    let forced = '';
    let title = '';
    let description = text;
    const url = this.extractUrl(text);
    const host = this.hostOf(url);

    // 1. Explicit triggers: !game, !project, !site, !art, !idea ... (see CPT_COMMANDS)
    const commandMatch = text.match(CPT_COMMAND_RE);
    const commandKey = commandMatch ? cptNormalize(commandMatch[1]) : '';

    if (commandMatch && CPT_COMMANDS[commandKey]) {
      kind = 'command';
      command = commandKey;
      forced = CPT_COMMANDS[commandKey];
      const content = commandMatch[2].trim();
      title = content.split(/\s+[-–—:|]\s+/)[0] || content.slice(0, 35);
      if (/^https?:\/\/\S+$/i.test(title)) title = this.titleFromUrl(url) || host;
      description = content;
    } else {
      // 2. Natural language detection (English, Spanish, Italian)
      let topic = null;
      let game = null;
      if ((topic = this.matchTopic(text, norm))) {
        kind = 'idea';
      } else if (CPT_IDEA_PATTERNS.some(re => re.test(norm)) || CPT_SUGGESTION_RE.test(norm)) {
        kind = 'idea';
      } else if ((game = this.matchGameSuggestion(text, norm)) && (game.title || CPT_GAMING_HOST_RE.test(host))) {
        kind = 'game';
        forced = 'gaming';
      } else if (CPT_CREATION_RE.test(norm) || CPT_ATTENTION_RE.test(norm) || CPT_ART_VERB_RE.test(norm)) {
        kind = 'intro';
      } else if (CPT_PROJECT_HOST_RE.test(text)) {
        kind = 'link';
      } else if (host && !CPT_MEDIA_HOST_RE.test(host) && CPT_LINK_INTRO_RE.test(norm)) {
        kind = 'intro';
      }

      if (kind) {
        title = this.titleFromUrl(url) || (kind === 'game' && game.title) || (topic && topic.title) || '';
      }
    }

    if (!kind) return null;

    const project = {
      id: msg.id || 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      author: msg.author || 'Viewer',
      authorColor: msg.color || '#60a5fa',
      title: title,
      description: description,
      url: url,
      status: 'new', // 'new' | 'reviewed'
      platform: CPT_PLATFORM_LABELS[msg.platform] ? msg.platform : '',
      votes: 0,
      voters: [],
      timestamp: msg.timestamp || Date.now()
    };
    project.category = this.detectCategory(project, { kind, forced, norm });
    if (!project.title) {
      project.title = (project.category === 'web' && host) || this.titleFromText(text, kind) || cptT('item.untitled');
    }
    project.tags = this.detectTags(project, { kind, command, norm, category: project.category });
    return project;
  }

  /** Category precedence: command > link host > idea/topic phrasing > keywords > any website link. */
  detectCategory(project, ctx = {}) {
    if (CPT_CATEGORIES[ctx.forced]) return ctx.forced;
    const host = this.hostOf(project.url);
    if (host) {
      if (CPT_GAMING_HOST_RE.test(host)) return 'gaming';
      if (CPT_ART_HOST_RE.test(host)) return 'art';
      if (CPT_CODE_HOST_RE.test(host)) return 'tech';
    }
    if (ctx.kind === 'idea') return 'idea';
    const norm = (ctx.norm || cptNormalize(`${project.title || ''} ${project.description || ''}`))
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\S+\.\S+\/\S*/g, ' ');
    if (CPT_ART_WORDS_RE.test(norm) || CPT_ART_VERB_RE.test(norm)) return 'art';
    if (CPT_GAME_WORDS_RE.test(norm)) return 'gaming';
    if (CPT_TECH_WORDS_RE.test(norm)) return 'tech';
    if (CPT_WEB_WORDS_RE.test(norm)) return 'web';
    if (host && !CPT_MEDIA_HOST_RE.test(host)) return 'web';
    return 'tech';
  }

  /** Returns { title } for stream topics / challenges / Q&A questions, otherwise null. */
  matchTopic(text, norm) {
    for (const re of CPT_TOPIC_PATTERNS) {
      const m = re.exec(norm);
      if (m) {
        const rest = this.sliceAligned(text, norm, m.index + m[0].length).replace(/^\s*[:\-–—]?\s*/, '');
        return { title: this.capitalize(this.cleanTitle(rest)) };
      }
    }
    return null;
  }

  /** Returns { title } for "you should play <game>"-style suggestions, otherwise null. */
  matchGameSuggestion(text, norm) {
    const m = CPT_GAME_SUGGESTION_RE.exec(norm);
    if (!m) return null;
    let start = m.index + m[0].length;
    start += norm.slice(start).match(/^\s*:?\s*(?:(?:a|al|to)\s+)?/)[0].length;
    const rest = norm.slice(start);
    if (!rest.trim() || CPT_GAME_STOP_RE.test(rest)) return null;
    return { title: this.capitalize(this.cleanTitle(this.sliceAligned(text, norm, start), true)) };
  }

  // Accent stripping usually keeps string length, so indexes found in `norm` map back onto the original text.
  sliceAligned(text, norm, start) {
    return text.length === norm.length ? text.slice(start) : norm.slice(start);
  }

  cleanTitle(raw, isGame = false) {
    let s = String(raw || '').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
    s = s.split(/\s+[-–—|]\s+|[!?;(\n]|[.,:](?:\s|$)/)[0].trim();
    if (isGame) {
      s = s.replace(CPT_TITLE_TAIL_RE, '');
      for (let i = 0; i < 3; i++) s = s.replace(CPT_TITLE_FILLER_RE, '').trim();
    }
    s = s.replace(/^["'“”«»]+|["'“”«»]+$/g, '').replace(/[^\p{L}\p{N})\]'"+]+$/u, '').trim();
    const words = s.split(/\s+/).filter(Boolean);
    return words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
  }

  capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  hostOf(url) {
    try {
      return url ? new URL(url).hostname.replace(/^www\./, '').toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  extractUrl(text) {
    const withScheme = text.match(/https?:\/\/[^\s<>"']+/i);
    let url = withScheme ? withScheme[0] : '';
    if (!url) {
      const bare = text.match(CPT_PROJECT_HOST_RE);
      if (bare) url = 'https://' + bare[0].trim().replace(/^\(/, '').replace(/^https?:\/\//i, '');
    }
    return url.replace(/[.,;:!?)\]}]+$/, '');
  }

  slugTitle(slug) {
    let v = String(slug || '');
    try { v = decodeURIComponent(v); } catch (e) { /* keep raw slug */ }
    return v.replace(/[-_+]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  titleFromUrl(url) {
    if (!url) return '';
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return '';
    }
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (/^(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)$/.test(host) && parts.length >= 2) {
      return parts[1].replace(/\.git$/, '');
    }
    const sub = host.match(/^([\w-]+)\.(?:vercel\.app|netlify\.app|pages\.dev|glitch\.me|itch\.io|github\.io|artstation\.com)$/);
    if (sub) return host.endsWith('github.io') && parts[0] ? parts[0] : sub[1];
    if (host === 'store.steampowered.com' && parts[0] === 'app' && parts[2]) return this.slugTitle(parts[2]);
    if (host === 'store.epicgames.com' && parts.indexOf('p') >= 0) return this.slugTitle(parts[parts.indexOf('p') + 1]);
    if (host === 'gog.com' && parts.indexOf('game') >= 0) return this.slugTitle(parts[parts.indexOf('game') + 1]);
    if (host === 'roblox.com' && parts[0] === 'games' && parts[2]) return this.slugTitle(parts[2]);
    if (/(?:^|\.)etsy\.com$/.test(host)) {
      if (parts[0] === 'shop' && parts[1]) return parts[1];
      if (parts[0] === 'listing' && parts[2]) return this.slugTitle(parts[2]);
    }
    if (host === 'instagram.com' && parts[0] && !/^(p|reel|reels|stories|tv|explore)$/.test(parts[0])) return '@' + parts[0];
    if (host === 'artstation.com' && parts[0] && parts[0] !== 'artwork') return parts[0];
    if (host === 'deviantart.com' && parts[1] === 'art' && parts[2]) return this.slugTitle(parts[2].replace(/-\d+$/, ''));
    return '';
  }

  titleFromText(text, kind) {
    let source = text.replace(/https?:\/\/[^\s]+/gi, '').trim();
    if (kind === 'idea') {
      const afterColon = source.split(/:\s+/).slice(1).join(': ').trim();
      if (afterColon) source = afterColon;
    }
    const words = source.split(/\s+/).filter(Boolean);
    return words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
  }

  detectTags(project, ctx = {}) {
    const tags = new Set();
    const norm = (ctx.norm || cptNormalize(`${project.title} ${project.description}`)).replace(/(?:https?:\/\/)?\S+\.\S+\/\S*/g, ' ');
    const command = ctx.command || '';
    const category = ctx.category || project.category || '';
    const host = this.hostOf(project.url);

    if (host) {
      if (host === 'github.com' || host.endsWith('.github.io')) tags.add('GitHub');
      else if (host === 'gitlab.com') tags.add('GitLab');
      else if (host.endsWith('vercel.app')) tags.add('Vercel');
      else if (host.endsWith('netlify.app')) tags.add('Netlify');
      else if (/(?:^|\.)(?:steampowered|steamcommunity)\.com$/.test(host)) tags.add('Steam');
      else if (/(?:^|\.)itch\.io$/.test(host)) tags.add('itch.io');
      else if (/(?:^|\.)etsy\.com$/.test(host)) tags.add('Etsy');
      else if (host === 'instagram.com') tags.add('Instagram');
      else tags.add('Web');
    }

    const appHost = /^(play\.google\.com|apps\.apple\.com|chromewebstore\.google\.com|chrome\.google\.com|addons\.mozilla\.org|marketplace\.visualstudio\.com)$/.test(host);
    const appWord = /(?:^|[^\w])(?:app|apps|application|aplicacion|applicazione|webapp|tool|herramienta|strumento|bot|extension|estensione|plugin)(?![\w])/.test(norm);
    if (command === 'app' || appHost || appWord) tags.add('App');

    if (ctx.kind === 'idea' || command === 'idea' || command === 'idee') tags.add('Idea');
    if (tags.size === 0 && (!category || category === 'tech')) tags.add('Project');

    return CPT_TAG_ORDER.filter(t => tags.has(t));
  }

  /**
   * Main entry point to feed incoming chat messages into the tracker
   */
  processMessage(msg) {
    if (msg && this.parseVote(msg.text)) return this.handleVote(msg);

    const project = this.analyzeMessage(msg);
    if (!project) return false;

    if (this.streamMode !== 'all' && project.category !== this.streamMode) {
      this.skippedCount++;
      this.renderStreamMode();
      if (typeof this.onSkipped === 'function') this.onSkipped(project);
      return false;
    }

    // Avoid exact duplicate descriptions from the same author
    const exists = this.projects.some(p => p.author === project.author && p.description === project.description);
    if (exists) return false;
    if (this.projects.some(p => p.id === project.id)) {
      project.id += '_' + Math.random().toString(36).substr(2, 5);
    }

    project.num = ++this.seq;
    this.projects.unshift(project);
    this.saveProjects();
    this.render();

    if (typeof this.onProjectAdded === 'function') {
      this.onProjectAdded(project);
    }
    return true;
  }

  // ---------- Community upvotes ----------

  /** Returns { num } for "!vote N" / "!upvote N", { plusOne: true } for "+1", otherwise null. */
  parseVote(text) {
    const value = String(text || '');
    const cmd = value.match(CPT_VOTE_CMD_RE);
    if (cmd) return { num: parseInt(cmd[1], 10) };
    return CPT_PLUS_ONE_RE.test(value) ? { plusOne: true } : null;
  }

  handleVote(msg) {
    const vote = this.parseVote(msg.text);
    if (!vote) return false;
    let target;
    if (vote.plusOne) {
      target = this.projects.find(p => p.id === this.onAirId) ||
        this.projects.reduce((best, p) => (!best || (p.num || 0) > (best.num || 0) ? p : best), null);
    } else {
      target = this.projects.find(p => p.num === vote.num);
    }
    if (!target) return false;
    const voter = `${msg.platform || 'chat'}:${String(msg.author || 'viewer').toLowerCase()}`;
    return this.upvote(target.id, voter);
  }

  /** Adds one vote per voter key; returns false for duplicates or unknown projects. */
  upvote(projectId, voter) {
    const item = this.projects.find(p => p.id === projectId);
    if (!item) return false;
    item.voters = item.voters || [];
    if (voter && item.voters.includes(voter)) return false;
    if (voter) item.voters.push(voter);
    item.votes = (item.votes || 0) + 1;
    this.bumpId = item.id;
    this.saveProjects();
    this.render();
    if (this.onAirId === item.id) this.updateOverlayVotes(item);
    if (typeof this.onVote === 'function') this.onVote(item, voter);
    return true;
  }

  setSort(mode) {
    this.sortMode = mode === 'votes' ? 'votes' : 'newest';
    this.saveProjects();
    this.render();
  }

  // ---------- Categories & Stream Mode ----------

  /** Restricts which category chat submissions are captured for ('all' accepts everything). */
  setStreamMode(mode) {
    this.streamMode = CPT_CATEGORIES[mode] ? mode : 'all';
    this.skippedCount = 0;
    this.saveProjects();
    this.render();
    const cat = CPT_CATEGORIES[this.streamMode];
    this.showToast(cat ? cptT('toast.modeOn', { icon: cat.icon, label: cat.label }) : cptT('toast.modeAll'));
  }

  setCategoryFilter(category) {
    this.categoryFilter = CPT_CATEGORIES[category] && category !== this.categoryFilter ? category : null;
    this.render();
  }

  // ---------- Broadcast overlay ----------

  showOnStream(projectId) {
    if (typeof document === 'undefined') return false;
    const p = this.projects.find(x => x.id === projectId);
    if (!p) return false;
    this.hideOverlay();

    const esc = v => this.escapeHtml(v);
    const url = this.safeUrl(p.url);
    const desc = String(p.description || '').split(p.url || '\u0000').join(' ').replace(/\s+/g, ' ').replace(/[\s:,-]+$/, '').trim();
    const linkLabel = url ? url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '') : '';
    const platform = CPT_PLATFORM_LABELS[p.platform];
    const catKey = CPT_CATEGORIES[p.category] ? p.category : 'tech';
    const cat = CPT_CATEGORIES[catKey];

    const [byBefore, byAfter = ''] = cptT('overlay.by', { author: '\u0000' }).split('\u0000');
    const byHtml = `${esc(byBefore)}<span style="color: ${this.safeColor(p.authorColor)}">@${esc(p.author)}</span>${esc(byAfter)}`;

    const el = document.createElement('div');
    el.className = `cpt-overlay cpt-cat-${catKey}`;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.setProperty('--cpt-overlay-duration', `${this.overlayDuration}ms`);
    el.innerHTML = `
      <div class="cpt-overlay-accent"></div>
      <div class="cpt-overlay-icon" aria-hidden="true">${cat.icon}</div>
      <div class="cpt-overlay-body">
        <div class="cpt-overlay-eyebrow">
          <span class="cpt-overlay-live"><span class="cpt-overlay-dot"></span>${esc(cat.overlay)}</span>
          <span class="cpt-overlay-chip cpt-overlay-cat">${cat.icon} ${esc(cat.name)}</span>
          ${p.num ? `<span class="cpt-overlay-chip">#${esc(p.num)}</span>` : ''}
          ${platform ? `<span class="cpt-overlay-chip cpt-platform-${esc(p.platform)}">${esc(platform)}</span>` : ''}
          <span class="cpt-overlay-chip cpt-overlay-votes">▲ ${esc(p.votes || 0)}</span>
        </div>
        <div class="cpt-overlay-title">${esc(p.title)}</div>
        <div class="cpt-overlay-author">${byHtml}</div>
        ${desc ? `<div class="cpt-overlay-desc">${esc(desc)}</div>` : ''}
        ${url ? `<a class="cpt-overlay-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${cat.link} ${esc(linkLabel)}</a>` : ''}
      </div>
      <button class="cpt-overlay-close" type="button" aria-label="${esc(cptT('overlay.hide'))}">✕</button>
      <div class="cpt-overlay-progress"></div>
    `;
    el.querySelector('.cpt-overlay-close').addEventListener('click', () => this.hideOverlay());
    document.body.appendChild(el);
    void el.offsetWidth; // start the slide-in transition from the off-screen state
    el.classList.add('cpt-overlay-in');

    this.overlayEl = el;
    this.onAirId = p.id;
    this.overlayTimer = setTimeout(() => this.hideOverlay(), this.overlayDuration);
    this.render();
    return true;
  }

  hideOverlay() {
    clearTimeout(this.overlayTimer);
    const el = this.overlayEl;
    this.overlayEl = null;
    const wasOnAir = this.onAirId;
    this.onAirId = null;
    if (el) {
      el.classList.remove('cpt-overlay-in');
      el.classList.add('cpt-overlay-out');
      setTimeout(() => el.remove(), 700);
    }
    if (wasOnAir) this.render();
  }

  updateOverlayVotes(item) {
    const badge = this.overlayEl && this.overlayEl.querySelector('.cpt-overlay-votes');
    if (!badge) return;
    badge.textContent = `▲ ${item.votes || 0}`;
    badge.classList.remove('cpt-vote-bump');
    void badge.offsetWidth;
    badge.classList.add('cpt-vote-bump');
  }

  toggleStatus(projectId) {
    const item = this.projects.find(p => p.id === projectId);
    if (item) {
      item.status = item.status === 'new' ? 'reviewed' : 'new';
      this.saveProjects();
      this.render();
    }
  }

  deleteProject(projectId) {
    if (this.onAirId === projectId) this.hideOverlay();
    this.projects = this.projects.filter(p => p.id !== projectId);
    this.saveProjects();
    this.render();
  }

  clearAll(skipConfirm = false) {
    if (this.projects.length === 0) return false;
    if (!skipConfirm && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(cptT('confirm.clearAll', { n: this.projects.length }))) return false;
    }
    this.hideOverlay();
    this.projects = [];
    this.seq = 0;
    this.saveProjects();
    this.render();
    this.showToast(cptT('toast.cleared'));
    return true;
  }

  setFilter(filter) {
    this.filterState = filter;
    this.render();
  }

  setTagFilter(tag) {
    this.tagFilter = tag && tag !== this.tagFilter ? tag : null;
    this.render();
  }

  setSearch(query) {
    this.searchQuery = String(query || '');
    this.render();
  }

  // ---------- Persistence ----------

  getStorage() {
    if (!this.persist) return null;
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
      return null; // e.g. storage disabled by browser privacy settings
    }
  }

  loadProjects() {
    const storage = this.getStorage();
    if (!storage) return [];
    try {
      const meta = JSON.parse(storage.getItem(`${this.storageKey}_meta`) || '{}') || {};
      if (meta.sortMode === 'votes') this.sortMode = 'votes';
      if (CPT_CATEGORIES[meta.streamMode]) this.streamMode = meta.streamMode;
      const parsed = JSON.parse(storage.getItem(this.storageKey) || '[]');
      if (!Array.isArray(parsed)) return [];
      const projects = parsed
        .filter(p => p && typeof p === 'object' && p.id)
        .map(p => {
          const item = {
            ...p,
            status: p.status === 'reviewed' ? 'reviewed' : 'new',
            votes: Math.max(0, parseInt(p.votes, 10) || 0),
            voters: Array.isArray(p.voters) ? p.voters : []
          };
          if (!CPT_CATEGORIES[item.category]) {
            item.category = this.detectCategory(item, { kind: (item.tags || []).includes('Idea') ? 'idea' : 'intro' });
          }
          if (!Array.isArray(item.tags) || !item.tags.length) item.tags = this.detectTags(item);
          return item;
        });
      // Never reuse a vote number, even after deletions; number legacy projects oldest-first.
      this.seq = Math.max(parseInt(meta.seq, 10) || 0, ...projects.map(p => p.num || 0), 0);
      projects.filter(p => !p.num).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)).forEach(p => { p.num = ++this.seq; });
      return projects;
    } catch (e) {
      console.warn('[ChatProjectTracker] Could not read saved projects:', e);
      return [];
    }
  }

  saveProjects() {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.setItem(this.storageKey, JSON.stringify(this.projects));
      storage.setItem(`${this.storageKey}_meta`, JSON.stringify({ seq: this.seq, sortMode: this.sortMode, streamMode: this.streamMode }));
    } catch (e) {
      console.warn('[ChatProjectTracker] Could not save projects:', e);
    }
  }

  // ---------- Export ----------

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.projects, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `androbs_projects_${Date.now()}.json`);
    dlAnchor.click();
  }

  toMarkdown(projects = this.projects.filter(p => p.status === 'reviewed')) {
    const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
    const escText = s => clean(s).replace(/([\\[\]*_`])/g, '\\$1');
    return projects.map(p => {
      const title = escText(p.title) || cptT('md.untitled');
      const safeUrl = this.safeUrl(p.url);
      const head = safeUrl ? `[${title}](${safeUrl.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : `**${title}**`;
      const desc = clean(String(p.description || '').split(p.url || '\u0000').join(' ')).replace(/[\s:,-]+$/, '');
      return `- ${cptT('md.item', { head, author: clean(p.author) })}${desc ? `: ${desc}` : ''}`;
    }).join('\n');
  }

  async copyMarkdown() {
    const reviewed = this.projects.filter(p => p.status === 'reviewed');
    if (reviewed.length === 0) {
      this.showToast(cptT('toast.noReviewed'), 'warn');
      return false;
    }
    const md = this.toMarkdown(reviewed);
    const ok = await this.copyToClipboard(md);
    this.showToast(
      ok ? cptT('toast.copied', { n: reviewed.length }) : cptT('toast.clipboardError'),
      ok ? 'success' : 'error'
    );
    return ok;
  }

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* fall back below */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  showToast(message, type = 'success') {
    const root = typeof document !== 'undefined' && document.getElementById(this.containerId);
    const host = root && root.querySelector('.cpt-container');
    if (!host) return;
    const toast = document.createElement('div');
    toast.className = `cpt-toast cpt-toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('cpt-toast-visible'));
    setTimeout(() => {
      toast.classList.remove('cpt-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // ---------- UI ----------

  escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  safeUrl(url) {
    return /^https?:\/\//i.test(url || '') ? url : '';
  }

  safeColor(color) {
    return /^#[0-9a-f]{3,8}$/i.test(color || '') ? color : '#60a5fa';
  }

  getFilteredProjects() {
    const query = cptNormalize(this.searchQuery).trim();
    const terms = query ? query.split(/\s+/) : [];
    const byNewest = (a, b) => (b.num || 0) - (a.num || 0) || (b.timestamp || 0) - (a.timestamp || 0);
    const sorter = this.sortMode === 'votes' ? (a, b) => (b.votes || 0) - (a.votes || 0) || byNewest(a, b) : byNewest;
    return this.projects.filter(p => {
      if (this.filterState !== 'all' && p.status !== this.filterState) return false;
      if (this.categoryFilter && p.category !== this.categoryFilter) return false;
      if (this.tagFilter && !(p.tags || []).includes(this.tagFilter)) return false;
      if (terms.length) {
        const catWords = CPT_CATEGORIES[p.category] ? [...cptTAll(`cat.${p.category}.name`), ...cptTAll(`cat.${p.category}.label`)] : [];
        const haystack = cptNormalize([p.title, p.author, p.description, p.url, (p.tags || []).join(' '), ...catWords].join(' '));
        return terms.every(t => haystack.includes(t));
      }
      return true;
    }).sort(sorter);
  }

  initUI() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const esc = v => this.escapeHtml(v);
    const t = (key, params) => esc(cptT(key, params));
    container.__cptTracker = this;
    container.innerHTML = `
      <div class="cpt-container">
        <div class="cpt-header">
          <div class="cpt-header-top">
            <div class="cpt-title-wrap">
              <div class="cpt-icon">✨</div>
              <div>
                <h3 class="cpt-title">${t('app.title')}</h3>
                <p class="cpt-subtitle">${t('app.subtitle')}</p>
              </div>
            </div>
            <div class="cpt-header-meta">
              <span class="cpt-badge-count" id="cpt-counter"></span>
              <select class="cpt-lang-select" id="cpt-lang" aria-label="${t('lang.label')}" title="${t('lang.label')}">
                ${Object.keys(CPT_LANGUAGES).map(code => `<option value="${code}" title="${esc(CPT_LANGUAGES[code].label)}" ${code === cptGetLanguage() ? 'selected' : ''}>${CPT_LANGUAGES[code].flag} ${code.toUpperCase()}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="cpt-search-row">
            <div class="cpt-search-wrap">
              <span class="cpt-search-icon">🔍</span>
              <input type="search" class="cpt-search" id="cpt-search" placeholder="${t('search.placeholder')}" autocomplete="off" aria-label="${t('search.aria')}">
            </div>
            <div class="cpt-sort-toggle" role="group" aria-label="${t('sort.aria')}">
              <button class="cpt-sort-btn" data-action="sort" data-sort="newest" title="${t('sort.newestTitle')}">${t('sort.newest')}</button>
              <button class="cpt-sort-btn" data-action="sort" data-sort="votes" title="${t('sort.votesTitle')}">${t('sort.votes')}</button>
            </div>
          </div>
          <div class="cpt-tag-filters cpt-cat-filters" id="cpt-cat-filters" aria-label="${t('cat.filterAria')}"></div>
          <div class="cpt-mode-row" id="cpt-mode-row">
            <label class="cpt-mode-label" for="cpt-stream-mode">${t('mode.label')}</label>
            <select class="cpt-mode-select" id="cpt-stream-mode">
              <option value="all">${t('mode.all')}</option>
              ${CPT_CATEGORY_ORDER.map(c => `<option value="${c}">${t('mode.only', { icon: CPT_CATEGORIES[c].icon, label: CPT_CATEGORIES[c].label })}</option>`).join('')}
            </select>
            <span class="cpt-mode-note" id="cpt-mode-note"></span>
          </div>
        </div>

        <div class="cpt-actions">
          <button class="cpt-btn cpt-btn-primary" data-action="export-json">${t('action.exportJson')}</button>
          <button class="cpt-btn cpt-btn-primary" data-action="copy-md">${t('action.copyMd')}</button>
          <div class="cpt-filter-group">
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="all">${t('filter.all')}</button>
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="new">${t('filter.new')}</button>
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="reviewed">${t('filter.reviewed')}</button>
          </div>
          <button class="cpt-btn cpt-btn-danger" data-action="clear-all" title="${t('action.clearAllTitle')}">${t('action.clearAll')}</button>
        </div>

        <div class="cpt-list" id="cpt-list-items"></div>
      </div>
    `;

    const searchEl = container.querySelector('#cpt-search');
    searchEl.value = this.searchQuery;
    searchEl.addEventListener('input', e => this.setSearch(e.target.value));
    container.querySelector('#cpt-lang').addEventListener('change', e => cptSetLanguage(e.target.value));
    container.querySelector('#cpt-stream-mode').addEventListener('change', e => this.setStreamMode(e.target.value));

    const root = container.querySelector('.cpt-container');
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !root.contains(btn)) return;
      const { action, id, filter, tag, sort, category } = btn.dataset;
      switch (action) {
        case 'export-json': this.exportJSON(); break;
        case 'copy-md': this.copyMarkdown(); break;
        case 'clear-all': this.clearAll(); break;
        case 'filter': this.setFilter(filter); break;
        case 'tag': this.setTagFilter(tag); break;
        case 'category': this.setCategoryFilter(category); break;
        case 'sort': this.setSort(sort); break;
        case 'show': this.onAirId === id ? this.hideOverlay() : this.showOnStream(id); break;
        case 'toggle': this.toggleStatus(id); break;
        case 'delete': this.deleteProject(id); break;
      }
    });

    this.render();
  }

  renderCategoryFilters() {
    const el = document.getElementById('cpt-cat-filters');
    if (!el) return;
    const esc = v => this.escapeHtml(v);
    const counts = {};
    this.projects.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    if (this.tagFilter && !this.projects.some(p => (p.tags || []).includes(this.tagFilter))) this.tagFilter = null;

    const chip = (key, label, count) => {
      const active = key ? this.categoryFilter === key : !this.categoryFilter;
      return `
      <button class="cpt-tag-chip cpt-cat-chip ${key ? `cpt-cat-${key}` : ''} ${active ? 'cpt-active' : ''} ${count ? '' : 'cpt-empty'}"
        data-action="category" data-category="${key}" aria-pressed="${active}">${label} <span class="cpt-chip-count">${count}</span></button>`;
    };
    el.innerHTML = chip('', esc(cptT('filter.all')), this.projects.length) +
      CPT_CATEGORY_ORDER.map(c => chip(c, `${CPT_CATEGORIES[c].icon} ${esc(CPT_CATEGORIES[c].label)}`, counts[c] || 0)).join('') +
      (this.tagFilter ? `<button class="cpt-tag-chip cpt-tag-pill cpt-active" data-action="tag" data-tag="${esc(this.tagFilter)}" title="${esc(cptT('tag.clear'))}">🏷 ${esc(this.tagFilter)} ✕</button>` : '');
  }

  renderStreamMode() {
    if (typeof document === 'undefined') return;
    const row = document.getElementById('cpt-mode-row');
    if (!row) return;
    const select = row.querySelector('#cpt-stream-mode');
    if (select.value !== this.streamMode) select.value = this.streamMode;
    row.className = `cpt-mode-row ${this.streamMode !== 'all' ? `cpt-mode-active cpt-cat-${this.streamMode}` : ''}`;
    row.querySelector('#cpt-mode-note').textContent = this.streamMode === 'all'
      ? cptT('mode.noteAll')
      : cptT('mode.skipped', { n: this.skippedCount });
  }

  render() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('cpt-list-items');
    const counterEl = document.getElementById('cpt-counter');
    if (!listEl) return;

    this.renderCategoryFilters();
    this.renderStreamMode();
    const filtered = this.getFilteredProjects();

    if (counterEl) {
      const total = this.projects.length;
      counterEl.textContent = filtered.length === total
        ? cptT('count.items', { n: total })
        : cptT('count.filtered', { n: total, shown: filtered.length });
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.querySelectorAll('.cpt-filter-btn').forEach(b => {
        b.classList.toggle('cpt-active', b.dataset.filter === this.filterState);
      });
      container.querySelectorAll('.cpt-sort-btn').forEach(b => {
        const active = b.dataset.sort === this.sortMode;
        b.classList.toggle('cpt-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = this.projects.length === 0 ? `
        <div class="cpt-empty-state">
          <div class="cpt-empty-icon">💬</div>
          <p>${this.escapeHtml(cptT('empty.none'))}</p>
          <small style="opacity: 0.7;">${this.escapeHtml(cptT('empty.hint'))}</small>
        </div>
      ` : `
        <div class="cpt-empty-state">
          <div class="cpt-empty-icon">🔎</div>
          <p>${this.escapeHtml(cptT('empty.noMatch'))}</p>
        </div>
      `;
      return;
    }

    const esc = v => this.escapeHtml(v);
    const bumpId = this.bumpId;
    this.bumpId = null;
    listEl.innerHTML = filtered.map(p => {
      const url = this.safeUrl(p.url);
      const onAir = this.onAirId === p.id;
      const platform = CPT_PLATFORM_LABELS[p.platform];
      const catKey = CPT_CATEGORIES[p.category] ? p.category : 'tech';
      const cat = CPT_CATEGORIES[catKey];
      return `
      <div class="cpt-card cpt-cat-${catKey} ${onAir ? 'cpt-on-air' : ''}" data-id="${esc(p.id)}">
        <div class="cpt-card-header">
          <h4 class="cpt-card-title">
            ${p.num ? `<span class="cpt-num" title="${esc(cptT('card.voteHint', { num: p.num }))}">#${esc(p.num)}</span>` : ''}
            <span>${esc(p.title)}</span>
          </h4>
          <div class="cpt-card-badges">
            <span class="cpt-upvotes ${p.votes ? 'cpt-has-votes' : ''} ${bumpId === p.id ? 'cpt-vote-bump' : ''}" title="${esc(cptT('card.upvotes', { n: p.votes || 0, num: p.num }))}">▲ ${esc(p.votes || 0)}</span>
            <span class="cpt-tag ${p.status === 'new' ? 'cpt-tag-new' : 'cpt-tag-reviewed'}">
              ${esc(cptT(p.status === 'new' ? 'status.new' : 'status.reviewed'))}
            </span>
          </div>
        </div>
        <div class="cpt-card-tags">
          <span class="cpt-cat-badge">${cat.icon} ${esc(cat.label)}</span>
          ${(p.tags || []).map(t => `<button class="cpt-mini-tag cpt-tag-${esc(t.toLowerCase().replace(/[^a-z0-9]/g, ''))} ${this.tagFilter === t ? 'cpt-active' : ''}" data-action="tag" data-tag="${esc(t)}" title="${esc(cptT('card.filterTag', { tag: t }))}">[${esc(t)}]</button>`).join('')}
        </div>
        <p class="cpt-card-desc">${esc(p.description)}</p>
        <div class="cpt-card-footer">
          <span class="cpt-card-author" style="color: ${this.safeColor(p.authorColor)}">@${esc(p.author)}${platform ? ` <span class="cpt-platform-badge cpt-platform-${esc(p.platform)}">${esc(platform)}</span>` : ''}</span>
          <div class="cpt-card-actions">
            ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="cpt-card-link">${esc(cptT('card.link'))}</a>` : ''}
            <button class="cpt-btn cpt-btn-xs cpt-btn-stream ${onAir ? 'cpt-active' : ''}" data-action="show" data-id="${esc(p.id)}" title="${esc(cptT(onAir ? 'card.hideTitle' : 'card.showTitle'))}">
              ${esc(cptT(onAir ? 'card.onAir' : 'card.show'))}
            </button>
            <button class="cpt-btn cpt-btn-xs" data-action="toggle" data-id="${esc(p.id)}">
              ${esc(cptT(p.status === 'new' ? 'card.markReviewed' : 'card.markNew'))}
            </button>
            <button class="cpt-btn cpt-btn-xs" style="color: #ef4444;" data-action="delete" data-id="${esc(p.id)}" title="${esc(cptT('card.delete'))}">✕</button>
          </div>
        </div>
      </div>
    `;
    }).join('');
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.ChatProjectTracker = ChatProjectTracker;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChatProjectTracker };
}
