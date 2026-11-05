// Профил: паяжинна диаграма на шестте способности, натрупана практика и лични рекорди.
// Без дати, без история по дни и без сравнение с други хора: само ти спрямо себе си.
import { ALL_SUBTOPICS } from '../content/math/topics.js';
import { SKILLS, SKILL_LABELS } from '../core/config.js';
import { h, mount, svgEl } from '../core/dom.js';
import { levelFromXP } from '../core/evolution.js';
import { activeSkills, allGames, isUnlocked, moduleForSkill } from '../core/registry.js';
import { recordOf, state, topicOf } from '../core/store.js';
import { icon } from './icons.js';
import { formatXP, fullName, t } from './ui.js';

const CX = 160;
const CY = 136;
const R = 88;
const LABEL_R = 106;
const RINGS = [0.25, 0.5, 0.75, 1];

const angleOf = (i) => ((-90 + i * 60) * Math.PI) / 180;
const axisPoint = (i, r) => [CX + Math.cos(angleOf(i)) * r, CY + Math.sin(angleOf(i)) * r];
const corners = (radii) => radii.map((r, i) => axisPoint(i, r).map((n) => n.toFixed(1)).join(',')).join(' ');
const ring = (fraction) => corners(SKILLS.map(() => R * fraction));

// Хоризонталното подравняване следва мястото на върха, за да не излиза текстът от рамката.
function labelAttrs(i) {
  const [x, y] = axisPoint(i, LABEL_R);
  const cos = Math.cos(angleOf(i));
  const anchor = Math.abs(cos) < 0.01 ? 'middle' : (cos > 0 ? 'start' : 'end');
  const dy = i === 0 ? -4 : i === 3 ? 12 : 4;
  return { x: x.toFixed(1), y: (y + dy).toFixed(1), 'text-anchor': anchor, class: 'radar-label' };
}

// Паяжината. Нормализирана спрямо собствената най-тренирана способност, без норми и чужди резултати.
// role="img" с пълното описание е текстовата алтернатива за четци на екрана.
function radar(levels, top, selected) {
  const fractions = levels.map((l) => Math.max(0.04, l / top));
  const text = SKILLS.map((s, i) => SKILL_LABELS[s] + ' ниво ' + levels[i]).join(', ');
  const svg = svgEl('svg', { viewBox: '0 0 320 272', class: 'radar-svg', role: 'img', 'aria-label': 'Паяжинна диаграма на натрупаната практика: ' + text + '.' });
  for (const f of RINGS) svg.append(svgEl('polygon', { points: ring(f), class: 'radar-ring' }));
  SKILLS.forEach((_, i) => {
    const [x, y] = axisPoint(i, R);
    svg.append(svgEl('line', { x1: CX, y1: CY, x2: x.toFixed(1), y2: y.toFixed(1), class: 'radar-axis' }));
  });
  svg.append(svgEl('polygon', { points: corners(fractions.map((f) => R * f)), class: 'radar-shape' }));
  SKILLS.forEach((skill, i) => {
    const [x, y] = axisPoint(i, R * fractions[i]);
    const on = skill === selected;
    svg.append(svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: on ? 6 : 4, class: on ? 'radar-dot radar-dot-on' : 'radar-dot' }));
    svg.append(svgEl('text', labelAttrs(i), SKILL_LABELS[skill]));
  });
  return svg;
}

// Текстът описва натрупана практика, а не оценка на човека: никакви епитети за способностите.
export function practiceNote(skill, levels, active) {
  if (!active.includes(skill)) return 'Отключва се с модул ' + moduleForSkill(skill);
  const level = levels[SKILLS.indexOf(skill)];
  const activeLevels = active.map((s) => levels[SKILLS.indexOf(s)]);
  const top = Math.max(...activeLevels);
  const low = Math.min(...activeLevels);
  if (top === low) return 'натрупана практика';
  if (level === top) return t('profile.most');
  if (level === low) return t('profile.grow');
  return 'натрупана практика';
}

const gamesForSkill = (skill) => allGames()
  .filter((g) => g.skills.includes(skill))
  .sort((a, b) => a.unlockStep - b.unlockStep);

function recordLine(game) {
  const rec = recordOf(game.id);
  if (!isUnlocked(game, state.profile.step)) return 'отключва се при ' + fullName(game.unlockStep);
  if (!rec.bestScore) return 'още без рекорд';
  return 'рекорд ' + rec.bestScore + (rec.bestMeanRT === null ? '' : ' · ' + Math.round(rec.bestMeanRT) + ' ms');
}

