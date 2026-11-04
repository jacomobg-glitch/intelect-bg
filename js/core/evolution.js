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

// Минимално ниво във ВСЯКА способност за достигане на дадена стъпка.
export function requiredLevel(step) {
  if (step <= 0) return 0;
  const fairShare = CUMULATIVE_XP[step] / SKILLS.length;
  return Math.max(1, levelFromXP(CONFIG.BALANCE * fairShare));
}

// Активна способност е тази, за която има поне един отключен модул.
// Праговете важат само за активните, затова липсващ модул никога не спира изкачването.
export function canReach(profile, step, active = SKILLS) {
  if (step >= TOTAL_STEPS) return false;
  if (profile.totalXP < CUMULATIVE_XP[step]) return false;
  const need = requiredLevel(step);
  return active.every((s) => levelFromXP(profile.skillXP[s]) >= need);
}

// Стъпката само расте: нов модул добавя изисквания за следващите стъпки, но не отнема достигнатите.
// activeFor(step) връща активните способности при дадена стъпка.
export function advancedStep(profile, activeFor = () => SKILLS) {
  let step = profile.step;
  while (canReach(profile, step + 1, activeFor(step))) step += 1;
  return step;
}

export function applyXP(profile, xp, skills, activeFor) {
  const valid = skills.filter((s) => SKILLS.includes(s));
  const amount = Number.isFinite(xp) && xp > 0 && valid.length ? xp : 0;
  const skillXP = { ...profile.skillXP };
  for (const s of valid) {
    skillXP[s] = Math.round((skillXP[s] + amount / valid.length) * 100) / 100;
  }
  const next = { ...profile, totalXP: profile.totalXP + amount, skillXP };
  const from = profile.step;
  next.step = advancedStep(next, activeFor);
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
  const skills = (need) => SKILLS.map((skill) => {
    const level = levelFromXP(profile.skillXP[skill]);
    return { skill, level, required: need, ok: level >= need, active: active.includes(skill) };
  });
  if (next >= TOTAL_STEPS) {
    return { isMax: true, next: null, xpInto: 0, xpCost: 0, fraction: 1, xpReady: true, gates: skills(0), blocked: [] };
  }
  const base = CUMULATIVE_XP[profile.step];
  const xpCost = CUMULATIVE_XP[next] - base;
  const xpInto = Math.max(0, profile.totalXP - base);
  const gates = skills(requiredLevel(next));
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
