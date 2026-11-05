// „Кой тренира?“: изборът на профил, отключването и създаването на нов.
// Екранът не сравнява никого с никого: показва само името, съществото и стъпката.
import { confirmDialog, h, mount, toast } from '../core/dom.js';
import { ROLE_LABELS, checkSecret, defaultProfileEntry, lockProfile } from '../core/profiles.js';
import { addEntry, openProfile, requestPersistence, state, waitingMs } from '../core/store.js';
import { icon } from './icons.js';
import { worldOf } from '../content/worlds/index.js';
import { avatarEl, creatureAt, fullName } from './ui.js';

const seconds = (ms) => Math.ceil(ms / 1000);

// Профилът е отворен: приложението се пренастройва и тръгва от началото.
function announceOpen() {
  document.dispatchEvent(new CustomEvent('profile-open'));
  location.hash = '#/';
}

function unlockPanel(entry, rerender) {
  const input = h('input', {
    type: 'password',
    inputmode: 'numeric',
    class: 'pin-input',
    autocomplete: 'current-password',
    'aria-label': `Парола или ПИН за ${entry.name}`,
    maxlength: '64',
  });
  const message = h('p', { class: 'muted small', 'aria-live': 'polite' }, '');
  let busy = false;

  const tick = () => {
    const waiting = waitingMs(entry.id);
    if (waiting <= 0) {
      message.textContent = '';
      return;
    }
    message.textContent = `Изчакай ${seconds(waiting)} секунди и опитай пак.`;
    setTimeout(tick, 500);
  };

  const submit = async () => {
    if (busy) return;
    const waiting = waitingMs(entry.id);
    if (waiting > 0) { tick(); return; }
    busy = true;
    message.textContent = 'Проверявам…';
    const result = await openProfile(entry.id, input.value);
    busy = false;
    input.value = '';
    if (result.ok) { announceOpen(); return; }
    if (result.reason === 'wrong') {
      message.textContent = result.waiting > 0
        ? `Грешна парола. Изчакай ${seconds(result.waiting)} секунди.`
        : 'Грешна парола. Опитай пак.';
      if (result.waiting > 0) tick();
    } else if (result.reason === 'waiting') tick();
    else message.textContent = 'Профилът не може да се отвори.';
    // Полето остава на екрана: след сгрешена парола се пише пак тук, а не отначало.
    input.focus();
  };

  const form = h('form', {
    class: 'who-unlock',
    onsubmit: (e) => { e.preventDefault(); submit(); },
  },
  h('label', { class: 'small muted' }, `Парола или ПИН за „${entry.name}“`),
  input,
  h('div', { class: 'row' },
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Отключи'),
    h('button', { class: 'btn', type: 'button', onclick: rerender }, 'Назад')),
  message);
  setTimeout(() => input.focus(), 50);
  tick();
  return form;
}

function profileCard(entry, onPick) {
  // Светът стои в картата: затова се вижда правилният аватар, без да се отключва профилът.
  const world = worldOf(entry.card.world);
  const creature = creatureAt(entry.card.step, world);
  return h('button', {
    class: 'who-card', type: 'button', onclick: () => onPick(entry),
  },
  avatarEl(creature, 'who-avatar'),
  h('span', { class: 'who-name' }, entry.name),
  h('span', { class: 'who-step muted small' }, fullName(entry.card.step, world)),
  h('span', { class: 'who-role small muted' },
    entry.lock ? icon('lock') : null,
    h('span', {}, ROLE_LABELS[entry.role])));
}

// Първият профил на устройството винаги е администратор: той създава останалите.
function firstProfileForm(rerender) {
  const name = h('input', { type: 'text', class: 'text-input', maxlength: '24', 'aria-label': 'Име', placeholder: 'Име' });
  const pin = h('input', {
    type: 'password', inputmode: 'numeric', class: 'pin-input', maxlength: '64',
    'aria-label': 'ПИН или парола, по желание', placeholder: 'ПИН или парола (по желание)',
  });
  const message = h('p', { class: 'muted small', 'aria-live': 'polite' }, '');

  const submit = async () => {
    const secret = pin.value.trim();
    if (secret) {
      const problem = checkSecret(secret);
      if (problem) { message.textContent = problem; return; }
    }
    message.textContent = 'Създавам…';
    let entry = defaultProfileEntry({ name: name.value, role: 'admin', order: 0 });
    if (secret) entry = await lockProfile(entry, secret);
    await addEntry(entry);
    // Точно тук браузърът е най-склонен да каже „да“: човекът току-що е направил нещо свое.
    await requestPersistence();
    if (secret) {
      message.textContent = '';
      await confirmDialog({
        title: 'Запомни паролата',
        body: [
          'Паролата не се пази никъде — нито в приложението, нито навън. Само тя отключва този профил.',
          'Ако се забрави, прогресът се връща единствено от изтеглено копие. Направи си копие още сега, спокойно.',
        ],
        ok: 'Разбрах',
        cancel: null,
      });
      rerender();
      return;
    }
    const result = await openProfile(entry.id);
    if (result.ok) announceOpen();
    else rerender();
  };

  return h('form', { class: 'card who-create', onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('h2', {}, 'Първи профил'),
    h('p', { class: 'muted small' }, 'Този профил е администраторът: той създава останалите и може да нулира детски ПИН.'),
    name,
    pin,
    h('p', { class: 'muted small' }, 'Без парола профилът се отваря направо. С парола съдържанието му се шифрова на устройството.'),
    h('div', { class: 'row' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Създай')),
    message);
}

export function renderWho(root) {
  const rerender = () => renderWho(root);
  const first = !state.profiles.length;

  if (first) {
    mount(root,
      h('h1', { class: 'page-title' }, 'Добре дошъл'),
      h('p', {}, 'Всичко се пази само на това устройство. Започни с един профил; после можеш да добавиш и други.'),
      firstProfileForm(rerender));
    return;
  }

  const onPick = async (entry) => {
    if (entry.lock) {
      mount(root,
        h('h1', { class: 'page-title' }, 'Кой тренира?'),
        h('div', { class: 'who-grid' }, state.profiles.map((p) => profileCard(p, onPick))),
        unlockPanel(entry, rerender));
      return;
    }
    const result = await openProfile(entry.id);
    if (result.ok) announceOpen();
    else toast('Профилът не може да се отвори.');
  };

  mount(root,
    h('h1', { class: 'page-title' }, 'Кой тренира?'),
    h('p', { class: 'muted small' }, 'Всеки профил има свой напредък. Нищо не се сравнява и не се смесва.'),
    h('div', { class: 'who-grid' }, state.profiles.map((p) => profileCard(p, onPick))),
    // Нови профили се създават от администратора, вътре в Настройки → Профили.
    h('p', { class: 'muted small' }, 'Нови профили се създават от администратора в Настройки.'));
}

// Мек край на сесията за детски профил: без звук, без натиск и без нищо отключено насила.
const minutesWord = (n) => `${n} ${n === 1 ? 'минута' : 'минути'}`;

export function renderRest(root, { minutes }) {
  mount(root,
    h('h1', { class: 'page-title' }, 'Добра работа днес.'),
    h('p', {}, 'Почивка за очите и тялото.'),
    h('p', { class: 'muted' }, `Днешната сесия беше ${minutesWord(minutes)}. Утре продължаваме оттук.`),
    h('a', { class: 'btn btn-primary btn-big', href: '#/who', onclick: () => document.dispatchEvent(new CustomEvent('profile-close')) }, 'Смени профила'));
}
