import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GENERATORS, MAX_LEVEL, checkAnswer, makeTask, parseNumeric } from '../js/content/math/generators.js';
import { parseInterval } from '../js/content/math/task.js';
import { ALL_SUBTOPICS, MATH_TREE } from '../js/content/math/topics.js';
import { defaultTopic } from '../js/core/model.js';
import { validateGame } from '../js/core/registry.js';
import math, { SESSION_SIZE, applyOutcome, testLevels } from '../js/modules/math.js';

// Възпроизводим генератор на случайни числа.
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Независимо пресмятане на верния отговор, без да се ползва кодът на генератора.
// Числовите типове връщат число (сравнява се по стойност), текстовите връщат текст.
const EUR = 1.95583; // курсът се пише тук наново, за да не се чете от генератора
const PI = 3.14;     // същото важи и за π: стойността се пише наново

// Сметките за теми 7–10 се пишат наново тук, без да се ползва код на генератора.
const total = (list) => list.reduce((a, b) => a + b, 0);
const sorted = (list) => [...list].sort((a, b) => a - b);
const medianOf = (list) => {
  const s = sorted(list);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const modeOf = (list) => {
  let best = list[0];
  let bestCount = 0;
  for (const v of list) {
    const count = list.filter((x) => x === v).length;
    if (count > bestCount) { best = v; bestCount = count; }
  }
  return best;
};
const primeByTrial = (n) => {
  if (n < 2) return false;
  for (let i = 2; i <= n - 1; i += 1) if (n % i === 0) return false;
  return true;
};
const gcdByList = (a, b) => {
  let best = 1;
  for (let i = 1; i <= Math.min(a, b); i += 1) if (a % i === 0 && b % i === 0) best = i;
  return best;
};
const lcmByList = (a, b) => {
  for (let i = Math.max(a, b); i <= a * b; i += 1) if (i % a === 0 && i % b === 0) return i;
  return a * b;
};
const factorialOf = (n) => {
  let v = 1;
  for (let i = 2; i <= n; i += 1) v *= i;
  return v;
};
const fallingOf = (n, k) => {
  let v = 1;
  for (let i = 0; i < k; i += 1) v *= n - i;
  return v;
};
const dicePairs = (target) => {
  let count = 0;
  for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) if (a + b === target) count += 1;
  return count;
};
const INF = Infinity;
// Интервал за сравнение по смисъл: краищата и това дали влизат.
const between = (lo, loIn, hi, hiIn) => ({ lo: lo === 0 ? 0 : lo, loIn, hi: hi === 0 ? 0 : hi, hiIn });
const OPEN = { gt: false, ge: true, lt: false, le: true };
const upward = (op, value) => (op === 'gt' || op === 'ge'
  ? between(value, OPEN[op], INF, false)
  : between(-INF, false, value, OPEN[op]));
const TURN = { gt: 'lt', ge: 'le', lt: 'gt', le: 'ge' };
const hypotenuse = (a, c) => Math.sqrt(a * a + c * c);
const minWeigh = (n) => {
  let k = 0;
  let reach = 1;
  while (reach < n) { reach *= 3; k += 1; }
  return k;
};
// Втори решател за рицарите и за мрежите: пише се наново, за да не се ползва кодът на генератора.
const says = (stmt, assign) => {
  if (stmt.k === 'knight') return assign[stmt.who] === true;
  if (stmt.k === 'liar') return assign[stmt.who] === false;
  if (stmt.k === 'same') return assign[stmt.a] === assign[stmt.b];
  if (stmt.k === 'diff') return assign[stmt.a] !== assign[stmt.b];
  if (stmt.k === 'allLiars') return assign.indexOf(true) === -1;
  if (stmt.k === 'someLiar') return assign.indexOf(false) !== -1;
  return assign.filter((v) => v === true).length === stmt.n;
};
const knightSolutions = (count, told) => {
  const out = [];
  for (let mask = 0; mask < 2 ** count; mask += 1) {
    const assign = [];
    for (let i = 0; i < count; i += 1) assign.push(((mask >> i) & 1) === 1);
    if (told.every((t) => assign[t.who] === says(t.stmt, assign))) out.push(assign);
  }
  return out;
};
const orders = (n) => {
  if (n === 0) return [[]];
  const out = [];
  for (const rest of orders(n - 1)) {
    for (let at = 0; at <= rest.length; at += 1) out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
  }
  return out;
};
const gridSolutions = (n, clues) => orders(n).filter((order) => clues.every((clue) => {
  if (clue.kind === 'is') return order[clue.person] === clue.item;
  if (clue.kind === 'not') return order[clue.person] !== clue.item;
  return clue.items.indexOf(order[clue.person]) !== -1;
}));

