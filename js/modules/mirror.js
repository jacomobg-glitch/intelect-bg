// „Огледални и завъртени фигури“: една от опциите е същата фигура, само завъртяна,
// а останалите са огледални образи. Без таймер под напрежение: задачата иска въртене наум.
import { makeMirrorTask } from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { shapeSvg } from './shared/glyphs.js';

export const TASKS = 8;
const MAX_TASK_MS = 90000;    // замислен е добре, забравено устройство не е
export const SPEED_LIMIT_MS = 25000;
const FEEDBACK_MS = 900;

function showTask(g) {
  const s = g.state;
  const task = makeMirrorTask(g.log.level, Math.random);
  s.task = task;
  s.trial = { onset: null };
  s.taskStart = performance.now();
  g.statusLabel.textContent = `Задача ${s.done + 1} от ${TASKS}`;

  const options = task.options.map((cells, i) => h('button', {
    class: 'answer-btn gm-option', type: 'button', 'data-answer': String(i), 'aria-label': `Фигура ${i + 1}`,
  }, shapeSvg(cells, task.grid)));

  s.board.replaceChildren(
    h('p', { class: 'stroop-cue' }, 'Коя е същата фигура, само завъртяна?'),
    h('div', { class: 'gm-reference' }, shapeSvg(task.shape, task.grid, 'gm-shape-big')),
    h('div', { class: 'answer-grid' }, options),
  );
  g.markOnset(s.trial);
  g.updateLevel();
}

function answer(g, value, event) {
  const s = g.state;
  if (s.locked) return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  s.locked = true;
  s.activeMs += Math.min(MAX_TASK_MS, performance.now() - s.taskStart);
  const right = value === s.task.answer;
  if (right) g.log.correct({ rt: Math.min(rt, SPEED_LIMIT_MS), limit: SPEED_LIMIT_MS });
  else g.log.error('wrong');
  for (const b of s.board.querySelectorAll('[data-answer]')) {
    if (b.dataset.answer === s.task.answer) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === value) b.classList.add('answer-btn-wrong');
  }
  s.done += 1;
  g.timer = setTimeout(() => {
    s.locked = false;
    if (s.done >= TASKS) g.finish();
    else showTask(g);
  }, FEEDBACK_MS);
}

export default createGame({
  id: 'mirror',
  title: 'Огледални фигури',
  category: 'cognitive',
  unlockStep: 8,
  skills: ['logic'],
  description: 'Една фигура е същата, само завъртяна. Останалите са огледални. Без бързане.',
  allowHidden: true,
  reportsRT: false,

  setup(g, stage) {
    const board = h('div', { class: 'lg-board' });
    stage.append(board);
    g.state = { board, done: 0, activeMs: 0, locked: false, trial: null, task: null, taskStart: 0 };
  },

  begin: showTask,
  onAnswer: answer,
  activeMs: (g) => g.state.activeMs,

  rows: (g) => {
    const total = g.log.total;
    return [
      ['Верни', `${g.log.correctCount} от ${total}`],
      ['Точност', `${total ? Math.round(g.log.quality() * 100) : 0}%`],
    ];
  },

  demo() {
    const shape = [[0, 0], [1, 0], [1, 1], [1, 2]];
    const turned = [[0, 0], [0, 1], [1, 0], [2, 0]];
    return h('div', { class: 'demo-box demo-mirror', 'aria-hidden': 'true' },
      shapeSvg(shape, 3),
      h('span', { class: 'demo-mirror-arrow' }, '→'),
      shapeSvg(turned, 3, 'demo-mirror-right'),
      h('span', { class: 'demo-nb-label' }, 'Същата фигура, завъртяна. Огледалната не се брои.'));
  },
});
