// Генератори за нива 4–6: дроби, десетични, проценти, отрицателни, степени, корени,
// пропорции и текстови задачи от българския бит. Чисти функции: random се подава отвън.
// Всяка задача носи check — данните, по които тестът пресмята отговора независимо от генератора.
import { bg, choiceTask, dec, fracText, int, numberTask, pick, reduce } from './task.js';

// Официалният фиксиран курс при приемането на евро.
export const EUR_RATE = 1.95583;

// --- 4. Дроби, десетични числа, проценти ---

function fractions(level, random) {
  if (level === 1) {
    // Част от цяло: дробта като реален дял от количество.
    const den = pick(random, [2, 3, 4, 5]);
    const whole = den * int(random, 2, 9);
    const part = whole / den;
    return numberTask(`Колко е ${fracText(1, den)} от ${whole}?`, part,
      [`${fracText(1, den)} значи „раздели на ${den} равни части и вземи една“.`,
        `Раздели ${whole} на ${den}.`,
        `${whole} ÷ ${den} = ${part}.`],
      { type: 'frac-of', whole, num: 1, den });
  }
  if (level === 2) {
    // Еквивалентна дроб: същата част, записана с друг знаменател.
    const den = pick(random, [2, 3, 4, 5]);
    const num = int(random, 1, den - 1);
    const factor = int(random, 2, 5);
    return numberTask(`Колко липсва: ${num}/${den} = ?/${den * factor}`, num * factor,
      ['Дробта не се променя, ако умножим и числителя, и знаменателя с едно и също число.',
        `Знаменателят е умножен по ${factor}, значи и числителят трябва.`,
        `${num} × ${factor} = ${num * factor}.`],
      { type: 'frac-equiv', num, den, factor });
  }
  if (level === 3) {
    // Събиране с еднакъв знаменател.
    const den = int(random, 3, 9);
    const a = int(random, 1, den - 2);
    const b = int(random, 1, den - a);
    return numberTask(`${a}/${den} + ${b}/${den} = ?`, fracText(a + b, den),
      ['Знаменателите са еднакви: броят на частите не се променя.',
        'Събери само числителите.',
        `${a} + ${b} = ${a + b}, значи отговорът е ${fracText(a + b, den)}.`],
      { type: 'frac-add-same', a, b, den });
  }
  if (level === 4) {
    // Съкращаване до несъкратима дроб.
    const [n0, d0] = [int(random, 1, 6), int(random, 2, 9)];
    const factor = int(random, 2, 6);
    const num = n0 * factor;
    const den = (d0 + n0) * factor;
    return numberTask(`Съкрати дробта ${num}/${den}.`, fracText(num, den),
      ['Търси число, на което се делят и числителят, и знаменателят.',
        `${num} и ${den} се делят на ${factor}.`,
        `${num}/${den} = ${fracText(num, den)}.`],
      { type: 'frac-reduce', num, den });
  }
  if (level === 5) {
    // Събиране с различни знаменатели, където единият е кратен на другия.
    const small = pick(random, [2, 3, 4]);
    const big = small * int(random, 2, 3);
    const a = int(random, 1, small - 1 || 1);
    const b = int(random, 1, big - 1);
    return numberTask(`${a}/${small} + ${b}/${big} = ?`, fracText(a * (big / small) + b, big),
      [`${big} се дели на ${small}, значи общият знаменател е ${big}.`,
        `${a}/${small} = ${a * (big / small)}/${big}. Сега знаменателите са еднакви.`,
        `${a * (big / small)}/${big} + ${b}/${big} = ${fracText(a * (big / small) + b, big)}.`],
      { type: 'frac-add', a, b, da: small, db: big });
  }
  // Дроб от количество с числител над 1.
  const den = pick(random, [3, 4, 5, 6, 8]);
  const num = int(random, 2, den - 1);
  const whole = den * int(random, 3, 20);
  const part = (whole / den) * num;
  return numberTask(`Колко е ${num}/${den} от ${whole}?`, part,
    [`Първо намери колко е 1/${den} от ${whole}.`,
      `${whole} ÷ ${den} = ${whole / den}, после умножи по ${num}.`,
      `${whole / den} × ${num} = ${part}.`],
    { type: 'frac-of', whole, num, den });
}