const fibTerm = (first, second, index) => {
  const terms = [first, second];
  while (terms.length <= index) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
  return terms[index];
};

function expected(c) {
  switch (c.type) {
    case 'next': return c.n + 1;
    case 'prev': return c.n - 1;
    case 'tens': return Math.floor(c.n / 10);
    case 'add': return c.a + c.b;
    case 'add3': return c.a + c.b + c.c;
    case 'sub': return c.a - c.b;
    case 'mul': return c.a * c.b;
    case 'div': return c.a / c.b;
    case 'rem': return c.a % c.b;
    case 'mid': return (c.a + c.b) / 2;
    case 'hops': return c.start + c.hops * c.step;
    case 'parity': return c.n % 2 === 0 ? 'Четно' : 'Нечетно';
    case 'parity-sum': return (c.a + c.b) % 2 === 0 ? 'Четно' : 'Нечетно';
    case 'divides': return c.n % c.d === 0 ? 'Да' : 'Не';
    // Нива 4-6
    case 'frac-of': return (c.whole / c.den) * c.num;
    case 'frac-equiv': return c.num * c.factor;
    case 'frac-add-same': return (c.a + c.b) / c.den;
    case 'frac-reduce': return c.num / c.den;
    case 'frac-add': return c.a / c.da + c.b / c.db;
    case 'frac-to-dec': return c.num / c.den;
    case 'dec-add': return c.a + c.b;
    case 'dec-mul': return c.a * c.b;
    case 'dec-div': return c.a / c.b;
    case 'dec-digit': return c.place === 'десетите' ? c.tenths : c.hundredths;
    case 'percent-of': return (c.base * c.p) / 100;
    case 'percent-less': return c.base - (c.base * c.p) / 100;
    case 'percent-more': return c.base + (c.base * c.p) / 100;
    case 'percent-share': return (c.part / c.base) * 100;
    case 'neg-add': return c.a + c.b;
    case 'neg-mul': return c.a * c.b;
    case 'neg-mul-add': return c.a + c.b * c.c;
    case 'pow': return c.base ** c.exp;
    case 'sqrt': return Math.sqrt(c.n);
    case 'sqrt-floor': return Math.floor(Math.sqrt(c.n));
    case 'cbrt': return Math.round(Math.cbrt(c.n));
    case 'ratio': return (c.a / c.b) * c.c;
    case 'ratio-split': return (c.total / (c.a + c.b)) * c.a;
    case 'inverse': return (c.workers * c.hours) / c.more;
    case 'buy-change': return c.paid - c.count * c.price;
    case 'two-goods': return c.a * c.pa + c.b * c.pb;
    case 'two-legs': return c.s1 * c.h1 + c.s2 * c.h2;
    case 'to-euro': return Math.round(c.leva / EUR);
    // Нива 7-10
    case 'expr-lin': return c.k * c.v + c.m;
    case 'expr-sum-coef': return c.k + c.m;
    case 'expr-two': return c.k * c.v + c.m * c.w;
    case 'expr-bracket': return c.k * (c.v + c.m);
    case 'eq-add': return c.total - c.a;
    case 'eq-sub': return c.diff + c.a;
    case 'eq-mul': return c.product / c.k;
    case 'eq-div': return c.quotient * c.k;
    case 'eq2-add': return (c.r - c.m) / c.k;
    case 'eq2-sub': return (c.r + c.m) / c.k;
    case 'eq2-bracket-plus': return c.r / c.k - c.m;
    case 'eq2-bracket-minus': return c.r / c.k + c.m;
    case 'eq2-both': return (c.p - c.m) / (c.k - c.n);
    case 'ang-comp': return 90 - c.given;
    case 'ang-supp': return 180 - c.given;
    case 'ang-tri': return 180 - c.a - c.c;
    case 'ang-iso': return (180 - c.apex) / 2;
    case 'ang-quad': return 360 - c.a - c.c - c.e;
    case 'ang-poly': return ((c.n - 2) * 180) / c.n;
    case 'per-square': return 4 * c.a;
    case 'per-rect': return 2 * (c.a + c.c);
    case 'per-tri': return c.a + c.c + c.e;
    case 'per-side': return c.p / 2 - c.a;
    case 'per-poly': return c.n * c.a;
    case 'per-circle': return Math.round(2 * PI * c.r * 100) / 100;
    case 'area-square': return c.a * c.a;
    case 'area-rect': return c.a * c.c;
    case 'area-tri': return (c.base * c.height) / 2;
    case 'area-side': return c.value / c.a;
    case 'area-trap': return ((c.a + c.c) * c.height) / 2;
    case 'area-circle': return Math.round(PI * c.r * c.r * 100) / 100;
    case 'data-max': return c.labels[c.values.indexOf(Math.max(...c.values))];
    case 'data-sum': return total(c.values);
    case 'data-range': return Math.max(...c.values) - Math.min(...c.values);
    case 'data-count': return c.values.filter((v) => v > c.limit).length;
    case 'data-missing': return c.total - total(c.values);
    case 'data-share': return (100 * c.part) / c.total;
    case 'mean': return total(c.values) / c.values.length;
    case 'median': return medianOf(c.values);
    case 'mode': return modeOf(c.values);
    case 'mean-missing': return c.mean * c.count - total(c.values);
    case 'prob-simple': return c.good / c.total;
    case 'prob-not': return (c.total - c.good) / c.total;
    case 'prob-percent': return (100 * c.good) / c.total;
    case 'prob-two': return (c.good1 * c.good2) / (c.total1 * c.total2);
    case 'prob-dice-sum': return dicePairs(c.target) / 36;
    case 'seq-arith': return c.start + c.step * c.index;
    case 'seq-geom': return c.start * c.ratio ** c.index;
    case 'seq-square': return c.n * c.n;
    case 'seq-tri': return (c.n * (c.n + 1)) / 2;
    case 'seq-fib': return fibTerm(c.first, c.second, c.index);
    case 'seq-sum': return (c.count * (2 * c.start + (c.count - 1) * c.step)) / 2;
    case 'prime': return primeByTrial(c.n) ? 'Да' : 'Не';
    case 'gcd': return gcdByList(c.a, c.c);
    case 'lcm': return lcmByList(c.a, c.c);
    case 'count-mul': return c.a * c.c;
    case 'count-mul3': return c.a * c.c * c.e;
    case 'count-pow': return c.base ** c.exp;
    case 'count-perm': return factorialOf(c.n);
    case 'count-perm-k': return fallingOf(c.n, c.k);
    case 'count-comb': return fallingOf(c.n, c.k) / factorialOf(c.k);
    // Допълненията: неравенства, функции, Питагор, много опити и загадки
    case 'ineq-add': return { interval: upward(c.op, c.r - c.a) };
    case 'ineq-sub': return { interval: upward(c.op, c.r + c.a) };
    case 'ineq-mul': return { interval: upward(c.op, c.r / c.k) };
    case 'ineq-neg-free': return { interval: upward(c.op, (c.r - c.m) / c.k) };
    case 'ineq-neg': return { interval: upward(TURN[c.op], c.r / c.k) };
    case 'ineq-between': return { interval: between(c.lo - c.m, false, c.hi - c.m, true) };
    case 'coord-read': return c.axis === 'x' ? c.x : c.y;
    case 'coord-quadrant': return c.x > 0 ? (c.y > 0 ? 1 : 4) : (c.y > 0 ? 2 : 3);
    case 'coord-dist': return Math.abs(c.x2 - c.x1) + Math.abs(c.y2 - c.y1);
    case 'coord-mid': return (c.x1 + c.x2) / 2;
    case 'coord-reflect': return c.overX
      ? (c.which === 'x' ? c.x : -c.y)
      : (c.which === 'x' ? -c.x : c.y);
    case 'lin-value': return c.k * c.x + c.b;
    case 'lin-zero': return -c.b / c.k;
    case 'lin-slope': return (c.y2 - c.y1) / (c.x2 - c.x1);
    case 'lin-solve': return (c.y - c.b) / c.k;
    case 'lin-cross': return (c.b2 - c.b1) / (c.k1 - c.k2);
    case 'par-value': return c.x * c.x;
    case 'par-stretch': return c.a * c.x * c.x;
    case 'par-shift-up': return c.x * c.x + c.k;
    case 'par-shift-side': return (c.x - c.h) * (c.x - c.h);
    case 'par-vertex': return c.which === 'h' ? c.h : c.k;
    case 'par-full': return c.a * (c.x - c.h) * (c.x - c.h) + c.k;
    case 'rate-total': return c.base + c.per * c.units;
    case 'rate-total-dec': return Math.round((c.base + c.per * c.units) * 100) / 100;
    case 'rate-units': return (c.total - c.base) / c.per;
    case 'rate-base': return c.total - c.per * c.units;
    case 'rate-plan': return c.base + c.perExtra * Math.max(0, c.used - c.included);
    case 'rate-even': return (c.baseB - c.baseA) / (c.perA - c.perB);
    case 'pyth-hyp': return hypotenuse(c.a, c.c);
    case 'pyth-leg': return Math.sqrt(c.hyp * c.hyp - c.a * c.a);
    case 'sim-expect': return (c.trials * c.good) / c.total;
    case 'sim-share': return (100 * c.hits) / c.trials;
    case 'sim-gap': return Math.abs((100 * c.hits) / c.trials - (100 * c.good) / c.total);
    case 'sim-closer': {
      const gapA = Math.abs((100 * c.first.hits) / c.first.trials - (100 * c.good) / c.total);
      const gapB = Math.abs((100 * c.second.hits) / c.second.trials - (100 * c.good) / c.total);
      return gapB < gapA ? 'вторият опит' : 'първият опит';
    }
    case 'sim-dice-expect': return (c.trials * dicePairs(c.target)) / 36;
    case 'log-and': return c.p && c.q ? 'Да' : 'Не';
    case 'log-or': return c.p || c.q ? 'Да' : 'Не';
    case 'log-not': return c.p ? 'Не' : 'Да';
    case 'log-implies': return !c.p || c.q ? 'Да' : 'Не';
    case 'log-rows': {
      const table = [[true, true], [true, false], [false, true], [false, false]];
      const op = {
        and: (p, q) => p && q, or: (p, q) => p || q, implies: (p, q) => !p || q, xor: (p, q) => p !== q,
      }[c.op];
      return table.filter(([p, q]) => op(p, q)).length;
    }
    case 'log-compound': {
      const form = [
        (p, q, r) => (p && q) || !r,
        (p, q) => !(p || q),
        (p, q, r) => !p || (q && r),
      ][c.form];
      return form(c.p, c.q, c.r) ? 'Да' : 'Не';
    }
    case 'coins-max': return 3 ** c.k;
    case 'coins-min': return minWeigh(c.n);
    case 'coins-left': return c.n - 2 * c.each;
    case 'coins-side': return c.up === 'none' ? 'сред неизмерените'
      : (c.up === 'left' ? 'в лявата група' : 'в дясната група');
    case 'knights': {
      const [only] = knightSolutions(c.count, c.says);
      if (!only) return 'без решение';
      if (c.ask !== null) return only[c.ask] ? 'Да' : 'Не';
      if (only[0] && only[1]) return 'и двамата';
      if (only[0]) return 'само А';
      if (only[1]) return 'само Б';
      return 'никой';
    }
    case 'grid': {
      // Имената се изписват наново тук, за да се хване и разминаване в тях.
      const WHO = ['Ана', 'Боян', 'Вера', 'Генади'];
      const WHERE = ['синята', 'зелената', 'червената', 'жълтата'];
      const [only] = gridSolutions(c.n, c.clues);
      if (!only) return 'без решение';
      return c.ask.kind === 'person' ? WHERE[only[c.ask.index]] : WHO[only.indexOf(c.ask.index)];
    }
    case 'const': return c.value;
    default: throw new Error(`непознат тип ${c.type}`);
  }
}

