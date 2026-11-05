// Генератори за теми 7–10: изрази и уравнения, геометрия, данни и вероятност,
// закономерности и броене. Чисти функции: random се подава отвън.
// Всяка задача носи check — данните, по които тестът пресмята отговора независимо.
import { choiceTask, dec, fracText, gcd, int, numberTask, pick } from './task.js';

// π се ползва закръглено, както е в училище. Тестът смята със същото число.
export const PI = 3.14;

const YES_NO = ['Да', 'Не'];
const DAYS = ['понеделник', 'вторник', 'сряда', 'четвъртък', 'петък'];
const COUNTED = ['книги', 'задачи', 'стикера', 'гола'];

// Коефициент 1 не се пише: „1x“ не е запис, който дете вижда в учебник.
const times = (k, name) => (k === 1 ? name : `${k}${name}`);

// Избор без връщане: гарантира различни стойности, значи и един единствен максимум.
function distinctValues(random, count, lo, hi) {
  const pool = [];
  for (let v = lo; v <= hi; v += 1) pool.push(v);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function shuffled(random, list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Списък с точно зададена средна стойност: започва от равни и премества по малко.
// Така сборът остава кратен на броя, а всяко число остава поне 1.
function valuesWithMean(random, count, mean, shakes = 3) {
  const v = Array.from({ length: count }, () => mean);
  for (let s = 0; s < shakes; s += 1) {
    const i = int(random, 0, count - 1);
    const j = (i + 1 + int(random, 0, count - 2)) % count;
    const move = int(random, 1, Math.max(1, Math.floor(mean / 2)));
    if (v[i] - move >= 1) { v[i] -= move; v[j] += move; }
  }
  return v;
}

const sum = (list) => list.reduce((a, b) => a + b, 0);
const isPrime = (n) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i += 1) if (n % i === 0) return false;
  return true;
};
const smallestFactor = (n) => {
  for (let i = 2; i * i <= n; i += 1) if (n % i === 0) return i;
  return n;
};

// --- 7. Изрази и уравнения ---

function expressions(level, random) {
  if (level === 1) {
    const v = int(random, 2, 9);
    const m = int(random, 2, 9);
    return numberTask(`Колко е a + ${m} при a = ${v}?`, v + m,
      ['Буквата стои вместо число: замести я с дадената стойност.',
        `Вместо a пиши ${v}: ${v} + ${m}.`,
        `${v} + ${m} = ${v + m}.`],
      { type: 'expr-lin', k: 1, v, m });
  }
  if (level === 2) {
    const k = int(random, 2, 6);
    const v = int(random, 2, 9);
    return numberTask(`Колко е ${k}a при a = ${v}?`, k * v,
      [`${k}a значи ${k} пъти a.`,
        `Замести a с ${v}: ${k} × ${v}.`,
        `${k} × ${v} = ${k * v}.`],
      { type: 'expr-lin', k, v, m: 0 });
  }
  if (level === 3) {
    const k = int(random, 2, 7);
    const v = int(random, 2, 9);
    const m = int(random, 2, 12);
    return numberTask(`Колко е ${k}a + ${m} при a = ${v}?`, k * v + m,
      ['Първо умножението, после събирането.',
        `${k} × ${v} = ${k * v}, после добави ${m}.`,
        `${k * v} + ${m} = ${k * v + m}.`],
      { type: 'expr-lin', k, v, m });
  }
  if (level === 4) {
    const k = int(random, 2, 9);
    const m = int(random, 2, 9);
    return numberTask(`Опрости: ${k}a + ${m}a = ?a`, k + m,
      ['Еднаквите букви се събират като еднакви неща.',
        `${k} кутии и още ${m} кутии са колко кутии?`,
        `${k} + ${m} = ${k + m}, значи ${k}a + ${m}a = ${k + m}a.`],
      { type: 'expr-sum-coef', k, m });
  }
  if (level === 5) {
    const k = int(random, 2, 6);
    const v = int(random, 2, 9);
    const m = int(random, 2, 6);
    const w = int(random, 2, 9);
    return numberTask(`Колко е ${k}a + ${m}b при a = ${v} и b = ${w}?`, k * v + m * w,
      ['Двете букви имат различни стойности: замести всяка със своята.',
        `${k} × ${v} = ${k * v} и ${m} × ${w} = ${m * w}.`,
        `${k * v} + ${m * w} = ${k * v + m * w}.`],
      { type: 'expr-two', k, v, m, w });
  }
  const k = int(random, 2, 6);
  const v = int(random, 2, 9);
  const m = int(random, 2, 9);
  return numberTask(`Колко е ${k}(a + ${m}) при a = ${v}?`, k * (v + m),
    ['Първо смятай в скобата.',
      `${v} + ${m} = ${v + m}, после умножи по ${k}.`,
      `${k} × ${v + m} = ${k * (v + m)}.`],
    { type: 'expr-bracket', k, v, m });
}