function decimals(level, random) {
  if (level === 1) {
    // Десети: събиране с един знак след запетаята.
    const a = int(random, 1, 8);
    const b = int(random, 1, 9 - a);
    return numberTask(`0,${a} + 0,${b} = ?`, dec((a + b) / 10, 1),
      ['Десетите се събират като единици: 1 десета плюс 1 десета са 2 десети.',
        `${a} десети + ${b} десети = ${a + b} десети.`,
        `Отговор: ${dec((a + b) / 10, 1)}.`],
      { type: 'dec-add', a: a / 10, b: b / 10 });
  }
  if (level === 2) {
    // Стойност на цифрата: мястото решава колко струва.
    const whole = int(random, 1, 99);
    const tenths = int(random, 1, 9);
    const hundredths = int(random, 1, 9);
    const value = `${whole},${tenths}${hundredths}`;
    const place = pick(random, ['десетите', 'стотните']);
    const answer = place === 'десетите' ? tenths : hundredths;
    return numberTask(`Коя е цифрата на ${place} в числото ${value}?`, answer,
      ['След запетаята идват първо десетите, после стотните.',
        `В ${value} първата цифра след запетаята е ${tenths}, втората е ${hundredths}.`,
        `Отговор: ${answer}.`],
      { type: 'dec-digit', whole, tenths, hundredths, place });
  }
  if (level === 3) {
    // Две цифри след запетаята, с пренос.
    const a = int(random, 105, 980) / 100;
    const b = int(random, 105, 980) / 100;
    return numberTask(`${dec(a)} + ${dec(b)} = ?`, dec(a + b),
      ['Подреди числата по запетаята.',
        'Събери стотните, после десетите, после целите.',
        `Отговор: ${dec(a + b)}.`],
      { type: 'dec-add', a, b });
  }
  if (level === 4) {
    // Умножение и деление на 10 и 100: запетаята се мести.
    const value = int(random, 105, 9850) / 100;
    const factor = pick(random, [10, 100]);
    const up = random() < 0.5;
    const answer = up ? value * factor : value / factor;
    return numberTask(`${dec(value)} ${up ? '×' : '÷'} ${factor} = ?`, dec(answer, 4),
      ['Умножението и деленето на 10 местят запетаята.',
        `${up ? 'Надясно' : 'Наляво'} с ${factor === 10 ? 'едно място' : 'две места'}.`,
        `Отговор: ${dec(answer, 4)}.`],
      { type: up ? 'dec-mul' : 'dec-div', a: value, b: factor });
  }
  if (level === 5) {
    // Десетично по цяло число.
    const a = int(random, 105, 950) / 100;
    const b = int(random, 2, 9);
    return numberTask(`${dec(a)} × ${b} = ?`, dec(a * b),
      ['Умножи, като че няма запетая, после я върни на място.',
        `${Math.round(a * 100)} × ${b} = ${Math.round(a * 100) * b}; запетаята остава на 2 места.`,
        `Отговор: ${dec(a * b)}.`],
      { type: 'dec-mul', a, b });
  }
  // Дроб към десетично число: отговорът може да се даде и в двата записа.
  const den = pick(random, [2, 4, 5, 8, 10, 20, 25]);
  const num = int(random, 1, den - 1);
  return numberTask(`Запиши ${num}/${den} като десетично число.`, dec(num / den, 4),
    ['Дробта е деление: числител върху знаменател.',
      `Раздели ${num} на ${den}.`,
      `${num} ÷ ${den} = ${dec(num / den, 4)}.`],
    { type: 'frac-to-dec', num, den });
}

