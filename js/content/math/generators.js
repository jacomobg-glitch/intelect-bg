// Процедурни задачи по шаблони. Чисти функции: random се подава отвън, затова всичко се тества директно.
// Всяка задача носи check: данните, по които тестът пресмята отговора независимо от генератора.
export const MAX_LEVEL = 6;

const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (random, list) => list[Math.floor(random() * list.length)];

const numberTask = (prompt, answer, hints, check) => ({ kind: 'number', prompt, answer: String(answer), options: null, hints, check });
const choiceTask = (prompt, answer, options, hints, check) => ({ kind: 'choice', prompt, answer, options, hints, check });

const PARITY = ['Четно', 'Нечетно'];
const YES_NO = ['Да', 'Не'];
const parityWord = (n) => (n % 2 === 0 ? 'четно' : 'нечетно');
const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

function count(level, random) {
  if (level <= 2) {
    const max = level === 1 ? 20 : 100;
    const n = int(random, 2, max);
    if (level === 1 || random() < 0.5) {
      return numberTask(`Кое число идва след ${n}?`, n + 1,
        ['Едно число нагоре по реда.', `Към ${n} добави 1.`, `${n} + 1 = ${n + 1}.`],
        { type: 'next', n });
    }
    return numberTask(`Кое число идва точно преди ${n}?`, n - 1,
      ['Едно число назад по реда.', `От ${n} извади 1.`, `${n} − 1 = ${n - 1}.`],
      { type: 'prev', n });
  }
  if (level <= 4) {
    const n = level === 3 ? int(random, 11, 99) : int(random, 100, 999);
    const tens = Math.floor(n / 10);
    return numberTask(`Колко цели десетици има в числото ${n}?`, tens,
      ['Една десетица е пакет от 10 единици.', `Раздели ${n} на пакети по 10 и не брой остатъка.`, `${n} = ${tens} × 10 + ${n % 10}, значи ${tens} десетици.`],
      { type: 'tens', n });
  }
  const max = level === 5 ? 9999 : 99999;
  const n = int(random, 1000, max);
  const step = pick(random, [10, 100, 1000]);
  return numberTask(`Кое е числото с ${step} по-голямо от ${n}?`, n + step,
    [`Промени само една цифра, ако няма пренос.`, `Събери ${n} + ${step}.`, `${n} + ${step} = ${n + step}.`],
    { type: 'add', a: n, b: step });
}

function numberLine(level, random) {
  const step = [1, 1, 2, 5, 10, 25][level - 1];
  if (level >= 3 && random() < 0.4) {
    const half = int(random, 1, 6) * step;
    const a = int(random, 0, 10) * step;
    const b = a + 2 * half;
    const mid = a + half;
    return numberTask(`Кое число е точно по средата между ${a} и ${b}?`, mid,
      ['Средата е на равно разстояние от двата края.', `Разстоянието е ${b - a}. Раздели го на 2 и го добави към ${a}.`, `${b - a} ÷ 2 = ${half}; ${a} + ${half} = ${mid}.`],
      { type: 'mid', a, b });
  }
  const start = int(random, 0, 10) * step;
  const hops = int(random, 2, 3 + level);
  const end = start + hops * step;
  return numberTask(`Стоиш на ${start}. Правиш ${hops} стъпки надясно, всяка по ${step}. На кое число стигаш?`, end,
    ['Надясно числата растат.', `Умножи ${hops} × ${step} и добави към ${start}.`, `${hops} × ${step} = ${hops * step}; ${start} + ${hops * step} = ${end}.`],
    { type: 'hops', start, hops, step });
}

function parity(level, random) {
  if (level <= 3) {
    const n = int(random, 1, [20, 100, 1000][level - 1]);
    const word = parityWord(n);
    return choiceTask(`Числото ${n} четно ли е, или нечетно?`, capitalize(word), PARITY,
      ['Може ли да се раздели на две равни групи без остатък?', 'Гледай само последната цифра: 0, 2, 4, 6, 8 значи четно.', `Последната цифра е ${n % 10}, значи числото е ${word}.`],
      { type: 'parity', n });
  }
  const a = int(random, 1, 10 ** (level - 2));
  const b = int(random, 1, 10 ** (level - 2));
  const word = parityWord(a + b);
  return choiceTask(`Без да смяташ целия сбор: ${a} + ${b} четно ли е, или нечетно?`, capitalize(word), PARITY,
    ['Важно е само дали всяко от числата е четно.', 'Четно + четно и нечетно + нечетно дават четно. Различните дават нечетно.', `${a} е ${parityWord(a)}, ${b} е ${parityWord(b)}, значи сборът е ${word}.`],
    { type: 'parity-sum', a, b });
}

