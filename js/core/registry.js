// Регистър на модулите. Ядрото познава само общия интерфейс, а не конкретните игри.
import { PLANNED_MODULES } from '../content/planned.js';
import { CATEGORIES, SKILLS } from './config.js';

const games = new Map();

const REQUIRED_FUNCTIONS = ['init', 'start', 'stop', 'score', 'xpReward'];

export function validateGame(game) {
  if (!game || typeof game !== 'object') return ['модулът не е обект'];
  const problems = [];
  if (typeof game.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(game.id)) problems.push('невалидно id');
  if (typeof game.title !== 'string' || !game.title) problems.push('липсва title');
  if (!CATEGORIES.some((c) => c.id === game.category)) problems.push('непозната category');
  if (!Number.isInteger(game.unlockStep) || game.unlockStep < 0) problems.push('невалидно unlockStep');
  if (typeof game.difficulty !== 'number') problems.push('липсва difficulty');
  if (!Array.isArray(game.skills) || !game.skills.length || !game.skills.every((s) => SKILLS.includes(s))) {
    problems.push('невалидни skills');
  }
  for (const fn of REQUIRED_FUNCTIONS) {
    if (typeof game[fn] !== 'function') problems.push(`липсва ${fn}()`);
  }
  return problems;
}

export function registerGames(list) {
  for (const game of list) {
    const problems = validateGame(game);
    if (problems.length) {
      // Счупен модул не бива да сваля приложението.
      console.error(`Модулът е пропуснат (${game && game.id}):`, problems.join(', '));
      continue;
    }
    games.set(game.id, game);
  }
}

export const getGame = (id) => games.get(id);
export const allGames = () => [...games.values()];
export const isUnlocked = (game, step) => step >= game.unlockStep;
export const unlockedBetween = (from, to) => allGames().filter((g) => g.unlockStep > from && g.unlockStep <= to);

// Активни са способностите с поне един отключен модул.
export function activeSkills(step) {
  const covered = new Set(allGames().filter((g) => isUnlocked(g, step)).flatMap((g) => g.skills));
  return SKILLS.filter((s) => covered.has(s));
}

// Името за текста „Отключва се с модул …“: първият регистриран модул или планираният.
export function moduleForSkill(skill) {
  const next = allGames().filter((g) => g.skills.includes(skill)).sort((x, y) => x.unlockStep - y.unlockStep)[0];
  return next ? next.title : PLANNED_MODULES[skill];
}
