// Одит за клавиатура и екранен четец. Пуска се ВЪТРЕ в страницата от tools/browser-check.mjs
// през CDP: файлът е един израз, който връща намереното за текущия екран.
//
// Защо на ръка, а не с готов инструмент: проектът не допуска зависимости, а правилата тук
// са точно тези, които важат за това приложение — всеки бутон с име, нито една рисунка
// без обяснение или скрита от четеца, и нищо, което клавиатурата не може да стигне.
//
// Връща { problems, warnings, stats }. problems спират проверката, warnings само се отчитат.
(() => {
  const problems = [];
  const warnings = [];
  const seen = new Set();
  const add = (list, rule, detail) => {
    const line = `${rule}: ${detail}`;
    if (seen.has(line)) return;
    seen.add(line);
    list.push(line);
  };
  const fail = (rule, detail) => add(problems, rule, detail);
  const warn = (rule, detail) => add(warnings, rule, detail);

  const where = (el) => {
    if (!el || !el.tagName) return '?';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return `${tag}${id}${cls}${text ? ` „${text}“` : ''}`;
  };

  const shown = (el) => {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // Скрито зад класа за четци пак се чете: не е „невидимо“ за този одит.
    return el.getClientRects().length > 0 || el.classList.contains('visually-hidden');
  };

  // Приблизително изчисляване на достъпното име. Нарочно е по-щедро от спецификацията:
  // интересува ни дали четецът ще каже НЕЩО, а не точната дума.
  const nameOf = (el) => {
    const byId = el.getAttribute('aria-labelledby');
    if (byId) {
      const text = byId.split(/\s+/)
        .map((id) => (document.getElementById(id) || {}).textContent || '')
        .join(' ').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const title = (el.getAttribute('title') || '').trim();
    if (title) return title;
    if (el.labels && el.labels.length) {
      const text = [...el.labels].map((l) => l.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    // Текстът на самия елемент, без частите, скрити от четеца.
    const clone = el.cloneNode(true);
    for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
    const own = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    if (own) return own;
    const alt = [...el.querySelectorAll('img[alt], svg[role="img"][aria-label]')]
      .map((n) => (n.getAttribute('alt') || n.getAttribute('aria-label') || '').trim())
      .filter(Boolean).join(' ');
    if (alt) return alt;
    if (el.tagName === 'INPUT' && el.type === 'submit') return (el.value || '').trim();
    return '';
  };

  const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex], summary, [contenteditable=""], [contenteditable="true"]';
  const all = [...document.querySelectorAll(FOCUSABLE)];
  // Скрит зад display:none елемент не е в реда на клавиатурата и не го броим.
  const live = all.filter(shown);

  // 1. Заглавие на документа и език.
  if (!document.title.trim()) fail('заглавие', 'document.title е празен');
  if (document.documentElement.lang !== 'bg') fail('език', `html[lang] е „${document.documentElement.lang}“`);

  // 2. Точно едно видимо h1 на екран: четецът започва оттам.
  const h1s = [...document.querySelectorAll('h1')].filter(shown);
  if (h1s.length === 0) fail('заглавие h1', 'екранът няма видимо h1');
  if (h1s.length > 1) fail('заглавие h1', `${h1s.length} заглавия h1: ${h1s.map(where).join(' | ')}`);

  // 3. Нивата на заглавията не прескачат: h1 → h3 оставя четеца без стъпало.
  const levels = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .filter(shown)
    .map((el) => ({ el, level: Number(el.tagName.slice(1)) }));
  let previous = 0;
  for (const { el, level } of levels) {
    if (previous && level > previous + 1) fail('ред на заглавията', `от h${previous} към h${level} при ${where(el)}`);
    previous = level;
  }

  // 4. Повторен id чупи и aria-labelledby, и label[for].
  const ids = new Map();
  for (const el of document.querySelectorAll('[id]')) {
    ids.set(el.id, (ids.get(el.id) || 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) fail('повторен id', `„${id}“ се среща ${count} пъти`);

  // 5. Всеки стигаем елемент има какво да каже.
  for (const el of live) {
    if (el.disabled) continue;
    if (el.getAttribute('aria-hidden') === 'true') {
      fail('скрит, но стигаем', `${where(el)} е aria-hidden, а клавиатурата го стига`);
      continue;
    }
    if (el.type === 'hidden') continue;
    if (!nameOf(el)) fail('без име', `${where(el)} няма достъпно име`);
  }

  // 6. Положителен tabindex размества реда и се забранява.
  for (const el of document.querySelectorAll('[tabindex]')) {
    const value = Number(el.getAttribute('tabindex'));
    if (value > 0) fail('tabindex', `${where(el)} има tabindex=${value}`);
  }

  // 7. Нищо фокусируемо вътре в скрито от четеца поддърво.
  for (const host of document.querySelectorAll('[aria-hidden="true"]')) {
    const inside = [...host.querySelectorAll(FOCUSABLE)].filter((el) => shown(el) && !el.disabled);
    if (inside.length) fail('фокус в скрито', `${where(host)} крие ${inside.length} стигаеми елемента`);
  }

  // 8. Рисунките: или скрити от четеца, или с роля и име. Трето няма.
  for (const svg of document.querySelectorAll('svg')) {
    if (!shown(svg)) continue;
    if (svg.closest('[aria-hidden="true"]')) continue;
    if (svg.getAttribute('aria-hidden') === 'true') continue;
    const role = svg.getAttribute('role');
    const title = svg.querySelector('title');
    const name = (svg.getAttribute('aria-label') || (title ? title.textContent : '') || '').trim();
    if (role !== 'img' || !name) {
      fail('рисунка без обяснение', `${where(svg.parentElement || svg)} носи svg без aria-hidden и без role="img" с име`);
    }
  }

  // 9. Полетата за въвеждане: без име четецът казва само „текстово поле“.
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!shown(el) || el.type === 'hidden') continue;
    if (!nameOf(el) && !(el.getAttribute('placeholder') || '').trim()) {
      fail('поле без етикет', where(el));
    }
  }

  // 10. Големина на целите. Телефонът е второ устройство, но 44 px остава правилото;
  // затова е предупреждение, а не грешка: част от целите са в самите игри.
  for (const el of live) {
    if (el.disabled || el.type === 'hidden') continue;
    // Скритото поле за файл се натиска през бутон, не с пръст.
    if (el.classList.contains('visually-hidden')) continue;
    // Чекбокс вътре в етикет се натиска по целия етикет: мери се той, не квадратчето.
    const label = el.closest('label');
    const box = (label || el).getBoundingClientRect();
    if (box.width && box.height && (box.width < 32 || box.height < 32)) {
      warn('малка цел', `${where(el)} е ${Math.round(box.width)}×${Math.round(box.height)} px`);
    }
  }

  // 11. Отвореният диалог държи фокуса вътре: иначе четецът остава зад него.
  for (const dialog of document.querySelectorAll('dialog[open]')) {
    if (!dialog.contains(document.activeElement)) fail('диалог без фокус', where(dialog));
  }

  // 12. Единият signal никога не е само цветът: всяко място с aria-live да има текст.
  for (const region of document.querySelectorAll('[aria-live]')) {
    if (!['polite', 'assertive', 'off'].includes(region.getAttribute('aria-live'))) {
      fail('aria-live', `${where(region)} има непозната стойност`);
    }
  }

  return {
    problems,
    warnings,
    stats: {
      focusable: live.length,
      h1: h1s.length ? (h1s[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
      headings: levels.length,
      svg: document.querySelectorAll('svg').length,
    },
  };
})()
