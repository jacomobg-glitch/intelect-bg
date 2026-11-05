// Етап 6б: седемте рефлексни игри. Всеки генератор се проверява с независима сметка,
// писана наново тук, а не с кода на самия генератор.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BANK_DEGREES, BANK_LABELS, CHOICE_SIGNS, ON_TARGET_SHARE, PITCH_LABELS, PITCH_OFFSET,
  QUARTER_LABELS, REFILL_BELOW, TRACK_WINDOW_MS,
  canRefill, choiceParams, instrumentParams, isRotationBy, makeChoiceTrial, makeInstrumentTask,
  makeMultitaskTrial, makePeripheralTrial, makeRotationTask, makeTimeTrial, makeTrackingPath, multitaskParams,
  peripheralParams, rotationParams, stateLabel, statePool, timeError, timeHit, timeSenseParams,
  trackPosition, trackingParams,
} from '../js/content/games/reflex.js';
import { SKILLS } from '../js/core/config.js';
import { TOTAL_STEPS, creatureIndex, difficultyCeiling, subIndex } from '../js/core/evolution.js';
import { validateGame } from '../js/core/registry.js';
import { MATH_TREE } from '../js/content/math/topics.js';
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

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 15, 21, 31];
const ROUNDS = 150;
const byId = Object.fromEntries(games.map((g) => [g.id, g]));
const NEW_IDS = ['choice-reaction', 'peripheral', 'instruments', 'time-sense', 'tracking', 'rotation', 'multitask'];

// --- Регистър, способности и отключване ---

test('седемте рефлекса спазват общия интерфейс и имат демонстрация', () => {
  for (const id of NEW_IDS) {
    const g = byId[id];
    assert.ok(g, `липсва модул ${id}`);
    assert.deepEqual(validateGame(g), [], id);
    assert.equal(g.category, 'reflex', id);
    assert.equal(typeof g.demo, 'function', id);
    assert.ok(g.description.length > 20, id);
    assert.ok(g.skills.every((s) => SKILLS.includes(s)), id);
  }
});

test('способностите на рефлексите следват спецификацията', () => {
  assert.deepEqual(byId['choice-reaction'].skills, ['speed', 'attention']);
  assert.deepEqual(byId.peripheral.skills, ['attention', 'speed']);
  assert.deepEqual(byId.instruments.skills, ['logic', 'speed']);
  assert.deepEqual(byId['time-sense'].skills, ['attention', 'memory']);
  assert.deepEqual(byId.tracking.skills, ['attention', 'speed']);
  assert.deepEqual(byId.rotation.skills, ['logic', 'memory']);
  assert.deepEqual(byId.multitask.skills, ['flexibility', 'attention']);
});

test('всяко същество до Вълк отключва поне едно нещо, и то на всяка стъпка', () => {
  const steps = [...new Set([
    ...games.map((g) => g.unlockStep),
    ...MATH_TREE.map((group) => group.unlockStep),
  ])].sort((a, b) => a - b);
  // Етап 6б запълва стълбата без дупки до Вълк I: всяка стъпка дотам носи своя награда.
  for (let step = 0; step <= 18; step += 1) {
    assert.ok(steps.includes(step), `стъпка ${step} остава без награда`);
  }
  // Всяко от първите седем същества получава нещо, и то на първата си подстепен или по-рано.
  for (let creature = 0; creature <= 6; creature += 1) {
    const own = steps.filter((s) => creatureIndex(s) === creature);
    assert.ok(own.length, `същество ${creature} не отключва нищо`);
  }
  // Новите игри не се трупат на една стъпка: всяка носи своя.
  const newSteps = NEW_IDS.map((id) => byId[id].unlockStep);
  assert.equal(new Set(newSteps).size, newSteps.length, `повтарящи се стъпки: ${newSteps}`);
  for (const step of newSteps) assert.ok(subIndex(step) >= 0 && step < 45);
});

// --- Избирателна реакция ---

