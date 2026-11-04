// Стъклото е скъпо на слаби телефони. Ако кадрите падат при отваряне, приложението минава на плътен фон.
const SAMPLE_MS = 2500;
const MIN_FPS = 30;

export function watchFrameRate() {
  if (document.hidden) return;
  let frames = 0;
  const t0 = performance.now();
  const tick = (now) => {
    // Скрит екран спира кадрите и не значи бавно устройство.
    if (document.hidden) return;
    frames += 1;
    if (now - t0 < SAMPLE_MS) {
      requestAnimationFrame(tick);
    } else if ((frames * 1000) / (now - t0) < MIN_FPS) {
      document.documentElement.classList.add('no-blur');
    }
  };
  requestAnimationFrame(tick);
}
