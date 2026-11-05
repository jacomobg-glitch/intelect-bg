// Фоновете за сцената: купеният и включен фон сменя фона на hero картата и на
// „Моят свят“. Само градиенти и SVG — никакви растерни картинки.
//
// Цветовете стоят тук като данни (а не само в CSS), за да може тест да смята
// контраста им спрямо текста в двете теми. Купено, но нечетимо, не е украса.

export const BACKGROUNDS = Object.freeze([
  {
    id: 'bg-night',
    name: 'Звездна нощ',
    price: 60,
    // Тъмната тема е по-плътна, светлата — по-мека, за да остане текстът четим.
    dark: { from: '#0d1b2a', to: '#1b3a4b' },
    light: { from: '#c9d8e8', to: '#e5edf5' },
    sparkle: 'stars',
  },
  {
    id: 'bg-dawn',
    name: 'Изгрев',
    price: 60,
    dark: { from: '#2b1b2f', to: '#4a2c3a' },
    light: { from: '#f6ddd0', to: '#fdf0e6' },
    sparkle: 'sun',
  },
  {
    id: 'bg-rain',
    name: 'Тих дъжд',
    price: 80,
    dark: { from: '#101f26', to: '#24414a' },
    light: { from: '#cfe0e4', to: '#eaf2f4' },
    sparkle: 'rain',
  },
]);

export const backgroundOf = (id) => BACKGROUNDS.find((b) => b.id === id) || null;

// Декорът на фона: няколко фигури, които се рисуват върху градиента.
// Нарочно са слаби и бавни: фон, който дърпа вниманието, пречи на четенето.
const SPARKLES = {
  stars: '<g class="scene-sparkle">'
    + '<circle cx="18" cy="22" r="2"/><circle cx="52" cy="14" r="1.5"/><circle cx="86" cy="30" r="2.2"/>'
    + '<circle cx="124" cy="18" r="1.4"/><circle cx="158" cy="26" r="1.8"/><circle cx="196" cy="16" r="2"/>'
    + '<circle cx="232" cy="28" r="1.5"/><circle cx="268" cy="20" r="2.1"/><circle cx="300" cy="34" r="1.6"/></g>',
  sun: '<g class="scene-sparkle"><circle cx="268" cy="38" r="20"/>'
    + '<circle cx="268" cy="38" r="30" opacity=".4"/><circle cx="268" cy="38" r="42" opacity=".2"/></g>',
  rain: '<g class="scene-sparkle">'
    + '<path d="M30 10l-6 16M70 4l-6 16M110 12l-6 16M150 2l-6 16M190 14l-6 16M230 6l-6 16M270 16l-6 16"/></g>',
};

export const sparkleMarkup = (id) => {
  const background = backgroundOf(id);
  return background && SPARKLES[background.sparkle] ? SPARKLES[background.sparkle] : '';
};

// Променливите, които CSS ползва. Двата варианта се подават заедно, а темата избира.
export function backgroundVars(id) {
  const background = backgroundOf(id);
  if (!background) return null;
  return {
    '--scene-dark-from': background.dark.from,
    '--scene-dark-to': background.dark.to,
    '--scene-light-from': background.light.from,
    '--scene-light-to': background.light.to,
  };
}