const ROUNDS = 400;
const NEAR = 1e-9;

test('генератори: верният отговор винаги е верен, на всички теми и нива', () => {
  for (const id of Object.keys(GENERATORS)) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(id.length * 1000 + level);
      for (let i = 0; i < ROUNDS; i += 1) {
        const t = makeTask(id, level, random);
        const want = expected(t.check);
        if (want && typeof want === 'object') {
          const got = parseInterval(t.answer);
          assert.ok(got, `${id}/${level}: „${t.answer}“ не се чете като интервал`);
          assert.deepEqual(got, want.interval, `${id}/${level}: ${t.prompt} → ${t.answer}`);
          assert.ok(checkAnswer(t, t.answer));
          continue;
        }
        if (typeof want === 'number') {
          const got = parseNumeric(t.answer);
          assert.ok(got !== null, `${id}/${level}: „${t.answer}“ не е число`);
          assert.ok(Math.abs(got - want) < NEAR, `${id}/${level}: ${t.prompt} → ${t.answer}, очаквано ${want}`);
        } else {
          assert.equal(t.answer, want, `${id}/${level}: ${t.prompt}`);
        }
        assert.ok(checkAnswer(t, t.answer));
      }
    }
  }
});

// Темите, при които отговорът може да не е цяло число или да е отрицателен.
const FRACTIONAL = new Set(['fractions', 'decimals', 'percent', 'word-money',
  'perimeter', 'area', 'averages', 'probability', 'rates', 'pythagoras']);
