import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_ID, BackupError, parseBackup, summarize } from '../js/core/backup.js';
import { SKILLS } from '../js/core/config.js';
import { CUMULATIVE_XP, TOTAL_STEPS, applyXP, advancedStep, nextStepInfo, requiredLevel, requirementFor, syncActivation } from '../js/core/evolution.js';
import { mergeData, mergeProfiles, mergeRecord, mergeTopic } from '../js/core/merge.js';
import { cleanTopic, defaultProfile, defaultRecord, defaultSettings } from '../js/core/model.js';
import { addDays, gradeFromPercent, isDue, reviewUpdate } from '../js/core/sm2.js';

const FIREFLIES_ONLY = () => ['speed', 'attention'];
const allActive = () => SKILLS;

const profile = (skillXP, step = 0) => {
  const full = { ...Object.fromEntries(SKILLS.map((s) => [s, 0])), ...skillXP };
  return { key: 'profile', skillXP: full, totalXP: Object.values(full).reduce((a, b) => a + b, 0), step };
};
const topic = (id, over = {}) => ({ id, checked: false, mastered: false, masteredAt: null, bestTest: 0, level: 1, sm2: null, ...over });

test('активни способности: само със „Светулки“ изкачването е възможно', () => {
  const { profile: p, to } = applyXP(defaultProfile(), 150, ['speed', 'attention'], FIREFLIES_ONLY);
  assert.ok(to >= 1, `стъпка ${to}`);
  assert.equal(p.skillXP.memory, 0);
});

test('активни способности: неактивните не са неизпълнено изискване', () => {
  const p = applyXP(defaultProfile(), 150, ['speed', 'attention'], FIREFLIES_ONLY).profile;
  const blocked = { ...p, totalXP: CUMULATIVE_XP[p.step + 1] };
  const info = nextStepInfo(blocked, FIREFLIES_ONLY());
  assert.equal(info.gates.find((g) => g.skill === 'memory').active, false);
  assert.ok(!info.blocked.includes('memory'));
  assert.ok(!info.blocked.includes('logic'));
});

test('активни способности: изоставена активна способност още спира изкачването', () => {
  const r = applyXP(defaultProfile(), 5000, ['speed'], FIREFLIES_ONLY);
  assert.equal(r.to, 0);
  assert.deepEqual(nextStepInfo(r.profile, FIREFLIES_ONLY()).blocked, ['attention']);
});

test('активни способности: нов модул не сваля достигнатото', () => {
  const reached = applyXP(defaultProfile(), 5000, ['speed', 'attention'], FIREFLIES_ONLY).profile;
  assert.ok(reached.step > 5);
  // Появява се модул за памет: всички способности стават активни.
  const after = applyXP(reached, 10, ['speed'], allActive);
  assert.equal(after.profile.step, reached.step);
  assert.equal(advancedStep(reached, allActive), reached.step);
});

test('мек преход (а): късно активиране не блокира следващата стъпка', () => {
  // Логиката се активира на Гущер I (стъпка 9). Праговете на 9 и 10 са равни, значи за Гущер II не се иска нищо.
  assert.equal(requiredLevel(9), requiredLevel(10));
  const onlyOld = () => ['speed', 'attention'];
  const atLizard = { ...profile({ speed: 2000, attention: 2000 }, 9), activationSteps: { speed: 0, attention: 0 } };
  const withLogic = (step) => (step >= 9 ? ['speed', 'attention', 'logic'] : onlyOld());
  const r = applyXP(atLizard, 10, ['speed'], withLogic);
  assert.equal(r.profile.activationSteps.logic, 9);
  assert.ok(r.to >= 10, `стъпка ${r.to}`);
  assert.equal(r.profile.skillXP.logic, 0);
});

test('мек преход: изискването е разликата между праговете и расте оттам', () => {
  const p = { ...profile({}, 9), activationSteps: { logic: 9 } };
  assert.equal(requirementFor(p, 'logic', 10), 0);
  assert.equal(requirementFor(p, 'logic', 20), requiredLevel(20) - requiredLevel(9));
  assert.equal(requirementFor(p, 'logic', 44), requiredLevel(44) - requiredLevel(9));
  assert.equal(requirementFor(p, 'logic', 5), 0);
});

test('мек преход: изоставането след активиране вече спира изкачването', () => {
  const p = { ...profile({ speed: 20000 }, 9), totalXP: 90000, activationSteps: { speed: 0, logic: 9 } };
  const only = () => ['speed', 'logic'];
  const stuckAt = advancedStep(p, only);
  assert.ok(stuckAt > 9 && stuckAt < 44, `стъпка ${stuckAt}`);
  assert.ok(requirementFor(p, 'logic', stuckAt + 1) >= 1);
});

