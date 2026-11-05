// Генератори за групата „Функции и графики“: координатна система, линейна функция,
// парабола и задачи с такса плюс цена на единица. Чисти функции: random се подава отвън.
// Всяка задача носи check — данните, по които тестът пресмята отговора независимо.
import { dec, int, numberTask, pick } from './task.js';

// Отрицателните числа се пишат с обикновено тире, за да съвпада отговорът с текста
// на решението: „-3“ в полето и „-3“ в подсказката са един и същ низ.
const POINTS = ['A', 'B', 'C', 'D', 'M', 'N'];
const nonZero = (random, max) => {
  const value = int(random, 1, max);
  return random() < 0.5 ? value : -value;
};

// --- Координатна система ---

function coordinates(level, random) {
  if (level === 1) {
    const name = pick(random, POINTS);
    const x = int(random, 1, 9);
    const y = int(random, 1, 9);
    const axis = random() < 0.5 ? 'x' : 'y';
    const asked = axis === 'x' ? 'първата' : 'втората';
    return numberTask(`Точка ${name} е на ${x} надясно и ${y} нагоре от началото. Коя е ${asked} ѝ координата?`,
      axis === 'x' ? x : y,
      ['Първата координата е надясно, втората е нагоре.',
        `Записът на точката е (${x}; ${y}).`,
        `${asked[0].toUpperCase()}${asked.slice(1)} координата е ${axis === 'x' ? x : y}.`],
      { type: 'coord-read', x, y, axis });
  }
  if (level === 2) {
    const name = pick(random, POINTS);
    const x = nonZero(random, 9);
    const y = nonZero(random, 9);
    const axis = random() < 0.5 ? 'x' : 'y';
    const asked = axis === 'x' ? 'първата' : 'втората';
    const horizontal = x > 0 ? `${x} надясно` : `${-x} наляво`;
    const vertical = y > 0 ? `${y} нагоре` : `${-y} надолу`;
    return numberTask(`Точка ${name} е на ${horizontal} и ${vertical}. Коя е ${asked} ѝ координата?`,
      axis === 'x' ? x : y,
      ['Наляво и надолу числата са отрицателни.',
        `Записът на точката е (${x}; ${y}).`,
        `${asked[0].toUpperCase()}${asked.slice(1)} координата е ${axis === 'x' ? x : y}.`],
      { type: 'coord-read', x, y, axis });
  }
  if (level === 3) {
    const x = nonZero(random, 9);
    const y = nonZero(random, 9);
    const quadrant = x > 0 ? (y > 0 ? 1 : 4) : (y > 0 ? 2 : 3);
    return numberTask(`В кой квадрант е точката (${x}; ${y})? Отговори с число от 1 до 4.`, quadrant,
      ['Квадрантите се броят от горния десен, обратно на часовниковата стрелка.',
        `Тук x е ${x > 0 ? 'положително' : 'отрицателно'}, а y е ${y > 0 ? 'положително' : 'отрицателно'}.`,
        `Това е квадрант ${quadrant}.`],
      { type: 'coord-quadrant', x, y });
  }
  if (level === 4) {
    const x1 = nonZero(random, 8);
    const y1 = nonZero(random, 8);
    const sideways = random() < 0.5;
    const shift = int(random, 2, 9);
    const x2 = sideways ? x1 + shift : x1;
    const y2 = sideways ? y1 : y1 + shift;
    return numberTask(`Колко е разстоянието между (${x1}; ${y1}) и (${x2}; ${y2})?`, shift,
      [`Едната координата не се променя, значи отсечката е ${sideways ? 'хоризонтална' : 'вертикална'}.`,
        `Разстоянието е разликата на ${sideways ? 'първите' : 'вторите'} координати.`,
        `${sideways ? x2 : y2} - (${sideways ? x1 : y1}) = ${shift}.`],
      { type: 'coord-dist', x1, y1, x2, y2 });
  }
  if (level === 5) {
    const half = int(random, 1, 6);
    const x1 = nonZero(random, 8);
    const x2 = x1 + 2 * half;
    const mid = x1 + half;
    return numberTask(`Точките (${x1}; 0) и (${x2}; 0) са на хоризонталната ос. Коя е първата координата на средата между тях?`, mid,
      ['Средата е еднакво далеч от двата края.',
        `Разстоянието е ${x2 - x1}; половината е ${half}.`,
        `${x1} + ${half} = ${mid}.`],
      { type: 'coord-mid', x1, x2 });
  }
  const x = nonZero(random, 9);
  const y = nonZero(random, 9);
  const overX = random() < 0.5;
  const which = random() < 0.5 ? 'x' : 'y';
  const value = overX ? (which === 'x' ? x : -y) : (which === 'x' ? -x : y);
  return numberTask(`Точката (${x}; ${y}) се огледа спрямо ${overX ? 'хоризонталната' : 'вертикалната'} ос. Коя е ${which === 'x' ? 'първата' : 'втората'} координата на образа?`, value,
    [`Огледалото спрямо ${overX ? 'хоризонталната' : 'вертикалната'} ос сменя знака само на ${overX ? 'втората' : 'първата'} координата.`,
      `Образът е (${overX ? x : -x}; ${overX ? -y : y}).`,
      `Търсената координата е ${value}.`],
    { type: 'coord-reflect', x, y, overX, which });
}