const SIGNED = new Set(['negatives', 'powers', 'coordinates', 'linear', 'parabola']);

test('генератори: няма деление на нула, счупен текст или неуместни дроби и минуси', () => {
  for (const id of Object.keys(GENERATORS)) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(id.length * 77 + level);
      for (let i = 0; i < ROUNDS; i += 1) {
        const t = makeTask(id, level, random);
        const all = [t.prompt, ...t.hints, ...(t.options || [])].join(' ');
        assert.doesNotMatch(all, /undefined|NaN|null|Infinity|\[object/, `${id}/${level}: ${all}`);
        assert.equal(t.hints.length, 3);
        if (t.check.b === 0 || t.check.d === 0) assert.fail(`нула: ${t.prompt}`);
        if (t.kind === 'number') {
          const v = parseNumeric(t.answer);
          assert.ok(v !== null, `${id}/${level}: „${t.answer}“ не е число`);
          if (!FRACTIONAL.has(id)) assert.ok(Number.isInteger(v), `${id}/${level}: ${t.prompt} = ${t.answer}`);
          if (!SIGNED.has(id)) assert.ok(v >= 0, `${id}/${level}: ${t.prompt} = ${t.answer}`);
        }
      }
    }
  }
});

test('генератори: десетичната запетая е по български и няма опашки от плаваща точка', () => {
  for (const id of Object.keys(GENERATORS)) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(id.length * 211 + level);
      for (let i = 0; i < 200; i += 1) {
        const t = makeTask(id, level, random);
        const all = [t.answer, t.prompt, ...t.hints].join(' ');
        // Точка между цифри значи английски запис: в текстовете е забранена.
        assert.doesNotMatch(all, /\d\.\d/, `${id}/${level}: ${all}`);
        if (t.kind !== 'number') continue;
        const places = (t.answer.split(',')[1] || '').length;
        assert.ok(places <= 4, `${id}/${level}: ${t.answer} има ${places} знака след запетаята`);
      }
    }
  }
});

