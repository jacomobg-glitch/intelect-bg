// Състояние в паметта плюс запис в IndexedDB. Изгледите четат оттук.
import { CONFIG } from './config.js';
import { getAll, getOne, writeAll } from './db.js';
import { applyXP, difficultyCeiling, syncActivation } from './evolution.js';
import { activeSkills } from './registry.js';
import {
  cleanProfile, cleanRecord, cleanSettings, cleanTopic, defaultProfile, defaultRecord, defaultSettings, defaultTopic,
} from './model.js';

export const state = {
  profile: defaultProfile(),
  settings: defaultSettings(),
  records: new Map(),
  topics: new Map(),
  simSnapshot: null, // реалният прогрес, докато тестовият режим е включен
};

export async function loadState() {
  state.profile = cleanProfile(await getOne('meta', 'profile')) || defaultProfile();
  state.settings = cleanSettings(await getOne('meta', 'settings'));
  const snap = await getOne('meta', 'simSnapshot');
  state.simSnapshot = snap ? cleanProfile(snap.profile) : null;
  state.records = new Map((await getAll('records')).map(cleanRecord).filter(Boolean).map((r) => [r.id, r]));
  state.topics = new Map((await getAll('topics')).map(cleanTopic).filter(Boolean).map((t) => [t.id, t]));
}

// Вика се, след като модулите са регистрирани: новите способности започват да се броят от тази стъпка.
export async function syncActiveSkills() {
  const synced = syncActivation(state.profile, activeSkills);
  if (synced !== state.profile) await saveProfile(synced);
}

export const recordOf = (id) => state.records.get(id) || defaultRecord(id);
export const topicOf = (id) => state.topics.get(id) || defaultTopic(id);
export const maxDifficulty = () => difficultyCeiling(state.profile.step);

export async function saveProfile(profile) {
  state.profile = profile;
  await writeAll([{ store: 'meta', value: profile }]);
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await writeAll([{ store: 'meta', value: state.settings }]);
}

export async function saveTopic(topic) {
  state.topics.set(topic.id, topic);
  await writeAll([{ store: 'topics', value: topic }]);
}

export async function markDemoSeen(id) {
  const rec = { ...recordOf(id), demoSeen: true };
  state.records.set(id, rec);
  await writeAll([{ store: 'records', value: rec }]);
}

// Завършена сесия: рекорд, трудност и XP се записват заедно в една транзакция.
export async function completeSession(game) {
  const score = Math.max(0, Math.round(game.score()) || 0);
  const xp = Math.min(CONFIG.MAX_SESSION_XP, Math.max(0, Math.round(game.xpReward()) || 0));
  const stats = typeof game.stats === 'function' ? game.stats() : {};

  const prev = recordOf(game.id);
  const isRecord = score > 0 && score > prev.bestScore;
  const meanRT = Number.isFinite(stats.meanRT) ? stats.meanRT : null;
  const record = {
    ...prev,
    bestScore: Math.max(prev.bestScore, score),
    bestMeanRT: meanRT !== null && (prev.bestMeanRT === null || meanRT < prev.bestMeanRT) ? meanRT : prev.bestMeanRT,
    lastDifficulty: Math.max(1, game.difficulty),
    plays: prev.plays + 1,
    demoSeen: true,
  };
  const { profile, from, to } = applyXP(state.profile, xp, game.skills, activeSkills);

  await writeAll([{ store: 'records', value: record }, { store: 'meta', value: profile }]);
  state.records.set(game.id, record);
  state.profile = profile;
  return { score, xp, isRecord, from, to, stats, record };
}

// Искане браузърът да не изтрива данните при липса на място. При отказ не показва нищо.
export function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