function oneStep(level, random) {
  const forms = [['add'], ['sub'], ['add', 'sub'], ['mul'], ['div'], ['add', 'sub', 'mul', 'div']];
  const form = pick(random, forms[level - 1]);
  const wide = level >= 3;
  if (form === 'add') {
    const x = int(random, 2, wide ? 60 : 15);
    const a = int(random, 2, wide ? 40 : 12);
    const total = x + a;
    return numberTask(`Реши: x + ${a} = ${total}`, x,
      ['И двете страни се променят еднакво, иначе равенството се разваля.',
        `Извади ${a} от двете страни: x = ${total} − ${a}.`,
        `${total} − ${a} = ${x}. Проверка: ${x} + ${a} = ${total}.`],
      { type: 'eq-add', total, a });
  }
  if (form === 'sub') {
    const a = int(random, 2, wide ? 40 : 12);
    const diff = int(random, 1, wide ? 60 : 15);
    const x = diff + a;
    return numberTask(`Реши: x − ${a} = ${diff}`, x,
      ['Обратното на изваждането е събиране.',
        `Добави ${a} към двете страни: x = ${diff} + ${a}.`,
        `${diff} + ${a} = ${x}. Проверка: ${x} − ${a} = ${diff}.`],
      { type: 'eq-sub', diff, a });
  }
  if (form === 'mul') {
    const k = int(random, 2, 9);
    const x = int(random, 2, level >= 6 ? 20 : 12);
    const product = k * x;
    return numberTask(`Реши: ${k}x = ${product}`, x,
      ['Умножението се маха с деление.',
        `Раздели двете страни на ${k}: x = ${product} ÷ ${k}.`,
        `${product} ÷ ${k} = ${x}. Проверка: ${k} × ${x} = ${product}.`],
      { type: 'eq-mul', product, k });
  }
  const k = int(random, 2, 9);
  const quotient = int(random, 2, level >= 6 ? 15 : 10);
  const x = k * quotient;
  return numberTask(`Реши: x ÷ ${k} = ${quotient}`, x,
    ['Делението се маха с умножение.',
      `Умножи двете страни по ${k}: x = ${quotient} × ${k}.`,
      `${quotient} × ${k} = ${x}. Проверка: ${x} ÷ ${k} = ${quotient}.`],
    { type: 'eq-div', quotient, k });
}

function twoStep(level, random) {
  const x = int(random, 2, level >= 4 ? 12 : 8);
  const k = int(random, 2, level >= 4 ? 7 : 5);
  if (level === 1 || level === 4) {
    const m = int(random, 2, level >= 4 ? 15 : 9);
    const r = k * x + m;
    return numberTask(`Реши: ${k}x + ${m} = ${r}`, x,
      ['Първо махни събираемото, после раздели.',
        `Извади ${m}: ${k}x = ${r - m}. После раздели на ${k}.`,
        `${r - m} ÷ ${k} = ${x}. Проверка: ${k} × ${x} + ${m} = ${r}.`],
      { type: 'eq2-add', k, m, r });
  }
  if (level === 2) {
    const m = int(random, 1, Math.min(12, k * x - 1));
    const r = k * x - m;
    return numberTask(`Реши: ${k}x − ${m} = ${r}`, x,
      ['Обратното на изваждането е събиране.',
        `Добави ${m}: ${k}x = ${r + m}. После раздели на ${k}.`,
        `${r + m} ÷ ${k} = ${x}. Проверка: ${k} × ${x} − ${m} = ${r}.`],
      { type: 'eq2-sub', k, m, r });
  }
  if (level === 3) {
    const m = int(random, 2, 9);
    const r = k * (x + m);
    return numberTask(`Реши: ${k}(x + ${m}) = ${r}`, x,
      ['Скобата е по-лесна, ако първо разделиш.',
        `Раздели на ${k}: x + ${m} = ${r / k}. После махни ${m}.`,
        `${r / k} − ${m} = ${x}. Проверка: ${k} × (${x} + ${m}) = ${r}.`],
      { type: 'eq2-bracket-plus', k, m, r });
  }
  if (level === 5) {
    const m = int(random, 1, x - 1);
    const r = k * (x - m);
    return numberTask(`Реши: ${k}(x − ${m}) = ${r}`, x,
      ['Скобата е по-лесна, ако първо разделиш.',
        `Раздели на ${k}: x − ${m} = ${r / k}. После добави ${m}.`,
        `${r / k} + ${m} = ${x}. Проверка: ${k} × (${x} − ${m}) = ${r}.`],
      { type: 'eq2-bracket-minus', k, m, r });
  }
  const m = int(random, 1, 12);
  const n = int(random, 1, k - 1);
  const p = (k - n) * x + m;
  return numberTask(`Реши: ${k}x + ${m} = ${times(n, 'x')} + ${p}`, x,
    ['Събери неизвестното на една страна.',
      `Извади ${times(n, 'x')} от двете страни: ${k - n}x + ${m} = ${p}. После махни ${m}.`,
      `${p - m} ÷ ${k - n} = ${x}. Проверка: ${k} × ${x} + ${m} = ${k * x + m} и ${n} × ${x} + ${p} = ${n * x + p}.`],
    { type: 'eq2-both', k, m, n, p });
}

