import { COLOR_THEMES } from '../shared/colors';
import { ICON_LABELS, iconSvg } from '../shared/icons';
import { BUBBLE_SIZE, NOTE_COLORS, NOTE_ICONS, type Note } from '../shared/types';

export type NotePatch = Partial<
  Pick<Note, 'x' | 'y' | 'width' | 'height' | 'color' | 'icon' | 'text' | 'minimized'>
>;

export interface NoteViewCallbacks {
  /** `patch.updatedAt` é o momento da alteração local; é o valor que vai para o storage. */
  onChange(id: string, patch: NotePatch & { updatedAt: number }): void;
  onDelete(id: string): void;
  onActivate(view: NoteView): void;
}

const TEXT_SAVE_DELAY = 400;
const RESIZE_SAVE_DELAY = 300;
const DELETE_CONFIRM_TIMEOUT = 3000;
const DRAG_THRESHOLD = 3;
/** Espaço reservado para a dica ao lado da bolinha antes de ela trocar de lado. */
const TIP_SPACE = 280;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function firstLine(text: string): string {
  const line = text.split('\n').find((l) => l.trim());
  return line?.trim() || 'Nota vazia';
}

export class NoteView {
  readonly root: HTMLDivElement;
  private note: Note;
  private readonly header: HTMLDivElement;
  private readonly styleBtn: HTMLButtonElement;
  private readonly deleteBtn: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly bubble: HTMLButtonElement;
  private readonly tip: HTMLSpanElement;
  private readonly resizeObserver: ResizeObserver;

  private pageWidth = Infinity;
  private dragging = false;
  /** O último gesto na bolinha foi um arrasto; o clique que vem depois não deve expandir. */
  private suppressClick = false;
  private textTimer: number | undefined;
  private resizeTimer: number | undefined;
  private confirmTimer: number | undefined;

