// Отчетът за калибриране: събирането на сборните числа и препоръката от тях.
// Сметките тук са написани наново, а не взети от кода, който се проверява.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENOUGH, buildCalibration, formatCalibration, fromSums, gameAdvice, recommend, staircaseFor,
} from '../js/core/calibration.js';
import { CONFIG, SKILLS } from '../js/core/config.js';
import {
  addFeel, addSession, cleanRecord, defaultProfile, defaultRecord, emptyCalib,
} from '../js/core/model.js';
import { TrialLog, inputKindOf } from '../js/modules/shared/trial-log.js';

// Независима сметка за средно и извадково разсейване.
const meanOf = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sdOf = (xs) => {
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const sums = (xs) => ({
  n: xs.length,
  sum: xs.reduce((a, b) => a + b, 0),
  sumSq: xs.reduce((a, b) => a + b * b, 0),
});

const close = (got, want, eps, what) => assert.ok(Math.abs(got - want) < eps, `${what}: ${got} вместо ${want}`);

test('средно и разсейване от суми дават същото като от самите опити', () => {
  const xs = [310, 288, 455, 371, 299, 512, 333];
  const got = fromSums(sums(xs));
  assert.equal(got.n, xs.length);
  close(got.mean, meanOf(xs), 1e-9, 'средно');
  close(got.sd, sdOf(xs), 1e-9, 'разсейване');

  assert.deepEqual(fromSums(null), { n: 0, mean: null, sd: null });
  assert.deepEqual(fromSums({ n: 0, sum: 0, sumSq: 0 }), { n: 0, mean: null, sd: null });
  // Един опит няма разсейване: делим на n−1.
  assert.deepEqual(fromSums(sums([400])), { n: 1, mean: 400, sd: null });
});

test('видът вход се чете от самото събитие', () => {
  assert.equal(inputKindOf({ key: '1' }), 'keyboard');
  assert.equal(inputKindOf({ pointerType: 'touch' }), 'touch');
  assert.equal(inputKindOf({ pointerType: 'pen' }), 'pen');
  assert.equal(inputKindOf({ pointerType: 'mouse' }), 'mouse');
  // Непознат или липсващ вид не чупи нищо: времето пак се брои, само че като мишка.
  assert.equal(inputKindOf({ pointerType: 'светлинен меч' }), 'mouse');
  assert.equal(inputKindOf(null), 'mouse');
});

test('дневникът брои опитите и разделя времената по вид вход', () => {
  const log = new TrialLog({ startLevel: 2, maxLevel: 9, adapt: false });
  const mouse = [320, 410, 365];
  const keyboard = [280, 240];
  log.input = 'mouse';
  for (const rt of mouse) log.correct({ rt, limit: 2000 });
  log.input = 'keyboard';
  for (const rt of keyboard) log.correct({ rt, limit: 2000 });
  log.error('wrong');
  log.error('miss');
  log.error('miss');
  log.premature();

  const s = log.summary();
  assert.equal(s.correct, 5);
  assert.equal(s.wrong, 1);
  assert.equal(s.misses, 2);
  assert.equal(s.premature, 1, 'преждевременното не е опит и не влиза в trials');
  assert.equal(s.trials, 8);
  assert.equal(s.levelTrials, 8, 'всеки приключил опит дава трудност за средната');
  assert.equal(s.levelSum, 8 * 2, 'без адаптация трудността стои на 2');
  close(fromSums(s.rt.mouse).mean, meanOf(mouse), 1e-9, 'мишка');
  close(fromSums(s.rt.keyboard).mean, meanOf(keyboard), 1e-9, 'клавиатура');
  assert.equal(s.rt.touch, undefined, 'непипнат вид вход не се появява');
});

test('сесиите се натрупват, а оценките се броят', () => {
  const first = addSession(emptyCalib(), {
    trials: 10, correct: 8, wrong: 1, misses: 1, premature: 2, levelSum: 30, levelTrials: 10,
    rt: { mouse: sums([300, 400]) },
  });
  const both = addSession(first, {
    trials: 6, correct: 5, wrong: 1, misses: 0, premature: 0, levelSum: 24, levelTrials: 6,
    rt: { mouse: sums([500]), keyboard: sums([250, 270]) },
  });
  assert.equal(both.sessions, 2);
  assert.equal(both.trials, 16);
  assert.equal(both.correct, 13);
  assert.equal(both.premature, 2);
  assert.equal(both.levelSum, 54);
  // Трите времена с мишка са от двете сесии и дават едно средно.
  close(fromSums(both.rt.mouse).mean, meanOf([300, 400, 500]), 1e-9, 'мишка през две сесии');
  assert.equal(both.rt.keyboard.n, 2);

  // Сесия без сборни числа (игра без calibration()) само вдига брояча на сесиите.
  assert.equal(addSession(both, null).sessions, 2, 'липсваща сесия не се брои');

  let feels = emptyCalib();
  for (const f of ['hard', 'hard', 'right', 'много трудно']) feels = addFeel(feels, f);
  assert.deepEqual(feels.feels, { easy: 0, right: 1, hard: 2 });
});

test('записи отпреди схема 3 се четат с нули, а боклукът се изхвърля', () => {
  const old = cleanRecord({ id: 'stroop', bestScore: 10, plays: 3 });
  assert.deepEqual(old.calib, emptyCalib(), 'стар запис започва отчета от нула');
  assert.equal(old.bestScore, 10, 'рекордът не се губи');

  const dirty = cleanRecord({
    id: 'stroop',
    calib: {
      sessions: 2, trials: -5, correct: 'много',
      rt: { mouse: { n: 3, sum: 900, sumSq: 280000 }, телепатия: { n: 9, sum: 9, sumSq: 9 }, pen: { n: 0, sum: 0, sumSq: 0 } },
      feels: { easy: 1, hard: 'често' },
    },
  });
  assert.equal(dirty.calib.sessions, 2);
  assert.equal(dirty.calib.trials, 0, 'отрицателно се отхвърля');
  assert.equal(dirty.calib.correct, 0, 'текст вместо число се отхвърля');
  assert.deepEqual(Object.keys(dirty.calib.rt), ['mouse'], 'непознат вид вход и празен запис отпадат');
  assert.deepEqual(dirty.calib.feels, { easy: 1, right: 0, hard: 0 });
});

// --- отчетът ---

const reportOf = ({ games = [], obstacles = {}, trialsEach = {} } = {}) => buildCalibration({
  version: '0.0.0',
  profile: { ...defaultProfile(), totalXP: 5000, step: 7, obstacles: { ...defaultProfile().obstacles, ...obstacles } },
  records: games,
  titles: Object.fromEntries(games.map((g) => [g.id, trialsEach[g.id] || g.id])),
});

const gameRecord = (id, { sessions = 1, trials, correct, levelSum = trials * 3, rt = {}, feels = {} } = {}) => ({
  ...defaultRecord(id),
  lastDifficulty: 4,
  calib: {
    ...emptyCalib(),
    sessions,
    trials,
    correct,
    wrong: trials - correct,
    levelSum,
    levelTrials: trials,
    rt,
    feels: { easy: 0, right: 0, hard: 0, ...feels },
  },
});

test('отчетът смята успех, средна трудност и време наново', () => {
  const rts = [300, 340, 410, 380];
  const report = reportOf({
    games: [gameRecord('stroop', { sessions: 4, trials: 100, correct: 79, levelSum: 420, rt: { keyboard: sums(rts) } })],
  });
  const g = report.games[0];
  assert.equal(g.trials, 100);
  close(g.accuracy, 79 / 100, 1e-9, 'успех');
  close(g.meanLevel, 420 / 100, 1e-9, 'средна трудност');
  close(g.rt.keyboard.mean, meanOf(rts), 0.05, 'средно време');
  close(g.rt.keyboard.sd, sdOf(rts), 0.05, 'разсейване');
  assert.equal(g.lastDifficulty, 4, 'крайната трудност идва от записа');
  close(report.totals.accuracy, 79 / 100, 1e-9, 'общият успех');

  // Игра без изиграна сесия не влиза в отчета: нула опити не казва нищо.
  const empty = reportOf({ games: [defaultRecord('nback')] });
  assert.deepEqual(empty.games, []);
  assert.equal(empty.totals.accuracy, null);
  assert.doesNotThrow(() => formatCalibration(empty));
});

test('отчетът не съдържа дати, часове и история', () => {
  const report = reportOf({
    games: [gameRecord('stroop', { trials: 50, correct: 40, feels: { right: 3 } })],
    obstacles: { memory: 4 },
  });
  const text = `${JSON.stringify(report)}\n${formatCalibration(report)}`;
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, 'има дата');
  assert.doesNotMatch(text, /\d{1,2}:\d{2}/, 'има час');
  assert.doesNotMatch(text, /streak|история|дата|вчера|днес/i);
});

