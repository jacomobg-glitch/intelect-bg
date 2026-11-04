// Логически редици и матрици. Чисти функции. Всяка задача минава проверка за единствен верен отговор,
// иначе се генерира наново.
const int = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (random, list) => list[Math.floor(random() * list.length)];
const MIN_TERMS = 4;

const shuffle = (list, random) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Каталог с правила за редици. next връща следващия член или null, ако правилото не пасва.
export const SEQUENCE_RULES = {
  arithmetic(t) {
    const d = t[1] - t[0];
    return t.every((x, i) => i === 0 || x - t[i - 1] === d) ? t[t.length - 1] + d : null;
  },
  geometric(t) {
    if (t.some((x) => x === 0)) return null;
    const r = t[1] / t[0];
    if (!Number.isInteger(r) || r === 1) return null;
    return t.every((x, i) => i === 0 || x === t[i - 1] * r) ? t[t.length - 1] * r : null;
  },
  // Разликите растат с постоянна стъпка: +2, +3, +4...
  secondOrder(t) {
    const d = t.slice(1).map((x, i) => x - t[i]);
    const dd = d[1] - d[0];
    return d.every((x, i) => i === 0 || x - d[i - 1] === dd) ? t[t.length - 1] + d[d.length - 1] + dd : null;
  },
  // Всеки член е сборът от предишните два.
  fibonacci(t) {
    return t.every((x, i) => i < 2 || x === t[i - 1] + t[i - 2]) ? t[t.length - 1] + t[t.length - 2] : null;
  },
  // Две редуващи се стъпки: +a, +b, +a, +b...
  alternating(t) {
    const d = t.slice(1).map((x, i) => x - t[i]);
    const fits = d.every((x, i) => i < 2 || x === d[i - 2]);
    return fits ? t[t.length - 1] + d[d.length - 2] : null;
  },
};

// Всички различни продължения, които каталогът допуска за тази редица.
export function possibleNext(terms) {
  if (terms.length < MIN_TERMS) return new Set();
  const out = new Set();
  for (const rule of Object.values(SEQUENCE_RULES)) {
    const next = rule(terms);
    if (next !== null) out.add(next);
  }
  return out;
}

function buildTerms(level, random) {
  const count = 5;
  const family = pick(random, [
    ['arithmetic'],
    ['arithmetic'],
    ['arithmetic', 'geometric'],
    ['geometric', 'alternating'],
    ['alternating', 'secondOrder', 'fibonacci'],
    ['secondOrder', 'fibonacci', 'alternating'],
  ][level - 1]);
  const terms = [];
  if (family === 'arithmetic') {
    const step = level === 1 ? int(random, 1, 5) : int(random, 2, 12) * (random() < 0.35 ? -1 : 1);
    const start = step < 0 ? int(random, 40, 90) : int(random, 1, 20);
    for (let i = 0; i < count; i += 1) terms.push(start + i * step);
  } else if (family === 'geometric') {
    const r = int(random, 2, 3);
    const start = int(random, 1, 5);
    for (let i = 0; i < count; i += 1) terms.push(start * r ** i);
  } else if (family === 'alternating') {
    const a = int(random, 1, 9);
    let b = int(random, 1, 9);
    if (a === b) b += 3;
    terms.push(int(random, 1, 15));
    for (let i = 1; i < count; i += 1) terms.push(terms[i - 1] + (i % 2 ? a : b));
  } else if (family === 'secondOrder') {
    let d = int(random, 1, 4);
    const dd = int(random, 1, 3);
    terms.push(int(random, 1, 10));
    for (let i = 1; i < count; i += 1) { terms.push(terms[i - 1] + d); d += dd; }
  } else {
    terms.push(int(random, 1, 6), int(random, 2, 8));
    for (let i = 2; i < count; i += 1) terms.push(terms[i - 1] + terms[i - 2]);
  }
  return { terms, family };
}

