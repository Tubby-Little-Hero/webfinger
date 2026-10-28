// ============================================================
// WebFinger - Cookie Collector
// 解析页面 Cookies 进行指纹匹配
// ============================================================

/** 将 document.cookie 字符串解析为 Record */
export function parseCookieString(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieStr) return cookies;

  for (const part of cookieStr.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.substring(0, idx).trim();
      const value = part.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

/** 从 Chrome webRequest API 获取的 cookie 列表解析 */
export function parseWebRequestCookies(
  cookies: Array<{ name: string; value?: string }> | undefined
): Record<string, string> {
  if (!cookies || !Array.isArray(cookies)) return {};

  const result: Record<string, string> = {};
  for (const cookie of cookies) {
    if (cookie.name) {
      result[cookie.name] = cookie.value || '';
    }
  }
  return result;
}
