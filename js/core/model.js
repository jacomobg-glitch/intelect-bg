// Модел на данните. Съзнателно няма полета за дати на активност, серии или история на влизания.
import { SKILLS } from './config.js';
import { TOTAL_STEPS } from './evolution.js';
import { isISODate } from './sm2.js';

export const SCHEMA_VERSION = 1;

export const defaultProfile = () => ({
  key: 'profile',
  totalXP: 0,
  skillXP: Object.fromEntries(SKILLS.map((s) => [s, 0])),
  step: 0,
});

export const defaultSettings = () => ({
  key: 'settings',
  theme: 'auto',   // auto | dark | light
  skin: 'nature',  // визуална тема на стълбата; механиката не зависи от нея
});

export const defaultRecord = (id) => ({
  id,
  bestScore: 0,
  bestMeanRT: null,  // най-добро средно време за реакция в ms, ако играта го мери
  lastDifficulty: 1,
  plays: 0,
  demoSeen: false,
});

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
  return { key: 'profile', totalXP: raw.totalXP, skillXP, step: raw.step };
}

export function cleanSettings(raw) {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  if (['auto', 'dark', 'light'].includes(raw.theme)) base.theme = raw.theme;
  if (typeof raw.skin === 'string' && /^[a-z0-9-]{1,32}$/.test(raw.skin)) base.skin = raw.skin;
  return base;
}

export function cleanRecord(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  const rec = defaultRecord(raw.id);
  if (isCount(raw.bestScore)) rec.bestScore = raw.bestScore;
  if (isCount(raw.bestMeanRT)) rec.bestMeanRT = raw.bestMeanRT;
  if (isCount(raw.lastDifficulty) && raw.lastDifficulty >= 1) rec.lastDifficulty = raw.lastDifficulty;
  if (isCount(raw.plays)) rec.plays = raw.plays;
  rec.demoSeen = raw.demoSeen === true;
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
