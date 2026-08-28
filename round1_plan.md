# 🎨 TYPE//GHOST — Round 1 Detailed Plan (UI/UX Build Spec)

**Scope:** Pure frontend. No server. No dependencies. No build tools.
**Judging Criteria:** UI/UX quality, visual polish, interaction design.
**Deliverable:** 4 files that run by double-clicking `index.html`.

---

## 📺 User Workflow (Screen by Screen)

### Screen 1 — 🏠 Lobby

**What the user sees:**
- Large display title: `TYPE//GHOST`
- Tagline: *"Race the ghost. Beat the record."*
- Two buttons:
  - `[Set a Ghost Run]` → starts Player 1 recording mode
  - `[Race the Ghost]` → starts Player 2 duel mode (greyed out until a ghost exists)
- Keyboard shortcut hint at the bottom: `Press [Space] to start`

**What happens under the hood:**
- Check browser `localStorage`: does a ghost recording exist?
  - Yes → enable "Race the Ghost" button, show ghost stats preview (P1's WPM & time)
  - No → only "Set a Ghost Run" is active

---

### Screen 2 — ⌨️ Typing Arena (Shared by both P1 and P2)

**What the user sees:**
- The paragraph text displayed character-by-character in a clean monospace block
- A smooth gliding caret (blinking cursor) on the current character
- Character coloring:
  - ⚪ **Untyped:** Dimmed zinc gray (`#71717A`)
  - 📍 **Current:** Bright white with a subtle pulsing underline
  - 🟢 **Correct:** Lit up in Electric Cyan (`#00F2FE`) with a faint glow
  - 🔴 **Wrong:** Lit up in soft red (`#FF4757`) with a 50ms horizontal shake
- **Top HUD bar:**
  - Left: Live WPM counter (updates every keystroke)
  - Center: Elapsed timer (`00:00.0`)
  - Right: Accuracy percentage
- **Bottom progress section:**
  - Your progress bar (cyan, smooth gradient fill)
  - Ghost's progress bar (amber `#FFB300`, only visible in P2 mode)
- 3-2-1 countdown overlay before typing begins (scale-in animation with beep sounds)

**P1 Mode (Recording):**
- Every keystroke is captured as: `{ char, timestamp, correct }`
- Ghost progress bar is hidden (only your bar shows)
- When finished → save the full keystroke timeline + paragraph to `localStorage`

**P2 Mode (Ghost Duel):**
- Ghost's keystroke timeline is loaded from `localStorage`
- A `requestAnimationFrame` loop ticks through the ghost timeline in real time
- Ghost's caret and progress bar move at the exact speed P1 originally typed
- Ghost caret rendered as a semi-transparent amber shadow trailing/leading your cursor
- Both progress bars race simultaneously

---

### Screen 3 — 🏆 Results / Telemetry

**What the user sees:**
- Winner/Loser banner:
  - Won: `YOU BEAT THE GHOST` with a cyan glow burst
  - Lost: `THE GHOST GOT YOU` with an amber pulse
  - (P1 solo run: `GHOST RECORDED` with a save confirmation)
- Side-by-side stat cards:

  | Stat | You | Ghost |
  | :--- | :--- | :--- |
  | WPM | 74 | 68 |
  | Accuracy | 96.2% | 93.8% |
  | Time | 38.4s | 41.1s |
  | Delta | — | +2.7s slower |

- **Velocity Graph:** A small line chart (drawn on `<canvas>`) showing WPM over time for both players overlaid — so you can see where you surged ahead or fell behind
- **Action Buttons:**
  - `[Set New Ghost]` → record a fresh run
  - `[Race Again]` → rematch against the same ghost
  - `[Back to Lobby]`
- Keyboard hints: `[Space] Race Again` / `[Tab] New Ghost` / `[Esc] Lobby`

---

## 📁 File-by-File Code Breakdown

### 📄 `index.html` (~80–100 lines)

Semantic HTML structure for all 3 screens:
- `<section id="lobby">` — title, buttons, ghost preview
- `<section id="arena">` — paragraph display, HUD, progress bars, countdown overlay
- `<section id="results">` — stats cards, velocity graph canvas, action buttons
- Google Fonts link for `JetBrains Mono` + `Outfit`
- `<script>` and `<link>` tags for `app.js` and `style.css`

No divitis. No wrapper soup. Clean landmark elements.

---

### 🎨 `style.css` (~200–250 lines)

**Design Tokens (CSS Custom Properties):**
```
--bg-deep:        #08090C
--bg-surface:     #161922
--bg-card:        #1E2130
--text-primary:   #F0F0F5
--text-muted:     #71717A
--accent-player:  #00F2FE   (Electric Cyan)
--accent-ghost:   #FFB300   (Phosphor Amber)
--accent-error:   #FF4757
--font-mono:      'JetBrains Mono', monospace
--font-display:   'Outfit', sans-serif
--radius:         12px
```

**Key Sections:**
- **Screen toggling:** `.screen { display: none }` / `.screen.active { display: flex }`
- **Paragraph text:** Monospace grid, `letter-spacing` tuned so every character occupies the same width (critical for caret alignment)
- **Caret animation:** `@keyframes blink` with smooth opacity transitions
- **Progress bars:** `transition: width 80ms ease-out` for buttery interpolation
- **Countdown overlay:** `@keyframes scaleIn` — numbers scale from 200% to 100% with fade
- **Error shake:** `@keyframes shake` — 50ms horizontal jitter on wrong keypress
- **Streak glow:** When combo class is active, `text-shadow` intensifies on correctly typed characters
- **Results cards:** Frosted glass cards with `backdrop-filter: blur(12px)` and subtle border glow

---

### 🧠 `app.js` (~250–300 lines)

**Module 1 — `StateManager` (~30 lines)**
- Tracks current screen, current mode (P1 recording / P2 racing), paragraph index
- `switchScreen(screenId)` toggles visibility
- Reads/writes ghost data to `localStorage`

**Module 2 — `RaceEngine` (~80 lines)**
- `startRace(paragraph, mode)` → resets state, starts countdown, begins timer
- `handleKeystroke(event)` → compares `event.key` against `paragraph[index]`
  - Correct: advance index, apply green class, trigger click sound
  - Wrong: apply red class + shake animation, increment errors, trigger error sound, still advance
- `calcWPM()` → `Math.round((correctChars / 5) / (elapsedMs / 60000))`
- `calcAccuracy()` → `Math.round((1 - errors / totalChars) * 100)`
- Updates HUD elements and progress bar width every keystroke
- Emits `onProgress(index, wpm)` and `onFinish(stats)` callbacks

**Module 3 — `GhostRecorder` (~30 lines)**
- On each keystroke from RaceEngine, pushes `{ charIndex, timestampMs, correct }` to an array
- `save()` → serializes the timeline + paragraph + final stats to `localStorage`

**Module 4 — `GhostReplayer` (~50 lines)**
- `load()` → reads the saved timeline from `localStorage`
- `start()` → begins a `requestAnimationFrame` loop
  - On each frame, checks: has elapsed time passed the next ghost keystroke's timestamp?
  - If yes → advance ghost caret position, update ghost progress bar
- Ghost caret rendered as a separate DOM element with amber glow styling
- `onGhostFinish()` callback when ghost completes

**Module 5 — `AudioEngine` (~40 lines)**
- Creates an `AudioContext` on first user interaction
- `playClick()` → generates a short noise burst (5ms white noise filtered through a bandpass) to simulate a mechanical keyswitch click
- `playError()` → lower-pitched thud variant
- `playBeep()` → sine wave oscillator at 880Hz for countdown ticks
- `playGo()` → higher pitch burst for the "GO!" moment
- All sounds are synthesized — zero audio files downloaded

**Module 6 — `TelemetryView` (~30 lines)**
- Takes both player's keystroke timelines
- Draws a simple line chart on a `<canvas>`:
  - X-axis: time elapsed
  - Y-axis: WPM at that moment
  - Two lines: cyan (you) vs amber (ghost)
- Populates the stat comparison cards

---

### 📚 `quotes.json` (~50–60 lines)

50 curated paragraphs. **No generic lorem ipsum.** Categories:
- 🖥️ **Tech/Dev quotes:** *"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."*
- 🎬 **Sci-fi/Movie quotes:** *"The only way to do great work is to love what you do."*
- 📖 **Literature excerpts:** Short passages from public domain books
- 🧠 **Challenging tongue-twisters:** For Hard mode variety

Each entry: `{ "text": "...", "source": "..." }`

---

## 📏 Total Code Size Summary

| File | Lines | Bytes (approx) |
| :--- | :--- | :--- |
| `index.html` | ~90 | ~3 KB |
| `style.css` | ~230 | ~6 KB |
| `app.js` | ~280 | ~9 KB |
| `quotes.json` | ~55 | ~4 KB |
| **Total** | **~655 lines** | **~22 KB** |

**For perspective:** A single React boilerplate `node_modules` folder is 200+ MB. Our entire app is 22 KB. That's ~10,000x smaller.

---

## ⏱️ Build Timeline

| Phase | What | Est. Time |
| :--- | :--- | :--- |
| 1 | HTML structure (all 3 screens, semantic markup) | 15 min |
| 2 | CSS design system (tokens, dark theme, typography, layout) | 30 min |
| 3 | CSS animations (caret, progress bars, countdown, shake, glow) | 20 min |
| 4 | RaceEngine (keystroke validation, WPM, accuracy, HUD updates) | 30 min |
| 5 | GhostRecorder + GhostReplayer (record, save, replay loop) | 25 min |
| 6 | AudioEngine (Web Audio synthesis for clicks, beeps) | 15 min |
| 7 | TelemetryView (canvas velocity chart, stat cards) | 20 min |
| 8 | Integration, transitions, quotes data, polish | 15 min |
| **Total** | | **~2.5–3 hours** |

---

## 🛡️ Edge Cases

| Scenario | Handling |
| :--- | :--- |
| No ghost recorded yet | "Race the Ghost" button disabled with tooltip: *"Set a ghost run first"* |
| Player hits backspace | Caret moves back, re-marks character as untyped. Ghost timeline unaffected. |
| Player pastes text | `onpaste` event prevented. Typing only. |
| Browser tab loses focus mid-race | Timer pauses, resumes on refocus with a "PAUSED" overlay |
| Window resize mid-race | Paragraph container uses responsive `ch` units. Caret position recalculated. |
| localStorage full or disabled | Graceful fallback: ghost features disabled, solo mode only, with a visible notice |

---

## 🧪 Verification Checklist

- [ ] Solo P1 run: type a paragraph, verify WPM and accuracy math are correct
- [ ] Ghost save: complete P1 run, refresh page, verify ghost data persists in localStorage
- [ ] Ghost replay: start P2 race, verify ghost caret moves at exact recorded speed
- [ ] Ghost comparison: finish P2 race, verify winner/loser is correctly determined
- [ ] Velocity graph: verify both lines render on canvas with correct data points
- [ ] Audio: verify click/error/beep sounds play in Chrome, Edge, Firefox
- [ ] Error handling: verify paste is blocked, backspace works, tab-refocus pauses correctly
- [ ] Visual polish: verify no layout shifts, smooth 60fps animations, no jank on scroll
