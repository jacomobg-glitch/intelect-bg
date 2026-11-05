// Екрани по математика: дърво на темите, подтема с обяснения и примери, сесия със задачи.
import { ALL_SUBTOPICS, MASTERY_PERCENT, MATH_TREE, findSubtopic } from '../content/math/topics.js';
import { h, mount } from '../core/dom.js';
import { isDue, todayISO } from '../core/sm2.js';
import { completeSession, maxDifficulty, saveTopic, state, topicOf } from '../core/store.js';
import math, { SESSION_SIZE, applyOutcome } from '../modules/math.js';
import { showEvolution } from './evolution.js';
import { VISUALIZATIONS } from './math-viz.js';
import { fullName, t, xpName } from './ui.js';

const LEVEL_TABS = [['child', 'Като на дете'], ['standard', 'Стандартно'], ['why', 'Защо работи']];
const formatDate = (iso) => iso.split('-').reverse().join('.');
const isOpen = (subtopic) => state.profile.step >= subtopic.unlockStep;

export const dueSubtopics = () => {
  const today = todayISO();
  return ALL_SUBTOPICS.filter((s) => isOpen(s) && isDue(topicOf(s.id).sm2, today));
};

function checkbox(subtopic) {
  const topic = topicOf(subtopic.id);
  return h('label', { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked: topic.checked,
      onchange: (e) => saveTopic({ ...topicOf(subtopic.id), checked: e.target.checked }),
    }),
    h('span', {}, 'Моя отметка'));
}

const masteredBadge = (topic) => (topic.mastered
  ? h('span', { class: 'badge badge-done' }, `✓ Усвоена ${topic.masteredAt ? formatDate(topic.masteredAt) : ''}`)
  : null);

export function renderMathHome(root) {
  const due = dueSubtopics();
  mount(root,
    h('h1', { class: 'page-title' }, 'Математика'),
    h('p', { class: 'muted' }, 'Избери тема. Редът е препоръка, а не правило.'),
    due.length
      ? h('section', { class: 'review-quiet' },
        h('h2', {}, `Готови за преговор: ${due.length} ${due.length === 1 ? 'тема' : 'теми'}`),
        due.map((s) => h('a', { class: 'link-row', href: `#/math/${s.id}/review` }, s.title)))
      : null,
    MATH_TREE.map((group) => {
      const open = state.profile.step >= group.unlockStep;
      return h('section', { class: 'group' },
        h('h2', {}, group.title),
        open ? null : h('p', { class: 'muted small' }, `Отключва се при ${fullName(group.unlockStep)}`),
        group.subtopics.map((s) => {
          const topic = topicOf(s.id);
          const body = [
            h('strong', {}, s.title),
            h('span', { class: 'muted small' }, s.summary),
            masteredBadge(topic),
          ];
          return open
            ? h('a', { class: 'card card-link', href: `#/math/${s.id}` }, body)
            : h('div', { class: 'card card-locked' }, body);
        }));
    }));
}

function explanation(subtopic) {
  let current = 'child';
  const text = h('p', { class: 'explain-text' }, subtopic.explain[current]);
  const tabs = LEVEL_TABS.map(([key, label]) => h('button', {
    type: 'button',
    class: key === current ? 'active' : '',
    'aria-pressed': String(key === current),
    onclick: (e) => {
      current = key;
      text.textContent = subtopic.explain[key];
      for (const btn of e.currentTarget.parentElement.children) {
        const on = btn === e.currentTarget;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      }
    },
  }, label));
  return h('section', { class: 'group' }, h('h2', {}, 'Обяснение'),
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Ниво на обяснение' }, tabs), text);
}

function workedExample(example) {
  let shown = 1;
  const list = h('ol', { class: 'steps' });
  const next = h('button', { type: 'button', class: 'btn btn-small' }, 'Следваща стъпка');
  const paint = () => {
    list.replaceChildren(...example.steps.slice(0, shown).map((step) => h('li', {}, step)));
    next.hidden = shown >= example.steps.length;
  };
  next.addEventListener('click', () => { shown += 1; paint(); });
  paint();
  return h('div', { class: 'card example' }, h('strong', {}, example.title), list, next);
}

// Подтемата има една визуализация, а по желание и втора – друг поглед върху същата сметка.
// Без vizAlt няма превключвател: един изглед не се избира.
function vizSection(subtopic) {
  const host = h('div', {});
  if (!subtopic.vizAlt) {
    VISUALIZATIONS[subtopic.viz](host);
    return [host];
  }
  const ids = [subtopic.viz, subtopic.vizAlt];
  const names = subtopic.vizNames || ['Основен изглед', 'Друг изглед'];
  const buttons = ids.map((vizId, i) => h('button', {
    class: 'chip', type: 'button',
    onclick: () => {
      buttons.forEach((b, j) => {
        b.className = j === i ? 'chip chip-active' : 'chip';
        b.setAttribute('aria-pressed', String(j === i));
      });
      VISUALIZATIONS[vizId](host);
    },
  }, names[i]));
  buttons[0].className = 'chip chip-active';
  buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === 0)));
  VISUALIZATIONS[ids[0]](host);
  return [h('div', { class: 'row-inline', role: 'group', 'aria-label': 'Изглед' }, buttons), host];
}

