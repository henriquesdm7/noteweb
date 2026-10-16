import { describe, expect, it } from 'vitest';
import { isRestrictedUrl, toPageKey } from '../src/shared/pageKey';

describe('toPageKey', () => {
  it('mantém protocolo, host, caminho e query string', () => {
    expect(toPageKey('https://example.com/docs/page?id=42')).toBe('https://example.com/docs/page?id=42');
  });

  it('ignora o #hash', () => {
    expect(toPageKey('https://example.com/a?x=1#secao')).toBe('https://example.com/a?x=1');
    expect(toPageKey('https://example.com/a#secao')).toBe('https://example.com/a');
  });

  it('diferencia páginas com query strings diferentes', () => {
    expect(toPageKey('https://example.com/watch?v=1')).not.toBe(toPageKey('https://example.com/watch?v=2'));
  });

  it('ordena os parâmetros da query', () => {
    expect(toPageKey('https://example.com/a?b=2&a=1')).toBe(toPageKey('https://example.com/a?a=1&b=2'));
  });

  it('descarta "?" vazio', () => {
    expect(toPageKey('https://example.com/a?')).toBe('https://example.com/a');
  });

  it('remove a barra final, exceto na raiz', () => {
    expect(toPageKey('https://example.com/a/b/')).toBe('https://example.com/a/b');
    expect(toPageKey('https://example.com/a/b//?q=1')).toBe('https://example.com/a/b?q=1');
    expect(toPageKey('https://example.com/')).toBe('https://example.com/');
    expect(toPageKey('https://example.com')).toBe('https://example.com/');
  });

  it('normaliza o host para minúsculas e mantém a porta', () => {
    expect(toPageKey('https://EXAMPLE.com:8080/Caminho')).toBe('https://example.com:8080/Caminho');
  });

  it('funciona com file://', () => {
    expect(toPageKey('file:///home/user/doc.html#x')).toBe('file:///home/user/doc.html');
  });

  it('retorna null para URLs inválidas', () => {
    expect(toPageKey('não é url')).toBeNull();
  });
});

describe('isRestrictedUrl', () => {
  it('permite http, https e file', () => {
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl('http://example.com')).toBe(false);
    expect(isRestrictedUrl('file:///tmp/a.html')).toBe(false);
  });

  it('bloqueia páginas internas e a Web Store', () => {
    expect(isRestrictedUrl(undefined)).toBe(true);
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('chrome-extension://abc/popup.html')).toBe(true);
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/x')).toBe(true);
  });
});
