// Списък с модули, групирани по вид. Групите се пълнят автоматично от регистъра.
import { CATEGORIES, SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { allGames, isUnlocked } from '../core/registry.js';
import { recordOf, state } from '../core/store.js';
import { fullName } from './ui.js';

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

export function renderTrain(root) {
  const games = allGames();
  mount(root,
    h('h1', { class: 'page-title' }, 'Тренирай'),
    h('p', { class: 'muted' }, 'Избери каквото искаш, за колкото време искаш.'),
    CATEGORIES.map((cat) => {
      const list = games.filter((g) => g.category === cat.id);
      return h('section', { class: 'group' },
        h('h2', {}, cat.label),
        list.length ? list.map(gameCard) : h('p', { class: 'muted small' }, 'Идва в следващите етапи.'));
    }),
  );
}
