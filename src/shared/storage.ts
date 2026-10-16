import type { Note } from './types';

const PREFIX = 'notes:';

export const storageKey = (pageKey: string) => `${PREFIX}${pageKey}`;

const area = () => chrome.storage.local;

// Todas as escritas passam por esta fila: cada uma lê o estado mais recente antes
// de gravar, então duas alterações próximas não se sobrescrevem.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readPage(pageKey: string): Promise<Note[]> {
  const key = storageKey(pageKey);
  const data = await area().get(key);
  const notes = data[key];
  return Array.isArray(notes) ? (notes as Note[]) : [];
}

async function writePage(pageKey: string, notes: Note[]): Promise<void> {
  const key = storageKey(pageKey);
  if (notes.length === 0) await area().remove(key);
  else await area().set({ [key]: notes });
}

function updatePage(pageKey: string, update: (notes: Note[]) => Note[]): Promise<Note[]> {
  return enqueue(async () => {
    const next = update(await readPage(pageKey));
    await writePage(pageKey, next);
    return next;
  });
}

export function getNotes(pageKey: string): Promise<Note[]> {
  return readPage(pageKey);
}

export async function getAllNotes(): Promise<Note[]> {
  const data = await area().get(null);
  return Object.entries(data)
    .filter(([key, value]) => key.startsWith(PREFIX) && Array.isArray(value))
    .flatMap(([, value]) => value as Note[]);
}

export function saveNote(note: Note): Promise<Note[]> {
  return updatePage(note.pageKey, (notes) => {
    const index = notes.findIndex((n) => n.id === note.id);
    if (index === -1) return [...notes, note];
    const next = notes.slice();
    next[index] = note;
    return next;
  });
}

/** Aplica só os campos informados, preservando alterações feitas por outras gravações. */
export function patchNote(
  pageKey: string,
  id: string,
  patch: Partial<Omit<Note, 'id' | 'pageKey' | 'createdAt'>>,
): Promise<Note[]> {
  return updatePage(pageKey, (notes) =>
    notes.map((n) =>
      n.id === id ? { ...n, ...patch, updatedAt: Math.max(n.updatedAt, patch.updatedAt ?? Date.now()) } : n,
    ),
  );
}

export function deleteNote(pageKey: string, id: string): Promise<Note[]> {
  return updatePage(pageKey, (notes) => notes.filter((n) => n.id !== id));
}

/** Substitui as notas das páginas informadas (usado pela importação). */
export function writePages(pages: Map<string, Note[]>): Promise<void> {
  return enqueue(async () => {
    for (const [pageKey, notes] of pages) await writePage(pageKey, notes);
  });
}

/** Chamado sempre que as notas de alguma página mudam, em qualquer aba. */
export function onNotesChanged(callback: (pageKey: string, notes: Note[]) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      if (!key.startsWith(PREFIX)) continue;
      const notes = Array.isArray(change.newValue) ? (change.newValue as Note[]) : [];
      callback(key.slice(PREFIX.length), notes);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
