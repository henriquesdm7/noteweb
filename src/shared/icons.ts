import type { NoteIcon } from './types';

// Desenhos do Tabler Icons (https://tabler.io/icons), licença MIT; ver THIRD_PARTY_NOTICES.md.
const PATHS: Record<NoteIcon, string> = {
  note: '<path d="M13 20l7 -7"/><path d="M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7"/>',
  message:
    '<path d="M8 9h8"/><path d="M8 13h6"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"/>',
  pin: '<path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/>',
  pencil: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
  lines: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h14"/>',
  bulb: '<path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/>',
};

export const ICON_LABELS: Record<NoteIcon, string> = {
  note: 'Post-it',
  message: 'Balão de fala',
  pin: 'Alfinete',
  pencil: 'Lápis',
  lines: 'Linhas de texto',
  bulb: 'Lâmpada',
};

/** SVG do ícone; ícones desconhecidos caem no Post-it. */
export function iconSvg(icon: NoteIcon | undefined): string {
  const paths = PATHS[icon as NoteIcon] ?? PATHS.note;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
