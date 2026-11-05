// Световете са данни: по един JSON на свят, с 15 етапа и (по избор) герой и спътници.
// Нов свят = нов файл и един ред тук. Механиката не знае нищо за тях.
import builder from './builder.json' with { type: 'json' };
import city from './city.json' with { type: 'json' };
import garden from './garden.json' with { type: 'json' };
import nature from './nature.json' with { type: 'json' };
import space from './space.json' with { type: 'json' };

export const DEFAULT_WORLD = 'nature';

export const WORLDS = Object.freeze({ nature, builder, city, garden, space });
export const WORLD_LIST = Object.freeze([nature, builder, city, garden, space]);
export const WORLD_IDS = Object.freeze(WORLD_LIST.map((w) => w.id));

// Непознат или изтрит свят не бива да чупи екрана: връща се този по подразбиране.
export const worldOf = (id) => WORLDS[id] || WORLDS[DEFAULT_WORLD];

// Безопасен заместител за липсваща картинка. По-добре въпросителна, отколкото празно място.
export const FALLBACK_AVATAR = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
  + '<circle class="av-a" cx="50" cy="50" r="34"/>'
  + '<text class="av-d" x="50" y="64" text-anchor="middle" font-size="42" font-weight="700">?</text></svg>';

// Същество по стъпка: празно или повредено място дава заместител, а не грешка.
// Работи с подадения свят такъв, какъвто е: така и непълни данни не чупят екрана.
export function creatureAt(world, index) {
  const source = world && Array.isArray(world.creatures) ? world : worldOf(world && world.id);
  const creature = source.creatures[index];
  if (!creature) return { key: 'unknown', name: '—', trait: '', colors: ['#9db3a6', '#cfd6e0'], can: '', you: '', avatar: FALLBACK_AVATAR };
  return { ...creature, avatar: creature.avatar || FALLBACK_AVATAR };
}

// Как се казва XP в този свят. „Градина“ брои вода на капки.
export const xpWord = (world) => (world.xp && world.xp.word) || 'XP';
export const xpLong = (world) => (world.xp && world.xp.long) || 'опит';
export const isDrops = (world) => Boolean(world.xp && world.xp.drop);

// Как светът казва „отключи“. „Градски мисии“ го казва като мисия.
export const unlockWord = (world) => world.unlockWord || 'Отключи';
