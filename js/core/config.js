// Всички настройваеми числа на прогреса са тук. Промяна на темпото = промяна само на този файл.
export const CONFIG = Object.freeze({
  PACE_HOURS: 150,        // чисти часове тренировка от Мравка I до Мъдрец III
  XP_PER_MINUTE: 10,      // XP за минута при добро представяне
  FIRST_STEP_XP: 150,     // цена на първата стъпка (около 15 минути)
  CURVE: 1.45,            // колко стръмно поскъпват стъпките
  BALANCE: 0.5,           // всяка способност трябва да има поне 50% от „справедливия си дял“ XP
  LEVEL_K: 6,             // ниво L на способност изисква LEVEL_K * L² XP
  CREATURES: 15,
  SUBSTEPS: 3,
  MAX_SESSION_XP: 300,    // предпазител срещу грешен модул
});

// Ключовете са договорът между модулите и ядрото.
export const SKILLS = Object.freeze(['memory', 'attention', 'speed', 'logic', 'math', 'flexibility']);

export const SKILL_LABELS = Object.freeze({
  memory: 'Памет',
  attention: 'Внимание',
  speed: 'Скорост',
  logic: 'Логика',
  math: 'Математика',
  flexibility: 'Гъвкавост',
});

export const CATEGORIES = Object.freeze([
  { id: 'math', label: 'Математика' },
  { id: 'cognitive', label: 'Когнитивни игри' },
  { id: 'reflex', label: 'Рефлекси' },
]);
