// Начален екран: hero с текущото същество, трите подстепени и шестте способности.
import { CONFIG, SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { creatureIndex, nearestObstacle, subIndex } from '../core/evolution.js';
import { activeSkills, allGames, isUnlocked, moduleForSkill } from '../core/registry.js';
import { state } from '../core/store.js';
import { icon } from './icons.js';
import { dueSubtopics } from './math.js';
import { activeSkin, applyScene, avatarEl, creatureAt, formatXP, fullName, meter, t, xpName } from './ui.js';

const SUB_NAMES = ['I', 'II', 'III'];

// Най-близкото препятствие с думи. Изоставащата способност е конкретна: „още 40 XP Памет“.
export function obstacleText(obstacle) {
  if (obstacle.kind === 'max') return 'Това е върхът на стълбата.';
  if (obstacle.kind === 'ready') return t('home.ready', { step: fullName(obstacle.step) });
  const xp = `${formatXP(obstacle.xp)} ${xpName()}`;
  if (obstacle.kind === 'skill') {
    return t('home.obstacle.skill', { step: fullName(obstacle.step), xp, skill: SKILL_LABELS[obstacle.skill] });
  }
  return t('home.obstacle.any', { step: fullName(obstacle.step), xp });
}

// Подходящата игра за препятствието: най-рано отключената, която тренира точно тази способност.
// Без способност (остава само общ XP) води към списъка с модули.
export function gameForObstacle(obstacle, step) {
  if (obstacle.kind !== 'skill') return null;
  return allGames()
    .filter((g) => g.skills.includes(obstacle.skill) && isUnlocked(g, step))
    .sort((a, b) => a.unlockStep - b.unlockStep)[0] || null;
}

function nextLine(step) {
  const next = activeSkin().creatures[creatureIndex(step) + 1];
  return next ? t('home.next', { name: next.name }) : 'Залата остава отворена.';
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
  const obstacle = nearestObstacle(profile, activeSkills(profile.step));
  const info = obstacle.info;
  const due = dueSubtopics().length;
  const target = gameForObstacle(obstacle, profile.step);

  mount(root,
    // Купеният фон сменя фона на hero картата; без фон остава стъклото.
    applyScene(h('section', { class: 'hero' },
      h('div', { class: 'hero-art', 'aria-hidden': 'true' }, avatarEl(creature)),
      h('div', { class: 'hero-main' },
        h('div', { class: 'hero-avatar' }, avatarEl(creature)),
        h('h1', {}, t('home.you', { name: fullName(profile.step) }), h('span', { class: 'title-sub' }, nextLine(profile.step))),
        h('p', { class: 'hero-trait' }, creature.trait),
        h('div', { class: 'next-step' },
          info.isMax ? null : meter(info.fraction, 'Напредък до следващата стъпка'),
          h('p', { class: 'next-hint', 'aria-live': 'polite' }, obstacleText(obstacle))),
        target
          ? h('a', { class: 'btn btn-pill', href: target.route || `#/play/${target.id}` }, `Тренирай ${target.title}`, icon('arrow-up-right'))
          : h('a', { class: 'btn btn-pill', href: '#/train' }, t('home.continue'), icon('arrow-up-right'))),
      substeps(profile.step))),
    due ? h('a', { class: 'review-link', href: '#/math' }, `Готови за преговор: ${due}`) : null,
    h('a', { class: 'btn surprise-link', href: '#/surprise' }, icon('sparkles'), 'Изненадай ме'),
    h('h2', { class: 'section-title' }, 'Шестте способности'),
    h('section', { class: 'skills', 'aria-label': 'Шестте способности' },
      info.gates.map((g) => h('div', { class: `skill ${g.active ? (g.ok ? 'skill-ok' : '') : 'skill-inactive'}` },
        h('span', { class: 'skill-name' }, SKILL_LABELS[g.skill]),
        h('span', { class: 'skill-level' }, !g.active
          ? `Отключва се с модул ${moduleForSkill(g.skill)}`
          : (info.isMax ? `ниво ${g.level}` : `ниво ${g.level} / ${g.required}`))))),
    h('p', { class: 'practice-note' }, t('home.levelNote')));
}
