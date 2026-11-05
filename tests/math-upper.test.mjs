// Допълненията по математика: неравенства, функции и графики, Питагорова теорема,
// много опити и групата „Логика и загадки“. Тук стоят инвариантите, които са
// специфични за тези теми — най-вече че всяка генерирана загадка има ТОЧНО едно решение.
// Общите проверки на генераторите са в tests/math.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MAX_LEVEL, makeTask, parseNumeric } from '../js/content/math/generators.js';
import { parseInterval, sameAnswer } from '../js/content/math/task.js';
import { ALL_SUBTOPICS, MATH_TREE } from '../js/content/math/topics.js';
import games from '../js/modules/index.js';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const ADDED = ['inequalities', 'coordinates', 'linear', 'parabola', 'rates',
  'pythagoras', 'simulation', 'truth-tables', 'knights', 'coins', 'grid-puzzles'];

function forEachTask(id, visit, rounds = 150) {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const random = seeded(id.length * 131 + level * 17);
    for (let i = 0; i < rounds; i += 1) visit(makeTask(id, level, random), level);
  }
}

// --- Дървото ---

test('дървото е пълно: дванайсет групи, 41 подтеми, всяка със своя рисунка', () => {
  assert.equal(MATH_TREE.length, 12);
  assert.equal(ALL_SUBTOPICS.length, 41);
  assert.equal(new Set(ALL_SUBTOPICS.map((s) => s.id)).size, ALL_SUBTOPICS.length);
  // Нито една визуализация не се ползва от две подтеми: всяка тема има своя картинка.
  const vizNames = ALL_SUBTOPICS.map((s) => s.viz);
  assert.equal(new Set(vizNames).size, vizNames.length, 'две подтеми делят една рисунка');
  for (const id of ADDED) assert.ok(ALL_SUBTOPICS.some((s) => s.id === id), `${id} липсва в дървото`);
});

test('стълбата носи награда до Шахматист II, без празнина над 3 стъпки', () => {
  const steps = [...new Set([
    ...games.map((g) => g.unlockStep),
    ...MATH_TREE.map((group) => group.unlockStep),
  ])].sort((a, b) => a - b);
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i] - steps[i - 1] <= 3, `празнина между ${steps[i - 1]} и ${steps[i]}`);
  }
  assert.deepEqual(MATH_TREE.map((g) => g.unlockStep), [0, 0, 3, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
  // Функциите идват след уравненията, а логиката е най-горе.
  const at = (id) => MATH_TREE.find((g) => g.id === id).unlockStep;
  assert.ok(at('functions') > at('equations'));
  assert.equal(Math.max(...MATH_TREE.map((g) => g.unlockStep)), at('logic-puzzles'));
  assert.ok(at('logic-puzzles') < 45);
});

test('всяка група носи поне две интерактивни рисунки', () => {
  const src = readFileSync(new URL('../js/views/math-viz.js', import.meta.url), 'utf8');
  for (const group of MATH_TREE) {
    const own = new Set(group.subtopics.map((s) => s.viz));
    assert.ok(own.size >= 2, `${group.id}: само ${own.size} рисунки`);
    for (const name of own) assert.ok(src.includes(`'${name}'`) || src.includes(`${name},`), `липсва ${name}`);
  }
});

// --- Записи на отговорите ---

test('отговорите приемат корен и интервал в няколко записа', () => {
  // Корен: стойността решава, не записът.
  assert.ok(sameAnswer('√8', '2√2'));
  assert.ok(sameAnswer('sqrt(16)', '4'));
  assert.ok(sameAnswer('√13', '√13'));
  assert.equal(sameAnswer('√13', '√14'), false);
  assert.equal(sameAnswer('3,6', '√13'), false, 'приблизителното не е точното');
  // Интервал: неравенство и скоби са един и същ отговор.
  assert.ok(sameAnswer('x > 3', '(3; ∞)'));
  assert.ok(sameAnswer('3 < x', '(3; ∞)'));
  assert.ok(sameAnswer('x ≥ -2', '[-2; ∞)'));
  assert.ok(sameAnswer('x <= 5', '(-∞; 5]'));
  assert.ok(sameAnswer('2 < x ≤ 7', '(2; 7]'));
  // Отвореното и затвореното НЕ са едно и също.
  assert.equal(sameAnswer('x ≥ 3', '(3; ∞)'), false);
  assert.equal(sameAnswer('2 ≤ x ≤ 7', '(2; 7]'), false);
  assert.equal(sameAnswer('x > 3', 'x > 4'), false);
  // Старите записи остават недокоснати.
  assert.ok(sameAnswer('0,5', '1/2'));
  assert.ok(sameAnswer(' да ', 'Да'));
  assert.equal(parseInterval('Да'), null);
  assert.equal(parseInterval('12'), null);
});

