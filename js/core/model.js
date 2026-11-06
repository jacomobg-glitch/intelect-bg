// Модел на данните. Съзнателно няма полета за дати на активност, серии или история на влизания.
import { CONFIG, SKILLS } from './config.js';
import { TOTAL_STEPS } from './evolution.js';
import { DEFAULT_HERO, cleanHero } from '../content/hero.js';
import { itemOf } from '../content/shop.js';
import { DEFAULT_WORLD, WORLD_IDS } from '../content/worlds/index.js';
import { INPUT_KINDS } from './stats.js';
import { isISODate } from './sm2.js';

// 3: записите носят сборни числа за калибриране (calib), профилът брои препятствията.
export const SCHEMA_VERSION = 3;

export const defaultProfile = () => ({
  key: 'profile',
  totalXP: 0,
  skillXP: Object.fromEntries(SKILLS.map((s) => [s, 0])),
  step: 0,
  activationSteps: {}, // способност → стъпка, на която е станала активна
  coins: 0,            // печелят се с практика и НЕ изгарят при пауза
  owned: [],           // купена украса; нищо от нея не дава предимство
  // Колко пъти всяка способност е ставала препятствие на началния екран. Брой, не история:
  // няма кога, само колко. Служи само за отчета за калибриране.
  obstacles: Object.fromEntries(SKILLS.map((s) => [s, 0])),
  obstacleNow: null,   // коя е преброена в момента, за да не се брои наново при всяко рисуване
});

export const defaultSettings = () => ({
  key: 'settings',
  theme: 'auto',          // auto | dark | light
  world: DEFAULT_WORLD,   // кой свят облича стълбата; механиката не зависи от него
  hero: { ...DEFAULT_HERO }, // цвят, шапка, инструмент и име на героя
  background: null,       // купен фон, ако има такъв
  decorOff: [],           // купена украса, която детето е махнало от сцената
  stroopVariant: 'color', // color | shape: вариант на Stroop без цветове
  colorFree: false,       // true: игрите с цветове минават на форми (цветна слепота)
});

// Сборните числа на една игра за отчета за калибриране. Само суми и броячи:
// нито дата, нито списък със сесии — отчетът казва КОЛКО, никога КОГА.
export const emptyCalib = () => ({
  sessions: 0,
  trials: 0,
  correct: 0,
  wrong: 0,
  misses: 0,
  premature: 0,
  levelSum: 0,       // сума от трудностите по опити → средна трудност
  levelTrials: 0,
  rt: {},            // вид вход → { n, sum, sumSq }; от тях излизат средно и разсейване
  feels: { easy: 0, right: 0, hard: 0 },
});

export const defaultRecord = (id) => ({
  id,
  bestScore: 0,
  bestMeanRT: null,  // най-добро средно време за реакция в ms, ако играта го мери
  lastDifficulty: 1,
  plays: 0,
  demoSeen: false,
  feel: null,        // последната оценка „Лесно / Точно / Трудно“, без история
  calib: emptyCalib(),
});

// Добавя сборните числа на една сесия към натрупаните. Чиста функция.
export function addSession(calib, session) {
  const base = calib || emptyCalib();
  if (!session) return base;
  const rt = { ...base.rt };
  for (const [kind, box] of Object.entries(session.rt || {})) {
    if (!INPUT_KINDS.includes(kind) || !box || !isCount(box.n)) continue;
    const prev = rt[kind] || { n: 0, sum: 0, sumSq: 0 };
    rt[kind] = { n: prev.n + box.n, sum: prev.sum + box.sum, sumSq: prev.sumSq + box.sumSq };
  }
  const add = (key) => base[key] + (isCount(session[key]) ? session[key] : 0);
  return {
    ...base,
    sessions: base.sessions + 1,
    trials: add('trials'),
    correct: add('correct'),
    wrong: add('wrong'),
    misses: add('misses'),
    premature: add('premature'),
    levelSum: add('levelSum'),
    levelTrials: add('levelTrials'),
    rt,
  };
}

// Оценката „как беше“ се брои, а не само се помни: за калибрирането важи разпределението.
export function addFeel(calib, feel) {
  const base = calib || emptyCalib();
  if (!FEELS.includes(feel)) return base;
  return { ...base, feels: { ...base.feels, [feel]: base.feels[feel] + 1 } };
}

export const FEELS = Object.freeze(['easy', 'right', 'hard']);
export const FEEL_LABELS = Object.freeze({ easy: 'Лесно', right: 'Точно', hard: 'Трудно' });

// „Лесно“ вдига началната трудност с една стъпка, „Трудно“ я сваля, „Точно“ не мести нищо.
export const feelShift = (feel) => (feel === 'easy' ? CONFIG.FEEL_SHIFT : feel === 'hard' ? -CONFIG.FEEL_SHIFT : 0);

// Начална трудност за следващата сесия: докъдето е стигнал staircase, преместена с последната оценка.
// Оценката важи за точно една следваща сесия, затова completeSession я изчиства след употреба.
export const startDifficulty = (record) => Math.max(1, record.lastDifficulty + feelShift(record.feel));

const isCount = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const ID_PATTERN = /^[a-z0-9-]{1,64}$/;