function percent(level, random) {
  if (level === 1) {
    // Най-простите проценти: половината и четвъртината.
    const p = pick(random, [50, 25, 10]);
    const base = p === 10 ? int(random, 2, 20) * 10 : int(random, 1, 12) * (p === 25 ? 4 : 2);
    const answer = (base * p) / 100;
    return numberTask(`Колко е ${p}% от ${base}?`, answer,
      [`${p}% значи ${p} от всеки 100, тоест ${p === 50 ? 'половината' : p === 25 ? 'четвъртината' : 'една десета'}.`,
        `Раздели ${base} на ${100 / p}.`,
        `${base} ÷ ${100 / p} = ${answer}.`],
      { type: 'percent-of', base, p });
  }
  if (level === 2) {
    const p = pick(random, [10, 20, 30, 40, 50]);
    const base = int(random, 2, 40) * 10;
    const answer = (base * p) / 100;
    return numberTask(`Колко е ${p}% от ${base}?`, answer,
      ['Намери първо 10%: това е числото, разделено на 10.',
        `10% от ${base} е ${base / 10}, а ти трябват ${p / 10} такива части.`,
        `${base / 10} × ${p / 10} = ${answer}.`],
      { type: 'percent-of', base, p });
  }
  if (level === 3) {
    // Намаление в магазина: типичната сметка пред рафта.
    // Цената е кратна на 20, за да е цяло и намалението при 25%.
    const price = int(random, 1, 20) * 20;
    const p = pick(random, [10, 20, 25, 50]);
    const off = (price * p) / 100;
    return numberTask(`Яке за ${price} лв. е с ${p}% намаление. Колко плащаш?`, price - off,
      [`Намалението е ${p}% от ${price} лв.`,
        `${p}% от ${price} е ${off}. Извади го от цената.`,
        `${price} − ${off} = ${price - off} лв.`],
      { type: 'percent-less', base: price, p });
  }
  if (level === 4) {
    // Увеличение: заплата, цена, количество.
    const base = int(random, 2, 30) * 100;
    const p = pick(random, [5, 10, 15, 20]);
    const more = (base * p) / 100;
    return numberTask(`Цена от ${base} лв. се вдига с ${p}%. Каква става?`, base + more,
      [`Увеличението е ${p}% от ${base} лв.`,
        `${p}% от ${base} е ${more}. Добави го към цената.`,
        `${base} + ${more} = ${base + more} лв.`],
      { type: 'percent-more', base, p });
  }
  if (level === 5) {
    // Обратната посока: колко процента е едното от другото.
    const p = pick(random, [10, 20, 25, 40, 50, 75]);
    const base = int(random, 2, 20) * 20;
    const part = (base * p) / 100;
    return numberTask(`Колко процента е ${part} от ${base}?`, p,
      ['Процентът е частта, разделена на цялото, умножена по 100.',
        `${part} ÷ ${base} = ${dec(part / base, 4)}.`,
        `${dec(part / base, 4)} × 100 = ${p}%.`],
      { type: 'percent-share', part, base });
  }
  // ДДС: сметката, която излиза на всяка касова бележка.
  const net = int(random, 2, 50) * 10;
  const vat = net * 0.2;
  return numberTask(`Цена без ДДС е ${net} лв. С 20% ДДС колко става?`, dec(net + vat),
    ['ДДС в България е 20% върху цената без данък.',
      `20% от ${net} е ${dec(vat)}. Добави го.`,
      `${net} + ${dec(vat)} = ${dec(net + vat)} лв.`],
    { type: 'percent-more', base: net, p: 20 });
}

// --- 5. Отрицателни числа, степени, корени ---