test('мек преход (б): способност, активна от началото, се смята както досега', () => {
  const p = { ...defaultProfile(), activationSteps: Object.fromEntries(SKILLS.map((s) => [s, 0])) };
  for (let step = 1; step < TOTAL_STEPS; step += 1) {
    for (const s of SKILLS) assert.equal(requirementFor(p, s, step), requiredLevel(step), `${s}/${step}`);
  }
});

test('мек преход (в): activationStep оцелява при експорт и импорт', () => {
  const p = { ...profile({ speed: 500 }, 12), activationSteps: { speed: 0, logic: 9 } };
  const parsed = parseBackup(JSON.stringify({ app: APP_ID, schema: 1, data: { meta: [p] } }));
  assert.deepEqual(parsed.meta.find((m) => m.key === 'profile').activationSteps, { speed: 0, logic: 9 });
});

test('мек преход (в): при сливане печели по-ранната стойност', () => {
  const a = { ...profile({ speed: 1 }, 5), activationSteps: { logic: 9, memory: 2, speed: 0 } };
  const b = { ...profile({ speed: 1 }, 5), activationSteps: { logic: 4, attention: 1 } };
  const m = mergeProfiles(a, b, () => ['speed']);
  assert.deepEqual(m.activationSteps, { logic: 4, memory: 2, speed: 0, attention: 1 });
});

test('мек преход: повреден activationStep се изчиства при импорт', () => {
  const p = { ...profile({}), activationSteps: { logic: 99, memory: -1, speed: 'x', evil: 3, attention: 2 } };
  const parsed = parseBackup(JSON.stringify({ app: APP_ID, schema: 1, data: { meta: [p] } }));
  assert.deepEqual(parsed.meta.find((m) => m.key === 'profile').activationSteps, { attention: 2 });
});

test('синхронизация: стар запис не се пипа, а липсващият взема текущата стъпка', () => {
  const p = { ...profile({}, 7), activationSteps: { speed: 0 } };
  const synced = syncActivation(p, () => ['speed', 'logic']);
  assert.deepEqual(synced.activationSteps, { speed: 0, logic: 7 });
  assert.equal(synced.step, 7);
  assert.equal(syncActivation(synced, () => ['speed', 'logic']), synced);
  // Профил от по-стара версия няма полето изобщо.
  const old = { key: 'profile', totalXP: 0, step: 3, skillXP: profile({}).skillXP };
  assert.deepEqual(syncActivation(old, () => ['math']).activationSteps, { math: 3 });
});

test('стъпките се записват и при няколко стъпки наведнъж', () => {
  const opens = (step) => (step >= 4 ? ['speed', 'logic'] : ['speed']);
  const { profile: p } = applyXP(defaultProfile(), 5000, ['speed'], opens);
  assert.equal(p.activationSteps.speed, 0);
  assert.equal(p.activationSteps.logic, 4);
});

test('активни способности: без функция важат всичките шест', () => {
  assert.equal(applyXP(defaultProfile(), 90000, ['speed']).to, 0);
});

test('сливане: XP по способност е по-голямата стойност, а общият е сборът', () => {
  const m = mergeProfiles(profile({ speed: 100, math: 10 }), profile({ speed: 40, math: 70 }), FIREFLIES_ONLY);
  assert.equal(m.skillXP.speed, 100);
  assert.equal(m.skillXP.math, 70);
  assert.equal(m.totalXP, 170);
});

test('сливане: стъпката се преизчислява от слетите данни', () => {
  const half = CUMULATIVE_XP[10];
  const a = profile({ speed: half });
  const b = profile({ attention: half });
  assert.equal(a.step, 0);
  const m = mergeProfiles(a, b, FIREFLIES_ONLY);
  assert.equal(m.step, advancedStep({ ...m, step: 0 }, FIREFLIES_ONLY));
  assert.ok(m.step >= 10);
});

test('сливане: достигната стъпка никога не пада', () => {
  const m = mergeProfiles(profile({ speed: 1 }, 20), profile({ speed: 2 }, 3), allActive);
  assert.equal(m.step, 20);
  assert.ok(m.step < TOTAL_STEPS);
});

test('сливане: рекордите вземат по-доброто, а оценката „как беше“ се изчиства', () => {
  const a = { ...defaultRecord('x'), bestScore: 10, bestMeanRT: 300, plays: 2, demoSeen: true, feel: 'hard' };
  const b = { ...defaultRecord('x'), bestScore: 50, bestMeanRT: 450, plays: 7, lastDifficulty: 4 };
  assert.deepEqual(mergeRecord(a, b), {
    id: 'x', bestScore: 50, bestMeanRT: 300, lastDifficulty: 4, plays: 7, demoSeen: true, feel: null,
  });
  assert.equal(mergeRecord(defaultRecord('x'), { ...defaultRecord('x'), bestMeanRT: 400 }).bestMeanRT, 400);
});