// --- препоръката ---

test('праговете за STAIRCASE_UP са точно както са описани', () => {
  assert.equal(staircaseFor(0.55), 2);
  assert.equal(staircaseFor(0.699), 2);
  assert.equal(staircaseFor(0.72), null, '70–75% е сива зона');
  assert.equal(staircaseFor(0.75), 3);
  assert.equal(staircaseFor(0.794), 3, 'целта при 3 е около 79.4%');
  assert.equal(staircaseFor(0.85), 3);
  assert.equal(staircaseFor(0.87), null, '85–88% е сива зона');
  assert.equal(staircaseFor(0.90), 4);
  assert.equal(staircaseFor(null), null);
});

test('препоръката за STAIRCASE_UP иска достатъчно опити', () => {
  const few = recommend(reportOf({ games: [gameRecord('stroop', { trials: 50, correct: 20 })] })).staircaseUp;
  assert.equal(few.enough, false);
  assert.equal(few.suggested, CONFIG.STAIRCASE_UP, 'при малко данни нищо не се мести');
  assert.match(few.reason, new RegExp(String(ENOUGH.trials)));

  const hard = recommend(reportOf({ games: [gameRecord('stroop', { trials: 400, correct: 240 })] })).staircaseUp;
  assert.equal(hard.enough, true);
  assert.equal(hard.suggested, 2, '60% успех значи твърде трудно');

  const easy = recommend(reportOf({ games: [gameRecord('stroop', { trials: 400, correct: 376 })] })).staircaseUp;
  assert.equal(easy.suggested, 4, '94% успех значи твърде лесно');

  const right = recommend(reportOf({ games: [gameRecord('stroop', { trials: 400, correct: 318 })] })).staircaseUp;
  assert.equal(right.suggested, 3, '79.5% е точно каквото 3 цели');
  assert.equal(right.now, right.suggested);
});

