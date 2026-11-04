// Светла и тъмна тема на интерфейса. Нямат общо с „кожите“ на стълбата.
const COLORS = { dark: '#11141a', light: '#f5f3ee' };
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
