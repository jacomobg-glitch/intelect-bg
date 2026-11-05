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

// Път, скорост и време: права от А до Б, движеща се кола и часовник. Показва s = v × t.
// Анимацията се спира сама, когато рисунката вече не е на екрана, и не тръгва при
// prefers-reduced-motion: там колата стои на края на пътя.
function travel(host) {
  let speed = 80; // км/ч
  let hours = 3;
  let anim = null;
  frame(host, (render) => {
    if (anim) cancelAnimationFrame(anim);
    anim = null;
    const dist = speed * hours;
    const W = 340;
    const X0 = 24;
    const X1 = 246;
    const Y = 62;
    const CX = 296;
    const CY = 52;
    const R = 26;
    const svg = svgRoot(W, 150, `Път от А до Б: ${speed} километра в час по ${hours} часа прави ${dist} километра`);

    svg.append(s('line', { x1: X0, y1: Y, x2: X1, y2: Y, class: 'viz-road' }));
    const done = s('line', { x1: X0, y1: Y, x2: X0, y2: Y, class: 'viz-road-done' });
    svg.append(done);
    [[X0, 'А', 0], [X1, 'Б', dist]].forEach(([x, name, km]) => {
      svg.append(s('line', { x1: x, y1: Y - 9, x2: x, y2: Y + 9, class: 'viz-tick' }));
      svg.append(s('text', { x, y: Y + 26, class: 'viz-label' }, name));
      svg.append(s('text', { x, y: Y + 40, class: 'viz-label viz-label-soft' }, `${km} км`));
    });

    // Колата: каросерия, покрив и две колела. Формата идва от кода, цветовете – от tokens.css.
    const car = s('g', { class: 'viz-car' });
    car.append(s('path', { d: 'M1 10h30v8H1Z', class: 'viz-car-body' }));
    car.append(s('path', { d: 'M8 3h15l5 7H8Z', class: 'viz-car-body' }));
    car.append(s('circle', { cx: 9, cy: 19, r: 3.4, class: 'viz-wheel' }));
    car.append(s('circle', { cx: 24, cy: 19, r: 3.4, class: 'viz-wheel' }));
    svg.append(car);

    // Часовник: 12 деления и стрелка, която минава по 30° на час.
    svg.append(s('circle', { cx: CX, cy: CY, r: R, class: 'viz-clock-face' }));
    for (let i = 0; i < 12; i += 1) {
      const a = (i * 30 - 90) * (Math.PI / 180);
      svg.append(s('line', {
        x1: CX + Math.cos(a) * (R - 5), y1: CY + Math.sin(a) * (R - 5),
        x2: CX + Math.cos(a) * (R - 1), y2: CY + Math.sin(a) * (R - 1),
        class: 'viz-tick',
      }));
    }
    const hand = s('line', { x1: CX, y1: CY, x2: CX, y2: CY - (R - 7), class: 'viz-clock-hand' });
    svg.append(hand);
    svg.append(s('circle', { cx: CX, cy: CY, r: 2.4, class: 'viz-dot' }));
    const clockText = s('text', { x: CX, y: CY + R + 16, class: 'viz-label' }, '0 ч');
    svg.append(clockText);

    const kmText = s('text', { x: (X0 + X1) / 2, y: Y - 18, class: 'viz-label' }, '0 км');
    svg.append(kmText);
    svg.append(s('text', { x: W / 2, y: 142, class: 'viz-label' }, `${speed} км/ч × ${hours} ч = ${dist} км`));

    // Единствената стъпка, която мести всичко: един дял от пътя – един дял от времето.
    const place = (p) => {
      const x = X0 + p * (X1 - X0);
      car.setAttribute('transform', `translate(${x - 16} ${Y - 22})`);
      done.setAttribute('x2', String(x));
      kmText.textContent = `${Math.round(dist * p)} км`;
      const h0 = hours * p;
      clockText.textContent = `${Number.isInteger(h0) ? h0 : h0.toFixed(1).replace('.', ',')} ч`;
      const a = (h0 * 30 - 90) * (Math.PI / 180);
      hand.setAttribute('x2', String(CX + Math.cos(a) * (R - 7)));
      hand.setAttribute('y2', String(CY + Math.sin(a) * (R - 7)));
    };
    place(1);

    const play = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        place(1);
        return;
      }
      const dur = Math.min(2600, 600 + 450 * hours);
      const t0 = performance.now();
      const step = (now) => {
        // Напуснат екран: анимацията се спира сама, без да чака когото и да е.
        if (!svg.isConnected) {
          anim = null;
          return;
        }
        const p = Math.min(1, (now - t0) / dur);
        place(p);
        anim = p < 1 ? requestAnimationFrame(step) : null;
      };
      place(0);
      anim = requestAnimationFrame(step);
    };

    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `При ${speed} км/ч за ${hours} ч колата минава ${speed} × ${hours} = ${dist} км. Обратно: ${dist} ÷ ${speed} = ${hours} ч и ${dist} ÷ ${hours} = ${speed} км/ч.`,
      controls: [
        stepper('Скорост', () => speed, set((v) => { speed = v; }), 10, 140, 10),
        stepper('Часове', () => hours, set((v) => { hours = v; }), 1, 8),
        h('button', { class: 'chip', type: 'button', onclick: play }, 'Пусни колата'),
      ],
    };
  });
}

