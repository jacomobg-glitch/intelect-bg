// Отпечатва таблицата с праговете в Markdown за docs/ARCHITECTURE.md.
import { CONFIG } from '../js/core/config.js';
import { CUMULATIVE_XP, STEP_COSTS, TOTAL_STEPS, creatureIndex, requiredLevel, subLabel } from '../js/core/evolution.js';
import nature from '../js/content/worlds/nature.json' with { type: 'json' };

console.log('| # | Стъпка | Цена, XP | Време за стъпката | Общо XP | Общо време | Мин. ниво във всяка способност |');
console.log('|---|---|---:|---:|---:|---:|---:|');
const time = (xp) => {
  const min = xp / CONFIG.XP_PER_MINUTE;
  return min < 60 ? `${Math.round(min)} мин` : `${(min / 60).toFixed(1)} ч`;
};
for (let s = 0; s < TOTAL_STEPS; s += 1) {
  const cost = s === 0 ? 0 : STEP_COSTS[s - 1];
  console.log(`| ${s + 1} | ${nature.creatures[creatureIndex(s)].name} ${subLabel(s)} | ${cost} | ${s === 0 ? '–' : time(cost)} | ${CUMULATIVE_XP[s]} | ${s === 0 ? '–' : time(CUMULATIVE_XP[s])} | ${requiredLevel(s)} |`);
}
