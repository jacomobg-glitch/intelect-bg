// Симулиран играч с реалистичен профил. Не е част от приложението: ползва се от тестовете
// (tests/calibration.test.mjs) и от `npm run calibrate`, за да се види как се държи staircase с човек.
//
// Моделът е умишлено прост и описан с числа, които могат да се сверят с реални данни:
//   - време за реакция 250–450 ms, около 310 ms средно, по-бавно при по-висока трудност;
//   - около 15% грешки на „своята“ трудност, повече при по-висока;
//   - разсейване: рядък опит с време далеч над срока, който играта брои като пропуск;
//   - умора: след 3 минути точността пада и времената се разтягат.
import { CONFIG } from '../js/core/config.js';
import { quickParams, simonParams, sortParams, swapParams } from '../js/content/games/generators.js';
import { TrialLog, staircaseTarget } from '../js/modules/shared/trial-log.js';
import { goNoGoParams } from '../js/modules/go-nogo.js';
import { SPEED_LIMIT_MS as LOGIC_LIMIT_MS } from '../js/modules/logic.js';
import { SPEED_LIMIT_MS as MIRROR_LIMIT_MS } from '../js/modules/mirror.js';
import { limitFor as oddLimit } from '../js/modules/odd-one-out.js';
import { INPUT_LIMIT_MS as SEQ_LIMIT_MS } from '../js/modules/sequence.js';
import { reactionParams } from '../js/modules/simple-reaction.js';
import { stroopParams } from '../js/modules/stroop.js';
import { ANSWER_LIMIT_MS as SWAP_LIMIT_MS } from '../js/modules/swapped.js';

export const RT_RANGE = [250, 450];      // границите, в които стоят времената без разсейване
export const BASE_ACCURACY = 0.85;       // 15% грешки на „своята“ трудност
export const ACCURACY_PER_LEVEL = 0.12;  // колко точност се губи на стъпка трудност нагоре
export const FATIGUE_AFTER_MS = 180000;  // умората започва след 3 минути
export const LAPSE_RATE = 0.05;          // дял разсеяни опити

// Детерминиран генератор (xorshift32): тестът трябва да дава един и същ резултат всеки път.
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// Приблизително нормално разпределение от сумата на три равномерни числа.
const gauss = (random) => (random() + random() + random() - 1.5) * 1.1;

// Колко умора има в момента t: 0 преди FATIGUE_AFTER_MS, после расте и спира на 1.
export const fatigueAt = (elapsedMs, span = 420000) => clamp((elapsedMs - FATIGUE_AFTER_MS) / span, 0, 1);

// Вероятност за верен отговор при дадена трудност. ability е трудността, на която играчът
// прави около 15% грешки. Умората отнема до 12 процентни пункта.
export function accuracyAt(level, ability, fatigue = 0) {
  return clamp(BASE_ACCURACY - ACCURACY_PER_LEVEL * (level - ability) - 0.12 * fatigue, 0.02, 0.98);
}

// Време за реакция в ms. Разсейването дава време далеч над границата: играта го брои като пропуск.
export function reactionAt(level, ability, fatigue, random) {
  if (random() < LAPSE_RATE) return 600 + random() * 800;
  const base = 310 + 28 * (level - ability) + 60 * fatigue + gauss(random) * 45;
  return clamp(base, ...RT_RANGE);
}

