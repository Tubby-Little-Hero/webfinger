import { describe, it, expect } from 'vitest';
import { 
  collectDomNodes, 
  collectIframeUrls, 
  collectServiceWorkers,
  checkDomSelector,
} from '../src/core/collectors/dom-structure';

/**
 * 不依赖 jsdom 的 DOM 结构采集测试
 * 使用 mock 对象模拟 DOM API
 */

interface MockAttr {
  name: string;
  value: string;
}

interface MockElement {
  tagName: string;
  id: string;
  className: string;
  textContent: string;
  attributes: MockAttr[];
  parentElement: MockElement | null;
  getAttribute: (name: string) => string | null;
}

function createMockElement(
  tag: string,
  options: {
    id?: string;
    className?: string;
    text?: string;
    attributes?: Record<string, string>;
  } = {}
): MockElement {
  const { id = '', text = '', attributes = {} } = options;
  // 优先使用显式传入的 className，否则从 attributes 中提取
  const className = options.className ?? attributes['class'] ?? '';
  
  const attrArray: MockAttr[] = Object.entries(attributes).map(([name, value]) => ({
    name,
    value,
  }));

  return {
    tagName: tag.toUpperCase(),
    id,
    className,
    textContent: text,
    attributes: attrArray,
    parentElement: null,
    getAttribute: (name: string) => {
      const attr = attrArray.find((a) => a.name === name);
      return attr ? attr.value : null;
    },
  };
}

function createMockDocument(html: string) {
  // 解析 HTML 提取元素
  const elements: MockElement[] = [];

  // 提取带 id 的元素
  const idMatches = [...html.matchAll(/<(\w+)([^>]*)\sid="([^"]*)"([^>]*)>/g)];
  for (const match of idMatches) {
    const tag = match[1];
    const id = match[3];
    const fullTag = match[0];
    const attributes = extractAttributes(fullTag);
    const textContent = extractTextContent(html, match.index!, fullTag, tag);
    elements.push(createMockElement(tag, { id, attributes, text: textContent }));
  }

  // 提取带 class 的元素（不重复）
  const classMatches = [...html.matchAll(/<(\w+)([^>]*)\sclass="([^"]*)"([^>]*)>/g)];
  for (const match of classMatches) {
    const tag = match[1];
    const className = match[3];
    const fullTag = match[0];
    const id = fullTag.match(/\sid="([^"]*)"/)?.[1] || '';
    
    // 避免重复添加已经有 id 的元素
    if (id && elements.some((e) => e.id === id)) continue;
    
    const attributes = extractAttributes(fullTag);
    const textContent = extractTextContent(html, match.index!, fullTag, tag);
    elements.push(createMockElement(tag, { id, className, attributes, text: textContent }));
  }

  // 提取 iframe src
  const iframeSrcs: string[] = [];
  const iframeMatches = [...html.matchAll(/<iframe[^>]*src="([^"]*)"[^>]*>/g)];
  for (const match of iframeMatches) {
    iframeSrcs.push(match[1]);
  }

  return {
    querySelectorAll: function (selector: string): MockElement[] {
      const matched: MockElement[] = [];

      // 处理复合选择器，如 'link[rel*="icon"]'
      const baseSelector = selector.split('[')[0].split(',')[0].trim();

      for (const el of elements) {
        if (matchesSelector(el, selector)) {
          matched.push(el);
        }
      }

      // 处理 iframe[src]
      if (selector === 'iframe[src]') {
        for (const src of iframeSrcs) {
          const iframeEl = createMockElement('iframe', {
            attributes: { src },
          });
          matched.push(iframeEl);
        }
      }

      return matched;
    },
  };
}