test('отговорите приемат еквивалентни записи: 0,5 = 0.5 = 1/2', () => {
  const half = { answer: '1/2' };
  for (const form of ['1/2', '0,5', '0.5', ' 0,50 ', '2/4', '50/100']) {
    assert.ok(checkAnswer(half, form), form);
  }
  for (const form of ['0,6', '1/3', '2', '', 'половина']) {
    assert.equal(checkAnswer(half, form), false, form);
  }
  // И в обратната посока: записан като десетично число, приема дроб.
  assert.ok(checkAnswer({ answer: '0,75' }, '3/4'));
  assert.ok(checkAnswer({ answer: '2,5' }, '5/2'));
  // Отрицателни и цели числа.
  assert.ok(checkAnswer({ answer: '-27' }, '−27'.replace('−', '-')));
  assert.ok(checkAnswer({ answer: '12' }, '12,0'));
  assert.equal(checkAnswer({ answer: '12' }, '12,1'), false);
  // Текстовите отговори остават текстови.
  assert.ok(checkAnswer({ answer: 'Да' }, ' да '));
  assert.equal(checkAnswer({ answer: 'Да' }, '1'), false);
});

test('parseNumeric: чете цели, десетични и прости дроби, иначе връща null', () => {
  assert.equal(parseNumeric('7'), 7);
  assert.equal(parseNumeric('-7'), -7);
  assert.equal(parseNumeric('0,25'), 0.25);
  assert.equal(parseNumeric('0.25'), 0.25);
  assert.equal(parseNumeric('3/4'), 0.75);
  assert.equal(parseNumeric('-3/4'), -0.75);
  assert.equal(parseNumeric('1/0'), null);
  assert.equal(parseNumeric('Да'), null);
  assert.equal(parseNumeric(''), null);
  assert.equal(parseNumeric('1/2/3'), null);
  assert.equal(parseNumeric('12лв'), null);
});

