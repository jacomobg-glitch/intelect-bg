// Настройки: тема, резервно копие, инсталиране. Тестовият режим се зарежда само при нужда.
import { applyBackup, BackupError, buildBackup, normalizeData, parseBackup, readAllData, summarize } from '../core/backup.js';
import { confirmDialog, h, mount, toast } from '../core/dom.js';
import { creatureIndex, subLabel } from '../core/evolution.js';
import { mergeData } from '../core/merge.js';
import { activeSkills } from '../core/registry.js';
import { loadState, saveSettings, state } from '../core/store.js';
import { applyTheme } from '../core/theme.js';
import { activeSkin, formatXP, fullName } from './ui.js';
import { canInstall, promptInstall } from '../install.js';

const THEMES = [['auto', 'Като системата'], ['dark', 'Тъмна'], ['light', 'Светла']];
const APP_VERSION = '0.5.0';
const TAPS_FOR_TEST_MODE = 7;

async function exportBackup() {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `evolyutsiya-backup-${backup.exportedAt.slice(0, 10)}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('Копието е изтеглено.');
}

const stepLabel = (step) => `${activeSkin().creatures[creatureIndex(step)].name} ${subLabel(step)}`;

const SUMMARY_ROWS = [
  ['Стъпка', (s) => stepLabel(s.step)],
  ['XP', (s) => formatXP(s.totalXP)],
  ['Игри с рекорд', (s) => String(s.records)],
  ['Усвоени теми', (s) => String(s.mastered)],
];

// Показва избор „Слей“ или „Замени изцяло“ и сравнение устройство / файл / резултат.
function askImportMode(local, incoming) {
  return new Promise((resolve) => {
    const results = { merge: mergeData(local, incoming, activeSkills), replace: incoming };
    const cells = SUMMARY_ROWS.map(() => h('td', {}));
    const paint = (mode) => {
      const summary = summarize(results[mode]);
      SUMMARY_ROWS.forEach(([, read], i) => { cells[i].textContent = read(summary); });
    };
    const choice = (value, label, note, checked) => h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'import-mode', value, checked, onchange: () => paint(value) }),
      h('span', {}, h('strong', {}, label), h('span', { class: 'muted small' }, note)));
    const localSummary = summarize(local);
    const fileSummary = summarize(incoming);
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', {}, 'Как да заредя копието?'),
      choice('merge', 'Слей', 'Запазва по-доброто от двете места. Нищо постигнато не се губи.', true),
      choice('replace', 'Замени изцяло', 'Данните на това устройство се заменят с тези от файла.', false),
      h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Устройство'), h('th', {}, 'Файл'), h('th', {}, 'Резултат'))),
        h('tbody', {}, SUMMARY_ROWS.map(([label, read], i) => h('tr', {},
          h('th', { scope: 'row' }, label), h('td', {}, read(localSummary)), h('td', {}, read(fileSummary)), cells[i])))),
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

// На чисто устройство профилът още не е записан в базата, затова се допълва от паметта.
async function localData() {
  const data = await readAllData();
  if (!data.meta.some((m) => m.key === 'profile')) data.meta.push(state.profile);
  return normalizeData(data);
}

async function importBackup(file, rerender) {
  try {
    const parsed = parseBackup(await file.text());
    const result = await askImportMode(await localData(), parsed);
    if (!result) return;
    await applyBackup(result);
    await loadState();
    applyTheme(state.settings.theme);
    toast('Данните са възстановени.');
    rerender();
  } catch (err) {
    const message = err instanceof BackupError ? err.message : 'Файлът не можа да бъде прочетен.';
    await confirmDialog({ title: 'Импортът не мина', body: [message, 'Данните ти не са променени.'], ok: 'Добре', cancel: null });
  }
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
      h('h2', {}, 'Резервно копие'),
      h('p', { class: 'muted small' }, 'Всичко се пази само на това устройство. За пренос между лаптопа и телефона изтегли копие тук и го зареди там.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: exportBackup }, 'Изтегли копие'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, 'Зареди копие'),
        fileInput)),
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
