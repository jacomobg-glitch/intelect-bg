// Общи части на изгледите: аватар, имена, икони, думите на активния свят.
import { colorOf, heroMarkup, heroName } from '../content/hero.js';
import { creatureAt as creatureOf, isDrops, unlockWord as unlockOf, worldOf, xpLong, xpWord } from '../content/worlds/index.js';
import { text as pickText } from '../content/texts.js';
import { h, trustedSvg } from '../core/dom.js';
import { creatureIndex, subLabel } from '../core/evolution.js';
import { isChild, state } from '../core/store.js';

// Светът на отворения профил. Непознат или изтрит свят пада до „Природа“.
export const activeWorld = () => worldOf(state.settings.world);

// Старото име: все още се ползва на места, където става дума за визията на стълбата.
export const activeSkin = activeWorld;

export const creatureAt = (step, world = activeWorld()) => creatureOf(world, creatureIndex(step));
export const fullName = (step, world = activeWorld()) => `${creatureAt(step, world).name} ${subLabel(step)}`;

// Как този свят нарича XP: „XP“ навсякъде, „капки“ в градината.
export const xpName = () => xpWord(activeWorld());
export const xpNameLong = () => xpLong(activeWorld());
export const xpIsWater = () => isDrops(activeWorld());
export const unlockPhrase = () => unlockOf(activeWorld());

// Колко XP има в едно число, с думата на света: „40 XP“ или „40 капки“.
export const withXP = (value) => `${formatXP(value)} ${xpName()}`;

// Текст според профила: детският получава своята версия, останалите — стандартната.
export const t = (key, params = {}) => pickText(key, { kid: isChild(), ...params });

export function avatarEl(creature, extraClass = '') {
  const el = trustedSvg(creature.avatar, `avatar ${extraClass}`);
  el.style.setProperty('--av', creature.colors[0]);
  el.style.setProperty('--av2', creature.colors[1]);
  return el;
}

// Героят на света, сглобен с избраните цвят, шапка и инструмент.
export function heroEl(extraClass = '', world = activeWorld(), hero = state.settings.hero) {
  const markup = heroMarkup(world, hero);
  if (!markup) return null;
  const el = trustedSvg(markup, `avatar ${extraClass}`);
  const { colors } = colorOf(hero.color);
  el.style.setProperty('--av', colors[0]);
  el.style.setProperty('--av2', colors[1]);
  return el;
}

export const worldHeroName = (world = activeWorld(), hero = state.settings.hero) => heroName(world, hero);

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