// --- Линейна функция ---

// Записът на „y = kx + b“ без излишни знаци: 1x, +0 и +(-3) не се пишат.
const lineText = (k, b) => {
  const slope = k === 1 ? 'x' : k === -1 ? '-x' : `${k}x`;
  if (b === 0) return `y = ${slope}`;
  return `y = ${slope} ${b > 0 ? '+' : '-'} ${Math.abs(b)}`;
};

function linear(level, random) {
  if (level === 1) {
    const k = int(random, 2, 6);
    const b = int(random, 1, 9);
    const x = int(random, 1, 9);
    return numberTask(`${lineText(k, b)}. Колко е y при x = ${x}?`, k * x + b,
      ['Замести x и първо умножи.',
        `${k} × ${x} = ${k * x}.`,
        `${k * x} + ${b} = ${k * x + b}.`],
      { type: 'lin-value', k, b, x });
  }
  if (level === 2) {
    const k = pick(random, [-4, -3, -2, 2, 3, 4]);
    const b = nonZero(random, 9);
    const x = nonZero(random, 7);
    return numberTask(`${lineText(k, b)}. Колко е y при x = ${x}?`, k * x + b,
      ['Внимавай със знаците: минус по минус дава плюс.',
        `${k} × ${x} = ${k * x}.`,
        `${k * x} + (${b}) = ${k * x + b}.`],
      { type: 'lin-value', k, b, x });
  }
  if (level === 3) {
    const k = pick(random, [2, 3, 4, 5]);
    const zero = int(random, 1, 8);
    const b = -k * zero;
    return numberTask(`Къде правата ${lineText(k, b)} пресича хоризонталната ос?`, zero,
      ['На хоризонталната ос y е нула.',
        `${k}x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = 0, значи ${k}x = ${-b}.`,
        `${-b} ÷ ${k} = ${zero}.`],
      { type: 'lin-zero', k, b });
  }
  if (level === 4) {
    const k = pick(random, [-3, -2, 2, 3, 4]);
    const x1 = nonZero(random, 6);
    const step = int(random, 1, 4);
    const x2 = x1 + step;
    const b = int(random, -6, 6);
    const y1 = k * x1 + b;
    const y2 = k * x2 + b;
    return numberTask(`Права минава през (${x1}; ${y1}) и (${x2}; ${y2}). Какъв е наклонът ѝ?`, k,
      ['Наклонът е промяната на y, разделена на промяната на x.',
        `y се мени с ${y2} - (${y1}) = ${y2 - y1}, а x с ${x2} - (${x1}) = ${x2 - x1}.`,
        `${y2 - y1} ÷ ${x2 - x1} = ${k}.`],
      { type: 'lin-slope', x1, y1, x2, y2 });
  }
  if (level === 5) {
    const k = pick(random, [2, 3, 4, 5, 6]);
    const b = nonZero(random, 9);
    const x = nonZero(random, 8);
    const y = k * x + b;
    return numberTask(`${lineText(k, b)}. При кое x се получава y = ${y}?`, x,
      ['Реши уравнението спрямо x.',
        `${k}x = ${y} - (${b}) = ${y - b}.`,
        `${y - b} ÷ ${k} = ${x}.`],
      { type: 'lin-solve', k, b, y });
  }
  const x = nonZero(random, 6);
  const k1 = int(random, 2, 6);
  const k2 = k1 - int(random, 1, 3);
  const b1 = nonZero(random, 8);
  const b2 = (k1 - k2) * x + b1;
  return numberTask(`При кое x двете прави ${lineText(k1, b1)} и ${lineText(k2, b2)} се пресичат?`, x,
    ['В пресечната точка двете дават едно и също y.',
      `${k1}x + (${b1}) = ${k2}x + (${b2}), значи ${k1 - k2}x = ${b2 - b1}.`,
      `${b2 - b1} ÷ ${k1 - k2} = ${x}.`],
    { type: 'lin-cross', k1, b1, k2, b2 });
}

