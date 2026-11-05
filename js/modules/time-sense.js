// „Оценка на време“: показва се отрязък, после се отмерва същият наум, без никакъв брояч.
// Няма време за реакция в обичайния смисъл: мери се отклонението от показаното време,
// затова статистиката говори за грешка в проценти, а не за милисекунди.
import { makeTimeTrial, timeError, timeHit, timeSenseParams } from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 90000;
const FEEDBACK_MS = 1100;

const seconds = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

function nextTrial(g) {
  const s = g.state;
  s.task = makeTimeTrial(g.log.level, Math.random);
  s.phase = 'show';
  s.cue.textContent = `Запомни колко е ${seconds(s.task.targetMs)} секунди`;
  s.pad.className = 'reaction-pad ts-pad reaction-on';
  s.label.textContent = 'Гледай';
  s.bar.style.width = '0%';
  s.showStart = performance.now();
  s.until = s.showStart + s.task.targetMs;
  g.updateLevel();
}

function ready(g) {
  const s = g.state;
  s.phase = 'ready';
  s.pad.className = 'reaction-pad ts-pad';
  s.label.textContent = 'Натисни, за да започнеш';
  s.cue.textContent = 'Сега отмери същото време. Брояч няма.';
  s.bar.style.width = '0%';
  // Без срок: началото на отмерването е в ръцете на играча.
  s.until = Infinity;
}

function settle(g, producedMs) {
  const s = g.state;
  const hit = timeHit(s.task, producedMs);
  const err = timeError(s.task.targetMs, producedMs);
  s.errors.push(err);
  if (hit) g.log.correct();
  else g.log.error('wrong');
  s.phase = 'feedback';
  s.pad.className = `reaction-pad ts-pad ${hit ? 'ts-hit' : 'ts-off'}`;
  s.label.textContent = hit ? 'Точно' : producedMs > s.task.targetMs ? 'Твърде дълго' : 'Твърде кратко';
  s.cue.textContent = `Трябваше ${seconds(s.task.targetMs)} с, ти отмери ${seconds(producedMs)} с.`;
  s.until = performance.now() + FEEDBACK_MS;
}

function tap(g, event) {
  const s = g.state;
  const now = event.timeStamp || performance.now();
  if (s.phase === 'ready') {
    s.phase = 'produce';
    s.produceStart = now;
    s.pad.className = 'reaction-pad ts-pad ts-running';
    s.label.textContent = 'Натисни, когато мине';
    s.cue.textContent = 'Отмервай наум.';
    // Няма срок: отрязъкът може да се окаже дълъг, а познаването не е бързина.
    s.until = Infinity;
  } else if (s.phase === 'produce') {
    settle(g, now - s.produceStart);
  }
}

export default createGame({
  id: 'time-sense',
  title: 'Оценка на време',
  category: 'reflex',
  unlockStep: 14,
  skills: ['attention', 'memory'],
  description: 'Показва се отрязък от време. Отмери същия наум, без брояч.',
  runMs: RUN_MS,
  reportsRT: false,
  levelText: (level) => `Трудност ${level} · допуск ±${Math.round(timeSenseParams(level).tolerance * 100)}%`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, '');
    const label = h('span', { class: 'reaction-label' }, '');
    const bar = h('div', { class: 'qm-bar-fill' });
    const pad = h('div', { class: 'reaction-pad ts-pad', role: 'button', 'aria-label': 'Натисни тук' }, label);
    stage.append(cue, h('div', { class: 'qm-bar' }, bar), pad);
    g.state = { cue, label, bar, pad, task: null, phase: 'show', until: 0, showStart: 0, produceStart: 0, errors: [] };
  },

  begin: nextTrial,

  frame(g, now) {
    const s = g.state;
    // Лентата се пълни САМО докато отрязъкът се показва. После изчезва: иначе не би било оценка.
    if (s.phase === 'show') {
      s.bar.style.width = `${Math.min(100, ((now - s.showStart) / s.task.targetMs) * 100)}%`;
    }
    if (now < s.until) return;
    if (s.phase === 'show') ready(g);
    else if (s.phase === 'feedback') nextTrial(g);
  },

  onTap: (g, e) => tap(g, e),

  onKey(g, e) {
    if (e.code !== 'Space') return false;
    tap(g, e);
    return true;
  },

  rows(g) {
    const errs = g.state.errors;
    const meanErr = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
    return [
      ['Средна грешка', meanErr === null ? '–' : `${Math.round(meanErr * 100)}%`],
      ['Най-точен опит', errs.length ? `${Math.round(Math.min(...errs) * 100)}%` : '–'],
      ['В допуска', `${g.log.correctCount}`],
      ['Извън допуска', `${g.log.wrong}`],
    ];
  },

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'qm-bar' }, h('div', { class: 'qm-bar-fill demo-ts-fill' })),
      h('span', { class: 'demo-nb-label' }, 'Лентата показва отрязъка. После го отмерваш без нея.'));
  },
});
