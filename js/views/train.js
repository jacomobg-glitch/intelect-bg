// Списък с модули. Без аргумент показва всички групи, с аргумент само една категория.
import { CATEGORIES, SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { allGames, isUnlocked } from '../core/registry.js';
import { recordOf, state } from '../core/store.js';
import { icon } from './icons.js';
import { fullName } from './ui.js';

const CATEGORY_NOTES = {
  cognitive: 'Когнитивните игри идват в следващия етап.',
};

function gameCard(game) {
  const open = isUnlocked(game, state.profile.step);
  const rec = recordOf(game.id);
  const skills = game.skills.map((s) => SKILL_LABELS[s]).join(' · ');
  const body = [
    h('strong', {}, game.title),
    h('span', { class: 'muted small' }, open ? game.description : `Отключва се при ${fullName(game.unlockStep)}`),
    h('span', { class: 'card-meta small' }, skills, rec.bestScore > 0 ? ` · рекорд ${rec.bestScore}` : ''),
  ];
  return open
    ? h('a', { class: 'card card-link', href: game.route || `#/play/${game.id}` }, body)
    : h('div', { class: 'card card-locked' }, body);
}

export function renderTrain(root, categoryId) {
  const games = allGames();
  const categories = categoryId ? CATEGORIES.filter((c) => c.id === categoryId) : CATEGORIES;
  mount(root,
    h('h1', { class: 'page-title' }, categoryId ? categories[0].label : 'Тренирай'),
    h('p', { class: 'muted' }, 'Избери каквото искаш, за колкото време искаш.'),
    categoryId ? null : h('a', { class: 'card card-link surprise-card', href: '#/surprise' },
      icon('sparkles'),
      h('span', { class: 'module-text' },
        h('strong', {}, 'Изненадай ме'),
        h('span', {}, 'Една тема по математика и две игри, около 5 до 10 минути.'))),
    categories.map((cat) => {
      const list = games.filter((g) => g.category === cat.id);
      return h('section', { class: 'group' },
        categoryId ? null : h('h2', {}, cat.label),
        list.length ? list.map(gameCard) : h('p', { class: 'muted small' }, CATEGORY_NOTES[cat.id] || 'Идва в следващите етапи.'));
    }));
}
