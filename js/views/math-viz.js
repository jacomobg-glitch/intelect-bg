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
};
