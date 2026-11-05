// Генератори за групата „Логика и загадки“: истинностни таблици, рицари и лъжци,
// претегляне на монети и логически мрежи. Чисти функции: random се подава отвън.
//
// Загадките се генерират с пълно изчерпване и се пускат само ако имат ТОЧНО едно
// решение. Затова тук живеят и двата решателя — те са част от условието на задачата,
// а не от нейната проверка: тестът пише своите наново.
import { choiceTask, int, numberTask, pick } from './task.js';

const YES_NO = ['Да', 'Не'];

// --- Истинностни таблици ---

// Вярно или невярно твърдение за числа, според поръчаното.
function claim(random, truth) {
  const small = int(random, 1, 30);
  const big = small + int(random, 1, 20);
  return pick(random, truth
    ? [`${big} > ${small}`, `${small} < ${big}`, `${small} = ${small}`]
    : [`${small} > ${big}`, `${big} < ${small}`, `${small} = ${big}`]);
}

const bool = (random) => random() < 0.5;
const word = (value) => (value ? 'Да' : 'Не');

// Колко от четирите реда на истинностната таблица са верни.
const ROW_OPS = {
  and: { text: 'P И Q', rows: 1 },
  or: { text: 'P ИЛИ Q', rows: 3 },
  implies: { text: 'ако P, то Q', rows: 3 },
  xor: { text: 'или P, или Q, но не и двете', rows: 2 },
};

const COMPOUNDS = [
  { text: '(P И Q) ИЛИ НЕ R', holds: (p, q, r) => (p && q) || !r },
  { text: 'НЕ (P ИЛИ Q)', holds: (p, q) => !(p || q) },
  { text: 'ако P, то (Q И R)', holds: (p, q, r) => !p || (q && r) },
];

function truthTables(level, random) {
  if (level <= 4) {
    const p = bool(random);
    const q = bool(random);
    const first = claim(random, p);
    const second = claim(random, q);
    if (level === 1) {
      return choiceTask(`Вярно ли е: ${first} И ${second}?`, word(p && q), YES_NO,
        ['При „И“ трябват и двете части.',
          `Първата част е ${word(p).toLowerCase()}, втората е ${word(q).toLowerCase()}.`,
          `${p && q ? 'И двете са верни' : 'Поне едната не е вярна'}, значи отговорът е „${word(p && q)}“.`],
        { type: 'log-and', p, q });
    }
    if (level === 2) {
      return choiceTask(`Вярно ли е: ${first} ИЛИ ${second}?`, word(p || q), YES_NO,
        ['При „ИЛИ“ стига поне едната част.',
          `Първата част е ${word(p).toLowerCase()}, втората е ${word(q).toLowerCase()}.`,
          `${p || q ? 'Поне едната е вярна' : 'Нито една не е вярна'}, значи отговорът е „${word(p || q)}“.`],
        { type: 'log-or', p, q });
    }
    if (level === 3) {
      return choiceTask(`Вярно ли е: НЕ (${first})?`, word(!p), YES_NO,
        ['„НЕ“ обръща стойността.',
          `Вътре в скобата е ${word(p).toLowerCase()}.`,
          `Обърнато, отговорът е „${word(!p)}“.`],
        { type: 'log-not', p });
    }
    return choiceTask(`Вярно ли е: ако ${first}, то ${second}?`, word(!p || q), YES_NO,
      ['„Ако… то“ е невярно само когато началото е вярно, а краят не е.',
        `Началото е ${word(p).toLowerCase()}, краят е ${word(q).toLowerCase()}.`,
        p && !q
          ? `Вярно начало и невярен край, значи отговорът е „${word(!p || q)}“.`
          : `Няма случай на вярно начало с невярен край, значи отговорът е „${word(!p || q)}“.`],
      { type: 'log-implies', p, q });
  }
  if (level === 5) {
    const op = pick(random, Object.keys(ROW_OPS));
    const { text, rows } = ROW_OPS[op];
    return numberTask(`Истинностната таблица има 4 реда: двете стойности на P по двете на Q. В колко реда е вярно „${text}“?`, rows,
      ['Пробвай и четирите случая: вярно-вярно, вярно-невярно, невярно-вярно, невярно-невярно.',
        'Отбелязвай само редовете, в които цялото е вярно.',
        `Вярно е в ${rows} ${rows === 1 ? 'ред' : 'реда'}.`],
      { type: 'log-rows', op });
  }
  const p = bool(random);
  const q = bool(random);
  const r = bool(random);
  const form = int(random, 0, COMPOUNDS.length - 1);
  const compound = COMPOUNDS[form];
  const value = compound.holds(p, q, r);
  return choiceTask(
    `P е „${claim(random, p)}“, Q е „${claim(random, q)}“, R е „${claim(random, r)}“. Вярно ли е ${compound.text}?`,
    word(value), YES_NO,
    ['Пресметни първо малките части, после цялото.',
      `P е ${word(p).toLowerCase()}, Q е ${word(q).toLowerCase()}, R е ${word(r).toLowerCase()}.`,
      `Сглобено по реда на скобите, отговорът е „${word(value)}“.`],
    { type: 'log-compound', p, q, r, form },
  );
}

