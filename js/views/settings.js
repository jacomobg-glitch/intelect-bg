// Настройки: тема, моят профил, профилите (за администратор), резервно копие, инсталиране.
// Тестовият режим се зарежда само при нужда.
import {
  BackupError, buildBackup, formatMoment, parseBackup, summarizeEntry, summarizePayload,
} from '../core/backup.js';
import { decryptJson, encryptJson, openWithPassword, unwrapDataKey } from '../core/crypto.js';
import { chooseDialog, confirmDialog, h, mount, promptDialog, toast } from '../core/dom.js';
import { creatureIndex, subLabel } from '../core/evolution.js';
import { mergePayload } from '../core/merge.js';
import {
  ROLE_LABELS, checkSecret, cleanName, cleanPayload, defaultProfileEntry, lockProfile,
} from '../core/profiles.js';
import { activeSkills } from '../core/registry.js';
import { addEntry, isAdmin, openProfile, removeEntry, saveEntry, saveSettings, state } from '../core/store.js';
import { applyTheme } from '../core/theme.js';
import { deviceSettings, updateDevice } from './perf.js';
import { activeSkin, formatXP, fullName } from './ui.js';
import { canInstall, promptInstall } from '../install.js';

const THEMES = [['auto', 'Като системата'], ['dark', 'Тъмна'], ['light', 'Светла']];
const COLOR_MODES = [[false, 'С цветове'], [true, 'С форми']];
export const APP_VERSION = '0.11.0';
const TAPS_FOR_TEST_MODE = 7;

const stepLabel = (step) => `${activeSkin().creatures[creatureIndex(step)].name} ${subLabel(step)}`;
const cardOfPayload = (payload) => ({ step: payload.profile.step, totalXP: payload.profile.totalXP });

const SUMMARY_ROWS = [
  ['Стъпка', (s) => (s.step === null ? '–' : stepLabel(s.step))],
  ['XP', (s) => (s.totalXP === null ? '–' : formatXP(s.totalXP))],
  ['Игри с рекорд', (s) => (s.records === null ? '–' : String(s.records))],
  ['Усвоени теми', (s) => (s.mastered === null ? '–' : String(s.mastered))],
];

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Експорт на избрани профили. Заключените излизат шифровани, както си стоят.
function exportProfiles(entries, suffix) {
  const backup = buildBackup(entries);
  download(`evolyutsiya-${suffix}-${backup.exportedAt.slice(0, 10)}.json`, JSON.stringify(backup, null, 2));
  updateDevice({ lastExport: backup.exportedAt });
  toast(entries.length > 1 ? 'Копието с всички профили е изтеглено.' : 'Копието е изтеглено.');
}

// Съдържанието на профил в четим вид: отвореният го дава от паметта, заключеният иска парола.
async function payloadOfEntry(entry, where) {
  if (entry.data) return entry.data;
  if (state.entry && state.entry.id === entry.id && state.keys) {
    return cleanPayload(await decryptJson(state.keys.dataKey, entry.enc));
  }
  const secret = await promptDialog({
    title: `Парола за „${entry.name}“`,
    body: [`Профилът е заключен (${where}). Без паролата съдържанието му не може да се слее.`],
    placeholder: 'ПИН или парола',
    password: true,
  });
  if (!secret) return null;
  const opened = await openWithPassword(entry.lock, secret);
  if (!opened) {
    await confirmDialog({ title: 'Грешна парола', body: ['Профилът остава непокътнат.'], ok: 'Добре', cancel: null });
    return null;
  }
  return cleanPayload(await decryptJson(opened.dataKey, entry.enc));
}