function negatives(level, random) {
  if (level === 1) {
    // От минус към плюс: движение надясно по оста.
    const a = -int(random, 1, 9);
    const b = int(random, Math.abs(a) + 1, 15);
    return numberTask(`${a} + ${b} = ?`, a + b,
      ['Събирането е движение надясно по числовата ос.',
        `Тръгни от ${a} и направи ${b} стъпки надясно.`,
        `${a} + ${b} = ${a + b}.`],
      { type: 'neg-add', a, b });
  }
  if (level === 2) {
    // Изваждане под нулата.
    const a = int(random, 1, 9);
    const b = int(random, a + 1, 18);
    return numberTask(`${a} − ${b} = ?`, a - b,
      ['Изваждането е движение наляво, което може да мине под нулата.',
        `От ${a} направи ${b} стъпки наляво.`,
        `${a} − ${b} = ${a - b}.`],
      { type: 'neg-add', a, b: -b });
  }
  if (level === 3) {
    // Минус минус плюс: двата знака се събират по посока.
    const a = -int(random, 1, 12);
    const b = int(random, 1, 12);
    return numberTask(`${a} − ${b} = ?`, a - b,
      ['И двете са наляво: започваш отляво на нулата и продължаваш натам.',
        `${Math.abs(a)} + ${b} = ${Math.abs(a) + b}, но в отрицателната страна.`,
        `${a} − ${b} = ${a - b}.`],
      { type: 'neg-add', a, b: -b });
  }
  if (level === 4) {
    // Температура: най-честата употреба в бита.
    const morning = -int(random, 1, 12);
    const rise = int(random, 3, 20);
    return numberTask(`Сутринта е ${morning}°C. Температурата се вдига с ${rise} градуса. Колко става?`, morning + rise,
      ['Вдигането на температура е движение надясно по градусника.',
        `Тръгни от ${morning} и добави ${rise}.`,
        `${morning} + ${rise} = ${morning + rise}°C.`],
      { type: 'neg-add', a: morning, b: rise });
  }
  if (level === 5) {
    // Знаци при умножение.
    const a = int(random, 2, 9) * (random() < 0.5 ? -1 : 1);
    const b = int(random, 2, 9) * (random() < 0.5 ? -1 : 1);
    const sign = a * b > 0 ? 'плюс' : 'минус';
    return numberTask(`(${a}) × (${b}) = ?`, a * b,
      ['Еднаквите знаци дават плюс, различните дават минус.',
        `${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a * b)}, а знакът е ${sign}.`,
        `(${a}) × (${b}) = ${a * b}.`],
      { type: 'neg-mul', a, b });
  }
  // Скоби и ред на действията с отрицателни числа.
  const a = -int(random, 2, 9);
  const b = int(random, 2, 9);
  const c = int(random, 2, 9);
  return numberTask(`${a} + ${b} × ${c} = ?`, a + b * c,
    ['Умножението е преди събирането, дори когато има минус.',
      `${b} × ${c} = ${b * c}, после добави ${a}.`,
      `${a} + ${b * c} = ${a + b * c}.`],
    { type: 'neg-mul-add', a, b, c });
}

