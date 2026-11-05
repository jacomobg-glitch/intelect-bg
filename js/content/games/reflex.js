// Генератори за рефлексите от Етап 6б. Чисти функции без DOM: random се подава отвън,
// затова всяка задача се проверява директно в тестовете, независимо от кода на играта.
// Всяка задача с опции гарантира ЕДИНСТВЕН верен отговор и различими опции.
import { isConnected, keyOf, normalize, pickOne, randomShape, rotations, shuffle } from './generators.js';

const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// --- Избирателна реакция (Скорост, Внимание) ---

// Редът е нарочен: при две опции остават само наляво и надясно, които не се бъркат.
export const CHOICE_SIGNS = ['left', 'right', 'up', 'down'];

export const choiceParams = (level) => ({
  options: level <= 1 ? 2 : level <= 3 ? 3 : 4,
  limitMs: Math.max(420, 1150 - 85 * (level - 1)),
  waitMin: 450,
  waitMax: Math.max(900, 1900 - 80 * (level - 1)),
});

export function makeChoiceTrial(level, random) {
  const { options, limitMs, waitMin, waitMax } = choiceParams(level);
  return {
    options,
    target: int(random, 0, options - 1),
    limitMs,
    waitMs: waitMin + random() * (waitMax - waitMin),
  };
}

// --- Периферно внимание (Внимание, Скорост) ---

export const peripheralParams = (level) => ({
  slots: level <= 2 ? 4 : level <= 4 ? 6 : 8,
  flashMs: Math.max(90, 330 - 40 * (level - 1)),
  // Дял от по-малката страна на полето: колкото по-навън е знакът, толкова по-периферен е.
  radius: Math.min(0.46, 0.24 + 0.035 * level),
  distractors: Math.max(0, level - 3),
});

// Знакът светва на едно място, а разсейващите са други места с ДРУГА форма:
// търсеното е запълненото, затова отговорът остава единствен.
export function makePeripheralTrial(level, random) {
  const { slots, flashMs, radius, distractors } = peripheralParams(level);
  const target = int(random, 0, slots - 1);
  const rest = shuffle(Array.from({ length: slots }, (_, i) => i).filter((i) => i !== target), random);
  return {
    slots,
    target,
    distractors: rest.slice(0, Math.min(distractors, slots - 1)),
    flashMs,
    radius,
    // Цифрата в средата се сменя всеки опит, за да има погледът защо да стои там.
    center: int(random, 2, 9),
  };
}

// --- Оценка на време (Внимание, Памет) ---

export const timeSenseParams = (level) => ({
  // Допустима грешка като дял от показания отрязък: от 26% надолу до 7%.
  tolerance: Math.max(0.07, 0.26 - 0.035 * (level - 1)),
  minMs: 1200,
  maxMs: Math.min(6000, 2400 + 600 * level),
});

export function makeTimeTrial(level, random) {
  const { minMs, maxMs, tolerance } = timeSenseParams(level);
  // Кратните на 100 ms са достатъчно ситни, а и числото остава четимо.
  return { targetMs: Math.round((minMs + random() * (maxMs - minMs)) / 100) * 100, tolerance };
}

export const timeError = (targetMs, producedMs) => Math.abs(producedMs - targetMs) / targetMs;
export const timeHit = (trial, producedMs) => timeError(trial.targetMs, producedMs) <= trial.tolerance;

// --- Следене на цел (Внимание, Скорост) ---

export const TRACK_WINDOW_MS = 1000;   // прозорец, който се брои за един опит
export const ON_TARGET_SHARE = 0.7;    // колко от прозореца трябва да е върху целта

export const trackingParams = (level) => ({
  speed: Math.min(0.9, 0.2 + 0.055 * (level - 1)),        // обороти в секунда, с таван
  tolerance: Math.max(0.05, 0.14 - 0.012 * (level - 1)),  // дял от по-малката страна
  wobble: Math.min(0.6, 0.12 + 0.06 * (level - 1)),
});

// Пътят е сбор от синуси: гладък, без скокове и повторяем за даден random.
export function makeTrackingPath(level, random) {
  const { speed, wobble } = trackingParams(level);
  return {
    speed,
    wobble,
    phase: Array.from({ length: 4 }, () => random() * Math.PI * 2),
  };
}

// Позиция в дялове от полето. Границите пазят целта далеч от ръбовете,
// за да не се лови лесно в някой ъгъл.
export function trackPosition(path, tSec) {
  const w = path.speed * tSec * Math.PI * 2;
  const x = 0.5 + 0.32 * Math.sin(w + path.phase[0]) + path.wobble * 0.11 * Math.sin(w * 2.3 + path.phase[1]);
  const y = 0.5 + 0.28 * Math.cos(w * 0.8 + path.phase[2]) + path.wobble * 0.11 * Math.sin(w * 1.7 + path.phase[3]);
  return { x: clamp(x, 0.08, 0.92), y: clamp(y, 0.08, 0.92) };
}

// --- Ориентация по прибори (Логика, Скорост) ---

export const BANK_LABELS = Object.freeze({
  '-2': 'силен наклон наляво',
  '-1': 'наклон наляво',
  0: 'без наклон',
  1: 'наклон надясно',
  2: 'силен наклон надясно',
});

export const PITCH_LABELS = Object.freeze({
  '-2': 'нос силно надолу',
  '-1': 'нос надолу',
  0: 'нос на хоризонта',
  1: 'нос нагоре',
  2: 'нос силно нагоре',
});

// Как се рисува приборът. Числата живеят тук, при останалата логика на играта, за да
// може посоката им да се провери с тест: js/modules/shared/glyphs.js само ги ползва.
// Хоризонтът се върти ОБРАТНО на самолета: при наклон надясно десният край на хоризонта
// се ВДИГА. В SVG y расте надолу, затова „надясно“ е отрицателен ъгъл.
export const BANK_DEGREES = Object.freeze({ '-2': 45, '-1': 20, 0: 0, 1: -20, 2: -45 });

