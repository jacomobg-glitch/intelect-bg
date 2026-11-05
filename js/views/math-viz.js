// Интерактивни SVG визуализации. Всяка е функция (host) => void и сама си пази състоянието.
import { h, mount, svgEl as s } from '../core/dom.js';

const svgRoot = (w, height, label) => s('svg', { viewBox: `0 0 ${w} ${height}`, class: 'viz-svg', role: 'img', 'aria-label': label });

function stepper(label, get, set, min, max, step = 1) {
  const value = h('output', { class: 'stepper-value' }, String(get()));
  const change = (delta) => {
    set(Math.min(max, Math.max(min, get() + delta)));
  };
  return h('div', { class: 'stepper' },
    h('span', { class: 'stepper-label' }, label),
    h('button', { class: 'stepper-btn', type: 'button', 'aria-label': `${label}: по-малко`, onclick: () => change(-step) }, '−'),
    value,
    h('button', { class: 'stepper-btn', type: 'button', 'aria-label': `${label}: повече`, onclick: () => change(step) }, '+'));
}

// Рамка: контроли, рисунка и изречение, което казва същото с думи.
function frame(host, build) {
  const render = () => {
    const { controls, drawing, readout } = build(render);
    mount(host, h('div', { class: 'viz' },
      drawing,
      h('p', { class: 'viz-readout', 'aria-live': 'polite' }, readout),
      h('div', { class: 'viz-controls' }, controls)));
  };
  render();
}

// Числова ос с дъги. hops: [{ from, to }]
function numberLine(max, hops, marks = []) {
  const W = 340;
  const Y = 74;
  const x = (n) => 14 + (n / max) * (W - 28);
  const svg = svgRoot(W, 104, 'Числова ос');
  svg.append(s('line', { x1: 8, y1: Y, x2: W - 8, y2: Y, class: 'viz-axis' }));
  const tickEvery = max <= 30 ? 1 : 10;
  const labelEvery = max <= 30 ? 5 : 10;
  for (let n = 0; n <= max; n += tickEvery) {
    const major = n % labelEvery === 0;
    svg.append(s('line', { x1: x(n), y1: Y - (major ? 6 : 3), x2: x(n), y2: Y + (major ? 6 : 3), class: 'viz-tick' }));
    if (major) svg.append(s('text', { x: x(n), y: Y + 22, class: 'viz-label' }, n));
  }
  hops.forEach(({ from, to }) => {
    const mid = (x(from) + x(to)) / 2;
    const height = Math.max(14, Math.min(58, Math.abs(x(to) - x(from)) * 0.7));
    svg.append(s('path', { d: `M${x(from)} ${Y - 2} Q${mid} ${Y - height * 1.5} ${x(to)} ${Y - 2}`, class: 'viz-hop' }));
  });
  marks.forEach((n, i) => {
    svg.append(s('circle', { cx: x(n), cy: Y, r: 6, class: i === marks.length - 1 ? 'viz-dot' : 'viz-dot-alt' }));
  });
  return svg;
}

const unitHops = (from, count, dir, size = 1) => Array.from({ length: count }, (_, i) => ({
  from: from + dir * i * size,
  to: from + dir * (i + 1) * size,
}));

function blocks(host) {
  let value = 34;
  frame(host, (render) => {
    const hundreds = Math.floor(value / 100);
    const tens = Math.floor((value % 100) / 10);
    const ones = value % 10;
    const svg = svgRoot(340, 110, `Блокчета: ${value}`);
    let x = 8;
    for (let i = 0; i < hundreds; i += 1) {
      svg.append(s('rect', { x, y: 8, width: 90, height: 90, rx: 4, class: 'viz-block-hundred' }));
      x += 96;
    }
    for (let i = 0; i < tens; i += 1) {
      svg.append(s('rect', { x, y: 8, width: 10, height: 90, rx: 2, class: 'viz-block-ten' }));
      x += 14;
    }
    x += 6;
    for (let i = 0; i < ones; i += 1) {
      svg.append(s('rect', { x: x + (i % 3) * 13, y: 73 - Math.floor(i / 3) * 13, width: 11, height: 11, rx: 2, class: 'viz-block-one' }));
    }
    const set = (v) => { value = v; render(); };
    return {
      drawing: svg,
      readout: `${value} = ${hundreds ? `${hundreds} стотици, ` : ''}${tens} десетици и ${ones} единици`,
      controls: [
        stepper('Единици', () => value, set, 0, 199),
        stepper('Десетици', () => value, set, 0, 199, 10),
      ],
    };
  });
}

