import type { NoteColor } from './types';

export interface ColorTheme {
  label: string;
  /** Fundo do corpo da nota. */
  body: string;
  /** Fundo da barra de título. */
  header: string;
  /** Borda e ponto de cor nas listas. */
  accent: string;
}

export const COLOR_THEMES: Record<NoteColor, ColorTheme> = {
  yellow: { label: 'Amarelo', body: '#fff7b1', header: '#ffe86b', accent: '#e0b400' },
  pink: { label: 'Rosa', body: '#ffd9e8', header: '#ffb3cf', accent: '#e05a8f' },
  blue: { label: 'Azul', body: '#d6ecff', header: '#a9d4ff', accent: '#3b8fe0' },
  green: { label: 'Verde', body: '#d8f5d0', header: '#ade8a0', accent: '#48a83a' },
};
