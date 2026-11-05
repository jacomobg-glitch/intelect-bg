// „Бърза сметка“: проста сметка със срок, който се скъсява с трудността.
// Мери и скорост, и сметка, затова носи XP и за двете способности.
import { makeQuickTask, quickParams } from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;
const FEEDBACK_MS = 450;

function showTask(g) {
  const s = g.state;
  const task = makeQuickTask(g.log.level, Math.random);
  s.task = task;
  s.phase = 'play';
  s.prompt.textContent = `${task.prompt} = ?`;
  s.buttons = task.options.map((option, i) => h('button', {
    class: 'answer-btn qm-option', type: 'button', 'data-answer': option,
  }, h('span', {}, option), h('kbd', {}, String(i + 1))));
  s.options.replaceChildren(...s.buttons);
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + task.limitMs;
  g.updateLevel();
}

function settle(g, correct, value) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  for (const b of s.buttons) {
    if (b.dataset.answer === s.task.answer) b.classList.add('answer-btn-right');
    else if (b.dataset.answer === value) b.classList.add('answer-btn-wrong');
  }
  s.until = performance.now() + FEEDBACK_MS;
  if (!correct) s.prompt.textContent = `${s.task.prompt} = ${s.task.answer}`;
}

function answer(g, value, event) {
  const s = g.state;
  if (s.phase !== 'play') return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  const correct = value === s.task.answer;
  if (correct) g.log.correct({ rt, limit: s.task.limitMs });
  else g.log.error('wrong');
  settle(g, correct, value);
}

export default createGame({
  id: 'quick-math',
  title: 'Бърза сметка',
  category: 'cognitive',
  unlockStep: 5,
  skills: ['speed', 'math'],
  description: 'Сметни и избери отговора, преди да изтече времето.',
  keys: 'цифрите 1–4 избират отговор',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · ${(quickParams(level).limitMs / 1000).toFixed(1)} с`,

  setup(g, stage) {
    const prompt = h('p', { class: 'qm-prompt' }, '');
    const options = h('div', { class: 'answer-grid' });
    const bar = h('div', { class: 'qm-bar-fill' });
    stage.append(prompt, h('div', { class: 'qm-bar' }, bar), options);
    g.state = { prompt, options, bar, buttons: [], task: null, trial: null, phase: 'play', until: 0 };
  },

  begin: showTask,

  frame(g, now) {
    const s = g.state;
    // Лентата показва колко време остава за ТАЗИ задача, а не за цялата сесия.
    if (s.phase === 'play' && s.task) {
      const left = Math.max(0, (s.until - now) / s.task.limitMs);
      s.bar.style.width = `${left * 100}%`;
    }
    if (now < s.until) return;
    if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, false, null);
    } else {
      showTask(g);
    }
  },

  onAnswer: answer,

  onKey(g, e) {
    const button = g.state.buttons[Number(e.key) - 1];
    if (!button) return false;
    answer(g, button.dataset.answer, e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Верни', wrong: 'Грешни', misses: 'Изтекло време' }),

  demo() {
    return h('div', { class: 'demo-box demo-quick', 'aria-hidden': 'true' },
      h('span', { class: 'qm-prompt' }, '7 × 8 = ?'),
      h('span', { class: 'demo-pick' }, '56'));
  },
});