function powers(level, random) {
  if (level === 1) {
    const base = int(random, 2, 5);
    const exp = 2;
    return numberTask(`${base}² = ?`, base ** exp,
      ['Квадратът е числото, умножено по себе си.',
        `${base} × ${base}.`,
        `${base}² = ${base ** exp}.`],
      { type: 'pow', base, exp });
  }
  if (level === 2) {
    const exp = int(random, 2, 6);
    return numberTask(`10 на степен ${exp} = ?`, 10 ** exp,
      ['Степента казва колко десетки се умножават.',
        `Единица и след нея ${exp} нули.`,
        `10 на степен ${exp} = ${10 ** exp}.`],
      { type: 'pow', base: 10, exp });
  }
  if (level === 3) {
    const base = int(random, 6, 15);
    return numberTask(`${base}² = ?`, base ** 2,
      ['Квадратът е числото, умножено по себе си.',
        `Раздели: ${base} × ${base} = ${base} × 10 + ${base} × ${base - 10 >= 0 ? base - 10 : base}.`,
        `${base}² = ${base ** 2}.`],
      { type: 'pow', base, exp: 2 });
  }
  if (level === 4) {
    // Умножение на степени с еднаква основа: степените се събират.
    const base = int(random, 2, 4);
    const m = int(random, 1, 3);
    const n = int(random, 1, 3);
    return numberTask(`${base} на степен ${m}, умножено по ${base} на степен ${n} = ?`, base ** (m + n),
      ['При еднаква основа степените се събират.',
        `${m} + ${n} = ${m + n}, значи търсим ${base} на степен ${m + n}.`,
        `Отговор: ${base ** (m + n)}.`],
      { type: 'pow', base, exp: m + n });
  }
  if (level === 5) {
    // Знак при степен на отрицателно число.
    const base = -int(random, 2, 4);
    const exp = int(random, 2, 3);
    return numberTask(`(${base}) на степен ${exp} = ?`, base ** exp,
      ['Четна степен дава плюс, нечетна запазва минуса.',
        `${Math.abs(base)} на степен ${exp} = ${Math.abs(base) ** exp}, а степента е ${exp % 2 === 0 ? 'четна' : 'нечетна'}.`,
        `Отговор: ${base ** exp}.`],
      { type: 'pow', base, exp });
  }
  // Деление на степени: степените се изваждат.
  const base = int(random, 2, 4);
  const m = int(random, 3, 6);
  const n = int(random, 1, m - 1);
  return numberTask(`${base} на степен ${m}, разделено на ${base} на степен ${n} = ?`, base ** (m - n),
    ['При деление с еднаква основа степените се изваждат.',
      `${m} − ${n} = ${m - n}.`,
      `Отговор: ${base ** (m - n)}.`],
    { type: 'pow', base, exp: m - n });
}

function roots(level, random) {
  if (level <= 3) {
    const max = [6, 12, 20][level - 1];
    const root = int(random, 2, max);
    return numberTask(`Корен квадратен от ${root * root} = ?`, root,
      ['Търсим число, което умножено по себе си дава това число.',
        `Кое число на квадрат дава ${root * root}?`,
        `${root} × ${root} = ${root * root}, значи отговорът е ${root}.`],
      { type: 'sqrt', n: root * root });
  }
  if (level === 4) {
    // Оценка: между кои цели числа е коренът.
    const root = int(random, 3, 15);
    const n = root * root + int(random, 1, 2 * root);
    return numberTask(`Между кои две цели числа е корен квадратен от ${n}? Напиши по-малкото.`, root,
      ['Потърси най-близките точни квадрати.',
        `${root}² = ${root * root}, а ${root + 1}² = ${(root + 1) ** 2}.`,
        `${root * root} < ${n} < ${(root + 1) ** 2}, значи по-малкото число е ${root}.`],
      { type: 'sqrt-floor', n });
  }
  if (level === 5) {
    // Корен от произведение: двата корена се умножават.
    const a = int(random, 2, 9);
    const b = int(random, 2, 9);
    return numberTask(`Корен квадратен от ${a * a * b * b} = ?`, a * b,
      ['Числото е произведение от два точни квадрата.',
        `${a * a * b * b} = ${a * a} × ${b * b}, а корените им са ${a} и ${b}.`,
        `${a} × ${b} = ${a * b}.`],
      { type: 'sqrt', n: a * a * b * b });
  }
  // Кубичен корен.
  const root = int(random, 2, 8);
  return numberTask(`Корен трети (кубичен) от ${root ** 3} = ?`, root,
    ['Търсим число, което три пъти умножено по себе си дава това число.',
      `Кое число на трета степен дава ${root ** 3}?`,
      `${root} × ${root} × ${root} = ${root ** 3}, значи отговорът е ${root}.`],
    { type: 'cbrt', n: root ** 3 });
}