function jumps(host) {
  let start = 2;
  let size = 2;
  let count = 4;
  frame(host, (render) => {
    const end = start + size * count;
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: numberLine(Math.max(30, end), unitHops(start, count, 1, size), [start, end]),
      readout: `От ${start} правиш ${count} стъпки по ${size} и стигаш до ${end}.`,
      controls: [
        stepper('Начало', () => start, set((v) => { start = v; }), 0, 20),
        stepper('Дължина', () => size, set((v) => { size = v; }), 1, 5),
        stepper('Стъпки', () => count, set((v) => { count = v; }), 1, 5),
      ],
    };
  });
}

function pairs(host) {
  let n = 7;
  frame(host, (render) => {
    const svg = svgRoot(340, 76, `${n} точки по двойки`);
    const couples = Math.floor(n / 2);
    for (let i = 0; i < couples; i += 1) {
      const x = 16 + i * 26;
      svg.append(s('circle', { cx: x, cy: 18, r: 9, class: 'viz-dot' }));
      svg.append(s('circle', { cx: x, cy: 46, r: 9, class: 'viz-dot' }));
      svg.append(s('line', { x1: x, y1: 18, x2: x, y2: 46, class: 'viz-axis' }));
    }
    if (n % 2) svg.append(s('circle', { cx: 16 + couples * 26, cy: 18, r: 9, class: 'viz-dot-alt' }));
    return {
      drawing: svg,
      readout: n % 2 ? `${n} е нечетно: ${couples} двойки и един остава сам.` : `${n} е четно: ${couples} двойки, никой не остава сам.`,
      controls: [stepper('Брой', () => n, (v) => { n = v; render(); }, 1, 24)],
    };
  });
}

function addLine(host) {
  let a = 7;
  let b = 5;
  frame(host, (render) => ({
    drawing: numberLine(30, unitHops(a, b, 1), [a, a + b]),
    readout: `${a} + ${b} = ${a + b}: от ${a} правиш ${b} стъпки надясно.`,
    controls: [
      stepper('Начало', () => a, (v) => { a = v; render(); }, 0, 20),
      stepper('Добавяш', () => b, (v) => { b = v; render(); }, 0, 10),
    ],
  }));
}

function subLine(host) {
  let a = 13;
  let b = 5;
  frame(host, (render) => {
    if (b > a) b = a;
    return {
      drawing: numberLine(30, unitHops(a, b, -1), [a, a - b]),
      readout: `${a} − ${b} = ${a - b}: от ${a} правиш ${b} стъпки наляво.`,
      controls: [
        stepper('Начало', () => a, (v) => { a = v; render(); }, 1, 30),
        stepper('Махаш', () => b, (v) => { b = v; render(); }, 0, 15),
      ],
    };
  });
}

function splitLine(host) {
  let a = 47;
  let b = 28;
  frame(host, (render) => {
    const tens = Math.floor(b / 10) * 10;
    const ones = b % 10;
    return {
      drawing: numberLine(100, [{ from: a, to: a + tens }, { from: a + tens, to: a + b }], [a, a + tens, a + b]),
      readout: `${a} + ${b}: първо +${tens} дава ${a + tens}, после +${ones} дава ${a + b}.`,
      controls: [
        stepper('Първо число', () => a, (v) => { a = v; render(); }, 10, 60),
        stepper('Второ число', () => b, (v) => { b = v; render(); }, 11, 39),
      ],
    };
  });
}

