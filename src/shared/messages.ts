export type ContentMessage =
  | {
      type: 'CREATE_NOTE';
      at?: { x: number; y: number };
      /** Usa o ponto do último clique direito (menu de contexto). */
      useContextPoint?: boolean;
      /** Usa a posição atual do mouse (atalho de teclado). */
      usePointer?: boolean;
      text?: string;
    }
  | { type: 'FOCUS_NOTE'; id: string }
  | { type: 'DELETE_NOTE'; id: string }
  | { type: 'PING' };

export interface ContentResponse {
  ok: boolean;
  pageKey?: string;
  id?: string;
}

export function sendToTab(tabId: number, message: ContentMessage): Promise<ContentResponse> {
  return chrome.tabs.sendMessage<ContentMessage, ContentResponse>(tabId, message);
}