test('генератори: опциите съдържат верния отговор и няма дублирани', () => {
  for (const id of Object.keys(GENERATORS)) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(level * 31);
      for (let i = 0; i < ROUNDS; i += 1) {
        const t = makeTask(id, level, random);
        if (t.kind !== 'choice') continue;
        assert.ok(t.options.includes(t.answer), `${id}/${level}: ${t.prompt}`);
        assert.equal(new Set(t.options).size, t.options.length, `${id}/${level}`);
      }
    }
  }
});

test('генератори: решението (третата подсказка) съдържа отговора при числовите задачи', () => {
  const ids = ['add', 'sub', 'mul', 'div', 'mental', 'count', 'number-line',
    'fractions', 'decimals', 'percent', 'negatives', 'powers', 'roots', 'ratio', 'word-money', 'word-travel',
    'expressions', 'one-step', 'two-step', 'angles', 'perimeter', 'area',
    'charts', 'averages', 'probability', 'sequences', 'multiples', 'counting',
    'inequalities', 'coordinates', 'linear', 'parabola', 'rates', 'pythagoras',
    'simulation', 'truth-tables', 'knights', 'coins', 'grid-puzzles'];
  for (const id of ids) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(level * 13 + id.length);
      for (let i = 0; i < 100; i += 1) {
        const t = makeTask(id, level, random);
        assert.ok(t.hints[2].includes(t.answer), `${id}: ${t.prompt} → ${t.hints[2]}`);
      }
    }
  }
});

test('генератори: и двата отговора при „Да/Не“ се срещат, за да не може да се познава', () => {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    const random = seeded(level * 101);
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) seen.add(makeTask('divisibility', level, random).answer);
    assert.equal(seen.size, 2, `ниво ${level}`);
  }
});

test('генератори: по-високо ниво дава по-големи числа', () => {
  const avg = (level) => {
    const random = seeded(level + 5);
    let sum = 0;
    for (let i = 0; i < 200; i += 1) sum += Number(makeTask('add', level, random).answer);
    return sum / 200;
  };
  for (let level = 2; level <= MAX_LEVEL; level += 1) assert.ok(avg(level) > avg(level - 1), `ниво ${level}`);
});

