// Светла и тъмна тема на интерфейса. Нямат общо с „кожите“ на стълбата.
const COLORS = { dark: '#0b1512', light: '#e6efe9' };
const media = window.matchMedia('(prefers-color-scheme: dark)');
let current = 'auto';

function paint() {
  const resolved = current === 'auto' ? (media.matches ? 'dark' : 'light') : current;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[resolved]);
}

export function applyTheme(theme) {
  current = theme;
  paint();
}

media.addEventListener('change', paint);