// --- 6. Пропорции и текстови задачи от бита ---

function ratio(level, random) {
  if (level === 1) {
    // Увеличаване на рецепта: отношението се запазва.
    const a = int(random, 1, 5);
    const b = int(random, 1, 5);
    const factor = int(random, 2, 6);
    return numberTask(`Рецепта иска ${a} чаши вода на ${b} чаши ориз. За ${b * factor} чаши ориз колко вода трябва?`, a * factor,
      ['Отношението остава същото: и двете се увеличават еднакво.',
        `${b * factor} ÷ ${b} = ${factor}, значи всичко се умножава по ${factor}.`,
        `${a} × ${factor} = ${a * factor} чаши вода.`],
      { type: 'ratio', a, b, c: b * factor });
  }
  if (level === 2) {
    // Пропорция с неизвестно.
    const a = int(random, 2, 9);
    const b = int(random, 2, 9);
    const factor = int(random, 2, 7);
    return numberTask(`Намери неизвестното: ${a} / ${b} = ? / ${b * factor}`, a * factor,
      ['Пропорцията е равенство на две отношения.',
        `Долу числото е умножено по ${factor}, значи и горе.`,
        `${a} × ${factor} = ${a * factor}.`],
      { type: 'ratio', a, b, c: b * factor });
  }
  if (level === 3) {
    // Единична цена: сметката пред щанда.
    const kg = int(random, 2, 8);
    const perKg = int(random, 2, 15);
    const want = int(random, 2, 12);
    return numberTask(`${kg} кг домати струват ${kg * perKg} лв. Колко струват ${want} кг?`, want * perKg,
      ['Намери първо цената на 1 кг.',
        `${kg * perKg} ÷ ${kg} = ${perKg} лв. за килограм.`,
        `${perKg} × ${want} = ${want * perKg} лв.`],
      { type: 'ratio', a: kg * perKg, b: kg, c: want });
  }
  if (level === 4) {
    // Разделяне в дадено отношение.
    const a = int(random, 1, 4);
    const b = int(random, 1, 4);
    const unit = int(random, 3, 20);
    const total = (a + b) * unit;
    return numberTask(`${total} лв. се делят между двама в отношение ${a} към ${b}. Колко взема първият?`, a * unit,
      [`Общо частите са ${a} + ${b} = ${a + b}.`,
        `${total} ÷ ${a + b} = ${unit} лв. за една част.`,
        `Първият взема ${a} части: ${unit} × ${a} = ${a * unit} лв.`],
      { type: 'ratio-split', total, a, b });
  }
  if (level === 5) {
    // Мащаб на карта.
    const scale = pick(random, [100, 200, 500, 1000]);
    const cm = int(random, 2, 12);
    return numberTask(`На карта 1 см отговаря на ${scale} м. Колко метра са ${cm} см?`, cm * scale,
      ['Всеки сантиметър на картата е едно и също разстояние наистина.',
        `${cm} × ${scale}.`,
        `Отговор: ${cm * scale} м.`],
      { type: 'ratio', a: scale, b: 1, c: cm });
  }
  // Обратна пропорционалност: повече работници, по-малко време.
  // Часовете са кратни на множителя, за да излезе цял час.
  const workers = int(random, 2, 6);
  const times = int(random, 2, 3);
  const hours = times * int(random, 1, 4);
  const more = workers * times;
  return numberTask(`${workers} работници боядисват стая за ${hours} часа. За колко часа ще я боядисат ${more} работници?`, (workers * hours) / more,
    ['Повече хора значи по-малко време: произведението остава същото.',
      `${workers} × ${hours} = ${workers * hours} работни часа са нужни.`,
      `${workers * hours} ÷ ${more} = ${(workers * hours) / more} часа.`],
    { type: 'inverse', workers, hours, more });
}

