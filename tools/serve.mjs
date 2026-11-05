// Локален сървър за браузърните проверки. Дава приложението на същия път, на който
// стои и на живо (/intelect-bg/), за да не се разминават адресите.
//
// Защо е тук, а не наготово „npx serve“: проверката трябва да може да каже с
// сигурност ПРЕД КОЙ сървър стои. Затова /__health връща корена и кога е пуснат —
// стар процес от предишен пробег се разпознава веднага.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_PATH = '/intelect-bg/';
const STARTED = new Date().toISOString();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

export function createAppServer({ root = ROOT, basePath = BASE_PATH } = {}) {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/__health') {
      send(res, 200, JSON.stringify({ ok: true, root, started: STARTED }), TYPES['.json']);
      return;
    }
    if (!url.pathname.startsWith(basePath)) {
      send(res, 404, `Приложението е на ${basePath}`);
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(basePath.length)) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    // Никакво излизане извън корена: „..“ в адреса не води до чужди файлове.
    const full = normalize(join(root, rel));
    if (!full.startsWith(root + sep) && full !== root) {
      send(res, 403, 'Извън корена');
      return;
    }
    if (!existsSync(full) || statSync(full).isDirectory()) {
      send(res, 404, 'Няма такъв файл');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(full).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(full).pipe(res);
  });
}

export function startServer({ port = 5173, root = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const server = createAppServer({ root });
    server.once('error', (err) => {
      // Зает порт значи стар сървър: по-добре ясна грешка, отколкото проверка
      // срещу неизвестно какво.
      reject(err.code === 'EADDRINUSE'
        ? new Error(`Портът ${port} е зает. Спри стария сървър и пусни наново.`)
        : err);
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port, root, started: STARTED }));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 5173;
  startServer({ port })
    .then(() => {
      console.log(`Приложението е на http://127.0.0.1:${port}${BASE_PATH} (корен: ${ROOT})`);
      console.log(`Проверка на живота: http://127.0.0.1:${port}/__health`);
    })
    .catch((err) => {
      console.error(`Сървърът не тръгна: ${err.message}`);
      process.exit(1);
    });
}
