import { describe, expect, it } from 'vitest';
import { createBackup, mergeNotes, validateBackup } from '../src/shared/backup';
import type { Note } from '../src/shared/types';

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1',
  pageKey: 'https://example.com/a',
  x: 10,
  y: 20,
  width: 240,
  height: 180,
  color: 'yellow',
  icon: 'note',
  text: 'olá',
  minimized: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...over,
});

describe('validateBackup', () => {
  it('aceita um backup gerado por createBackup', () => {
    const notes = [note(), note({ id: 'n2', color: 'blue', icon: 'bulb' })];
    expect(validateBackup(JSON.parse(JSON.stringify(createBackup(notes, 5))))).toEqual({ notes, invalid: 0 });
  });

  it('rejeita arquivos que não são do NoteWeb', () => {
    expect(() => validateBackup(null)).toThrow('JSON válido');
    expect(() => validateBackup({ app: 'outro', version: 1, notes: [] })).toThrow('não é um backup');
    expect(() => validateBackup({ app: 'noteweb', version: 2, notes: [] })).toThrow('Versão');
    expect(() => validateBackup({ app: 'noteweb', version: 1 })).toThrow('lista de notas');
  });

  it('ignora notas inválidas e corrige valores fora do limite', () => {
    const { notes, invalid } = validateBackup({
      app: 'noteweb',
      version: 1,
      notes: [
        { ...note(), x: -50, width: 10, color: 'roxo', icon: 'foguete', updatedAt: undefined },
        { ...note({ id: 'n2' }), text: 42 },
        { id: 'n3' },
        'lixo',
      ],
    });
    expect(invalid).toBe(3);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ x: 0, width: 160, color: 'yellow', icon: 'note', updatedAt: 1000 });
  });
});

describe('mergeNotes', () => {
  it('adiciona notas novas na página certa', () => {
    const existing = [note()];
    const incoming = [note({ id: 'n2' }), note({ id: 'n3', pageKey: 'https://example.com/b' })];
    const result = mergeNotes(existing, incoming);
    expect(result).toMatchObject({ added: 2, updated: 0, unchanged: 0 });
    expect(result.pages.get('https://example.com/a')!.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(result.pages.get('https://example.com/b')!.map((n) => n.id)).toEqual(['n3']);
  });

  it('mantém a versão mais recente pelo updatedAt', () => {
    const existing = [note({ text: 'antiga', updatedAt: 1000 }), note({ id: 'n2', text: 'local', updatedAt: 3000 })];
    const incoming = [note({ text: 'nova', updatedAt: 2000 }), note({ id: 'n2', text: 'backup', updatedAt: 2000 })];
    const result = mergeNotes(existing, incoming);
    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 1 });
    expect(result.pages.get('https://example.com/a')!.map((n) => n.text)).toEqual(['local', 'nova']);
  });

  it('move a nota quando a versão mais nova está em outra página', () => {
    const existing = [note()];
    const incoming = [note({ pageKey: 'https://example.com/b', updatedAt: 2000 })];
    const result = mergeNotes(existing, incoming);
    expect(result.pages.get('https://example.com/a')).toEqual([]);
    expect(result.pages.get('https://example.com/b')!.map((n) => n.id)).toEqual(['n1']);
  });

  it('não marca páginas sem mudança', () => {
    const existing = [note()];
    const result = mergeNotes(existing, [note()]);
    expect(result.pages.size).toBe(0);
    expect(result.unchanged).toBe(1);
  });
});
