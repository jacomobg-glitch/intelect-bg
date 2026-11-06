// Етап 6г: профили, пароли и шифроване. Криптото се проверява с истинския WebCrypto
// на Node, а не с подменен: иначе тестът не доказва нищо за браузъра.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  KDF_ITERATIONS, decryptJson, deriveKey, encryptJson, generateDataKey, newSalt,
  openWithPassword, unwrapDataKey, wrapDataKey,
} from '../js/core/crypto.js';
import {
  CHILD_HIDDEN_GAMES, LOCKOUT_AFTER, ROLES, checkSecret, cleanProfileEntry, defaultProfileEntry,
  emptyPayload, lockProfile, lockoutMs, migrateLegacy, cleanName, cardOf, isPin,
} from '../js/core/profiles.js';
import { SCHEMA_VERSION, defaultProfile, defaultRecord, defaultSettings, defaultTopic } from '../js/core/model.js';
import { buildBackup, parseBackup, summarizeEntry, summarizePayload } from '../js/core/backup.js';
import { mergePayload } from '../js/core/merge.js';
import { SKILLS } from '../js/core/config.js';

// Бързо извеждане за тестовете: истинските 210 000 итерации на всяка проверка биха
// направили набора бавен. Броят итерации се проверява отделно.
const FAST = 1000;

test('ключът от парола: същата парола дава ключ, който чете; друга не чете', async () => {
  const salt = newSalt();
  const key = await deriveKey('правилна парола', salt, FAST);
  const box = await encryptJson(key, { tajna: 42 });
  assert.deepEqual(await decryptJson(key, box), { tajna: 42 });

  const other = await deriveKey('друга парола', salt, FAST);
  await assert.rejects(() => decryptJson(other, box), 'грешната парола не бива да отваря');
  // Друг salt със същата парола също не отваря: salt-ът е уникален за профил.
  const elsewhere = await deriveKey('правилна парола', newSalt(), FAST);
  await assert.rejects(() => decryptJson(elsewhere, box));
});

test('шифрованото не съдържа текста: в базата се вижда само шум', async () => {
  const key = await deriveKey('парола123', newSalt(), FAST);
  const box = await encryptJson(key, { profile: { totalXP: 1234 }, име: 'Иванчо' });
  assert.doesNotMatch(box.ct, /Иванчо|totalXP|1234/);
  assert.ok(box.iv.length > 10 && box.ct.length > 20);
  // Два пъти едно и също съдържание дава различен шифър: IV е нов всеки път.
  const again = await encryptJson(key, { profile: { totalXP: 1234 }, име: 'Иванчо' });
  assert.notEqual(box.ct, again.ct);
});

test('ключът на данните се обвива с паролата и се разопакова обратно', async () => {
  const dataKey = await generateDataKey();
  const pk = await deriveKey('1234', newSalt(), FAST);
  const wrapped = await wrapDataKey(dataKey, pk);
  const back = await unwrapDataKey(wrapped, pk);
  const box = await encryptJson(dataKey, { a: 1 });
  assert.deepEqual(await decryptJson(back, box), { a: 1 }, 'разопакованият ключ е същият');
});

test('заключване и отключване на профил, без да се пипат данните', async () => {
  const entry = defaultProfileEntry({ name: 'Дете', role: 'child' });
  entry.data = { ...emptyPayload(), profile: { ...defaultProfile(), totalXP: 500, step: 3 } };
  const locked = await lockProfile(entry, '4321');

  assert.equal(locked.data, null, 'чистият текст изчезва');
  assert.ok(locked.enc && locked.enc.ct, 'остава само шифрованото');
  assert.ok(locked.lock.iterations >= 200000, 'итерациите са поне 200 000');
  assert.equal(locked.lock.iterations, KDF_ITERATIONS);
  assert.notEqual(locked.lock.salt, defaultProfileEntry().id, 'salt-ът е собствен');

  const opened = await openWithPassword(locked.lock, '4321');
  assert.ok(opened, 'верният ПИН отваря');
  const payload = await decryptJson(opened.dataKey, locked.enc);
  assert.equal(payload.profile.totalXP, 500);
  assert.equal(payload.profile.step, 3);
  assert.equal(await openWithPassword(locked.lock, '1111'), null, 'грешният ПИН не отваря');
});

test('администраторът нулира детски ПИН, а прогресът остава', async () => {
  const adminKey = await deriveKey('администраторска парола', newSalt(), FAST);
  const child = defaultProfileEntry({ name: 'Дете', role: 'child' });
  child.data = { ...emptyPayload(), profile: { ...defaultProfile(), totalXP: 777, step: 5 } };
  const locked = await lockProfile(child, '1234', { adminKey });
  assert.ok(locked.lock.wrapAdmin, 'ключът е обвит и с администраторския');

  // Детето е забравило ПИН-а. Администраторът отваря ключа със своя и слага нов ПИН.
  const dataKey = await unwrapDataKey(locked.lock.wrapAdmin, adminKey);
  const reset = await lockProfile({ ...locked, data: null }, '9876', { dataKey, adminKey });

  assert.equal(await openWithPassword(reset.lock, '1234'), null, 'старият ПИН вече не върши работа');
  const opened = await openWithPassword(reset.lock, '9876');
  assert.ok(opened, 'новият ПИН отваря');
  const payload = await decryptJson(opened.dataKey, reset.enc);
  assert.equal(payload.profile.totalXP, 777, 'прогресът е непокътнат');
  assert.equal(payload.profile.step, 5);
});

