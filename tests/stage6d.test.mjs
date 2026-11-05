// Етап 6д: светове, герои, магазин. Данните се проверяват като данни:
// формата, безопасността и правилата, които сме си поставили.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEFAULT_WORLD, FALLBACK_AVATAR, WORLDS, WORLD_IDS, WORLD_LIST,
  creatureAt, isDrops, unlockWord, worldOf, xpWord,
} from '../js/content/worlds/index.js';
import {
  DEFAULT_HERO, HATS, HERO_COLORS, TOOLS, availableHats, availableTools, cleanHero, heroMarkup, heroName,
} from '../js/content/hero.js';
import { KIND_ORDER, SHOP_ITEMS, canAfford, coinsFor, itemOf, itemsForWorld } from '../js/content/shop.js';
import { TEXTS, fill, text } from '../js/content/texts.js';
import { render as renderKidTexts } from '../tools/gen-kid-texts.mjs';
import { cleanProfile, cleanSettings, defaultProfile, defaultSettings } from '../js/core/model.js';
import { mergeProfiles } from '../js/core/merge.js';
import { SKILLS } from '../js/core/config.js';
import { TOTAL_STEPS } from '../js/core/evolution.js';

const STEPS = 15;

// --- световете като данни ---

test('всеки свят има точно 15 етапа с име, цветове и картинка', () => {
  assert.equal(WORLD_LIST.length, 5);
  assert.deepEqual(WORLD_IDS, ['nature', 'builder', 'city', 'garden', 'space']);
  for (const world of WORLD_LIST) {
    assert.equal(world.creatures.length, STEPS, world.id);
    assert.equal(STEPS * 3, TOTAL_STEPS, 'етапите са три подстепени всеки');
    const names = world.creatures.map((c) => c.name);
    assert.equal(new Set(names).size, STEPS, `${world.id}: повтарящо се име`);
    for (const creature of world.creatures) {
      assert.ok(creature.name && creature.name.length > 1, `${world.id}: празно име`);
      assert.ok(creature.can && creature.you, `${world.id}/${creature.name}: липсва текст`);
      assert.equal(creature.colors.length, 2, `${world.id}/${creature.name}`);
      for (const color of creature.colors) assert.match(color, /^#[0-9a-f]{6}$/i, `${world.id}/${creature.name}`);
      assert.match(creature.avatar, /^<svg /, `${world.id}/${creature.name}`);
      assert.match(creature.avatar, /viewBox="0 0 100 100"/, `${world.id}/${creature.name}`);
    }
  }
});

test('картинките са безопасни: без скриптове, без външни адреси', () => {
  const all = WORLD_LIST.flatMap((w) => [
    ...w.creatures.map((c) => c.avatar),
    ...w.companions.map((c) => c.avatar),
    ...(w.hero ? [w.hero.base] : []),
  ]);
  for (const markup of [...all, ...HATS.map((h) => h.svg), ...TOOLS.map((t) => t.svg), FALLBACK_AVATAR]) {
    assert.doesNotMatch(markup, /<script|onload=|onclick=|javascript:/i);
    assert.doesNotMatch(markup, /https?:\/\/(?!www\.w3\.org)/i, 'външен адрес в картинка');
    assert.doesNotMatch(markup, /<image|xlink:href/i, 'външна картинка');
  }
});

test('липсваща картинка дава безопасен заместител, а не грешка', () => {
  const broken = { id: 'broken', creatures: [{ name: 'Без картинка', colors: ['#000000', '#ffffff'], can: '', you: '' }] };
  // Непознат свят пада до този по подразбиране.
  assert.equal(worldOf('няма такъв').id, DEFAULT_WORLD);
  assert.equal(worldOf(undefined).id, DEFAULT_WORLD);
  // Празна стъпка също не чупи екрана.
  const missing = creatureAt(WORLDS.nature, 99);
  assert.equal(missing.avatar, FALLBACK_AVATAR);
  assert.equal(missing.name, '—');
  assert.equal(creatureAt(broken, 0).avatar, FALLBACK_AVATAR, 'липсващ avatar се заменя');
});

test('смяната на свят не пипа прогреса', () => {
  const profile = { ...defaultProfile(), totalXP: 4000, step: 12, coins: 40, owned: ['hat-crown'] };
  const before = JSON.stringify(profile);
  const settings = cleanSettings({ ...defaultSettings(), world: 'garden' });
  assert.equal(settings.world, 'garden');
  assert.equal(JSON.stringify(profile), before, 'профилът е същият обект със същите числа');
  // Старото име на полето продължава да се чете.
  assert.equal(cleanSettings({ skin: 'space' }).world, 'space');
  assert.equal(cleanSettings({ world: 'измислен' }).world, DEFAULT_WORLD);
});

test('авторско право: нищо не носи име от чужда игра', () => {
  // Кирилските имена се търсят като цели думи: иначе „застиване“ съдържа „стив“.
  const latin = ['minecraft', 'gta', 'steve', 'creeper', 'enderman', 'mario', 'roblox', 'fortnite', 'pokemon'];
  const cyrillic = ['майнкрафт', 'стив', 'крийпър', 'ендърман', 'марио', 'роблокс', 'фортнайт', 'покемон'];
  const banned = new RegExp(`(${latin.join('|')})|(?<![а-я])(${cyrillic.join('|')})(?![а-я])`, 'i');
  const data = JSON.stringify([WORLD_LIST, HATS, TOOLS, HERO_COLORS, SHOP_ITEMS, TEXTS]);
  assert.doesNotMatch(data, banned);
  // И в кода, който ги описва.
  for (const file of ['js/content/hero.js', 'js/content/shop.js', 'js/content/worlds/index.js']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), banned, file);
  }
});

