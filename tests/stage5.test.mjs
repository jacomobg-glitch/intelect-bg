// Етап 5: когнитивен профил, „Изненадай ме“, най-близкото препятствие.
// Плюс настройваемият праг и оценката „Лесно / Точно / Трудно“.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXTS } from '../js/content/texts.js';
import { test } from 'node:test';
import { CONFIG, SKILLS } from '../js/core/config.js';
import {
  CUMULATIVE_XP, TOTAL_STEPS, applyXP, levelFromXP, nearestObstacle, requiredLevel, requirementFor, xpForLevel,
} from '../js/core/evolution.js';
import { defaultProfile, defaultRecord, cleanRecord, feelShift, startDifficulty } from '../js/core/model.js';
import { favouriteGame, gameWeight, pickGames, pickTopic, planSurprise, skillNeeds, weightedPick } from '../js/core/surprise.js';
import games from '../js/modules/index.js';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const profileWith = (skillXP, step = 0) => {
  const full = { ...Object.fromEntries(SKILLS.map((s) => [s, 0])), ...skillXP };
  return {
    key: 'profile',
    skillXP: full,
    totalXP: Object.values(full).reduce((a, b) => a + b, 0),
    step,
    activationSteps: Object.fromEntries(SKILLS.map((s) => [s, 0])),
  };
};

// --- Настройваем праг (раздел 1.2) ---

test('прагът 50% е една константа и се ползва като подразбиране навсякъде', () => {
  assert.equal(CONFIG.SKILL_SHARE_THRESHOLD, 0.5);
  for (let step = 1; step < TOTAL_STEPS; step += 1) {
    assert.equal(requiredLevel(step), requiredLevel(step, CONFIG.SKILL_SHARE_THRESHOLD), `стъпка ${step}`);
  }
  const p = profileWith({}, 5);
  assert.equal(requirementFor(p, 'memory', 10), requirementFor(p, 'memory', 10, CONFIG.SKILL_SHARE_THRESHOLD));
});

test('по-висок праг иска повече, по-нисък иска по-малко, и границите са 30–70%', () => {
  const [lo, hi] = CONFIG.SKILL_SHARE_RANGE;
  assert.deepEqual([lo, hi], [0.3, 0.7]);
  let strictlyHigher = 0;
  for (let step = 1; step < TOTAL_STEPS; step += 1) {
    assert.ok(requiredLevel(step, lo) <= requiredLevel(step), `стъпка ${step}`);
    assert.ok(requiredLevel(step, hi) >= requiredLevel(step), `стъпка ${step}`);
    if (requiredLevel(step, hi) > requiredLevel(step, lo)) strictlyHigher += 1;
  }
  assert.ok(strictlyHigher > 30, 'плъзгачът трябва да променя нещо видимо');
  for (const t of [lo, CONFIG.SKILL_SHARE_THRESHOLD, hi]) {
    assert.equal(requiredLevel(0, t), 0);
    assert.ok(requiredLevel(1, t) >= 1, 'първата стъпка винаги иска поне ниво 1');
  }
});

test('прагът на плъзгача не влиза в сметката на реалния прогрес', () => {
  const r = applyXP(defaultProfile(), CUMULATIVE_XP[6], SKILLS);
  const atReal = r.profile.step;
  // Промяна само в показването: същата функция с друг праг не променя записания профил.
  requiredLevel(6, 0.7);
  assert.equal(applyXP(defaultProfile(), CUMULATIVE_XP[6], SKILLS).profile.step, atReal);
});

// --- Оценка „Лесно / Точно / Трудно“ (раздел 3) ---

test('оценката мести началната трудност най-много с една стъпка', () => {
  assert.equal(CONFIG.FEEL_SHIFT, 1);
  assert.equal(feelShift('easy'), 1);
  assert.equal(feelShift('hard'), -1);
  assert.equal(feelShift('right'), 0);
  assert.equal(feelShift(null), 0);
  assert.equal(feelShift('нещо друго'), 0);
});

