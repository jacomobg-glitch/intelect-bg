// Браузърна проверка със снимки, без библиотеки: Chrome се води направо през CDP
// по WebSocket, който Node вече носи. Защо така, а не с готов инструмент: проектът
// не допуска зависимости, а проверката трябва да може да се пусне и след години.
//
// Пуска се с вече вдигнат сървър:
//   npm run serve          (в отделен прозорец)
//   node tools/browser-check.mjs [име-на-набор]
//
// Сървърът се пита през /__health ПРЕДИ Chrome да тръгне: мъртъв сървър или чужд
// процес на същия порт спира проверката с ясна грешка, вместо да даде празни екрани.
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommend } from '../js/core/calibration.js';
import { SCHEMA_VERSION } from '../js/core/model.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'docs', 'screenshots');
const ORIGIN = 'http://127.0.0.1:5173';
const BASE = `${ORIGIN}/intelect-bg/`;

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

async function checkServer() {
  let health;
  try {
    health = await (await fetch(`${ORIGIN}/__health`)).json();
  } catch {
    die(`Няма сървър на ${ORIGIN}. Пусни „npm run serve“ в отделен прозорец.`);
  }
  if (health.root !== ROOT) {
    die(`На ${ORIGIN} стои друг проект: ${health.root}. Спри го и пусни „npm run serve“ оттук.`);
  }
  console.log(`сървър: ${health.root}, пуснат ${health.started}`);
}

// --- тънък CDP клиент ---

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data || '')})`));
      else resolve(msg.result);
      return;
    }
    const waiting = listeners.get(msg.method);
    if (waiting) { listeners.delete(msg.method); waiting(msg.params); }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP връзката не се отвори')), { once: true });
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    // При изтекло време връща null вместо да откаже: липсата на събитие е отговор,
    // а не грешка — например load не идва при смяна само на фрагмента.
    once(method, timeoutMs = 15000) {
      return new Promise((resolve) => {
        listeners.set(method, resolve);
        setTimeout(() => {
          if (listeners.get(method) === resolve) { listeners.delete(method); resolve(null); }
        }, timeoutMs);
      });
    },
    close: () => ws.close(),
  };
}

async function launchChrome() {
  const binary = CHROME_PATHS.find((p) => existsSync(p));
  if (!binary) die('Chrome не е намерен. Подай пътя през CHROME_PATH.');
  const profileDir = mkdtempSync(join(tmpdir(), 'evo-check-'));
  const child = spawn(binary, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Chrome не каза къде слуша DevTools')), 20000);
    child.stderr.on('data', (chunk) => {
      buffer += chunk;
      const found = buffer.match(/ws:\/\/[^\s]+/);
      if (found) { clearTimeout(timer); resolve(found[0]); }
    });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Chrome спря с код ${code}`)); });
  });
  // Страницата се намира през списъка с цели: така не се налага работа със сесии.
  const list = await (await fetch(`${wsUrl.replace(/^ws:\/\//, 'http://').replace(/\/devtools\/browser\/.*/, '')}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('Chrome не отвори страница');
  const cdp = connect(page.webSocketDebuggerUrl);
  await cdp.ready;
  return {
    cdp,
    stop() {
      cdp.close();
      child.kill();
      try { rmSync(profileDir, { recursive: true, force: true }); } catch { /* временната папка си отива сама */ }
    },
  };
}

// --- помощници за проверката ---

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
  return result.value;
}

async function open(cdp, hash) {
  const url = `${BASE}${hash ? `#${hash}` : ''}`;
  // Първо празна страница. Смяната само на фрагмента е навигация в същия документ:
  // приложението успява да пренасочи адреса към „Кой тренира?“ и презареждането
  // после хваща чужд екран. Чистият преход гарантира, че се зарежда исканият адрес.
  const blank = cdp.once('Page.loadEventFired', 5000);
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await blank;
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  if (!(await loaded)) throw new Error(`страницата ${url} не се зареди`);
  // Данните се четат от IndexedDB, затова се чака готовото тяло, а не само load.
  for (let i = 0; i < 60; i += 1) {
    if (await evaluate(cdp, 'document.body.classList.contains("ready")')) break;
    await wait(100);
  }
  await wait(250);
}

async function screenshot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  снимка: docs/screenshots/${name}.png`);
}

async function device(cdp, { width, height, mobile }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
}

// Последната награда по стълбата е на стъпка 34; профилът на проверката стои над нея,
// за да е отворено ВСИЧКО. Числото е тук, а не по наборите: иначе разместване на
// стълбата оставя теми заключени и снимките излизат празни.
const READY_STEP = 40;

