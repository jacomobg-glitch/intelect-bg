// Всички настройваеми числа на прогреса са тук. Промяна на темпото = промяна само на този файл.
export const CONFIG = Object.freeze({
  PACE_HOURS: 150,        // чисти часове тренировка от Мравка I до Мъдрец III
  XP_PER_MINUTE: 10,      // XP за минута при добро представяне
  FIRST_STEP_XP: 150,     // цена на първата стъпка (около 15 минути)
  CURVE: 1.45,            // колко стръмно поскъпват стъпките
  LEVEL_K: 6,             // ниво L на способност изисква LEVEL_K * L² XP
  CREATURES: 15,
  SUBSTEPS: 3,
  MAX_SESSION_XP: 300,    // предпазител срещу грешен модул

  // Дял от „справедливия дял“ XP, който всяка активна способност трябва да има за следващата стъпка.
  // Единственото място, където живее числото 50%.
  SKILL_SHARE_THRESHOLD: 0.5,
  // В тези граници се калибрира прагът след реални данни: `npm run calibrate` показва
  // какво става при друга стойност, преди тя да се запише тук.
  SKILL_SHARE_RANGE: Object.freeze([0.3, 0.7]),

  // Staircase: колко поредни верни отговора вдигат трудността (грешката я сваля с 1).
  // Целевият успех е 0.5^(1/STAIRCASE_UP): при 3 това са около 79%.
  STAIRCASE_UP: 3,

  // „Лесно / Точно / Трудно“ след игра мести началната трудност на следващата сесия най-много с толкова.
  FEEL_SHIFT: 1,
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