function array(host) {
  let rows = 3;
  let cols = 4;
  frame(host, (render) => {
    const cell = 22;
    const svg = svgRoot(Math.max(cols * cell + 8, 240), rows * cell + 8, `${rows} реда по ${cols}`);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        svg.append(s('circle', { cx: 4 + cell / 2 + c * cell, cy: 4 + cell / 2 + r * cell, r: 8, class: 'viz-dot' }));
      }
    }
    return {
      drawing: svg,
      readout: `${rows} реда по ${cols}: ${rows} × ${cols} = ${cols} × ${rows} = ${rows * cols}.`,
      controls: [
        stepper('Редове', () => rows, (v) => { rows = v; render(); }, 1, 10),
        stepper('В ред', () => cols, (v) => { cols = v; render(); }, 1, 12),
      ],
    };
  });
}

function share(host) {
  let total = 17;
  let groups = 5;
  frame(host, (render) => {
    const each = Math.floor(total / groups);
    const rest = total % groups;
    const cell = 18;
    const colW = Math.min(40, 320 / groups);
    const hgt = Math.max(each, 1) * cell + 30 + (rest ? cell + 8 : 0);
    const svg = svgRoot(340, hgt, `${total} разделени на ${groups}`);
    for (let g = 0; g < groups; g += 1) {
      svg.append(s('rect', { x: 8 + g * colW, y: 4, width: colW - 6, height: Math.max(each, 1) * cell + 10, rx: 6, class: 'viz-group' }));
      for (let i = 0; i < each; i += 1) {
        svg.append(s('circle', { cx: 8 + g * colW + (colW - 6) / 2, cy: 18 + i * cell, r: 6.5, class: 'viz-dot' }));
      }
    }
    for (let i = 0; i < rest; i += 1) {
      svg.append(s('circle', { cx: 18 + i * cell, cy: hgt - 12, r: 6.5, class: 'viz-dot-alt' }));
    }
    return {
      drawing: svg,
      readout: rest
        ? `${total} ÷ ${groups} = ${each} и остават ${rest}. Проверка: ${groups} × ${each} + ${rest} = ${total}.`
        : `${total} ÷ ${groups} = ${each} без остатък. Проверка: ${groups} × ${each} = ${total}.`,
      controls: [
        stepper('Общо', () => total, (v) => { total = v; render(); }, 1, 40),
        stepper('Групи', () => groups, (v) => { groups = v; render(); }, 1, 8),
      ],
    };
  });
}

const DIVISORS = [2, 3, 4, 5, 6, 9, 10];

function sieve(host) {
  let divisor = 3;
  frame(host, (render) => {
    const cell = 34;
    const svg = svgRoot(cell * 10, cell * 10, `Числата до 100, които се делят на ${divisor}`);
    for (let n = 1; n <= 100; n += 1) {
      const x = ((n - 1) % 10) * cell;
      const y = Math.floor((n - 1) / 10) * cell;
      const hit = n % divisor === 0;
      svg.append(s('rect', { x: x + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 5, class: hit ? 'viz-cell-hit' : 'viz-cell' }));
      svg.append(s('text', { x: x + cell / 2, y: y + cell / 2 + 4, class: hit ? 'viz-cell-text-hit' : 'viz-cell-text' }, n));
    }
    return {
      drawing: svg,
      readout: `До 100 има ${Math.floor(100 / divisor)} числа, които се делят на ${divisor}.`,
      controls: DIVISORS.map((d) => h('button', {
        type: 'button',
        class: `chip ${d === divisor ? 'chip-active' : ''}`,
        'aria-pressed': String(d === divisor),
        onclick: () => { divisor = d; render(); },
      }, `на ${d}`)),
    };
  });
}


// --- Визуализации за нива 4–6 ---

const bgNum = (x) => String(x).replace('.', ',');
const round2 = (x) => Math.round(x * 100) / 100;

