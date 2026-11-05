// „Периферно внимание“: цифрата в средата е за погледа, а знакът светва за миг встрани.
// Къде е светнало се казва СЛЕД като знакът угасне, затова се разчита на периферията.
// Какво не можем да проверим: че погледът наистина е стоял в средата. Без проследяване
// на очите това остава уговорка, а цифрата е само причина да има какво да се гледа.
import { makePeripheralTrial, peripheralParams } from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;
export const ANSWER_LIMIT_MS = 2500;
const FEEDBACK_MS = 420;
export const GAP_MS = [650, 1500];

const randomGap = () => GAP_MS[0] + Math.random() * (GAP_MS[1] - GAP_MS[0]);

// Местата са по кръг и започват отгоре, по часовника.
function layout(g, task) {
  const s = g.state;
  s.slots = Array.from({ length: task.slots }, (_, i) => {
    const angle = (i / task.slots) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(angle) * task.radius * 100;
    const y = 50 + Math.sin(angle) * task.radius * 100;
    return h('button', {
      class: 'pf-slot', type: 'button', 'data-answer': String(i),
      'aria-label': `Място ${i + 1}`,
      vars: { '--x': `${x.toFixed(2)}%`, '--y': `${y.toFixed(2)}%` },
    }, h('span', { class: 'pf-mark' }));
  });
  s.field.replaceChildren(s.center, ...s.slots);
}

function arm(g) {
  const s = g.state;
  s.phase = 'wait';
  s.trial = null;
  s.task = makePeripheralTrial(g.log.level, Math.random);
  s.center.textContent = String(s.task.center);
  layout(g, s.task);
  s.cue.textContent = 'Гледай цифрата в средата';
  s.until = performance.now() + randomGap();
  g.updateLevel();
}

function flash(g) {
  const s = g.state;
  s.phase = 'flash';
  // Търсеното е запълненото петно, разсейващите са кръгчета: формата ги различава.
  s.slots[s.task.target].classList.add('pf-lit');
  for (const i of s.task.distractors) s.slots[i].classList.add('pf-decoy');
  s.trial = { onset: null };
  g.markOnset(s.trial);
  s.until = performance.now() + s.task.flashMs;
}

function ask(g) {
  const s = g.state;
  s.phase = 'play';
  for (const slot of s.slots) slot.classList.remove('pf-lit', 'pf-decoy');
  s.cue.textContent = 'Къде светна?';
  s.until = performance.now() + ANSWER_LIMIT_MS;
}

function settle(g, picked) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  s.slots[s.task.target].classList.add('pf-right');
  if (picked !== null && picked !== s.task.target) s.slots[picked].classList.add('pf-wrong');
  s.until = performance.now() + FEEDBACK_MS;
}

function answer(g, value, event) {
  const s = g.state;
  if (s.phase !== 'play' && s.phase !== 'flash') return;
  const rt = g.readReaction(s.trial, event);
  if (rt === null) return;
  const picked = Number(value);
  if (picked === s.task.target) g.log.correct({ rt, limit: s.task.flashMs + ANSWER_LIMIT_MS });
  else g.log.error('wrong');
  settle(g, picked);
}

export default createGame({
  id: 'peripheral',
  title: 'Периферно внимание',
  category: 'reflex',
  unlockStep: 11,
  skills: ['attention', 'speed'],
  description: 'Гледай цифрата в средата. Знакът светва за миг встрани: покажи къде беше.',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · ${peripheralParams(level).slots} места`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, 'Гледай цифрата в средата');
    const center = h('span', { class: 'pf-center' }, '');
    const field = h('div', { class: 'pf-field' }, center);
    stage.append(cue, field);
    g.state = { cue, field, center, slots: [], task: null, trial: null, phase: 'wait', until: 0 };
  },

  begin: arm,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'wait') flash(g);
    else if (s.phase === 'flash') ask(g);
    else if (s.phase === 'play') {
      g.log.error('miss');
      settle(g, null);
    } else arm(g);
  },

  onAnswer: answer,

  onKey(g, e) {
    const index = Number(e.key) - 1;
    const s = g.state;
    if (!Number.isInteger(index) || index < 0 || index >= (s.task?.slots || 0)) return false;
    answer(g, String(index), e);
    return true;
  },

  rows: (g) => g.log.rows({ correct: 'Познати', wrong: 'Сбъркано място', misses: 'Без отговор' }),

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'pf-field demo-pf-field' },
        h('span', { class: 'pf-center' }, '7'),
        h('span', { class: 'pf-slot pf-lit', vars: { '--x': '85%', '--y': '50%' } }, h('span', { class: 'pf-mark' })),
        h('span', { class: 'pf-slot', vars: { '--x': '15%', '--y': '50%' } }, h('span', { class: 'pf-mark' })),
        h('span', { class: 'pf-slot', vars: { '--x': '50%', '--y': '12%' } }, h('span', { class: 'pf-mark' })),
        h('span', { class: 'pf-slot', vars: { '--x': '50%', '--y': '88%' } }, h('span', { class: 'pf-mark' }))),
      h('span', { class: 'demo-nb-label' }, 'Светна отдясно, без да местиш погледа.'));
  },
});