// Профил с достатъчно напредък, за да са отворени всички теми.
// Пише се направо в IndexedDB през модулите на приложението, за да е валиден записът.
const SEED = (theme, step) => `(async () => {
  const { defaultProfileEntry, cardOf } = await import('./js/core/profiles.js');
  const { writeAll, PROFILES } = await import('./js/core/db.js');
  const entry = defaultProfileEntry({ id: 'check', name: 'Проверка', role: 'admin', order: 0 });
  entry.autoLockMin = 0;
  entry.data.profile.step = ${step};
  entry.data.profile.totalXP = 60000;
  for (const key of Object.keys(entry.data.profile.skillXP)) entry.data.profile.skillXP[key] = 12000;
  entry.data.settings.theme = '${theme}';
  entry.card = cardOf(entry.data);
  await writeAll([
    { store: PROFILES, value: entry },
    { store: 'meta', value: { key: 'activeProfile', id: 'check' } },
  ]);
  return entry.data.profile.step;
})()`;

// Визуализацията стои под обясненията, затова се докарва в средата на екрана:
// снимката трябва да показва точно новата рисунка.
const SHOW_VIZ = `(() => {
  const viz = document.querySelector('.viz');
  if (!viz) return 'няма визуализация';
  viz.scrollIntoView({ block: 'center' });
  return viz.querySelector('svg') ? 'готово' : 'без svg';
})()`;

// Дванайсетте подтеми от теми 7–10: всяка носи своя нова визуализация.
const ALL_NEW_TOPICS = [
  'expressions', 'one-step', 'two-step',
  'angles', 'perimeter', 'area',
  'charts', 'averages', 'probability',
  'sequences', 'multiples', 'counting',
];

// Натиска контрола на визуализацията по надписа ѝ.
const CLICK = (text) => `(() => {
  const button = [...document.querySelectorAll('.viz-controls button')]
    .find((b) => b.textContent.includes(${JSON.stringify(text)}));
  if (!button) return 'няма копче „' + ${JSON.stringify(text)} + '“';
  button.click();
  return 'натиснато';
})()`;

// Единайсетте подтеми, добавени след Етап 6в.
const ADDED_TOPICS = [
  'inequalities', 'coordinates', 'linear', 'parabola', 'rates',
  'pythagoras', 'simulation', 'truth-tables', 'knights', 'coins', 'grid-puzzles',
];

const DESKTOP = { width: 1280, height: 900, mobile: false };
const PORTRAIT = { width: 390, height: 844, mobile: true };
const LANDSCAPE = { width: 844, height: 390, mobile: true };

