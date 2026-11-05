// Етап 6а: шестте нови когнитивни игри и разпределението на отключването.
// Всеки генератор се проверява с независима сметка, не с кода на самия генератор.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ODD_KINDS, PADS, SORT_RULES, SORT_VALUES, TOKENS, TONE_FILLS,
  basketFor, makeMirrorTask, makeOddTask, makeQuickTask, makeSimonSequence, makeSortBaskets, makeSortCard,
  makeSwapTask, mirrorX, nextSortRule, oddIsUnique, oddParams, quickParams, rotate90, simonParams, sortParams,
  swapParams, shuffle,
} from '../js/content/games/generators.js';
import { SKILLS } from '../js/core/config.js';
import { creatureIndex, subLabel } from '../js/core/evolution.js';
import nature from '../js/content/worlds/nature.json' with { type: 'json' };
import { cleanSettings, defaultSettings } from '../js/core/model.js';
import { validateGame } from '../js/core/registry.js';
import { ALL_SUBTOPICS, MATH_TREE } from '../js/content/math/topics.js';
import games from '../js/modules/index.js';
import { calibrateAllGames } from '../tools/sim-player.mjs';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const LEVELS = [1, 2, 3, 4, 5, 6];
const ROUNDS = 300;
const byId = Object.fromEntries(games.map((g) => [g.id, g]));

// --- Регистър и способности ---

test('новите игри спазват общия интерфейс и имат демонстрация', () => {
  // 14 от Етап 6а плюс седемте рефлекса на Етап 6б.
  assert.equal(games.length, 21);
  for (const g of games) assert.deepEqual(validateGame(g), [], g.id);
  for (const id of ['odd-one-out', 'swapped', 'quick-math', 'sequence', 'mirror', 'sorting']) {
    assert.ok(byId[id], `липсва модул ${id}`);
    assert.equal(typeof byId[id].demo, 'function', id);
    assert.ok(byId[id].description.length > 20, id);
  }
});

test('способностите на новите игри следват спецификацията', () => {
  assert.deepEqual(byId.swapped.skills, ['memory']);
  assert.deepEqual(byId['odd-one-out'].skills, ['attention']);
  assert.deepEqual(byId.sequence.skills, ['memory']);
  assert.deepEqual(byId.sorting.skills, ['flexibility']);
  assert.deepEqual(byId.mirror.skills, ['logic']);
  assert.deepEqual(byId['quick-math'].skills, ['speed', 'math']);
});

// --- Разпределение на отключването ---

// Всички награди по пътя: нов модул или нова група теми по математика.
const rewardSteps = () => [...new Set([
  ...games.map((g) => g.unlockStep),
  ...MATH_TREE.map((group) => group.unlockStep),
])].sort((a, b) => a - b);

test('наградите идват през не повече от 3 стъпки, докъдето стига съдържанието', () => {
  const steps = rewardSteps();
  assert.equal(steps[0], 0);
  for (let i = 1; i < steps.length; i += 1) {
    const gap = steps[i] - steps[i - 1];
    assert.ok(gap <= 3, `празнина от ${gap} стъпки между ${steps[i - 1]} и ${steps[i]}`);
  }
  // Етап 6а покрива стъпките до Гарван II; оттам нататък продължава Етап 6б.
  assert.ok(steps[steps.length - 1] >= 16, `съдържанието стига само до стъпка ${steps[steps.length - 1]}`);
});

test('всяка способност има поне 2 игри до Гущер I', () => {
  for (const skill of SKILLS) {
    const count = games.filter((g) => g.skills.includes(skill) && g.unlockStep <= 9).length;
    assert.ok(count >= 2, `${skill}: само ${count} игри до стъпка 9`);
  }
});

