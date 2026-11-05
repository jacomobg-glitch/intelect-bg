// Магазинът: само украса. Нищо тук не ускорява XP, не прескача нива и не прави
// игрите по-лесни — това е правило, не настройка. Монетите се печелят с практика
// и не изгарят при пауза. Няма реални пари, няма оферти със срок и няма натиск.
//
// Всеки предмет ТРЯБВА да има преглед: купено, но невидимо, е нарушено обещание.
// Тест пази това — предмет без preview не влиза в списъка.
import { BACKGROUNDS } from './backgrounds.js';
import { DECOR } from './decor.js';
import { HATS, TOOLS } from './hero.js';

// Колко монети носи една сесия: една монета на всеки толкова XP, най-малко една,
// когато изобщо има верен отговор. Монетите вървят в същия поток като XP, затова
// не могат да се трупат по друг начин освен с практика.
export const XP_PER_COIN = 10;
export const coinsFor = (xp) => (xp > 0 ? Math.max(1, Math.round(xp / XP_PER_COIN)) : 0);

// Цените са подредени така, че първата покупка да идва след няколко сесии,
// а не след седмици.
const PRICES = { hat: 40, tool: 55 };

export const SHOP_ITEMS = Object.freeze([
  ...HATS.filter((h) => !h.free).map((h) => ({ id: `hat-${h.id}`, name: h.name, price: PRICES.hat, kind: 'hat', part: h.id })),
  ...TOOLS.filter((t) => !t.free).map((t) => ({ id: `tool-${t.id}`, name: t.name, price: PRICES.tool, kind: 'tool', part: t.id })),
  ...BACKGROUNDS.map((b) => ({ id: b.id, name: b.name, price: b.price, kind: 'background' })),
  ...DECOR.map((d) => ({ id: d.id, name: d.name, price: d.price, kind: 'decor', world: d.world })),
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

// --- прегледът „така ще изглежда“ ---

const hatOf = (id) => HATS.find((h) => h.id === id);
const toolOf = (id) => TOOLS.find((t) => t.id === id);
const decorOf = (id) => DECOR.find((d) => d.id === id);
const backgroundOf = (id) => BACKGROUNDS.find((b) => b.id === id);

// Бледа фигура, върху която се вижда как ляга шапката или инструментът.
const DUMMY = '<rect class="pv-body" x="34" y="36" width="32" height="30" rx="4"/>'
  + '<rect class="pv-body" x="36" y="12" width="28" height="24" rx="4"/>'
  + '<rect class="pv-body" x="26" y="40" width="8" height="20" rx="2"/>'
  + '<rect class="pv-body" x="66" y="40" width="8" height="20" rx="2"/>';

export function previewMarkup(item) {
  if (!item) return null;
  if (item.kind === 'hat' || item.kind === 'tool') {
    const part = item.kind === 'hat' ? hatOf(item.part) : toolOf(item.part);
    if (!part || !part.svg) return null;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="pv pv-hero" aria-hidden="true">${DUMMY}${part.svg}</svg>`;
  }
  if (item.kind === 'background') {
    const background = backgroundOf(item.id);
    if (!background) return null;
    // Спиранията са променливи: същият преглед работи и в светла, и в тъмна тема.
    return `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg" class="pv pv-bg" aria-hidden="true">`
      + `<defs><linearGradient id="pv-${item.id}" x1="0" y1="0" x2="0.3" y2="1">`
      + '<stop class="pv-from" offset="0"/><stop class="pv-to" offset="1"/></linearGradient></defs>'
      + `<rect x="0" y="0" width="100" height="60" rx="6" fill="url(#pv-${item.id})"/></svg>`;
  }
  if (item.kind === 'decor') {
    const decor = decorOf(item.id);
    if (!decor) return null;
    return `<svg viewBox="-55 -58 110 70" xmlns="http://www.w3.org/2000/svg" class="pv pv-decor" aria-hidden="true">`
      + `<path class="sc-ground" d="M-55 0h110v12h-110Z"/>${decor.svg}</svg>`;
  }
  return null;
}

// Всеки предмет има преглед: проверява се и в тестовете, и преди показване.
export const hasPreview = (item) => typeof previewMarkup(item) === 'string';
