# 💡 AndrOBS - Live Chat Project Tracker & AI Extractor

> A high-performance, real-time widget for streamers and tech community builders.
> Automatically listens to live stream chat (Twitch, YouTube, Kick), identifies project proposals and tech ideas, and renders an interactive on-screen list.

---

## 🚀 Features

- **Real-Time Stream Chat Ingestion**: Works with Twitch IRC WebSockets out of the box.
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
├── index.html                  # Interactive test sandbox with simulator & live Twitch connector
├── chat_project_tracker.js     # Core engine and extraction logic (ChatProjectTracker class)
├── chat_project_tracker.css    # Modern glassmorphism UI styles
├── tests/analyze_message.html  # Browser test page for analyzeMessage() / Markdown export
└── README.md                   # Documentation & Devin specs
```

---

## 🛠️ How to Test Locally

1. Open `index.html` in any browser.
2. Click the test buttons on the left to simulate incoming messages.
3. See projects immediately populate the Live Project Tracker widget on the right.
4. Or type a live Twitch channel (e.g. `erasmoh`, `ibai`) to connect to actual live chat!
5. Open `tests/analyze_message.html` to run the detection test cases (EN / ES / IT, positives and chit-chat negatives).
