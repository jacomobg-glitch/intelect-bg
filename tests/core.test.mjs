import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BackupError, formatMoment, parseBackup, APP_ID } from '../js/core/backup.js';
import { CONFIG, SKILLS } from '../js/core/config.js';
import {
  CUMULATIVE_XP, STEP_COSTS, TARGET_TOTAL_XP, TOTAL_STEPS, applyXP, canReach, creatureIndex,
  difficultyCeiling, levelFromXP, nextStepInfo, requiredLevel, sessionXP, subLabel,
} from '../js/core/evolution.js';
import { defaultProfile } from '../js/core/model.js';
import { validateGame } from '../js/core/registry.js';
import nature from '../js/content/skins/nature.js';
import games from '../js/modules/index.js';
import { buildManifest, render } from '../tools/gen-precache.mjs';

const balanced = (xpTotal) => applyXP(defaultProfile(), xpTotal, SKILLS).profile;

test('стълбата има 45 стъпки и 15 същества', () => {
  assert.equal(TOTAL_STEPS, 45);
  assert.equal(nature.creatures.length, 15);
  assert.equal(STEP_COSTS.length, 44);
  assert.equal(creatureIndex(44), 14);
  assert.equal(subLabel(44), 'III');
});

test('темпото отговаря на избраните 150 часа', () => {
  const hours = CUMULATIVE_XP[44] / CONFIG.XP_PER_MINUTE / 60;
  assert.ok(Math.abs(hours - 150) < 1.5, `получени ${hours} часа`);
  assert.equal(TARGET_TOTAL_XP, 90000);
  const minutes = (xp) => xp / CONFIG.XP_PER_MINUTE;
  assert.ok(minutes(STEP_COSTS[0]) >= 10 && minutes(STEP_COSTS[0]) <= 20);
  const last = minutes(STEP_COSTS[43]) / 60;
  assert.ok(last >= 6 && last <= 8, `последна стъпка ${last} ч`);
});

test('цените и минималните нива никога не намаляват', () => {
  for (let i = 1; i < STEP_COSTS.length; i += 1) assert.ok(STEP_COSTS[i] >= STEP_COSTS[i - 1]);
  for (let s = 1; s < TOTAL_STEPS; s += 1) assert.ok(requiredLevel(s) >= requiredLevel(s - 1));
});

test('балансиран напредък стига до Мъдрец III точно при нужния XP', () => {
  assert.equal(balanced(CUMULATIVE_XP[44] - 10).step, 43);
  assert.equal(balanced(CUMULATIVE_XP[44]).step, 44);
});

test('всяка стъпка е достижима при балансиран напредък', () => {
  for (let s = 1; s < TOTAL_STEPS; s += 1) {
    assert.ok(canReach(balanced(CUMULATIVE_XP[s]), s), `стъпка ${s}`);
  }
});

test('прогресът не може да се напомпа само с една способност', () => {
  const pumped = applyXP(defaultProfile(), 90000, ['speed']);
  assert.equal(pumped.to, 0);
  const info = nextStepInfo(pumped.profile);
  assert.equal(info.xpReady, true);
  assert.deepEqual(info.blocked.sort(), ['attention', 'flexibility', 'logic', 'math', 'memory']);
});

test('една изоставена способност спира изкачването, а след това то продължава', () => {
  const noLogic = SKILLS.filter((s) => s !== 'logic');
  const held = applyXP(defaultProfile(), 5000, noLogic);
  assert.equal(held.to, 0);
  const freed = applyXP(held.profile, 200, ['logic']);
  assert.ok(freed.to > 0, 'след тренировка на логика стъпките се наваксват');
});

test('прогресът никога не намалява', () => {
  const high = { ...balanced(5000) };
  const lowered = { ...high, totalXP: 0, skillXP: defaultProfile().skillXP };
  assert.equal(applyXP(lowered, 1, ['speed']).profile.step, high.step);
});

test('XP не се дава при невалидни входни данни', () => {
  const p = defaultProfile();
  assert.equal(applyXP(p, -5, ['speed']).profile.totalXP, 0);
  assert.equal(applyXP(p, NaN, ['speed']).profile.totalXP, 0);
  assert.equal(applyXP(p, 10, ['unknown']).profile.totalXP, 0);
});

test('нивото следва формулата', () => {
  assert.equal(levelFromXP(0), 0);
  assert.equal(levelFromXP(5.9), 0);
  assert.equal(levelFromXP(6), 1);
  assert.equal(levelFromXP(24), 2);
});

