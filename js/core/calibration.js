// Отчет за калибриране: сборните числа от записите на ЕДИН профил и препоръката,
// която се вади от тях. Чисти функции без DOM, за да се тестват в Node и да се ползват
// и от `npm run calibrate -- --from <файл>`.
//
// Правилото на отчета: КОЛКО, никога КОГА. Няма дати, часове, история по дни и серии —
// само суми и броячи. Отчетът излиза от устройството единствено ако човекът го копира сам.
import { CONFIG, SKILLS, SKILL_LABELS } from './config.js';
import { INPUT_KINDS, INPUT_LABELS } from './stats.js';
import { FEELS, FEEL_LABELS, emptyCalib } from './model.js';
import { levelFromXP } from './evolution.js';

// Колко данни са нужни, преди препоръката изобщо да значи нещо.
export const ENOUGH = Object.freeze({
  trials: 200,      // общо опити за препоръка за STAIRCASE_UP
  gameTrials: 60,   // опити в една игра, за да се брои нейният ред
  obstacles: 10,    // смени на препятствието за препоръка за SKILL_SHARE_THRESHOLD
  feels: 10,        // оценки „как беше“ за препоръка за FEEL_SHIFT
});

// Средно и разсейване от суми, без да се пазят самите опити.
// Разсейването е извадково (делим на n−1): един опит не казва нищо за разпръснатостта.
export function fromSums(box) {
  if (!box || !box.n) return { n: 0, mean: null, sd: null };
  const mean = box.sum / box.n;
  if (box.n < 2) return { n: box.n, mean, sd: null };
  // max(0, …) пази от отрицателно под корена при закръгляне на големи суми.
  const variance = Math.max(0, (box.sumSq - box.n * mean * mean) / (box.n - 1));
  return { n: box.n, mean, sd: Math.sqrt(variance) };
}

const ratio = (part, whole) => (whole > 0 ? part / whole : null);
const round = (x, digits = 2) => (x === null || x === undefined ? null : Number(x.toFixed(digits)));

function gameRow(record, titles) {
  const c = record.calib || emptyCalib();
  const rt = {};
  for (const kind of INPUT_KINDS) {
    const stats = fromSums(c.rt[kind]);
    if (stats.n) rt[kind] = { n: stats.n, mean: round(stats.mean, 1), sd: round(stats.sd, 1) };
  }
  return {
    id: record.id,
    title: titles[record.id] || record.id,
    sessions: c.sessions,
    trials: c.trials,
    correct: c.correct,
    wrong: c.wrong,
    misses: c.misses,
    premature: c.premature,
    accuracy: round(ratio(c.correct, c.trials), 4),
    meanLevel: round(ratio(c.levelSum, c.levelTrials), 2),
    lastDifficulty: record.lastDifficulty,
    bestScore: record.bestScore,
    rt,
    feels: { ...c.feels },
  };
}

// titles: id → заглавие на модула. Подава се отвън, за да остане този файл без зависимост
// от регистъра и да може тестът да го вика с каквото иска.
export function buildCalibration({ version, profile, records, titles = {}, config = CONFIG }) {
  const games = records
    .map((r) => gameRow(r, titles))
    .filter((g) => g.sessions > 0)
    .sort((a, b) => b.trials - a.trials || a.id.localeCompare(b.id));

  const sum = (key) => games.reduce((acc, g) => acc + g[key], 0);
  const feels = Object.fromEntries(FEELS.map((f) => [f, games.reduce((acc, g) => acc + g.feels[f], 0)]));
  const trials = sum('trials');
  const correct = sum('correct');

  return {
    kind: 'calibration',
    version: version || null,
    config: {
      staircaseUp: config.STAIRCASE_UP,
      skillShareThreshold: config.SKILL_SHARE_THRESHOLD,
      skillShareRange: [...config.SKILL_SHARE_RANGE],
      feelShift: config.FEEL_SHIFT,
    },
    profile: {
      step: profile.step,
      totalXP: Math.round(profile.totalXP),
      skillXP: Object.fromEntries(SKILLS.map((s) => [s, Math.round(profile.skillXP[s])])),
      levels: Object.fromEntries(SKILLS.map((s) => [s, levelFromXP(profile.skillXP[s])])),
      obstacles: Object.fromEntries(SKILLS.map((s) => [s, (profile.obstacles || {})[s] || 0])),
    },
    games,
    totals: {
      sessions: sum('sessions'),
      trials,
      correct,
      accuracy: round(ratio(correct, trials), 4),
      feels,
    },
  };
}

// --- препоръка ---

// Колко верни отговора иска staircase, за да вдигне трудността. Границите идват от целевия
// успех 0.5^(1/N): при 2 това са 70.7%, при 3 — 79.4%, при 4 — 84.1%. Между тях стои сива
// зона, в която числото се оставя както е: дребна разлика не оправдава смяна.
export function staircaseFor(accuracy) {
  if (accuracy === null || accuracy === undefined) return null;
  if (accuracy < 0.70) return 2;
  if (accuracy < 0.75) return null;
  if (accuracy <= 0.85) return 3;
  if (accuracy <= 0.88) return null;
  return 4;
}

