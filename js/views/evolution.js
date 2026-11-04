// Анимация на трансформацията. Показва се само при реално изкачване.
import { h } from '../core/dom.js';
import { creatureIndex, difficultyCeiling, subLabel } from '../core/evolution.js';
import { unlockedBetween } from '../core/registry.js';
import { activeSkin, avatarEl, fullName } from './ui.js';

const PARTICLES = 18;

function burst() {
  return Array.from({ length: PARTICLES }, (_, i) => {
    const angle = (i / PARTICLES) * Math.PI * 2;
    const dist = 90 + Math.random() * 70;
    return h('span', {
      class: 'evo-particle',
      vars: { '--dx': `${Math.cos(angle) * dist}px`, '--dy': `${Math.sin(angle) * dist}px` },
    });
  });
}

// Какво реално се отключва: само неща, които вече съществуват в приложението.
export function unlocksBetween(from, to) {
  const items = unlockedBetween(from, to).map((g) => `Нов модул: ${g.title}`);
  if (creatureIndex(to) > creatureIndex(from)) {
    items.push(`По-висок таван на трудността в игрите: до ${difficultyCeiling(to)}`);
  }
  return items;
}

export function showEvolution(from, to) {
  return new Promise((resolve) => {
    const skin = activeSkin();
    const oldC = skin.creatures[creatureIndex(from)];
    const newC = skin.creatures[creatureIndex(to)];
    const isNewCreature = creatureIndex(to) > creatureIndex(from);
    const unlocks = unlocksBetween(from, to);

    const close = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const button = h('button', { class: 'btn btn-primary btn-big', onclick: close }, 'Продължи');

    const overlay = h('div', {
      class: `evo-overlay ${isNewCreature ? 'evo-major' : 'evo-minor'}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': `Еволюция: ${fullName(to)}`,
    },
      h('div', { class: 'evo-stage' },
        h('div', { class: 'evo-ring' }),
        isNewCreature ? h('div', { class: 'evo-from' }, avatarEl(oldC)) : null,
        h('div', { class: 'evo-to' }, avatarEl(newC)),
        isNewCreature ? burst() : null),
      h('div', { class: 'evo-text' },
        h('p', { class: 'evo-kicker' }, isNewCreature ? 'Еволюция' : `Подстепен ${subLabel(to)}`),
        h('h2', {}, fullName(to)),
        isNewCreature
          ? [h('p', {}, newC.can), h('p', { class: 'evo-you' }, newC.you)]
          : h('p', {}, `Подстепен ${subLabel(to)} на ${newC.name}: още практика в „${newC.trait}“.`),
        unlocks.length
          ? h('div', { class: 'evo-unlocks' }, h('h3', {}, 'Отключва се'), h('ul', {}, unlocks.map((u) => h('li', {}, u))))
          : null,
        button));

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    button.focus({ preventScroll: true });
  });
}