test('избирателна реакция: посоките растат с трудността, а срокът се скъсява', () => {
  assert.deepEqual(CHOICE_SIGNS.slice(0, 2), ['left', 'right']);
  assert.equal(new Set(CHOICE_SIGNS).size, 4);
  assert.equal(choiceParams(1).options, 2);
  assert.equal(choiceParams(9).options, 4);
  for (const level of LEVELS.slice(1)) {
    assert.ok(choiceParams(level).options >= choiceParams(level - 1).options, `ниво ${level}`);
    assert.ok(choiceParams(level).limitMs <= choiceParams(level - 1).limitMs, `ниво ${level}`);
  }
  assert.ok(choiceParams(9).limitMs >= 420, 'срокът не става невъзможен');
});

test('избирателна реакция: светва само посока, която има бутон', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 13);
    const seen = new Set();
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeChoiceTrial(level, random);
      const { options, waitMin, waitMax, limitMs } = choiceParams(level);
      assert.equal(t.options, options);
      assert.ok(Number.isInteger(t.target) && t.target >= 0 && t.target < options, `${t.target} при ${options}`);
      assert.equal(t.limitMs, limitMs);
      assert.ok(t.waitMs >= waitMin && t.waitMs <= waitMax, `чакане ${t.waitMs}`);
      seen.add(t.target);
    }
    // Всички възможни посоки излизат: иначе бутон би стоял без работа.
    assert.equal(seen.size, choiceParams(level).options, `ниво ${level}: ${[...seen]}`);
  }
});

// --- Периферно внимание ---

test('периферно внимание: знакът е на едно място, а разсейващите са други', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 17);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makePeripheralTrial(level, random);
      const p = peripheralParams(level);
      assert.equal(t.slots, p.slots);
      assert.ok(t.target >= 0 && t.target < t.slots);
      assert.equal(t.distractors.length, Math.min(p.distractors, t.slots - 1));
      assert.equal(new Set(t.distractors).size, t.distractors.length, 'повтарящо се разсейващо място');
      for (const d of t.distractors) {
        assert.notEqual(d, t.target, 'разсейващото стои върху търсеното');
        assert.ok(d >= 0 && d < t.slots, `място ${d} извън ${t.slots}`);
      }
      assert.ok(t.center >= 2 && t.center <= 9 && Number.isInteger(t.center), `цифра ${t.center}`);
    }
  }
});

test('периферно внимание: повече места, по-кратък проблясък, по-далеч от средата', () => {
  for (const level of LEVELS.slice(1)) {
    const now = peripheralParams(level);
    const before = peripheralParams(level - 1);
    assert.ok(now.slots >= before.slots, `ниво ${level}`);
    assert.ok(now.flashMs <= before.flashMs, `ниво ${level}`);
    assert.ok(now.radius >= before.radius, `ниво ${level}`);
  }
  assert.ok(peripheralParams(9).flashMs >= 90, 'проблясъкът не става невидим');
  // Радиусът е дял от полето: над 0.5 знакът би излязъл извън него.
  assert.ok(peripheralParams(9).radius <= 0.46);
});

// --- Оценка на време ---

test('оценка на време: отрязъкът е в границите и е кратен на 100 ms', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 19);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeTimeTrial(level, random);
      const { minMs, maxMs, tolerance } = timeSenseParams(level);
      assert.equal(t.targetMs % 100, 0, `${t.targetMs}`);
      assert.ok(t.targetMs >= Math.round(minMs / 100) * 100 && t.targetMs <= maxMs, `${t.targetMs}`);
      assert.equal(t.tolerance, tolerance);
    }
  }
  assert.ok(timeSenseParams(9).tolerance < timeSenseParams(1).tolerance);
  assert.ok(timeSenseParams(9).tolerance >= 0.07, 'допускът не става невъзможен');
  assert.ok(timeSenseParams(9).maxMs > timeSenseParams(1).maxMs);
});

