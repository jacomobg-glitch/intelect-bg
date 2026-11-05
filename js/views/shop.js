// Магазинът: само украса. Нищо купено не дава предимство в игрите и в математиката.
// Няма реални пари, няма оферти с таймер и няма „само днес“. Монетите не изгарят.
import { KIND_LABELS, KIND_ORDER, itemsForWorld, previewMarkup } from '../content/shop.js';
import { backgroundVars } from '../content/backgrounds.js';
import { h, mount, toast, trustedSvg } from '../core/dom.js';
import { buyItem, saveSettings, state } from '../core/store.js';
import { activeWorld, formatXP } from './ui.js';

const coinWord = (n) => (n === 1 ? 'монета' : 'монети');

export function renderShop(root) {
  const rerender = () => renderShop(root);
  const world = activeWorld();
  const coins = state.profile.coins || 0;
  const owned = state.profile.owned || [];

  const buy = async (item) => {
    const ok = await buyItem(item);
    if (!ok) { toast('Още не стигат монетите.'); return; }
    toast(`Купи „${item.name}“.`);
    rerender();
  };

  // Фонът се включва и изключва по желание: купеното не се натрапва.
  const useBackground = async (id) => {
    const next = state.settings.background === id ? null : id;
    await saveSettings({ background: next });
    toast(next ? 'Фонът е сложен.' : 'Фонът е махнат.');
    rerender();
  };

  const card = (item) => {
    const mine = owned.includes(item.id);
    const action = mine
      ? (item.kind === 'background'
        ? h('button', {
          class: `btn btn-small${state.settings.background === item.id ? ' btn-primary' : ''}`,
          type: 'button',
          onclick: () => useBackground(item.id),
        }, state.settings.background === item.id ? 'Сложен' : 'Сложи')
        : h('span', { class: 'badge badge-done' }, 'Твое'))
      : h('button', {
        class: 'btn btn-small',
        type: 'button',
        disabled: coins < item.price,
        onclick: () => buy(item),
      }, `${item.price} ${coinWord(item.price)}`);
    // Прегледът „така ще изглежда“ стои над цената: купува се видяно, не описано.
    const preview = trustedSvg(previewMarkup(item), 'shop-preview');
    if (item.kind === 'background') {
      for (const [name, value] of Object.entries(backgroundVars(item.id) || {})) preview.style.setProperty(name, value);
    }
    return h('div', { class: `card shop-item${mine ? ' shop-item-own' : ''}` },
      preview,
      h('strong', {}, item.name),
      h('span', { class: 'small muted' }, KIND_LABELS[item.kind]),
      action);
  };

  // Предмет без преглед не се показва: купено, но невидимо, е нарушено обещание.
  const items = itemsForWorld(world.id).filter((item) => previewMarkup(item));
  const groups = KIND_ORDER
    .map((kind) => [kind, items.filter((item) => item.kind === kind)])
    .filter(([, list]) => list.length);

  mount(root,
    h('h1', { class: 'page-title' }, 'Магазин'),
    h('div', { class: 'card shop-purse' },
      h('strong', {}, `${formatXP(coins)} ${coinWord(coins)}`),
      h('span', { class: 'small muted' }, 'Монетите идват от практиката и остават при теб. Не изгарят и не изтичат.')),
    h('p', { class: 'muted small' }, 'Тук се купува само украса: шапки, инструменти, фонове. Нищо не ускорява напредъка и не прави задачите по-лесни.'),
    groups.map(([kind, list]) => h('section', { class: 'group' },
      h('h2', {}, KIND_LABELS[kind]),
      h('div', { class: 'shop-grid' }, list.map(card)))),
    h('a', { class: 'btn', href: '#/hero' }, 'Към героя'));
}
