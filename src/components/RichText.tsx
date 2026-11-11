import { useMemo } from 'react';

const ALLOWED = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUB', 'SUP', 'MARK', 'BR']);

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Залишає лише безпечне інлайн-оформлення з документа (жирний, курсив,
 * підкреслення, індекси, підсвітку). Будь-які інші теги та атрибути
 * відкидаються, текст екранується — тож вставка через innerHTML безпечна.
 */
export function sanitizeInline(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const inner = Array.from(el.childNodes).map(walk).join('');
    if (!ALLOWED.has(el.tagName)) return inner;
    const tag = el.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    const cls = tag === 'mark' && /^hl-[A-Za-z]+$/.test(el.className) ? ` class="${el.className}"` : '';
    return `<${tag}${cls}>${inner}</${tag}>`;
  };
  return Array.from(root.childNodes).map(walk).join('');
}

/** Плоский текст без тегів (для полів вводу в редакторі). */
export function toPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html.replace(/<br\s*\/?>/gi, '\n')}</div>`, 'text/html');
  return doc.body.textContent ?? '';
}

interface Props {
  html: string;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

/** Показує текст із документа зі збереженим інлайн-оформленням і переносами. */
export function RichText({ html, className = '', as = 'span' }: Props) {
  const safe = useMemo(() => sanitizeInline(html), [html]);
  const Tag = as;
  return (
    <Tag
      className={`whitespace-pre-wrap ${className}`}
      // Вміст пройшов sanitizeInline: дозволені лише інлайн-теги без атрибутів.
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
