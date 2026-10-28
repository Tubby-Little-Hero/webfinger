// ============================================================
// WebFinger - DOM Collector
// 从页面 DOM 中提取 HTML、Meta、Script、CSS 等指纹信息
// ============================================================

import type { MetaTag } from '../types';

/** 采集所有 meta 标签 */
export function collectMetaTags(doc: Document): MetaTag[] {
  const metaTags: MetaTag[] = [];
  const elements = doc.querySelectorAll('meta');

  for (const el of elements) {
    const name = el.getAttribute('name') || el.getAttribute('property') || '';
    const content = el.getAttribute('content') || '';
    const property = el.getAttribute('property') || undefined;

    if (name || content) {
      metaTags.push({ name, content, property });
    }
  }

  return metaTags;
}

/** 采集所有 script 标签的 src 属性 */
export function collectScriptSources(doc: Document): string[] {
  const sources: string[] = [];
  const scripts = doc.querySelectorAll('script[src]');

  for (const script of scripts) {
    const src = script.getAttribute('src');
    if (src) sources.push(src);
  }

  return sources;
}

/** 采集所有内联 script 内容 */
export function collectInlineScripts(doc: Document): string[] {
  const scripts: string[] = [];
  const elements = doc.querySelectorAll('script:not([src])');

  for (const script of elements) {
    const text = script.textContent;
    if (text && text.trim().length > 0) {
      scripts.push(text.trim());
    }
  }

  return scripts;
}

/** 采集页面中使用的 CSS class 和 ID */
export function collectCssIdentifiers(doc: Document): string[] {
  const identifiers: string[] = [];
  const allElements = doc.querySelectorAll('[class], [id]');

  for (const el of allElements) {
    const className = el.getAttribute('class');
    if (className) {
      identifiers.push(...className.split(/\s+/).filter(Boolean));
    }
    const id = el.getAttribute('id');
    if (id) {
      identifiers.push(`#${id}`);
    }
  }

  return [...new Set(identifiers)];
}

/** 采集所有 link 标签的 href（样式表、图标等） */
export function collectLinkHrefs(doc: Document): string[] {
  const hrefs: string[] = [];
  const links = doc.querySelectorAll('link[href]');

  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) hrefs.push(href);
  }

  return hrefs;
}

/** 获取 favicon URL */
export function resolveFaviconUrl(doc: Document, pageUrl: string): string | null {
  // 优先查找 link 标签中的 favicon
  const iconLink = doc.querySelector(
    'link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  if (iconLink) {
    const href = iconLink.getAttribute('href');
    if (href) {
      try {
        return new URL(href, pageUrl).href;
      } catch {
        return null;
      }
    }
  }

  // 默认 favicon.ico
  try {
    const url = new URL(pageUrl);
    return `${url.protocol}//${url.host}/favicon.ico`;
  } catch {
    return null;
  }
}

/** 获取完整 HTML（限制长度以提高性能） */
export function collectHTML(doc: Document, maxLength: number = 150000): string {
  const html = doc.documentElement.outerHTML;
  return html.length > maxLength ? html.substring(0, maxLength) : html;
}

/** 从 HTML 中提取纯文本 */
export function extractTextContent(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