export function renderSubtopic(root, id) {
  const subtopic = findSubtopic(id);
  if (!subtopic || !isOpen(subtopic)) {
    location.hash = '#/math';
    return;
  }
  const topic = topicOf(id);
  mount(root,
    h('a', { class: 'back', href: '#/math' }, '← Математика'),
    h('h1', { class: 'page-title' }, subtopic.title),
    h('div', { class: 'row-inline' }, masteredBadge(topic), checkbox(subtopic)),
    explanation(subtopic),
    h('section', { class: 'group' }, h('h2', {}, t('math.try')), vizSection(subtopic)),
    h('section', { class: 'group' }, h('h2', {}, t('math.examples')), subtopic.examples.map(workedExample)),
    h('section', { class: 'group' },
      h('h2', {}, 'Задачи'),
      h('a', { class: 'btn btn-primary btn-big', href: `#/math/${id}/practice` }, 'Упражнения'),
      h('a', { class: 'btn', href: `#/math/${id}/test` }, `Тест за овладяване (${SESSION_SIZE.test} задачи, ${MASTERY_PERCENT}%)`),
      isDue(topic.sm2, todayISO()) ? h('a', { class: 'btn', href: `#/math/${id}/review` }, 'Преговор') : null,
      topic.bestTest > 0 ? h('p', { class: 'muted small' }, `Най-добър тест: ${topic.bestTest}%`) : null));
}

const MODE_TITLES = { practice: 'Упражнения', test: 'Тест за овладяване', review: 'Преговор' };

