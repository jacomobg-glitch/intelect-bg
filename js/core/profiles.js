// Профили: кой тренира, каква роля има и как стои заключен. Чиста логика без DOM,
// за да се тества директно. Самото шифроване е в crypto.js, записът — в db.js.
import { KDF_ITERATIONS, deriveKey, encryptJson, generateDataKey, newSalt, wrapDataKey } from './crypto.js';
import { cleanProfile, cleanRecord, cleanSettings, cleanTopic, defaultProfile, defaultSettings } from './model.js';

export const ROLES = Object.freeze(['admin', 'person', 'child']);
export const ROLE_LABELS = Object.freeze({ admin: 'Администратор', person: 'Обикновен', child: 'Детски' });

// Детският профил не вижда двете най-тежки пилотски игри, докато администраторът не ги пусне.
export const CHILD_HIDDEN_GAMES = Object.freeze(['multitask', 'instruments']);

const ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const NAME_MAX = 24;

export const newProfileId = () => (crypto.randomUUID ? crypto.randomUUID() : `p${Date.now().toString(36)}`);

// Името е каквото човек си напише, но без празно и без да чупи оформлението.
export function cleanName(raw, fallback = 'Профил') {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
  return name || fallback;
}

export const isPin = (secret) => /^\d{4,6}$/.test(secret);

// Парола или ПИН: ПИН-ът е 4–6 цифри, паролата е поне 6 знака. Празно значи „без заключване“.
export function checkSecret(secret) {
  if (typeof secret !== 'string' || !secret) return 'Полето е празно.';
  if (/^\d+$/.test(secret)) return isPin(secret) ? null : 'ПИН-ът е от 4 до 6 цифри.';
  return secret.length >= 6 ? null : 'Паролата е поне 6 знака.';
}

export const emptyPayload = () => ({
  profile: defaultProfile(),
  settings: defaultSettings(),
  records: [],
  topics: [],
});

// Какво се вижда на картата „Кой тренира?“, без да се отключва профилът.
// Нарочно само толкова: име, докъде е стигнал и колко XP има. Без сравнения с други.
export const cardOf = (payload) => ({
  step: payload.profile.step,
  totalXP: payload.profile.totalXP,
});

export function defaultProfileEntry({ id = newProfileId(), name = 'Профил', role = 'person', order = 0 } = {}) {
  return {
    id,
    name: cleanName(name),
    role: ROLES.includes(role) ? role : 'person',
    order,
    card: cardOf(emptyPayload()),
    lock: null,          // null значи профил без парола
    data: emptyPayload(),// чист текст, докато няма парола
    enc: null,           // кутия { iv, ct }, когато има парола
    hiddenGames: role === 'child' ? [...CHILD_HIDDEN_GAMES] : [],
    sessionLimitMin: 0,  // 0 значи без таван на сесията
    autoLockMin: 15,     // автоматичен изход при бездействие; 0 го изключва
  };
}

// Проверява чужд запис (например от файл) и връща изчистено копие или null.
export function cleanProfileEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null;
  const entry = defaultProfileEntry({ id: raw.id, name: raw.name, role: raw.role, order: Number.isInteger(raw.order) ? raw.order : 0 });
  entry.hiddenGames = Array.isArray(raw.hiddenGames) ? raw.hiddenGames.filter((g) => typeof g === 'string' && ID_PATTERN.test(g)) : [];
  entry.sessionLimitMin = Number.isInteger(raw.sessionLimitMin) && raw.sessionLimitMin >= 0 ? Math.min(240, raw.sessionLimitMin) : 0;
  entry.autoLockMin = Number.isInteger(raw.autoLockMin) && raw.autoLockMin >= 0 ? Math.min(240, raw.autoLockMin) : 15;

  if (raw.lock) {
    const lock = cleanLock(raw.lock);
    if (!lock) return null;
    if (!raw.enc || typeof raw.enc.iv !== 'string' || typeof raw.enc.ct !== 'string') return null;
    entry.lock = lock;
    entry.enc = { iv: raw.enc.iv, ct: raw.enc.ct };
    entry.data = null;
  } else {
    const data = cleanPayload(raw.data);
    if (!data) return null;
    entry.data = data;
  }
  entry.card = cleanCard(raw.card) || (entry.data ? cardOf(entry.data) : { step: 0, totalXP: 0 });
  return entry;
}

