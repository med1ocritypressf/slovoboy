(() => {
  'use strict';

  const D = DATA;
  const W = 480;
  const H = 270;
  const TOTAL_WAVES = D.WAVES.length;
  const MAX_UPGRADE_WAVE = 10;
  const FONT_STACK = "'Roboto Mono', 'Consolas', 'Courier New', monospace";
  const BASE = { x: 240, y: 135, r: 24 };
  const SAFE_TOP = 34;
  const SAFE_BOTTOM = 212;
  const MAX_ENEMIES = 12;
  const MAX_TOTAL_ENEMIES = 14;

  const $ = (id) => document.getElementById(id);

  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const dom = {
    stage: $('gameStage'),
    hud: $('hud'),
    waveValue: $('waveValue'),
    waveModTag: $('waveModTag'),
    scoreValue: $('scoreValue'),
    hpLabel: $('hpLabel'),
    hpFill: $('hpFill'),
    shieldLabel: $('shieldLabel'),
    comboValue: $('comboValue'),
    tokensValue: $('tokensValue'),
    bossBar: $('bossBar'),
    bossName: $('bossName'),
    bossPips: $('bossPips'),
    bossPhrase: $('bossPhrase'),
    targetName: $('targetName'),
    targetHint: $('targetHint'),
    targetWord: $('targetWord'),
    bufferText: $('bufferText'),
    killsValue: $('killsValue'),
    enemiesValue: $('enemiesValue'),
    waveBanner: $('waveBanner'),
    toast: $('toast'),
    flash: $('flash'),
    menuScreen: $('menuScreen'),
    difficultyPicker: $('difficultyPicker'),
    startBtn: $('startBtn'),
    helpBtn: $('helpBtn'),
    menuSoundBtn: $('menuSoundBtn'),
    menuFullscreenBtn: $('menuFullscreenBtn'),
    bestScore: $('bestScore'),
    helpScreen: $('helpScreen'),
    helpCloseBtn: $('helpCloseBtn'),
    upgradeScreen: $('upgradeScreen'),
    upgradeWave: $('upgradeWave'),
    upgradeTokens: $('upgradeTokens'),
    cards: $('cards'),
    rerollBtn: $('rerollBtn'),
    skipBtn: $('skipBtn'),
    pauseScreen: $('pauseScreen'),
    pauseStats: $('pauseStats'),
    resumeBtn: $('resumeBtn'),
    pauseHelpBtn: $('pauseHelpBtn'),
    restartBtn: $('restartBtn'),
    pauseMenuBtn: $('pauseMenuBtn'),
    pauseSoundBtn: $('pauseSoundBtn'),
    pauseShakeBtn: $('pauseShakeBtn'),
    pauseMotionBtn: $('pauseMotionBtn'),
    pauseFullscreenBtn: $('pauseFullscreenBtn'),
    endScreen: $('endScreen'),
    endEyebrow: $('endEyebrow'),
    endTitle: $('endTitle'),
    endSubtitle: $('endSubtitle'),
    endStats: $('endStats'),
    endBuild: $('endBuild'),
    againBtn: $('againBtn'),
    endMenuBtn: $('endMenuBtn')
  };

  const screens = [
    dom.menuScreen,
    dom.helpScreen,
    dom.upgradeScreen,
    dom.pauseScreen,
    dom.endScreen
  ];

  // ------------------------------------------------------------------
  // Утилиты
  // ------------------------------------------------------------------

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function makeRng(seed) {
    let s = seed >>> 0;
    return function random() {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(rng, arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function formatNum(n) {
    return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function editionForWave(wave) {
    return D.EDITIONS[Math.max(0, Math.min(D.EDITIONS.length - 1, Math.floor((wave - 1) / 5)))] || D.EDITIONS[0];
  }

  function waveModifier(wave) {
    const wd = D.WAVES[wave - 1];
    return wd && wd.mod ? D.WAVE_MODIFIERS[wd.mod] || null : null;
  }

  function shouldOfferUpgrade(wave) {
    if (wave >= TOTAL_WAVES) return false;
    if (wave <= MAX_UPGRADE_WAVE) return true;
    return wave % 5 === 0 || wave % 2 === 0;
  }

  function waveSpeedScale(wave) {
    const capped = Math.min(20, wave);
    return 1 + 0.035 * (capped - 1) + Math.max(0, wave - 20) * 0.01;
  }

  function bossSpeedScale(wave) {
    const capped = Math.min(20, wave);
    return 1 + 0.025 * (capped - 1) + Math.max(0, wave - 20) * 0.012;
  }

  function spawnModFactor() {
    if (!run || run.waveMod !== 'rush') return 1;
    return run.diff.id === 'easy' ? 0.92 : 0.85;
  }

  function redMarkBoost() {
    return run && run.diff.id === 'easy' ? 1.05 : 1.1;
  }

  function dryHealFactor() {
    return run && run.diff.id === 'easy' ? 0.75 : 0.5;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Игра остаётся играбельной без localStorage.
    }
  }

  // ------------------------------------------------------------------
  // Настройки и рекорд
  // ------------------------------------------------------------------

  const SETTINGS_KEY = 'slovoboy_settings_v1';
  const BEST_KEY = 'slovoboy_best_v1';

  const settings = Object.assign(
    { sound: true, shake: true, motion: true },
    loadJson(SETTINGS_KEY, {})
  );

  let bestScore = Number(loadJson(BEST_KEY, 0)) || 0;
  let selectedDiff = 'normal';
  let helpReturn = 'menu';

  // ------------------------------------------------------------------
  // Звук: процедурный чиптюн без внешних файлов
  // ------------------------------------------------------------------

  const AudioSys = {
    ctx: null,
    master: null,
    sfxGain: null,
    musicGain: null,
    musicTimer: null,
    step: 0,
    nextNote: 0,
    enabled: true,
    musicOn: false,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.24;
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null;
      }
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    },

    setEnabled(value) {
      this.enabled = !!value;
      if (!this.ctx) return;
      if (this.enabled) {
        this.resume();
      } else {
        this.stopMusic();
      }
    },

    tone(freq, duration, type = 'square', volume = 0.025, slide = 0, destination = null) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), now + duration);
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(destination || this.sfxGain);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },

    noise(duration = 0.08, volume = 0.03, freq = 900) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      source.start(now);
    },

    key(index = 0) {
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 987.77];
      const freq = scale[index % scale.length];
      this.tone(freq, 0.045, 'square', 0.012, 0);
    },

    soft() {
      this.tone(220, 0.04, 'triangle', 0.008, -20);
    },

    error() {
      this.tone(110, 0.12, 'sawtooth', 0.035, -40);
      this.noise(0.06, 0.02, 300);
    },

    kill() {
      this.tone(659.25, 0.08, 'square', 0.035, 120);
      setTimeout(() => this.tone(987.77, 0.11, 'square', 0.025, 60), 35);
      this.noise(0.08, 0.015, 2200);
    },

    shieldBreak() {
      this.tone(300, 0.08, 'triangle', 0.03, 120);
      this.noise(0.07, 0.02, 1500);
    },

    shield() {
      this.tone(440, 0.1, 'sine', 0.025, 220);
    },

    hit() {
      this.tone(70, 0.2, 'sawtooth', 0.05, -25);
      this.noise(0.12, 0.035, 220);
    },

    heal() {
      this.tone(523.25, 0.1, 'sine', 0.02, 180);
    },

    wave() {
      this.tone(196, 0.12, 'triangle', 0.03, 30);
      setTimeout(() => this.tone(293.66, 0.16, 'triangle', 0.025, 40), 80);
    },

    waveClear() {
      [392, 493.88, 587.33, 783.99].forEach((f, i) => {
        setTimeout(() => this.tone(f, 0.16, 'square', 0.022, 0), i * 70);
      });
    },

    upgrade() {
      this.tone(392, 0.07, 'square', 0.025, 60);
      setTimeout(() => this.tone(587.33, 0.12, 'square', 0.025, 80), 55);
    },

    boss() {
      this.tone(73.42, 0.8, 'sawtooth', 0.05, -10);
      this.tone(110, 0.6, 'triangle', 0.035, 0);
      this.noise(0.5, 0.02, 180);
    },

    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        setTimeout(() => this.tone(f, 0.22, 'square', 0.035, 0), i * 120);
      });
    },

    defeat() {
      [293.66, 246.94, 196, 146.83].forEach((f, i) => {
        setTimeout(() => this.tone(f, 0.3, 'triangle', 0.035, -10), i * 170);
      });
    },

    startMusic() {
      this.init();
      if (!this.enabled || !this.ctx) return;
      this.resume();
      if (this.musicTimer) return;
      this.musicOn = true;
      this.step = 0;
      this.nextNote = this.ctx.currentTime + 0.08;
      this.musicTimer = setInterval(() => this.scheduleMusic(), 40);
    },

    stopMusic() {
      this.musicOn = false;
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    },

    setMusicVolume(value) {
      if (this.musicGain) {
        this.musicGain.gain.value = value;
      }
    },

    scheduleMusic() {
      if (!this.ctx || !this.musicOn || !this.enabled) return;
      if (this.nextNote < this.ctx.currentTime - 0.5) {
        this.nextNote = this.ctx.currentTime + 0.05;
      }
      const bass = [110, 110, 146.83, 110, 98, 98, 130.81, 98];
      const arp = [220, 261.63, 329.63, 392, 329.63, 261.63, 246.94, 293.66];
      while (this.nextNote < this.ctx.currentTime + 0.1) {
        const step = this.step % 16;
        if (step % 4 === 0) {
          this.tone(bass[(this.step / 4) % bass.length | 0], 0.22, 'triangle', 0.015, 0, this.musicGain);
        }
        if (step % 2 === 0) {
          this.tone(arp[(this.step / 2) % arp.length | 0], 0.12, 'square', 0.006, 0, this.musicGain);
        }
        if (step === 0 || step === 8) {
          this.noise(0.05, 0.006, 500);
        }
        this.nextNote += 0.16;
        this.step += 1;
      }
    }
  };

  // ------------------------------------------------------------------
  // Состояние
  // ------------------------------------------------------------------

  let mode = 'menu';
  let run = null;
  let visualTime = 0;
  let lastTs = 0;
  let toastTimer = 0;
  let bannerTimer = 0;
  let flashTimer = 0;
  let targetUiSig = '';
  let bossUiSig = '';
  let audioStarted = false;

  function stamp() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }

  function createRun(diffId) {
    const diff = D.DIFFICULTIES[diffId] || D.DIFFICULTIES.normal;
    const urlSeed = Number(new URLSearchParams(window.location.search).get('seed'));
    const seed = Number.isFinite(urlSeed) && urlSeed > 0 ? urlSeed : (Date.now() >>> 0);
    return {
      seed,
      rng: makeRng(seed),
      diff,
      wave: 0,
      waveMod: null,
      edition: 0,
      redMarkPending: false,
      eliteSpawned: false,
      maxHp: diff.hp,
      hp: diff.hp,
      shield: 0,
      maxShield: 0,
      score: 0,
      kills: 0,
      combo: 0,
      bestCombo: 0,
      tokens: 1,
      mistakes: 0,
      keystrokes: 0,
      correctKeys: 0,
      totalDamage: 0,
      upgrades: {},
      pity: { epic: 0, legendary: 0 },
      enemies: [],
      particles: [],
      floaters: [],
      slashes: [],
      queue: [],
      spawnTimer: 0,
      spawnCount: 0,
      spawnBossDone: false,
      phase: 'waveIntro',
      waveTimer: 0,
      waveClearTimer: 0,
      endQueued: false,
      endDelay: 0,
      waveTime: 0,
      buffer: '',
      manualTargetId: null,
      activeTargetId: null,
      latinStreak: 0,
      mistakesWave: 0,
      damageWave: 0,
      perfectWave: true,
      mirrorUsed: false,
      cleanKills: 0,
      berserkKills: 0,
      chronosTimer: 25,
      chronopenCd: 0,
      slowTimer: 0,
      slowFactor: 1,
      phoenixUsed: false,
      secondChanceUsed: false,
      boss: null,
      bossPhrase: null,
      bossSegment: 0,
      bossTotal: 0,
      offer: null,
      lastOfferIds: [],
      choosing: false,
      perfectWaves: 0,
      startedAt: Date.now(),
      endedAt: 0,
      endReason: '',
      nextEnemyId: 1,
      shake: 0,
      flash: 0,
      tagRects: [],
      pausedAt: 0,
      totalPaused: 0,
      hints: {}
    };
  }

  function stacks(id) {
    return run && run.upgrades[id] ? run.upgrades[id] : 0;
  }

  function has(id) {
    return stacks(id) > 0;
  }

  function comboMult() {
    return 1 + Math.min(run ? run.combo : 0, 50) * 0.02;
  }

  function addScore(points) {
    if (!run) return;
    run.score += Math.round(points * run.diff.score);
  }

  function healBase(amount, silent = false) {
    if (!run || amount <= 0) return;
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + amount);
    const healed = run.hp - before;
    if (healed > 0 && !silent) {
      addFloater(BASE.x + (run.rng() * 20 - 10), BASE.y - 20, `+${Math.round(healed)}`, '#8bd8a4');
      AudioSys.heal();
    }
    updateHud();
  }

  function addFloater(x, y, text, color = '#f1e6c8') {
    if (!run) return;
    run.floaters.push({
      x,
      y,
      text,
      color,
      life: 0.9,
      maxLife: 0.9,
      vy: -18
    });
  }

  function addBurst(x, y, color, count = 8, speed = 32, size = 2) {
    if (!run) return;
    const n = settings.motion ? count : Math.max(2, Math.floor(count / 3));
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      run.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: size + Math.floor(Math.random() * 2),
        color
      });
    }
  }

  function addSlash(x1, y1, x2, y2) {
    if (!run) return;
    run.slashes.push({ x1, y1, x2, y2, life: 0.25, maxLife: 0.25 });
  }

  function triggerSlow(factor, duration) {
    if (!run) return;
    run.slowFactor = Math.min(run.slowFactor || 1, factor);
    run.slowTimer = Math.max(run.slowTimer, duration);
  }

  function updateUiTimers(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) dom.toast.classList.remove('show');
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) dom.waveBanner.classList.remove('show');
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) dom.flash.classList.remove('show');
    }
    if (run) {
      if (settings.shake) {
        run.shake = Math.max(0, run.shake - dt * 32);
      } else {
        run.shake = 0;
      }
      run.flash = Math.max(0, run.flash - dt * 7);
    }
  }

  // ------------------------------------------------------------------
  // Экраны и режимы
  // ------------------------------------------------------------------

  function showScreen(el) {
    screens.forEach((s) => s.classList.toggle('active', s === el));
  }

  function hideScreens() {
    screens.forEach((s) => s.classList.remove('active'));
  }

  function setMode(next) {
    mode = next;
    const hudVisible = next === 'playing' || next === 'paused';
    dom.hud.classList.toggle('visible', hudVisible);
    canvas.style.cursor = next === 'playing' ? 'crosshair' : 'default';
  }

  function showToast(text, ms = 1700) {
    dom.toast.textContent = text;
    dom.toast.classList.add('show');
    toastTimer = ms / 1000;
  }

  function showWaveBanner(text, ms = 1300) {
    dom.waveBanner.innerHTML = text.replace(/(\d+)/g, '<span class="banner-num">$1</span>');
    dom.waveBanner.classList.add('show');
    bannerTimer = ms / 1000;
  }

  function flashScreen() {
    dom.flash.classList.add('show');
    flashTimer = 0.12;
  }

  // ------------------------------------------------------------------
  // Запуск и волны
  // ------------------------------------------------------------------

  function startRun(diffId) {
    AudioSys.init();
    audioStarted = true;
    AudioSys.setMusicVolume(0.24);
    if (settings.sound) AudioSys.startMusic();
    run = createRun(diffId);
    targetUiSig = '';
    bossUiSig = '';
    hideScreens();
    setMode('playing');
    dom.stage.focus({ preventScroll: true });
    updateBest();
    startWaveIntro(1);
  }

  function startWaveIntro(waveNum) {
    if (!run) return;
    if (waveNum > TOTAL_WAVES) {
      victory();
      return;
    }
    const wd = D.WAVES[waveNum - 1];
    const mod = waveModifier(waveNum);
    const edition = editionForWave(waveNum);
    run.wave = waveNum;
    run.waveMod = mod ? mod.id : null;
    run.edition = Math.max(0, Math.min(D.EDITIONS.length - 1, Math.floor((waveNum - 1) / 5)));
    run.redMarkPending = !!mod && mod.id === 'redmark';
    run.eliteSpawned = false;
    run.phase = 'waveIntro';
    run.waveTimer = 2.45;
    run.waveClearTimer = 0;
    run.endQueued = false;
    run.endDelay = 0;
    run.buffer = '';
    run.manualTargetId = null;
    run.activeTargetId = null;
    run.latinStreak = 0;
    run.mistakesWave = 0;
    run.damageWave = 0;
    run.perfectWave = true;
    run.mirrorUsed = false;
    run.slowTimer = 0;
    run.slowFactor = 1;
    run.chronopenCd = 0;
    run.boss = null;
    run.bossPhrase = null;
    run.bossSegment = 0;
    run.bossTotal = 0;
    run.offer = null;
    run.choosing = false;
    run.enemies = [];
    run.tagRects = [];
    run.queue = buildQueue(waveNum);
    run.spawnCount = 0;
    run.spawnBossDone = false;
    dom.waveModTag.textContent = mod ? (mod.short || mod.name) : 'НЕТ';
    dom.waveModTag.classList.toggle('active', !!mod);
    targetUiSig = '';
    bossUiSig = '';
    dom.bossBar.classList.remove('show');
    setMode('playing');
    hideScreens();
    updateHud();
    updateTargetUI();
    updateBossBar();
    const boss = wd && wd.boss ? D.BOSSES[wd.boss] : null;
    const sub = `${edition.name}${mod ? ` · ${mod.name}` : ''}`;
    const title = boss ? `ВОЛНА ${waveNum} · БОСС` : `ВОЛНА ${waveNum}`;
    showWaveBanner(`${title}<span class="banner-sub">${sub}</span>`, boss ? 1900 : 1450);
  }

  function buildQueue(waveNum) {
    const wd = D.WAVES[waveNum - 1];
    if (!wd || !wd.comp) return [];
    const queue = [];
    Object.keys(wd.comp).forEach((type) => {
      for (let i = 0; i < wd.comp[type]; i += 1) queue.push(type);
    });
    return shuffle(run.rng, queue);
  }

  function beginWave() {
    if (!run) return;
    const wd = D.WAVES[run.wave - 1];
    const mod = run.waveMod ? D.WAVE_MODIFIERS[run.waveMod] : null;
    run.phase = 'wave';
    run.waveTime = 0;
    run.maxShield = 30 * stacks('shield');
    run.shield = run.maxShield;
    run.chronosTimer = has('chronos') ? Math.max(10, 25 - 5 * (stacks('chronos') - 1)) : 25;
    run.chronopenCd = 0;
    run.spawnTimer = (wd && wd.boss ? 2.1 : 0.75) * (1 + 0.08 * stacks('slowspawn')) * spawnModFactor();
    if (wd && wd.boss) {
      spawnBoss(wd.boss);
    } else if (mod && mod.id === 'elite' && !run.eliteSpawned) {
      const eliteType = run.wave < 10 ? 'S' : run.wave < 20 ? 'H' : 'A';
      const elite = spawnEnemy(eliteType, { elite: true });
      run.eliteSpawned = !!elite;
      if (elite) {
        addFloater(elite.x, elite.y - elite.size - 14, 'ЗАГЛАВНАЯ', '#f2c14e');
      }
    }
    if (run.wave === 1 && !run.hints.start) {
      run.hints.start = true;
      showToast('НАПЕЧАТАЙ СЛОВО НАД ВРАГОМ, ЧТОБЫ УБИТЬ ЕГО', 2800);
    } else if (mod && !run.hints[`mod_${mod.id}`]) {
      run.hints[`mod_${mod.id}`] = true;
      showToast(`${mod.name}: ${mod.desc}`, 2800);
    }
    AudioSys.wave();
    updateHud();
  }

  function rollLength(range) {
    const a = range[0];
    const b = range[1];
    if (b <= a) return a;
    const r = run.rng();
    if (b - a === 1) return r < 0.66 ? a : b;
    if (r < 0.52) return a;
    if (r < 0.84) return a + 1;
    return b;
  }

  function pickWordForEnemy(length, wave, used) {
    const lens = [length, length + 1, length - 1, length + 2, length - 2]
      .filter((l) => l >= 3 && l <= 10);
    const existing = run.enemies
      .filter((e) => !e.dead)
      .flatMap((e) => e.words.slice(e.wordIndex));
    for (const len of lens) {
      const bucket = D.WORD_BUCKETS[len];
      if (!bucket || !bucket.length) continue;
      for (let i = 0; i < 35; i += 1) {
        const word = bucket[Math.floor(run.rng() * bucket.length)];
        if (used && used.has(word)) continue;
        if (wave <= 5 && word.includes('й')) continue;
        if (existing.some((w) => w === word || w.startsWith(word) || word.startsWith(w))) continue;
        return word;
      }
    }
    const fallbackBucket = D.WORD_BUCKETS[clamp(length, 3, 10)] || D.WORD_BUCKETS[3];
    return fallbackBucket[Math.floor(run.rng() * fallbackBucket.length)];
  }

  function globalSpeedMod() {
    return Math.pow(0.92, stacks('heavypages'))
      * (has('absolute') ? 0.82 : 1)
      * (has('greed') ? 1.15 : 1);
  }

  function spawnEnemy(typeKey, opts = {}) {
    if (!run) return null;
    if (run.enemies.length >= MAX_TOTAL_ENEMIES) return null;
    const type = D.ENEMY_TYPES[typeKey];
    if (!type) return null;
    const wd = D.WAVES[run.wave - 1] || { len: [4, 5] };
    const elite = !!opts.elite;
    let angle;
    if (opts.angle !== undefined) {
      angle = opts.angle;
    } else if (run.waveMod === 'raid' && opts.x === undefined && opts.y === undefined) {
      const side = run.spawnCount % 2 === 0 ? 0 : Math.PI;
      angle = side + (run.rng() * 2 - 1) * 0.55;
    } else {
      angle = run.rng() * Math.PI * 2;
      if (Math.abs(Math.cos(angle)) < 0.34) {
        angle += (Math.sin(angle) < 0 ? 0.62 : -0.62);
      }
    }
    let x = opts.x;
    let y = opts.y;
    if (x === undefined || y === undefined) {
      x = BASE.x + Math.cos(angle) * 300;
      y = BASE.y + Math.sin(angle) * 180;
    } else {
      angle = Math.atan2(y - BASE.y, x - BASE.x);
    }
    const ring = BASE.r + 8;
    const targetX = BASE.x + Math.cos(angle) * ring;
    const targetY = BASE.y + Math.sin(angle) * ring;

    let baseLen;
    if (opts.fixedLen) {
      baseLen = opts.fixedLen;
    } else {
      baseLen = rollLength(wd.len || [4, 5]);
      baseLen = clamp(baseLen + (type.lenMod || 0), 3, 10);
      const keepers = run.enemies.filter((e) => !e.dead && e.type === 'K').length;
      baseLen = clamp(baseLen + Math.min(2, keepers), 3, 10);
    }

    const wordCount = elite ? 2 : (type.words || 1);
    const words = [];
    const prefills = [];
    const used = new Set();
    for (let wi = 0; wi < wordCount; wi += 1) {
      const len = wordCount > 1 ? clamp(baseLen + wi, 3, 10) : baseLen;
      const word = pickWordForEnemy(len, run.wave, used);
      used.add(word);
      words.push(word);
      prefills.push(0);
    }

    const enemy = {
      id: run.nextEnemyId++,
      type: type.key,
      name: elite ? `Заглавный ${type.name}` : type.name,
      x,
      y,
      spawnX: x,
      spawnY: y,
      targetX,
      targetY,
      angle,
      speed: type.speed * waveSpeedScale(run.wave) * run.diff.speed * globalSpeedMod() * (elite ? 0.82 : 1),
      damage: Math.max(1, Math.round(type.damage * run.diff.damage * (elite ? 1.15 : 1))),
      interval: type.interval,
      size: type.size * (elite ? 1.35 : 1),
      body: type.body,
      light: type.light,
      eye: type.eye,
      words,
      prefills,
      wordIndex: 0,
      state: 'walk',
      attackTimer: type.interval * 0.55,
      windup: 0,
      stagger: 0,
      intro: 0,
      jumpTimer: 5,
      age: 0,
      spawnOrder: run.nextEnemyId,
      isBoss: false,
      elite,
      redMarked: false,
      dead: false,
      tagRect: null
    };
    if (type.key === 'J') enemy.jumpTimer = 3.5 + run.rng() * 2;
    run.enemies.push(enemy);
    if (run.waveMod === 'redmark' && run.redMarkPending && !elite && type.key !== 'SHARD') {
      enemy.redMarked = true;
      run.redMarkPending = false;
      addFloater(enemy.x, enemy.y - enemy.size - 12, 'КРАСНАЯ ПОМЕТКА', '#ff8a8a');
    }
    addBurst(x, y, type.light, 9, 26, 2);
    if (!run.hints[type.key] && ['K', 'D', 'J', 'A'].includes(type.key)) {
      run.hints[type.key] = true;
      if (type.key === 'K') showToast('ХРАНИТЕЛЬ: СЛЕДУЮЩИЕ ВРАГИ БУДУТ ДЛИННЕЕ НА 1 БУКВУ', 2200);
      if (type.key === 'D') showToast('ДЕЛЕЦ: ПОСЛЕ СМЕРТИ РАСПАДАЕТСЯ НА ОСКОЛКИ', 2200);
      if (type.key === 'J') showToast('ПРЫГУН: ПРЫГАЕТ БЛИЖЕ К БАЗЕ', 2000);
      if (type.key === 'A') showToast('БРОНЕНОСЕЦ: У НЕГО ДВА СЛОВА', 2200);
    }
    return enemy;
  }

  function spawnBoss(waveNum) {
    if (!run) return;
    const bd = D.BOSSES[waveNum];
    if (!bd) return;
    let words;
    if (waveNum === 20 || waveNum === 30) {
      const pairs = shuffle(run.rng, D.BOSS_PHRASES[waveNum]).slice(0, 3);
      words = pairs.flat();
    } else {
      words = pick(run.rng, D.BOSS_PHRASES[waveNum]).slice();
    }
    const prefills = words.map(() => 0);
    const sentence = words.join(' ');
    const angle = -Math.PI / 2;
    const x = BASE.x;
    const y = BASE.y - BASE.r - 31;
    const targetX = BASE.x;
    const targetY = BASE.y - BASE.r - 15;
    const bossInterval = bd.interval * (has('silence') ? 1.2 : 1);
    const boss = {
      id: run.nextEnemyId++,
      type: 'BOSS',
      name: bd.name,
      x,
      y,
      spawnX: x,
      spawnY: y,
      targetX,
      targetY,
      angle,
      speed: bd.speed * bossSpeedScale(waveNum) * run.diff.speed * globalSpeedMod(),
      damage: Math.max(1, Math.round(bd.damage * run.diff.damage)),
      interval: bossInterval,
      size: bd.size,
      body: bd.color,
      light: '#eab0c0',
      eye: '#ffe29a',
      words,
      sentence,
      typed: '',
      rewardedWords: 0,
      prefills,
      wordIndex: 0,
      state: 'walk',
      attackTimer: bossInterval * 0.8,
      windup: 0,
      stagger: 0,
      intro: 2.0,
      age: 0,
      spawnOrder: run.nextEnemyId,
      isBoss: true,
      bossWave: waveNum,
      phaseBreaks: bd.phaseBreaks.slice(),
      phaseAdds: bd.phaseAdds,
      phaseTypes: bd.phaseTypes.slice(),
      phasesDone: 0,
      dead: false,
      tagRect: null
    };
    run.enemies.push(boss);
    run.boss = boss;
    run.bossPhrase = words;
    run.bossSegment = 0;
    run.bossTotal = words.length;
    run.spawnBossDone = true;
    dom.bossBar.classList.add('show');
    AudioSys.boss();
    showToast(`БОСС: ${bd.name} · ВВЕДИ ВСЁ ПРЕДЛОЖЕНИЕ`, 2600);
    addBurst(x, BASE.y - 40, bd.color, 24, 45, 3);
    run.shake = 8;
    updateBossBar();
  }

  function phaseTransition(boss) {
    if (!boss || boss.dead) return;
    boss.phasesDone += 1;
    boss.speed *= 1.16;
    boss.interval *= 0.91;
    boss.attackTimer = Math.min(boss.attackTimer, boss.interval);
    const types = boss.phaseTypes;
    const spawned = [];
    for (let i = 0; i < boss.phaseAdds; i += 1) {
      if (run.enemies.length >= MAX_TOTAL_ENEMIES) break;
      const add = spawnEnemy(types[i % types.length], { angle: pick(run.rng, [0.2, 1.1, 2.2, 3.3, 4.4, 5.5]) });
      if (add) spawned.push(add);
    }
    if (boss.bossWave === 30 && spawned.length) {
      const marked = spawned[Math.floor(run.rng() * spawned.length)];
      marked.redMarked = true;
      addFloater(marked.x, marked.y - marked.size - 12, 'КРАСНАЯ ПОМЕТКА', '#ff8a8a');
    }
    addFloater(boss.x, boss.y - boss.size - 16, 'ФАЗА', '#ffb0b0');
    showToast('НОВАЯ ФАЗА', 1200);
    run.shake = 6;
    AudioSys.boss();
  }

  // ------------------------------------------------------------------
  // Цели, ввод, ошибки
  // ------------------------------------------------------------------

  function currentWord(enemy) {
    if (!enemy) return '';
    if (enemy.isBoss) return enemy.sentence || '';
    return enemy.words[enemy.wordIndex] || '';
  }

  function currentPrefill() {
    // В игре больше нет автозаполнения: любое слово вводится целиком.
    return 0;
  }

  function bossTyped(boss) {
    if (!boss) return '';
    if (!boss.sentence) return boss.typed || '';
    if (run && run.activeTargetId === boss.id && boss.sentence.startsWith(run.buffer)) {
      return run.buffer;
    }
    return boss.typed || '';
  }

  function countBossWords(boss, typed) {
    if (!boss) return 0;
    let count = 0;
    let start = 0;
    for (let i = 0; i < boss.words.length; i += 1) {
      const end = start + boss.words[i].length;
      if (typed.length >= end && (i === boss.words.length - 1 || typed.length > end)) {
        count += 1;
      }
      start = end + 1;
    }
    return count;
  }

  function rewardBossWord(boss, index, fromEffect) {
    if (!boss || boss.dead || !run) return;
    const word = boss.words[index] || '';
    if (!fromEffect) {
      run.combo += 5;
      run.bestCombo = Math.max(run.bestCombo, run.combo);
      addScore(90 * word.length * comboMult());
    }
    addBurst(boss.x, boss.y, '#f2c14e', 18, 45, 3);
    addFloater(
      boss.x,
      boss.y - boss.size - 10,
      fromEffect ? 'СЛОВО СНЯТО' : `СЛОВО ${index + 1}/${boss.words.length}`,
      '#f2c14e'
    );
    boss.stagger = 1.5 + (has('silence') ? 1 : 0);
    boss.windup = 0;
    boss.attackTimer = Math.max(boss.attackTimer, boss.interval * 0.75);
    AudioSys.shieldBreak();
    run.shake = Math.max(run.shake, 5);
  }

  function syncBossProgress(boss, text, fromEffect = false) {
    if (!boss || boss.dead || !run) return '';
    const sentence = boss.sentence || '';
    let typed = String(text || '');
    if (!sentence.startsWith(typed)) {
      let i = 0;
      while (i < typed.length && i < sentence.length && typed[i] === sentence[i]) i += 1;
      typed = sentence.slice(0, i);
    }
    boss.typed = typed;
    if (run.activeTargetId === boss.id) run.buffer = typed;
    const completed = countBossWords(boss, typed);
    boss.wordIndex = completed;
    run.bossSegment = completed;
    run.bossTotal = boss.words.length;
    if (completed > boss.rewardedWords) {
      for (let i = boss.rewardedWords; i < completed; i += 1) {
        rewardBossWord(boss, i, fromEffect);
      }
      boss.rewardedWords = completed;
    }
    const breaks = boss.phaseBreaks || [];
    while (boss.phasesDone < breaks.length && completed >= breaks[boss.phasesDone]) {
      phaseTransition(boss);
    }
    updateBossBar();
    updateTargetUI();
    return typed;
  }

  function nextBossSkipText(boss) {
    if (!boss || !boss.sentence) return '';
    const typed = bossTyped(boss);
    const sentence = boss.sentence;
    if (typed.length >= sentence.length) return sentence;
    let start = 0;
    for (let i = 0; i < boss.words.length; i += 1) {
      const end = start + boss.words[i].length;
      if (typed.length < end) {
        const nextEnd = i < boss.words.length - 1 ? end + 1 : end;
        return sentence.slice(0, nextEnd);
      }
      if (typed.length === end) {
        if (i >= boss.words.length - 1) return sentence;
        const nextWordEnd = end + 1 + boss.words[i + 1].length;
        const nextEnd = i + 1 < boss.words.length - 1 ? nextWordEnd + 1 : nextWordEnd;
        return sentence.slice(0, nextEnd);
      }
      start = end + 1;
    }
    return sentence;
  }

  function requiredTail(enemy) {
    if (!enemy) return '';
    return currentWord(enemy).slice(currentPrefill(enemy));
  }

  function remainingLetters(enemy) {
    return Math.max(0, requiredTail(enemy).length - (run && run.activeTargetId === enemy.id ? run.buffer.length : 0));
  }

  function isTargetable(enemy) {
    return enemy && !enemy.dead && !(enemy.isBoss && enemy.intro > 0);
  }

  function enemyById(id) {
    if (!run || id == null) return null;
    return run.enemies.find((e) => e.id === id && !e.dead) || null;
  }

  function prioritySort(a, b) {
    // Пока босс жив, его предложение всегда главная цель.
    if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
    const aAttack = a.state === 'attack' ? 1 : 0;
    const bAttack = b.state === 'attack' ? 1 : 0;
    if (aAttack !== bAttack) return bAttack - aAttack;
    const da = dist(a, BASE);
    const db = dist(b, BASE);
    if (Math.abs(da - db) > 0.8) return da - db;
    const ra = requiredTail(a).length;
    const rb = requiredTail(b).length;
    if (ra !== rb) return ra - rb;
    return a.spawnOrder - b.spawnOrder;
  }

  function getCandidates(buffer) {
    if (!run) return [];
    const manual = enemyById(run.manualTargetId);
    if (manual) {
      if (!isTargetable(manual)) return [];
      if (requiredTail(manual).startsWith(buffer)) return [manual];
      return [];
    }
    return run.enemies
      .filter((e) => isTargetable(e) && requiredTail(e).startsWith(buffer))
      .sort(prioritySort);
  }

  function updateActiveTarget() {
    if (!run) return;
    const manual = enemyById(run.manualTargetId);
    if (run.manualTargetId != null && !manual) {
      run.manualTargetId = null;
    }
    if (manual) {
      if (isTargetable(manual) && requiredTail(manual).startsWith(run.buffer)) {
        if (manual.isBoss && manual.typed && manual.sentence.startsWith(manual.typed)
          && (run.buffer.length === 0 || manual.typed.length > run.buffer.length)) {
          run.buffer = manual.typed;
        }
        run.activeTargetId = manual.id;
      } else {
        run.activeTargetId = null;
      }
      updateTargetUI();
      return;
    }
    let candidates = getCandidates(run.buffer);
    if (candidates.length && candidates[0].isBoss) {
      const boss = candidates[0];
      if (boss.typed && boss.sentence.startsWith(boss.typed) && boss.typed.length > run.buffer.length) {
        run.buffer = boss.typed;
        candidates = getCandidates(run.buffer);
      }
    }
    run.activeTargetId = candidates.length ? candidates[0].id : null;
    updateTargetUI();
  }

  function getActiveTarget() {
    return enemyById(run && run.activeTargetId);
  }

  function isValidBuffer(buffer) {
    if (!run) return false;
    const manual = enemyById(run.manualTargetId);
    if (manual) return requiredTail(manual).startsWith(buffer);
    return run.enemies.some((e) => isTargetable(e) && requiredTail(e).startsWith(buffer));
  }

  function afterCorrectKey() {
    if (!run || !has('inkwell')) return;
    if (run.correctKeys % 20 !== 0) return;
    const heal = stacks('inkwell');
    healBase(heal, true);
    addFloater(BASE.x, BASE.y - 24, `+${heal}`, '#8bd8a4');
  }

  function typeLetter(ch) {
    if (!run || run.phase !== 'wave') return;
    if (!ch) return;
    if (!run.enemies.some(isTargetable)) return;
    updateActiveTarget();
    const wasEmpty = run.buffer.length === 0;
    run.keystrokes += 1;

    if (run.diff.strict) {
      const next = run.buffer + ch;
      run.buffer = next;
      if (!isValidBuffer(next)) {
        registerMistake();
        updateActiveTarget();
        return;
      }
      run.correctKeys += 1;
      afterCorrectKey();
      run.latinStreak = 0;
      updateActiveTarget();
      const target = getActiveTarget();
      if (target && target.isBoss) syncBossProgress(target, run.buffer, false);
      if (target && next === requiredTail(target)) {
        completeEnemyWord(target);
      } else {
        AudioSys.key(next.length - 1);
      }
      if (wasEmpty && has('chronopen') && run.chronopenCd <= 0) {
        triggerSlow(0.5, 0.8);
        run.chronopenCd = 8;
      }
      updateTargetUI();
      return;
    }

    const manual = enemyById(run.manualTargetId);
    if (manual && !isTargetable(manual)) return;
    if (manual && !requiredTail(manual).startsWith(run.buffer + ch)) {
      registerMistake();
      return;
    }
    const candidates = getCandidates(run.buffer + ch);
    if (!candidates.length) {
      registerMistake();
      return;
    }
    run.buffer += ch;
    run.correctKeys += 1;
    afterCorrectKey();
    run.latinStreak = 0;
    updateActiveTarget();
    if (!run.hints.tab && getCandidates(run.buffer).length > 1) {
      run.hints.tab = true;
      showToast('ПОДХОДИТ НЕСКОЛЬКО ЦЕЛЕЙ. TAB — СМЕНИТЬ ЦЕЛЬ', 1800);
    }
    const target = getActiveTarget();
    if (target && target.isBoss) syncBossProgress(target, run.buffer, false);
    if (target && run.buffer === requiredTail(target)) {
      completeEnemyWord(target);
    } else {
      AudioSys.key(run.buffer.length - 1);
    }
    if (wasEmpty && has('chronopen') && run.chronopenCd <= 0) {
      triggerSlow(0.5, 0.8);
      run.chronopenCd = 8;
    }
    updateTargetUI();
  }

  function backspace() {
    if (!run || run.phase !== 'wave') return;
    if (!run.buffer.length) return;
    const boss = run.boss && !run.boss.dead && run.activeTargetId === run.boss.id ? run.boss : null;
    run.buffer = run.buffer.slice(0, -1);
    if (boss) boss.typed = run.buffer;
    updateActiveTarget();
    if (boss) syncBossProgress(boss, run.buffer, false);
    updateTargetUI();
    AudioSys.soft();
  }

  function registerMistake() {
    if (!run) return;
    if (!run.hints.mistake) {
      run.hints.mistake = true;
      showToast('ОШИБКА НЕ РАНИТ БАЗУ. ПРОДОЛЖАЙ ПЕЧАТАТЬ.', 2100);
    }
    run.mistakes += 1;
    run.mistakesWave += 1;
    run.perfectWave = false;
    run.latinStreak = 0;
    run.cleanKills = 0;
    run.berserkKills = 0;
    if (!has('preciseeye')) run.combo = 0;
    if (has('berserk')) {
      damageBase(5, { self: true });
    }
    AudioSys.error();
    flashScreen();
    run.flash = 1;
    updateHud();
    updateTargetUI();
  }

  function cycleTarget() {
    if (!run || run.phase !== 'wave') return;
    let candidates;
    if (run.buffer.length === 0) {
      candidates = run.enemies.filter(isTargetable).sort(prioritySort);
    } else {
      candidates = run.enemies
        .filter((e) => isTargetable(e) && requiredTail(e).startsWith(run.buffer))
        .sort(prioritySort);
    }
    if (!candidates.length) return;
    const currentIndex = candidates.findIndex((e) => e.id === run.activeTargetId);
    const next = candidates[(currentIndex + 1) % candidates.length];
    if (next.isBoss && next.typed && next.sentence.startsWith(next.typed)) {
      if (run.buffer.length === 0 || next.typed.length > run.buffer.length) {
        run.buffer = next.typed;
      }
    }
    run.manualTargetId = next.id;
    run.activeTargetId = next.id;
    updateTargetUI();
    AudioSys.soft();
  }

  function clearManualTarget() {
    if (!run) return;
    run.manualTargetId = null;
    if (run.boss && !run.boss.dead) {
      run.buffer = run.boss.typed || '';
    }
    updateActiveTarget();
  }

  function selectEnemyAt(x, y) {
    if (!run || run.phase !== 'wave') return;
    let found = null;
    let best = Infinity;
    run.enemies.forEach((e) => {
      if (!isTargetable(e)) return;
      const bodyDist = Math.hypot(e.x - x, e.y - y);
      if (bodyDist < e.size + 8 && bodyDist < best) {
        found = e;
        best = bodyDist;
      }
      const r = e.tagRect;
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < best) {
          found = e;
          best = d;
        }
      }
    });
    if (found) {
      if (found.isBoss) {
        if (!found.sentence.startsWith(run.buffer)) {
          run.buffer = found.typed || '';
        } else if (found.typed && found.typed.length > run.buffer.length) {
          run.buffer = found.typed;
        }
      } else if (run.buffer && !requiredTail(found).startsWith(run.buffer)) {
        run.buffer = '';
      }
      run.manualTargetId = found.id;
      run.activeTargetId = found.id;
      updateTargetUI();
      AudioSys.soft();
    } else {
      clearManualTarget();
    }
  }

  // ------------------------------------------------------------------
  // Завершение слов, смерть, эффекты
  // ------------------------------------------------------------------

  function completeEnemyWord(enemy, depth = 0) {
    if (!enemy || enemy.dead || !run) return;
    if (enemy.isBoss) {
      if (bossTyped(enemy) === enemy.sentence) killBoss(enemy);
      return;
    }
    if (enemy.wordIndex < enemy.words.length - 1) {
      enemy.wordIndex += 1;
      enemy.stagger = Math.max(enemy.stagger, 0.45);
      if (run.activeTargetId === enemy.id) run.buffer = '';
      addBurst(enemy.x, enemy.y, enemy.light, 10, 30, 2);
      addFloater(enemy.x, enemy.y - enemy.size - 8, 'ЩИТ СНЯТ', '#c9d68a');
      AudioSys.shieldBreak();
      run.shake = Math.max(run.shake, 2);
      updateTargetUI();
      return;
    }
    killEnemy(enemy, depth);
  }

  // Эффекты «босс теряет слово» снимают одно слово из предложения.
  // Игроку всё равно нужно ввести оставшуюся часть фразы целиком.
  function completeBossWord(boss, depth = 0, fromEffect = true) {
    if (!boss || boss.dead || !run) return;
    const before = bossTyped(boss);
    const next = nextBossSkipText(boss);
    if (next.length <= before.length) {
      if (before === boss.sentence) killBoss(boss);
      return;
    }
    syncBossProgress(boss, next, true);
    if (boss.typed === boss.sentence) {
      killBoss(boss);
      return;
    }
    updateBossBar();
    updateTargetUI();
    updateHud();
    checkWaveEndSoon();
  }

  function killBoss(boss) {
    if (!run || !boss || boss.dead) return;
    boss.dead = true;
    run.enemies = run.enemies.filter((e) => e !== boss);
    if (run.boss === boss) run.boss = null;
    run.bossPhrase = null;
    run.bossSegment = 0;
    run.bossTotal = 0;
    dom.bossBar.classList.remove('show');
    if (run.activeTargetId === boss.id) {
      run.activeTargetId = null;
      run.buffer = '';
    }
    if (run.manualTargetId === boss.id) run.manualTargetId = null;
    run.kills += 1;
    run.combo += 10;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    addScore(2000 + 50 * boss.words.length);
    addBurst(boss.x, boss.y, '#f2c14e', 42, 70, 3);
    addBurst(boss.x, boss.y, boss.body, 30, 50, 2);
    addFloater(boss.x, boss.y - 20, 'БОСС ПОБЕЖДЕН', '#ffe29a');
    AudioSys.victory();
    run.shake = 10;
    triggerSlow(0.4, 1.1);
    updateHud();
    updateTargetUI();
    updateBossBar();
    checkWaveEndSoon();
  }

  function killEnemy(enemy, depth = 0, opts = {}) {
    if (!run || !enemy || enemy.dead) return;
    if (enemy.isBoss) {
      killBoss(enemy);
      return;
    }
    const word = currentWord(enemy);
    const wordLength = word.length;
    enemy.dead = true;
    run.enemies = run.enemies.filter((e) => e !== enemy);
    if (run.activeTargetId === enemy.id) {
      run.activeTargetId = null;
      run.buffer = '';
    }
    if (run.manualTargetId === enemy.id) run.manualTargetId = null;
    run.kills += 1;
    run.combo += 1;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    addScore(10 * wordLength * wordLength * comboMult());
    if (enemy.elite) {
      run.tokens += 1;
      healBase(5, true);
      addScore(250 * comboMult());
      addBurst(enemy.x, enemy.y, '#f2c14e', 26, 48, 3);
      addFloater(enemy.x, enemy.y - enemy.size - 14, 'ЗАГЛАВНАЯ · +1 ЖЕТОН', '#f2c14e');
      showToast('ЗАГЛАВНАЯ ПОБЕЖДЕНА: +1 ЖЕТОН', 1800);
    }
    if (enemy.redMarked) {
      healBase(5, true);
      addBurst(enemy.x, enemy.y, '#ff8a8a', 18, 38, 2);
      addFloater(enemy.x, enemy.y - enemy.size - 14, 'ПОМЕТКА СНЯТА · +5 HP', '#ffb0b0');
      showToast('КРАСНАЯ ПОМЕТКА СНЯТА: +5 HP', 1600);
    }
    if (run.kills === 1 && !run.hints.firstKill) {
      run.hints.firstKill = true;
      showToast('ПЕРВОЕ СЛОВО! ВВОДИ СЛОВА БЕЗ ОШИБОК, ЧТОБЫ РАСТИТЬ СЕРИЮ', 2200);
    }
    run.cleanKills += 1;
    run.berserkKills += 1;
    if (has('redline')) {
      const threshold = Math.max(3, 5 - (stacks('redline') - 1));
      if (run.cleanKills >= threshold) {
        run.cleanKills = 0;
        const heal = 1 + 2 * stacks('redline');
        healBase(heal, true);
        addFloater(enemy.x, enemy.y - enemy.size - 6, `+${heal}`, '#8bd8a4');
      }
    }
    if (has('berserk') && run.berserkKills >= 5) {
      run.berserkKills = 0;
      stunAll(1.5, true);
      addFloater(BASE.x, BASE.y - 32, 'БЕРСЕРК', '#e05252');
    }
    if (has('paragraph') && wordLength >= 7) {
      healBase(stacks('paragraph'), true);
      addFloater(enemy.x, enemy.y - enemy.size - 6, `+${stacks('paragraph')}`, '#8bd8a4');
    }
    if (has('footnote') && run.kills % 10 === 0) {
      healBase(stacks('footnote'), true);
      addFloater(BASE.x, BASE.y - 24, `+${stacks('footnote')}`, '#8bd8a4');
    }
    if (has('stun') && run.kills % 6 === 0) {
      stunAll(0.8 + 0.4 * (stacks('stun') - 1));
    }
    if (has('masterinput') && wordLength >= 7) {
      stunAll(0.5 + 0.25 * (stacks('masterinput') - 1), true);
    }
    if (has('glasscannon')) {
      stunAll(1, true);
    }
    if (has('serialkiller') && run.combo >= 20) {
      healBase(1, true);
    }
    if (has('glossary') && run.kills % 8 === 0) {
      healBase(4, true);
      addFloater(BASE.x, BASE.y - 24, '+4', '#8bd8a4');
    }
    if (has('bloody')) {
      healBase(1, true);
    }
    if (depth < 3) {
      onKillEffects(enemy, depth);
    }
    if (enemy.type === 'D' && run.enemies.length < MAX_TOTAL_ENEMIES - 1) {
      spawnShards(enemy.x, enemy.y);
    }
    addBurst(enemy.x, enemy.y, enemy.light, 14, 40, 2);
    addBurst(enemy.x, enemy.y, '#f2c14e', 5, 24, 2);
    addFloater(enemy.x, enemy.y - enemy.size - 8, `+${formatNum(Math.round(10 * wordLength * wordLength * comboMult()))}`, '#f2c14e');
    AudioSys.kill();
    run.shake = Math.max(run.shake, 2);
    updateHud();
    updateTargetUI();
    checkWaveEndSoon();
  }

  function onKillEffects(dead, depth) {
    if (!run) return;

    if (has('echo')) {
      const targets = run.enemies
        .filter((e) => !e.dead && !e.isBoss)
        .sort((a, b) => Math.hypot(a.x - dead.x, a.y - dead.y) - Math.hypot(b.x - dead.x, b.y - dead.y))
        .slice(0, stacks('echo'));
      targets.forEach((e) => {
        e.stagger = Math.max(e.stagger, 0.4);
      });
    }

    if (has('chain')) {
      const duration = 0.5 + 0.25 * (stacks('chain') - 1);
      run.enemies.forEach((e) => {
        if (e.dead || e.isBoss) return;
        if (Math.hypot(e.x - dead.x, e.y - dead.y) <= 140) {
          e.stagger = Math.max(e.stagger, duration);
        }
      });
    }

    if (has('discharge') && run.kills % 15 === 0) {
      const count = 1 + stacks('discharge');
      const targets = run.enemies.filter((e) => !e.dead && !e.isBoss);
      for (let i = 0; i < count && targets.length; i += 1) {
        const target = targets.splice(Math.floor(run.rng() * targets.length), 1)[0];
        if (target && !target.dead) killEnemy(target, depth + 1);
      }
      if (run.boss && !run.boss.dead) completeBossWord(run.boss, depth + 1, true);
    }

    if (has('universal')) {
      run.enemies.forEach((e) => {
        if (e.dead || e.isBoss) return;
        if (Math.hypot(e.x - dead.x, e.y - dead.y) <= 200) {
          e.stagger = Math.max(e.stagger, 0.8);
        }
      });
    }

    if (has('storm') && run.kills % 20 === 0) {
      run.enemies.slice().forEach((e) => {
        if (e.dead || e.isBoss) return;
        if (currentWord(e).length <= 4) killEnemy(e, depth + 1);
      });
      if (run.boss && !run.boss.dead) completeBossWord(run.boss, depth + 1, true);
    }
  }

  function stunAll(duration, quiet = false) {
    if (!run) return;
    run.enemies.forEach((e) => {
      if (e.dead) return;
      if (e.isBoss) {
        e.stagger = Math.max(e.stagger, 0.25);
      } else {
        e.stagger = Math.max(e.stagger, duration);
      }
    });
    if (!quiet) addFloater(BASE.x, BASE.y - 32, 'ОГЛУШЕНИЕ', '#8ce0cb');
  }

  function spawnShards(x, y) {
    if (!run) return;
    for (let i = 0; i < 2; i += 1) {
      if (run.enemies.length >= MAX_TOTAL_ENEMIES) break;
      const angle = Math.atan2(y - BASE.y, x - BASE.x) + (i === 0 ? -0.5 : 0.5);
      spawnEnemy('SHARD', {
        angle,
        x: x + Math.cos(angle) * 8,
        y: y + Math.sin(angle) * 8,
        fixedLen: 3
      });
    }
  }

  function damageBase(amount, opts = {}) {
    if (!run || amount <= 0) return;
    if (!opts.self && has('mirror') && !run.mirrorUsed) {
      run.mirrorUsed = true;
      addFloater(BASE.x, BASE.y - 26, 'БЛОК', '#5aa9e6');
      addBurst(BASE.x, BASE.y, '#5aa9e6', 14, 35, 2);
      AudioSys.shield();
      run.shake = Math.max(run.shake, 4);
      return;
    }
    let dmg = amount;
    if (opts.self && run.hp - dmg < 1) {
      dmg = Math.max(0, run.hp - 1);
    }
    if (run.shield > 0) {
      const absorbed = Math.min(run.shield, dmg);
      run.shield -= absorbed;
      dmg -= absorbed;
      addFloater(BASE.x, BASE.y - 22, `−${Math.round(absorbed)} ЩИТ`, '#66c7b5');
      AudioSys.shield();
    }
    if (dmg > 0) {
      if (!opts.self && !run.hints.baseHit) {
        run.hints.baseHit = true;
        showToast('ВРАГ ДОШЁЛ ДО СЛОВАРЯ. УБЕЙ ЕГО ПЕРВЫМ.', 2200);
      }
      run.hp -= dmg;
      run.totalDamage += dmg;
      run.damageWave += dmg;
      run.perfectWave = false;
      if (!opts.self && !has('incunabula') && !has('absolute')) run.combo = 0;
      addFloater(BASE.x + (run.rng() * 18 - 9), BASE.y - 18, `−${Math.round(dmg)}`, '#ff8a8a');
      AudioSys.hit();
      flashScreen();
      run.flash = 1;
      run.shake = Math.min(11, 4 + dmg * 0.5);
      if (opts.sourceX !== undefined) addSlash(opts.sourceX, opts.sourceY, BASE.x, BASE.y);
    }
    if (run.hp <= 0) handleDeath();
    updateHud();
  }

  function handleDeath() {
    if (!run) return;
    if (has('phoenix') && !run.phoenixUsed) {
      run.phoenixUsed = true;
      run.hp = Math.max(1, Math.ceil(run.maxHp * 0.6));
      run.shield = 0;
      const list = run.enemies.slice();
      list.forEach((e) => {
        if (!e.dead && !e.isBoss) killEnemy(e, 3);
      });
      if (run.boss && !run.boss.dead) completeBossWord(run.boss, 3, true);
      addBurst(BASE.x, BASE.y, '#f2c14e', 50, 80, 3);
      addFloater(BASE.x, BASE.y - 34, 'ФЕНИКС', '#ffe29a');
      showToast('ФЕНИКС: СЛОВАРЬ ВОЗРОЖДАЕТСЯ', 2200);
      AudioSys.victory();
      updateHud();
      return;
    }
    if (has('secondchance') && !run.secondChanceUsed) {
      run.secondChanceUsed = true;
      run.hp = Math.min(run.maxHp, 40);
      run.shield = 0;
      addBurst(BASE.x, BASE.y, '#66c7b5', 36, 60, 3);
      addFloater(BASE.x, BASE.y - 34, 'ВТОРОЙ ШАНС', '#8ce0cb');
      showToast('ВТОРОЙ ШАНС: 40 HP', 2000);
      AudioSys.waveClear();
      updateHud();
      return;
    }
    gameOver();
  }

  // ------------------------------------------------------------------
  // Обновление боя
  // ------------------------------------------------------------------

  function checkWaveEndSoon() {
    if (!run || run.phase !== 'wave') return;
    if (run.enemies.some((e) => !e.dead)) return;
    if (run.queue.length > 0) return;
    if (run.endQueued) return;
    run.endQueued = true;
    run.endDelay = 0.45;
  }

  function updateRun(dt) {
    if (!run) return;

    if (run.phase === 'waveIntro') {
      run.waveTimer -= dt;
      updateParticles(dt);
      updateHud();
      if (run.waveTimer <= 0) beginWave();
      return;
    }

    if (run.phase === 'between') {
      run.waveTimer -= dt;
      updateParticles(dt);
      if (run.waveTimer <= 0) startWaveIntro(run.wave + 1);
      return;
    }

    if (run.phase === 'waveClear') {
      run.waveClearTimer -= dt;
      updateParticles(dt);
      if (run.waveClearTimer <= 0) {
        if (run.wave >= TOTAL_WAVES) victory();
        else if (shouldOfferUpgrade(run.wave)) showUpgradeScreen();
        else startWaveIntro(run.wave + 1);
      }
      return;
    }

    if (run.phase !== 'wave') return;

    run.waveTime += dt;
    if (run.chronopenCd > 0) run.chronopenCd = Math.max(0, run.chronopenCd - dt);
    if (run.slowTimer > 0) {
      run.slowTimer -= dt;
      if (run.slowTimer <= 0) run.slowFactor = 1;
    }
    const ts = run.slowTimer > 0 ? run.slowFactor : 1;

    if (has('regen') && run.hp < run.maxHp) {
      run.hp = Math.min(run.maxHp, run.hp + stacks('regen') * dt);
    }

    if (has('chronos')) {
      run.chronosTimer -= dt;
      if (run.chronosTimer <= 0) {
        triggerSlow(0.6, 2);
        run.chronosTimer = Math.max(10, 25 - 5 * (stacks('chronos') - 1));
        addFloater(BASE.x, BASE.y - 28, 'ЗАМЕДЛЕНИЕ', '#8fb6ff');
      }
    }

    if (run.endQueued) {
      run.endDelay -= dt;
      if (run.endDelay <= 0 && run.enemies.every((e) => e.dead) && run.queue.length === 0) {
        endWave();
        return;
      }
    } else {
      checkWaveEndSoon();
    }

    updateSpawn(dt * ts);
    updateEnemies(dt * ts, dt);
    updateParticles(dt);

    if (run.phase !== 'wave') return;
    updateActiveTarget();
    checkWaveEndSoon();
    updateHud();
    updateTargetUI();
    updateBossBar();
    if (run.hp <= 0 && mode === 'playing') handleDeath();
  }

  function updateSpawn(dt) {
    if (!run || run.queue.length === 0) return;
    if (run.enemies.length >= MAX_ENEMIES) {
      run.spawnTimer = Math.max(run.spawnTimer, 0.28);
      return;
    }
    const wd = D.WAVES[run.wave - 1];
    run.spawnTimer -= dt;
    if (run.spawnTimer > 0) return;
    const type = run.queue.shift();
    if (type) {
      spawnEnemy(type, {});
      run.spawnCount += 1;
      if (wd && wd.pack && run.spawnCount % 4 === 0 && run.queue.length) {
        run.spawnTimer = 0.25;
      } else {
        run.spawnTimer = (wd ? wd.interval : 2) * (1 + 0.08 * stacks('slowspawn')) * spawnModFactor();
      }
    }
  }

  function updateEnemies(dt, dtReal) {
    if (!run) return;
    const redAlive = run.enemies.some((e) => e.redMarked && !e.dead);
    const enemyDt = dt * (redAlive ? redMarkBoost() : 1);
    const list = run.enemies.slice();
    for (const e of list) {
      if (e.dead || run.phase !== 'wave') continue;
      e.age += dtReal;
      if (e.intro > 0) {
        e.intro -= dtReal;
        continue;
      }
      if (e.stagger > 0) {
        e.stagger -= dtReal;
        continue;
      }
      if (e.state === 'walk') {
        if (e.type === 'J') {
          e.jumpTimer -= enemyDt;
          if (e.jumpTimer <= 0) {
            const dx = e.targetX - e.x;
            const dy = e.targetY - e.y;
            const d = Math.hypot(dx, dy);
            if (d > 2) {
              const step = Math.min(80, d - 1);
              e.x += (dx / d) * step;
              e.y += (dy / d) * step;
              addBurst(e.x, e.y, '#9bd39d', 10, 28, 2);
              addFloater(e.x, e.y - e.size - 8, 'ПРЫЖОК', '#9bd39d');
            }
            e.jumpTimer = 5;
          }
        }
        const dx = e.targetX - e.x;
        const dy = e.targetY - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= 1.6) {
          e.x = e.targetX;
          e.y = e.targetY;
          e.state = 'attack';
          e.attackTimer = 0.7;
        } else {
          const step = Math.min(d, e.speed * enemyDt);
          e.x += (dx / d) * step;
          e.y += (dy / d) * step;
        }
      } else if (e.state === 'attack') {
        if (e.windup > 0) {
          e.windup -= enemyDt;
          if (e.windup <= 0) {
            damageBase(e.damage, { sourceX: e.x, sourceY: e.y });
            e.attackTimer = e.interval;
            e.windup = 0;
          }
        } else {
          e.attackTimer -= enemyDt;
          if (e.attackTimer <= 0) {
            e.windup = 0.6;
          }
        }
      }
    }

    // Расталкивание, чтобы враги не слипались в одну точку.
    for (let i = 0; i < run.enemies.length; i += 1) {
      const a = run.enemies[i];
      if (a.dead || a.state !== 'walk' || a.isBoss) continue;
      for (let j = i + 1; j < run.enemies.length; j += 1) {
        const b = run.enemies[j];
        if (b.dead || b.state !== 'walk' || b.isBoss) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = (a.size + b.size) * 0.62;
        if (d > 0.001 && d < min) {
          const push = (min - d) * 0.5;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
    run.enemies = run.enemies.filter((e) => !e.dead);
  }

  function updateParticles(dt) {
    if (!run) return;
    const ps = run.particles;
    for (let i = ps.length - 1; i >= 0; i -= 1) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 28 * dt;
    }
    const fs = run.floaters;
    for (let i = fs.length - 1; i >= 0; i -= 1) {
      const f = fs[i];
      f.life -= dt;
      if (f.life <= 0) {
        fs.splice(i, 1);
        continue;
      }
      f.y += f.vy * dt;
    }
    const ss = run.slashes;
    for (let i = ss.length - 1; i >= 0; i -= 1) {
      ss[i].life -= dt;
      if (ss[i].life <= 0) ss.splice(i, 1);
    }
  }

  function endWave() {
    if (!run || run.phase !== 'wave') return;
    run.phase = 'waveClear';
    run.waveClearTimer = 1.0;
    run.buffer = '';
    run.manualTargetId = null;
    run.activeTargetId = null;
    run.enemies = [];
    run.shield = 0;

    addScore(100 * run.wave);
    if (run.mistakesWave === 0 && run.damageWave === 0) {
      run.perfectWaves += 1;
      addScore(200 * run.wave);
      showToast('ВОЛНА БЕЗ ОШИБОК', 1500);
    }

    const baseHeal = Math.ceil(run.maxHp * 0.1) + 8 * stacks('restoration');
    const heal = run.waveMod === 'drypage'
      ? Math.max(1, Math.ceil(baseHeal * dryHealFactor()))
      : baseHeal;
    healBase(heal, true);
    addFloater(BASE.x, BASE.y - 26, `+${heal}`, '#8bd8a4');
    if (run.waveMod === 'drypage') {
      run.tokens += 1;
      showToast(`СУХАЯ СТРАНИЦА: ЛЕЧЕНИЕ −${Math.round((1 - dryHealFactor()) * 100)}% · +1 ЖЕТОН`, 2100);
    }
    if (has('bloody')) {
      const curse = Math.min(6, Math.max(0, run.hp - 1));
      if (curse > 0) {
        run.hp -= curse;
        run.totalDamage += curse;
        addFloater(BASE.x, BASE.y - 20, `−${curse}`, '#ff8a8a');
      }
    }
    if (run.wave % 5 === 0) {
      run.tokens += 1;
      if (has('librarian')) {
        run.tokens += stacks('librarian');
        showToast(`БОСС: +1 ЖЕТОН · БИБЛИОТЕКАРЬ: +${stacks('librarian')}`, 1700);
      } else {
        showToast('БОСС ПОБЕЖДЕН: +1 ЖЕТОН', 1500);
      }
    }
    AudioSys.waveClear();
    updateHud();
    updateTargetUI();
    updateBossBar();
  }

  function showUpgradeScreen() {
    if (!run) return;
    run.phase = 'upgrade';
    run.choosing = false;
    run.offer = generateOffer();
    dom.upgradeWave.textContent = String(run.wave);
    dom.upgradeTokens.textContent = String(run.tokens);
    dom.rerollBtn.disabled = run.tokens < 1;
    renderOffer();
    showScreen(dom.upgradeScreen);
    setMode('upgrade');
    AudioSys.upgrade();
  }

  // ------------------------------------------------------------------
  // Улучшения
  // ------------------------------------------------------------------

  function currentWeights(wave) {
    let weights = D.RARITY_WEIGHTS[D.RARITY_WEIGHTS.length - 1].weights;
    for (const row of D.RARITY_WEIGHTS) {
      if (wave <= row.maxWave) {
        weights = row.weights;
        break;
      }
    }
    return weights;
  }

  function weightedRarity(weights, allowed) {
    const entries = Object.entries(weights).filter(([key]) => !allowed || allowed.includes(key));
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    let roll = run.rng() * total;
    for (const [key, value] of entries) {
      roll -= value;
      if (roll <= 0) return key;
    }
    return entries.length ? entries[entries.length - 1][0] : 'common';
  }

  function availableCards(rarity, exclude) {
    return Object.values(D.UPGRADES).filter((u) => (
      u.rarity === rarity
      && stacks(u.id) < u.max
      && !exclude.has(u.id)
    ));
  }

  function anyAvailableCards(exclude) {
    return Object.values(D.UPGRADES).filter((u) => stacks(u.id) < u.max && !exclude.has(u.id));
  }

  function chooseCardForSlot(rarity, exclude, preferredTags) {
    let pool = availableCards(rarity, exclude);
    if (preferredTags && pool.length) {
      const preferred = pool.filter((u) => preferredTags.includes(u.tag));
      if (preferred.length) pool = preferred;
    }
    if (!pool.length) {
      const all = anyAvailableCards(exclude).filter((u) => u.rarity === rarity);
      if (all.length) pool = all;
    }
    if (!pool.length) return null;
    return pick(run.rng, pool);
  }

  function dominantTag() {
    if (!run) return null;
    const counts = {};
    Object.entries(run.upgrades).forEach(([id, count]) => {
      const def = D.UPGRADES[id];
      if (def) counts[def.tag] = (counts[def.tag] || 0) + count;
    });
    let best = null;
    let bestCount = 0;
    Object.entries(counts).forEach(([tag, count]) => {
      if (count > bestCount) {
        best = tag;
        bestCount = count;
      }
    });
    return best;
  }

  function generateOffer(excludeIds = []) {
    const count = 3 + (has('catalog') ? 1 : 0) + (has('greed') ? 2 : 0);
    const weights = currentWeights(run.wave + (run.wave % 5 === 0 ? 2 : 0));
    const exclude = new Set(excludeIds);
    const offer = [];
    const slots = Math.min(6, Math.max(3, count));

    for (let i = 0; i < slots; i += 1) {
      let rarity;
      let preferredTags = null;
      if (i === 2) {
        if (run.pity.legendary >= 8) {
          rarity = 'legendary';
        } else if (run.pity.epic >= 2) {
          rarity = weightedRarity({ epic: 82, legendary: 18 }, ['epic', 'legendary']);
        } else if (run.wave >= 12) {
          rarity = weightedRarity(weights, ['epic', 'legendary']);
        } else if (run.wave >= 4) {
          rarity = weightedRarity(weights, ['rare', 'epic', 'legendary']);
        } else {
          rarity = weightedRarity(weights);
        }
        if (run.hp < run.maxHp * 0.35) {
          preferredTags = ['База', 'Контроль'];
        } else if (run.rng() < 0.6) {
          const tag = dominantTag();
          if (tag) preferredTags = [tag];
        }
      } else {
        rarity = weightedRarity(weights);
      }

      let card = chooseCardForSlot(rarity, exclude, preferredTags);
      if (!card) {
        const remaining = anyAvailableCards(exclude);
        if (remaining.length) {
          card = pick(run.rng, remaining);
          rarity = card.rarity;
        }
      }
      if (!card) {
        offer.push({ fallback: true, card: null, rarity: 'common' });
        continue;
      }
      exclude.add(card.id);
      offer.push({ fallback: false, card, rarity: card.rarity });
    }

    // Проклятая страница заменяет второй слот.
    if (run.wave >= 6 && offer.length >= 2) {
      const chance = run.wave >= 16 ? 0.15 : run.wave >= 11 ? 0.12 : 0.08;
      if (run.rng() < chance) {
        const pool = availableCards('cursed', exclude);
        if (pool.length) {
          const card = pick(run.rng, pool);
          exclude.add(card.id);
          offer[1] = { fallback: false, card, rarity: 'cursed' };
        }
      }
    }

    // Заполняем пустые слоты лечением.
    while (offer.length < slots) {
      offer.push({ fallback: true, card: null, rarity: 'common' });
    }

    const offeredRarities = offer.filter((o) => !o.fallback).map((o) => o.card.rarity);
    const hasEpicPlus = offeredRarities.some((r) => r === 'epic' || r === 'legendary');
    const hasLegendary = offeredRarities.includes('legendary');
    if (hasEpicPlus) run.pity.epic = 0;
    else run.pity.epic += 1;
    if (hasLegendary) run.pity.legendary = 0;
    else run.pity.legendary += 1;

    run.lastOfferIds = offer.map((o) => (o.card ? o.card.id : '__heal'));
    return offer;
  }

  function rarityMeta(rarity) {
    return D.RARITIES[rarity] || D.RARITIES.common;
  }

  function tagColor(tag) {
    return D.TAG_COLORS[tag] || '#9aa4a1';
  }

  function renderOffer() {
    if (!run || !run.offer) return;
    dom.cards.innerHTML = '';
    dom.cards.scrollTop = 0;
    dom.cards.classList.toggle('many', run.offer.length >= 5);
    run.offer.forEach((entry, index) => {
      const rarity = rarityMeta(entry.rarity);
      const cardDef = entry.card;
      const name = entry.fallback ? 'Лечение' : cardDef.name;
      const tag = entry.fallback ? 'База' : cardDef.tag;
      const flavor = entry.fallback ? 'Здоровье важнее новой карты.' : cardDef.flavor;
      const s = entry.fallback ? 0 : stacks(cardDef.id);
      const max = entry.fallback ? 0 : cardDef.max;
      const description = entry.fallback
        ? 'Восстанавливает 20 HP. Появляется, когда других улучшений не осталось.'
        : cardDef.desc(s);
      const button = document.createElement('button');
      button.className = `card${entry.rarity === 'cursed' ? ' cursed' : ''}`;
      button.style.setProperty('--rarity', rarity.color);
      button.style.setProperty('--tag', tagColor(tag));
      button.setAttribute('aria-label', `${name}. ${description}`);
      button.innerHTML = `
        <div class="card-rarity">
          <span><span class="r-icon">${rarity.icon}</span> ${rarity.name}</span>
          <span class="card-stack">${entry.fallback ? '∞' : `${s}/${max}`}</span>
        </div>
        <div class="card-name">${name}</div>
        <div class="card-tag">${tag}</div>
        <div class="card-desc">${description}</div>
        <div class="card-flavor">${flavor}</div>
        <div class="card-key">[${index + 1}]</div>
      `;
      button.addEventListener('click', () => chooseOffer(index));
      dom.cards.appendChild(button);
    });
  }

  function applyUpgrade(id) {
    const def = D.UPGRADES[id];
    if (!run || !def) return;
    const current = stacks(id);
    if (current >= def.max) return;
    run.upgrades[id] = current + 1;
    if (id === 'binding') {
      run.maxHp += 15;
      healBase(15);
    }
    if (id === 'token') {
      run.tokens += 1;
    }
    if (id === 'glasscannon') {
      run.maxHp = Math.max(30, Math.floor(run.maxHp * 0.7));
      run.hp = Math.min(run.hp, run.maxHp);
    }
    updateHud();
  }

  function chooseOffer(index) {
    if (!run || mode !== 'upgrade' || run.choosing) return;
    const entry = run.offer && run.offer[index];
    if (!entry) return;
    run.choosing = true;
    if (entry.fallback) {
      healBase(20);
      showToast('ЛЕЧЕНИЕ: +20 HP', 1400);
    } else {
      applyUpgrade(entry.card.id);
      showToast(`ВЗЯТО: ${entry.card.name.toUpperCase()}`, 1400);
    }
    AudioSys.upgrade();
    updateHud();
    hideScreens();
    setMode('playing');
    dom.stage.focus({ preventScroll: true });
    run.phase = 'between';
    run.waveTimer = 0.62;
    run.buffer = '';
    run.manualTargetId = null;
    run.activeTargetId = null;
  }

  function skipOffer() {
    if (!run || mode !== 'upgrade' || run.choosing) return;
    run.choosing = true;
    healBase(15);
    showToast('ПРОПУЩЕНО: +15 HP', 1200);
    AudioSys.upgrade();
    hideScreens();
    setMode('playing');
    dom.stage.focus({ preventScroll: true });
    run.phase = 'between';
    run.waveTimer = 0.62;
  }

  function rerollOffer() {
    if (!run || mode !== 'upgrade' || run.choosing) return;
    if (run.tokens < 1) return;
    run.tokens -= 1;
    run.offer = generateOffer(run.lastOfferIds);
    dom.upgradeTokens.textContent = String(run.tokens);
    dom.rerollBtn.disabled = run.tokens < 1;
    renderOffer();
    AudioSys.upgrade();
    updateHud();
  }

  // ------------------------------------------------------------------
  // Пауза, меню, конец забега
  // ------------------------------------------------------------------

  function pauseGame() {
    if (!run || mode !== 'playing') return;
    if (run.phase === 'upgrade') return;
    setMode('paused');
    showScreen(dom.pauseScreen);
    updatePauseStats();
    dom.resumeBtn.focus({ preventScroll: true });
    AudioSys.setMusicVolume(0.12);
    run.pausedAt = Date.now();
  }

  function resumeGame() {
    if (!run || mode !== 'paused') return;
    if (run.pausedAt) {
      run.totalPaused += Date.now() - run.pausedAt;
      run.pausedAt = 0;
    }
    hideScreens();
    setMode('playing');
    AudioSys.setMusicVolume(0.24);
    dom.stage.focus({ preventScroll: true });
  }

  function updatePauseStats() {
    if (!run) return;
    const mod = run.waveMod ? D.WAVE_MODIFIERS[run.waveMod] : null;
    const edition = editionForWave(run.wave);
    dom.pauseStats.textContent = `Волна ${run.wave}/${TOTAL_WAVES} · ${edition.name}${mod ? ` · ${mod.name}` : ''} · здоровье ${Math.ceil(run.hp)} HP · серия ${run.combo}`;
  }

  function openHelp(returnTo) {
    helpReturn = returnTo;
    hideScreens();
    showScreen(dom.helpScreen);
    setMode('help');
    dom.helpCloseBtn.focus({ preventScroll: true });
  }

  function closeHelp() {
    hideScreens();
    if (helpReturn === 'paused' && run) {
      showScreen(dom.pauseScreen);
      setMode('paused');
      updatePauseStats();
      dom.resumeBtn.focus({ preventScroll: true });
    } else {
      showScreen(dom.menuScreen);
      setMode('menu');
      dom.startBtn.focus({ preventScroll: true });
    }
  }

  function goMenu() {
    run = null;
    AudioSys.stopMusic();
    hideScreens();
    showScreen(dom.menuScreen);
    setMode('menu');
    dom.bossBar.classList.remove('show');
    updateBest();
    dom.startBtn.focus({ preventScroll: true });
  }

  function restartRun() {
    if (!run) return;
    const diff = run.diff.id;
    hideScreens();
    startRun(diff);
  }

  function gameOver() {
    if (!run || mode === 'gameover' || mode === 'victory') return;
    run.endReason = 'base';
    run.endedAt = Date.now();
    AudioSys.stopMusic();
    AudioSys.defeat();
    finishRun(false);
  }

  function victory() {
    if (!run || mode === 'victory') return;
    addScore(5000 + Math.max(0, Math.floor(run.hp)) * 50);
    run.endReason = 'victory';
    run.endedAt = Date.now();
    AudioSys.stopMusic();
    AudioSys.victory();
    finishRun(true);
  }

  function finishRun(won) {
    if (!run) return;
    if (run.score > bestScore) {
      bestScore = run.score;
      saveJson(BEST_KEY, bestScore);
    }
    updateBest();
    setMode(won ? 'victory' : 'gameover');
    hideScreens();
    showScreen(dom.endScreen);
    dom.endEyebrow.textContent = won ? 'СЛОВАРЬ СПАСЁН' : 'ЗАБЕГ ЗАВЕРШЁН';
    dom.endTitle.textContent = won ? 'ПОБЕДА' : 'СЛОВАРЬ ПАЛ';
    dom.endTitle.className = won ? 'victory' : 'defeat';
    dom.endSubtitle.textContent = won
      ? 'Последняя редакция побеждена. Словарь снова полон слов.'
      : `Тишина добралась до базы на волне ${run.wave}. Но слова ещё можно вернуть.`;
    const accuracy = run.keystrokes > 0 ? Math.round((run.correctKeys / run.keystrokes) * 100) : 100;
    const elapsed = ((run.endedAt || Date.now()) - run.startedAt - (run.totalPaused || 0)) / 1000;
    const stats = [
      ['ВОЛНА', `${run.wave}/${TOTAL_WAVES}`],
      ['УБИЙСТВА', formatNum(run.kills)],
      ['СЧЁТ', formatNum(run.score)],
      ['ТОЧНОСТЬ', `${accuracy}%`],
      ['ЛУЧШАЯ СЕРИЯ', String(run.bestCombo)],
      ['ВРЕМЯ', formatTime(elapsed)],
      ['УРОН ПО БАЗЕ', formatNum(Math.round(run.totalDamage))],
      ['ВОЛНЫ БЕЗ ОШИБОК', String(run.perfectWaves)]
    ];
    dom.endStats.innerHTML = stats.map(([label, value]) => `
      <div class="end-stat">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${value}</span>
      </div>
    `).join('');
    const chosen = Object.keys(run.upgrades)
      .map((id) => ({ def: D.UPGRADES[id], count: run.upgrades[id] }))
      .filter((x) => x.def)
      .sort((a, b) => D.RARITIES[a.def.rarity].order - D.RARITIES[b.def.rarity].order);
    dom.endBuild.innerHTML = chosen.length
      ? chosen.map(({ def, count }) => `<span class="build-chip">${def.name}${count > 1 ? ` ×${count}` : ''}</span>`).join('')
      : '<span class="build-chip empty">Страниц не выбрано</span>';
    dom.againBtn.focus({ preventScroll: true });
  }

  function updateBest() {
    dom.bestScore.textContent = formatNum(bestScore);
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------

  function updateHud() {
    if (!run) return;
    dom.waveValue.textContent = `${run.wave}/${TOTAL_WAVES}`;
    dom.scoreValue.textContent = formatNum(run.score);
    dom.hpLabel.textContent = `${Math.max(0, Math.ceil(run.hp))} / ${run.maxHp}`;
    const ratio = clamp(run.hp / run.maxHp, 0, 1);
    dom.hpFill.style.width = `${ratio * 100}%`;
    dom.hpFill.classList.toggle('low', ratio < 0.3);
    dom.shieldLabel.textContent = run.shield > 0 ? String(Math.ceil(run.shield)) : '';
    dom.comboValue.textContent = run.combo > 0 ? `${run.combo} ×${comboMult().toFixed(2)}` : '0';
    dom.tokensValue.textContent = String(run.tokens);
    dom.killsValue.textContent = formatNum(run.kills);
    dom.enemiesValue.textContent = String(run.enemies.filter((e) => !e.dead).length);
    if (mode === 'upgrade') {
      dom.upgradeTokens.textContent = String(run.tokens);
      dom.rerollBtn.disabled = run.tokens < 1;
    }
    updateTargetUI();
    updateBossBar();
  }

  function updateTargetUI() {
    if (!run) return;
    const target = getActiveTarget();
    const buffer = run.buffer || '';
    const isBoss = !!(target && target.isBoss);
    dom.targetWord.classList.toggle('boss-sentence', isBoss);
    dom.bufferText.classList.toggle('boss-sentence', isBoss);
    const sig = [
      run.wave,
      run.activeTargetId,
      run.manualTargetId,
      buffer,
      target ? currentWord(target) : '',
      target ? target.wordIndex : 0,
      target ? currentPrefill(target) : 0,
      run.diff.strict ? 1 : 0
    ].join('|');
    if (sig === targetUiSig) return;
    targetUiSig = sig;
    if (!target) {
      dom.targetName.textContent = 'ЦЕЛЬ НЕ ВЫБРАНА';
      dom.targetHint.textContent = 'TAB — СМЕНИТЬ ЦЕЛЬ';
      dom.targetWord.innerHTML = '<span class="empty">—</span>';
    } else {
      const word = currentWord(target);
      const prefill = currentPrefill(target);
      const typedEnd = prefill + buffer.length;
      const chars = word.split('').map((ch, i) => {
        const shown = ch === ' ' ? '&nbsp;' : ch;
        if (i < prefill) return `<span class="auto">${shown}</span>`;
        if (i < typedEnd) return `<span class="typed">${shown}</span>`;
        return `<span class="rest">${shown}</span>`;
      });
      dom.targetWord.innerHTML = chars.join('');
      const remaining = Math.max(0, word.length - prefill - buffer.length);
      dom.targetName.textContent = target.isBoss
        ? `БОСС · ПРЕДЛОЖЕНИЕ · СЛОВ: ${target.wordIndex}/${target.words.length}`
        : `${target.name.toUpperCase()} · ОСТАЛОСЬ ${remaining} БУКВ`;
      dom.targetHint.textContent = run.manualTargetId === target.id
        ? 'ВЫБРАНО ВРУЧНУЮ · TAB — ДРУГАЯ'
        : target.isBoss
          ? 'МЕЖДУ СЛОВАМИ — ПРОБЕЛ'
          : 'TAB — ДРУГАЯ ЦЕЛЬ';
    }
    dom.bufferText.textContent = buffer ? buffer.toUpperCase() : '_';
    dom.bufferText.classList.toggle('invalid', run.diff.strict && buffer.length > 0 && !isValidBuffer(buffer));
  }

  function updateBossBar() {
    if (!run || !run.boss) {
      if (bossUiSig !== 'none') {
        bossUiSig = 'none';
        dom.bossBar.classList.remove('show');
      }
      return;
    }
    const boss = run.boss;
    const typed = bossTyped(boss);
    const sig = `${boss.id}|${boss.wordIndex}|${typed}|${run.activeTargetId}|${boss.words.join('')}`;
    if (sig === bossUiSig) return;
    bossUiSig = sig;
    dom.bossBar.classList.add('show');
    dom.bossName.textContent = boss.name;
    let cursor = 0;
    dom.bossPhrase.innerHTML = boss.words.map((word, i) => {
      const start = cursor;
      const end = start + word.length;
      cursor = end + 1;
      if (i < boss.wordIndex) {
        return `<span class="done">${word.toUpperCase()}</span>`;
      }
      if (i === boss.wordIndex) {
        const typedInWord = clamp(typed.length - start, 0, word.length);
        const letters = word.split('').map((ch, j) => {
          const cls = j < typedInWord ? 'typed' : 'rest';
          return `<span class="${cls}">${ch.toUpperCase()}</span>`;
        }).join('');
        return `<span class="current">${letters}</span>`;
      }
      return `<span>${word.toUpperCase()}</span>`;
    }).join(' ');
    dom.bossPips.innerHTML = boss.words.map((_, i) => (
      `<span class="boss-pip ${i < boss.wordIndex ? 'done' : ''}"></span>`
    )).join('');
  }

  // ------------------------------------------------------------------
  // Настройки и обработчики
  // ------------------------------------------------------------------

  function persistSettings() {
    saveJson(SETTINGS_KEY, settings);
  }

  function applySettings() {
    AudioSys.setEnabled(settings.sound);
    document.body.classList.toggle('reduce-motion', !settings.motion);
    updateSettingLabels();
  }

  function updateSettingLabels() {
    dom.menuSoundBtn.textContent = `ЗВУК: ${settings.sound ? 'ВКЛ' : 'ВЫКЛ'}`;
    dom.pauseSoundBtn.innerHTML = `ЗВУК <span>${settings.sound ? 'ВКЛ' : 'ВЫКЛ'}</span>`;
    dom.pauseShakeBtn.innerHTML = `ТРЯСКА <span>${settings.shake ? 'ВКЛ' : 'ВЫКЛ'}</span>`;
    dom.pauseMotionBtn.innerHTML = `АНИМАЦИИ <span>${settings.motion ? 'ПОЛНЫЕ' : 'МЕНЬШЕ'}</span>`;
  }

  function toggleSound() {
    settings.sound = !settings.sound;
    persistSettings();
    AudioSys.setEnabled(settings.sound);
    if (settings.sound && audioStarted) AudioSys.startMusic();
    if (!settings.sound) AudioSys.stopMusic();
    updateSettingLabels();
  }

  function toggleShake() {
    settings.shake = !settings.shake;
    persistSettings();
    updateSettingLabels();
  }

  function toggleMotion() {
    settings.motion = !settings.motion;
    persistSettings();
    document.body.classList.toggle('reduce-motion', !settings.motion);
    updateSettingLabels();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      return;
    }
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  function updateFullscreenLabels() {
    const active = !!document.fullscreenElement;
    const label = active ? 'ОБЫЧНЫЙ ЭКРАН' : 'НА ВЕСЬ ЭКРАН';
    if (dom.menuFullscreenBtn) dom.menuFullscreenBtn.textContent = label;
    if (dom.pauseFullscreenBtn) dom.pauseFullscreenBtn.textContent = label;
  }

  function selectDifficulty(id) {
    selectedDiff = id;
    dom.difficultyPicker.querySelectorAll('.diff-card').forEach((card) => {
      const active = card.dataset.diff === id;
      card.classList.toggle('selected', active);
      card.setAttribute('aria-checked', active ? 'true' : 'false');
    });
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const onButton = event.target && event.target.closest && event.target.closest('button');

    if (mode === 'menu') {
      if (event.key === 'Enter' && !onButton) {
        event.preventDefault();
        startRun(selectedDiff);
      }
      return;
    }

    if (mode === 'help') {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeHelp();
      }
      return;
    }

    if (mode === 'paused') {
      if (event.key === 'Escape') {
        event.preventDefault();
        resumeGame();
      }
      return;
    }

    if (mode === 'upgrade') {
      if (event.repeat) return;
      if (/^[1-6]$/.test(event.key)) {
        event.preventDefault();
        chooseOffer(Number(event.key) - 1);
        return;
      }
      if (event.code === 'KeyR' || event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'к') {
        event.preventDefault();
        rerollOffer();
        return;
      }
      if (event.code === 'KeyS' || event.key.toLowerCase() === 's' || event.key.toLowerCase() === 'ы') {
        event.preventDefault();
        skipOffer();
      }
      return;
    }

    if (mode === 'gameover' || mode === 'victory') {
      if (event.key === 'Enter' && !onButton) {
        event.preventDefault();
        if (run) startRun(run.diff.id);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        goMenu();
      }
      return;
    }

    if (mode !== 'playing') return;

    if (event.key === 'Escape') {
      event.preventDefault();
      pauseGame();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      cycleTarget();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (!run || event.repeat) return;
      updateActiveTarget();
      const target = getActiveTarget();
      if (target && target.isBoss && run.buffer.length > 0 && !run.buffer.endsWith(' ')) {
        const next = run.buffer + ' ';
        if (target.sentence.startsWith(next)) typeLetter(' ');
      }
      return;
    }
    if (event.repeat) return;

    let key = event.key;
    if (key === 'ё' || key === 'Ё') key = 'е';
    key = key.toLowerCase();
    if (/^[а-я]$/.test(key)) {
      event.preventDefault();
      typeLetter(key);
      return;
    }
    if (/^[a-z]$/i.test(key)) {
      if (run && run.buffer.length === 0) {
        showToast('ПЕРЕКЛЮЧИ РАСКЛАДКУ НА РУССКУЮ', 1600);
      }
    }
  }

  function onPointerDown(event) {
    if (mode !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    selectEnemyAt(x, y);
    dom.stage.focus({ preventScroll: true });
  }

  function onBlur() {
    if (mode === 'playing' && run && run.phase !== 'upgrade') {
      pauseGame();
    }
  }

  function init() {
    loadJson(SETTINGS_KEY, {});
    applySettings();
    updateFullscreenLabels();
    updateBest();
    selectDifficulty(selectedDiff);

    dom.startBtn.addEventListener('click', () => startRun(selectedDiff));
    dom.difficultyPicker.addEventListener('click', (event) => {
      const card = event.target.closest('.diff-card');
      if (card) selectDifficulty(card.dataset.diff);
    });
    dom.helpBtn.addEventListener('click', () => openHelp('menu'));
    dom.menuSoundBtn.addEventListener('click', toggleSound);
    dom.menuFullscreenBtn.addEventListener('click', toggleFullscreen);
    dom.helpCloseBtn.addEventListener('click', closeHelp);
    dom.rerollBtn.addEventListener('click', rerollOffer);
    dom.skipBtn.addEventListener('click', skipOffer);
    dom.resumeBtn.addEventListener('click', resumeGame);
    dom.pauseHelpBtn.addEventListener('click', () => openHelp('paused'));
    dom.restartBtn.addEventListener('click', restartRun);
    dom.pauseMenuBtn.addEventListener('click', goMenu);
    dom.pauseSoundBtn.addEventListener('click', toggleSound);
    dom.pauseShakeBtn.addEventListener('click', toggleShake);
    dom.pauseMotionBtn.addEventListener('click', toggleMotion);
    dom.pauseFullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenLabels);
    dom.againBtn.addEventListener('click', () => {
      if (run) startRun(run.diff.id);
    });
    dom.endMenuBtn.addEventListener('click', goMenu);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onBlur();
    });

    showScreen(dom.menuScreen);
    setMode('menu');
    updateBest();
    requestAnimationFrame(loop);
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    visualTime += dt;
    updateUiTimers(dt);
    if (mode === 'playing' && run) {
      updateRun(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // Рендер
  // ------------------------------------------------------------------

  const bgRng = makeRng(91337);
  const bgBooks = [];
  for (let row = 0; row < 4; row += 1) {
    const y = 18 + row * 61;
    let x = -4;
    while (x < W + 8) {
      const w = 3 + Math.floor(bgRng() * 5);
      const h = 12 + Math.floor(bgRng() * 14);
      bgBooks.push({
        x,
        y: y + 20 - h,
        w,
        h,
        color: pick(bgRng, ['#18241d', '#211d17', '#1b2029', '#241a20', '#1d2a21'])
      });
      x += w + 2 + Math.floor(bgRng() * 2);
    }
  }

  const dustMotes = [];
  for (let i = 0; i < 30; i += 1) {
    dustMotes.push({
      x: bgRng() * W,
      y: bgRng() * H,
      speed: 2 + bgRng() * 5,
      size: bgRng() < 0.72 ? 1 : 2,
      phase: bgRng() * Math.PI * 2,
      alpha: 0.08 + bgRng() * 0.18
    });
  }

  const menuLetters = [];
  {
    const chars = 'СЛОВОБОЙПОСЛЕДНИЙСЛОВАРЬ';
    for (let i = 0; i < 18; i += 1) {
      menuLetters.push({
        ch: chars[Math.floor(bgRng() * chars.length)],
        x: 12 + bgRng() * (W - 24),
        y: bgRng() * H,
        speed: 3 + bgRng() * 7,
        size: 7 + Math.floor(bgRng() * 7),
        phase: bgRng() * Math.PI * 2,
        alpha: 0.05 + bgRng() * 0.12
      });
    }
  }

  function pxRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function pxLine(x1, y1, x2, y2, color, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    ctx.stroke();
  }

  function drawBackground() {
    pxRect(0, 0, W, H, '#070a08');

    const glow = ctx.createRadialGradient(BASE.x, BASE.y + 2, 6, BASE.x, BASE.y + 2, 118);
    glow.addColorStop(0, 'rgba(74, 93, 72, 0.16)');
    glow.addColorStop(0.5, 'rgba(32, 48, 38, 0.08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(70, 10, 340, 250);

    // Дальние полки с книгами.
    for (const book of bgBooks) {
      ctx.globalAlpha = 0.48;
      pxRect(book.x, book.y, book.w, book.h, book.color);
      pxRect(book.x, book.y, book.w, 1, 'rgba(230, 210, 160, 0.08)');
    }
    ctx.globalAlpha = 1;

    for (let row = 0; row < 4; row += 1) {
      const y = 38 + row * 61;
      pxRect(0, y, W, 2, '#0d1510');
      pxRect(0, y + 2, W, 1, '#050806');
    }

    // Пыль и парящие частицы.
    for (const mote of dustMotes) {
      const y = (mote.y - visualTime * mote.speed) % (H + 16);
      const yy = y < -8 ? y + H + 16 : y;
      const xx = mote.x + Math.sin(visualTime * 0.35 + mote.phase) * 7;
      ctx.globalAlpha = mote.alpha * (0.65 + Math.sin(visualTime + mote.phase) * 0.35);
      pxRect(xx, yy, mote.size, mote.size, '#d8c894');
    }
    ctx.globalAlpha = 1;

    // Тёмный пол.
    pxRect(0, H - 18, W, 18, '#060907');
    pxRect(0, H - 19, W, 1, '#111a14');

    // Нарастающая тишина по краям.
    if (run) {
      const hpRatio = clamp(run.hp / run.maxHp, 0, 1);
      const silence = (1 - hpRatio) * 0.35;
      const left = ctx.createLinearGradient(0, 0, 38, 0);
      left.addColorStop(0, `rgba(2, 4, 3, ${0.28 + silence})`);
      left.addColorStop(1, 'rgba(2, 4, 3, 0)');
      ctx.fillStyle = left;
      ctx.fillRect(0, 0, 38, H);
      const right = ctx.createLinearGradient(W, 0, W - 38, 0);
      right.addColorStop(0, `rgba(2, 4, 3, ${0.28 + silence})`);
      right.addColorStop(1, 'rgba(2, 4, 3, 0)');
      ctx.fillStyle = right;
      ctx.fillRect(W - 38, 0, 38, H);
    }
  }

  function drawBase() {
    const hpRatio = run ? clamp(run.hp / run.maxHp, 0, 1) : 1;
    const shield = run ? run.shield : 0;
    const maxShield = run ? run.maxShield : 0;
    const bx = BASE.x;
    const by = BASE.y;

    ctx.save();
    ctx.translate(bx, by);

    const pulse = 0.72 + Math.sin(visualTime * 2.2) * 0.12;
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 64);
    glow.addColorStop(0, `rgba(242, 193, 78, ${0.16 * pulse})`);
    glow.addColorStop(0.45, `rgba(188, 142, 48, ${0.08 * pulse})`);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-64, -64, 128, 128);

    // Тень.
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#020403';
    ctx.beginPath();
    ctx.ellipse(0, 17, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Обложка.
    pxRect(-25, -12, 50, 26, '#24160d');
    pxRect(-25, -12, 50, 3, '#372314');
    pxRect(-25, 12, 50, 2, '#160d07');

    // Страницы.
    ctx.fillStyle = '#d9c99d';
    ctx.beginPath();
    ctx.moveTo(-23, -7);
    ctx.lineTo(-3, -12);
    ctx.lineTo(-3, 12);
    ctx.lineTo(-23, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f0e2b9';
    ctx.beginPath();
    ctx.moveTo(23, -7);
    ctx.lineTo(3, -12);
    ctx.lineTo(3, 12);
    ctx.lineTo(23, 8);
    ctx.closePath();
    ctx.fill();

    // Корешок.
    pxRect(-3, -12, 6, 25, '#6d4b2b');
    pxRect(-1, -11, 2, 23, '#9b7040');

    // Строки на страницах.
    pxRect(-19, -2, 12, 1, '#9e8b60');
    pxRect(-19, 2, 14, 1, '#9e8b60');
    pxRect(-19, 6, 10, 1, '#9e8b60');
    pxRect(7, -2, 12, 1, '#b5a171');
    pxRect(7, 2, 14, 1, '#b5a171');
    pxRect(7, 6, 10, 1, '#b5a171');

    // Золотая руна на корешке.
    pxRect(-1, -6, 2, 4, '#f2c14e');
    pxRect(-2, -4, 4, 2, '#f2c14e');
    pxRect(0, -8, 1, 2, '#ffe29a');

    // Трещины при потере HP.
    if (hpRatio < 0.72) {
      ctx.strokeStyle = '#3a2416';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-18, -5);
      ctx.lineTo(-12, 1);
      ctx.lineTo(-15, 5);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    }
    if (hpRatio < 0.4) {
      ctx.strokeStyle = '#311b12';
      ctx.beginPath();
      ctx.moveTo(9, -8);
      ctx.lineTo(14, -1);
      ctx.lineTo(11, 4);
      ctx.lineTo(18, 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2, -11);
      ctx.lineTo(2, -5);
      ctx.lineTo(-1, 1);
      ctx.stroke();
    }

    // Щит.
    if (shield > 0 || maxShield > 0) {
      ctx.globalAlpha = shield > 0 ? 0.55 + Math.sin(visualTime * 4) * 0.12 : 0.18;
      const segments = 16;
      for (let i = 0; i < segments; i += 1) {
        const a = (i / segments) * Math.PI * 2 + visualTime * 0.15;
        const sx = Math.cos(a) * 32;
        const sy = Math.sin(a) * 32;
        pxRect(sx - 1, sy - 1, 2, 2, '#66c7b5');
      }
      ctx.globalAlpha = 1;
    }

    // Красное свечение при критическом HP.
    if (hpRatio < 0.35) {
      ctx.globalAlpha = 0.18 + Math.sin(visualTime * 6) * 0.06;
      ctx.fillStyle = '#e05252';
      ctx.beginPath();
      ctx.arc(0, 0, 37, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function measureTag(word, fontSize, weight) {
    ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`;
    const chars = word.split('');
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((sum, w) => sum + w + 0.9, 0);
    return {
      chars,
      widths,
      w: Math.ceil(total) + 7,
      h: fontSize + 7
    };
  }

  function buildTag(enemy, active) {
    const word = currentWord(enemy).toUpperCase();
    if (!word) return null;
    const fontSize = enemy.isBoss ? 13 : active ? 12 : 11;
    const weight = enemy.isBoss || active ? 700 : 500;
    const measured = measureTag(word, fontSize, weight);
    let x = clamp(Math.round(enemy.x - measured.w / 2), 2, W - measured.w - 2);
    const topLimit = run && run.boss ? 76 : SAFE_TOP;
    let y = Math.round(enemy.y - enemy.size - 10 - measured.h);
    y = clamp(y, topLimit, SAFE_BOTTOM - measured.h);
    return {
      enemy,
      active,
      word,
      chars: measured.chars,
      widths: measured.widths,
      w: measured.w,
      h: measured.h,
      x,
      y,
      fontSize,
      weight
    };
  }

  function tagsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawEnemyBody(enemy) {
    if (enemy.isBoss) {
      drawBossBody(enemy);
      return;
    }
    const wob = settings.motion ? Math.sin(visualTime * 5 + enemy.id * 1.7) : 0;
    const windupShift = enemy.windup > 0 ? 2 : 0;
    const towardX = enemy.state === 'attack' ? Math.cos(enemy.angle) * windupShift : 0;
    const towardY = enemy.state === 'attack' ? Math.sin(enemy.angle) * windupShift : 0;

    ctx.save();
    ctx.translate(Math.round(enemy.x + towardX), Math.round(enemy.y + towardY));

    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#020403';
    ctx.beginPath();
    ctx.ellipse(0, enemy.size * 0.62, enemy.size * 0.72, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    let w = Math.max(6, enemy.size * 0.95);
    let h = Math.max(7, enemy.size * 1.08);
    if (enemy.type === 'R') {
      w *= 0.7;
      h *= 1.08;
    }
    if (enemy.type === 'H') {
      w *= 1.18;
      h *= 0.92;
    }
    if (enemy.type === 'A') {
      w *= 1.2;
    }
    if (enemy.type === 'SHARD') {
      w *= 0.8;
      h *= 0.85;
    }

    // Тёмный контур.
    pxRect(-w / 2 - 1, -h / 2 - 1 + wob, w + 2, h + 2, '#050706');

    if (enemy.type === 'D') {
      // Делец — две доли.
      pxRect(-w / 2, -h / 2 + 2 + wob, w * 0.4, h - 3, enemy.body);
      pxRect(w * 0.1, -h / 2 + 2 + wob, w * 0.4, h - 3, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 3 + wob, w * 0.22, 2, enemy.light);
      pxRect(w * 0.18, -h / 2 + 3 + wob, w * 0.22, 2, enemy.light);
      pxRect(-w * 0.28, -1 + wob, 2, 2, enemy.eye);
      pxRect(w * 0.24, -1 + wob, 2, 2, enemy.eye);
      pxRect(-w * 0.2, h / 2 - 2, 2, 2, '#2a1810');
      pxRect(w * 0.28, h / 2 - 2, 2, 2, '#2a1810');
    } else if (enemy.type === 'A') {
      // Броненосец — панцирь и голова.
      pxRect(-w / 2, -h / 2 + 3 + wob, w, h - 5, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 4 + wob, w - 2, 2, enemy.light);
      pxRect(-w / 2 + 1, 0 + wob, w - 2, 2, enemy.light);
      pxRect(-w / 2 + 2, h / 2 - 2, 3, 2, '#2a2418');
      pxRect(w / 2 - 5, h / 2 - 2, 3, 2, '#2a2418');
      pxRect(-4, -h / 2 + 1 + wob, 8, 4, enemy.light);
      pxRect(-2, -h / 2 + 2 + wob, 2, 2, enemy.eye);
    } else if (enemy.type === 'K') {
      // Хранитель — аура над головой.
      pxRect(-w / 2, -h / 2 + 3 + wob, w, h - 4, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 4 + wob, w - 2, 2, enemy.light);
      const haloY = -h / 2 - 5 + Math.sin(visualTime * 3 + enemy.id) * 1.5;
      pxRect(-6, haloY, 12, 1, '#f2c14e');
      pxRect(-7, haloY + 1, 2, 1, '#f2c14e');
      pxRect(5, haloY + 1, 2, 1, '#f2c14e');
      pxRect(-3, -2 + wob, 2, 2, enemy.eye);
      pxRect(2, -2 + wob, 2, 2, enemy.eye);
    } else if (enemy.type === 'J') {
      // Прыгун — пружина снизу.
      pxRect(-w / 2, -h / 2 + 1 + wob, w, h - 3, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 2 + wob, w - 2, 2, enemy.light);
      pxRect(-4, h / 2 - 2, 2, 3, '#9bd39d');
      pxRect(-1, h / 2, 2, 2, '#9bd39d');
      pxRect(2, h / 2 - 2, 2, 3, '#9bd39d');
      pxRect(-3, -2 + wob, 2, 2, enemy.eye);
      pxRect(2, -2 + wob, 2, 2, enemy.eye);
    } else if (enemy.type === 'SHARD') {
      pxRect(-w / 2, -h / 2 + 1 + wob, w, h - 2, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 2 + wob, w - 2, 1, enemy.light);
      pxRect(-1, -1 + wob, 2, 2, enemy.eye);
      pxRect(-w / 2 - 1, h / 2 - 3, 2, 2, enemy.body);
      pxRect(w / 2 - 1, h / 2 - 3, 2, 2, enemy.body);
    } else {
      // Шептун, Бегун, Тяжеловес.
      pxRect(-w / 2, -h / 2 + 2 + wob, w, h - 3, enemy.body);
      pxRect(-w / 2 + 1, -h / 2 + 3 + wob, w - 2, 2, enemy.light);
      if (enemy.type === 'R') {
        pxRect(-w / 2 + 1, h / 2 - 1, 2, 3, enemy.body);
        pxRect(w / 2 - 3, h / 2 - 1, 2, 3, enemy.body);
      }
      if (enemy.type === 'H') {
        pxRect(-w / 2, -h / 2 - 2 + wob, 3, 3, enemy.light);
        pxRect(w / 2 - 3, -h / 2 - 2 + wob, 3, 3, enemy.light);
      }
      pxRect(-w / 4 - 1, -2 + wob, 2, 2, enemy.eye);
      pxRect(w / 4 - 1, -2 + wob, 2, 2, enemy.eye);
      // Нижние чернильные капли.
      pxRect(-w / 2 + 2, h / 2 - 1, 2, 2, enemy.body);
      pxRect(w / 2 - 4, h / 2 - 1, 2, 2, enemy.body);
    }

    if (enemy.elite || enemy.redMarked) {
      const color = enemy.elite ? '#f2c14e' : '#ff5a5a';
      ctx.globalAlpha = enemy.redMarked ? 0.42 + Math.sin(visualTime * 7 + enemy.id) * 0.18 : 0.82;
      const x0 = Math.round(-w / 2 - 3);
      const y0 = Math.round(-h / 2 - 3 + wob);
      const ww = Math.ceil(w + 6);
      const hh = Math.ceil(h + 6);
      pxRect(x0, y0, ww, 1, color);
      pxRect(x0, y0 + hh - 1, ww, 1, color);
      pxRect(x0, y0, 1, hh, color);
      pxRect(x0 + ww - 1, y0, 1, hh, color);
      ctx.globalAlpha = 1;
      if (enemy.elite) {
        const crownY = Math.round(-h / 2 - 10 + wob);
        pxRect(-6, crownY + 2, 2, 2, color);
        pxRect(0, crownY, 2, 4, color);
        pxRect(6, crownY + 2, 2, 2, color);
      }
    }

    if (enemy.windup > 0) {
      ctx.globalAlpha = 0.18 + Math.sin(visualTime * 22) * 0.08;
      pxRect(-w / 2 - 2, -h / 2 - 2 + wob, w + 4, h + 4, '#e05252');
      ctx.globalAlpha = 1;
    }

    if (enemy.stagger > 0) {
      const sy = -h / 2 - 8;
      pxRect(-6, sy, 2, 2, '#f2c14e');
      pxRect(0, sy - 2, 2, 2, '#f2c14e');
      pxRect(6, sy, 2, 2, '#f2c14e');
    }

    ctx.restore();
  }

  function drawBossBody(boss) {
    const s = boss.size;
    const wob = settings.motion ? Math.sin(visualTime * 2.4) * 1.5 : 0;
    ctx.save();
    ctx.translate(Math.round(boss.x), Math.round(boss.y));

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#020403';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.62, s * 0.8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Щупальца.
    for (let i = -2; i <= 2; i += 1) {
      pxLine(0, s * 0.2, i * s * 0.22, s * 0.75, '#1a0d12', 2);
      pxLine(i * s * 0.22, s * 0.75, i * s * 0.3, s * 0.92, boss.body, 1);
    }

    // Основная масса.
    pxRect(-s * 0.55, -s * 0.5 + wob, s * 1.1, s * 0.85, '#09070a');
    pxRect(-s * 0.5, -s * 0.45 + wob, s * 1.0, s * 0.78, boss.body);
    pxRect(-s * 0.34, -s * 0.58 + wob, s * 0.68, s * 0.2, boss.body);
    pxRect(-s * 0.3, -s * 0.28 + wob, s * 0.6, 3, boss.light);

    // Глаза.
    for (let i = -1; i <= 1; i += 1) {
      pxRect(i * s * 0.24 - 2, -s * 0.08 + wob, 4, 3, boss.eye);
      pxRect(i * s * 0.24 - 1, -s * 0.07 + wob, 1, 1, '#2a1b09');
    }

    // Корона.
    for (let i = -1; i <= 1; i += 1) {
      pxRect(i * s * 0.2 - 2, -s * 0.72 + wob, 4, 7, '#f2c14e');
      pxRect(i * s * 0.2 - 1, -s * 0.76 + wob, 2, 3, '#ffe29a');
    }
    pxRect(-s * 0.32, -s * 0.66 + wob, s * 0.64, 2, '#d99a2b');

    // Фазовая аура.
    if (boss.phasesDone > 0) {
      ctx.globalAlpha = 0.22 + Math.sin(visualTime * 4) * 0.08;
      ctx.fillStyle = '#e05252';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (boss.intro > 0) {
      ctx.globalAlpha = 0.35 + Math.sin(visualTime * 8) * 0.15;
      ctx.strokeStyle = '#f2c14e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (boss.stagger > 0) {
      pxRect(-10, -s * 0.95, 2, 2, '#f2c14e');
      pxRect(0, -s * 1.02, 2, 2, '#f2c14e');
      pxRect(10, -s * 0.95, 2, 2, '#f2c14e');
    }

    ctx.restore();
  }

  function drawTargetBrackets(enemy) {
    const s = enemy.size + 6;
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    const len = 4;
    const color = '#f2c14e';
    // Левый верх.
    pxRect(x - s, y - s, len, 1, color);
    pxRect(x - s, y - s, 1, len, color);
    // Правый верх.
    pxRect(x + s - len, y - s, len, 1, color);
    pxRect(x + s, y - s, 1, len, color);
    // Левый низ.
    pxRect(x - s, y + s, len, 1, color);
    pxRect(x - s, y + s - len, 1, len, color);
    // Правый низ.
    pxRect(x + s - len, y + s, len, 1, color);
    pxRect(x + s, y + s - len, 1, len, color);
  }

  function drawEnemyTag(tag) {
    const e = tag.enemy;
    const active = tag.active;
    const border = active ? '#f2c14e' : e.isBoss ? '#a34050' : '#3d4e42';
    const bg = e.isBoss ? '#160c10' : active ? '#12160e' : '#0b100c';

    // Указатель к врагу.
    const px = clamp(Math.round(e.x), tag.x + 4, tag.x + tag.w - 4);
    pxRect(px, tag.y + tag.h, 1, 4, border);

    pxRect(tag.x, tag.y, tag.w, tag.h, bg);
    pxRect(tag.x, tag.y, tag.w, 1, border);
    pxRect(tag.x, tag.y + tag.h - 1, tag.w, 1, border);
    pxRect(tag.x, tag.y, 1, tag.h, border);
    pxRect(tag.x + tag.w - 1, tag.y, 1, tag.h, border);

    if (active) {
      pxRect(tag.x + 1, tag.y + 1, tag.w - 2, 1, 'rgba(242,193,78,0.18)');
    }

    const word = currentWord(e);
    const prefill = currentPrefill(e);
    const typedEnd = prefill + (active && run ? run.buffer.length : 0);
    const textX = tag.x + 4;
    const textY = tag.y + tag.h / 2 + 1;
    ctx.font = `${tag.weight} ${tag.fontSize}px ${FONT_STACK}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let cx = textX;
    for (let i = 0; i < word.length; i += 1) {
      let color = '#f1e6c8';
      if (i < prefill) color = '#8f7739';
      else if (i < typedEnd) color = '#f2c14e';
      ctx.fillStyle = color;
      ctx.fillText(word[i].toUpperCase(), Math.round(cx), textY);
      cx += tag.widths[i] + 0.9;
    }

    if (e.elite) {
      pxRect(tag.x + tag.w - 5, tag.y + 2, 2, 2, '#f2c14e');
      pxRect(tag.x + tag.w - 9, tag.y + 2, 2, 2, '#f2c14e');
    } else if (e.redMarked) {
      pxRect(tag.x + tag.w - 5, tag.y + 2, 2, 2, '#e05252');
    } else if (active && run && run.manualTargetId === e.id) {
      pxRect(tag.x + tag.w - 5, tag.y + 2, 2, 2, '#f2c14e');
    }
  }

  function drawEnemiesAndTags() {
    if (!run) return;
    const enemies = run.enemies.filter((e) => !e.dead);
    enemies.forEach((e) => { e.tagRect = null; });

    // Тела.
    const sortedBodies = enemies.slice().sort((a, b) => a.y - b.y);
    sortedBodies.forEach((e) => drawEnemyBody(e));

    // Линии замаха.
    enemies.forEach((e) => {
      if (e.windup > 0) {
        ctx.globalAlpha = 0.16 + Math.sin(visualTime * 24) * 0.08;
        pxLine(e.x, e.y, BASE.x, BASE.y, '#e05252', 1);
        ctx.globalAlpha = 1;
      }
    });

    // Бирки со словами. У босса предложение показывает верхняя полоса.
    const tags = [];
    const bossActive = run.boss && run.boss.id === run.activeTargetId ? run.boss : null;
    if (bossActive) drawTargetBrackets(bossActive);
    const sortedTags = enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of sortedTags) {
      if (e.isBoss) continue;
      if (e.x < -80 || e.x > W + 80 || e.y < -40 || e.y > H + 50) continue;
      const active = e.id === run.activeTargetId;
      const tag = buildTag(e, active);
      if (!tag) continue;
      tags.push(tag);
    }

    const placed = [];
    tags.forEach((tag) => {
      let guard = 0;
      while (guard < 7 && placed.some((other) => tagsOverlap(tag, other))) {
        tag.y -= tag.h + 2;
        guard += 1;
      }
      const topLimit = run.boss ? 76 : SAFE_TOP;
      tag.y = clamp(tag.y, topLimit, SAFE_BOTTOM - tag.h);
      placed.push(tag);
      tag.enemy.tagRect = { x: tag.x, y: tag.y, w: tag.w, h: tag.h };
    });

    tags.sort((a, b) => (a.active === b.active ? 0 : a.active ? 1 : -1));
    tags.forEach((tag) => {
      if (tag.active) drawTargetBrackets(tag.enemy);
      drawEnemyTag(tag);
    });
  }

  function drawParticles() {
    if (!run) return;
    for (const p of run.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      pxRect(p.x, p.y, p.size, p.size, p.color);
    }
    ctx.globalAlpha = 1;

    for (const f of run.floaters) {
      ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.font = `700 7px ${FONT_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawSlashes() {
    if (!run) return;
    for (const s of run.slashes) {
      ctx.globalAlpha = clamp(s.life / s.maxLife, 0, 1) * 0.65;
      pxLine(s.x1, s.y1, s.x2, s.y2, '#e05252', 1);
      pxRect(s.x2 - 1, s.y2 - 1, 2, 2, '#ffb0b0');
    }
    ctx.globalAlpha = 1;
  }

  function drawMenuScene() {
    drawBase();

    // Парящие буквы.
    for (const letter of menuLetters) {
      const y = (letter.y - visualTime * letter.speed) % (H + 24);
      const yy = y < -12 ? y + H + 24 : y;
      const xx = letter.x + Math.sin(visualTime * 0.4 + letter.phase) * 8;
      ctx.globalAlpha = letter.alpha;
      ctx.font = `700 ${letter.size}px ${FONT_STACK}`;
      ctx.fillStyle = '#f1e6c8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter.ch, Math.round(xx), Math.round(yy));
    }
    ctx.globalAlpha = 1;

    // Немые силуэты по краям.
    drawMenuBlob(44, 214, 1.1, '#2a3550', '#6f7fd8');
    drawMenuBlob(438, 206, 0.9, '#3c2430', '#b06a7c');
    drawMenuBlob(72, 82, 0.7, '#253b34', '#66a58e');
  }

  function drawMenuBlob(x, y, scale, body, light) {
    const w = 12 * scale;
    const h = 15 * scale;
    ctx.globalAlpha = 0.3;
    pxRect(x - w / 2, y - h / 2, w, h, body);
    pxRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, 2, light);
    pxRect(x - 3, y - 1, 2, 2, '#f1e6c8');
    pxRect(x + 2, y - 1, 2, 2, '#f1e6c8');
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const top = ctx.createLinearGradient(0, 0, 0, 26);
    top.addColorStop(0, 'rgba(0,0,0,0.62)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 26);

    const bottom = ctx.createLinearGradient(0, H, 0, H - 30);
    bottom.addColorStop(0, 'rgba(0,0,0,0.56)');
    bottom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H - 30, W, 30);

    const left = ctx.createLinearGradient(0, 0, 16, 0);
    left.addColorStop(0, 'rgba(0,0,0,0.35)');
    left.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, 16, H);

    const right = ctx.createLinearGradient(W, 0, W - 16, 0);
    right.addColorStop(0, 'rgba(0,0,0,0.35)');
    right.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = right;
    ctx.fillRect(W - 16, 0, 16, H);
  }

  function drawScreenEffects() {
    if (!run) return;

    if (run.slowTimer > 0) {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#6f8cff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      pxRect(0, 0, W, 1, 'rgba(120,160,255,0.35)');
      pxRect(0, H - 1, W, 1, 'rgba(120,160,255,0.35)');
      ctx.font = `700 6px ${FONT_STACK}`;
      ctx.fillStyle = 'rgba(170,200,255,0.8)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('ВРЕМЯ ЗАМЕДЛЕНО', 8, H - 15);
    }

    if (run.flash > 0) {
      ctx.globalAlpha = run.flash * 0.11;
      ctx.fillStyle = '#e05252';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    const hpRatio = clamp(run.hp / run.maxHp, 0, 1);
    if (hpRatio < 0.35) {
      const grad = ctx.createRadialGradient(BASE.x, BASE.y, 70, BASE.x, BASE.y, 250);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(120, 20, 28, ${0.16 + (1 - hpRatio) * 0.12})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    const shake = run && settings.shake ? run.shake : 0;
    const sx = shake ? Math.sin(visualTime * 97) * shake * 0.55 : 0;
    const sy = shake ? Math.cos(visualTime * 83) * shake * 0.45 : 0;

    ctx.save();
    ctx.translate(Math.round(sx), Math.round(sy));

    drawBackground();
    if (run) {
      drawBase();
      drawEnemiesAndTags();
      drawParticles();
      drawSlashes();
      drawScreenEffects();
    } else {
      drawMenuScene();
    }

    ctx.restore();
    drawVignette();

    if (run && run.slowTimer > 0) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#5a7dff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  if (new URLSearchParams(window.location.search).get('debug') === '1') {
    window.__SL = {
      get run() { return run; },
      get mode() { return mode; },
      getState() {
        return run ? {
          mode,
          phase: run.phase,
          wave: run.wave,
          totalWaves: TOTAL_WAVES,
          edition: editionForWave(run.wave).name,
          waveMod: run.waveMod,
          nextUpgrade: shouldOfferUpgrade(run.wave),
          hp: run.hp,
          maxHp: run.maxHp,
          shield: run.shield,
          combo: run.combo,
          score: run.score,
          kills: run.kills,
          tokens: run.tokens,
          boss: run.boss ? {
            name: run.boss.name,
            words: run.boss.words,
            sentence: run.boss.sentence,
            typed: bossTyped(run.boss),
            index: run.boss.wordIndex,
            active: run.activeTargetId === run.boss.id,
            manual: run.manualTargetId === run.boss.id
          } : null,
          enemies: run.enemies.map((e) => ({
            id: e.id,
            type: e.type,
            name: e.name,
            word: currentWord(e),
            prefill: currentPrefill(e),
            wordIndex: e.wordIndex,
            state: e.state,
            isBoss: e.isBoss,
            elite: !!e.elite,
            redMarked: !!e.redMarked
          })),
          offer: run.offer ? run.offer.map((o) => ({ id: o.card ? o.card.id : '__heal', rarity: o.rarity })) : null
        } : { mode };
      },
      setWave(n) {
        if (!run) return;
        startWaveIntro(clamp(n, 1, TOTAL_WAVES));
      },
      clearEnemies() {
        if (!run) return;
        run.enemies.slice().forEach((e) => {
          if (e.dead) return;
          if (e.isBoss) {
            while (run.boss && !run.boss.dead) completeBossWord(run.boss, 3, true);
          } else {
            killEnemy(e, 3);
          }
        });
      },
      bossLoseWord() {
        if (run && run.boss && !run.boss.dead) completeBossWord(run.boss, 0, true);
      },
      spawn(type, count = 1) {
        if (!run) return;
        for (let i = 0; i < count; i += 1) spawnEnemy(type || 'S', {});
      },
      give(id) {
        if (run) applyUpgrade(id);
      },
      damage(n) {
        if (run) damageBase(n, { self: true });
      },
      setHp(n) {
        if (run) run.hp = clamp(n, 1, run.maxHp);
      },
      addTokens(n) {
        if (run) run.tokens += n;
      },
      showUpgrade() {
        if (run) showUpgradeScreen();
      },
      pick(i) {
        chooseOffer(i);
      },
      reroll() {
        rerollOffer();
      },
      skip() {
        skipOffer();
      },
      win() {
        if (run) victory();
      },
      lose() {
        if (run) gameOver();
      },
      pause() {
        pauseGame();
      },
      resume() {
        resumeGame();
      }
    };
  }

  init();
})();