const percent = (x) => (x === null ? '–' : `${(x * 100).toFixed(1)}%`);

function staircaseAdvice(report) {
  const now = report.config.staircaseUp;
  const { trials, accuracy } = report.totals;
  if (trials < ENOUGH.trials) {
    return {
      key: 'STAIRCASE_UP',
      now,
      suggested: now,
      enough: false,
      reason: `Само ${trials} опита общо. Препоръката иска поне ${ENOUGH.trials}.`,
    };
  }
  const suggested = staircaseFor(accuracy);
  if (suggested === null) {
    return {
      key: 'STAIRCASE_UP',
      now,
      suggested: now,
      enough: true,
      reason: `Успехът е ${percent(accuracy)} — в сивата зона между две стойности. Остава ${now}.`,
    };
  }
  if (suggested === now) {
    return {
      key: 'STAIRCASE_UP',
      now,
      suggested: now,
      enough: true,
      reason: `Успехът е ${percent(accuracy)} при ${trials} опита: точно каквото ${now} цели.`,
    };
  }
  const direction = suggested > now ? 'твърде лесно' : 'твърде трудно';
  return {
    key: 'STAIRCASE_UP',
    now,
    suggested,
    enough: true,
    reason: `Успехът е ${percent(accuracy)} при ${trials} опита: ${direction}. ${suggested} връща целта към ${percent(0.5 ** (1 / suggested))}.`,
  };
}

function thresholdAdvice(report) {
  const now = report.config.skillShareThreshold;
  const [lo, hi] = report.config.skillShareRange;
  const obstacles = report.profile.obstacles;
  const total = SKILLS.reduce((acc, s) => acc + obstacles[s], 0);
  const step = 0.1;

  if (total === 0) {
    if (report.totals.trials < ENOUGH.trials) {
      return {
        key: 'SKILL_SHARE_THRESHOLD', now, suggested: now, enough: false,
        reason: 'Нито едно препятствие по способност и още малко практика. Няма какво да се каже.',
      };
    }
    return {
      key: 'SKILL_SHARE_THRESHOLD', now, suggested: round(Math.min(hi, now + step), 2), enough: true,
      reason: `${report.totals.trials} опита и нито веднъж способност не е спирала стълбата: прагът не хапе.`,
    };
  }
  if (total < ENOUGH.obstacles) {
    return {
      key: 'SKILL_SHARE_THRESHOLD', now, suggested: now, enough: false,
      reason: `Само ${total} смени на препятствието. Препоръката иска поне ${ENOUGH.obstacles}.`,
    };
  }
  const [worst, count] = SKILLS
    .map((s) => [s, obstacles[s]])
    .sort((a, b) => b[1] - a[1])[0];
  const share = count / total;
  if (share > 0.5) {
    return {
      key: 'SKILL_SHARE_THRESHOLD', now, suggested: round(Math.max(lo, now - step), 2), enough: true,
      reason: `${SKILL_LABELS[worst]} е спирала стълбата ${count} от ${total} пъти (${percent(share)}): една способност носи твърде много тежест.`,
    };
  }
  return {
    key: 'SKILL_SHARE_THRESHOLD', now, suggested: now, enough: true,
    reason: `Препятствията се редуват (най-често ${SKILL_LABELS[worst]}: ${count} от ${total}). Прагът работи както е замислен.`,
  };
}

function feelAdvice(report) {
  const now = report.config.feelShift;
  const { feels } = report.totals;
  const total = FEELS.reduce((acc, f) => acc + feels[f], 0);
  if (total < ENOUGH.feels) {
    return {
      key: 'FEEL_SHIFT', now, suggested: now, enough: false,
      reason: `Само ${total} оценки „как беше“. Препоръката иска поне ${ENOUGH.feels}.`,
    };
  }
  const share = (f) => feels[f] / total;
  if (share('right') >= 0.5) {
    return {
      key: 'FEEL_SHIFT', now, suggested: now, enough: true,
      reason: `„Точно“ е ${percent(share('right'))} от ${total} оценки: началната трудност уцелва.`,
    };
  }
  for (const [feel, word] of [['hard', 'висока'], ['easy', 'ниска']]) {
    if (share(feel) > 0.5) {
      return {
        key: 'FEEL_SHIFT', now, suggested: now + 1, enough: true,
        reason: `„${FEEL_LABELS[feel]}“ е ${percent(share(feel))} от ${total} оценки: началната трудност редовно е твърде ${word}, а една стъпка не я оправя.`,
      };
    }
  }
  return {
    key: 'FEEL_SHIFT', now, suggested: now, enough: true,
    reason: `Оценките са разделени (${FEELS.map((f) => `${FEEL_LABELS[f]} ${feels[f]}`).join(', ')}): няма системен наклон.`,
  };
}