// Една сесия. limitMs е срокът за отговор в играта (под него отговорът е „верен“).
// Връща дневника плюс пътя на трудността, за да се види дали се стабилизира.
export function playSession({
  ability = 4,
  maxLevel = 9,
  startLevel = 1,
  runMs = 60000,
  limitMs = 900,
  gapMs = 700,
  seed = 1,
  up = CONFIG.STAIRCASE_UP,
} = {}) {
  const random = seeded(seed);
  const log = new TrialLog({ startLevel, maxLevel, up });
  const levels = [];
  let elapsed = 0;
  while (elapsed < runMs) {
    const fatigue = fatigueAt(elapsed);
    const rt = reactionAt(log.level, ability, fatigue, random);
    levels.push(log.level);
    if (rt > limitMs) log.error('miss');
    else if (random() < accuracyAt(log.level, ability, fatigue)) log.correct({ rt, limit: limitMs });
    else log.error('wrong');
    elapsed += gapMs + Math.min(rt, limitMs);
  }
  return { log, levels, trials: levels.length };
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

// Обобщава няколко сесии: къде застава трудността и колко се клати.
// settled е втората половина на пътя: първата е изкачването от startLevel.
export function calibrate(options = {}, runs = 40) {
  const stats = [];
  for (let i = 0; i < runs; i += 1) {
    const { log, levels } = playSession({ ...options, seed: i * 7919 + 13 });
    const settled = levels.slice(Math.floor(levels.length / 2));
    stats.push({
      quality: log.quality(),
      settledMean: mean(settled),
      settledSd: sd(settled),
      meanRT: log.meanRT(),
      trials: levels.length,
    });
  }
  return {
    runs,
    quality: mean(stats.map((s) => s.quality)),
    settledMean: mean(stats.map((s) => s.settledMean)),
    settledSd: mean(stats.map((s) => s.settledSd)),
    worstSd: Math.max(...stats.map((s) => s.settledSd)),
    meanRT: mean(stats.map((s) => s.meanRT)),
    trials: mean(stats.map((s) => s.trials)),
  };
}


// --- Профили на отделните игри ---
// Срокът за отговор и паузата между опитите идват от самите модули, не се преписват тук.
// Така калибрирането следва истинските числа и се чупи, ако някой ги промени.
export const GAME_PROFILES = [
  { id: 'stroop', title: 'Stroop', limit: (l) => stroopParams(l).limit, gapMs: 450, runMs: 60000 },
  { id: 'simple-reaction', title: 'Проста реакция', limit: (l) => reactionParams(l).deadline, gapMs: 2200, runMs: 45000 },
  { id: 'go-nogo', title: 'Go / No-Go', limit: (l) => goNoGoParams(l).duration, gapMs: 1000, runMs: 60000 },
  { id: 'fireflies', title: 'Светулки', limit: (l) => Math.max(450, 1500 - 70 * (l - 1)), gapMs: 1050, runMs: 60000 },
  { id: 'logic', title: 'Логически редици', limit: () => LOGIC_LIMIT_MS, gapMs: 800, runMs: 240000 },
  { id: 'odd-one-out', title: 'Различното', limit: (l) => oddLimit(l), gapMs: 550, runMs: 60000 },
  { id: 'swapped', title: 'Разменени неща', limit: () => SWAP_LIMIT_MS, gapMs: (l) => swapParams(l).studyMs + 1200, runMs: 90000 },
  { id: 'quick-math', title: 'Бърза сметка', limit: (l) => quickParams(l).limitMs, gapMs: 450, runMs: 60000 },
  { id: 'sequence', title: 'Цветни последователности', limit: () => SEQ_LIMIT_MS, gapMs: (l) => simonParams(l).length * (simonParams(l).showMs + simonParams(l).gapMs) + 1400, runMs: 120000 },
  { id: 'mirror', title: 'Огледални фигури', limit: () => MIRROR_LIMIT_MS, gapMs: 900, runMs: 240000 },
  { id: 'sorting', title: 'Сортиране по правило', limit: (l) => sortParams(l).limitMs, gapMs: 600, runMs: 90000 },
];

// Една игра, изиграна от симулирания човек със собствените ѝ срокове.
// startLevel: 1 е първа сесия, а ability е завърналият се играч, който продължава от lastDifficulty.
export function calibrateGame(profile, { ability = 4, maxLevel = 9, runs = 30, startLevel = 1 } = {}) {
  const stats = [];
  for (let i = 0; i < runs; i += 1) {
    const random = seeded(i * 6151 + 29);
    const log = new TrialLog({ startLevel, maxLevel });
    const levels = [];
    let elapsed = 0;
    const runMs = profile.runMs;
    while (elapsed < runMs) {
      const fatigue = fatigueAt(elapsed);
      const limitMs = profile.limit(log.level);
      const gapMs = typeof profile.gapMs === 'function' ? profile.gapMs(log.level) : profile.gapMs;
      const rt = reactionAt(log.level, ability, fatigue, random);
      levels.push(log.level);
      if (rt > limitMs) log.error('miss');
      else if (random() < accuracyAt(log.level, ability, fatigue)) log.correct({ rt, limit: limitMs });
      else log.error('wrong');
      elapsed += gapMs + Math.min(rt, limitMs);
    }
    const settled = levels.slice(Math.floor(levels.length / 2));
    stats.push({
      quality: log.quality(),
      settledMean: mean(settled),
      settledSd: sd(settled),
      trials: levels.length,
    });
  }
  return {
    id: profile.id,
    title: profile.title,
    trials: mean(stats.map((x) => x.trials)),
    quality: mean(stats.map((x) => x.quality)),
    settledMean: mean(stats.map((x) => x.settledMean)),
    settledSd: mean(stats.map((x) => x.settledSd)),
    worstSd: Math.max(...stats.map((x) => x.settledSd)),
  };
}

export const calibrateAllGames = (options) => GAME_PROFILES.map((p) => calibrateGame(p, options));

// npm run calibrate: таблица за различни способности и дължини на сесията.
function printTable() {
  const target = staircaseTarget();
  console.log(`Staircase: ${CONFIG.STAIRCASE_UP} верни нагоре, 1 грешка надолу. Целеви успех: ${(target * 100).toFixed(1)}%\n`);
  console.log('ability  сесия   опити  успех   трудност (2-ра половина)  клатене  средно RT');
  for (const ability of [2, 4, 6]) {
    for (const runMs of [60000, 180000, 420000]) {
      const r = calibrate({ ability, runMs, maxLevel: 9 });
      console.log([
        String(ability).padStart(6),
        `${(runMs / 60000).toFixed(0)} мин`.padStart(8),
        r.trials.toFixed(0).padStart(6),
        `${(r.quality * 100).toFixed(1)}%`.padStart(7),
        r.settledMean.toFixed(2).padStart(24),
        `±${r.settledSd.toFixed(2)}`.padStart(9),
        `${r.meanRT.toFixed(0)} ms`.padStart(10),
      ].join(''));
    }
  }

  // Завърналият се играч продължава от lastDifficulty, затова startLevel е способността му.
  // Първата сесия на нова игра започва от 1 и затова изглежда по-лесна: staircase още се качва.
  const first = new Map(calibrateAllGames({ startLevel: 1 }).map((r) => [r.id, r]));
  console.log('\nПо игри (способност 4, таван 9, 30 сесии всяка):');
  console.log('игра                        опити  1-ва сесия  после  трудност  клатене  най-лошо');
  for (const row of calibrateAllGames({ startLevel: 4 })) {
    console.log([
      row.title.slice(0, 26).padEnd(28),
      row.trials.toFixed(0).padStart(5),
      `${(first.get(row.id).quality * 100).toFixed(1)}%`.padStart(12),
      `${(row.quality * 100).toFixed(1)}%`.padStart(7),
      row.settledMean.toFixed(2).padStart(10),
      `\u00b1${row.settledSd.toFixed(2)}`.padStart(9),
      `\u00b1${row.worstSd.toFixed(2)}`.padStart(10),
    ].join(''));
  }
}

if (process.argv[1] && process.argv[1].endsWith('sim-player.mjs')) {
  printTable();
}