test('оценка на време: попадението се мери като дял от отрязъка, в двете посоки', () => {
  const trial = { targetMs: 2000, tolerance: 0.1 };
  // Независима сметка: 10% от 2000 ms са 200 ms в двете посоки.
  assert.equal(timeHit(trial, 1800), true);
  assert.equal(timeHit(trial, 2200), true);
  assert.equal(timeHit(trial, 1799), false);
  assert.equal(timeHit(trial, 2201), false);
  assert.equal(timeError(2000, 1500), 0.25);
  assert.equal(timeError(2000, 2500), 0.25);
  // Грешката не зависи от посоката, а допускът е дял, не милисекунди.
  assert.equal(timeHit({ targetMs: 1000, tolerance: 0.1 }, 1150), false);
  assert.equal(timeHit({ targetMs: 4000, tolerance: 0.1 }, 4150), true);
});

// --- Следене на цел ---

test('следене: целта стои в полето и се движи гладко', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 23);
    const path = makeTrackingPath(level, random);
    assert.equal(path.phase.length, 4);
    let previous = trackPosition(path, 0);
    for (let step = 1; step <= 2000; step += 1) {
      const t = step / 60; // по един кадър при 60 Hz
      const pos = trackPosition(path, t);
      assert.ok(pos.x >= 0.08 && pos.x <= 0.92, `x=${pos.x}`);
      assert.ok(pos.y >= 0.08 && pos.y <= 0.92, `y=${pos.y}`);
      // Гладко: за един кадър (60 Hz) целта минава под 6% от полето. Числото следва от
      // тавана на скоростта (0.9 оборота в секунда): по-голяма стъпка би била прескачане.
      assert.ok(Math.hypot(pos.x - previous.x, pos.y - previous.y) < 0.06, `скок при t=${t}`);
      previous = pos;
    }
    // Един и същ път дава един и същ резултат: иначе нищо не би било проверимо.
    assert.deepEqual(trackPosition(path, 1.5), trackPosition(path, 1.5));
  }
});

test('следене: по-висока трудност значи по-бърза цел и по-малък допуск', () => {
  for (const level of LEVELS.slice(1)) {
    assert.ok(trackingParams(level).speed >= trackingParams(level - 1).speed, `ниво ${level}`);
    assert.ok(trackingParams(level).tolerance <= trackingParams(level - 1).tolerance, `ниво ${level}`);
  }
  // Расте, докато стигне тавана, и спира там: иначе целта става неуловима.
  assert.ok(trackingParams(9).speed > trackingParams(1).speed);
  assert.equal(trackingParams(31).speed, trackingParams(21).speed);
  assert.ok(trackingParams(31).speed <= 0.9, 'целта не ускорява без край');
  assert.ok(trackingParams(9).tolerance >= 0.05, 'допускът не става невъзможен');
  assert.ok(ON_TARGET_SHARE > 0.5 && ON_TARGET_SHARE <= 1);
  assert.equal(TRACK_WINDOW_MS, 1000);
});

// --- Ориентация по прибори ---

const distance = (a, b) => Math.abs(a.bank - b.bank) + Math.abs(a.pitch - b.pitch);

test('прибори: състоянията са отклонени точно по толкова оси, колкото иска трудността', () => {
  // Независима сметка: 4 стойности × 2 оси при една ос, 4 × 4 при двете.
  assert.equal(statePool(false).length, 8);
  assert.equal(statePool(true).length, 16);
  for (const state of statePool(false)) {
    assert.equal((state.bank !== 0 ? 1 : 0) + (state.pitch !== 0 ? 1 : 0), 1, JSON.stringify(state));
  }
  for (const state of statePool(true)) {
    assert.notEqual(state.bank, 0);
    assert.notEqual(state.pitch, 0);
  }
  assert.equal(instrumentParams(1).pairs, false);
  assert.equal(instrumentParams(3).pairs, true);
  assert.equal(instrumentParams(5).nearMiss, true);
  assert.ok(instrumentParams(9).limitMs >= 1600, 'срокът не става невъзможен');
  assert.ok(instrumentParams(9).limitMs < instrumentParams(1).limitMs);
});

