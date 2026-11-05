// Обвивка на приложението: странична лента на десктоп, долна лента и плъзгащо се меню на телефон.
import { ALL_SUBTOPICS } from '../content/math/topics.js';
import { h, mount } from '../core/dom.js';
import { allGames, getGame, isUnlocked } from '../core/registry.js';
import { isHidden, recordOf, state } from '../core/store.js';
import { icon } from './icons.js';
import { avatarEl, creatureAt, fullName } from './ui.js';

const NAV = [
  { route: '', href: '#/', label: 'Начало', icon: 'house' },
  { route: 'math', href: '#/math', label: 'Математика', icon: 'sigma' },
  { route: 'games', href: '#/games', label: 'Игри', icon: 'brain' },
  { route: 'reflex', href: '#/reflex', label: 'Рефлекси', icon: 'zap' },
  { route: 'gallery', href: '#/gallery', label: 'Еволюция', icon: 'dna' },
  { route: 'profile', href: '#/profile', label: 'Профил', icon: 'user' },
];

const CATEGORY_ROUTE = { math: 'math', cognitive: 'games', reflex: 'reflex' };
const CATEGORY_ICON = { math: 'sigma', cognitive: 'brain', reflex: 'zap' };

const closeDrawer = () => document.body.classList.remove('drawer-open');
const openDrawer = () => document.body.classList.add('drawer-open');

// Коя точка от менюто свети за текущия маршрут.
function activeRoute(name, arg) {
  if (name === 'play') return CATEGORY_ROUTE[getGame(arg)?.category] || 'train';
  return name;
}

const navLink = (item, active) => h('a', {
  href: item.href,
  'aria-current': item.route === active ? 'page' : null,
  onclick: closeDrawer,
}, icon(item.icon), h('span', {}, item.label));

function moduleCard(game) {
  const step = state.profile.step;
  const open = isUnlocked(game, step);
  // „Ново“ значи отключено по пътя и още неотваряно. Нищо не се пази освен броя игри.
  const isNew = open && game.unlockStep > 0 && recordOf(game.id).plays === 0;
  const body = [
    icon(open ? CATEGORY_ICON[game.category] : 'lock'),
    h('span', { class: 'module-text' },
      h('strong', {}, game.title),
      h('span', {}, open ? game.description : `Отключва се при ${fullName(game.unlockStep)}`)),
    isNew ? h('span', { class: 'badge badge-new' }, 'Ново') : null,
  ];
  return open
    ? h('a', { class: 'module-card', href: game.route || `#/play/${game.id}`, onclick: closeDrawer }, body)
    : h('div', { class: 'module-card locked' }, body);
}

function subtopicCard(subtopic) {
  return h('a', { class: 'module-card', href: `#/math/${subtopic.id}`, onclick: closeDrawer },
    icon('sigma'),
    h('span', { class: 'module-text' }, h('strong', {}, subtopic.title), h('span', {}, subtopic.summary)));
}

// Игрите, които администраторът е скрил за този профил, просто ги няма в списъците.
const visibleGames = () => allGames().filter((g) => !isHidden(g.id));

function moduleList(query) {
  const q = query.trim().toLowerCase();
  if (!q) return visibleGames().map(moduleCard);
  const matches = (...texts) => texts.some((t) => t.toLowerCase().includes(q));
  const games = visibleGames().filter((g) => matches(g.title, g.description));
  const subtopics = ALL_SUBTOPICS.filter((s) => state.profile.step >= s.unlockStep && matches(s.title, s.summary));
  const items = [...games.map(moduleCard), ...subtopics.map(subtopicCard)];
  return items.length ? items : [h('p', { class: 'side-empty' }, 'Нищо не отговаря на търсенето.')];
}

function renderSidebar(sidebar, active) {
  const modules = h('div', { class: 'side-modules', 'aria-live': 'polite' }, moduleList(''));
  mount(sidebar,
    h('div', { class: 'side-top' },
      h('a', { class: 'side-avatar', href: '#/gallery', 'aria-label': fullName(state.profile.step), onclick: closeDrawer }, avatarEl(creatureAt(state.profile.step))),
      h('label', { class: 'search' },
        icon('search'),
        h('input', {
          type: 'search',
          placeholder: 'Търси модул',
          'aria-label': 'Търси модул или тема',
          oninput: (e) => modules.replaceChildren(...moduleList(e.target.value)),
        })),
      h('button', { class: 'btn btn-small btn-quiet side-close', type: 'button', 'aria-label': 'Затвори менюто', onclick: closeDrawer }, icon('x'))),
    h('a', { class: 'btn btn-primary btn-big', href: '#/train', onclick: closeDrawer }, icon('plus'), 'Тренирай'),
    h('nav', { class: 'side-nav', 'aria-label': 'Основна навигация' }, NAV.map((item) => navLink(item, active))),
    h('p', { class: 'side-heading' }, 'Твоите модули'),
    modules,
    h('div', { class: 'side-foot' },
      navLink({ route: 'settings', href: '#/settings', label: 'Настройки', icon: 'settings' }, active),
      h('a', { href: '#/settings', onclick: closeDrawer }, icon('archive'), h('span', {}, 'Експорт / Импорт')),
      // Смяната на профил затваря текущия: ключовете му излизат от паметта.
      h('a', {
        href: '#/who',
        onclick: () => { closeDrawer(); document.dispatchEvent(new CustomEvent('profile-close')); },
      }, icon('user'), h('span', {}, `Смени профила${state.entry ? ` (${state.entry.name})` : ''}`))));
}

function renderTabbar(tabbar, active) {
  mount(tabbar,
    NAV.slice(0, 4).map((item) => navLink(item, active)),
    h('button', {
      type: 'button',
      'aria-label': 'Още: Еволюция, Профил, Настройки',
      'aria-current': ['gallery', 'profile', 'settings', 'train'].includes(active) ? 'page' : null,
      onclick: openDrawer,
    }, icon('menu'), h('span', {}, 'Още')));
}

export function renderShell(name, arg) {
  // Докато няма отворен профил, менютата са празни: няма какво да се навигира
  // и нищо от профилите не бива да се вижда.
  document.body.classList.toggle('no-profile', !state.entry);
  if (!state.entry) {
    mount(document.getElementById('sidebar'));
    mount(document.getElementById('tabbar'));
    closeDrawer();
    return;
  }
  const active = activeRoute(name, arg);
  renderSidebar(document.getElementById('sidebar'), active);
  renderTabbar(document.getElementById('tabbar'), active);
  closeDrawer();
}

export function initShell() {
  document.getElementById('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
}
