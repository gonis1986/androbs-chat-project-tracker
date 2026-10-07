/**
 * chat_project_tracker.js - AndrOBS Live Chat Project Tracker
 * Automatically detects, extracts, and organizes projects & ideas shared in live stream chat.
 */

const CPT_TAG_ORDER = ['GitHub', 'GitLab', 'Vercel', 'Netlify', 'Web', 'App', 'Idea', 'Project'];

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
  'programma', 'prototipo'
];
// Weaker nouns only count together with a "creation" verb (avoids "look at this game" on gaming streams).
const CPT_CREATION_ONLY_NOUNS = ['game', 'videogame', 'script', 'juego', 'videojuego', 'gioco', 'videogioco'];

const CPT_ATTENTION_INTROS = [
  // English
  'check out', 'check', 'look at', 'take a look at', 'have a look at', 'try', 'try out', 'here is', "here's",
  'sharing', 'i want to share', 'i wanted to share', 'let me share', 'introducing', 'presenting',
  'would love feedback on', 'would love your feedback on', 'feedback on', 'can you review', 'could you review',
  'can you check', 'could you check', 'what do you think of', 'what do you think about', 'thoughts on',
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
const CPT_PROJECT_HOST_RE = /(?:^|[\s(])(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|[\w-]+\.github\.io|[\w-]+\.vercel\.app|[\w-]+\.netlify\.app|[\w-]+\.pages\.dev|[\w-]+\.glitch\.me|[\w-]+\.itch\.io|huggingface\.co\/spaces|replit\.com\/@|npmjs\.com\/package|pypi\.org\/project|chromewebstore\.google\.com|chrome\.google\.com\/webstore|addons\.mozilla\.org|marketplace\.visualstudio\.com|play\.google\.com\/store\/apps|apps\.apple\.com)\/?[^\s]*/i;

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

class ChatProjectTracker {
  constructor(options = {}) {
    this.containerId = options.containerId || 'chat-project-tracker-root';
    this.storageKey = options.storageKey || 'androbs_chat_project_tracker_v1';
    this.persist = options.persist !== false;
    this.onProjectAdded = options.onProjectAdded || null;
    this.filterState = 'all'; // 'all', 'new', 'reviewed'
    this.tagFilter = null;
    this.searchQuery = '';
    this.projects = this.loadProjects();

    this.initUI();
  }

  /**
   * Evaluates if a chat message contains a project proposal, idea, or repo link.
   * @param {Object} msg - { id, author, text, color, timestamp }
   * @returns {Object|null} Extracted project data or null if not a project
   */
  analyzeMessage(msg) {
    if (!msg || !msg.text) return null;
    const text = String(msg.text).trim();
    if (!text) return null;
    const norm = cptNormalize(text);

    let kind = null; // 'command' | 'link' | 'intro' | 'idea'
    let command = '';
    let title = '';
    let description = text;
    const url = this.extractUrl(text);

    // 1. Explicit triggers: !project, !idea, !proyecto, !app, !progetto, !repo
    const commandMatch = text.match(/^!(project|proyecto|projeto|progetto|idea|idee|app|repo)\s+(.+)/i);

    if (commandMatch) {
      kind = 'command';
      command = commandMatch[1].toLowerCase();
      const content = commandMatch[2].trim();
      title = content.split(/\s+[-–—:|]\s+/)[0] || content.slice(0, 35);
      description = content;
    } else {
      // 2. Natural language detection (English, Spanish, Italian)
      const ideaMatch = CPT_IDEA_PATTERNS.some(re => re.test(norm)) || CPT_SUGGESTION_RE.test(norm);
      if (ideaMatch) {
        kind = 'idea';
      } else if (CPT_CREATION_RE.test(norm) || CPT_ATTENTION_RE.test(norm)) {
        kind = 'intro';
      } else if (CPT_PROJECT_HOST_RE.test(text)) {
        kind = 'link';
      }

      if (kind) {
        title = this.titleFromUrl(url) || this.titleFromText(text, kind);
      }
    }

    if (!kind) return null;

    const project = {
      id: msg.id || 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      author: msg.author || 'Viewer',
      authorColor: msg.color || '#60a5fa',
      title: title || 'Nuovo Progetto',
      description: description,
      url: url,
      status: 'new', // 'new' | 'reviewed'
      timestamp: msg.timestamp || Date.now()
    };
    project.tags = this.detectTags(project, { kind, command, norm });
    return project;
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

  titleFromUrl(url) {
    if (!url) return '';
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return '';
    }
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (/^(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)$/.test(host) && parts.length >= 2) {
      return parts[1].replace(/\.git$/, '');
    }
    const sub = host.match(/^([\w-]+)\.(?:vercel\.app|netlify\.app|pages\.dev|glitch\.me|itch\.io|github\.io)$/);
    if (sub) return host.endsWith('github.io') && parts[0] ? parts[0] : sub[1];
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
    let host = '';
    try {
      host = project.url ? new URL(project.url).hostname.replace(/^www\./, '') : '';
    } catch (e) { /* ignore malformed URLs */ }

    if (host) {
      if (host === 'github.com' || host.endsWith('.github.io')) tags.add('GitHub');
      else if (host === 'gitlab.com') tags.add('GitLab');
      else if (host.endsWith('vercel.app')) tags.add('Vercel');
      else if (host.endsWith('netlify.app')) tags.add('Netlify');
      else tags.add('Web');
    }

    const appHost = /^(play\.google\.com|apps\.apple\.com|chromewebstore\.google\.com|chrome\.google\.com|addons\.mozilla\.org|marketplace\.visualstudio\.com)$/.test(host);
    const appWord = /(?:^|[^\w])(?:app|apps|application|aplicacion|applicazione|webapp|tool|herramienta|strumento|bot|extension|estensione|plugin)(?![\w])/.test(norm);
    if (command === 'app' || appHost || appWord) tags.add('App');

    if (ctx.kind === 'idea' || command === 'idea' || command === 'idee') tags.add('Idea');
    if (tags.size === 0) tags.add('Project');

    return CPT_TAG_ORDER.filter(t => tags.has(t));
  }

  /**
   * Main entry point to feed incoming chat messages into the tracker
   */
  processMessage(msg) {
    const project = this.analyzeMessage(msg);
    if (!project) return false;

    // Avoid exact duplicate descriptions from the same author
    const exists = this.projects.some(p => p.author === project.author && p.description === project.description);
    if (exists) return false;
    if (this.projects.some(p => p.id === project.id)) {
      project.id += '_' + Math.random().toString(36).substr(2, 5);
    }

    this.projects.unshift(project);
    this.saveProjects();
    this.render();

    if (typeof this.onProjectAdded === 'function') {
      this.onProjectAdded(project);
    }
    return true;
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
    this.projects = this.projects.filter(p => p.id !== projectId);
    this.saveProjects();
    this.render();
  }

  clearAll(skipConfirm = false) {
    if (this.projects.length === 0) return false;
    if (!skipConfirm && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`Delete all ${this.projects.length} captured projects? This cannot be undone.`)) return false;
    }
    this.projects = [];
    this.saveProjects();
    this.render();
    this.showToast('All projects cleared');
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
      const parsed = JSON.parse(storage.getItem(this.storageKey) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(p => p && typeof p === 'object' && p.id)
        .map(p => ({
          ...p,
          status: p.status === 'reviewed' ? 'reviewed' : 'new',
          tags: Array.isArray(p.tags) && p.tags.length ? p.tags : this.detectTags(p)
        }));
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
      const title = escText(p.title) || 'Untitled';
      const safeUrl = this.safeUrl(p.url);
      const head = safeUrl ? `[${title}](${safeUrl.replace(/\(/g, '%28').replace(/\)/g, '%29')})` : `**${title}**`;
      const desc = clean(String(p.description || '').split(p.url || '\u0000').join(' ')).replace(/[\s:,-]+$/, '');
      return `- ${head} by @${clean(p.author)}${desc ? `: ${desc}` : ''}`;
    }).join('\n');
  }

  async copyMarkdown() {
    const reviewed = this.projects.filter(p => p.status === 'reviewed');
    if (reviewed.length === 0) {
      this.showToast('No reviewed projects to copy yet', 'warn');
      return false;
    }
    const md = this.toMarkdown(reviewed);
    const ok = await this.copyToClipboard(md);
    this.showToast(
      ok ? `Copied ${reviewed.length} reviewed project${reviewed.length === 1 ? '' : 's'} as Markdown` : 'Could not access the clipboard',
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
    return this.projects.filter(p => {
      if (this.filterState !== 'all' && p.status !== this.filterState) return false;
      if (this.tagFilter && !(p.tags || []).includes(this.tagFilter)) return false;
      if (terms.length) {
        const haystack = cptNormalize([p.title, p.author, p.description, p.url, (p.tags || []).join(' ')].join(' '));
        return terms.every(t => haystack.includes(t));
      }
      return true;
    });
  }

  initUI() {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="cpt-container">
        <div class="cpt-header">
          <div class="cpt-header-top">
            <div class="cpt-title-wrap">
              <div class="cpt-icon">💡</div>
              <div>
                <h3 class="cpt-title">Live Project Tracker</h3>
                <p class="cpt-subtitle">AI-powered chat proposals for stream</p>
              </div>
            </div>
            <span class="cpt-badge-count" id="cpt-counter">0 Projects</span>
          </div>
          <div class="cpt-search-wrap">
            <span class="cpt-search-icon">🔍</span>
            <input type="search" class="cpt-search" id="cpt-search" placeholder="Search title, author, keywords..." autocomplete="off" aria-label="Search projects">
          </div>
          <div class="cpt-tag-filters" id="cpt-tag-filters" aria-label="Filter by tag"></div>
        </div>

        <div class="cpt-actions">
          <button class="cpt-btn cpt-btn-primary" data-action="export-json">📥 Export JSON</button>
          <button class="cpt-btn cpt-btn-primary" data-action="copy-md">📋 Copy Markdown</button>
          <div class="cpt-filter-group">
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="all">All</button>
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="new">New</button>
            <button class="cpt-btn cpt-filter-btn" data-action="filter" data-filter="reviewed">Reviewed</button>
          </div>
          <button class="cpt-btn cpt-btn-danger" data-action="clear-all" title="Delete all captured projects">🗑 Clear All</button>
        </div>

        <div class="cpt-list" id="cpt-list-items">
          <!-- Items will render here -->
        </div>
      </div>
    `;

    const searchEl = container.querySelector('#cpt-search');
    searchEl.addEventListener('input', e => this.setSearch(e.target.value));

    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn || !container.contains(btn)) return;
      const { action, id, filter, tag } = btn.dataset;
      switch (action) {
        case 'export-json': this.exportJSON(); break;
        case 'copy-md': this.copyMarkdown(); break;
        case 'clear-all': this.clearAll(); break;
        case 'filter': this.setFilter(filter); break;
        case 'tag': this.setTagFilter(tag); break;
        case 'toggle': this.toggleStatus(id); break;
        case 'delete': this.deleteProject(id); break;
      }
    });

    this.render();
  }

  renderTagFilters() {
    const el = document.getElementById('cpt-tag-filters');
    if (!el) return;
    const counts = {};
    this.projects.forEach(p => (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const tags = CPT_TAG_ORDER.filter(t => counts[t]).concat(Object.keys(counts).filter(t => !CPT_TAG_ORDER.includes(t)));
    if (this.tagFilter && !counts[this.tagFilter]) this.tagFilter = null;

    const chip = (tag, label, active) => `
      <button class="cpt-tag-chip cpt-tag-${this.escapeHtml(String(tag || 'all').toLowerCase())} ${active ? 'cpt-active' : ''}"
        data-action="tag" data-tag="${this.escapeHtml(tag)}" aria-pressed="${active}">${label}</button>`;
    el.innerHTML = chip('', 'All tags', !this.tagFilter) +
      tags.map(t => chip(t, `${this.escapeHtml(t)} <span class="cpt-chip-count">${counts[t]}</span>`, this.tagFilter === t)).join('');
  }

  render() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('cpt-list-items');
    const counterEl = document.getElementById('cpt-counter');
    if (!listEl) return;

    this.renderTagFilters();
    const filtered = this.getFilteredProjects();

    if (counterEl) {
      const total = this.projects.length;
      counterEl.textContent = filtered.length === total ? `${total} Projects` : `${filtered.length} / ${total} Projects`;
    }

    const container = document.getElementById(this.containerId);
    if (container) {
      container.querySelectorAll('.cpt-filter-btn').forEach(b => {
        b.classList.toggle('cpt-active', b.dataset.filter === this.filterState);
      });
    }

    if (filtered.length === 0) {
      listEl.innerHTML = this.projects.length === 0 ? `
        <div class="cpt-empty-state">
          <div class="cpt-empty-icon">💬</div>
          <p>Nessun progetto rilevato nella chat.</p>
          <small style="opacity: 0.7;">Scrivi in chat "!project [nome] - [descrizione]" oppure condividi un link GitHub!</small>
        </div>
      ` : `
        <div class="cpt-empty-state">
          <div class="cpt-empty-icon">🔎</div>
          <p>No projects match the current search or filters.</p>
        </div>
      `;
      return;
    }

    const esc = v => this.escapeHtml(v);
    listEl.innerHTML = filtered.map(p => {
      const url = this.safeUrl(p.url);
      return `
      <div class="cpt-card" data-id="${esc(p.id)}">
        <div class="cpt-card-header">
          <h4 class="cpt-card-title">
            <span>${esc(p.title)}</span>
          </h4>
          <span class="cpt-tag ${p.status === 'new' ? 'cpt-tag-new' : 'cpt-tag-reviewed'}">
            ${p.status === 'new' ? 'NEW' : 'REVIEWED'}
          </span>
        </div>
        <div class="cpt-card-tags">
          ${(p.tags || []).map(t => `<span class="cpt-mini-tag cpt-tag-${esc(t.toLowerCase())}">[${esc(t)}]</span>`).join('')}
        </div>
        <p class="cpt-card-desc">${esc(p.description)}</p>
        <div class="cpt-card-footer">
          <span class="cpt-card-author" style="color: ${this.safeColor(p.authorColor)}">@${esc(p.author)}</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="cpt-card-link">🔗 Link</a>` : ''}
            <button class="cpt-btn" style="padding: 2px 6px; font-size: 10px;" data-action="toggle" data-id="${esc(p.id)}">
              ${p.status === 'new' ? '✓ Mark Reviewed' : '↩ Mark New'}
            </button>
            <button class="cpt-btn" style="padding: 2px 6px; font-size: 10px; color: #ef4444;" data-action="delete" data-id="${esc(p.id)}" title="Delete">✕</button>
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
