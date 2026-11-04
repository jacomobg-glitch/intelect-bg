// Математиката като модул с общия интерфейс. Логиката на сесията е без DOM, а екраните са в views/math.js.
import { makeTask, checkAnswer, MAX_LEVEL } from '../content/math/generators.js';
import { MASTERY_PERCENT } from '../content/math/topics.js';
import { CONFIG } from '../core/config.js';
import { sessionXP } from '../core/evolution.js';
import { gradeFromPercent, reviewUpdate } from '../core/sm2.js';

export const SESSION_SIZE = { practice: 8, test: 10, review: 5 };
const MAX_TASK_MS = 120000;       // замислен над задача е добре, забравено устройство не е
const HINT_CREDIT = [1, 0.75, 0.5, 0]; // колко струва верен отговор след 0, 1, 2 или 3 подсказки

// Тестът започва леко и стига до нивото, което таванът позволява.
export function testLevels(count, ceiling) {
  const top = Math.min(ceiling, MAX_LEVEL);
  return Array.from({ length: count }, (_, i) => Math.max(1, Math.ceil(((i + 1) / count) * top)));
}

const math = {
  id: 'math',
  title: 'Математика',
  category: 'math',
  unlockStep: 0,
  skills: ['math'],
  route: '#/math',
  description: 'От броенето нагоре: обяснения, примери и задачи.',
  difficulty: 1,

  // ctx: { topicId, mode, difficulty, maxDifficulty, random }
  init(ctx) {
    this.ctx = ctx;
    this.mode = ctx.mode;
    this.total = SESSION_SIZE[ctx.mode];
    this.ceiling = Math.max(1, ctx.maxDifficulty || 3);
    this.difficulty = Math.min(this.ceiling, MAX_LEVEL, Math.max(1, ctx.difficulty || 1));
    this.levels = ctx.mode === 'practice' ? null : testLevels(this.total, this.ceiling);
    this.index = -1;
    this.correctRun = 0;
    this.credit = 0;
    this.points = 0;
    this.correctCount = 0;
    this.activeMs = 0;
    this.task = null;
    this.finished = false;
  },

  start() {
    this.next();
  },

  stop() {
    this.closeTimer();
  },

  closeTimer() {
    if (this.taskStart === null || this.taskStart === undefined) return;
    this.activeMs += Math.min(MAX_TASK_MS, performance.now() - this.taskStart);
    this.taskStart = null;
  },

  // Минава към следващата задача. Връща false, когато сесията е свършила.
  next() {
    this.closeTimer();
    this.index += 1;
    if (this.index >= this.total) {
      this.finished = true;
      this.task = null;
      return false;
    }
    const level = this.levels ? this.levels[this.index] : this.difficulty;
    this.task = makeTask(this.ctx.topicId, level, this.ctx.random || Math.random);
    this.hintLevel = 0;
    this.answered = false;
    this.taskStart = performance.now();
    return true;
  },

  // Подсказки само при упражнение: намек → метод → решение.
  showHint() {
    if (this.mode !== 'practice' || this.answered || this.hintLevel >= 3) return null;
    this.hintLevel += 1;
    return this.task.hints[this.hintLevel - 1];
  },

  // Връща { correct, final }. final значи, че задачата е приключила и може да се продължи.
  answer(raw) {
    if (this.answered) return { correct: false, final: true };
    const correct = checkAnswer(this.task, raw);
    if (correct) {
      this.answered = true;
      const credit = this.mode === 'practice' ? HINT_CREDIT[this.hintLevel] : 1;
      this.settle(credit, credit >= HINT_CREDIT[1]);
      this.correctCount += 1;
      return { correct: true, final: true };
    }
    // При тест и преговор има един опит. При упражнение грешката отваря следващата подсказка.
    if (this.mode !== 'practice') {
      this.answered = true;
      this.settle(0, false);
      return { correct: false, final: true };
    }
    if (this.hintLevel < 3) this.hintLevel += 1;
    return { correct: false, final: false, hint: this.task.hints[this.hintLevel - 1] };
  },

  // Видяното решение затваря задачата без точки.
  giveUp() {
    if (this.answered) return;
    this.answered = true;
    this.settle(0, false);
  },

  settle(credit, wentWell) {
    this.credit += credit;
    this.points += credit * this.task.level * 10;
    if (this.mode !== 'practice') return;
    if (wentWell) {
      this.correctRun += 1;
      if (this.correctRun >= CONFIG.STAIRCASE_UP) {
        this.difficulty = Math.min(this.difficulty + 1, this.ceiling, MAX_LEVEL);
        this.correctRun = 0;
      }
    } else {
      this.correctRun = 0;
      this.difficulty = Math.max(1, this.difficulty - 1);
    }
  },

  percent() {
    return Math.round((this.correctCount / this.total) * 100);
  },

  score() {
    return Math.round(this.points);
  },

  xpReward() {
    if (this.credit <= 0) return 0;
    // Поне 1 XP: кратка сесия с верни отговори не бива да се закръгля до нула.
    return Math.max(1, sessionXP({ activeMs: this.activeMs, quality: this.credit / this.total }));
  },

  stats() {
    return {
      rows: [
        ['Верни', `${this.correctCount} от ${this.total}`],
        ['Точност', `${this.percent()}%`],
      ],
    };
  },
};

// Какво се променя в записа на темата след сесия. Чиста функция.
// Слаб резултат не отнема нищо: отметката остава, само преговорът идва по-рано.
export function applyOutcome(topic, { mode, percent, level }, today) {
  const next = { ...topic };
  if (mode === 'practice') {
    next.level = level;
    return next;
  }
  next.bestTest = Math.max(topic.bestTest, percent);
  const grade = gradeFromPercent(percent);
  if (mode === 'test' && percent >= MASTERY_PERCENT) {
    next.sm2 = reviewUpdate(topic.mastered ? topic.sm2 : null, grade, today);
    if (!topic.mastered) {
      next.mastered = true;
      next.masteredAt = today;
    }
  } else if (mode === 'review' && topic.sm2) {
    next.sm2 = reviewUpdate(topic.sm2, grade, today);
  }
  return next;
}

export default math;
