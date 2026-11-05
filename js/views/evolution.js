// Анимация на трансформацията. Показва се само при реално изкачване.
import { h } from '../core/dom.js';
import { creatureIndex, difficultyCeiling, subLabel } from '../core/evolution.js';
import { unlockedBetween } from '../core/registry.js';
import { animOf } from '../content/worlds/index.js';
import { activeSkin, activeWorld, avatarEl, fullName, unlockPhrase } from './ui.js';

// Колко трае превръщането. В границите 1.5–2.5 секунди: достатъчно да се види,
// недостатъчно да отегчи. Подстепента е по-кратка, защото е по-малко събитие.
export const MAJOR_MS = 2200;
export const MINOR_MS = 1600;
export const REDUCED_MS = 320;

// Декорът на всяка анимация. Само форми: цветовете идват от CSS.
const DECOR = {
  blocks: () => h('div', { class: 'evo-fx evo-fx-blocks', 'aria-hidden': 'true' },
    Array.from({ length: 6 }, (_, i) => h('span', { class: `evo-cube evo-cube-${i + 1}` }))),
  water: () => h('div', { class: 'evo-fx evo-fx-water', 'aria-hidden': 'true' },
    h('span', { class: 'evo-can' }),
    Array.from({ length: 3 }, (_, i) => h('span', { class: `evo-drop evo-drop-${i + 1}` }))),
  mission: () => h('div', { class: 'evo-fx evo-fx-mission', 'aria-hidden': 'true' },
    h('span', { class: 'evo-road' }),
    h('span', { class: 'evo-ribbon' }, 'Мисия изпълнена!')),
  spark: () => h('div', { class: 'evo-fx evo-fx-spark', 'aria-hidden': 'true' },
    Array.from({ length: 8 }, (_, i) => h('span', { class: `evo-ray evo-ray-${i + 1}` }))),
  fade: () => null,
};

// Какво реално се отключва: само неща, които вече съществуват в приложението.
export function unlocksBetween(from, to) {
  const items = unlockedBetween(from, to).map((g) => `Нов модул: ${g.title}`);
  if (creatureIndex(to) > creatureIndex(from)) {
    items.push(`По-висок таван на трудността: до ${difficultyCeiling(to)}`);
  }
  return items;
}

const layer = (name, child) => h('div', { class: `evo-layer ${name}` }, child);

export function showEvolution(from, to) {
  return new Promise((resolve) => {
    const skin = activeSkin();
    const oldC = skin.creatures[creatureIndex(from)];
    const newC = skin.creatures[creatureIndex(to)];
    const isNewCreature = creatureIndex(to) > creatureIndex(from);
    const unlocks = unlocksBetween(from, to);

    const anim = animOf(activeWorld());
    // При „по-малко движение“ остава само кратко преливане: без летящи кубчета и пръски.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? REDUCED_MS : (isNewCreature ? MAJOR_MS : MINOR_MS);

    const close = () => {
      clearTimeout(timer);
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve();
    };
    // Докато трае превръщането, бутонът прескача; после продължава.
    const button = h('button', { class: 'btn btn-primary btn-big', onclick: () => (running ? settle() : close()) }, 'Прескочи');
    let running = true;
    const settle = () => {
      if (!running) return;
      running = false;
      clearTimeout(timer);
      overlay.classList.add('evo-done');
      button.textContent = 'Продължи';
      button.focus({ preventScroll: true });
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (running) settle();
      else close();
    };
    const timer = setTimeout(settle, duration);

    // Цветно → силует → размит преход → нов силует → цветно.
    const stage = isNewCreature
      ? [
        layer('evo-from', avatarEl(oldC)),
        layer('evo-from-sil', avatarEl(oldC, 'silhouette')),
        layer('evo-to-sil', avatarEl(newC, 'silhouette')),
        layer('evo-to', avatarEl(newC)),
      ]
      : [layer('evo-to', avatarEl(newC))];

    const overlay = h('div', {
      class: `evo-overlay ${isNewCreature ? 'evo-major' : 'evo-minor'} evo-${anim}${reduced ? ' evo-reduced' : ''}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': `Еволюция: ${fullName(to)}`,
    },
      h('div', { class: 'evo-stage' }, h('div', { class: 'evo-ring' }), stage, reduced ? null : DECOR[anim]()),
      h('div', { class: 'evo-text' },
        h('p', { class: 'evo-kicker' }, isNewCreature ? 'Еволюция' : `Подстепен ${subLabel(to)}`),
        h('h2', {}, fullName(to)),
        isNewCreature
          ? [h('p', {}, newC.can), h('p', { class: 'evo-you' }, newC.you)]
          : h('p', {}, `Подстепен ${subLabel(to)} на ${newC.name}: още практика в „${newC.trait}“.`),
        unlocks.length
          // Светът казва отключването със своите думи: „Мисия изпълнена! Отключи:“ в града.
          ? h('div', { class: 'evo-unlocks' }, h('h3', {}, unlockPhrase()), h('ul', {}, unlocks.map((u) => h('li', {}, u))))
          : null,
        button));

    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    button.focus({ preventScroll: true });
  });
}
