// Обвивка, която дава на всяка игра общия интерфейс: init, start, stop, score, difficulty, xpReward, skills.
// Самата игра описва само своите стъпки в spec: setup, frame, onAnswer, onTap, onKey.
import { h } from '../../core/dom.js';
import { sessionXP } from '../../core/evolution.js';
import { TrialLog, inputKindOf, isValidReaction, reactionMs } from './trial-log.js';

// Цифрите 1–9 избират n-тия бутон с отговор. Стои тук, а не във всяка игра поотделно,
// защото е един и същ жест навсякъде, където отговорът е бутон.
function pressDigit(game, event, spec) {
  const index = Number(event.key) - 1;
  if (!Number.isInteger(index) || index < 0 || index > 8 || !spec.onAnswer) return false;
  const button = game.stage.querySelectorAll('[data-answer]')[index];
  if (!button) return false;
  spec.onAnswer(game, button.dataset.answer, event);
  return true;
}

// Клавиатурен курсор за игрите с мрежа: стрелките местят, Enter или интервал избира.
// Броят колони се чете от --size на самата мрежа, затова важи за всяка мрежа без настройка.
function gridColumns(buttons) {
  const parent = buttons[0].parentElement;
  const size = parent ? Number.parseInt(getComputedStyle(parent).getPropertyValue('--size'), 10) : NaN;
  return Number.isInteger(size) && size > 0 ? size : buttons.length;
}

function moveCursor(game, event, spec) {
  const buttons = [...game.stage.querySelectorAll('[data-answer]')];
  if (!buttons.length || !spec.onAnswer) return false;
  const columns = gridColumns(buttons);
  const step = {
    ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns,
  }[event.code];
  const at = Math.min(game.cursor || 0, buttons.length - 1);
  if (step !== undefined) {
    game.cursor = Math.min(buttons.length - 1, Math.max(0, at + step));
    for (const b of buttons) b.classList.remove('kb-cursor');
    buttons[game.cursor].classList.add('kb-cursor');
    return true;
  }
  if (event.code !== 'Enter' && event.code !== 'Space') return false;
  spec.onAnswer(game, buttons[at].dataset.answer, event);
  return true;
}

export function createGame(spec) {
  return {
    id: spec.id,
    title: spec.title,
    category: spec.category,
    unlockStep: spec.unlockStep,
    skills: spec.skills,
    description: spec.description,
    // Какво върши клавиатурата: показва се във въведението преди играта.
    keys: spec.keys || null,
    allowHidden: Boolean(spec.allowHidden),
    demo: spec.demo,
    introOptions: spec.introOptions,
    log: null,

    get difficulty() {
      return this.log ? this.log.level : 1;
    },

    init(ctx) {
      this.ctx = ctx;
      // up идва от профила: детският се качва след един верен отговор повече.
      this.log = new TrialLog({
        startLevel: ctx.difficulty, maxLevel: ctx.maxDifficulty, adapt: spec.adapt !== false, up: ctx.staircaseUp,
      });
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
      this.cursor = 0;
      this.onKeyDown = (e) => {
        if (!this.running || e.repeat) return;
        if (spec.onKey && spec.onKey(this, e)) { e.preventDefault(); return; }
        if (spec.digitKeys && pressDigit(this, e, spec)) { e.preventDefault(); return; }
        if (spec.gridKeys && moveCursor(this, e, spec)) e.preventDefault();
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
      // Видът вход се чете от самото събитие и важи за този опит: така нито една игра
      // не го пренася на ръка, а времената от мишка и клавиатура не се смесват в отчета.
      this.log.input = inputKindOf(event);
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

    // Сборните числа на сесията за отчета за калибриране. Без тях записът пази само рекорда.
    calibration() {
      return this.log ? this.log.summary() : null;
    },
  };
}
