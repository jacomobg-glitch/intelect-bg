// Обвивка на всяка игра: въведение, отброяване, игра, резултат. Работи само през общия интерфейс.
import { h, mount } from '../core/dom.js';
import { getGame, isUnlocked } from '../core/registry.js';
import { completeSession, markDemoSeen, maxDifficulty, recordOf, saveSettings, state } from '../core/store.js';
import { showEvolution } from './evolution.js';
import { startGameMonitor } from './perf.js';

export function renderPlay(root, id) {
  const game = getGame(id);
  if (!game || !isUnlocked(game, state.profile.step)) {
    location.hash = '#/train';
    return undefined;
  }

  let countdownTimer = null;
  let active = false;
  let stopMonitor = null;

  const leaveGame = () => {
    clearInterval(countdownTimer);
    if (active) game.stop();
    active = false;
    if (stopMonitor) stopMonitor();
    stopMonitor = null;
    document.body.classList.remove('playing');
    document.removeEventListener('visibilitychange', onVisibility);
  };

  // Скрит екран изкривява времената, затова опитът се прекратява, без нищо да се губи.
  const onVisibility = () => {
    if (document.hidden && !game.allowHidden) {
      leaveGame();
      showIntro('Опитът беше прекъснат и не се брои. Натрупаното си остава.');
    }
  };

  function showIntro(notice) {
    const rec = recordOf(game.id);
    const demo = !rec.demoSeen && game.demo ? game.demo() : null;
    mount(root,
      h('h1', { class: 'page-title' }, game.title),
      notice ? h('p', { class: 'notice' }, notice) : null,
      h('p', {}, game.description),
      demo,
      game.introOptions ? game.introOptions({ settings: state.settings, save: saveSettings }) : null,
      rec.bestScore > 0 ? h('p', { class: 'muted' }, `Личен рекорд: ${rec.bestScore}`) : null,
      h('button', { class: 'btn btn-primary btn-big', onclick: startCountdown }, 'Старт'),
      h('a', { class: 'btn', href: '#/train' }, 'Назад'),
    );
  }

  function startCountdown() {
    if (!recordOf(game.id).demoSeen) markDemoSeen(game.id);
    let n = 3;
    const number = h('div', { class: 'countdown', 'aria-live': 'polite' }, String(n));
    const stage = h('div', { class: 'game-stage' });
    const exit = h('button', {
      class: 'btn game-exit',
      onclick: () => { leaveGame(); location.hash = '#/train'; },
    }, 'Изход');
    document.body.classList.add('playing');
    const wrap = h('div', { class: 'game-wrap' }, stage, exit, number);
    mount(root, wrap);
    document.addEventListener('visibilitychange', onVisibility);

    countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        number.textContent = String(n);
        return;
      }
      clearInterval(countdownTimer);
      number.remove();
      game.init({ container: stage, difficulty: recordOf(game.id).lastDifficulty, maxDifficulty: maxDifficulty(), settings: state.settings, onEnd: finish });
      active = true;
      game.start();
      stopMonitor = startGameMonitor(game.id, wrap);
    }, 800);
  }

  async function finish() {
    active = false;
    leaveGame();
    const result = await completeSession(game);
    if (result.to > result.from) await showEvolution(result.from, result.to);
    showResult(result);
  }

  function showResult({ score, xp, isRecord, stats }) {
    mount(root,
      h('h1', { class: 'page-title' }, game.title),
      h('div', { class: 'result' },
        h('p', { class: 'result-score' }, String(score)),
        isRecord ? h('p', { class: 'result-record' }, 'Нов личен рекорд') : h('p', { class: 'muted' }, `Личен рекорд: ${recordOf(game.id).bestScore}`),
        h('p', { class: 'result-xp', 'aria-live': 'polite' }, xp > 0 ? `+${xp} XP` : 'Този път без XP: нямаше вярна реакция.')),
      stats.rows ? h('dl', { class: 'stats' }, stats.rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))) : null,
      h('button', { class: 'btn btn-primary btn-big', onclick: startCountdown }, 'Още веднъж'),
      h('a', { class: 'btn', href: '#/' }, 'Към началото'),
    );
  }

  showIntro();
  return leaveGame;
}