// --- 8. Ъгли, обиколка и лице ---

function angles(level, random) {
  if (level === 1) {
    const given = int(random, 2, 17) * 5;
    return numberTask(`Два ъгъла заедно правят прав ъгъл. Единият е ${given}°. Колко градуса е другият?`, 90 - given,
      ['Правият ъгъл е 90°.',
        `Извади ${given} от 90.`,
        `90 − ${given} = ${90 - given}.`],
      { type: 'ang-comp', given });
  }
  if (level === 2) {
    const given = int(random, 3, 33) * 5;
    return numberTask(`Два съседни ъгъла. Единият е ${given}°. Колко градуса е другият?`, 180 - given,
      ['Съседните ъгли заедно правят изправен ъгъл.',
        `Изправеният ъгъл е 180°: извади ${given}.`,
        `180 − ${given} = ${180 - given}.`],
      { type: 'ang-supp', given });
  }
  if (level === 3) {
    const a = int(random, 4, 16) * 5;
    const c = int(random, 4, 16) * 5;
    return numberTask(`В триъгълник два от ъглите са ${a}° и ${c}°. Колко градуса е третият?`, 180 - a - c,
      ['Сборът на ъглите в триъгълник е 180°.',
        `${a} + ${c} = ${a + c}; остатъкът до 180 е третият ъгъл.`,
        `180 − ${a + c} = ${180 - a - c}.`],
      { type: 'ang-tri', a, c });
  }
  if (level === 4) {
    const apex = int(random, 2, 16) * 10;
    const base = (180 - apex) / 2;
    return numberTask(`Равнобедрен триъгълник с ъгъл при върха ${apex}°. Колко градуса е всеки от другите два?`, base,
      ['Ъглите при основата на равнобедрения триъгълник са равни.',
        `Заедно те са 180 − ${apex} = ${180 - apex}; раздели на 2.`,
        `${180 - apex} ÷ 2 = ${base}.`],
      { type: 'ang-iso', apex });
  }
  if (level === 5) {
    const a = int(random, 6, 20) * 5;
    const c = int(random, 6, 20) * 5;
    const e = int(random, 6, 20) * 5;
    return numberTask(`В четириъгълник три от ъглите са ${a}°, ${c}° и ${e}°. Колко градуса е четвъртият?`, 360 - a - c - e,
      ['Сборът на ъглите в четириъгълник е 360°.',
        `${a} + ${c} + ${e} = ${a + c + e}; остатъкът до 360 е четвъртият.`,
        `360 − ${a + c + e} = ${360 - a - c - e}.`],
      { type: 'ang-quad', a, c, e });
  }
  const n = pick(random, [3, 4, 5, 6, 8, 9, 10, 12]);
  const inner = ((n - 2) * 180) / n;
  return numberTask(`Колко градуса е всеки ъгъл на правилен ${n}-ъгълник?`, inner,
    ['Сборът на ъглите в n-ъгълник е (n − 2) × 180°.',
      `Тук сборът е (${n} − 2) × 180 = ${(n - 2) * 180}, а ъглите са ${n} равни.`,
      `${(n - 2) * 180} ÷ ${n} = ${inner}.`],
    { type: 'ang-poly', n });
}

function perimeter(level, random) {
  if (level === 1) {
    const a = int(random, 2, 15);
    return numberTask(`Квадрат със страна ${a} см. Колко сантиметра е обиколката?`, 4 * a,
      ['Квадратът има 4 равни страни.',
        `Умножи ${a} по 4.`,
        `4 × ${a} = ${4 * a}.`],
      { type: 'per-square', a });
  }
  if (level === 2) {
    const a = int(random, 2, 18);
    const c = int(random, 2, 18);
    return numberTask(`Правоъгълник ${a} см на ${c} см. Колко сантиметра е обиколката?`, 2 * (a + c),
      ['Срещуположните страни на правоъгълника са равни.',
        `${a} + ${c} = ${a + c} е половината обиколка.`,
        `2 × ${a + c} = ${2 * (a + c)}.`],
      { type: 'per-rect', a, c });
  }
  if (level === 3) {
    const a = int(random, 4, 15);
    const c = int(random, 4, 15);
    const e = int(random, Math.abs(a - c) + 1, a + c - 1);
    return numberTask(`Триъгълник със страни ${a} см, ${c} см и ${e} см. Колко е обиколката?`, a + c + e,
      ['Обиколката е сборът на всички страни.',
        `${a} + ${c} = ${a + c}, после добави ${e}.`,
        `${a + c} + ${e} = ${a + c + e}.`],
      { type: 'per-tri', a, c, e });
  }
  if (level === 4) {
    const a = int(random, 3, 20);
    const c = int(random, 3, 20);
    const p = 2 * (a + c);
    return numberTask(`Обиколката на правоъгълник е ${p} см, а едната страна е ${a} см. Колко е другата?`, c,
      ['Половината обиколка е сборът на двете различни страни.',
        `${p} ÷ 2 = ${p / 2}; извади известната страна.`,
        `${p / 2} − ${a} = ${c}.`],
      { type: 'per-side', p, a });
  }
  if (level === 5) {
    const n = pick(random, [5, 6, 7, 8, 10, 12]);
    const a = int(random, 2, 12);
    return numberTask(`Правилен ${n}-ъгълник със страна ${a} см. Колко е обиколката?`, n * a,
      ['Всички страни на правилния многоъгълник са равни.',
        `Умножи ${n} по ${a}.`,
        `${n} × ${a} = ${n * a}.`],
      { type: 'per-poly', n, a });
  }
  const r = int(random, 2, 12);
  const value = dec(2 * PI * r, 2);
  return numberTask(`Кръг с радиус ${r} см. Колко е обиколката при π около 3,14?`, value,
    ['Обиколката на кръг е 2 × π × радиуса.',
      `2 × ${r} = ${2 * r}; умножи по 3,14.`,
      `${2 * r} × 3,14 = ${value}.`],
    { type: 'per-circle', r });
}

