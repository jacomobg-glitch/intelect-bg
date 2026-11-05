// Украсата за света: купеното се вижда на сцената „Моят свят“.
// Всеки предмет има място (слот), за да не се налага влачене — детето само
// го включва и изключва. Цветовете идват от класове, не от кода тук.
//
// Сцената е 320×180. Всеки предмет се рисува около своята точка и стъпва на нулата
// по y, затова един и същ предмет пасва на всеки слот.

export const SLOTS = Object.freeze({
  'sky-left': 'translate(52 44)',
  'sky-right': 'translate(258 40)',
  left: 'translate(48 140)',
  right: 'translate(262 140)',
  center: 'translate(160 146)',
});

export const SLOT_NAMES = Object.freeze(Object.keys(SLOTS));

const item = (id, world, name, price, slot, svg) => ({ id, world, name, price, slot, svg });

export const DECOR = Object.freeze([
  // --- Строител ---
  item('decor-flag', 'builder', 'Знаме на кулата', 50, 'sky-right',
    '<path class="sc-d" d="M0 0v-46"/><path class="sc-a" d="M0-46h30l-8 9 8 9H0Z"/>'),
  item('decor-lantern', 'builder', 'Фенер', 45, 'sky-left',
    '<path class="sc-d" d="M0 0v-30"/><path class="sc-e" d="M-9-44h18l-4 14h-10Z"/><circle class="sc-glow" cx="0" cy="-37" r="12"/>'),
  item('decor-fence', 'builder', 'Оградка', 40, 'left',
    '<g class="sc-b"><rect x="-26" y="-22" width="6" height="22"/><rect x="-10" y="-26" width="6" height="26"/><rect x="6" y="-22" width="6" height="22"/><rect x="22" y="-26" width="6" height="26"/></g><g class="sc-d"><rect x="-28" y="-18" width="58" height="4"/><rect x="-28" y="-8" width="58" height="4"/></g>'),
  item('decor-chest', 'builder', 'Сандък със съкровище', 70, 'right',
    '<rect class="sc-b" x="-22" y="-24" width="44" height="24" rx="3"/><path class="sc-a" d="M-22-24a22 12 0 0 1 44 0Z"/><rect class="sc-e" x="-5" y="-18" width="10" height="12" rx="2"/>'),
  item('decor-bridge', 'builder', 'Малък мост', 90, 'center',
    '<path class="sc-b" d="M-46 0q46-40 92 0Z" opacity=".55"/><path class="sc-d" d="M-46 0q46-40 92 0"/><g class="sc-b"><rect x="-30" y="-16" width="5" height="16"/><rect x="-6" y="-26" width="5" height="26"/><rect x="24" y="-16" width="5" height="16"/></g>'),

  // --- Градина ---
  item('decor-can', 'garden', 'Лейка', 40, 'left',
    '<path class="sc-a" d="M-16-26h26v20a6 6 0 0 1-6 6h-14a6 6 0 0 1-6-6Z"/><path class="sc-d" d="M10-22 24-30M-16-22l-8-6"/><path class="sc-d" d="M-10-26q6-10 14 0"/>'),
  item('decor-butterflies', 'garden', 'Пеперуди', 55, 'sky-left',
    '<g class="sc-a"><path d="M0 0q-12-12-18-4 6 10 18 4Zm0 0q12-12 18-4-6 10-18 4Z"/><path d="M30 14q-10-10-15-3 5 8 15 3Zm0 0q10-10 15-3-5 8-15 3Z" opacity=".8"/></g>'),
  item('decor-bench', 'garden', 'Пейка', 50, 'right',
    '<g class="sc-b"><rect x="-26" y="-14" width="52" height="6" rx="2"/><rect x="-26" y="-28" width="52" height="5" rx="2"/><rect x="-22" y="-8" width="5" height="8"/><rect x="17" y="-8" width="5" height="8"/><rect x="-22" y="-28" width="4" height="16"/><rect x="18" y="-28" width="4" height="16"/></g>'),
  item('decor-fountain', 'garden', 'Фонтан', 90, 'center',
    '<ellipse class="sc-b" cx="0" cy="0" rx="30" ry="10"/><path class="sc-e" d="M-6-28h12v28h-12Z" opacity=".8"/><g class="sc-glow"><path d="M0-30q-10-14 0-24 10 10 0 24Z"/></g><ellipse class="sc-e" cx="0" cy="-2" rx="22" ry="6" opacity=".5"/>'),
  item('decor-hive', 'garden', 'Кошер', 65, 'sky-right',
    '<g class="sc-a"><rect x="-18" y="-14" width="36" height="14" rx="6"/><rect x="-16" y="-26" width="32" height="13" rx="6"/><rect x="-13" y="-36" width="26" height="11" rx="5"/></g><circle class="sc-d" cx="0" cy="-8" r="3"/>'),

  // --- Градски мисии ---
  item('decor-signs', 'city', 'Пътни знаци', 40, 'sky-left',
    '<path class="sc-d" d="M0 0v-34"/><rect class="sc-a" x="-14" y="-46" width="28" height="14" rx="3"/><path class="sc-e" d="M-8-40h16v3h-16Z"/>'),
  item('decor-kiosk', 'city', 'Будка за кафе', 60, 'left',
    '<rect class="sc-b" x="-24" y="-30" width="48" height="30" rx="3"/><path class="sc-a" d="M-28-30h56l-6-10h-44Z"/><rect class="sc-e" x="-14" y="-24" width="28" height="12" rx="2"/>'),
  item('decor-traffic', 'city', 'Светофар', 50, 'sky-right',
    '<path class="sc-d" d="M0 0v34"/><rect class="sc-b" x="-9" y="-30" width="18" height="34" rx="4"/><circle class="sc-glow" cx="0" cy="-22" r="4"/><circle class="sc-e" cx="0" cy="-13" r="4" opacity=".6"/><circle class="sc-a" cx="0" cy="-4" r="4"/>'),
  item('decor-park', 'city', 'Паркче', 70, 'center',
    '<g class="sc-a"><circle cx="-18" cy="-24" r="14"/><circle cx="14" cy="-18" r="10"/></g><g class="sc-b"><rect x="-20" y="-10" width="4" height="10"/><rect x="12" y="-8" width="4" height="8"/><rect x="-40" y="-2" width="80" height="4" rx="2"/></g>'),
  item('decor-garage', 'city', 'Гараж', 80, 'right',
    '<rect class="sc-b" x="-30" y="-34" width="60" height="34" rx="3"/><path class="sc-a" d="M-34-34h68l-8-12h-52Z"/><rect class="sc-e" x="-20" y="-24" width="40" height="24" rx="2" opacity=".75"/>'),

  // --- Космос ---
  item('decor-satellite', 'space', 'Спътник', 55, 'sky-right',
    '<rect class="sc-b" x="-8" y="-10" width="16" height="20" rx="3"/><rect class="sc-a" x="-30" y="-6" width="18" height="12" rx="2"/><rect class="sc-a" x="12" y="-6" width="18" height="12" rx="2"/><path class="sc-d" d="M0-10v-10"/>'),
  item('decor-telescope', 'space', 'Телескоп', 70, 'left',
    '<path class="sc-d" d="M-12 0 0-8 12 0"/><rect class="sc-b" x="-6" y="-40" width="12" height="34" rx="4" transform="rotate(20 0 -20)"/><circle class="sc-glow" cx="12" cy="-38" r="6"/>'),
  item('decor-comet', 'space', 'Комета', 60, 'sky-left',
    '<circle class="sc-glow" cx="0" cy="0" r="9"/><path class="sc-a" d="M-6 4-40 22l30-10Z" opacity=".7"/>'),
  item('decor-base', 'space', 'Малка база', 90, 'center',
    '<path class="sc-b" d="M-34 0a34 20 0 0 1 68 0Z"/><rect class="sc-e" x="-10" y="-16" width="20" height="16" rx="4" opacity=".8"/><path class="sc-d" d="M-24-6h8M16-6h8"/>'),
  item('decor-starmap', 'space', 'Звездна карта', 50, 'right',
    '<rect class="sc-b" x="-24" y="-30" width="48" height="30" rx="3"/><g class="sc-e"><circle cx="-12" cy="-20" r="2"/><circle cx="4" cy="-24" r="2"/><circle cx="12" cy="-12" r="2"/><circle cx="-6" cy="-8" r="2"/></g><path class="sc-d" d="M-12-20 4-24l8 12-18 4Z" opacity=".6"/>'),

  // --- Животни ---
  item('decor-rock', 'nature', 'Камък', 40, 'left',
    '<path class="sc-b" d="M-24 0q-4-18 10-22 18-6 24 8 4 10-6 14Z"/><path class="sc-d" d="M-10-14q8-4 14 2" opacity=".5"/>'),
  item('decor-stream', 'nature', 'Поточе', 70, 'center',
    '<path class="sc-glow" d="M-50 0q16-10 32 0t32 0 32 0" opacity=".8"/><path class="sc-e" d="M-50 8q16-10 32 0t32 0 32 0" opacity=".5"/>'),
  item('decor-flowers', 'nature', 'Цветя', 45, 'right',
    '<g class="sc-d"><path d="M-14 0v-16M0 0v-22M14 0v-14"/></g><g class="sc-a"><circle cx="-14" cy="-20" r="6"/><circle cx="0" cy="-26" r="7"/><circle cx="14" cy="-18" r="6"/></g><g class="sc-e"><circle cx="-14" cy="-20" r="2.5"/><circle cx="0" cy="-26" r="3"/><circle cx="14" cy="-18" r="2.5"/></g>'),
  item('decor-hollow', 'nature', 'Хралупа', 65, 'sky-left',
    '<path class="sc-b" d="M-16 0v-40h32V0Z"/><ellipse class="sc-d" cx="0" cy="-22" rx="9" ry="12"/><path class="sc-a" d="M-20-40q20-16 40 0Z"/>'),
  item('decor-rainbow', 'nature', 'Дъга', 85, 'sky-right',
    '<g class="sc-rainbow" fill="none" stroke-width="5"><path d="M-40 20A40 40 0 0 1 40 20" stroke="#e76f51"/><path d="M-32 20A32 32 0 0 1 32 20" stroke="#e9c46a"/><path d="M-24 20A24 24 0 0 1 24 20" stroke="#2a9d8f"/><path d="M-16 20A16 16 0 0 1 16 20" stroke="#4895ef"/></g>'),
]);

export const decorOf = (id) => DECOR.find((d) => d.id === id) || null;
export const decorForWorld = (worldId) => DECOR.filter((d) => d.world === worldId);

// Какво се вижда на сцената: купеното, без изключеното от детето.
export const activeDecor = (worldId, owned = [], off = []) => decorForWorld(worldId)
  .filter((d) => owned.includes(d.id) && !off.includes(d.id));

// Сцената като SVG: фонът е отделен слой, а предметите лягат по слотовете си.
export function sceneMarkup({ worldId, owned = [], off = [], sparkle = '' }) {
  const items = activeDecor(worldId, owned, off)
    .map((d) => `<g transform="${SLOTS[d.slot] || SLOTS.center}">${d.svg}</g>`)
    .join('');
  return `<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" class="scene-svg" aria-hidden="true">`
    + `${sparkle}<path class="sc-ground" d="M0 150h320v30H0Z"/>${items}</svg>`;
}
