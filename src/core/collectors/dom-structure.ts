// ============================================================
// WebFinger - DOM Structure Collector
// 采集 DOM 结构特征用于指纹识别
// ============================================================

import type { DomNodeInfo } from '../types';

/** 需要采集的关键元素选择器列表 */
const KEY_SELECTORS = [
  // 框架根元素
  '[id^="__next"]',           // Next.js
  '[data-reactroot]',          // React
  '[data-v-]',                 // Vue (scoped)
  '[ng-app], [ng-component]',  // Angular
  '[svelte]',                  // Svelte
  '[class*="__nuxt"]',         // Nuxt
  '[hx]',                      // HTMX
  '[x-data]',                  // Alpine.js
  '[wire\\:]',                 // Livewire
  
  // CMS 相关
  '#wp-content', '.wp-block',  // WordPress
  '#drupalpage', '.drupal-',   // Drupal
  '#joomla', '.joomla',        // Joomla
  '#dede', '.dede',            // DedeCMS
  
  // 电子商务
  '.product-list', '.cart-item',
  '[data-product]', '[data-sku]',
  
  // 表单框架
  '[data-validate]', '.form-group',
  '[aria-label*="form"]',
  
  // 轮播/组件
  '.carousel', '.swiper-container',
  '.modal', '[data-bs-toggle]',
  '[data-toggle*="modal"]',
  
  // 图表/数据可视化
  'svg[data-chart]', '[data-echarts]',
  'canvas.chart',
  
  // 富文本编辑器
  '[contenteditable="true"]',
  '.editor-content',
  
  // 认证/用户
  '[data-user-id]', '[data-account]',
  
  // SPA 路由
  '[data-view]', '[data-route]',
];

/** 关键属性名列表 */
const KEY_ATTRIBUTES = [
  'src', 'href', 'action',
  'data-component', 'data-component-name',
  'data-module', 'data-page', 'data-template',
  'data-app', 'data-root',
  'data-version', 'data-framework',
  'data-site', 'data-config',
  'ng-version', 'ng-class', 'ng-if',
  'v-cloak', 'v-model',
  'wire:snapshot', 'wire:submit',
];

/**
 * 采集页面关键 DOM 节点的结构信息
 * @param doc Document 对象
 * @param maxNodes 最大采集节点数
 */
export function collectDomNodes(
  doc: Document,
  maxNodes: number = 500
): DomNodeInfo[] {
  const nodes: DomNodeInfo[] = [];
  const seen = new Set<string>();

  for (const selector of KEY_SELECTORS) {
    try {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el, index) => {
        if (nodes.length >= maxNodes) return;
        
        const nodeId = generateNodeId(el, index);
        if (seen.has(nodeId)) return;
        seen.add(nodeId);

        nodes.push({
          selector: generateSelectorPath(el),
          tag: el.tagName.toLowerCase(),
          className: el.className?.toString() || '',
          id: el.id || '',
          text: (el.textContent || '').trim().substring(0, 200),
          keyAttributes: extractKeyAttributes(el),
        });
      });
    } catch {
      // 某些选择器可能不支持，跳过
    }
  }

  // 额外采集: 有 data-* 属性的元素
  const dataElements = doc.querySelectorAll('[data-]');
  dataElements.forEach((el) => {
    if (nodes.length >= maxNodes) return;
    
    const dataAttrs = Array.from(el.attributes)
      .filter(a => a.name.startsWith('data-'))
      .map(a => a.name);
    
    if (dataAttrs.length >= 2) {
      const nodeId = generateNodeId(el, dataAttrs.length);
      if (seen.has(nodeId)) return;
      seen.add(nodeId);

      nodes.push({
        selector: generateSelectorPath(el),
        tag: el.tagName.toLowerCase(),
        className: el.className?.toString() || '',
        id: el.id || '',
        text: (el.textContent || '').trim().substring(0, 100),
        keyAttributes: extractKeyAttributes(el),
      });
    }
  });

  return nodes;
}

/**
 * 生成节点唯一 ID（避免重复）
 */
function generateNodeId(el: Element, index: number): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id || '';
  const cls = (el.className?.toString() || '').split(/\s+/).slice(0, 2).join('.');
  return `${tag}#${id}.${cls}[${index}]`;
}

/**
 * 生成 CSS 选择器路径
 */
function generateSelectorPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  
  while (current && depth < 5) {
    let selector = current.tagName.toLowerCase();
    
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    }
    
    const classes = current.className?.toString();
    if (classes) {
      const firstClass = classes.split(/\s+/)[0];
      if (firstClass) {
        selector += `.${firstClass}`;
      }
    }
    
    // 添加 nth-child
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current as Element) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    
    parts.unshift(selector);
    current = current.parentElement;
    depth++;
  }
  
  return parts.join(' > ');
}

/**
 * 提取关键属性
 */
function extractKeyAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  for (const attr of KEY_ATTRIBUTES) {
    const value = el.getAttribute(attr);
    if (value !== null && value.length < 500) {
      attrs[attr] = value;
    }
  }
  
  // 提取所有 data-* 属性
  const elementAttrs = el.attributes;
  for (let i = 0; i < elementAttrs.length; i++) {
    const attr = elementAttrs[i];
    if (attr.name.startsWith('data-') && attr.value.length < 200) {
      attrs[attr.name] = attr.value;
    }
  }
  
  return attrs;
}

/**
 * 采集页面 iframe URL 列表
 */
export function collectIframeUrls(doc: Document): string[] {
  const urls: string[] = [];
  const iframes = doc.querySelectorAll('iframe[src]');
  
  for (const iframe of iframes) {
    const src = iframe.getAttribute('src');
    if (src && !src.startsWith('about:')) {
      urls.push(src);
    }
  }
  
  return [...new Set(urls)];
}

/**
 * 采集 Service Worker URL
 */
export function collectServiceWorkers(doc: Document, scripts: string[]): string[] {
  const urls: string[] = [];
  
  // 从 script 标签中查找 serviceWorker.register 调用
  for (const script of scripts) {
    const swMatches = script.match(/serviceWorker\.register\(['"]([^'"]+)['"]\)/g);
    if (swMatches) {
      for (const match of swMatches) {
        const urlMatch = match.match(/['"]([^'"]+)['"]/);
        if (urlMatch) {
          urls.push(urlMatch[1]);
        }
      }
    }
  }
  
  return [...new Set(urls)];
}

/**
 * 检查特定 DOM 选择器是否存在
 */
export function checkDomSelector(
  doc: Document,
  selector: string
): { exists: boolean; count: number } {
  try {
    const elements = doc.querySelectorAll(selector);
    return { exists: elements.length > 0, count: elements.length };
  } catch {
    return { exists: false, count: 0 };
  }
}