// --- Неравенства ---

test('неравенства: решението е вярно за проба отвътре и невярно за проба отвън', () => {
  const test1 = (op, value, x) => (op === 'gt' ? x > value : op === 'ge' ? x >= value
    : op === 'lt' ? x < value : x <= value);
  forEachTask('inequalities', (t) => {
    const span = parseInterval(t.answer);
    assert.ok(span, `${t.prompt} → ${t.answer}`);
    // Лявата страна на неравенството, пресметната за дадено x.
    const left = {
      'ineq-add': (c, x) => x + c.a,
      'ineq-sub': (c, x) => x - c.a,
      'ineq-mul': (c, x) => c.k * x,
      'ineq-neg-free': (c, x) => c.k * x + c.m,
      'ineq-neg': (c, x) => -c.k * x,
    }[t.check.type];
    if (!left) {
      // Двустранното неравенство: проверява се направо срещу двата края.
      const { lo, hi, m } = t.check;
      assert.ok(lo < hi);
      assert.equal(span.lo, lo - m);
      assert.equal(span.hi, hi - m);
      assert.equal(span.loIn, false);
      assert.equal(span.hiIn, true);
      return;
    }
    const compare = t.check.type === 'ineq-neg' ? -t.check.r : t.check.r;
    const bound = Number.isFinite(span.lo) ? span.lo : span.hi;
    const inside = Number.isFinite(span.lo) ? bound + 1 : bound - 1;
    const outside = Number.isFinite(span.lo) ? bound - 1 : bound + 1;
    assert.ok(test1(t.check.op, compare, left(t.check, inside)), `${t.prompt}: ${inside} трябва да е решение`);
    assert.equal(test1(t.check.op, compare, left(t.check, outside)), false, `${t.prompt}: ${outside} не бива да е решение`);
  });
});

test('неравенства: при деление с отрицателно число знакът се обръща', () => {
  const random = seeded(11);
  const turned = { gt: '<', ge: '≤', lt: '>', le: '≥' };
  for (let i = 0; i < 100; i += 1) {
    const t = makeTask('inequalities', 5, random);
    assert.equal(t.check.type, 'ineq-neg');
    assert.match(t.prompt, /-\d+x/);
    assert.ok(t.answer.includes(turned[t.check.op]), `${t.prompt} → ${t.answer}`);
  }
});

// --- Функции ---

test('линейна функция: двете дадени точки наистина лежат на правата', () => {
  forEachTask('linear', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'lin-slope') {
      assert.equal((c.y2 - c.y1) / (c.x2 - c.x1), value);
      assert.notEqual(c.x1, c.x2, 'вертикална права няма наклон');
    }
    if (c.type === 'lin-zero') assert.equal(c.k * value + c.b, 0, t.prompt);
    if (c.type === 'lin-solve') assert.equal(c.k * value + c.b, c.y, t.prompt);
    if (c.type === 'lin-cross') {
      assert.equal(c.k1 * value + c.b1, c.k2 * value + c.b2, t.prompt);
      assert.notEqual(c.k1, c.k2, 'успоредни прави не се пресичат');
    }
    assert.ok(Number.isInteger(value), `${t.prompt} → ${t.answer}`);
  });
});

test('парабола: симетрията важи, а върхът е най-ниската или най-високата точка', () => {
  forEachTask('parabola', (t) => {
    const c = t.check;
    if (c.type === 'par-value') {
      // Квадратът не различава знака: двете страни дават едно и също.
      assert.equal(c.x * c.x, (-c.x) * (-c.x));
      assert.ok(parseNumeric(t.answer) > 0);
    }
    if (c.type === 'par-full') {
      const at = (x) => c.a * (x - c.h) ** 2 + c.k;
      // Върхът е крайна стойност в двете посоки.
      assert.ok(c.a > 0 ? at(c.h) <= at(c.h + 3) : at(c.h) >= at(c.h + 3), t.prompt);
      assert.equal(at(c.h - 2), at(c.h + 2), 'липсва симетрия спрямо върха');
    }
  });
});

test('координати: квадрантът и огледалото са по определение', () => {
  const seen = new Set();
  forEachTask('coordinates', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'coord-quadrant') {
      seen.add(value);
      assert.ok([1, 2, 3, 4].includes(value));
      assert.notEqual(c.x, 0);
      assert.notEqual(c.y, 0);
    }
    if (c.type === 'coord-dist') assert.ok(value > 0, t.prompt);
    if (c.type === 'coord-mid') assert.equal(2 * value, c.x1 + c.x2);
    assert.ok(Number.isInteger(value), `${t.prompt} → ${t.answer}`);
  });
  assert.equal(seen.size, 4, `срещнати квадранти: ${[...seen]}`);
});

