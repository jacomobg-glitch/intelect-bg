// „Многозадачност“: две неща вървят едновременно. Стрелките искат бърз отговор, а
// резервоарът изтича без да пита и трябва да се допълни, когато падне под половината.
// Пълен резервоар не се пълни: натискане „Напълни“ отгоре е грешка, иначе играта би се
// свеждала до едно непрекъснато чукане по бутона. Горивото се вижда и като дължина, и като
// число, затова цветът не е единственият сигнал.
import {
  REFILL_BELOW, canRefill, makeMultitaskTrial, multitaskParams,
} from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { ARROW_LABELS, arrowSvg } from './shared/glyphs.js';

const RUN_MS = 90000;
const FEEDBACK_MS = 380;
const SIDES = ['left', 'right'];
const KEY_FOR = { ArrowLeft: 'left', ArrowRight: 'right' };

function showFuel(g) {
  const s = g.state;
  const low = canRefill(s.fuel);
  s.fuelFill.style.width = `${(s.fuel * 100).toFixed(1)}%`;
  s.fuelText.textContent = `${Math.round(s.fuel * 100)}%`;
  if (low !== s.low) {
    s.low = low;
    s.gauge.classList.toggle('mt-low', low);
    s.refill.classList.toggle('mt-refill-due', low);
  }
}

function arm(g) {
  const s = g.state;
  s.phase = 'wait';
  s.trial = null;
  s.task = makeMultitaskTrial(g.log.level, Math.random);
  s.stim.replaceChildren(h('span', { class: 'cr-dash' }, '—'));
  for (const b of s.sides) b.className = 'answer-btn cr-option';
  s.refill.classList.remove('answer-btn-wrong');
  s.until = performance.now() + s.task.waitMs;
  g.updateLevel();
}

function show(g) {
  const s = g.state;
  s.phase = 'play';
  s.stim.replaceChildren(arrowSvg(s.task.sign, 'cr-stim-arrow'));
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + s.task.limitMs;
}

function settle(g, pressed) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  for (const b of s.sides) {
    if (b.dataset.answer === s.task.sign) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === pressed) b.classList.add('answer-btn-wrong');
  }
  s.until = performance.now() + FEEDBACK_MS;
}

function pressSide(g, side, event) {
  const s = g.state;
  if (s.phase !== 'play') {
    // Натискане, преди да е светнало: брои се за преждевременно и чакането започва отново.
    if (s.phase === 'wait') {
      g.readReaction(null, event);
      s.cue.textContent = 'Рано. Изчакай стрелката.';
      s.until = performance.now() + s.task.waitMs;
    }
    return;
  }
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  if (side !== s.task.sign) g.log.error('wrong');
  else g.log.correct({ rt, limit: s.task.limitMs });
  s.last.textContent = `${Math.round(rt)} ms`;
  settle(g, side);
}

// Второто задание: допълването е верен отговор само когато резервоарът наистина е нисък.
function pressRefill(g) {
  const s = g.state;
  if (canRefill(s.fuel)) {
    s.fuel = 1;
    s.refills += 1;
    g.log.correct();
    s.refill.classList.remove('answer-btn-wrong');
  } else {
    g.log.error('wrong');
    s.early += 1;
    s.refill.classList.add('answer-btn-wrong');
  }
  showFuel(g);
}

export default createGame({
  id: 'multitask',
  title: 'Многозадачност',
  category: 'reflex',
  unlockStep: 18,
  skills: ['flexibility', 'attention'],
  description: 'Отговаряй на стрелките и в същото време не оставяй резервоара да пресъхне.',
  keys: 'стрелките ← → отговарят, интервал пълни резервоара',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · изтича ${Math.round(multitaskParams(level).drainPerSec * 100)}%/с`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, `Напълни, щом горивото падне под ${Math.round(REFILL_BELOW * 100)}%`);
    const stim = h('div', { class: 'cr-stim' });
    const last = h('span', { class: 'reaction-last' }, '');
    const fuelFill = h('div', { class: 'mt-fuel-fill' });
    const fuelText = h('span', { class: 'mt-fuel-text' }, '100%');
    const gauge = h('div', { class: 'mt-gauge' },
      h('span', { class: 'mt-fuel-label' }, 'Гориво'),
      h('div', { class: 'mt-fuel-track' }, fuelFill, h('span', { class: 'mt-fuel-mark' })),
      fuelText);
    const refill = h('button', {
      class: 'answer-btn mt-refill', type: 'button', 'data-answer': 'fuel',
    }, h('span', {}, 'Напълни'), h('kbd', {}, 'Space'));
    const sides = SIDES.map((dir) => h('button', {
      class: 'answer-btn cr-option', type: 'button', 'data-answer': dir, 'aria-label': ARROW_LABELS[dir],
    }, arrowSvg(dir, 'cr-option-arrow')));
    stage.append(cue, stim, last, gauge, h('div', { class: 'mt-pads' }, sides[0], refill, sides[1]));
    g.state = {
      cue, stim, last, gauge, fuelFill, fuelText, refill, sides,
      fuel: 1, low: false, refills: 0, early: 0, dry: 0,
      task: null, trial: null, phase: 'wait', until: 0, tick: 0,
    };
  },

  begin(g) {
    g.state.tick = performance.now();
    showFuel(g);
    arm(g);
  },

  frame(g, now) {
    const s = g.state;
    // Горивото изтича независимо от стрелките: това е второто задание, не фон.
    const dt = Math.min(64, now - s.tick); // след скрит екран кадърът не бива да скача
    s.tick = now;
    s.fuel = Math.max(0, s.fuel - multitaskParams(g.log.level).drainPerSec * (dt / 1000));
    if (s.fuel <= 0) {
      s.fuel = 1;
      s.dry += 1;
      g.log.error('miss');
    }
    showFuel(g);
    if (now < s.until) return;
    if (s.phase === 'wait') show(g);
    else if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, null);
    } else arm(g);
  },

  onAnswer(g, value, event) {
    if (value === 'fuel') pressRefill(g);
    else pressSide(g, value, event);
  },

  onKey(g, e) {
    if (e.code === 'Space') {
      pressRefill(g);
      return true;
    }
    const dir = KEY_FOR[e.code];
    if (!dir) return false;
    pressSide(g, dir, e);
    return true;
  },

  rows: (g) => [
    ['Допълвания навреме', `${g.state.refills}`],
    ['Излишни допълвания', `${g.state.early}`],
    ['Пресъхнал резервоар', `${g.state.dry}`],
    ...g.log.rows({ correct: 'Верни', wrong: 'Грешни', misses: 'Пропуснати' }),
  ],

  demo() {
    return h('div', { class: 'demo-box demo-mt', 'aria-hidden': 'true' },
      h('div', { class: 'cr-stim demo-cr-stim' }, arrowSvg('left', 'cr-stim-arrow')),
      h('div', { class: 'mt-gauge demo-mt-gauge' },
        h('div', { class: 'mt-fuel-track' }, h('div', { class: 'mt-fuel-fill demo-mt-fill' }), h('span', { class: 'mt-fuel-mark' }))),
      h('span', { class: 'demo-nb-label' }, 'Стрелката иска отговор, а горивото – допълване.'));
  },
});