test('началната трудност следва staircase, преместена с последната оценка', () => {
  const rec = (over) => ({ ...defaultRecord('x'), ...over });
  assert.equal(startDifficulty(rec({ lastDifficulty: 4 })), 4);
  assert.equal(startDifficulty(rec({ lastDifficulty: 4, feel: 'easy' })), 5);
  assert.equal(startDifficulty(rec({ lastDifficulty: 4, feel: 'hard' })), 3);
  assert.equal(startDifficulty(rec({ lastDifficulty: 4, feel: 'right' })), 4);
  assert.equal(startDifficulty(rec({ lastDifficulty: 1, feel: 'hard' })), 1, 'не пада под 1');
});

test('оценката се пази само като последна стойност и чужди стойности се отхвърлят', () => {
  assert.equal(defaultRecord('x').feel, null);
  assert.equal(cleanRecord({ id: 'x', feel: 'hard' }).feel, 'hard');
  assert.equal(cleanRecord({ id: 'x', feel: 'много трудно' }).feel, null);
  assert.equal(cleanRecord({ id: 'x', feel: ['hard'] }).feel, null);
  // Няма поле за история: записът има точно тези ключове.
  assert.deepEqual(Object.keys(defaultRecord('x')).sort(),
    ['bestMeanRT', 'bestScore', 'demoSeen', 'feel', 'id', 'lastDifficulty', 'plays']);
});

// --- Най-близкото препятствие (раздел 4.3) ---

test('XP за ниво е обратното на нивото от XP', () => {
  for (let level = 0; level < 20; level += 1) {
    assert.equal(levelFromXP(xpForLevel(level)), level);
    if (level > 0) assert.equal(levelFromXP(xpForLevel(level) - 0.01), level - 1);
  }
});

test('препятствие: изоставаща способност се показва с точния остатък XP', () => {
  const needed = requiredLevel(1);
  const p = profileWith({
    memory: xpForLevel(needed) - 40,
    attention: xpForLevel(needed + 2),
    speed: xpForLevel(needed + 2),
    logic: xpForLevel(needed + 2),
    math: xpForLevel(needed + 2),
    flexibility: xpForLevel(needed + 2),
  });
  const o = nearestObstacle(p);
  assert.equal(o.kind, 'skill');
  assert.equal(o.skill, 'memory');
  assert.equal(o.xp, 40);
  assert.equal(o.step, 1);
  // Точно толкова XP вдигат нивото и препятствието изчезва.
  const after = nearestObstacle(profileWith({ ...p.skillXP, memory: p.skillXP.memory + o.xp }));
  assert.notEqual(after.skill, 'memory');
});

test('препятствие: най-близката изоставаща способност е тази с най-малък остатък', () => {
  const needed = requiredLevel(1);
  const p = profileWith({
    memory: xpForLevel(needed) - 90,
    attention: xpForLevel(needed) - 5,
    speed: xpForLevel(needed + 2),
    logic: xpForLevel(needed + 2),
    math: xpForLevel(needed + 2),
    flexibility: xpForLevel(needed + 2),
  });
  const o = nearestObstacle(p);
  assert.equal(o.skill, 'attention');
  assert.equal(o.xp, 5);
});

test('препятствие: без изоставаща способност остава общият XP, после е готово', () => {
  const balanced = applyXP(defaultProfile(), 100, SKILLS).profile;
  const o = nearestObstacle(balanced);
  assert.equal(o.kind, 'xp');
  assert.equal(o.xp, CUMULATIVE_XP[1] - 100);
  const ready = applyXP(defaultProfile(), CUMULATIVE_XP[1], SKILLS).profile;
  assert.equal(nearestObstacle({ ...ready, step: 0 }).kind, 'ready');
});

test('препятствие: на върха на стълбата няма препятствие', () => {
  const top = applyXP(defaultProfile(), CUMULATIVE_XP[44], SKILLS).profile;
  const o = nearestObstacle(top);
  assert.equal(o.kind, 'max');
  assert.equal(o.step, null);
  assert.equal(o.info.isMax, true);
});

test('препятствие: неактивна способност никога не е препятствие', () => {
  const needed = requiredLevel(1);
  const p = profileWith({
    speed: xpForLevel(needed + 2),
    attention: xpForLevel(needed + 2),
  });
  const o = nearestObstacle(p, ['speed', 'attention']);
  assert.notEqual(o.kind, 'skill');
});

// --- „Изненадай ме“ (раздел 4.2) ---

