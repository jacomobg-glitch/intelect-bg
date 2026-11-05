// „Моят свят“: сцената, на която се вижда купената украса и избраният фон.
// Всеки предмет се включва и изключва поотделно — купеното е твое, но ти решаваш
// дали да стои на сцената.
import { sparkleMarkup } from '../content/backgrounds.js';
import { activeDecor, decorForWorld, sceneMarkup } from '../content/decor.js';
import { h, mount, trustedSvg } from '../core/dom.js';
import { saveSettings, state } from '../core/store.js';
import { activeWorld, applyScene, heroEl } from './ui.js';

// Самата сцена: фон, украса и героят отпред. Ползва се и от галерията.
export function sceneEl(extraClass = '') {
  const world = activeWorld();
  const owned = state.profile.owned || [];
  const off = state.settings.decorOff || [];
  const svg = sceneMarkup({
    worldId: world.id,
    owned,
    off,
    sparkle: sparkleMarkup(state.settings.background),
  });
  const box = h('div', { class: `scene ${extraClass}`.trim() }, trustedSvg(svg, 'scene-art'));
  const hero = heroEl('scene-hero');
  if (hero) box.append(hero);
  return applyScene(box);
}

export function renderScene(root) {
  const rerender = () => renderScene(root);
  const world = activeWorld();
  const owned = state.profile.owned || [];
  const off = state.settings.decorOff || [];
  const mine = decorForWorld(world.id).filter((d) => owned.includes(d.id));
  const shown = activeDecor(world.id, owned, off).length;

  const toggle = async (id, on) => {
    const next = on ? off.filter((x) => x !== id) : [...new Set([...off, id])];
    await saveSettings({ decorOff: next });
    rerender();
  };

  mount(root,
    h('h1', { class: 'page-title' }, 'Моят свят'),
    h('p', { class: 'muted' }, `${world.name}: ${world.tagline}.`),
    sceneEl('scene-big'),
    h('section', { class: 'group' },
      h('h2', {}, 'Украса'),
      mine.length
        ? [
          h('p', { class: 'muted small' }, `${shown} от ${mine.length} ${mine.length === 1 ? 'предмет е' : 'предмета са'} на сцената. Махнатото си остава твое.`),
          h('div', { class: 'decor-list' }, mine.map((d) => h('label', { class: 'check decor-row' },
            h('input', {
              type: 'checkbox',
              checked: !off.includes(d.id),
              onchange: (e) => toggle(d.id, e.target.checked),
            }),
            h('span', {}, d.name)))),
        ]
        : h('p', { class: 'muted small' }, 'Още няма украса за този свят. Купува се от магазина с монети от практиката.')),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '#/shop' }, 'Магазин'),
      world.hero ? h('a', { class: 'btn', href: '#/hero' }, 'Създай своя герой') : null));
}
