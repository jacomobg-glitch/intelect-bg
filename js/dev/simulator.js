// Тестов режим за изпробване на еволюцията, преди игрите да са готови.
// Може да се изтрие заедно с папка js/dev: приложението продължава да работи без него.
// При включване реалният прогрес се запазва, а при изход се връща точно както е бил.
import { CUMULATIVE_XP, TOTAL_STEPS, levelFromXP, requiredLevel, applyXP } from '../core/evolution.js';
import { CONFIG, SKILLS, SKILL_LABELS } from '../core/config.js';

import { h, mount, toast } from '../core/dom.js';
import { activeSkills } from '../core/registry.js';
import { saveProfile, setSimSnapshot, state } from '../core/store.js';
import { showEvolution } from '../views/evolution.js';
import { updateDevice } from '../views/perf.js';
import { fullName } from '../views/ui.js';

async function enter() {
  await setSimSnapshot(state.profile);
}

async function leave() {
  const real = state.simSnapshot;
  await setSimSnapshot(null);
  await saveProfile(real);
}

async function give(amount, skills) {
  if (!state.simSnapshot) await enter();
  const { profile, from, to } = applyXP(state.profile, amount, skills, activeSkills);
  await saveProfile(profile);
  if (to > from) await showEvolution(from, to);
}

// Точно колкото XP и нива са нужни за следващата стъпка.
function profileAtStep(step) {
  const need = requiredLevel(step);
  const minSkill = CONFIG.LEVEL_K * need * need;
  const skillXP = Object.fromEntries(SKILLS.map((s) => [s, Math.max(minSkill, CUMULATIVE_XP[step] / SKILLS.length)]));
  return { ...state.profile, totalXP: CUMULATIVE_XP[step], skillXP, step };
}

// Плъзгач за прага SKILL_SHARE_THRESHOLD: показва на живо какво би било изискването за
// следващите 5 стъпки. Само предварителен изглед: реалният прогрес се смята с числото от конфигурацията.
function thresholdPreview() {
  const [lo, hi] = CONFIG.SKILL_SHARE_RANGE;
  const real = CONFIG.SKILL_SHARE_THRESHOLD;
  const steps = Array.from({ length: 5 }, (_, i) => state.profile.step + 1 + i).filter((s) => s < TOTAL_STEPS);
  const value = h('output', { class: 'thr-value' }, `${Math.round(real * 100)}%`);
  const body = h('tbody', {});
  const paint = (t) => {
    value.textContent = `${Math.round(t * 100)}%`;
    body.replaceChildren(...steps.map((step) => h('tr', {},
      h('th', { scope: 'row' }, fullName(step)),
      h('td', {}, String(requiredLevel(step, real))),
      h('td', {}, String(requiredLevel(step, t))))));
  };
  const slider = h('input', {
    type: 'range',
    class: 'thr-slider',
    min: String(Math.round(lo * 100)),
    max: String(Math.round(hi * 100)),
    step: '1',
    value: String(Math.round(real * 100)),
    'aria-label': 'Дял от справедливия дял XP за всяка способност',
    oninput: (e) => paint(Number(e.target.value) / 100),
  });
  paint(real);
  return h('div', { class: 'thr' },
    h('p', { class: 'small' }, 'Праг за всяка способност: ', value),
    slider,
    steps.length
      ? h('table', { class: 'compare' },
        h('thead', {}, h('tr', {},
          h('th', {}, 'Стъпка'),
          h('th', {}, `Сега (${Math.round(real * 100)}%)`),
          h('th', {}, 'С плъзгача'))),
        body)
      : h('p', { class: 'muted small' }, 'Няма следващи стъпки.'),
    h('p', { class: 'muted small' }, 'Плъзгачът не пипа прогреса. Окончателната стойност се сменя в js/core/config.js.'));
}

export function renderSimulator(slot, rerender) {
  const after = async (action) => {
    await action();
    rerender();
  };

  const stepSelect = h('select', { class: 'select', 'aria-label': 'Стъпка' },
    Array.from({ length: TOTAL_STEPS }, (_, i) => {
      const opt = h('option', { value: String(i) }, `${i + 1}. ${fullName(i)}`);
      opt.selected = i === state.profile.step;
      return opt;
    }));

  const levels = SKILLS.map((s) => `${SKILL_LABELS[s]} ${levelFromXP(state.profile.skillXP[s])}`).join(', ');

  mount(slot, h('section', { class: 'group test-panel' },
    h('h2', {}, 'Тестов режим'),
    h('p', { class: 'muted small' }, 'Промените тук са временни. „Излез“ връща реалния прогрес.'),
    h('a', { class: 'btn', href: '#/diagnostics', onclick: () => updateDevice({ diagnostics: true }) }, 'Диагностика'),
    h('p', { class: 'small' }, `${fullName(state.profile.step)}, ${Math.floor(state.profile.totalXP)} XP. ${levels}.`),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => after(() => give(600, SKILLS)) }, '+600 XP (всички)'),
      h('button', { class: 'btn', onclick: () => after(() => give(6000, SKILLS)) }, '+6000 XP (всички)')),
    h('div', { class: 'row' }, SKILLS.map((s) => h('button', {
      class: 'btn btn-small',
      onclick: () => after(() => give(500, [s])),
    }, `+500 ${SKILL_LABELS[s]}`))),
    h('div', { class: 'row' },
      stepSelect,
      h('button', {
        class: 'btn',
        onclick: () => after(async () => {
          if (!state.simSnapshot) await enter();
          const from = state.profile.step;
          const to = Number(stepSelect.value);
          await saveProfile(profileAtStep(to));
          if (to > from) await showEvolution(from, to);
        }),
      }, 'Скочи')),
    thresholdPreview(),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        onclick: () => {
          const from = Math.floor(state.profile.step / 3) * 3 - 1;
          showEvolution(Math.max(0, from), Math.max(3, Math.floor(state.profile.step / 3) * 3));
        },
      }, 'Покажи анимацията'),
      state.simSnapshot
        ? h('button', {
          class: 'btn btn-primary',
          onclick: () => after(async () => {
            await leave();
            toast('Реалният прогрес е върнат.');
          }),
        }, 'Излез и върни прогреса')
        : null)));
}
