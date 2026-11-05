// Stroop: инхибиция. Отговаря се по цвета (или формата), а думата пречи.
// Вариантът с форми работи и при цветна слепота.
import { h, trustedSvg } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;

export const COLOR_SET = [
  { id: 'red', word: 'ЧЕРВЕНО', label: 'Червено' },
  { id: 'blue', word: 'СИНЬО', label: 'Синьо' },
  { id: 'green', word: 'ЗЕЛЕНО', label: 'Зелено' },
  { id: 'yellow', word: 'ЖЪЛТО', label: 'Жълто' },
];

export const SHAPE_SET = [
  { id: 'circle', word: 'КРЪГ', label: 'Кръг' },
  { id: 'square', word: 'КВАДРАТ', label: 'Квадрат' },
  { id: 'triangle', word: 'ТРИЪГЪЛНИК', label: 'Триъгълник' },
  { id: 'star', word: 'ЗВЕЗДА', label: 'Звезда' },
];

const SHAPE_SVG = {
  circle: '<circle cx="50" cy="50" r="38"/>',
  square: '<rect x="14" y="14" width="72" height="72" rx="4"/>',
  triangle: '<path d="M50 10 92 86H8Z"/>',
  star: '<path d="M50 6 62 38 96 39 69 60 79 93 50 74 21 93 31 60 4 39 38 38Z"/>',
};
const shapeEl = (id) => trustedSvg(`<svg viewBox="0 0 100 100">${SHAPE_SVG[id]}</svg>`, 'stroop-shape');

export const stroopParams = (level) => ({
  limit: Math.max(800, 2600 - 180 * (level - 1)),
  congruentShare: Math.max(0.1, 0.5 - 0.08 * (level - 1)),
  // От трудност 4 понякога правилото се сменя: отговаря се по думата. Така се тренира и гъвкавост.
  wordRuleShare: level >= 4 ? 0.3 : 0,
});

const pick = (random, list) => list[Math.floor(random() * list.length)];

// Чиста функция: word и ink са id от набора, answer е id на верния бутон.
export function makeStroopTrial(level, random, set = COLOR_SET) {
  const { limit, congruentShare, wordRuleShare } = stroopParams(level);
  const ink = pick(random, set).id;
  const congruent = random() < congruentShare;
  const others = set.filter((s) => s.id !== ink);
  const word = congruent ? ink : pick(random, others).id;
  const rule = random() < wordRuleShare ? 'word' : 'ink';
  return { word, ink, rule, answer: rule === 'word' ? word : ink, congruent, limit };
}

const nextGap = () => 300 + Math.random() * 600;
export const RULE_WARNING = 'Внимание: правилото се сменя';
const WARN_MS = 1800;  // колко дълго стои предупреждението преди първата смяна на правилото

// Показва вече подготвения опит. Времето тече от кадъра, в който стимулът е на екрана.
function reveal(g) {
  const { set, stim, cue } = g.state;
  const trial = g.state.pending;
  g.state.pending = null;
  g.state.trial = trial;
  const word = set.find((s) => s.id === trial.word).word;
  cue.textContent = trial.rule === 'word' ? 'Отговори по ДУМАТА' : (g.state.variant === 'shape' ? 'Отговори по ФОРМАТА' : 'Отговори по ЦВЕТА');
  cue.classList.toggle('stroop-cue-switch', trial.rule === 'word');
  cue.classList.remove('stroop-cue-warn');
  if (g.state.variant === 'shape') {
    stim.replaceChildren(shapeEl(trial.ink), h('span', { class: 'stroop-caption' }, word));
    stim.className = 'stroop-stim';
  } else {
    stim.textContent = word;
    stim.className = `stroop-stim stroop-word ink-${trial.ink}`;
  }
  g.markOnset(trial);
}

