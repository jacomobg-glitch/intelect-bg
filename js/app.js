// Входна точка: зарежда профилите, регистрира модулите и управлява навигацията.
import { h } from './core/dom.js';
import { registerGames } from './core/registry.js';
import {
  closeProfile, isChild, isOpen, loadState, requestPersistence, state, syncActiveSkills,
} from './core/store.js';
import { applyTheme } from './core/theme.js';
import games from './modules/index.js';
import './install.js';
import { renderGallery } from './views/gallery.js';
import { renderHome } from './views/home.js';
import { renderMathHome, renderMathSession, renderSubtopic } from './views/math.js';
import { renderDiagnostics } from './views/diagnostics.js';
import { flushNotice, initPerf } from './views/perf.js';
import { renderPlay } from './views/play.js';
import { renderProfile } from './views/profile.js';
import { renderSettings } from './views/settings.js';
import { renderSurprise } from './views/surprise.js';
import { initShell, renderShell } from './views/shell.js';
import { renderTrain } from './views/train.js';
import { renderRest, renderWho } from './views/who.js';

const view = document.getElementById('view');
let cleanup = null;
let openedAt = 0;      // кога е отворен профилът: за тавана на сесията
let idleTimer = null;
let sessionTimer = null;

// Колко минути върви текущата сесия на профила.
const sessionMinutes = () => Math.floor((Date.now() - openedAt) / 60000);
const sessionLimit = () => (isOpen() ? state.entry.sessionLimitMin || 0 : 0);
const restReached = () => sessionLimit() > 0 && sessionMinutes() >= sessionLimit();

function stopTimers() {
  clearTimeout(idleTimer);
  clearTimeout(sessionTimer);
  idleTimer = null;
  sessionTimer = null;
}

// Автоматичен изход при бездействие. Важи само за заключен профил: там има какво да се пази.
function armIdle() {
  clearTimeout(idleTimer);
  const minutes = isOpen() && state.keys ? state.entry.autoLockMin || 0 : 0;
  if (!minutes) return;
  idleTimer = setTimeout(() => {
    if (cleanup) cleanup();
    cleanup = null;
    closeProfile();
    stopTimers();
    location.hash = '#/who';
  }, minutes * 60000);
}

// Мекият край на сесията идва сам, без да се чака следващо докосване.
function armSession() {
  clearTimeout(sessionTimer);
  const limit = sessionLimit();
  if (!limit) return;
  const left = limit * 60000 - (Date.now() - openedAt);
  sessionTimer = setTimeout(() => route(), Math.max(1000, left));
}

function onProfileOpen() {
  openedAt = Date.now();
  applyTheme(state.settings.theme);
  // Детският профил чете по-едър текст. Класът е на корена, за да важи навсякъде.
  document.documentElement.classList.toggle('kid', isChild());
  syncActiveSkills();
  armIdle();
  armSession();
}

function route() {
  if (cleanup) cleanup();
  cleanup = null;
  window.scrollTo(0, 0);
  const [, name = '', arg, mode] = location.hash.replace(/^#/, '').split('/');

  // Без отворен профил се вижда само „Кой тренира?“.
  if (!isOpen() && name !== 'who') {
    location.hash = '#/who';
    return;
  }

  // На екрана за почивка менютата се прибират: това е краят на сесията, а не нова страница.
  document.body.classList.toggle('resting', isOpen() && restReached());
  if (name === 'who') renderWho(view);
  else if (restReached()) renderRest(view, { minutes: sessionMinutes() });
  else if (name === 'train') renderTrain(view);
  else if (name === 'games') renderTrain(view, 'cognitive');
  else if (name === 'reflex') renderTrain(view, 'reflex');
  else if (name === 'gallery') renderGallery(view);
  else if (name === 'profile') renderProfile(view);
  else if (name === 'surprise') cleanup = renderSurprise(view) || null;
  else if (name === 'settings') renderSettings(view);
  else if (name === 'diagnostics') cleanup = renderDiagnostics(view) || null;
  else if (name === 'play' && arg) cleanup = renderPlay(view, arg) || null;
  else if (name === 'math' && arg && mode) cleanup = renderMathSession(view, arg, mode) || null;
  else if (name === 'math' && arg) renderSubtopic(view, arg);
  else if (name === 'math') renderMathHome(view);
  else renderHome(view);

  renderShell(name, arg);
  flushNotice();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // updateViaCache: 'none', за да не се закача стара версия в кеша на браузъра.
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((err) => {
    console.warn('Service worker не се регистрира:', err);
  });
}

async function boot() {
  try {
    await loadState();
  } catch (err) {
    console.error(err);
    view.replaceChildren(
      h('h1', { class: 'page-title' }, 'Данните не могат да се отворят'),
      h('p', {}, 'Браузърът не позволява локално съхранение (например в режим „инкогнито“). Отвори приложението в обикновен прозорец.'),
    );
    return;
  }
  applyTheme(state.settings.theme);
  registerGames(games);
  if (isOpen()) onProfileOpen();
  initShell();

  document.addEventListener('profile-open', onProfileOpen);
  // Смяна на ограниченията на отворения профил: таймерите се нагласят наново.
  document.addEventListener('profile-entry', () => { armIdle(); armSession(); });
  document.addEventListener('profile-close', () => {
    closeProfile();
    stopTimers();
    document.documentElement.classList.remove('kid');
  });
  // Всяко докосване и всеки клавиш отлагат автоматичния изход.
  for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, armIdle, true);

  window.addEventListener('hashchange', route);
  route();
  document.body.classList.add('ready');
  requestPersistence();
  registerServiceWorker();
  initPerf();
}

boot();