// Приборът показва обратното на самолета. Ако знакът се обърне, играчът ще се учи на
// огледален прибор, а задачата е точно да се чете истински авиохоризонт.
test('прибори: наклон надясно вдига десния край на хоризонта, нос нагоре го сваля', () => {
  assert.equal(BANK_DEGREES[0], 0);
  assert.equal(PITCH_OFFSET[0], 0);
  // В SVG положителният ъгъл върти по часовника, а y расте надолу.
  assert.ok(BANK_DEGREES[1] < 0 && BANK_DEGREES[2] < BANK_DEGREES[1], 'надясно трябва да е отрицателен ъгъл');
  assert.ok(BANK_DEGREES[-1] > 0 && BANK_DEGREES[-2] > BANK_DEGREES[-1], 'наляво трябва да е положителен ъгъл');
  assert.equal(BANK_DEGREES[1], -BANK_DEGREES[-1], 'двете посоки са симетрични');
  assert.equal(BANK_DEGREES[2], -BANK_DEGREES[-2]);
  // Нос нагоре → хоризонтът слиза (по-голямо y), нос надолу → хоризонтът се качва.
  assert.ok(PITCH_OFFSET[1] > 0 && PITCH_OFFSET[2] > PITCH_OFFSET[1], 'нос нагоре сваля хоризонта');
  assert.ok(PITCH_OFFSET[-1] < 0 && PITCH_OFFSET[-2] < PITCH_OFFSET[-1]);
  // Всяко състояние от басейна има и ъгъл, и отместване.
  for (const state of [...statePool(true), ...statePool(false)]) {
    assert.equal(typeof BANK_DEGREES[state.bank], 'number', JSON.stringify(state));
    assert.equal(typeof PITCH_OFFSET[state.pitch], 'number', JSON.stringify(state));
  }
});

test('прибори: четири различни описания и точно едно вярно', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 29);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeInstrumentTask(level, random);
      const { pairs, nearMiss } = instrumentParams(level);
      assert.equal(t.options.length, 4);
      assert.equal(t.labels.length, 4);
      // Два бутона с едно и също описание биха дали два верни отговора.
      assert.equal(new Set(t.labels).size, 4, `${t.labels}`);
      const answer = Number(t.answer);
      assert.deepEqual(t.options[answer], { bank: t.bank, pitch: t.pitch });
      // Независима сметка на описанието от самите стойности.
      const own = pairs ? `${BANK_LABELS[t.bank]}, ${PITCH_LABELS[t.pitch]}` : (t.bank !== 0 ? BANK_LABELS[t.bank] : PITCH_LABELS[t.pitch]);
      assert.equal(t.labels[answer], own);
      assert.equal(stateLabel({ bank: t.bank, pitch: t.pitch }, pairs), own);
      // Останалите три са други състояния от същия басейн.
      const pool = statePool(pairs);
      for (const [k, option] of t.options.entries()) {
        assert.ok(pool.some((s) => distance(s, option) === 0), JSON.stringify(option));
        if (k !== answer) assert.ok(distance(option, t.options[answer]) > 0, 'повторено състояние');
      }
      if (nearMiss) {
        // Разсейващите са най-близките състояния: сравнява се с подредените разстояния на всички.
        const all = pool.filter((s) => distance(s, t.options[answer]) > 0)
          .map((s) => distance(s, t.options[answer])).sort((a, b) => a - b).slice(0, 3);
        const picked = t.options.filter((_, k) => k !== answer)
          .map((s) => distance(s, t.options[answer])).sort((a, b) => a - b);
        assert.deepEqual(picked, all, `${level}: ${picked} вместо ${all}`);
      }
    }
  }
});

// --- Пространствена ротация ---

