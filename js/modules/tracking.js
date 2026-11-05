// „Следене на цел“: целта се движи по гладък път, а твоят знак трябва да стои върху нея.
// Няма отделни задачи с отговор: всяка секунда е един опит и се брои за верен, ако
// знакът е бил върху целта поне ON_TARGET_SHARE от нея. Затова няма и време за реакция.
import {
  ON_TARGET_SHARE, TRACK_WINDOW_MS, makeTrackingPath, trackPosition, trackingParams,
} from '../content/games/reflex.js';
import { h } from '../core/dom.js';
import { createGame } from './shared/base-game.js';

const RUN_MS = 60000;
const KEY_STEP = 0.045; // колко от полето минава знакът при едно натискане на стрелка

const KEY_MOVES = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

function newPath(g) {
  const s = g.state;
  s.path = makeTrackingPath(g.log.level, Math.random);
  s.params = trackingParams(g.log.level);
  // Кръгът на целта е точно допускът: допускът е дял от страната, диаметърът – двойно повече.
  s.target.style.setProperty('--tol', `${(s.params.tolerance * 200).toFixed(1)}%`);
  s.pathStart = performance.now();
  g.updateLevel();
}

// Полето е правоъгълно, а допускът е дял от по-малката страна: иначе трудността
// би зависела от формата на екрана.
function distanceShare(s, own, target) {
  const rect = s.field.getBoundingClientRect();
  const short = Math.max(1, Math.min(rect.width, rect.height));
  const dx = (own.x - target.x) * rect.width;
  const dy = (own.y - target.y) * rect.height;
  return Math.hypot(dx, dy) / short;
}

function place(el, pos) {
  el.style.setProperty('--x', `${(pos.x * 100).toFixed(2)}%`);
  el.style.setProperty('--y', `${(pos.y * 100).toFixed(2)}%`);
}

function closeWindow(g) {
  const s = g.state;
  const share = s.windowMs ? s.onMs / s.windowMs : 0;
  s.shares.push(share);
  if (share >= ON_TARGET_SHARE) g.log.correct();
  else g.log.error('miss');
  s.windowMs = 0;
  s.onMs = 0;
  // Трудността се смени: новият път тръгва с новите числа.
  if (s.params.speed !== trackingParams(g.log.level).speed) newPath(g);
  else g.updateLevel();
}

export default createGame({
  id: 'tracking',
  title: 'Следене на цел',
  category: 'reflex',
  unlockStep: 15,
  skills: ['attention', 'speed'],
  description: 'Дръж знака си върху движещата се цел. Пръстът или стрелките го местят.',
  runMs: RUN_MS,
  reportsRT: false,
  levelText: (level) => `Трудност ${level} · допуск ${Math.round(trackingParams(level).tolerance * 100)}%`,

  setup(g, stage) {
    const cue = h('p', { class: 'stroop-cue' }, 'Дръж знака върху целта');
    const target = h('span', { class: 'tr-target' });
    const own = h('span', { class: 'tr-own' });
    const field = h('div', { class: 'tr-field' }, target, own);
    stage.append(cue, field);
    g.state = {
      cue, field, target, own,
      pos: { x: 0.5, y: 0.5 },
      path: null, params: trackingParams(g.log.level), pathStart: 0,
      windowMs: 0, onMs: 0, last: 0, shares: [], onTarget: false,
    };
    // Слушателят е на самото поле: с него си отива и той, затова няма какво да се освобождава.
    field.addEventListener('pointermove', (e) => {
      if (!g.running) return;
      const rect = field.getBoundingClientRect();
      g.state.pos = {
        x: Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width))),
        y: Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height))),
      };
    });
  },

  begin(g) {
    newPath(g);
    g.state.last = performance.now();
  },

  frame(g, now) {
    const s = g.state;
    const dt = Math.min(64, now - s.last); // след скрит екран кадърът не бива да скача
    s.last = now;
    const target = trackPosition(s.path, (now - s.pathStart) / 1000);
    place(s.target, target);
    place(s.own, s.pos);
    const onTarget = distanceShare(s, s.pos, target) <= s.params.tolerance;
    if (onTarget !== s.onTarget) {
      s.onTarget = onTarget;
      s.target.classList.toggle('tr-hit', onTarget);
      s.own.classList.toggle('tr-hit', onTarget);
    }
    s.windowMs += dt;
    if (onTarget) s.onMs += dt;
    if (s.windowMs >= TRACK_WINDOW_MS) closeWindow(g);
  },

  // Докосването мести знака веднага, без да се чака движение.
  onTap(g, e) {
    const rect = g.state.field.getBoundingClientRect();
    g.state.pos = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / Math.max(1, rect.height))),
    };
  },

  onKey(g, e) {
    const move = KEY_MOVES[e.code];
    if (!move) return false;
    const s = g.state;
    s.pos = {
      x: Math.min(1, Math.max(0, s.pos.x + move[0] * KEY_STEP)),
      y: Math.min(1, Math.max(0, s.pos.y + move[1] * KEY_STEP)),
    };
    return true;
  },

  rows(g) {
    const shares = g.state.shares;
    const mean = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
    return [
      ['Време върху целта', mean === null ? '–' : `${Math.round(mean * 100)}%`],
      ['Най-добра секунда', shares.length ? `${Math.round(Math.max(...shares) * 100)}%` : '–'],
      ['Удържани секунди', `${g.log.correctCount}`],
      ['Изпуснати секунди', `${g.log.misses}`],
    ];
  },

  demo() {
    return h('div', { class: 'demo-box', 'aria-hidden': 'true' },
      h('div', { class: 'tr-field demo-tr-field' },
        h('span', { class: 'tr-target demo-tr-target' }),
        h('span', { class: 'tr-own demo-tr-own' })),
      h('span', { class: 'demo-nb-label' }, 'Целта се движи: кръгчето ти я следва.'));
  },
});
