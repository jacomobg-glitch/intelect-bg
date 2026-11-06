// Сливане на данни от две устройства. Чисти функции: нищо не се записва тук.
import { SKILLS } from './config.js';
import { advance } from './evolution.js';

const newerDate = (a, b) => {
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
};

// Копие отпреди профилите може да носи прибран прогрес от изтрития тестов режим.
// Тогава истинският прогрес е в снимката, а не в профила, и се чете оттам.
export function realProfile(data) {
  const snapshot = data.meta.find((m) => m.key === 'simSnapshot');
  return snapshot ? snapshot.profile : data.meta.find((m) => m.key === 'profile');
}

export function mergeProfiles(a, b, activeFor) {
  const skillXP = Object.fromEntries(SKILLS.map((s) => [s, Math.max(a.skillXP[s], b.skillXP[s])]));
  const sum = SKILLS.reduce((acc, s) => acc + skillXP[s], 0);
  // При активирането печели по-ранната стъпка: то е станало, когато е станало на първото устройство.
  const activationSteps = {};
  for (const s of SKILLS) {
    const known = [a, b].map((p) => (p.activationSteps ? p.activationSteps[s] : undefined)).filter((x) => x !== undefined);
    if (known.length) activationSteps[s] = Math.min(...known);
  }
  // Вече достигнатата стъпка не се отнема; слетите данни могат само да я вдигнат.
  // Монетите вземат по-голямото (не се събират: сесиите по двете устройства може
  // да са едни и същи), а купеното се обединява — нищо платено не се губи.
  // Броячът на препятствията взема по-голямото, като монетите: двете устройства
  // може да са видели едни и същи препятствия, затова сборът би ги удвоил.
  const obstacles = Object.fromEntries(SKILLS.map((s) => [
    s, Math.max((a.obstacles || {})[s] || 0, (b.obstacles || {})[s] || 0),
  ]));
  return advance({
    key: 'profile',
    skillXP,
    totalXP: Math.max(sum, a.totalXP, b.totalXP),
    step: Math.max(a.step, b.step),
    activationSteps,
    coins: Math.max(a.coins || 0, b.coins || 0),
    owned: [...new Set([...(a.owned || []), ...(b.owned || [])])],
    obstacles,
    obstacleNow: null,
  }, activeFor);
}

export function mergeRecord(a, b) {
  const times = [a.bestMeanRT, b.bestMeanRT].filter((t) => t !== null);
  // Сборните числа за калибриране се вземат ЦЕЛИ от по-богатия запис, а не поле по поле:
  // сборът би удвоил общи сесии, а максимум по полета би дал вътрешно противоречиви числа
  // (например повече верни, отколкото опити).
  const ca = a.calib || { trials: 0 };
  const cb = b.calib || { trials: 0 };
  return {
    id: a.id,
    calib: (cb.trials || 0) > (ca.trials || 0) ? cb : ca,
    bestScore: Math.max(a.bestScore, b.bestScore),
    bestMeanRT: times.length ? Math.min(...times) : null,
    lastDifficulty: Math.max(a.lastDifficulty, b.lastDifficulty),
    plays: Math.max(a.plays, b.plays),
    demoSeen: a.demoSeen || b.demoSeen,
    // Оценката важи за следващата сесия на това устройство; при сливане се изчиства,
    // защото „по-новата“ не е определима без дата, а дати съзнателно не пазим.
    feel: null,
  };
}

// Отметките се обединяват. При конфликт печели по-новата дата: за усвояване и за срока на преговор.
export function mergeTopic(a, b) {
  const sm2 = !a.sm2 || !b.sm2 ? a.sm2 || b.sm2 : (a.sm2.due >= b.sm2.due ? a.sm2 : b.sm2);
  return {
    id: a.id,
    checked: a.checked || b.checked,
    mastered: a.mastered || b.mastered,
    masteredAt: newerDate(a.masteredAt, b.masteredAt),
    bestTest: Math.max(a.bestTest, b.bestTest),
    level: Math.max(a.level, b.level),
    sm2,
  };
}

function mergeById(listA, listB, mergeOne) {
  const out = new Map(listA.map((item) => [item.id, item]));
  for (const item of listB) {
    out.set(item.id, out.has(item.id) ? mergeOne(out.get(item.id), item) : item);
  }
  return [...out.values()];
}

// Сливане на съдържанието на ЕДИН профил. Настройките остават на устройството:
// темата и шрифтът важат за този екран, не за прогреса.
export function mergePayload(local, incoming, activeFor) {
  return {
    profile: mergeProfiles(local.profile, incoming.profile, activeFor),
    settings: local.settings,
    records: mergeById(local.records, incoming.records, mergeRecord),
    topics: mergeById(local.topics, incoming.topics, mergeTopic),
  };
}

// local и incoming са изчистени данни { meta, records, topics }. Настройките остават на устройството.
export function mergeData(local, incoming, activeFor) {
  const settings = local.meta.find((m) => m.key === 'settings');
  return {
    meta: [mergeProfiles(realProfile(local), realProfile(incoming), activeFor), ...(settings ? [settings] : [])],
    records: mergeById(local.records, incoming.records, mergeRecord),
    topics: mergeById(local.topics, incoming.topics, mergeTopic),
  };
}