// --- Рицари и лъжци ---

const ISLANDERS = ['А', 'Б', 'В'];

// Вярно ли е изказването при дадено разпределение. assign[i] = true значи рицар.
function holds(stmt, assign) {
  switch (stmt.k) {
    case 'knight': return assign[stmt.who];
    case 'liar': return !assign[stmt.who];
    case 'same': return assign[stmt.a] === assign[stmt.b];
    case 'diff': return assign[stmt.a] !== assign[stmt.b];
    case 'allLiars': return assign.every((v) => !v);
    case 'someLiar': return assign.some((v) => !v);
    default: return assign.filter(Boolean).length === stmt.n;
  }
}

const sayText = (stmt) => {
  switch (stmt.k) {
    case 'knight': return `${ISLANDERS[stmt.who]} е рицар`;
    case 'liar': return `${ISLANDERS[stmt.who]} е лъжец`;
    case 'same': return `${ISLANDERS[stmt.a]} и ${ISLANDERS[stmt.b]} са от един и същи вид`;
    case 'diff': return `${ISLANDERS[stmt.a]} и ${ISLANDERS[stmt.b]} са от различен вид`;
    case 'allLiars': return 'всички ние сме лъжци';
    case 'someLiar': return 'поне един от нас е лъжец';
    case 'countKnights': return stmt.n === 0
      ? 'никой от нас не е рицар'
      : `точно ${stmt.n === 1 ? 'един' : stmt.n} от нас ${stmt.n === 1 ? 'е рицар' : 'са рицари'}`;
    default: return '';
  }
};

// Всички изказвания, които един жител може да направи. За себе си не твърди нищо:
// „аз съм лъжец“ е парадокс, а не загадка.
function statementsFor(count, speaker) {
  const out = [{ k: 'allLiars' }, { k: 'someLiar' }];
  for (let i = 0; i < count; i += 1) {
    if (i !== speaker) { out.push({ k: 'knight', who: i }); out.push({ k: 'liar', who: i }); }
  }
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) { out.push({ k: 'same', a, b }); out.push({ k: 'diff', a, b }); }
  }
  for (let n = 0; n <= count; n += 1) out.push({ k: 'countKnights', n });
  return out;
}

// Единственото непротиворечиво разпределение или null, ако са нула или повече от едно.
function onlySolution(count, says) {
  let found = null;
  for (let mask = 0; mask < (1 << count); mask += 1) {
    const assign = Array.from({ length: count }, (_, i) => Boolean(mask & (1 << i)));
    if (!says.every(({ who, stmt }) => assign[who] === holds(stmt, assign))) continue;
    if (found) return null;
    found = assign;
  }
  return found;
}

// Готовите загадки се броят веднъж и се пазят: изчерпването е същото при всяко пускане.
const puzzleCache = new Map();
function knightPuzzles(count, speakers) {
  const key = `${count}-${speakers}`;
  if (puzzleCache.has(key)) return puzzleCache.get(key);
  const pools = Array.from({ length: speakers }, (_, i) => statementsFor(count, i));
  const out = [];
  const build = (index, says) => {
    if (index === speakers) {
      const solution = onlySolution(count, says);
      if (solution) out.push({ says: says.map((s) => ({ ...s })), solution });
      return;
    }
    for (const stmt of pools[index]) build(index + 1, [...says, { who: index, stmt }]);
  };
  build(0, []);
  puzzleCache.set(key, out);
  return out;
}

const WHO_OPTIONS = ['само А', 'само Б', 'и двамата', 'никой'];
const twoAnswer = (solution) => {
  if (solution[0] && solution[1]) return 'и двамата';
  if (solution[0]) return 'само А';
  if (solution[1]) return 'само Б';
  return 'никой';
};
const roleList = (solution) => solution
  .map((isKnight, i) => `${ISLANDERS[i]} е ${isKnight ? 'рицар' : 'лъжец'}`).join(', ');