test('отговорите се сравняват толерантно, но празното не е верен отговор', () => {
  const t = makeTask('add', 1, seeded(3));
  assert.ok(checkAnswer(t, ` ${t.answer} `));
  assert.equal(checkAnswer(t, ''), false);
  assert.equal(checkAnswer(t, '   '), false);
  assert.ok(checkAnswer({ answer: 'Четно' }, 'четно'));
});

test('съдържание: всяка подтема има 3 нива, 3 примера, визуализация и генератор', () => {
  assert.equal(MATH_TREE.length, 12);
  assert.equal(ALL_SUBTOPICS.length, 41);
  for (const s of ALL_SUBTOPICS) {
    assert.ok(GENERATORS[s.id], s.id);
    assert.ok(s.viz, s.id);
    for (const key of ['child', 'standard', 'why']) assert.ok(s.explain[key].length > 40, `${s.id}/${key}`);
    assert.equal(s.examples.length, 3, s.id);
    for (const e of s.examples) {
      assert.ok(e.steps.length >= 3, e.title);
      assert.match(e.steps[e.steps.length - 1], /Отговор/, e.title);
    }
  }
});

// Визуализациите живеят в изглед с DOM, затова тук се четат от файла: важното е, че
// всяко име от дървото има своя функция, а не как е нарисувана.
test('всяко име на визуализация от дървото съществува в math-viz.js', () => {
  const src = readFileSync(new URL('../js/views/math-viz.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const VISUALIZATIONS = {'));
  const names = new Set([...block.slice(0, block.indexOf('};')).matchAll(/^\s+'?([a-z-]+)'?[,:]/gm)].map((m) => m[1]));
  for (const s of ALL_SUBTOPICS) {
    assert.ok(names.has(s.viz), `липсва визуализация ${s.viz} за ${s.id}`);
    if (s.vizAlt) {
      assert.ok(names.has(s.vizAlt), `липсва втори изглед ${s.vizAlt} за ${s.id}`);
      assert.notEqual(s.vizAlt, s.viz, s.id);
      assert.equal(s.vizNames?.length, 2, `${s.id}: двата изгледа искат по едно име`);
    }
  }
  // „Задачи с път и време“ получи собствена визуализация; отношенията са вторият изглед.
  const travel = ALL_SUBTOPICS.find((s) => s.id === 'word-travel');
  assert.equal(travel.viz, 'travel');
  assert.equal(travel.vizAlt, 'ratio-bars');
});

test('модулът спазва общия интерфейс и е достъпен от началото', () => {
  assert.deepEqual(validateGame(math), []);
  assert.equal(math.unlockStep, 0);
  assert.deepEqual(math.skills, ['math']);
});

const runSession = (mode, answerRight, opts = {}) => {
  const random = seeded(99);
  math.init({ topicId: opts.topicId || 'add', mode, difficulty: 1, maxDifficulty: opts.ceiling || 3, random });
  math.start();
  let n = 0;
  while (math.task) {
    n += 1;
    const right = typeof answerRight === 'function' ? answerRight(n) : answerRight;
    math.answer(right ? math.task.answer : 'грешно');
    if (!math.answered) math.giveUp();
    math.next();
  }
  return n;
};

test('сесия: брой задачи и процент', () => {
  assert.equal(runSession('test', true), SESSION_SIZE.test);
  assert.equal(math.percent(), 100);
  assert.equal(runSession('test', (n) => n <= 8), 10);
  assert.equal(math.percent(), 80);
  assert.equal(runSession('review', true), SESSION_SIZE.review);
  assert.equal(runSession('practice', true), SESSION_SIZE.practice);
});

test('сесия: трудността на упражненията следва правилото и спазва тавана', () => {
  runSession('practice', true, { ceiling: 3 });
  assert.equal(math.difficulty, 3);
  math.init({ topicId: 'add', mode: 'practice', difficulty: 3, maxDifficulty: 3, random: seeded(4) });
  math.start();
  math.answer('грешно');
  math.giveUp();
  assert.equal(math.difficulty, 2);
});

