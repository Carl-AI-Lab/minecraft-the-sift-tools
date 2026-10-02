export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function link(label: string, href: string): HTMLAnchorElement {
  const node = element('a', label);
  const absolute = href.startsWith('/') ? new URL(href, 'https://minecraftthesift.com').href : href;
  node.href = absolute;
  if (absolute.startsWith('https://')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  return node;
}
export function facts(values: [string, string][]): HTMLDListElement {
  const list = element('dl');
  values.forEach(([label, value]) => list.append(element('dt', label), element('dd', value)));
  return list;
}
export function ready(callback: () => void): void {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  else callback();
}