// --- Парабола ---

function parabola(level, random) {
  if (level === 1) {
    const x = nonZero(random, 9);
    return numberTask(`y = x². Колко е y при x = ${x}?`, x * x,
      ['Квадратът е числото, умножено само по себе си.',
        `${x} × ${x}.`,
        `Резултатът е ${x * x}.`],
      { type: 'par-value', x });
  }
  if (level === 2) {
    const a = int(random, 2, 5);
    const x = nonZero(random, 6);
    return numberTask(`y = ${a}x². Колко е y при x = ${x}?`, a * x * x,
      ['Първо квадратът, после умножението.',
        `${x} × ${x} = ${x * x}.`,
        `${a} × ${x * x} = ${a * x * x}.`],
      { type: 'par-stretch', a, x });
  }
  if (level === 3) {
    const k = nonZero(random, 9);
    const x = nonZero(random, 7);
    return numberTask(`y = x² ${k > 0 ? '+' : '-'} ${Math.abs(k)}. Колко е y при x = ${x}?`, x * x + k,
      ['Числото накрая мести цялата крива нагоре или надолу.',
        `${x} × ${x} = ${x * x}.`,
        `${x * x} + (${k}) = ${x * x + k}.`],
      { type: 'par-shift-up', k, x });
  }
  if (level === 4) {
    const h = nonZero(random, 6);
    const x = nonZero(random, 8);
    const inside = x - h;
    return numberTask(`y = (x ${h > 0 ? '-' : '+'} ${Math.abs(h)})². Колко е y при x = ${x}?`, inside * inside,
      ['Първо смятай в скобата.',
        `${x} - (${h}) = ${inside}.`,
        `${inside} × ${inside} = ${inside * inside}.`],
      { type: 'par-shift-side', h, x });
  }
  if (level === 5) {
    const h = nonZero(random, 7);
    const k = nonZero(random, 9);
    const which = random() < 0.5 ? 'h' : 'k';
    return numberTask(`y = (x ${h > 0 ? '-' : '+'} ${Math.abs(h)})² ${k > 0 ? '+' : '-'} ${Math.abs(k)}. Коя е ${which === 'h' ? 'първата' : 'втората'} координата на върха?`,
      which === 'h' ? h : k,
      ['Върхът е там, където скобата е нула.',
        `Скобата е нула при x = ${h}, а тогава y = ${k}.`,
        `Върхът е (${h}; ${k}), значи търсената координата е ${which === 'h' ? h : k}.`],
      { type: 'par-vertex', h, k, which });
  }
  const a = pick(random, [-3, -2, 2, 3]);
  const h = nonZero(random, 5);
  const k = nonZero(random, 8);
  const x = nonZero(random, 7);
  const inside = x - h;
  return numberTask(`y = ${a}(x ${h > 0 ? '-' : '+'} ${Math.abs(h)})² ${k > 0 ? '+' : '-'} ${Math.abs(k)}. Колко е y при x = ${x}?`,
    a * inside * inside + k,
    ['Ред: скоба, квадрат, умножение, събиране.',
      `${x} - (${h}) = ${inside}, после ${inside} × ${inside} = ${inside * inside}.`,
      `${a} × ${inside * inside} + (${k}) = ${a * inside * inside + k}.`],
    { type: 'par-full', a, h, k, x });
}

// --- Такса и цена на единица ---

const RIDES = [
  { thing: 'такси', unit: 'километър', units: 'километра', fee: 'начална такса' },
  { thing: 'велосипед под наем', unit: 'час', units: 'часа', fee: 'такса за отключване' },
  { thing: 'куриер', unit: 'пакет', units: 'пакета', fee: 'такса за посещение' },
];

