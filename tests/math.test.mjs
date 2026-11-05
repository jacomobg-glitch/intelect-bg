import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATORS, MAX_LEVEL, checkAnswer, makeTask, parseNumeric } from '../js/content/math/generators.js';
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
const FRACTIONAL = new Set(['fractions', 'decimals', 'percent', 'word-money']);
const SIGNED = new Set(['negatives', 'powers']);

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
  for (const id of ['parity', 'divisibility']) {
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const random = seeded(level * 31);
      for (let i = 0; i < ROUNDS; i += 1) {
        const t = makeTask(id, level, random);
        assert.ok(t.options.includes(t.answer));
        assert.equal(new Set(t.options).size, t.options.length);
      }
    }
  }
});

test('генератори: решението (третата подсказка) съдържа отговора при числовите задачи', () => {
  const ids = ['add', 'sub', 'mul', 'div', 'mental', 'count', 'number-line',
    'fractions', 'decimals', 'percent', 'negatives', 'powers', 'roots', 'ratio', 'word-money', 'word-travel'];
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
  assert.equal(MATH_TREE.length, 6);
  assert.equal(ALL_SUBTOPICS.length, 18);
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
