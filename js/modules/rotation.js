// „Пространствена ротация“: фигурата трябва да се завърти наум на толкова, колкото е казано.
// Четирите опции са четирите завъртания на СЪЩАТА фигура, затова огледален образ няма и
// въпросът е само „на колко“. Фигурата е избрана така, че четирите завъртания се различават –
// иначе два бутона биха били един и същ отговор.
import { QUARTER_LABELS, makeRotationTask, rotationParams } from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { shapeSvg } from './shared/glyphs.js';

const RUN_MS = 120000;
const FEEDBACK_MS = 700;

function showTask(g) {
  const s = g.state;
  const task = makeRotationTask(g.log.level, Math.random);
  s.task = task;
  s.phase = 'play';
  s.cue.textContent = `Завърти фигурата на ${QUARTER_LABELS[task.quarter]}`;
  s.reference.replaceChildren(shapeSvg(task.shape, task.grid, 'gm-shape-big'));
  s.buttons = task.options.map((cells, i) => h('button', {
    class: 'answer-btn gm-option', type: 'button', 'data-answer': String(i), 'aria-label': `Фигура ${i + 1}`,
  }, shapeSvg(cells, task.grid), h('kbd', {}, String(i + 1))));
  s.options.replaceChildren(...s.buttons);
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + task.limitMs;
  g.updateLevel();
}

function settle(g, value) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  for (const b of s.buttons) {
    if (b.dataset.answer === s.task.answer) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === value) b.classList.add('answer-btn-wrong');
  }
  s.until = performance.now() + FEEDBACK_MS;
}

function answer(g, value, event) {
  const s = g.state;
  if (s.phase !== 'play') return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  if (value === s.task.answer) g.log.correct({ rt, limit: s.task.limitMs });
  else g.log.error('wrong');
  settle(g, value);
}

export default createGame({
  id: 'rotation',
  title: 'Пространствена ротация',
  category: 'reflex',
  unlockStep: 17,
  skills: ['logic', 'memory'],
  description: 'Завърти фигурата наум на казаното и избери как изглежда след това.',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · мрежа ${rotationParams(level).grid}×${rotationParams(level).grid}`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, '');
    const reference = h('div', { class: 'gm-reference' });
    const bar = h('div', { class: 'qm-bar-fill' });
    const options = h('div', { class: 'answer-grid' });
    stage.append(cue, reference, h('div', { class: 'qm-bar' }, bar), options);
    g.state = { cue, reference, bar, options, buttons: [], task: null, trial: null, phase: 'play', until: 0 };
  },

  begin: showTask,

  frame(g, now) {
    const s = g.state;
    if (s.phase === 'play' && s.task) {
      s.bar.style.width = `${Math.max(0, (s.until - now) / s.task.limitMs) * 100}%`;
    }
    if (now < s.until) return;
    if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, null);
    } else showTask(g);
  },

  onAnswer: answer,

  onKey(g, e) {
    const button = g.state.buttons[Number(e.key) - 1];
    if (!button) return false;
    answer(g, button.dataset.answer, e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Верни', wrong: 'Сбъркано завъртане', misses: 'Изтекло време' }),

  demo() {
    const shape = [[0, 0], [0, 1], [0, 2], [1, 2]];
    const turned = [[0, 1], [1, 1], [2, 0], [2, 1]];
    return h('div', { class: 'demo-box demo-mirror', 'aria-hidden': 'true' },
      shapeSvg(shape, 3),
      h('span', { class: 'demo-mirror-arrow' }, '↺'),
      shapeSvg(turned, 3, 'demo-mirror-right'),
      h('span', { class: 'demo-nb-label' }, 'Същата фигура, завъртяна на 90° наляво.'));
  },
});