test('смяна на собствената парола не праща данните на боклука', async () => {
  const entry = defaultProfileEntry({ name: 'Аз', role: 'admin' });
  entry.data = { ...emptyPayload(), profile: { ...defaultProfile(), totalXP: 120 } };
  const first = await lockProfile(entry, 'старапарола');
  const opened = await openWithPassword(first.lock, 'старапарола');
  const second = await lockProfile({ ...first, data: null }, 'новапарола', { dataKey: opened.dataKey });
  const again = await openWithPassword(second.lock, 'новапарола');
  assert.ok(again);
  assert.equal((await decryptJson(again.dataKey, second.enc)).profile.totalXP, 120);
  assert.equal(second.enc.ct, first.enc.ct, 'съдържанието не се прекодира излишно');
});

test('правила за паролата и за ПИН-а', () => {
  assert.equal(checkSecret('1234'), null);
  assert.equal(checkSecret('123456'), null);
  assert.ok(checkSecret('123'), 'три цифри са малко');
  assert.ok(checkSecret('1234567'), 'седем цифри вече не са ПИН');
  assert.equal(checkSecret('тайнапарола'), null);
  assert.ok(checkSecret('кратко'.slice(0, 5)));
  assert.ok(checkSecret(''));
  assert.ok(checkSecret(undefined));
  assert.equal(isPin('0000'), true);
  assert.equal(isPin('abcd'), false);
});

test('пауза при налучкване: расте, но никога не е завинаги', () => {
  for (let i = 0; i < LOCKOUT_AFTER; i += 1) assert.equal(lockoutMs(i), 0, `опит ${i}`);
  assert.equal(lockoutMs(5), 30000);
  assert.equal(lockoutMs(6), 120000);
  assert.equal(lockoutMs(50), 120000, 'таванът си остава 2 минути');
});

test('запис на профил от чужд файл се изчиства, а повреденият се отхвърля', () => {
  assert.equal(cleanProfileEntry(null), null);
  assert.equal(cleanProfileEntry({ id: 'ГОЛЕМИ БУКВИ' }), null);
  assert.equal(cleanProfileEntry({ id: 'p1', data: { profile: { totalXP: -5 } } }), null, 'повреден прогрес');
  assert.equal(cleanProfileEntry({ id: 'p1', lock: { salt: 'x' } }), null, 'заключен без шифровани данни');

  const clean = cleanProfileEntry({
    id: 'p1',
    name: '   Много дълго име, което никой не е писал на ръка   ',
    role: 'измислена',
    data: { profile: defaultProfile(), records: [defaultRecord('stroop'), { id: 'ЛОШ' }], topics: [defaultTopic('count-1')] },
    hiddenGames: ['multitask', 'ЛОШ'],
    sessionLimitMin: 9999,
    autoLockMin: -3,
  });
  assert.equal(clean.role, 'person', 'непозната роля пада до обикновен профил');
  assert.ok(clean.name.length <= 24);
  assert.equal(clean.data.records.length, 1, 'повреденият рекорд отпада');
  assert.deepEqual(clean.hiddenGames, ['multitask']);
  assert.equal(clean.sessionLimitMin, 240, 'таван на сесията');
  assert.equal(clean.autoLockMin, 15, 'отрицателно време пада до стойността по подразбиране');
});

test('новият детски профил скрива двете най-тежки игри, а другите роли не', () => {
  assert.deepEqual(defaultProfileEntry({ role: 'child' }).hiddenGames, [...CHILD_HIDDEN_GAMES]);
  assert.deepEqual(defaultProfileEntry({ role: 'admin' }).hiddenGames, []);
  assert.deepEqual(defaultProfileEntry({ role: 'person' }).hiddenGames, []);
  for (const role of ROLES) assert.ok(defaultProfileEntry({ role }).id.length > 3);
  assert.equal(cleanName('   '), 'Профил');
  assert.equal(cleanName('  Иво  Иванов '), 'Иво Иванов');
});

