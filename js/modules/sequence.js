// „Цветни последователности“: редицата светва, ти я повтаряш. Всяко поле има и свой символ,
// а вариантът без цветове сменя цвета с форма, затова играта работи и при цветна слепота.
import { PADS, makeSimonSequence, simonParams } from '../content/games/generators.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 120000;
const FEEDBACK_MS = 800;
const START_DELAY_MS = 600;
export const INPUT_LIMIT_MS = 2600; // срок за всяко отделно докосване

const padClass = (pad, lit, colorFree) => [
  'seq-pad',
  colorFree ? 'seq-pad-mono' : `ink-bg-${pad.id}`,
  lit ? 'seq-pad-lit' : '',
].filter(Boolean).join(' ');

function repaint(g, litIndex = -1) {
  const s = g.state;
  s.pads.forEach((el, i) => { el.className = padClass(PADS[i], i === litIndex, s.colorFree); });
}

function startRound(g) {
  const s = g.state;
  const { length, showMs, gapMs } = simonParams(g.log.level);
  s.sequence = makeSimonSequence(length, Math.random);
  s.showMs = showMs;
  s.gapMs = gapMs;
  s.step = 0;
  s.input = 0;
  s.phase = 'show';
  s.lit = -1;
  s.until = performance.now() + START_DELAY_MS;
  s.cue.textContent = 'Гледай редицата';
  repaint(g);
  g.updateLevel();
}

function settle(g, correct) {
  const s = g.state;
  s.phase = 'feedback';
  s.trial = null;
  repaint(g);
  s.cue.textContent = correct ? 'Вярно' : 'Не беше този ред';
  s.until = performance.now() + FEEDBACK_MS;
}

export default createGame({
  id: 'sequence',
  title: 'Цветни последователности',
  category: 'cognitive',
  unlockStep: 7,
  skills: ['memory'],
  description: 'Редицата светва една по една. Повтори я в същия ред.',
  runMs: RUN_MS,
  levelText: (level) => `Трудност ${level} · ${simonParams(level).length} стъпки`,

  setup(g, stage) {
    const colorFree = g.ctx.settings?.colorFree === true;
    const cue = h('p', { class: 'stroop-cue' }, '');
    const pads = PADS.map((pad, i) => h('button', {
      class: padClass(pad, false, colorFree),
      type: 'button',
      'data-answer': String(i),
      'aria-label': pad.label,
    }, h('span', { class: 'seq-symbol' }, pad.symbol)));
    stage.append(cue, h('div', { class: 'seq-grid' }, pads));
    g.state = {
      cue, pads, colorFree, sequence: [], step: 0, input: 0, phase: 'show',
      until: 0, lit: -1, showMs: 600, gapMs: 200, trial: null,
    };
  },

  begin: startRound,

  frame(g, now) {
    const s = g.state;
    if (now < s.until) return;
    if (s.phase === 'show') {
      if (s.lit >= 0) {
        // Паузата между две светвания: без нея две еднакви полета изглеждат като едно.
        s.lit = -1;
        repaint(g);
        s.until = now + s.gapMs;
        s.step += 1;
        if (s.step >= s.sequence.length) {
          s.phase = 'input';
          s.cue.textContent = 'Повтори я';
          s.trial = { onset: null };
          g.markOnset(s.trial);
          s.until = now + INPUT_LIMIT_MS;
        }
        return;
      }
      s.lit = s.sequence[s.step];
      repaint(g, s.lit);
      s.until = now + s.showMs;
    } else if (s.phase === 'input') {
      g.log.error('miss');
      settle(g, false);
    } else {
      startRound(g);
    }
  },

  onAnswer(g, value, event) {
    const s = g.state;
    if (s.phase !== 'input') return;
    const rt = g.readReaction(s.trial, event);
    if (rt === null) return;
    const index = Number(value);
    if (index !== s.sequence[s.input]) {
      g.log.error('wrong');
      settle(g, false);
      return;
    }
    s.input += 1;
    if (s.input >= s.sequence.length) {
      g.log.correct({ rt, limit: INPUT_LIMIT_MS });
      settle(g, true);
      return;
    }
    // Следващото докосване има свой срок и свое начало на мерене.
    s.trial = { onset: null };
    g.markOnset(s.trial);
    s.until = performance.now() + INPUT_LIMIT_MS;
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

  rows: (g) => g.log.rows({ correct: 'Повторени редици', wrong: 'Сбъркан ред', misses: 'Изтекло време' }),

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'seq-grid demo-seq-grid' }, PADS.map((pad, i) => h('span', {
        class: `seq-pad ink-bg-${pad.id} demo-seq-${i + 1}`,
      }, h('span', { class: 'seq-symbol' }, pad.symbol)))),
      h('span', { class: 'demo-nb-label' }, 'Светва едно по едно: повтори същия ред.'));
  },
});
