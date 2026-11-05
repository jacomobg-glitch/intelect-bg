// „Ориентация по прибори“: авиохоризонтът показва наклон и нос, а ти избираш описанието му.
// Задачата е да прочетеш прибор, а не да го усетиш: затова приборът е нарисуван, а отговорите
// са думи. Приборът остава скрит за екранния четец – описанието му Е отговорът, затова
// изговарянето му би подсказало. Същото важи и за фигурите в „Огледални фигури“.
import { instrumentParams, makeInstrumentTask } from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';
import { attitudeSvg } from './shared/glyphs.js';

const RUN_MS = 90000;
const FEEDBACK_MS = 700;

function showTask(g) {
  const s = g.state;
  const task = makeInstrumentTask(g.log.level, Math.random);
  s.task = task;
  s.phase = 'play';
  s.dial.replaceChildren(attitudeSvg({ bank: task.bank, pitch: task.pitch }));
  s.buttons = task.labels.map((label, i) => h('button', {
    class: 'answer-btn ai-option', type: 'button', 'data-answer': String(i),
  }, h('span', {}, label), h('kbd', {}, String(i + 1))));
  s.options.replaceChildren(...s.buttons);
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + task.limitMs;
  g.updateLevel();
}

function settle(g, value) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  for (const b of s.buttons) {
    if (b.dataset.answer === s.task.answer) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === value) b.classList.add('answer-btn-wrong');
  }
  s.until = performance.now() + FEEDBACK_MS;
}

function answer(g, value, event) {
  const s = g.state;
  if (s.phase !== 'play') return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  if (value === s.task.answer) g.log.correct({ rt, limit: s.task.limitMs });
  else g.log.error('wrong');
  settle(g, value);
}

export default createGame({
  id: 'instruments',
  title: 'Ориентация по прибори',
  category: 'reflex',
  unlockStep: 12,
  skills: ['logic', 'speed'],
  description: 'Приборът показва наклон и накъде гледа носът. Избери кое описание му отговаря.',
  keys: 'цифрите 1–4 избират отговор',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · ${instrumentParams(level).pairs ? 'наклон и нос' : 'една ос'}`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, 'Какво показва приборът?');
    const dial = h('div', { class: 'ai-stage' });
    const bar = h('div', { class: 'qm-bar-fill' });
    const options = h('div', { class: 'answer-grid' });
    stage.append(cue, dial, h('div', { class: 'qm-bar' }, bar), options);
    g.state = { cue, dial, bar, options, buttons: [], task: null, trial: null, phase: 'play', until: 0 };
  },

  begin: showTask,

  frame(g, now) {
    const s = g.state;
    // Лентата е за ТАЗИ задача: при прибори срокът е дълъг и без лента не се усеща.
    if (s.phase === 'play' && s.task) {
      s.bar.style.width = `${Math.max(0, (s.until - now) / s.task.limitMs) * 100}%`;
    }
    if (now < s.until) return;
    if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, null);
    } else showTask(g);
  },

  onAnswer: answer,

  onKey(g, e) {
    const button = g.state.buttons[Number(e.key) - 1];
    if (!button) return false;
    answer(g, button.dataset.answer, e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Верни', wrong: 'Сбъркан прибор', misses: 'Изтекло време' }),

  demo() {
    return h('div', { class: 'demo-box demo-ai', 'aria-hidden': 'true' },
      attitudeSvg({ bank: 1, pitch: 1 }, 'demo-ai-dial'),
      h('span', { class: 'demo-nb-label' }, 'Наклон надясно, нос нагоре.'));
  },
});
