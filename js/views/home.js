// Начален екран: същество, лента до следващата стъпка и голям бутон „Тренирай“.
import { SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { nextStepInfo } from '../core/evolution.js';
import { activeSkills, moduleForSkill } from '../core/registry.js';
import { state } from '../core/store.js';
import { avatarEl, creatureAt, formatXP, fullName, meter } from './ui.js';

const joinSkills = (skills) => skills.map((s) => SKILL_LABELS[s]).join(', ');

function hintFor(info) {
  if (info.isMax) return 'Това е върхът на стълбата. Залата остава отворена.';
  if (!info.xpReady) {
    return `${formatXP(info.xpInto)} от ${formatXP(info.xpCost)} XP до ${fullName(info.next)}`;
  }
  if (!info.blocked.length) return `Готово за ${fullName(info.next)}.`;
  return `XP е събран. Остава да развиеш: ${joinSkills(info.blocked)}.`;
}

export function renderHome(root) {
  const { profile } = state;
  const creature = creatureAt(profile.step);
  const info = nextStepInfo(profile, activeSkills(profile.step));

  mount(root,
    state.simSnapshot ? h('p', { class: 'badge-test' }, 'Тестов режим: реалният прогрес е запазен') : '',
    h('section', { class: 'hero' },
      h('div', { class: 'hero-avatar' }, avatarEl(creature)),
      h('h1', {}, fullName(profile.step)),
      h('p', { class: 'muted' }, creature.trait)),
    h('section', { class: 'next-step' },
      info.isMax ? null : meter(info.fraction, 'Напредък до следващата стъпка'),
      h('p', { class: 'next-hint', 'aria-live': 'polite' }, hintFor(info))),
    h('a', { class: 'btn btn-primary btn-big btn-train', href: '#/train' }, 'Тренирай'),
    h('section', { class: 'skills', 'aria-label': 'Шестте способности' },
      info.gates.map((g) => h('div', { class: `skill ${g.active ? (g.ok ? 'skill-ok' : '') : 'skill-inactive'}` },
        h('span', { class: 'skill-name' }, SKILL_LABELS[g.skill]),
        h('span', { class: 'skill-level' }, !g.active
          ? `Отключва се с модул ${moduleForSkill(g.skill)}`
          : (info.isMax ? `ниво ${g.level}` : `ниво ${g.level} / ${g.required}`))))),
  );
}
