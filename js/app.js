// Входна точка: зарежда данните, регистрира модулите и управлява навигацията.
import { h } from './core/dom.js';
import { registerGames } from './core/registry.js';
import { loadState, requestPersistence, state } from './core/store.js';
import { applyTheme } from './core/theme.js';
import games from './modules/index.js';
import './install.js';
import { renderGallery } from './views/gallery.js';
import { renderHome } from './views/home.js';
import { renderMathHome, renderMathSession, renderSubtopic } from './views/math.js';
import { watchFrameRate } from './views/perf.js';
import { renderPlay } from './views/play.js';
import { renderProfile } from './views/profile.js';
import { renderSettings } from './views/settings.js';
import { initShell, renderShell } from './views/shell.js';
import { renderTrain } from './views/train.js';

const view = document.getElementById('view');
let cleanup = null;

function route() {
  if (cleanup) cleanup();
  cleanup = null;
  window.scrollTo(0, 0);
  const [, name = '', arg, mode] = location.hash.replace(/^#/, '').split('/');

  if (name === 'train') renderTrain(view);
  else if (name === 'games') renderTrain(view, 'cognitive');
  else if (name === 'reflex') renderTrain(view, 'reflex');
  else if (name === 'gallery') renderGallery(view);
  else if (name === 'profile') renderProfile(view);
  else if (name === 'settings') renderSettings(view);
  else if (name === 'play' && arg) cleanup = renderPlay(view, arg) || null;
  else if (name === 'math' && arg && mode) cleanup = renderMathSession(view, arg, mode) || null;
  else if (name === 'math' && arg) renderSubtopic(view, arg);
  else if (name === 'math') renderMathHome(view);
  else renderHome(view);

  renderShell(name, arg);
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
  initShell();
  window.addEventListener('hashchange', route);
  route();
  document.body.classList.add('ready');
  requestPersistence();
  registerServiceWorker();
  watchFrameRate();
}

boot();
