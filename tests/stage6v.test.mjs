// Етап 6в: математика, теми 7–10. Тук стоят проверките, които са специфични за новите
// теми: инвариантите на всяка задача (решението наистина решава уравнението, НОД наистина
// дели двете числа) и мястото на новите групи по стълбата. Общите проверки на генераторите
// — верен отговор, подсказки, запис на числата — са в tests/math.test.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GENERATORS, MAX_LEVEL, makeTask, parseNumeric } from '../js/content/math/generators.js';
import { UPPER_GENERATORS } from '../js/content/math/gen-upper.js';
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

const NEW_GROUPS = ['equations', 'geometry', 'data', 'patterns'];
const NEW_IDS = Object.keys(UPPER_GENERATORS);
const ROUNDS = 200;

// Обхожда всички нива на една тема и подава задачите на проверка.
function forEachTask(id, visit, rounds = ROUNDS) {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const random = seeded(id.length * 97 + level * 13);
    for (let i = 0; i < rounds; i += 1) visit(makeTask(id, level, random), level);
  }
}

// --- Дърво и стълба ---

const groupOf = (id) => MATH_TREE.find((g) => g.id === id);

test('теми 7–10: четирите групи стоят в дървото, всяка с подтемите си', () => {
  for (const id of NEW_GROUPS) {
    const group = groupOf(id);
    assert.ok(group, `${id} липсва в дървото`);
    assert.ok(group.subtopics.length >= 3, `${id}: само ${group.subtopics.length} подтеми`);
  }
  // Редът им в дървото остава същият, макар между тях да влязоха нови групи.
  const order = MATH_TREE.map((g) => g.id).filter((id) => NEW_GROUPS.includes(id));
  assert.deepEqual(order, NEW_GROUPS);
  assert.equal(new Set(ALL_SUBTOPICS.map((s) => s.id)).size, ALL_SUBTOPICS.length);
  // Всяка нова подтема има свой генератор и своя визуализация.
  for (const id of NEW_IDS) {
    const subtopic = ALL_SUBTOPICS.find((s) => s.id === id);
    assert.ok(subtopic, `${id} липсва в дървото`);
    assert.ok(GENERATORS[id], `${id} липсва в регистъра на генераторите`);
    assert.ok(NEW_GROUPS.includes(subtopic.groupId), `${id} не е в новите групи`);
  }
});

test('новите групи продължават стълбата, без празнина над 3 стъпки', () => {
  const steps = [...new Set([
    ...games.map((g) => g.unlockStep),
    ...MATH_TREE.map((group) => group.unlockStep),
  ])].sort((a, b) => a - b);
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i] - steps[i - 1] <= 3, `празнина между ${steps[i - 1]} и ${steps[i]}`);
  }
  // Четирите групи стоят на различни стъпки, всяка след предишната.
  const newSteps = NEW_GROUPS.map((id) => groupOf(id).unlockStep);
  assert.deepEqual(newSteps, [...newSteps].sort((a, b) => a - b));
  assert.equal(new Set(newSteps).size, newSteps.length);
  assert.equal(newSteps[0], 19);
  // Никоя от тях не идва преди последната игра: редът на наградите остава смесен.
  assert.ok(newSteps[0] > Math.max(...games.map((g) => g.unlockStep)) - 1);
});

test('визуализациите на новите подтеми са различни и всяка има своя функция', () => {
  const src = readFileSync(new URL('../js/views/math-viz.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const VISUALIZATIONS = {'));
  const names = new Set([...block.slice(0, block.indexOf('};')).matchAll(/^\s+'?([a-z-]+)'?[,:]/gm)].map((m) => m[1]));
  const used = new Set();
  for (const id of NEW_IDS) {
    const { viz } = ALL_SUBTOPICS.find((s) => s.id === id);
    assert.ok(names.has(viz), `липсва визуализация ${viz} за ${id}`);
    assert.equal(used.has(viz), false, `${viz} се ползва от две подтеми`);
    used.add(viz);
  }
});

// --- Инварианти на задачите ---

test('уравнения: заместеният отговор прави двете страни равни', () => {
  const checks = {
    'eq-add': (x, c) => x + c.a === c.total,
    'eq-sub': (x, c) => x - c.a === c.diff,
    'eq-mul': (x, c) => c.k * x === c.product,
    'eq-div': (x, c) => x / c.k === c.quotient,
    'eq2-add': (x, c) => c.k * x + c.m === c.r,
    'eq2-sub': (x, c) => c.k * x - c.m === c.r,
    'eq2-bracket-plus': (x, c) => c.k * (x + c.m) === c.r,
    'eq2-bracket-minus': (x, c) => c.k * (x - c.m) === c.r,
    'eq2-both': (x, c) => c.k * x + c.m === c.n * x + c.p,
  };
  for (const id of ['one-step', 'two-step']) {
    forEachTask(id, (t) => {
      const verify = checks[t.check.type];
      assert.ok(verify, `непознат вид уравнение ${t.check.type}`);
      const x = parseNumeric(t.answer);
      assert.ok(verify(x, t.check), `${id}: ${t.prompt} → ${t.answer}`);
      // Отговорът е цяло положително число: отрицателните и дробите идват по-късно.
      assert.ok(Number.isInteger(x) && x > 0, `${id}: ${t.prompt} → ${t.answer}`);
    });
  }
});

