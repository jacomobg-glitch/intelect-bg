// Шифроване на профилите с WebCrypto. Без външни библиотеки и без сървър:
// ключът се ражда от паролата на устройството и никъде не се записва.
//
// Схемата е нарочно проста:
//   парола + salt --PBKDF2--> ключ на паролата (PK)
//   случаен ключ на данните (DK) шифрова целия профил с AES-GCM
//   DK се пази САМО обвит: с PK на профила, а при детските профили и с PK на администратора.
// Така смяната на ПИН не пипа данните: сменя се само обвивката, не ключът отдолу.

export const KDF_ITERATIONS = 210000; // изискването е поне 200 000
const SALT_BYTES = 16;
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// base64 на части: един огромен apply() върху цял профил може да препълни стека.
export function toB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

export const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export const newSalt = () => toB64(randomBytes(SALT_BYTES));

// Ключ от парола. Бавното място е тук, нарочно: 210 000 итерации правят налучкването скъпо.
export async function deriveKey(password, saltB64, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Ключът на данните е случаен, а не изведен от паролата: затова паролата се сменя
// без прекодиране на целия профил.
export const generateDataKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const importDataKey = (bytes) => crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

export const exportDataKey = async (key) => new Uint8Array(await crypto.subtle.exportKey('raw', key));

// Кутия: { iv, ct } в base64. Нищо извън нея не е нужно за разшифроване освен ключа.
export async function encryptBytes(key, bytes) {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

export async function decryptBytes(key, box) {
  if (!box || typeof box.iv !== 'string' || typeof box.ct !== 'string') throw new Error('Повредена кутия.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
  return new Uint8Array(plain);
}

export const encryptJson = (key, value) => encryptBytes(key, encoder.encode(JSON.stringify(value)));

export async function decryptJson(key, box) {
  return JSON.parse(decoder.decode(await decryptBytes(key, box)));
}

export const wrapDataKey = async (dataKey, wrappingKey) => encryptBytes(wrappingKey, await exportDataKey(dataKey));

export const unwrapDataKey = async (box, wrappingKey) => importDataKey(await decryptBytes(wrappingKey, box));

// Вярна ли е паролата: проверява се с опит да се разшифрова обвивката. AES-GCM носи
// собствен етикет за цялост, затова грешната парола се вижда веднага и няма нужда
// да пазим отделен хеш на паролата.
export async function openWithPassword(lock, password) {
  const key = await deriveKey(password, lock.salt, lock.iterations);
  try {
    return { dataKey: await unwrapDataKey(lock.wrapSelf, key), passwordKey: key };
  } catch {
    return null;
  }
}
