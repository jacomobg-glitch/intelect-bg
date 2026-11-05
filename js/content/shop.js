// Магазинът: само украса. Нищо тук не ускорява XP, не прескача нива и не прави
// игрите по-лесни — това е правило, не настройка. Монетите се печелят с практика
// и не изгарят при пауза. Няма реални пари, няма оферти с таймер и няма натиск.
import { HATS, TOOLS } from './hero.js';

// Колко монети носи една сесия: една монета на всеки толкова XP, най-малко една,
// когато изобщо има верен отговор. Монетите вървят в същия поток като XP, затова
// не могат да се „фармят“ по друг начин освен с практика.
export const XP_PER_COIN = 10;
export const coinsFor = (xp) => (xp > 0 ? Math.max(1, Math.round(xp / XP_PER_COIN)) : 0);

// Фоновете и украсите са чист external вид: сменят само картинката зад стълбата.
const BACKGROUNDS = [
  { id: 'bg-night', name: 'Звездна нощ', price: 60, kind: 'background' },
  { id: 'bg-dawn', name: 'Изгрев', price: 60, kind: 'background' },
  { id: 'bg-rain', name: 'Тих дъжд', price: 80, kind: 'background' },
];

const DECOR = [
  { id: 'decor-bench', name: 'Пейка в градината', price: 50, kind: 'decor', world: 'garden' },
  { id: 'decor-pond', name: 'Малко езеро', price: 90, kind: 'decor', world: 'garden' },
  { id: 'decor-lantern', name: 'Фенер на моста', price: 70, kind: 'decor', world: 'builder' },
  { id: 'decor-flag', name: 'Знаме на кулата', price: 50, kind: 'decor', world: 'builder' },
  { id: 'decor-garage', name: 'Табела на гаража', price: 60, kind: 'decor', world: 'city' },
  { id: 'decor-comet', name: 'Комета в далечината', price: 80, kind: 'decor', world: 'space' },
];

// Цените са подредени така, че първата покупка да идва след няколко сесии,
// а не след седмици. Нищо не е заключено зад „скоро“ или зад пари.
const PRICES = { hat: 40, tool: 55 };

export const SHOP_ITEMS = Object.freeze([
  ...HATS.filter((h) => !h.free).map((h) => ({ id: `hat-${h.id}`, name: h.name, price: PRICES.hat, kind: 'hat' })),
  ...TOOLS.filter((t) => !t.free).map((t) => ({ id: `tool-${t.id}`, name: t.name, price: PRICES.tool, kind: 'tool' })),
  ...BACKGROUNDS,
  ...DECOR,
]);

export const KIND_LABELS = Object.freeze({
  hat: 'Шапки',
  tool: 'Инструменти',
  background: 'Фонове',
  decor: 'Украса за света',
});

export const KIND_ORDER = Object.freeze(['hat', 'tool', 'background', 'decor']);

export const itemOf = (id) => SHOP_ITEMS.find((item) => item.id === id) || null;
export const isOwned = (owned, id) => owned.includes(id);
export const canAfford = (coins, id) => {
  const item = itemOf(id);
  return Boolean(item) && coins >= item.price;
};

// Какво се предлага в този свят: общите неща плюс украсата за него.
export const itemsForWorld = (worldId) => SHOP_ITEMS.filter((item) => !item.world || item.world === worldId);
