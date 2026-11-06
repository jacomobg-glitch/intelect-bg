// Общо за всички игри: дневник на опитите, staircase, точкуване. Без DOM, за да се тества в Node.
import { CONFIG } from '../../core/config.js';
import { INPUT_KINDS, mean, sd } from '../../core/stats.js';

export const MIN_VALID_RT = 100; // реакции под 100 ms се отхвърлят като преждевременни

// Целевият успех на staircase „N верни нагоре, 1 грешка надолу“.
// Трудността стои на място, когато изкачването и спадането са равновероятни: p^N = 1 − p^N,
// тоест p = 0.5^(1/N). При N = 3 това са около 79% успех: предизвикателство, но не разочарование.
export const staircaseTarget = (up = CONFIG.STAIRCASE_UP) => 0.5 ** (1 / Math.max(1, up));

// Времето идва от момента на самото докосване (pointerdown), а не от обработката му.
export const reactionMs = (event, onset) => (event.timeStamp || performance.now()) - onset;
export const isValidReaction = (rt) => rt >= MIN_VALID_RT;

// С какво е отговорено. Времената от мишка, пръст, писалка и клавиатура не се смесват:
// един и същ човек дава различни числа с различен вход, затова всеки опит носи своя вид.
export function inputKindOf(event) {
  if (!event) return 'mouse';
  if (typeof event.key === 'string') return 'keyboard';
  const kind = event.pointerType;
  return INPUT_KINDS.includes(kind) ? kind : 'mouse';
}

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
    // За отчета за калибриране: суми вместо списъци, защото отчетът е сборен и без история.
    this.input = 'mouse';   // вида вход на текущия опит; base-game го слага от събитието
    this.byInput = {};      // вид вход → { n, sum, sumSq } за време на реакция
    this.levelSum = 0;      // сума от трудностите по опити → средна трудност на сесията
    this.levelTrials = 0;
  }

  // Един приключил опит: трудността, на която е станал, влиза в средната.
  noteLevel() {
    this.levelSum += this.level;
    this.levelTrials += 1;
  }

  noteReaction(rt) {
    const box = (this.byInput[this.input] ||= { n: 0, sum: 0, sumSq: 0 });
    box.n += 1;
    box.sum += rt;
    box.sumSq += rt * rt;
  }

  correct({ rt = null, limit = null } = {}) {
    this.points += trialPoints(this.level, rt, limit);
    this.correctCount += 1;
    this.noteLevel();
    if (rt !== null) {
      this.rts.push(rt);
      this.noteReaction(rt);
    }
    if (!this.adapt) return;
    this.run += 1;
    if (this.run >= this.up) {
      this.level = Math.min(this.level + 1, this.maxLevel);
      this.run = 0;
    }
  }

  // kind: 'miss' (пропуск) или 'wrong' (грешно натискане)
  error(kind = 'wrong') {
    this.noteLevel();
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

  // Сборните числа за отчета за калибриране. Само суми: без дати и без списък с опити.
  summary() {
    return {
      trials: this.total,
      correct: this.correctCount,
      wrong: this.wrong,
      misses: this.misses,
      premature: this.prematureCount,
      level: this.level,
      levelSum: this.levelSum,
      levelTrials: this.levelTrials,
      rt: this.byInput,
    };
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
