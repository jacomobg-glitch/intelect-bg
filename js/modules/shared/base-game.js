// Обвивка, която дава на всяка игра общия интерфейс: init, start, stop, score, difficulty, xpReward, skills.
// Самата игра описва само своите стъпки в spec: setup, frame, onAnswer, onTap, onKey.
import { h } from '../../core/dom.js';
import { sessionXP } from '../../core/evolution.js';
import { TrialLog, isValidReaction, reactionMs } from './trial-log.js';

export function createGame(spec) {
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    unlockStep: spec.unlockStep,
    skills: spec.skills,
    description: spec.description,
    allowHidden: Boolean(spec.allowHidden),
    demo: spec.demo,
    introOptions: spec.introOptions,
    log: null,

    get difficulty() {
      return this.log ? this.log.level : 1;
    },

    init(ctx) {
      this.ctx = ctx;
      this.log = new TrialLog({ startLevel: ctx.difficulty, maxLevel: ctx.maxDifficulty, adapt: spec.adapt !== false });
      this.running = false;
      this.state = {};
      this.elapsed = 0;

      this.timeFill = h('div', { class: 'game-time-fill' });
      this.levelLabel = h('span', {});
      this.statusLabel = h('span', { class: 'game-status' });
      this.stage = h('div', { class: 'game-board' });
      ctx.container.replaceChildren(
        h('div', { class: 'game-hud' },
          spec.runMs ? h('div', { class: 'game-time' }, this.timeFill) : this.statusLabel,
          this.levelLabel),
        this.stage,
      );

      this.onPointer = (e) => {
        if (!this.running) return;
        const target = e.target.closest('[data-answer]');
        e.preventDefault();
        if (target && spec.onAnswer) spec.onAnswer(this, target.dataset.answer, e);
        else if (spec.onTap) spec.onTap(this, e);
      };
      this.stage.addEventListener('pointerdown', this.onPointer);
      this.onKeyDown = (e) => {
        if (!this.running || e.repeat || !spec.onKey) return;
        if (spec.onKey(this, e)) e.preventDefault();
      };
      document.addEventListener('keydown', this.onKeyDown);

      spec.setup(this, this.stage);
      this.updateLevel();
    },

    start() {
      this.running = true;
      this.t0 = performance.now();
      if (document.activeElement) document.activeElement.blur();
      if (spec.begin) spec.begin(this);
      const frame = () => {
        if (!this.running) return;
        const now = performance.now();
        this.elapsed = now - this.t0;
        if (spec.runMs) {
          this.timeFill.style.width = `${Math.max(0, 100 - (this.elapsed / spec.runMs) * 100)}%`;
          if (this.elapsed >= spec.runMs) {
            this.finish();
            return;
          }
        }
        if (spec.frame) spec.frame(this, now);
        if (this.running) this.raf = requestAnimationFrame(frame);
      };
      this.raf = requestAnimationFrame(frame);
    },

    finish() {
      if (!this.running) return;
      if (spec.beforeEnd) spec.beforeEnd(this);
      this.stop();
      this.ctx.onEnd();
    },

    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      clearTimeout(this.timer);
      this.stage?.removeEventListener('pointerdown', this.onPointer);
      document.removeEventListener('keydown', this.onKeyDown);
    },

    updateLevel() {
      this.levelLabel.textContent = spec.levelText ? spec.levelText(this.log.level) : `Трудност ${this.log.level}`;
    },

    // Времето тече от първия кадър, в който стимулът вече е на екрана.
    markOnset(trial) {
      requestAnimationFrame(() => {
        if (this.state.trial === trial) trial.onset = performance.now();
      });
    },

    // Връща валидно време на реакция или null, ако опитът е преждевременен.
    readReaction(trial, event) {
      if (!trial || trial.onset === null || trial.onset === undefined) {
        this.log.premature();
        return null;
      }
      const rt = reactionMs(event, trial.onset);
      if (!isValidReaction(rt)) {
        this.log.premature();
        return null;
      }
      return rt;
    },

    score() {
      return this.log.score();
    },

    // Без нито един верен отговор няма XP: оставено устройство не трупа напредък.
    xpReward() {
      if (!this.log.correctCount) return 0;
      const activeMs = spec.activeMs ? spec.activeMs(this) : this.elapsed;
      // Поне 1 XP: кратка сесия с верни отговори не бива да се закръгля до нула.
      return Math.max(1, sessionXP({ activeMs, quality: this.log.quality() }));
    },

    stats() {
      return { meanRT: spec.reportsRT === false ? null : this.log.meanRT(), rows: spec.rows ? spec.rows(this) : this.log.rows() };
    },
  };
}
