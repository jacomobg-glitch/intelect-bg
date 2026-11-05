// „Създай своя герой“: цвят, шапка, инструмент и име. Всичко е оригинално и е данни,
// затова нов елемент значи нов ред тук, без да се пипа механиката.
// Шапките и инструментите лягат на едни и същи места във всеки свят: главата е около
// y = 24, ръката държи инструмента вдясно. Затова един набор пасва на всички герои.

export const HERO_COLORS = Object.freeze([
  { id: 'green', name: 'Зелено', colors: ['#8fdc9a', '#c8f0b0'] },
  { id: 'blue', name: 'Синьо', colors: ['#4895ef', '#9ec5f5'] },
  { id: 'orange', name: 'Оранжево', colors: ['#e8873d', '#f5bb8a'] },
  { id: 'violet', name: 'Лилаво', colors: ['#9b5de5', '#c9a7f0'] },
  { id: 'red', name: 'Червено', colors: ['#ef476f', '#f99bb3'] },
  { id: 'sand', name: 'Пясък', colors: ['#f2cc8f', '#f8e3bc'] },
]);

// Шапките: първите две са налични от самото начало, останалите се купуват.
export const HATS = Object.freeze([
  { id: 'none', name: 'Без шапка', free: true, svg: '' },
  {
    id: 'cap', name: 'Каскет', free: true,
    svg: '<path class="av-a" d="M32 16a18 14 0 0 1 36 0v3H32Z"/><path class="av-a" d="M68 19h14v5H68Z"/>',
  },
  {
    id: 'helmet', name: 'Каска', free: false,
    svg: '<path class="av-e" d="M30 20a20 16 0 0 1 40 0v4H30Z"/><rect class="av-e" x="28" y="24" width="44" height="4" rx="2"/>',
  },
  {
    id: 'crown', name: 'Корона', free: false,
    svg: '<path class="av-e" d="M32 20 36 8l7 8 7-10 7 10 7-8 4 12Z"/>',
  },
  {
    id: 'leaf', name: 'Листо', free: false,
    svg: '<path class="av-a" d="M50 14C36 12 30 4 32-2c10-2 18 6 18 16Z" transform="translate(0 8)"/>',
  },
  {
    id: 'pilot', name: 'Пилотска шапка', free: false,
    svg: '<path class="av-a" d="M30 22a20 16 0 0 1 40 0v2H30Z"/><rect class="av-e" x="34" y="14" width="32" height="7" rx="3" opacity=".85"/>',
  },
]);

export const TOOLS = Object.freeze([
  { id: 'none', name: 'Без инструмент', free: true, svg: '' },
  {
    id: 'spade', name: 'Дървена лопатка', free: true,
    svg: '<path class="av-l av-thick" d="M78 40v22"/><path class="av-a" d="M70 62h16v12a8 8 0 0 1-16 0Z"/>',
  },
  {
    id: 'pickaxe', name: 'Желязна кирка', free: false,
    svg: '<path class="av-l av-thick" d="M78 36v30"/><path class="av-e" d="M62 36q16-10 32 0-16 6-32 0Z"/>',
  },
  {
    id: 'wrench', name: 'Ключ', free: false,
    svg: '<path class="av-l av-thick" d="M74 66 86 42"/><path class="av-e" d="M82 34a8 8 0 1 1 8 14l-4-7Z"/>',
  },
  {
    id: 'can', name: 'Лейка', free: false,
    svg: '<path class="av-a" d="M68 52h18v16a6 6 0 0 1-6 6h-6a6 6 0 0 1-6-6Z"/><path class="av-l" d="M86 56 94 48M68 56l-6-4"/>',
  },
  {
    id: 'jetpack', name: 'Летящ ранец', free: false,
    svg: '<rect class="av-a" x="18" y="44" width="12" height="24" rx="4"/><path class="av-e" d="M20 68h8l-4 14Z"/>',
  },
]);

export const DEFAULT_HERO = Object.freeze({ color: 'green', hat: 'cap', tool: 'spade', name: '' });

const byId = (list, id) => list.find((x) => x.id === id) || list[0];

export const hatOf = (id) => byId(HATS, id);
export const toolOf = (id) => byId(TOOLS, id);
export const colorOf = (id) => byId(HERO_COLORS, id);

export const FREE_PARTS = Object.freeze([
  ...HATS.filter((h) => h.free).map((h) => `hat-${h.id}`),
  ...TOOLS.filter((t) => t.free).map((t) => `tool-${t.id}`),
]);

// Какво е налично: безплатното плюс купеното. Нищо друго не се показва като избор.
export const availableHats = (owned = []) => HATS.filter((h) => h.free || owned.includes(`hat-${h.id}`));
export const availableTools = (owned = []) => TOOLS.filter((t) => t.free || owned.includes(`tool-${t.id}`));

// Проверява избора: непозната или некупена част пада до безплатната.
export function cleanHero(raw, owned = []) {
  const base = { ...DEFAULT_HERO };
  if (!raw || typeof raw !== 'object') return base;
  if (HERO_COLORS.some((c) => c.id === raw.color)) base.color = raw.color;
  if (availableHats(owned).some((h) => h.id === raw.hat)) base.hat = raw.hat;
  if (availableTools(owned).some((t) => t.id === raw.tool)) base.tool = raw.tool;
  if (typeof raw.name === 'string') base.name = raw.name.replace(/\s+/g, ' ').trim().slice(0, 16);
  return base;
}

// Как се казва героят: избраното от детето име, иначе временното име на света.
export const heroName = (world, hero) => (hero && hero.name) || (world.hero && world.hero.name) || 'Героят';

// Сглобява героя: тяло от света, отгоре шапка и инструмент.
export function heroMarkup(world, hero) {
  if (!world.hero) return null;
  const parts = [world.hero.base, hatOf(hero.hat).svg, toolOf(hero.tool).svg].filter(Boolean).join('');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
}