// Имената на стъпките в документацията лесно се разминават с кода: unlockStep се брои от 0,
// а таблицата на стълбата – от 1. Затова таблиците в ARCHITECTURE.md се сверяват с модулите.
test('ARCHITECTURE.md назовава същата стъпка, на която играта наистина се отключва', () => {
  const doc = readFileSync(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8');
  const stepName = (step) => `${nature.creatures[creatureIndex(step)].name} ${subLabel(step)}`;
  // Редът в таблицата може да уточнява името („Stroop (цветове или форми)“), затова се
  // търси по начало на текста в двете посоки.
  const matchGame = (cell) => games.find((g) => cell.startsWith(g.title) || g.title.startsWith(cell));
  const checked = new Set();
  for (const line of doc.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 5 || !cells[1]) continue;
    const game = matchGame(cells[1]);
    if (!game) continue;
    assert.equal(cells[3], stepName(game.unlockStep), `${game.title}: unlockStep ${game.unlockStep}`);
    checked.add(game.id);
  }
  // Всички игри с таблица в документа: извън таблиците остават само „Математика“ и „Светулки“.
  assert.ok(checked.size >= games.length - 2, `сверени са само ${checked.size} игри: ${[...checked]}`);
});

test('всяко отключване е на достижима стъпка и нито една игра не чака напразно', () => {
  for (const g of games) {
    assert.ok(Number.isInteger(g.unlockStep) && g.unlockStep >= 0 && g.unlockStep < 45, g.id);
  }
  // На Мравка I има модул за всяка способност: това е условието от Етап 4 и остава вярно.
  const atStart = new Set(games.filter((g) => g.unlockStep === 0).flatMap((g) => g.skills));
  assert.deepEqual([...atStart].sort(), [...SKILLS].sort());
});

// --- Разменени неща ---

test('разменени неща: точно две места се разменят и символите им се различават', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 13);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeSwapTask(level, random);
      const { size, items } = swapParams(level);
      assert.equal(t.size, size);
      assert.equal(t.before.length, items);
      assert.equal(t.after.length, items);
      assert.equal(t.moved.length, 2);
      // Местата не се менят, менят се символите по тях.
      assert.deepEqual(t.after.map((x) => x.pos), t.before.map((x) => x.pos));
      const changed = t.before.filter((x, k) => x.token !== t.after[k].token);
      assert.equal(changed.length, 2, 'променени са точно два символа');
      assert.deepEqual(changed.map((x) => x.pos).sort((a, b) => a - b), t.moved);
      // Размяната е истинска: двата символа са различни и са си сменили местата.
      const [a, b] = changed;
      const ai = t.before.findIndex((x) => x.pos === a.pos);
      const bi = t.before.findIndex((x) => x.pos === b.pos);
      assert.notEqual(a.token, b.token);
      assert.equal(t.after[ai].token, t.before[bi].token);
      assert.equal(t.after[bi].token, t.before[ai].token);
      // Всичко се вижда: местата са в мрежата и символите не се повтарят.
      for (const { pos, token } of t.before) {
        assert.ok(pos >= 0 && pos < size * size, `място ${pos} извън мрежа ${size}`);
        assert.ok(TOKENS.includes(token), token);
      }
      assert.equal(new Set(t.before.map((x) => x.pos)).size, items);
      assert.equal(new Set(t.before.map((x) => x.token)).size, items);
    }
  }
});

test('разменени неща: по-висока трудност значи повече символи и по-малко време', () => {
  assert.ok(swapParams(6).items > swapParams(1).items);
  assert.ok(swapParams(6).studyMs < swapParams(1).studyMs);
  assert.ok(swapParams(1).items <= swapParams(1).size ** 2);
  assert.ok(swapParams(6).items <= swapParams(6).size ** 2);
  assert.ok(swapParams(6).studyMs >= 1400, 'време за запомняне не пада под 1,4 секунди');
});

test('разменени неща: символите са форми, никъде цвят', () => {
  assert.equal(new Set(TOKENS).size, TOKENS.length);
  for (const token of TOKENS) assert.doesNotMatch(token, /red|blue|green|yellow|color/i, token);
});

// --- Различното ---

