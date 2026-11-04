// Тестов режим за изпробване на еволюцията, преди игрите да са готови.
// Може да се изтрие заедно с папка js/dev: приложението продължава да работи без него.
// При включване реалният прогрес се запазва, а при изход се връща точно както е бил.
import { CUMULATIVE_XP, TOTAL_STEPS, levelFromXP, requiredLevel, applyXP } from '../core/evolution.js';
import { CONFIG, SKILLS, SKILL_LABELS } from '../core/config.js';
import { writeAll } from '../core/db.js';
import { h, mount, toast } from '../core/dom.js';
import { activeSkills } from '../core/registry.js';
import { saveProfile, state } from '../core/store.js';
import { showEvolution } from '../views/evolution.js';
import { fullName } from '../views/ui.js';

async function enter() {
  state.simSnapshot = state.profile;
  await writeAll([{ store: 'meta', value: { key: 'simSnapshot', profile: state.profile } }]);
}

async function leave() {
  const real = state.simSnapshot;
  state.simSnapshot = null;
  await writeAll([{ store: 'meta', delete: 'simSnapshot' }]);
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