function cleanBox(raw) {
  return raw && typeof raw.iv === 'string' && typeof raw.ct === 'string' ? { iv: raw.iv, ct: raw.ct } : null;
}

export function cleanLock(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.salt !== 'string') return null;
  const wrapSelf = cleanBox(raw.wrapSelf);
  if (!wrapSelf) return null;
  const iterations = Number.isInteger(raw.iterations) && raw.iterations >= 200000 ? raw.iterations : KDF_ITERATIONS;
  return { salt: raw.salt, iterations, wrapSelf, wrapAdmin: cleanBox(raw.wrapAdmin) };
}

function cleanCard(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const step = Number.isInteger(raw.step) && raw.step >= 0 ? raw.step : 0;
  const totalXP = typeof raw.totalXP === 'number' && raw.totalXP >= 0 ? raw.totalXP : 0;
  return { step, totalXP };
}

// Съдържанието на един профил: същите проверки, които пазят и единичния прогрес.
export function cleanPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const profile = cleanProfile(raw.profile);
  if (!profile) return null;
  return {
    profile,
    settings: cleanSettings(raw.settings),
    records: Array.isArray(raw.records) ? raw.records.map(cleanRecord).filter(Boolean) : [],
    topics: Array.isArray(raw.topics) ? raw.topics.map(cleanTopic).filter(Boolean) : [],
    // Тестовият режим пази истинския прогрес тук, вътре в профила, а не отстрани.
    simSnapshot: cleanProfile(raw.simSnapshot),
  };
}

// Старият единичен прогрес става първи профил: администраторът. Нищо не се губи,
// защото съдържанието минава през същите проверки, с които е било записано.
export function migrateLegacy(legacy, name = 'Аз') {
  const profile = cleanProfile((legacy.meta || []).find((m) => m && m.key === 'profile'));
  if (!profile) return null;
  const entry = defaultProfileEntry({ name, role: 'admin', order: 0 });
  entry.data = {
    profile,
    settings: cleanSettings((legacy.meta || []).find((m) => m && m.key === 'settings')),
    records: (legacy.records || []).map(cleanRecord).filter(Boolean),
    topics: (legacy.topics || []).map(cleanTopic).filter(Boolean),
  };
  entry.card = cardOf(entry.data);
  return entry;
}

// Пауза след сгрешена парола. След 5 опита 30 секунди, после по 2 минути.
// Никога завинаги: заключен завинаги профил е загубен профил.
export const LOCKOUT_AFTER = 5;
export function lockoutMs(attempts) {
  if (attempts < LOCKOUT_AFTER) return 0;
  return attempts === LOCKOUT_AFTER ? 30000 : 120000;
}

// Заключва профил с нова парола. dataKey се подава, когато вече има шифровани данни
// (смяна на парола), и се ражда наново само при първото заключване.
export async function lockProfile(entry, secret, { dataKey = null, adminKey = null } = {}) {
  const key = dataKey || await generateDataKey();
  const salt = newSalt();
  const passwordKey = await deriveKey(secret, salt, KDF_ITERATIONS);
  const lock = {
    salt,
    iterations: KDF_ITERATIONS,
    wrapSelf: await wrapDataKey(key, passwordKey),
    wrapAdmin: adminKey ? await wrapDataKey(key, adminKey) : (entry.lock ? entry.lock.wrapAdmin : null),
  };
  const payload = entry.data || emptyPayload();
  return {
    ...entry,
    lock,
    enc: entry.enc && !entry.data ? entry.enc : await encryptJson(key, payload),
    data: null,
    card: entry.card,
  };
}