// Сравнение „устройство / файл / резултат“ за един профил.
function askMergeMode(name, local, incoming, merged) {
  return new Promise((resolve) => {
    const results = { merge: merged, replace: incoming };
    const cells = SUMMARY_ROWS.map(() => h('td', {}));
    const paint = (mode) => {
      const summary = summarizePayload(results[mode]);
      SUMMARY_ROWS.forEach(([, read], i) => { cells[i].textContent = read(summary); });
    };
    const choice = (value, label, note, checked) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'import-mode', value, checked, onchange: () => paint(value) }),
      h('span', {}, h('strong', {}, label), h('span', { class: 'muted small' }, note)));
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', {}, `Как да заредя „${name}“?`),
      choice('merge', 'Слей', 'Запазва по-доброто от двете места. Нищо постигнато не се губи.', true),
      choice('replace', 'Замени изцяло', 'Данните на този профил се заменят с тези от файла.', false),
      h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Устройство'), h('th', {}, 'Файл'), h('th', {}, 'Резултат'))),
        h('tbody', {}, SUMMARY_ROWS.map(([label, read], i) => h('tr', {},
          h('th', { scope: 'row' }, label),
          h('td', {}, read(summarizePayload(local))),
          h('td', {}, read(summarizePayload(incoming))),
          cells[i])))),
      h('p', { class: 'muted small compare-note' }, 'Ако си тренирал на двете устройства между два преноса, по-малкият принос няма да се добави.'),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => dialog.close('') }, 'Отказ'),
        h('button', { class: 'btn btn-primary', onclick: () => dialog.close(dialog.querySelector('input:checked').value) }, 'Зареди')));
    paint('merge');
    dialog.addEventListener('close', () => {
      const mode = dialog.returnValue;
      dialog.remove();
      resolve(mode ? results[mode] : null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Записва ново съдържание в профил: шифрова го наново, ако профилът е заключен.
async function writePayload(entry, payload) {
  if (!entry.lock) {
    await saveEntry({ ...entry, data: payload, enc: null, card: cardOfPayload(payload) });
    return true;
  }
  if (state.entry && state.entry.id === entry.id && state.keys) {
    await saveEntry({
      ...entry,
      enc: await encryptJson(state.keys.dataKey, payload),
      data: null,
      card: cardOfPayload(payload),
    });
    return true;
  }
  return false;
}

async function importBackup(file, rerender) {
  let parsed;
  try {
    parsed = parseBackup(await file.text());
  } catch (err) {
    const message = err instanceof BackupError ? err.message : 'Файлът не можа да бъде прочетен.';
    await confirmDialog({ title: 'Импортът не мина', body: [message, 'Данните ти не са променени.'], ok: 'Добре', cancel: null });
    return;
  }

  const report = [];
  for (const incoming of parsed.profiles) {
    // Копие отпреди профилите се слива с отворения профил: там е бил целият прогрес.
    const local = parsed.legacy ? state.entry : state.profiles.find((p) => p.id === incoming.id);
    if (!local) {
      await addEntry({ ...incoming, order: state.profiles.length });
      report.push(`„${incoming.name}“: добавен като нов профил.`);
      continue;
    }
    const localPayload = await payloadOfEntry(local, 'на устройството');
    if (!localPayload) { report.push(`„${local.name}“: пропуснат, няма парола.`); continue; }
    const incomingPayload = await payloadOfEntry(incoming, 'във файла');
    if (!incomingPayload) { report.push(`„${incoming.name}“: пропуснат, няма парола.`); continue; }

    const merged = mergePayload(localPayload, incomingPayload, activeSkills);
    const chosen = await askMergeMode(local.name, localPayload, incomingPayload, merged);
    if (!chosen) { report.push(`„${local.name}“: отказан.`); continue; }
    if (!await writePayload(local, chosen)) {
      report.push(`„${local.name}“: не може да се запише; отвори профила и опитай пак.`);
      continue;
    }
    report.push(`„${local.name}“: заредено.`);
    if (state.entry && state.entry.id === local.id) {
      // Отвореният профил се чете наново, за да не стои стар прогрес в паметта.
      if (local.lock) await openProfile(local.id, null);
      state.profile = chosen.profile;
      state.settings = chosen.settings;
      state.records = new Map(chosen.records.map((r) => [r.id, r]));
      state.topics = new Map(chosen.topics.map((t) => [t.id, t]));
      applyTheme(state.settings.theme);
    }
  }
  await confirmDialog({ title: 'Импортът приключи', body: report, ok: 'Добре', cancel: null });
  rerender();
}

// --- моят профил ---

function myProfileSection(rerender) {
  const entry = state.entry;
  if (!entry) return null;

  const rename = async () => {
    const name = await promptDialog({ title: 'Име на профила', value: entry.name, placeholder: 'Име' });
    if (name === null) return;
    await saveEntry({ ...entry, name: cleanName(name, entry.name) });
    rerender();
  };

  const setPassword = async () => {
    const secret = await promptDialog({
      title: entry.lock ? 'Нова парола или ПИН' : 'Парола или ПИН',
      body: [
        'ПИН е 4–6 цифри, паролата е поне 6 знака.',
        'Паролата не се пази никъде. Ако се забрави, прогресът се връща само от изтеглено копие — затова си направи копие.',
      ],
      placeholder: 'ПИН или парола',
      password: true,
    });
    if (!secret) return;
    const problem = checkSecret(secret);
    if (problem) { toast(problem); return; }
    const dataKey = state.keys ? state.keys.dataKey : null;
    const adminKey = entry.role === 'child' ? state.adminKey : null;
    const locked = await lockProfile(entry, secret, { dataKey, adminKey });
    await saveEntry(locked);
    // Профилът се отваря наново, за да е в паметта ключът от новата парола.
    await openProfile(entry.id, secret);
    toast('Паролата е сменена.');
    rerender();
  };

  const dropPassword = async () => {
    const sure = await confirmDialog({
      title: 'Да махна ли паролата?',
      body: ['Съдържанието спира да е шифровано и профилът се отваря направо.'],
      ok: 'Махни',
    });
    if (!sure) return;
    const payload = await payloadOfEntry(entry, 'на устройството');
    if (!payload) return;
    await saveEntry({ ...entry, lock: null, enc: null, data: payload, card: cardOfPayload(payload) });
    await openProfile(entry.id);
    toast('Паролата е махната.');
    rerender();
  };

  const autoLock = h('input', {
    type: 'number', min: '0', max: '240', step: '5', class: 'num-input',
    value: String(entry.autoLockMin), 'aria-label': 'Минути до автоматичен изход',
    onchange: async (e) => {
      const minutes = Math.max(0, Math.min(240, Number(e.target.value) || 0));
      await saveEntry({ ...entry, autoLockMin: minutes });
      toast(minutes ? `Автоматичен изход след ${minutes} минути.` : 'Автоматичният изход е изключен.');
    },
  });

  return h('section', { class: 'group' },
    h('h2', {}, 'Моят профил'),
    h('p', { class: 'muted small' }, `${entry.name} · ${ROLE_LABELS[entry.role]} · ${fullName(state.profile.step)}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn', type: 'button', onclick: rename }, 'Преименувай'),
      h('button', { class: 'btn', type: 'button', onclick: setPassword }, entry.lock ? 'Смени паролата' : 'Сложи парола'),
      entry.lock ? h('button', { class: 'btn', type: 'button', onclick: dropPassword }, 'Махни паролата') : null),
    entry.lock
      ? h('label', { class: 'field' }, h('span', { class: 'small muted' }, 'Автоматичен изход при бездействие (минути, 0 = изключен)'), autoLock)
      : h('p', { class: 'muted small' }, 'Профил без парола се отваря направо; автоматичният изход няма какво да пази.'));
}

// --- профилите: само за администратор ---

function profileRow(entry, rerender) {
  const isMe = state.entry && state.entry.id === entry.id;
  const summary = summarizeEntry(entry);

  const rename = async () => {
    const name = await promptDialog({ title: 'Ново име', value: entry.name, placeholder: 'Име' });
    if (name === null) return;
    await saveEntry({ ...entry, name: cleanName(name, entry.name) });
    rerender();
  };

  const remove = async () => {
    const sure = await confirmDialog({
      title: `Да изтрия ли „${entry.name}“?`,
      body: ['Целият прогрес на този профил изчезва от устройството.', 'Ако няма копие, няма откъде да се върне.'],
      ok: 'Изтрий',
    });
    if (!sure) return;
    await removeEntry(entry.id);
    toast('Профилът е изтрит.');
    rerender();
  };

  // ПИН на дете: администраторът го слага и го нулира, защото ключът на детето
  // е обвит и с неговия. Без администраторска парола няма с какво да се обвие.
  const setChildPin = async () => {
    if (!state.adminKey) {
      await confirmDialog({
        title: 'Първо сложи парола на администратора',
        body: [
          'Детският ключ се обвива с администраторския, за да може ПИН-ът да се нулира без загуба на прогрес.',
          'Затова този профил трябва да има своя парола и да е отключен с нея.',
        ],
        ok: 'Разбрах',
        cancel: null,
      });
      return;
    }
    if (entry.lock && !entry.lock.wrapAdmin) {
      await confirmDialog({
        title: 'ПИН-ът не може да се нулира',
        body: [
          'Този ПИН е сложен, докато администраторът е бил без парола, затова ключът не е обвит с неговия.',
          'Детето може да махне ПИН-а от своите Настройки и ти да сложиш нов оттук.',
        ],
        ok: 'Разбрах',
        cancel: null,
      });
      return;
    }
    const secret = await promptDialog({
      title: entry.lock ? `Нов ПИН за „${entry.name}“` : `ПИН за „${entry.name}“`,
      body: ['4–6 цифри. Прогресът остава непокътнат.'],
      placeholder: '4–6 цифри',
      password: true,
    });
    if (!secret) return;
    const problem = checkSecret(secret);
    if (problem) { toast(problem); return; }
    const dataKey = entry.lock ? await unwrapDataKey(entry.lock.wrapAdmin, state.adminKey) : null;
    await saveEntry(await lockProfile(entry, secret, { dataKey, adminKey: state.adminKey }));
    toast(entry.lock ? 'ПИН-ът е нулиран. Прогресът е непокътнат.' : 'ПИН-ът е сложен.');
    rerender();
  };

  const limit = h('input', {
    type: 'number', min: '0', max: '240', step: '5', class: 'num-input',
    value: String(entry.sessionLimitMin), 'aria-label': `Таван на сесията за ${entry.name}`,
    onchange: async (e) => {
      const minutes = Math.max(0, Math.min(240, Number(e.target.value) || 0));
      await saveEntry({ ...entry, sessionLimitMin: minutes });
      toast(minutes ? `Сесията свършва след ${minutes} минути.` : 'Без таван на сесията.');
    },
  });

  const hardGames = [['multitask', 'Многозадачност'], ['instruments', 'Ориентация по прибори']];
  const toggles = hardGames.map(([id, label]) => h('label', { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked: !entry.hiddenGames.includes(id),
      onchange: async (e) => {
        const hidden = e.target.checked
          ? entry.hiddenGames.filter((g) => g !== id)
          : [...new Set([...entry.hiddenGames, id])];
        await saveEntry({ ...entry, hiddenGames: hidden });
      },
    }),
    h('span', {}, label)));

  return h('div', { class: 'card profile-admin' },
    h('strong', {}, `${entry.name}${isMe ? ' (ти)' : ''}`),
    h('span', { class: 'small muted' }, `${ROLE_LABELS[entry.role]} · ${summary.step === null ? '–' : stepLabel(summary.step)}${entry.lock ? ' · заключен' : ''}`),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-small', type: 'button', onclick: rename }, 'Преименувай'),
      entry.role === 'child' ? h('button', { class: 'btn btn-small', type: 'button', onclick: setChildPin }, entry.lock ? 'Нулирай ПИН' : 'Сложи ПИН') : null,
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => exportProfiles([entry], 'profil') }, 'Копие'),
      isMe ? null : h('button', { class: 'btn btn-small', type: 'button', onclick: remove }, 'Изтрий')),
    entry.role === 'child'
      ? h('div', { class: 'child-limits' },
        h('label', { class: 'field' }, h('span', { class: 'small muted' }, 'Таван на сесията (минути, 0 = без)'), limit),
        h('p', { class: 'small muted' }, 'Тежките пилотски игри:'),
        toggles)
      : null);
}

export function renderSettings(root) {
  const rerender = () => renderSettings(root);
  let taps = 0;

  const fileInput = h('input', {
    type: 'file',
    accept: '.json,application/json',
    class: 'visually-hidden',
    'aria-label': 'Файл с резервно копие',
    onchange: (e) => {
      const [file] = e.target.files;
      if (file) importBackup(file, rerender);
      e.target.value = '';
    },
  });

  const testSlot = h('div', {});
  const showTestPanel = async () => {
    try {
      const { renderSimulator } = await import('../dev/simulator.js');
      renderSimulator(testSlot, rerender);
    } catch {
      toast('Тестовият режим не е наличен в тази версия.');
    }
  };

  const newProfile = async () => {
    const name = await promptDialog({ title: 'Име на новия профил', placeholder: 'Име' });
    if (!name) return;
    const role = await chooseDialog({
      title: `Какъв профил е „${name}“?`,
      body: ['Детският започва по-леко, с по-едър шрифт и без двете най-тежки игри.'],
      options: [['person', 'Обикновен'], ['child', 'Детски']],
    });
    if (!role) return;
    await addEntry(defaultProfileEntry({ name, role, order: state.profiles.length }));
    toast(role === 'child' ? 'Детският профил е създаден. ПИН-ът се слага оттук.' : 'Профилът е създаден. Паролата се слага от самия него.');
    rerender();
  };

  mount(root,
    h('h1', { class: 'page-title' }, 'Настройки'),
    h('section', { class: 'group' },
      h('h2', {}, 'Тема'),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Тема' }, THEMES.map(([id, label]) => h('button', {
        class: state.settings.theme === id ? 'active' : '',
        'aria-pressed': String(state.settings.theme === id),
        onclick: async () => {
          await saveSettings({ theme: id });
          applyTheme(id);
          rerender();
        },
      }, label)))),
    h('section', { class: 'group' },
      h('h2', {}, 'Цветове в игрите'),
      h('p', { class: 'muted small' }, 'Игрите с цветове имат и вариант с форми. Същото се избира и преди всяка такава игра.'),
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Цветове в игрите' }, COLOR_MODES.map(([value, label]) => h('button', {
        class: state.settings.colorFree === value ? 'active' : '',
        'aria-pressed': String(state.settings.colorFree === value),
        onclick: async () => {
          await saveSettings({ colorFree: value });
          rerender();
        },
      }, label)))),
    myProfileSection(rerender),
    isAdmin()
      ? h('section', { class: 'group' },
        h('h2', {}, 'Профили'),
        h('p', { class: 'muted small' }, 'Всеки профил е сам за себе си: нищо не се сравнява и не се смесва.'),
        state.profiles.map((p) => profileRow(p, rerender)),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: newProfile }, 'Нов профил')))
      : null,
    h('section', { class: 'group' },
      h('h2', {}, 'Резервно копие'),
      h('p', { class: 'muted small' }, 'Всичко се пази само на това устройство. За пренос между лаптопа и телефона изтегли копие тук и го зареди там. Заключен профил излиза шифрован и импортът му иска паролата.'),
      h('div', { class: 'row' },
        state.entry ? h('button', { class: 'btn', onclick: () => exportProfiles([state.entry], 'profil') }, 'Изтегли моето копие') : null,
        isAdmin() ? h('button', { class: 'btn', onclick: () => exportProfiles(state.profiles, 'vsichki') }, 'Копие на всички') : null,
        h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Зареди копие'),
        fileInput),
      // Тихо поле: само информация. Без напомняне, без известие и без оцветяване.
      h('p', { class: 'muted small' }, `Последен експорт: ${formatMoment(deviceSettings().lastExport) || 'още няма'}`)),
    canInstall()
      ? h('section', { class: 'group' },
        h('h2', {}, 'Инсталиране'),
        h('button', { class: 'btn', onclick: async () => { await promptInstall(); rerender(); } }, 'Инсталирай приложението'))
      : null,
    h('section', { class: 'group' },
      h('h2', {}, 'За приложението'),
      h('p', { class: 'muted small' }, `Текущо: ${fullName(state.profile.step)}. Без известия, без серии, без сървър.`),
      h('button', {
        class: 'version',
        onclick: () => {
          taps += 1;
          if (taps === TAPS_FOR_TEST_MODE) showTestPanel();
        },
      }, `Версия ${APP_VERSION}`)),
    testSlot,
  );

  // Ако тестовият режим вече е включен, панелът трябва да е видим, за да може да се излезе.
  if (state.simSnapshot) showTestPanel();
}
