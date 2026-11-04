// Начален екран: hero с текущото същество, трите подстепени и шестте способности.
import { CONFIG, SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { creatureIndex, nextStepInfo, subIndex } from '../core/evolution.js';
import { activeSkills, moduleForSkill } from '../core/registry.js';
import { state } from '../core/store.js';
import { icon } from './icons.js';
import { dueSubtopics } from './math.js';
import { activeSkin, avatarEl, creatureAt, formatXP, fullName, meter } from './ui.js';

const SUB_NAMES = ['I', 'II', 'III'];
const joinSkills = (skills) => skills.map((s) => SKILL_LABELS[s]).join(', ');

function hintFor(info) {
  if (info.isMax) return 'Това е върхът на стълбата.';
  if (!info.xpReady) return `${formatXP(info.xpInto)} от ${formatXP(info.xpCost)} XP до ${fullName(info.next)}`;
  if (!info.blocked.length) return `Готово за ${fullName(info.next)}.`;
  return `XP е събран. Остава практика в: ${joinSkills(info.blocked)}.`;
}

function nextLine(step) {
  const next = activeSkin().creatures[creatureIndex(step) + 1];
  return next ? `Следва: ${next.name}.` : 'Залата остава отворена.';
}

function substeps(step) {
  const creature = creatureAt(step);
  const current = subIndex(step);
  return h('ol', { class: 'substeps', 'aria-label': `Подстепени на ${creature.name}` },
    Array.from({ length: CONFIG.SUBSTEPS }, (_, i) => {
      const status = i < current ? 'done' : i === current ? 'current' : 'next';
      return h('li', { class: `substep ${status}` },
        h('span', { class: 'substep-mark' }, status === 'done' ? icon('check') : SUB_NAMES[i]),
        h('span', {},
          h('strong', {}, `${creature.name} ${SUB_NAMES[i]}`),
          h('span', { class: 'substep-note' }, status === 'done' ? 'Премината' : status === 'current' ? 'Тук си сега' : 'Напред')));
    }));
}

export function renderHome(root) {
  const { profile } = state;
  const creature = creatureAt(profile.step);
  const info = nextStepInfo(profile, activeSkills(profile.step));
  const due = dueSubtopics().length;

  mount(root,
    state.simSnapshot ? h('p', { class: 'badge badge-test' }, 'Тестов режим: реалният прогрес е запазен') : null,
    h('section', { class: 'hero' },
      h('div', { class: 'hero-art', 'aria-hidden': 'true' }, avatarEl(creature)),
      h('div', { class: 'hero-main' },
        h('div', { class: 'hero-avatar' }, avatarEl(creature)),
        h('h1', {}, `Ти си ${fullName(profile.step)}.`, h('span', { class: 'title-sub' }, nextLine(profile.step))),
        h('p', { class: 'hero-trait' }, creature.trait),
        h('div', { class: 'next-step' },
          info.isMax ? null : meter(info.fraction, 'Напредък до следващата стъпка'),
          h('p', { class: 'next-hint', 'aria-live': 'polite' }, hintFor(info))),
        h('a', { class: 'btn btn-pill', href: '#/train' }, 'Продължи тренировката', icon('arrow-up-right'))),
      substeps(profile.step)),
    due ? h('a', { class: 'review-link', href: '#/math' }, `Готови за преговор: ${due}`) : null,
    h('h2', { class: 'section-title' }, 'Шестте способности'),
    h('section', { class: 'skills', 'aria-label': 'Шестте способности' },
      info.gates.map((g) => h('div', { class: `skill ${g.active ? (g.ok ? 'skill-ok' : '') : 'skill-inactive'}` },
        h('span', { class: 'skill-name' }, SKILL_LABELS[g.skill]),
        h('span', { class: 'skill-level' }, !g.active
          ? `Отключва се с модул ${moduleForSkill(g.skill)}`
          : (info.isMax ? `ниво ${g.level}` : `ниво ${g.level} / ${g.required}`))))),
    h('p', { class: 'practice-note' }, 'Нивото показва натрупана практика в задачите.'));
}