function rates(level, random) {
  const ride = pick(random, RIDES);
  if (level === 1) {
    const base = int(random, 2, 6);
    const per = int(random, 2, 5);
    const units = int(random, 3, 12);
    const total = base + per * units;
    return numberTask(`При ${ride.thing}: ${ride.fee} ${base} лв. и по ${per} лв. на ${ride.unit}. Колко струват ${units} ${ride.units}?`, total,
      ['Таксата се плаща веднъж, цената — за всяка единица.',
        `${units} × ${per} = ${per * units} лв.`,
        `${per * units} + ${base} = ${total} лв.`],
      { type: 'rate-total', base, per, units });
  }
  if (level === 2) {
    const base = int(random, 2, 8);
    const per = int(random, 2, 6);
    const units = int(random, 3, 14);
    const total = base + per * units;
    return numberTask(`При ${ride.thing}: ${ride.fee} ${base} лв. и по ${per} лв. на ${ride.unit}. Платил си ${total} лв. Колко ${ride.units} са това?`, units,
      ['Първо махни таксата, която не зависи от количеството.',
        `${total} - ${base} = ${per * units} лв. остават за ${ride.units}.`,
        `${per * units} ÷ ${per} = ${units}.`],
      { type: 'rate-units', base, per, total });
  }
  if (level === 3) {
    const base = int(random, 2, 9);
    const per = int(random, 2, 7);
    const units = int(random, 3, 12);
    const total = base + per * units;
    return numberTask(`Сметката е ${total} лв. за ${units} ${ride.units} при цена ${per} лв. на ${ride.unit}. Колко е ${ride.fee}?`, base,
      ['Частта за количеството се смята направо.',
        `${units} × ${per} = ${per * units} лв.`,
        `${total} - ${per * units} = ${base} лв.`],
      { type: 'rate-base', per, units, total });
  }
  if (level === 4) {
    const base = int(random, 2, 6);
    const per = pick(random, [0.8, 1.2, 1.5, 2.5]);
    const units = int(random, 4, 16);
    const value = base + per * units;
    return numberTask(`При ${ride.thing}: ${ride.fee} ${base} лв. и по ${dec(per, 2)} лв. на ${ride.unit}. Колко струват ${units} ${ride.units}?`, dec(value, 2),
      ['Умножението с десетично число става както с цяло, после се слага запетаята.',
        `${units} × ${dec(per, 2)} = ${dec(per * units, 2)} лв.`,
        `${dec(per * units, 2)} + ${base} = ${dec(value, 2)} лв.`],
      { type: 'rate-total-dec', base, per, units });
  }
  if (level === 5) {
    const base = int(random, 10, 25);
    const included = pick(random, [100, 200, 300]);
    const perExtra = pick(random, [1, 2]);
    const extra = int(random, 0, 60);
    const used = included + extra;
    const total = base + perExtra * extra;
    return numberTask(`Абонамент ${base} лв. с включени ${included} минути, после по ${perExtra} лв. на минута. Колко е сметката при ${used} минути?`, total,
      ['Включените минути не се плащат допълнително.',
        `Над включеното: ${used} - ${included} = ${extra} минути.`,
        `${base} + ${extra} × ${perExtra} = ${total} лв.`],
      { type: 'rate-plan', base, included, perExtra, used });
  }
  const units = int(random, 2, 12);
  const perA = int(random, 3, 8);
  const perB = perA - int(random, 1, 2);
  const baseA = int(random, 1, 8);
  const baseB = baseA + (perA - perB) * units;
  return numberTask(`Първа тарифа: ${baseA} лв. такса и по ${perA} лв. на ${ride.unit}. Втора: ${baseB} лв. такса и по ${perB} лв. Колко ${ride.units} изравняват двете сметки?`, units,
    ['Търси количеството, при което двете сметки са равни.',
      `Разликата в таксите е ${baseB - baseA} лв., а първата тарифа харчи по ${perA - perB} лв. повече на ${ride.unit}.`,
      `${baseB - baseA} ÷ ${perA - perB} = ${units}.`],
    { type: 'rate-even', baseA, perA, baseB, perB });
}

export const FUNCTION_GENERATORS = Object.freeze({
  coordinates,
  linear,
  parabola,
  rates,
});