function area(level, random) {
  if (level === 1) {
    const a = int(random, 2, 15);
    return numberTask(`Квадрат със страна ${a} см. Колко квадратни сантиметра е лицето?`, a * a,
      ['Лицето е колко плочки покриват фигурата.',
        `Редовете са ${a}, по ${a} плочки всеки.`,
        `${a} × ${a} = ${a * a}.`],
      { type: 'area-square', a });
  }
  if (level === 2) {
    const a = int(random, 2, 15);
    const c = int(random, 2, 15);
    return numberTask(`Правоъгълник ${a} см на ${c} см. Колко квадратни сантиметра е лицето?`, a * c,
      ['Броят на плочките е редове по плочки в ред.',
        `Умножи ${a} по ${c}.`,
        `${a} × ${c} = ${a * c}.`],
      { type: 'area-rect', a, c });
  }
  if (level === 3) {
    const base = int(random, 2, 10) * 2;
    const height = int(random, 3, 15);
    return numberTask(`Триъгълник с основа ${base} см и височина ${height} см. Колко е лицето?`, (base * height) / 2,
      ['Триъгълникът е половината от правоъгълник със същата основа и височина.',
        `Правоъгълникът е ${base} × ${height} = ${base * height}.`,
        `${base * height} ÷ 2 = ${(base * height) / 2}.`],
      { type: 'area-tri', base, height });
  }
  if (level === 4) {
    const a = int(random, 2, 12);
    const c = int(random, 2, 12);
    const value = a * c;
    return numberTask(`Лицето на правоъгълник е ${value} см², а едната страна е ${a} см. Колко е другата?`, c,
      ['Лицето е произведение на двете страни.',
        `Търси с колко се умножава ${a}, за да стане ${value}.`,
        `${value} ÷ ${a} = ${c}.`],
      { type: 'area-side', value, a });
  }
  if (level === 5) {
    const a = int(random, 2, 10);
    const c = a + int(random, 1, 8);
    const height = int(random, 1, 7) * 2;
    return numberTask(`Трапец с основи ${a} см и ${c} см и височина ${height} см. Колко е лицето?`, ((a + c) * height) / 2,
      ['Средната широчина на трапеца е средата между двете основи.',
        `(${a} + ${c}) ÷ 2 = ${dec((a + c) / 2, 1)}; умножи по височината ${height}.`,
        `(${a} + ${c}) × ${height} ÷ 2 = ${((a + c) * height) / 2}.`],
      { type: 'area-trap', a, c, height });
  }
  const r = int(random, 2, 12);
  const value = dec(PI * r * r, 2);
  return numberTask(`Кръг с радиус ${r} см. Колко е лицето при π около 3,14?`, value,
    ['Лицето на кръг е π × радиуса × радиуса.',
      `${r} × ${r} = ${r * r}; умножи по 3,14.`,
      `${r * r} × 3,14 = ${value}.`],
    { type: 'area-circle', r });
}

// --- 9. Данни, средни стойности и вероятност ---

const dayTable = (labels, values) => labels.map((l, i) => `${l} ${values[i]}`).join(', ');

// Процентът трябва да е цяло число, затова цялото и делът се избират от готови двойки.
const SHARE_PARTS = { 20: [10, 25, 40], 25: [20, 40, 60], 40: [10, 25, 50], 50: [10, 20, 40] };