test('градината брои вода и никога не заплашва растенията', () => {
  const garden = WORLDS.garden;
  assert.equal(xpWord(garden), 'капки');
  assert.equal(isDrops(garden), true);
  assert.match(garden.calm, /чака/);
  assert.match(garden.calm, /не изсъхва/);
  assert.match(garden.calm, /не умира/);
  // В самите етапи няма увяхване, съхнене или смърт — нито като заплаха, нито като шега.
  const stages = JSON.stringify(garden.creatures);
  assert.doesNotMatch(stages, /увяхв|изсъхн|умре|умира|повяхв|загин|мъртв/i);
  // Останалите светове броят XP.
  for (const id of ['nature', 'builder', 'city', 'space']) assert.equal(xpWord(WORLDS[id]), 'XP');
});

test('градските мисии са без оръжия, престъпления и насилие', () => {
  const city = WORLDS.city;
  assert.match(unlockWord(city), /Мисия/);
  assert.doesNotMatch(JSON.stringify(city), /оръж|пистолет|стрелб|престъп|кражб|крад|бандит|полиц|насил|убий|бой/i);
});

// --- героят ---

test('героят се сглобява от тяло, шапка и инструмент', () => {
  for (const world of WORLD_LIST) {
    const markup = heroMarkup(world, DEFAULT_HERO);
    if (!world.hero) {
      assert.equal(markup, null, `${world.id}: няма герой`);
      continue;
    }
    assert.match(markup, /^<svg /, world.id);
    assert.ok(markup.includes(world.hero.base.trim().slice(0, 20)), `${world.id}: тялото е вътре`);
    assert.ok(world.hero.name && world.hero.note, world.id);
    assert.equal(heroName(world, { name: 'Мечо' }), 'Мечо', 'избраното име побеждава временното');
    assert.equal(heroName(world, { name: '' }), world.hero.name);
  }
});

test('изборът на герой пази само това, което е налично', () => {
  // Без покупки се избира само от безплатните части.
  const free = cleanHero({ color: 'blue', hat: 'crown', tool: 'jetpack', name: '  Иво  ' }, []);
  assert.equal(free.color, 'blue');
  // Некупената част не се слага: остава тази по подразбиране, която е безплатна.
  assert.equal(free.hat, DEFAULT_HERO.hat);
  assert.equal(free.tool, DEFAULT_HERO.tool);
  assert.ok(HATS.find((x) => x.id === free.hat).free, 'подразбиращата се шапка е безплатна');
  assert.ok(TOOLS.find((x) => x.id === free.tool).free, 'подразбиращият се инструмент е безплатен');
  assert.equal(free.name, 'Иво');
  // С покупка вече може.
  const owned = cleanHero({ color: 'blue', hat: 'crown', tool: 'jetpack' }, ['hat-crown', 'tool-jetpack']);
  assert.equal(owned.hat, 'crown');
  assert.equal(owned.tool, 'jetpack');
  // Непознат цвят и дълго име се изчистват.
  const odd = cleanHero({ color: 'дъга', name: 'А'.repeat(40) }, []);
  assert.equal(odd.color, DEFAULT_HERO.color);
  assert.ok(odd.name.length <= 16);
  assert.equal(availableHats([]).length, HATS.filter((h) => h.free).length);
  assert.equal(availableTools(['tool-can']).length, TOOLS.filter((t) => t.free).length + 1);
});

