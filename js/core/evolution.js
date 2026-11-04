// Чиста логика на еволюцията: без DOM и без база данни, за да се тества директно в Node.
import { CONFIG, SKILLS } from './config.js';

export const TOTAL_STEPS = CONFIG.CREATURES * CONFIG.SUBSTEPS;
export const TARGET_TOTAL_XP = CONFIG.PACE_HOURS * 60 * CONFIG.XP_PER_MINUTE;

const SUB_LABELS = ['I', 'II', 'III'];
const transitions = TOTAL_STEPS - 1;
const round10 = (x) => Math.round(x / 10) * 10;

// Цена на стъпка: FIRST + K * t^CURVE, като K се избира така, че сумата да е равна на целта.
const curve = Array.from({ length: transitions }, (_, i) => (i / (transitions - 1)) ** CONFIG.CURVE);
const curveSum = curve.reduce((a, b) => a + b, 0);
const K = (TARGET_TOTAL_XP - transitions * CONFIG.FIRST_STEP_XP) / curveSum;

// STEP_COSTS[i] е цената на прехода от стъпка i към стъпка i + 1.
export const STEP_COSTS = Object.freeze(curve.map((w) => round10(CONFIG.FIRST_STEP_XP + K * w)));

// CUMULATIVE_XP[s] е общият XP, нужен за достигане на стъпка s.
export const CUMULATIVE_XP = Object.freeze(
  STEP_COSTS.reduce((acc, cost) => [...acc, acc[acc.length - 1] + cost], [0]),
);

export const creatureIndex = (step) => Math.floor(step / CONFIG.SUBSTEPS);
export const subIndex = (step) => step % CONFIG.SUBSTEPS;
export const subLabel = (step) => SUB_LABELS[subIndex(step)];

export const levelFromXP = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / CONFIG.LEVEL_K));

// Обратното на levelFromXP: най-малкият XP, при който способността е на ниво L.
export const xpForLevel = (level) => CONFIG.LEVEL_K * Math.max(0, level) ** 2;

// Минимално ниво във ВСЯКА способност за достигане на дадена стъпка.
// threshold е делът от „справедливия дял“ XP; реалният прогрес винаги ползва стойността от конфигурацията.
export function requiredLevel(step, threshold = CONFIG.SKILL_SHARE_THRESHOLD) {
  if (step <= 0) return 0;
  const fairShare = CUMULATIVE_XP[step] / SKILLS.length;
  return Math.max(1, levelFromXP(threshold * fairShare));
}

// Активна способност е тази, за която има поне един отключен модул.
// Праговете важат само за активните, затова липсващ модул никога не спира изкачването.
export function canReach(profile, step, active = SKILLS) {
  if (step >= TOTAL_STEPS) return false;
  if (profile.totalXP < CUMULATIVE_XP[step]) return false;
  return active.every((s) => levelFromXP(profile.skillXP[s]) >= requirementFor(profile, s, step));
}

// Стъпката, на която способността е станала активна. Без запис: става активна точно сега.
export const activationOf = (profile, skill) => {
  const recorded = profile.activationSteps ? profile.activationSteps[skill] : undefined;
  return recorded === undefined ? profile.step : recorded;
};

// Мек преход: късно активирана способност започва от нула и расте нормално оттам.
export function requirementFor(profile, skill, step, threshold = CONFIG.SKILL_SHARE_THRESHOLD) {
  return Math.max(0, requiredLevel(step, threshold) - requiredLevel(activationOf(profile, skill), threshold));
}

// Записва стъпка на активиране за новите активни способности. Старите записи не се пипат.
export function syncActivation(profile, activeFor) {
  const active = activeFor(profile.step);
  const known = profile.activationSteps || {};
  const missing = active.filter((s) => known[s] === undefined);
  if (!missing.length && profile.activationSteps) return profile;
  const activationSteps = { ...known };
  for (const s of missing) activationSteps[s] = profile.step;
  return { ...profile, activationSteps };
}

