// „Избирателна реакция“: светва една от няколко посоки и се натиска точно нейният бутон.
// Разликата от „Проста реакция“ е, че тук трябва и да избереш, не само да натиснеш.
import { CHOICE_SIGNS, choiceParams, makeChoiceTrial } from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { ARROW_LABELS, arrowSvg } from './shared/glyphs.js';

const RUN_MS = 60000;
const FEEDBACK_MS = 420;
const KEY_FOR = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

function arm(g) {
  const s = g.state;
  s.phase = 'wait';
  s.trial = null;
  s.task = makeChoiceTrial(g.log.level, Math.random);
  s.stim.replaceChildren(h('span', { class: 'cr-dash' }, '—'));
  s.cue.textContent = 'Изчакай…';
  for (const b of s.buttons) b.className = buttonClass(b.dataset.answer, s.task.options);
  s.until = performance.now() + s.task.waitMs;
  g.updateLevel();
}

const buttonClass = (dir, options) => {
  const index = CHOICE_SIGNS.indexOf(dir);
  return `answer-btn cr-option${index >= options ? ' cr-option-off' : ''}`;
};

function show(g) {
  const s = g.state;
  s.phase = 'play';
  const dir = CHOICE_SIGNS[s.task.target];
  s.stim.replaceChildren(arrowSvg(dir, 'cr-stim-arrow'));
  s.cue.textContent = 'Натисни посоката';
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + s.task.limitMs + 400;
}

function settle(g, pressed) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  const right = CHOICE_SIGNS[s.task.target];
  for (const b of s.buttons) {
    if (b.dataset.answer === right) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === pressed) b.classList.add('answer-btn-wrong');
  }
  s.until = performance.now() + FEEDBACK_MS;
}

function press(g, dir, event) {
  const s = g.state;
  if (s.phase !== 'play') {
    // Натискане преди знака: брои се като преждевременно и чакането започва отново.
    if (s.phase === 'wait') {
      g.readReaction(null, event);
      s.cue.textContent = 'Рано. Изчакай знака.';
      s.until = performance.now() + s.task.waitMs;
    }
    return;
  }
  if (CHOICE_SIGNS.indexOf(dir) >= s.task.options) return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  if (dir !== CHOICE_SIGNS[s.task.target]) g.log.error('wrong');
  else if (rt <= s.task.limitMs) g.log.correct({ rt, limit: s.task.limitMs });
  else g.log.error('miss');
  s.last.textContent = `${Math.round(rt)} ms`;
  settle(g, dir);
}

export default createGame({
  id: 'choice-reaction',
  title: 'Избирателна реакция',
  category: 'reflex',
  unlockStep: 1,
  skills: ['speed', 'attention'],
  description: 'Светва една посока. Натисни точно нейния бутон, не друг.',
  keys: 'стрелките ← ↑ ↓ → отговарят',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · ${choiceParams(level).options} посоки`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, 'Изчакай…');
    const stim = h('div', { class: 'cr-stim' });
    const last = h('span', { class: 'reaction-last' }, '');
    const buttons = CHOICE_SIGNS.map((dir) => h('button', {
      class: 'answer-btn cr-option', type: 'button', 'data-answer': dir, 'aria-label': ARROW_LABELS[dir],
    }, arrowSvg(dir, 'cr-option-arrow')));
    stage.append(cue, stim, last, h('div', { class: 'cr-pads' }, buttons));
    g.state = { cue, stim, last, buttons, task: null, trial: null, phase: 'wait', until: 0 };
  },

  begin: arm,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'wait') show(g);
    else if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, null);
    } else arm(g);
  },

  onAnswer: (g, value, event) => press(g, value, event),

  onKey(g, e) {
    const dir = KEY_FOR[e.code];
    if (!dir) return false;
    press(g, dir, e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Верни', wrong: 'Сбъркана посока', misses: 'Закъснели' }),

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'cr-stim demo-cr-stim' }, arrowSvg('right', 'cr-stim-arrow')),
      h('div', { class: 'cr-pads demo-cr-pads' }, CHOICE_SIGNS.slice(0, 3).map((dir) => h('span', {
        class: `answer-btn cr-option ${dir === 'right' ? 'answer-btn-right' : ''}`,
      }, arrowSvg(dir, 'cr-option-arrow')))),
      h('span', { class: 'demo-nb-label' }, 'Светна надясно: натисни стрелката надясно.'));
  },
});
