import {
  MIN_NOTE_SIZE,
  NOTE_COLORS,
  NOTE_ICONS,
  type BackupFile,
  type Note,
  type NoteColor,
  type NoteIcon,
} from './types';

export function createBackup(notes: Note[], now = Date.now()): BackupFile {
  return { app: 'noteweb', version: 1, exportedAt: now, notes };
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function parseNote(raw: unknown): Note | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== 'string' || !n.id) return null;
  if (typeof n.pageKey !== 'string' || !n.pageKey) return null;
  if (typeof n.text !== 'string') return null;
  if (![n.x, n.y, n.width, n.height].every(isFiniteNumber)) return null;

  const now = Date.now();
  const createdAt = isFiniteNumber(n.createdAt) ? n.createdAt : now;
  return {
    id: n.id,
    pageKey: n.pageKey,
    x: Math.max(0, n.x as number),
    y: Math.max(0, n.y as number),
    width: Math.max(MIN_NOTE_SIZE.width, n.width as number),
    height: Math.max(MIN_NOTE_SIZE.height, n.height as number),
    color: NOTE_COLORS.includes(n.color as NoteColor) ? (n.color as NoteColor) : 'yellow',
    icon: NOTE_ICONS.includes(n.icon as NoteIcon) ? (n.icon as NoteIcon) : 'note',
    text: n.text,
    minimized: n.minimized === true,
    createdAt,
    updatedAt: isFiniteNumber(n.updatedAt) ? n.updatedAt : createdAt,
  };
}

/**
 * Valida o conteúdo de um arquivo de backup e devolve as notas válidas.
 * Lança um Error com mensagem amigável se o arquivo não for um backup do NoteWeb.
 */
export function validateBackup(data: unknown): { notes: Note[]; invalid: number } {
  if (typeof data !== 'object' || data === null) throw new Error('O arquivo não contém um JSON válido.');
  const file = data as Partial<BackupFile>;
  if (file.app !== 'noteweb') throw new Error('Este arquivo não é um backup do NoteWeb.');
  if (file.version !== 1) throw new Error(`Versão de backup não suportada: ${String(file.version)}.`);
  if (!Array.isArray(file.notes)) throw new Error('O backup não contém a lista de notas.');

  const notes: Note[] = [];
  let invalid = 0;
  for (const raw of file.notes) {
    const note = parseNote(raw);
    if (note) notes.push(note);
    else invalid++;
  }
  return { notes, invalid };
}

export interface MergeResult {
  /** Páginas alteradas, já com a lista final de notas de cada uma. */
  pages: Map<string, Note[]>;
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Junta notas importadas com as existentes. Para o mesmo id, fica a versão com
 * `updatedAt` mais recente.
 */
export function mergeNotes(existing: Note[], incoming: Note[]): MergeResult {
  const byPage = new Map<string, Note[]>();
  for (const note of existing) {
    const list = byPage.get(note.pageKey) ?? [];
    list.push(note);
    byPage.set(note.pageKey, list);
  }
  const existingById = new Map(existing.map((n) => [n.id, n]));

  const pages = new Map<string, Note[]>();
  const pageFor = (pageKey: string) => {
    let list = pages.get(pageKey);
    if (!list) {
      list = (byPage.get(pageKey) ?? []).slice();
      pages.set(pageKey, list);
    }
    return list;
  };

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const note of incoming) {
    const current = existingById.get(note.id);
    if (!current) {
      pageFor(note.pageKey).push(note);
      existingById.set(note.id, note);
      added++;
    } else if (note.updatedAt > current.updatedAt) {
      // A nota pode ter mudado de página; remove da antiga antes de inserir na nova.
      const oldList = pageFor(current.pageKey);
      oldList.splice(oldList.findIndex((n) => n.id === note.id), 1);
      pageFor(note.pageKey).push(note);
      existingById.set(note.id, note);
      updated++;
    } else {
      unchanged++;
    }
  }

  for (const [pageKey, list] of pages) {
    const original = byPage.get(pageKey) ?? [];
    if (list.length === original.length && list.every((n, i) => n === original[i])) pages.delete(pageKey);
  }
  return { pages, added, updated, unchanged };
}
