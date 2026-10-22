/* ============================================================
   Brick Breaker Demo
   Pure frontend / Canvas 2D / no dependencies.
   ============================================================ */

(() => {
  "use strict";

  // ------------------------------------------------------------
  // Constants
  // ------------------------------------------------------------

  let W = 1280;
  let H = 760;
  let canvasDprCap = 2;

  let FIELD = {
    left: 44,
    top: 106,
    right: 1236,
    bottom: 724,
    width: 1192,
    height: 618,
  };
  FIELD.centerX = FIELD.left + FIELD.width / 2;
  FIELD.centerY = FIELD.top + FIELD.height / 2;

  let PADDLE = {
    y: 666,
    height: 18,
    baseWidth: 176,
    extensionStep: 52.5,
  };
  let MAX_PADDLE_WIDTH = FIELD.width / 2;
  let MAX_EXTENSION = MAX_PADDLE_WIDTH - PADDLE.baseWidth;

  let BALL_RADIUS = 9;
  const FIXED_STEP = 1 / 120;
  const MAX_BALLS = 240;
  let POWERUP_FALL_SPEED = 132;
  let BRICK_LAYOUT = null;
  let WORLD_SPEED_SCALE = 1;

  const SPEEDS = [300, 370, 480, 610, 745];
  const DIFFICULTY = [
    { name: "悠闲", code: "SLOW" },
    { name: "轻松", code: "EASY" },
    { name: "适中", code: "NORMAL" },
    { name: "挑战", code: "HARD" },
    { name: "极限", code: "EXPERT" },
  ];

  // The score multipliers apply at settlement, not during play.
  const SPEED_MULTIPLIERS = [1, 1.25, 1.5, 1.75, 2];

  // Total brick durability presets. 3 is intended as the balanced setting.
  // Portrait has more bricks, so its targets are scaled by the exact brick
  // count ratio (137 / 71) and rounded to whole HP.
  const LANDSCAPE_BRICK_TOTAL = 71;
  const PORTRAIT_BRICK_TOTAL = 137;
  const PORTRAIT_DURABILITY_RATIO = PORTRAIT_BRICK_TOTAL / LANDSCAPE_BRICK_TOTAL;
  const DURABILITY_LEVELS = [
    { name: "轻量", hp: 170, display: "170", unit: "HP" },
    { name: "轻装", hp: 215, display: "215", unit: "HP" },
    { name: "标准", hp: 260, display: "260", unit: "HP" },
    { name: "厚重", hp: 305, display: "305", unit: "HP" },
    { name: "堡垒", hp: 350, display: "350", unit: "HP" },
  ].map((level) => ({
    ...level,
    portraitHp: Math.round(level.hp * PORTRAIT_DURABILITY_RATIO),
  }));

  // Reward brick density presets. Level 1 grants the most rewards (50% of bricks),
  // level 5 the fewest (10%). The display order is reversed in the UI, but score
  // multipliers remain bound to the tier number.
  const REWARD_LEVELS = [
    { name: "丰厚", ratio: 0.5, multiplier: 1, display: "50", unit: "%" },
    { name: "较多", ratio: 0.4, multiplier: 1.25, display: "40", unit: "%" },
    { name: "适中", ratio: 0.3, multiplier: 1.5, display: "30", unit: "%" },
    { name: "稀少", ratio: 0.2, multiplier: 1.75, display: "20", unit: "%" },
    { name: "极稀", ratio: 0.1, multiplier: 2, display: "10", unit: "%" },
  ];

  // Keyboard control speed is deliberately separate from difficulty and scoring.
  const KEYBOARD_SPEEDS = [460, 620, 800, 1020, 1240];
  const KEYBOARD_LEVELS = [
    { name: "缓速", code: "SLOW" },
    { name: "稳健", code: "STEADY" },
    { name: "标准", code: "NORMAL" },
    { name: "迅捷", code: "QUICK" },
    { name: "极速", code: "TURBO" },
  ];

  const ROW_HP_RANGES = [
    [5, 10], // top row: toughest
    [3, 10],
    [3, 9],
    [2, 8],
    [1, 6],
    [1, 3],
    [1, 3], // bottom row: fragile
  ];

  // Portrait rows keep the same top-to-bottom durability gradient while
  // allowing the lower target totals to remain reachable with more bricks.
  const PORTRAIT_ROW_HP_RANGES = [
    [3, 10],
    [2, 10],
    [2, 9],
    [1, 8],
    [1, 7],
    [1, 6],
    [1, 5],
    [1, 4],
    [1, 4],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
  ];

  const BOARD_CONFIGS = {
    landscape: {
      W: 1280,
      H: 760,
      field: { left: 44, top: 106, right: 1236, bottom: 724 },
      paddle: { y: 666, height: 18, baseRatio: 176 / 1280 },
      ballRadius: 9,
      speedScale: 1,
      keyboardScale: 1,
      powerupFall: 132,
      brick: {
        cols: 12,
        rows: 7,
        padX: 14,
        gapX: 3,
        gapY: 6,
        height: 28,
        topOffset: 48,
        echoFrom: 1,
        ranges: ROW_HP_RANGES,
      },
    },
    portrait: {
      W: 720,
      H: 1280,
      field: { left: 24, top: 92, right: 696, bottom: 1210 },
      paddle: { y: 1050, height: 24, baseRatio: 112 / 720 },
      ballRadius: 11,
      speedScale: 0.82,
      keyboardScale: 720 / 1280,
      powerupFall: 112,
      brick: {
        cols: 9,
        rows: 18,
        padX: 16,
        gapX: 3,
        gapY: 6,
        heightRatio: 0.5,
        topOffset: 42,
        echoFrom: 11,
        ranges: PORTRAIT_ROW_HP_RANGES,
      },
    },
  };

  // Phone portrait uses larger, edge-to-edge bricks: at most eight columns,
  // dynamic row count and a slightly longer paddle. Desktop portrait and
  // landscape keep their existing configurations.
  const MOBILE_PORTRAIT_ROW_HP_RANGES = [
    [4, 10],
    [3, 10],
    [3, 10],
    [2, 9],
    [2, 9],
    [2, 8],
    [2, 8],
    [1, 7],
    [1, 7],
    [1, 6],
    [1, 6],
    [1, 5],
    [1, 5],
    [1, 4],
    [1, 4],
    [1, 4],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
    [1, 3],
  ];

  const MOBILE_PORTRAIT_BOARD_CONFIG = {
    ...BOARD_CONFIGS.portrait,
    field: {
      ...BOARD_CONFIGS.portrait.field,
      left: 8,
      right: 712,
    },
    paddle: {
      ...BOARD_CONFIGS.portrait.paddle,
      baseRatio: 124 / 720,
    },
    brick: {
      ...BOARD_CONFIGS.portrait.brick,
      cols: 8,
      rows: 21,
      padX: 8,
      gapX: 3,
      gapY: 6.985,
      topOffset: 38,
      echoFrom: 16,
      heightRatio: 1 / 3,
      ranges: MOBILE_PORTRAIT_ROW_HP_RANGES,
    },
  };

  const DESKTOP_PORTRAIT_MAX_WIDTH = 820;
  const LOWER_REWARD_SHARE = 0.3;
  const BUFF_DURATIONS = { C: 10, E: 5 };
  const LEADERBOARD_KEY = "brickBreakerDemo.leaderboard.v2";

  const RANDOM_PLAYER_NAMES = Object.freeze([
    "Aaron", "Abigail", "Adam", "Adrian", "Aiden", "Alex",
    "Alice", "Amanda", "Amber", "Amy", "Andrew", "Angela",
    "Anna", "Anthony", "Arthur", "Ashley", "Audrey", "Austin",
    "Ava", "Benjamin", "Blake", "Brandon", "Brian", "Brooke",
    "Caleb", "Cameron", "Caroline", "Charles", "Charlotte", "Chloe",
    "Chris", "Claire", "Colin", "Daniel", "David", "Diana",
    "Dylan", "Edward", "Elena", "Elijah", "Ella", "Emily",
    "Emma", "Eric", "Ethan", "Eva", "Evelyn", "Felix",
    "Fiona", "Frank", "Gabriel", "Grace", "Hannah", "Harry",
    "Hazel", "Henry", "Holly", "Ian", "Isaac", "Isabella",
    "Jack", "Jacob", "James", "Jane", "Jason", "Jasmine",
    "Jennifer", "Jeremy", "Jessica", "John", "Jonathan", "Jordan",
    "Joseph", "Julia", "Julian", "Justin", "Karen", "Kate",
    "Kevin", "Laura", "Lauren", "Leo", "Liam", "Lily",
    "Logan", "Lucas", "Lucy", "Madison", "Marcus", "Maria",
    "Mark", "Mason", "Matthew", "Maya", "Megan", "Michael",
    "Mia", "Nathan", "Nicholas", "Noah",
  ]);

  function pickRandomPlayerName(exclude = "") {
    const current = String(exclude ?? "").trim().toLowerCase();
    const candidates = current
      ? RANDOM_PLAYER_NAMES.filter((name) => name.toLowerCase() !== current)
      : RANDOM_PLAYER_NAMES;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const TAU = Math.PI * 2;

  const COLORS = {
    cyan: "#5ce6ff",
    cyanSoft: "#9ff5ff",
    violet: "#a984ff",
    pink: "#ff7acb",
    gold: "#ffd479",
    red: "#ff6a76",
    green: "#6cf3ba",
    orange: "#ffb45c",
    ink: "#f4f8ff",
    muted: "#7f90a8",
  };

  const POWERUP_META = {
    A: { color: "#b994ff", name: "分裂", weight: 23 },
    B: { color: "#5cf2bb", name: "加长", weight: 21 },
    C: { color: "#64d8ff", name: "穿透", weight: 19 },
    D: { color: "#ffb75f", name: "强化", weight: 25 },
    E: { color: "#ff86d2", name: "无敌", weight: 12 },
  };

  // Palette indexed by current durability. Cool = fragile, hot = tough.
  const BRICK_PALETTE = {
    1: { top: "#8dffdb", base: "#39dcae", deep: "#167f68", glow: "#52f1c0" },
    2: { top: "#8efbf2", base: "#35d6d2", deep: "#157f83", glow: "#4ce7e0" },
    3: { top: "#93eaff", base: "#39c4ec", deep: "#176b8c", glow: "#54d7fa" },
    4: { top: "#a8d4ff", base: "#5ca8ff", deep: "#285894", glow: "#70b9ff" },
    5: { top: "#bebcff", base: "#838dfa", deep: "#424997", glow: "#9ca4ff" },
    6: { top: "#dfc3ff", base: "#ad85ff", deep: "#63409e", glow: "#c19cff" },
    7: { top: "#f0c4ff", base: "#d47df5", deep: "#853d9f", glow: "#e4a0ff" },
    8: { top: "#ffc8e8", base: "#f574c8", deep: "#9c2f70", glow: "#ff9cdd" },
    9: { top: "#ffc9cf", base: "#ff7584", deep: "#9b303c", glow: "#ff98a2" },
    10: { top: "#ffd6ba", base: "#ff985d", deep: "#9d4a26", glow: "#ffb27c" },
  };

  const REWARD_PALETTE = {
    top: "#ffe8a8",
    base: "#d49b3f",
    deep: "#674219",
    glow: "#ffd479",
  };

  // ------------------------------------------------------------
  // DOM & Canvas
  // ------------------------------------------------------------

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");

  const dom = {
    stage,
    score: document.getElementById("scoreValue"),
    balls: document.getElementById("ballValue"),
    power: document.getElementById("powerValue"),
    bricks: document.getElementById("brickValue"),
    hp: document.getElementById("hpValue"),
    time: document.getElementById("timeValue"),
    speedChipValue: document.getElementById("speedChipValue"),
    speedReadout: document.getElementById("speedReadout"),
    durabilityReadout: document.getElementById("durabilityReadout"),
    rewardReadout: document.getElementById("rewardReadout"),
    keyboardSpeedReadout: document.getElementById("keyboardSpeedReadout"),
    panelCode: document.getElementById("panelCode"),
    speedOptions: document.getElementById("speedOptions"),
    durabilityOptions: document.getElementById("durabilityOptions"),
    rewardOptions: document.getElementById("rewardOptions"),
    keyboardSpeedOptions: document.getElementById("keyboardSpeedOptions"),
    pauseKeyboardOptions: document.getElementById("pauseKeyboardOptions"),
    pauseKeyboardReadout: document.getElementById("pauseKeyboardReadout"),
    pauseKeyboardSetting: document.querySelector(".pause-setting"),
    pauseKeyGuide: document.querySelector(".pause-key-guide"),
    playerName: document.getElementById("playerName"),
    nameDiceButton: document.getElementById("nameDiceButton"),
    startButton: document.getElementById("startButton"),
    boardIndicator: document.getElementById("boardIndicator"),
    boardStatusText: document.getElementById("boardStatusText"),
    keyboardSettingBlock: document.querySelector(".setting-support"),
    statusPill: document.getElementById("statusPill"),
    statusText: document.getElementById("statusText"),
    buffRail: document.getElementById("buffRail"),
    toast: document.getElementById("toast"),
    toastIcon: document.getElementById("toastIcon"),
    toastTitle: document.getElementById("toastTitle"),
    toastSubtitle: document.getElementById("toastSubtitle"),
    launchHint: document.getElementById("launchHint"),
    launchHintTitle: document.getElementById("launchHintTitle"),
    launchHintSubtitle: document.getElementById("launchHintSubtitle"),
    leaderboard: document.querySelector(".leaderboard"),
    leaderboardTitle: document.getElementById("leaderboardTitle"),
    leaderboardSubtitle: document.getElementById("leaderboardSubtitle"),
    leaderboardBoardChip: document.getElementById("leaderboardBoardChip"),
    leaderboardFilters: document.getElementById("leaderboardFilters"),
    leaderboardList: document.getElementById("leaderboardList"),
    leaderboardPagination: document.getElementById("leaderboardPagination"),
    leaderboardPrev: document.getElementById("leaderboardPrev"),
    leaderboardNext: document.getElementById("leaderboardNext"),
    leaderboardPageInfo: document.getElementById("leaderboardPageInfo"),
    leaderboardEmpty: document.getElementById("leaderboardEmpty"),
    leaderboardCount: document.getElementById("leaderboardCount"),
    mobilePauseButton: document.getElementById("mobilePauseButton"),
    deleteLeaderboardButton: document.getElementById("deleteLeaderboardButton"),
    deleteLeaderboardModal: document.getElementById("deleteLeaderboardModal"),
    cancelDeleteButton: document.getElementById("cancelDeleteButton"),
    confirmDeleteButton: document.getElementById("confirmDeleteButton"),
    victoryModal: document.getElementById("victoryModal"),
    gameOverModal: document.getElementById("gameOverModal"),
    pauseModal: document.getElementById("pauseModal"),
    pauseReason: document.getElementById("pauseReason"),
    resumeButton: document.getElementById("resumeButton"),
    abandonButton: document.getElementById("abandonButton"),
    victoryPlayerName: document.getElementById("victoryPlayerName"),
    failPlayerName: document.getElementById("failPlayerName"),
    clearTime: document.getElementById("clearTime"),
    clearScore: document.getElementById("clearScore"),
    failTime: document.getElementById("failTime"),
    failScore: document.getElementById("failScore"),
    failBricks: document.getElementById("failBricks"),
    failHp: document.getElementById("failHp"),
    victoryBaseScore: document.getElementById("victoryBaseScore"),
    victorySpeedMultiplier: document.getElementById("victorySpeedMultiplier"),
    victoryRewardMultiplier: document.getElementById("victoryRewardMultiplier"),
    victoryTimeMultiplier: document.getElementById("victoryTimeMultiplier"),
    victoryTotalCoefficient: document.getElementById("victoryTotalCoefficient"),
    failBaseScore: document.getElementById("failBaseScore"),
    failSpeedMultiplier: document.getElementById("failSpeedMultiplier"),
    failRewardMultiplier: document.getElementById("failRewardMultiplier"),
    failTotalCoefficient: document.getElementById("failTotalCoefficient"),
    playAgainButton: document.getElementById("playAgainButton"),
    victoryMenuButton: document.getElementById("victoryMenuButton"),
    okButton: document.getElementById("okButton"),
    soundButton: document.getElementById("soundButton"),
  };

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, canvasDprCap);
    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupCanvas();

  // ------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const random = (min, max) => min + Math.random() * (max - min);
  const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const pad = (n, len = 2) => String(n).padStart(len, "0");

  function shuffle(items) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    const mins = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    const tenths = Math.floor((safe % 1) * 10);
    return `${pad(mins)}:${pad(secs)}.${tenths}`;
  }

  function roundRectPath(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function weightedTwoToTen() {
    // Lower values are intentionally much more common.
    const weights = [
      [2, 21],
      [3, 17],
      [4, 14],
      [5, 11],
      [6, 9],
      [7, 7],
      [8, 5],
      [9, 3],
      [10, 1.5],
    ];
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [value, weight] of weights) {
      roll -= weight;
      if (roll <= 0) return value;
    }
    return 2;
  }

  function pickPowerupType() {
    const entries = Object.entries(POWERUP_META);
    const total = entries.reduce((sum, [, meta]) => sum + meta.weight, 0);
    let roll = Math.random() * total;
    for (const [type, meta] of entries) {
      roll -= meta.weight;
      if (roll <= 0) return type;
    }
    return "A";
  }

  function createStars() {
    const count = game.menuBoard === "portrait" ? 56 : 88;
    return Array.from({ length: count }, () => ({
      x: random(FIELD.left, FIELD.right),
      y: random(FIELD.top, FIELD.bottom),
      radius: random(0.35, 1.45),
      alpha: random(0.12, 0.52),
      phase: random(0, TAU),
      speed: random(0.35, 1.1),
      cyan: Math.random() < 0.2,
    }));
  }

  // ------------------------------------------------------------
  // Audio (WebAudio synth + generated background music)
  // ------------------------------------------------------------

  const MUSIC_BPM = 100;
  const MUSIC_STEP_DURATION = 60 / MUSIC_BPM / 4;
  const MUSIC_STEPS = 64;
  const MUSIC_VOLUME = 0.2;
  const MUSIC_PROGRESSION = [
    { root: 45, pad: [57, 60, 64, 71] }, // Am add9
    { root: 41, pad: [53, 57, 60, 64] }, // Fmaj7
    { root: 36, pad: [55, 60, 64, 71] }, // Cmaj7
    { root: 43, pad: [55, 59, 62, 64] }, // G6
  ];
  const midiToFrequency = (note) => 440 * (2 ** ((note - 69) / 12));

  const audio = {
    enabled: true,
    ctx: null,
    master: null,
    last: new Map(),
    musicTimer: null,
    musicStep: 0,
    musicNextTime: 0,
    musicBus: null,
    musicFilter: null,
    musicDelay: null,
    musicNoiseBuffer: null,
    stateHandlerBound: false,

    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
      }
      if (!this.stateHandlerBound) {
        this.ctx.onstatechange = () => {
          if (this.ctx?.state === "running" && this.enabled) this.startMusic();
        };
        this.stateHandlerBound = true;
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume()
          .then(() => {
            if (this.enabled) this.startMusic();
          })
          .catch(() => {});
      } else {
        this.startMusic();
      }
      return this.ctx;
    },

    setEnabled(value) {
      this.enabled = value;
      if (this.master) this.master.gain.value = value ? 0.55 : 0;
      if (value) {
        this.ensure();
      } else {
        this.stopMusic();
      }
    },

    ensureMusicGraph() {
      if (!this.ctx || this.musicBus) return;
      const context = this.ctx;
      const bus = context.createGain();
      bus.gain.value = 0.0001;

      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 4300;
      filter.Q.value = 0.55;

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 22;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.24;

      bus.connect(filter);
      filter.connect(compressor);
      compressor.connect(this.master);

      const delay = context.createDelay(1);
      delay.delayTime.value = MUSIC_STEP_DURATION * 1.5;
      const feedback = context.createGain();
      feedback.gain.value = 0.22;
      const wet = context.createGain();
      wet.gain.value = 0.2;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(bus);

      const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noise.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }

      this.musicBus = bus;
      this.musicFilter = filter;
      this.musicDelay = delay;
      this.musicNoiseBuffer = noise;
    },

    startMusic() {
      if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
      this.ensureMusicGraph();
      if (!this.musicBus || this.musicTimer) return;

      const now = this.ctx.currentTime;
      this.musicStep = 0;
      this.musicNextTime = now + 0.08;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(Math.max(0.0001, this.musicBus.gain.value), now);
      this.musicBus.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, now + 0.9);

      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
      this.scheduleMusic();
    },

    stopMusic() {
      if (this.musicTimer) {
        window.clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      if (this.musicBus && this.ctx) {
        const now = this.ctx.currentTime;
        this.musicBus.gain.cancelScheduledValues(now);
        this.musicBus.gain.setValueAtTime(Math.max(0.0001, this.musicBus.gain.value), now);
        this.musicBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      }
      this.musicStep = 0;
    },

    scheduleMusic() {
      if (!this.enabled || !this.ctx || this.ctx.state !== "running" || !this.musicBus) return;
      const now = this.ctx.currentTime;
      if (this.musicNextTime < now - 0.5) this.musicNextTime = now + 0.05;

      while (this.musicNextTime < now + 0.2) {
        this.playMusicStep(this.musicStep, this.musicNextTime);
        this.musicNextTime += MUSIC_STEP_DURATION;
        this.musicStep = (this.musicStep + 1) % MUSIC_STEPS;
      }
    },

    playMusicStep(step, when) {
      const bar = Math.floor(step / 16) % MUSIC_PROGRESSION.length;
      const position = step % 16;
      const chord = MUSIC_PROGRESSION[bar];
      const arpNotes = chord.pad.map((note) => note + 12);

      if (position === 0) {
        this.musicPad(chord, when);
        this.musicKick(when, 0.058);
        this.musicBass(chord.root, when, 0.032);
      }
      if (position === 8) {
        this.musicKick(when, 0.037);
        this.musicBass(chord.root, when, 0.024);
      }
      if (position === 6 || position === 14) this.musicKick(when, 0.016);
      if (position === 4 || position === 12) this.musicClap(when, 0.012);
      if (position % 2 === 0) {
        this.musicHat(when, position % 4 === 0 ? 0.0028 : 0.0019, false);
        const note = arpNotes[Math.floor(position / 2) % arpNotes.length];
        this.musicArp(note, when, position % 4 === 0 ? -0.24 : 0.24);
      }
      if (position === 7 || position === 15) this.musicHat(when, 0.0028, true);
      if (position === 3 || position === 11) {
        this.musicBass(chord.root + 12, when, 0.012);
      }
    },

    musicPad(chord, when) {
      const duration = MUSIC_STEP_DURATION * 16 * 0.92;
      chord.pad.forEach((note, index) => {
        this.musicTone(midiToFrequency(note), when, duration, {
          type: index % 2 === 0 ? "triangle" : "sawtooth",
          gain: 0.0095,
          attack: 0.35,
          release: 0.85,
          sustain: true,
          detune: index % 2 === 0 ? -4 : 4,
          pan: index === 0 ? -0.32 : index === 3 ? 0.32 : 0,
        });
      });
    },

    musicBass(note, when, gain = 0.03) {
      this.musicTone(midiToFrequency(note), when, 0.2, {
        type: "triangle",
        gain,
        attack: 0.006,
        release: 0.12,
        endFreq: midiToFrequency(note) * 0.99,
      });
    },

    musicArp(note, when, pan = 0) {
      this.musicTone(midiToFrequency(note), when, 0.12, {
        type: "triangle",
        gain: 0.016,
        attack: 0.005,
        release: 0.22,
        pan,
        delaySend: 0.55,
      });
    },

    musicKick(when, gain = 0.05) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const context = this.ctx;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(145, when);
      osc.frequency.exponentialRampToValueAtTime(44, when + 0.16);
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(gain, when + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, when + 0.21);
      osc.connect(env);
      env.connect(this.musicBus);
      osc.start(when);
      osc.stop(when + 0.24);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
    },

    musicClap(when, gain = 0.012) {
      this.musicNoise(when, 0.1, {
        gain,
        filterType: "bandpass",
        frequency: 1650,
        q: 0.9,
        attack: 0.003,
      });
    },

    musicHat(when, gain, open = false) {
      this.musicNoise(when, open ? 0.12 : 0.028, {
        gain,
        filterType: "highpass",
        frequency: 6900,
        q: 0.7,
        attack: 0.001,
      });
    },

    musicNoise(when, duration, options = {}) {
      if (!this.enabled || !this.ctx || !this.musicBus || !this.musicNoiseBuffer) return;
      const context = this.ctx;
      const {
        gain = 0.004,
        filterType = "highpass",
        frequency = 6000,
        q = 0.7,
        attack = 0.002,
      } = options;
      const source = context.createBufferSource();
      source.buffer = this.musicNoiseBuffer;
      const filter = context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const env = context.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, when + duration);
      source.connect(filter);
      filter.connect(env);
      env.connect(this.musicBus);
      source.start(when, Math.random() * 0.45);
      source.stop(when + duration + 0.02);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        env.disconnect();
      };
    },

    musicTone(freq, when, duration, options = {}) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const context = this.ctx;
      const {
        type = "sine",
        gain = 0.016,
        attack = 0.008,
        release = 0.12,
        endFreq = freq,
        detune = 0,
        pan = 0,
        delaySend = 0,
        sustain = false,
      } = options;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), when);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), when + duration);
      }
      osc.detune.setValueAtTime(detune, when);

      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + Math.max(0.001, attack));
      if (sustain) {
        env.gain.setValueAtTime(Math.max(0.0002, gain), when + Math.max(attack + 0.01, duration));
      } else {
        env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack + 0.03, duration));
      }
      env.gain.exponentialRampToValueAtTime(0.0001, when + duration + release);

      let output = env;
      let panner = null;
      if (pan !== 0 && typeof context.createStereoPanner === "function") {
        panner = context.createStereoPanner();
        panner.pan.value = pan;
        env.connect(panner);
        output = panner;
      }
      output.connect(this.musicBus);

      let send = null;
      if (delaySend > 0 && this.musicDelay) {
        send = context.createGain();
        send.gain.value = delaySend;
        output.connect(send);
        send.connect(this.musicDelay);
      }

      osc.connect(env);
      osc.start(when);
      osc.stop(when + duration + release + 0.05);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        if (panner) panner.disconnect();
        if (send) send.disconnect();
      };
    },

    tone(freq, duration = 0.07, options = {}) {
      if (!this.enabled) return;
      const context = this.ensure();
      if (!context) return;
      const {
        endFreq = freq,
        type = "sine",
        gain = 0.026,
        delay = 0,
        attack = 0.004,
      } = options;
      const now = context.currentTime + delay;
      const osc = context.createOscillator();
      const env = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(env);
      env.connect(this.master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },

    play(name) {
      if (!this.enabled) return;
      const now = performance.now();
      const throttle = this.last.get(name) || 0;
      if ((name === "wall" || name === "brick" || name === "paddle") && now - throttle < 38) return;
      this.last.set(name, now);

      switch (name) {
        case "launch":
          this.tone(190, 0.2, { endFreq: 750, type: "sine", gain: 0.045 });
          this.tone(520, 0.13, { endFreq: 980, type: "triangle", gain: 0.018, delay: 0.035 });
          break;
        case "paddle":
          this.tone(270, 0.065, { endFreq: 410, type: "triangle", gain: 0.032 });
          break;
        case "wall":
          this.tone(360, 0.035, { endFreq: 280, type: "sine", gain: 0.013 });
          break;
        case "brick":
          this.tone(590, 0.045, { endFreq: 430, type: "triangle", gain: 0.018 });
          break;
        case "break":
          this.tone(280, 0.12, { endFreq: 160, type: "triangle", gain: 0.035 });
          this.tone(740, 0.08, { endFreq: 380, type: "sine", gain: 0.018, delay: 0.01 });
          break;
        case "reward":
          this.tone(660, 0.09, { endFreq: 780, type: "sine", gain: 0.022 });
          this.tone(990, 0.12, { endFreq: 1120, type: "sine", gain: 0.016, delay: 0.06 });
          break;
        case "powerup":
          this.tone(520, 0.1, { endFreq: 720, type: "sine", gain: 0.028 });
          this.tone(780, 0.13, { endFreq: 1040, type: "triangle", gain: 0.02, delay: 0.055 });
          this.tone(1040, 0.16, { endFreq: 1390, type: "sine", gain: 0.014, delay: 0.11 });
          break;
        case "split":
          for (let i = 0; i < 5; i += 1) {
            this.tone(420 + i * 95, 0.1, { endFreq: 600 + i * 80, type: "sine", gain: 0.012, delay: i * 0.026 });
          }
          break;
        case "shield":
          this.tone(220, 0.28, { endFreq: 880, type: "sine", gain: 0.032 });
          this.tone(880, 0.3, { endFreq: 1320, type: "triangle", gain: 0.012, delay: 0.04 });
          break;
        case "lose":
          this.tone(240, 0.42, { endFreq: 105, type: "sawtooth", gain: 0.022 });
          this.tone(160, 0.5, { endFreq: 70, type: "triangle", gain: 0.02, delay: 0.1 });
          break;
        case "win":
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
            this.tone(freq, 0.34, { endFreq: freq * 1.01, type: "triangle", gain: 0.025, delay: index * 0.1 });
          });
          this.tone(1567.98, 0.5, { type: "sine", gain: 0.017, delay: 0.42 });
          break;
        default:
          break;
      }
    },
  };

  // ------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------

  const game = {
    mode: "menu",
    isMobile: false,
    menuBoard: "landscape",
    roundBoard: null,
    speedIndex: 3,
    durabilityIndex: 3,
    rewardIndex: 3,
    keyboardSpeedIndex: 3,
    speed: SPEEDS[2],
    keyboardSpeed: KEYBOARD_SPEEDS[2],
    playerName: "Player",
    targetDurability: DURABILITY_LEVELS[2].hp,
    rewardRatio: REWARD_LEVELS[2].ratio,
    rewardBrickCount: 0,
    initialDurability: 0,
    initialBrickCount: 0,
    initialRewardCount: 0,
    initialLowerRewardCount: 0,
    playTime: 0,
    score: 0,
    lastSettlement: null,
    bricks: [],
    balls: [],
    powerups: [],
    particles: [],
    texts: [],
    ambientBricks: [],
    stars: [],
    shake: 0,
    flash: 0,
    effect: {
      penetrationUntil: 0,
      damageUnlocked: false,
      ballPower: 1,
      invincibleUntil: 0,
      invincibleActive: false,
      invincibleBank: 0,
      extension: 0,
    },
    winTimer: null,
    failTimer: null,
    toastTimer: null,
    pauseReason: null,
    mobileTouchPositioned: false,
    buffSignature: "",
    buffNodes: new Map(),
    leaderboardFilter: "win",
    leaderboardPage: 1,
    leaderboardEntries: [],
    brickId: 0,
    powerupId: 0,
    lastFrame: performance.now(),
    accumulator: 0,
  };

  const paddle = {
    x: FIELD.centerX,
    y: PADDLE.y,
    width: PADDLE.baseWidth,
    height: PADDLE.height,
    vx: 0,
    flash: 0,
  };

  const pointer = {
    x: FIELD.centerX,
    active: false,
    lastTime: 0,
  };

  const inputState = {
    mode: "mouse",
    left: false,
    right: false,
  };

  const touchState = {
    active: false,
    pointerId: null,
    lastTime: 0,
    startX: 0,
    startY: 0,
    moved: false,
    pendingLaunch: false,
  };

  function getActiveBoard() {
    if (game.mode === "menu") return game.menuBoard;
    return game.roundBoard || game.menuBoard;
  }

  function getBoardSpeedScale(board = getActiveBoard()) {
    return BOARD_CONFIGS[board]?.speedScale ?? 1;
  }

  function getBoardKeyboardScale(board = getActiveBoard()) {
    return BOARD_CONFIGS[board]?.keyboardScale ?? 1;
  }

  function getDurabilityHp(index, board = getActiveBoard()) {
    const safe = clamp(Math.round(index), 1, DURABILITY_LEVELS.length);
    const level = DURABILITY_LEVELS[safe - 1];
    return board === "portrait" ? level.portraitHp : level.hp;
  }

  function updateDurabilityUI() {
    const board = getActiveBoard();
    const safe = clamp(Math.round(game.durabilityIndex), 1, DURABILITY_LEVELS.length);
    const level = DURABILITY_LEVELS[safe - 1];
    game.targetDurability = getDurabilityHp(safe, board);

    if (dom.durabilityReadout) {
      dom.durabilityReadout.textContent = board === "portrait"
        ? `${level.name} · ${game.targetDurability} HP`
        : level.name;
    }

    if (dom.durabilityOptions) {
      dom.durabilityOptions.querySelectorAll(".rail-node").forEach((node, index) => {
        const nodeLevel = DURABILITY_LEVELS[index];
        if (!nodeLevel) return;
        const hp = getDurabilityHp(index + 1, board);
        const label = node.querySelector(".rail-label");
        if (label) label.textContent = board === "portrait" ? String(hp) : nodeLevel.name;
        node.setAttribute("aria-label", `砖块总耐久 ${index + 1} 档 · ${nodeLevel.name} ${hp} HP`);
        node.title = `${nodeLevel.name} · ${hp} HP`;
      });
    }
  }

  function configureBoard(boardName) {
    const config = boardName === "portrait" && game.isMobile
      ? MOBILE_PORTRAIT_BOARD_CONFIG
      : (BOARD_CONFIGS[boardName] || BOARD_CONFIGS.landscape);
    const field = config.field;
    W = config.W;
    H = config.H;
    FIELD = {
      ...field,
      width: field.right - field.left,
      height: field.bottom - field.top,
    };
    FIELD.centerX = FIELD.left + FIELD.width / 2;
    FIELD.centerY = FIELD.top + FIELD.height / 2;

    const baseWidth = W * config.paddle.baseRatio;
    PADDLE = {
      y: config.paddle.y,
      height: config.paddle.height,
      baseWidth,
      extensionStep: (FIELD.width / 2 - baseWidth) / 8,
    };
    MAX_PADDLE_WIDTH = FIELD.width / 2;
    MAX_EXTENSION = MAX_PADDLE_WIDTH - PADDLE.baseWidth;
    BALL_RADIUS = config.ballRadius;
    POWERUP_FALL_SPEED = config.powerupFall;
    WORLD_SPEED_SCALE = config.speedScale;
    BRICK_LAYOUT = config.brick;
    canvasDprCap = boardName === "portrait" ? 1.25 : 2;

    stage.dataset.board = boardName;
    canvas.setAttribute("aria-label", boardName === "portrait"
      ? "Brick Breaker 竖屏游戏区域"
      : "Brick Breaker 游戏区域");
    setupCanvas();

    paddle.y = PADDLE.y;
    paddle.height = PADDLE.height;
    paddle.width = PADDLE.baseWidth;
    paddle.x = FIELD.centerX;
    paddle.targetX = FIELD.centerX;
    paddle.vx = 0;
    game.speed = SPEEDS[game.speedIndex - 1] * WORLD_SPEED_SCALE;
    game.keyboardSpeed = KEYBOARD_SPEEDS[game.keyboardSpeedIndex - 1] * (config.keyboardScale ?? 1);
    touchState.active = false;
    touchState.pointerId = null;
  }

  function detectMobileDevice() {
    const ua = navigator.userAgent || "";
    const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
    const dataMobile = navigator.userAgentData?.mobile === true;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    const touchPoints = navigator.maxTouchPoints || 0;
    return uaMobile || dataMobile || (
      touchPoints > 1
      && coarse
      && noHover
      && window.innerWidth <= 1024
    );
  }

  function detectMenuBoard() {
    if (game.isMobile) return "portrait";
    return window.innerWidth < DESKTOP_PORTRAIT_MAX_WIDTH ? "portrait" : "landscape";
  }

  function isPortraitViewport() {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    return height >= width;
  }

  function syncDeviceClasses() {
    const landscape = !isPortraitViewport();
    document.body.classList.toggle("is-mobile", game.isMobile);
    document.body.classList.toggle(
      "is-mobile-landscape",
      game.isMobile && landscape,
    );
    if (dom.keyboardSettingBlock) dom.keyboardSettingBlock.hidden = game.isMobile;
    if (dom.pauseKeyboardSetting) dom.pauseKeyboardSetting.hidden = game.isMobile;
    if (dom.pauseKeyGuide) dom.pauseKeyGuide.hidden = game.isMobile;
  }

  function updateLaunchHintCopy() {
    if (game.isMobile) {
      dom.launchHintTitle.textContent = game.mobileTouchPositioned
        ? "挡板已就位"
        : "首次拖动圆盘定位";
      dom.launchHintSubtitle.textContent = "再次点击圆盘 · 发射弹珠";
    } else {
      dom.launchHintTitle.textContent = "点击鼠标左键 / 空格键 · 发射弹珠";
      dom.launchHintSubtitle.textContent = "移动鼠标或使用 A / D 键调整反弹板";
    }
  }

  function updateBoardStatus() {
    const portrait = game.menuBoard === "portrait";
    dom.boardIndicator.dataset.board = game.menuBoard;
    dom.boardIndicator.classList.toggle("is-mobile", game.isMobile);
    dom.boardStatusText.textContent = game.isMobile
      ? (portrait ? "手机端竖屏模式 · 已就绪" : "手机端仅支持竖屏")
      : `下一局游戏为${portrait ? "竖屏" : "横屏"}版`;
  }

  function applyMenuBoard(force = false) {
    if (game.mode !== "menu") return false;
    const next = detectMenuBoard();
    if (!force && next === game.menuBoard) {
      updateBoardStatus();
      renderLeaderboard();
      return false;
    }
    game.menuBoard = next;
    configureBoard(next);
    game.stars = createStars();
    game.ambientBricks = createBrickGrid(true);
    game.leaderboardPage = 1;
    updateBoardStatus();
    updateLaunchHintCopy();
    updateDurabilityUI();
    renderLeaderboard();
    const menu = document.querySelector(".menu");
    if (menu) menu.scrollTop = 0;
    return true;
  }

  // ------------------------------------------------------------
  // Level generation
  // ------------------------------------------------------------

  function buildBrickLayout(ambient = false) {
    const {
      cols,
      rows,
      padX,
      gapX,
      gapY,
      height: fixedBrickHeight,
      heightRatio,
      topOffset,
      echoFrom,
      ranges,
    } = BRICK_LAYOUT;
    const brickWidth = (FIELD.width - padX * 2 - gapX * (cols - 1)) / cols;
    const brickHeight = heightRatio ? brickWidth * heightRatio : fixedBrickHeight;
    const startX = FIELD.left + padX;
    const startY = FIELD.top + topOffset;
    const bricks = [];

    // A deliberately stair-stepped channel runs through the wall. Its bias is
    // randomized per round, so the layout is predictable in style but varies.
    const channelOffset = randomInt(1, cols - 2);
    const channelDirection = Math.random() < 0.5 ? 1 : -1;
    const wrapCol = (value) => ((value % cols) + cols) % cols;
    const channelAt = (row) => wrapCol(channelOffset + row * channelDirection);

    for (let row = 0; row < rows; row += 1) {
      const [minHp, maxHp] = ranges[Math.min(row, ranges.length - 1)];
      const channelCol = channelAt(row);
      const echoCol = wrapCol(channelCol + channelDirection * 2);

      for (let col = 0; col < cols; col += 1) {
        // The offset echo keeps a roughly constant deliberate-open share while
        // the stair-step main channel runs through every row.
        const isPatternGap = col === channelCol || (row >= echoFrom && col === echoCol);
        if (isPatternGap) continue;

        const durability = randomInt(minHp, maxHp);
        const x = startX + col * (brickWidth + gapX);
        const y = startY + row * (brickHeight + gapY);

        bricks.push({
          id: game.brickId++,
          x,
          y,
          w: brickWidth,
          h: brickHeight,
          row,
          hp: durability,
          maxHp: durability,
          rangeMin: minHp,
          rangeMax: maxHp,
          reward: false,
          flash: 0,
          seed: Math.random() * 1000,
          spawnAt: performance.now() / 1000 + (row * 0.018 + col * 0.008),
          ambient,
        });
      }
    }

    return bricks;
  }

  function adjustBrickDurability(bricks, target) {
    let total = bricks.reduce((sum, brick) => sum + brick.hp, 0);
    let guard = 0;

    while (total < target && guard < 12000) {
      const candidates = bricks.filter((brick) => brick.hp < brick.rangeMax);
      if (!candidates.length) return false;
      const brick = candidates[Math.floor(Math.random() * candidates.length)];
      const room = brick.rangeMax - brick.hp;
      const increase = Math.min(room, target - total, randomInt(1, 3));
      brick.hp += increase;
      total += increase;
      guard += increase;
    }

    while (total > target && guard < 24000) {
      const candidates = bricks.filter((brick) => brick.hp > brick.rangeMin && brick.hp > 1);
      if (!candidates.length) return false;
      const brick = candidates[Math.floor(Math.random() * candidates.length)];
      const room = brick.hp - brick.rangeMin;
      const decrease = Math.min(room, total - target, randomInt(1, 2));
      brick.hp -= decrease;
      total -= decrease;
      guard += decrease;
    }

    if (total !== target) return false;
    bricks.forEach((brick) => {
      brick.maxHp = brick.hp;
    });
    return true;
  }

  function markRewardBricks(bricks, rewardCount) {
    if (!bricks.length) return { total: 0, lower: 0 };

    bricks.forEach((brick) => {
      brick.reward = false;
    });

    const top = Math.min(...bricks.map((brick) => brick.y));
    const bottom = Math.max(...bricks.map((brick) => brick.y + brick.h));
    const lowerThreshold = top + (bottom - top) * (1 - LOWER_REWARD_SHARE);
    const isLower = (brick) => brick.y + brick.h / 2 >= lowerThreshold;
    const lowerCandidates = shuffle(bricks.filter(isLower));
    const allCandidates = shuffle(bricks);
    const requiredLower = Math.min(lowerCandidates.length, Math.ceil(rewardCount * LOWER_REWARD_SHARE));
    const selected = new Set();

    lowerCandidates.slice(0, requiredLower).forEach((brick) => selected.add(brick));
    for (const brick of allCandidates) {
      if (selected.size >= rewardCount) break;
      selected.add(brick);
    }

    selected.forEach((brick) => {
      brick.reward = true;
    });

    return {
      total: selected.size,
      lower: Array.from(selected).filter(isLower).length,
    };
  }

  function countLowerRewardBricks(bricks) {
    if (!bricks.length) return 0;
    const top = Math.min(...bricks.map((brick) => brick.y));
    const bottom = Math.max(...bricks.map((brick) => brick.y + brick.h));
    const lowerThreshold = top + (bottom - top) * (1 - LOWER_REWARD_SHARE);
    return bricks.filter((brick) => brick.reward && brick.y + brick.h / 2 >= lowerThreshold).length;
  }

  function createBrickGrid(ambient = false) {
    if (ambient) {
      const bricks = buildBrickLayout(true);
      markRewardBricks(bricks, 8);
      return bricks;
    }

    const targetHp = getDurabilityHp(game.durabilityIndex, getActiveBoard());
    const rewardRatio = REWARD_LEVELS[game.rewardIndex - 1].ratio;

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const bricks = buildBrickLayout(false);
      if (!adjustBrickDurability(bricks, targetHp)) continue;
      const rewardCount = Math.max(1, Math.round(bricks.length * rewardRatio));
      markRewardBricks(bricks, rewardCount);
      return bricks;
    }

    // Extremely rare fallback: use a complete grid so the target remains reachable.
    const fallback = buildBrickLayout(false);
    while (fallback.some((brick) => brick.hp < 1)) {
      const brick = fallback.find((item) => item.hp < 1);
      if (!brick) break;
      brick.hp = 1;
    }
    if (!adjustBrickDurability(fallback, targetHp)) {
      // Final safety: distribute any remaining difference onto top rows.
      let total = fallback.reduce((sum, brick) => sum + brick.hp, 0);
      let guard = 0;
      while (total < targetHp && guard < 5000) {
        const brick = fallback[Math.floor(Math.random() * fallback.length)];
        if (brick.hp < 10) {
          brick.hp += 1;
          total += 1;
        }
        guard += 1;
      }
      fallback.forEach((brick) => {
        brick.maxHp = brick.hp;
      });
    }
    markRewardBricks(
      fallback,
      Math.max(1, Math.round(fallback.length * rewardRatio)),
    );
    return fallback;
  }

  // ------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------

  const STATUS_COPY = {
    menu: "待机中",
    ready: "准备就绪",
    playing: "游戏中",
    paused: "已暂停",
    won: "已通关",
    lost: "挑战失败",
  };

  function getPointerLockElement() {
    return document.pointerLockElement || document.webkitPointerLockElement || null;
  }

  function isGamePointerLocked() {
    return getPointerLockElement() === stage;
  }

  function requestGamePointerLock() {
    if (game.isMobile || game.mode !== "playing" || isGamePointerLocked()) return;
    const request = stage.requestPointerLock || stage.webkitRequestPointerLock;
    if (!request) return;
    try {
      const result = request.call(stage);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (error) {
      // Fall back to regular mouse input plus the cursor-left auto pause.
    }
  }

  function releaseGamePointerLock() {
    if (!getPointerLockElement()) return;
    const exit = document.exitPointerLock || document.webkitExitPointerLock;
    try {
      exit?.call(document);
    } catch (error) {
      // Ignore; the browser may already have released the lock.
    }
  }

  function handlePointerLockChange() {
    if (isGamePointerLocked()) {
      if (game.mode !== "playing") {
        releaseGamePointerLock();
        return;
      }
      pointer.lastTime = performance.now();
      return;
    }
    if (game.mode === "playing") {
      pauseGame("pointerlock");
    }
  }

  function setMode(mode) {
    if (mode !== "playing") releaseGamePointerLock();
    game.mode = mode;
    dom.mobilePauseButton?.classList.toggle(
      "is-visible",
      game.isMobile && mode === "playing",
    );
    dom.stage.dataset.mode = mode;
    dom.statusPill.dataset.mode = mode;
    dom.statusText.textContent = STATUS_COPY[mode] || "待机中";
    dom.stage.classList.toggle("is-menu", mode === "menu");
  }

  const SETTING_GROUPS = {
    speed: {
      stateKey: "speedIndex",
      levels: DIFFICULTY.map((level, index) => ({
        value: index + 1,
        name: level.name,
        display: level.name,
        unit: level.code,
        aria: `球速 ${index + 1} 档 · ${level.name}`,
      })),
    },
    durability: {
      stateKey: "durabilityIndex",
      levels: DURABILITY_LEVELS.map((level, index) => ({
        value: index + 1,
        name: level.name,
        display: level.display,
        unit: level.unit,
        aria: `砖块总耐久 ${index + 1} 档 · ${level.name} ${level.hp} HP`,
      })),
    },
    reward: {
      stateKey: "rewardIndex",
      levels: REWARD_LEVELS.map((level, index) => ({
        value: index + 1,
        name: level.name,
        display: level.display,
        unit: level.unit,
        aria: `奖励砖 ${index + 1} 档 · ${level.name} ${Math.round(level.ratio * 100)}%`,
      })),
    },
    keyboard: {
      stateKey: "keyboardSpeedIndex",
      levels: KEYBOARD_LEVELS.map((level, index) => ({
        value: index + 1,
        name: level.name,
        display: String(KEYBOARD_SPEEDS[index]),
        unit: "px/s",
        aria: `键盘移速 ${index + 1} 档 · ${level.name} ${KEYBOARD_SPEEDS[index]} 像素每秒`,
      })),
    },
  };

  function getSettingContainers(type) {
    if (type === "speed") return [dom.speedOptions];
    if (type === "durability") return [dom.durabilityOptions];
    if (type === "reward") return [dom.rewardOptions];
    if (type === "keyboard") return [dom.keyboardSpeedOptions, dom.pauseKeyboardOptions];
    return [];
  }

  function buildRail(container, type, levels, config) {
    container.dataset.setting = type;
    container.title = "拖动或点击节点选择";
    container.innerHTML = `
      <div class="rail-graphic" aria-hidden="true">
        <span class="rail-line"></span>
        <span class="rail-fill"></span>
        <span class="rail-thumb"></span>
      </div>
      <div class="rail-nodes">
        ${levels.map((level) => `
          <button class="rail-node" type="button" role="radio" aria-checked="false"
            data-setting="${type}" data-value="${level.value}"
            aria-label="${config.label}：${level.name}">
            <span class="rail-dot" aria-hidden="true"></span>
            <span class="rail-label">${level.name}</span>
          </button>
        `).join("")}
      </div>
    `;

    let dragging = false;

    const pickAt = (clientX) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width) return;
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const index = clamp(Math.round(((ratio * 100) - 10) / 20), 0, 4);
      const nodes = Array.from(container.querySelectorAll(".rail-node"));
      const node = nodes[index];
      if (!node) return;
      const value = Number(node.dataset.value);
      if (value === game[config.stateKey]) return;
      selectSetting(type, value);
      audio.ensure();
      audio.play("wall");
    };

    container.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragging = true;
      container.classList.add("is-dragging");
      try {
        container.setPointerCapture?.(event.pointerId);
      } catch (error) {
        // Synthetic test events may not have an active pointer capture.
      }
      pickAt(event.clientX);
    });

    container.addEventListener("pointermove", (event) => {
      if (dragging) pickAt(event.clientX);
    });

    const stopDragging = (event) => {
      if (!dragging) return;
      dragging = false;
      container.classList.remove("is-dragging");
      try {
        if (container.hasPointerCapture?.(event.pointerId)) {
          container.releasePointerCapture(event.pointerId);
        }
      } catch (error) {
        // Ignore a pointer that was already released.
      }
    };

    container.addEventListener("pointerup", stopDragging);
    container.addEventListener("pointercancel", stopDragging);
    container.addEventListener("lostpointercapture", () => {
      dragging = false;
      container.classList.remove("is-dragging");
    });

    container.addEventListener("click", (event) => {
      const node = event.target.closest(".rail-node");
      if (!node) return;
      const value = Number(node.dataset.value);
      if (value === game[config.stateKey]) return;
      selectSetting(type, value);
      audio.ensure();
      audio.play("wall");
    });

    container.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const nodes = Array.from(container.querySelectorAll(".rail-node"));
      let index = nodes.findIndex((node) => Number(node.dataset.value) === game[config.stateKey]);
      if (index < 0) index = 0;
      if (event.key === "ArrowLeft") index = Math.max(0, index - 1);
      else if (event.key === "ArrowRight") index = Math.min(nodes.length - 1, index + 1);
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = nodes.length - 1;

      const node = nodes[index];
      if (!node) return;
      const value = Number(node.dataset.value);
      if (value !== game[config.stateKey]) {
        selectSetting(type, value);
        audio.ensure();
        audio.play("wall");
      }
      node.focus({ preventScroll: true });
    });
  }

  function buildCards(container, type, levels) {
    container.dataset.setting = type;
    container.innerHTML = levels.map((level) => `
      <button class="choice-option" type="button" role="radio" aria-checked="false"
        data-setting="${type}" data-value="${level.value}" aria-label="${level.aria}">
        <span class="choice-index">${pad(level.value)}</span>
        <span class="choice-value">${level.display}</span>
        <span class="choice-unit">${level.unit}</span>
      </button>
    `).join("");

    container.addEventListener("click", (event) => {
      const button = event.target.closest(".choice-option");
      if (!button) return;
      const changed = selectSetting(type, Number(button.dataset.value));
      if (changed) {
        audio.ensure();
        audio.play("wall");
      }
    });
  }

  function updateRailVisual(container, safe) {
    const nodes = Array.from(container.querySelectorAll(".rail-node"));
    let selectedIndex = nodes.findIndex((node) => Number(node.dataset.value) === safe);
    if (selectedIndex < 0) selectedIndex = 0;
    const position = nodes.length > 1 ? selectedIndex / (nodes.length - 1) : 0;
    const left = 10 + position * 80;
    const thumb = container.querySelector(".rail-thumb");
    const fill = container.querySelector(".rail-fill");
    if (thumb) thumb.style.left = `${left}%`;
    if (fill) fill.style.width = `${position * 80}%`;
    container.style.setProperty("--rail-position", `${left}%`);
  }

  function buildSettingGroup(type) {
    const config = SETTING_GROUPS[type];
    config.label = {
      speed: "球速",
      durability: "砖块总耐久",
      reward: "奖励砖块占比",
      keyboard: "键盘移速",
    }[type];
    // Rewards are displayed from rarest to most generous (left to right),
    // while their tier numbers and score multipliers stay unchanged.
    const renderedLevels = type === "reward"
      ? config.levels.slice().reverse()
      : config.levels;

    getSettingContainers(type).forEach((container) => {
      if (!container) return;
      if (container.classList.contains("choice-rail")) {
        buildRail(container, type, renderedLevels, config);
      } else {
        buildCards(container, type, renderedLevels);
      }
    });
  }

  function updatePanelCode() {
    dom.panelCode.textContent = "LOADOUT READY";
  }

  function selectSetting(type, index) {
    const config = SETTING_GROUPS[type];
    const safe = clamp(Math.round(index), 1, 5);
    const changed = game[config.stateKey] !== safe;
    game[config.stateKey] = safe;

    if (type === "speed") {
      game.speed = SPEEDS[safe - 1] * getBoardSpeedScale(getActiveBoard());
    } else if (type === "durability") {
      game.targetDurability = getDurabilityHp(safe, getActiveBoard());
    } else if (type === "reward") {
      game.rewardRatio = REWARD_LEVELS[safe - 1].ratio;
      game.rewardBrickCount = 0;
    } else if (type === "keyboard") {
      game.keyboardSpeed = KEYBOARD_SPEEDS[safe - 1] * getBoardKeyboardScale(getActiveBoard());
    }

    getSettingContainers(type).forEach((container) => {
      if (!container) return;
      const buttons = Array.from(container.querySelectorAll("[data-value]"));
      buttons.forEach((button) => {
        const active = Number(button.dataset.value) === safe;
        button.classList.toggle("is-selected", active);
        button.setAttribute("aria-checked", String(active));
      });
      if (container.classList.contains("choice-rail")) {
        updateRailVisual(container, safe);
      }
    });

    if (type === "speed") {
      dom.speedReadout.textContent = DIFFICULTY[safe - 1].name;
      dom.speedChipValue.textContent = pad(safe);
    } else if (type === "durability") {
      updateDurabilityUI();
    } else if (type === "reward") {
      dom.rewardReadout.textContent = REWARD_LEVELS[safe - 1].name;
    } else if (type === "keyboard") {
      const level = KEYBOARD_LEVELS[safe - 1];
      dom.keyboardSpeedReadout.textContent = level.name;
      dom.pauseKeyboardReadout.textContent = `${pad(safe)} · ${level.name} ${game.keyboardSpeed} px/s`;
    }

    updatePanelCode();
    return changed;
  }

  function selectSpeed(index) {
    selectSetting("speed", index);
  }

  function normalizePlayerName(value) {
    const cleaned = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 16);
    return cleaned || "Player";
  }

  function readPlayerName() {
    const name = normalizePlayerName(dom.playerName.value);
    dom.playerName.value = name;
    game.playerName = name;
    return name;
  }

  function totalRemainingHp() {
    return game.bricks.reduce((total, brick) => total + Math.max(0, brick.hp), 0);
  }

  function updateHUD() {
    dom.score.textContent = pad(game.score, 6);
    dom.balls.textContent = String(game.balls.length);
    dom.power.textContent = String(game.effect.damageUnlocked ? game.effect.ballPower : 1);
    dom.power.classList.toggle("is-boosted", game.effect.damageUnlocked);
    dom.bricks.textContent = String(game.bricks.length);
    dom.hp.textContent = String(totalRemainingHp());
    dom.time.textContent = formatTime(game.playTime);
    dom.speedChipValue.textContent = pad(game.speedIndex);
  }

  function getTimedBuffs() {
    const now = game.playTime;
    const buffs = [];

    if (game.effect.penetrationUntil > now) {
      buffs.push({
        key: "C",
        icon: "穿透",
        name: "弹珠穿透",
        color: POWERUP_META.C.color,
        remaining: game.effect.penetrationUntil - now,
        total: BUFF_DURATIONS.C,
      });
    }
    if (game.effect.invincibleActive && game.effect.invincibleUntil > now) {
      buffs.push({
        key: "E",
        icon: "无敌",
        name: game.effect.invincibleBank > 0 ? "无敌 · 加长已储存" : "无敌反弹板",
        color: POWERUP_META.E.color,
        remaining: game.effect.invincibleUntil - now,
        total: BUFF_DURATIONS.E,
      });
    }

    return buffs;
  }

  function updateBuffRail() {
    const active = (game.mode === "playing" || game.mode === "paused") ? getTimedBuffs() : [];
    const signature = active.map((buff) => `${buff.key}:${buff.icon}:${buff.name}`).join("|");

    if (signature !== game.buffSignature) {
      game.buffSignature = signature;
      game.buffNodes.clear();

      if (!active.length) {
        dom.buffRail.innerHTML = "";
      } else {
        dom.buffRail.innerHTML = active.map((buff) => `
          <div class="buff-card" data-buff="${buff.key}" style="--buff-color:${buff.color}">
            <div class="buff-top">
              <span class="buff-icon">${buff.icon}</span>
              <span class="buff-name">${buff.name}</span>
              <span class="buff-time"></span>
            </div>
            <span class="buff-track"><i class="buff-fill"></i></span>
          </div>
        `).join("");

        active.forEach((buff) => {
          game.buffNodes.set(buff.key, {
            time: dom.buffRail.querySelector(`[data-buff="${buff.key}"] .buff-time`),
            fill: dom.buffRail.querySelector(`[data-buff="${buff.key}"] .buff-fill`),
          });
        });
      }
    }

    dom.buffRail.classList.toggle("is-visible", active.length > 0);

    active.forEach((buff) => {
      const nodes = game.buffNodes.get(buff.key);
      if (!nodes) return;
      const remaining = Math.max(0, buff.remaining);
      const percent = clamp(remaining / buff.total, 0, 1) * 100;
      if (nodes.time) nodes.time.textContent = `${remaining.toFixed(1)}s`;
      if (nodes.fill) nodes.fill.style.width = `${percent.toFixed(1)}%`;
    });
  }

  function clearBuffRail() {
    game.buffSignature = "";
    game.buffNodes.clear();
    dom.buffRail.innerHTML = "";
    dom.buffRail.classList.remove("is-visible");
  }

  // ------------------------------------------------------------
  // Local leaderboard
  // ------------------------------------------------------------

  function loadLeaderboard() {
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      game.leaderboardEntries = Array.isArray(parsed)
        ? parsed.filter((entry) => (
          entry
          && typeof entry.name === "string"
          && Number.isFinite(Number(entry.score))
          && (entry.outcome === "win" || entry.outcome === "loss")
        )).map((entry) => ({
          ...entry,
          name: normalizePlayerName(entry.name),
          board: entry.board === "portrait" ? "portrait" : "landscape",
          score: Math.max(0, Math.round(Number(entry.score))),
        }))
        : [];
    } catch (error) {
      game.leaderboardEntries = [];
    }
  }

  function saveLeaderboard() {
    try {
      window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(game.leaderboardEntries));
    } catch (error) {
      // The leaderboard still works for this session if storage is unavailable.
    }
  }

  function recordLeaderboard(settlement) {
    const entry = {
      id: `${settlement.at}-${Math.random().toString(36).slice(2, 7)}`,
      name: settlement.playerName,
      score: settlement.finalScore,
      baseScore: settlement.baseScore,
      outcome: settlement.outcome,
      board: settlement.board || "landscape",
      time: settlement.time,
      speedIndex: settlement.speedIndex,
      durabilityIndex: settlement.durabilityIndex,
      rewardIndex: settlement.rewardIndex,
      timeMultiplier: settlement.timeMultiplier,
      totalCoefficient: settlement.totalCoefficient,
      at: settlement.at,
    };
    game.leaderboardEntries.push(entry);
    game.leaderboardEntries.sort((a, b) => b.score - a.score || b.at - a.at);
    game.leaderboardPage = 1;
    saveLeaderboard();
    renderLeaderboard();
  }

  function renderLeaderboard() {
    if (!dom.leaderboardList) return;

    const filter = game.leaderboardFilter;
    const board = game.menuBoard || "landscape";
    const boardLabel = board === "portrait" ? "竖屏" : "横屏";
    const filterLabel = filter === "all" ? "全部战绩" : "通关榜";
    dom.leaderboard.dataset.board = board;
    dom.leaderboardBoardChip.textContent = boardLabel;
    dom.leaderboardBoardChip.dataset.board = board;
    dom.leaderboardTitle.textContent = `${boardLabel}${filterLabel}`;
    dom.leaderboardSubtitle.textContent = filter === "win"
      ? `横屏与竖屏排行榜独立保存；当前仅显示${boardLabel}通关记录。`
      : `横屏与竖屏排行榜独立保存；当前显示${boardLabel}全部战绩。`;

    dom.leaderboardFilters.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const entries = game.leaderboardEntries
      .filter((entry) => entry.board === board)
      .filter((entry) => filter === "all" || entry.outcome === "win")
      .sort((a, b) => b.score - a.score || b.at - a.at);

    const paginate = board === "portrait";
    const pageSize = 10;
    const totalPages = paginate ? Math.max(1, Math.ceil(entries.length / pageSize)) : 1;
    if (paginate) {
      game.leaderboardPage = clamp(game.leaderboardPage || 1, 1, totalPages);
    } else {
      game.leaderboardPage = 1;
    }
    const pageOffset = paginate ? (game.leaderboardPage - 1) * pageSize : 0;
    const visibleEntries = paginate
      ? entries.slice(pageOffset, pageOffset + pageSize)
      : entries;

    dom.leaderboardList.innerHTML = "";
    dom.leaderboard.classList.toggle("is-empty", entries.length === 0);
    dom.leaderboardEmpty.textContent = filter === "win"
      ? `还没有${boardLabel}通关战绩，完成一局后会保存在本机。`
      : `还没有${boardLabel}战绩记录，来打一局吧。`;
    dom.leaderboardCount.textContent = String(entries.length);
    dom.deleteLeaderboardButton.disabled = game.leaderboardEntries.length === 0;

    if (dom.leaderboardPagination && dom.leaderboardPrev && dom.leaderboardNext && dom.leaderboardPageInfo) {
      const showPagination = paginate && totalPages > 1;
      dom.leaderboardPagination.hidden = !showPagination;
      if (showPagination) {
        dom.leaderboardPageInfo.textContent = `第 ${game.leaderboardPage} / ${totalPages} 页`;
        dom.leaderboardPrev.disabled = game.leaderboardPage <= 1;
        dom.leaderboardNext.disabled = game.leaderboardPage >= totalPages;
      }
    }

    visibleEntries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "leaderboard-row";

      const rank = document.createElement("span");
      rank.className = "leaderboard-rank";
      rank.textContent = pad(pageOffset + index + 1);

      const name = document.createElement("span");
      name.className = "leaderboard-player leaderboard-name";
      name.textContent = entry.name;

      if (filter === "all") {
        const tag = document.createElement("span");
        tag.className = `leaderboard-tag${entry.outcome === "loss" ? " is-lose" : ""}`;
        tag.textContent = entry.outcome === "win" ? "CLEAR" : "FAIL";
        name.appendChild(tag);
      }

      const config = document.createElement("span");
      config.className = "leaderboard-config";
      config.textContent = Number.isFinite(entry.speedIndex)
        ? `S${entry.speedIndex}·H${entry.durabilityIndex}·R${entry.rewardIndex}`
        : "—";

      const time = document.createElement("span");
      time.className = "leaderboard-time";
      time.textContent = formatTime(Number(entry.time) || 0);

      const score = document.createElement("span");
      score.className = "leaderboard-score";
      score.textContent = pad(entry.score, 6);

      const when = new Date(entry.at);
      const stamp = Number.isNaN(when.getTime()) ? "" : when.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      row.title = `${entry.name} · ${entry.outcome === "win" ? "通关" : "失败"} · 速度 ${entry.speedIndex} / 总耐久 ${entry.durabilityIndex} / 奖励 ${entry.rewardIndex} · ${stamp}`;
      row.append(rank, name, config, time, score);
      dom.leaderboardList.appendChild(row);
    });
  }

  function setLeaderboardFilter(filter) {
    game.leaderboardFilter = filter === "all" ? "all" : "win";
    game.leaderboardPage = 1;
    renderLeaderboard();
  }

  function openDeleteLeaderboardConfirm() {
    if (game.mode !== "menu" || game.leaderboardEntries.length === 0) return;
    dom.deleteLeaderboardModal.classList.add("is-open");
    window.setTimeout(() => dom.cancelDeleteButton.focus({ preventScroll: true }), 80);
  }

  function closeDeleteLeaderboardConfirm(restoreFocus = true) {
    dom.deleteLeaderboardModal.classList.remove("is-open");
    if (restoreFocus) {
      window.setTimeout(() => {
        const target = dom.deleteLeaderboardButton.disabled
          ? dom.leaderboardFilters.querySelector("button")
          : dom.deleteLeaderboardButton;
        target?.focus({ preventScroll: true });
      }, 60);
    }
  }

  function deleteLocalLeaderboard() {
    if (game.leaderboardEntries.length === 0) {
      closeDeleteLeaderboardConfirm(false);
      return;
    }

    game.leaderboardEntries = [];
    game.leaderboardPage = 1;
    try {
      window.localStorage.removeItem(LEADERBOARD_KEY);
    } catch (error) {
      // The in-memory leaderboard is still cleared for this session.
    }

    dom.deleteLeaderboardModal.classList.remove("is-open");
    renderLeaderboard();
    showToast("本地排行榜已清空", "全部本地战绩与积分已删除", COLORS.red, "×");
    window.setTimeout(() => {
      dom.leaderboardFilters.querySelector("button")?.focus({ preventScroll: true });
    }, 60);
  }

  function setVictoryModalContent(settlement) {
    dom.victoryPlayerName.textContent = settlement.playerName;
    dom.clearTime.textContent = formatTime(settlement.time);
    dom.clearScore.textContent = pad(settlement.finalScore, 6);
    dom.victoryBaseScore.textContent = pad(settlement.baseScore, 6);
    dom.victorySpeedMultiplier.textContent = formatBonus(settlement.speedMultiplier);
    dom.victoryRewardMultiplier.textContent = formatBonus(settlement.rewardMultiplier);
    dom.victoryTimeMultiplier.textContent = formatBonus(settlement.timeMultiplier);
    dom.victoryTotalCoefficient.textContent = formatBonus(settlement.totalCoefficient);
  }

  function setFailureModalContent(settlement) {
    dom.failPlayerName.textContent = settlement.playerName;
    dom.failTime.textContent = formatTime(settlement.time);
    dom.failScore.textContent = pad(settlement.finalScore, 6);
    dom.failBricks.textContent = pad(settlement.remainingBricks, 2);
    dom.failHp.textContent = String(settlement.remainingHp);
    dom.failBaseScore.textContent = pad(settlement.baseScore, 6);
    dom.failSpeedMultiplier.textContent = formatBonus(settlement.speedMultiplier);
    dom.failRewardMultiplier.textContent = formatBonus(settlement.rewardMultiplier);
    dom.failTotalCoefficient.textContent = formatBonus(settlement.totalCoefficient);
  }

  function getClearTimeMultiplier(seconds) {
    const FAST_CLEAR_SECONDS = 60;
    const SLOW_CLEAR_SECONDS = 180;
    if (seconds <= FAST_CLEAR_SECONDS) return 2;
    if (seconds >= SLOW_CLEAR_SECONDS) return 1;
    const value = 2 - (seconds - FAST_CLEAR_SECONDS) / (SLOW_CLEAR_SECONDS - FAST_CLEAR_SECONDS);
    return Math.round(value * 100) / 100;
  }

  function formatBonus(multiplier) {
    return `+${Math.round((multiplier - 1) * 100)}%`;
  }

  function calculateSettlement(outcome) {
    const speedMultiplier = SPEED_MULTIPLIERS[game.speedIndex - 1];
    const rewardMultiplier = REWARD_LEVELS[game.rewardIndex - 1].multiplier;
    const timeMultiplier = outcome === "win" ? getClearTimeMultiplier(game.playTime) : 1;
    const baseScore = game.score;
    // Every coefficient is a bonus applied to the original score. Bonuses add;
    // they do not multiply each other.
    const totalCoefficient = 1
      + (speedMultiplier - 1)
      + (rewardMultiplier - 1)
      + (timeMultiplier - 1);
    const finalScore = Math.round(baseScore * totalCoefficient);

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      outcome,
      playerName: game.playerName,
      baseScore,
      finalScore,
      speedMultiplier,
      rewardMultiplier,
      timeMultiplier,
      totalCoefficient,
      speedIndex: game.speedIndex,
      durabilityIndex: game.durabilityIndex,
      rewardIndex: game.rewardIndex,
      time: game.playTime,
      board: game.roundBoard || game.menuBoard,
      remainingBricks: game.bricks.length,
      remainingHp: totalRemainingHp(),
      at: Date.now(),
    };
  }

  function showToast(title, subtitle, color = COLORS.cyan, icon = "✦") {
    window.clearTimeout(game.toastTimer);
    dom.toast.style.setProperty("--toast-color", color);
    dom.toastIcon.textContent = icon;
    dom.toastTitle.textContent = title;
    dom.toastSubtitle.textContent = subtitle || "";
    dom.toast.classList.add("is-visible");
    game.toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, 2100);
  }

  function hideToast() {
    window.clearTimeout(game.toastTimer);
    dom.toast.classList.remove("is-visible");
  }

  function hideModals() {
    window.clearTimeout(game.winTimer);
    window.clearTimeout(game.failTimer);
    dom.victoryModal.classList.remove("is-open");
    dom.gameOverModal.classList.remove("is-open");
    dom.pauseModal.classList.remove("is-open");
    dom.deleteLeaderboardModal.classList.remove("is-open");
  }

  function showVictoryModal() {
    const settlement = game.lastSettlement || calculateSettlement("win");
    setVictoryModalContent(settlement);
    dom.victoryModal.classList.add("is-open");
    window.setTimeout(() => dom.playAgainButton.focus({ preventScroll: true }), 120);
  }

  function showFailureModal() {
    const settlement = game.lastSettlement || calculateSettlement("loss");
    setFailureModalContent(settlement);
    dom.gameOverModal.classList.add("is-open");
    window.setTimeout(() => dom.okButton.focus({ preventScroll: true }), 120);
  }

  // ------------------------------------------------------------
  // Round lifecycle
  // ------------------------------------------------------------

  function resetEffects() {
    game.effect.penetrationUntil = 0;
    game.effect.damageUnlocked = false;
    game.effect.ballPower = 1;
    game.effect.invincibleUntil = 0;
    game.effect.invincibleActive = false;
    game.effect.invincibleBank = 0;
    game.effect.extension = 0;
    clearBuffRail();
    refreshPaddleWidth();
  }

  function startRound() {
    audio.ensure();
    hideModals();
    hideToast();

    // Clicking "play again" keeps the board locked from the previous round;
    // only returning to the start page allows the orientation to change.
    game.roundBoard = game.roundBoard || game.menuBoard;
    configureBoard(game.roundBoard);

    game.playTime = 0;
    game.score = 0;
    game.lastSettlement = null;
    game.pauseReason = null;
    game.powerups = [];
    game.particles = [];
    game.texts = [];
    game.shake = 0;
    game.flash = 0;
    game.brickId = 0;
    game.powerupId = 0;
    clearBuffRail();
    game.effect.penetrationUntil = 0;
    game.effect.damageUnlocked = false;
    game.effect.ballPower = 1;
    game.effect.invincibleUntil = 0;
    game.effect.invincibleActive = false;
    game.effect.invincibleBank = 0;
    game.effect.extension = 0;
    game.speed = SPEEDS[game.speedIndex - 1] * getBoardSpeedScale(game.roundBoard);
    game.keyboardSpeed = KEYBOARD_SPEEDS[game.keyboardSpeedIndex - 1] * getBoardKeyboardScale(game.roundBoard);
    game.targetDurability = getDurabilityHp(game.durabilityIndex, game.roundBoard);
    game.rewardRatio = REWARD_LEVELS[game.rewardIndex - 1].ratio;
    game.bricks = createBrickGrid(false);
    inputState.mode = "mouse";
    inputState.left = false;
    inputState.right = false;
    game.initialDurability = totalRemainingHp();
    game.initialBrickCount = game.bricks.length;
    game.initialRewardCount = game.bricks.filter((brick) => brick.reward).length;
    game.initialLowerRewardCount = countLowerRewardBricks(game.bricks);
    game.rewardBrickCount = game.initialRewardCount;

    paddle.width = PADDLE.baseWidth;
    paddle.flash = 0;
    paddle.vx = 0;
    paddle.x = getDesiredPaddleX(pointer.active ? pointer.x : FIELD.centerX);
    paddle.targetX = paddle.x;

    game.balls = [{
      x: paddle.x,
      y: paddle.y - BALL_RADIUS - 1,
      vx: 0,
      vy: 0,
      r: BALL_RADIUS,
      stuck: true,
      trail: [],
    }];

    game.winTimer = null;
    game.failTimer = null;
    game.accumulator = 0;
    game.lastFrame = performance.now();
    game.mobileTouchPositioned = false;

    setMode("ready");
    updateLaunchHintCopy();
    updateHUD();
    clearBuffRail();
  }

  function launchBall() {
    if (game.mode !== "ready") return;
    const ball = game.balls[0];
    if (!ball) return;

    ball.stuck = false;
    ball.x = paddle.x;
    ball.y = paddle.y - BALL_RADIUS - 1;
    ball.vx = 0;
    ball.vy = -game.speed;
    ball.trail = [];
    game.playTime = 0;
    game.accumulator = 0;
    game.lastFrame = performance.now();
    setMode("playing");
    requestGamePointerLock();
    spawnParticles(ball.x, ball.y + 2, COLORS.cyanSoft, 10, 105, { gravity: 120, size: 2.2 });
    audio.play("launch");
  }

  function returnToMenu() {
    hideModals();
    hideToast();
    game.balls = [];
    game.bricks = [];
    game.powerups = [];
    game.particles = [];
    game.texts = [];
    game.playTime = 0;
    game.score = 0;
    game.effect.penetrationUntil = 0;
    game.effect.damageUnlocked = false;
    game.effect.ballPower = 1;
    game.effect.invincibleUntil = 0;
    game.effect.invincibleActive = false;
    game.effect.invincibleBank = 0;
    game.effect.extension = 0;
    game.lastSettlement = null;
    game.pauseReason = null;
    game.roundBoard = null;
    clearBuffRail();
    paddle.width = PADDLE.baseWidth;
    paddle.x = FIELD.centerX;
    paddle.targetX = FIELD.centerX;
    paddle.vx = 0;
    inputState.left = false;
    inputState.right = false;
    setMode("menu");
    applyMenuBoard(true);
    dom.playerName.value = game.playerName;
    updateHUD();
    renderLeaderboard();
    window.setTimeout(() => dom.startButton.focus({ preventScroll: true }), 120);
  }

  function finishWin() {
    if (game.mode !== "playing") return;
    const settlement = calculateSettlement("win");
    game.lastSettlement = settlement;
    recordLeaderboard(settlement);
    setMode("won");
    paddle.vx = 0;
    spawnVictoryConfetti();
    audio.play("win");
    updateHUD();
    clearBuffRail();
    window.clearTimeout(game.winTimer);
    game.winTimer = window.setTimeout(showVictoryModal, 620);
  }

  function finishLoss() {
    if (game.mode !== "playing") return;
    const settlement = calculateSettlement("loss");
    game.lastSettlement = settlement;
    recordLeaderboard(settlement);
    setMode("lost");
    paddle.vx = 0;
    game.shake = Math.min(12, game.shake + 8);
    audio.play("lose");
    updateHUD();
    clearBuffRail();
    window.clearTimeout(game.failTimer);
    game.failTimer = window.setTimeout(showFailureModal, 560);
  }

  // ------------------------------------------------------------
  // Pause / resume
  // ------------------------------------------------------------

  function pauseGame(reason = "esc") {
    if (game.mode !== "playing") return;

    inputState.left = false;
    inputState.right = false;
    touchState.active = false;
    paddle.vx = 0;
    game.accumulator = 0;
    game.pauseReason = reason;
    setMode("paused");

    dom.pauseReason.textContent = reason === "mouseleave"
      ? "鼠标移出了游戏区域，本局已自动暂停。"
      : reason === "pointerlock"
        ? "鼠标锁定已解除，本局已自动暂停。"
        : reason === "mobile-landscape"
          ? "手机端仅支持竖屏，游戏已暂停。请旋转回竖屏后继续。"
          : reason === "mobile"
            ? "游戏已暂停。点击「继续游戏」返回战场。"
            : "按 Esc 或点击「继续游戏」返回战场。";
    dom.pauseModal.classList.add("is-open");
    window.setTimeout(() => dom.resumeButton.focus({ preventScroll: true }), 100);
  }

  function resumeGame() {
    if (game.mode !== "paused") return;

    game.pauseReason = null;
    dom.pauseModal.classList.remove("is-open");
    dom.resumeButton.blur();
    inputState.left = false;
    inputState.right = false;
    game.lastFrame = performance.now();
    game.accumulator = 0;
    setMode("playing");
    requestGamePointerLock();
  }

  function abandonGame() {
    if (game.mode !== "paused") return;
    dom.pauseModal.classList.remove("is-open");
    inputState.left = false;
    inputState.right = false;
    returnToMenu();
  }

  // ------------------------------------------------------------
  // Paddle positioning & width
  // ------------------------------------------------------------

  function getDesiredPaddleX(rawX) {
    if (paddle.width >= FIELD.width - 1) return FIELD.centerX;
    const half = paddle.width / 2;
    return clamp(rawX, FIELD.left + half, FIELD.right - half);
  }

  function updateStuckBall() {
    if (game.balls.length === 1 && game.balls[0].stuck) {
      game.balls[0].x = paddle.x;
      game.balls[0].y = paddle.y - BALL_RADIUS - 1;
    }
  }

  function syncPaddlePosition() {
    const raw = (inputState.mode === "keyboard" || inputState.mode === "touch")
      ? paddle.targetX
      : (pointer.active ? pointer.x : FIELD.centerX);
    paddle.targetX = getDesiredPaddleX(raw);
    paddle.x = paddle.targetX;
    updateStuckBall();
  }

  function updateKeyboardPaddle(dt) {
    if (inputState.mode !== "keyboard") return false;

    const direction = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
    if (!direction || paddle.width >= FIELD.width - 1) {
      paddle.vx *= Math.exp(-dt * 14);
      if (Math.abs(paddle.vx) < 0.6) paddle.vx = 0;
      return true;
    }

    const half = paddle.width / 2;
    const min = FIELD.left + half;
    const max = FIELD.right - half;
    const previous = paddle.x;
    const next = clamp(paddle.targetX + direction * game.keyboardSpeed * dt, min, max);

    paddle.x = next;
    paddle.targetX = next;
    paddle.vx = clamp((next - previous) / dt, -2600, 2600);
    updateStuckBall();
    return true;
  }

  function refreshPaddleWidth() {
    const previousWidth = paddle.width;
    if (game.effect.invincibleActive) {
      paddle.width = FIELD.width;
    } else {
      paddle.width = Math.min(PADDLE.baseWidth + game.effect.extension, MAX_PADDLE_WIDTH);
    }
    if (Math.abs(previousWidth - paddle.width) > 0.1) paddle.flash = Math.max(paddle.flash, 0.4);
    syncPaddlePosition();
  }

  function updatePaddle(dt) {
    if (game.effect.invincibleActive && game.effect.invincibleUntil <= game.playTime) {
      expireInvincible();
    }

    if (!updateKeyboardPaddle(dt)) {
      paddle.vx *= Math.exp(-dt * 8.5);
      if (Math.abs(paddle.vx) < 0.6) paddle.vx = 0;
      syncPaddlePosition();
    }
  }

  // ------------------------------------------------------------
  // Effects / powerups
  // ------------------------------------------------------------

  function getBrickHitDamage() {
    // D is a permanent, pickup-only boost. Brick collisions never increase
    // power again; only another D pickup can stack it.
    return game.effect.damageUnlocked ? game.effect.ballPower : 1;
  }

  function isPenetrating() {
    return game.effect.penetrationUntil > game.playTime;
  }

  function expireInvincible() {
    const banked = game.effect.invincibleBank;
    game.effect.invincibleActive = false;
    game.effect.invincibleUntil = 0;
    game.effect.invincibleBank = 0;
    game.effect.extension = Math.min(banked, MAX_EXTENSION);
    refreshPaddleWidth();

    if (banked > 0) {
      showToast(
        "无敌时间结束",
        `已吸收 ${banked}px 加长 · 反弹板宽度已更新`,
        POWERUP_META.E.color,
        "无敌",
      );
    } else {
      showToast(
        "无敌时间结束",
        "反弹板已恢复原始长度",
        POWERUP_META.E.color,
        "无敌",
      );
    }
  }

  function updateEffectTimers() {
    const now = game.playTime;
    if (game.effect.penetrationUntil > 0 && now >= game.effect.penetrationUntil) {
      game.effect.penetrationUntil = 0;
    }
    if (game.effect.invincibleActive && now >= game.effect.invincibleUntil) {
      expireInvincible();
    }
  }

  function createPowerup(type, forcedValue = null) {
    const actualType = POWERUP_META[type] ? type : pickPowerupType();
    let value = 0;
    if (actualType === "A") {
      value = forcedValue ? clamp(Math.round(forcedValue), 2, 10) : weightedTwoToTen();
    }
    return {
      id: game.powerupId++,
      type: actualType,
      value,
      x: 0,
      y: 0,
      r: 23,
      vy: POWERUP_FALL_SPEED,
      phase: Math.random() * TAU,
      bornAt: performance.now() / 1000,
    };
  }

  function spawnPowerupFromBrick(brick) {
    const powerup = createPowerup();
    powerup.x = brick.x + brick.w / 2;
    powerup.y = brick.y + brick.h / 2;
    game.powerups.push(powerup);
    spawnRing(powerup.x, powerup.y, POWERUP_META[powerup.type].color, 11, 0.55);
    spawnParticles(powerup.x, powerup.y, COLORS.gold, 14, 100, { gravity: 40, size: 2.4 });
    audio.play("reward");
  }

  function applyPowerup(powerup) {
    const meta = POWERUP_META[powerup.type];
    const { type, value } = powerup;
    const icon = meta.name;

    switch (type) {
      case "A": {
        splitAllBalls(value);
        showToast("弹珠分裂", `每颗弹珠随机分裂为 ${value} 颗`, meta.color, icon);
        audio.play("split");
        break;
      }
      case "B": {
        if (game.effect.invincibleActive) {
          game.effect.invincibleBank = Math.min(
            game.effect.invincibleBank + PADDLE.extensionStep,
            MAX_EXTENSION,
          );
          showToast(
            "反弹板加长已储存",
            `无敌结束后将继承 +${game.effect.invincibleBank}px 长度`,
            meta.color,
            icon,
          );
        } else {
          game.effect.extension = Math.min(
            game.effect.extension + PADDLE.extensionStep,
            MAX_EXTENSION,
          );
          refreshPaddleWidth();
          showToast(
            "反弹板加长",
            `长度 +${PADDLE.extensionStep}px · 上限为场地宽度的 50%`,
            meta.color,
            icon,
          );
        }
        audio.play("powerup");
        break;
      }
      case "C": {
        const refreshed = game.effect.penetrationUntil > game.playTime;
        game.effect.penetrationUntil = game.playTime + BUFF_DURATIONS.C;
        showToast(
          refreshed ? "弹珠穿透 · 已刷新" : "弹珠穿透",
          refreshed
            ? "效果时长已重置为 10 秒"
            : "10 秒内击毁砖块后不会反弹",
          meta.color,
          icon,
        );
        audio.play("powerup");
        break;
      }
      case "D": {
        const alreadyUnlocked = game.effect.damageUnlocked;
        game.effect.damageUnlocked = true;
        game.effect.ballPower += 1;
        showToast(
          alreadyUnlocked ? "弹珠强化叠加" : "弹珠强化",
          `威力 +1 → 当前威力 ${game.effect.ballPower} · 持续至本局结束`,
          meta.color,
          "强化",
        );
        audio.play("powerup");
        break;
      }
      case "E": {
        const refreshed = game.effect.invincibleActive && game.effect.invincibleUntil > game.playTime;
        game.effect.invincibleActive = true;
        game.effect.invincibleUntil = game.playTime + BUFF_DURATIONS.E;
        refreshPaddleWidth();
        showToast(
          refreshed ? "无敌反弹板 · 已刷新" : "无敌反弹板",
          refreshed
            ? "效果时长已重置为 5 秒 · 加长储存保留"
            : game.effect.invincibleBank > 0
              ? "扩展至全场宽度 · 已储存的加长将在结束后生效"
              : "5 秒内扩展至游戏区域 100% 宽度",
          meta.color,
          icon,
        );
        audio.play("shield");
        break;
      }
      default:
        break;
    }

    spawnRing(powerup.x, powerup.y, meta.color, 18, 0.5);
    spawnParticles(powerup.x, powerup.y, meta.color, 18, 140, { gravity: 30, size: 2.2 });
    game.shake = Math.min(8, game.shake + 1.2);
  }

  function getMaxBalls() {
    return getActiveBoard() === "portrait" ? 120 : MAX_BALLS;
  }

  function splitAllBalls(count) {
    const parents = game.balls.slice();
    const next = [];
    const baseAngle = Math.random() * TAU;

    for (const parent of parents) {
      for (let index = 0; index < count; index += 1) {
        if (next.length >= getMaxBalls()) break;
        const angle = baseAngle + (index / count) * TAU + random(-0.23, 0.23);
        const offset = random(0, 7);
        next.push({
          x: parent.x + Math.cos(angle) * offset,
          y: parent.y + Math.sin(angle) * offset,
          vx: Math.cos(angle) * game.speed,
          vy: Math.sin(angle) * game.speed,
          r: BALL_RADIUS,
          stuck: false,
          trail: [],
        });
      }
    }

    if (next.length) game.balls = next;
    spawnParticles(
      parents[0]?.x || FIELD.centerX,
      parents[0]?.y || FIELD.centerY,
      POWERUP_META.A.color,
      28,
      185,
      { gravity: 0, size: 2.6 },
    );
    game.shake = Math.min(9, game.shake + 2.5);
  }

  // ------------------------------------------------------------
  // Particles & float text
  // ------------------------------------------------------------

  function spawnParticles(x, y, color, count = 12, speed = 140, options = {}) {
    const portrait = getActiveBoard() === "portrait";
    const adjustedCount = portrait ? Math.max(3, Math.ceil(count * 0.65)) : count;
    const particleCap = portrait ? 340 : 520;
    const {
      gravity = 180,
      size = 2,
      drag = 1.8,
      life = 0.55,
      shape = "circle",
    } = options;

    for (let index = 0; index < adjustedCount; index += 1) {
      if (game.particles.length > particleCap) game.particles.shift();
      const angle = Math.random() * TAU;
      const velocity = random(0.25, 1) * speed;
      const maxLife = random(0.55, 1.25) * life;
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - random(0, 0.45) * speed,
        life: maxLife,
        maxLife,
        size: random(0.7, 1.5) * size,
        color,
        gravity,
        drag,
        shape,
        rotation: random(0, TAU),
        spin: random(-8, 8),
      });
    }
  }

  function spawnRing(x, y, color, radius = 22, life = 0.45) {
    const cap = getActiveBoard() === "portrait" ? 360 : 540;
    if (game.particles.length > cap) game.particles.shift();
    game.particles.push({
      type: "ring",
      x,
      y,
      life,
      maxLife: life,
      size: radius,
      color,
    });
  }

  function spawnFloatText(x, y, text, color = COLORS.gold, size = 14) {
    game.texts.push({
      x,
      y,
      text,
      color,
      size,
      life: 0.8,
      maxLife: 0.8,
      vy: -28,
    });
  }

  function spawnVictoryConfetti() {
    const palette = [COLORS.cyan, COLORS.violet, COLORS.gold, COLORS.pink, COLORS.green];
    for (let index = 0; index < 110; index += 1) {
      if (game.particles.length > 550) break;
      const angle = random(-Math.PI * 0.92, -Math.PI * 0.08);
      const speed = random(110, 340);
      game.particles.push({
        x: FIELD.centerX + random(-90, 90),
        y: FIELD.top + random(40, 160),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: random(2.2, 4),
        maxLife: 4,
        size: random(2.5, 5),
        color: palette[index % palette.length],
        gravity: 185,
        drag: 0.28,
        shape: "rect",
        rotation: random(0, TAU),
        spin: random(-9, 9),
      });
    }
  }

  function updateParticles(dt) {
    for (let index = game.particles.length - 1; index >= 0; index -= 1) {
      const particle = game.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        game.particles.splice(index, 1);
        continue;
      }
      if (particle.type === "ring") continue;
      particle.vx *= Math.exp(-particle.drag * dt);
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
    }

    for (let index = game.texts.length - 1; index >= 0; index -= 1) {
      const text = game.texts[index];
      text.life -= dt;
      text.y += text.vy * dt;
      if (text.life <= 0) game.texts.splice(index, 1);
    }

    game.shake *= Math.exp(-dt * 8);
    if (game.shake < 0.04) game.shake = 0;
    paddle.flash = Math.max(0, paddle.flash - dt * 4.5);
  }

  // ------------------------------------------------------------
  // Main fixed update
  // ------------------------------------------------------------

  function fixedUpdate(dt) {
    if (game.mode !== "playing") return;

    game.playTime += dt;
    updateEffectTimers();
    updatePaddle(dt);

    for (const ball of game.balls) {
      const previousY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      resolveWalls(ball);
      resolveBrickCollisions(ball);
      resolvePaddleCollision(ball, previousY);

      if (ball.y - ball.r > FIELD.bottom + 4) {
        ball.dead = true;
      }

      ball.trail.push({ x: ball.x, y: ball.y });
      const trailLimit = getActiveBoard() === "portrait" ? 5 : 8;
      if (ball.trail.length > trailLimit) ball.trail.shift();
    }

    const lostBalls = game.balls.filter((ball) => ball.dead);
    if (lostBalls.length) {
      for (const ball of lostBalls) {
        spawnParticles(ball.x, Math.min(FIELD.bottom - 4, ball.y), COLORS.muted, 5, 80, {
          gravity: 80,
          size: 1.8,
          life: 0.45,
        });
      }
      game.balls = game.balls.filter((ball) => !ball.dead);
    }

    updatePowerups(dt);

    game.bricks.forEach((brick) => {
      brick.flash = Math.max(0, brick.flash - dt * 7.5);
    });

    if (game.bricks.length === 0) {
      finishWin();
    } else if (game.balls.length === 0) {
      finishLoss();
    }
  }

  function resolveWalls(ball) {
    if (ball.x - ball.r < FIELD.left) {
      ball.x = FIELD.left + ball.r;
      if (ball.vx < 0) ball.vx = Math.abs(ball.vx);
      onWallHit(ball, FIELD.left, ball.y);
    } else if (ball.x + ball.r > FIELD.right) {
      ball.x = FIELD.right - ball.r;
      if (ball.vx > 0) ball.vx = -Math.abs(ball.vx);
      onWallHit(ball, FIELD.right, ball.y);
    }

    if (ball.y - ball.r < FIELD.top) {
      ball.y = FIELD.top + ball.r;
      if (ball.vy < 0) ball.vy = Math.abs(ball.vy);
      onWallHit(ball, ball.x, FIELD.top);
    }
  }

  function onWallHit(ball, x, y) {
    const color = game.effect.damageUnlocked ? COLORS.orange : COLORS.cyan;
    spawnParticles(x, y, color, 2, 50, { gravity: 20, size: 1.3, life: 0.3 });
    audio.play("wall");
  }

  function resolvePaddleCollision(ball, previousY) {
    if (ball.vy <= 0) return;
    const half = paddle.width / 2;
    if (ball.x + ball.r * 0.7 < paddle.x - half || ball.x - ball.r * 0.7 > paddle.x + half) return;

    const top = paddle.y;
    const crossedTop = previousY + ball.r <= top + 3 && ball.y + ball.r >= top;
    if (!crossedTop) return;

    ball.y = top - ball.r - 0.4;
    const relative = clamp((ball.x - paddle.x) / half, -1, 1);
    const spin = clamp(paddle.vx / 1450, -1, 1);
    const angle = clamp(relative * 58 + spin * 18, -72, 72);
    const radians = (angle * Math.PI) / 180;

    ball.vx = Math.sin(radians) * game.speed;
    ball.vy = -Math.cos(radians) * game.speed;
    ball.trail = [];

    paddle.flash = 1;
    game.shake = Math.min(6, game.shake + 1.2);
    spawnParticles(ball.x, top + 2, COLORS.cyanSoft, 8, 110, {
      gravity: 170,
      size: 2,
      life: 0.5,
    });
    audio.play("paddle");
  }

  function circleRectCollision(ball, rect) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq > ball.r * ball.r) return null;

    if (distSq > 0.0001) {
      const distance = Math.sqrt(distSq);
      return {
        nx: dx / distance,
        ny: dy / distance,
        overlap: ball.r - distance,
        px: closestX,
        py: closestY,
      };
    }

    const toLeft = ball.x - rect.x;
    const toRight = rect.x + rect.w - ball.x;
    const toTop = ball.y - rect.y;
    const toBottom = rect.y + rect.h - ball.y;
    const min = Math.min(toLeft, toRight, toTop, toBottom);

    if (min === toLeft) {
      return { nx: -1, ny: 0, overlap: toLeft + ball.r, px: rect.x, py: ball.y };
    }
    if (min === toRight) {
      return { nx: 1, ny: 0, overlap: toRight + ball.r, px: rect.x + rect.w, py: ball.y };
    }
    if (min === toTop) {
      return { nx: 0, ny: -1, overlap: toTop + ball.r, px: ball.x, py: rect.y };
    }
    return { nx: 0, ny: 1, overlap: toBottom + ball.r, px: ball.x, py: rect.y + rect.h };
  }

  function reflectBall(ball, nx, ny) {
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
    const length = Math.hypot(ball.vx, ball.vy);
    if (length > 0.001) {
      ball.vx = (ball.vx / length) * game.speed;
      ball.vy = (ball.vy / length) * game.speed;
    }
  }

  function resolveBrickCollisions(ball) {
    for (let index = game.bricks.length - 1; index >= 0; index -= 1) {
      const brick = game.bricks[index];
      const hit = circleRectCollision(ball, brick);
      if (!hit) continue;

      const damage = getBrickHitDamage();
      const willBreak = brick.hp - damage <= 0;
      const penetrating = isPenetrating();

      damageBrick(brick, damage, hit, index);

      // D's overkill power never grants penetration by itself. Only C can
      // let the ball continue through a brick that was just destroyed.
      if (penetrating && willBreak) {
        continue;
      }

      ball.x += hit.nx * (hit.overlap + 0.3);
      ball.y += hit.ny * (hit.overlap + 0.3);
      reflectBall(ball, hit.nx, hit.ny);
      return;
    }
  }

  function calculateBrickHitScore(maxHp, currentHp, damage) {
    const durabilityConsumed = Math.min(damage, currentHp);
    const willBreak = damage >= currentHp;
    const clearMultiplier = willBreak && maxHp > 1
      ? 1.1 + (maxHp - 2) * 0.1
      : 1;
    return {
      points: Math.round(durabilityConsumed * 100 * clearMultiplier),
      durabilityConsumed,
      willBreak,
      clearMultiplier,
    };
  }

  function damageBrick(brick, damage, hit, brickIndex) {
    const { points } = calculateBrickHitScore(brick.maxHp, brick.hp, damage);

    brick.hp -= damage;
    brick.flash = 1;
    game.score += points;

    const palette = brick.reward ? REWARD_PALETTE : (BRICK_PALETTE[brick.hp] || BRICK_PALETTE[1]);
    const hitX = hit.px ?? hit.nx;
    const hitY = hit.py ?? hit.ny;
    spawnParticles(hitX, hitY, palette.glow, brick.hp <= 0 ? 16 : 5, brick.hp <= 0 ? 170 : 80, {
      gravity: 160,
      size: brick.hp <= 0 ? 2.4 : 1.6,
      life: brick.hp <= 0 ? 0.8 : 0.35,
      shape: brick.reward ? "rect" : "circle",
    });

    if (brick.hp > 0) {
      damageBrickSound();
      return;
    }

    // Destroyed. The hit that clears the brick has already received its
    // original-durability multiplier in `points`.
    const centerX = brick.x + brick.w / 2;
    const centerY = brick.y + brick.h / 2;
    game.bricks.splice(brickIndex, 1);
    game.shake = Math.min(8, game.shake + (brick.reward ? 3.2 : 1.5));
    spawnRing(centerX, centerY, palette.glow, brick.reward ? 22 : 14, 0.48);
    spawnFloatText(centerX, centerY - 2, `+${points}`, brick.reward ? COLORS.gold : "#dffbff", brick.reward ? 15 : 12);

    if (brick.reward) {
      spawnPowerupFromBrick(brick);
    } else {
      audio.play("break");
    }
  }

  let lastDamageSound = 0;
  function damageBrickSound() {
    const now = performance.now();
    if (now - lastDamageSound > 35) {
      audio.play("brick");
      lastDamageSound = now;
    }
  }

  function updatePowerups(dt) {
    for (let index = game.powerups.length - 1; index >= 0; index -= 1) {
      const powerup = game.powerups[index];
      powerup.y += powerup.vy * dt;

      if (powerup.y + powerup.r * 0.75 >= paddle.y
        && powerup.y - powerup.r * 0.75 <= paddle.y + paddle.height
        && Math.abs(powerup.x - paddle.x) <= paddle.width / 2 + powerup.r * 0.65) {
        game.powerups.splice(index, 1);
        applyPowerup(powerup);
        continue;
      }

      if (powerup.y - powerup.r > FIELD.bottom + 25) {
        game.powerups.splice(index, 1);
        spawnParticles(powerup.x, FIELD.bottom - 5, "#516175", 7, 55, {
          gravity: -20,
          size: 1.4,
          life: 0.35,
        });
      }
    }
  }

  // ------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------

  function drawBackground(time) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#08111f");
    bg.addColorStop(0.45, "#060d18");
    bg.addColorStop(1, "#040912");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const leftGlow = ctx.createRadialGradient(W * 0.12, H * 0.06, 10, W * 0.12, H * 0.06, W * 0.62);
    leftGlow.addColorStop(0, "rgba(34, 126, 166, 0.11)");
    leftGlow.addColorStop(1, "rgba(34, 126, 166, 0)");
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, W, H);

    const rightGlow = ctx.createRadialGradient(W * 0.86, H * 0.42, 20, W * 0.86, H * 0.42, W * 0.54);
    rightGlow.addColorStop(0, "rgba(95, 65, 173, 0.09)");
    rightGlow.addColorStop(1, "rgba(95, 65, 173, 0)");
    ctx.fillStyle = rightGlow;
    ctx.fillRect(0, 0, W, H);

    const floorGlow = ctx.createRadialGradient(W * 0.5, FIELD.bottom + 80, 20, W * 0.5, FIELD.bottom + 80, 490);
    floorGlow.addColorStop(0, "rgba(25, 119, 154, 0.12)");
    floorGlow.addColorStop(1, "rgba(25, 119, 154, 0)");
    ctx.fillStyle = floorGlow;
    ctx.fillRect(0, 0, W, H);

    // Star field.
    for (const star of game.stars) {
      const twinkle = 0.66 + 0.34 * Math.sin(time * star.speed + star.phase);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, TAU);
      ctx.fillStyle = star.cyan
        ? `rgba(105, 226, 255, ${star.alpha * twinkle})`
        : `rgba(207, 224, 255, ${star.alpha * twinkle})`;
      ctx.fill();
    }

    ctx.save();
    roundRectPath(FIELD.left, FIELD.top, FIELD.width, FIELD.height, 14);
    ctx.clip();

    const inner = ctx.createLinearGradient(0, FIELD.top, 0, FIELD.bottom);
    inner.addColorStop(0, "rgba(8, 20, 35, 0.45)");
    inner.addColorStop(0.6, "rgba(5, 13, 23, 0.2)");
    inner.addColorStop(1, "rgba(4, 10, 18, 0.55)");
    ctx.fillStyle = inner;
    ctx.fillRect(FIELD.left, FIELD.top, FIELD.width, FIELD.height);

    ctx.strokeStyle = "rgba(115, 176, 212, 0.055)";
    ctx.lineWidth = 1;
    for (let x = FIELD.left + 64; x < FIELD.right; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, FIELD.top);
      ctx.lineTo(x, FIELD.bottom);
      ctx.stroke();
    }
    for (let y = FIELD.top + 64; y < FIELD.bottom; y += 64) {
      ctx.beginPath();
      ctx.moveTo(FIELD.left, y);
      ctx.lineTo(FIELD.right, y);
      ctx.stroke();
    }

    // Wander lines near the lower half.
    ctx.globalAlpha = 0.18;
    for (let index = 0; index < 4; index += 1) {
      const y = FIELD.top + 300 + index * 68;
      ctx.beginPath();
      ctx.moveTo(FIELD.left + 20, y);
      ctx.bezierCurveTo(W * 0.34, y - 18, W * 0.66, y + 22, FIELD.right - 20, y - 6);
      ctx.strokeStyle = index % 2 ? "rgba(131, 128, 255, 0.09)" : "rgba(72, 193, 229, 0.1)";
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawFieldFrame(time);
  }

  function drawFieldFrame(time) {
    ctx.save();

    roundRectPath(FIELD.left - 7, FIELD.top - 7, FIELD.width + 14, FIELD.height + 14, 19);
    ctx.strokeStyle = "rgba(108, 171, 212, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    roundRectPath(FIELD.left, FIELD.top, FIELD.width, FIELD.height, 14);
    ctx.strokeStyle = "rgba(125, 191, 227, 0.14)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bright corner brackets.
    const corner = (x, y, dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * 24);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * 24, y);
      ctx.strokeStyle = "rgba(100, 231, 255, 0.48)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };
    corner(FIELD.left - 7, FIELD.top - 7, 1, 1);
    corner(FIELD.right + 7, FIELD.top - 7, -1, 1);
    corner(FIELD.left - 7, FIELD.bottom + 7, 1, -1);
    ctx.strokeStyle = "rgba(150, 143, 255, 0.31)";
    ctx.beginPath();
    ctx.moveTo(FIELD.right + 7, FIELD.bottom + 7);
    ctx.lineTo(FIELD.right + 7, FIELD.bottom - 17);
    ctx.moveTo(FIELD.right + 7, FIELD.bottom + 7);
    ctx.lineTo(FIELD.right - 17, FIELD.bottom + 7);
    ctx.stroke();

    // Floor danger line.
    const danger = ctx.createLinearGradient(FIELD.left, 0, FIELD.right, 0);
    danger.addColorStop(0, "rgba(255, 106, 118, 0)");
    danger.addColorStop(0.28, "rgba(255, 106, 118, 0.21)");
    danger.addColorStop(0.5, "rgba(110, 225, 255, 0.26)");
    danger.addColorStop(0.72, "rgba(110, 225, 255, 0.21)");
    danger.addColorStop(1, "rgba(255, 106, 118, 0)");
    ctx.strokeStyle = danger;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(FIELD.left + 16, FIELD.bottom - 0.5);
    ctx.lineTo(FIELD.right - 16, FIELD.bottom - 0.5);
    ctx.stroke();

    ctx.font = "500 8px 'SFMono-Regular', Menlo, monospace";
    ctx.fillStyle = "rgba(112, 133, 157, 0.38)";
    ctx.textAlign = "left";
    ctx.fillText("PLAYFIELD / 01", FIELD.left + 14, FIELD.top - 17);
    ctx.textAlign = "right";
    ctx.fillText("LOST ZONE", FIELD.right - 14, FIELD.bottom + 19);

    // Small animated signal ticks.
    const pulse = 0.25 + Math.sin(time * 2.2) * 0.14;
    ctx.fillStyle = `rgba(92, 230, 255, ${pulse})`;
    for (let index = 0; index < 5; index += 1) {
      ctx.fillRect(FIELD.left + 18 + index * 8, FIELD.bottom + 14, 4, 1);
    }
    ctx.restore();
  }

  function drawAmbientScene(time) {
    ctx.save();
    ctx.globalAlpha = 0.21;
    for (const brick of game.ambientBricks) {
      drawBrick(brick, time, true);
    }
    ctx.restore();

    // Holographic target rings behind the menu panel.
    const cx = W * 0.79;
    const cy = H * 0.42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.035);
    ctx.strokeStyle = "rgba(92, 230, 255, 0.065)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 214, 0.2, 2.2);
    ctx.arc(0, 0, 214, 3.5, 5.4);
    ctx.stroke();

    ctx.setLineDash([3, 12]);
    ctx.strokeStyle = "rgba(169, 132, 255, 0.08)";
    ctx.beginPath();
    ctx.arc(0, 0, 154, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let index = 0; index < 3; index += 1) {
      const angle = time * (0.16 + index * 0.035) + index * 2.1;
      const radius = 172 + index * 28;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.66, 2.1, 0, TAU);
      ctx.fillStyle = index === 1 ? "rgba(169, 132, 255, 0.26)" : "rgba(92, 230, 255, 0.24)";
      ctx.fill();
    }
    ctx.restore();

    // A few slow drifting glints.
    for (let index = 0; index < 7; index += 1) {
      const x = W * 0.58 + ((time * (8 + index * 2) + index * 139) % (W * 0.4));
      const y = FIELD.top + 30 + ((index * 83 + Math.sin(time * 0.4 + index) * 24) % 330);
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, TAU);
      ctx.fillStyle = `rgba(163, 215, 255, ${0.08 + (index % 3) * 0.035})`;
      ctx.fill();
    }
  }

  function drawBricks(time) {
    for (const brick of game.bricks) {
      drawBrick(brick, time, false);
    }
  }

  function drawBrick(brick, time, ambient) {
    const portrait = game.roundBoard === "portrait";
    const palette = brick.reward ? REWARD_PALETTE : (BRICK_PALETTE[brick.hp] || BRICK_PALETTE[1]);
    const { x, y, w, h } = brick;
    const reveal = ambient ? 1 : clamp((time - brick.spawnAt) * 7, 0, 1);
    if (reveal <= 0) return;

    ctx.save();
    ctx.globalAlpha *= reveal;

    if (brick.reward && !ambient) {
      const pulse = 0.5 + Math.sin(time * 2.8 + brick.seed) * 0.5;
      ctx.save();
      ctx.shadowColor = `rgba(255, 196, 76, ${0.42 + pulse * 0.18})`;
      ctx.shadowBlur = portrait ? 9 + pulse * 4 : 20 + pulse * 9;
      ctx.strokeStyle = `rgba(255, 229, 147, ${0.38 + pulse * 0.24})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -time * 18;
      roundRectPath(x - 3.5, y - 3.5, w + 7, h + 7, 8);
      ctx.stroke();
      ctx.restore();
    }

    let gradient = brick.gradient;
    if (!gradient || brick.gradientHp !== brick.hp) {
      gradient = ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, palette.top);
      gradient.addColorStop(0.45, palette.base);
      gradient.addColorStop(1, palette.deep);
      brick.gradient = gradient;
      brick.gradientHp = brick.hp;
    }

    roundRectPath(x, y, w, h, 6);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dark bottom bevel.
    ctx.save();
    roundRectPath(x, y, w, h, 6);
    ctx.clip();
    ctx.fillStyle = "rgba(1, 7, 14, 0.19)";
    ctx.fillRect(x, y + h - 7, w, 7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.17)";
    ctx.fillRect(x + 1, y + 1, w - 2, 1.5);

    if (brick.reward) {
      // 600ms sweep, 300ms rest, then repeat.
      const shimmerPhase = (time + brick.seed * 0.013) % 0.9;
      if (shimmerPhase < 0.6) {
        const shimmerProgress = shimmerPhase / 0.6;
        const shimmerX = x - 24 + shimmerProgress * (w + 48);
        const shimmer = ctx.createLinearGradient(shimmerX - 24, y, shimmerX + 24, y + h);
        shimmer.addColorStop(0, "rgba(255, 255, 255, 0)");
        shimmer.addColorStop(0.42, "rgba(255, 252, 231, 0.08)");
        shimmer.addColorStop(0.5, "rgba(255, 253, 236, 0.48)");
        shimmer.addColorStop(0.58, "rgba(255, 252, 231, 0.08)");
        shimmer.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = shimmer;
        ctx.fillRect(x, y, w, h);
      }

      ctx.fillStyle = "rgba(45, 24, 3, 0.24)";
      ctx.beginPath();
      ctx.arc(x + 17, y + h / 2, 10.5, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.shadowColor = "rgba(255, 241, 185, 0.95)";
      ctx.shadowBlur = portrait ? 4 : 8;
      drawStar(x + 17, y + h / 2, 6.5, 2.7, 5, "rgba(255, 248, 208, 1)");
      ctx.restore();
    }
    ctx.restore();

    // Inner border.
    roundRectPath(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 5.5);
    ctx.strokeStyle = brick.reward
      ? "rgba(255, 230, 157, 0.74)"
      : "rgba(255, 255, 255, 0.13)";
    ctx.lineWidth = brick.reward ? 1.35 : 1;
    ctx.stroke();

    if (brick.reward && !ambient) {
      // A few twinkles outside the brick make rewards readable at a glance.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 0; index < 3; index += 1) {
        const phase = time * 2.1 + brick.seed * 0.07 + index * 2.3;
        const twinkle = 0.25 + Math.sin(phase) * 0.2;
        const px = x + 12 + ((brick.seed * (index + 3)) % Math.max(1, w - 24));
        const py = index % 2 === 0 ? y - 2 : y + h + 2;
        ctx.fillStyle = `rgba(255, 232, 160, ${twinkle})`;
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 1.4, py);
        ctx.lineTo(px, py + 3);
        ctx.lineTo(px - 1.4, py);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Damage cracks.
    if (brick.hp < brick.maxHp) {
      const damageRatio = 1 - brick.hp / brick.maxHp;
      ctx.save();
      ctx.strokeStyle = `rgba(4, 11, 19, ${0.12 + damageRatio * 0.34})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const crackX = x + w * (0.33 + ((brick.seed % 10) / 100));
      ctx.moveTo(crackX, y + 3);
      ctx.lineTo(crackX + 5, y + 9);
      ctx.lineTo(crackX - 1, y + 14);
      ctx.lineTo(crackX + 4, y + h - 4);
      if (damageRatio > 0.55) {
        ctx.moveTo(x + w * 0.72, y + h - 3);
        ctx.lineTo(x + w * 0.67, y + 13);
        ctx.lineTo(x + w * 0.71, y + 8);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Durability number. In portrait it is larger, and reward bricks keep
    // the same centred baseline as regular bricks despite their star badge.
    ctx.font = `600 ${portrait ? 14 : 12}px 'SFMono-Regular', Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = brick.reward ? "rgba(255, 246, 216, 0.95)" : "rgba(247, 254, 255, 0.9)";
    const numberX = x + w / 2;
    if (brick.reward) {
      ctx.shadowColor = "rgba(84, 44, 3, 0.8)";
      ctx.shadowBlur = 3;
    }
    ctx.fillText(String(Math.max(0, brick.hp)), numberX, y + h / 2 + 0.5);

    ctx.shadowBlur = 0;

    if (!brick.reward && !ambient) {
      ctx.font = "500 6px 'SFMono-Regular', Menlo, monospace";
      ctx.fillStyle = "rgba(5, 19, 29, 0.4)";
      ctx.textAlign = "right";
      ctx.fillText("HP", x + w - 7, y + h / 2 + 1);
    }

    if (brick.flash > 0) {
      ctx.save();
      roundRectPath(x, y, w, h, 6);
      ctx.fillStyle = `rgba(255, 255, 255, ${brick.flash * 0.72})`;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawStar(cx, cy, outer, inner, points, color) {
    ctx.save();
    ctx.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const angle = (index * Math.PI) / points - Math.PI / 2;
      const radius = index % 2 === 0 ? outer : inner;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawPaddle(time) {
    const w = paddle.width;
    const h = paddle.height;
    const x = paddle.x - w / 2;
    const y = paddle.y;
    const invincible = game.effect.invincibleActive;
    const hue = (time * 120) % 360;

    ctx.save();

    // Soft base glow.
    const glow = ctx.createLinearGradient(x, y, x, y + h + 8);
    glow.addColorStop(0, invincible ? `hsla(${hue}, 100%, 68%, 0.55)` : "rgba(92, 230, 255, 0.62)");
    glow.addColorStop(1, "rgba(18, 138, 190, 0)");
    ctx.fillStyle = glow;
    ctx.shadowColor = invincible ? `hsla(${hue}, 100%, 68%, 0.6)` : "rgba(74, 221, 255, 0.62)";
    ctx.shadowBlur = invincible ? 28 : 20;
    roundRectPath(x, y, w, h, h / 2);
    ctx.fill();

    // Core.
    const body = ctx.createLinearGradient(x, y, x, y + h);
    if (invincible) {
      body.addColorStop(0, "#fff9e8");
      body.addColorStop(0.38, `hsl(${hue}, 100%, 74%)`);
      body.addColorStop(1, `hsl(${(hue + 60) % 360}, 85%, 48%)`);
    } else {
      body.addColorStop(0, "#d9fbff");
      body.addColorStop(0.28, "#63e8ff");
      body.addColorStop(0.72, "#199bd0");
      body.addColorStop(1, "#0b6190");
    }
    ctx.shadowBlur = 0;
    roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = body;
    ctx.fill();

    // Top specular line.
    ctx.beginPath();
    ctx.moveTo(x + h, y + 2.3);
    ctx.lineTo(x + w - h, y + 2.3);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.58)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // End caps / emitters.
    for (const endX of [x + 9, x + w - 9]) {
      ctx.beginPath();
      ctx.arc(endX, y + h / 2, 4.2, 0, TAU);
      ctx.fillStyle = invincible ? "rgba(255, 252, 231, 0.9)" : "rgba(211, 250, 255, 0.9)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endX, y + h / 2, 7.5, 0, TAU);
      ctx.strokeStyle = invincible ? "rgba(255, 240, 178, 0.35)" : "rgba(167, 243, 255, 0.28)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center launch notch.
    const notchW = Math.min(34, w * 0.2);
    ctx.beginPath();
    ctx.moveTo(paddle.x - notchW / 2, y + h - 2);
    ctx.lineTo(paddle.x, y + h - 5.5);
    ctx.lineTo(paddle.x + notchW / 2, y + h - 2);
    ctx.strokeStyle = invincible ? "rgba(255, 252, 224, 0.68)" : "rgba(218, 252, 255, 0.54)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    if (invincible) {
      const pulse = 0.4 + Math.sin(time * 8) * 0.18;
      roundRectPath(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
      ctx.strokeStyle = `hsla(${(hue + 140) % 360}, 100%, 74%, ${pulse})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (paddle.flash > 0) {
      roundRectPath(x, y, w, h, h / 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${paddle.flash * 0.45})`;
      ctx.fill();
    }

    ctx.restore();
  }

  function getBallColor() {
    const damage = game.effect.damageUnlocked;
    const penetration = game.effect.penetrationUntil > game.playTime;
    if (damage && penetration) return "#ffc1ff";
    if (damage) return "#ffd28b";
    if (penetration) return "#8df3ff";
    return "#d7fbff";
  }

  function drawBall(ball, time) {
    const color = getBallColor();
    const radius = ball.r;
    const isStuck = ball.stuck;

    if (!isStuck && ball.trail.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let index = 1; index < ball.trail.length; index += 1) {
        const previous = ball.trail[index - 1];
        const current = ball.trail[index];
        const alpha = (index / ball.trail.length) * 0.22;
        ctx.beginPath();
        ctx.moveTo(previous.x, previous.y);
        ctx.lineTo(current.x, current.y);
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.8 + (index / ball.trail.length) * 3.5;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const aura = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, radius * 3.6);
    aura.addColorStop(0, "rgba(255, 255, 255, 0.58)");
    aura.addColorStop(0.18, color);
    aura.addColorStop(1, "rgba(92, 230, 255, 0)");
    ctx.globalAlpha = isStuck ? 0.33 : 0.23;
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius * 3.6, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (isStuck) {
      const pulse = 0.32 + Math.sin(time * 3.4) * 0.12;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius + 8 + Math.sin(time * 3.4) * 2, 0, TAU);
      ctx.strokeStyle = `rgba(167, 246, 255, ${pulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const ballGradient = ctx.createRadialGradient(
      ball.x - radius * 0.32,
      ball.y - radius * 0.38,
      radius * 0.08,
      ball.x,
      ball.y,
      radius,
    );
    ballGradient.addColorStop(0, "#ffffff");
    ballGradient.addColorStop(0.4, "#f0ffff");
    ballGradient.addColorStop(0.78, color);
    ballGradient.addColorStop(1, "rgba(58, 190, 225, 0.8)");
    ctx.fillStyle = ballGradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius - 0.8, 0, TAU);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }

  function drawReadyAim(time) {
    const ball = game.balls[0];
    if (!ball || !ball.stuck) return;

    ctx.save();
    const gradient = ctx.createLinearGradient(0, ball.y - 152, 0, ball.y - 18);
    gradient.addColorStop(0, "rgba(116, 238, 255, 0)");
    gradient.addColorStop(0.55, "rgba(116, 238, 255, 0.18)");
    gradient.addColorStop(1, "rgba(183, 249, 255, 0.34)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -time * 18;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y - 20);
    ctx.lineTo(ball.x, ball.y - 152);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let index = 0; index < 3; index += 1) {
      const offset = 34 + index * 25 - ((time * 10) % 25);
      ctx.beginPath();
      ctx.moveTo(ball.x - 4, ball.y - 18 - offset);
      ctx.lineTo(ball.x, ball.y - 24 - offset);
      ctx.lineTo(ball.x + 4, ball.y - 18 - offset);
      ctx.strokeStyle = `rgba(147, 242, 255, ${0.15 - index * 0.03})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPowerups(time) {
    for (const powerup of game.powerups) {
      drawPowerup(powerup, time);
    }
  }

  function drawPowerup(powerup, time) {
    const meta = POWERUP_META[powerup.type];
    const label = meta.name;
    const detail = powerup.type === "A"
      ? `×${powerup.value}`
      : powerup.type === "B"
        ? "板宽"
        : powerup.type === "C"
          ? "10s"
          : powerup.type === "D"
            ? "永久"
            : "5s";
    const bob = Math.sin(time * 3 + powerup.phase) * 1.4;
    const scale = 1 + Math.sin(time * 4 + powerup.phase) * 0.025;
    const x = powerup.x;
    const y = powerup.y + bob;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const halo = ctx.createRadialGradient(0, 0, 5, 0, 0, 34);
    halo.addColorStop(0, `${meta.color}36`);
    halo.addColorStop(1, `${meta.color}00`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(time * 0.85 + powerup.phase);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = `${meta.color}99`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    const inner = ctx.createRadialGradient(-5, -8, 2, 0, 0, 22);
    inner.addColorStop(0, "rgba(23, 39, 59, 0.98)");
    inner.addColorStop(1, "rgba(5, 12, 22, 0.99)");
    ctx.fillStyle = inner;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = meta.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 17.5, 0, TAU);
    ctx.strokeStyle = `${meta.color}2c`;
    ctx.lineWidth = 1;
    ctx.stroke();

    drawPowerupGlyph(powerup.type, meta.color, time);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f7feff";
    ctx.font = "600 12px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(label, 0, -2.5);

    ctx.font = "500 7px 'SFMono-Regular', Menlo, monospace";
    ctx.fillStyle = meta.color;
    ctx.globalAlpha = 0.9;
    ctx.fillText(detail, 0, 11);

    ctx.restore();
  }

  function drawPowerupGlyph(type, color, time) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.1;
    ctx.globalAlpha = 0.82;

    switch (type) {
      case "A":
        for (const angle of [time * 0.8, time * 0.8 + Math.PI]) {
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * 17, Math.sin(angle) * 17, 1.8, 0, TAU);
          ctx.fill();
        }
        break;
      case "B":
        ctx.beginPath();
        ctx.moveTo(-16, -12);
        ctx.lineTo(-11, -12);
        ctx.moveTo(11, -12);
        ctx.lineTo(16, -12);
        ctx.stroke();
        break;
      case "C":
        for (const x of [-12, 0, 12]) {
          ctx.beginPath();
          ctx.moveTo(x - 2.5, 8);
          ctx.lineTo(x, 11);
          ctx.lineTo(x + 2.5, 8);
          ctx.stroke();
        }
        break;
      case "D":
        drawStar(0, -14, 4, 1.8, 4, color);
        break;
      case "E":
        ctx.beginPath();
        ctx.moveTo(-6, -17);
        ctx.lineTo(6, -17);
        ctx.lineTo(7, -12);
        ctx.lineTo(0, -7);
        ctx.lineTo(-7, -12);
        ctx.closePath();
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    for (const particle of game.particles) {
      const progress = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = progress;
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;

      if (particle.type === "ring") {
        const t = 1 - progress;
        ctx.globalAlpha = progress * 0.5;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size + t * 35, 0, TAU);
        ctx.lineWidth = Math.max(0.5, progress * 1.6);
        ctx.stroke();
        continue;
      }

      if (particle.shape === "rect") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillRect(-particle.size / 2, -particle.size, particle.size, particle.size * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.3, particle.size * progress), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    for (const text of game.texts) {
      const alpha = clamp(text.life / text.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `650 ${text.size}px 'SFMono-Regular', Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = text.color;
      ctx.shadowColor = text.color;
      ctx.shadowBlur = 10;
      ctx.fillText(text.text, text.x, text.y);
      ctx.restore();
    }
  }

  function drawVignette() {
    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, W * 0.65);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.33)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function render(time) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(time);

    if (game.mode === "menu") {
      drawAmbientScene(time);
      drawVignette();
      return;
    }

    ctx.save();
    if (game.shake > 0.05) {
      ctx.translate(random(-game.shake, game.shake) * 0.35, random(-game.shake, game.shake) * 0.3);
    }

    drawBricks(time);

    if (game.mode === "ready") {
      drawReadyAim(time);
    }

    drawPowerups(time);
    drawPaddle(time);

    for (const ball of game.balls) {
      drawBall(ball, time);
    }

    drawParticles();
    if (canUseTouchControl()) drawTouchControl(time);
    ctx.restore();

    drawVignette();
  }

  // ------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------

  function updateReadyState(dt) {
    if (!updateKeyboardPaddle(dt)) {
      syncPaddlePosition();
      paddle.vx *= Math.exp(-dt * 10);
    }
    updateStuckBall();
  }

  function updateVisuals(dt) {
    updateParticles(dt);
    if (game.mode !== "playing") {
      game.bricks.forEach((brick) => {
        brick.flash = Math.max(0, brick.flash - dt * 6);
      });
    }
  }

  function frame(now) {
    const rawDt = (now - game.lastFrame) / 1000;
    game.lastFrame = now;
    const dt = clamp(rawDt, 0, 0.05);

    if (game.mode === "playing") {
      game.accumulator += dt;
      let steps = 0;
      while (game.accumulator >= FIXED_STEP && steps < 10) {
        fixedUpdate(FIXED_STEP);
        game.accumulator -= FIXED_STEP;
        steps += 1;
        if (game.mode !== "playing") break;
      }
      if (steps === 10) game.accumulator = Math.min(game.accumulator, FIXED_STEP);
    } else {
      game.accumulator = 0;
      if (game.mode === "ready") updateReadyState(dt);
    }

    if (game.mode !== "paused") updateVisuals(dt);
    updateHUD();
    updateBuffRail();
    render(now / 1000);
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------
  // Input
  // ------------------------------------------------------------

  function mapClientXToCanvas(clientX) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return FIELD.centerX;
    return ((clientX - rect.left) / rect.width) * W;
  }

  function mapClientToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: FIELD.centerX, y: FIELD.bottom };
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function getTouchControlPosition() {
    return {
      x: paddle.x,
      y: FIELD.bottom - 75,
      r: 38,
    };
  }

  function canUseTouchControl() {
    return game.isMobile
      && game.roundBoard === "portrait"
      && (game.mode === "ready" || game.mode === "playing");
  }

  function updateTouchControl(clientX, timeStamp) {
    const now = timeStamp || performance.now();
    const dt = clamp((now - touchState.lastTime) / 1000, 0.004, 0.09);
    const point = mapClientToWorld(clientX, 0);
    const previous = paddle.x;
    const desired = getDesiredPaddleX(point.x);
    const rawVelocity = (desired - previous) / dt;
    paddle.vx = clamp(lerp(paddle.vx, rawVelocity, 0.68), -2400, 2400);
    paddle.x = desired;
    paddle.targetX = desired;
    inputState.mode = "touch";
    touchState.lastTime = now;
    if (game.mode === "ready") updateStuckBall();
  }

  function startTouchControl(event) {
    touchState.active = true;
    touchState.pointerId = event.pointerId;
    touchState.lastTime = event.timeStamp || performance.now();
    inputState.mode = "touch";
    try {
      stage.setPointerCapture?.(event.pointerId);
    } catch (error) {
      // Synthetic events may not have an active pointer.
    }
    updateTouchControl(event.clientX, event.timeStamp);
  }

  function endTouchControl(event) {
    if (!touchState.active) return;
    if (event && touchState.pointerId !== event.pointerId) return;

    const shouldLaunch = Boolean(
      event
      && event.type === "pointerup"
      && game.mode === "ready"
      && touchState.pendingLaunch
      && !touchState.moved,
    );

    touchState.active = false;
    touchState.pointerId = null;
    touchState.pendingLaunch = false;
    touchState.moved = false;
    if (event) {
      try {
        if (stage.hasPointerCapture?.(event.pointerId)) {
          stage.releasePointerCapture(event.pointerId);
        }
      } catch (error) {
        // Ignore pointer capture that is already gone.
      }
    }

    if (shouldLaunch) launchBall();
  }

  function drawTouchControl(time) {
    if (!canUseTouchControl()) return;
    const control = getTouchControlPosition();
    const active = touchState.active;
    const pulse = 0.5 + Math.sin(time * 3.2) * 0.5;
    ctx.save();
    ctx.lineCap = "round";

    const line = ctx.createLinearGradient(
      control.x,
      paddle.y + paddle.height,
      control.x,
      control.y - control.r,
    );
    line.addColorStop(0, "rgba(92, 230, 255, 0.12)");
    line.addColorStop(0.55, "rgba(92, 230, 255, 0.55)");
    line.addColorStop(1, "rgba(169, 132, 255, 0.85)");
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(paddle.x, paddle.y + paddle.height - 1);
    ctx.lineTo(control.x, control.y - control.r - 3);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.shadowColor = "rgba(92, 230, 255, 0.55)";
    ctx.shadowBlur = active ? 26 : 14 + pulse * 8;
    ctx.fillStyle = "rgba(5, 17, 28, 0.88)";
    ctx.strokeStyle = active
      ? "rgba(219, 253, 255, 0.95)"
      : "rgba(92, 230, 255, 0.62)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(control.x, control.y, control.r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(92, 230, 255, 0.24)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(control.x, control.y, control.r - 8, 0, TAU);
    ctx.stroke();

    const knob = ctx.createRadialGradient(
      control.x - 4,
      control.y - 5,
      1,
      control.x,
      control.y,
      16,
    );
    knob.addColorStop(0, "#f4ffff");
    knob.addColorStop(0.45, "#8ff2ff");
    knob.addColorStop(1, "#2ab7d9");
    ctx.fillStyle = knob;
    ctx.beginPath();
    ctx.arc(control.x, control.y, active ? 14 : 12, 0, TAU);
    ctx.fill();

    ctx.fillStyle = "rgba(4, 18, 27, 0.8)";
    ctx.font = "700 9px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("◀", control.x - 16, control.y + 1);
    ctx.fillText("▶", control.x + 16, control.y + 1);
    ctx.restore();
  }

  function handlePointerMove(event) {
    if (game.isMobile || isGamePointerLocked()) return;

    const now = event.timeStamp || performance.now();
    const dt = clamp((now - pointer.lastTime) / 1000, 0.004, 0.09);
    const canvasX = mapClientXToCanvas(event.clientX);
    const oldRawX = pointer.active ? pointer.x : FIELD.centerX;
    const oldDesiredX = getDesiredPaddleX(oldRawX);

    pointer.x = canvasX;
    pointer.active = true;
    pointer.lastTime = now;

    if (game.mode !== "playing" && game.mode !== "ready") return;

    // Apply the pointer position immediately. Waiting for the next 120 Hz
    // physics tick adds visible input latency on high-refresh mice.
    inputState.mode = "mouse";
    const desired = getDesiredPaddleX(canvasX);
    const rawVelocity = (desired - oldDesiredX) / dt;
    paddle.vx = clamp(lerp(paddle.vx, rawVelocity, 0.68), -2400, 2400);
    paddle.x = desired;
    paddle.targetX = desired;

    if (game.mode === "ready") updateStuckBall();
  }

  function handleLockedMouseMove(event) {
    if (!isGamePointerLocked() || game.mode !== "playing") return;

    const now = event.timeStamp || performance.now();
    const dt = clamp((now - pointer.lastTime) / 1000, 0.004, 0.09);
    const movementX = Number.isFinite(event.movementX) ? event.movementX : 0;
    pointer.lastTime = now;
    if (!movementX) return;

    const rect = canvas.getBoundingClientRect();
    const scale = rect.width > 0 ? W / rect.width : 1;
    const oldDesired = getDesiredPaddleX(paddle.targetX);
    const desired = getDesiredPaddleX(paddle.targetX + movementX * scale);
    inputState.mode = "mouse";
    paddle.vx = clamp(
      lerp(paddle.vx, (desired - oldDesired) / dt, 0.68),
      -2400,
      2400,
    );
    paddle.x = desired;
    paddle.targetX = desired;
    pointer.x = desired;
    pointer.active = true;
  }

  function handlePointerLeavePage(event) {
    if (game.isMobile || isGamePointerLocked() || !pointer.active) return;
    const rect = canvas.getBoundingClientRect();
    let edgeX = null;
    if (event.clientX <= rect.left) edgeX = FIELD.left - 200;
    else if (event.clientX >= rect.right) edgeX = FIELD.right + 200;
    if (edgeX === null) return;
    pointer.x = edgeX;
    pointer.lastTime = performance.now();
    paddle.vx = 0;
    if (game.mode === "playing" || game.mode === "ready") {
      inputState.mode = "mouse";
      paddle.x = getDesiredPaddleX(edgeX);
      paddle.targetX = paddle.x;
      if (game.mode === "ready") syncPaddlePosition();
    }
  }

  function beginGameFromMenu(event) {
    if (event) event.stopPropagation();
    readPlayerName();
    audio.ensure();
    startRound();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  dom.startButton.addEventListener("click", beginGameFromMenu);

  dom.playerName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      beginGameFromMenu();
    }
  });

  dom.playerName.addEventListener("blur", () => {
    dom.playerName.value = normalizePlayerName(dom.playerName.value);
  });

  let nameDiceAnimationTimer = 0;

  dom.nameDiceButton.addEventListener("click", () => {
    const name = pickRandomPlayerName(dom.playerName.value);
    dom.playerName.value = name;
    game.playerName = name;
    dom.nameDiceButton.classList.remove("is-rolling");
    void dom.nameDiceButton.offsetWidth;
    dom.nameDiceButton.classList.add("is-rolling");
    window.clearTimeout(nameDiceAnimationTimer);
    nameDiceAnimationTimer = window.setTimeout(() => {
      dom.nameDiceButton.classList.remove("is-rolling");
    }, 420);
    audio.ensure();
    audio.play("wall");
  });

  function isTextEntryTarget(target) {
    return target instanceof Element && Boolean(
      target.closest("input, textarea, select, [contenteditable='true']"),
    );
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dom.deleteLeaderboardModal.classList.contains("is-open")) {
      event.preventDefault();
      closeDeleteLeaderboardConfirm();
      return;
    }

    if (event.key === "Escape") {
      if (event.repeat) return;
      if (game.mode === "playing") {
        event.preventDefault();
        pauseGame("esc");
      } else if (game.mode === "paused") {
        event.preventDefault();
        resumeGame();
      }
      return;
    }

    if (isTextEntryTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.code === "Space") {
      if (game.mode === "ready") {
        event.preventDefault();
        if (!event.repeat) launchBall();
      }
      return;
    }

    if (event.code !== "KeyA" && event.code !== "KeyD") return;
    if (game.mode !== "playing" && game.mode !== "ready") return;

    event.preventDefault();
    inputState.mode = "keyboard";
    paddle.targetX = paddle.x;

    if (event.code === "KeyA") inputState.left = true;
    if (event.code === "KeyD") inputState.right = true;
  });

  window.addEventListener("keyup", (event) => {
    if (event.code === "KeyA") inputState.left = false;
    if (event.code === "KeyD") inputState.right = false;
  });

  dom.leaderboardFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    setLeaderboardFilter(button.dataset.filter);
  });

  dom.leaderboardPrev.addEventListener("click", () => {
    if (game.leaderboardPage > 1) {
      game.leaderboardPage -= 1;
      renderLeaderboard();
    }
  });

  dom.leaderboardNext.addEventListener("click", () => {
    const board = game.menuBoard || "landscape";
    const entries = game.leaderboardEntries
      .filter((entry) => entry.board === board)
      .filter((entry) => game.leaderboardFilter === "all" || entry.outcome === "win");
    const totalPages = Math.max(1, Math.ceil(entries.length / 10));
    if (game.leaderboardPage < totalPages) {
      game.leaderboardPage += 1;
      renderLeaderboard();
    }
  });

  dom.deleteLeaderboardButton.addEventListener("click", openDeleteLeaderboardConfirm);
  dom.cancelDeleteButton.addEventListener("click", () => closeDeleteLeaderboardConfirm());
  dom.confirmDeleteButton.addEventListener("click", deleteLocalLeaderboard);
  dom.deleteLeaderboardModal.addEventListener("click", (event) => {
    if (event.target === dom.deleteLeaderboardModal) closeDeleteLeaderboardConfirm();
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    if (canUseTouchControl()) {
      const point = mapClientToWorld(event.clientX, event.clientY);
      const control = getTouchControlPosition();
      const onControl = Math.hypot(point.x - control.x, point.y - control.y)
        <= control.r + 30;
      if (onControl) {
        event.preventDefault();
        const freshPositioning = game.mode === "ready" && !game.mobileTouchPositioned;
        touchState.startX = event.clientX;
        touchState.startY = event.clientY;
        touchState.moved = false;
        touchState.pendingLaunch = game.mode === "ready" && game.mobileTouchPositioned;
        if (freshPositioning) {
          game.mobileTouchPositioned = true;
          updateLaunchHintCopy();
        }
        startTouchControl(event);
        return;
      }
      if (game.mode === "ready") {
        // A blank tap must never launch on mobile; the control owns launch.
        event.preventDefault();
      }
      return;
    }

    if (game.mode === "ready") {
      event.preventDefault();
      launchBall();
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!touchState.active || touchState.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (!touchState.moved) {
      const dx = event.clientX - touchState.startX;
      const dy = event.clientY - touchState.startY;
      if (Math.hypot(dx, dy) > 12) touchState.moved = true;
    }
    updateTouchControl(event.clientX, event.timeStamp);
  }, { passive: false });

  stage.addEventListener("pointerup", endTouchControl);
  stage.addEventListener("pointercancel", endTouchControl);
  stage.addEventListener("lostpointercapture", endTouchControl);

  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch" || isGamePointerLocked()) return;
    if (game.mode === "playing") pauseGame("mouseleave");
  });

  dom.resumeButton.addEventListener("click", resumeGame);
  dom.abandonButton.addEventListener("click", abandonGame);

  window.addEventListener("pointerdown", (event) => {
    if (audio.enabled && event.target.closest?.("#soundButton")) return;
    audio.ensure();
  }, { once: true, capture: true });

  document.addEventListener("pointerlockchange", handlePointerLockChange);
  document.addEventListener("webkitpointerlockchange", handlePointerLockChange);

  const pointerEventName = "onpointerrawupdate" in window ? "pointerrawupdate" : "pointermove";
  window.addEventListener(pointerEventName, handlePointerMove, { passive: true });
  window.addEventListener("mousemove", handleLockedMouseMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", handlePointerLeavePage);
  window.addEventListener("blur", () => {
    paddle.vx = 0;
    inputState.left = false;
    inputState.right = false;
  });

  let viewportUpdateFrame = 0;

  function handleViewportChange() {
    syncDeviceClasses();
    const portrait = isPortraitViewport();
    if (
      game.isMobile
      && !portrait
      && game.mode === "playing"
    ) {
      pauseGame("mobile-landscape");
    }
    if (
      game.mode === "paused"
      && portrait
      && game.pauseReason === "mobile-landscape"
    ) {
      game.pauseReason = "mobile";
      dom.pauseReason.textContent = "游戏已暂停。点击「继续游戏」返回战场。";
    }
    if (game.mode === "menu") {
      applyMenuBoard();
    } else if (game.mode === "ready") {
      syncPaddlePosition();
    }
    updateLaunchHintCopy();
  }

  function scheduleViewportChange() {
    window.cancelAnimationFrame(viewportUpdateFrame);
    viewportUpdateFrame = window.requestAnimationFrame(handleViewportChange);
  }

  window.addEventListener("resize", scheduleViewportChange);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(scheduleViewportChange, 120);
  });

  // Mobile browsers can report transient dimensions while the address bar
  // settles. Re-read orientation after load, page restore and visual viewport
  // changes so a portrait phone can never be left behind a landscape gate.
  window.addEventListener("pageshow", scheduleViewportChange);
  window.addEventListener("load", scheduleViewportChange, { once: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleViewportChange, { passive: true });
  }
  if (window.screen?.orientation?.addEventListener) {
    window.screen.orientation.addEventListener("change", scheduleViewportChange);
  }
  window.setTimeout(scheduleViewportChange, 260);

  dom.mobilePauseButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
  });

  dom.mobilePauseButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (game.mode === "playing") pauseGame("mobile");
  });

  dom.soundButton.addEventListener("click", () => {
    audio.setEnabled(!audio.enabled);
    dom.soundButton.classList.toggle("is-muted", !audio.enabled);
    dom.soundButton.setAttribute("aria-pressed", String(audio.enabled));
    dom.soundButton.setAttribute("aria-label", audio.enabled ? "关闭声音" : "开启声音");
    dom.soundButton.setAttribute("title", audio.enabled ? "关闭声音（音乐与音效）" : "开启声音（音乐与音效）");
    if (audio.enabled) audio.play("wall");
  });

  dom.playAgainButton.addEventListener("click", () => {
    startRound();
  });

  dom.victoryMenuButton.addEventListener("click", () => {
    returnToMenu();
  });

  dom.okButton.addEventListener("click", () => {
    returnToMenu();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      audio.stopMusic();
    } else {
      game.lastFrame = performance.now();
      if (audio.enabled && audio.ctx) audio.ensure();
    }
  });

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  game.isMobile = detectMobileDevice();
  syncDeviceClasses();
  game.menuBoard = detectMenuBoard();
  configureBoard(game.menuBoard);
  game.stars = createStars();
  game.ambientBricks = createBrickGrid(true);
  buildSettingGroup("speed");
  buildSettingGroup("durability");
  buildSettingGroup("reward");
  buildSettingGroup("keyboard");
  selectSetting("speed", 3);
  selectSetting("durability", 3);
  selectSetting("reward", 3);
  selectSetting("keyboard", 3);
  dom.playerName.value = pickRandomPlayerName();
  loadLeaderboard();
  updateBoardStatus();
  updateLaunchHintCopy();
  renderLeaderboard();
  game.playerName = normalizePlayerName(dom.playerName.value);
  setMode("menu");
  updateHUD();
  requestAnimationFrame(frame);

  // Debug/automation surface for the demo. Harmless to normal play.
  window.BrickBreakerDemo = {
    getState() {
      return {
        mode: game.mode,
        isMobile: game.isMobile,
        menuBoard: game.menuBoard,
        roundBoard: game.roundBoard,
        playerName: game.playerName,
        speedIndex: game.speedIndex,
        ballSpeed: game.speed,
        durabilityIndex: game.durabilityIndex,
        rewardIndex: game.rewardIndex,
        keyboardSpeedIndex: game.keyboardSpeedIndex,
        keyboardSpeed: game.keyboardSpeed,
        inputMode: inputState.mode,
        targetDurability: game.targetDurability,
        rewardRatio: game.rewardRatio,
        rewardBrickCount: game.rewardBrickCount,
        initialDurability: game.initialDurability,
        initialBrickCount: game.initialBrickCount,
        initialRewardCount: game.initialRewardCount,
        initialLowerRewardCount: game.initialLowerRewardCount,
        score: game.score,
        playTime: game.playTime,
        balls: game.balls.length,
        bricks: game.bricks.length,
        remainingHp: totalRemainingHp(),
        powerups: game.powerups.length,
        paddleWidth: paddle.width,
        paddleX: Math.round(paddle.x),
        pointerActive: pointer.active,
        pointerLocked: isGamePointerLocked(),
        leaderboardFilter: game.leaderboardFilter,
        leaderboardPage: game.leaderboardPage,
        leaderboardEntries: game.leaderboardEntries.length,
        lastSettlement: game.lastSettlement,
        effects: {
          penetration: Math.max(0, game.effect.penetrationUntil - game.playTime),
          damageUnlocked: game.effect.damageUnlocked,
          ballPower: game.effect.ballPower,
          invincible: Math.max(0, game.effect.invincibleUntil - game.playTime),
          invincibleBank: game.effect.invincibleBank,
          extension: game.effect.extension,
        },
      };
    },
    getBricks() {
      return game.bricks.map((brick) => ({
        row: brick.row,
        hp: brick.hp,
        maxHp: brick.maxHp,
        reward: brick.reward,
        x: Math.round(brick.x),
        y: Math.round(brick.y),
        w: Math.round(brick.w),
        h: brick.h,
      }));
    },
    getBoardInfo() {
      return {
        board: getActiveBoard(),
        isMobile: game.isMobile,
        W,
        H,
        field: { ...FIELD },
        paddle: { ...PADDLE },
        ballRadius: BALL_RADIUS,
        speedScale: WORLD_SPEED_SCALE,
        keyboardScale: getBoardKeyboardScale(getActiveBoard()),
        brickLayout: BRICK_LAYOUT,
        canvasBacking: [canvas.width, canvas.height],
        touchControl: getTouchControlPosition(),
      };
    },
    start(speedIndex = 3, durabilityIndex = 3, rewardIndex = 3, name = null) {
      if (name !== null) {
        game.playerName = normalizePlayerName(name);
        dom.playerName.value = game.playerName;
      }
      selectSetting("speed", speedIndex);
      selectSetting("durability", durabilityIndex);
      selectSetting("reward", rewardIndex);
      startRound();
    },
    setName(name) {
      game.playerName = normalizePlayerName(name);
      dom.playerName.value = game.playerName;
    },
    setKeyboardSpeed(index) {
      selectSetting("keyboard", index);
    },
    pause(reason = "debug") {
      pauseGame(reason);
    },
    resume() {
      resumeGame();
    },
    setScore(value) {
      game.score = Math.max(0, Math.round(Number(value) || 0));
      updateHUD();
    },
    clearTimeMultiplier(seconds) {
      return getClearTimeMultiplier(Number(seconds) || 0);
    },
    previewHitScore(maxHp, currentHp, damage) {
      return calculateBrickHitScore(
        clamp(Math.round(maxHp), 1, 10),
        clamp(Math.round(currentHp), 1, 10),
        clamp(Math.round(damage), 1, 10),
      );
    },
    launch() {
      launchBall();
    },
    grant(type, value = null) {
      const powerup = createPowerup(type, value);
      powerup.x = paddle.x;
      powerup.y = paddle.y - 4;
      applyPowerup(powerup);
    },
    drop(type, value = null, x = FIELD.centerX, y = FIELD.top + 280) {
      const powerup = createPowerup(type, value);
      powerup.x = x;
      powerup.y = y;
      game.powerups.push(powerup);
    },
    finish() {
      game.bricks = [];
      finishWin();
    },
    fail() {
      game.balls = [];
      finishLoss();
    },
    getAudioState() {
      return {
        enabled: audio.enabled,
        contextState: audio.ctx?.state || "uninitialized",
        musicRunning: Boolean(audio.musicTimer),
        musicStep: audio.musicStep,
        musicVolume: audio.musicBus?.gain.value ?? 0,
        masterVolume: audio.master?.gain.value ?? 0,
      };
    },
  };

})();