// Проверява чужд обект (например от файл за импорт) и връща изчистено копие или null.
export function cleanProfile(raw) {
  if (!raw || typeof raw !== 'object' || !isCount(raw.totalXP)) return null;
  if (!Number.isInteger(raw.step) || raw.step < 0 || raw.step >= TOTAL_STEPS) return null;
  if (!raw.skillXP || typeof raw.skillXP !== 'object') return null;
  const skillXP = {};
  for (const s of SKILLS) {
    if (!isCount(raw.skillXP[s])) return null;
    skillXP[s] = raw.skillXP[s];
  }
  const activationSteps = {};
  const rawSteps = raw.activationSteps && typeof raw.activationSteps === 'object' ? raw.activationSteps : {};
  for (const s of SKILLS) {
    if (Number.isInteger(rawSteps[s]) && rawSteps[s] >= 0 && rawSteps[s] < TOTAL_STEPS) activationSteps[s] = rawSteps[s];
  }
  // Монетите и покупките са част от прогреса: пътуват с копието и се сливат.
  const coins = isCount(raw.coins) ? Math.min(1e6, Math.round(raw.coins)) : 0;
  const owned = Array.isArray(raw.owned)
    ? [...new Set(raw.owned.filter((id) => typeof id === 'string' && itemOf(id)))]
    : [];
  const obstacles = Object.fromEntries(SKILLS.map((s) => {
    const n = raw.obstacles && raw.obstacles[s];
    return [s, isCount(n) ? Math.min(1e6, Math.round(n)) : 0];
  }));
  const obstacleNow = SKILLS.includes(raw.obstacleNow) ? raw.obstacleNow : null;
  return {
    key: 'profile', totalXP: raw.totalXP, skillXP, step: raw.step, activationSteps, coins, owned,
    obstacles, obstacleNow,
  };
}

export function cleanSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  if (['auto', 'dark', 'light'].includes(raw.theme)) base.theme = raw.theme;
  // `skin` е старото име на същото поле: копие отпреди световете продължава да работи.
  const world = raw.world || raw.skin;
  if (WORLD_IDS.includes(world)) base.world = world;
  base.hero = cleanHero(raw.hero, Array.isArray(raw.owned) ? raw.owned : []);
  if (typeof raw.background === 'string' && itemOf(raw.background)) base.background = raw.background;
  base.decorOff = Array.isArray(raw.decorOff)
    ? [...new Set(raw.decorOff.filter((id) => typeof id === 'string' && itemOf(id)))]
    : [];
  if (['color', 'shape'].includes(raw.stroopVariant)) base.stroopVariant = raw.stroopVariant;
  base.colorFree = raw.colorFree === true;
  return base;
}

// Записи отпреди схема 3 нямат сборни числа: започват от нули, без да се губи рекордът.
function cleanCalib(raw) {
  const out = emptyCalib();
  if (!raw || typeof raw !== 'object') return out;
  for (const key of ['sessions', 'trials', 'correct', 'wrong', 'misses', 'premature', 'levelSum', 'levelTrials']) {
    if (isCount(raw[key])) out[key] = Math.min(1e9, raw[key]);
  }
  for (const kind of INPUT_KINDS) {
    const box = raw.rt && raw.rt[kind];
    if (!box || !isCount(box.n) || !isCount(box.sum) || !isCount(box.sumSq) || box.n === 0) continue;
    out.rt[kind] = { n: box.n, sum: box.sum, sumSq: box.sumSq };
  }
  for (const feel of FEELS) {
    if (raw.feels && isCount(raw.feels[feel])) out.feels[feel] = Math.min(1e6, raw.feels[feel]);
  }
  return out;
}

export function cleanRecord(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  const rec = defaultRecord(raw.id);
  if (isCount(raw.bestScore)) rec.bestScore = raw.bestScore;
  if (isCount(raw.bestMeanRT)) rec.bestMeanRT = raw.bestMeanRT;
  if (isCount(raw.lastDifficulty) && raw.lastDifficulty >= 1) rec.lastDifficulty = raw.lastDifficulty;
  if (isCount(raw.plays)) rec.plays = raw.plays;
  rec.demoSeen = raw.demoSeen === true;
  if (FEELS.includes(raw.feel)) rec.feel = raw.feel;
  rec.calib = cleanCalib(raw.calib);
  return rec;
}

export const defaultTopic = (id) => ({
  id,
  checked: false,    // лична отметка, поставя се на ръка
  mastered: false,   // „усвоена“: идва само от тест с 80% или повече
  masteredAt: null,  // YYYY-MM-DD, единствената дата, която се показва
  bestTest: 0,
  level: 1,          // докъде е стигнала трудността на упражненията
  sm2: null,         // { ef, interval, reps, due } за тихия преговор
});

function cleanSm2(raw) {
  if (!raw || typeof raw !== 'object' || !isISODate(raw.due)) return null;
  if (!isCount(raw.ef) || !isCount(raw.interval) || !isCount(raw.reps)) return null;
  return { ef: raw.ef, interval: raw.interval, reps: raw.reps, due: raw.due };
}

export function cleanTopic(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  return {
    id: raw.id,
    checked: raw.checked === true,
    mastered: raw.mastered === true,
    masteredAt: isISODate(raw.masteredAt) ? raw.masteredAt : null,
    bestTest: isCount(raw.bestTest) ? Math.min(100, raw.bestTest) : 0,
    level: isCount(raw.level) && raw.level >= 1 ? raw.level : 1,
    sm2: cleanSm2(raw.sm2),
  };
}