test('миграция: старият единичен прогрес става първи профил и нищо не се губи', () => {
  const legacy = {
    meta: [
      { key: 'profile', totalXP: 4210, skillXP: { memory: 700, attention: 700, speed: 700, logic: 700, math: 710, flexibility: 700 }, step: 11, activationSteps: { memory: 0 } },
      { key: 'settings', theme: 'light', colorFree: true },
    ],
    records: [{ ...defaultRecord('stroop'), bestScore: 900, plays: 12 }, { id: 'ЛОШ' }],
    topics: [{ ...defaultTopic('count-1'), mastered: true, masteredAt: '2026-10-01' }],
  };
  const entry = migrateLegacy(legacy, 'Ивайло');
  assert.equal(entry.role, 'admin');
  assert.equal(entry.name, 'Ивайло');
  assert.equal(entry.data.profile.totalXP, 4210);
  assert.equal(entry.data.profile.step, 11);
  assert.equal(entry.data.profile.activationSteps.memory, 0);
  assert.equal(entry.data.settings.theme, 'light');
  assert.equal(entry.data.settings.colorFree, true);
  assert.equal(entry.data.records.length, 1);
  assert.equal(entry.data.records[0].bestScore, 900);
  assert.equal(entry.data.topics[0].mastered, true);
  assert.equal(entry.data.topics[0].masteredAt, '2026-10-01');
  // Картата показва точно това, което е в профила: без сравнения и без чужди числа.
  assert.deepEqual(entry.card, cardOf(entry.data));
  assert.equal(entry.card.step, 11);
  // Без стар прогрес няма какво да се мигрира.
  assert.equal(migrateLegacy({ meta: [] }), null);
});

// --- копие и сливане по профили ---

const payload = (xp, step = 0, extra = {}) => ({
  profile: { ...defaultProfile(), totalXP: xp, step, skillXP: Object.fromEntries(SKILLS.map((s) => [s, xp / 6])) },
  settings: defaultSettings(),
  records: [],
  topics: [],
  ...extra,
});

test('сливане по профили: взема по-доброто, а настройките остават на устройството', () => {
  const local = payload(600, 2, {
    settings: { ...defaultSettings(), theme: 'dark' },
    records: [{ ...defaultRecord('stroop'), bestScore: 10, bestMeanRT: 400 }],
    topics: [defaultTopic('count-1')],
  });
  const incoming = payload(900, 3, {
    settings: { ...defaultSettings(), theme: 'light' },
    records: [{ ...defaultRecord('stroop'), bestScore: 7, bestMeanRT: 320 }, { ...defaultRecord('nback'), bestScore: 5 }],
    topics: [{ ...defaultTopic('count-2'), mastered: true, masteredAt: '2026-02-02' }],
  });
  const merged = mergePayload(local, incoming, () => SKILLS);

  assert.equal(merged.settings.theme, 'dark', 'настройките не пътуват с копието');
  assert.equal(merged.records.length, 2);
  const stroop = merged.records.find((r) => r.id === 'stroop');
  assert.equal(stroop.bestScore, 10, 'печели по-високият резултат');
  assert.equal(stroop.bestMeanRT, 320, 'печели по-бързото време');
  assert.equal(merged.topics.length, 2);
  assert.ok(merged.profile.totalXP >= 900);
  assert.ok(merged.profile.step >= 3, 'достигнатата стъпка не се отнема');
  assert.equal(merged.simSnapshot, undefined, 'изтритият тестов режим не оставя поле след себе си');
  assert.equal(summarizePayload(merged).records, 2);
});

test('копието носи профилите, а заключеният излиза шифрован', async () => {
  const open = defaultProfileEntry({ name: 'Аз', role: 'admin' });
  open.data = payload(1000, 4, { records: [{ ...defaultRecord('stroop'), bestScore: 123 }] });
  open.card = cardOf(open.data);

  const kid = defaultProfileEntry({ name: 'Дете', role: 'child', order: 1 });
  kid.data = payload(300, 1);
  kid.card = cardOf(kid.data);
  const lockedKid = await lockProfile(kid, '2468');

  const file = JSON.stringify(buildBackup([open, lockedKid]));
  assert.doesNotMatch(file, /2468/, 'ПИН-ът го няма във файла');
  // Шифрованият профил не издава нищо освен картата си.
  assert.equal(file.includes('"name":"Дете"'), true);
  const back = parseBackup(file);
  assert.equal(back.legacy, false);
  assert.equal(back.profiles.length, 2);

  const [first, second] = back.profiles;
  assert.equal(first.data.records[0].bestScore, 123);
  assert.equal(second.data, null, 'заключеният няма чист текст');
  assert.ok(second.enc.ct.length > 20);
  assert.equal(summarizeEntry(second).records, null, 'за заключен профил броят записи не се знае');
  assert.equal(summarizeEntry(second).step, 1, 'картата показва само стъпката');
  // Съдържанието се чете единствено с ПИН-а.
  const opened = await openWithPassword(second.lock, '2468');
  assert.ok(opened);
  assert.equal((await decryptJson(opened.dataKey, second.enc)).profile.totalXP, 300);
  assert.equal(SCHEMA_VERSION, 2);
});

test('профилите не се смесват: всеки запис носи своето съдържание', () => {
  const a = defaultProfileEntry({ name: 'А' });
  a.data = payload(100);
  const b = defaultProfileEntry({ name: 'Б', order: 1 });
  b.data = payload(900, 3);
  assert.notEqual(a.id, b.id);
  assert.equal(a.data.profile.totalXP, 100);
  assert.equal(b.data.profile.totalXP, 900);
  // Промяна в единия не докосва другия.
  a.data.profile.totalXP = 101;
  assert.equal(b.data.profile.totalXP, 900);
  assert.equal(cardOf(b.data).step, 3);
});