// Независима сметка: завъртане на 90° и нормализиране, писани наново тук.
function ownTurn(cells, times) {
  let out = cells;
  for (let i = 0; i < ((times % 4) + 4) % 4; i += 1) out = out.map(([x, y]) => [y, -x]);
  const minX = Math.min(...out.map(([x]) => x));
  const minY = Math.min(...out.map(([, y]) => y));
  return out.map(([x, y]) => [x - minX, y - minY])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

function ownConnected(cells) {
  const keys = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (keys.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}

test('ротация: верният отговор е точно казаното завъртане, а опциите са различни', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 31);
    for (let i = 0; i < 120; i += 1) {
      const t = makeRotationTask(level, random);
      const { grid, cells, quarters, limitMs } = rotationParams(level);
      assert.equal(t.grid, grid);
      assert.equal(t.shape.length, cells);
      assert.equal(t.limitMs, limitMs);
      assert.ok(quarters.includes(t.quarter), `${t.quarter} извън ${quarters}`);
      assert.ok(QUARTER_LABELS[t.quarter], `липсва име за ${t.quarter}`);
      assert.equal(t.options.length, 4);
      // Точно една опция е завъртането на фигурата с толкова деления.
      const fits = t.options.map((o, k) => (ownTurn(o, 0) === ownTurn(t.shape, t.quarter) ? k : -1)).filter((k) => k >= 0);
      assert.deepEqual(fits, [Number(t.answer)], `ниво ${level}: ${JSON.stringify(t)}`);
      assert.equal(isRotationBy(t.shape, t.options[Number(t.answer)], t.quarter), true);
      // Четирите опции са четирите завъртания и са различими помежду си.
      const drawn = t.options.map((o) => ownTurn(o, 0));
      assert.equal(new Set(drawn).size, 4, `дублирана опция: ${drawn}`);
      const turns = new Set([0, 1, 2, 3].map((q) => ownTurn(t.shape, q)));
      assert.equal(turns.size, 4, 'симетрична фигура: отговорът не би бил един');
      for (const key of drawn) assert.ok(turns.has(key), `опция, която не е завъртане: ${key}`);
      // Фигурата е свързана и стои в мрежата, иначе се чете трудно.
      assert.ok(ownConnected(t.shape), JSON.stringify(t.shape));
      for (const option of [t.shape, ...t.options]) {
        assert.equal(option.length, cells);
        for (const [x, y] of option) assert.ok(x >= 0 && y >= 0 && x < grid && y < grid, `${x},${y} извън ${grid}`);
      }
    }
  }
});

test('ротация: мрежата расте, срокът пада, а деленията се добавят', () => {
  assert.deepEqual(rotationParams(1).quarters, [1]);
  assert.deepEqual(rotationParams(9).quarters, [1, 2, 3]);
  assert.ok(rotationParams(9).grid >= rotationParams(1).grid);
  assert.ok(rotationParams(9).cells > rotationParams(1).cells);
  assert.ok(rotationParams(9).limitMs >= 3000, 'срокът не става невъзможен');
  for (const level of LEVELS.slice(1)) {
    assert.ok(rotationParams(level).limitMs <= rotationParams(level - 1).limitMs, `ниво ${level}`);
  }
});

// --- Многозадачност ---

test('многозадачност: пълен резервоар не се пълни', () => {
  assert.equal(REFILL_BELOW, 0.5);
  assert.equal(canRefill(1), false);
  assert.equal(canRefill(0.5), false);
  assert.equal(canRefill(0.49), true);
  assert.equal(canRefill(0), true);
});

test('многозадачност: стрелката е наляво или надясно, а изтичането расте', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 37);
    const seen = new Set();
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeMultitaskTrial(level, random);
      const { limitMs, gapMin, gapMax } = multitaskParams(level);
      assert.ok(['left', 'right'].includes(t.sign), t.sign);
      assert.equal(t.limitMs, limitMs);
      assert.ok(t.waitMs >= gapMin && t.waitMs <= gapMax, `пауза ${t.waitMs}`);
      seen.add(t.sign);
    }
    assert.equal(seen.size, 2, `ниво ${level}: само ${[...seen]}`);
  }
  for (const level of LEVELS.slice(1)) {
    assert.ok(multitaskParams(level).drainPerSec >= multitaskParams(level - 1).drainPerSec, `ниво ${level}`);
    assert.ok(multitaskParams(level).limitMs <= multitaskParams(level - 1).limitMs, `ниво ${level}`);
  }
  assert.ok(multitaskParams(9).drainPerSec > multitaskParams(1).drainPerSec);
  assert.ok(multitaskParams(9).limitMs >= 900, 'срокът не става невъзможен');
  // Резервоарът издържа поне три секунди и на най-високата трудност: иначе играта би била само той.
  assert.ok(1 / multitaskParams(9).drainPerSec >= 3, 'резервоарът пресъхва прекалено бързо');
});