function charts(level, random) {
  const unit = pick(random, COUNTED);
  const labels = DAYS.slice(0, 4);
  if (level === 1) {
    const values = distinctValues(random, 4, 2, 14);
    const top = Math.max(...values);
    const day = labels[values.indexOf(top)];
    return choiceTask(`Преброени ${unit} по дни: ${dayTable(labels, values)}. В кой ден са най-много?`, day, labels,
      ['Търси най-високото число в реда.',
        `Най-голямото от ${values.join(', ')} е ${top}.`,
        `${top} стои при ${day}, значи отговорът е ${day}.`],
      { type: 'data-max', values, labels });
  }
  if (level === 2) {
    const values = distinctValues(random, 4, 2, 16);
    const total = sum(values);
    return numberTask(`Преброени ${unit} по дни: ${dayTable(labels, values)}. Колко са общо?`, total,
      ['Общото е сборът на всички стълбове.',
        `${values[0]} + ${values[1]} = ${values[0] + values[1]} и ${values[2]} + ${values[3]} = ${values[2] + values[3]}.`,
        `${values[0] + values[1]} + ${values[2] + values[3]} = ${total}.`],
      { type: 'data-sum', values });
  }
  if (level === 3) {
    const values = distinctValues(random, 4, 2, 18);
    const top = Math.max(...values);
    const low = Math.min(...values);
    return numberTask(`Преброени ${unit} по дни: ${dayTable(labels, values)}. Колко е разликата между най-силния и най-слабия ден?`, top - low,
      ['Разликата е между най-високия и най-ниския стълб.',
        `Най-много са ${top}, най-малко са ${low}.`,
        `${top} − ${low} = ${top - low}.`],
      { type: 'data-range', values });
  }
  if (level === 4) {
    const values = distinctValues(random, 5, 2, 18);
    const five = DAYS.slice(0, 5);
    const limit = int(random, Math.min(...values), Math.max(...values) - 1);
    const count = values.filter((v) => v > limit).length;
    return numberTask(`Преброени ${unit} по дни: ${dayTable(five, values)}. В колко дни са повече от ${limit}?`, count,
      ['Сравни всяка стойност с границата.',
        `Границата е ${limit}: брои само дните над нея.`,
        `Над ${limit} са ${count} дни.`],
      { type: 'data-count', values, limit });
  }
  if (level === 5) {
    const values = distinctValues(random, 4, 2, 16);
    const total = sum(values);
    const known = values.slice(0, 3);
    return numberTask(`Общо за четирите дни са ${total} ${unit}. Известни са ${dayTable(labels.slice(0, 3), known)}. Колко са в ${labels[3]}?`, values[3],
      ['Липсващата стойност е общото минус известните.',
        `${known[0]} + ${known[1]} + ${known[2]} = ${sum(known)}.`,
        `${total} − ${sum(known)} = ${values[3]}.`],
      { type: 'data-missing', total, values: known });
  }
  const total = Number(pick(random, Object.keys(SHARE_PARTS)));
  const percent = pick(random, SHARE_PARTS[total]);
  const part = (total * percent) / 100;
  const rest = total - part;
  const r1 = int(random, 1, rest - 2);
  const r2 = int(random, 1, rest - r1 - 1);
  const others = [r1, r2, rest - r1 - r2];
  const idx = int(random, 0, 3);
  const values = [];
  for (let i = 0, j = 0; i < 4; i += 1) values.push(i === idx ? part : others[j++]);
  return numberTask(`Преброени ${unit} по дни: ${dayTable(labels, values)}. Колко процента от всички са в ${labels[idx]}?`, percent,
    ['Процентът е частта, разделена на цялото, по 100.',
      `Цялото е ${total}, а частта е ${part}.`,
      `${part} ÷ ${total} × 100 = ${percent}.`],
    { type: 'data-share', part, total });
}

function averages(level, random) {
  if (level <= 2) {
    const count = level === 1 ? 3 : int(random, 4, 5);
    const mean = int(random, 3, 12);
    const values = valuesWithMean(random, count, mean);
    return numberTask(`Числата са ${values.join(', ')}. Колко е средната стойност?`, mean,
      ['Средната стойност е сборът, разделен на броя.',
        `Сборът е ${sum(values)}, а числата са ${count}.`,
        `${sum(values)} ÷ ${count} = ${mean}.`],
      { type: 'mean', values });
  }
  if (level === 3) {
    const values = distinctValues(random, 5, 1, 20);
    const sorted = [...values].sort((a, b) => a - b);
    return numberTask(`Числата са ${values.join(', ')}. Колко е медианата?`, sorted[2],
      ['Медианата иска числата подредени по големина.',
        `Подредени: ${sorted.join(', ')}. Числата са 5, значи средата е третото.`,
        `Медианата е ${sorted[2]}.`],
      { type: 'median', values });
  }
  if (level === 4) {
    const base = distinctValues(random, 3, 1, 15);
    const mode = base[int(random, 0, 2)];
    const values = shuffled(random, [...base, mode, mode]);
    return numberTask(`Числата са ${values.join(', ')}. Колко е модата?`, mode,
      ['Модата е стойността, която се среща най-често.',
        'Преброй колко пъти се явява всяко число.',
        `Най-често се явява ${mode}, значи модата е ${mode}.`],
      { type: 'mode', values });
  }
  if (level === 5) {
    const count = int(random, 4, 5);
    const mean = int(random, 4, 12);
    const values = valuesWithMean(random, count, mean);
    const known = values.slice(0, count - 1);
    return numberTask(`Средната стойност на ${count} числа е ${mean}. Известни са ${known.join(', ')}. Колко е последното?`, values[count - 1],
      ['От средната стойност се връща целият сбор.',
        `Сборът е ${count} × ${mean} = ${count * mean}, а известните дават ${sum(known)}.`,
        `${count * mean} − ${sum(known)} = ${values[count - 1]}.`],
      { type: 'mean-missing', mean, count, values: known });
  }
  const values = distinctValues(random, 6, 1, 24);
  const sorted = [...values].sort((a, b) => a - b);
  const middle = dec((sorted[2] + sorted[3]) / 2, 1);
  return numberTask(`Числата са ${values.join(', ')}. Колко е медианата?`, middle,
    ['При четен брой числа медианата е между двете в средата.',
      `Подредени: ${sorted.join(', ')}. Двете в средата са ${sorted[2]} и ${sorted[3]}.`,
      `(${sorted[2]} + ${sorted[3]}) ÷ 2 = ${middle}.`],
    { type: 'median', values });
}