// --- Визуализации за теми 7–10 ---

const gcdOf = (a, b) => (b === 0 ? Math.abs(a) : gcdOf(b, a % b));
const fracOf = (n, d) => {
  const g = gcdOf(n, d) || 1;
  return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`;
};
const sumOf = (list) => list.reduce((a, b) => a + b, 0);

// Буквеният израз като дължина: кутиите с неизвестното и отделните единици
// стоят в една редица, затова стойността се вижда, а не само се смята.
function termTiles(host) {
  let boxes = 3;
  let inside = 4;
  let extra = 2;
  frame(host, (render) => {
    const W = 340;
    const value = boxes * inside + extra;
    const unit = Math.min(16, (W - 30) / Math.max(value, 1));
    const svg = svgRoot(W, 98, `${boxes} кутии по ${inside} и още ${extra} единици`);
    let x = 10;
    for (let i = 0; i < boxes; i += 1) {
      const w = Math.max(10, inside * unit - 3);
      svg.append(s('rect', { x, y: 16, width: w, height: 34, rx: 5, class: 'viz-cell-hit' }));
      svg.append(s('text', { x: x + w / 2, y: 38, class: 'viz-cell-text-hit' }, 'a'));
      x += w + 3;
    }
    for (let i = 0; i < extra; i += 1) {
      svg.append(s('rect', { x, y: 16, width: Math.max(5, unit - 2), height: 34, rx: 2, class: 'viz-cell' }));
      x += unit;
    }
    const written = extra ? `${boxes}a + ${extra}` : `${boxes}a`;
    svg.append(s('text', { x: W / 2, y: 78, class: 'viz-label' }, `${written} = ${value} при a = ${inside}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `При a = ${inside} изразът ${written} е ${boxes} × ${inside}${extra ? ` + ${extra}` : ''} = ${value}. Кутиите са еднакви, затова само те се събират помежду си.`,
      controls: [
        stepper('Кутии', () => boxes, set((v) => { boxes = v; }), 1, 6),
        stepper('В кутия', () => inside, set((v) => { inside = v; }), 1, 9),
        stepper('Единици', () => extra, set((v) => { extra = v; }), 0, 9),
      ],
    };
  });
}

