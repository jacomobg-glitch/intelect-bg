// Schulte таблица: числата се докосват по ред, а погледът търси широко из полето.
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;
const TAP_LIMIT_MS = 2500;

export const tableSize = (level) => Math.min(7, 2 + Math.max(1, level));

// Чиста функция: разбъркване с Фишър-Йейтс, всяко число точно веднъж.
export function makeTable(size, random) {
  const numbers = Array.from({ length: size * size }, (_, i) => i + 1);
  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// Staircase по цели таблици: бърза и чиста таблица вдига трудността, бавна или с много грешки я сваля.
export function nextSchulteLevel(level, { ms, errors, size }, ceiling) {
  const target = size * size * 1100;
  if (errors <= 1 && ms <= target) return Math.min(level + 1, ceiling);
  if (errors > 3 || ms > target * 2) return Math.max(1, level - 1);
  return level;
}

function buildTable(g) {
  const size = tableSize(g.log.level);
  g.state.size = size;
  g.state.next = 1;
  g.state.errors = 0;
  g.state.tableStart = performance.now();
  g.state.lastTap = g.state.tableStart;
  g.state.grid.style.setProperty('--size', String(size));
  g.state.grid.replaceChildren(...makeTable(size, Math.random).map((n) => h('button', {
    class: 'sch-cell', type: 'button', 'data-answer': String(n),
  }, String(n))));
  g.state.find.textContent = 'Търси: 1';
  g.updateLevel();
}

function tap(g, value, event) {
  const s = g.state;
  const n = Number(value);
  const rt = (event.timeStamp || performance.now()) - s.lastTap;
  if (rt < 100) {
    g.log.premature();
    return;
  }
  s.lastTap = event.timeStamp || performance.now();
  if (n !== s.next) {
    s.errors += 1;
    g.log.error('wrong');
    return;
  }
  g.log.correct({ rt, limit: TAP_LIMIT_MS });
  event.target.closest('button').classList.add('sch-done');
  s.next += 1;
  s.find.textContent = `Търси: ${s.next}`;
  if (s.next > s.size * s.size) {
    g.log.level = nextSchulteLevel(g.log.level, { ms: performance.now() - s.tableStart, errors: s.errors, size: s.size }, g.log.maxLevel);
    g.state.tables += 1;
    buildTable(g);
  }
}

export default createGame({
  id: 'schulte',
  title: 'Schulte таблица',
  category: 'cognitive',
  unlockStep: 6,
  skills: ['attention', 'speed'],
  description: 'Докосвай числата по ред, от 1 нагоре.',
  runMs: RUN_MS,
  adapt: false,
  levelText: (level) => `Трудност ${level} · ${tableSize(level)}×${tableSize(level)}`,

  setup(g, stage) {
    const find = h('p', { class: 'stroop-cue' }, 'Търси: 1');
    const grid = h('div', { class: 'sch-grid' });
    stage.append(find, grid);
    g.state = { find, grid, tables: 0 };
    buildTable(g);
  },

  begin(g) {
    g.state.tableStart = performance.now();
    g.state.lastTap = g.state.tableStart;
  },

  onAnswer: tap,
  rows: (g) => [['Цели таблици', `${g.state.tables}`], ...g.log.rows()],

  demo() {
    return h('div', { class: 'demo-box demo-schulte', 'aria-hidden': 'true' },
      h('div', { class: 'sch-grid', vars: { '--size': '3' } }, [4, 1, 7, 9, 2, 5, 3, 8, 6].map((n) => h('span', { class: `sch-cell demo-sch-${n}` }, String(n)))));
  },
});
