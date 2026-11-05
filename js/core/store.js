// Състояние в паметта плюс запис в IndexedDB. Изгледите четат оттук.
// От Етап 6г нататък всичко е в рамките на ЕДИН профил: в паметта стои само отвореният,
// а ключовете му не се записват никъде. Профилите не се виждат един друг.
import { coinsFor } from '../content/shop.js';
import { CONFIG } from './config.js';
import { decryptJson, encryptJson, openWithPassword } from './crypto.js';
import { PROFILES, getAll, getOne, writeAll } from './db.js';
import { applyXP, difficultyCeiling, syncActivation } from './evolution.js';
import {
  cardOf, cleanPayload, cleanProfileEntry, emptyPayload, lockoutMs, migrateLegacy,
} from './profiles.js';
import { activeSkills } from './registry.js';
import {
  FEELS, cleanProfile, defaultProfile, defaultRecord, defaultSettings, defaultTopic,
} from './model.js';

export const state = {
  profile: defaultProfile(),
  settings: defaultSettings(),
  records: new Map(),
  topics: new Map(),
  simSnapshot: null, // реалният прогрес, докато тестовият режим е включен

  profiles: [],      // всички записи: име, роля, карта. Съдържанието им е заключено.
  entry: null,       // отвореният профил
  keys: null,        // { dataKey, passwordKey } само в паметта, никога на диска
  adminKey: null,    // ключът на администратора, нужен за нулиране на детски ПИН
};

export const activeId = () => (state.entry ? state.entry.id : null);
export const isOpen = () => Boolean(state.entry);
export const isChild = () => state.entry?.role === 'child';
export const isAdmin = () => state.entry?.role === 'admin';
export const entryOf = (id) => state.profiles.find((p) => p.id === id) || null;

const byOrder = (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'bg');

// --- списък с профили и миграция ---

export async function loadProfiles() {
  const raw = await getAll(PROFILES);
  state.profiles = raw.map(cleanProfileEntry).filter(Boolean).sort(byOrder);
  if (!state.profiles.length) {
    const legacy = {
      meta: await getAll('meta'),
      records: await getAll('records'),
      topics: await getAll('topics'),
    };
    const first = migrateLegacy(legacy);
    if (first) {
      await writeAll([{ store: PROFILES, value: first }]);
      state.profiles = [first];
    }
  }
  return state.profiles;
}

export const needsPassword = (entry) => Boolean(entry && entry.lock);

// Колко опита за парола са правени на ТОВА устройство. Стои в localStorage, защото
// е мярка срещу налучкване тук и сега, а не част от прогреса.
const ATTEMPTS_KEY = 'evolyutsiya-attempts';

function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeAttempts(all) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch {
    // Без localStorage паузата важи само до затварянето на страницата.
  }
}

// Остатък от паузата в ms: 0 значи, че може да се опита пак.
export function waitingMs(id, now = Date.now()) {
  const info = readAttempts()[id];
  if (!info || !info.until) return 0;
  return Math.max(0, info.until - now);
}

function noteAttempt(id, ok, now = Date.now()) {
  const all = readAttempts();
  if (ok) {
    delete all[id];
  } else {
    const count = (all[id]?.count || 0) + 1;
    all[id] = { count, until: now + lockoutMs(count) };
  }
  writeAttempts(all);
}

// --- отваряне и затваряне на профил ---

function applyPayload(payload) {
  state.profile = payload.profile;
  state.settings = payload.settings;
  state.records = new Map(payload.records.map((r) => [r.id, r]));
  state.topics = new Map(payload.topics.map((t) => [t.id, t]));
  state.simSnapshot = payload.simSnapshot ? cleanProfile(payload.simSnapshot) : null;
}

const payloadOf = () => ({
  profile: state.profile,
  settings: state.settings,
  records: [...state.records.values()],
  topics: [...state.topics.values()],
  simSnapshot: state.simSnapshot,
});

// Отваря профил. За заключен профил иска паролата и връща причината при отказ,
// за да може екранът да каже какво става, без да гадае.
export async function openProfile(id, secret = null) {
  const entry = entryOf(id);
  if (!entry) return { ok: false, reason: 'missing' };

  if (!entry.lock) {
    state.entry = entry;
    state.keys = null;
    applyPayload(entry.data || emptyPayload());
    await writeAll([{ store: 'meta', value: { key: 'activeProfile', id } }]);
    return { ok: true };
  }

  const waiting = waitingMs(id);
  if (waiting > 0) return { ok: false, reason: 'waiting', waiting };
  if (!secret) return { ok: false, reason: 'locked' };

  const opened = await openWithPassword(entry.lock, secret);
  if (!opened) {
    noteAttempt(id, false);
    return { ok: false, reason: 'wrong', waiting: waitingMs(id) };
  }
  noteAttempt(id, true);

  const payload = cleanPayload(await decryptJson(opened.dataKey, entry.enc));
  if (!payload) return { ok: false, reason: 'broken' };
  state.entry = entry;
  state.keys = opened;
  if (entry.role === 'admin') state.adminKey = opened.passwordKey;
  applyPayload(payload);
  await writeAll([{ store: 'meta', value: { key: 'activeProfile', id } }]);
  return { ok: true };
}

// Затваря профила: ключовете изчезват от паметта заедно със съдържанието.
export function closeProfile() {
  state.entry = null;
  state.keys = null;
  state.adminKey = null;
  state.profile = defaultProfile();
  state.settings = defaultSettings();
  state.records = new Map();
  state.topics = new Map();
  state.simSnapshot = null;
}