const GAMES = games.filter((g) => g.category !== 'math').map((g) => ({ id: g.id, title: g.title, skills: g.skills }));
const TOPICS = [
  { id: 'count', title: 'Броене', mastered: true, due: false },
  { id: 'number-line', title: 'Числова ос', mastered: false, due: false },
  { id: 'add-sub', title: 'Събиране', mastered: true, due: true },
];

test('място за растеж: най-малко практикуваната способност тежи най-много', () => {
  const needs = skillNeeds({ memory: 0, attention: 100, speed: 50, logic: 100, math: 100, flexibility: 100 });
  assert.equal(needs.memory, 1);
  assert.equal(needs.attention, 0);
  assert.equal(needs.speed, 0.5);
  // Празен профил: всички са равни и нищо не дели на нула.
  const empty = skillNeeds(Object.fromEntries(SKILLS.map((s) => [s, 0])));
  for (const s of SKILLS) assert.equal(empty[s], 1);
});

test('тежестта на играта следва водещата ѝ способност, но никоя не пада до нула', () => {
  const needs = skillNeeds({ memory: 0, attention: 100, speed: 100, logic: 100, math: 100, flexibility: 100 });
  const nback = GAMES.find((g) => g.id === 'nback');
  const schulte = GAMES.find((g) => g.id === 'schulte');
  assert.ok(gameWeight(nback, needs) > gameWeight(schulte, needs));
  assert.ok(gameWeight(schulte, needs) > 0, 'тренирана способност запазва шанс');
});

test('претегленият избор следва тежестите и не излиза извън списъка', () => {
  const list = ['a', 'b', 'c'];
  const random = seeded(5);
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 6000; i += 1) counts[weightedPick(list, [8, 1, 1], random)] += 1;
  assert.ok(counts.a > counts.b * 3, JSON.stringify(counts));
  assert.ok(counts.b > 0 && counts.c > 0, 'малката тежест не е нула');
  assert.equal(weightedPick([], [], random), null);
  assert.ok(list.includes(weightedPick(list, [0, 0, 0], random)), 'нулеви тежести: равен шанс');
});

test('любимата игра е най-играната, а без изиграна игра няма любима', () => {
  assert.equal(favouriteGame(GAMES, () => 0), null);
  const plays = (id) => (id === 'schulte' ? 9 : id === 'stroop' ? 4 : 0);
  assert.equal(favouriteGame(GAMES, plays).id, 'schulte');
});

test('планът винаги е две различни игри и една математическа тема', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const random = seeded(seed * 31);
    const plan = planSurprise({
      games: GAMES,
      topics: TOPICS,
      plays: (id) => (id === 'stroop' ? 5 : 0),
      skillXP: { memory: 10, attention: 300, speed: 200, logic: 40, math: 60, flexibility: 90 },
      random,
    });
    assert.equal(plan.length, 3, `seed ${seed}`);
    const gameItems = plan.filter((x) => x.kind === 'game');
    assert.equal(gameItems.length, 2);
    assert.equal(new Set(gameItems.map((x) => x.id)).size, 2, 'една и съща игра два пъти');
    assert.equal(plan.filter((x) => x.kind === 'math').length, 1);
    // Математиката стои в средата, затова двете игри никога не са една след друга.
    assert.equal(plan[1].kind, 'math');
    for (const item of plan) {
      assert.ok(item.title, 'всяка стъпка има заглавие за прегледа');
      assert.ok(item.skills.length > 0);
    }
  }
});

test('планът винаги включва любимата игра, когато има такава', () => {
  let withFavourite = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const plan = planSurprise({
      games: GAMES,
      topics: TOPICS,
      plays: (id) => (id === 'schulte' ? 12 : 0),
      skillXP: { memory: 0, attention: 500, speed: 500, logic: 0, math: 0, flexibility: 0 },
      random: seeded(seed * 97),
    });
    if (plan.some((x) => x.id === 'schulte')) withFavourite += 1;
  }
  assert.equal(withFavourite, 200, 'любимата игра е част от удоволствието');
});

