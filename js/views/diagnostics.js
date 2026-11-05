// Скрит екран „Диагностика“ за проверка на истински телефон. Отключва се от тестовия режим.
import { h, mount, toast } from '../core/dom.js';
import { LowFpsDetector, buildReport, frameStats, inputLine, latencyStats, summarizeInput } from '../core/stats.js';
import { deviceSettings, fallbackStatus, resetFallback, updateDevice, watchFrames } from './perf.js';
import { APP_VERSION } from './settings.js';

const MEASURE_MS = 10000;
const num = (x, d = 0) => (x === null || x === undefined ? '–' : x.toFixed(d));

// taps е списък от { kind, ms }: пробната зона също помни с какво е натисната.
function collect(taps) {
  const samples = {};
  for (const { kind, ms } of taps) (samples[kind] ||= []).push(ms);
  return {
    version: APP_VERSION,
    userAgent: navigator.userAgent,
    screen: `${window.screen.width}×${window.screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: window.devicePixelRatio,
    fallback: fallbackStatus(),
    tap: latencyStats(taps.map((t) => t.ms)),
    tapInput: summarizeInput(samples),
    games: deviceSettings().games || {},
  };
}

async function copyText(text, area) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Отчетът е копиран.');
  } catch {
    // Без достъп до клипборда текстът остава избран, за да се копира на ръка.
    area.focus();
    area.select();
    toast('Копирай избрания текст на ръка.');
  }
}

export function renderDiagnostics(root) {
  if (!deviceSettings().diagnostics) {
    location.hash = '#/settings';
    return undefined;
  }

  const taps = [];
  let stopMeasure = null;
  const report = h('textarea', { class: 'diag-report', readonly: true, rows: '10', 'aria-label': 'Текст на отчета' });
  const paintReport = () => { report.value = buildReport(collect(taps)); };

  const tapOut = h('p', { class: 'diag-value' }, 'Още няма опити.');
  const record = (kind, ms) => {
    taps.push({ kind, ms });
    const samples = {};
    for (const t of taps) (samples[t.kind] ||= []).push(t.ms);
    tapOut.textContent = inputLine(summarizeInput(samples));
    paintReport();
  };
  // Зоната приема и клавиатура: на лаптоп повечето отговори идват оттам.
  const pad = h('div', {
    class: 'diag-pad',
    role: 'button',
    tabindex: '0',
    'aria-label': 'Зона за проба: натискай с мишка, пръст или клавиш',
    onpointerdown: (e) => {
      e.preventDefault();
      record(e.pointerType || 'mouse', performance.now() - e.timeStamp);
    },
    onkeydown: (e) => {
      if (e.repeat || (e.code !== 'Space' && e.code !== 'Enter')) return;
      e.preventDefault();
      record('keyboard', performance.now() - e.timeStamp);
    },
  }, 'Натискай тук: с мишка, с пръст или с интервал');

  const fpsOut = h('p', { class: 'diag-value' }, 'Натисни „Замери“ и не пипай екрана.');
  const measure = h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      if (stopMeasure) return;
      const deltas = [];
      measure.disabled = true;
      // Прагът за fallback се пази, а отделният детектор тук само следи същите кадри.
      stopMeasure = watchFrames(new LowFpsDetector(), (d) => {
        if (d > 500) return;
        deltas.push(d);
        const s = frameStats(deltas);
        fpsOut.textContent = `FPS средно ${num(s.avg)}, минимум ${num(s.min)}, 1% low ${num(s.low1)}`;
      });
      setTimeout(() => {
        stopMeasure?.();
        stopMeasure = null;
        measure.disabled = false;
      }, MEASURE_MS);
    },
  }, 'Замери 10 секунди');

  const status = fallbackStatus();
  const games = deviceSettings().games || {};

  mount(root,
    h('a', { class: 'back', href: '#/settings' }, '← Настройки'),
    h('h1', { class: 'page-title' }, 'Диагностика'),
    h('p', { class: 'muted small' }, 'Само технически данни за устройството. Нищо не се изпраща навън: отчетът излиза само ако го копираш сам.'),

    h('section', { class: 'group' },
      h('h2', {}, 'Устройство'),
      h('p', { class: 'diag-value diag-ua' }, navigator.userAgent),
      h('p', { class: 'diag-value' }, `Екран ${window.screen.width}×${window.screen.height}, прозорец ${window.innerWidth}×${window.innerHeight}, devicePixelRatio ${window.devicePixelRatio}`)),

    h('section', { class: 'group' },
      h('h2', {}, 'Плътен фон'),
      h('p', { class: 'diag-value' }, status.active ? `Включен: ${status.reason}.` : 'Изключен: ползва се стъкло.'),
      status.auto
        ? h('button', { class: 'btn', type: 'button', onclick: () => { resetFallback(); renderDiagnostics(root); } }, 'Върни стъклото')
        : null),

    h('section', { class: 'group' },
      h('h2', {}, 'Кадри в секунда'),
      fpsOut, measure,
      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox',
          checked: Boolean(deviceSettings().liveFps),
          onchange: (e) => updateDevice({ liveFps: e.target.checked }),
        }),
        h('span', {}, 'Показвай FPS на живо по време на игра'))),

    h('section', { class: 'group' },
      h('h2', {}, 'Забавяне при натискане'),
      h('p', { class: 'muted small' }, 'Времето от събитието до обработката му, поотделно за мишка, докосване, писалка и клавиатура. Не включва забавянето на самия сензор или клавиш.'),
      pad, tapOut),

    h('section', { class: 'group' },
      h('h2', {}, 'Изиграни игри'),
      Object.keys(games).length
        ? Object.entries(games).map(([id, g]) => h('div', { class: 'profile-row diag-game' },
          h('strong', {}, id),
          h('span', { class: 'small muted' }, `${num(g.avg)} FPS, 1% ${num(g.low1)}`),
          h('span', { class: 'small muted diag-input' }, g.input ? inputLine(g.input) : `докосване ${num(g.tapMean, 1)} ms`)))
        : h('p', { class: 'muted small' }, 'Изиграй игра до края и се върни тук.')),

    h('section', { class: 'group' },
      h('h2', {}, 'Отчет'),
      report,
      h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: () => { paintReport(); copyText(report.value, report); } }, 'Копирай отчета')));

  paintReport();
  return () => { stopMeasure?.(); };
}