test('сливане: отметките се обединяват, а при конфликт печели по-новата дата', () => {
  const a = topic('t', { checked: true, mastered: true, masteredAt: '2026-01-10', bestTest: 90, sm2: { ef: 2.5, interval: 6, reps: 2, due: '2026-02-01' } });
  const b = topic('t', { mastered: true, masteredAt: '2026-03-05', bestTest: 80, sm2: { ef: 2.2, interval: 1, reps: 0, due: '2026-03-06' } });
  const m = mergeTopic(a, b);
  assert.equal(m.checked, true);
  assert.equal(m.masteredAt, '2026-03-05');
  assert.equal(m.bestTest, 90);
  assert.equal(m.sm2.due, '2026-03-06');
  assert.deepEqual(mergeTopic(b, a), m);
});

test('сливане: цели данни, с настройките на устройството и теми само от едната страна', () => {
  const local = {
    meta: [profile({ speed: 100 }), { ...defaultSettings(), theme: 'dark' }],
    records: [{ ...defaultRecord('a'), bestScore: 5 }],
    topics: [topic('t1', { checked: true })],
  };
  const incoming = {
    meta: [profile({ memory: 50 }), { ...defaultSettings(), theme: 'light' }],
    records: [{ ...defaultRecord('b'), bestScore: 9 }],
    topics: [topic('t2', { mastered: true, masteredAt: '2026-01-01' })],
  };
  const m = mergeData(local, incoming, FIREFLIES_ONLY);
  assert.equal(m.meta.find((x) => x.key === 'settings').theme, 'dark');
  assert.deepEqual(m.records.map((r) => r.id).sort(), ['a', 'b']);
  assert.deepEqual(m.topics.map((t) => t.id).sort(), ['t1', 't2']);
  assert.equal(summarize(m).records, 2);
  assert.equal(summarize(m).mastered, 1);
});

test('сливане: взема реалния прогрес, а не тестовия режим, и го изчиства', () => {
  const local = {
    meta: [profile({ speed: 99999 }, 44), { key: 'simSnapshot', profile: profile({ speed: 7 }) }],
    records: [],
    topics: [],
  };
  const incoming = { meta: [profile({ speed: 3 })], records: [], topics: [] };
  const m = mergeData(local, incoming, FIREFLIES_ONLY);
  const p = m.meta.find((x) => x.key === 'profile');
  assert.equal(p.skillXP.speed, 7);
  assert.equal(p.step, 0);
  assert.ok(!m.meta.some((x) => x.key === 'simSnapshot'));
});

test('импорт: празен и повреден файл се отхвърлят с ясна грешка', () => {
  const valid = { app: APP_ID, schema: 1, data: { meta: [profile({})] } };
  for (const bad of ['', '   \n', '{', 'null', '[]', '{}',
    JSON.stringify({ ...valid, data: null }),
    JSON.stringify({ ...valid, data: { meta: [{ key: 'profile', step: 'x' }] } })]) {
    assert.throws(() => parseBackup(bad), BackupError, JSON.stringify(bad));
  }
  assert.equal(parseBackup(JSON.stringify(valid)).records.length, 0);
});

test('темите се изчистват: непознати полета и лоши дати отпадат', () => {
  const t = cleanTopic({ id: 't', checked: true, mastered: true, masteredAt: 'вчера', bestTest: 500, evil: 1, sm2: { ef: 'x' } });
  assert.deepEqual(t, { id: 't', checked: true, mastered: true, masteredAt: null, bestTest: 100, level: 1, sm2: null });
  assert.equal(cleanTopic({ id: '../x' }), null);
});

test('SM-2: интервалите растат при добър преговор и се скъсяват при слаб', () => {
  const today = '2026-01-01';
  const a = reviewUpdate(null, 5, today);
  assert.equal(a.interval, 1);
  assert.equal(a.due, '2026-01-02');
  const b = reviewUpdate(a, 5, a.due);
  assert.equal(b.interval, 6);
  const c = reviewUpdate(b, 4, b.due);
  assert.ok(c.interval > 6);
  const low = reviewUpdate(c, 1, c.due);
  assert.equal(low.interval, 1);
  assert.equal(low.reps, 0);
  assert.ok(low.ef >= 1.3);
});

test('SM-2: готовност за преговор и помощни функции', () => {
  assert.equal(isDue(null, '2026-01-01'), false);
  assert.equal(isDue({ due: '2026-01-01' }, '2026-01-01'), true);
  assert.equal(isDue({ due: '2026-01-02' }, '2026-01-01'), false);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(gradeFromPercent(100), 5);
  assert.equal(gradeFromPercent(80), 4);
  assert.equal(gradeFromPercent(0), 0);
});