// Стъпката само расте: нов модул добавя изисквания за следващите стъпки, но не отнема достигнатите.
// activeFor(step) връща активните способности при дадена стъпка.
export function advance(profile, activeFor = () => SKILLS) {
  let current = syncActivation(profile, activeFor);
  while (canReach(current, current.step + 1, activeFor(current.step))) {
    current = syncActivation({ ...current, step: current.step + 1 }, activeFor);
  }
  return current;
}

export const advancedStep = (profile, activeFor) => advance(profile, activeFor).step;

export function applyXP(profile, xp, skills, activeFor) {
  const valid = skills.filter((s) => SKILLS.includes(s));
  const amount = Number.isFinite(xp) && xp > 0 && valid.length ? xp : 0;
  const skillXP = { ...profile.skillXP };
  for (const s of valid) {
    skillXP[s] = Math.round((skillXP[s] + amount / valid.length) * 100) / 100;
  }
  const from = profile.step;
  const next = advance({ ...profile, totalXP: profile.totalXP + amount, skillXP }, activeFor);
  return { profile: next, from, to: next.step };
}

// XP за изиграна сесия: активно време, умножено по качество (0.5 до 1.3).
export function sessionXP({ activeMs, quality }) {
  const q = Math.min(1, Math.max(0, quality));
  const minutes = Math.max(0, activeMs) / 60000;
  const xp = minutes * CONFIG.XP_PER_MINUTE * (0.5 + 0.8 * q);
  return Math.min(CONFIG.MAX_SESSION_XP, Math.round(xp));
}

// Таван на адаптивната трудност: всяко ново същество го вдига с 2.
export const difficultyCeiling = (step) => 3 + creatureIndex(step) * 2;

// Всичко, което началният екран трябва да знае за следващата стъпка.
export function nextStepInfo(profile, active = SKILLS) {
  const next = profile.step + 1;
  const skills = (step) => SKILLS.map((skill) => {
    const level = levelFromXP(profile.skillXP[skill]);
    const required = step === null ? 0 : requirementFor(profile, skill, step);
    return { skill, level, required, ok: level >= required, active: active.includes(skill) };
  });
  if (next >= TOTAL_STEPS) {
    return { isMax: true, next: null, xpInto: 0, xpCost: 0, fraction: 1, xpReady: true, gates: skills(null), blocked: [] };
  }
  const base = CUMULATIVE_XP[profile.step];
  const xpCost = CUMULATIVE_XP[next] - base;
  const xpInto = Math.max(0, profile.totalXP - base);
  const gates = skills(next);
  return {
    isMax: false,
    next,
    xpInto: Math.min(xpInto, xpCost),
    xpCost,
    fraction: Math.min(1, xpInto / xpCost),
    xpReady: xpInto >= xpCost,
    gates,
    blocked: gates.filter((g) => g.active && !g.ok).map((g) => g.skill),
  };
}

// Най-близкото препятствие към следващата стъпка. Изоставаща способност е по-близо от общия XP,
// защото тренировката ѝ носи и двете: XP за способността и XP за стъпката.
// Връща { kind: 'max' | 'ready' | 'skill' | 'xp', skill, xp, step, info }.
export function nearestObstacle(profile, active = SKILLS) {
  const info = nextStepInfo(profile, active);
  if (info.isMax) return { kind: 'max', skill: null, xp: 0, step: null, info };
  const gaps = info.gates
    .filter((g) => g.active && !g.ok)
    .map((g) => ({ skill: g.skill, xp: Math.max(1, Math.ceil(xpForLevel(g.required) - profile.skillXP[g.skill])) }))
    .sort((a, b) => a.xp - b.xp || SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill));
  if (gaps.length) return { kind: 'skill', ...gaps[0], step: info.next, info };
  const left = Math.ceil(info.xpCost - info.xpInto);
  if (left > 0) return { kind: 'xp', skill: null, xp: left, step: info.next, info };
  return { kind: 'ready', skill: null, xp: 0, step: info.next, info };
}