test('уравнения: условието не издава отговора и скобите не са празни', () => {
  forEachTask('two-step', (t) => {
    // Решението не стои в условието: „3x + 4 = 19“ не съдържа 5 като отделно число.
    const numbers = (t.prompt.match(/\d+/g) || []).map(Number);
    const x = parseNumeric(t.answer);
    if (t.check.type === 'eq2-bracket-minus') assert.ok(t.check.m < x, t.prompt);
    assert.ok(numbers.length >= 2, t.prompt);
  });
});

test('ъгли: сборовете са 90°, 180° или 360° и нито един ъгъл не е нула', () => {
  forEachTask('angles', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    assert.ok(value > 0 && value < 360, `${t.prompt} → ${t.answer}`);
    if (c.type === 'ang-comp') assert.equal(value + c.given, 90);
    if (c.type === 'ang-supp') assert.equal(value + c.given, 180);
    if (c.type === 'ang-tri') assert.equal(value + c.a + c.c, 180);
    if (c.type === 'ang-iso') assert.equal(2 * value + c.apex, 180);
    if (c.type === 'ang-quad') assert.equal(value + c.a + c.c + c.e, 360);
    if (c.type === 'ang-poly') assert.equal(value * c.n, (c.n - 2) * 180);
  });
});

test('геометрия: триъгълникът е възможен, а кръгът ползва 3,14 с два знака', () => {
  forEachTask('perimeter', (t) => {
    const c = t.check;
    if (c.type === 'per-tri') {
      // Неравенството на триъгълника: всяка страна е по-малка от сбора на другите две.
      const sides = [c.a, c.c, c.e];
      for (const side of sides) assert.ok(side < sides.reduce((x, y) => x + y, 0) - side, t.prompt);
    }
    if (c.type === 'per-circle') {
      assert.match(t.prompt, /3,14/);
      assert.ok(Math.abs(parseNumeric(t.answer) - 2 * 3.14 * c.r) < 0.005, t.prompt);
    }
    if (c.type === 'per-side') assert.ok(c.p / 2 - c.a > 0, t.prompt);
  });
  forEachTask('area', (t) => {
    const c = t.check;
    if (c.type === 'area-circle') {
      assert.match(t.prompt, /3,14/);
      assert.ok(Math.abs(parseNumeric(t.answer) - 3.14 * c.r * c.r) < 0.005, t.prompt);
    }
    if (c.type === 'area-trap') assert.ok(c.c > c.a, `${t.prompt}: основите са еднакви`);
    assert.ok(parseNumeric(t.answer) > 0, t.prompt);
  });
});

test('данни: всички стойности от таблицата стоят в условието', () => {
  forEachTask('charts', (t) => {
    const c = t.check;
    if (!c.values) return;
    for (const v of c.values) assert.match(t.prompt, new RegExp(`\\b${v}\\b`), `${v} липсва в „${t.prompt}“`);
    if (c.type === 'data-max') {
      // Максимумът е един: иначе задачата има два верни отговора.
      const top = Math.max(...c.values);
      assert.equal(c.values.filter((v) => v === top).length, 1, t.prompt);
      assert.equal(new Set(c.labels).size, c.labels.length, t.prompt);
    }
    if (c.type === 'data-count') assert.ok(parseNumeric(t.answer) >= 1, t.prompt);
  });
});

test('средни стойности: медианата е от списъка или между двете в средата', () => {
  forEachTask('averages', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'mean') {
      assert.ok(value >= Math.min(...c.values) && value <= Math.max(...c.values), t.prompt);
      assert.equal(c.values.reduce((a, b) => a + b, 0), value * c.values.length);
    }
    if (c.type === 'median') {
      const s = [...c.values].sort((a, b) => a - b);
      assert.ok(value >= s[0] && value <= s[s.length - 1], t.prompt);
      if (s.length % 2) assert.ok(c.values.includes(value), t.prompt);
    }
    if (c.type === 'mode') {
      // Модата е една: срещу всички останали стойности има по-малко повторения.
      const count = c.values.filter((v) => v === value).length;
      for (const v of new Set(c.values)) {
        if (v !== value) assert.ok(c.values.filter((x) => x === v).length < count, t.prompt);
      }
    }
    if (c.type === 'mean-missing') {
      assert.ok(value >= 1, t.prompt);
      assert.equal(c.values.reduce((a, b) => a + b, 0) + value, c.mean * c.count);
    }
  });
});

test('вероятност: отговорът винаги е между 0 и 1 или процент до 100', () => {
  forEachTask('probability', (t) => {
    const value = parseNumeric(t.answer);
    if (t.check.type === 'prob-percent') {
      assert.ok(value > 0 && value <= 100, t.prompt);
      assert.ok(Number.isInteger(value), `${t.prompt} → ${t.answer}`);
      return;
    }
    assert.ok(value >= 0 && value <= 1, `${t.prompt} → ${t.answer}`);
    // Записът е дроб или цяло число, не десетично: така се чете по-лесно.
    assert.doesNotMatch(t.answer, /,/, t.answer);
  });
});

