import { NoteLayer } from './NoteLayer';
import type { ContentMessage, ContentResponse } from '../shared/messages';
import { newId } from '../shared/id';
import { toPageKey } from '../shared/pageKey';
import { deleteNote, getNotes, onNotesChanged, patchNote, saveNote } from '../shared/storage';
import { DEFAULT_NOTE_SIZE, type Note } from '../shared/types';

const URL_CHECK_INTERVAL = 500;
const CONTEXT_POINT_MAX_AGE = 15_000;
const VIEWPORT_MARGIN = 8;

let pageKey = toPageKey(location.href);
let loadToken = 0;
let lastContextPoint: { x: number; y: number; time: number } | null = null;
/**
 * Última posição do mouse em coordenadas da janela (não do documento), para continuar
 * certa se a página rolar sem o mouse se mover. Fica null quando o mouse sai da página.
 */
let pointer: { x: number; y: number } | null = null;

/** A extensão foi recarregada ou removida e este script ficou órfão. */
const contextInvalidated = () => !chrome.runtime?.id;

function handleError(error: unknown): void {
  if (contextInvalidated()) teardown();
  else console.error('[NoteWeb]', error);
}

const layer = new NoteLayer({
  onChange(id, patch) {
    if (pageKey) patchNote(pageKey, id, patch).catch(handleError);
  },
  onDelete(id) {
    layer.remove(id);
    if (pageKey) deleteNote(pageKey, id).catch(handleError);
  },
});

async function loadPage(): Promise<void> {
  const token = ++loadToken;
  layer.setNotes([]);
  if (!pageKey) return;
  const notes = await getNotes(pageKey);
  if (token === loadToken) layer.setNotes(notes);
}

/** Desloca o ponto para que uma nota com esse tamanho fique inteira na área visível. */
function fitInViewport(at: { x: number; y: number }, width: number, height: number) {
  const { clientWidth, clientHeight } = document.documentElement;
  const maxX = window.scrollX + clientWidth - width - VIEWPORT_MARGIN;
  const maxY = window.scrollY + clientHeight - height - VIEWPORT_MARGIN;
  return {
    x: Math.max(window.scrollX, Math.min(at.x, maxX)),
    y: Math.max(window.scrollY, Math.min(at.y, maxY)),
  };
}

function createNote(options: { at?: { x: number; y: number }; text?: string }): Note | null {
  if (!pageKey) return null;
  const { width, height } = DEFAULT_NOTE_SIZE;
  const at = options.at
    ? fitInViewport(options.at, width, height)
    : {
        x: window.scrollX + (window.innerWidth - width) / 2,
        y: window.scrollY + Math.max(40, (window.innerHeight - height) / 3),
      };
  const now = Date.now();
  const note: Note = {
    id: newId(),
    pageKey,
    x: Math.round(Math.max(0, at.x)),
    y: Math.round(Math.max(0, at.y)),
    width,
    height,
    color: 'yellow',
    icon: 'note',
    text: options.text ?? '',
    minimized: false,
    createdAt: now,
    updatedAt: now,
  };
  layer.add(note).focusText();
  saveNote(note).catch(handleError);
  return note;
}

function onMessage(
  message: ContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ContentResponse) => void,
): boolean | void {
  switch (message.type) {
    case 'PING':
      sendResponse({ ok: true, pageKey: pageKey ?? undefined });
      break;
    case 'CREATE_NOTE': {
      let at = message.at;
      if (!at && message.useContextPoint && lastContextPoint) {
        if (Date.now() - lastContextPoint.time < CONTEXT_POINT_MAX_AGE) at = lastContextPoint;
      }
      if (!at && message.usePointer && pointer) {
        at = { x: pointer.x + window.scrollX, y: pointer.y + window.scrollY };
      }
      const note = createNote({ at, text: message.text });
      sendResponse({ ok: !!note, id: note?.id, pageKey: pageKey ?? undefined });
      break;
    }
    case 'FOCUS_NOTE': {
      const view = layer.get(message.id);
      if (view) {
        layer.bringToFront(view);
        view.reveal();
      }
      sendResponse({ ok: !!view });
      break;
    }
    case 'DELETE_NOTE':
      layer.remove(message.id);
      if (pageKey) {
        deleteNote(pageKey, message.id).then(
          () => sendResponse({ ok: true }),
          (error) => {
            handleError(error);
            sendResponse({ ok: false });
          },
        );
        return true; // resposta assíncrona
      }
      sendResponse({ ok: false });
      break;
  }
}

const stopWatchingStorage = onNotesChanged((changedKey, notes) => {
  if (changedKey === pageKey) layer.setNotes(notes);
});

function onContextMenu(e: MouseEvent): void {
  lastContextPoint = { x: e.pageX, y: e.pageY, time: Date.now() };
}

function onPointerMove(e: PointerEvent): void {
  pointer = { x: e.clientX, y: e.clientY };
}

function onPointerOut(e: PointerEvent): void {
  if (!e.relatedTarget) pointer = null; // saiu da janela
}

const pointerListenerOptions = { capture: true, passive: true };

/** Sites SPA trocam de URL sem recarregar; quando a chave da página muda, troca as notas. */
function checkUrl(): void {
  if (contextInvalidated()) {
    teardown();
    return;
  }
  layer.mount();
  const next = toPageKey(location.href);
  if (next === pageKey) return;
  layer.flushAll();
  pageKey = next;
  loadPage().catch(handleError);
}

const onPageHide = () => layer.flushAll();

const urlTimer = window.setInterval(checkUrl, URL_CHECK_INTERVAL);
const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
navigation?.addEventListener('navigatesuccess', checkUrl);
window.addEventListener('popstate', checkUrl);
window.addEventListener('pagehide', onPageHide);
document.addEventListener('contextmenu', onContextMenu, true);
document.addEventListener('pointermove', onPointerMove, pointerListenerOptions);
document.addEventListener('pointerout', onPointerOut, pointerListenerOptions);
chrome.runtime.onMessage.addListener(onMessage);

let tornDown = false;
function teardown(): void {
  if (tornDown) return;
  tornDown = true;
  window.clearInterval(urlTimer);
  navigation?.removeEventListener('navigatesuccess', checkUrl);
  window.removeEventListener('popstate', checkUrl);
  window.removeEventListener('pagehide', onPageHide);
  document.removeEventListener('contextmenu', onContextMenu, true);
  document.removeEventListener('pointermove', onPointerMove, pointerListenerOptions);
  document.removeEventListener('pointerout', onPointerOut, pointerListenerOptions);
  try {
    stopWatchingStorage();
    chrome.runtime.onMessage.removeListener(onMessage);
  } catch {
    // O contexto da extensão já não existe.
  }
  layer.destroy();
}

loadPage().catch(handleError);
