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
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const SUITES = { '6v': stage6v, added };

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