test('XP за сесия: минута при средно качество е около 10 XP, с таван', () => {
  assert.equal(sessionXP({ activeMs: 60000, quality: 0.7 }), Math.round(10 * 1.06));
  assert.equal(sessionXP({ activeMs: 60000, quality: 0 }), 5);
  assert.equal(sessionXP({ activeMs: 3600000, quality: 1 }), CONFIG.MAX_SESSION_XP);
});

test('таванът на трудността расте с всяко същество', () => {
  assert.equal(difficultyCeiling(0), 3);
  assert.equal(difficultyCeiling(2), 3);
  assert.equal(difficultyCeiling(3), 5);
});

test('следващата стъпка на върха', () => {
  const info = nextStepInfo({ ...balanced(CUMULATIVE_XP[44]) });
  assert.equal(info.isMax, true);
  assert.equal(info.fraction, 1);
});

const validBackup = () => ({
  app: APP_ID,
  schema: 1,
  exportedAt: '2026-11-04T00:00:00.000Z',
  data: {
    meta: [balanced(1000), { key: 'settings', theme: 'light', skin: 'nature' }],
    records: [{ id: 'fireflies', bestScore: 50, bestMeanRT: 320, lastDifficulty: 2, plays: 3, demoSeen: true }],
    topics: [],
  },
});

test('импорт: валидно копие минава', () => {
  const parsed = parseBackup(JSON.stringify(validBackup()));
  assert.equal(parsed.records[0].bestScore, 50);
  assert.equal(parsed.meta.find((m) => m.key === 'settings').theme, 'light');
});

test('импорт: повредени файлове се отхвърлят с разбираема грешка', () => {
  const cases = [
    'не е json',
    JSON.stringify({ app: 'друго' }),
    JSON.stringify({ ...validBackup(), schema: 999 }),
    JSON.stringify({ ...validBackup(), data: { meta: [] } }),
    JSON.stringify({ ...validBackup(), data: { meta: [{ key: 'profile', totalXP: -1, step: 0, skillXP: {} }] } }),
    JSON.stringify({ ...validBackup(), data: { meta: [{ ...balanced(10), step: 99 }] } }),
  ];
  for (const text of cases) assert.throws(() => parseBackup(text), BackupError, text);
});

test('импорт: непознати полета и невалидни записи се изчистват', () => {
  const b = validBackup();
  b.data.meta[0].evil = '<script>';
  b.data.records.push({ id: '../hack', bestScore: 1 });
  b.data.records.push({ id: 'ok-id', bestScore: 'много' });
  const parsed = parseBackup(JSON.stringify(b));
  assert.equal(parsed.meta[0].evil, undefined);
  assert.deepEqual(parsed.records.map((r) => r.id), ['fireflies', 'ok-id']);
  assert.equal(parsed.records[1].bestScore, 0);
});

test('модел на данните: няма дати на активност и история', () => {
  const backup = JSON.stringify(defaultProfile());
  assert.doesNotMatch(backup, /date|time|streak|last|history/i);
});

test('всички модули спазват общия интерфейс', () => {
  assert.ok(games.length > 0);
  for (const g of games) assert.deepEqual(validateGame(g), [], g.id);
  assert.ok(validateGame({ id: 'bad' }).length > 0);
});

test('приложението не съдържа известия, серии или външни заявки', () => {
  const m = buildManifest();
  const code = m.files
    .filter((f) => f.endsWith('.js') && f !== './js/dev/simulator.js')
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
    .join('\n');
  assert.doesNotMatch(code, /Notification\.|PushManager|setAppBadge|streak/);
  assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/);
});

test('precache-manifest.js е актуален (иначе: npm run precache)', () => {
  const onDisk = readFileSync(new URL('../precache-manifest.js', import.meta.url), 'utf8');
  assert.equal(onDisk, render(buildManifest()));
});

// Тихото поле „Последен експорт“ в Настройки: само информация, без напомняне.
test('последен експорт: показва се четимо, а повредена стойност не чупи екрана', () => {
  // Сравнението е с местно време от двете страни, затова тестът не зависи от часовата зона.
  const at = new Date(2026, 10, 5, 9, 7);
  assert.equal(formatMoment(at.toISOString()), '5.11.2026, 09:07');
  assert.equal(formatMoment(new Date(2026, 0, 1, 23, 59).toISOString()), '1.1.2026, 23:59');
  for (const bad of ['', 'вчера', null, undefined, 42, {}]) assert.equal(formatMoment(bad), null, String(bad));
});
