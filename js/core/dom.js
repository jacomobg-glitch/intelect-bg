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

export function toast(message) {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3200);
}

// Сменя съдържанието на елемент. За разлика от replaceChildren приема масиви и пропуска празни стойности.
export function mount(root, ...children) {
  root.replaceChildren(...h('div', {}, ...children).childNodes);
}