// Снимките за Етап 6в: четирите нови групи, двете теми, двете ориентации и офлайн.
async function stage6v(cdp) {
  await device(cdp, DESKTOP);
  await open(cdp, '');
  const step = await evaluate(cdp, SEED('dark', READY_STEP));
  console.log(`профил за проверката: стъпка ${step}`);

  await open(cdp, '/math');
  await evaluate(cdp, 'window.scrollTo(0, document.body.scrollHeight)');
  await wait(150);
  await screenshot(cdp, 'stage6v-math-tree');

  const topics = [
    ['expressions', 'stage6v-expressions'],
    ['one-step', 'stage6v-equations'],
    ['charts', 'stage6v-charts'],
    ['averages', 'stage6v-data'],
    ['probability', 'stage6v-probability'],
    ['multiples', 'stage6v-patterns'],
  ];
  for (const [id, name] of topics) {
    await open(cdp, `/math/${id}`);
    console.log(`  ${id}: ${await evaluate(cdp, SHOW_VIZ)}`);
    await wait(150);
    await screenshot(cdp, name);
  }

  // Светла тема: същата проверка на геометрията, за да се види контрастът и там.
  await evaluate(cdp, SEED('light', READY_STEP));
  await open(cdp, '/math/area');
  console.log(`  area (светла): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'stage6v-geometry-light');
  await evaluate(cdp, SEED('dark', READY_STEP));

  // Упражнение: задача от новите генератори, подсказките и полето за отговор.
  await open(cdp, '/math/two-step/practice');
  await wait(250);
  console.log(`  условие: ${await evaluate(cdp, 'document.querySelector(".task-prompt")?.textContent || "няма задача"')}`);
  await screenshot(cdp, 'stage6v-session');

  // Телефон: портрет и пейзаж.
  await device(cdp, PORTRAIT);
  await open(cdp, '/math/angles');
  console.log(`  angles (портрет): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'stage6v-mobile-portrait');

  await device(cdp, LANDSCAPE);
  await open(cdp, '/math/counting');
  console.log(`  counting (пейзаж): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'stage6v-mobile-landscape');

  // Офлайн: service worker-ът вече е регистриран, затова страницата трябва да се вдигне пак.
  await device(cdp, DESKTOP);
  await open(cdp, '/math');
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await open(cdp, '/math/sequences');
  const offlineOk = await evaluate(cdp, 'document.body.classList.contains("ready") && Boolean(document.querySelector(".viz svg"))');
  console.log(`  офлайн: ${offlineOk ? 'екранът се вдига с визуализация' : 'НЕ се вдига'}`);
  await screenshot(cdp, 'stage6v-offline');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  if (!offlineOk) die('Офлайн проверката падна: страницата не се вдига от кеша.');

  // Накрая всички дванайсет нови рисунки: снимките показват част от тях, но нито една
  // не бива да остане непроверена дали изобщо се рисува.
  const missing = [];
  for (const id of ALL_NEW_TOPICS) {
    await open(cdp, `/math/${id}`);
    if (await evaluate(cdp, SHOW_VIZ) !== 'готово') missing.push(id);
  }
  console.log(missing.length ? `  БЕЗ рисунка: ${missing.join(', ')}` : '  и дванайсетте визуализации се рисуват');
  if (missing.length) die(`Липсва рисунка за: ${missing.join(', ')}`);
}

// Допълненията: неравенства, функции и графики, Питагор, много опити и загадки.
async function added(cdp) {
  await device(cdp, DESKTOP);
  await open(cdp, '');
  console.log(`профил за проверката: стъпка ${await evaluate(cdp, SEED('dark', READY_STEP))}`);

  await open(cdp, '/math');
  await evaluate(cdp, 'window.scrollTo(0, document.body.scrollHeight)');
  await wait(150);
  await screenshot(cdp, 'math-tree-full');

  const plain = [
    ['inequalities', 'math-inequalities'],
    ['linear', 'math-linear'],
    ['parabola', 'math-parabola'],
    ['pythagoras', 'math-pythagoras'],
    ['truth-tables', 'math-truth-table'],
    ['knights', 'math-knights'],
    ['coins', 'math-coins'],
  ];
  for (const [id, name] of plain) {
    await open(cdp, `/math/${id}`);
    console.log(`  ${id}: ${await evaluate(cdp, SHOW_VIZ)}`);
    await wait(150);
    await screenshot(cdp, name);
  }

  // Две рисунки показват същината си чак след щракане.
  await open(cdp, '/math/simulation');
  await evaluate(cdp, SHOW_VIZ);
  console.log(`  simulation: ${await evaluate(cdp, CLICK('Хвърли 1000'))}`);
  await wait(250);
  await evaluate(cdp, SHOW_VIZ);
  await screenshot(cdp, 'math-simulation');

  await open(cdp, '/math/grid-puzzles');
  await evaluate(cdp, SHOW_VIZ);
  console.log(`  grid-puzzles: ${await evaluate(cdp, CLICK('Ана не е в синята'))}, ${await evaluate(cdp, CLICK('Боян е в червената'))}`);
  await wait(200);
  await evaluate(cdp, SHOW_VIZ);
  await screenshot(cdp, 'math-logic-grid');

  // Упражнение с интервал за отговор: новият вид поле се вижда на живо.
  await open(cdp, '/math/inequalities/practice');
  await wait(250);
  console.log(`  условие: ${await evaluate(cdp, 'document.querySelector(".task-prompt")?.textContent || "няма задача"')}`);
  console.log(`  клавиатура за полето: ${await evaluate(cdp, 'document.querySelector(".answer-input")?.inputMode')}`);
  await screenshot(cdp, 'math-inequality-task');

  // Светла тема: графиката на таксата.
  await evaluate(cdp, SEED('light', READY_STEP));
  await open(cdp, '/math/rates');
  console.log(`  rates (светла): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'math-rates-light');
  await evaluate(cdp, SEED('dark', READY_STEP));

  await device(cdp, PORTRAIT);
  await open(cdp, '/math/coordinates');
  console.log(`  coordinates (портрет): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'math-coordinates-mobile');

  await device(cdp, LANDSCAPE);
  await open(cdp, '/math/pythagoras');
  console.log(`  pythagoras (пейзаж): ${await evaluate(cdp, SHOW_VIZ)}`);
  await wait(150);
  await screenshot(cdp, 'math-pythagoras-landscape');

  // Офлайн през service worker-а.
  await device(cdp, DESKTOP);
  await open(cdp, '/math');
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await open(cdp, '/math/knights');
  const offlineOk = await evaluate(cdp, 'document.body.classList.contains("ready") && Boolean(document.querySelector(".viz svg"))');
  console.log(`  офлайн: ${offlineOk ? 'екранът се вдига с визуализация' : 'НЕ се вдига'}`);
  await screenshot(cdp, 'math-offline-knights');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  if (!offlineOk) die('Офлайн проверката падна: страницата не се вдига от кеша.');

  // Нито една от единайсетте нови рисунки не бива да остане непроверена.
  const missing = [];
  for (const id of ADDED_TOPICS) {
    await open(cdp, `/math/${id}`);
    if (await evaluate(cdp, SHOW_VIZ) !== 'готово') missing.push(id);
  }
  console.log(missing.length ? `  БЕЗ рисунка: ${missing.join(', ')}` : '  и единайсетте нови визуализации се рисуват');
  if (missing.length) die(`Липсва рисунка за: ${missing.join(', ')}`);
}

// --- Етап 7: клавиатура, екранен четец и пълен пробег ---

// Одитът живее в отделен файл, за да се чете като код, а не като низ в низ.
const AUDIT = readFileSync(join(ROOT, 'tools', 'a11y-audit.js'), 'utf8');

// Бърза смяна на екрана без презареждане: приложението е hash рутер. Пълното
// презареждане остава за open() там, където се проверява самото зареждане.
async function go(cdp, hash) {
  await evaluate(cdp, "(() => { location.hash = '#/'; return true; })()");
  await wait(60);
  await evaluate(cdp, `(() => { location.hash = '#${hash}'; return true; })()`);
  // Два кадъра: единият за рутера, другият за рисуването.
  await evaluate(cdp, '(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))))()');
  await wait(120);
}

// Списъците с игри и теми се четат от самото приложение: инструментът не ги преписва,
// за да не остане назад при нова игра или нова тема.
const LIST_CONTENT = `(async () => {
  const { allGames } = await import('./js/core/registry.js');
  const { ALL_SUBTOPICS } = await import('./js/content/math/topics.js');
  return { games: allGames().map((g) => g.id), topics: ALL_SUBTOPICS.map((s) => s.id) };
})()`;

// Общите екрани. Игрите и темите се добавят отгоре по списъка от приложението.
const BASE_SCREENS = [
  ['', 'Начало'],
  ['/train', 'Тренирай'],
  ['/games', 'Игри'],
  ['/reflex', 'Рефлекси'],
  ['/math', 'Математика'],
  ['/gallery', 'Еволюция'],
  ['/profile', 'Профил'],
  ['/world', 'Моят свят'],
  ['/shop', 'Магазин'],
  ['/hero', 'Моят герой'],
  ['/settings', 'Настройки'],
  ['/surprise', 'Изненадай ме'],
  ['/diagnostics', 'Диагностика'],
  ['/who', 'Кой тренира?'],
];

// Клавиш през CDP. С text събитието носи знак (цифрите), без text е само клавиш (Tab, Escape).
async function key(cdp, spec) {
  const payload = {
    windowsVirtualKeyCode: spec.vk, code: spec.code, key: spec.key,
  };
  if (spec.text) payload.text = spec.text;
  await cdp.send('Input.dispatchKeyEvent', { type: spec.text ? 'keyDown' : 'rawKeyDown', ...payload });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...payload });
}

const TAB = { vk: 9, code: 'Tab', key: 'Tab' };
const ESCAPE = { vk: 27, code: 'Escape', key: 'Escape' };
// Enter иска знак в събитието: без него бутонът не се задейства.
const ENTER = { vk: 13, code: 'Enter', key: 'Enter', text: String.fromCharCode(13) };
const digitKey = (n) => ({ vk: 48 + n, code: `Digit${n}`, key: String(n), text: String(n) });

// Какво държи фокуса сега и вижда ли се той. При Tab Chrome включва :focus-visible,
// затова контурът трябва да е ненулев: иначе клавиатурата върви на тъмно.
const FOCUS_STATE = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { tag: 'body', name: '', outline: '0px', shadow: 'none', inMain: false };
  const style = getComputedStyle(el);
  const clone = el.cloneNode(true);
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return {
    tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
    name: (el.getAttribute('aria-label') || clone.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
    outline: style.outlineWidth,
    shadow: style.boxShadow,
    inMain: Boolean(el.closest('#view')),
  };
})()`;

// Диагностиката се отваря само с вдигнато знаме: то идва от Настройки.
const ALLOW_DIAGNOSTICS = `(() => {
  const name = 'evolyutsiya-device';
  const device = JSON.parse(localStorage.getItem(name) || '{}');
  localStorage.setItem(name, JSON.stringify({ ...device, diagnostics: true }));
  return true;
})()`;

// Одит на всеки екран плюс обхождане с Tab. Пада при намерен проблем.
async function a11y(cdp) {
  await device(cdp, DESKTOP);
  await open(cdp, '');
  await evaluate(cdp, ALLOW_DIAGNOSTICS);
  const step = await evaluate(cdp, SEED('dark', READY_STEP));
  await open(cdp, '');
  console.log(`профил за одита: стъпка ${step}`);

  const { games, topics } = await evaluate(cdp, LIST_CONTENT);
  const screens = [
    ...BASE_SCREENS,
    ...games.map((id) => [`/play/${id}`, `Игра: ${id}`]),
    ...topics.map((id) => [`/math/${id}`, `Тема: ${id}`]),
    [`/math/${topics[0]}/practice`, 'Упражнение'],
    [`/math/${topics[0]}/test`, 'Тест за овладяване'],
  ];
  console.log(`  ${screens.length} екрана: ${BASE_SCREENS.length} общи, ${games.length} игри, ${topics.length} теми`);

  const bad = [];
  const warnCount = new Map();
  for (const [hash, label] of screens) {
    await go(cdp, hash);
    const result = await evaluate(cdp, AUDIT);
    for (const w of result.warnings) warnCount.set(w, (warnCount.get(w) || 0) + 1);
    if (result.problems.length) {
      bad.push(`${label} (${hash || '/'})`);
      console.log(`  ✖ ${label}: ${result.problems.join(' | ')}`);
    }
  }
  console.log(`  одит: ${screens.length - bad.length} от ${screens.length} екрана без забележки`);
  if (warnCount.size) {
    console.log('  предупреждения (не спират проверката):');
    for (const [line, count] of [...warnCount].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`    ${count}× ${line}`);
    }
  }

  // Първата спирка на клавиатурата е „Към съдържанието“: без нея менюто стои пред
  // съдържанието на всеки екран и десетки Tab-а делят човека от първия бутон.
  await open(cdp, '');
  await key(cdp, TAB);
  const firstStop = await evaluate(cdp, FOCUS_STATE);
  console.log(`  първият Tab хваща: ${firstStop.tag} „${firstStop.name}“`);
  if (firstStop.tag !== 'button#skip') bad.push(`първият Tab хваща ${firstStop.tag}, а не бутона за прескачане`);
  await key(cdp, ENTER);
  await wait(100);
  const afterSkip = await evaluate(cdp, FOCUS_STATE);
  console.log(`  след прескачането фокусът е на: ${afterSkip.tag}`);
  if (!afterSkip.inMain) bad.push('„Към съдържанието“ не мести фокуса в съдържанието');

  // Обхождане с Tab: фокусът се вижда навсякъде и не се заклещва.
  // Презареждане, а не смяна на адреса: иначе обхождането започва оттам, където
  // прескачането е оставило фокуса, и менюто остава непроверено.
  await open(cdp, '');
  const seen = [];
  let reachedMain = null;
  let stuck = null;
  let invisible = null;
  for (let i = 0; i < 40; i += 1) {
    await key(cdp, TAB);
    const focus = await evaluate(cdp, FOCUS_STATE);
    if (focus.tag === 'body') break;
    const mark = `${focus.tag}|${focus.name}`;
    if (seen.length && seen[seen.length - 1] === mark && !stuck) stuck = focus.tag;
    seen.push(mark);
    if (focus.outline === '0px' && focus.shadow === 'none' && !invisible) invisible = `${focus.tag} „${focus.name}“`;
    if (focus.inMain && reachedMain === null) reachedMain = i + 1;
  }
  console.log(`  с Tab: ${seen.length} спирки, съдържанието е достигнато на ${reachedMain ?? '—'}-та`);
  console.log(`  първите спирки: ${seen.slice(0, 4).join(' → ')}`);
  if (invisible) bad.push(`фокусът не се вижда на ${invisible}`);
  if (stuck) bad.push(`фокусът се заклещва на ${stuck}`);
  if (reachedMain === null) bad.push('с Tab не се стига до съдържанието');

  // Escape затваря менюто на телефон: иначе фокусът остава зад него.
  await device(cdp, PORTRAIT);
  await go(cdp, '');
  await evaluate(cdp, "(() => { document.body.classList.add('drawer-open'); return true; })()");
  await key(cdp, ESCAPE);
  await wait(80);
  const drawerClosed = await evaluate(cdp, "!document.body.classList.contains('drawer-open')");
  console.log(`  Escape затваря менюто: ${drawerClosed ? 'да' : 'НЕ'}`);
  if (!drawerClosed) bad.push('Escape не затваря менюто');

  // Снимки: началният екран с видим фокус и Настройки на телефон.
  await device(cdp, DESKTOP);
  await open(cdp, '');
  await key(cdp, TAB);
  await screenshot(cdp, 'stage7-focus-desktop');
  await device(cdp, PORTRAIT);
  await go(cdp, '/settings');
  await screenshot(cdp, 'stage7-settings-mobile');

  if (bad.length) die(`Одитът за клавиатура и четец падна:\n  - ${bad.join('\n  - ')}`);
}

// --- пълен пробег: първо отваряне, игра, еволюция, експорт, импорт, офлайн ---

async function clearEverything(cdp) {
  await open(cdp, '');
  await evaluate(cdp, `(async () => {
    localStorage.clear();
    const names = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name } of names) {
      if (!name) continue;
      await new Promise((done) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = done;
        request.onerror = done;
        request.onblocked = done;
      });
    }
    return true;
  })()`);
}

// Пише в поле и вдига input, за да стигне до кода на приложението.
const TYPE = (selector, value) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return 'няма поле ' + ${JSON.stringify(selector)};
  el.value = ${JSON.stringify(value)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'готово';
})()`;

// Натиска бутон или връзка по видимия надпис, в избрана част от екрана.
const PRESS = (text, scope = 'body') => `(() => {
  const root = document.querySelector(${JSON.stringify(scope)});
  if (!root) return 'няма ' + ${JSON.stringify(scope)};
  const target = [...root.querySelectorAll('button, a, [role="button"]')]
    .find((el) => (el.textContent || '').replace(/\\s+/g, ' ').includes(${JSON.stringify(text)}));
  if (!target) return 'няма „' + ${JSON.stringify(text)} + '“';
  target.click();
  return 'натиснато';
})()`;

async function waitFor(cdp, expression, what, timeoutMs = 20000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await evaluate(cdp, expression)) return true;
    await wait(120);
  }
  return die(`Пробегът спря: ${what} не се появи за ${Math.round(timeoutMs / 1000)} секунди.`);
}

// Верният отговор на Stroop се чете от самия екран: правилото е в подсказката,
// а цветът — в класа на стимула. Така играта се играе наистина, а не наужким.
const STROOP_ANSWER = `(() => {
  const cue = document.querySelector('.stroop-cue');
  const stim = document.querySelector('.stroop-stim');
  if (!cue || !stim || !stim.textContent.trim()) return null;
  const buttons = [...document.querySelectorAll('[data-answer]')];
  if (!buttons.length) return null;
  const words = { 'ЧЕРВЕНО': 'red', 'СИНЬО': 'blue', 'ЗЕЛЕНО': 'green', 'ЖЪЛТО': 'yellow' };
  const ink = [...stim.classList].find((c) => c.startsWith('ink-'));
  const byWord = cue.textContent.includes('ДУМАТА');
  const answer = byWord ? words[stim.textContent.trim()] : (ink ? ink.slice(4) : null);
  if (!answer) return null;
  const index = buttons.findIndex((b) => b.dataset.answer === answer);
  return index < 0 ? null : index + 1;
})()`;

// Играе Stroop САМО от клавиатурата: лаптопът е основното устройство.
async function playStroop(cdp) {
  await waitFor(cdp, "Boolean(document.querySelector('.stroop-cue'))", 'игралното поле');
  let answered = 0;
  const started = Date.now();
  // Играта свършва сама след една минута; дотогава се отговаря на всеки стимул.
  while (Date.now() - started < 80000) {
    if (await evaluate(cdp, "Boolean(document.querySelector('.result'))")) break;
    const digit = await evaluate(cdp, STROOP_ANSWER);
    if (!digit) {
      await wait(60);
      continue;
    }
    // Над 100 ms след показването: по-бързите реакции приложението отхвърля нарочно.
    await wait(150);
    await key(cdp, digitKey(digit));
    answered += 1;
    await wait(200);
  }
  return answered;
}

async function release(cdp) {
  await device(cdp, DESKTOP);

  // 1. Първо отваряне: нищо запазено, екранът пита за първи профил.
  await clearEverything(cdp);
  await open(cdp, '');
  console.log(`  първо отваряне: „${await evaluate(cdp, "document.querySelector('h1')?.textContent || ''")}“`);
  if (!await evaluate(cdp, "Boolean(document.querySelector('.who-create'))")) {
    die('Първото отваряне не показа формата за първи профил.');
  }
  await screenshot(cdp, 'stage7-first-run');

  // 2. Създаване на профил без парола: оттук нататък приложението е нормално.
  console.log(`  име: ${await evaluate(cdp, TYPE('.who-create .text-input', 'Проверка'))}`);
  await evaluate(cdp, PRESS('Създай', '.who-create'));
  await waitFor(cdp, "location.hash === '#/' && Boolean(document.querySelector('.hero'))", 'началният екран');
  console.log(`  профилът е създаден: ${await evaluate(cdp, "document.querySelector('.hero h1')?.textContent || ''")}`);
  await screenshot(cdp, 'stage7-home-new');

  // 3. Прогрес точно под първия праг: следващата изиграна сесия трябва да го премине.
  const before = await evaluate(cdp, `(async () => {
    const { CUMULATIVE_XP, applyXP } = await import('./js/core/evolution.js');
    const { SKILLS } = await import('./js/core/config.js');
    const { activeSkills } = await import('./js/core/registry.js');
    const { saveProfile, state } = await import('./js/core/store.js');
    const { profile } = applyXP(state.profile, CUMULATIVE_XP[1] - 5, SKILLS, activeSkills);
    await saveProfile(profile);
    return { step: profile.step, totalXP: profile.totalXP, need: CUMULATIVE_XP[1] };
  })()`);
  console.log(`  подготвено: стъпка ${before.step}, ${before.totalXP} XP при праг ${before.need}`);

  // 4. Игра от клавиатурата до край, после еволюция и резултат.
  await go(cdp, '/play/stroop');
  await waitFor(cdp, "Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Старт')))", 'бутонът „Старт“');
  await screenshot(cdp, 'stage7-game-intro');
  await evaluate(cdp, PRESS('Старт'));
  const answers = await playStroop(cdp);
  console.log(`  изиграна сесия: ${answers} отговора само от клавиатура`);

  // Еволюцията идва преди резултата и чака да бъде затворена.
  const evolved = await evaluate(cdp, "Boolean(document.querySelector('.evo-overlay'))");
  if (evolved) {
    await screenshot(cdp, 'stage7-evolution');
    // Превръщането е модален екран: проверява се както четецът го чува, така и
    // че се затваря само от клавиатура (Escape първо прескача, после продължава).
    const overlay = await evaluate(cdp, `(() => {
      const el = document.querySelector('.evo-overlay');
      return {
        role: el.getAttribute('role'),
        modal: el.getAttribute('aria-modal'),
        label: el.getAttribute('aria-label'),
        focusInside: el.contains(document.activeElement),
      };
    })()`);
    console.log(`  превръщане: role=${overlay.role}, aria-modal=${overlay.modal}, име „${overlay.label}“, фокусът вътре: ${overlay.focusInside ? 'да' : 'НЕ'}`);
    if (overlay.role !== 'dialog' || overlay.modal !== 'true' || !overlay.label) die('Екранът на превръщането не е обявен като модален диалог с име.');
    if (!overlay.focusInside) die('Фокусът не влиза в екрана на превръщането.');
    await key(cdp, ESCAPE);
    await wait(400);
    await key(cdp, ESCAPE);
    await wait(400);
    if (await evaluate(cdp, "Boolean(document.querySelector('.evo-overlay'))")) {
      die('Екранът на превръщането не се затвори с Escape.');
    }
  }
  await waitFor(cdp, "Boolean(document.querySelector('.result'))", 'екранът с резултата', 30000);
  const after = await evaluate(cdp, `(async () => {
    const { state } = await import('./js/core/store.js');
    const record = state.records.get('stroop');
    return { step: state.profile.step, totalXP: state.profile.totalXP, plays: record ? record.plays : 0 };
  })()`);
  console.log(`  след сесията: стъпка ${after.step}, ${Math.round(after.totalXP)} XP, изигравания ${after.plays}`);
  await screenshot(cdp, 'stage7-result');
  if (after.plays < 1) die('Сесията не беше записана: играта не стигна до край.');
  if (after.totalXP <= before.totalXP) die('Сесията не донесе XP.');
  if (after.step <= before.step) die('Прагът беше преминат, но стъпката не се вдигна.');
  if (!evolved) die('Стъпката се вдигна, но анимацията на превръщането не се показа.');

  // 5. Експорт: истинско изтегляне на файл, не само натиснат бутон.
  const downloads = mkdtempSync(join(tmpdir(), 'evo-dl-'));
  await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await go(cdp, '/settings');
  await waitFor(cdp, "Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Изтегли моето копие')))", 'бутонът за експорт');
  await evaluate(cdp, PRESS('Изтегли моето копие'));
  let file = null;
  for (let i = 0; i < 50 && !file; i += 1) {
    const found = readdirSync(downloads).filter((n) => n.endsWith('.json'));
    if (found.length) file = join(downloads, found[0]);
    else await wait(200);
  }
  if (!file) die(`Експортът не свали файл в ${downloads}.`);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`  експорт: ${backup.profiles.length} профил, стъпка ${backup.profiles[0].card.step}, схема ${backup.schema}`);
  if (backup.app !== 'evolyutsiya-na-uma') die('Свалененият файл не е копие на приложението.');
  if (backup.profiles[0].card.step !== after.step) die('Копието не носи достигнатата стъпка.');
  const exportNote = await evaluate(cdp, "[...document.querySelectorAll('p')].some((p) => p.textContent.includes('Последен експорт:') && !p.textContent.includes('още няма'))");
  console.log(`  „Последен експорт“ се обнови: ${exportNote ? 'да' : 'НЕ'}`);
  if (!exportNote) die('Полето „Последен експорт“ остана празно.');
  await screenshot(cdp, 'stage7-export');

  // 6. Импорт на същия файл: сливането не бива да отнема нищо.
  const { root: document_ } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: document_.nodeId, selector: 'input[type="file"]' });
  if (!nodeId) die('Полето за файл не се намери в Настройки.');
  await cdp.send('DOM.setFileInputFiles', { files: [file], nodeId });
  await waitFor(cdp, "Boolean(document.querySelector('dialog[open] .compare'))", 'сравнението при импорт');
  await screenshot(cdp, 'stage7-import');
  await evaluate(cdp, PRESS('Зареди', 'dialog[open]'));
  await waitFor(cdp, "[...document.querySelectorAll('dialog[open] h2')].some((h) => h.textContent.includes('Импортът приключи'))", 'отчетът от импорта');
  console.log(`  импорт: ${await evaluate(cdp, "[...document.querySelectorAll('dialog[open] p')].map((p) => p.textContent).join(' ')")}`);
  await evaluate(cdp, PRESS('Добре', 'dialog[open]'));
  await wait(400);
  const mergedAfter = await evaluate(cdp, `(async () => {
    const { state } = await import('./js/core/store.js');
    return { step: state.profile.step, totalXP: state.profile.totalXP };
  })()`);
  console.log(`  след импорта: стъпка ${mergedAfter.step}, ${Math.round(mergedAfter.totalXP)} XP`);
  if (mergedAfter.step < after.step || mergedAfter.totalXP < after.totalXP) die('Импортът отне напредък.');

  // 7. Копие от по-нова версия: двете устройства може да са на различни кеширани версии.
  // Отказът трябва да е спокоен и да НЕ пипа нищо.
  const futureFile = join(downloads, 'ot-badeshteto.json');
  writeFileSync(futureFile, JSON.stringify({ ...backup, schema: SCHEMA_VERSION + 1 }, null, 2));
  const { root: doc2 } = await cdp.send('DOM.getDocument');
  const future = await cdp.send('DOM.querySelector', { nodeId: doc2.nodeId, selector: 'input[type="file"]' });
  await cdp.send('DOM.setFileInputFiles', { files: [futureFile], nodeId: future.nodeId });
  await waitFor(cdp, "[...document.querySelectorAll('dialog[open] h2')].some((h) => h.textContent.includes('Импортът не мина'))", 'отказът при по-нова версия');
  const refusal = await evaluate(cdp, "[...document.querySelectorAll('dialog[open] p')].map((p) => p.textContent).join(' ')");
  console.log(`  по-нова версия: ${refusal}`);
  if (!refusal.includes('по-нова версия') || !refusal.includes('интернет')) {
    die('Съобщението за по-нова версия не казва причината и какво да се направи.');
  }
  if (!refusal.includes('Данните ти не са променени')) die('Отказът не успокоява, че нищо не е пипнато.');
  await screenshot(cdp, 'stage7-future-version');
  await evaluate(cdp, PRESS('Добре', 'dialog[open]'));
  await wait(300);
  const untouched = await evaluate(cdp, `(async () => {
    const { state } = await import('./js/core/store.js');
    return { step: state.profile.step, totalXP: state.profile.totalXP };
  })()`);
  if (untouched.step !== mergedAfter.step || untouched.totalXP !== mergedAfter.totalXP) {
    die('Отказаният импорт все пак е променил прогреса.');
  }
  console.log('  прогресът след отказа е непокътнат');

  // 8. Отчетът за калибриране: сглобява се от току-що изиграната сесия и се сваля,
  // после Node го прекарва през същата препоръка, която ползва и `npm run calibrate`.
  await evaluate(cdp, ALLOW_DIAGNOSTICS);
  await go(cdp, '/diagnostics');
  await waitFor(cdp, "Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Отчет за калибриране')))", 'бутонът за отчета');
  await evaluate(cdp, PRESS('Отчет за калибриране'));
  await waitFor(cdp, "Boolean(document.querySelector('.diag-report'))", 'текстът на отчета');
  const shown = await evaluate(cdp, "[...document.querySelectorAll('.diag-report')].map((t) => t.value).find((v) => v.includes('Отчет за калибриране')) || ''");
  console.log(`  отчет за калибриране: ${shown.split('\n')[4] || 'празен'}`);
  if (!shown.includes('Stroop')) die('Отчетът не носи току-що изиграната игра.');
  if (/\d{4}-\d{2}-\d{2}/.test(shown)) die('Отчетът съдържа дата, а не бива.');
  // Секцията е под целия екран: снимката трябва да показва нея, не заглавието.
  await evaluate(cdp, `(() => {
    const area = [...document.querySelectorAll('.diag-report')].find((t) => t.value.includes('Отчет за калибриране'));
    area.closest('section').scrollIntoView({ block: 'start' });
    return true;
  })()`);
  await wait(200);
  await screenshot(cdp, 'stage7-calibration');
  await evaluate(cdp, PRESS('Свали като JSON'));
  let calibFile = null;
  for (let i = 0; i < 50 && !calibFile; i += 1) {
    const found = readdirSync(downloads).filter((n) => n.includes('kalibrirane'));
    if (found.length) calibFile = join(downloads, found[0]);
    else await wait(200);
  }
  if (!calibFile) die('Отчетът за калибриране не се свали.');
  const calib = JSON.parse(readFileSync(calibFile, 'utf8'));
  if (calib.kind !== 'calibration') die('Свалененият отчет не е за калибриране.');
  const advice = recommend(calib);
  console.log(`  сборно: ${calib.totals.sessions} сесии, ${calib.totals.trials} опита, успех ${Math.round((calib.totals.accuracy || 0) * 100)}%`);
  console.log(`  препоръка: ${advice.staircaseUp.reason}`);
  if (!calib.games.length) die('Отчетът е празен след изиграна сесия.');

  // 9. Офлайн: приложението се вдига от кеша на service worker-а.
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  });
  await open(cdp, '');
  const offlineOk = await evaluate(cdp, "document.body.classList.contains('ready') && Boolean(document.querySelector('.hero'))");
  console.log(`  офлайн: ${offlineOk ? 'началният екран се вдига с прогреса' : 'НЕ се вдига'}`);
  await screenshot(cdp, 'stage7-offline');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });
  try { rmSync(downloads, { recursive: true, force: true }); } catch { /* временната папка си отива сама */ }
  if (!offlineOk) die('Офлайн проверката падна: приложението не се вдига от кеша.');
}

const SUITES = {
  '6v': stage6v, added, a11y, release,
};

async function main() {
  const which = process.argv[2];
  if (which && !SUITES[which]) die(`Непознат набор „${which}“. Има: ${Object.keys(SUITES).join(', ')}`);
  const chosen = which ? [which] : Object.keys(SUITES);
  await checkServer();
  mkdirSync(SHOTS, { recursive: true });
  const chrome = await launchChrome();
  try {
    await chrome.cdp.send('Page.enable');
    await chrome.cdp.send('Runtime.enable');
    for (const name of chosen) {
      console.log(`\n--- набор ${name} ---`);
      await SUITES[name](chrome.cdp);
    }
    console.log('\nбраузърната проверка мина\n');
  } finally {
    chrome.stop();
  }
}

main().catch((err) => die(err.stack || String(err)));
