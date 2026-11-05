// Етап 6е: видима украса, фонове и анимации по светове.
// Правилото, което тези проверки пазят: купено, но невидимо, не се продава.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BACKGROUNDS, backgroundOf, backgroundVars, sparkleMarkup } from '../js/content/backgrounds.js';
import { DECOR, SLOTS, SLOT_NAMES, activeDecor, decorForWorld, decorOf, sceneMarkup } from '../js/content/decor.js';
import { KIND_ORDER, SHOP_ITEMS, hasPreview, itemsForWorld, previewMarkup } from '../js/content/shop.js';
import { ANIMATIONS, WORLD_LIST, animOf } from '../js/content/worlds/index.js';
import { MAJOR_MS, MINOR_MS, REDUCED_MS } from '../js/views/evolution.js';
import { cleanSettings, defaultSettings } from '../js/core/model.js';

// --- контраст по WCAG ---

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// Цветовете на текста се четат от самите токени, за да не се разминат с приложението.
function textColors() {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const dark = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="light"]'));
  const light = css.slice(css.indexOf('[data-theme="light"]'));
  const pick = (block) => block.match(/--text:\s*(#[0-9a-f]{6})/i)[1];
  return { dark: pick(dark), light: pick(light) };
}

test('контрастът на текста върху всеки фон стига за четене (AA)', () => {
  const text = textColors();
  for (const background of BACKGROUNDS) {
    for (const theme of ['dark', 'light']) {
      for (const [edge, color] of Object.entries(background[theme])) {
        assert.match(color, /^#[0-9a-f]{6}$/i, `${background.id}/${theme}/${edge}`);
        const ratio = contrast(text[theme], color);
        assert.ok(ratio >= 4.5, `${background.id} · ${theme} · ${edge}: контраст ${ratio.toFixed(2)} (трябва ≥ 4.5)`);
      }
    }
  }
});

test('всеки фон има вариант и за двете теми, и се подава като променливи', () => {
  assert.ok(BACKGROUNDS.length >= 3);
  for (const background of BACKGROUNDS) {
    assert.ok(background.dark.from && background.dark.to, background.id);
    assert.ok(background.light.from && background.light.to, `${background.id}: липсва светъл вариант`);
    const vars = backgroundVars(background.id);
    assert.deepEqual(Object.keys(vars).sort(), [
      '--scene-dark-from', '--scene-dark-to', '--scene-light-from', '--scene-light-to',
    ]);
    assert.equal(vars['--scene-light-from'], background.light.from);
    assert.match(sparkleMarkup(background.id), /^<g /, `${background.id}: липсва украса на фона`);
  }
  assert.equal(backgroundOf('няма такъв'), null);
  assert.equal(backgroundVars('няма такъв'), null);
  assert.equal(sparkleMarkup('няма такъв'), '');
});

// --- украсата ---

test('всеки свят има по пет украси с място на сцената', () => {
  assert.equal(DECOR.length, 25);
  assert.equal(new Set(DECOR.map((d) => d.id)).size, 25, 'повтарящо се id');
  assert.equal(new Set(DECOR.map((d) => d.name)).size, 25, 'повтарящо се име');
  for (const world of WORLD_LIST) {
    const mine = decorForWorld(world.id);
    assert.equal(mine.length, 5, `${world.id}: ${mine.length} украси`);
    // Пет предмета на пет различни места: иначе единият покрива другия.
    assert.equal(new Set(mine.map((d) => d.slot)).size, 5, `${world.id}: две украси на едно място`);
    for (const d of mine) {
      assert.ok(SLOT_NAMES.includes(d.slot), `${d.id}: непознато място ${d.slot}`);
      assert.ok(SLOTS[d.slot].startsWith('translate('), d.slot);
      assert.ok(Number.isInteger(d.price) && d.price > 0 && d.price <= 200, `${d.id}: цена ${d.price}`);
      assert.ok(d.svg.length > 20, `${d.id}: празна картинка`);
      assert.doesNotMatch(d.svg, /<script|onload=|javascript:|<image|xlink:href/i, d.id);
    }
  }
});

test('на сцената влиза само купеното, което не е махнато', () => {
  const owned = ['decor-flag', 'decor-lantern', 'decor-chest'];
  const off = ['decor-lantern'];
  const shown = activeDecor('builder', owned, off).map((d) => d.id);
  assert.deepEqual(shown, ['decor-flag', 'decor-chest']);
  // Чужда украса не влиза, дори да е „купена“.
  assert.deepEqual(activeDecor('garden', owned, []), []);
  assert.deepEqual(activeDecor('builder', [], []), []);

  const svg = sceneMarkup({ worldId: 'builder', owned, off });
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes(decorOf('decor-flag').svg), 'знамето е на сцената');
  assert.ok(!svg.includes(decorOf('decor-lantern').svg), 'махнатото не се рисува');
  assert.match(svg, /sc-ground/, 'сцената има земя');
  // Празна сцена пак е валидна картинка.
  assert.match(sceneMarkup({ worldId: 'space', owned: [], off: [] }), /^<svg .*<\/svg>$/s);
});

test('махнатата украса се пази в настройките и се изчиства от боклук', () => {
  assert.deepEqual(defaultSettings().decorOff, []);
  const clean = cleanSettings({ decorOff: ['decor-flag', 'измислено', 'decor-flag'] });
  assert.deepEqual(clean.decorOff, ['decor-flag']);
  assert.deepEqual(cleanSettings({ decorOff: 'не е списък' }).decorOff, []);
});

// --- магазинът ---

test('в магазина не може да влезе предмет без преглед', () => {
  assert.equal(SHOP_ITEMS.length, 36);
  for (const item of SHOP_ITEMS) {
    assert.ok(hasPreview(item), `${item.id}: няма преглед`);
    assert.match(previewMarkup(item), /^<svg /, item.id);
    assert.ok(KIND_ORDER.includes(item.kind), item.id);
  }
  // Измислен вид няма рендер и затова не минава проверката.
  assert.equal(previewMarkup({ id: 'x', kind: 'измислен', name: 'Нещо', price: 10 }), null);
  assert.equal(hasPreview({ id: 'x', kind: 'измислен' }), false);
  assert.equal(previewMarkup(null), null);
  // Украсата за свят се показва само в него.
  const builder = itemsForWorld('builder').map((i) => i.id);
  assert.ok(builder.includes('decor-flag'));
  assert.ok(!builder.includes('decor-fountain'));
  // Общите неща (шапки, инструменти, фонове) ги има във всеки свят.
  for (const world of WORLD_LIST) {
    const ids = itemsForWorld(world.id).map((i) => i.id);
    assert.ok(ids.includes('hat-crown'), world.id);
    assert.ok(ids.includes('bg-night'), world.id);
    assert.equal(ids.filter((id) => id.startsWith('decor-')).length, 5, world.id);
  }
});

// --- анимациите ---

test('всеки свят има своя анимация на превръщането', () => {
  const kinds = WORLD_LIST.map((w) => animOf(w));
  assert.deepEqual(kinds, ['fade', 'blocks', 'mission', 'water', 'spark']);
  for (const kind of kinds) assert.ok(ANIMATIONS.includes(kind), kind);
  // Непознат вид пада до простото преливане.
  assert.equal(animOf({ anim: 'измислена' }), 'fade');
  assert.equal(animOf({}), 'fade');
});

test('превръщането трае между 1.5 и 2.5 секунди, а при по-малко движение е кратко', () => {
  assert.ok(MAJOR_MS >= 1500 && MAJOR_MS <= 2500, `${MAJOR_MS} ms`);
  assert.ok(MINOR_MS >= 1500 && MINOR_MS <= 2500, `${MINOR_MS} ms`);
  assert.ok(REDUCED_MS <= 500, `${REDUCED_MS} ms при prefers-reduced-motion`);
  const code = readFileSync(new URL('../js/views/evolution.js', import.meta.url), 'utf8');
  assert.match(code, /prefers-reduced-motion/, 'уважава системната настройка');
  assert.match(code, /Прескочи/, 'има бутон за прескачане');
  assert.match(code, /Продължи/, 'после продължава');
});

test('стиловете наистина описват всяка анимация и сцената', () => {
  const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
  for (const selector of ['.evo-fx-blocks', '.evo-fx-water', '.evo-fx-mission', '.evo-fx-spark', '.evo-done']) {
    assert.ok(css.includes(selector), `липсва стил ${selector}`);
  }
  for (const selector of ['.scene', '.scene-hero', '.sc-ground', '.shop-preview', '.hero[data-bg]']) {
    assert.ok(css.includes(selector), `липсва стил ${selector}`);
  }
  // Светлата тема има свой вариант на фона: иначе текстът би се загубил.
  assert.match(css, /\[data-theme="light"\] \.hero\[data-bg\]/);
});
