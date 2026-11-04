// Наблюдение на кадрите и докосването. Настройките на устройството са в localStorage, а не в базата:
// не влизат в експорта, защото важат само за този телефон или лаптоп.
import { toast } from '../core/dom.js';
import { LowFpsDetector, frameStats, latencyStats } from '../core/stats.js';

const KEY = 'evolyutsiya-device';
const STARTUP_WATCH_MS = 12000;
const MAX_SAMPLES = 20000;

function readDevice() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function writeDevice(patch) {
  const next = { ...readDevice(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Без localStorage решението важи само до затварянето.
  }
  return next;
}

export const deviceSettings = readDevice;
export const updateDevice = writeDevice;

// Защо стъклото е изключено, ако е изключено.
export function fallbackStatus() {
  const device = readDevice();
  if (device.noBlur) return { active: true, reason: `средно ${device.fps} FPS за 3 секунди`, auto: true };
  if (window.CSS && !CSS.supports('backdrop-filter', 'blur(1px)') && !CSS.supports('-webkit-backdrop-filter', 'blur(1px)')) {
    return { active: true, reason: 'браузърът не поддържа размиване', auto: false };
  }
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) {
    return { active: true, reason: 'системна настройка за по-малко прозрачност', auto: false };
  }
  return { active: false, reason: null, auto: false };
}

let noticePending = false;

// Съобщението е тихо и еднократно. По време на игра изчаква следващия екран.
export function flushNotice() {
  if (!noticePending || document.body.classList.contains('playing')) return;
  noticePending = false;
  toast('Минах на плътен фон за по-плавна работа.');
}

function onLowFps(fps) {
  if (readDevice().noBlur) return;
  writeDevice({ noBlur: true, fps: Math.round(fps) });
  document.documentElement.classList.add('no-blur');
  noticePending = true;
  flushNotice();
}

export function resetFallback() {
  writeDevice({ noBlur: false, fps: null });
  document.documentElement.classList.remove('no-blur');
}

function watchFrames(detector, onFrame) {
  let last = null;
  let stopped = false;
  const tick = (now) => {
    if (stopped) return;
    if (last !== null) {
      const hit = detector.add(now);
      if (hit !== null) onLowFps(hit);
      if (onFrame) onFrame(now - last);
    }
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { stopped = true; };
}

export function initPerf() {
  if (readDevice().noBlur) document.documentElement.classList.add('no-blur');
  const stop = watchFrames(new LowFpsDetector());
  setTimeout(stop, STARTUP_WATCH_MS);
}

// Мери по време на игра. Връща функция, която спира и записва обобщението за тази игра.
export function startGameMonitor(gameId, host) {
  const deltas = [];
  const taps = [];
  const onDown = (e) => { if (taps.length < MAX_SAMPLES) taps.push(performance.now() - e.timeStamp); };
  document.addEventListener('pointerdown', onDown, true);

  const live = readDevice().liveFps ? document.createElement('div') : null;
  let sinceRepaint = 0;
  if (live) {
    live.className = 'perf-live';
    host.append(live);
  }

  const stopFrames = watchFrames(new LowFpsDetector(), (delta) => {
    // Дълга пауза значи скрит екран, а не бавен кадър.
    if (delta > 500) return;
    if (deltas.length < MAX_SAMPLES) deltas.push(delta);
    sinceRepaint += delta;
    if (live && sinceRepaint > 500) {
      sinceRepaint = 0;
      const s = frameStats(deltas.slice(-300));
      live.textContent = `FPS ${Math.round(s.avg)} · мин ${Math.round(s.min)} · 1% ${Math.round(s.low1)}`;
    }
  });

  return () => {
    stopFrames();
    document.removeEventListener('pointerdown', onDown, true);
    live?.remove();
    if (deltas.length < 30) return;
    const f = frameStats(deltas);
    const t = latencyStats(taps);
    writeDevice({
      games: { ...(readDevice().games || {}), [gameId]: { avg: f.avg, min: f.min, low1: f.low1, frames: f.frames, tapMean: t.mean, tapSd: t.sd, tapCount: t.count } },
    });
  };
}

export { watchFrames };
