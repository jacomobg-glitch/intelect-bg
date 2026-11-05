// Логически редици и матрици. Няма таймер: задачата иска мислене, а не бързина.
import { makeLogicTask } from '../content/logic/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
// Фигурите са общи за логиката и за игрите от Етап 6а: един източник, един вид.
import { cellSvg } from './shared/glyphs.js';

export const TASKS = 8;
export const MAX_TASK_MS = 90000; // замислен е добре, забравено устройство не е
export const SPEED_LIMIT_MS = 30000;
const FEEDBACK_MS = 800;

export { cellSvg };

function showTask(g) {
  const s = g.state;
  const task = makeLogicTask(g.log.level, Math.random);
  const trial = { task, onset: null };
  s.trial = trial;
  s.taskStart = performance.now();
  g.statusLabel.textContent = `Задача ${s.done + 1} от ${TASKS}`;

  const options = task.kind === 'sequence'
    ? task.options.map((o) => h('button', { class: 'answer-btn lg-option', type: 'button', 'data-answer': o }, h('span', {}, o)))
    : task.options.map((o, i) => h('button', {
      class: 'answer-btn lg-option', type: 'button', 'data-answer': String(i), 'aria-label': `${o.count}, ${o.shape}, ${o.fill}`,
    }, cellSvg(o)));

  const question = task.kind === 'sequence'
    ? h('div', {},
      h('p', { class: 'stroop-cue' }, 'Кое число продължава редицата?'),
      h('p', { class: 'lg-terms' }, `${task.terms.join(', ')}, ?`))
    : h('div', {},
      h('p', { class: 'stroop-cue' }, 'Коя фигура допълва матрицата?'),
      h('div', { class: 'lg-matrix' }, task.cells.map(cellSvg), h('span', { class: 'lg-cell lg-missing' }, '?')));

  s.board.replaceChildren(question, h('div', { class: 'answer-grid' }, options));
  g.markOnset(trial);
}

function answer(g, value, event) {
  const s = g.state;
  const trial = s.trial;
  if (s.locked) return;
  const rt = g.readReaction(trial, event);
  if (rt === null) return;
  s.locked = true;
  s.activeMs += Math.min(MAX_TASK_MS, performance.now() - s.taskStart);
  const right = value === trial.task.answer;
  if (right) g.log.correct({ rt: Math.min(rt, SPEED_LIMIT_MS), limit: SPEED_LIMIT_MS });
  else g.log.error('wrong');
  for (const b of s.board.querySelectorAll('[data-answer]')) {
    if (b.dataset.answer === trial.task.answer) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === value) b.classList.add('answer-btn-wrong');
  }
  s.done += 1;
  g.updateLevel();
  g.timer = setTimeout(() => {
    s.locked = false;
    if (s.done >= TASKS) g.finish();
    else showTask(g);
  }, FEEDBACK_MS);
}

export default createGame({
  id: 'logic',
  title: 'Логически редици и матрици',
  category: 'cognitive',
  unlockStep: 0,
  skills: ['logic'],
  description: 'Намери правилото и избери какво следва. Без бързане.',
  allowHidden: true,
  reportsRT: false,

  setup(g, stage) {
    const board = h('div', { class: 'lg-board' });
    stage.append(board);
    g.state = { board, done: 0, activeMs: 0, locked: false, trial: null };
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
    return h('div', { class: 'demo-box demo-logic', 'aria-hidden': 'true' },
      h('span', { class: 'lg-terms' }, '2, 4, 6, 8, '), h('span', { class: 'lg-terms demo-logic-answer' }, '10'));
  },
});
