# 🏎️💨 TYPE//GHOST — Overall Implementation Plan

## 💡 What Is It?

A real-time competitive typing battle engine in the browser. Two players race head-to-head typing the same paragraph — watching each other's progress bars glide across the screen in real time. Fastest typist with the best accuracy wins.

**The name:** TYPE//GHOST — because in Round 1, you race against a recorded "ghost" of the previous player's run (like ghost laps in racing games).

---

## 🧩 The Two Rounds

### 🎨 Round 1 — Pure Frontend (UI/UX Judging)

**Constraint:** No backend, no server, no database. Everything runs client-side.

**Mode:** Ghost Shadow Duel
- Player 1 types a paragraph → their keystrokes and timing are recorded locally
- Player 2 hits "Race the Ghost" → they type the same paragraph while Player 1's ghost cursor replays at the exact original speed
- Post-race telemetry compares both runs side-by-side

**What judges see:** Premium dark-neon UI, buttery smooth animations, mechanical keyboard audio feedback, and a polished post-race stats breakdown. Zero AI slop.

**Tech:** 3 files — `index.html`, `style.css`, `app.js` + a `quotes.json` data file. No dependencies. No build step. Double-click to run.

> 📄 *Detailed build spec is in the [Round 1 Plan](file:///C:/Users/faheem/.gemini/antigravity-ide/brain/46b772c7-43c1-4f54-84f4-dec1109a3900/round1_plan.md).*

---

### 🌐 Round 2 — Full Stack (Live Multiplayer)

**Unlocked:** A tiny Node.js relay server (~70 lines) enables real-time online matchmaking.

**Mode:** Random Online Matchmaking
- Player clicks "Find Match" → enters a waiting queue
- Second player clicks "Find Match" → server pairs them instantly
- Both get the same paragraph, countdown starts, live race begins
- Progress syncs over WebSockets with ~30-80ms latency

**Added files:** `server.js` (~70 lines), `package.json` (2 dependencies: `express` + `ws`)

**What changes from Round 1:** The Ghost replay engine is swapped for a live WebSocket opponent. All the UI/UX, animations, and audio from Round 1 carry forward untouched.

---

## 🛠️ Tech Stack (Full Project)

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| Structure | HTML5 | Page layout, 4 screens |
| Styling | CSS3 | Dark theme, animations, progress bars |
| Logic | Vanilla JavaScript | Keystroke engine, ghost replay, WPM math |
| Audio | Web Audio API (native) | Synthesized mechanical key sounds, no audio files |
| Data | JSON file | 50 curated paragraphs |
| Server (Round 2 only) | Node.js + Express + ws | Static file serving + WebSocket matchmaking relay |

**Total codebase:** ~500–600 lines across 4–6 files. No frameworks. No React. No database.

---

## 🎤 The Judge Pitch (60 Seconds)

> **Hook (10s):**
> *"Typing tests are boring and lonely. We turned typing into a competitive sport — a real-time ghost racing arena in the browser."*
>
> **Demo (20s):**
> *(Type a paragraph, show the ghost cursor replaying, show the split-screen telemetry comparison)*
>
> **Tech Flex (20s):**
> *"Zero frameworks, zero dependencies, zero backend. Pure vanilla JavaScript with hardware-accelerated CSS animations running at a locked 60 FPS. Synthesized mechanical keyboard audio via the native Web Audio API — no downloaded sound files."*
>
> **Closer (10s):**
> *"The entire application is under 600 lines of code. Clean architecture beats over-engineering every time."*

---

## 🗺️ What We Know About Our Constraints

- ❌ No mobile apps (banned by hackathon rules)
- ❌ No database, no user accounts, no ratings
- ❌ No bots or AI opponents (by choice — ghost duel is cleaner)
- ❌ No React/Vue/Angular framework bloat
- ✅ Round 1 = pure frontend, UI/UX judged
- ✅ Round 2 = can add a minimal server for live multiplayer
- ✅ Must look handcrafted, not AI-generated template slop
