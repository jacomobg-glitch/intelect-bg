// „Сортиране по сменящо се правило“: подреждаш картата в един от трите коша.
// Правилото не е казано и се сменя тихо след няколко верни. Обратната връзка е само вярно/грешно,
// затова играта мери превключването, не паметта. Вариантът без цветове сменя цвета със запълване.
import {
  RULE_LABELS, SORT_RULES, TONE_FILLS, basketFor, makeSortBaskets, makeSortCard, nextSortRule, pickOne, sortParams,
} from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { cellSvg } from './shared/glyphs.js';

const RUN_MS = 90000;
const FEEDBACK_MS = 600;

// Картата като фигура: формата и броят винаги се виждат, а третият признак е цвят или запълване.
const cardEl = (card, colorFree, extra = '') => {
  const el = cellSvg({ shape: card.shape, count: card.count, fill: colorFree ? TONE_FILLS[card.tone] : 'solid' }, extra);
  if (!colorFree) el.classList.add(`tone-${card.tone}`);
  return el;
};

function startRound(g) {
  const s = g.state;
  s.card = makeSortCard(s.baskets, Math.random);
  s.phase = 'play';
  s.cardSlot.replaceChildren(cardEl(s.card, s.colorFree, 'gm-card'));
  for (const b of s.basketEls) b.className = 'answer-btn gm-basket';
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.limit = sortParams(g.log.level).limitMs;
  s.until = performance.now() + s.limit;
  g.updateLevel();
}

// Правилото се сменя тихо, когато играчът е хванал старото.
function maybeSwitchRule(g) {
  const s = g.state;
  const { runToSwitch } = sortParams(g.log.level);
  if (s.run < runToSwitch) return;
  s.rule = nextSortRule(s.rule, Math.random);
  s.run = 0;
  s.switches += 1;
}

function settle(g, correct, tapped) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  const right = basketFor(s.baskets, s.card, s.rule);
  if (right >= 0) s.basketEls[right].classList.add('answer-btn-right');
  if (!correct && tapped !== null) s.basketEls[tapped].classList.add('answer-btn-wrong');
  s.cue.textContent = correct ? 'Вярно' : 'Грешно';
  s.until = performance.now() + FEEDBACK_MS;
}

export default createGame({
  id: 'sorting',
  title: 'Сортиране по правило',
  category: 'cognitive',
  unlockStep: 9,
  skills: ['flexibility'],
  description: 'Сложи картата в верния кош. Правилото не е казано и се сменя без предупреждение.',
  runMs: RUN_MS,

  setup(g, stage) {
    const colorFree = g.ctx.settings?.colorFree === true;
    const baskets = makeSortBaskets(Math.random);
    const cue = h('p', { class: 'stroop-cue' }, 'Познай правилото по вярно и грешно');
    const cardSlot = h('div', { class: 'gm-card-slot' });
    const basketEls = baskets.map((b, i) => h('button', {
      class: 'answer-btn gm-basket',
      type: 'button',
      'data-answer': String(i),
      'aria-label': `Кош ${i + 1}`,
    }, cardEl(b, colorFree)));
    stage.append(cue, cardSlot, h('div', { class: 'answer-grid answer-grid-3' }, basketEls));
    g.state = {
      cue, cardSlot, basketEls, baskets, colorFree,
      rule: pickOne(Math.random, SORT_RULES), run: 0, switches: 0,
      card: null, trial: null, phase: 'play', until: 0, limit: 0,
    };
  },

  begin: startRound,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'play') {
      g.log.error('miss');
      s.run = 0;
      settle(g, false, null);
    } else {
      startRound(g);
    }
  },

  onAnswer(g, value, event) {
    const s = g.state;
    if (s.phase !== 'play') return;
    const rt = g.readReaction(s.trial, event);
    if (rt === null) return;
    const index = Number(value);
    const correct = index === basketFor(s.baskets, s.card, s.rule);
    if (correct) {
      g.log.correct({ rt, limit: s.limit });
      s.run += 1;
      maybeSwitchRule(g);
    } else {
      g.log.error('wrong');
      s.run = 0;
    }
    settle(g, correct, index);
  },

  introOptions({ settings, save }) {
    const options = [[false, 'С цветове'], [true, 'С форми (без цветове)']];
    const wrap = h('div', { class: 'segmented', role: 'group', 'aria-label': 'Вариант на играта' }, options.map(([value, label]) => h('button', {
      type: 'button',
      class: settings.colorFree === value ? 'active' : '',
      'aria-pressed': String(settings.colorFree === value),
      onclick: async (e) => {
        await save({ colorFree: value });
        for (const b of wrap.children) {
          const on = b === e.currentTarget;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        }
      },
    }, label)));
    return wrap;
  },

  rows: (g) => [
    ['Смени на правилото', `${g.state.switches}`],
    ['Последно правило', RULE_LABELS[g.state.rule]],
    ...g.log.rows({ misses: 'Изтекло време' }),
  ],

  demo() {
    const card = { shape: 'triangle', count: 2, tone: 'blue' };
    return h('div', { class: 'demo-box demo-sort', 'aria-hidden': 'true' },
      cardEl(card, false, 'gm-card demo-sort-card'),
      h('span', { class: 'demo-nb-label' }, 'Понякога важи формата, понякога броят, понякога цветът.'));
  },
});