// Двойка събираеми според трудността. Без пренос до ниво 3, с пренос след това.
function addends(level, random) {
  if (level === 1) { const a = int(random, 1, 9); return [a, int(random, 1, 10 - a)]; }
  if (level === 2) { const a = int(random, 3, 12); return [a, int(random, 2, 20 - a)]; }
  if (level === 3) {
    const a = int(random, 1, 7) * 10 + int(random, 1, 5);
    return [a, int(random, 1, 2) * 10 + int(random, 1, 4)];
  }
  if (level === 4) return [int(random, 1, 7) * 10 + int(random, 5, 9), int(random, 1, 2) * 10 + int(random, 5, 9)];
  if (level === 5) return [int(random, 100, 899), int(random, 11, 99)];
  return [int(random, 100, 899), int(random, 101, 899)];
}

function add(level, random) {
  const [a, b] = addends(level, random);
  const sum = a + b;
  return numberTask(`${a} + ${b} = ?`, sum,
    ['Започни от по-голямото число.', 'Събери поотделно единиците и десетиците, после ги сложи заедно.', `${a} + ${b} = ${sum}.`],
    { type: 'add', a, b });
}

function sub(level, random) {
  const [x, y] = addends(level, random);
  const a = x + y;
  const b = random() < 0.5 ? x : y;
  const diff = a - b;
  return numberTask(`${a} − ${b} = ?`, diff,
    ['Изваждането е обратното на събирането.', `Попитай се: ${b} + колко прави ${a}?`, `${b} + ${diff} = ${a}, значи ${a} − ${b} = ${diff}.`],
    { type: 'sub', a, b });
}

function mental(level, random) {
  if (level <= 2 || level === 5) {
    const near = level === 1 ? 9 : level === 2 ? pick(random, [19, 29, 39]) : 99;
    const a = level === 5 ? int(random, 120, 880) : int(random, 12, 60);
    const round = near + 1;
    const sum = a + near;
    return numberTask(`Сметни наум: ${a} + ${near}`, sum,
      [`${near} е почти ${round}.`, `Добави ${round}, после махни 1.`, `${a} + ${round} = ${a + round}; ${a + round} − 1 = ${sum}.`],
      { type: 'add', a, b: near });
  }
  if (level === 3) {
    const near = pick(random, [9, 19, 29]);
    const a = int(random, near + 11, 95);
    const round = near + 1;
    const diff = a - near;
    return numberTask(`Сметни наум: ${a} − ${near}`, diff,
      [`${near} е почти ${round}.`, `Извади ${round}, после върни 1.`, `${a} − ${round} = ${a - round}; ${a - round} + 1 = ${diff}.`],
      { type: 'sub', a, b: near });
  }
  if (level === 4) {
    const a = int(random, 2, 7) * 10 + int(random, 3, 9);
    const b = int(random, 1, 2) * 10 + int(random, 3, 9);
    const tens = Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10;
    const ones = (a % 10) + (b % 10);
    return numberTask(`Сметни наум: ${a} + ${b}`, a + b,
      ['Раздели числата на десетици и единици.', 'Събери десетиците, събери единиците, после сложи двата резултата заедно.', `${tens} + ${ones} = ${a + b}.`],
      { type: 'add', a, b });
  }
  const a = int(random, 10, 60);
  const c = int(random, 2, 9);
  const b = (10 - c) + 10 * int(random, 1, 3);
  const sum = a + b + c;
  return numberTask(`Сметни наум: ${a} + ${b} + ${c}`, sum,
    ['Потърси двойка, която дава кръгло число.', `Събери първо ${b} + ${c}.`, `${b} + ${c} = ${b + c}; ${a} + ${b + c} = ${sum}.`],
    { type: 'add3', a, b, c });
}