// Общата рисунка на везната: отляво кутии с неизвестното и отделни единици, отдясно единици.
// Ползва се и от двете уравнителни визуализации, за да е една и същата картинка.
function scales(label, boxes, units, right) {
  const W = 340;
  const PLATE = 112;
  const svg = svgRoot(W, 152, label);
  svg.append(s('line', { x1: 28, y1: 18, x2: W - 28, y2: 18, class: 'viz-beam' }));
  svg.append(s('path', { d: `M${W / 2} 18 L${W / 2 - 18} 142 L${W / 2 + 18} 142 Z`, class: 'viz-shape' }));
  const plate = (cx) => {
    svg.append(s('line', { x1: cx, y1: 18, x2: cx, y2: PLATE, class: 'viz-edge-soft' }));
    svg.append(s('rect', { x: cx - 62, y: PLATE, width: 124, height: 5, rx: 2, class: 'viz-beam' }));
  };
  const slot = (cx, n) => ({ x: cx - 57 + (n % 6) * 19, y: PLATE - 16 - Math.floor(n / 6) * 17 });
  plate(86);
  plate(W - 86);
  for (let i = 0; i < boxes; i += 1) {
    const p = slot(86, i);
    svg.append(s('rect', { x: p.x, y: p.y, width: 15, height: 15, rx: 4, class: 'viz-cell-hit' }));
    svg.append(s('text', { x: p.x + 7.5, y: p.y + 12, class: 'viz-cell-text-hit' }, 'x'));
  }
  for (let i = 0; i < units; i += 1) {
    const p = slot(86, boxes + i);
    svg.append(s('rect', { x: p.x, y: p.y, width: 15, height: 15, rx: 3, class: 'viz-cell' }));
  }
  for (let i = 0; i < right; i += 1) {
    const p = slot(W - 86, i);
    svg.append(s('rect', { x: p.x, y: p.y, width: 15, height: 15, rx: 3, class: 'viz-cell' }));
  }
  return svg;
}

// Едно действие: каквото се махне отляво, се маха и отдясно.
function balance(host) {
  let hidden = 7;
  let extra = 3;
  let cleared = false;
  frame(host, (render) => {
    const right = cleared ? hidden : hidden + extra;
    const svg = scales(
      cleared ? `Везна: кутия срещу ${right}` : `Везна: кутия и ${extra} срещу ${right}`,
      1, cleared ? 0 : extra, right,
    );
    return {
      drawing: svg,
      readout: cleared
        ? `Махнахме ${extra} от двете страни и остана x = ${hidden}. Везната е още равна, защото промяната беше еднаква.`
        : `x + ${extra} = ${hidden + extra}. Везната стои равна, значи двете страни са едно и също число.`,
      controls: [
        stepper('В кутията', () => hidden, (v) => { hidden = v; render(); }, 1, 9),
        stepper('Отделни', () => extra, (v) => { extra = v; cleared = false; render(); }, 0, 9),
        h('button', {
          type: 'button',
          class: `chip ${cleared ? 'chip-active' : ''}`,
          'aria-pressed': String(cleared),
          onclick: () => { cleared = !cleared; render(); },
        }, cleared ? 'Върни ги' : `Махни ${extra} от двете страни`),
      ],
    };
  });
}

const TWO_STAGES = ['Както е дадено', 'Махни единиците', 'Раздели на кутиите'];

// Две стъпки: първо си отива излишното, после всичко се дели на броя кутии.
function balanceTwo(host) {
  let hidden = 5;
  let boxes = 3;
  let extra = 4;
  let stage = 0;
  frame(host, (render) => {
    const whole = boxes * hidden + extra;
    const shown = stage === 0
      ? { boxes, units: extra, right: whole }
      : stage === 1
        ? { boxes, units: 0, right: whole - extra }
        : { boxes: 1, units: 0, right: hidden };
    const svg = scales(`Везна, стъпка ${stage + 1}`, shown.boxes, shown.units, shown.right);
    const line = [
      `${boxes}x + ${extra} = ${whole}`,
      `${boxes}x = ${whole - extra}`,
      `x = ${hidden}`,
    ][stage];
    const set = (fn) => (v) => { fn(v); stage = 0; render(); };
    return {
      drawing: svg,
      readout: `${line}. ${['Първо махни единиците от двете страни.', 'Сега раздели и двете страни на броя кутии.', 'Остана една кутия: това е отговорът.'][stage]}`,
      controls: [
        stepper('В кутията', () => hidden, set((v) => { hidden = v; }), 1, 6),
        stepper('Кутии', () => boxes, set((v) => { boxes = v; }), 1, 4),
        stepper('Единици', () => extra, set((v) => { extra = v; }), 0, 8),
        ...TWO_STAGES.map((name, i) => h('button', {
          type: 'button',
          class: `chip ${i === stage ? 'chip-active' : ''}`,
          'aria-pressed': String(i === stage),
          onclick: () => { stage = i; render(); },
        }, name)),
      ],
    };
  });
}

