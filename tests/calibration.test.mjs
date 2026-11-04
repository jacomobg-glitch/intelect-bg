// Калибриране на трудността за реален човек: симулиран играч с времена 250–450 ms,
// разсейване, около 15% грешки и умора след 3 минути. Проверява, че staircase се стабилизира.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIG } from '../js/core/config.js';
import { staircaseTarget } from '../js/modules/shared/trial-log.js';
import {
  ACCURACY_PER_LEVEL, BASE_ACCURACY, FATIGUE_AFTER_MS, RT_RANGE,
  accuracyAt, calibrate, fatigueAt, playSession, reactionAt, seeded,
} from '../tools/sim-player.mjs';

test('профилът на играча: 15% грешки на своята трудност, по-малко точност по-нагоре', () => {
  assert.equal(accuracyAt(4, 4), BASE_ACCURACY);
  assert.ok(Math.abs(accuracyAt(5, 4) - (BASE_ACCURACY - ACCURACY_PER_LEVEL)) < 1e-9);
  assert.ok(accuracyAt(8, 4) < accuracyAt(6, 4));
  assert.ok(accuracyAt(1, 4) <= 0.98, 'точността има таван: човек греши и на лесното');
  assert.ok(accuracyAt(4, 4, 1) < accuracyAt(4, 4, 0), 'умората отнема точност');
});

test('умората започва след 3 минути и расте плавно', () => {
  assert.equal(fatigueAt(0), 0);
  assert.equal(fatigueAt(FATIGUE_AFTER_MS), 0);
  assert.ok(fatigueAt(FATIGUE_AFTER_MS + 60000) > 0);
  assert.ok(fatigueAt(FATIGUE_AFTER_MS + 60000) < fatigueAt(FATIGUE_AFTER_MS + 300000));
  assert.equal(fatigueAt(10 ** 9), 1, 'умората не расте без край');
});

test('времената за реакция стоят в 250–450 ms, освен при разсейване', () => {
  const random = seeded(3);
  let inRange = 0;
  let lapses = 0;
  const total = 4000;
  for (let i = 0; i < total; i += 1) {
    const rt = reactionAt(4, 4, 0, random);
    if (rt >= RT_RANGE[0] && rt <= RT_RANGE[1]) inRange += 1;
    else lapses += 1;
    assert.ok(rt > 0 && rt < 2000);
  }
  assert.ok(lapses / total > 0.02 && lapses / total < 0.09, `разсейване ${lapses / total}`);
  assert.ok(inRange / total > 0.9);
});

test('умората забавя реакциите', () => {
  const fresh = [];
  const tired = [];
  const a = seeded(11);
  const b = seeded(11);
  for (let i = 0; i < 2000; i += 1) {
    fresh.push(reactionAt(4, 4, 0, a));
    tired.push(reactionAt(4, 4, 1, b));
  }
  const mean = (xs) => xs.reduce((x, y) => x + y, 0) / xs.length;
  assert.ok(mean(tired) > mean(fresh), `${mean(fresh)} → ${mean(tired)}`);
});

test('staircase: успеваемостта на симулирания човек пада в зоната 75–85%', () => {
  for (const ability of [2, 4, 6]) {
    const r = calibrate({ ability, maxLevel: 9, runMs: 420000 });
    assert.ok(r.quality > 0.75 && r.quality < 0.85, `ability ${ability}: ${r.quality}`);
  }
});

test('staircase: трудността се стабилизира около способността на играча и не „тресе“', () => {
  for (const ability of [2, 4, 6]) {
    const r = calibrate({ ability, maxLevel: 9, runMs: 420000 });
    assert.ok(Math.abs(r.settledMean - ability) <= 1, `ability ${ability}: застана на ${r.settledMean}`);
    // Стъпките са цели числа, затова едно ниво люлеене е неизбежно. Повече от 1.5 вече е тресене.
    assert.ok(r.settledSd < 1.5, `ability ${ability}: клатене ±${r.settledSd}`);
    assert.ok(r.worstSd < 2, `ability ${ability}: най-лоша сесия ±${r.worstSd}`);
  }
});

test('по-дълга сесия не разваля стабилността: умората сваля нивото, но плавно', () => {
  const short = calibrate({ ability: 4, maxLevel: 9, runMs: 60000 });
  const long = calibrate({ ability: 4, maxLevel: 9, runMs: 420000 });
  assert.ok(long.settledMean < short.settledMean, 'умората води до по-ниска трудност');
  assert.ok(short.settledMean - long.settledMean < 1.5, 'спадът не е срив');
  assert.ok(long.settledSd < 1.5);
});

test('изборът на 3 верни нагоре е този, който дава зоната 75–80%', () => {
  const at = (up) => calibrate({ ability: 4, maxLevel: 9, runMs: 420000, up }).quality;
  assert.ok(at(2) < 0.75, `2 нагоре дава ${at(2)}`);
  const three = at(3);
  assert.ok(three >= 0.75 && three <= 0.82, `3 нагоре дава ${three}`);
  assert.ok(at(4) > 0.82, `4 нагоре дава ${at(4)}`);
  assert.equal(CONFIG.STAIRCASE_UP, 3);
  assert.ok(Math.abs(staircaseTarget(CONFIG.STAIRCASE_UP) - 0.7937) < 0.001);
});

test('таванът на трудността се спазва и при безгрешен играч', () => {
  const { log } = playSession({ ability: 99, maxLevel: 5, runMs: 120000, limitMs: 5000 });
  assert.ok(log.level <= 5);
  assert.ok(log.level >= 4, `перфектен играч стига до тавана, стигна до ${log.level}`);
});

test('симулацията е детерминирана: един и същ seed дава един и същ резултат', () => {
  const a = playSession({ seed: 42 });
  const b = playSession({ seed: 42 });
  assert.deepEqual(a.levels, b.levels);
  assert.equal(a.log.quality(), b.log.quality());
});
