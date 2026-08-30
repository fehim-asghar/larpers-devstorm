/* ══════════════════════════════════════════════════════════
   TYPE//GHOST — App Engine
   Universal Laptop-Tuned Thock, Pac-Man In-line Caret, Space Preserving, Minesweeper Chain Blast
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM Refs ───
  const $ = id => document.getElementById(id);
  const screens = { lobby: $('lobby'), vs: $('vs-screen'), arena: $('arena'), results: $('results') };
  const el = {
    vsScreen: $('vs-screen'),
    vsP1Avatar: $('vs-p1-avatar'),
    vsP1Name: $('vs-p1-name'),
    vsP1Badge: $('vs-p1-badge'),
    vsP2Avatar: $('vs-p2-avatar'),
    vsP2Name: $('vs-p2-name'),
    vsP2Badge: $('vs-p2-badge'),
    btnSetGhost: $('btn-set-ghost'),
    btnRaceGhost: $('btn-race-ghost'),
    ghostPreview: $('ghost-preview'),
    gpWpm: $('ghost-preview-wpm'),
    gpAcc: $('ghost-preview-acc'),
    gpTime: $('ghost-preview-time'),
    countdown: $('countdown'),
    countdownNum: $('countdown-num'),
    pauseOverlay: $('pause-overlay'),
    modeBadge: $('mode-badge'),
    btnAudioToggle: $('btn-audio-toggle'),
    audioToggleIcon: $('audio-toggle-icon'),
    audioToggleText: $('audio-toggle-text'),
    textDisplay: $('text-display'),
    hudWpm: $('hud-wpm'),
    hudTime: $('hud-time'),
    hudAcc: $('hud-acc'),
    progressPlayer: $('progress-player'),
    progressGhost: $('progress-ghost'),
    ghostRow: $('ghost-progress-row'),
    hiddenInput: $('hidden-input'),
    resultBanner: $('result-banner'),
    speedTierBadge: $('speed-tier-badge'),
    statPWpm: $('stat-p-wpm'),
    statPAcc: $('stat-p-acc'),
    statPTime: $('stat-p-time'),
    statPCons: $('stat-p-cons'),
    statCardGhost: $('stat-card-ghost'),
    statGWpm: $('stat-g-wpm'),
    statGAcc: $('stat-g-acc'),
    statGTime: $('stat-g-time'),
    statDelta: $('stat-delta'),
    velocityChart: $('velocity-chart'),
    btnCopyCard: $('btn-copy-card'),
    btnNewGhost: $('btn-new-ghost'),
    btnRaceAgain: $('btn-race-again'),
    btnBackLobby: $('btn-back-lobby'),
    btnOnlineDuel: $('btn-online-duel'),
    matchmakingModal: $('matchmaking-modal'),
    matchmakingStatus: $('matchmaking-status'),
    btnCancelMatch: $('btn-cancel-match'),
    profilePill: $('profile-pill'),
    userAvatar: $('user-avatar'),
    userName: $('user-name'),
    userMmrBadge: $('user-mmr-badge'),
    authModal: $('auth-modal'),
    googleBtnContainer: $('google-btn-container'),
    btnDemoSignin: $('btn-demo-signin'),
    btnCancelAuth: $('btn-cancel-auth'),
    btnOpenLeaderboard: $('btn-open-leaderboard'),
    leaderboardModal: $('leaderboard-modal'),
    btnCloseLeaderboard: $('btn-close-leaderboard'),
    leaderboardTbody: $('leaderboard-tbody'),
    tabLeaderboardRankings: $('tab-leaderboard-rankings'),
    tabLeaderboardHistory: $('tab-leaderboard-history'),
    viewLeaderboardRankings: $('view-leaderboard-rankings'),
    viewLeaderboardHistory: $('view-leaderboard-history'),
    matchHistoryList: $('match-history-list'),
    btnCustomRoom: $('btn-custom-room'),
    customRoomModal: $('custom-room-modal'),
    btnCloseCustomRoom: $('btn-close-custom-room'),
    tabCreateRoom: $('tab-create-room'),
    tabJoinRoom: $('tab-join-room'),
    roomCreatePanel: $('room-create-panel'),
    roomJoinPanel: $('room-join-panel'),
    displayRoomCode: $('display-room-code'),
    btnCopyCode: $('btn-copy-code'),
    btnCopyLink: $('btn-copy-link'),
    roomWaitingStatus: $('room-waiting-status'),
    inputRoomCode: $('input-room-code'),
    btnJoinRoomSubmit: $('btn-join-room-submit'),
    roomJoinError: $('room-join-error'),
  };

  // ─── State ───
  let quotes = [];
  let mode = null;          // 'record' | 'race' | 'online'
  let currentUser = null;   // { id, google_id, username, avatar_url, mmr }
  let googleClientId = '';
  let currentRoomCode = '';
  let isCustomMatch = false;
  let paragraph = '';
  let charIndex = 0;
  let errors = 0;
  let totalTyped = 0;
  let startTime = 0;
  let elapsedMs = 0;
  let timerRAF = null;
  let isPaused = false;
  let pauseOffset = 0;
  let streak = 0;
  let wpmHistory = [];      // [{ ms, wpm }]
  let isMuted = false;
  let isExploding = false;

  // Ghost data
  let ghostTimeline = [];   // [{ charIndex, ms, correct }]
  let recordTimeline = [];
  let ghostData = null;     // saved ghost { paragraph, timeline, stats, wpmHistory }
  let ghostRAF = null;
  let ghostIdx = 0;

  // Live Multiplayer State
  let ws = null;
  let isOnlineMatch = false;
  let onlineOpponentStats = null;
  let onlineOpponentFinished = false;
  let opponentWpmHistory = [];

  // ══════════════════════════════════════════════════════
  // Audio Engine (Web Audio API — Universal Laptop Speaker Tuned)
  // ══════════════════════════════════════════════════════
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // ─── Laptop-Audible Punchy & Creamy "Thock" Switch Synthesizer ───
  // Tuned with 300Hz–1200Hz punch harmonics so it cuts cleanly through laptop speakers & phones!
  function playThock(currentWpm = 0) {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;

    // 1. High transient mechanical snap (tactile switch click)
    const snapBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.005), audioCtx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapData.length; i++) {
      snapData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / snapData.length, 4);
    }
    const snapSrc = audioCtx.createBufferSource();
    snapSrc.buffer = snapBuf;

    const snapFilter = audioCtx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.value = 3800 + Math.min(1200, currentWpm * 12);
    snapFilter.Q.value = 1.8;

    const snapGain = audioCtx.createGain();
    snapGain.gain.setValueAtTime(0.4, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.006);

    snapSrc.connect(snapFilter).connect(snapGain).connect(audioCtx.destination);
    snapSrc.start(t);

    // 2. Punchy lower-mid switch bottom-out "THOCK" body (Audible on all speakers!)
    // Fundamental ~320Hz dropping fast to ~180Hz
    const bodyOsc = audioCtx.createOscillator();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(320 + Math.min(40, currentWpm * 0.3), t);
    bodyOsc.frequency.exponentialRampToValueAtTime(180, t + 0.04);

    const bodyGain = audioCtx.createGain();
    bodyGain.gain.setValueAtTime(0.75, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

    bodyOsc.connect(bodyGain).connect(audioCtx.destination);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.05);

    // 3. Acoustic wooden clack formant resonance (750Hz)
    const clackOsc = audioCtx.createOscillator();
    clackOsc.type = 'sine';
    clackOsc.frequency.setValueAtTime(780, t);
    clackOsc.frequency.exponentialRampToValueAtTime(350, t + 0.035);

    const clackGain = audioCtx.createGain();
    clackGain.gain.setValueAtTime(0.4, t);
    clackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    clackOsc.connect(clackGain).connect(audioCtx.destination);
    clackOsc.start(t);
    clackOsc.stop(t + 0.04);
  }

  // ─── Low-Pitch Error Thud ───
  function playError() {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 450;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.095);
  }

  // ─── Countdown Beeps ───
  function playBeep(freq = 880, dur = 0.08) {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  // ─── Minesweeper Micro-Explosion Pop Chirp ───
  function playBlastChirp(freq = 400) {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + 0.04);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(filter).connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  // ─── Tekken VS Clash Dramatic SFX (Sub-bass boom + metallic slash) ───
  function playClashSound() {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;

    // 1. Sub-Bass 808 Impact Boom (130Hz -> 30Hz)
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(130, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.65);
    subGain.gain.setValueAtTime(0.75, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    subOsc.connect(subGain).connect(audioCtx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.75);

    // 2. Metallic Slash Saw Chirp
    const sawOsc = audioCtx.createOscillator();
    const sawGain = audioCtx.createGain();
    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(700, t);
    sawOsc.frequency.exponentialRampToValueAtTime(70, t + 0.35);
    sawGain.gain.setValueAtTime(0.35, t);
    sawGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    sawOsc.connect(sawGain).connect(audioCtx.destination);
    sawOsc.start(t);
    sawOsc.stop(t + 0.4);
  }

  function getSpeedTier(wpm) {
    if (wpm >= 120) return '⚡ Phantom';
    if (wpm >= 95) return '🔥 Apex';
    if (wpm >= 75) return '🌸 Viper';
    if (wpm >= 55) return '🏎️ Striker';
    if (wpm >= 35) return '⚡ Cruiser';
    return '🌱 Novice';
  }

  function showVsClashScreen(rival, onComplete) {
    const p1 = currentUser || { username: 'YOU', avatar_url: 'miku.gif', mmr: 500, best_wpm: 60 };
    const p2 = rival || { username: 'RIVAL RACER', avatar_url: 'miku.gif', mmr: 500, best_wpm: 60 };

    el.vsP1Avatar.src = p1.avatar_url || 'miku.gif';
    el.vsP1Name.textContent = (p1.username || 'YOU').toUpperCase();
    el.vsP1Badge.textContent = `${p1.mmr || 500} MMR · ${getSpeedTier(p1.best_wpm || 60)}`;

    el.vsP2Avatar.src = p2.avatar_url || 'miku.gif';
    el.vsP2Name.textContent = (p2.username || 'RIVAL RACER').toUpperCase();
    el.vsP2Badge.textContent = `${p2.mmr || 500} MMR · ${getSpeedTier(p2.best_wpm || 60)}`;

    switchScreen('vs');
    playClashSound();

    setTimeout(() => {
      onComplete();
    }, 1800);
  }

  // ─── Procedural Lobby 8-bit Synth Melody Loop (PoPiPo Style) ───
  let bgmInterval = null;
  let bgmNoteIndex = 0;
  const bgmMelody = [
    523.25, 659.25, 783.99, 659.25, 523.25, 659.25, 783.99, 1046.50,
    880.00, 783.99, 659.25, 523.25, 587.33, 659.25, 587.33, 523.25
  ];

  function startLobbyBGM() {
    if (isMuted || bgmInterval) return;
    ensureAudio();
    bgmNoteIndex = 0;
    bgmInterval = setInterval(() => {
      if (isMuted || !screens.lobby.classList.contains('active')) {
        stopLobbyBGM();
        return;
      }
      try {
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bgmMelody[bgmNoteIndex % bgmMelody.length];
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.13);
        bgmNoteIndex++;
      } catch (e) { }
    }, 180);
  }

  function stopLobbyBGM() {
    if (bgmInterval) {
      clearInterval(bgmInterval);
      bgmInterval = null;
    }
  }

  // ─── Victory & Defeat Audio Fanfares ───
  function playVictoryFanfare() {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.09 + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + idx * 0.09);
      osc.stop(t + idx * 0.09 + 0.36);
    });

    // Sub-bass celebration boom
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, t + 0.36);
    subOsc.frequency.exponentialRampToValueAtTime(45, t + 0.9);
    subGain.gain.setValueAtTime(0.6, t + 0.36);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    subOsc.connect(subGain).connect(audioCtx.destination);
    subOsc.start(t + 0.36);
    subOsc.stop(t + 0.95);
  }

  function playDefeatChime() {
    if (isMuted) return;
    ensureAudio();
    const t = audioCtx.currentTime;
    const notes = [440.00, 392.00, 349.23, 261.63];
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.16 + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + idx * 0.16);
      osc.stop(t + idx * 0.16 + 0.36);
    });
  }

  function toggleAudio() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('typeghost_muted', isMuted ? 'true' : 'false');
    } catch (e) { }
    if (isMuted) stopLobbyBGM();
    else if (screens.lobby.classList.contains('active')) startLobbyBGM();
    updateAudioUI();
  }

  function updateAudioUI() {
    if (isMuted) {
      el.audioToggleIcon.textContent = '🔇';
      el.audioToggleText.textContent = 'MUTED';
      el.btnAudioToggle.classList.add('muted');
    } else {
      el.audioToggleIcon.textContent = '🔊';
      el.audioToggleText.textContent = 'SFX ON';
      el.btnAudioToggle.classList.remove('muted');
    }
  }

  // ══════════════════════════════════════════════════════
  // State Manager & Storage
  // ══════════════════════════════════════════════════════
  function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    const bgVideo = $('lobby-bg-video');
    if (bgVideo) {
      if (name === 'lobby') {
        bgVideo.play().catch(() => { });
        startLobbyBGM();
      } else {
        bgVideo.pause();
        stopLobbyBGM();
      }
    }
  }

  function loadGhostFromStorage() {
    try {
      const raw = localStorage.getItem('typeghost_ghost');
      if (raw) {
        ghostData = JSON.parse(raw);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function saveGhostToStorage(data) {
    try {
      localStorage.setItem('typeghost_ghost', JSON.stringify(data));
    } catch (e) { }
  }

  function updateLobbyState() {
    const hasGhost = loadGhostFromStorage();
    el.btnRaceGhost.disabled = !hasGhost;
    el.btnRaceAgain.disabled = !hasGhost;
    if (hasGhost) {
      el.ghostPreview.classList.remove('hidden');
      el.gpWpm.textContent = ghostData.stats.wpm + ' WPM';
      el.gpAcc.textContent = ghostData.stats.accuracy + '%';
      el.gpTime.textContent = (ghostData.stats.timeMs / 1000).toFixed(1) + 's';
    } else {
      el.ghostPreview.classList.add('hidden');
    }
  }

  // ══════════════════════════════════════════════════════
  // Race Engine & Pac-Man Chomping
  // ══════════════════════════════════════════════════════
  function pickParagraph() {
    return quotes[Math.floor(Math.random() * quotes.length)].text;
  }

  function renderText() {
    el.textDisplay.innerHTML = '';
    let currentWord = document.createElement('span');
    currentWord.className = 'word';
    el.textDisplay.appendChild(currentWord);

    for (let i = 0; i < paragraph.length; i++) {
      const span = document.createElement('span');
      const isSpace = paragraph[i] === ' ';
      span.className = 'char' + (isSpace ? ' space' : '') + (i === 0 ? ' current' : ' untyped');
      span.textContent = paragraph[i];
      span.dataset.idx = i;
      currentWord.appendChild(span);

      // Start a new word container after every space (unless at end of text)
      if (isSpace && i < paragraph.length - 1) {
        currentWord = document.createElement('span');
        currentWord.className = 'word';
        el.textDisplay.appendChild(currentWord);
      }
    }
  }

  function getChars() {
    return el.textDisplay.querySelectorAll('.char');
  }

  function calcWPM() {
    if (elapsedMs < 500) return 0;
    const correctChars = totalTyped - errors;
    return Math.max(0, Math.round((correctChars / 5) / (elapsedMs / 60000)));
  }

  function calcAccuracy() {
    if (totalTyped === 0) return 100;
    return Math.round(((totalTyped - errors) / totalTyped) * 100);
  }

  function calcConsistency() {
    if (wpmHistory.length < 5) return 96;
    const wpms = wpmHistory.map(p => p.wpm).filter(w => w > 0);
    if (wpms.length === 0) return 95;
    const avg = wpms.reduce((a, b) => a + b, 0) / wpms.length;
    const variance = wpms.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / wpms.length;
    const stdDev = Math.sqrt(variance);
    const score = Math.max(50, Math.min(99, Math.round(100 - (stdDev / (avg || 1)) * 40)));
    return score;
  }

  function getSpeedTier(wpm) {
    if (wpm >= 110) return '👑 MECHANICAL GOD';
    if (wpm >= 90) return '🔥 GHOST SLAYER';
    if (wpm >= 70) return '⚡ KEYBOARD ATHLETE';
    if (wpm >= 50) return '🔵 DAILY DRIVER';
    if (wpm >= 30) return '🟡 LEARNING THE ROPES';
    return '🐢 HUNT & PECK';
  }

  function updateHUD() {
    el.hudWpm.textContent = calcWPM();
    el.hudAcc.textContent = calcAccuracy() + '%';
    const secs = elapsedMs / 1000;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    el.hudTime.textContent = String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
    el.progressPlayer.style.width = ((charIndex / paragraph.length) * 100) + '%';
  }

  function timerTick() {
    if (isPaused || isExploding) return;
    elapsedMs = performance.now() - startTime - pauseOffset;
    updateHUD();
    timerRAF = requestAnimationFrame(timerTick);
  }

  function handleKeystroke(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Tab' || e.key === 'Escape') return;
    if (charIndex >= paragraph.length || isPaused || isExploding) return;

    const chars = getChars();

    // Backspace
    if (e.key === 'Backspace') {
      if (charIndex > 0) {
        const isCurrSpace = paragraph[charIndex] === ' ';
        chars[charIndex].className = 'char untyped' + (isCurrSpace ? ' space' : '');
        charIndex--;
        const isPrevSpace = paragraph[charIndex] === ' ';
        chars[charIndex].className = 'char current' + (isPrevSpace ? ' space' : '');
      }
      return;
    }

    if (e.key.length !== 1) return;
    e.preventDefault();
    totalTyped++;

    const expected = paragraph[charIndex];
    const correct = e.key === expected;
    const currentWpm = calcWPM();
    const isCharSpace = paragraph[charIndex] === ' ';

    if (correct) {
      chars[charIndex].className = 'char correct' + (isCharSpace ? ' space' : '');
      streak++;
      playThock(currentWpm);

      const ms = performance.now() - startTime - pauseOffset;
      recordTimeline.push({ charIndex, ms, correct: true });
      wpmHistory.push({ ms, wpm: currentWpm });

      // Live Multiplayer Broadcast (<30ms)
      if (mode === 'online' && ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'PROGRESS',
          charIndex: charIndex + 1,
          wpm: currentWpm
        }));
      }

      charIndex++;

      if (charIndex < paragraph.length) {
        const isNextSpace = paragraph[charIndex] === ' ';
        chars[charIndex].className = 'char current' + (isNextSpace ? ' space' : '');
      }

      // Finish reached? Trigger Minesweeper explosion!
      if (charIndex >= paragraph.length) {
        updateHUD();
        finishRace();
        return;
      }
    } else {
      errors++;
      streak = 0;
      playError();

      // Block advance: flash red shake on current char without incrementing charIndex
      chars[charIndex].className = 'char current' + (isCharSpace ? ' space' : '');
      chars[charIndex].classList.remove('wrong');
      void chars[charIndex].offsetWidth; // force reflow so repeated typos re-trigger shake
      chars[charIndex].classList.add('wrong');
    }

    // Streak glow
    if (streak >= 15) {
      el.textDisplay.classList.add('streak');
    } else {
      el.textDisplay.classList.remove('streak');
    }

    updateHUD();
  }

  // ══════════════════════════════════════════════════════
  // Minesweeper Chain-Reaction Letter Explosion
  // ══════════════════════════════════════════════════════
  function triggerMinesweeperExplosion(onComplete) {
    isExploding = true;
    const chars = Array.from(getChars());
    let idx = 0;
    const total = chars.length;
    const delayPerChar = Math.max(8, Math.min(18, 550 / total));

    const popInterval = setInterval(() => {
      if (idx >= total) {
        clearInterval(popInterval);
        setTimeout(() => {
          isExploding = false;
          onComplete();
        }, 150);
        return;
      }

      const c = chars[idx];
      c.classList.remove('current', 'ghost-cursor');
      c.classList.add('blast-pop');

      // Ascending arcade pop pitch
      const pitch = 320 + Math.min(1100, idx * (900 / total));
      playBlastChirp(pitch);

      idx++;
    }, delayPerChar);
  }

  function finishRace() {
    cancelAnimationFrame(timerRAF);
    if (ghostRAF) cancelAnimationFrame(ghostRAF);
    elapsedMs = performance.now() - startTime - pauseOffset;

    const stats = {
      wpm: calcWPM(),
      accuracy: calcAccuracy(),
      consistency: calcConsistency(),
      timeMs: Math.round(elapsedMs),
    };

    el.hiddenInput.removeEventListener('keydown', handleKeystroke);
    el.hiddenInput.blur();

    if (mode === 'online' && ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'FINISH', stats }));
    }

    // Trigger Minesweeper explosion before showing results
    triggerMinesweeperExplosion(() => {
      if (mode === 'record') {
        const data = { paragraph, timeline: recordTimeline, stats, wpmHistory };
        saveGhostToStorage(data);
        ghostData = data;
        showResults(stats, null);
      } else if (mode === 'online') {
        showResults(stats, onlineOpponentStats);
      } else {
        showResults(stats, ghostData.stats);
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // Authentication & Profile State (Phase 2)
  // ══════════════════════════════════════════════════════
  function updateProfileUI() {
    if (currentUser) {
      el.userName.textContent = currentUser.username || 'Racer';
      el.userAvatar.src = currentUser.avatar_url || 'miku.gif';
      el.userMmrBadge.textContent = `${currentUser.mmr || 500} MMR · 🌸 Viper`;
      el.profilePill.classList.add('logged-in');
    } else {
      el.userName.textContent = 'Guest';
      el.userAvatar.src = 'miku.gif';
      el.userMmrBadge.textContent = '500 MMR (Unranked)';
      el.profilePill.classList.remove('logged-in');
    }
  }

  async function handleGoogleResponse(res) {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: res.credential })
      });
      const data = await response.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem('syntax_user', JSON.stringify(currentUser));
        if (data.token) localStorage.setItem('syntax_token', data.token);
        updateProfileUI();
        el.authModal.classList.add('hidden');
        startMatchmaking();
      }
    } catch (e) {
      alert('Google authentication failed. Try 1-Click Fast Sign-In.');
    }
  }

  async function handleDemoSignin() {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mockUser: {
            id: 'faheem_dev',
            username: 'Faheem (Ranked)',
            avatar_url: 'miku.gif'
          }
        })
      });
      const data = await response.json();
      if (data.success && data.user) {
        currentUser = data.user;
        localStorage.setItem('syntax_user', JSON.stringify(currentUser));
        if (data.token) localStorage.setItem('syntax_token', data.token);
        updateProfileUI();
        el.authModal.classList.add('hidden');
        startMatchmaking();
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error('Demo auth error:', e);
    }
  }

  function handleRankedDuelClick() {
    if (currentUser) {
      startMatchmaking();
    } else {
      el.authModal.classList.remove('hidden');
    }
  }

  function handleProfilePillClick() {
    if (currentUser) {
      if (confirm(`Logged in as ${currentUser.username} (${currentUser.mmr} MMR).\n\nDo you want to log out?`)) {
        currentUser = null;
        localStorage.removeItem('syntax_user');
        localStorage.removeItem('syntax_token');
        if (ws) ws.close();
        updateProfileUI();
      }
    } else {
      el.authModal.classList.remove('hidden');
    }
  }

  function openLeaderboard() {
    el.leaderboardModal.classList.remove('hidden');
    switchLeaderboardTab('rankings');
  }

  function switchLeaderboardTab(tab) {
    if (tab === 'rankings') {
      el.tabLeaderboardRankings.classList.add('active');
      el.tabLeaderboardHistory.classList.remove('active');
      el.viewLeaderboardRankings.classList.remove('hidden');
      el.viewLeaderboardHistory.classList.add('hidden');
      loadLeaderboardRankings();
    } else {
      el.tabLeaderboardRankings.classList.remove('active');
      el.tabLeaderboardHistory.classList.add('active');
      el.viewLeaderboardRankings.classList.add('hidden');
      el.viewLeaderboardHistory.classList.remove('hidden');
      loadMatchHistory();
    }
  }

  async function loadLeaderboardRankings() {
    el.leaderboardTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">Loading rankings...</td></tr>`;
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();

      if (!data || data.length === 0) {
        el.leaderboardTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-dim);">No ranked players yet. Be the first to duel!</td></tr>`;
        return;
      }

      el.leaderboardTbody.innerHTML = data.map((player, idx) => {
        const rankNum = idx + 1;
        const rankBadgeClass = rankNum === 1 ? 'rank-badge-1' : (rankNum === 2 ? 'rank-badge-2' : (rankNum === 3 ? 'rank-badge-3' : ''));
        const tier = getSpeedTier(player.best_wpm || 0);
        const winRate = player.matches_played > 0
          ? Math.round((player.matches_won / player.matches_played) * 100) + '%'
          : '—';
        const isActive = currentUser && currentUser.id === player.id ? 'active-user' : '';

        return `
          <tr class="${isActive}">
            <td class="${rankBadgeClass}">#${rankNum}</td>
            <td>
              <div class="racer-cell">
                <img class="racer-avatar" src="${player.avatar_url || 'miku.gif'}" alt="Avatar">
                <span>${player.username}</span>
              </div>
            </td>
            <td style="color: #FFB300; font-weight: 700;">${player.mmr || 500}</td>
            <td>${tier}</td>
            <td>${player.best_wpm || 0} WPM</td>
            <td>${winRate}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      el.leaderboardTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--accent-error);">Failed to load rankings.</td></tr>`;
    }
  }

  async function loadMatchHistory() {
    el.matchHistoryList.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.82rem;">Loading battle history...</div>`;
    try {
      const url = currentUser ? `/api/matches/recent?userId=${currentUser.id}` : `/api/matches/recent`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data || data.length === 0) {
        el.matchHistoryList.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-dim); font-family: var(--font-mono); font-size: 0.82rem;">No battle logs recorded yet. Play a match to create history!</div>`;
        return;
      }

      el.matchHistoryList.innerHTML = data.map(m => {
        const isP1 = currentUser && currentUser.id === m.p1_id;
        const isWinner = currentUser ? (m.winner_id === currentUser.id) : (m.winner_id === m.p1_id);
        const matchTypeClass = m.is_ranked ? 'ranked' : 'custom';
        const matchTypeLabel = m.is_ranked ? '⚔️ Ranked' : '🎮 Custom';
        const outcomeClass = isWinner ? 'win' : 'lose';
        const outcomeText = isWinner ? 'VICTORY' : 'DEFEAT';
        const mmrDeltaText = m.is_ranked
          ? (isP1 ? (m.p1_mmr_delta >= 0 ? `+${m.p1_mmr_delta}` : `${m.p1_mmr_delta}`) : (m.p2_mmr_delta >= 0 ? `+${m.p2_mmr_delta}` : `${m.p2_mmr_delta}`)) + ' MMR'
          : '0 MMR';

        const p1Name = m.p1_name || 'Racer 1';
        const p2Name = m.p2_name || 'Racer 2';
        const p1Avatar = m.p1_avatar || 'miku.gif';
        const p2Avatar = m.p2_avatar || 'miku.gif';
        const dateStr = (m.played_at || '').substring(11, 16) || 'Just now';

        return `
          <div class="match-history-card">
            <span class="match-type-badge ${matchTypeClass}">${matchTypeLabel}</span>

            <div class="match-fighters-row">
              <div class="match-player-side">
                <img class="match-player-avatar" src="${p1Avatar}" alt="P1">
                <div>
                  <div class="match-player-name">${p1Name}</div>
                  <div class="match-player-stats">${m.p1_wpm} WPM · ${m.p1_acc}%</div>
                </div>
              </div>

              <span class="match-vs-badge">VS</span>

              <div class="match-player-side">
                <img class="match-player-avatar" src="${p2Avatar}" alt="P2">
                <div>
                  <div class="match-player-name">${p2Name}</div>
                  <div class="match-player-stats">${m.p2_wpm} WPM · ${m.p2_acc}%</div>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="match-outcome-badge ${outcomeClass}">${outcomeText} (${mmrDeltaText})</span>
              <span class="match-date-stamp">${dateStr}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      el.matchHistoryList.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--accent-error); font-family: var(--font-mono); font-size: 0.82rem;">Failed to load match history.</div>`;
    }
  }

  // ══════════════════════════════════════════════════════
  // Custom Unranked Room Handlers (Phase 5)
  // ══════════════════════════════════════════════════════
  function openCustomRoomModal() {
    el.customRoomModal.classList.remove('hidden');
    switchRoomTab('create');
    createCustomRoom();
  }

  function switchRoomTab(tab) {
    if (tab === 'create') {
      el.tabCreateRoom.classList.add('active');
      el.tabJoinRoom.classList.remove('active');
      el.roomCreatePanel.classList.remove('hidden');
      el.roomJoinPanel.classList.add('hidden');
    } else {
      el.tabCreateRoom.classList.remove('active');
      el.tabJoinRoom.classList.add('active');
      el.roomCreatePanel.classList.add('hidden');
      el.roomJoinPanel.classList.remove('hidden');
      el.inputRoomCode.focus();
    }
  }

  function createCustomRoom() {
    isOnlineMatch = true;
    isCustomMatch = true;
    onlineOpponentStats = null;
    onlineOpponentFinished = false;
    opponentWpmHistory = [];

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';

    try {
      if (ws) ws.close();
      ws = new WebSocket(`${protocol}//${host}`);
    } catch (e) {
      alert('Could not connect to relay server.');
      return;
    }

    currentRoomCode = 'RUSH-' + Math.floor(10 + Math.random() * 90);
    el.displayRoomCode.textContent = currentRoomCode;

    ws.onopen = () => {
      const token = localStorage.getItem('syntax_token');
      if (token) ws.send(JSON.stringify({ type: 'AUTH', token }));
      ws.send(JSON.stringify({
        type: 'CREATE_ROOM',
        roomCode: currentRoomCode
      }));
    };

    wireWebSocketEvents();
  }

  function joinCustomRoom(code) {
    const cleanCode = (code || el.inputRoomCode.value || '').trim().toUpperCase();
    if (!cleanCode) {
      el.roomJoinError.textContent = 'Please enter a valid room code (e.g. RUSH-42)';
      el.roomJoinError.classList.remove('hidden');
      return;
    }

    el.roomJoinError.classList.add('hidden');
    isOnlineMatch = true;
    isCustomMatch = true;
    onlineOpponentStats = null;
    onlineOpponentFinished = false;
    opponentWpmHistory = [];

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';

    try {
      if (ws) ws.close();
      ws = new WebSocket(`${protocol}//${host}`);
    } catch (e) {
      alert('Could not connect to relay server.');
      return;
    }

    ws.onopen = () => {
      const token = localStorage.getItem('syntax_token');
      if (token) ws.send(JSON.stringify({ type: 'AUTH', token }));
      ws.send(JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode: cleanCode
      }));
    };

    wireWebSocketEvents();
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(currentRoomCode).then(() => {
      el.btnCopyCode.innerHTML = `<span class="btn-icon">✓</span> Copied!`;
      setTimeout(() => el.btnCopyCode.innerHTML = `<span class="btn-icon">📋</span> Copy Code`, 2000);
    });
  }

  function copyRoomLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      el.btnCopyLink.innerHTML = `<span class="btn-icon">✓</span> Copied Link!`;
      setTimeout(() => el.btnCopyLink.innerHTML = `<span class="btn-icon">🔗</span> Copy Link`, 2000);
    });
  }

  // ══════════════════════════════════════════════════════
  // Live 1v1 Multiplayer Engine (WebSockets)
  // ══════════════════════════════════════════════════════
  function startMatchmaking() {
    isOnlineMatch = true;
    isCustomMatch = false;
    onlineOpponentStats = null;
    onlineOpponentFinished = false;
    opponentWpmHistory = [];

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';

    try {
      if (ws) ws.close();
      ws = new WebSocket(`${protocol}//${host}`);
    } catch (e) {
      alert('Could not connect to multiplayer relay server. Make sure server.js is running!');
      return;
    }

    el.matchmakingModal.classList.remove('hidden');
    el.matchmakingStatus.textContent = 'Connecting to relay server...';

    ws.onopen = () => {
      const token = localStorage.getItem('syntax_token');
      if (token) ws.send(JSON.stringify({ type: 'AUTH', token }));
      el.matchmakingStatus.textContent = 'Searching for live rival...';
      ws.send(JSON.stringify({ type: 'FIND_MATCH' }));
    };

    wireWebSocketEvents();
  }

  function wireWebSocketEvents() {
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'ROOM_CREATED') {
          currentRoomCode = data.roomCode;
          el.displayRoomCode.textContent = data.roomCode;
          el.roomWaitingStatus.textContent = 'Waiting for friend to enter code...';
        } else if (data.type === 'ROOM_ERROR') {
          el.roomJoinError.textContent = data.message;
          el.roomJoinError.classList.remove('hidden');
        } else if (data.type === 'WAITING') {
          el.matchmakingStatus.textContent = data.message || 'Waiting for an opponent to join...';
        } else if (data.type === 'MATCH_START') {
          isCustomMatch = (data.isRanked === false);
          el.matchmakingModal.classList.add('hidden');
          el.customRoomModal.classList.add('hidden');
          paragraph = data.paragraph;
          const rival = data.opponentUser || { username: 'RIVAL RACER', avatar_url: 'miku.gif', mmr: 500, best_wpm: 60 };
          showVsClashScreen(rival, () => {
            startOnlineRace();
          });
        } else if (data.type === 'OPPONENT_PROGRESS') {
          el.progressGhost.style.width = ((data.charIndex / paragraph.length) * 100) + '%';
          const chars = getChars();
          chars.forEach(c => c.classList.remove('ghost-cursor'));
          if (data.charIndex < paragraph.length) {
            chars[data.charIndex].classList.add('ghost-cursor');
          }
          opponentWpmHistory.push({ ms: performance.now() - startTime, wpm: data.wpm });
        } else if (data.type === 'OPPONENT_FINISHED') {
          onlineOpponentFinished = true;
          onlineOpponentStats = data.stats;
          el.progressGhost.style.width = '100%';
        } else if (data.type === 'MATCH_RESULT') {
          if (data.isRanked && data.user) {
            currentUser = data.user;
            localStorage.setItem('syntax_user', JSON.stringify(currentUser));
            updateProfileUI();
          }
          if (data.won) playVictoryFanfare();
          else playDefeatChime();

          if (screens.results.classList.contains('active')) {
            if (!data.isRanked) {
              if (data.won) {
                el.resultBanner.textContent = 'VICTORY — YOU WON THE CUSTOM DUEL! (0 MMR)';
                el.resultBanner.className = 'result-banner win';
              } else {
                el.resultBanner.textContent = 'DEFEAT — FRIEND WAS FASTER! (0 MMR)';
                el.resultBanner.className = 'result-banner lose';
              }
            } else {
              const bonusText = data.bonuses && data.bonuses.length ? ` [${data.bonuses.join(' ')}]` : '';
              if (data.won) {
                el.resultBanner.textContent = `VICTORY! (+${data.mmrDelta} MMR)${bonusText}`;
                el.resultBanner.className = 'result-banner win';
              } else {
                el.resultBanner.textContent = `DEFEAT (${data.mmrDelta} MMR)`;
                el.resultBanner.className = 'result-banner lose';
              }
            }
          }
        } else if (data.type === 'OPPONENT_DISCONNECTED') {
          if (screens.arena.classList.contains('active') || screens.results.classList.contains('active')) {
            onlineOpponentFinished = true;
            onlineOpponentStats = { wpm: 0, accuracy: 0, timeMs: 999999 };
            if (data.matchResult && data.matchResult.user && data.matchResult.isRanked) {
              currentUser = data.matchResult.user;
              localStorage.setItem('syntax_user', JSON.stringify(currentUser));
              updateProfileUI();
            }
            el.resultBanner.textContent = data.matchResult?.isRanked
              ? 'RIVAL FORFEIT — VICTORY! (+25 MMR)'
              : 'FRIEND LEFT — DUEL ENDED (0 MMR)';
            el.resultBanner.className = 'result-banner win';
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onerror = () => {
      el.matchmakingStatus.textContent = 'Multiplayer server offline. Run "npm start"!';
      el.roomJoinError.textContent = 'Multiplayer server offline.';
      el.roomJoinError.classList.remove('hidden');
    };

    ws.onclose = () => {
      if (!screens.arena.classList.contains('active') && !screens.results.classList.contains('active')) {
        el.matchmakingModal.classList.add('hidden');
      }
    };
  }

  function cancelMatchmaking() {
    if (ws) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'CANCEL_QUEUE' }));
        ws.send(JSON.stringify({ type: 'LEAVE_ROOM' }));
      }
      ws.close();
    }
    el.matchmakingModal.classList.add('hidden');
    el.customRoomModal.classList.add('hidden');
    isOnlineMatch = false;
    isCustomMatch = false;
  }

  function startOnlineRace() {
    mode = 'online';
    charIndex = 0;
    errors = 0;
    totalTyped = 0;
    elapsedMs = 0;
    streak = 0;
    pauseOffset = 0;
    isPaused = false;
    isExploding = false;
    wpmHistory = [];
    opponentWpmHistory = [];

    switchScreen('arena');
    el.modeBadge.textContent = '⚔️ LIVE 1v1 DUEL';
    el.modeBadge.classList.add('ghost-mode');
    el.ghostRow.classList.remove('hidden');
    el.progressPlayer.style.width = '0%';
    el.progressGhost.style.width = '0%';
    el.hudWpm.textContent = '0';
    el.hudAcc.textContent = '100%';
    el.hudTime.textContent = '00:00.0';
    el.textDisplay.classList.remove('streak');
    el.pauseOverlay.classList.add('hidden');

    renderText();

    // Immediate start: Tekken VS Clash screen already served as the cinematic countdown!
    startTime = performance.now();
    timerRAF = requestAnimationFrame(timerTick);

    el.hiddenInput.value = '';
    el.hiddenInput.focus();
    el.hiddenInput.addEventListener('keydown', handleKeystroke);
  }

  // ══════════════════════════════════════════════════════
  // Ghost Replayer (Solo Mode)
  // ══════════════════════════════════════════════════════
  function startGhostReplay() {
    if (!ghostData) return;
    ghostTimeline = ghostData.timeline;
    ghostIdx = 0;
    el.ghostRow.classList.remove('hidden');
    el.progressGhost.style.width = '0%';

    const chars = getChars();
    function ghostTick() {
      if (isExploding) return;
      const now = performance.now() - startTime - pauseOffset;
      while (ghostIdx < ghostTimeline.length && ghostTimeline[ghostIdx].ms <= now) {
        const gi = ghostTimeline[ghostIdx].charIndex;
        chars.forEach(c => c.classList.remove('ghost-cursor'));
        if (gi + 1 < paragraph.length) {
          chars[gi + 1].classList.add('ghost-cursor');
        }
        ghostIdx++;
        el.progressGhost.style.width = ((ghostIdx / paragraph.length) * 100) + '%';
      }

      if (ghostIdx < ghostTimeline.length) {
        ghostRAF = requestAnimationFrame(ghostTick);
      } else {
        el.progressGhost.style.width = '100%';
        chars.forEach(c => c.classList.remove('ghost-cursor'));
      }
    }
    ghostRAF = requestAnimationFrame(ghostTick);
  }

  // ══════════════════════════════════════════════════════
  // Countdown & Start
  // ══════════════════════════════════════════════════════
  function startCountdown(onGo) {
    let count = 3;
    el.countdown.classList.remove('hidden');
    el.countdownNum.textContent = count;
    el.countdownNum.style.animation = 'none';
    void el.countdownNum.offsetWidth;
    el.countdownNum.style.animation = '';
    playBeep(660, 0.1);

    const iv = setInterval(() => {
      count--;
      if (count > 0) {
        el.countdownNum.textContent = count;
        el.countdownNum.style.animation = 'none';
        void el.countdownNum.offsetWidth;
        el.countdownNum.style.animation = '';
        playBeep(660, 0.1);
      } else if (count === 0) {
        el.countdownNum.textContent = 'GO';
        el.countdownNum.style.animation = 'none';
        void el.countdownNum.offsetWidth;
        el.countdownNum.style.animation = '';
        playBeep(1320, 0.15);
      } else {
        clearInterval(iv);
        el.countdown.classList.add('hidden');
        onGo();
      }
    }, 650);
  }

  function startRace(raceMode) {
    mode = raceMode;
    charIndex = 0;
    errors = 0;
    totalTyped = 0;
    elapsedMs = 0;
    streak = 0;
    pauseOffset = 0;
    isPaused = false;
    isExploding = false;
    wpmHistory = [];
    recordTimeline = [];
    ghostIdx = 0;

    if (mode === 'race' && ghostData) {
      paragraph = ghostData.paragraph;
    } else {
      paragraph = pickParagraph();
    }

    switchScreen('arena');
    el.modeBadge.textContent = mode === 'record' ? 'RECORDING' : 'RACING GHOST';
    el.modeBadge.classList.toggle('ghost-mode', mode === 'race');
    el.ghostRow.classList.toggle('hidden', mode !== 'race');
    el.progressPlayer.style.width = '0%';
    el.progressGhost.style.width = '0%';
    el.hudWpm.textContent = '0';
    el.hudAcc.textContent = '100%';
    el.hudTime.textContent = '00:00.0';
    el.textDisplay.classList.remove('streak');
    el.pauseOverlay.classList.add('hidden');

    renderText();

    startCountdown(() => {
      startTime = performance.now();
      timerRAF = requestAnimationFrame(timerTick);

      el.hiddenInput.value = '';
      el.hiddenInput.focus();
      el.hiddenInput.addEventListener('keydown', handleKeystroke);

      if (mode === 'race') startGhostReplay();
    });
  }

  // ══════════════════════════════════════════════════════
  // Telemetry & Results
  // ══════════════════════════════════════════════════════
  function showResults(playerStats, ghostStats) {
    switchScreen('results');

    el.statPWpm.textContent = playerStats.wpm;
    el.statPAcc.textContent = playerStats.accuracy + '%';
    el.statPTime.textContent = (playerStats.timeMs / 1000).toFixed(1) + 's';
    el.statPCons.textContent = (playerStats.consistency || calcConsistency()) + '%';

    // Speed Tier
    el.speedTierBadge.textContent = getSpeedTier(playerStats.wpm);

    if (mode === 'online') {
      el.statCardGhost.classList.remove('hidden');
      if (ghostStats) {
        el.statGWpm.textContent = ghostStats.wpm;
        el.statGAcc.textContent = ghostStats.accuracy + '%';
        el.statGTime.textContent = (ghostStats.timeMs / 1000).toFixed(1) + 's';

        const deltaMs = playerStats.timeMs - ghostStats.timeMs;
        const deltaSec = (deltaMs / 1000).toFixed(1);
        el.statDelta.textContent = (deltaMs >= 0 ? '+' : '') + deltaSec + 's';

        if (playerStats.timeMs <= ghostStats.timeMs) {
          el.resultBanner.textContent = 'VICTORY — YOU WON THE DUEL!';
          el.resultBanner.className = 'result-banner win';
        } else {
          el.resultBanner.textContent = 'DEFEAT — RIVAL WAS FASTER!';
          el.resultBanner.className = 'result-banner lose';
        }
      } else {
        el.statGWpm.textContent = 'RACING...';
        el.statGAcc.textContent = '—';
        el.statGTime.textContent = '—';
        el.statDelta.textContent = '1ST';
        el.resultBanner.textContent = 'VICTORY — 1ST TO FINISH!';
        el.resultBanner.className = 'result-banner win';
      }
    } else if (ghostStats && mode === 'race') {
      el.statCardGhost.classList.remove('hidden');
      el.statGWpm.textContent = ghostStats.wpm;
      el.statGAcc.textContent = ghostStats.accuracy + '%';
      el.statGTime.textContent = (ghostStats.timeMs / 1000).toFixed(1) + 's';

      const deltaMs = playerStats.timeMs - ghostStats.timeMs;
      const deltaSec = (deltaMs / 1000).toFixed(1);
      el.statDelta.textContent = (deltaMs >= 0 ? '+' : '') + deltaSec + 's';

      if (playerStats.accuracy === 100 && playerStats.timeMs < ghostStats.timeMs) {
        el.resultBanner.textContent = 'PERFECT RUN. THE GHOST IS DEAD.';
        el.resultBanner.className = 'result-banner win';
        playVictoryFanfare();
      } else if (playerStats.timeMs <= ghostStats.timeMs) {
        el.resultBanner.textContent = 'YOU BEAT THE GHOST';
        el.resultBanner.className = 'result-banner win';
        playVictoryFanfare();
      } else {
        el.resultBanner.textContent = 'THE GHOST GOT YOU';
        el.resultBanner.className = 'result-banner lose';
        playDefeatChime();
      }
    } else {
      el.statCardGhost.classList.add('hidden');
      el.resultBanner.textContent = playerStats.accuracy === 100 ? 'PERFECT RUN. GHOST RECORDED.' : 'GHOST RECORDED';
      el.resultBanner.className = 'result-banner recorded';
      if (playerStats.accuracy === 100) playVictoryFanfare();
    }

    updateLobbyState();
    drawVelocityChart(playerStats);
  }

  function copyResultCard() {
    const wpm = el.statPWpm.textContent;
    const acc = el.statPAcc.textContent;
    const time = el.statPTime.textContent;
    const tier = el.speedTierBadge.textContent;
    const banner = el.resultBanner.textContent;

    let text = `⚡ SYNTAX//RUSH SCORECARD ⚡\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🏎️ Speed: ${wpm} WPM | Acc: ${acc} | Time: ${time}\n`;
    text += `🎖️ Tier: ${tier}\n`;
    text += `🏆 Outcome: ${banner}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Play now: github.com/faheem/typing-battle`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = el.btnCopyCard.innerHTML;
        el.btnCopyCard.innerHTML = `<span class="btn-icon">✨</span> Copied to Clipboard!`;
        setTimeout(() => { el.btnCopyCard.innerHTML = orig; }, 2000);
      });
    }
  }

  function drawVelocityChart(playerStats) {
    const canvas = el.velocityChart;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    const datasets = [];
    if (wpmHistory.length > 1) {
      datasets.push({ points: wpmHistory, color: '#00F2FE', label: 'YOU' });
    }
    if (mode === 'race' && ghostData && ghostData.wpmHistory && ghostData.wpmHistory.length > 1) {
      datasets.push({ points: ghostData.wpmHistory, color: '#FF007F', label: 'GHOST' });
    }
    if (mode === 'online' && opponentWpmHistory.length > 1) {
      datasets.push({ points: opponentWpmHistory, color: '#FF007F', label: 'RIVAL' });
    }

    if (datasets.length === 0) {
      ctx.fillStyle = '#71717A';
      ctx.font = '14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough data for velocity chart', W / 2, H / 2);
      return;
    }

    let maxMs = 0, maxWpm = 0;
    datasets.forEach(ds => {
      ds.points.forEach(p => {
        if (p.ms > maxMs) maxMs = p.ms;
        if (p.wpm > maxWpm) maxWpm = p.wpm;
      });
    });
    maxWpm = Math.max(maxWpm, 20);

    ctx.strokeStyle = '#2A2E42';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#71717A';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const val = Math.round(maxWpm * (1 - i / 4));
      ctx.fillText(val, pad.left - 8, y + 4);
    }

    datasets.forEach(ds => {
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      const step = Math.max(1, Math.floor(ds.points.length / 60));
      let first = true;
      for (let i = 0; i < ds.points.length; i += step) {
        const p = ds.points[i];
        const x = pad.left + (p.ms / maxMs) * plotW;
        const y = pad.top + plotH - (p.wpm / maxWpm) * plotH;
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      const last = ds.points[ds.points.length - 1];
      ctx.lineTo(pad.left + (last.ms / maxMs) * plotW, pad.top + plotH - (last.wpm / maxWpm) * plotH);
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = ds.color;
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ds.label, pad.left + 6, pad.top + (datasets.indexOf(ds) === 0 ? 14 : 28));
    });

    ctx.fillStyle = '#71717A';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', pad.left + plotW / 2, H - 6);
  }

  // ══════════════════════════════════════════════════════
  // Pause/Resume & Visibility
  // ══════════════════════════════════════════════════════
  let pauseStart = 0;

  document.addEventListener('visibilitychange', () => {
    if (!startTime || mode === null || isExploding) return;
    if (charIndex >= paragraph.length) return;

    if (document.hidden) {
      isPaused = true;
      pauseStart = performance.now();
      el.pauseOverlay.classList.remove('hidden');
    }
  });

  el.pauseOverlay.addEventListener('click', () => {
    if (!isPaused) return;
    pauseOffset += performance.now() - pauseStart;
    isPaused = false;
    el.pauseOverlay.classList.add('hidden');
    el.hiddenInput.focus();
    timerRAF = requestAnimationFrame(timerTick);
    if (mode === 'race') startGhostReplay();
  });

  document.querySelector('.text-container')?.addEventListener('click', () => {
    el.hiddenInput.focus();
  });

  el.hiddenInput.addEventListener('paste', e => e.preventDefault());

  // ══════════════════════════════════════════════════════
  // Event Bindings
  // ══════════════════════════════════════════════════════
  el.btnSetGhost.addEventListener('click', () => startRace('record'));
  el.btnRaceGhost.addEventListener('click', () => { if (!el.btnRaceGhost.disabled) startRace('race'); });
  el.btnOnlineDuel.addEventListener('click', handleRankedDuelClick);
  el.btnCustomRoom.addEventListener('click', openCustomRoomModal);
  el.btnCloseCustomRoom.addEventListener('click', cancelMatchmaking);
  el.tabCreateRoom.addEventListener('click', () => switchRoomTab('create'));
  el.tabJoinRoom.addEventListener('click', () => switchRoomTab('join'));
  el.btnCopyCode.addEventListener('click', copyRoomCode);
  el.btnCopyLink.addEventListener('click', copyRoomLink);
  el.btnJoinRoomSubmit.addEventListener('click', () => joinCustomRoom());
  el.inputRoomCode.addEventListener('keydown', e => { if (e.key === 'Enter') joinCustomRoom(); });
  el.btnCancelMatch.addEventListener('click', cancelMatchmaking);
  el.btnDemoSignin.addEventListener('click', handleDemoSignin);
  el.btnOpenLeaderboard.addEventListener('click', openLeaderboard);
  el.btnCloseLeaderboard.addEventListener('click', () => el.leaderboardModal.classList.add('hidden'));
  el.tabLeaderboardRankings.addEventListener('click', () => switchLeaderboardTab('rankings'));
  el.tabLeaderboardHistory.addEventListener('click', () => switchLeaderboardTab('history'));
  el.leaderboardModal.addEventListener('click', (e) => {
    if (e.target === el.leaderboardModal) el.leaderboardModal.classList.add('hidden');
  });
  el.customRoomModal.addEventListener('click', (e) => {
    if (e.target === el.customRoomModal) cancelMatchmaking();
  });
  el.authModal.addEventListener('click', (e) => {
    if (e.target === el.authModal) el.authModal.classList.add('hidden');
  });
  el.profilePill.addEventListener('click', handleProfilePillClick);
  el.btnNewGhost.addEventListener('click', () => startRace('record'));
  el.btnRaceAgain.addEventListener('click', () => { if (!el.btnRaceAgain.disabled) startRace('race'); });
  el.btnBackLobby.addEventListener('click', () => { updateLobbyState(); switchScreen('lobby'); });
  el.btnAudioToggle.addEventListener('click', toggleAudio);
  el.btnCopyCard.addEventListener('click', copyResultCard);

  // Keyboard Shortcuts
  document.addEventListener('keydown', e => {
    if (screens.arena.classList.contains('active')) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (screens.lobby.classList.contains('active')) {
        startRace('record');
      } else if (screens.results.classList.contains('active') && !el.btnRaceAgain.disabled) {
        startRace('race');
      }
    }
    if (e.code === 'Enter' && screens.lobby.classList.contains('active') && !el.btnRaceGhost.disabled) {
      e.preventDefault();
      startRace('race');
    }
    if ((e.key === 'm' || e.key === 'M') && screens.lobby.classList.contains('active')) {
      e.preventDefault();
      handleRankedDuelClick();
    }
    if ((e.key === 'c' || e.key === 'C') && screens.lobby.classList.contains('active')) {
      e.preventDefault();
      openCustomRoomModal();
    }
    if ((e.key === 'v' || e.key === 'V') && screens.lobby.classList.contains('active')) {
      e.preventDefault();
      const mockRival = { username: 'CYBER VIPER', avatar_url: 'miku.gif', mmr: 610, best_wpm: 88 };
      showVsClashScreen(mockRival, () => {
        switchScreen('lobby');
      });
    }
    if (e.key === 'Tab' && screens.results.classList.contains('active')) {
      e.preventDefault();
      startRace('record');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      el.authModal.classList.add('hidden');
      el.leaderboardModal.classList.add('hidden');
      el.customRoomModal.classList.add('hidden');
      cancelMatchmaking();
      updateLobbyState();
      switchScreen('lobby');
    }
  });

  // ══════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════
  async function init() {
    try {
      isMuted = localStorage.getItem('typeghost_muted') === 'true';
    } catch (e) { }
    updateAudioUI();

    try {
      const savedUser = localStorage.getItem('syntax_user');
      if (savedUser) currentUser = JSON.parse(savedUser);
    } catch (e) { }
    updateProfileUI();

    try {
      const authConfigRes = await fetch('/api/auth/config');
      const authConfig = await authConfigRes.json();
      googleClientId = authConfig.googleClientId;

      if (googleClientId && window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse
        });
        window.google.accounts.id.renderButton(
          el.googleBtnContainer,
          { theme: 'filled_black', size: 'large', shape: 'pill', width: 240 }
        );
      }
    } catch (e) { }

    try {
      const res = await fetch('quotes.json');
      quotes = await res.json();
    } catch (e) {
      quotes = [
        { text: "The best code is no code at all Every new line of code you bring into the world is code that has to be debugged", source: "Jeff Atwood" },
        { text: "Any fool can write code that a computer can understand Good programmers write code that humans can understand", source: "Martin Fowler" },
        { text: "First solve the problem Then write the code If you spend too long on the second step you skipped the first", source: "John Johnson" },
        { text: "Simplicity is prerequisite for reliability If you cannot explain it simply you do not understand it well enough", source: "Edsger Dijkstra" },
        { text: "Talk is cheap Show me the code Make sure that code is clean fast and does exactly what it needs to do", source: "Linus Torvalds" },
      ];
    }
    updateLobbyState();

    // Auto-join if ?room=CODE in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      el.customRoomModal.classList.remove('hidden');
      switchRoomTab('join');
      el.inputRoomCode.value = roomParam.toUpperCase();
      joinCustomRoom(roomParam);
    }
  }

  init();
})();
