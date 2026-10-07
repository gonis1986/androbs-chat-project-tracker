/**
 * chat_project_tracker.js - AndrOBS Live Chat Project Tracker
 * Automatically detects, extracts, and organizes projects & ideas shared in live stream chat.
 */

class ChatProjectTracker {
  constructor(options = {}) {
    this.containerId = options.containerId || 'chat-project-tracker-root';
    this.projects = [];
    this.onProjectAdded = options.onProjectAdded || null;
    this.filterState = 'all'; // 'all', 'new', 'reviewed'
    
    this.initUI();
  }

  /**
   * Evaluates if a chat message contains a project proposal, idea, or repo link.
   * @param {Object} msg - { id, author, text, color, timestamp }
   * @returns {Object|null} Extracted project data or null if not a project
   */
  analyzeMessage(msg) {
    if (!msg || !msg.text) return null;
    const text = msg.text.trim();
    const lower = text.toLowerCase();

    // 1. Explicit triggers: !project, !idea, !proyecto, !app
    const commandMatch = text.match(/^!(project|proyecto|idea|app|progetto)\s+(.+)/i);
    let isProject = false;
    let title = "";
    let description = text;
    let url = "";

    // Extract any URL
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      url = urlMatch[1];
    }

    if (commandMatch) {
      isProject = true;
      const content = commandMatch[2].trim();
      title = content.split(' - ')[0] || content.slice(0, 35);
      description = content;
    } else {
      // 2. Natural language detection keywords (English, Spanish, Italian)
      const projectPatterns = [
        /(?:check out|look at|miren|guarda|mira|built|creé|creado|hice|ho creato|ho sviluppato)\s+(?:my|this|mi|este|il mio|un)?\s*(?:project|app|tool|repo|website|bot|proyecto|progetto|herramienta)/i,
        /(?:github\.com|gitlab\.com|vercel\.app|netlify\.app)\/([^\s]+)/i,
        /(?:idea for you|idea para ti|un'idea per te|proposta):?\s*(.+)/i
      ];

      for (const pattern of projectPatterns) {
        if (pattern.test(text)) {
          isProject = true;
          break;
        }
      }

      if (isProject) {
        // Simple heuristic for title extraction
        const words = text.split(' ');
        title = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
      }
    }

    if (!isProject) return null;

    return {
      id: msg.id || 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      author: msg.author || 'Viewer',
      authorColor: msg.color || '#60a5fa',
      title: title || 'Nuovo Progetto',
      description: description,
      url: url,
      status: 'new', // 'new' | 'reviewed'
      timestamp: msg.timestamp || Date.now()
    };
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

    this.projects.unshift(project);
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
      this.render();
    }
  }

  deleteProject(projectId) {
    this.projects = this.projects.filter(p => p.id !== projectId);
    this.render();
  }

  setFilter(filter) {
    this.filterState = filter;
    this.render();
  }

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.projects, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `androbs_projects_${Date.now()}.json`);
    dlAnchor.click();
  }

  initUI() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="cpt-container">
        <div class="cpt-header">
          <div class="cpt-title-wrap">
            <div class="cpt-icon">💡</div>
            <div>
              <h3 class="cpt-title">Live Project Tracker</h3>
              <p class="cpt-subtitle">AI-powered chat proposals for stream</p>
            </div>
          </div>
          <span class="cpt-badge-count" id="cpt-counter">0 Projects</span>
        </div>

        <div class="cpt-actions">
          <button class="cpt-btn cpt-btn-primary" onclick="window.chatTracker.exportJSON()">📥 Export JSON</button>
          <button class="cpt-btn" onclick="window.chatTracker.setFilter('all')">All</button>
          <button class="cpt-btn" onclick="window.chatTracker.setFilter('new')">New</button>
          <button class="cpt-btn" onclick="window.chatTracker.setFilter('reviewed')">Reviewed</button>
        </div>

        <div class="cpt-list" id="cpt-list-items">
          <!-- Items will render here -->
        </div>
      </div>
    `;

    this.render();
  }

  render() {
    const listEl = document.getElementById('cpt-list-items');
    const counterEl = document.getElementById('cpt-counter');
    if (!listEl) return;

    const filtered = this.projects.filter(p => {
      if (this.filterState === 'all') return true;
      return p.status === this.filterState;
    });

    if (counterEl) {
      counterEl.textContent = `${this.projects.length} Projects`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="cpt-empty-state">
          <div class="cpt-empty-icon">💬</div>
          <p>Nessun progetto rilevato nella chat.</p>
          <small style="opacity: 0.7;">Scrivi in chat "!project [nome] - [descrizione]" oppure condividi un link GitHub!</small>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(p => `
      <div class="cpt-card" data-id="${p.id}">
        <div class="cpt-card-header">
          <h4 class="cpt-card-title">
            <span>${p.title}</span>
          </h4>
          <span class="cpt-tag ${p.status === 'new' ? 'cpt-tag-new' : 'cpt-tag-reviewed'}">
            ${p.status === 'new' ? 'NEW' : 'REVIEWED'}
          </span>
        </div>
        <p class="cpt-card-desc">${p.description}</p>
        <div class="cpt-card-footer">
          <span class="cpt-card-author" style="color: ${p.authorColor}">@${p.author}</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            ${p.url ? `<a href="${p.url}" target="_blank" rel="noopener" class="cpt-card-link">🔗 Link</a>` : ''}
            <button class="cpt-btn" style="padding: 2px 6px; font-size: 10px;" onclick="window.chatTracker.toggleStatus('${p.id}')">
              ${p.status === 'new' ? '✓ Mark Reviewed' : '↩ Mark New'}
            </button>
            <button class="cpt-btn" style="padding: 2px 6px; font-size: 10px; color: #ef4444;" onclick="window.chatTracker.deleteProject('${p.id}')">✕</button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// Global exposure
if (typeof window !== 'undefined') {
  window.ChatProjectTracker = ChatProjectTracker;
}
