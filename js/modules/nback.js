// N-back с два канала: позиция и цвят, на 1, 2 или 3 назад.
// Всеки цвят върви със свой символ, за да работи и при цветна слепота.
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const CELLS = 9;
export const COLORS = [
  { id: 'red', symbol: '●' },
  { id: 'blue', symbol: '▲' },
  { id: 'green', symbol: '■' },
  { id: 'yellow', symbol: '◆' },
];
const BASE_TRIALS = 20;
const TARGET_RATE = 0.3;
const SHOW_MS = 1000;

// Трудността определя колко назад се гледа и колко бързо върви редицата.
export function nbackParams(level) {
  const l = Math.min(6, Math.max(1, level));
  return {
    n: l <= 2 ? 1 : l <= 4 ? 2 : 3,
    interval: [2600, 2200, 2800, 2400, 3000, 2600][l - 1],
  };
}

function channel(n, length, values, random) {
  const out = [];
  for (let i = 0; i < length; i += 1) {
    if (i >= n && random() < TARGET_RATE) {
      out.push(out[i - n]);
    } else {
      const avoid = i >= n ? out[i - n] : -1;
      let v = Math.floor(random() * values);
      if (v === avoid) v = (v + 1 + Math.floor(random() * (values - 1))) % values;
      out.push(v);
    }
  }
  return out;
}

// Чиста функция. Съвпаденията се пресмятат от самата редица, а не от намерението на генератора.
export function makeNbackSequence(n, length, random) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const pos = channel(n, length, CELLS, random);
    const color = channel(n, length, COLORS.length, random);
    const items = pos.map((p, i) => ({
      pos: p,
      color: color[i],
      posMatch: i >= n && pos[i - n] === p,
      colorMatch: i >= n && color[i - n] === color[i],
    }));
    if (items.some((x) => x.posMatch) && items.some((x) => x.colorMatch)) return items;
  }
  throw new Error('Неуспешна редица');
}

// Блокът е цял с едно n. Трудността се сменя чак след него: да се смени n по средата обърква редицата.
export function nextNbackLevel(level, accuracy, ceiling) {
  if (accuracy >= 0.8) return Math.min(level + 1, ceiling);
  if (accuracy < 0.6) return Math.max(1, level - 1);
  return level;
}

function closeTrial(g) {
  const { items, index, responses } = g.state;
  const item = items[index];
  if (!item || index < g.state.n) return;
  for (const [key, match] of [['pos', item.posMatch], ['color', item.colorMatch]]) {
    const r = responses[key];
    if (match && r) g.log.correct({ rt: r, limit: g.state.interval });
    else if (!match && !r) g.log.correct();
    else if (match) g.log.error('miss');
    else g.log.error('wrong');
  }
}

function press(g, key, event) {
  const { trial, responses, buttons } = g.state;
  if (responses[key]) return;
  if (!trial || g.state.index < g.state.n) {
    g.log.premature();
    return;
  }
  const rt = g.readReaction(trial, event);
  if (rt === null) return;
  responses[key] = rt;
  buttons[key].classList.add('answer-btn-on');
}

function nextTrial(g) {
  const s = g.state;
  closeTrial(g);
  s.index += 1;
  for (const b of Object.values(s.buttons)) b.classList.remove('answer-btn-on');
  for (const c of s.cells) c.replaceChildren();
  for (const c of s.cells) c.className = 'nb-cell';
  if (s.index >= s.items.length) {
    g.finish();
    return;
  }
  const item = s.items[s.index];
  const cell = s.cells[item.pos];
  const color = COLORS[item.color];
  cell.className = `nb-cell ink-bg-${color.id}`;
  cell.textContent = color.symbol;
  s.responses = {};
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.hideAt = performance.now() + SHOW_MS;
  s.nextAt = performance.now() + s.interval;
  g.statusLabel.textContent = s.index < s.n ? 'Запомняй' : `${s.index + 1 - s.n} от ${s.items.length - s.n}`;
}

export default createGame({
  id: 'nback',
  title: 'N-back',
  category: 'cognitive',
  unlockStep: 0,
  skills: ['memory'],
  description: 'Натисни, когато позицията или цветът съвпадат с показаните преди N стъпки.',
  keys: 'A за същото място, L за същия цвят',
  adapt: false,
  levelText: (level) => `Трудност ${level} · ${nbackParams(level).n} назад`,

  setup(g, stage) {
    const { n, interval } = nbackParams(g.log.level);
    const cells = Array.from({ length: CELLS }, () => h('div', { class: 'nb-cell' }));
    const buttons = {
      pos: h('button', { class: 'answer-btn', type: 'button', 'data-answer': 'pos' }, h('span', {}, 'Позиция'), h('kbd', {}, 'A')),
      color: h('button', { class: 'answer-btn', type: 'button', 'data-answer': 'color' }, h('span', {}, 'Цвят'), h('kbd', {}, 'L')),
    };
    stage.append(
      h('p', { class: 'stroop-cue' }, `Сравнявай с преди ${n} ${n === 1 ? 'стъпка' : 'стъпки'}`),
      h('div', { class: 'nb-grid' }, cells),
      h('div', { class: 'answer-grid answer-grid-2' }, buttons.pos, buttons.color),
    );
    g.state = {
      n, interval, cells, buttons, index: -1, responses: {}, trial: null,
      items: makeNbackSequence(n, BASE_TRIALS + n, Math.random),
      nextAt: 0, hideAt: Infinity,
    };
  },

  begin(g) {
    g.state.nextAt = performance.now() + 500;
  },

  frame(g, now) {
    const s = g.state;
    if (now >= s.hideAt) {
      s.hideAt = Infinity;
      for (const c of s.cells) { c.replaceChildren(); c.className = 'nb-cell'; }
    }
    if (now >= s.nextAt) nextTrial(g);
  },

  beforeEnd(g) {
    g.log.level = nextNbackLevel(g.log.level, g.log.quality(), g.log.maxLevel);
  },

  onAnswer: press,
  onKey(g, e) {
    const key = { KeyA: 'pos', KeyL: 'color' }[e.code];
    if (!key) return false;
    press(g, key, e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Верни решения', wrong: 'Фалшиви натискания', misses: 'Пропуснати съвпадения' }),

  demo() {
    return h('div', { class: 'demo-box demo-nback', 'aria-hidden': 'true' },
      h('div', { class: 'nb-grid nb-grid-demo' }, Array.from({ length: 9 }, (_, i) => h('span', { class: `nb-cell ${i === 4 ? 'demo-nb-lit' : ''}` }))),
      h('span', { class: 'demo-nb-label' }, 'Същото място: натисни „Позиция“'));
  },
});
