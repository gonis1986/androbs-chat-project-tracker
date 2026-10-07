/**
 * chat_connectors.js - androbs multi-platform chat adapters & live connectors (Twitch, Kick, YouTube).
 *
 * Adapters turn raw platform payloads into the tracker's normalized message shape:
 *   { id, author, text, color, timestamp, platform }
 * Connectors open the live chat for a channel and push adapted messages to `onMessage`.
 */

const CPT_PLATFORMS = {
  twitch: { label: 'Twitch', color: '#9146ff' },
  kick: { label: 'Kick', color: '#53fc18' },
  youtube: { label: 'YouTube', color: '#ff0033' }
};

// Public Pusher app used by kick.com's web chat.
const CPT_KICK_PUSHER_URL = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';
const CPT_YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';

function cptRandomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function cptSafeJson(value) {
  if (typeof value !== 'string') return value && typeof value === 'object' ? value : null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return null;
  }
}

// ---------- Adapters ----------

const TwitchAdapter = {
  unescapeTag(value) {
    const map = { s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' };
    return String(value || '').replace(/\\(.)/g, (_, c) => (c in map ? map[c] : c));
  },

  /** Parses one IRC line (with IRCv3 tags). Returns a normalized message for PRIVMSG, otherwise null. */
  parseLine(line) {
    let rest = String(line || '').trim();
    if (!rest) return null;
    const tags = {};
    if (rest[0] === '@') {
      const space = rest.indexOf(' ');
      if (space < 0) return null;
      rest.slice(1, space).split(';').forEach(kv => {
        const eq = kv.indexOf('=');
        if (eq < 0) tags[kv] = '';
        else tags[kv.slice(0, eq)] = this.unescapeTag(kv.slice(eq + 1));
      });
      rest = rest.slice(space + 1);
    }
    const m = rest.match(/^:([^!\s]+)(?:!\S*)?\s+PRIVMSG\s+#(\S+)\s+:([\s\S]*)$/);
    if (!m) return null;
    let text = m[3];
    const action = text.match(/^\u0001ACTION ([\s\S]*)\u0001$/);
    if (action) text = action[1];
    return {
      id: tags.id ? `tw_${tags.id}` : cptRandomId('tw'),
      author: tags['display-name'] || m[1],
      text,
      color: tags.color || '',
      timestamp: Number(tags['tmi-sent-ts']) || Date.now(),
      platform: 'twitch',
      channel: m[2]
    };
  }
};

const KickAdapter = {
  /**
   * Accepts a raw Pusher frame (string or object) for `App\Events\ChatMessageEvent`,
   * or the inner chat message object itself. Returns null for non-chat frames.
   */
  parse(raw) {
    const frame = cptSafeJson(raw);
    if (!frame) return null;
    let data = frame;
    if (frame.event !== undefined) {
      if (!/ChatMessageEvent$/.test(frame.event)) return null;
      data = cptSafeJson(frame.data);
    }
    if (!data || typeof data.content !== 'string' || !data.sender) return null;
    if (data.type && data.type !== 'message' && data.type !== 'reply') return null;
    const text = data.content.replace(/\[emote:\d+:([^\]]*)\]/g, '$1').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const sender = data.sender;
    return {
      id: data.id ? `kick_${data.id}` : cptRandomId('kick'),
      author: sender.username || sender.slug || 'KickViewer',
      text,
      color: (sender.identity && sender.identity.color) || '',
      timestamp: Date.parse(data.created_at) || Date.now(),
      platform: 'kick'
    };
  }
};

const YouTubeAdapter = {
  /** Parses a YouTube Data API v3 `liveChatMessage` resource. */
  parse(item) {
    if (!item || !item.snippet) return null;
    const s = item.snippet;
    const text = s.displayMessage ||
      (s.textMessageDetails && s.textMessageDetails.messageText) ||
      (s.superChatDetails && s.superChatDetails.userComment) || '';
    if (!String(text).trim()) return null;
    const a = item.authorDetails || {};
    const color = a.isChatOwner ? '#facc15' : a.isChatModerator ? '#60a5fa' : a.isChatSponsor ? '#34d399' : '';
    return {
      id: item.id ? `yt_${item.id}` : cptRandomId('yt'),
      author: String(a.displayName || 'YouTubeViewer').replace(/^@/, ''),
      text: String(text).trim(),
      color,
      timestamp: Date.parse(s.publishedAt) || Date.now(),
      platform: 'youtube'
    };
  },

  /** Extracts the 11-char video id from a watch / youtu.be / live / shorts URL, or returns a bare id. */
  parseVideoId(input) {
    const value = String(input || '').trim();
    if (/^[\w-]{11}$/.test(value)) return value;
    const m = value.match(/(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
};

// ---------- Live connectors ----------

class BaseChatConnector {
  constructor({ onMessage, onStatus } = {}) {
    this.onMessage = onMessage || (() => {});
    this.onStatus = onStatus || (() => {});
    this.active = false;
  }

  status(state, text) {
    this.onStatus(state, text);
  }

  emit(msg) {
    if (msg && this.active) this.onMessage(msg);
  }

  disconnect() {
    this.active = false;
  }
}

class TwitchConnector extends BaseChatConnector {
  connect({ channel }) {
    const name = String(channel || '').trim().replace(/^#/, '').toLowerCase();
    if (!name) return this.status('error', 'Enter a Twitch channel name');
    this.disconnect();
    this.active = true;
    this.status('connecting', `Connecting to twitch.tv/${name}...`);

    const socket = this.socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
    socket.onopen = () => {
      socket.send('CAP REQ :twitch.tv/tags');
      socket.send('PASS SCHMOOPIIE');
      socket.send(`NICK justinfan${Math.floor(Math.random() * 80000) + 1000}`);
      socket.send(`JOIN #${name}`);
    };
    socket.onmessage = event => {
      String(event.data).split('\r\n').forEach(line => {
        if (line.startsWith('PING')) socket.send('PONG :tmi.twitch.tv');
        else if (/ JOIN #/.test(line) || / 366 /.test(line)) this.status('connected', `Connected to twitch.tv/${name}`);
        else this.emit(TwitchAdapter.parseLine(line));
      });
    };
    socket.onerror = () => this.status('error', `Error connecting to twitch.tv/${name}`);
    socket.onclose = () => { if (this.socket === socket && this.active) this.status('offline', 'Disconnected from Twitch'); };
  }

  disconnect() {
    super.disconnect();
    if (this.socket) {
      const s = this.socket;
      this.socket = null;
      s.close();
    }
  }
}

class KickConnector extends BaseChatConnector {
  /** `channel` is a Kick channel slug or a numeric chatroom id. */
  async connect({ channel }) {
    const value = String(channel || '').trim().replace(/^https?:\/\/(?:www\.)?kick\.com\//i, '').replace(/\/.*$/, '');
    if (!value) return this.status('error', 'Enter a Kick channel name or chatroom ID');
    this.disconnect();
    this.active = true;
    const session = this.session = {};

    let chatroomId = /^\d+$/.test(value) ? value : '';
    if (!chatroomId) {
      this.status('connecting', `Looking up kick.com/${value}...`);
      try {
        const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(value.toLowerCase())}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        chatroomId = data && data.chatroom && data.chatroom.id;
        if (!chatroomId) throw new Error('no chatroom');
      } catch (e) {
        if (this.session === session) {
          this.active = false;
          this.status('error', `Could not look up "${value}" (${e.message}). Kick may block browser lookups — enter the numeric chatroom ID instead.`);
        }
        return;
      }
    }
    if (this.session !== session) return;

    const label = /^\d+$/.test(value) ? `Kick chatroom ${chatroomId}` : `kick.com/${value}`;
    this.status('connecting', `Connecting to ${label}...`);
    const socket = this.socket = new WebSocket(CPT_KICK_PUSHER_URL);
    socket.onmessage = event => {
      const frame = cptSafeJson(event.data);
      if (!frame) return;
      if (frame.event === 'pusher:connection_established') {
        socket.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: `chatrooms.${chatroomId}.v2` } }));
      } else if (frame.event === 'pusher_internal:subscription_succeeded') {
        this.status('connected', `Connected to ${label}`);
      } else if (frame.event === 'pusher:ping') {
        socket.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
      } else if (frame.event === 'pusher:error') {
        this.status('error', `Kick error: ${(cptSafeJson(frame.data) || {}).message || 'unknown'}`);
      } else {
        this.emit(KickAdapter.parse(frame));
      }
    };
    socket.onerror = () => this.status('error', `Error connecting to ${label}`);
    socket.onclose = () => { if (this.socket === socket && this.active) this.status('offline', 'Disconnected from Kick'); };
  }

  disconnect() {
    super.disconnect();
    this.session = null;
    if (this.socket) {
      const s = this.socket;
      this.socket = null;
      s.close();
    }
  }
}

class YouTubeConnector extends BaseChatConnector {
  /** Polls liveChatMessages.list with a YouTube Data API v3 key. */
  async connect({ video, apiKey }) {
    const videoId = YouTubeAdapter.parseVideoId(video);
    const key = String(apiKey || '').trim();
    if (!videoId) return this.status('error', 'Enter a YouTube live video URL or ID');
    if (!key) return this.status('error', 'A YouTube Data API v3 key is required');
    this.disconnect();
    this.active = true;
    const session = this.session = {};
    this.status('connecting', `Finding live chat for video ${videoId}...`);

    try {
      const info = await this.api(`videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}`, key);
      const details = info.items && info.items[0] && info.items[0].liveStreamingDetails;
      const liveChatId = details && details.activeLiveChatId;
      if (!liveChatId) throw new Error('this video has no active live chat');
      if (this.session !== session) return;
      this.status('connected', `Connected to YouTube live chat (${videoId})`);
      this.poll(session, liveChatId, key, null, true);
    } catch (e) {
      if (this.session === session) {
        this.active = false;
        this.status('error', `YouTube: ${e.message}`);
      }
    }
  }

  async api(path, key) {
    const res = await fetch(`${CPT_YOUTUBE_API}/${path}&key=${encodeURIComponent(key)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
    return json;
  }

  async poll(session, liveChatId, key, pageToken, skipBacklog) {
    if (this.session !== session) return;
    try {
      const json = await this.api(
        `liveChat/messages?part=snippet,authorDetails&maxResults=200&liveChatId=${encodeURIComponent(liveChatId)}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''), key);
      if (this.session !== session) return;
      // Like the Twitch/Kick connectors, only react to messages sent after connecting.
      if (!skipBacklog) (json.items || []).forEach(item => this.emit(YouTubeAdapter.parse(item)));
      const wait = Math.max(Number(json.pollingIntervalMillis) || 5000, 2000);
      this.timer = setTimeout(() => this.poll(session, liveChatId, key, json.nextPageToken, false), wait);
    } catch (e) {
      if (this.session === session) {
        this.active = false;
        this.status('error', `YouTube: ${e.message}`);
      }
    }
  }

  disconnect() {
    super.disconnect();
    this.session = null;
    clearTimeout(this.timer);
  }
}

function createChatConnector(platform, handlers) {
  switch (platform) {
    case 'kick': return new KickConnector(handlers);
    case 'youtube': return new YouTubeConnector(handlers);
    default: return new TwitchConnector(handlers);
  }
}

const CPT_CONNECTOR_EXPORTS = {
  CPT_PLATFORMS, TwitchAdapter, KickAdapter, YouTubeAdapter,
  TwitchConnector, KickConnector, YouTubeConnector, createChatConnector
};
if (typeof window !== 'undefined') Object.assign(window, CPT_CONNECTOR_EXPORTS);
if (typeof module !== 'undefined' && module.exports) module.exports = CPT_CONNECTOR_EXPORTS;