test('изборът е претеглен към слабата практика, но не е винаги най-слабата', () => {
  const counts = {};
  for (let seed = 1; seed <= 600; seed += 1) {
    const plan = planSurprise({
      games: GAMES,
      topics: TOPICS,
      plays: () => 0,
      skillXP: { memory: 0, attention: 600, speed: 600, logic: 600, math: 600, flexibility: 600 },
      random: seeded(seed * 7919),
    });
    for (const item of plan.filter((x) => x.kind === 'game')) counts[item.id] = (counts[item.id] || 0) + 1;
  }
  assert.ok(counts.nback > 0, 'играта за най-слабата способност се предлага');
  assert.ok(Object.keys(counts).length >= 4, `само ${Object.keys(counts).length} различни игри`);
  const share = counts.nback / 1200;
  assert.ok(share > 1 / GAMES.length, `nback дял ${share}: претеглянето не работи`);
  assert.ok(share < 0.6, `nback дял ${share}: изборът е станал предвидим`);
});

test('играта от края на предишната изненада не започва следващата', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const plan = planSurprise({
      games: GAMES,
      topics: TOPICS,
      plays: (id) => (id === 'stroop' ? 5 : 0),
      skillXP: Object.fromEntries(SKILLS.map((s) => [s, 100])),
      random: seeded(seed * 13),
      avoid: 'stroop',
    });
    const first = plan.find((x) => x.kind === 'game');
    if (plan.some((x) => x.id === 'stroop')) assert.notEqual(first.id, 'stroop', `seed ${seed}`);
  }
});

test('темата за преговор е с предимство, после неусвоената', () => {
  const random = seeded(2);
  assert.equal(pickTopic(TOPICS, random).id, 'add-sub');
  const noDue = TOPICS.map((t) => ({ ...t, due: false }));
  assert.equal(pickTopic(noDue, random).id, 'number-line');
  const allMastered = noDue.map((t) => ({ ...t, mastered: true }));
  assert.ok(allMastered.some((t) => t.id === pickTopic(allMastered, random).id));
  assert.equal(pickTopic([], random), null);
});

test('по-малко от две игри: планът не се чупи', () => {
  const one = [GAMES[0]];
  assert.deepEqual(pickGames([], { needs: skillNeeds({}), plays: () => 0, random: seeded(1) }), []);
  const plan = planSurprise({ games: one, topics: TOPICS, plays: () => 0, skillXP: {}, random: seeded(1) });
  assert.equal(plan.length, 2);
  assert.equal(plan.filter((x) => x.kind === 'game').length, 1);
  const noTopics = planSurprise({ games: GAMES, topics: [], plays: () => 0, skillXP: {}, random: seeded(1) });
  assert.equal(noTopics.filter((x) => x.kind === 'math').length, 0);
  assert.equal(noTopics.length, 2);
});

// --- Текстове и модел (раздел 4.1 и раздел 5) ---

test('профилът не говори за слабо и силно, а за практика', () => {
  const code = readFileSync(new URL('../js/views/profile.js', import.meta.url), 'utf8');
  // Текстовете живеят в js/content/texts.js (стандартен и детски), затова се четат оттам.
  assert.match(TEXTS['profile.most'].standard, /практика/);
  assert.match(TEXTS['profile.grow'].standard, /растеж/);
  assert.match(TEXTS['profile.most'].kid, /упражнявал/);
  assert.doesNotMatch(code, /слаб|силн|добър|лош|IQ/i);
  // Нито един текст, нито стандартен, нито детски, не оценява човека.
  for (const [key, entry] of Object.entries(TEXTS)) {
    assert.doesNotMatch(entry.standard, /слаб|силн|гениал|тъп|глупав|IQ/i, key);
    assert.doesNotMatch(entry.kid, /слаб|силн|гениал|тъп|глупав|IQ/i, key);
  }
});

test('Етап 5 не внася дати, серии или история по дни', () => {
  const files = ['js/core/surprise.js', 'js/views/profile.js', 'js/views/surprise.js', 'js/core/model.js'];
  for (const file of files) {
    const code = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /streak|Date\.now|new Date|toISOString/, file);
  }
  // Единствената дата в модела остава денят на усвояване на тема.
  const model = readFileSync(new URL('../js/core/model.js', import.meta.url), 'utf8');
  const dateFields = [...model.matchAll(/(\w+At)\s*:/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(dateFields)], ['masteredAt']);
});
