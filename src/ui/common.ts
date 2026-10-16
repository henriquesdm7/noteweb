import { COLOR_THEMES } from '../shared/colors';
import { ICON_LABELS, iconSvg } from '../shared/icons';
import type { Note } from '../shared/types';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatDate = (time: number) => dateFormat.format(time);

export function notePreview(note: Note): string {
  return note.text.trim() || 'Nota vazia';
}

/** Mini bolinha com a cor e o ícone da nota, igual à nota minimizada na página. */
export function noteBadge(note: Note): HTMLSpanElement {
  const theme = COLOR_THEMES[note.color] ?? COLOR_THEMES.yellow;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.style.background = theme.header;
  badge.title = `${theme.label} · ${ICON_LABELS[note.icon] ?? ICON_LABELS.note}`;
  badge.innerHTML = iconSvg(note.icon);
  return badge;
}

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>';

/** Botão de excluir que pede confirmação no segundo clique. */
export function deleteButton(label: string, onConfirm: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = TRASH_ICON;
  let timer: number | undefined;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (btn.classList.contains('confirm')) {
      window.clearTimeout(timer);
      onConfirm();
      return;
    }
    btn.classList.add('confirm');
    btn.textContent = 'Excluir?';
    timer = window.setTimeout(() => {
      btn.classList.remove('confirm');
      btn.innerHTML = TRASH_ICON;
    }, 3000);
  });
  return btn;
}