// Подготвя следващия опит. Преди ПЪРВАТА смяна на правилото изчаква с кратко предупреждение:
// смяната трябва да е трудна, а не капан. После смените идват без предупреждение.
function present(g, now) {
  g.state.pending = { ...makeStroopTrial(g.log.level, Math.random, g.state.set), onset: null };
  if (g.state.pending.rule === 'word' && !g.state.warned) {
    g.state.warned = true;
    g.state.stim.replaceChildren();
    g.state.stim.className = 'stroop-stim';
    g.state.cue.textContent = RULE_WARNING;
    g.state.cue.classList.add('stroop-cue-warn');
    g.state.revealAt = now + WARN_MS;
    return;
  }
  reveal(g);
}

function settle(g) {
  g.state.trial = null;
  g.state.stim.replaceChildren();
  g.state.stim.className = 'stroop-stim';
  g.state.pending = null;
  g.state.nextAt = performance.now() + nextGap();
  g.updateLevel();
}

function answer(g, value, event) {
  const trial = g.state.trial;
  const rt = g.readReaction(trial, event);
  if (rt === null) return;
  if (value === trial.answer) g.log.correct({ rt, limit: trial.limit });
  else g.log.error('wrong');
  settle(g);
}

export default createGame({
  id: 'stroop',
  title: 'Stroop',
  category: 'cognitive',
  unlockStep: 0,
  skills: ['attention', 'flexibility'],
  description: 'Думата казва едно, цветът друго. Отговаряй по цвета.',
  keys: 'цифрите 1–4 избират отговор',
  runMs: RUN_MS,

  setup(g, stage) {
    const variant = g.ctx.settings?.stroopVariant === 'shape' ? 'shape' : 'color';
    const set = variant === 'shape' ? SHAPE_SET : COLOR_SET;
    const cue = h('p', { class: 'stroop-cue' }, '');
    const stim = h('div', { class: 'stroop-stim', 'aria-live': 'off' });
    const buttons = h('div', { class: 'answer-grid' }, set.map((s, i) => h('button', {
      class: 'answer-btn', type: 'button', 'data-answer': s.id, 'aria-label': s.label,
    },
    variant === 'shape' ? shapeEl(s.id) : h('span', { class: `swatch ink-bg-${s.id}` }),
    h('span', {}, s.label),
    h('kbd', {}, String(i + 1)))));
    stage.append(cue, stim, buttons);
    g.state = {
      variant, set, cue, stim, trial: null, pending: null, warned: false, revealAt: 0,
      nextAt: performance.now() + nextGap(),
    };
  },

  frame(g, now) {
    const { trial, pending, nextAt } = g.state;
    if (pending) {
      if (now >= g.state.revealAt) reveal(g);
      return;
    }
    if (!trial && now >= nextAt) present(g, now);
    else if (trial && trial.onset !== null && now - trial.onset > trial.limit) {
      g.log.error('miss');
      settle(g);
    }
  },

  onAnswer: answer,
  onTap(g) { if (!g.state.trial) g.log.premature(); },
  onKey(g, e) {
    const item = g.state.set[Number(e.key) - 1];
    if (!item) return false;
    answer(g, item.id, e);
    return true;
  },

  introOptions({ settings, save }) {
    const options = [['color', 'С цветове'], ['shape', 'С форми (без цветове)']];
    const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Вариант на играта' }, options.map(([id, label]) => h('button', {
      type: 'button',
      class: settings.stroopVariant === id ? 'active' : '',
      'aria-pressed': String(settings.stroopVariant === id),
      onclick: async (e) => {
        await save({ stroopVariant: id });
        for (const b of wrap.children) {
          const on = b === e.currentTarget;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        }
      },
    }, label)));
    return wrap;
  },

  demo() {
    return h('div', { class: 'demo-box demo-stroop', 'aria-hidden': 'true' },
      h('span', { class: 'demo-word ink-blue' }, 'ЧЕРВЕНО'),
      h('span', { class: 'demo-pick' }, h('span', { class: 'swatch ink-bg-blue' }), 'Синьо'));
  },
});
