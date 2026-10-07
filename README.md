# 💡 AndrOBS - Live Chat Project Tracker & AI Extractor

> A high-performance, real-time widget for streamers and tech community builders.
> Automatically listens to live stream chat (Twitch, YouTube, Kick), identifies project proposals and tech ideas, and renders an interactive on-screen list.

---

## 🚀 Features

- **Multi-Platform Live Chat**: Connect Twitch (IRC WebSocket), Kick (public Pusher chat socket — channel name or numeric chatroom ID) or YouTube (Data API v3 polling — needs a live video URL/ID and an API key) from the tabbed connection panel. Each platform has a parsing adapter (`TwitchAdapter`, `KickAdapter`, `YouTubeAdapter`) that normalizes raw payloads.
- **📺 Show on Stream**: Every card has a button that slides in a glassmorphism lower-third overlay (title, author, description, clickable link, live vote count) for 8 seconds, then fades out. Use `index.html` as an OBS Browser Source to put it on stream (`overlayDuration` option changes the duration).
- **🗳️ Community Upvotes**: Each project gets a short number (`#1`, `#2`, ...). Viewers vote with `!vote 1` / `!upvote 1` (also `!voto`, `!vota`), or `+1` for the project currently on stream (or the newest one). One vote per viewer per project; cards show `▲ count` and the header toggles **Newest** / **Most Upvoted** sorting.
- **Multilingual Project Detection**: Recognizes project proposals in Spanish, English, Italian, and Portuguese.
- **Smart Extraction**: Extracts Author, Project Title, Description, and URLs (GitHub, Vercel, personal sites).
- **Interactive Review UI**: Mark as Reviewed, Delete, Filter (All / New / Reviewed), Export to JSON.
- **Persistent List**: Captured projects are saved in `localStorage` and survive page refreshes (🗑 Clear All asks for confirmation).
- **Search & Tag Filter**: Search by title, author or keywords; projects are auto-tagged (`[GitHub]`, `[GitLab]`, `[Vercel]`, `[Netlify]`, `[Web]`, `[App]`, `[Idea]`, `[Project]`) and can be filtered by tag.
- **📋 Copy Markdown**: Copies all *reviewed* projects as a GitHub/Notion-ready list: `- [Title](url) by @author: description`.
- **Glassmorphism Dark UI**: Designed for streaming overlays and live control rooms.

---

## 📂 File Structure

```text
├── index.html                  # Interactive test sandbox with simulators & Twitch / Kick / YouTube connectors
├── chat_connectors.js          # Platform adapters + live chat connectors
├── chat_project_tracker.js     # Core engine and extraction logic (ChatProjectTracker class)
├── chat_project_tracker.css    # Modern glassmorphism UI styles
├── tests/analyze_message.html  # Browser test page for analyzeMessage() / Markdown export
├── tests/connectors_and_votes.html # Browser tests for adapters, upvotes, sorting and the overlay
└── README.md                   # Documentation & Devin specs
```

---

## 🛠️ How to Test Locally

1. Open `index.html` in any browser.
2. Click the test buttons on the left to simulate incoming messages.
3. See projects immediately populate the Live Project Tracker widget on the right.
4. Use the Kick / YouTube / Twitch payload buttons and the `!vote` / `+1` buttons to test the adapters and upvotes, and click **📺 Show on Stream** on a card.
5. Or pick a platform tab and connect to a real live chat (Twitch channel, Kick channel/chatroom ID, or YouTube live video + API key).
6. Open `tests/analyze_message.html` and `tests/connectors_and_votes.html` to run the browser test suites.