function mul(level, random) {
  const pools = [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6, 7, 8, 9], [6, 7, 8, 9]];
  let a;
  let b;
  if (level <= 4) {
    a = pick(random, pools[level - 1]);
    b = int(random, 2, 10);
  } else {
    a = int(random, 2, 9);
    b = level === 5 ? int(random, 11, 19) : int(random, 21, 99);
  }
  const product = a * b;
  const tens = Math.floor(b / 10) * 10;
  const ones = b % 10;
  const method = b > 10
    ? `Раздели ${b} на ${tens} и ${ones}, умножи всяко по ${a} и събери.`
    : `Събери ${a} на ${b} пъти или използвай таблицата за ${a}.`;
  return numberTask(`${a} × ${b} = ?`, product,
    [`Това са ${a} групи по ${b}.`, method, `${a} × ${b} = ${product}.`],
    { type: 'mul', a, b });
}

function div(level, random) {
  if (level >= 4 && random() < 0.5) {
    const b = int(random, 2, 9);
    const q = int(random, 2, level === 4 ? 9 : 20);
    const r = int(random, 1, b - 1);
    const a = b * q + r;
    return numberTask(`Колко остава, когато разделиш ${a} на ${b}?`, r,
      ['Остатъкът винаги е по-малък от делителя.', `Намери най-голямото кратно на ${b}, което не надминава ${a}.`, `${b} × ${q} = ${b * q}; ${a} − ${b * q} = ${r}.`],
      { type: 'rem', a, b });
  }
  const pools = [[2, 5, 10], [2, 3, 4, 5, 10], [3, 4, 6, 7, 8, 9], [6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9], [3, 4, 6, 7, 8, 9, 12]];
  const b = pick(random, pools[level - 1]);
  const q = int(random, 2, level <= 3 ? 10 : level === 4 ? 12 : 25);
  const a = b * q;
  return numberTask(`${a} ÷ ${b} = ?`, q,
    [`На колко равни групи по ${b} се разделя ${a}?`, `Попитай се: ${b} × колко прави ${a}?`, `${b} × ${q} = ${a}, значи ${a} ÷ ${b} = ${q}.`],
    { type: 'div', a, b });
}

const RULES = {
  2: 'Последната цифра е четна.',
  3: 'Сборът от цифрите се дели на 3.',
  4: 'Числото от последните две цифри се дели на 4.',
  5: 'Последната цифра е 0 или 5.',
  6: 'Дели се и на 2, и на 3.',
  9: 'Сборът от цифрите се дели на 9.',
  10: 'Последната цифра е 0.',
};

function divisibility(level, random) {
  const pools = [[2, 5, 10], [2, 5, 10], [2, 3, 5, 10], [3, 9], [3, 4, 9], [3, 4, 6, 9]];
  const d = pick(random, pools[level - 1]);
  const max = [50, 200, 500, 1000, 5000, 20000][level - 1];
  // Половината числа се делят, за да не може да се познава.
  const n = random() < 0.5 ? d * int(random, 2, Math.floor(max / d)) : int(random, 11, max);
  const yes = n % d === 0;
  const q = Math.floor(n / d);
  const solution = yes
    ? `${n} = ${d} × ${q}, значи се дели.`
    : `${n} = ${d} × ${q} + ${n % d}, значи не се дели.`;
  return choiceTask(`Дели ли се ${n} на ${d} без остатък?`, yes ? 'Да' : 'Не', YES_NO,
    ['Има правило, което спестява деленето.', RULES[d], solution],
    { type: 'divides', n, d });
}

export const GENERATORS = Object.freeze({
  count,
  'number-line': numberLine,
  parity,
  add,
  sub,
  mental,
  mul,
  div,
  divisibility,
});

export function makeTask(topicId, level, random = Math.random) {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Math.round(level) || 1));
  return { topicId, level: clamped, ...GENERATORS[topicId](clamped, random) };
}

// Отговорът се сравнява като текст: интервалите не пречат, а главните и малките букви са без значение.
export function checkAnswer(task, raw) {
  const clean = (s) => String(s).replace(/\s+/g, '').toLowerCase();
  return clean(raw) !== '' && clean(raw) === clean(task.answer);
}
