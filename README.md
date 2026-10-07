# ✨ AndrOBS Universal Live Showcase & Community Queue

> A real-time widget for **every** kind of streamer: gaming, coding, web design, art & crafts, or just chatting.
> It listens to live chat (Twitch, YouTube, Kick), picks out what viewers want to show or suggest, sorts it into categories, lets chat vote on it, and puts it on stream.

---

## 🚀 Features

- **5 Universal Categories**: every captured item gets one category:

  | Category | Detected from | Commands |
  |---|---|---|
  | 🎮 Games | Steam / itch.io / Epic / GOG / Roblox links, "you should play X", "deberías jugar X", "dovresti giocare a X" | `!game`, `!play` |
  | 💻 Tech & Code | GitHub / GitLab / npm / store links, apps, bots, repos, tools | `!project`, `!repo`, `!app` |
  | 🌐 Websites & Portals | Any other website link shared with an intro ("review my site", "check this out"), portfolios, blogs | `!site`, `!web` |
  | 🎨 Handmade & Art | Etsy / Instagram / ArtStation / DeviantArt / Behance links, paintings, crochet, DIY ("I painted…", "hice un cuadro", "ho dipinto…") | `!art`, `!craft`, `!handmade` |
  | 💡 Ideas & Topics | "topic:", "let's talk about…", challenges, Q&A ("pregunta para el stream", "parliamo di…"), project ideas | `!idea`, `!topic` |

  Precedence: command → link → idea/topic phrasing → keywords → any website link.
- **Category Filter Bar**: `[All] [🎮 Games] [💻 Tech] [🌐 Websites] [🎨 Handmade & Art] [💡 Ideas]` chips with counts. Link tags on each card (`[Steam]`, `[Etsy]`, `[GitHub]`…) are clickable tag filters.
- **🎯 Stream Mode**: restrict what gets captured to today's theme (e.g. *Only 🎮 Games today*). Off-theme chat items are skipped and counted; votes always work. The mode is saved across refreshes.
- **Multi-Platform Live Chat**: Connect Twitch (IRC WebSocket), Kick (public Pusher chat socket — channel name or numeric chatroom ID) or YouTube (Data API v3 polling — needs a live video URL/ID and an API key) from the tabbed connection panel. Each platform has a parsing adapter (`TwitchAdapter`, `KickAdapter`, `YouTubeAdapter`) that normalizes raw payloads.
- **📺 Show on Stream**: Every card has a button that slides in a glassmorphism lower-third overlay (title, author, description, clickable link, live vote count) for 8 seconds, then fades out. Accent colors, icon and badge follow the item's category (neon/scanlines for games, grid + monospace for tech, warm stitched frame for handmade & art, …). Use `index.html` as an OBS Browser Source to put it on stream (`overlayDuration` option changes the duration).
- **🗳️ Community Upvotes**: Each project gets a short number (`#1`, `#2`, ...). Viewers vote with `!vote 1` / `!upvote 1` (also `!voto`, `!vota`), or `+1` for the project currently on stream (or the newest one). One vote per viewer per project; cards show `▲ count` and the header toggles **Newest** / **Most Upvoted** sorting.
- **Multilingual Detection**: Recognizes games, projects, websites, artwork and topics in Spanish, English and Italian.
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
├── tests/analyze_message.html  # Browser test page for detection, categories and Markdown export
├── tests/connectors_and_votes.html # Browser tests for adapters, upvotes, sorting and the overlay
└── README.md                   # Documentation & Devin specs
```

---

## 🛠️ How to Test Locally

1. Open `index.html` in any browser.
2. Click the test buttons on the left to simulate incoming messages.
3. See items immediately populate the Live Showcase widget on the right, grouped by category.
4. Use the category buttons (Steam game, Etsy craft, Instagram art, website review, stream topic, `!game`, `!art`) and pick a **🎯 Stream Mode** to see off-theme items skipped.
5. Use the Kick / YouTube / Twitch payload buttons and the `!vote` / `+1` buttons to test the adapters and upvotes, and click **📺 Show on Stream** on a card.
6. Or pick a platform tab and connect to a real live chat (Twitch channel, Kick channel/chatroom ID, or YouTube live video + API key).
7. Open `tests/analyze_message.html` and `tests/connectors_and_votes.html` to run the browser test suites.