const SHOPS = ['хлебарницата', 'магазина', 'сладкарницата', 'пазара'];

function wordMoney(level, random) {
  if (level === 1) {
    // Ресто: първата сметка, която дете прави само.
    const price = int(random, 2, 9);
    const paid = pick(random, [10, 20]);
    return numberTask(`Купуваш хляб за ${price} лв. и плащаш с ${paid} лв. Колко ресто получаваш?`, paid - price,
      ['Рестото е разликата между платеното и цената.',
        `${paid} − ${price}.`,
        `Отговор: ${paid - price} лв.`],
      { type: 'sub', a: paid, b: price });
  }
  if (level === 2) {
    // Няколко еднакви неща. Банкнотата се избира след сметката, за да стига винаги.
    const count = int(random, 2, 8);
    const price = int(random, 2, 9);
    const total = count * price;
    const paid = [10, 20, 50, 100].find((note) => note >= total);
    return numberTask(`В ${pick(random, SHOPS)} купуваш ${count} кифли по ${price} лв. Плащаш с ${paid} лв. Колко ресто ти се връща?`, paid - count * price,
      ['Първо намери колко струва всичко.',
        `${count} × ${price} = ${total} лв.`,
        `${paid} − ${total} = ${paid - total} лв.`],
      { type: 'buy-change', count, price, paid });
  }
  if (level === 3) {
    // Две различни стоки.
    const a = int(random, 2, 6);
    const pa = int(random, 2, 8);
    const b = int(random, 2, 6);
    const pb = int(random, 2, 8);
    return numberTask(`Купуваш ${a} кг картофи по ${pa} лв. и ${b} кг моркови по ${pb} лв. Колко плащаш общо?`, a * pa + b * pb,
      ['Сметни отделно двете стоки, после ги събери.',
        `${a} × ${pa} = ${a * pa}, а ${b} × ${pb} = ${b * pb}.`,
        `${a * pa} + ${b * pb} = ${a * pa + b * pb} лв.`],
      { type: 'two-goods', a, pa, b, pb });
  }
  if (level === 4) {
    // Сметка със стотинки.
    const price = int(random, 150, 890) / 100;
    const count = int(random, 2, 5);
    const total = price * count;
    return numberTask(`Кисело мляко струва ${dec(price)} лв. Колко плащаш за ${count} броя?`, dec(total),
      ['Умножи цената по броя.',
        `${Math.round(price * 100)} стотинки × ${count} = ${Math.round(price * 100) * count} стотинки.`,
        `Отговор: ${dec(total)} лв.`],
      { type: 'dec-mul', a: price, b: count });
  }
  if (level === 5) {
    // Пестене за цел: колко месеца.
    const perMonth = int(random, 2, 12) * 10;
    const months = int(random, 3, 12);
    const goal = perMonth * months;
    return numberTask(`Събираш по ${perMonth} лв. на месец за телефон за ${goal} лв. След колко месеца ще го купиш?`, months,
      ['Колко пъти месечната сума се събира в цената?',
        `${goal} ÷ ${perMonth}.`,
        `Отговор: ${months} месеца.`],
      { type: 'div', a: goal, b: perMonth });
  }
  // Превръщане на левове в евро по фиксирания курс.
  const leva = int(random, 2, 40) * 10;
  const euro = Math.round(leva / EUR_RATE);
  return numberTask(`Курсът е 1 евро = ${bg(String(EUR_RATE))} лв. Колко евро са ${leva} лв.? Закръгли до цяло евро.`, euro,
    ['За да превърнеш левове в евро, делиш на курса.',
      `${leva} ÷ ${bg(String(EUR_RATE))} = ${dec(leva / EUR_RATE)}.`,
      `Закръглено: ${euro} евро.`],
    { type: 'to-euro', leva });
}

