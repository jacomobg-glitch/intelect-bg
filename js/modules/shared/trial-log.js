// Общо за всички игри: дневник на опитите, staircase, точкуване. Без DOM, за да се тества в Node.
import { CONFIG } from '../../core/config.js';
import { mean, sd } from '../../core/stats.js';

export const MIN_VALID_RT = 100; // реакции под 100 ms се отхвърлят като преждевременни

// Целевият успех на staircase „N верни нагоре, 1 грешка надолу“.
// Трудността стои на място, когато изкачването и спадането са равновероятни: p^N = 1 − p^N,
// тоест p = 0.5^(1/N). При N = 3 това са около 79% успех: предизвикателство, но не разочарование.
export const staircaseTarget = (up = CONFIG.STAIRCASE_UP) => 0.5 ** (1 / Math.max(1, up));

// Времето идва от момента на самото докосване (pointerdown), а не от обработката му.
export const reactionMs = (event, onset) => (event.timeStamp || performance.now()) - onset;
export const isValidReaction = (rt) => rt >= MIN_VALID_RT;

// Точки за верен отговор: трудност × 10, плюс до още толкова за бързина.
// Без време (например правилно въздържане) остава половината от основата.
export function trialPoints(level, rt = null, limit = null) {
  if (rt === null || !limit) return level * 5;
  return level * 10 * (1 + Math.max(0, 1 - rt / limit));
}

export class TrialLog {
  // adapt: true значи staircase „STAIRCASE_UP верни нагоре, 1 грешка надолу“ (виж staircaseTarget).
  constructor({ startLevel = 1, maxLevel = 3, adapt = true, up = CONFIG.STAIRCASE_UP } = {}) {
    this.maxLevel = Math.max(1, maxLevel);
    this.level = Math.min(Math.max(1, Math.round(startLevel) || 1), this.maxLevel);
    this.adapt = adapt;
    this.up = Math.max(1, up);
    this.points = 0;
    this.rts = [];
    this.correctCount = 0;
    this.misses = 0;
    this.wrong = 0;
    this.prematureCount = 0;
    this.run = 0;
  }

  correct({ rt = null, limit = null } = {}) {
    this.points += trialPoints(this.level, rt, limit);
    this.correctCount += 1;
    if (rt !== null) this.rts.push(rt);
    if (!this.adapt) return;
    this.run += 1;
    if (this.run >= this.up) {
      this.level = Math.min(this.level + 1, this.maxLevel);
      this.run = 0;
    }
  }

  // kind: 'miss' (пропуск) или 'wrong' (грешно натискане)
  error(kind = 'wrong') {
    if (kind === 'miss') this.misses += 1;
    else this.wrong += 1;
    if (!this.adapt) return;
    this.run = 0;
    this.level = Math.max(1, this.level - 1);
  }

  premature() {
    this.prematureCount += 1;
  }

  get total() {
    return this.correctCount + this.misses + this.wrong;
  }

  quality() {
    return this.total ? this.correctCount / this.total : 0;
  }

  score() {
    return Math.round(this.points);
  }

  meanRT() {
    return mean(this.rts);
  }

  rows(labels = {}) {
    const m = this.meanRT();
    const s = sd(this.rts);
    return [
      ['Средно време', m === null ? '–' : `${Math.round(m)} ms`],
      ['Вариабилност', s === null ? '–' : `±${Math.round(s)} ms`],
      [labels.correct || 'Верни', `${this.correctCount}`],
      [labels.wrong || 'Грешни', `${this.wrong}`],
      [labels.misses || 'Пропуски', `${this.misses}`],
      ['Преждевременни', `${this.prematureCount}`],
    ];
  }
}
