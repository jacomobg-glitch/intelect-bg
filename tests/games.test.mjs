import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ATTRIBUTES, SEQUENCE_RULES, isValidExtension, makeLogicTask, makeMatrixTask, makeSequenceTask, possibleNext,
} from '../js/content/logic/generators.js';
import { CONFIG, SKILLS } from '../js/core/config.js';
import {
  INPUT_KINDS, LowFpsDetector, buildReport, frameStats, inputKinds, inputLine, latencyStats,
  mainInput, mean, sd, summarizeInput,
} from '../js/core/stats.js';
import { activeSkills, registerGames, validateGame } from '../js/core/registry.js';
import { cleanSettings } from '../js/core/model.js';
import games from '../js/modules/index.js';
import { makeGoNoGoTrial, goNoGoParams } from '../js/modules/go-nogo.js';
import { COLORS, makeNbackSequence, nbackParams, nextNbackLevel } from '../js/modules/nback.js';
import { makeTable, nextSchulteLevel, tableSize } from '../js/modules/schulte.js';
import { TrialLog, isValidReaction, reactionMs, staircaseTarget, trialPoints } from '../js/modules/shared/trial-log.js';
import { reactionParams } from '../js/modules/simple-reaction.js';
import { COLOR_SET, SHAPE_SET, makeStroopTrial, stroopParams } from '../js/modules/stroop.js';

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const LEVELS = [1, 2, 3, 4, 5, 6];
const ROUNDS = 500;

test('всички модули спазват интерфейса, а на Мравка I има модул за всяка способност', () => {
  assert.equal(games.length, 21);
  for (const g of games) assert.deepEqual(validateGame(g), [], g.id);
  registerGames(games);
  assert.deepEqual([...activeSkills(0)].sort(), [...SKILLS].sort());
});

test('способностите на игрите следват спецификацията', () => {
  const skills = Object.fromEntries(games.map((g) => [g.id, g.skills]));
  assert.deepEqual(skills.stroop, ['attention', 'flexibility']);
  assert.deepEqual(skills['simple-reaction'], ['speed']);
  assert.deepEqual(skills['go-nogo'], ['attention']);
  assert.deepEqual(skills.nback, ['memory']);
  assert.deepEqual(skills.schulte, ['attention', 'speed']);
  assert.deepEqual(skills.logic, ['logic']);
});

test('всяка нова игра има демонстрация', () => {
  for (const g of games.filter((x) => x.id !== 'math')) assert.equal(typeof g.demo, 'function', g.id);
});

// Точкуване и staircase
test('реакция: под 100 ms се отхвърля, а времето идва от event.timeStamp', () => {
  assert.equal(isValidReaction(99), false);
  assert.equal(isValidReaction(100), true);
  assert.equal(reactionMs({ timeStamp: 1500 }, 1200), 300);
});

test('точки: трудност × 10, плюс бонус за бързина, а въздържането носи половин основа', () => {
  assert.equal(trialPoints(2, 0, 1000), 40);
  assert.equal(trialPoints(2, 500, 1000), 30);
  assert.equal(trialPoints(2, 5000, 1000), 20);
  assert.equal(trialPoints(3), 15);
});

test('staircase: CONFIG.STAIRCASE_UP верни нагоре, 1 грешка надолу, в рамките на тавана', () => {
  assert.equal(CONFIG.STAIRCASE_UP, 3);
  const log = new TrialLog({ startLevel: 1, maxLevel: 3 });
  log.correct();
  log.correct();
  assert.equal(log.level, 1, 'две верни още не вдигат трудността');
  log.correct();
  assert.equal(log.level, 2);
  log.correct();
  log.correct();
  log.error();
  assert.equal(log.level, 1, 'една грешка нулира серията и сваля трудността');
  log.error();
  assert.equal(log.level, 1);
  for (let i = 0; i < 20; i += 1) log.correct();
  assert.equal(log.level, 3);
});

