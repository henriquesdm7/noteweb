import { sendToTab, type ContentMessage } from '../shared/messages';
import { isRestrictedUrl } from '../shared/pageKey';

const MENU_ID = 'noteweb-add-note';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Adicionar nota aqui',
      contexts: ['page', 'selection', 'link', 'image', 'video', 'audio', 'editable'],
      documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
    });
  });
});

async function createNoteIn(tab: chrome.tabs.Tab | undefined, message: ContentMessage): Promise<void> {
  if (tab?.id === undefined || isRestrictedUrl(tab.url)) return;
  try {
    await sendToTab(tab.id, message);
  } catch {
    // A aba foi aberta antes da instalação da extensão e ainda não tem o content script.
    console.warn('[NoteWeb] Recarregue a página para usar o NoteWeb.');
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  void createNoteIn(tab, {
    type: 'CREATE_NOTE',
    // O ponto do clique só é conhecido quando o clique foi no frame principal.
    useContextPoint: !info.frameId,
    text: info.selectionText?.trim() || undefined,
  });
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'create-note') return;
  const target = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  void createNoteIn(target, { type: 'CREATE_NOTE', usePointer: true });
});