// Подробности за една способност: какво я тренира, личните рекорди и бутон „Тренирай това“.
function skillDetail(skill, levels, active) {
  const level = levels[SKILLS.indexOf(skill)];
  const games = gamesForSkill(skill);
  const target = games.find((g) => isUnlocked(g, state.profile.step));
  return h('section', { class: 'skill-detail', 'aria-live': 'polite' },
    h('h3', {}, SKILL_LABELS[skill]),
    h('p', { class: 'muted small' }, 'ниво ' + level + ' · ' + formatXP(state.profile.skillXP[skill]) + ' XP · ' + practiceNote(skill, levels, active)),
    h('p', { class: 'small' }, 'Какво я тренира:'),
    games.length
      ? games.map((g) => h('div', { class: isUnlocked(g, state.profile.step) ? 'profile-row' : 'profile-row inactive' },
        h('strong', {}, g.title),
        h('span', { class: 'small muted' }, recordLine(g))))
      : h('p', { class: 'muted small' }, 'Модулът идва по-късно: ' + moduleForSkill(skill) + '.'),
    target
      ? h('a', { class: 'btn btn-primary', href: target.route || '#/play/' + target.id }, 'Тренирай това', icon('arrow-up-right'))
      : null);
}

export function renderProfile(root) {
  const { profile } = state;
  const active = activeSkills(profile.step);
  const levels = SKILLS.map((s) => levelFromXP(profile.skillXP[s]));
  const top = Math.max(1, ...levels);
  const games = allGames().filter((g) => recordOf(g.id).bestScore > 0);
  const mastered = ALL_SUBTOPICS.filter((s) => topicOf(s.id).mastered).length;
  let selected = null;

  const chartSlot = h('div', { class: 'radar-wrap' });
  const detailSlot = h('div', {});
  const buttons = new Map();

  const paint = () => {
    chartSlot.replaceChildren(radar(levels, top, selected));
    for (const [skill, btn] of buttons) {
      btn.classList.toggle('skill-on', skill === selected);
      btn.setAttribute('aria-pressed', String(skill === selected));
    }
    detailSlot.replaceChildren(selected
      ? skillDetail(selected, levels, active)
      : h('p', { class: 'muted small' }, 'Докосни способност, за да видиш какво я тренира.'));
  };

  for (const skill of SKILLS) {
    const isActive = active.includes(skill);
    buttons.set(skill, h('button', {
      class: isActive ? 'skill skill-btn' : 'skill skill-btn skill-inactive',
      type: 'button',
      'aria-pressed': 'false',
      onclick: () => { selected = selected === skill ? null : skill; paint(); },
    },
    h('span', { class: 'skill-name' }, SKILL_LABELS[skill]),
    h('span', { class: 'skill-level' }, isActive
      ? 'ниво ' + levels[SKILLS.indexOf(skill)] + ' · ' + practiceNote(skill, levels, active)
      : practiceNote(skill, levels, active))));
  }

  mount(root,
    h('h1', { class: 'page-title' }, 'Профил'),
    h('p', { class: 'muted' }, fullName(profile.step) + ' · ' + formatXP(profile.totalXP) + ' XP · усвоени теми: ' + mastered + ' от ' + ALL_SUBTOPICS.length),
    h('section', { class: 'group' },
      h('h2', {}, 'Когнитивен профил'),
      h('p', { class: 'muted small' }, 'Паяжината сравнява шестте способности само помежду им, спрямо най-тренираната. Нивото описва натрупана практика в самите задачи.'),
      chartSlot,
      h('div', { class: 'skills' }, [...buttons.values()]),
      detailSlot),
    h('section', { class: 'group' },
      h('h2', {}, 'Изненадай ме'),
      h('p', { class: 'muted small' }, 'Кратка сесия: една тема по математика и две игри, подбрани с повече шанс за способностите с най-малко практика.'),
      h('a', { class: 'btn btn-primary btn-big', href: '#/surprise' }, icon('sparkles'), 'Изненадай ме')),
    h('section', { class: 'group' },
      h('h2', {}, 'Лични рекорди'),
      games.length
        ? games.map((g) => {
          const rec = recordOf(g.id);
          return h('div', { class: 'profile-row' },
            h('strong', {}, g.title),
            h('span', { class: 'small' }, rec.bestMeanRT === null ? String(rec.bestScore) : rec.bestScore + ' · ' + Math.round(rec.bestMeanRT) + ' ms'));
        })
        : h('p', { class: 'muted small' }, 'Рекордите се появяват след първата завършена игра.')));

  paint();
}
