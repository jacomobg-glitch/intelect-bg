// „Изненадай ме“: една сесия от 5–10 минути — игра, математика, игра.
// Планът живее само в паметта: няма история, няма дати, няма сравнение с минали дни.
import { ALL_SUBTOPICS } from '../content/math/topics.js';
import { SKILL_LABELS } from '../core/config.js';
import { h, mount } from '../core/dom.js';
import { xpName } from './ui.js';
import { allGames, isUnlocked } from '../core/registry.js';
import { isDue, todayISO } from '../core/sm2.js';
import { planSurprise } from '../core/surprise.js';
import { recordOf, state, topicOf } from '../core/store.js';
import { icon } from './icons.js';
import { renderMathSession } from './math.js';
import { renderPlay } from './play.js';

// Играта от края на предишната изненада не започва следващата. Пази се само в паметта.
let lastGameId = null;

const playableGames = () => allGames().filter((g) => g.category !== 'math' && isUnlocked(g, state.profile.step));

function openTopics() {
  const today = todayISO();
  return ALL_SUBTOPICS.filter((s) => state.profile.step >= s.unlockStep).map((s) => {
    const topic = topicOf(s.id);
    return { id: s.id, title: s.title, mastered: topic.mastered, due: isDue(topic.sm2, today) };
  });
}

export function buildPlan(random = Math.random) {
  return planSurprise({
    games: playableGames(),
    topics: openTopics(),
    plays: (id) => recordOf(id).plays,
    skillXP: state.profile.skillXP,
    random,
    avoid: lastGameId,
  });
}

export function renderSurprise(root) {
  // Планът, събраното и текущата стъпка живеят в една обвивка, за да остане валидно
  // онова, което app.js получава за изчистване при напускане на екрана.
  let plan = [];
  let totals = { xp: 0, bySkill: {}, records: [] };
  let cleanupChild = null;
  let index = -1;

  const collect = (item) => (result) => {
    totals.xp += result.xp;
    for (const skill of item.skills) {
      totals.bySkill[skill] = (totals.bySkill[skill] || 0) + result.xp / item.skills.length;
    }
    if (result.isRecord) totals.records.push(item.title);
    if (item.kind === 'game') lastGameId = item.id;
  };

  function step() {
    if (cleanupChild) cleanupChild();
    cleanupChild = null;
    index += 1;
    if (index >= plan.length) {
      showSummary();
      return;
    }
    const item = plan[index];
    const kicker = `Изненадай ме · ${index + 1} от ${plan.length}`;
    const next = { label: index + 1 >= plan.length ? 'Виж обобщението' : 'Напред', onClick: step };
    const common = { kicker, next, back: '#/', onFinish: collect(item) };
    cleanupChild = item.kind === 'game'
      ? renderPlay(root, item.id, common)
      : renderMathSession(root, item.topicId, 'practice', common);
  }

  function showSummary() {
    const rows = Object.entries(totals.bySkill)
      .filter(([, xp]) => xp > 0)
      .sort((a, b) => b[1] - a[1]);
    mount(root,
      h('h1', { class: 'page-title' }, 'Сесията приключи'),
      h('div', { class: 'result' },
        h('p', { class: 'result-score' }, `+${Math.round(totals.xp)}`),
        h('p', { class: 'muted' }, `${xpName()} от тази сесия`)),
      rows.length
        ? h('dl', { class: 'stats' }, rows.map(([skill, xp]) => h('div', {},
          h('dt', {}, SKILL_LABELS[skill]),
          h('dd', {}, `+${Math.round(xp)} ${xpName()}`))))
        : h('p', { class: 'muted small' }, `Този път без ${xpName()}: нямаше верен отговор.`),
      totals.records.length
        ? h('p', { class: 'result-record' }, `Нов личен рекорд: ${totals.records.join(', ')}`)
        : null,
      h('button', { class: 'btn btn-primary btn-big', onclick: showIntro }, 'Още една изненада'),
      h('a', { class: 'btn', href: '#/' }, 'Към началото'));
  }

  // Прегледът на плана преди старта: изненадата е приятна, но не е непрозрачна.
  function showIntro() {
    if (cleanupChild) cleanupChild();
    cleanupChild = null;
    plan = buildPlan();
    totals = { xp: 0, bySkill: {}, records: [] };
    index = -1;
    if (!plan.length) {
      mount(root,
        h('h1', { class: 'page-title' }, 'Изненадай ме'),
        h('p', {}, 'Още няма достатъчно отключени модули за изненада.'),
        h('a', { class: 'btn', href: '#/train' }, 'Към „Тренирай“'));
      return;
    }
    mount(root,
      h('h1', { class: 'page-title' }, 'Изненадай ме'),
      h('p', { class: 'muted' }, 'Кратка сесия: една тема по математика и две игри. Около 5 до 10 минути.'),
      h('ol', { class: 'plan' }, plan.map((item) => h('li', {},
        icon(item.kind === 'math' ? 'sigma' : 'brain'),
        h('span', { class: 'module-text' },
          h('strong', {}, item.title),
          h('span', {}, item.skills.map((s) => SKILL_LABELS[s]).join(' · ')))))),
      h('button', { class: 'btn btn-primary btn-big', onclick: step }, icon('sparkles'), 'Започни'),
      h('a', { class: 'btn', href: '#/' }, 'Назад'));
  }

  showIntro();
  return () => { if (cleanupChild) cleanupChild(); };
}
