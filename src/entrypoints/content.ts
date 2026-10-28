// ============================================================
// WebFinger - Content Script (ISOLATED World)
// 采集页面 DOM/HTML/Meta/Script/Cookie 等指纹数据
// ============================================================

import {
  collectMetaTags,
  collectScriptSources,
  collectInlineScripts,
  collectCssIdentifiers,
  collectHTML,
  resolveFaviconUrl,
} from '../core/collectors/dom';
import { parseCookieString } from '../core/collectors/cookies';
import type { CollectedPageData } from '../core/types';

export default defineContentScript({
  matches: ['*://*/*'],

  async main(ctx) {
    // 防重复注入标记
    const marker = 'data-webfinger-scanned';
    if (document.head?.querySelector(`[${marker}]`)) return;

    const meta = document.createElement('meta');
    meta.setAttribute(marker, 'true');
    document.head?.appendChild(meta);

    // 监听 Background 发来的采集请求
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'COLLECT_PAGE_DATA') {
        const data = collectPageData();
        sendResponse({ type: 'PAGE_DATA', data });
      }
      return true;
    });

    // 页面加载完成后自动采集（不再重复发送，等 Background 请求）
  },
});

/** 执行完整的数据采集 */
function collectPageData(): CollectedPageData {
  const url = location.href;
  const hostname = location.hostname;

  // 从 MAIN world 获取 JS 全局变量（通过 postMessage）
  const jsGlobals = collectJsGlobals();

  return {
    url,
    hostname,
    html: collectHTML(document),
    meta: collectMetaTags(document),
    scriptSrc: collectScriptSources(document),
    scripts: collectInlineScripts(document),
    cssClasses: collectCssIdentifiers(document),
    jsGlobals,
    cookies: parseCookieString(document.cookie),
    faviconUrl: resolveFaviconUrl(document, url),
  };
}

/**
 * JS 全局变量采集
 * 注意：在 ISOLATED world 中无法访问页面的 window 对象
 * 需要通过 MAIN world 脚本来获取
 */
function collectJsGlobals(): Record<string, string> {
  // 基础的 DOM 层面可检测的变量
  const result: Record<string, string> = {};

  // 通过 HTML 属性检测（部分框架会设置 html/body 属性）
  if (document.documentElement.getAttribute('ng-app') ||
      document.documentElement.getAttribute('ng-controller') ||
      document.documentElement.getAttribute('ng-version')) {
    result['Angular'] = 'true';
  }

  // React 检测：检查 __REACT_DEVTOOLS_GLOBAL_HOOK__ 是否在页面中
  // （ISOLATED world 无法直接检测，需要通过其他方式）

  return result;
}

// 监听 MAIN world 发来的 JS 全局变量消息
// 安全说明：必须验证消息来源和格式，防止恶意页面伪造数据
window.addEventListener('message', (event) => {
  // 1. 验证消息来源：必须来自当前页面（origin 检查）
  if (event.origin !== location.origin) {
    // 忽略来自其他源的消息
    console.debug('[WebFinger] Ignored cross-origin message');
    return;
  }
  
  // 2. 验证消息来源窗口
  if (event.source !== window) return;
  
  // 3. 验证消息结构
  if (!event.data || typeof event.data !== 'object') return;
  if (event.data.type !== 'WEBFINGER_JS_GLOBALS') return;
  
  // 4. 验证 globals 数据格式
  if (!event.data.globals || typeof event.data.globals !== 'object') {
    console.warn('[WebFinger] Invalid globals data format');
    return;
  }
  
  // 5. 限制数据大小，防止资源耗尽
  const globals = event.data.globals;
  const keyCount = Object.keys(globals).length;
  if (keyCount > 1000) {
    console.warn('[WebFinger] Too many globals keys, possible attack detected');
    return;
  }
  
  // 6. 验证每个值都是安全的字符串
  for (const [key, value] of Object.entries(globals)) {
    if (typeof value !== 'string') {
      console.warn('[WebFinger] Invalid value type for key:', key);
      return;
    }
    // 限制单个值的长度
    if (value.length > 1000) {
      console.warn('[WebFinger] Value too long for key:', key);
      return;
    }
  }
  
  // 转发给 Background
  browser.runtime.sendMessage({
    type: 'JS_GLOBALS',
    tabId: -1, // 由 Background 根据 sender 推断
    globals: event.data.globals,
  });
});
