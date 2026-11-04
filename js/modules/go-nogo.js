// Go / No-Go: зеленият кръг се натиска, червеният квадрат не. Различават се и по форма, не само по цвят.
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;

export const goNoGoParams = (level) => ({
  duration: Math.max(420, 1150 - 70 * (level - 1)),
  noGoShare: Math.min(0.4, 0.2 + 0.03 * (level - 1)),
  gapMin: 500,
  gapMax: Math.max(900, 1500 - 50 * (level - 1)),
});

export function makeGoNoGoTrial(level, random) {
  const { duration, noGoShare } = goNoGoParams(level);
  return { type: random() < noGoShare ? 'nogo' : 'go', duration };
}

const nextGap = (level) => {
  const { gapMin, gapMax } = goNoGoParams(level);
  return gapMin + Math.random() * (gapMax - gapMin);
};

function settle(g) {
  g.state.trial = null;
  g.state.stim.className = 'gng-stim';
  g.state.nextAt = performance.now() + nextGap(g.log.level);
  g.updateLevel();
}

function press(g, event) {
  const trial = g.state.trial;
  const rt = g.readReaction(trial, event);
  if (rt === null) return;
  if (trial.type === 'go') g.log.correct({ rt, limit: trial.duration });
  else g.log.error('wrong');
  settle(g);
}

export default createGame({
  id: 'go-nogo',
  title: 'Go / No-Go',
  category: 'reflex',
  unlockStep: 3,
  skills: ['attention'],
  description: 'Натисни при зелен кръг. При червен квадрат се въздържи.',
  runMs: RUN_MS,

  setup(g, stage) {
    const stim = h('div', { class: 'gng-stim' });
    stage.append(h('div', { class: 'reaction-pad gng-pad', role: 'button', 'aria-label': 'Натисни тук' }, stim));
    g.state = { stim, trial: null, nextAt: performance.now() + nextGap(g.log.level) };
  },

  frame(g, now) {
    const { trial, nextAt, stim } = g.state;
    if (!trial && now >= nextAt) {
      const next = { ...makeGoNoGoTrial(g.log.level, Math.random), onset: null };
      g.state.trial = next;
      stim.className = `gng-stim gng-${next.type}`;
      g.markOnset(next);
    } else if (trial && trial.onset !== null && now - trial.onset > trial.duration) {
      if (trial.type === 'go') g.log.error('miss');
      else g.log.correct();
      settle(g);
    }
  },

  onTap: press,
  onKey(g, e) {
    if (e.code !== 'Space') return false;
    press(g, e);
    return true;
  },

  rows: (g) => g.log.rows({ wrong: 'При червено', misses: 'Пропуснато зелено' }),

  demo() {
    return h('div', { class: 'demo-box demo-gng', 'aria-hidden': 'true' },
      h('span', { class: 'demo-go' }), h('span', { class: 'demo-nogo' }), h('span', { class: 'demo-tap' }));
  },
});