// Условия за един зар: текст и брой благоприятни случаи.
const DIE_EVENTS = [
  ['четно число', 3],
  ['нечетно число', 3],
  ['число, по-голямо от 4', 2],
  ['число, по-малко от 3', 2],
  ['число, което се дели на 3', 2],
];

function probability(level, random) {
  if (level === 1) {
    const good = int(random, 1, 4);
    const other = int(random, 1, 5);
    const total = good + other;
    const answer = fracText(good, total);
    return numberTask(`В торбичка има ${good} сини и ${other} червени топчета. Каква е вероятността да извадиш синьо? Запиши като дроб.`, answer,
      ['Вероятността е благоприятните случаи върху всички случаи.',
        `Благоприятни са ${good}, а топчетата са ${total}.`,
        `${good} от ${total} е ${answer}.`],
      { type: 'prob-simple', good, total });
  }
  if (level === 2) {
    const good = int(random, 1, 4);
    const other = int(random, 2, 6);
    const total = good + other;
    const answer = fracText(total - good, total);
    return numberTask(`В торбичка има ${good} сини и ${other} червени топчета. Каква е вероятността да НЕ извадиш синьо? Запиши като дроб.`, answer,
      ['Всичко, което не е синьо, е благоприятно.',
        `Не са сини ${total} − ${good} = ${total - good} топчета от ${total}.`,
        `${total - good} от ${total} е ${answer}.`],
      { type: 'prob-not', good, total });
  }
  if (level === 3) {
    const [text, good] = pick(random, DIE_EVENTS);
    const answer = fracText(good, 6);
    return numberTask(`Хвърляш зар. Каква е вероятността да се падне ${text}? Запиши като дроб.`, answer,
      ['Всички шест страни са равновъзможни.',
        `Благоприятните случаи са ${good} от 6.`,
        `${good} от 6 е ${answer}.`],
      { type: 'prob-simple', good, total: 6 });
  }
  if (level === 4) {
    const total = pick(random, [4, 5, 10, 20, 25, 50]);
    const good = int(random, 1, total - 1);
    const answer = (100 * good) / total;
    return numberTask(`В клас има ${total} ученици и ${good} от тях играят шах. Каква е вероятността случайно избран ученик да играе шах? Отговори в проценти.`, answer,
      ['Процентът е частта върху цялото, по 100.',
        `Частта е ${good}, цялото е ${total}.`,
        `${good} ÷ ${total} × 100 = ${answer}.`],
      { type: 'prob-percent', good, total });
  }
  if (level === 5) {
    const total1 = int(random, 2, 5);
    const good1 = int(random, 1, total1 - 1);
    const total2 = int(random, 3, 6);
    const good2 = int(random, 1, total2 - 1);
    const answer = fracText(good1 * good2, total1 * total2);
    return numberTask(`В първата торбичка ${good1} от ${total1} топчета са сини, във втората ${good2} от ${total2}. Вадиш по едно от всяка. Каква е вероятността и двете да са сини?`, answer,
      ['Двете вадения не си влияят.',
        `Вероятностите се умножават: ${fracText(good1, total1)} × ${fracText(good2, total2)}.`,
        `${good1} × ${good2} върху ${total1} × ${total2} е ${answer}.`],
      { type: 'prob-two', good1, total1, good2, total2 });
  }
  const target = int(random, 3, 11);
  let count = 0;
  for (let a = 1; a <= 6; a += 1) for (let c = 1; c <= 6; c += 1) if (a + c === target) count += 1;
  const answer = fracText(count, 36);
  return numberTask(`Хвърляш два зара. Каква е вероятността сборът да е ${target}? Запиши като дроб.`, answer,
    ['Равновъзможните случаи са всички двойки, а не всички сборове.',
      `Двойките са 6 × 6 = 36, а сбор ${target} дават ${count} от тях.`,
      `${count} от 36 е ${answer}.`],
    { type: 'prob-dice-sum', target });
}

