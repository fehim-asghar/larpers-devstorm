# ⚡ SYNTAX//RUSH — Real-Time Competitive Browser Typing Battle Arena

> **Race against your ghost. Duel rivals online in sub-30ms real-time battles. Powered by pure Vanilla JS, Web Audio API, and WebSockets.**

---

## 🎮 Features

* **🏎️ Real-Time 1v1 WebSocket Duels:** Instant matchmaking & sub-30ms keystroke progress synchronization over WebSockets.
* **👻 Local Ghost Racing (Round 1 Engine):** Record your best typing run and race against your past shadow with variable speed delta tracking.
* **🔊 Universal Hardware-Tuned Thock SFX:** Real-time synthesized mechanical switch audio with upper-mid acoustic resonance tuned for all laptop speakers.
* **🎀 Hatsune Miku Cyberpunk Aesthetic:** Luminous Miku Cyan (`#00F2FE`) & Sakura Hot Pink (`#FF007F`) dual-track lasers, live animated wallpaper, and pixel-art carets.
* **💣 Minesweeper Chain-Reaction Finish:** Staggered letter detonation sequence with ascending pitch pops upon race completion.
* **📊 Post-Match Velocity Curves:** Real-time Canvas telemetry plotting acceleration and consistency against your rival.

---

## 🚀 Quick Start (Local Setup)

```bash
# 1. Clone the repository
git clone https://github.com/fehim-asghar/larpers-devstorm.git

# 2. Enter the game directory
cd larpers-devstorm/typing-battle

# 3. Install dependencies
npm install

# 4. Start the live multiplayer server
npm start
```

Open **`http://localhost:3000`** in your browser and start typing!

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), CSS3 (Hardware-accelerated transforms & filters), HTML5 Video
* **Audio Engine:** Web Audio API (Multi-oscillator transient synthesis)
* **Backend Relay:** Node.js, Express, `ws` (WebSocket Server)
* **Storage:** In-memory queue & local storage for ghosts