// Лента, разделена на равни части: толкова от тях са взети.
function fractionBar(host) {
  let den = 4;
  let num = 1;
  frame(host, (render) => {
    const W = 340;
    const svg = svgRoot(W, 96, `Дроб ${num} върху ${den}`);
    const w = (W - 16) / den;
    for (let i = 0; i < den; i += 1) {
      svg.append(s('rect', {
        x: 8 + i * w, y: 14, width: w - 3, height: 46, rx: 4,
        class: i < num ? 'viz-cell-hit' : 'viz-cell',
      }));
    }
    svg.append(s('text', { x: W / 2, y: 84, class: 'viz-label' }, `${num}/${den} = ${bgNum(String(Math.round((num / den) * 1000) / 1000))}`));
    const set = (fn) => (v) => { fn(v); if (num > den) num = den; render(); };
    return {
      drawing: svg,
      readout: `Цялото е нарязано на ${den} равни части и са взети ${num}. Това е ${Math.round((num / den) * 100)}% от цялото.`,
      controls: [
        stepper('Части', () => den, set((v) => { den = v; }), 1, 12),
        stepper('Взети', () => num, set((v) => { num = v; }), 0, 12),
      ],
    };
  });
}

// Квадрат от 100 клетки: всяка клетка е една стотна, всеки цял ред е една десета.
function decimalGrid(host) {
  let hundredths = 37;
  frame(host, (render) => {
    const cell = 30;
    const svg = svgRoot(cell * 10, cell * 10 + 26, `${hundredths} стотни от цялото`);
    for (let i = 0; i < 100; i += 1) {
      svg.append(s('rect', {
        x: (i % 10) * cell + 1, y: Math.floor(i / 10) * cell + 1, width: cell - 2, height: cell - 2, rx: 3,
        class: i < hundredths ? 'viz-cell-hit' : 'viz-cell',
      }));
    }
    svg.append(s('text', { x: (cell * 10) / 2, y: cell * 10 + 18, class: 'viz-label' }, bgNum(String(hundredths / 100))));
    return {
      drawing: svg,
      readout: `${hundredths} стотни са ${bgNum(String(hundredths / 100))}: ${Math.floor(hundredths / 10)} цели реда (десети) и ${hundredths % 10} отделни клетки (стотни).`,
      controls: [
        stepper('Стотни', () => hundredths, (v) => { hundredths = v; render(); }, 0, 100),
        stepper('Десети', () => hundredths, (v) => { hundredths = v; render(); }, 0, 100, 10),
      ],
    };
  });
}

// Лента с процент: колко от цялото е взето и колко прави това от конкретно число.
function percentBar(host) {
  let p = 20;
  let base = 200;
  frame(host, (render) => {
    const W = 340;
    const svg = svgRoot(W, 92, `${p} процента`);
    svg.append(s('rect', { x: 8, y: 16, width: W - 16, height: 34, rx: 6, class: 'viz-cell' }));
    svg.append(s('rect', { x: 8, y: 16, width: ((W - 16) * p) / 100, height: 34, rx: 6, class: 'viz-cell-hit' }));
    for (let i = 1; i < 10; i += 1) {
      const x = 8 + ((W - 16) * i) / 10;
      svg.append(s('line', { x1: x, y1: 16, x2: x, y2: 50, class: 'viz-tick' }));
    }
    svg.append(s('text', { x: W / 2, y: 76, class: 'viz-label' }, `${p}% от ${base} = ${bgNum(String(round2((base * p) / 100)))}`));
    return {
      drawing: svg,
      readout: `Процентът е част от 100. ${p}% значи ${p} от всеки 100, тоест ${bgNum(String(round2((base * p) / 100)))} от ${base}.`,
      controls: [
        stepper('Процент', () => p, (v) => { p = v; render(); }, 0, 100, 5),
        stepper('Цяло', () => base, (v) => { base = v; render(); }, 10, 1000, 10),
      ],
    };
  });
}