test('такса и цена: сметката се връзва и в двете посоки', () => {
  forEachTask('rates', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'rate-units') assert.equal(c.base + c.per * value, c.total, t.prompt);
    if (c.type === 'rate-base') assert.equal(value + c.per * c.units, c.total, t.prompt);
    if (c.type === 'rate-even') {
      // В точката на изравняване двете тарифи дават една и съща сметка.
      assert.equal(c.baseA + c.perA * value, c.baseB + c.perB * value, t.prompt);
      assert.ok(c.perA > c.perB && c.baseB > c.baseA, t.prompt);
    }
    if (c.type === 'rate-plan') assert.ok(c.used >= c.included, t.prompt);
    assert.ok(value > 0, `${t.prompt} → ${t.answer}`);
  });
});

// --- Питагор ---

test('Питагор: отговорът на квадрат дава сбора от квадратите на другите две страни', () => {
  let roots = 0;
  forEachTask('pythagoras', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'pyth-hyp') {
      assert.ok(Math.abs(value * value - (c.a * c.a + c.c * c.c)) < 1e-9, t.prompt);
      assert.ok(value > c.a && value > c.c, 'хипотенузата е най-дългата страна');
    } else {
      assert.ok(Math.abs(value * value + c.a * c.a - c.hyp * c.hyp) < 1e-9, t.prompt);
      assert.ok(value > 0 && value < c.hyp, t.prompt);
    }
    if (t.answer.includes('√')) roots += 1;
  });
  // Нивата с корен наистина дават корен, иначе записът „√“ не се упражнява.
  assert.ok(roots > 0, 'нито един отговор не излезе с корен');
});

test('Питагор: цялото ниво с тройки дава цели числа', () => {
  for (const level of [1, 2, 3, 5]) {
    const random = seeded(level * 29);
    for (let i = 0; i < 100; i += 1) {
      const t = makeTask('pythagoras', level, random);
      assert.ok(Number.isInteger(parseNumeric(t.answer)), `ниво ${level}: ${t.prompt} → ${t.answer}`);
      assert.doesNotMatch(t.answer, /√/, `ниво ${level} не бива да дава корен`);
    }
  }
});

// --- Много опити ---

test('много опити: очакваният брой не надминава броя опити', () => {
  forEachTask('simulation', (t) => {
    const c = t.check;
    if (t.kind !== 'number') return;
    const value = parseNumeric(t.answer);
    assert.ok(Number.isInteger(value), `${t.prompt} → ${t.answer}`);
    if (c.type === 'sim-expect') {
      assert.equal(value, (c.trials * c.good) / c.total);
      assert.ok(value <= c.trials);
    }
    if (c.type === 'sim-share') assert.ok(value >= 0 && value <= 100, t.prompt);
    if (c.type === 'sim-gap') assert.ok(value >= 0 && value <= 50, t.prompt);
    if (c.type === 'sim-dice-expect') assert.ok(value > 0 && value < c.trials, t.prompt);
  });
});

test('много опити: двата опита за сравнение никога не са еднакво близо', () => {
  const random = seeded(77);
  for (let i = 0; i < 150; i += 1) {
    const t = makeTask('simulation', 5, random);
    const { first, second } = t.check;
    const gapA = Math.abs((100 * first.hits) / first.trials - 50);
    const gapB = Math.abs((100 * second.hits) / second.trials - 50);
    assert.notEqual(gapA, gapB, `${t.prompt}: двата отговора стават верни`);
  }
});

// --- Логика и загадки ---

// Решател, написан наново: пълно изчерпване по осемте възможни разпределения.
const says = (stmt, assign) => {
  if (stmt.k === 'knight') return assign[stmt.who];
  if (stmt.k === 'liar') return !assign[stmt.who];
  if (stmt.k === 'same') return assign[stmt.a] === assign[stmt.b];
  if (stmt.k === 'diff') return assign[stmt.a] !== assign[stmt.b];
  if (stmt.k === 'allLiars') return !assign.some(Boolean);
  if (stmt.k === 'someLiar') return !assign.every(Boolean);
  return assign.filter(Boolean).length === stmt.n;
};

function allConsistent(count, told) {
  const out = [];
  for (let mask = 0; mask < 2 ** count; mask += 1) {
    const assign = Array.from({ length: count }, (_, i) => ((mask >> i) & 1) === 1);
    if (told.every(({ who, stmt }) => assign[who] === says(stmt, assign))) out.push(assign);
  }
  return out;
}