test('целевият успех на staircase е в зоната 75–80%', () => {
  assert.ok(Math.abs(staircaseTarget(2) - 0.7071) < 0.001);
  assert.ok(Math.abs(staircaseTarget(3) - 0.7937) < 0.001);
  const target = staircaseTarget();
  assert.ok(target >= 0.75 && target <= 0.80, `цел ${target}`);
});

test('начална трудност над тавана се ограничава', () => {
  assert.equal(new TrialLog({ startLevel: 9, maxLevel: 3 }).level, 3);
  assert.equal(new TrialLog({ startLevel: 0, maxLevel: 3 }).level, 1);
});

test('дневник: преждевременните не сменят трудността и не влизат в качеството', () => {
  const log = new TrialLog({ startLevel: 2, maxLevel: 5 });
  log.premature();
  log.correct({ rt: 300, limit: 1000 });
  log.error('miss');
  log.error('wrong');
  assert.equal(log.prematureCount, 1);
  assert.equal(log.total, 3);
  assert.equal(log.quality(), 1 / 3);
  assert.equal(log.misses, 1);
  assert.equal(log.wrong, 1);
  assert.deepEqual(log.rts, [300]);
  assert.equal(new TrialLog().quality(), 0);
});

test('XP: кратка сесия с верен отговор дава поне 1, а без верен отговор 0', () => {
  const game = games.find((g) => g.id === 'stroop');
  game.log = new TrialLog({ maxLevel: 3 });
  game.elapsed = 500;
  assert.equal(game.xpReward(), 0);
  game.log.correct();
  assert.equal(game.xpReward(), 1);
  game.elapsed = 60000;
  assert.equal(game.xpReward(), 13);
  game.log = null;
});

// Stroop
test('Stroop: верният отговор следва правилото, а думата и цветът се разминават при несъответствие', () => {
  for (const set of [COLOR_SET, SHAPE_SET]) {
    for (const level of LEVELS) {
      const random = seeded(level * 17);
      for (let i = 0; i < ROUNDS; i += 1) {
        const t = makeStroopTrial(level, random, set);
        assert.equal(t.answer, t.rule === 'word' ? t.word : t.ink);
        assert.equal(t.congruent, t.word === t.ink);
        assert.ok(set.some((s) => s.id === t.answer));
      }
    }
  }
});

test('Stroop: по-висока трудност значи по-малко съвпадения и по-кратък срок', () => {
  assert.ok(stroopParams(6).congruentShare < stroopParams(1).congruentShare);
  assert.ok(stroopParams(6).limit < stroopParams(1).limit);
  assert.equal(stroopParams(3).wordRuleShare, 0);
  assert.ok(stroopParams(4).wordRuleShare > 0);
});

test('Stroop: вариантът с форми няма цветове и се пази в настройките', () => {
  assert.equal(SHAPE_SET.length, 4);
  assert.equal(new Set(SHAPE_SET.map((s) => s.word)).size, 4);
  assert.equal(cleanSettings({ stroopVariant: 'shape' }).stroopVariant, 'shape');
  assert.equal(cleanSettings({ stroopVariant: 'зло' }).stroopVariant, 'color');
});