// Нос нагоре сваля хоризонта надолу в прибора – точно както се вижда през пилотската кабина.
export const PITCH_OFFSET = Object.freeze({ '-2': -22, '-1': -11, 0: 0, 1: 11, 2: 22 });

export const instrumentParams = (level) => ({
  limitMs: Math.max(1600, 4200 - 320 * (level - 1)),
  // От трета трудност наклонът и носът се четат заедно, не поединично.
  pairs: level >= 3,
  // От пета трудност разсейващите опции са най-близките, не случайни.
  nearMiss: level >= 5,
});

// При една отклонена ос името е само нейното: така отговорът е кратък и еднозначен.
export const stateLabel = ({ bank, pitch }, pairs) => {
  if (pairs) return `${BANK_LABELS[bank]}, ${PITCH_LABELS[pitch]}`;
  return bank !== 0 ? BANK_LABELS[bank] : PITCH_LABELS[pitch];
};

const AXIS_VALUES = [-2, -1, 0, 1, 2];

// Всички състояния за дадената трудност: при pairs и двете оси са отклонени,
// иначе е отклонена точно една. „Право и равно“ не влиза: то не е задача.
export function statePool(pairs) {
  const out = [];
  for (const bank of AXIS_VALUES) {
    for (const pitch of AXIS_VALUES) {
      const deviations = (bank !== 0 ? 1 : 0) + (pitch !== 0 ? 1 : 0);
      if (deviations === (pairs ? 2 : 1)) out.push({ bank, pitch });
    }
  }
  return out;
}

const stateDistance = (a, b) => Math.abs(a.bank - b.bank) + Math.abs(a.pitch - b.pitch);

export function makeInstrumentTask(level, random) {
  const { pairs, nearMiss, limitMs } = instrumentParams(level);
  const pool = statePool(pairs);
  const answerState = pickOne(random, pool);
  const others = pool.filter((s) => stateDistance(s, answerState) > 0);
  // При nearMiss разсейващите са най-близките състояния: разликата е едно деление.
  const picked = nearMiss
    ? shuffle(others, random).sort((a, b) => stateDistance(a, answerState) - stateDistance(b, answerState)).slice(0, 3)
    : shuffle(others, random).slice(0, 3);
  const options = shuffle([answerState, ...picked], random);
  return {
    bank: answerState.bank,
    pitch: answerState.pitch,
    pairs,
    options,
    labels: options.map((o) => stateLabel(o, pairs)),
    answer: String(options.indexOf(answerState)),
    limitMs,
  };
}

// --- Пространствена ротация (Логика, Памет) ---

export const rotationParams = (level) => ({
  grid: level <= 2 ? 3 : 4,
  cells: Math.min(level <= 2 ? 5 : 8, 3 + level),
  limitMs: Math.max(3000, 9000 - 700 * (level - 1)),
  // На колко деления от 90° се върти фигурата.
  quarters: level <= 1 ? [1] : level <= 3 ? [1, 3] : [1, 2, 3],
});

// Завъртането rotate90 е (x, y) → (y, −x). На екрана y расте надолу, затова
// едно деление изглежда като 90° наляво (обратно на часовника).
export const QUARTER_LABELS = Object.freeze({ 1: '90° наляво', 2: '180°', 3: '90° надясно' });

export const rotateTimes = (cells, times) => rotations(cells)[((times % 4) + 4) % 4];

// Четирите завъртания са опциите: едно е търсеното, останалите три са другите завъртания,
// включително самата непроменена фигура. Симетрична фигура се отхвърля – там отговорът не е един.
export function makeRotationTask(level, random) {
  const { grid, cells: count, quarters, limitMs } = rotationParams(level);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const shape = randomShape(grid, count, random);
    if (shape.length < count || !isConnected(shape)) continue;
    const rots = rotations(shape);
    if (new Set(rots.map(keyOf)).size !== 4) continue;
    const quarter = pickOne(random, quarters);
    const right = rots[quarter];
    const options = shuffle([right, ...rots.filter((_, i) => i !== quarter)], random);
    return {
      grid,
      quarter,
      shape: normalize(shape),
      options: options.map(normalize),
      answer: String(options.indexOf(right)),
      limitMs,
    };
  }
  throw new Error('Неуспешна фигура за ротация');
}

// Независима проверка: опцията е точно завъртането на фигурата с толкова деления.
export const isRotationBy = (shape, candidate, quarter) => keyOf(rotateTimes(shape, quarter)) === keyOf(candidate);

// --- Многозадачност (Гъвкавост, Внимание) ---

export const REFILL_BELOW = 0.5; // пълен резервоар не се пълни: това е грешно натискане

export const multitaskParams = (level) => ({
  limitMs: Math.max(900, 2200 - 160 * (level - 1)),
  gapMin: Math.max(500, 1400 - 90 * (level - 1)),
  gapMax: Math.max(900, 2600 - 140 * (level - 1)),
  // Колко от резервоара изтича за секунда: от 12% до 26%. Таванът е нарочен – при повече
  // от това цялата игра би станала „пълни резервоара“, а стрелките не биха имали време.
  drainPerSec: Math.min(0.26, 0.12 + 0.02 * (level - 1)),
});

export const canRefill = (fuel) => fuel < REFILL_BELOW;

export function makeMultitaskTrial(level, random) {
  const { limitMs, gapMin, gapMax } = multitaskParams(level);
  return {
    sign: pickOne(random, ['left', 'right']),
    limitMs,
    waitMs: gapMin + random() * (gapMax - gapMin),
  };
}