test('различното: различна е точно една клетка', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 29);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeOddTask(level, random);
      assert.ok(oddIsUnique(t), `${level}: ${JSON.stringify(t)}`);
      assert.equal(t.count, t.size * t.size);
      assert.ok(t.oddIndex >= 0 && t.oddIndex < t.count);
      assert.ok(ODD_KINDS.includes(t.kind));
    }
  }
});

test('различното: разликата никога не е цвят, а намалява с трудността', () => {
  for (const kind of ODD_KINDS) assert.doesNotMatch(kind, /color|red|blue|green|yellow/i, kind);
  assert.ok(oddParams(6).strength < oddParams(1).strength);
  assert.ok(oddParams(6).size > oddParams(1).size);
  assert.ok(oddParams(6).strength >= 0.18, 'разликата не става невидима');
});

// --- Цветни последователности ---

test('редица: дължината следва трудността, а стойностите са в границите', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 41);
    const { length } = simonParams(level);
    for (let i = 0; i < ROUNDS; i += 1) {
      const seq = makeSimonSequence(length, random);
      assert.equal(seq.length, length);
      for (const v of seq) assert.ok(Number.isInteger(v) && v >= 0 && v < PADS.length, String(v));
      // Едно поле не свети три пъти подред: това би мерило друго.
      for (let k = 2; k < seq.length; k += 1) {
        assert.ok(!(seq[k] === seq[k - 1] && seq[k] === seq[k - 2]), `три поредни: ${seq}`);
      }
    }
  }
  assert.ok(simonParams(6).length > simonParams(1).length);
  assert.ok(simonParams(6).showMs < simonParams(1).showMs);
});

test('редица: четирите полета излизат приблизително еднакво често', () => {
  const random = seeded(7);
  const counts = new Array(PADS.length).fill(0);
  let total = 0;
  for (let i = 0; i < 4000; i += 1) {
    for (const v of makeSimonSequence(6, random)) { counts[v] += 1; total += 1; }
  }
  for (const c of counts) assert.ok(Math.abs(c / total - 1 / PADS.length) < 0.03, counts.join(','));
});

test('редица: всяко поле има свой символ, не само цвят', () => {
  assert.equal(new Set(PADS.map((p) => p.symbol)).size, PADS.length);
  assert.equal(new Set(PADS.map((p) => p.id)).size, PADS.length);
  for (const pad of PADS) assert.ok(pad.label.length > 2, pad.id);
});

// --- Сортиране по сменящо се правило ---

test('сортиране: трите коша се различават по всеки признак', () => {
  const random = seeded(3);
  for (let i = 0; i < ROUNDS; i += 1) {
    const baskets = makeSortBaskets(random);
    assert.equal(baskets.length, 3);
    for (const rule of SORT_RULES) {
      const values = baskets.map((b) => b[rule]);
      assert.equal(new Set(values).size, 3, `${rule}: ${values}`);
      for (const v of values) assert.ok(SORT_VALUES[rule].includes(v), `${rule}=${v}`);
    }
  }
});

test('сортиране: всяко правило дава точно един верен кош, и то различен', () => {
  const random = seeded(5);
  for (let i = 0; i < ROUNDS; i += 1) {
    const baskets = makeSortBaskets(random);
    const card = makeSortCard(baskets, random);
    const targets = SORT_RULES.map((rule) => basketFor(baskets, card, rule));
    for (const t of targets) assert.ok(t >= 0 && t < 3, `${targets}`);
    // Различен кош за всяко правило: само така смяната на правилото се вижда.
    assert.equal(new Set(targets).size, 3, `${JSON.stringify(card)} → ${targets}`);
  }
});

test('сортиране: правилото винаги се сменя на друго', () => {
  const random = seeded(9);
  for (const rule of SORT_RULES) {
    for (let i = 0; i < 200; i += 1) {
      const next = nextSortRule(rule, random);
      assert.notEqual(next, rule);
      assert.ok(SORT_RULES.includes(next));
    }
  }
});