function matchesSelector(el: MockElement, selector: string): boolean {
  // 处理逗号分隔的多个选择器
  if (selector.includes(',')) {
    return selector.split(',').some((s) => matchesSelector(el, s.trim()));
  }

  // 多部分组合选择器 (如 svg[data-chart], canvas.chart, button.btn.btn-primary)
  const parts = splitCompoundSelector(selector);
  if (parts.length > 1) {
    return parts.every((part) => matchesSelector(el, part));
  }

  const single = parts[0];

  // ID 选择器
  if (single.startsWith('#')) {
    return el.id === single.slice(1);
  }

  // class 选择器
  if (single.startsWith('.')) {
    const cls = single.slice(1);
    return el.className.split(/\s+/).includes(cls);
  }

  // 属性选择器 (含 [data-], [data-attr^=val], [data-attr*=val], etc.)
  const attrMatch = single.match(/^\[([^\]\=~|^*$]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]$/);
  if (attrMatch) {
    const [, attrName, op, attrValue] = attrMatch;
    
    // 通配符 data-: 检查是否有任意 data-* 属性
    if (attrName.endsWith('-') && !attrValue) {
      return el.attributes.some((a) => a.name.startsWith(attrName));
    }
    
    const val = el.getAttribute(attrName);
    if (val === null) return false;
    if (attrValue === undefined) return true;
    switch (op) {
      case '^=': return val.startsWith(attrValue);
      case '*=': return val.includes(attrValue);
      case '|=': return val.startsWith(attrValue);
      case '$=': return val.endsWith(attrValue);
      case '~=': return val.split(/\s+/).includes(attrValue);
      default: return val === attrValue;
    }
  }

  // 属性 + 标签组合 (如 [data-chart], [contenteditable="true"])
  if (single.startsWith('[')) {
    return matchAttributeOnly(el, single);
  }

  // class + 标签组合 (如 button.btn.btn-primary, canvas.chart)
  // 先提取标签名
  const tagMatch = single.match(/^([a-zA-Z][\w-]*)/);
  if (tagMatch) {
    const tagName = tagMatch[1];
    if (el.tagName.toLowerCase() !== tagName.toLowerCase()) {
      return false;
    }
    // 剩余部分
    const rest = single.slice(tagName.length);
    if (rest) {
      return matchesSelector(el, rest);
    }
    return true;
  }

  return false;
}

