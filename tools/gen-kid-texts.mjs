// Генерира docs/kid-texts.md от js/content/texts.js: таблица „стар текст → нов текст“
// за преглед. Тест пази документа и кода да не се разминат.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEXTS } from '../js/content/texts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'kid-texts.md');

const SECTIONS = [
  ['home.', 'Начален екран'],
  ['play.', 'Игра и резултат'],
  ['feel.', 'Оценка „Как беше“'],
  ['math.', 'Математика'],
  ['gallery.', 'Галерия'],
  ['profile.', 'Профил'],
];

export function render() {
  const lines = [
    '# Текстове в детския режим',
    '',
    'Генериран файл: обновява се с `npm run kid-texts` от `js/content/texts.js`. Не се редактира на ръка.',
    '',
    'Детският профил вижда дясната колона. Принципите: кратки изречения и познати думи; хвали се усилието и начинът, не талантът; грешката е информация, не провал; без сарказъм, без натиск и без сравнения.',
    '',
    `Общо ${Object.keys(TEXTS).length} текста.`,
    '',
  ];
  for (const [prefix, title] of SECTIONS) {
    const keys = Object.keys(TEXTS).filter((k) => k.startsWith(prefix));
    if (!keys.length) continue;
    lines.push(`## ${title}`, '', '| Ключ | Стандартен текст | Детски текст |', '|---|---|---|');
    for (const key of keys) {
      const { standard, kid } = TEXTS[key];
      lines.push(`| \`${key}\` | ${standard.replace(/\|/g, '\\|')} | ${kid.replace(/\|/g, '\\|')} |`);
    }
    lines.push('');
  }
  lines.push('Заместителите в къдрави скоби (`{name}`, `{xp}`, `{step}`, `{skill}`, `{score}`) се попълват от приложението.', '');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, render());
  console.log(`docs/kid-texts.md: ${Object.keys(TEXTS).length} текста`);
}
