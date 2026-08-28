/* ══════════════════════════════════════════════════════════
   TYPE//GHOST — App Engine
   Universal Laptop-Tuned Thock, Pac-Man In-line Caret, Space Preserving, Minesweeper Chain Blast
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM Refs ───
  const $ = id => document.getElementById(id);
  const screens = { lobby: $('lobby'), arena: $('arena'), results: $('results') };
  const el = {
    btnSetGhost:     $('btn-set-ghost'),
    btnRaceGhost:    $('btn-race-ghost'),
    ghostPreview:    $('ghost-preview'),
    gpWpm:           $('ghost-preview-wpm'),
    gpAcc:           $('ghost-preview-acc'),
    gpTime:          $('ghost-preview-time'),
    countdown:       $('countdown'),
    countdownNum:    $('countdown-num'),
    pauseOverlay:    $('pause-overlay'),
    modeBadge:       $('mode-badge'),
    btnAudioToggle:  $('btn-audio-toggle'),
    audioToggleIcon: $('audio-toggle-icon'),
    audioToggleText: $('audio-toggle-text'),
    textDisplay:     $('text-display'),
    hudWpm:          $('hud-wpm'),
    hudTime:         $('hud-time'),
    hudAcc:          $('hud-acc'),
    progressPlayer:  $('progress-player'),
    progressGhost:   $('progress-ghost'),
    ghostRow:        $('ghost-progress-row'),
    hiddenInput:     $('hidden-input'),
    resultBanner:    $('result-banner'),
    speedTierBadge:  $('speed-tier-badge'),
    statPWpm:        $('stat-p-wpm'),
    statPAcc:        $('stat-p-acc'),
    statPTime:       $('stat-p-time'),
    statPCons:       $('stat-p-cons'),
    statCardGhost:   $('stat-card-ghost'),
    statGWpm:        $('stat-g-wpm'),
    statGAcc:        $('stat-g-acc'),
    statGTime:       $('stat-g-time'),
    statDelta:       $('stat-delta'),
    velocityChart:   $('velocity-chart'),
    btnCopyCard:     $('btn-copy-card'),
    btnNewGhost:     $('btn-new-ghost'),
    btnRaceAgain:    $('btn-race-again'),
    btnBackLobby:    $('btn-back-lobby'),
    btnOnlineDuel:   $('btn-online-duel'),
    matchmakingModal:$('matchmaking-modal'),
    matchmakingStatus:$('matchmaking-status'),
    btnCancelMatch:  $('btn-cancel-match'),
  };

  // ─── State ───
  let quotes = [];
  let mode = null;          // 'record' | 'race' | 'online'
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

  function toggleAudio() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('typeghost_muted', isMuted ? 'true' : 'false');
    } catch (e) {}
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
        bgVideo.play().catch(() => {});
      } else {
        bgVideo.pause();
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
    } catch (e) {}
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
    for (let i = 0; i < paragraph.length; i++) {
      const span = document.createElement('span');
      const isSpace = paragraph[i] === ' ';
      span.className = 'char' + (isSpace ? ' space' : '') + (i === 0 ? ' current' : ' untyped');
      span.textContent = paragraph[i];
      span.dataset.idx = i;
      el.textDisplay.appendChild(span);
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
    if (wpm >= 90)  return '🔥 GHOST SLAYER';
    if (wpm >= 70)  return '⚡ KEYBOARD ATHLETE';
    if (wpm >= 50)  return '🔵 DAILY DRIVER';
    if (wpm >= 30)  return '🟡 LEARNING THE ROPES';
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
    } else {
      chars[charIndex].className = 'char wrong' + (isCharSpace ? ' space' : '');
      errors++;
      streak = 0;
      playError();
    }

    // Streak glow
    if (streak >= 15) {
      el.textDisplay.classList.add('streak');
    } else {
      el.textDisplay.classList.remove('streak');
    }

    const ms = performance.now() - startTime - pauseOffset;
    recordTimeline.push({ charIndex, ms, correct });
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

    updateHUD();

    // Finish reached? Trigger Minesweeper explosion!
    if (charIndex >= paragraph.length) {
      finishRace();
    }
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
  // Live 1v1 Multiplayer Engine (WebSockets)
  // ══════════════════════════════════════════════════════
  function startMatchmaking() {
    isOnlineMatch = true;
    onlineOpponentStats = null;
    onlineOpponentFinished = false;
    opponentWpmHistory = [];

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:3000';
    
    try {
      ws = new WebSocket(`${protocol}//${host}`);
    } catch (e) {
      alert('Could not connect to multiplayer relay server. Make sure server.js is running!');
      return;
    }

    el.matchmakingModal.classList.remove('hidden');
    el.matchmakingStatus.textContent = 'Connecting to relay server...';

    ws.onopen = () => {
      el.matchmakingStatus.textContent = 'Searching for live rival...';
      ws.send(JSON.stringify({ type: 'FIND_MATCH' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'WAITING') {
          el.matchmakingStatus.textContent = 'Waiting for an opponent to join...';
        } else if (data.type === 'MATCH_START') {
          el.matchmakingModal.classList.add('hidden');
          paragraph = data.paragraph;
          startOnlineRace();
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
        } else if (data.type === 'OPPONENT_DISCONNECTED') {
          if (screens.arena.classList.contains('active')) {
            onlineOpponentFinished = true;
            onlineOpponentStats = { wpm: 0, accuracy: 0, timeMs: 999999 };
            el.resultBanner.textContent = 'RIVAL DISCONNECTED — FORFEIT WIN!';
            el.resultBanner.className = 'result-banner win';
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onerror = () => {
      el.matchmakingStatus.textContent = 'Multiplayer server offline. Run "npm start"!';
    };

    ws.onclose = () => {
      if (!screens.arena.classList.contains('active') && !screens.results.classList.contains('active')) {
        el.matchmakingModal.classList.add('hidden');
      }
    };
  }

  function cancelMatchmaking() {
    if (ws) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'CANCEL_QUEUE' }));
      ws.close();
    }
    el.matchmakingModal.classList.add('hidden');
    isOnlineMatch = false;
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

    startCountdown(() => {
      startTime = performance.now();
      timerRAF = requestAnimationFrame(timerTick);

      el.hiddenInput.value = '';
      el.hiddenInput.focus();
      el.hiddenInput.addEventListener('keydown', handleKeystroke);
    });
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
      } else if (playerStats.timeMs <= ghostStats.timeMs) {
        el.resultBanner.textContent = 'YOU BEAT THE GHOST';
        el.resultBanner.className = 'result-banner win';
      } else {
        el.resultBanner.textContent = 'THE GHOST GOT YOU';
        el.resultBanner.className = 'result-banner lose';
      }
    } else {
      el.statCardGhost.classList.add('hidden');
      el.resultBanner.textContent = playerStats.accuracy === 100 ? 'PERFECT RUN. GHOST RECORDED.' : 'GHOST RECORDED';
      el.resultBanner.className = 'result-banner recorded';
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
  el.btnOnlineDuel.addEventListener('click', startMatchmaking);
  el.btnCancelMatch.addEventListener('click', cancelMatchmaking);
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
      startMatchmaking();
    }
    if (e.key === 'Tab' && screens.results.classList.contains('active')) {
      e.preventDefault();
      startRace('record');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
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
    } catch (e) {}
    updateAudioUI();

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
  }

  init();
})();
