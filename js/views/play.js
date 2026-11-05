// Обвивка на всяка игра: въведение, отброяване, игра, резултат. Работи само през общия интерфейс.
import { h, mount } from '../core/dom.js';
import { FEELS, FEEL_LABELS, startDifficulty } from '../core/model.js';
import { getGame, isUnlocked } from '../core/registry.js';
import {
  childStart, completeSession, isHidden, markDemoSeen, maxDifficulty, recordOf, saveFeel, saveSettings,
  staircaseUp, state,
} from '../core/store.js';
import { showEvolution } from './evolution.js';
import { startGameMonitor } from './perf.js';

// Едно докосване по желание след играта. Без задължение, без напомняне и без история:
// пази се само последната оценка и тя мести началната трудност на следващата сесия с най-много 1.
export function feelRow(gameId) {
  const row = h('div', { class: 'feel-row' });
  const note = h('p', { class: 'muted small feel-note', 'aria-live': 'polite' }, 'Как беше? Отговорът е по желание.');
  const buttons = FEELS.map((feel) => h('button', {
    class: 'btn btn-small', type: 'button',
    onclick: async () => {
      await saveFeel(gameId, feel);
      for (const b of buttons) b.disabled = true;
      note.textContent = 'Записано. Следващият път ще започне съобразено с това.';
    },
  }, FEEL_LABELS[feel]));
  row.append(...buttons);
  return h('div', { class: 'feel' }, note, row);
}

// options.next по желание сменя бутоните на резултата с продължение (например „Изненадай ме“).
export function renderPlay(root, id, options = {}) {
  const game = getGame(id);
  // Скритата за този профил игра не се отваря и през адреса.
  if (!game || !isUnlocked(game, state.profile.step) || isHidden(id)) {
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
      options.kicker ? h('p', { class: 'muted small' }, options.kicker) : null,
      h('h1', { class: 'page-title' }, game.title),
      notice ? h('p', { class: 'notice' }, notice) : null,
      h('p', {}, game.description),
      demo,
      // Лаптопът е основното устройство: как се играе с клавиатура се вижда още тук.
      game.keys ? h('p', { class: 'muted small keys-hint' }, `Клавиатура: ${game.keys}`) : null,
      game.introOptions ? game.introOptions({ settings: state.settings, save: saveSettings }) : null,
      rec.bestScore > 0 ? h('p', { class: 'muted' }, `Личен рекорд: ${rec.bestScore}`) : null,
      h('button', { class: 'btn btn-primary btn-big', onclick: startCountdown }, 'Старт'),
      options.back === null ? null : h('a', { class: 'btn', href: options.back || '#/train' }, 'Назад'),
    );
  }

  function startCountdown() {
    if (!recordOf(game.id).demoSeen) markDemoSeen(game.id);
    let n = 3;
    const number = h('div', { class: 'countdown', 'aria-live': 'polite' }, String(n));
    const stage = h('div', { class: 'game-stage' });
    const exit = h('button', {
      class: 'btn game-exit',
      onclick: () => { leaveGame(); location.hash = options.back || '#/train'; },
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
      game.init({
        container: stage,
        // Детският профил започва една стъпка по-ниско и се качва по-бавно.
        difficulty: childStart(startDifficulty(recordOf(game.id))),
        maxDifficulty: maxDifficulty(),
        staircaseUp: staircaseUp(),
        settings: state.settings,
        onEnd: finish,
      });
      active = true;
      game.start();
      stopMonitor = startGameMonitor(game.id, wrap);
    }, 800);
  }

  async function finish() {
    active = false;
    leaveGame();
    const result = await completeSession(game);
    if (options.onFinish) options.onFinish(result);
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
      feelRow(game.id),
      options.next
        ? h('button', { class: 'btn btn-primary btn-big', onclick: options.next.onClick }, options.next.label)
        : h('button', { class: 'btn btn-primary btn-big', onclick: startCountdown }, 'Още веднъж'),
      options.next ? null : h('a', { class: 'btn', href: '#/' }, 'Към началото'),
    );
  }

  showIntro();
  return leaveGame;
}
