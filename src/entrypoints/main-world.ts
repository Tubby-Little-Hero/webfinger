// ============================================================
// WebFinger - Main World Script
// 在页面的 MAIN world 中运行，检测 JS 全局变量
// 这是唯一能访问页面真实 window 对象的方式
// ============================================================

import { JS_GLOBAL_CHECKS } from '../core/collectors/javascript';

export default defineContentScript({
  matches: ['*://*/*'],
  world: 'MAIN',

  async main() {
    // 防止重复执行
    if ((window as any).__WEBFINGER_MAIN_RUN__) return;
    (window as any).__WEBFINGER_MAIN_RUN__ = true;

    // 执行全局变量检查
    const globals: Record<string, string> = {};

    for (const [path] of JS_GLOBAL_CHECKS) {
      try {
        const parts = path.split('.');
        let val: any = (window as any);
        let valid = true;
        for (const part of parts) {
          if (val === null || val === undefined) { valid = false; break; }
          val = val[part];
        }
        if (valid && val !== undefined) {
          globals[path] = typeof val === 'string' ? val : 'true';
        }
      } catch {
        // ignore
      }
    }

    // 通过 postMessage 发送给 ISOLATED world 的 content script
    window.postMessage({
      type: 'WEBFINGER_JS_GLOBALS',
      globals,
    }, '*');
  },
});
