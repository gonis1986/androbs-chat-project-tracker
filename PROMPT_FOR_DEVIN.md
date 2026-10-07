# 🤖 Instructions for Devin AI

Hey Devin! This repository contains `AndrOBS - Live Chat Project Tracker`, a lightweight widget used by live streamers to detect, extract, and list projects & ideas proposed by viewers in live chat (Twitch, Kick, YouTube).

Please open and inspect:
- `index.html` (the test sandbox)
- `chat_project_tracker.js` (the core extractor and UI rendering logic)
- `chat_project_tracker.css` (the styles)

### 🎯 Your Goal:
Enhance `chat_project_tracker.js` and `chat_project_tracker.css` with the following 4 features:

1. **Local Persistence (`localStorage`)**:
   - Save captured projects in `localStorage` so refreshing the browser preserves the list.
   - Add a "Clear All" button with a confirmation prompt.

2. **Search Bar & Quick Tag Filter**:
   - Add a search input in the widget header to filter projects by title, author name, or keywords.
   - Auto-tag projects based on links (e.g. `[GitHub]`, `[Vercel]`, `[App]`, `[Idea]`).

3. **Export to Markdown**:
   - Next to "Export JSON", add a button "📋 Copy Markdown" that formats the reviewed projects into a clean GitHub/Notion markdown list (e.g. `- [Title](url) by @author: description`) and copies it to the clipboard with a visual toast notification.

4. **Expanded Multilingual NLP Heuristics**:
   - Improve `analyzeMessage(msg)` to catch even more conversational project introductions in English, Spanish (e.g., "mira este proyecto", "hice una herramienta", "les comparto mi repo"), and Italian.

### 🧪 Verification:
- Run `index.html` in your browser.
- Use the simulator buttons and verify that the search bar, localStorage persistence, and Markdown copy button work flawlessly.
