import '../ui/base.css';
import './options.css';
import { createBackup, mergeNotes, validateBackup } from '../shared/backup';
import { deleteNote, getAllNotes, onNotesChanged, writePages } from '../shared/storage';
import type { Note } from '../shared/types';
import { deleteButton, formatDate, noteBadge, notePreview } from '../ui/common';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const summary = $<HTMLParagraphElement>('summary');
const status = $<HTMLParagraphElement>('status');
const search = $<HTMLInputElement>('search');
const pagesEl = $<HTMLDivElement>('pages');
const empty = $<HTMLParagraphElement>('empty');
const fileInput = $<HTMLInputElement>('import-file');

let allNotes: Note[] = [];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function showStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle('error', isError);
  status.hidden = false;
}

function groupByPage(notes: Note[]): [string, Note[]][] {
  const pages = new Map<string, Note[]>();
  for (const note of notes) {
    const list = pages.get(note.pageKey) ?? [];
    list.push(note);
    pages.set(note.pageKey, list);
  }
  const latest = (list: Note[]) => Math.max(...list.map((n) => n.updatedAt));
  return [...pages.entries()]
    .map(([key, list]) => [key, list.sort((a, b) => a.y - b.y || a.x - b.x)] as [string, Note[]])
    .sort((a, b) => latest(b[1]) - latest(a[1]));
}

function renderPage(pageKey: string, notes: Note[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'page';

  const head = document.createElement('div');
  head.className = 'page-head';
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'page-link';
  link.textContent = pageKey;
  link.title = `Abrir ${pageKey}`;
  link.addEventListener('click', () => void chrome.tabs.create({ url: pageKey }));

  const pageCount = document.createElement('span');
  pageCount.className = 'page-count muted';
  pageCount.textContent = plural(notes.length, 'nota', 'notas');

  const removePage = document.createElement('button');
  removePage.type = 'button';
  removePage.className = 'btn page-delete';
  removePage.textContent = 'Excluir página';
  let confirmTimer: number | undefined;
  removePage.addEventListener('click', () => {
    if (!removePage.classList.contains('confirm')) {
      removePage.classList.add('confirm');
      removePage.textContent = 'Confirmar exclusão';
      confirmTimer = window.setTimeout(() => {
        removePage.classList.remove('confirm');
        removePage.textContent = 'Excluir página';
      }, 3000);
      return;
    }
    window.clearTimeout(confirmTimer);
    void writePages(new Map([[pageKey, []]]));
  });

  head.append(link, pageCount, removePage);

  const list = document.createElement('ul');
  list.className = 'page-notes';
  for (const note of notes) {
    const item = document.createElement('li');
    const body = document.createElement('div');
    body.className = 'note-body';
    const preview = document.createElement('p');
    preview.className = 'note-preview';
    preview.textContent = notePreview(note);
    const meta = document.createElement('p');
    meta.className = 'note-meta muted';
    meta.textContent = `Editada em ${formatDate(note.updatedAt)}`;
    body.append(preview, meta);
    item.append(
      noteBadge(note),
      body,
      deleteButton('Excluir nota', () => void deleteNote(note.pageKey, note.id)),
    );
    list.append(item);
  }

  section.append(head, list);
  return section;
}

function render(): void {
  const pageTotal = new Set(allNotes.map((n) => n.pageKey)).size;
  summary.textContent = `${plural(allNotes.length, 'nota', 'notas')} em ${plural(pageTotal, 'página', 'páginas')}`;

  const query = search.value.trim().toLowerCase();
  const visible = query
    ? allNotes.filter((n) => n.text.toLowerCase().includes(query) || n.pageKey.toLowerCase().includes(query))
    : allNotes;

  pagesEl.replaceChildren(...groupByPage(visible).map(([key, notes]) => renderPage(key, notes)));
  empty.hidden = visible.length > 0;
  empty.textContent = query
    ? 'Nenhuma nota encontrada para essa busca.'
    : 'Nenhuma nota salva ainda. Abra uma página e crie a primeira pelo ícone do NoteWeb.';
}

async function reload(): Promise<void> {
  allNotes = await getAllNotes();
  render();
}

async function exportBackup(): Promise<void> {
  const notes = await getAllNotes();
  const blob = new Blob([JSON.stringify(createBackup(notes), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `noteweb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showStatus(`Backup exportado com ${plural(notes.length, 'nota', 'notas')}.`);
}

async function importBackup(file: File): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo não contém um JSON válido.');
  }
  const { notes, invalid } = validateBackup(data);
  const result = mergeNotes(await getAllNotes(), notes);
  await writePages(result.pages);

  const parts = [
    `${plural(result.added, 'nota importada', 'notas importadas')}`,
    `${plural(result.updated, 'atualizada', 'atualizadas')}`,
  ];
  if (result.unchanged) parts.push(`${plural(result.unchanged, 'já estava em dia', 'já estavam em dia')}`);
  if (invalid) parts.push(`${plural(invalid, 'inválida ignorada', 'inválidas ignoradas')}`);
  showStatus(`Importação concluída: ${parts.join(', ')}.`);
}

$('export').addEventListener('click', () => {
  exportBackup().catch((e: unknown) => showStatus(`Falha ao exportar: ${(e as Error).message}`, true));
});
$('import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  importBackup(file).catch((e: unknown) => showStatus(`Falha ao importar: ${(e as Error).message}`, true));
});
search.addEventListener('input', render);
// Uma importação altera várias páginas de uma vez; agrupa as recargas.
let reloadTimer: number | undefined;
onNotesChanged(() => {
  window.clearTimeout(reloadTimer);
  reloadTimer = window.setTimeout(() => void reload(), 50);
});

void reload();
