// ============================================================
// WebFinger - Favicon Collector
// 计算 favicon 的 MurmurHash3 hash，匹配已知 CMS
// ============================================================

import { murmur3_32 } from '../../utils/hash';

/**
 * 验证 URL 是否安全（防止 SSRF）
 * 只允许 http/https 协议，禁止访问内网地址
 */
function isSafeUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // 只允许 http/https 协议
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    
    const hostname = url.hostname.toLowerCase();
    
    // 检查是否是 localhost 或本地域名
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
      return false;
    }
    
    // 检查是否是私有 IP 地址范围
    if (isPrivateIp(hostname)) {
      return false;
    }
    
    // 检查是否使用了本地回环地址的各种变体
    if (hostname === '0.0.0.0' || hostname === '::') {
      return false;
    }
    
    return true;
  } catch {
    // URL 解析失败，不安全
    return false;
  }
}

/**
 * 检查 IP 是否在私有地址范围内
 */
function isPrivateIp(hostname: string): boolean {
  // 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  
  // 172.16.0.0/12
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const second = parseInt(match172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  
  // 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  
  // 127.0.0.0/8 (loopback)
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  
  // 169.254.0.0/16 (link-local)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  
  return false;
}

/**
 * 计算 favicon 的 hash（兼容 Shodan 格式）
 *
 * Shodan 的 favicon hash 算法：
 * 1. 读取 favicon 文件内容
 * 2. 进行 Base64 编码
 * 3. 在 76 字符处插入换行符
 * 4. 末尾添加换行符
 * 5. 对结果执行 MurmurHash3 32-bit
 */
export async function computeFaviconHash(faviconUrl: string): Promise<number | null> {
  try {
    // SSRF 防护：验证 URL 安全性
    if (!isSafeUrl(faviconUrl)) {
      console.warn('[WebFinger] Blocked potentially unsafe favicon URL:', faviconUrl);
      return null;
    }
    
    const response = await fetch(faviconUrl, {
      signal: AbortSignal.timeout(5000),
      redirect: 'error', // 禁止跟随重定向到不安全地址
    });

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Base64 编码
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // 每 76 字符加换行 + 末尾换行
    let encoded = '';
    for (let i = 0; i < base64.length; i++) {
      if (i > 0 && i % 76 === 0) encoded += '\n';
      encoded += base64[i];
    }
    encoded += '\n';

    // MurmurHash3 → 有符号 int32
    const hash = murmur3_32(encoded, 0);
    return hash | 0;
  } catch {
    return null;
  }
}

/**
 * 已知 CMS/平台的 favicon hash 数据库
 * hash 值使用有符号 32 位整数格式
 */
export const KNOWN_FAVICON_HASHES: Record<string, number> = {
  // 这些值需要在有对应 favicon 的网站上进行验证
  // 格式: '技术名称': hash_value
  // 例如: 'WordPress': -1234567890,
};