export const lastActiveId = async () => (await getOne('meta', 'activeProfile'))?.id || null;

// --- запис ---

// Записва отворения профил. Заключеният се шифрова наново с ключа от паметта.
async function persist() {
  if (!state.entry) return;
  const payload = payloadOf();
  const card = cardOf(payload);
  const entry = state.keys
    ? { ...state.entry, card, enc: await encryptJson(state.keys.dataKey, payload), data: null }
    : { ...state.entry, card, data: payload, enc: null };
  state.entry = entry;
  state.profiles = state.profiles.map((p) => (p.id === entry.id ? entry : p));
  await writeAll([{ store: PROFILES, value: entry }]);
}

// Тестовият режим прибира истинския прогрес встрани, но вътре в същия профил.
export async function setSimSnapshot(profile) {
  state.simSnapshot = profile;
  await persist();
}

// Записва променен запис на профил (име, роля, ограничения) без да пипа съдържанието.
export async function saveEntry(entry) {
  state.profiles = state.profiles.map((p) => (p.id === entry.id ? entry : p)).sort(byOrder);
  if (state.entry && state.entry.id === entry.id) {
    state.entry = entry;
    // Ограниченията се смениха: приложението пренавива таймерите си.
    document.dispatchEvent(new CustomEvent('profile-entry'));
  }
  await writeAll([{ store: PROFILES, value: entry }]);
}

export async function addEntry(entry) {
  state.profiles = [...state.profiles, entry].sort(byOrder);
  await writeAll([{ store: PROFILES, value: entry }]);
}

export async function removeEntry(id) {
  state.profiles = state.profiles.filter((p) => p.id !== id);
  await writeAll([{ store: PROFILES, delete: id }]);
}

// Старият начин на зареждане остава за съвместимост: зарежда списъка и отваря
// последния профил, ако е без парола.
export async function loadState() {
  await loadProfiles();
  const id = await lastActiveId();
  const entry = entryOf(id) || (state.profiles.length === 1 ? state.profiles[0] : null);
  if (entry && !entry.lock) await openProfile(entry.id);
}

// Вика се, след като модулите са регистрирани: новите способности започват да се броят от тази стъпка.
export async function syncActiveSkills() {
  if (!state.entry) return;
  const synced = syncActivation(state.profile, activeSkills);
  if (synced !== state.profile) await saveProfile(synced);
}

export const recordOf = (id) => state.records.get(id) || defaultRecord(id);
export const topicOf = (id) => state.topics.get(id) || defaultTopic(id);
export const maxDifficulty = () => difficultyCeiling(state.profile.step);

// Купуване от магазина: монетите се харчат, предметът влиза в профила.
// Нищо тук не пипа XP, трудност или отключвания — магазинът е само украса.
export async function buyItem(item) {
  const coins = state.profile.coins || 0;
  const owned = state.profile.owned || [];
  if (!item || owned.includes(item.id) || coins < item.price) return false;
  state.profile = { ...state.profile, coins: coins - item.price, owned: [...owned, item.id] };
  await persist();
  return true;
}

// Детският профил се качва по-бавно: трябва един верен отговор повече, за да се вдигне
// трудността, а началната е с една стъпка по-ниска.
export const staircaseUp = () => CONFIG.STAIRCASE_UP + (isChild() ? 1 : 0);
export const childStart = (level) => (isChild() ? Math.max(1, level - 1) : level);

// Игрите, скрити за този профил. Администраторът ги управлява от Настройки.
export const hiddenGames = () => new Set(state.entry?.hiddenGames || []);
export const isHidden = (gameId) => hiddenGames().has(gameId);

export async function saveProfile(profile) {
  state.profile = profile;
  await persist();
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await persist();
}

export async function saveTopic(topic) {
  state.topics.set(topic.id, topic);
  await persist();
}

// „Лесно / Точно / Трудно“ след игра. По желание, без напомняне, само последната оценка.
export async function saveFeel(id, feel) {
  if (!FEELS.includes(feel)) return;
  state.records.set(id, { ...recordOf(id), feel });
  await persist();
}

export async function markDemoSeen(id) {
  state.records.set(id, { ...recordOf(id), demoSeen: true });
  await persist();
}

// Завършена сесия: рекорд, трудност и XP се записват заедно.
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
    feel: null, // оценката важи за точно една сесия; тази вече я ползва
  };
  const { profile, from, to } = applyXP(state.profile, xp, game.skills, activeSkills);
  // Монетите идват от същата сесия и от същия XP: друг начин да се печелят няма.
  const coins = coinsFor(xp);
  const withCoins = { ...profile, coins: (profile.coins || 0) + coins };

  state.records.set(game.id, record);
  state.profile = withCoins;
  await persist();
  return { score, xp, coins, isRecord, from, to, stats, record };
}

// Искане браузърът да не изтрива данните при липса на място. Най-добре се иска
// веднага след истинско действие на човека (създаване на профил), затова се вика и там.
export async function requestPersistence() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

// Какво казва браузърът за хранилището: трайно ли е и колко място ползваме.
export async function storageStatus() {
  const out = { persisted: null, usage: null, quota: null };
  if (!navigator.storage) return out;
  try {
    if (navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      out.usage = usage ?? null;
      out.quota = quota ?? null;
    }
  } catch {
    // Браузърът не казва: показваме „не се знае“, вместо да гадаем.
  }
  return out;
}
