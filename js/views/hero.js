// „Създай своя герой“: цвят, шапка, инструмент и име. Изборът се пази в профила
// и важи навсякъде в него. Показват се само безплатните и купените части —
// нищо заключено не се върти пред очите като примамка.
import {
  HERO_COLORS, availableHats, availableTools, cleanHero, heroName,
} from '../content/hero.js';
import { h, mount, toast } from '../core/dom.js';
import { saveSettings, state } from '../core/store.js';
import { activeWorld, heroEl } from './ui.js';

export function renderHero(root) {
  const world = activeWorld();
  if (!world.hero) {
    mount(root,
      h('a', { class: 'back', href: '#/settings' }, '← Настройки'),
      h('h1', { class: 'page-title' }, 'Създай своя герой'),
      h('p', {}, `В света „${world.name}“ героят си ти: ти си съществото, което расте.`),
      h('p', { class: 'muted' }, 'Другите светове имат отделен герой, който можеш да облечеш.'),
      h('a', { class: 'btn', href: '#/settings' }, 'Избери друг свят'));
    return;
  }

  const owned = state.profile.owned || [];
  let draft = cleanHero(state.settings.hero, owned);

  const preview = h('div', { class: 'hero-preview' });
  const title = h('p', { class: 'hero-name-line' }, '');
  const paint = () => {
    preview.replaceChildren(heroEl('hero-big', world, draft));
    title.textContent = heroName(world, draft);
  };

  const nameInput = h('input', {
    type: 'text', class: 'text-input', maxlength: '16', value: draft.name,
    placeholder: world.hero.name, 'aria-label': 'Име на героя',
    oninput: (e) => { draft = { ...draft, name: e.target.value }; paint(); },
  });

  const group = (label, items, key, render) => h('div', { class: 'hero-group' },
    h('h2', {}, label),
    h('div', { class: 'hero-choices', role: 'group', 'aria-label': label }, items.map((item) => {
      const button = h('button', {
        type: 'button',
        class: `hero-choice${draft[key] === item.id ? ' hero-choice-on' : ''}`,
        'aria-pressed': String(draft[key] === item.id),
        'aria-label': item.name,
        onclick: () => {
          draft = { ...draft, [key]: item.id };
          for (const other of button.parentElement.children) {
            const on = other === button;
            other.classList.toggle('hero-choice-on', on);
            other.setAttribute('aria-pressed', String(on));
          }
          paint();
        },
      }, render(item));
      return button;
    })));

  const swatch = (item) => {
    const dot = h('span', { class: 'hero-swatch' });
    dot.style.background = `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})`;
    return [dot, h('span', { class: 'small' }, item.name)];
  };

  const save = async () => {
    await saveSettings({ hero: cleanHero(draft, owned) });
    toast('Героят е готов.');
    location.hash = '#/';
  };

  mount(root,
    h('a', { class: 'back', href: '#/settings' }, '← Настройки'),
    h('h1', { class: 'page-title' }, 'Създай своя герой'),
    h('p', { class: 'muted' }, world.hero.note),
    h('div', { class: 'hero-stage' }, preview, title),
    h('label', { class: 'field' }, h('span', { class: 'small muted' }, 'Име (твоето име за героя)'), nameInput),
    group('Цвят', HERO_COLORS, 'color', swatch),
    group('Шапка', availableHats(owned), 'hat', (item) => h('span', { class: 'small' }, item.name)),
    group('Инструмент', availableTools(owned), 'tool', (item) => h('span', { class: 'small' }, item.name)),
    h('p', { class: 'muted small' }, 'Още шапки и инструменти се купуват от магазина с монети от практиката.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: save }, 'Запази'),
      h('a', { class: 'btn', href: '#/shop' }, 'Магазин')));

  paint();
}
