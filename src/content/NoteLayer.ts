import styles from './styles.css?inline';
import { NoteView, type NoteViewCallbacks } from './NoteView';
import type { Note } from '../shared/types';

const HOST_TAG = 'noteweb-root';

/** Eventos que não devem chegar aos atalhos e handlers da página enquanto o usuário usa uma nota. */
const ISOLATED_EVENTS = [
  'keydown',
  'keyup',
  'keypress',
  'beforeinput',
  'input',
  'paste',
  'copy',
  'cut',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'click',
  'dblclick',
  'wheel',
  'touchstart',
  'touchmove',
] as const;

/**
 * Camada posicionada na origem do documento, com Shadow DOM, que contém todas as notas
 * da página atual. As notas usam coordenadas do documento, então rolam com o conteúdo.
 */
export class NoteLayer {
  private readonly host: HTMLElement;
  private readonly container: HTMLDivElement;
  private readonly views = new Map<string, NoteView>();
  private topZ = 1;

  constructor(private readonly callbacks: Omit<NoteViewCallbacks, 'onActivate'>) {
    // Remove uma camada antiga deixada por uma versão anterior da extensão.
    for (const stale of document.querySelectorAll(HOST_TAG)) stale.remove();

    this.host = document.createElement(HOST_TAG);
    const hostStyle: Record<string, string> = {
      all: 'initial',
      position: 'absolute',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      overflow: 'visible',
      'z-index': '2147483647',
      display: 'block',
      contain: 'style',
    };
    for (const [prop, value] of Object.entries(hostStyle)) this.host.style.setProperty(prop, value, 'important');

    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    this.container = document.createElement('div');
    shadow.append(style, this.container);

    for (const type of ISOLATED_EVENTS) {
      this.host.addEventListener(type, (e) => e.stopPropagation());
    }

    this.mount();
    window.addEventListener('resize', () => this.relayout());
  }

  /** Recoloca a camada no documento caso a página a tenha removido. */
  mount(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy();
    this.views.clear();
    this.host.remove();
  }

  get(id: string): NoteView | undefined {
    return this.views.get(id);
  }

  /** Sincroniza as notas exibidas com a lista recebida (por id). */
  setNotes(notes: Note[]): void {
    const incoming = new Set(notes.map((n) => n.id));
    for (const [id, view] of this.views) {
      if (!incoming.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }
    const pageWidth = this.pageWidth();
    for (const note of notes) {
      const view = this.views.get(note.id);
      if (view) {
        view.update(note);
      } else {
        this.add(note).layout(pageWidth);
      }
    }
  }

  add(note: Note): NoteView {
    const view = new NoteView(note, {
      ...this.callbacks,
      onActivate: (v) => this.bringToFront(v),
    });
    this.views.set(note.id, view);
    view.setZIndex(this.topZ++);
    this.container.append(view.root);
    view.layout(this.pageWidth());
    return view;
  }

  remove(id: string): void {
    this.views.get(id)?.destroy();
    this.views.delete(id);
  }

  bringToFront(view: NoteView): void {
    view.setZIndex(++this.topZ);
  }

  flushAll(): void {
    for (const view of this.views.values()) view.flush();
  }

  private relayout(): void {
    const pageWidth = this.pageWidth();
    for (const view of this.views.values()) view.layout(pageWidth);
  }

  /** Largura do conteúdo da página, sem contar as próprias notas. */
  private pageWidth(): number {
    return Math.max(document.documentElement.clientWidth, document.body?.scrollWidth ?? 0);
  }
}