export function makeSequenceTask(level, random) {
  const clamped = Math.min(6, Math.max(1, level));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { terms, family } = buildTerms(clamped, random);
    const possible = possibleNext(terms);
    if (possible.size !== 1) continue;
    const answer = [...possible][0];
    if (answer < 0) continue;
    const gap = Math.max(1, Math.abs(terms[4] - terms[3]));
    const candidates = new Set();
    for (const c of [answer + gap, answer - gap, answer + 1, answer - 1, answer + 2, answer + gap + 1, answer * 2, terms[4]]) {
      if (c !== answer && c >= 0) candidates.add(c);
    }
    // Грешен отговор не бива да продължава редицата по никое правило от каталога.
    const distractors = shuffle([...candidates].filter((c) => !isValidExtension(terms, c)), random).slice(0, 3);
    if (distractors.length < 3) continue;
    return { kind: 'sequence', terms, family, answer: String(answer), options: shuffle([answer, ...distractors], random).map(String) };
  }
  throw new Error('Неуспешна редица');
}

export const isValidExtension = (terms, value) => possibleNext(terms).has(value);

// Матрици 3×3. Атрибути: форма, брой, запълване. Всеки следва свое правило по редовете.
export const ATTRIBUTES = {
  shape: ['circle', 'square', 'triangle'],
  count: [1, 2, 3],
  fill: ['solid', 'outline', 'dot'],
};
const ATTR_NAMES = Object.keys(ATTRIBUTES);

function buildAttribute(name, varies, random) {
  const values = shuffle(ATTRIBUTES[name], random);
  if (!varies) return { rule: 'same', grid: Array.from({ length: 3 }, () => [values[0], values[0], values[0]]) };
  if (random() < 0.5) return { rule: 'rowSame', grid: values.map((v) => [v, v, v]) };
  // Всеки ред съдържа и трите стойности, с изместване (латински квадрат).
  return {
    rule: 'distribute',
    grid: [0, 1, 2].map((r) => [0, 1, 2].map((c) => values[(r + c) % 3])),
  };
}

const sameCell = (a, b) => ATTR_NAMES.every((n) => a[n] === b[n]);

// Едно попълване е валидно, ако за всеки атрибут всеки ред е еднакъв или всеки ред съдържа трите стойности.
export function isValidMatrix(cells) {
  return ATTR_NAMES.every((name) => {
    const rows = [0, 1, 2].map((r) => cells.slice(r * 3, r * 3 + 3).map((c) => c[name]));
    const allSame = rows.every((row) => new Set(row).size === 1);
    const allDistinct = rows.every((row) => new Set(row).size === 3);
    return allSame || allDistinct;
  });
}

export function makeMatrixTask(level, random) {
  const clamped = Math.min(6, Math.max(1, level));
  const varying = clamped <= 2 ? 1 : clamped <= 4 ? 2 : 3;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const active = shuffle(ATTR_NAMES, random).slice(0, varying);
    const attrs = Object.fromEntries(ATTR_NAMES.map((n) => [n, buildAttribute(n, active.includes(n), random)]));
    const cells = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        cells.push(Object.fromEntries(ATTR_NAMES.map((n) => [n, attrs[n].grid[r][c]])));
      }
    }
    const answer = cells[8];
    // Грешните опции се различават от верния отговор и не правят матрицата валидна.
    const seen = [answer];
    for (let tries = 0; tries < 80 && seen.length < 4; tries += 1) {
      const name = pick(random, tries < 30 ? active : ATTR_NAMES);
      const other = pick(random, ATTRIBUTES[name].filter((v) => v !== answer[name]));
      const candidate = { ...answer, [name]: other };
      if (!seen.some((s) => sameCell(s, candidate)) && !isValidMatrix([...cells.slice(0, 8), candidate])) seen.push(candidate);
    }
    if (seen.length < 4 || !isValidMatrix(cells)) continue;
    const options = shuffle(seen, random);
    return {
      kind: 'matrix',
      cells: cells.slice(0, 8),
      options,
      answer: String(options.findIndex((o) => sameCell(o, answer))),
    };
  }
  throw new Error('Неуспешна матрица');
}

// До трудност 2 само редици, после се редуват.
export function makeLogicTask(level, random) {
  if (level >= 2 && random() < 0.5) return makeMatrixTask(level, random);
  return makeSequenceTask(level, random);
}