function wordTravel(level, random) {
  if (level === 1) {
    // Пътуване с автобус: време на тръгване и пристигане.
    const start = int(random, 7, 18);
    const minutes = pick(random, [20, 30, 40, 45]);
    return numberTask(`Автобусът тръгва в ${start}:00 и пътува ${minutes} минути. В колко часа и минути пристига? Напиши само минутите.`, minutes,
      ['Часът не се сменя, щом минутите не минават 60.',
        `0 + ${minutes} = ${minutes} минути.`,
        `Пристига в ${start}:${minutes}, значи минутите са ${minutes}.`],
      { type: 'const', value: minutes });
  }
  if (level === 2) {
    // Разстояние и скорост, кръгли числа.
    const speed = pick(random, [40, 50, 60, 80]);
    const hours = int(random, 2, 5);
    return numberTask(`Кола се движи с ${speed} км/ч. Колко километра минава за ${hours} часа?`, speed * hours,
      ['Всеки час колата минава едно и също разстояние.',
        `${speed} × ${hours}.`,
        `Отговор: ${speed * hours} км.`],
      { type: 'mul', a: speed, b: hours });
  }
  if (level === 3) {
    // Обратното: колко време за дадено разстояние.
    const speed = pick(random, [40, 50, 60, 80]);
    const hours = int(random, 2, 6);
    const distance = speed * hours;
    return numberTask(`От София до Пловдив има ${distance} км. При ${speed} км/ч за колко часа се стига?`, hours,
      ['Колко пъти разстоянието за един час се събира в целия път?',
        `${distance} ÷ ${speed}.`,
        `Отговор: ${hours} часа.`],
      { type: 'div', a: distance, b: speed });
  }
  if (level === 4) {
    // Рецепта за повече хора. Брашното на човек е цяло число, за да е чиста сметката.
    const people = int(random, 2, 4);
    const perPerson = int(random, 5, 20) * 10;
    const grams = perPerson * people;
    const want = people * int(random, 2, 4);
    return numberTask(`Рецепта за ${people} души иска ${grams} г брашно. Колко брашно трябва за ${want} души?`, (grams / people) * want,
      ['Намери колко се пада на един човек.',
        `${grams} ÷ ${people} = ${grams / people} г на човек.`,
        `${grams / people} × ${want} = ${(grams / people) * want} г.`],
      { type: 'ratio', a: grams, b: people, c: want });
  }
  if (level === 5) {
    // Разход на гориво.
    const perHundred = int(random, 5, 9);
    const km = int(random, 2, 9) * 100;
    const litres = (perHundred * km) / 100;
    return numberTask(`Кола харчи ${perHundred} л на 100 км. Колко литра трябват за ${km} км?`, litres,
      ['Колко стотици километра са това?',
        `${km} ÷ 100 = ${km / 100} стотици, по ${perHundred} л всяка.`,
        `${km / 100} × ${perHundred} = ${litres} л.`],
      { type: 'ratio', a: perHundred, b: 100, c: km });
  }
  // Два етапа път с различно темпо.
  const s1 = pick(random, [40, 60, 80]);
  const h1 = int(random, 1, 3);
  const s2 = pick(random, [30, 50, 70]);
  const h2 = int(random, 1, 3);
  return numberTask(`Пътуваш ${h1} ч с ${s1} км/ч, после ${h2} ч с ${s2} км/ч. Колко километра си минал общо?`, s1 * h1 + s2 * h2,
    ['Сметни двата участъка отделно.',
      `${s1} × ${h1} = ${s1 * h1} км и ${s2} × ${h2} = ${s2 * h2} км.`,
      `${s1 * h1} + ${s2 * h2} = ${s1 * h1 + s2 * h2} км.`],
    { type: 'two-legs', s1, h1, s2, h2 });
}

export const ADVANCED_GENERATORS = Object.freeze({
  fractions,
  decimals,
  percent,
  negatives,
  powers,
  roots,
  ratio,
  'word-money': wordMoney,
  'word-travel': wordTravel,
});
