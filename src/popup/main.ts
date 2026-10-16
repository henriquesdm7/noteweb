import '../ui/base.css';
import './popup.css';
import { sendToTab } from '../shared/messages';
import { isRestrictedUrl, toPageKey } from '../shared/pageKey';
import { getNotes, onNotesChanged } from '../shared/storage';
import type { Note } from '../shared/types';
import { deleteButton, formatDate, noteBadge, notePreview } from '../ui/common';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const pageLabel = $<HTMLParagraphElement>('page');
const list = $<HTMLUListElement>('notes');
const empty = $<HTMLParagraphElement>('empty');
const count = $<HTMLHeadingElement>('count');

type State = 'restricted' | 'reload' | 'ready';

function showState(state: State): void {
  for (const s of ['restricted', 'reload', 'ready'] as const) $(`state-${s}`).hidden = s !== state;
}

function renderNotes(tabId: number, notes: Note[]): void {
  const sorted = notes.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  count.textContent = notes.length === 1 ? '1 nota nesta página' : `${notes.length} notas nesta página`;
  empty.hidden = notes.length > 0;
  list.replaceChildren(
    ...sorted.map((note) => {
      const item = document.createElement('li');
      item.className = 'note-item';

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'note-open';
      open.title = 'Mostrar na página';
      const text = document.createElement('span');
      text.className = 'note-text';
      const preview = document.createElement('span');
      preview.className = 'note-preview';
      preview.textContent = notePreview(note).split('\n')[0];
      const date = document.createElement('span');
      date.className = 'note-date muted';
      date.textContent = formatDate(note.updatedAt);
      text.append(preview, date);
      open.append(noteBadge(note), text);
      open.addEventListener('click', async () => {
        await sendToTab(tabId, { type: 'FOCUS_NOTE', id: note.id }).catch(() => undefined);
        window.close();
      });

      const remove = deleteButton('Excluir nota', () => {
        void sendToTab(tabId, { type: 'DELETE_NOTE', id: note.id });
      });

      item.append(open, remove);
      return item;
    }),
  );
}

async function init(): Promise<void> {
  $('open-options').addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
    window.close();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || isRestrictedUrl(tab.url)) {
    showState('restricted');
    return;
  }
  const tabId = tab.id;

  let pageKey: string | undefined;
  try {
    pageKey = (await sendToTab(tabId, { type: 'PING' })).pageKey;
  } catch {
    showState('reload');
    $('reload').addEventListener('click', () => {
      void chrome.tabs.reload(tabId);
      window.close();
    });
    return;
  }
  pageKey ??= toPageKey(tab.url!) ?? undefined;
  if (!pageKey) {
    showState('restricted');
    return;
  }

  pageLabel.textContent = pageKey;
  pageLabel.title = pageKey;
  pageLabel.hidden = false;
  showState('ready');

  $('new-note').addEventListener('click', async () => {
    await sendToTab(tabId, { type: 'CREATE_NOTE' }).catch(() => undefined);
    window.close();
  });

  const key = pageKey;
  renderNotes(tabId, await getNotes(key));
  onNotesChanged((changedKey, notes) => {
    if (changedKey === key) renderNotes(tabId, notes);
  });
}

void init();