// Числова ос с нула в средата: отрицателните числа са отляво.
function signedLine(host) {
  let a = -4;
  let b = 7;
  frame(host, (render) => {
    const W = 340;
    const MIN = -10;
    const MAX = 10;
    const x = (n) => 16 + ((n - MIN) / (MAX - MIN)) * (W - 32);
    const Y = 54;
    const end = Math.max(MIN, Math.min(MAX, a + b));
    const svg = svgRoot(W, 92, `От ${a} със стъпка ${b}`);
    svg.append(s('line', { x1: 8, y1: Y, x2: W - 8, y2: Y, class: 'viz-axis' }));
    for (let n = MIN; n <= MAX; n += 1) {
      svg.append(s('line', { x1: x(n), y1: Y - 5, x2: x(n), y2: Y + 5, class: 'viz-tick' }));
      if (n % 5 === 0) svg.append(s('text', { x: x(n), y: Y + 22, class: 'viz-label' }, n));
    }
    svg.append(s('path', {
      d: `M${x(a)} ${Y - 8}Q${(x(a) + x(end)) / 2} ${Y - 38} ${x(end)} ${Y - 8}`,
      class: 'viz-hop',
    }));
    svg.append(s('circle', { cx: x(a), cy: Y, r: 5, class: 'viz-dot-alt' }));
    svg.append(s('circle', { cx: x(end), cy: Y, r: 5, class: 'viz-dot' }));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `${a} + (${b}) = ${a + b}. Плюс значи надясно, минус значи наляво. Нулата е място по пътя, а не край.`,
      controls: [
        stepper('Начало', () => a, set((v) => { a = v; }), -10, 10),
        stepper('Стъпка', () => b, set((v) => { b = v; }), -10, 10),
      ],
    };
  });
}