// options.next по желание сменя бутоните на резултата с продължение (ползва се от „Изненадай ме“).
export function renderMathSession(root, id, mode, options = {}) {
  const subtopic = findSubtopic(id);
  if (!subtopic || !isOpen(subtopic) || !SESSION_SIZE[mode]) {
    location.hash = '#/math';
    return undefined;
  }

  const finish = async () => {
    const percent = math.percent();
    const result = await completeSession(math);
    await saveTopic(applyOutcome(topicOf(id), { mode, percent, level: math.difficulty }, todayISO()));
    if (options.onFinish) options.onFinish(result);
    if (result.to > result.from) await showEvolution(result.from, result.to);
    showResult(result, percent);
  };

  function showResult({ xp, coins = 0, stats }, percent) {
    const topic = topicOf(id);
    const kicker = options.kicker ? h('p', { class: 'muted small' }, options.kicker) : null;
    let message = 'Практиката е записана.';
    if (mode === 'test') {
      message = percent >= MASTERY_PERCENT
        ? 'Темата е усвоена.'
        : `Усвояването иска ${MASTERY_PERCENT}%. Можеш да опиташ пак, когато решиш.`;
    }
    if (mode === 'review') message = 'Преговорът е записан. Следващият идва тихо, когато му дойде времето.';
    mount(root,
      kicker,
      h('h1', { class: 'page-title' }, subtopic.title),
      h('div', { class: 'result' },
        h('p', { class: 'result-score' }, `${percent}%`),
        h('p', {}, message),
        masteredBadge(topic),
        h('p', { class: 'result-xp', 'aria-live': 'polite' }, xp > 0 ? `+${xp} ${xpName()}` : t('math.noXP', { xp: xpName() })),
        coins > 0 ? h('p', { class: 'result-coins' }, `+${coins} ${coins === 1 ? 'монета' : 'монети'}`) : null),
      h('dl', { class: 'stats' }, stats.rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
      options.next
        ? h('button', { class: 'btn btn-primary btn-big', onclick: options.next.onClick }, options.next.label)
        : h('button', { class: 'btn btn-primary btn-big', onclick: start }, 'Още веднъж'),
      options.next ? null : h('a', { class: 'btn', href: `#/math/${id}` }, 'Към темата'));
  }

  function showTask() {
    const task = math.task;
    const hintBox = h('div', { class: 'hints', 'aria-live': 'polite' });
    const feedback = h('p', { class: 'feedback', 'aria-live': 'polite' });
    const actions = h('div', { class: 'row' });

    const addHint = (text) => hintBox.append(h('p', { class: 'hint' }, text));

    const advance = () => {
      if (math.next()) showTask();
      else finish();
    };
    const showNext = () => {
      const next = h('button', { class: 'btn btn-primary btn-big', type: 'button', onclick: advance },
        math.index + 1 >= math.total ? 'Виж резултата' : 'Следваща задача');
      actions.replaceChildren(next);
      next.focus();
    };
    const submit = (raw) => {
      if (!String(raw).trim()) return;
      const r = math.answer(raw);
      if (r.correct) {
        feedback.textContent = t('math.correct');
        feedback.className = 'feedback feedback-ok';
        lock();
        showNext();
      } else if (r.final) {
        feedback.textContent = `Верният отговор е ${task.answer}.`;
        feedback.className = 'feedback feedback-no';
        lock();
        showNext();
      } else {
        feedback.textContent = t('math.wrong');
        feedback.className = 'feedback feedback-no';
        addHint(r.hint);
      }
    };

    let answerArea;
    let lock;
    if (task.kind === 'choice') {
      const buttons = task.options.map((option) => h('button', {
        class: 'btn btn-big', type: 'button', onclick: () => submit(option),
      }, option));
      answerArea = h('div', { class: 'row' }, buttons);
      lock = () => buttons.forEach((b) => { b.disabled = true; });
    } else {
      const input = h('input', {
        class: 'answer-input',
        type: 'text',
        // Интервалите и думите искат обикновена клавиатура, числата — цифрова.
        inputmode: task.kind === 'number' ? 'numeric' : 'text',
        autocomplete: 'off',
        'aria-label': 'Твоят отговор',
      });
      answerArea = h('form', {
        class: 'answer-form',
        onsubmit: (e) => {
          e.preventDefault();
          submit(input.value);
          if (!math.answered) { input.value = ''; input.focus(); }
        },
      }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Провери'));
      lock = () => { input.disabled = true; answerArea.querySelector('button').disabled = true; };
      setTimeout(() => input.focus(), 0);
    }

    const hintBtn = h('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        const hint = math.showHint();
        if (!hint) return;
        addHint(hint);
        hintBtn.textContent = [t('math.hint1'), t('math.hint2'), t('math.hint3')][math.hintLevel] || t('math.hint3');
        if (math.hintLevel >= 3) {
          hintBtn.remove();
          math.giveUp();
          lock();
          feedback.textContent = 'Това е решението. Тази задача не носи точки, но вече я видя.';
          feedback.className = 'feedback';
          showNext();
        }
      },
    }, t('math.hint1'));

    actions.replaceChildren(...(mode === 'practice' ? [hintBtn] : []));

    mount(root,
      options.kicker ? h('p', { class: 'muted small' }, options.kicker) : null,
      h('p', { class: 'muted small' }, `${MODE_TITLES[mode]} · ${subtopic.title} · задача ${math.index + 1} от ${math.total}`),
      h('p', { class: 'task-prompt' }, task.prompt),
      answerArea, feedback, hintBox, actions,
      h('a', { class: 'btn btn-quiet', href: options.back || `#/math/${id}` }, 'Изход'));
  }

  function start() {
    const topic = topicOf(id);
    math.init({ topicId: id, mode, difficulty: topic.level, maxDifficulty: maxDifficulty() });
    math.start();
    showTask();
  }

  start();
  return () => math.stop();
}
