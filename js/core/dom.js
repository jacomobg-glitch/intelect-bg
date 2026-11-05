// Малък помощник за DOM. Текстът винаги минава като текстов възел, затова данни от импорт не могат да вмъкнат код.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'vars') for (const [name, val] of Object.entries(v)) el.style.setProperty(name, val);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

// SVG елементите имат собствено namespace: document.createElement не работи за тях.
export function svgEl(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  if (text !== undefined) el.textContent = String(text);
  return el;
}

// Чете цвят от styles/tokens.css. Платното не разбира var(), затова игрите на Canvas минават оттук
// и нито един цвят не живее в кода на игра.
export function cssVar(name, fallback = 'transparent') {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// Само за SVG константи от кода на приложението, никога за външни данни.
export function trustedSvg(markup, className) {
  const wrap = document.createElement('span');
  wrap.className = className || 'svg';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = markup;
  return wrap;
}

export function confirmDialog({ title, body, ok = 'Да', cancel = 'Отказ' }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', {}, title),
      [].concat(body).map((line) => h('p', {}, line)),
      h('div', { class: 'dialog-actions' },
        cancel ? h('button', { class: 'btn', onclick: () => dialog.close('no') }, cancel) : null,
        h('button', { class: 'btn btn-primary', onclick: () => dialog.close('yes') }, ok)));
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(dialog.returnValue === 'yes');
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

// Диалог с едно поле. Връща текста или null при отказ. Ползва се за имена, ПИН и пароли.
export function promptDialog({ title, body = [], value = '', placeholder = '', ok = 'Готово', password = false }) {
  return new Promise((resolve) => {
    const input = h('input', {
      type: password ? 'password' : 'text',
      class: password ? 'pin-input' : 'text-input',
      value,
      placeholder,
      maxlength: '64',
      autocomplete: password ? 'new-password' : 'off',
      'aria-label': title,
    });
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', {}, title),
      [].concat(body).map((line) => h('p', { class: 'muted small' }, line)),
      input,
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => dialog.close('') }, 'Отказ'),
        h('button', { class: 'btn btn-primary', onclick: () => dialog.close('ok') }, ok)));
    dialog.addEventListener('close', () => {
      const chosen = dialog.returnValue === 'ok' ? input.value : null;
      dialog.remove();
      resolve(chosen);
    });
    // Enter в полето значи „Готово“: иначе диалогът се затваря без стойност.
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dialog.close('ok'); } });
    document.body.append(dialog);
    dialog.showModal();
    setTimeout(() => input.focus(), 50);
  });
}

// Диалог с избор от няколко възможности. Връща стойността или null при отказ.
export function chooseDialog({ title, body = [], options }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' },
      h('h2', {}, title),
      [].concat(body).map((line) => h('p', { class: 'muted small' }, line)),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn', onclick: () => dialog.close('') }, 'Отказ'),
        options.map(([value, label]) => h('button', {
          class: 'btn btn-primary',
          onclick: () => dialog.close(String(value)),
        }, label))));
    dialog.addEventListener('close', () => {
      const chosen = dialog.returnValue;
      dialog.remove();
      resolve(chosen || null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

// Сменя съдържанието на елемент. За разлика от replaceChildren приема масиви и пропуска празни стойности.
export function mount(root, ...children) {
  root.replaceChildren(...h('div', {}, ...children).childNodes);
}
