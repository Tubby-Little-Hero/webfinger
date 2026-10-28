// ============================================================
// WebFinger - Header Collector
// 从 HTTP 响应头中提取指纹信息
// ============================================================

import type { ResponseHeaders } from '../types';

/** 解析 webRequest 返回的响应头数组为标准 Record */
export function parseResponseHeaders(
  rawHeaders: Array<{ name: string; value?: string }> | undefined
): ResponseHeaders {
  if (!rawHeaders || !Array.isArray(rawHeaders)) return {};

  const headers: ResponseHeaders = {};
  for (const header of rawHeaders) {
    if (header.name && header.value !== undefined) {
      headers[header.name.toLowerCase()] = header.value;
    }
  }
  return headers;
}

/** 从响应头中提取可能包含技术信息的 header */
export function extractTechHeaders(headers: ResponseHeaders): ResponseHeaders {
  const techHeaderNames = [
    'server',
    'x-powered-by',
    'x-generator',
    'x-aspnet-version',
    'x-aspnetmvc-version',
    'x-drupal-cache',
    'x-drupal-dynamic-cache',
    'x-ua-compatible',
    'x-application-context',
    'x-modsecurity',
    'cf-ray',
    'cf-cache-status',
    'x-cache',
    'x-cache-lookup',
    'x-swift-*',
    'x-vercel-id',
    'x-served-by',
    'x-akamai-transformed',
    'x-chaitin-waf',
    'x-upyun-*',
    'x-waf-uuid',
    'x-content-encoded-by',
  ];

  const extracted: ResponseHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (techHeaderNames.some((name) => {
      if (name.endsWith('*')) {
        return key.startsWith(name.slice(0, -1).toLowerCase());
      }
      return key === name;
    })) {
      extracted[key] = value;
    }
  }
  return extracted;
}
