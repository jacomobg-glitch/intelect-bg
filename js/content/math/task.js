// Общи помощници за всички генератори на задачи. Чисти функции, без DOM.
// Тук живее и сравняването на отговори: „0,5“, „0.5“ и „1/2“ са един и същ отговор.

export const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
export const pick = (random, list) => list[Math.floor(random() * list.length)];

export const numberTask = (prompt, answer, hints, check) => ({ kind: 'number', prompt, answer: String(answer), options: null, hints, check });
export const choiceTask = (prompt, answer, options, hints, check) => ({ kind: 'choice', prompt, answer, options, hints, check });

// Български запис на число: десетичната запетая е „,“.
export const bg = (x) => String(x).replace('.', ',');

// Закръгля и маха излишните нули, после минава на български запис: 2.50 → „2,5“.
export function dec(x, places = 2) {
  const factor = 10 ** places;
  const rounded = Math.round(x * factor) / factor;
  return bg(String(rounded));
}

export const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

// Съкратена дроб като [числител, знаменател], със знак в числителя.
export function reduce(num, den) {
  const sign = den < 0 ? -1 : 1;
  const d = Math.abs(den);
  const n = num * sign;
  const g = gcd(Math.abs(n), d) || 1;
  return [n / g, d / g];
}

// Дроб като текст. Цяло число се пише без знаменател: 4/2 става „2“.
export function fracText(num, den) {
  const [n, d] = reduce(num, den);
  return d === 1 ? String(n) : `${n}/${d}`;
}

// Чете число от текст: цяло, десетично (с „,“ или „.“) или проста дроб.
// Връща null, когато текстът не е число — тогава сравняването минава на текст.
export function parseNumeric(raw) {
  const s = String(raw).replace(/\s+/g, '').replace(/,/g, '.').replace(/^\+/, '');
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

const EPSILON = 1e-9;

// Числата се сравняват по стойност, затова еквивалентните записи минават.
// Текстовите отговори („Да“, „Четно“) се сравняват без интервали и без значение на главните букви.
export function sameAnswer(given, want) {
  const text = String(given).trim();
  if (!text) return false;
  const a = parseNumeric(text);
  const b = parseNumeric(want);
  if (a !== null && b !== null) return Math.abs(a - b) < EPSILON;
  const clean = (s) => String(s).replace(/\s+/g, '').toLowerCase();
  return clean(text) === clean(want);
}