// Ъгъл: едно рамо се върти, а изправеният ъгъл до него показва остатъка до 180°.
function protractor(host) {
  let deg = 50;
  frame(host, (render) => {
    const W = 340;
    const CX = W / 2;
    const CY = 124;
    const R = 100;
    const at = (d, r) => [CX + r * Math.cos((d * Math.PI) / 180), CY - r * Math.sin((d * Math.PI) / 180)];
    const [ax, ay] = at(deg, R);
    const [arcX, arcY] = at(deg, 40);
    const [labelX, labelY] = at(deg / 2, 62);
    const [restX, restY] = at((deg + 180) / 2, 62);
    const svg = svgRoot(W, 152, `Ъгъл ${deg} градуса и съседният му ${180 - deg} градуса`);
    svg.append(s('line', { x1: CX - R, y1: CY, x2: CX + R, y2: CY, class: 'viz-edge-soft' }));
    svg.append(s('line', { x1: CX, y1: CY, x2: ax, y2: ay, class: 'viz-edge' }));
    svg.append(s('path', { d: `M${CX + 40} ${CY} A40 40 0 0 0 ${arcX} ${arcY}`, class: 'viz-arc' }));
    svg.append(s('circle', { cx: CX, cy: CY, r: 4, class: 'viz-dot' }));
    svg.append(s('text', { x: labelX, y: labelY, class: 'viz-label' }, `${deg}°`));
    svg.append(s('text', { x: restX, y: restY, class: 'viz-label-soft' }, `${180 - deg}°`));
    return {
      drawing: svg,
      readout: `Ъгълът е ${deg}°, а съседният до него е ${180 - deg}°. Заедно правят изправен ъгъл от 180°. Правият ъгъл е 90°${deg === 90 ? ' — точно този' : ''}.`,
      controls: [stepper('Градуси', () => deg, (v) => { deg = v; render(); }, 5, 175, 5)],
    };
  });
}

