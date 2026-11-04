// Генерира precache-manifest.js: списък с файлове за офлайн работа и версия по съдържанието им.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'precache-manifest.js';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

export function buildManifest() {
  const paths = [
    join(ROOT, 'index.html'),
    join(ROOT, 'manifest.json'),
    join(ROOT, 'sw.js'),
    ...walk(join(ROOT, 'styles')),
    ...walk(join(ROOT, 'js')),
    ...walk(join(ROOT, 'icons')),
  ].map((p) => relative(ROOT, p).split(sep).join('/')).sort();

  const hash = createHash('sha256');
  for (const p of paths) {
    hash.update(p);
    hash.update(readFileSync(join(ROOT, p)));
  }
  const files = paths.filter((p) => p !== 'sw.js' && p !== 'index.html').map((p) => `./${p}`);
  // './' вместо index.html: виж коментара в sw.js.
  files.unshift('./');
  return { version: hash.digest('hex').slice(0, 12), files };
}

export const render = (m) => `// Генериран файл: не се редактира на ръка. Обновява се с \`npm run precache\`.\nself.PRECACHE = ${JSON.stringify(m, null, 2)};\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = buildManifest();
  writeFileSync(join(ROOT, OUT), render(manifest));
  console.log(`${OUT}: версия ${manifest.version}, ${manifest.files.length} файла`);
}