// --- 10. Закономерности и броене ---

function sequences(level, random) {
  if (level <= 2) {
    const step = level === 1 ? int(random, 2, 5) : int(random, 6, 15);
    const start = level === 1 ? int(random, 1, 9) : int(random, 3, 30);
    const index = 4;
    const terms = Array.from({ length: index }, (_, i) => start + i * step);
    const answer = start + index * step;
    return numberTask(`${terms.join(', ')}, … Кое е следващото число?`, answer,
      ['Погледни разликата между съседните числа.',
        `Разликата е ${step} всеки път: добави ${step} към ${terms[index - 1]}.`,
        `${terms[index - 1]} + ${step} = ${answer}.`],
      { type: 'seq-arith', start, step, index });
  }
  if (level === 3) {
    const ratio = int(random, 2, 4);
    const start = int(random, 1, 3);
    const index = 4;
    const terms = Array.from({ length: index }, (_, i) => start * ratio ** i);
    const answer = start * ratio ** index;
    return numberTask(`${terms.join(', ')}, … Кое е следващото число?`, answer,
      ['Разликите не са еднакви, затова пробвай отношението.',
        `Всяко следващо е ${ratio} пъти предишното: умножи ${terms[index - 1]} по ${ratio}.`,
        `${terms[index - 1]} × ${ratio} = ${answer}.`],
      { type: 'seq-geom', start, ratio, index });
  }
  if (level === 4) {
    const n = int(random, 6, 12);
    if (random() < 0.5) {
      return numberTask(`1, 4, 9, 16, … Кое е ${n}-то число в редицата?`, n * n,
        ['Всяко число е квадрат на мястото си.',
          `Четвъртото е 4 × 4 = 16, значи ${n}-то е ${n} × ${n}.`,
          `${n} × ${n} = ${n * n}.`],
        { type: 'seq-square', n });
    }
    return numberTask(`1, 3, 6, 10, … Кое е ${n}-то число в редицата?`, (n * (n + 1)) / 2,
      ['Всяко следващо добавя с едно повече от предишното.',
        `${n}-то число е сборът 1 + 2 + … + ${n}, тоест ${n} × ${n + 1} ÷ 2.`,
        `${n} × ${n + 1} ÷ 2 = ${(n * (n + 1)) / 2}.`],
      { type: 'seq-tri', n });
  }
  if (level === 5) {
    const first = int(random, 1, 4);
    const second = int(random, first, first + 4);
    const index = 5;
    const terms = [first, second];
    while (terms.length <= index) terms.push(terms[terms.length - 1] + terms[terms.length - 2]);
    const answer = terms[index];
    return numberTask(`${terms.slice(0, index).join(', ')}, … Кое е следващото число?`, answer,
      ['Нито разликата, нито отношението са постоянни.',
        `Всеки член е сборът на двата преди него: ${terms[index - 2]} + ${terms[index - 1]}.`,
        `${terms[index - 2]} + ${terms[index - 1]} = ${answer}.`],
      { type: 'seq-fib', first, second, index });
  }
  const start = int(random, 1, 9);
  const step = int(random, 1, 6);
  const count = int(random, 4, 8);
  const last = start + (count - 1) * step;
  const total = (count * (start + last)) / 2;
  return numberTask(`Редица започва с ${start} и всяко следващо число е с ${step} повече. Колко е сборът на първите ${count} числа?`, total,
    ['Първото и последното, второто и предпоследното дават един и същи сбор.',
      `Последното е ${last}; сборът на крайните е ${start} + ${last} = ${start + last}.`,
      `${count} × ${start + last} ÷ 2 = ${total}.`],
    { type: 'seq-sum', start, step, count });
}