test('сесия: подсказките вървят намек → метод → решение и намаляват точките', () => {
  math.init({ topicId: 'add', mode: 'practice', difficulty: 1, maxDifficulty: 3, random: seeded(6) });
  math.start();
  const hints = math.task.hints;
  assert.equal(math.showHint(), hints[0]);
  assert.equal(math.showHint(), hints[1]);
  assert.equal(math.showHint(), hints[2]);
  assert.equal(math.showHint(), null);
  assert.equal(math.answer(math.task.answer).correct, true);
  assert.equal(math.credit, 0);
});

test('сесия: при упражнение грешният отговор отваря подсказка и позволява нов опит', () => {
  math.init({ topicId: 'add', mode: 'practice', difficulty: 1, maxDifficulty: 3, random: seeded(8) });
  math.start();
  const r = math.answer('грешно');
  assert.deepEqual([r.correct, r.final, r.hint], [false, false, math.task.hints[0]]);
  assert.equal(math.answer(math.task.answer).correct, true);
  assert.equal(math.credit, 0.75);
});

test('сесия: при тест няма подсказки и опитът е един', () => {
  math.init({ topicId: 'add', mode: 'test', difficulty: 1, maxDifficulty: 3, random: seeded(8) });
  math.start();
  assert.equal(math.showHint(), null);
  assert.equal(math.answer('грешно').final, true);
  assert.equal(math.answer(math.task.answer).correct, false);
});

test('сесия: без верен отговор няма XP, а времето е с таван', () => {
  runSession('practice', false);
  assert.equal(math.xpReward(), 0);
  math.init({ topicId: 'add', mode: 'test', difficulty: 1, maxDifficulty: 3, random: seeded(2) });
  math.start();
  math.taskStart = performance.now() - 3600000; // оставено устройство за час
  math.answer(math.task.answer);
  math.next();
  assert.ok(math.activeMs <= 120001, `${math.activeMs}`);
});

test('нивата на теста растат и не надминават тавана', () => {
  assert.deepEqual(testLevels(10, 3), [1, 1, 1, 2, 2, 2, 3, 3, 3, 3]);
  assert.equal(Math.max(...testLevels(10, 31)), MAX_LEVEL);
});

test('усвояване: 80% дава отметка с дата и план за преговор', () => {
  const t = applyOutcome(defaultTopic('add'), { mode: 'test', percent: 80 }, '2026-02-10');
  assert.equal(t.mastered, true);
  assert.equal(t.masteredAt, '2026-02-10');
  assert.equal(t.bestTest, 80);
  assert.equal(t.sm2.due, '2026-02-11');
});

test('усвояване: 70% не дава отметка, но и не наказва', () => {
  const t = applyOutcome(defaultTopic('add'), { mode: 'test', percent: 70 }, '2026-02-10');
  assert.equal(t.mastered, false);
  assert.equal(t.sm2, null);
  assert.equal(t.bestTest, 70);
});

test('преговор: слаб резултат не отнема отметката и датата', () => {
  const mastered = applyOutcome(defaultTopic('add'), { mode: 'test', percent: 100 }, '2026-02-10');
  const after = applyOutcome(mastered, { mode: 'review', percent: 20 }, '2026-03-01');
  assert.equal(after.mastered, true);
  assert.equal(after.masteredAt, '2026-02-10');
  assert.equal(after.bestTest, 100);
  assert.equal(after.sm2.interval, 1);
});

test('повторен тест пази първата дата на усвояване', () => {
  const first = applyOutcome(defaultTopic('add'), { mode: 'test', percent: 90 }, '2026-02-10');
  const again = applyOutcome(first, { mode: 'test', percent: 100 }, '2026-05-01');
  assert.equal(again.masteredAt, '2026-02-10');
  assert.equal(again.bestTest, 100);
});

test('упражнението пази нивото, но не пипа усвояването', () => {
  const t = applyOutcome(defaultTopic('add'), { mode: 'practice', percent: 100, level: 4 }, '2026-02-10');
  assert.equal(t.level, 4);
  assert.equal(t.mastered, false);
});