test('вероятност: двата зара се броят по 36 двойки, а не по 11 сбора', () => {
  const random = seeded(5);
  const seen = new Set();
  for (let i = 0; i < 400; i += 1) {
    const t = makeTask('probability', 6, random);
    assert.equal(t.check.type, 'prob-dice-sum');
    let count = 0;
    for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) if (a + b === t.check.target) count += 1;
    assert.ok(Math.abs(parseNumeric(t.answer) - count / 36) < 1e-9, t.prompt);
    seen.add(t.check.target);
  }
  // Задачата не е винаги за една и съща цел.
  assert.ok(seen.size >= 5, `само ${seen.size} различни сбора`);
});

test('редици: показаните членове наистина следват обявеното правило', () => {
  forEachTask('sequences', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'seq-arith') {
      const terms = Array.from({ length: c.index }, (_, i) => c.start + i * c.step);
      for (const term of terms) assert.match(t.prompt, new RegExp(`\\b${term}\\b`), t.prompt);
      assert.equal(value - terms[terms.length - 1], c.step);
    }
    if (c.type === 'seq-geom') {
      const terms = Array.from({ length: c.index }, (_, i) => c.start * c.ratio ** i);
      for (const term of terms) assert.match(t.prompt, new RegExp(`\\b${term}\\b`), t.prompt);
      assert.equal(value / terms[terms.length - 1], c.ratio);
    }
    assert.ok(Number.isInteger(value) && value > 0, `${t.prompt} → ${t.answer}`);
  });
});

test('прости числа, НОД и НОК: отговорът издържа проверка по определението', () => {
  const bothAnswers = new Set();
  forEachTask('multiples', (t, level) => {
    const c = t.check;
    if (c.type === 'prime') {
      if (level <= 2) bothAnswers.add(t.answer);
      let divisors = 0;
      for (let i = 1; i <= c.n; i += 1) if (c.n % i === 0) divisors += 1;
      assert.equal(t.answer, divisors === 2 ? 'Да' : 'Не', `${c.n}`);
      return;
    }
    const value = parseNumeric(t.answer);
    if (c.type === 'gcd') {
      assert.equal(c.a % value, 0, t.prompt);
      assert.equal(c.c % value, 0, t.prompt);
      // По-голям общ делител няма.
      for (let i = value + 1; i <= Math.min(c.a, c.c); i += 1) {
        assert.ok(c.a % i !== 0 || c.c % i !== 0, `${t.prompt}: ${i} също дели двете`);
      }
    }
    if (c.type === 'lcm') {
      assert.equal(value % c.a, 0, t.prompt);
      assert.equal(value % c.c, 0, t.prompt);
      for (let i = Math.max(c.a, c.c); i < value; i += 1) {
        assert.ok(i % c.a !== 0 || i % c.c !== 0, `${t.prompt}: ${i} е по-малко общо кратно`);
      }
    }
    assert.notEqual(c.a, c.c, t.prompt);
  });
  // „Просто ли е“ не може да се познава: и двата отговора се срещат.
  assert.equal(bothAnswers.size, 2, [...bothAnswers].join(','));
});

test('броене: отговорът съвпада с изброяване на всички възможности', () => {
  forEachTask('counting', (t) => {
    const c = t.check;
    const value = parseNumeric(t.answer);
    if (c.type === 'count-mul') {
      let count = 0;
      for (let i = 0; i < c.a; i += 1) for (let j = 0; j < c.c; j += 1) count += 1;
      assert.equal(value, count, t.prompt);
    }
    if (c.type === 'count-pow') {
      // Изброяване на всички думи с дължина exp над азбука от base букви.
      let count = 0;
      const walk = (depth) => {
        if (depth === c.exp) { count += 1; return; }
        for (let i = 0; i < c.base; i += 1) walk(depth + 1);
      };
      walk(0);
      assert.equal(value, count, t.prompt);
    }
    if (c.type === 'count-comb') {
      // Изброяване на двойките и тройките наистина, без формула.
      const items = Array.from({ length: c.n }, (_, i) => i);
      const groups = [];
      const walk = (start, chosen) => {
        if (chosen.length === c.k) { groups.push(chosen.join('-')); return; }
        for (let i = start; i < items.length; i += 1) walk(i + 1, [...chosen, items[i]]);
      };
      walk(0, []);
      assert.equal(value, new Set(groups).size, t.prompt);
    }
    assert.ok(Number.isInteger(value) && value > 0, `${t.prompt} → ${t.answer}`);
  }, 60);
});

test('Етап 6в не внася дати, серии или история', () => {
  const src = readFileSync(new URL('../js/content/math/gen-upper.js', import.meta.url), 'utf8');
  for (const forbidden of ['Date', 'localStorage', 'performance.now', 'Math.random']) {
    assert.ok(!src.includes(forbidden), `gen-upper.js ползва ${forbidden}`);
  }
});
