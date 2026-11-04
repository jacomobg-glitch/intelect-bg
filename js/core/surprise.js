// „Изненадай ме“: кратък план за една сесия. Чисти функции, без DOM и без база, за да се тестват в Node.
//
// Планът е една математическа тема и две игри. Изборът на игри е претеглен към способностите
// с най-малко практика, но едната игра е любимата (най-играната), за удоволствие.
import { SKILLS } from './config.js';

const FLOOR = 0.25; // и напълно тренирана способност запазва шанс: изненадата не е задължение

// Колко „място за растеж“ има всяка способност: 1 при най-малко практика, към 0 при най-много.
export function skillNeeds(skillXP) {
  const top = Math.max(1, ...SKILLS.map((s) => skillXP[s] || 0));
  return Object.fromEntries(SKILLS.map((s) => [s, 1 - (skillXP[s] || 0) / top]));
}

// Тежест на играта: водещата ѝ способност е тази с най-много място за растеж.
export const gameWeight = (game, needs) => FLOOR + Math.max(...game.skills.map((s) => (needs[s] === undefined ? 1 : needs[s])));

export function weightedPick(list, weights, random) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!list.length) return null;
  if (!(total > 0)) return list[Math.floor(random() * list.length)];
  let r = random() * total;
  for (let i = 0; i < list.length; i += 1) {
    r -= weights[i];
    if (r < 0) return list[i];
  }
  return list[list.length - 1];
}

// Любимата игра е най-играната. При равенство печели първата в списъка.
export function favouriteGame(games, plays) {
  const played = games.filter((g) => plays(g.id) > 0);
  if (!played.length) return null;
  return played.reduce((best, g) => (plays(g.id) > plays(best.id) ? g : best));
}

const pickWeighted = (pool, needs, random) => weightedPick(pool, pool.map((g) => gameWeight(g, needs)), random);

// Две различни игри: любимата (ако вече има изиграна) и една претеглена към слабата практика.
// avoid е играта от края на предишната изненада: тя не започва следващата.
export function pickGames(games, { needs, plays, random, avoid = null }) {
  if (games.length < 2) return games.slice();
  const favourite = favouriteGame(games, plays);
  let pair;
  if (favourite) {
    const rest = games.filter((g) => g.id !== favourite.id);
    pair = [favourite, pickWeighted(rest, needs, random)];
  } else {
    const first = pickWeighted(games, needs, random);
    const rest = games.filter((g) => g.id !== first.id);
    pair = [first, pickWeighted(rest, needs, random)];
  }
  const ordered = random() < 0.5 ? pair : [pair[1], pair[0]];
  if (avoid && ordered[0].id === avoid && ordered[1].id !== avoid) return [ordered[1], ordered[0]];
  return ordered;
}

// Тема за преговор, ако има такава; иначе неусвоена; иначе каквато и да е отворена.
export function pickTopic(topics, random) {
  const pools = [topics.filter((t) => t.due), topics.filter((t) => !t.mastered), topics];
  const pool = pools.find((p) => p.length) || [];
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

// Редът е игра → математика → игра: математиката е най-дългата част и стои в средата,
// а двете игри никога не са една и съща.
export function planSurprise({ games, topics = [], plays = () => 0, skillXP, random = Math.random, avoid = null }) {
  const needs = skillNeeds(skillXP);
  const picked = pickGames(games, { needs, plays, random, avoid });
  const topic = pickTopic(topics, random);
  const items = picked.map((g) => ({ kind: 'game', id: g.id, title: g.title, skills: g.skills }));
  const math = topic ? [{ kind: 'math', topicId: topic.id, title: topic.title, skills: ['math'] }] : [];
  if (items.length === 2) return [items[0], ...math, items[1]];
  return [...items, ...math];
}
