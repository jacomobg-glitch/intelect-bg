// Ръчен експорт и импорт в JSON: единственият мост между лаптопа и телефона.
import { STORES, getAll, replaceEverything } from './db.js';
import { realProfile } from './merge.js';
import { SCHEMA_VERSION, cleanProfile, cleanRecord, cleanSettings, cleanTopic } from './model.js';

export const APP_ID = 'evolyutsiya-na-uma';
const MAX_CHARS = 5 * 1024 * 1024;

export class BackupError extends Error {}

const list = (x) => (Array.isArray(x) ? x : []);

// Изчиства суровите записи. Хвърля BackupError, ако прогресът е неизползваем.
export function normalizeData(data) {
  if (!data || !Array.isArray(data.meta)) throw new BackupError('В копието липсват данни.');

  const profile = cleanProfile(data.meta.find((m) => m && m.key === 'profile'));
  if (!profile) throw new BackupError('Данните за прогреса в копието са повредени.');

  const meta = [profile, cleanSettings(data.meta.find((m) => m && m.key === 'settings'))];
  const rawSnapshot = data.meta.find((m) => m && m.key === 'simSnapshot');
  if (rawSnapshot) {
    const saved = cleanProfile(rawSnapshot.profile);
    if (saved) meta.push({ key: 'simSnapshot', profile: saved });
  }
  return {
    meta,
    records: list(data.records).map(cleanRecord).filter(Boolean),
    topics: list(data.topics).map(cleanTopic).filter(Boolean),
  };
}

export async function readAllData() {
  const data = {};
  for (const name of STORES) data[name] = await getAll(name);
  return data;
}

export async function buildBackup() {
  return { app: APP_ID, schema: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: await readAllData() };
}

// Чиста функция: от текст на файл до проверени записи за базата. Хвърля BackupError с ясен текст.
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) throw new BackupError('Файлът е празен.');
  if (text.length > MAX_CHARS) throw new BackupError('Файлът е твърде голям за резервно копие.');
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new BackupError('Файлът не е валиден JSON.');
  }
  if (!obj || obj.app !== APP_ID) throw new BackupError('Това не е резервно копие на „Еволюция на ума“.');
  if (!Number.isInteger(obj.schema) || obj.schema < 1 || obj.schema > SCHEMA_VERSION) {
    throw new BackupError('Копието е от непозната версия. Обнови приложението и опитай пак.');
  }
  return normalizeData(obj.data);
}

export const applyBackup = (data) => replaceEverything(data);

// Кратко описание за сравнението „устройство / файл / резултат“.
export function summarize(data) {
  const profile = realProfile(data);
  return {
    step: profile.step,
    totalXP: profile.totalXP,
    records: data.records.length,
    mastered: data.topics.filter((t) => t.mastered).length,
  };
}