// --- магазинът ---

test('магазинът продава само украса и нищо с предимство', () => {
  assert.ok(SHOP_ITEMS.length >= 10);
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.id)).size, SHOP_ITEMS.length, 'повтарящо се id');
  for (const item of SHOP_ITEMS) {
    assert.ok(KIND_ORDER.includes(item.kind), `${item.id}: непознат вид`);
    assert.ok(Number.isInteger(item.price) && item.price > 0 && item.price <= 200, `${item.id}: цена ${item.price}`);
    assert.ok(item.name && item.name.length > 2, item.id);
    // Нищо, което ускорява, прескача или улеснява.
    assert.doesNotMatch(`${item.id} ${item.name}`, /xp|опит|ниво|трудност|прескач|ускор|бонус|подсказк/i, item.id);
  }
  // Нищо не се продава за реални пари и няма оферти със срок.
  const code = readFileSync(new URL('../js/content/shop.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /PaymentRequest|stripe|paypal|checkout|лв\.|EUR|\$\d/i, 'няма плащане с пари');
  assert.doesNotMatch(JSON.stringify(SHOP_ITEMS), /лв|евро|\$|таймер|само днес|намал/i, 'няма пари и срокове в предметите');
});

test('монетите идват от практиката и не се палят от нищо друго', () => {
  assert.equal(coinsFor(0), 0);
  assert.equal(coinsFor(5), 1, 'малка сесия дава поне една монета');
  assert.equal(coinsFor(100), 10);
  assert.ok(coinsFor(300) > coinsFor(100));
  // Цената се проверява срещу наличните монети.
  assert.equal(canAfford(10, 'hat-crown'), false);
  assert.equal(canAfford(1000, 'hat-crown'), true);
  assert.equal(canAfford(1000, 'няма такова'), false);
  assert.equal(itemOf('няма такова'), null);
  // Украсата за един свят не се предлага в друг.
  assert.ok(itemsForWorld('garden').some((i) => i.id === 'decor-pond'));
  assert.ok(!itemsForWorld('space').some((i) => i.id === 'decor-pond'));
});

test('монетите и покупките пътуват с копието и не изгарят', () => {
  const clean = cleanProfile({ ...defaultProfile(), coins: 75, owned: ['hat-crown', 'измислено', 'hat-crown'] });
  assert.equal(clean.coins, 75);
  assert.deepEqual(clean.owned, ['hat-crown'], 'непознатото и повтореното отпадат');
  assert.equal(cleanProfile({ ...defaultProfile(), coins: -20 }).coins, 0);

  const a = { ...defaultProfile(), totalXP: 600, skillXP: Object.fromEntries(SKILLS.map((s) => [s, 100])), coins: 30, owned: ['hat-crown'] };
  const b = { ...defaultProfile(), totalXP: 600, skillXP: Object.fromEntries(SKILLS.map((s) => [s, 100])), coins: 80, owned: ['tool-can'] };
  const merged = mergeProfiles(a, b, () => SKILLS);
  assert.equal(merged.coins, 80, 'взема се по-голямото, не сборът');
  assert.deepEqual([...merged.owned].sort(), ['hat-crown', 'tool-can'], 'купеното се обединява');
});

// --- детските текстове ---

test('всеки текст има и детска версия, и тя е различна или нарочно същата', () => {
  for (const [key, entry] of Object.entries(TEXTS)) {
    assert.ok(entry.standard && entry.kid, key);
    assert.doesNotMatch(entry.kid, /трябва да|длъжен|провал|неуспех|грешка е|срам/i, key);
    // Заместителите в двете версии съвпадат: иначе някъде ще зее празно.
    const slots = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(slots(entry.kid), slots(entry.standard), key);
  }
  assert.equal(text('home.you', { kid: true, name: 'Мравка I' }), 'Сега си Мравка I.');
  assert.equal(text('home.you', { name: 'Мравка I' }), 'Ти си Мравка I.');
  assert.equal(text('няма такъв ключ'), '');
  assert.equal(fill('{a} и {b}', { a: 1 }), '1 и ', 'липсваща стойност не дава undefined');
});

test('docs/kid-texts.md е същото, което е в кода (иначе: npm run kid-texts)', () => {
  const doc = readFileSync(new URL('../docs/kid-texts.md', import.meta.url), 'utf8');
  assert.equal(doc, renderKidTexts());
});
