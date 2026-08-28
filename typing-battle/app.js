/* ══════════════════════════════════════════════════════════
   TYPE//GHOST — App Engine
   Keystroke validation, Ghost record/replay, Web Audio, Telemetry
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM Refs ───
  const $ = id => document.getElementById(id);
  const screens = { lobby: $('lobby'), arena: $('arena'), results: $('results') };
  const el = {
    btnSetGhost:    $('btn-set-ghost'),
    btnRaceGhost:   $('btn-race-ghost'),
    ghostPreview:   $('ghost-preview'),
    gpWpm:          $('ghost-preview-wpm'),
    gpAcc:          $('ghost-preview-acc'),
    gpTime:         $('ghost-preview-time'),
    countdown:      $('countdown'),
    countdownNum:   $('countdown-num'),
    pauseOverlay:   $('pause-overlay'),
    modeBadge:      $('mode-badge'),
    textDisplay:    $('text-display'),
    hudWpm:         $('hud-wpm'),
    hudTime:        $('hud-time'),
    hudAcc:         $('hud-acc'),
    progressPlayer: $('progress-player'),
    progressGhost:  $('progress-ghost'),
    ghostRow:       $('ghost-progress-row'),
    hiddenInput:    $('hidden-input'),
    resultBanner:   $('result-banner'),
    statPWpm:       $('stat-p-wpm'),
    statPAcc:       $('stat-p-acc'),
    statPTime:      $('stat-p-time'),
    statCardGhost:  $('stat-card-ghost'),
    statGWpm:       $('stat-g-wpm'),
    statGAcc:       $('stat-g-acc'),
    statGTime:      $('stat-g-time'),
    statDelta:      $('stat-delta'),
    velocityChart:  $('velocity-chart'),
    btnNewGhost:    $('btn-new-ghost'),
    btnRaceAgain:   $('btn-race-again'),
    btnBackLobby:   $('btn-back-lobby'),
  };

  // ─── State ───
  let quotes = [];
  let mode = null;          // 'record' | 'race'
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

  // Ghost data
  let ghostTimeline = [];   // [{ charIndex, ms, correct }]
  let recordTimeline = [];
  let ghostData = null;     // saved ghost { paragraph, timeline, stats }
  let ghostRAF = null;
  let ghostIdx = 0;

  // ══════════════════════════════════════════════════════
  // Audio Engine (Web Audio API — zero files)
  // ══════════════════════════════════════════════════════
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function playClick() {
    ensureAudio();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.008, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4000;
    filter.Q.value = 1.2;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.15;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  }

  function playError() {
    ensureAudio();
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.012, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.2;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  }

  function playBeep(freq = 880, dur = 0.08) {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  // ══════════════════════════════════════════════════════
  // State Manager
  // ══════════════════════════════════════════════════════
  function switchScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
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
    } catch (e) { /* localStorage full or disabled — silent fail */ }
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
  // Race Engine
  // ══════════════════════════════════════════════════════
  function pickParagraph() {
    return quotes[Math.floor(Math.random() * quotes.length)].text;
  }

  function renderText() {
    el.textDisplay.innerHTML = '';
    for (let i = 0; i < paragraph.length; i++) {
      const span = document.createElement('span');
      span.className = 'char' + (i === 0 ? ' current' : ' untyped');
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
    if (isPaused) return;
    elapsedMs = performance.now() - startTime - pauseOffset;
    updateHUD();
    timerRAF = requestAnimationFrame(timerTick);
  }

  function handleKeystroke(e) {
    // Ignore modifier keys, tab, escape, etc
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Tab' || e.key === 'Escape') return;
    if (charIndex >= paragraph.length) return;
    if (isPaused) return;

    const chars = getChars();

    // Backspace
    if (e.key === 'Backspace') {
      if (charIndex > 0) {
        chars[charIndex].className = 'char untyped';
        charIndex--;
        chars[charIndex].className = 'char current';
        // ponytail: not decrementing totalTyped/errors on backspace — net WPM stays honest
      }
      return;
    }

    // Only accept single printable characters
    if (e.key.length !== 1) return;

    e.preventDefault();
    totalTyped++;

    const expected = paragraph[charIndex];
    const correct = e.key === expected;

    if (correct) {
      chars[charIndex].className = 'char correct';
      streak++;
      playClick();
    } else {
      chars[charIndex].className = 'char wrong';
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

    // Record timeline
    const ms = performance.now() - startTime - pauseOffset;
    recordTimeline.push({ charIndex, ms, correct });

    // WPM history for velocity chart
    const wpm = calcWPM();
    wpmHistory.push({ ms, wpm });

    charIndex++;

    // Mark next char as current
    if (charIndex < paragraph.length) {
      chars[charIndex].className = 'char current';
    }

    updateHUD();

    // Finished?
    if (charIndex >= paragraph.length) {
      finishRace();
    }
  }

  function finishRace() {
    cancelAnimationFrame(timerRAF);
    if (ghostRAF) cancelAnimationFrame(ghostRAF);
    elapsedMs = performance.now() - startTime - pauseOffset;

    const stats = {
      wpm: calcWPM(),
      accuracy: calcAccuracy(),
      timeMs: Math.round(elapsedMs),
    };

    el.hiddenInput.removeEventListener('keydown', handleKeystroke);
    el.hiddenInput.blur();

    if (mode === 'record') {
      // Save ghost
      const data = { paragraph, timeline: recordTimeline, stats, wpmHistory };
      saveGhostToStorage(data);
      ghostData = data;
      showResults(stats, null);
    } else {
      // Compare against ghost
      showResults(stats, ghostData.stats);
    }
  }

  // ══════════════════════════════════════════════════════
  // Ghost Replayer
  // ══════════════════════════════════════════════════════
  function startGhostReplay() {
    if (!ghostData) return;
    ghostTimeline = ghostData.timeline;
    ghostIdx = 0;
    el.ghostRow.classList.remove('hidden');
    el.progressGhost.style.width = '0%';

    const chars = getChars();
    function ghostTick() {
      const now = performance.now() - startTime - pauseOffset;
      while (ghostIdx < ghostTimeline.length && ghostTimeline[ghostIdx].ms <= now) {
        // Move ghost position
        const gi = ghostTimeline[ghostIdx].charIndex;
        // Remove previous ghost cursor
        chars.forEach(c => c.classList.remove('ghost-cursor'));
        // Set new ghost cursor (next char)
        if (gi + 1 < paragraph.length) {
          chars[gi + 1].classList.add('ghost-cursor');
        }
        ghostIdx++;
        // Update ghost progress
        el.progressGhost.style.width = ((ghostIdx / paragraph.length) * 100) + '%';
      }

      if (ghostIdx < ghostTimeline.length) {
        ghostRAF = requestAnimationFrame(ghostTick);
      } else {
        // Ghost finished
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
    void el.countdownNum.offsetWidth; // reflow
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
    }, 700);
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
    wpmHistory = [];
    recordTimeline = [];
    ghostIdx = 0;

    // Pick paragraph
    if (mode === 'race' && ghostData) {
      paragraph = ghostData.paragraph;
    } else {
      paragraph = pickParagraph();
    }

    // Setup arena
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

      // Focus hidden input
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

    // Player stats
    el.statPWpm.textContent = playerStats.wpm;
    el.statPAcc.textContent = playerStats.accuracy + '%';
    el.statPTime.textContent = (playerStats.timeMs / 1000).toFixed(1) + 's';

    if (ghostStats && mode === 'race') {
      // Ghost comparison mode
      el.statCardGhost.classList.remove('hidden');
      el.statGWpm.textContent = ghostStats.wpm;
      el.statGAcc.textContent = ghostStats.accuracy + '%';
      el.statGTime.textContent = (ghostStats.timeMs / 1000).toFixed(1) + 's';

      const deltaMs = playerStats.timeMs - ghostStats.timeMs;
      const deltaSec = (deltaMs / 1000).toFixed(1);
      el.statDelta.textContent = (deltaMs >= 0 ? '+' : '') + deltaSec + 's';

      if (playerStats.timeMs <= ghostStats.timeMs) {
        el.resultBanner.textContent = 'YOU BEAT THE GHOST';
        el.resultBanner.className = 'result-banner win';
      } else {
        el.resultBanner.textContent = 'THE GHOST GOT YOU';
        el.resultBanner.className = 'result-banner lose';
      }
    } else {
      // Recording mode
      el.statCardGhost.classList.add('hidden');
      el.resultBanner.textContent = 'GHOST RECORDED';
      el.resultBanner.className = 'result-banner recorded';
    }

    updateLobbyState();
    drawVelocityChart(playerStats);
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

    // Clear
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 30, left: 45 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Determine datasets
    const datasets = [];
    if (wpmHistory.length > 1) {
      datasets.push({ points: wpmHistory, color: '#00F2FE', label: 'YOU' });
    }
    if (mode === 'race' && ghostData && ghostData.wpmHistory && ghostData.wpmHistory.length > 1) {
      datasets.push({ points: ghostData.wpmHistory, color: '#FFB300', label: 'GHOST' });
    }

    if (datasets.length === 0) {
      ctx.fillStyle = '#71717A';
      ctx.font = '14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough data for velocity chart', W / 2, H / 2);
      return;
    }

    // Find ranges
    let maxMs = 0, maxWpm = 0;
    datasets.forEach(ds => {
      ds.points.forEach(p => {
        if (p.ms > maxMs) maxMs = p.ms;
        if (p.wpm > maxWpm) maxWpm = p.wpm;
      });
    });
    maxWpm = Math.max(maxWpm, 20); // floor

    // Grid lines
    ctx.strokeStyle = '#2A2E42';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = '#71717A';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      const val = Math.round(maxWpm * (1 - i / 4));
      ctx.fillText(val, pad.left - 8, y + 4);
    }

    // Draw lines
    datasets.forEach(ds => {
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      // Smooth: sample every ~20 points to avoid noise
      const step = Math.max(1, Math.floor(ds.points.length / 60));
      let first = true;
      for (let i = 0; i < ds.points.length; i += step) {
        const p = ds.points[i];
        const x = pad.left + (p.ms / maxMs) * plotW;
        const y = pad.top + plotH - (p.wpm / maxWpm) * plotH;
        if (first) { ctx.moveTo(x, y); first = false; }
        else ctx.lineTo(x, y);
      }
      // Always include last point
      const last = ds.points[ds.points.length - 1];
      ctx.lineTo(pad.left + (last.ms / maxMs) * plotW, pad.top + plotH - (last.wpm / maxWpm) * plotH);
      ctx.stroke();

      // Glow
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Label
      ctx.fillStyle = ds.color;
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ds.label, pad.left + 6, pad.top + (datasets.indexOf(ds) === 0 ? 14 : 28));
    });

    // X axis label
    ctx.fillStyle = '#71717A';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', pad.left + plotW / 2, H - 6);
  }

  // ══════════════════════════════════════════════════════
  // Pause/Resume on visibility
  // ══════════════════════════════════════════════════════
  let pauseStart = 0;

  document.addEventListener('visibilitychange', () => {
    if (!startTime || mode === null) return;
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

  // Click on text area to refocus input
  document.querySelector('.text-container')?.addEventListener('click', () => {
    el.hiddenInput.focus();
  });

  // Block paste
  el.hiddenInput.addEventListener('paste', e => e.preventDefault());

  // ══════════════════════════════════════════════════════
  // Event Bindings
  // ══════════════════════════════════════════════════════
  el.btnSetGhost.addEventListener('click', () => startRace('record'));
  el.btnRaceGhost.addEventListener('click', () => { if (!el.btnRaceGhost.disabled) startRace('race'); });
  el.btnNewGhost.addEventListener('click', () => startRace('record'));
  el.btnRaceAgain.addEventListener('click', () => { if (!el.btnRaceAgain.disabled) startRace('race'); });
  el.btnBackLobby.addEventListener('click', () => { updateLobbyState(); switchScreen('lobby'); });

  // Global keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Only on lobby or results screens
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
    if (e.key === 'Tab' && screens.results.classList.contains('active')) {
      e.preventDefault();
      startRace('record');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      updateLobbyState();
      switchScreen('lobby');
    }
  });

  // ══════════════════════════════════════════════════════
  // Init
  // ══════════════════════════════════════════════════════
  async function init() {
    try {
      const res = await fetch('quotes.json');
      quotes = await res.json();
    } catch (e) {
      // Fallback if fetch fails (e.g., file:// protocol)
      quotes = [
        { text: "The best code is no code at all. Every new line of code you willingly bring into the world is code that has to be debugged and maintained.", source: "Jeff Atwood" },
        { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", source: "Martin Fowler" },
        { text: "First, solve the problem. Then, write the code. If you spend too long on the second step, you probably skipped the first.", source: "John Johnson" },
        { text: "Simplicity is prerequisite for reliability. If you cannot explain it simply, you do not understand it well enough to build it.", source: "Edsger Dijkstra" },
        { text: "Talk is cheap. Show me the code. And make sure that code is clean, tested, and does exactly what it needs to do.", source: "Linus Torvalds" },
      ];
    }
    updateLobbyState();
  }

  init();
})();