// --- Общи правила ---

// Таванът на трудността расте със стълбата: на Мъдрец III играта иска ниво 31.
// Всеки генератор трябва да дава смислена задача и там, а не само на ниските нива.
test('генераторите издържат до най-високата трудност, която играта може да поиска', () => {
  const top = difficultyCeiling(TOTAL_STEPS - 1);
  assert.equal(top, 31);
  const random = seeded(4242);
  for (const level of [top - 1, top, top + 5]) {
    const choice = makeChoiceTrial(level, random);
    assert.ok(choice.target < choice.options && choice.limitMs >= 420 && choice.waitMs > 0, 'избирателна реакция');

    const pf = makePeripheralTrial(level, random);
    assert.ok(pf.distractors.length < pf.slots && pf.flashMs >= 90 && pf.radius <= 0.46, 'периферно внимание');
    assert.ok(!pf.distractors.includes(pf.target));

    const ts = makeTimeTrial(level, random);
    assert.ok(ts.targetMs >= 1200 && ts.targetMs <= 6000 && ts.tolerance >= 0.07, 'оценка на време');

    const track = trackingParams(level);
    assert.ok(track.tolerance >= 0.05 && track.speed > 0 && track.speed <= 0.9 && track.wobble <= 0.6, 'следене');
    const pos = trackPosition(makeTrackingPath(level, random), 3.3);
    assert.ok(pos.x >= 0.08 && pos.x <= 0.92 && pos.y >= 0.08 && pos.y <= 0.92, 'следене: позиция в полето');

    const inst = makeInstrumentTask(level, random);
    assert.equal(new Set(inst.labels).size, 4, 'прибори: описанията остават различни');
    assert.ok(inst.limitMs >= 1600);

    const rot = makeRotationTask(level, random);
    assert.equal(rot.options.length, 4, 'ротация');
    assert.equal(isRotationBy(rot.shape, rot.options[Number(rot.answer)], rot.quarter), true);
    assert.ok(rot.limitMs >= 3000);

    const mt = makeMultitaskTrial(level, random);
    assert.ok(mt.limitMs >= 900 && mt.waitMs > 0, 'многозадачност');
    const fuel = multitaskParams(level);
    assert.ok(fuel.drainPerSec <= 0.26 && fuel.gapMin <= fuel.gapMax, 'многозадачност: резервоар');
  }
});


test('рефлексите не разчитат на цвят в самите задачи', () => {
  const src = readFileSync(new URL('../js/content/games/reflex.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(red|blue|green|yellow|color)\b/i, 'цвят в генераторите на рефлексите');
});

test('игрите без време за реакция не докладват милисекунди', () => {
  const src = (id) => readFileSync(new URL(`../js/modules/${id}.js`, import.meta.url), 'utf8');
  // „Оценка на време“ и „Следене на цел“ мерят отклонение и дял от секундата, не реакция.
  for (const id of ['time-sense', 'tracking']) assert.match(src(id), /reportsRT: false/, id);
  for (const id of ['choice-reaction', 'peripheral', 'instruments', 'rotation', 'multitask']) {
    assert.doesNotMatch(src(id), /reportsRT: false/, id);
  }
});

test('калибрирането покрива и седемте нови игри', () => {
  const rows = calibrateAllGames({ startLevel: 4 });
  const covered = new Map(rows.map((r) => [r.id, r]));
  for (const id of NEW_IDS) {
    const row = covered.get(id);
    assert.ok(row, `${id} не е в npm run calibrate`);
    assert.ok(row.quality > 0.75 && row.quality < 0.85, `${id}: успех ${row.quality}`);
    assert.ok(Math.abs(row.settledMean - 4) <= 1, `${id}: застана на ${row.settledMean}`);
    assert.ok(row.settledSd < 1.5, `${id}: клатене ±${row.settledSd}`);
    assert.ok(row.trials >= 10, `${id}: само ${row.trials} опита на сесия`);
  }
});
