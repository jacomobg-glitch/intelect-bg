// Чисти функции за измервания: средно, разсейване, кадри в секунда, откриване на слабо устройство, отчет.
export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function sd(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// От времена между кадрите в ms: средно FPS, минимум и „1% low“ (средното на най-бавните 1% кадри).
export function frameStats(deltas) {
  if (!deltas.length) return { avg: null, min: null, low1: null, frames: 0 };
  const sorted = [...deltas].sort((a, b) => b - a);
  const worst = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.01)));
  return {
    avg: 1000 / mean(deltas),
    min: 1000 / sorted[0],
    low1: 1000 / mean(worst),
    frames: deltas.length,
  };
}

export function latencyStats(samples) {
  return { mean: mean(samples), sd: sd(samples), count: samples.length };
}

// Сработва, когато средните FPS за целия прозорец са под прага. Дълга пауза между кадрите значи
// скрит екран или заспал телефон, а не бавно устройство, затова прозорецът започва отначало.
export class LowFpsDetector {
  constructor({ threshold = 45, windowMs = 3000, maxGapMs = 500 } = {}) {
    Object.assign(this, { threshold, windowMs, maxGapMs });
    this.times = [];
  }

  add(now) {
    const last = this.times[this.times.length - 1];
    if (last !== undefined && now - last > this.maxGapMs) this.times = [];
    this.times.push(now);
    while (this.times.length > 2 && now - this.times[1] >= this.windowMs) this.times.shift();
    const span = now - this.times[0];
    if (span < this.windowMs) return null;
    const fps = ((this.times.length - 1) * 1000) / span;
    return fps < this.threshold ? fps : null;
  }
}

const num = (x, digits = 0) => (x === null || x === undefined ? '–' : x.toFixed(digits));

// Отчетът за копиране: само техническа информация, без прогрес и без дати.
export function buildReport({ version, userAgent, screen, viewport, dpr, fallback, games, tap }) {
  const lines = [
    `Еволюция на ума, диагностика, версия ${version}`,
    `Браузър: ${userAgent}`,
    `Екран: ${screen}; прозорец: ${viewport}; devicePixelRatio: ${dpr}`,
    `Плътен фон: ${fallback.active ? 'включен' : 'изключен'}${fallback.reason ? ` (${fallback.reason})` : ''}`,
    `Докосване, пробна зона: средно ${num(tap.mean, 1)} ms, разсейване ${num(tap.sd, 1)} ms, ${tap.count} докосвания`,
    'Игри:',
  ];
  const ids = Object.keys(games);
  if (!ids.length) lines.push('  (още няма изиграни игри с тази версия)');
  for (const id of ids) {
    const g = games[id];
    lines.push(`  ${id}: FPS средно ${num(g.avg)}, минимум ${num(g.min)}, 1% low ${num(g.low1)}, кадри ${g.frames}; докосване средно ${num(g.tapMean, 1)} ms, разсейване ${num(g.tapSd, 1)} ms, ${g.tapCount} докосвания`);
  }
  return lines.join('\n');
}