function knights(level, random) {
  const count = level <= 3 ? 2 : 3;
  const speakers = level === 1 || level === 2 ? 1 : level === 6 ? 3 : 2;
  const pool = knightPuzzles(count, speakers);
  const { says, solution } = pick(random, pool);
  const quoted = says.map(({ who, stmt }) => `${ISLANDERS[who]} казва: „${sayText(stmt)}.“`).join(' ');
  const intro = 'На острова рицарите винаги казват истината, а лъжците винаги лъжат.';
  if (count === 2) {
    const answer = twoAnswer(solution);
    return choiceTask(`${intro} ${quoted} Кой е рицар?`, answer, WHO_OPTIONS,
      ['Пробвай едната възможност и виж дали се връзва.',
        'Ако някой е рицар, казаното от него е вярно; ако е лъжец — невярно.',
        `Единственото непротиворечиво разпределение е: ${roleList(solution)}. Значи отговорът е „${answer}“.`],
      { type: 'knights', count, says, ask: null });
  }
  const ask = int(random, 0, count - 1);
  const answer = solution[ask] ? 'Да' : 'Не';
  return choiceTask(`${intro} ${quoted} Рицар ли е ${ISLANDERS[ask]}?`, answer, YES_NO,
    ['Възможностите са само осем: мини през тях.',
      'Всяко изказване трябва да пасва на вида на този, който го казва.',
      `Единственото непротиворечиво разпределение е: ${roleList(solution)}. Значи отговорът е „${answer}“.`],
    { type: 'knights', count, says, ask });
}

// --- Претегляне на монети ---

// Везната има три изхода, затова едно претегляне дели на три.
function minWeighings(n) {
  let weighings = 0;
  let covered = 1;
  while (covered < n) { covered *= 3; weighings += 1; }
  return weighings;
}

function coins(level, random) {
  if (level === 1 || level === 6) {
    const k = level === 1 ? int(random, 1, 2) : int(random, 3, 4);
    const most = 3 ** k;
    return numberTask(`Везна с две блюда и една по-лека монета. С ${k} претегляния колко монети най-много може да се проверят?`, most,
      ['Всяко претегляне има три изхода: ляво, дясно и равновесие.',
        `Значи всяко претегляне дели на 3 части, а претеглянията са ${k}.`,
        `3 на степен ${k} = ${most} монети.`],
      { type: 'coins-max', k });
  }
  if (level === 2 || level === 4) {
    const n = level === 2 ? int(random, 2, 9) : int(random, 10, 81);
    const need = minWeighings(n);
    return numberTask(`${n} монети, една е по-лека от другите. Най-малко колко претегляния стигат, за да се намери със сигурност?`, need,
      ['С k претегляния се проверяват най-много 3 на степен k монети.',
        `3 на степен ${need - 1} = ${3 ** (need - 1)} не стига, а 3 на степен ${need} = ${3 ** need} стига.`,
        `Нужни са ${need} претегляния.`],
      { type: 'coins-min', n });
  }
  if (level === 3) {
    const each = int(random, 2, 6);
    const n = 2 * each + int(random, 1, 6);
    return numberTask(`${n} монети, една е по-лека. Слагаш ${each} срещу ${each} и везната е равна. Колко монети остават за проверка?`, n - 2 * each,
      ['Равновесието значи, че измерените са еднакви, тоест истински.',
        `На везната са ${each} + ${each} = ${2 * each} истински монети.`,
        `${n} - ${2 * each} = ${n - 2 * each} монети остават.`],
      { type: 'coins-left', n, each });
  }
  const each = int(random, 3, 6);
  const extra = int(random, 1, 5);
  const n = 2 * each + extra;
  const up = pick(random, ['left', 'right', 'none']);
  const options = ['в лявата група', 'в дясната група', 'сред неизмерените'];
  const answer = up === 'none' ? options[2] : (up === 'left' ? options[0] : options[1]);
  const what = up === 'none' ? 'везната остава равна' : `${up === 'left' ? 'лявото' : 'дясното'} блюдо се вдига нагоре`;
  return choiceTask(`${n} монети, една е по-лека. Слагаш ${each} срещу ${each} и ${what}. Къде е по-леката монета?`, answer, options,
    ['По-лекото блюдо се вдига нагоре.',
      up === 'none'
        ? 'Равните блюда значат, че и двете групи са само от истински монети.'
        : 'Вдигнатото блюдо съдържа по-леката монета.',
      `Значи отговорът е „${answer}“.`],
    { type: 'coins-side', up });
}