// Обосновка за всяка игра поотделно: къде стои успехът ѝ и какво би поискала тя сама.
export function gameAdvice(report) {
  return report.games.map((g) => {
    const enough = g.trials >= ENOUGH.gameTrials;
    const suggested = enough ? staircaseFor(g.accuracy) : null;
    let note;
    if (!enough) note = `само ${g.trials} опита (иска поне ${ENOUGH.gameTrials})`;
    else if (suggested === null) note = `${percent(g.accuracy)} — сива зона, не иска промяна`;
    else if (suggested === report.config.staircaseUp) note = `${percent(g.accuracy)} — съгласна с ${suggested}`;
    else note = `${percent(g.accuracy)} — сама би поискала ${suggested}`;
    return { id: g.id, title: g.title, trials: g.trials, accuracy: g.accuracy, suggested, enough, note };
  });
}

export function recommend(report) {
  return {
    staircaseUp: staircaseAdvice(report),
    skillShareThreshold: thresholdAdvice(report),
    feelShift: feelAdvice(report),
    games: gameAdvice(report),
  };
}

// --- четим вид ---

const pad = (text, width) => String(text).padEnd(width);
const padLeft = (text, width) => String(text).padStart(width);

function rtLine(rt) {
  const parts = INPUT_KINDS
    .filter((kind) => rt[kind])
    .map((kind) => `${INPUT_LABELS[kind]} ${Math.round(rt[kind].mean)}±${rt[kind].sd === null ? '–' : Math.round(rt[kind].sd)} ms (${rt[kind].n})`);
  return parts.length ? parts.join(', ') : 'без измерено време';
}

export function formatCalibration(report, advice = recommend(report)) {
  const lines = [];
  lines.push(`Отчет за калибриране — Еволюция на ума${report.version ? ` v${report.version}` : ''}`);
  lines.push(`Стъпка ${report.profile.step + 1} от 45, ${report.profile.totalXP} XP`);
  lines.push(`Настройки сега: STAIRCASE_UP ${report.config.staircaseUp}, SKILL_SHARE_THRESHOLD ${report.config.skillShareThreshold}, FEEL_SHIFT ${report.config.feelShift}`);
  lines.push('');

  lines.push(`Общо: ${report.totals.sessions} сесии, ${report.totals.trials} опита, успех ${percent(report.totals.accuracy)}`);
  lines.push('');

  lines.push('По игри (сборно, без дати)');
  lines.push(`${pad('игра', 26)}${padLeft('сесии', 6)}${padLeft('опити', 7)}${padLeft('успех', 8)}${padLeft('трудност', 10)}  време`);
  for (const g of report.games) {
    lines.push([
      pad(g.title.slice(0, 24), 26),
      padLeft(g.sessions, 6),
      padLeft(g.trials, 7),
      padLeft(percent(g.accuracy), 8),
      padLeft(`${g.meanLevel === null ? '–' : g.meanLevel.toFixed(1)}/${g.lastDifficulty}`, 10),
      `  ${rtLine(g.rt)}`,
    ].join(''));
  }
  if (!report.games.length) lines.push('  още няма изиграна сесия');
  lines.push('');

  const miss = report.games.filter((g) => g.misses + g.premature > 0);
  if (miss.length) {
    lines.push('Пропуски и преждевременни натискания');
    for (const g of miss) lines.push(`  ${pad(g.title.slice(0, 24), 26)}пропуски ${g.misses}, преждевременни ${g.premature}`);
    lines.push('');
  }

  lines.push('Способности');
  lines.push(`  ${SKILLS.map((s) => `${SKILL_LABELS[s]} ${report.profile.skillXP[s]} XP (ниво ${report.profile.levels[s]})`).join(' · ')}`);
  lines.push('Препятствие на началния екран (брой пъти, без дати)');
  lines.push(`  ${SKILLS.map((s) => `${SKILL_LABELS[s]} ${report.profile.obstacles[s]}`).join(' · ')}`);
  lines.push('Оценки „как беше“');
  lines.push(`  ${FEELS.map((f) => `${FEEL_LABELS[f]} ${report.totals.feels[f]}`).join(' · ')}`);
  lines.push('');

  lines.push('Препоръка');
  for (const key of ['staircaseUp', 'skillShareThreshold', 'feelShift']) {
    const a = advice[key];
    const change = a.suggested === a.now ? `остава ${a.now}` : `${a.now} → ${a.suggested}`;
    lines.push(`  ${pad(a.key, 24)}${pad(change, 14)}${a.enough ? '' : '(малко данни) '}${a.reason}`);
  }
  lines.push('');
  lines.push('По игри поотделно');
  for (const g of advice.games) lines.push(`  ${pad(g.title.slice(0, 24), 26)}${g.note}`);

  return lines.join('\n');
}