function multiples(level, random) {
  if (level <= 2) {
    const lo = level === 1 ? 7 : 40;
    const hi = level === 1 ? 60 : 200;
    const wantPrime = random() < 0.5;
    let n = int(random, lo, hi);
    for (let guard = 0; isPrime(n) !== wantPrime && guard < 200; guard += 1) n = int(random, lo, hi);
    const yes = isPrime(n);
    const f = smallestFactor(n);
    return choiceTask(`Просто число ли е ${n}?`, yes ? 'Да' : 'Не', YES_NO,
      ['Простото число се дели само на 1 и на себе си.',
        'Стига да провериш малките прости делители: 2, 3, 5, 7, 11, 13.',
        yes
          ? `${n} не се дели на нито един от тях, значи отговорът е „Да“.`
          : `${n} = ${f} × ${n / f}, значи отговорът е „Не“.`],
      { type: 'prime', n });
  }
  if (level === 3 || level === 5) {
    const wide = level === 5;
    const a = wide ? int(random, 20, 120) : int(random, 6, 40);
    let c = wide ? int(random, 20, 120) : int(random, 6, 40);
    for (let guard = 0; c === a && guard < 50; guard += 1) c = wide ? int(random, 20, 120) : int(random, 6, 40);
    const g = gcd(a, c);
    return numberTask(`Колко е НОД(${a}, ${c})?`, g,
      ['НОД е най-голямото число, което дели и двете без остатък.',
        `Търси общите множители на ${a} и ${c} и ги умножи.`,
        `${a} = ${g} × ${a / g} и ${c} = ${g} × ${c / g}, значи НОД е ${g}.`],
      { type: 'gcd', a, c });
  }
  const wide = level === 6;
  const a = wide ? int(random, 4, 18) : int(random, 2, 12);
  let c = wide ? int(random, 4, 18) : int(random, 2, 12);
  for (let guard = 0; c === a && guard < 50; guard += 1) c = wide ? int(random, 4, 18) : int(random, 2, 12);
  const g = gcd(a, c);
  const l = (a * c) / g;
  if (!wide) {
    return numberTask(`Колко е НОК(${a}, ${c})?`, l,
      ['НОК е най-малкото число, което се дели и на двете.',
        `Умножи ${a} × ${c} = ${a * c} и раздели на НОД, който е ${g}.`,
        `${a * c} ÷ ${g} = ${l}.`],
      { type: 'lcm', a, c });
  }
  return numberTask(`Два автобуса тръгват заедно. Единият минава през ${a} минути, другият през ${c}. След колко минути ще тръгнат заедно отново?`, l,
    ['Търси първата минута, която се дели и на двете.',
      `Това е НОК: ${a} × ${c} = ${a * c}, разделено на НОД, който е ${g}.`,
      `${a * c} ÷ ${g} = ${l} минути.`],
    { type: 'lcm', a, c });
}

function counting(level, random) {
  if (level === 1) {
    const a = int(random, 2, 6);
    const c = int(random, 2, 5);
    return numberTask(`${a} вида хляб и ${c} вида сирене. Колко различни сандвича могат да се направят?`, a * c,
      ['За всеки хляб има всички възможности за сиренето.',
        `Това са ${a} групи по ${c}.`,
        `${a} × ${c} = ${a * c}.`],
      { type: 'count-mul', a, c });
  }
  if (level === 2) {
    const a = int(random, 2, 4);
    const c = int(random, 2, 4);
    const e = int(random, 2, 4);
    return numberTask(`${a} блузи, ${c} панталона и ${e} шапки. Колко различни облекла се получават?`, a * c * e,
      ['Всеки избор се разклонява на следващите.',
        `Умножи трите числа: ${a} × ${c} = ${a * c}, после по ${e}.`,
        `${a * c} × ${e} = ${a * c * e}.`],
      { type: 'count-mul3', a, c, e });
  }
  if (level === 3) {
    const base = int(random, 2, 6);
    const exp = int(random, 2, 4);
    return numberTask(`Код от ${exp} знака, а всеки знак е една от ${base} букви. Колко различни кода има?`, base ** exp,
      ['Всяка позиция се избира независимо от другите.',
        `${base} възможности на всяка от ${exp} позиции: ${base} на степен ${exp}.`,
        `${base} на степен ${exp} = ${base ** exp}.`],
      { type: 'count-pow', base, exp });
  }
  if (level === 4) {
    const n = int(random, 3, 6);
    let value = 1;
    for (let i = 2; i <= n; i += 1) value *= i;
    return numberTask(`По колко начина могат да се наредят ${n} книги на рафт?`, value,
      ['След всяко поставяне възможностите намаляват с една.',
        `За първото място има ${n}, за следващото ${n - 1} и така до 1.`,
        `Произведението е ${value}.`],
      { type: 'count-perm', n });
  }
  if (level === 5) {
    const n = int(random, 5, 9);
    const k = int(random, 2, 3);
    let value = 1;
    for (let i = 0; i < k; i += 1) value *= n - i;
    return numberTask(`От ${n} състезатели се подреждат първите ${k} места. По колко начина може да стане?`, value,
      ['Тук редът има значение: първо и второ място не са едно и също.',
        `За първото място има ${n} възможности, за всяко следващо една по-малко.`,
        `Произведението на ${k} множителя от ${n} надолу е ${value}.`],
      { type: 'count-perm-k', n, k });
  }
  const n = int(random, 5, 9);
  const k = int(random, 2, 3);
  let ordered = 1;
  for (let i = 0; i < k; i += 1) ordered *= n - i;
  let factorial = 1;
  for (let i = 2; i <= k; i += 1) factorial *= i;
  return numberTask(`По колко начина се избират ${k} души от ${n} за дежурство?`, ordered / factorial,
    ['Тук редът няма значение: една и съща група, подредена иначе, е същият избор.',
      `Подредените групи са ${ordered}, а всяка група се повтаря ${factorial} пъти.`,
      `${ordered} ÷ ${factorial} = ${ordered / factorial}.`],
    { type: 'count-comb', n, k });
}

export const UPPER_GENERATORS = Object.freeze({
  expressions,
  'one-step': oneStep,
  'two-step': twoStep,
  angles,
  perimeter,
  area,
  charts,
  averages,
  probability,
  sequences,
  multiples,
  counting,
});
