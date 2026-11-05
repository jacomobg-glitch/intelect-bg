// „Светулки“: първият истински модул. Доказва общия интерфейс и дава реален XP.
// Докосваш светулките и не пипаш осите. Трудността следва общия staircase (CONFIG.STAIRCASE_UP верни нагоре, 1 грешка надолу).
// Всички цветове идват от styles/tokens.css, за да е една системата с останалите игри.
import { CONFIG } from '../core/config.js';
import { cssVar, h } from '../core/dom.js';
import { sessionXP } from '../core/evolution.js';

const RUN_MS = 60000;
const MIN_VALID_RT = 100;    // реакции под 100 ms се отхвърлят като преждевременни
const TOUCH_MARGIN = 12;     // пръстът е по-неточен от мишката
const WASP_FROM_LEVEL = 3;
const WASP_SHARE = 0.25;
const GAP_MS = [500, 1600];  // случайна пауза, за да не може да се предвижда моментът

const lifetimeAt = (d) => Math.max(450, 1500 - 70 * (d - 1));
const radiusAt = (d) => Math.max(18, 44 - 2 * d);
const random = (a, b) => a + Math.random() * (b - a);

const game = {
  id: 'fireflies',
  title: 'Светулки',
  category: 'reflex',
  unlockStep: 0,
  skills: ['speed', 'attention'],
  description: 'Докосвай светулките, преди да угаснат. Осите не пипай.',
  keys: 'интервал хваща светулката',
  difficulty: 1,
  stim: null,

  init(ctx) {
    this.ctx = ctx;
    this.difficulty = Math.min(Math.max(1, ctx.difficulty || 1), ctx.maxDifficulty || 3);
    this.points = 0;
    this.rts = [];
    this.trials = 0;
    this.correct = 0;
    this.misses = 0;
    this.falseTaps = 0;
    this.premature = 0;
    this.correctRun = 0;
    this.stim = null;
    this.running = false;

    this.canvas = h('canvas', { class: 'game-canvas', 'aria-label': 'Игрално поле' });
    this.timeBar = h('div', { class: 'game-time-fill' });
    this.levelLabel = h('span', {}, '');
    ctx.container.replaceChildren(
      h('div', { class: 'game-hud' }, h('div', { class: 'game-time' }, this.timeBar), this.levelLabel),
      this.canvas,
    );
    this.g = this.canvas.getContext('2d');
    // Цветовете се четат веднъж на сесия: темата не се сменя по време на игра.
    this.colors = {
      grid: cssVar('--game-grid'),
      core: cssVar('--game-fly-core'),
      hot: cssVar('--game-fly-hot'),
      glow: cssVar('--game-fly-glow'),
      edge: cssVar('--game-fly-edge'),
      wasp: cssVar('--game-wasp'),
      stripe: cssVar('--game-on-color'),
    };
    this.resize = () => {
      const r = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      this.w = r.width;
      this.h = r.height;
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(this.canvas);
    this.resize();

    this.onPointer = (e) => this.handleTap(e);
    this.canvas.addEventListener('pointerdown', this.onPointer);
    this.onKeyDown = (e) => {
      if (!this.running || e.repeat || e.code !== 'Space') return;
      e.preventDefault();
      this.press(e.timeStamp || performance.now());
    };
    document.addEventListener('keydown', this.onKeyDown);
    this.updateLevel();
  },

  start() {
    this.running = true;
    this.t0 = performance.now();
    this.nextAt = this.t0 + random(...GAP_MS);
    const frame = () => {
      if (!this.running) return;
      this.tick(performance.now());
      if (this.running) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.canvas?.removeEventListener('pointerdown', this.onPointer);
    document.removeEventListener('keydown', this.onKeyDown);
  },

  tick(now) {
    const elapsed = now - this.t0;
    this.timeBar.style.width = `${Math.max(0, 100 - (elapsed / RUN_MS) * 100)}%`;
    if (elapsed >= RUN_MS) {
      this.stop();
      this.ctx.onEnd();
      return;
    }
    if (this.stim && this.stim.onset !== null && now - this.stim.onset > this.stim.life) {
      this.finishTrial(this.stim.type === 'wasp');
    }
    if (!this.stim && now >= this.nextAt) this.spawn();
    this.draw(now);
    // Времето тече от момента, в който стимулът е реално нарисуван.
    if (this.stim && this.stim.onset === null) this.stim.onset = performance.now();
  },

  spawn() {
    const r = radiusAt(this.difficulty);
    const pad = r + 8;
    const isWasp = this.difficulty >= WASP_FROM_LEVEL && Math.random() < WASP_SHARE;
    this.stim = {
      type: isWasp ? 'wasp' : 'firefly',
      x: random(pad, Math.max(pad + 1, this.w - pad)),
      y: random(pad, Math.max(pad + 1, this.h - pad)),
      r,
      life: lifetimeAt(this.difficulty),
      onset: null,
    };
  },

  handleTap(e) {
    e.preventDefault();
    const s = this.stim;
    if (!this.running) return;
    if (!s || s.onset === null) {
      this.premature += 1;
      return;
    }
    const b = this.canvas.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - b.left - s.x, e.clientY - b.top - s.y);
    // Встрани от стимула: нито вярно, нито грешно – просто не е докоснат.
    if (dist > s.r + TOUCH_MARGIN) return;
    this.press(e.timeStamp || performance.now());
  },

  // Самото решение „хващам ли това“ – еднакво за пръст, мишка и клавиш.
  // С клавиатура отпада само прицелването: на екрана има най-много един стимул.
  press(at) {
    const s = this.stim;
    if (!this.running) return;
    if (!s || s.onset === null) {
      this.premature += 1;
      return;
    }
    const rt = at - s.onset;
    if (rt < MIN_VALID_RT) {
      this.premature += 1;
      return;
    }
    if (s.type === 'firefly') {
      this.rts.push(rt);
      const speedBonus = Math.max(0, 1 - rt / s.life);
      this.points += this.difficulty * 10 * (1 + speedBonus);
      this.finishTrial(true);
    } else {
      this.falseTaps += 1;
      this.finishTrial(false, true);
    }
  },

  finishTrial(correct, alreadyCounted = false) {
    this.trials += 1;
    if (correct) {
      this.correct += 1;
      this.correctRun += 1;
      if (this.correctRun >= CONFIG.STAIRCASE_UP) {
        this.difficulty = Math.min(this.difficulty + 1, this.ctx.maxDifficulty || 3);
        this.correctRun = 0;
      }
    } else {
      if (!alreadyCounted) this.misses += 1;
      this.correctRun = 0;
      this.difficulty = Math.max(1, this.difficulty - 1);
    }
    this.stim = null;
    this.nextAt = performance.now() + random(...GAP_MS);
    this.updateLevel();
  },

  updateLevel() {
    this.levelLabel.textContent = `Трудност ${this.difficulty}`;
  },

  draw(now) {
    const g = this.g;
    g.clearRect(0, 0, this.w, this.h);
    this.drawGrid(g);
    const s = this.stim;
    if (!s) return;
    if (s.type === 'firefly') {
      const pulse = 1 + 0.08 * Math.sin(now / 90);
      const glow = g.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r * 1.5 * pulse);
      glow.addColorStop(0, this.colors.hot);
      glow.addColorStop(0.55, this.colors.glow);
      glow.addColorStop(1, this.colors.edge);
      g.fillStyle = glow;
      g.beginPath();
      g.arc(s.x, s.y, s.r * 1.5 * pulse, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = this.colors.core;
      g.beginPath();
      g.arc(s.x, s.y, s.r * 0.5, 0, Math.PI * 2);
      g.fill();
    } else {
      // Осата се различава и по форма, не само по цвят, за да работи при цветна слепота.
      g.save();
      g.translate(s.x, s.y);
      g.rotate(Math.PI / 4);
      const a = s.r * 0.95;
      g.fillStyle = this.colors.wasp;
      g.fillRect(-a, -a, a * 2, a * 2);
      g.fillStyle = this.colors.stripe;
      g.fillRect(-a, -a * 0.45, a * 2, a * 0.35);
      g.fillRect(-a, a * 0.2, a * 2, a * 0.35);
      g.restore();
    }
  },

  // Същата мрежа като фона на приложението.
  drawGrid(g) {
    const STEP = 56;
    g.strokeStyle = this.colors.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = STEP; x < this.w; x += STEP) { g.moveTo(x, 0); g.lineTo(x, this.h); }
    for (let y = STEP; y < this.h; y += STEP) { g.moveTo(0, y); g.lineTo(this.w, y); }
    g.stroke();
  },

  score() {
    return Math.round(this.points);
  },

  // Без нито една вярна реакция няма XP: оставено устройство не трупа напредък.
  xpReward() {
    if (!this.rts.length) return 0;
    return sessionXP({ activeMs: RUN_MS, quality: this.trials ? this.correct / this.trials : 0 });
  },

  stats() {
    const n = this.rts.length;
    const meanRT = n ? this.rts.reduce((a, b) => a + b, 0) / n : null;
    const sd = n > 1 ? Math.sqrt(this.rts.reduce((a, b) => a + (b - meanRT) ** 2, 0) / (n - 1)) : null;
    return {
      meanRT,
      rows: [
        ['Средно време', meanRT === null ? '–' : `${Math.round(meanRT)} ms`],
        ['Вариабилност', sd === null ? '–' : `±${Math.round(sd)} ms`],
        ['Уцелени', `${n}`],
        ['Пропуски', `${this.misses}`],
        ['Докосната оса', `${this.falseTaps}`],
        ['Преждевременни', `${this.premature}`],
      ],
    };
  },

  // Кратка анимирана демонстрация преди първата игра.
  demo() {
    return h('div', { class: 'demo-fireflies', 'aria-hidden': 'true' },
      h('span', { class: 'demo-fly' }),
      h('span', { class: 'demo-ripple' }),
      h('span', { class: 'demo-wasp' }),
      h('span', { class: 'demo-no' }, '✕'));
  },
};

export default game;