// --- Логически мрежи ---

const GRID_PEOPLE = ['Ана', 'Боян', 'Вера', 'Генади'];
const GRID_HOUSES = ['синята', 'зелената', 'червената', 'жълтата'];

function permutations(n) {
  if (n === 1) return [[0]];
  const out = [];
  for (const rest of permutations(n - 1)) {
    for (let at = 0; at <= rest.length; at += 1) {
      const copy = [...rest.slice(0, at), n - 1, ...rest.slice(at)];
      out.push(copy);
    }
  }
  return out;
}

const clueHolds = (clue, order) => {
  if (clue.kind === 'is') return order[clue.person] === clue.item;
  if (clue.kind === 'not') return order[clue.person] !== clue.item;
  return clue.items.includes(order[clue.person]);
};

const solveGrid = (n, clues) => permutations(n).filter((order) => clues.every((c) => clueHolds(c, order)));

const shuffleWith = (random, list) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const clueText = (clue, people, items) => {
  if (clue.kind === 'is') return `${people[clue.person]} живее в ${items[clue.item]} къща`;
  if (clue.kind === 'not') return `${people[clue.person]} не живее в ${items[clue.item]} къща`;
  return `${people[clue.person]} живее в ${items[clue.items[0]]} или в ${items[clue.items[1]]} къща`;
};

function gridPuzzles(level, random) {
  const n = level <= 3 ? 3 : 4;
  const people = GRID_PEOPLE.slice(0, n);
  const items = GRID_HOUSES.slice(0, n);
  const secret = shuffleWith(random, [...Array(n).keys()]);
  const allowDirect = level <= 2;

  // Всички верни следи за тази подредба; от тях се събира най-малкият набор,
  // който оставя точно едно решение.
  const candidates = [];
  for (let person = 0; person < n; person += 1) {
    for (let item = 0; item < n; item += 1) {
      if (secret[person] === item) { if (allowDirect) candidates.push({ kind: 'is', person, item }); }
      else candidates.push({ kind: 'not', person, item });
    }
    for (let other = 0; other < n; other += 1) {
      if (other === secret[person]) continue;
      const pair = [secret[person], other].sort((a, b) => a - b);
      candidates.push({ kind: 'oneof', person, items: pair });
    }
  }

  const clues = [];
  for (const clue of shuffleWith(random, candidates)) {
    if (solveGrid(n, clues).length === 1) break;
    clues.push(clue);
  }
  // Излишните следи си отиват: загадката трябва да иска мислене, не четене.
  for (let i = clues.length - 1; i >= 0; i -= 1) {
    const without = clues.filter((_, at) => at !== i);
    if (solveGrid(n, without).length === 1) clues.splice(i, 1);
  }

  const askPerson = random() < 0.5;
  const index = int(random, 0, n - 1);
  const list = clues.map((c) => clueText(c, people, items)).join('. ');
  if (askPerson) {
    const answer = items[secret[index]];
    return choiceTask(`${people.join(', ')} живеят в различни къщи. ${list}. В коя къща живее ${people[index]}?`,
      answer, items,
      ['Зачерквай невъзможното, вместо да търсиш веднага верния отговор.',
        'Когато за някого остане една възможност, тя заема и неговия ред, и своята колона.',
        `Единствената подредба оставя ${people[index]} в ${answer} къща.`],
      { type: 'grid', n, clues, ask: { kind: 'person', index } });
  }
  const who = secret.indexOf(index);
  const answer = people[who];
  return choiceTask(`${people.join(', ')} живеят в различни къщи. ${list}. Кой живее в ${items[index]} къща?`,
    answer, people,
    ['Зачерквай невъзможното, вместо да търсиш веднага верния отговор.',
      'Когато за някого остане една възможност, тя заема и неговия ред, и своята колона.',
      `Единствената подредба слага ${answer} в ${items[index]} къща.`],
    { type: 'grid', n, clues, ask: { kind: 'item', index } });
}

export const PUZZLE_GENERATORS = Object.freeze({
  'truth-tables': truthTables,
  knights,
  coins,
  'grid-puzzles': gridPuzzles,
});