// Обиколка: оградата по контура, страна по страна, с деления по единица.
function perimeterShape(host) {
  let wide = 6;
  let tall = 4;
  frame(host, (render) => {
    const W = 340;
    const unit = Math.min(26, 230 / Math.max(wide, tall));
    const w = wide * unit;
    const hgt = tall * unit;
    const x0 = (W - w) / 2;
    const y0 = 26;
    const svg = svgRoot(W, hgt + 86, `Правоъгълник ${wide} на ${tall}`);
    svg.append(s('rect', { x: x0, y: y0, width: w, height: hgt, class: 'viz-shape' }));
    for (let i = 1; i < wide; i += 1) {
      svg.append(s('line', { x1: x0 + i * unit, y1: y0, x2: x0 + i * unit, y2: y0 + 7, class: 'viz-tick' }));
      svg.append(s('line', { x1: x0 + i * unit, y1: y0 + hgt - 7, x2: x0 + i * unit, y2: y0 + hgt, class: 'viz-tick' }));
    }
    for (let i = 1; i < tall; i += 1) {
      svg.append(s('line', { x1: x0, y1: y0 + i * unit, x2: x0 + 7, y2: y0 + i * unit, class: 'viz-tick' }));
      svg.append(s('line', { x1: x0 + w - 7, y1: y0 + i * unit, x2: x0 + w, y2: y0 + i * unit, class: 'viz-tick' }));
    }
    svg.append(s('text', { x: x0 + w / 2, y: y0 - 8, class: 'viz-label' }, wide));
    svg.append(s('text', { x: x0 + w / 2, y: y0 + hgt + 18, class: 'viz-label' }, wide));
    svg.append(s('text', { x: x0 - 14, y: y0 + hgt / 2 + 4, class: 'viz-label' }, tall));
    svg.append(s('text', { x: x0 + w + 14, y: y0 + hgt / 2 + 4, class: 'viz-label' }, tall));
    svg.append(s('text', { x: W / 2, y: hgt + 74, class: 'viz-label' }, `2 × (${wide} + ${tall}) = ${2 * (wide + tall)}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `Обиколката е ${wide} + ${tall} + ${wide} + ${tall} = ${2 * (wide + tall)}. Това е дължина, затова се мери в сантиметри.`,
      controls: [
        stepper('Широчина', () => wide, set((v) => { wide = v; }), 1, 12),
        stepper('Височина', () => tall, set((v) => { tall = v; }), 1, 9),
      ],
    };
  });
}

// Лице: броят плочки. Триъгълникът покрива точно половината от същия правоъгълник.
function areaGrid(host) {
  let wide = 6;
  let tall = 4;
  let triangle = false;
  frame(host, (render) => {
    const W = 340;
    const unit = Math.min(28, 240 / Math.max(wide, tall));
    const w = wide * unit;
    const hgt = tall * unit;
    const x0 = (W - w) / 2;
    const y0 = 14;
    const cells = wide * tall;
    const value = triangle ? cells / 2 : cells;
    const svg = svgRoot(W, hgt + 62, triangle ? `Триъгълник в мрежа ${wide} на ${tall}` : `Правоъгълник ${wide} на ${tall}`);
    for (let r = 0; r < tall; r += 1) {
      for (let c = 0; c < wide; c += 1) {
        svg.append(s('rect', {
          x: x0 + c * unit + 1, y: y0 + r * unit + 1, width: unit - 2, height: unit - 2, rx: 2,
          class: 'viz-cell',
        }));
      }
    }
    svg.append(triangle
      ? s('polygon', { points: `${x0},${y0 + hgt} ${x0 + w},${y0 + hgt} ${x0},${y0}`, class: 'viz-area' })
      : s('rect', { x: x0, y: y0, width: w, height: hgt, class: 'viz-area' }));
    svg.append(s('text', { x: W / 2, y: hgt + 50, class: 'viz-label' }, triangle
      ? `${wide} × ${tall} ÷ 2 = ${bgNum(String(value))}`
      : `${wide} × ${tall} = ${value}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: triangle
        ? `Правоъгълникът е ${cells} плочки, а триъгълникът покрива половината: ${bgNum(String(value))}. Затова лицето на триъгълник е основа по височина, делено на 2.`
        : `${tall} реда по ${wide} плочки са ${cells} плочки. Лицето се мери в квадратни единици.`,
      controls: [
        stepper('Широчина', () => wide, set((v) => { wide = v; }), 1, 10),
        stepper('Височина', () => tall, set((v) => { tall = v; }), 1, 8),
        h('button', {
          type: 'button',
          class: `chip ${triangle ? '' : 'chip-active'}`,
          'aria-pressed': String(!triangle),
          onclick: () => { triangle = false; render(); },
        }, 'Правоъгълник'),
        h('button', {
          type: 'button',
          class: `chip ${triangle ? 'chip-active' : ''}`,
          'aria-pressed': String(triangle),
          onclick: () => { triangle = true; render(); },
        }, 'Триъгълник'),
      ],
    };
  });
}

const CHART_DAYS = ['пн', 'вт', 'ср', 'чт'];

// Стълбовидна диаграма: скалата започва от нула, затова дължините се сравняват направо.
function barChart(host) {
  const values = [4, 7, 5, 9];
  frame(host, (render) => {
    const W = 340;
    const base = 116;
    const top = Math.max(...values, 1);
    const low = Math.min(...values);
    const best = CHART_DAYS[values.indexOf(top)];
    const svg = svgRoot(W, 156, `Диаграма по дни: ${values.join(', ')}`);
    svg.append(s('line', { x1: 26, y1: base, x2: W - 12, y2: base, class: 'viz-axis' }));
    svg.append(s('text', { x: 16, y: base + 4, class: 'viz-label-soft' }, '0'));
    values.forEach((v, i) => {
      const height = (v / top) * 82;
      const x = 42 + i * 70;
      svg.append(s('rect', { x, y: base - height, width: 44, height, rx: 4, class: 'viz-cell-hit' }));
      svg.append(s('text', { x: x + 22, y: base - height - 7, class: 'viz-label' }, v));
      svg.append(s('text', { x: x + 22, y: base + 18, class: 'viz-label-soft' }, CHART_DAYS[i]));
    });
    svg.append(s('text', { x: W / 2, y: 148, class: 'viz-label' }, `общо ${sumOf(values)} · най-много ${top} · разлика ${top - low}`));
    return {
      drawing: svg,
      readout: `Общо ${sumOf(values)}. Най-силен е ${best} с ${top}, а разликата с най-слабия ден е ${top - low}. Скалата започва от 0: ако започваше по-високо, разликите щяха да изглеждат по-големи.`,
      controls: CHART_DAYS.map((name, i) => stepper(name, () => values[i], (v) => { values[i] = v; render(); }, 0, 12)),
    };
  });
}

// Средна стойност: пунктираната линия е нивото, на което всички стълбове стават равни.
function meanBars(host) {
  const values = [3, 8, 5, 4];
  let levelled = false;
  frame(host, (render) => {
    const W = 340;
    const base = 116;
    const mean = sumOf(values) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = (sorted[1] + sorted[2]) / 2;
    const counts = values.map((v) => values.filter((x) => x === v).length);
    const topCount = Math.max(...counts);
    const mode = topCount > 1 ? values[counts.indexOf(topCount)] : null;
    const top = Math.max(...values, mean, 1);
    const toY = (v) => base - (v / top) * 82;
    const svg = svgRoot(W, 156, `Стълбове ${values.join(', ')} и средна стойност ${bgNum(String(round2(mean)))}`);
    svg.append(s('line', { x1: 26, y1: base, x2: W - 12, y2: base, class: 'viz-axis' }));
    values.forEach((v, i) => {
      const shown = levelled ? mean : v;
      const x = 42 + i * 70;
      svg.append(s('rect', { x, y: toY(shown), width: 44, height: base - toY(shown), rx: 4, class: 'viz-cell-hit' }));
      svg.append(s('text', { x: x + 22, y: toY(shown) - 7, class: 'viz-label' }, bgNum(String(round2(shown)))));
      svg.append(s('text', { x: x + 22, y: base + 18, class: 'viz-label-soft' }, `№${i + 1}`));
    });
    svg.append(s('line', { x1: 30, y1: toY(mean), x2: W - 16, y2: toY(mean), class: 'viz-mean-line' }));
    svg.append(s('text', { x: W / 2, y: 148, class: 'viz-label' },
      `средна ${bgNum(String(round2(mean)))} · медиана ${bgNum(String(round2(middle)))} · мода ${mode === null ? 'няма' : mode}`));
    return {
      drawing: svg,
      readout: levelled
        ? `Разделено по равно, всеки стълб става ${bgNum(String(round2(mean)))}. Точно това е средната стойност: сборът ${sumOf(values)}, разделен на ${values.length}.`
        : `Сборът е ${sumOf(values)}, числата са ${values.length}, значи средната стойност е ${bgNum(String(round2(mean)))}. Медианата е средата на подредените: ${bgNum(String(round2(middle)))}.`,
      controls: [
        ...values.map((v, i) => stepper(`№${i + 1}`, () => values[i], (nv) => { values[i] = nv; render(); }, 0, 12)),
        h('button', {
          type: 'button',
          class: `chip ${levelled ? 'chip-active' : ''}`,
          'aria-pressed': String(levelled),
          onclick: () => { levelled = !levelled; render(); },
        }, levelled ? 'Върни както бяха' : 'Раздели по равно'),
      ],
    };
  });
}

// Вероятност: колко от равните сектори са благоприятни. Секторите са номерирани,
// за да не е цветът единственият сигнал кои са те.
function chanceSpinner(host) {
  let parts = 6;
  let good = 1;
  frame(host, (render) => {
    const W = 340;
    const CX = W / 2;
    const CY = 92;
    const R = 76;
    const at = (turn, r) => [CX + r * Math.cos(turn * 2 * Math.PI - Math.PI / 2), CY + r * Math.sin(turn * 2 * Math.PI - Math.PI / 2)];
    const svg = svgRoot(W, 170, `Кръг от ${parts} равни сектора, ${good} от тях благоприятни`);
    for (let i = 0; i < parts; i += 1) {
      const [x1, y1] = at(i / parts, R);
      const [x2, y2] = at((i + 1) / parts, R);
      const large = 1 / parts > 0.5 ? 1 : 0;
      const hit = i < good;
      svg.append(s('path', {
        d: parts === 1
          ? `M${CX} ${CY - R} A${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`
          : `M${CX} ${CY} L${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`,
        class: hit ? 'viz-sector-hit' : 'viz-sector',
      }));
      const [tx, ty] = at((i + 0.5) / parts, R * 0.66);
      svg.append(s('text', { x: tx, y: ty + 4, class: hit ? 'viz-cell-text-hit' : 'viz-cell-text' }, i + 1));
    }
    const share = fracOf(good, parts);
    svg.append(s('text', { x: CX, y: 162, class: 'viz-label' }, `${good} от ${parts} = ${share} = ${bgNum(String(round2((good / parts) * 100)))}%`));
    const set = (fn) => (v) => { fn(v); if (good > parts) good = parts; render(); };
    return {
      drawing: svg,
      readout: `Благоприятни са ${good} от ${parts} равновъзможни сектора, значи вероятността е ${share}, тоест ${bgNum(String(round2((good / parts) * 100)))}%. Вероятността да НЕ стане е ${fracOf(parts - good, parts)}.`,
      controls: [
        stepper('Сектори', () => parts, set((v) => { parts = v; }), 2, 10),
        stepper('Благоприятни', () => good, set((v) => { good = v; }), 0, 10),
      ],
    };
  });
}

// Редица като стъпала: постоянната разлика расте равномерно, постоянното отношение — скокообразно.
function sequenceSteps(host) {
  let start = 2;
  let rule = 3;
  let multiply = false;
  frame(host, (render) => {
    const W = 340;
    const base = 122;
    const count = multiply ? 5 : 6;
    const terms = Array.from({ length: count }, (_, i) => (multiply ? start * rule ** i : start + i * rule));
    const top = Math.max(...terms, 1);
    const colW = (W - 24) / count;
    const svg = svgRoot(W, 162, `Редица: ${terms.join(', ')}`);
    svg.append(s('line', { x1: 12, y1: base, x2: W - 12, y2: base, class: 'viz-axis' }));
    terms.forEach((v, i) => {
      const height = Math.max(3, (v / top) * 88);
      const x = 16 + i * colW;
      svg.append(s('rect', { x, y: base - height, width: colW - 10, height, rx: 4, class: 'viz-cell-hit' }));
      svg.append(s('text', { x: x + (colW - 10) / 2, y: base - height - 7, class: 'viz-label' }, v));
      svg.append(s('text', { x: x + (colW - 10) / 2, y: base + 18, class: 'viz-label-soft' }, i + 1));
    });
    svg.append(s('text', { x: W / 2, y: 154, class: 'viz-label' },
      multiply ? `всяко следващо × ${rule}` : `всяко следващо + ${rule}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: multiply
        ? `${terms.join(', ')}, … Всяко следващо е ${rule} пъти предишното, затова редицата се вдига рязко. Следващото е ${terms[count - 1] * rule}.`
        : `${terms.join(', ')}, … Всяко следващо е с ${rule} повече, затова стъпалата са еднакви. Следващото е ${terms[count - 1] + rule}.`,
      controls: [
        stepper('Начало', () => start, set((v) => { start = v; }), 1, multiply ? 3 : 9),
        stepper(multiply ? 'Отношение' : 'Разлика', () => rule, set((v) => { rule = v; }), multiply ? 2 : 1, multiply ? 4 : 6),
        h('button', {
          type: 'button',
          class: `chip ${multiply ? '' : 'chip-active'}`,
          'aria-pressed': String(!multiply),
          onclick: () => { multiply = false; rule = 3; start = 2; render(); },
        }, 'Добавя'),
        h('button', {
          type: 'button',
          class: `chip ${multiply ? 'chip-active' : ''}`,
          'aria-pressed': String(multiply),
          onclick: () => { multiply = true; rule = 2; start = 1; render(); },
        }, 'Умножава'),
      ],
    };
  });
}

// Кратните на двете числа до 60. Квадратчето и кръгчето казват на кое от двете е кратно
// всяко число, а общите клетки са общите кратни: първата от тях е НОК.
function factorGrid(host) {
  let first = 4;
  let second = 6;
  frame(host, (render) => {
    const cell = 32;
    const COLS = 10;
    const ROWS = 6;
    const g = gcdOf(first, second);
    const l = (first * second) / g;
    const svg = svgRoot(cell * COLS, cell * ROWS + 46, `Кратните на ${first} и на ${second} до 60`);
    for (let n = 1; n <= COLS * ROWS; n += 1) {
      const x = ((n - 1) % COLS) * cell;
      const y = Math.floor((n - 1) / COLS) * cell;
      const isFirst = n % first === 0;
      const isSecond = n % second === 0;
      const both = isFirst && isSecond;
      if (isFirst || isSecond) {
        svg.append(s('rect', { x: x + 1, y: y + 1, width: cell - 2, height: cell - 2, rx: 5, class: both ? 'viz-cell-hit' : 'viz-cell' }));
      }
      svg.append(s('text', { x: x + cell / 2, y: y + cell / 2 + 4, class: both ? 'viz-cell-text-hit' : 'viz-cell-text' }, n));
      if (isFirst) svg.append(s('rect', { x: x + 4, y: y + 4, width: 6, height: 6, class: 'viz-dot' }));
      if (isSecond) svg.append(s('circle', { cx: x + cell - 7, cy: y + cell - 7, r: 3.5, class: 'viz-dot-alt' }));
    }
    svg.append(s('text', { x: (cell * COLS) / 2, y: cell * ROWS + 20, class: 'viz-label' },
      `най-голям общ делител: НОД(${first}, ${second}) = ${g}`));
    svg.append(s('text', { x: (cell * COLS) / 2, y: cell * ROWS + 38, class: 'viz-label' },
      `най-малко общо кратно: НОК(${first}, ${second}) = ${l}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `Квадратчето значи „кратно на ${first}“, кръгчето — „кратно на ${second}“. Клетките с двата знака са общите кратни; първата от тях е ${l}, тоест НОК. Най-голямото число, което дели и двете, е ${g}.`,
      controls: [
        stepper('Първо', () => first, set((v) => { first = v; }), 2, 12),
        stepper('Второ', () => second, set((v) => { second = v; }), 2, 12),
      ],
    };
  });
}

// Дърво на възможностите: всеки първи избор се разклонява на всички втори,
// затова броят се умножава, а не се събира.
function choiceTree(host) {
  let first = 3;
  let second = 2;
  frame(host, (render) => {
    const W = 340;
    const H = 170;
    const rootX = 24;
    const rootY = 84;
    const midX = 136;
    const leafX = 286;
    const svg = svgRoot(W, H, `${first} по ${second} възможности`);
    const spread = (i, n) => 22 + ((i + 0.5) / n) * 120;
    for (let i = 0; i < first; i += 1) {
      const y = spread(i, first);
      svg.append(s('line', { x1: rootX + 8, y1: rootY, x2: midX - 9, y2: y, class: 'viz-edge-soft' }));
      svg.append(s('circle', { cx: midX, cy: y, r: 8, class: 'viz-dot-alt' }));
      for (let j = 0; j < second; j += 1) {
        const leafY = spread(i * second + j, first * second);
        svg.append(s('line', { x1: midX + 9, y1: y, x2: leafX - 7, y2: leafY, class: 'viz-edge-soft' }));
        svg.append(s('rect', { x: leafX - 6, y: leafY - 6, width: 12, height: 12, rx: 3, class: 'viz-cell-hit' }));
      }
    }
    svg.append(s('circle', { cx: rootX, cy: rootY, r: 8, class: 'viz-dot' }));
    svg.append(s('text', { x: W / 2, y: H - 4, class: 'viz-label' }, `${first} × ${second} = ${first * second}`));
    const set = (fn) => (v) => { fn(v); render(); };
    return {
      drawing: svg,
      readout: `Първият избор има ${first} възможности, а за всяка от тях вторият има ${second}. Листата са ${first} × ${second} = ${first * second}.`,
      controls: [
        stepper('Първи избор', () => first, set((v) => { first = v; }), 1, 4),
        stepper('Втори избор', () => second, set((v) => { second = v; }), 1, 4),
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
  travel,
  'term-tiles': termTiles,
  balance,
  'balance-two': balanceTwo,
  protractor,
  'perimeter-shape': perimeterShape,
  'area-grid': areaGrid,
  'bar-chart': barChart,
  'mean-bars': meanBars,
  'chance-spinner': chanceSpinner,
  'sequence-steps': sequenceSteps,
  'factor-grid': factorGrid,
  'choice-tree': choiceTree,
};