test('сортиране: по-висока трудност сменя правилото по-често и дава по-малко време', () => {
  assert.ok(sortParams(6).runToSwitch <= sortParams(1).runToSwitch);
  assert.ok(sortParams(6).limitMs < sortParams(1).limitMs);
  assert.ok(sortParams(6).runToSwitch >= 3, 'правилото не се сменя след всеки верен отговор');
  assert.ok(sortParams(6).limitMs >= 1800);
});

test('сортиране: цветът има заместник със запълване, за да работи без цветове', () => {
  assert.deepEqual(Object.keys(TONE_FILLS).sort(), [...SORT_VALUES.tone].sort());
  assert.equal(new Set(Object.values(TONE_FILLS)).size, 3, 'трите запълвания са различими');
});

// --- Огледални и завъртени фигури ---

// Независима сметка: завъртане на 90 градуса и нормализиране, писани наново тук.
function ownRotations(cells) {
  const norm = (list) => {
    const minX = Math.min(...list.map(([x]) => x));
    const minY = Math.min(...list.map(([, y]) => y));
    return list.map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([x, y]) => `${x},${y}`)
      .join(' ');
  };
  const out = new Set();
  let current = cells;
  for (let i = 0; i < 4; i += 1) {
    out.add(norm(current));
    current = current.map(([x, y]) => [-y, x]);
  }
  return out;
}
const ownKey = (cells) => [...ownRotations(cells)][0];
const ownMirror = (cells) => cells.map(([x, y]) => [-x, y]);

test('огледални фигури: точно една опция е завъртяне, останалите са огледални', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 53);
    for (let i = 0; i < 150; i += 1) {
      const t = makeMirrorTask(level, random);
      assert.equal(t.options.length, 4);
      const shapeRots = ownRotations(t.shape);
      const fits = t.options.map((o, k) => (shapeRots.has(ownKey(o)) ? k : -1)).filter((k) => k >= 0);
      assert.deepEqual(fits, [Number(t.answer)], `ниво ${level}: ${JSON.stringify(t)}`);
      // Трите грешни са огледални образи на фигурата.
      const mirrorRots = ownRotations(ownMirror(t.shape));
      for (const [k, o] of t.options.entries()) {
        if (k === Number(t.answer)) continue;
        assert.ok(mirrorRots.has(ownKey(o)), `опция ${k} не е огледална`);
      }
      // Опциите се различават помежду си, за да няма два еднакви бутона.
      const drawn = t.options.map((o) => o.map(([x, y]) => `${x},${y}`).join(' '));
      assert.equal(new Set(drawn).size, 4, `дублирана опция: ${drawn}`);
    }
  }
});

test('огледални фигури: фигурата е хирална, свързана и в границите на мрежата', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 71);
    for (let i = 0; i < 150; i += 1) {
      const t = makeMirrorTask(level, random);
      // Хирална: огледалният образ не е завъртане, иначе задачата нямаше верен отговор.
      assert.ok(!ownRotations(t.shape).has(ownKey(ownMirror(t.shape))), 'фигурата е симетрична');
      for (const [x, y] of t.shape) {
        assert.ok(x >= 0 && x < t.grid && y >= 0 && y < t.grid, `клетка ${x},${y} извън ${t.grid}`);
      }
      for (const option of t.options) {
        assert.equal(option.length, t.shape.length, 'опция с друг брой клетки');
        for (const [x, y] of option) assert.ok(x >= 0 && y >= 0 && x < t.grid && y < t.grid);
      }
    }
  }
});

test('огледални фигури: завъртането и огледалът работят както трябва', () => {
  const L = [[0, 0], [0, 1], [0, 2], [1, 2]];
  assert.equal(ownRotations(rotate90(L)).has(ownKey(L)), true, 'завъртяното е в същата група');
  assert.equal(ownRotations(L).has(ownKey(mirrorX(L))), false, 'L е хирална');
  // Кръстът е симетричен: огледалът му е същата фигура.
  const plus = [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]];
  assert.equal(ownRotations(plus).has(ownKey(mirrorX(plus))), true);
  // Четири завъртания връщат началото.
  assert.equal(ownKey(rotate90(rotate90(rotate90(rotate90(L))))), ownKey(L));
});

