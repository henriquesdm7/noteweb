/**
 * Chave que identifica "a mesma página": protocolo + host + caminho + query string.
 * O #hash é ignorado, a barra final do caminho é removida (exceto na raiz) e os
 * parâmetros da query são ordenados, para que `?a=1&b=2` e `?b=2&a=1` sejam a mesma página.
 * Retorna null para URLs inválidas.
 */
export function toPageKey(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  let path = url.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';
  url.searchParams.sort();
  const query = url.searchParams.toString();
  return `${url.protocol}//${url.host}${path}${query ? `?${query}` : ''}`;
}

/** Páginas onde o Chrome não permite content scripts. */
export function isRestrictedUrl(href: string | undefined): boolean {
  if (!href) return true;
  if (!/^(https?|file):/i.test(href)) return true;
  try {
    const { hostname, pathname } = new URL(href);
    if (hostname === 'chromewebstore.google.com') return true;
    if (hostname === 'chrome.google.com' && pathname.startsWith('/webstore')) return true;
  } catch {
    return true;
  }
  return false;
}
