// SM-2 за тихия преговор. Датите са само YYYY-MM-DD и се ползват вътрешно, за да се знае кое е готово.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isISODate = (s) => typeof s === 'string' && DATE_PATTERN.test(s) && !Number.isNaN(Date.parse(s));

export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Превръща процент верни отговори в оценка 0–5 за SM-2.
export function gradeFromPercent(pct) {
  if (pct >= 95) return 5;
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  if (pct >= 20) return 1;
  return 0;
}

// Класическото SM-2. Слаб преговор само скъсява интервала: отметката за усвоена тема не се губи.
export function reviewUpdate(sm2, grade, today) {
  const prev = sm2 || { ef: 2.5, interval: 0, reps: 0, due: today };
  const ef = Math.max(1.3, prev.ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  let reps;
  let interval;
  if (grade < 3) {
    reps = 0;
    interval = 1;
  } else {
    reps = prev.reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(prev.interval * ef);
  }
  return { ef: Math.round(ef * 100) / 100, interval, reps, due: addDays(today, interval) };
}

export const isDue = (sm2, today) => Boolean(sm2) && sm2.due <= today;
