// Общи SVG фигури за игрите. Само константи от кода минават през trustedSvg,
// никога данни отвън. Цветовете идват от класове в tokens.css, не от кода тук.
import { trustedSvg } from '../../core/dom.js';

// Десет различими форми за „Разменени неща“: различават се по контур, не по цвят.
export const TOKEN_PATHS = {
  circle: '<circle cx="50" cy="50" r="33"/>',
  square: '<rect x="18" y="18" width="64" height="64" rx="5"/>',
  triangle: '<path d="M50 14 86 84H14Z"/>',
  star: '<path d="M50 10 62 40 94 42 69 62 78 92 50 75 22 92 31 62 6 42 38 40Z"/>',
  diamond: '<path d="M50 12 88 50 50 88 12 50Z"/>',
  cross: '<path d="M40 14h20v26h26v20H60v26H40V60H14V40h26Z"/>',
  ring: '<path fill-rule="evenodd" d="M50 16a34 34 0 1 0 0 68 34 34 0 1 0 0-68Zm0 18a16 16 0 1 1 0 32 16 16 0 1 1 0-32Z"/>',
  bolt: '<path d="M58 8 24 56h18l-8 36 36-52H52Z"/>',
  leaf: '<path d="M50 10c30 14 36 46 14 68-22 22-46 10-46 10S10 46 50 10Z"/>',
  drop: '<path d="M50 8c18 26 28 38 28 52a28 28 0 1 1-56 0c0-14 10-26 28-52Z"/>',
};

export const tokenSvg = (token, extra = '') => trustedSvg(
  `<svg viewBox="0 0 100 100">${TOKEN_PATHS[token]}</svg>`,
  `gm-token ${extra}`.trim(),
);

// Фигура с три признака: форма, запълване и място. Ползва се от логиката и от сортирането.
export function glyph(shape, fill, cx, cy, r) {
  const cls = fill === 'solid' ? 'lg-solid' : 'lg-line';
  const dot = fill === 'dot' ? `<circle class="lg-solid" cx="${cx}" cy="${cy}" r="${r * 0.32}"/>` : '';
  if (shape === 'circle') return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${r}"/>${dot}`;
  if (shape === 'square') return `<rect class="${cls}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}"/>${dot}`;
  return `<path class="${cls}" d="M${cx} ${cy - r}L${cx + r} ${cy + r}H${cx - r}Z"/>${dot}`;
}

export const POSITIONS = { 1: [[50, 50]], 2: [[30, 50], [70, 50]], 3: [[50, 28], [28, 70], [72, 70]] };

export const cellSvg = ({ shape, count, fill }, extra = '') => trustedSvg(
  `<svg viewBox="0 0 100 100">${POSITIONS[count].map(([x, y]) => glyph(shape, fill, x, y, count === 1 ? 24 : 16)).join('')}</svg>`,
  `lg-cell ${extra}`.trim(),
);

// Клетка за „Различното“: завъртане, размер, запълване и леко отместване.
export function oddSvg({ shape, rotation, scale, fill, shift }) {
  const r = 30 * scale;
  const cx = 50 + shift;
  const cy = 50 - shift;
  const body = glyph(shape, fill === 'solid' ? 'solid' : 'outline', cx, cy, r);
  return trustedSvg(
    `<svg viewBox="0 0 100 100"><g transform="rotate(${rotation} ${cx} ${cy})">${body}</g></svg>`,
    'gm-odd',
  );
}

// Фигура от клетки върху мрежа: ползва се от „Огледални и завъртени фигури“.
export function shapeSvg(cells, grid, extra = '') {
  const unit = 100 / grid;
  const rects = cells
    .map(([x, y]) => `<rect class="lg-solid" x="${(x * unit).toFixed(2)}" y="${(y * unit).toFixed(2)}" width="${(unit - 2).toFixed(2)}" height="${(unit - 2).toFixed(2)}" rx="2"/>`)
    .join('');
  const lines = Array.from({ length: grid + 1 }, (_, i) => {
    const p = (i * unit).toFixed(2);
    return `<line class="gm-rule" x1="${p}" y1="0" x2="${p}" y2="100"/><line class="gm-rule" x1="0" y1="${p}" x2="100" y2="${p}"/>`;
  }).join('');
  return trustedSvg(`<svg viewBox="-2 -2 104 104">${lines}${rects}</svg>`, `gm-shape ${extra}`.trim());
}
