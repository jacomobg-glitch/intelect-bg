// „Разменени неща“: запомняш подредбата, после две неща си сменят местата и ги намираш.
// Символите са форми, не цветове: играта работи и при цветна слепота.
import { makeSwapTask } from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { tokenSvg } from './shared/glyphs.js';

const RUN_MS = 90000;
const BLANK_MS = 500;      // кратка пауза, за да не се сравнява екран с екран
const FEEDBACK_MS = 700;
export const ANSWER_LIMIT_MS = 8000;

// Рисува мрежата. items е списък { pos, token }; празните клетки остават празни.
function paint(g, items, clickable) {
  const { cells } = g.state;
  for (const cell of cells) {
    cell.className = `gm-cell ${clickable ? 'gm-cell-live' : ''}`;
    cell.replaceChildren();
  }
  for (const { pos, token } of items) cells[pos].append(tokenSvg(token));
}

function startRound(g) {
  const s = g.state;
  const task = makeSwapTask(g.log.level, Math.random);
  s.task = task;
  s.trial = null;
  s.phase = 'study';
  s.until = performance.now() + task.studyMs;
  s.grid.style.setProperty('--size', String(task.size));
  s.cells = Array.from({ length: task.size * task.size }, (_, i) => h('div', { class: 'gm-cell', 'data-answer': String(i) }));
  s.grid.replaceChildren(...s.cells);
  paint(g, task.before, false);
  s.cue.textContent = 'Запомни подредбата';
  g.updateLevel();
}

function askAnswer(g) {
  const s = g.state;
  s.phase = 'answer';
  paint(g, s.task.after, true);
  s.cue.textContent = 'Кое се премести?';
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + ANSWER_LIMIT_MS;
}

function settle(g, correct, tappedPos) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  for (const pos of s.task.moved) s.cells[pos].classList.add('gm-cell-right');
  if (!correct && tappedPos !== null) s.cells[tappedPos].classList.add('gm-cell-wrong');
  s.cue.textContent = correct ? 'Вярно' : 'Разменените са тези';
  s.until = performance.now() + FEEDBACK_MS;
}

export default createGame({
  id: 'swapped',
  title: 'Разменени неща',
  category: 'cognitive',
  unlockStep: 4,
  skills: ['memory'],
  description: 'Запомни подредбата. Две неща си сменят местата: намери едно от тях.',
  keys: 'стрелките местят курсора, Enter избира',
  gridKeys: true,
  runMs: RUN_MS,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, '');
    const grid = h('div', { class: 'gm-grid' });
    stage.append(cue, grid);
    g.state = { cue, grid, cells: [], task: null, trial: null, phase: 'study', until: 0 };
  },

  begin: startRound,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'study') {
      s.phase = 'blank';
      paint(g, [], false);
      s.cue.textContent = '…';
      s.until = now + BLANK_MS;
    } else if (s.phase === 'blank') {
      askAnswer(g);
    } else if (s.phase === 'answer') {
      g.log.error('miss');
      settle(g, false, null);
    } else {
      startRound(g);
    }
  },

  onAnswer(g, value, event) {
    const s = g.state;
    if (s.phase !== 'answer') return;
    const rt = g.readReaction(s.trial, event);
    if (rt === null) return;
    const pos = Number(value);
    const correct = s.task.moved.includes(pos);
    if (correct) g.log.correct({ rt, limit: ANSWER_LIMIT_MS });
    else g.log.error('wrong');
    settle(g, correct, pos);
  },

  rows: (g) => g.log.rows({ correct: 'Намерени', wrong: 'Грешни места', misses: 'Без отговор' }),

  demo() {
    return h('div', { class: 'demo-box demo-swap', 'aria-hidden': 'true' },
      h('div', { class: 'gm-grid demo-swap-grid', vars: { '--size': '3' } },
        h('div', { class: 'gm-cell' }, tokenSvg('star')),
        h('div', { class: 'gm-cell' }),
        h('div', { class: 'gm-cell demo-swap-a' }, tokenSvg('circle')),
        h('div', { class: 'gm-cell' }),
        h('div', { class: 'gm-cell' }, tokenSvg('drop')),
        h('div', { class: 'gm-cell' }),
        h('div', { class: 'gm-cell demo-swap-b' }, tokenSvg('square')),
        h('div', { class: 'gm-cell' }),
        h('div', { class: 'gm-cell' })),
      h('span', { class: 'demo-nb-label' }, 'Двете светнали клетки са си разменили символите.'));
  },
});
