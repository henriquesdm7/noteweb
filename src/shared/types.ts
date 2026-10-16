export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_ICONS = ['note', 'message', 'pin', 'pencil', 'lines', 'bulb'] as const;
export type NoteIcon = (typeof NOTE_ICONS)[number];

export interface Note {
  id: string;
  pageKey: string;
  /** Posição em px relativa ao documento (não à janela). */
  x: number;
  y: number;
  width: number;
  height: number;
  color: NoteColor;
  /** Ícone mostrado na bolinha quando a nota está minimizada. */
  icon: NoteIcon;
  text: string;
  minimized: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BackupFile {
  app: 'noteweb';
  version: 1;
  exportedAt: number;
  notes: Note[];
}

export const DEFAULT_NOTE_SIZE = { width: 240, height: 180 } as const;
export const MIN_NOTE_SIZE = { width: 160, height: 90 } as const;
/** Diâmetro da bolinha da nota minimizada. */
export const BUBBLE_SIZE = 34;
