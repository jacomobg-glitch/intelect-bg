// Проста реакция: натискаш, щом светне. Случайното изчакване не позволява да се предвижда моментът.
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 45000;

export const reactionParams = (level) => ({
  // По-висока трудност значи по-кратък срок за отговор и по-непредвидимо чакане.
  deadline: Math.max(280, 900 - 70 * (level - 1)),
  waitMin: Math.max(600, 1200 - 60 * (level - 1)),
  waitMax: 3200 + 150 * (level - 1),
});

const randomWait = (level, random = Math.random) => {
  const { waitMin, waitMax } = reactionParams(level);
  return waitMin + random() * (waitMax - waitMin);
};

function arm(g) {
  g.state.trial = null;
  g.state.pad.className = 'reaction-pad';
  g.state.label.textContent = 'Изчакай…';
  g.state.nextAt = performance.now() + randomWait(g.log.level);
  g.updateLevel();
}

function press(g, event) {
  const trial = g.state.trial;
  if (!trial) {
    g.log.premature();
    g.state.label.textContent = 'Рано. Изчакай да светне.';
    g.state.nextAt = performance.now() + randomWait(g.log.level);
    return;
  }
  const rt = g.readReaction(trial, event);
  if (rt === null) return;
  if (rt <= trial.deadline) g.log.correct({ rt, limit: trial.deadline });
  else g.log.error('miss');
  g.state.last.textContent = `${Math.round(rt)} ms`;
  arm(g);
}

export default createGame({
  id: 'simple-reaction',
  title: 'Проста реакция',
  category: 'reflex',
  unlockStep: 0,
  skills: ['speed'],
  description: 'Изчакай да светне и натисни веднага.',
  runMs: RUN_MS,

  setup(g, stage) {
    const label = h('span', { class: 'reaction-label' }, 'Изчакай…');
    const last = h('span', { class: 'reaction-last' }, '');
    const pad = h('div', { class: 'reaction-pad', role: 'button', 'aria-label': 'Натисни тук' }, label);
    stage.append(pad, last);
    g.state = { pad, label, last, trial: null, nextAt: performance.now() + randomWait(g.log.level) };
  },

  frame(g, now) {
    const { trial, nextAt } = g.state;
    if (!trial && now >= nextAt) {
      const next = { onset: null, deadline: reactionParams(g.log.level).deadline };
      g.state.trial = next;
      g.state.pad.className = 'reaction-pad reaction-on';
      g.state.label.textContent = 'СЕГА';
      g.markOnset(next);
    } else if (trial && trial.onset !== null && now - trial.onset > trial.deadline + 600) {
      g.log.error('miss');
      arm(g);
    }
  },

  onTap: press,
  onKey(g, e) {
    if (e.code !== 'Space') return false;
    press(g, e);
    return true;
  },

  demo() {
    return h('div', { class: 'demo-box demo-reaction', 'aria-hidden': 'true' },
      h('span', { class: 'demo-lamp' }), h('span', { class: 'demo-tap' }));
  },
});