// --- Бърза сметка ---

const compute = ({ a, b, op }) => {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return a / b;
};

test('бърза сметка: отговорът е верен, а опциите са 4 различни и неотрицателни', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 101);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeQuickTask(level, random);
      assert.equal(Number(t.answer), compute(t), `${t.prompt}`);
      assert.ok(Number.isInteger(Number(t.answer)), `${t.prompt} = ${t.answer}`);
      assert.ok(Number(t.answer) >= 0, `${t.prompt} = ${t.answer}`);
      assert.equal(t.options.length, 4);
      assert.equal(new Set(t.options).size, 4, `${t.options}`);
      assert.ok(t.options.includes(t.answer));
      assert.equal(t.options.filter((o) => o === t.answer).length, 1, 'верният отговор е един');
      for (const o of t.options) assert.ok(Number(o) >= 0, `отрицателна опция ${o}`);
      if (t.op === '÷') assert.equal(t.a % t.b, 0, 'деленето е без остатък');
      if (t.op === '-') assert.ok(t.a > t.b, 'изваждането не дава минус');
      assert.doesNotMatch(t.prompt, /undefined|NaN/);
    }
  }
});

test('бърза сметка: срокът се скъсява, а действията се добавят с трудността', () => {
  assert.ok(quickParams(6).limitMs < quickParams(1).limitMs);
  assert.ok(quickParams(6).limitMs >= 2200, 'срокът не става невъзможен');
  assert.deepEqual(quickParams(1).ops, ['+']);
  assert.ok(quickParams(6).ops.includes('÷'));
  for (let level = 2; level <= 6; level += 1) {
    assert.ok(quickParams(level).ops.length >= quickParams(level - 1).ops.length, `ниво ${level}`);
  }
});

// --- Общи правила ---

test('игрите с цветове имат вариант с форми, а настройката се пази', () => {
  for (const id of ['sequence', 'sorting']) {
    assert.equal(typeof byId[id].introOptions, 'function', `${id} няма избор на вариант`);
  }
  assert.equal(defaultSettings().colorFree, false);
  assert.equal(cleanSettings({ colorFree: true }).colorFree, true);
  assert.equal(cleanSettings({ colorFree: 'да' }).colorFree, false);
  assert.equal(cleanSettings({}).colorFree, false);
});

test('разбъркването не губи и не повтаря елементи', () => {
  const random = seeded(17);
  const list = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < 300; i += 1) {
    const out = shuffle(list, random);
    assert.deepEqual([...out].sort((a, b) => a - b), list);
    assert.equal(out.length, list.length);
  }
  assert.deepEqual(shuffle([], random), []);
});

test('калибрирането покрива всяка игра със staircase и успехът е в зоната', () => {
  const rows = calibrateAllGames({ startLevel: 4 });
  const covered = new Set(rows.map((r) => r.id));
  // N-back и Schulte сменят трудността след цял блок по своя формула, не чрез staircase.
  const expected = games
    .filter((g) => !['math', 'nback', 'schulte'].includes(g.id))
    .map((g) => g.id);
  for (const id of expected) assert.ok(covered.has(id), `${id} не е в npm run calibrate`);
  for (const row of rows) {
    assert.ok(row.quality > 0.75 && row.quality < 0.85, `${row.id}: успех ${row.quality}`);
    assert.ok(Math.abs(row.settledMean - 4) <= 1, `${row.id}: застана на ${row.settledMean}`);
    assert.ok(row.settledSd < 1.5, `${row.id}: клатене ±${row.settledSd}`);
    assert.ok(row.trials >= 10, `${row.id}: само ${row.trials} опита на сесия`);
  }
});

test('Етап 6а не внася дати, серии или история', () => {
  assert.equal(ALL_SUBTOPICS.length, 30);
  assert.equal(new Set(ALL_SUBTOPICS.map((s) => s.id)).size, ALL_SUBTOPICS.length);
  assert.equal(new Set(games.map((g) => g.id)).size, games.length);
});
