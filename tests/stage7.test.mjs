// Етап 7: подготовка за издаване. Тук стоят проверките, които не зависят от браузър:
// версията, изчистеният тестов режим и договорът на обвивката за клавиатура и четец.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cleanPayload } from '../js/core/profiles.js';
import { mergePayload } from '../js/core/merge.js';
import { SKILLS } from '../js/core/config.js';
import { defaultProfile, defaultSettings } from '../js/core/model.js';
import { buildManifest } from '../tools/gen-precache.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
// Версията се чете от текста: изгледът пипа window и не се зарежда в Node.
const APP_VERSION = read('js/views/settings.js').match(/APP_VERSION = '([^']+)'/)[1];

test('версията е една и съща в package.json и в Настройки', () => {
  assert.equal(APP_VERSION, pkg.version, 'вдигни версията на двете места наведнъж');
  assert.match(read('docs/ROADMAP.md'), new RegExp(`v${pkg.version.replace(/\./g, '\\.')}`), 'бележката в ROADMAP.md липсва');
});

test('тестовият режим е махнат: няма js/dev нито в кода, нито в кеша', () => {
  assert.equal(existsSync(new URL('../js/dev', import.meta.url)), false, 'папката js/dev още стои');
  const files = buildManifest().files;
  assert.equal(files.filter((f) => f.includes('/dev/')).length, 0, 'манифестът още сочи js/dev');
  const code = files
    .filter((f) => f.endsWith('.js'))
    .map((f) => read(f.replace('./', '')))
    .join('\n');
  assert.doesNotMatch(code, /dev\/simulator|renderSimulator|setSimSnapshot/, 'останал е код на симулатора');
});

// Най-важното при махането: ако някой профил е бил оставен в тестов режим, истинският
// прогрес е бил прибран в snapshot. Четенето трябва да го върне, не да го забрави.
test('прибраният истински прогрес се връща при четене', () => {
  const real = { ...defaultProfile(), totalXP: 4000, step: 12 };
  const fake = { ...defaultProfile(), totalXP: 90000, step: 44 };
  const payload = cleanPayload({
    profile: fake, settings: defaultSettings(), records: [], topics: [], simSnapshot: real,
  });
  assert.equal(payload.profile.step, 12, 'върна се снимката, не напомпаният профил');
  assert.equal(payload.profile.totalXP, 4000);
  assert.equal('simSnapshot' in payload, false, 'полето не бива да остава в записа');

  // Без снимка профилът си е профилът.
  const plain = cleanPayload({
    profile: real, settings: defaultSettings(), records: [], topics: [], simSnapshot: null,
  });
  assert.equal(plain.profile.step, 12);
  assert.equal('simSnapshot' in plain, false);
});

test('сливането вече не носи поле за тестов режим', () => {
  const one = {
    profile: { ...defaultProfile(), totalXP: 600, step: 2 },
    settings: defaultSettings(), records: [], topics: [],
  };
  const two = {
    profile: { ...defaultProfile(), totalXP: 900, step: 3 },
    settings: defaultSettings(), records: [], topics: [],
  };
  const merged = mergePayload(one, two, () => SKILLS);
  assert.equal('simSnapshot' in merged, false);
  assert.ok(merged.profile.step >= 3, 'достигнатата стъпка не се отнема');
});

test('обвивката дава на клавиатурата път до съдържанието', () => {
  const html = read('index.html');
  assert.match(html, /id="skip"[^>]*class="skip-link"/, 'липсва бутонът за прескачане на менюто');
  assert.match(html, /<main id="view"[^>]*tabindex="-1"/, 'съдържанието не може да приеме фокуса');
  // Бутонът трябва да е ПРЕД менюто в кода: иначе прескачането идва след него.
  assert.ok(html.indexOf('id="skip"') < html.indexOf('id="sidebar"'), 'бутонът стои след менюто');
  assert.match(read('styles/app.css'), /\.skip-link:focus-visible/, 'бутонът не се показва при фокус');
  assert.match(read('js/views/shell.js'), /getElementById\('skip'\)/, 'бутонът не е вързан');
});

test('двете навигации имат различни имена за четеца', () => {
  const labels = [...read('index.html').matchAll(/<nav[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
  const inShell = [...read('js/views/shell.js').matchAll(/'nav', \{[^}]*'aria-label': '([^']+)'/g)].map((m) => m[1]);
  const all = [...labels, ...inShell];
  assert.ok(all.length >= 2, `намерени са ${all.length} навигации`);
  assert.equal(new Set(all).size, all.length, `повтарящо се име: ${all.join(', ')}`);
});

test('диагностиката не стои в менюто: вижда се само при проверка', () => {
  const shell = read('js/views/shell.js');
  assert.doesNotMatch(shell, /diagnostics/, 'диагностиката е влязла в навигацията');
  // Екранът сам се затваря, ако знамето не е вдигнато.
  assert.match(read('js/views/diagnostics.js'), /if \(!deviceSettings\(\)\.diagnostics\)/);
});

test('контролният списък за ръчна проверка покрива задължителното', () => {
  const list = read('docs/RELEASE-CHECKLIST.md');
  for (const topic of ['Android', 'докосван', 'пренос', 'офлайн', 'TalkBack', 'клавиатура']) {
    assert.match(list, new RegExp(topic, 'i'), `липсва раздел за „${topic}“`);
  }
});

test('браузърната проверка носи наборите на Етап 7', () => {
  const check = read('tools/browser-check.mjs');
  assert.match(check, /const SUITES = \{[\s\S]*a11y[\s\S]*release/);
  assert.ok(existsSync(new URL('../tools/a11y-audit.js', import.meta.url)), 'липсва одитът за четеца');
});
