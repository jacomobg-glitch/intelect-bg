// Общи помощници за всички генератори на задачи. Чисти функции, без DOM.
// Тук живее и сравняването на отговори: „0,5“, „0.5“ и „1/2“ са един и същ отговор,
// „√8“ и „2√2“ също, а „x > 3“ и „(3; ∞)“ са един и същ интервал.

export const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
export const pick = (random, list) => list[Math.floor(random() * list.length)];

export const numberTask = (prompt, answer, hints, check) => ({ kind: 'number', prompt, answer: String(answer), options: null, hints, check });
export const choiceTask = (prompt, answer, options, hints, check) => ({ kind: 'choice', prompt, answer, options, hints, check });
// Свободен текст, който не е число: интервал, неравенство, дума. Проверява се с sameAnswer.
export const textTask = (prompt, answer, hints, check) => ({ kind: 'text', prompt, answer: String(answer), options: null, hints, check });

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

// Корен като текст. Точен квадрат излиза като цяло число: √16 става „4“.
export function rootText(n) {
  const whole = Math.round(Math.sqrt(n));
  return whole * whole === n ? String(whole) : `√${n}`;
}

// Приравнява записа, преди да се чете: интервали, минус от типографията, главни букви.
const normalize = (raw) => String(raw).replace(/\s+/g, '').replace(/[−–—]/g, '-').toLowerCase();

// Корен: „√2“, „3√5“, „√13/2“, „sqrt(8)“. Стойността е по-важна от записа, затова
// „√8“ и „2√2“ се оказват едно и също число.
function parseRoot(s) {
  const m = s.match(/^(-?)(\d*)(?:√|sqrt)\(?(\d+(?:\.\d+)?)\)?(?:\/(\d+))?$/);
  if (!m) return null;
  const [, sign, coefficient, under, denominator] = m;
  const den = denominator ? Number(denominator) : 1;
  if (den === 0) return null;
  const value = ((coefficient === '' ? 1 : Number(coefficient)) * Math.sqrt(Number(under))) / den;
  return sign === '-' ? -value : value;
}

// Чете число от текст: цяло, десетично (с „,“ или „.“), проста дроб или корен.
// Връща null, когато текстът не е число — тогава сравняването минава на интервал или текст.
export function parseNumeric(raw) {
  const s = normalize(raw).replace(/,/g, '.').replace(/^\+/, '');
  if (!s) return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const frac = s.match(/^(-?\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  return parseRoot(s);
}

const EPSILON = 1e-9;
const INF = Infinity;

// Краят на интервал: число или безкрайност.
function edge(text) {
  if (/^[+]?inf$/.test(text)) return INF;
  if (/^-inf$/.test(text)) return -INF;
  return parseNumeric(text);
}

// Безкраен край винаги е отворен, а нулата се прибира до +0, за да се сравняват
// два интервала по стойност, а не по това как е стигнато до нея.
const span = (lo, loIn, hi, hiIn) => {
  if (lo === null || hi === null || Number.isNaN(lo) || Number.isNaN(hi)) return null;
  if (lo > hi) return null;
  return {
    lo: lo === 0 ? 0 : lo,
    loIn: Number.isFinite(lo) ? loIn : false,
    hi: hi === 0 ? 0 : hi,
    hiIn: Number.isFinite(hi) ? hiIn : false,
  };
};

// Чете интервал в двата записа, които училището ползва:
// неравенство („x > 3“, „2 ≤ x < 5“, „3 < x“) и скоби („(3; ∞)“, „[-∞; 5]“).
// Разделителят в скобите е „;“, защото запетаята вече е десетичен знак.
export function parseInterval(raw) {
  const s = normalize(raw).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/∞/g, 'inf');
  if (!s) return null;
  const brackets = s.match(/^([[(])([^;]+);([^;]+)([\])])$/);
  if (brackets) return span(edge(brackets[2]), brackets[1] === '[', edge(brackets[3]), brackets[4] === ']');
  const both = s.match(/^(.+?)(<=|<)[a-zа-я](<=|<)(.+)$/);
  if (both) return span(edge(both[1]), both[2] === '<=', edge(both[4]), both[3] === '<=');
  const after = s.match(/^[a-zа-я](>=|>|<=|<)(.+)$/);
  if (after) {
    const value = edge(after[2]);
    return after[1].startsWith('>')
      ? span(value, after[1] === '>=', INF, false)
      : span(-INF, false, value, after[1] === '<=');
  }
  const before = s.match(/^(.+?)(>=|>|<=|<)[a-zа-я]$/);
  if (before) {
    const value = edge(before[1]);
    // „3 < x“ казва същото като „x > 3“: само страните са разменени.
    return before[2].startsWith('<')
      ? span(value, before[2] === '<=', INF, false)
      : span(-INF, false, value, before[2] === '>=');
  }
  return null;
}

// Безкрайностите се сравняват направо: изваждането им дава NaN.
const near = (x, y) => (Number.isFinite(x) && Number.isFinite(y) ? Math.abs(x - y) < EPSILON : x === y);
const sameSpan = (a, b) => near(a.lo, b.lo) && near(a.hi, b.hi) && a.loIn === b.loIn && a.hiIn === b.hiIn;

// Числата се сравняват по стойност, затова еквивалентните записи минават.
// Интервалите се сравняват по това какво включват, не по записа.
// Текстовите отговори („Да“, „Четно“) се сравняват без интервали и без значение на главните букви.
export function sameAnswer(given, want) {
  const text = String(given).trim();
  if (!text) return false;
  const a = parseNumeric(text);
  const b = parseNumeric(want);
  if (a !== null && b !== null) return Math.abs(a - b) < EPSILON;
  const spanA = parseInterval(text);
  const spanB = parseInterval(want);
  if (spanA && spanB) return sameSpan(spanA, spanB);
  const clean = (s) => String(s).replace(/\s+/g, '').toLowerCase();
  return clean(text) === clean(want);
}
