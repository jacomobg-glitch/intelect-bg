// Генератори за игрите от Етап 6а. Чисти функции без DOM: random се подава отвън,
// затова всяка задача се проверява директно в тестовете.
// Всеки генератор гарантира ЕДИНСТВЕН верен отговор и различими опции.

const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
export const pickOne = (random, list) => list[Math.floor(random() * list.length)];

export function shuffle(list, random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- Разменени неща (Памет) ---

// Символите се различават по форма, не по цвят: играта работи и при цветна слепота.
export const TOKENS = ['circle', 'square', 'triangle', 'star', 'diamond', 'cross', 'ring', 'bolt', 'leaf', 'drop'];

export const swapParams = (level) => ({
  size: level <= 2 ? 3 : level <= 5 ? 4 : 5,          // страна на мрежата
  items: Math.min(TOKENS.length, 2 + level),          // колко символа са поставени
  studyMs: Math.max(1400, 4200 - 450 * (level - 1)),  // време за запомняне
});

// Поставя символите, после разменя точно два от тях. Разменените НИКОГА не са еднакви,
// иначе на екрана не би се променило нищо и задачата нямаше да има верен отговор.
export function makeSwapTask(level, random) {
  const { size, items, studyMs } = swapParams(level);
  const cells = size * size;
  const places = shuffle(Array.from({ length: cells }, (_, i) => i), random).slice(0, items);
  const symbols = shuffle(TOKENS, random).slice(0, items);
  const before = places.map((pos, i) => ({ pos, token: symbols[i] }));
  const [i, j] = shuffle(Array.from({ length: items }, (_, k) => k), random).slice(0, 2);
  const after = before.map((item) => ({ ...item }));
  after[i].token = before[j].token;
  after[j].token = before[i].token;
  return {
    size,
    studyMs,
    before,
    after,
    // Верни са и двете разменени места: „кое се е преместило“ има два еднакво верни отговора.
    moved: [before[i].pos, before[j].pos].sort((a, b) => a - b),
  };
}

// --- Различното (Внимание) ---

// Начините, по които една фигура се различава от останалите. Нито един не е цвят.
export const ODD_KINDS = ['rotation', 'size', 'fill', 'shift'];

export const oddParams = (level) => ({
  size: level <= 1 ? 3 : level <= 3 ? 4 : level <= 5 ? 5 : 6,
  // Колкото по-висока трудност, толкова по-малка разлика.
  strength: Math.max(0.18, 1 - 0.14 * (level - 1)),
});

export function makeOddTask(level, random) {
  const { size, strength } = oddParams(level);
  const count = size * size;
  const kind = pickOne(random, ODD_KINDS);
  const base = { shape: pickOne(random, ['circle', 'square', 'triangle']), rotation: 0, scale: 1, fill: 'solid', shift: 0 };
  const odd = { ...base };
  if (kind === 'rotation') odd.rotation = Math.round(8 + 37 * strength);
  else if (kind === 'size') odd.scale = 1 - 0.1 - 0.22 * strength;
  else if (kind === 'fill') odd.fill = 'outline';
  else odd.shift = Math.round(4 + 10 * strength);
  const oddIndex = int(random, 0, count - 1);
  return { size, count, kind, base, odd, oddIndex, strength };
}

// Независима проверка: различната клетка е точно една.
export const oddIsUnique = (task) => {
  const key = (c) => `${c.shape}/${c.rotation}/${c.scale.toFixed(3)}/${c.fill}/${c.shift}`;
  const cells = Array.from({ length: task.count }, (_, i) => (i === task.oddIndex ? task.odd : task.base));
  const odd = cells.filter((c) => key(c) !== key(task.base));
  return odd.length === 1 && key(task.odd) !== key(task.base);
};

// --- Цветни последователности (Памет) ---

// Четири полета, всяко със свой цвят И свой символ: вариантът с форми не ползва цветовете.
export const PADS = [
  { id: 'red', symbol: '●', label: 'Кръг' },
  { id: 'blue', symbol: '▲', label: 'Триъгълник' },
  { id: 'green', symbol: '■', label: 'Квадрат' },
  { id: 'yellow', symbol: '◆', label: 'Ромб' },
];

export const simonParams = (level) => ({
  length: 2 + level,                                  // колко стъпки има редицата
  showMs: Math.max(320, 720 - 55 * (level - 1)),      // колко свети едно поле
  gapMs: Math.max(110, 260 - 22 * (level - 1)),
});

// Редица от индекси на полета. Едно и също поле не се повтаря три пъти подред:
// такава редица се помни по друг начин и мери друго.
export function makeSimonSequence(length, random, pads = PADS.length) {
  const out = [];
  for (let i = 0; i < length; i += 1) {
    let next = Math.floor(random() * pads);
    if (i >= 2 && out[i - 1] === out[i - 2] && next === out[i - 1]) next = (next + 1) % pads;
    out.push(next);
  }
  return out;
}

// --- Сортиране по сменящо се правило (Гъвкавост) ---

// Три признака, всеки с три стойности. Цветът има и заместник с форма на запълването.
export const SORT_RULES = ['shape', 'count', 'tone'];
export const SORT_VALUES = {
  shape: ['circle', 'square', 'triangle'],
  count: [1, 2, 3],
  tone: ['red', 'blue', 'green'],
};
export const TONE_FILLS = { red: 'solid', blue: 'outline', green: 'dot' };
export const RULE_LABELS = { shape: 'формата', count: 'броя', tone: 'цвета' };

export const sortParams = (level) => ({
  // Колко верни подред сменят правилото. По-високата трудност сменя по-често.
  runToSwitch: Math.max(3, 8 - level),
  limitMs: Math.max(1800, 4000 - 300 * (level - 1)),
});

// Трите коша се различават по ВСИЧКИ признаци, затова всяко правило дава точно един верен кош.
export function makeSortBaskets(random) {
  const order = Object.fromEntries(SORT_RULES.map((rule) => [rule, shuffle(SORT_VALUES[rule], random)]));
  return [0, 1, 2].map((i) => Object.fromEntries(SORT_RULES.map((rule) => [rule, order[rule][i]])));
}

// Карта, която пасва на различен кош според всяко от трите правила: само така смяната
// на правилото се вижда. Иначе играчът би бил верен и по старото, и по новото правило.
export function makeSortCard(baskets, random) {
  const targets = shuffle([0, 1, 2], random);
  return Object.fromEntries(SORT_RULES.map((rule, i) => [rule, baskets[targets[i]][rule]]));
}

// Кой кош е верен при даденото правило. Връща -1, ако няма точно един (не бива да се случва).
export function basketFor(baskets, card, rule) {
  const hits = baskets.map((b, i) => (b[rule] === card[rule] ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}

// Правилото се сменя тихо на друго: това е целият смисъл на играта.
export const nextSortRule = (current, random) => pickOne(random, SORT_RULES.filter((r) => r !== current));

// --- Огледални и завъртени фигури (Логика) ---

export const mirrorParams = (level) => ({
  grid: level <= 3 ? 3 : 4,
  cells: Math.min(level <= 3 ? 6 : 9, 3 + level),
});

const normalize = (cells) => {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const keyOf = (cells) => normalize(cells).map(([x, y]) => `${x},${y}`).join(' ');

export const rotate90 = (cells) => cells.map(([x, y]) => [y, -x]);
export const mirrorX = (cells) => cells.map(([x, y]) => [-x, y]);

// Четирите завъртания на фигурата.
export function rotations(cells) {
  const out = [];
  let current = cells;
  for (let i = 0; i < 4; i += 1) {
    out.push(current);
    current = rotate90(current);
  }
  return out;
}

export const rotationKeys = (cells) => new Set(rotations(cells).map(keyOf));
// Хирална фигура: огледалният ѝ образ НЕ е нейно завъртане. Само такава става за задачата.
export const isChiral = (cells) => !rotationKeys(cells).has(keyOf(mirrorX(cells)));

// Свързана фигура: всички клетки се достигат една от друга. Разпаднала се фигура се чете трудно.
function isConnected(cells) {
  const keys = new Set(cells.map(([x, y]) => `${x},${y}`));
  const seen = new Set([`${cells[0][0]},${cells[0][1]}`]);
  const queue = [cells[0]];
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (keys.has(k) && !seen.has(k)) {
        seen.add(k);
        queue.push([x + dx, y + dy]);
      }
    }
  }
  return seen.size === cells.length;
}

function randomShape(grid, count, random) {
  const cells = [[int(random, 0, grid - 1), int(random, 0, grid - 1)]];
  let guard = 0;
  while (cells.length < count && guard < 200) {
    guard += 1;
    const [x, y] = pickOne(random, cells);
    const [dx, dy] = pickOne(random, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) continue;
    if (cells.some(([cx, cy]) => cx === nx && cy === ny)) continue;
    cells.push([nx, ny]);
  }
  return cells;
}

// Задача: една опция е завъртяна фигура, останалите три са огледални образи.
// Опциите са различими помежду си, а верният отговор е точно един.
export function makeMirrorTask(level, random) {
  const { grid, cells: count } = mirrorParams(level);
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const shape = randomShape(grid, count, random);
    if (shape.length < count || !isConnected(shape) || !isChiral(shape)) continue;
    const rots = rotations(shape);
    const mirrors = rotations(mirrorX(shape));
    // Завъртяната опция не бива да е самата фигура: иначе отговорът се познава по вида.
    const sameKey = keyOf(shape);
    const rightPool = rots.filter((r) => keyOf(r) !== sameKey);
    if (!rightPool.length) continue;
    const right = pickOne(random, rightPool);
    const wrongKeys = new Set();
    const wrong = [];
    for (const m of shuffle(mirrors, random)) {
      const k = keyOf(m);
      if (wrongKeys.has(k)) continue;
      wrongKeys.add(k);
      wrong.push(m);
      if (wrong.length === 3) break;
    }
    if (wrong.length < 3) continue;
    const options = shuffle([right, ...wrong], random);
    return {
      grid,
      shape: normalize(shape),
      options: options.map(normalize),
      answer: String(options.findIndex((o) => o === right)),
    };
  }
  throw new Error('Неуспешна фигура');
}

// Независима проверка: опцията е завъртяне на фигурата (а не огледален образ).
export const isRotationOf = (shape, candidate) => rotationKeys(shape).has(keyOf(candidate));

// --- Бърза сметка под таймер (Скорост, Математика) ---

export const quickParams = (level) => ({
  limitMs: Math.max(2200, 6000 - 500 * (level - 1)),
  ops: level <= 1 ? ['+'] : level <= 2 ? ['+', '-'] : level <= 4 ? ['+', '-', '×'] : ['+', '-', '×', '÷'],
  max: [10, 20, 30, 50, 99, 99][Math.min(5, level - 1)],
});

// Задача с четири различими опции, от които точно една е вярна.
export function makeQuickTask(level, random) {
  const { limitMs, ops, max } = quickParams(level);
  const op = pickOne(random, ops);
  let a;
  let b;
  let answer;
  if (op === '+') {
    a = int(random, 2, max);
    b = int(random, 2, max);
    answer = a + b;
  } else if (op === '-') {
    a = int(random, 3, max);
    b = int(random, 2, a - 1);
    answer = a - b;
  } else if (op === '×') {
    a = int(random, 2, level <= 4 ? 9 : 12);
    b = int(random, 2, level <= 4 ? 9 : 12);
    answer = a * b;
  } else {
    b = int(random, 2, 9);
    answer = int(random, 2, 9);
    a = b * answer;
  }
  // Разсейващите отговори са близо до верния, но различни един от друг и неотрицателни.
  const candidates = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10, answer * 2];
  const wrong = [];
  const seen = new Set([answer]);
  for (const c of shuffle(candidates, random)) {
    if (c < 0 || seen.has(c)) continue;
    seen.add(c);
    wrong.push(c);
    if (wrong.length === 3) break;
  }
  const options = shuffle([answer, ...wrong], random).map(String);
  return { prompt: `${a} ${op} ${b}`, a, b, op, answer: String(answer), options, limitMs };
}
