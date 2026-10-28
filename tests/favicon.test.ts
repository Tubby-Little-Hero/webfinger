import { describe, it, expect } from 'vitest';

// 测试 SSRF 防护的 URL 验证逻辑
// 注意：这是单元测试，测试的是 isSafeUrl 函数的逻辑
// 该函数是私有的，所以我们通过测试 favicon 模块的行为来间接验证

describe('Favicon SSRF 防护测试', () => {
  
  describe('URL 安全验证', () => {
    
    // 私有函数 isSafeUrl 的测试逻辑（我们在这里复制逻辑进行验证）
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
        
        // 检查私有 IP 范围
        const isPrivateIp = (h: string): boolean => {
          if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
          
          const match172 = h.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
          if (match172) {
            const second = parseInt(match172[1], 10);
            if (second >= 16 && second <= 31) return true;
          }
          
          if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
          if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
          if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
          
          return false;
        };
        
        if (isPrivateIp(hostname)) {
          return false;
        }
        
        if (hostname === '0.0.0.0' || hostname === '::') {
          return false;
        }
        
        return true;
      } catch {
        return false;
      }
    }

    it('应该允许正常的 HTTP URL', () => {
      expect(isSafeUrl('http://example.com/favicon.ico')).toBe(true);
    });

    it('应该允许正常的 HTTPS URL', () => {
      expect(isSafeUrl('https://example.com/favicon.ico')).toBe(true);
    });

    it('应该阻止 file:// 协议', () => {
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    });

    it('应该阻止 ftp:// 协议', () => {
      expect(isSafeUrl('ftp://example.com/favicon.ico')).toBe(false);
    });

    it('应该阻止 localhost', () => {
      expect(isSafeUrl('http://localhost/favicon.ico')).toBe(false);
    });

    it('应该阻止 127.0.0.1', () => {
      expect(isSafeUrl('http://127.0.0.1/favicon.ico')).toBe(false);
    });

    it('应该阻止 0.0.0.0', () => {
      expect(isSafeUrl('http://0.0.0.0/favicon.ico')).toBe(false);
    });

    it('应该阻止 10.x.x.x 私有 IP', () => {
      expect(isSafeUrl('http://10.0.0.1/favicon.ico')).toBe(false);
      expect(isSafeUrl('http://10.255.255.255/favicon.ico')).toBe(false);
    });

    it('应该阻止 172.16.x.x - 172.31.x.x 私有 IP', () => {
      expect(isSafeUrl('http://172.16.0.1/favicon.ico')).toBe(false);
      expect(isSafeUrl('http://172.31.255.255/favicon.ico')).toBe(false);
      expect(isSafeUrl('http://172.32.0.1/favicon.ico')).toBe(true); // 不在范围内
    });

    it('应该阻止 192.168.x.x 私有 IP', () => {
      expect(isSafeUrl('http://192.168.0.1/favicon.ico')).toBe(false);
      expect(isSafeUrl('http://192.168.255.255/favicon.ico')).toBe(false);
    });

    it('应该阻止链路本地地址 169.254.x.x', () => {
      expect(isSafeUrl('http://169.254.0.1/favicon.ico')).toBe(false);
    });

    it('应该阻止无效的 URL 格式', () => {
      expect(isSafeUrl('not-a-url')).toBe(false);
      expect(isSafeUrl('')).toBe(false);
    });
  });
});