test('рицари и лъжци: всяка загадка има точно едно непротиворечиво разпределение', () => {
  const shapes = new Set();
  forEachTask('knights', (t, level) => {
    const c = t.check;
    const solutions = allConsistent(c.count, c.says);
    assert.equal(solutions.length, 1, `${t.prompt}: ${solutions.length} решения`);
    assert.equal(c.count, level <= 3 ? 2 : 3);
    // Никой не говори за собствения си вид: „аз съм лъжец“ е парадокс, не загадка.
    for (const { who, stmt } of c.says) {
      if (stmt.k === 'knight' || stmt.k === 'liar') assert.notEqual(stmt.who, who, t.prompt);
    }
    shapes.add(c.says.map(({ stmt }) => stmt.k).join('+'));
  }, 60);
  assert.ok(shapes.size > 6, `само ${shapes.size} различни форми на загадката`);
});

test('рицари и лъжци: и двата отговора се срещат на всяко ниво', () => {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const random = seeded(level * 53 + 3);
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) seen.add(makeTask('knights', level, random).answer);
    assert.ok(seen.size >= 2, `ниво ${level}: само отговор „${[...seen]}“`);
  }
});

test('истинностни таблици: броят верни редове съвпада с изброяването', () => {
  const rows = [[true, true], [true, false], [false, true], [false, false]];
  const ops = {
    and: (p, q) => p && q, or: (p, q) => p || q, implies: (p, q) => !p || q, xor: (p, q) => p !== q,
  };
  forEachTask('truth-tables', (t) => {
    if (t.check.type !== 'log-rows') return;
    const op = ops[t.check.op];
    assert.ok(op, `непозната операция ${t.check.op}`);
    assert.equal(parseNumeric(t.answer), rows.filter(([p, q]) => op(p, q)).length, t.prompt);
  });
});

test('истинностни таблици: „ако… то“ е невярно само при вярно начало и невярен край', () => {
  const random = seeded(19);
  let falseCases = 0;
  for (let i = 0; i < 300; i += 1) {
    const t = makeTask('truth-tables', 4, random);
    const { p, q } = t.check;
    const want = p && !q ? 'Не' : 'Да';
    assert.equal(t.answer, want, t.prompt);
    if (want === 'Не') falseCases += 1;
  }
  assert.ok(falseCases > 20, 'невярният случай почти не се среща');
});

test('монети: отговорът идва от трите изхода на везната, не от два', () => {
  forEachTask('coins', (t) => {
    const c = t.check;
    if (t.kind !== 'number') return;
    const value = parseNumeric(t.answer);
    if (c.type === 'coins-max') assert.equal(value, 3 ** c.k);
    if (c.type === 'coins-min') {
      assert.ok(3 ** value >= c.n, `${t.prompt}: ${value} претегляния не стигат`);
      assert.ok(3 ** (value - 1) < c.n, `${t.prompt}: стигат и по-малко`);
    }
    if (c.type === 'coins-left') assert.equal(value, c.n - 2 * c.each);
    assert.ok(value > 0, t.prompt);
  });
});

test('логически мрежи: следите оставят точно едно подреждане и нито една не е излишна', () => {
  const orders = (n) => {
    if (n === 0) return [[]];
    const out = [];
    for (const rest of orders(n - 1)) {
      for (let at = 0; at <= rest.length; at += 1) out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
    }
    return out;
  };
  const fits = (clue, order) => {
    if (clue.kind === 'is') return order[clue.person] === clue.item;
    if (clue.kind === 'not') return order[clue.person] !== clue.item;
    return clue.items.includes(order[clue.person]);
  };
  const solve = (n, clues) => orders(n).filter((order) => clues.every((c) => fits(c, order)));
  forEachTask('grid-puzzles', (t, level) => {
    const { n, clues } = t.check;
    assert.equal(n, level <= 3 ? 3 : 4);
    assert.equal(solve(n, clues).length, 1, `${t.prompt}: не е единствено`);
    // Нито една следа не е излишна: без нея решението вече не е единствено.
    for (let i = 0; i < clues.length; i += 1) {
      const without = clues.filter((_, at) => at !== i);
      assert.ok(solve(n, without).length > 1, `${t.prompt}: следа ${i + 1} е излишна`);
    }
    assert.ok(clues.length >= 2, `${t.prompt}: една следа не е загадка`);
  }, 40);
});

test('допълненията не внасят дати, серии или случайност в генераторите', () => {
  for (const file of ['gen-functions.js', 'gen-puzzles.js']) {
    const src = readFileSync(new URL(`../js/content/math/${file}`, import.meta.url), 'utf8');
    for (const forbidden of ['Date', 'localStorage', 'performance.now', 'Math.random']) {
      assert.ok(!src.includes(forbidden), `${file} ползва ${forbidden}`);
    }
  }
});