// Цветна слепота: симулация по Machado (2009), тежест 1.0, върху цветовете от tokens.css.
const CVD = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
};
const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const hexToLinear = (hex) => [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
function lab([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const simulate = (rgb, m) => m.map((row) => clamp01(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const tokens = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
const token = (name) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))[1];
const GAME_COLORS = ['red', 'blue', 'green', 'yellow'].map((c) => [c, token(`game-${c}`)]);

test('цветна слепота: четирите цвята на Stroop остават различими и при трите вида', () => {
  for (const [kind, matrix] of Object.entries(CVD)) {
    for (let i = 0; i < GAME_COLORS.length; i += 1) {
      for (let j = i + 1; j < GAME_COLORS.length; j += 1) {
        const a = lab(simulate(hexToLinear(GAME_COLORS[i][1]), matrix));
        const b = lab(simulate(hexToLinear(GAME_COLORS[j][1]), matrix));
        const d = deltaE(a, b);
        assert.ok(d >= 20, `${kind}: ${GAME_COLORS[i][0]} и ${GAME_COLORS[j][0]} са твърде близки (ΔE ${d.toFixed(1)})`);
      }
    }
  }
});

test('цветовете на игрите се четат върху игралния фон (поне 4.5:1)', () => {
  const lum = (hex) => { const [r, g, b] = hexToLinear(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const bg = lum(token('game-bg'));
  for (const [name, hex] of GAME_COLORS) {
    const ratio = (lum(hex) + 0.05) / (bg + 0.05);
    assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}`);
  }
});

// Проста реакция и Go / No-Go
test('проста реакция: срокът намалява, а чакането остава непредвидимо', () => {
  for (const level of LEVELS) {
    const p = reactionParams(level);
    assert.ok(p.deadline >= 280);
    assert.ok(p.waitMax - p.waitMin > 1000);
  }
  assert.ok(reactionParams(6).deadline < reactionParams(1).deadline);
});

test('Go / No-Go: дял на „не натискай“ и краткост на стимула според трудността', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 3);
    let nogo = 0;
    for (let i = 0; i < 4000; i += 1) if (makeGoNoGoTrial(level, random).type === 'nogo') nogo += 1;
    assert.ok(Math.abs(nogo / 4000 - goNoGoParams(level).noGoShare) < 0.04, `ниво ${level}: ${nogo / 4000}`);
  }
  assert.ok(goNoGoParams(6).duration < goNoGoParams(1).duration);
});

// N-back
test('N-back: 1, 2 и 3 назад според трудността', () => {
  assert.deepEqual(LEVELS.map((l) => nbackParams(l).n), [1, 1, 2, 2, 3, 3]);
});

test('N-back: съвпаденията са точни и по двата канала, а първите n нямат', () => {
  for (const n of [1, 2, 3]) {
    const random = seeded(n * 41);
    for (let round = 0; round < 200; round += 1) {
      const items = makeNbackSequence(n, 20 + n, random);
      items.forEach((x, i) => {
        assert.ok(x.pos >= 0 && x.pos < 9);
        assert.ok(x.color >= 0 && x.color < COLORS.length);
        if (i < n) {
          assert.equal(x.posMatch, false);
          assert.equal(x.colorMatch, false);
        } else {
          assert.equal(x.posMatch, items[i - n].pos === x.pos);
          assert.equal(x.colorMatch, items[i - n].color === x.color);
        }
      });
      assert.ok(items.some((x) => x.posMatch));
      assert.ok(items.some((x) => x.colorMatch));
    }
  }
});

test('N-back: делът на съвпаденията е около 30%, за да не се отговаря на сляпо', () => {
  const random = seeded(5);
  let matches = 0;
  let total = 0;
  for (let round = 0; round < 300; round += 1) {
    for (const x of makeNbackSequence(2, 22, random).slice(2)) {
      total += 2;
      if (x.posMatch) matches += 1;
      if (x.colorMatch) matches += 1;
    }
  }
  assert.ok(Math.abs(matches / total - 0.3) < 0.04, String(matches / total));
});

test('N-back: трудността се сменя след блока според точността', () => {
  assert.equal(nextNbackLevel(2, 0.85, 5), 3);
  assert.equal(nextNbackLevel(5, 0.95, 5), 5);
  assert.equal(nextNbackLevel(3, 0.7, 5), 3);
  assert.equal(nextNbackLevel(3, 0.5, 5), 2);
  assert.equal(nextNbackLevel(1, 0.1, 5), 1);
});

test('N-back: всеки цвят върви със свой символ', () => {
  assert.equal(new Set(COLORS.map((c) => c.symbol)).size, COLORS.length);
});

// Schulte
test('Schulte: всяко число точно веднъж и таблици от 3×3 до 7×7', () => {
  assert.deepEqual(LEVELS.map(tableSize), [3, 4, 5, 6, 7, 7]);
  const random = seeded(9);
  for (const size of [3, 4, 5, 6, 7]) {
    for (let i = 0; i < 200; i += 1) {
      const t = makeTable(size, random);
      assert.deepEqual([...t].sort((a, b) => a - b), Array.from({ length: size * size }, (_, k) => k + 1));
    }
  }
});

test('Schulte: трудността следва скоростта и грешките', () => {
  assert.equal(nextSchulteLevel(2, { ms: 5000, errors: 0, size: 4 }, 5), 3);
  assert.equal(nextSchulteLevel(2, { ms: 5000, errors: 5, size: 4 }, 5), 1);
  assert.equal(nextSchulteLevel(2, { ms: 50000, errors: 0, size: 4 }, 5), 1);
  assert.equal(nextSchulteLevel(2, { ms: 20000, errors: 2, size: 4 }, 5), 2);
  assert.equal(nextSchulteLevel(3, { ms: 1000, errors: 0, size: 5 }, 3), 3);
});

// Логика: единствен верен отговор
test('логика, редици: каталогът познава правилата', () => {
  assert.equal(SEQUENCE_RULES.arithmetic([2, 4, 6, 8]), 10);
  assert.equal(SEQUENCE_RULES.geometric([1, 2, 4, 8]), 16);
  assert.equal(SEQUENCE_RULES.fibonacci([1, 2, 3, 5]), 8);
  assert.equal(SEQUENCE_RULES.secondOrder([1, 2, 4, 7]), 11);
  assert.equal(SEQUENCE_RULES.alternating([1, 3, 8, 10]), 15);
  assert.equal(SEQUENCE_RULES.geometric([1, 2, 5, 9]), null);
});

test('логика, редици: винаги единствен верен отговор сред опциите', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 53);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeSequenceTask(level, random);
      const possible = possibleNext(t.terms);
      assert.equal(possible.size, 1, `двусмислена: ${t.terms}`);
      assert.equal(String([...possible][0]), t.answer);
      assert.equal(new Set(t.options).size, 4, `опции: ${t.options}`);
      assert.ok(t.options.includes(t.answer));
      const valid = t.options.filter((o) => isValidExtension(t.terms, Number(o)));
      assert.deepEqual(valid, [t.answer], `${t.terms} → ${t.options}`);
      for (const o of t.options) assert.ok(Number(o) >= 0, `отрицателна опция ${o}`);
    }
  }
});

// Независима проверка: не ползва кода на генератора.
function completes(cells) {
  for (const name of Object.keys(ATTRIBUTES)) {
    const rows = [cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)].map((row) => row.map((c) => c[name]));
    const uniform = rows.every((r) => r[0] === r[1] && r[1] === r[2]);
    const allThree = rows.every((r) => r[0] !== r[1] && r[1] !== r[2] && r[0] !== r[2]);
    if (!uniform && !allThree) return false;
  }
  return true;
}

test('логика, матрици: точно една опция допълва матрицата', () => {
  for (const level of LEVELS) {
    const random = seeded(level * 71);
    for (let i = 0; i < ROUNDS; i += 1) {
      const t = makeMatrixTask(level, random);
      assert.equal(t.cells.length, 8);
      assert.equal(t.options.length, 4);
      const keys = t.options.map((o) => `${o.shape}/${o.count}/${o.fill}`);
      assert.equal(new Set(keys).size, 4, 'дублирана опция');
      const fits = t.options.map((o, idx) => (completes([...t.cells, o]) ? idx : -1)).filter((x) => x >= 0);
      assert.deepEqual(fits, [Number(t.answer)]);
    }
  }
});

test('логика: по-висока трудност значи повече променливи в матрицата', () => {
  const varying = (level) => {
    const random = seeded(level + 200);
    let max = 0;
    for (let i = 0; i < 100; i += 1) {
      const { cells } = makeMatrixTask(level, random);
      const n = Object.keys(ATTRIBUTES).filter((a) => new Set(cells.map((c) => c[a])).size > 1).length;
      max = Math.max(max, n);
    }
    return max;
  };
  assert.equal(varying(1), 1);
  assert.equal(varying(3), 2);
  assert.equal(varying(6), 3);
});

test('логика: от трудност 2 се редуват редици и матрици', () => {
  const random = seeded(11);
  const kinds = new Set(Array.from({ length: 50 }, () => makeLogicTask(3, random).kind));
  assert.deepEqual([...kinds].sort(), ['matrix', 'sequence']);
  assert.equal(makeLogicTask(1, random).kind, 'sequence');
});

// Диагностика
test('статистика: средно и разсейване', () => {
  assert.equal(mean([]), null);
  assert.equal(mean([2, 4]), 3);
  assert.equal(sd([5]), null);
  assert.ok(Math.abs(sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.01);
  assert.deepEqual(latencyStats([]), { mean: null, sd: null, count: 0 });
});

test('кадри: средно, минимум и 1% low', () => {
  const deltas = [...Array(99).fill(10), 100];
  const s = frameStats(deltas);
  assert.ok(Math.abs(s.avg - 1000 / 10.9) < 0.01);
  assert.equal(s.min, 10);
  assert.equal(s.low1, 10);
  assert.equal(frameStats([]).avg, null);
});

test('fallback: средно под 45 FPS за 3 секунди го включва, а 60 FPS не', () => {
  const run = (fps, seconds) => {
    const d = new LowFpsDetector();
    let hit = null;
    for (let i = 0; i <= seconds * fps; i += 1) hit = d.add((i * 1000) / fps) ?? hit;
    return hit;
  };
  assert.equal(run(60, 10), null);
  assert.equal(run(46, 10), null);
  assert.ok(run(40, 4) !== null);
  assert.equal(run(40, 2.5), null);
});

test('fallback: кратък спад не го включва, а скрит екран започва прозореца отначало', () => {
  const d = new LowFpsDetector();
  let t = 0;
  let hit = null;
  const frames = (fps, seconds) => {
    for (let i = 0; i < seconds * fps; i += 1) { t += 1000 / fps; hit = d.add(t) ?? hit; }
  };
  frames(60, 5);
  frames(30, 0.5);
  frames(60, 5);
  assert.equal(hit, null);
  // 30 секунди пауза: това не е бавен кадър.
  t += 30000;
  d.add(t);
  frames(60, 2);
  assert.equal(hit, null);
});

// Лаптопът е основното устройство: игра, която иска мишка, просто не се играе там.
test('всяка игра се играе и от клавиатура, а въведението го казва', () => {
  // Математиката не е игра на стадий: отговорът се пише в поле и клавиатурата е самият вход.
  const played = games.filter((g) => g.id !== 'math');
  for (const g of played) {
    assert.ok(g.keys && g.keys.length > 8, `${g.id}: липсва описание на клавишите`);
    const src = readFileSync(new URL(`../js/modules/${g.id}.js`, import.meta.url), 'utf8');
    const wired = /onKey/.test(src) || /digitKeys: true/.test(src) || /gridKeys: true/.test(src);
    assert.ok(wired, `${g.id}: няма клавиатурно управление`);
    assert.match(g.keys, /интервал|стрелк|цифр|Enter|A за/, `${g.id}: ${g.keys}`);
  }
  // Въведението преди играта показва клавишите, иначе никой няма да ги открие.
  const play = readFileSync(new URL('../js/views/play.js', import.meta.url), 'utf8');
  assert.match(play, /game\.keys/);
  assert.match(play, /Клавиатура/);
});

test('общата обвивка носи цифрите и курсора, за да не се преписват във всяка игра', () => {
  const base = readFileSync(new URL('../js/modules/shared/base-game.js', import.meta.url), 'utf8');
  assert.match(base, /function pressDigit/);
  assert.match(base, /function moveCursor/);
  // Собственият onKey на играта има предимство пред общото поведение.
  assert.match(base, /spec\.onKey && spec\.onKey\(this, e\)/);
});

test('вход: времената се държат разделени по вид, а водещият се вижда', () => {
  assert.deepEqual(INPUT_KINDS, ['mouse', 'touch', 'pen', 'keyboard']);
  const input = summarizeInput({ mouse: [10, 12, 14], keyboard: [6, 6], touch: [], unknown: [1, 2] });
  // Празните видове и непознатите имена не влизат.
  assert.deepEqual(Object.keys(input).sort(), ['keyboard', 'mouse']);
  assert.equal(input.mouse.count, 3);
  assert.equal(input.mouse.mean, 12);
  assert.equal(input.keyboard.mean, 6);
  // Подредбата е по брой: водещият вход е този, с който наистина е играно.
  assert.deepEqual(inputKinds(input).map(([k]) => k), ['mouse', 'keyboard']);
  assert.equal(mainInput(input), 'mouse');
  assert.equal(mainInput({}), null);
  assert.equal(mainInput(undefined), null);
  const line = inputLine(input);
  assert.match(line, /мишка 3 × 12\.0 ms/);
  assert.match(line, /клавиатура 2 × 6\.0 ms/);
  assert.equal(inputLine({}), 'няма записан вход');
});

test('отчет: казва с какво е играна всяка сесия', () => {
  const input = summarizeInput({ mouse: [10, 12], keyboard: [5] });
  const text = buildReport({
    version: '0.10.0',
    userAgent: 'UA',
    screen: '1920×1080',
    viewport: '1200×800',
    dpr: 1,
    fallback: { active: false, reason: null },
    tapInput: input,
    games: { rotation: { avg: 60, min: 50, low1: 52, frames: 3000, input } },
  });
  assert.match(text, /Пробна зона: мишка 2/);
  assert.match(text, /вход: мишка 2 × 11\.0 ms/);
  assert.match(text, /клавиатура 1/);
  // Стар запис без разрез по вход не чупи отчета.
  const old = buildReport({
    version: '0.9.0',
    userAgent: 'UA',
    screen: 'x',
    viewport: 'x',
    dpr: 1,
    fallback: { active: false, reason: null },
    tap: latencyStats([3, 5]),
    games: { stroop: { avg: 60, min: 50, low1: 52, frames: 3000, tapMean: 4, tapSd: 1, tapCount: 2 } },
  });
  assert.match(old, /вход: докосване средно 4\.0 ms/);
});

test('отчет: съдържа устройството и мерките, но нито прогрес, нито дати', () => {
  const text = buildReport({
    version: '0.6.0',
    userAgent: 'TestAgent',
    screen: '390×844',
    viewport: '390×700',
    dpr: 2.75,
    fallback: { active: true, reason: 'FPS 38' },
    tap: { mean: 4.2, sd: 1.1, count: 12 },
    games: { stroop: { avg: 59.6, min: 40.1, low1: 44.2, frames: 3000, tapMean: 5.5, tapSd: 2.2, tapCount: 40 } },
  });
  for (const part of ['0.6.0', 'TestAgent', '390×844', '2.75', 'FPS 38', 'stroop', '60', '4.2', '5.5']) assert.ok(text.includes(part), part);
  assert.doesNotMatch(text, /XP|стъпка|\d{4}-\d{2}-\d{2}/);
  const empty = buildReport({ version: '1', userAgent: 'x', screen: 'x', viewport: 'x', dpr: 1, fallback: { active: false, reason: null }, tap: latencyStats([]), games: {} });
  assert.ok(empty.includes('изключен'));
  assert.ok(empty.includes('още няма'));
});