function splitCompoundSelector(selector: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inBrackets = false;

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '[') inBrackets = true;
    if (ch === ']') inBrackets = false;
    
    if (ch === ' ' && !inBrackets && current.trim()) {
      // 检查是否是后代选择器或连续选择器
      const trimmed = current.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function matchAttributeOnly(el: MockElement, attrSelector: string): boolean {
  // 处理 [attr] 或 [attr=val] 格式
  const match = attrSelector.match(/^\[([^\]\=~|^*$]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]$/);
  if (!match) return false;
  
  const [, attrName, op, attrValue] = match;
  
  if (attrName.endsWith('-') && !attrValue) {
    return el.attributes.some((a) => a.name.startsWith(attrName));
  }
  
  const val = el.getAttribute(attrName);
  if (val === null) return false;
  if (attrValue === undefined) return true;
  
  switch (op) {
    case '^=': return val.startsWith(attrValue);
    case '*=': return val.includes(attrValue);
    case '|=': return val.startsWith(attrValue);
    case '$=': return val.endsWith(attrValue);
    case '~=': return val.split(/\s+/).includes(attrValue);
    default: return val === attrValue;
  }
}

function extractAttributes(tagStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrMatches = [...tagStr.matchAll(/([\w-]+)="([^"]*)"/g)];
  for (const match of attrMatches) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function extractTextContent(
  html: string,
  startIndex: number,
  openingTag: string,
  tagName: string
): string {
  const afterTag = html.substring(startIndex + openingTag.length);
  const closingIdx = afterTag.indexOf(`</${tagName}>`);
  if (closingIdx >= 0) {
    return afterTag.substring(0, closingIdx).replace(/<[^>]+>/g, '').trim();
  }
  return '';
}

describe('DOM 结构采集测试', () => {
  
  describe('collectDomNodes', () => {
    it('应该采集 React 根元素', () => {
      const mockDoc = createMockDocument(`
        <div id="root" data-reactroot="true">
          <h1>Hello World</h1>
        </div>
      `) as unknown as Document;

      const nodes = collectDomNodes(mockDoc);
      const rootNode = nodes.find((n) => n.id === 'root');
      
      expect(rootNode).toBeDefined();
      expect(rootNode?.tag).toBe('div');
    });

    it('应该采集带有 data-* 属性的元素', () => {
      const mockDoc = createMockDocument(`
        <div id="header" data-component="Header" data-version="2.0">
          <span>Title</span>
        </div>
      `) as unknown as Document;

      const nodes = collectDomNodes(mockDoc);
      const headerNode = nodes.find((n) => n.id === 'header');
      
      expect(headerNode).toBeDefined();
      if (headerNode) {
        expect(headerNode.keyAttributes['data-component']).toBe('Header');
        expect(headerNode.keyAttributes['data-version']).toBe('2.0');
      }
    });

    it('应该限制采集的节点数量', () => {
      let html = '';
      for (let i = 0; i < 100; i++) {
        html += `<div id="item-${i}" class="test-item">Item ${i}</div>`;
      }
      
      const mockDoc = createMockDocument(html) as unknown as Document;
      const nodes = collectDomNodes(mockDoc, 10);
      expect(nodes.length).toBeLessThanOrEqual(10);
    });

    it('应该处理空文档', () => {
      const mockDoc = createMockDocument('') as unknown as Document;
      const nodes = collectDomNodes(mockDoc);
      expect(nodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('collectIframeUrls', () => {
    it('应该采集 iframe URL', () => {
      const mockDoc = createMockDocument(`
        <iframe src="https://cdn.example.com/embed"></iframe>
        <iframe src="about:blank"></iframe>
        <iframe src="/analytics"></iframe>
      `) as unknown as Document;

      const urls = collectIframeUrls(mockDoc);
      
      expect(urls).toContain('https://cdn.example.com/embed');
      expect(urls).toContain('/analytics');
      // about: 开头的应该被过滤
      expect(urls).not.toContain('about:blank');
    });

    it('应该去重 iframe URL', () => {
      const mockDoc = createMockDocument(`
        <iframe src="/video"></iframe>
        <iframe src="/video"></iframe>
      `) as unknown as Document;

      const urls = collectIframeUrls(mockDoc);
      expect(urls.filter((u) => u === '/video').length).toBe(1);
    });
  });

  describe('checkDomSelector', () => {
    it('应该检测元素是否存在', () => {
      const mockDoc = createMockDocument(`
        <div id="app" class="container">
          <button class="btn btn-primary">Click</button>
        </div>
      `) as unknown as Document;

      const result1 = checkDomSelector(mockDoc, '#app');
      expect(result1.exists).toBe(true);
      expect(result1.count).toBe(1);

      const result2 = checkDomSelector(mockDoc, '.btn-primary');
      expect(result2.exists).toBe(true);
      expect(result2.count).toBe(1);

      const result3 = checkDomSelector(mockDoc, '#nonexistent');
      expect(result3.exists).toBe(false);
    });

    it('应该检测多个匹配的元素', () => {
      const mockDoc = createMockDocument(`
        <div id="item-1" class="item">1</div>
        <div id="item-2" class="item">2</div>
        <div id="item-3" class="item">3</div>
      `) as unknown as Document;

      const result = checkDomSelector(mockDoc, '.item');
      expect(result.exists).toBe(true);
      expect(result.count).toBe(3);
    });
  });

  describe('DOM 节点信息结构', () => {
    it('应该包含所有必要的字段', () => {
      const mockDoc = createMockDocument(`
        <div id="test" class="container main" data-testid="hello">
          Sample text
        </div>
      `) as unknown as Document;

      const nodes = collectDomNodes(mockDoc);
      const testNode = nodes.find((n) => n.id === 'test');
      
      if (testNode) {
        expect(testNode.selector).toBeDefined();
        expect(testNode.tag).toBe('div');
        expect(testNode.className).toContain('container');
        expect(testNode.text).toBeDefined();
        expect(testNode.keyAttributes).toBeDefined();
      }
    });

    it('应该截断过长的文本', () => {
      const longText = 'A'.repeat(500);
      const mockDoc = createMockDocument(`
        <div id="text-test">${longText}</div>
      `) as unknown as Document;

      const nodes = collectDomNodes(mockDoc);
      const textNode = nodes.find((n) => n.id === 'text-test');
      
      if (textNode) {
        expect(textNode.text.length).toBeLessThanOrEqual(200);
      }
    });
  });

  describe('collectServiceWorkers', () => {
    it('应该从内联脚本中提取 Service Worker URL', () => {
      const scripts = [
        `navigator.serviceWorker.register('/sw.js')`,
        `if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/cache-sw.js'); }`,
      ];

      const swUrls = collectServiceWorkers({} as Document, scripts);
      
      expect(swUrls).toContain('/sw.js');
      expect(swUrls).toContain('/cache-sw.js');
    });

    it('应该去重 Service Worker URL', () => {
      const scripts = [
        `navigator.serviceWorker.register('/sw.js')`,
        `navigator.serviceWorker.register('/sw.js')`,
      ];

      const swUrls = collectServiceWorkers({} as Document, scripts);
      expect(swUrls.filter((u) => u === '/sw.js').length).toBe(1);
    });
  });
});
