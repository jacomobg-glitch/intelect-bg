// „Различното“: всички фигури са еднакви освен една. Разликата е в завъртане, размер,
// запълване или място — никога в цвят, затова играта работи и при цветна слепота.
import { makeOddTask } from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { oddSvg } from './shared/glyphs.js';

const RUN_MS = 60000;
const FEEDBACK_MS = 550;
export const limitFor = (level) => Math.max(2600, 7000 - 450 * (level - 1));

function startRound(g) {
  const s = g.state;
  const task = makeOddTask(g.log.level, Math.random);
  s.task = task;
  s.phase = 'play';
  s.grid.style.setProperty('--size', String(task.size));
  s.cells = Array.from({ length: task.count }, (_, i) => h('div', {
    class: 'gm-cell gm-cell-live', 'data-answer': String(i),
  }, oddSvg(i === task.oddIndex ? task.odd : task.base)));
  s.grid.replaceChildren(...s.cells);
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.limit = limitFor(g.log.level);
  s.until = performance.now() + s.limit;
  g.updateLevel();
}

function settle(g, correct, tapped) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  s.cells[s.task.oddIndex].classList.add('gm-cell-right');
  if (!correct && tapped !== null) s.cells[tapped].classList.add('gm-cell-wrong');
  s.until = performance.now() + FEEDBACK_MS;
}

export default createGame({
  id: 'odd-one-out',
  title: 'Различното',
  category: 'cognitive',
  unlockStep: 2,
  skills: ['attention'],
  description: 'Една фигура не е като другите. Докосни я.',
  runMs: RUN_MS,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, 'Намери различната фигура');
    const grid = h('div', { class: 'gm-grid' });
    stage.append(cue, grid);
    g.state = { cue, grid, cells: [], task: null, trial: null, phase: 'play', until: 0, limit: 0 };
  },

  begin: startRound,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, false, null);
    } else {
      startRound(g);
    }
  },

  onAnswer(g, value, event) {
    const s = g.state;
    if (s.phase !== 'play') return;
    const rt = g.readReaction(s.trial, event);
    if (rt === null) return;
    const index = Number(value);
    const correct = index === s.task.oddIndex;
    if (correct) g.log.correct({ rt, limit: s.limit });
    else g.log.error('wrong');
    settle(g, correct, index);
  },

  rows: (g) => g.log.rows({ correct: 'Намерени', wrong: 'Грешни', misses: 'Изтекло време' }),

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'gm-grid demo-odd-grid', vars: { '--size': '3' } },
        Array.from({ length: 9 }, (_, i) => h('div', { class: `gm-cell ${i === 4 ? 'demo-odd-hit' : ''}` },
          oddSvg(i === 4
            ? { shape: 'square', rotation: 28, scale: 1, fill: 'solid', shift: 0 }
            : { shape: 'square', rotation: 0, scale: 1, fill: 'solid', shift: 0 })))),
      h('span', { class: 'demo-nb-label' }, 'Тази е завъртяна: докосни нея.'));
  },
});
