// Общи части на изгледите: аватар, имена, икони.
import { h, trustedSvg } from '../core/dom.js';
import { creatureIndex, subLabel } from '../core/evolution.js';
import { state } from '../core/store.js';
import nature from '../content/skins/nature.js';

const SKINS = { nature };

export const activeSkin = () => SKINS[state.settings.skin] || nature;
export const creatureAt = (step) => activeSkin().creatures[creatureIndex(step)];
export const fullName = (step) => `${creatureAt(step).name} ${subLabel(step)}`;

export function avatarEl(creature, extraClass = '') {
  const el = trustedSvg(creature.avatar, `avatar ${extraClass}`);
  el.style.setProperty('--av', creature.colors[0]);
  el.style.setProperty('--av2', creature.colors[1]);
  return el;
}

export function meter(fraction, label) {
  const fill = h('div', { class: 'meter-fill' });
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  return h('div', {
    class: 'meter',
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(Math.round(fraction * 100)),
  }, fill);
}

export const formatXP = (x) => Math.floor(x).toLocaleString('bg-BG');
