// Ръчен експорт и импорт в JSON: единственият мост между лаптопа и телефона.
// От Етап 6г копието съдържа профили. Заключеният профил излиза шифрован: файлът
// носи само кутията и обвивките на ключа, не и съдържанието в четим вид.
import { replaceEverything } from './db.js';
import { cleanProfileEntry, migrateLegacy } from './profiles.js';
import { SCHEMA_VERSION } from './model.js';

export const APP_ID = 'evolyutsiya-na-uma';
const MAX_CHARS = 20 * 1024 * 1024;

export class BackupError extends Error {}

export const isLocked = (entry) => Boolean(entry && entry.lock);

// „Последен експорт“ в Настройки: дата и час по местно време, без секунди.
// Празен или повреден запис дава null, за да може изгледът да каже „още няма“.
export function formatMoment(iso) {
  if (typeof iso !== 'string' || !iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  return `${at.getDate()}.${at.getMonth() + 1}.${at.getFullYear()}, ${time}`;
}

export function buildBackup(entries) {
  return {
    app: APP_ID,
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles: entries,
  };
}

// Чиста функция: от текст на файл до проверени профили. Хвърля BackupError с ясен текст.
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
  if (!Number.isInteger(obj.schema) || obj.schema < 1) {
    throw new BackupError('Копието е повредено: няма номер на версията.');
  }
  // Лаптопът и телефонът може да стоят на различни кеширани версии. Тогава по-старото
  // приложение няма как да прочете новия файл — казва го спокойно и НЕ пипа нищо.
  if (obj.schema > SCHEMA_VERSION) {
    throw new BackupError('Файлът е от по-нова версия. Отвори приложението с интернет, за да се обнови, и опитай пак.');
  }

  // Копие отпреди профилите: целият прогрес е един профил.
  if (!obj.profiles && obj.data) {
    const entry = migrateLegacy(obj.data, 'От копие');
    if (!entry) throw new BackupError('Данните за прогреса в копието са повредени.');
    return { profiles: [entry], legacy: true };
  }

  if (!Array.isArray(obj.profiles)) throw new BackupError('В копието липсват профили.');
  const profiles = obj.profiles.map(cleanProfileEntry).filter(Boolean);
  if (!profiles.length) throw new BackupError('Профилите в копието са повредени.');
  return { profiles, legacy: false };
}

// Кратко описание за сравнението „устройство / файл / резултат“.
export function summarizePayload(payload) {
  if (!payload) return { step: null, totalXP: null, records: null, mastered: null };
  const { profile } = payload;
  return {
    step: profile.step,
    totalXP: profile.totalXP,
    records: payload.records.length,
    mastered: payload.topics.filter((t) => t.mastered).length,
  };
}

// Заключеният профил не казва нищо повече от картата си, докато не се отключи.
export const summarizeEntry = (entry) => (entry.data
  ? summarizePayload(entry.data)
  : { step: entry.card.step, totalXP: entry.card.totalXP, records: null, mastered: null });

// Пълна замяна на профилите (само администратор). Старите три хранилища не се пипат:
// там стои прогресът отпреди профилите и той е последната мрежа при беда.
export const applyProfiles = (entries) => replaceEverything({ profiles: entries });
