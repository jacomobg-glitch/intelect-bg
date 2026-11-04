// Профил: натрупана практика и лични рекорди, без дати и без сравнение с други хора.
// Паяжинната диаграма и „Изненадай ме“ идват в Етап 5.
import { ALL_SUBTOPICS } from '../content/math/topics.js';
import { SKILLS, SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { levelFromXP } from '../core/evolution.js';
import { activeSkills, allGames, moduleForSkill } from '../core/registry.js';
import { recordOf, state, topicOf } from '../core/store.js';
import { formatXP, fullName, meter } from './ui.js';

export function renderProfile(root) {
  const { profile } = state;
  const active = activeSkills(profile.step);
  const levels = SKILLS.map((s) => levelFromXP(profile.skillXP[s]));
  const top = Math.max(1, ...levels);
  const games = allGames().filter((g) => recordOf(g.id).bestScore > 0);
  const mastered = ALL_SUBTOPICS.filter((s) => topicOf(s.id).mastered).length;

  mount(root,
    h('h1', { class: 'page-title' }, 'Профил'),
    h('p', { class: 'muted' }, `${fullName(profile.step)} · ${formatXP(profile.totalXP)} XP · усвоени теми: ${mastered} от ${ALL_SUBTOPICS.length}`),
    h('section', { class: 'group' },
      h('h2', {}, 'Натрупана практика'),
      h('p', { class: 'muted small' }, 'Нивото показва колко си практикувал в задачите, а лентата сравнява способностите само помежду им.'),
      SKILLS.map((s, i) => (active.includes(s)
        ? h('div', { class: 'profile-row' },
          h('strong', {}, SKILL_LABELS[s]),
          h('span', { class: 'small muted' }, `ниво ${levels[i]}`),
          meter(levels[i] / top, `${SKILL_LABELS[s]}: ниво ${levels[i]}`))
        : h('div', { class: 'profile-row inactive' },
          h('strong', {}, SKILL_LABELS[s]),
          h('span', { class: 'small muted' }, `Отключва се с модул ${moduleForSkill(s)}`))))),
    h('section', { class: 'group' },
      h('h2', {}, 'Лични рекорди'),
      games.length
        ? games.map((g) => {
          const rec = recordOf(g.id);
          return h('div', { class: 'profile-row' },
            h('strong', {}, g.title),
            h('span', { class: 'small' }, rec.bestMeanRT === null ? `${rec.bestScore}` : `${rec.bestScore} · ${Math.round(rec.bestMeanRT)} ms`));
        })
        : h('p', { class: 'muted small' }, 'Рекордите се появяват след първата завършена игра.')));
}