test('всяка игра носи своя обосновка', () => {
  const report = reportOf({
    games: [
      gameRecord('stroop', { trials: 300, correct: 180 }),   // 60%: иска 2
      gameRecord('nback', { trials: 300, correct: 285 }),    // 95%: иска 4
      gameRecord('schulte', { trials: 20, correct: 10 }),    // малко опити
    ],
  });
  const advice = gameAdvice(report);
  const by = Object.fromEntries(advice.map((g) => [g.id, g]));
  assert.equal(by.stroop.suggested, 2);
  assert.equal(by.nback.suggested, 4);
  assert.equal(by.schulte.enough, false);
  assert.equal(by.schulte.suggested, null);
  assert.match(by.schulte.note, new RegExp(String(ENOUGH.gameTrials)));
  // Общата препоръка не е просто първата игра: 465 от 620 е 75%, тоест 3.
  assert.equal(recommend(report).staircaseUp.suggested, 3);
});

test('препоръката за SKILL_SHARE_THRESHOLD гледа кой спира стълбата', () => {
  const games = [gameRecord('stroop', { trials: 400, correct: 318 })];

  const stuck = recommend(reportOf({ games, obstacles: { memory: 9, attention: 2, speed: 1 } })).skillShareThreshold;
  assert.equal(stuck.suggested, 0.4, 'една способност над половината случаи сваля прага');
  assert.match(stuck.reason, /Памет/);

  const mixed = recommend(reportOf({ games, obstacles: { memory: 4, attention: 4, speed: 3, logic: 2 } })).skillShareThreshold;
  assert.equal(mixed.suggested, CONFIG.SKILL_SHARE_THRESHOLD, 'редуващи се препятствия не местят нищо');

  const never = recommend(reportOf({ games })).skillShareThreshold;
  assert.equal(never.suggested, 0.6, 'много практика без нито едно препятствие вдига прага');

  const quiet = recommend(reportOf({ games: [gameRecord('stroop', { trials: 30, correct: 24 })] })).skillShareThreshold;
  assert.equal(quiet.enough, false, 'без практика няма какво да се каже');

  // Препоръката никога не излиза извън границите от config.js.
  const [lo, hi] = CONFIG.SKILL_SHARE_RANGE;
  for (const r of [stuck, mixed, never, quiet]) {
    assert.ok(r.suggested >= lo && r.suggested <= hi, `${r.suggested} е извън ${lo}–${hi}`);
  }
});

test('препоръката за FEEL_SHIFT гледа разпределението на оценките', () => {
  const withFeels = (feels) => recommend(reportOf({
    games: [gameRecord('stroop', { trials: 400, correct: 318, feels })],
  })).feelShift;

  assert.equal(withFeels({ easy: 1, right: 2, hard: 1 }).enough, false, 'четири оценки не стигат');
  assert.equal(withFeels({ easy: 2, right: 9, hard: 3 }).suggested, CONFIG.FEEL_SHIFT, '„Точно“ преобладава');
  assert.equal(withFeels({ easy: 1, right: 4, hard: 10 }).suggested, CONFIG.FEEL_SHIFT + 1, '„Трудно“ над половината');
  assert.equal(withFeels({ easy: 11, right: 4, hard: 1 }).suggested, CONFIG.FEEL_SHIFT + 1, '„Лесно“ над половината');
  assert.equal(withFeels({ easy: 7, right: 3, hard: 7 }).suggested, CONFIG.FEEL_SHIFT, 'разделени оценки без наклон');
});

test('отчетът се чете и наум: текстът носи числата, по които се решава', () => {
  const report = reportOf({
    games: [gameRecord('stroop', { sessions: 9, trials: 400, correct: 240, rt: { touch: sums([420, 480, 390]) } })],
    obstacles: { memory: 9, attention: 2, speed: 1 },
  });
  const text = formatCalibration(report);
  assert.match(text, /400/, 'броят опити');
  assert.match(text, /60\.0%/, 'успехът');
  assert.match(text, /докосване/, 'видът вход');
  assert.match(text, /STAIRCASE_UP\s+3 → 2/, 'препоръката с обосновка');
  for (const s of SKILLS) assert.ok(text.includes(s) === false, 'ключовете на способностите не излизат на екрана');
});