  constructor(
    note: Note,
    private readonly callbacks: NoteViewCallbacks,
  ) {
    this.note = note;

    this.root = el('div', 'note', { role: 'group', 'aria-label': 'Nota do NoteWeb' });

    this.header = el('div', 'header');
    const grip = el('span', 'grip');
    this.styleBtn = el('button', 'btn style-btn', {
      type: 'button',
      title: 'Cor e ícone',
      'aria-label': 'Escolher cor e ícone',
      'aria-expanded': 'false',
    });
    const minimizeBtn = el('button', 'btn', { type: 'button', title: 'Minimizar', 'aria-label': 'Minimizar' });
    minimizeBtn.textContent = '–';
    this.deleteBtn = el('button', 'btn delete', { type: 'button', title: 'Excluir', 'aria-label': 'Excluir nota' });
    this.deleteBtn.textContent = '×';
    this.header.append(grip, this.styleBtn, minimizeBtn, this.deleteBtn);

    this.panel = el('div', 'panel');
    this.panel.hidden = true;
    const colors = el('div', 'choices', { role: 'group', 'aria-label': 'Cor' });
    for (const color of NOTE_COLORS) {
      const swatch = el('button', 'choice swatch', { type: 'button', title: COLOR_THEMES[color].label });
      swatch.dataset.color = color;
      swatch.style.background = COLOR_THEMES[color].header;
      swatch.addEventListener('click', () => {
        if (color !== this.note.color) this.commit({ color });
      });
      colors.append(swatch);
    }
    const icons = el('div', 'choices', { role: 'group', 'aria-label': 'Ícone quando minimizada' });
    for (const icon of NOTE_ICONS) {
      const option = el('button', 'choice icon', { type: 'button', title: ICON_LABELS[icon] });
      option.dataset.icon = icon;
      option.innerHTML = iconSvg(icon);
      option.addEventListener('click', () => {
        if (icon !== this.note.icon) this.commit({ icon });
      });
      icons.append(option);
    }
    const colorsLabel = el('span', 'panel-label');
    colorsLabel.textContent = 'Cor';
    const iconsLabel = el('span', 'panel-label');
    iconsLabel.textContent = 'Ícone quando minimizada';
    this.panel.append(colorsLabel, colors, iconsLabel, icons);

    this.textarea = el('textarea', 'text', { placeholder: 'Escreva sua nota…', spellcheck: 'true' });

    this.bubble = el('button', 'bubble', { type: 'button' });
    this.tip = el('span', 'tip', { 'aria-hidden': 'true' });

    this.root.append(this.header, this.panel, this.textarea, this.bubble, this.tip);

    this.root.addEventListener('pointerdown', () => this.callbacks.onActivate(this), true);
    this.header.addEventListener('pointerdown', (e) => this.startDrag(e, this.header));
    this.header.addEventListener('dblclick', (e) => {
      if (!(e.target as Element).closest('.btn')) this.setMinimized(true);
    });
    this.styleBtn.addEventListener('click', () => this.togglePanel());
    minimizeBtn.addEventListener('click', () => this.setMinimized(true));
    this.deleteBtn.addEventListener('click', () => this.requestDelete());
    this.textarea.addEventListener('input', () => this.scheduleTextSave());
    this.textarea.addEventListener('blur', () => this.flush());

    this.bubble.addEventListener('pointerdown', (e) => this.startDrag(e, this.bubble));
    this.bubble.addEventListener('pointerenter', () => this.placeTip());
    this.bubble.addEventListener('focus', () => this.placeTip());
    this.bubble.addEventListener('click', () => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.setMinimized(false);
      this.textarea.focus({ preventScroll: true });
    });

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.root);

    this.render(true);
  }

  get id(): string {
    return this.note.id;
  }

  get data(): Note {
    return this.note;
  }

  /**
   * Aplica uma versão vinda do storage (ex.: alterada em outra aba). Versões mais
   * antigas que o estado local são ecos de gravações já superadas e são ignoradas.
   */
  update(note: Note): void {
    if (note.updatedAt < this.note.updatedAt) return;
    this.note = note;
    this.render(!this.isEditing());
  }

  isEditing(): boolean {
    return this.textarea.matches(':focus');
  }

  /** Limita a posição exibida à largura atual da página, sem alterar o valor salvo. */
  layout(pageWidth: number): void {
    this.pageWidth = pageWidth;
    if (!this.dragging) this.applyPosition();
  }

  setZIndex(z: number): void {
    this.root.style.zIndex = String(z);
  }

  focusText(): void {
    this.setMinimized(false);
    this.textarea.focus({ preventScroll: true });
  }

  reveal(): void {
    this.root.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    this.root.classList.remove('flash');
    void this.root.offsetWidth; // reinicia a animação
    this.root.classList.add('flash');
    this.root.addEventListener('animationend', () => this.root.classList.remove('flash'), { once: true });
  }

  /** Salva imediatamente o texto pendente, se houver. */
  flush(): void {
    if (this.textTimer === undefined) return;
    window.clearTimeout(this.textTimer);
    this.textTimer = undefined;
    if (this.textarea.value !== this.note.text) this.commit({ text: this.textarea.value });
  }

  destroy(): void {
    this.flush();
    this.resizeObserver.disconnect();
    window.clearTimeout(this.resizeTimer);
    window.clearTimeout(this.confirmTimer);
    this.root.remove();
  }

  private render(includeText: boolean): void {
    const { note } = this;
    const theme = COLOR_THEMES[note.color] ?? COLOR_THEMES.yellow;
    this.root.style.setProperty('--note-body', theme.body);
    this.root.style.setProperty('--note-header', theme.header);
    this.root.style.setProperty('--note-accent', theme.accent);
    this.root.style.width = `${note.width}px`;
    this.root.style.height = `${note.height}px`;
    this.root.classList.toggle('minimized', note.minimized);
    this.applyPosition();

    if (includeText && this.textarea.value !== note.text) this.textarea.value = note.text;

    this.bubble.innerHTML = iconSvg(note.icon);
    const preview = firstLine(note.text);
    this.bubble.setAttribute('aria-label', `Abrir nota: ${preview}`);
    this.tip.textContent = preview;

    for (const swatch of this.panel.querySelectorAll<HTMLButtonElement>('.swatch')) {
      swatch.setAttribute('aria-pressed', String(swatch.dataset.color === note.color));
    }
    for (const option of this.panel.querySelectorAll<HTMLButtonElement>('.icon')) {
      option.setAttribute('aria-pressed', String(option.dataset.icon === (note.icon ?? 'note')));
    }
  }

  private applyPosition(): void {
    const width = this.note.minimized ? BUBBLE_SIZE : this.note.width;
    const maxX = Math.max(0, this.pageWidth - width);
    this.root.style.left = `${Math.min(this.note.x, maxX)}px`;
    this.root.style.top = `${this.note.y}px`;
  }

  /** Atualiza o estado local na hora e pede para salvar. */
  private commit(patch: NotePatch): void {
    const updatedAt = Math.max(Date.now(), this.note.updatedAt + 1);
    this.note = { ...this.note, ...patch, updatedAt };
    this.render(false);
    this.callbacks.onChange(this.note.id, { ...patch, updatedAt });
  }

  private setMinimized(minimized: boolean): void {
    if (minimized === this.note.minimized) return;
    this.flush();
    this.panel.hidden = true;
    this.styleBtn.setAttribute('aria-expanded', 'false');
    this.commit({ minimized });
    if (minimized) this.bubble.focus({ preventScroll: true });
  }

  private togglePanel(): void {
    this.panel.hidden = !this.panel.hidden;
    this.styleBtn.setAttribute('aria-expanded', String(!this.panel.hidden));
  }

  /** Mostra a dica à esquerda da bolinha quando não há espaço à direita. */
  private placeTip(): void {
    const rect = this.bubble.getBoundingClientRect();
    this.root.classList.toggle('tip-left', rect.right + TIP_SPACE > document.documentElement.clientWidth);
  }

  private scheduleTextSave(): void {
    window.clearTimeout(this.textTimer);
    this.textTimer = window.setTimeout(() => {
      this.textTimer = undefined;
      if (this.textarea.value !== this.note.text) this.commit({ text: this.textarea.value });
    }, TEXT_SAVE_DELAY);
  }

  private requestDelete(): void {
    const isEmpty = !this.textarea.value.trim();
    if (isEmpty || this.deleteBtn.classList.contains('confirm')) {
      window.clearTimeout(this.textTimer);
      this.textTimer = undefined;
      this.callbacks.onDelete(this.note.id);
      return;
    }
    this.deleteBtn.classList.add('confirm');
    this.deleteBtn.textContent = 'Confirmar?';
    this.confirmTimer = window.setTimeout(() => {
      this.deleteBtn.classList.remove('confirm');
      this.deleteBtn.textContent = '×';
    }, DELETE_CONFIRM_TIMEOUT);
  }

  private startDrag(event: PointerEvent, handle: HTMLElement): void {
    if (event.button !== 0 || (event.target as Element).closest('.btn')) return;
    event.preventDefault();

    const startX = event.pageX;
    const startY = event.pageY;
    const originX = this.root.offsetLeft;
    const originY = this.root.offsetTop;
    let moved = false;

    handle.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.suppressClick = false;

    const onMove = (e: PointerEvent) => {
      const dx = e.pageX - startX;
      const dy = e.pageY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      if (!moved) this.root.classList.add('dragging');
      moved = true;
      this.root.style.left = `${Math.max(0, originX + dx)}px`;
      this.root.style.top = `${Math.max(0, originY + dy)}px`;
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      this.dragging = false;
      this.root.classList.remove('dragging');
      if (!moved) return;
      if (handle === this.bubble) this.suppressClick = true;
      const x = Math.round(this.root.offsetLeft);
      const y = Math.round(this.root.offsetTop);
      if (x !== this.note.x || y !== this.note.y) this.commit({ x, y });
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  private onResize(): void {
    if (this.note.minimized || this.dragging) return;
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.note.minimized) return;
      const width = Math.round(this.root.offsetWidth);
      const height = Math.round(this.root.offsetHeight);
      if (width !== this.note.width || height !== this.note.height) this.commit({ width, height });
    }, RESIZE_SAVE_DELAY);
  }
}
