// Текстовете, които се сменят в детския профил. Едно място, две версии:
// стандартна и детска. Принципите за детската версия:
//   - кратки изречения и думи, които 9-годишно дете ползва;
//   - хвали се усилието и начинът, не талантът;
//   - грешката е информация, не провал;
//   - без сарказъм, без натиск, без сравнения с други.
// Таблицата „стар текст → нов текст“ се генерира оттук в docs/kid-texts.md,
// а тест пази двете да не се разминат.

export const TEXTS = Object.freeze({
  'home.you': { standard: 'Ти си {name}.', kid: 'Сега си {name}.' },
  'home.next': { standard: 'Следва: {name}.', kid: 'Следва {name}.' },
  'home.obstacle.skill': {
    standard: 'За {step} ти трябват още {xp} {skill}',
    kid: 'Още {xp} {skill} и ставаш {step}.',
  },
  'home.obstacle.any': {
    standard: 'За {step} ти трябват още {xp}',
    kid: 'Още {xp} и ставаш {step}.',
  },
  'home.ready': { standard: 'Готово за {step}.', kid: 'Готов си за {step}!' },
  'home.levelNote': {
    standard: 'Нивото показва натрупана практика в задачите.',
    kid: 'Нивото показва колко си упражнявал, а не колко си умен.',
  },
  'home.continue': { standard: 'Продължи тренировката', kid: 'Продължи' },

  'play.interrupted': {
    standard: 'Опитът беше прекъснат и не се брои. Натрупаното си остава.',
    kid: 'Спряхме по средата, затова не се брои. Това, което вече имаш, си остава.',
  },
  'play.record': { standard: 'Личен рекорд: {score}', kid: 'Най-доброто ти досега: {score}' },
  'play.newRecord': { standard: 'Нов личен рекорд', kid: 'Нов твой рекорд! Опита пак и стана.' },
  'play.noXP': {
    standard: 'Този път без {xp}: нямаше вярна реакция.',
    kid: 'Този път без {xp}. Нищо страшно — пробвай пак.',
  },
  'play.again': { standard: 'Още веднъж', kid: 'Още веднъж' },

  'feel.ask': { standard: 'Как беше? Отговорът е по желание.', kid: 'Как беше? Кажи, ако искаш.' },
  'feel.saved': {
    standard: 'Записано. Следващият път ще започне съобразено с това.',
    kid: 'Записах. Следващия път ще нагодя колко е трудно.',
  },

  'math.try': { standard: 'Опитай сам', kid: 'Пробвай сам' },
  'math.examples': { standard: 'Решени примери', kid: 'Ето как се прави' },
  'math.correct': { standard: 'Вярно.', kid: 'Вярно! Така се прави.' },
  'math.wrong': {
    standard: 'Не е вярно. Виж подсказката.',
    kid: 'Почти! Виж къде е разликата.',
  },
  'math.hint1': { standard: 'Намек', kid: 'Подскажи ми' },
  'math.hint2': { standard: 'Метод', kid: 'Как се прави' },
  'math.hint3': { standard: 'Решение', kid: 'Покажи решението' },
  'math.noXP': {
    standard: 'Този път без {xp}: нямаше верен отговор.',
    kid: 'Този път без {xp}. Пробвай пак, става с упражнение.',
  },

  'gallery.title': { standard: 'Галерия на еволюцията', kid: 'Твоят път' },
  'profile.most': { standard: 'най-много практика', kid: 'тук си се упражнявал най-много' },
  'profile.grow': { standard: 'място за растеж', kid: 'тук има още какво да пробваш' },
});

// Попълва {име} със стойности. Липсваща стойност остава празна, а не „undefined“.
export function fill(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (params[key] === undefined ? '' : String(params[key])));
}

export function text(key, { kid = false, ...params } = {}) {
  const entry = TEXTS[key];
  if (!entry) return '';
  return fill(kid ? entry.kid : entry.standard, params);
}
