// Галерия на еволюцията: извървяният път и заключени силуети напред.
import { confirmDialog, h, mount } from '../core/dom.js';
import { creatureIndex, subLabel } from '../core/evolution.js';
import { state } from '../core/store.js';
import { activeSkin, avatarEl } from './ui.js';

export function renderGallery(root) {
  const current = creatureIndex(state.profile.step);
  const skin = activeSkin();

  mount(root,
    h('h1', { class: 'page-title' }, 'Галерия на еволюцията'),
    h('p', { class: 'muted' }, `${current + 1} от ${skin.creatures.length} същества`),
    h('div', { class: 'gallery' }, skin.creatures.map((c, i) => {
      if (i > current) {
        return h('div', { class: 'tile tile-locked', 'aria-label': 'Заключено същество' },
          avatarEl(c, 'silhouette'), h('span', { class: 'small muted' }, '?'));
      }
      const isCurrent = i === current;
      return h('button', {
        class: `tile ${isCurrent ? 'tile-current' : ''}`,
        onclick: () => confirmDialog({
          title: c.name,
          body: [c.trait, c.can, c.you],
          ok: 'Затвори',
          cancel: null,
        }),
      }, avatarEl(c), h('span', { class: 'small' }, isCurrent ? `${c.name} ${subLabel(state.profile.step)}` : c.name));
    })),
  );
}