// Степен: колко пъти основата се умножава по себе си. Квадратът се вижда като квадрат.
function powerStack(host) {
  let base = 3;
  let exp = 2;
  frame(host, (render) => {
    const value = base ** exp;
    const svg = svgRoot(340, 128, `${base} на степен ${exp}`);
    if (exp === 2) {
      const cell = Math.min(20, 104 / base);
      for (let r = 0; r < base; r += 1) {
        for (let c = 0; c < base; c += 1) {
          svg.append(s('rect', { x: 10 + c * cell, y: 10 + r * cell, width: cell - 2, height: cell - 2, rx: 2, class: 'viz-cell-hit' }));
        }
      }
      svg.append(s('text', { x: 230, y: 60, class: 'viz-label' }, `квадрат ${base} на ${base}`));
    } else {
      for (let i = 0; i < exp; i += 1) {
        svg.append(s('rect', { x: 14 + i * 62, y: 34, width: 44, height: 44, rx: 6, class: 'viz-cell-hit' }));
        svg.append(s('text', { x: 36 + i * 62, y: 62, class: 'viz-cell-text-hit' }, base));
        if (i < exp - 1) svg.append(s('text', { x: 68 + i * 62, y: 62, class: 'viz-label' }, '×'));
      }
    }
    svg.append(s('text', { x: 170, y: 118, class: 'viz-label' }, `${base} на степен ${exp} = ${value}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `${base} на степен ${exp} значи ${exp} пъти ${base}, умножени едно по друго: ${value}.`,
      controls: [
        stepper('Основа', () => base, set((v) => { base = v; }), 2, 12),
        stepper('Степен', () => exp, set((v) => { exp = v; }), 1, 5),
      ],
    };
  });
}

// Корен: квадрат с известна площ, а страната е това, което търсим.
function rootSquare(host) {
  let side = 6;
  frame(host, (render) => {
    const size = Math.min(140, 18 * side);
    const svg = svgRoot(340, 170, `Квадрат с площ ${side * side}`);
    const cell = size / side;
    for (let r = 0; r < side; r += 1) {
      for (let c = 0; c < side; c += 1) {
        svg.append(s('rect', { x: 14 + c * cell, y: 14 + r * cell, width: cell - 1.5, height: cell - 1.5, class: 'viz-cell-hit' }));
      }
    }
    svg.append(s('text', { x: 14 + size / 2, y: 14 + size + 18, class: 'viz-label' }, `страна ${side}`));
    svg.append(s('text', { x: 250, y: 70, class: 'viz-label' }, `площ ${side * side}`));
    svg.append(s('text', { x: 250, y: 92, class: 'viz-label' }, `корен = ${side}`));
    return {
      drawing: svg,
      readout: `Квадрат от ${side * side} клетки има страна ${side}. Коренът връща страната, когато знаеш площта.`,
      controls: [stepper('Страна', () => side, (v) => { side = v; render(); }, 1, 12)],
    };
  });
}

// Две лентички в дадено отношение: умножаването на двете не променя отношението.
function ratioBars(host) {
  let a = 2;
  let b = 3;
  let factor = 2;
  frame(host, (render) => {
    const W = 340;
    const unit = Math.min(26, (W - 70) / (Math.max(a, b) * factor));
    const svg = svgRoot(W, 118, `Отношение ${a} към ${b}`);
    const row = (value, y, label) => {
      for (let i = 0; i < value; i += 1) {
        svg.append(s('rect', { x: 52 + i * unit, y, width: Math.max(3, unit - 2), height: 24, rx: 3, class: 'viz-cell-hit' }));
      }
      svg.append(s('text', { x: 28, y: y + 17, class: 'viz-label' }, label));
    };
    row(a * factor, 12, String(a * factor));
    row(b * factor, 48, String(b * factor));
    svg.append(s('text', { x: W / 2, y: 104, class: 'viz-label' }, `${a * factor} : ${b * factor} = ${a} : ${b}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `${a * factor} към ${b * factor} е същото отношение като ${a} към ${b}: и двете са умножени по ${factor}.`,
      controls: [
        stepper('Първо', () => a, set((v) => { a = v; }), 1, 6),
        stepper('Второ', () => b, set((v) => { b = v; }), 1, 6),
        stepper('Пъти', () => factor, set((v) => { factor = v; }), 1, 5),
      ],
    };
  });
}

// Сметка пред касата: цена по брой, платено и ресто.
function moneyStack(host) {
  let price = 3;
  let count = 4;
  let paid = 20;
  frame(host, (render) => {
    const total = price * count;
    const change = paid - total;
    const W = 340;
    const svg = svgRoot(W, 116, `Сметка: ${count} по ${price} лева`);
    for (let i = 0; i < count; i += 1) {
      const x = 12 + i * 40;
      svg.append(s('rect', { x, y: 12, width: 34, height: 26, rx: 4, class: 'viz-cell-hit' }));
      svg.append(s('text', { x: x + 17, y: 30, class: 'viz-cell-text-hit' }, price));
    }
    const line = (text, y) => svg.append(s('text', { x: 12, y, class: 'viz-label', 'text-anchor': 'start' }, text));
    line(`общо ${total} лв.`, 64);
    line(`платено ${paid} лв.`, 86);
    line(change >= 0 ? `ресто ${change} лв.` : `не стигат ${-change} лв.`, 108);
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: change >= 0
        ? `${count} × ${price} = ${total} лв. От ${paid} лв. остават ${change} лв. ресто.`
        : `${count} × ${price} = ${total} лв., а имаш ${paid} лв.: не стигат ${-change} лв.`,
      controls: [
        stepper('Цена', () => price, set((v) => { price = v; }), 1, 20),
        stepper('Брой', () => count, set((v) => { count = v; }), 1, 8),
        stepper('Плащаш', () => paid, set((v) => { paid = v; }), 5, 100, 5),
      ],
    };
  });
}

export const VISUALIZATIONS = {
  blocks,
  jumps,
  pairs,
  'add-line': addLine,
  'sub-line': subLine,
  'split-line': splitLine,
  array,
  share,
  sieve,
  'fraction-bar': fractionBar,
  'decimal-grid': decimalGrid,
  'percent-bar': percentBar,
  'signed-line': signedLine,
  'power-stack': powerStack,
  'root-square': rootSquare,
  'ratio-bars': ratioBars,
  'money-stack': moneyStack,
};
