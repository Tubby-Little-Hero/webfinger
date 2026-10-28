import { describe, it, expect } from 'vitest';
import { computeFaviconHash, lookupFaviconHash, FAVICON_HASH_DATABASE } from '../src/core/fingerprint/favicon-hash-db';

describe('Favicon Hash Database 测试', () => {
  
  describe('computeFaviconHash', () => {
    it('应该计算相同数据的相同 hash', () => {
      const data = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
      const hash1 = computeFaviconHash(data);
      const hash2 = computeFaviconHash(data);
      expect(hash1).toBe(hash2);
    });

    it('应该为不同数据计算不同的 hash', () => {
      const data1 = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const data2 = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      const hash1 = computeFaviconHash(data1);
      const hash2 = computeFaviconHash(data2);
      expect(hash1).not.toBe(hash2);
    });

    it('应该处理空数据', () => {
      const data = new Uint8Array([]);
      const hash = computeFaviconHash(data);
      expect(typeof hash).toBe('number');
    });

    it('应该处理 1 字节数据', () => {
      const data = new Uint8Array([0x42]);
      const hash = computeFaviconHash(data);
      expect(typeof hash).toBe('number');
    });
  });

  describe('lookupFaviconHash', () => {
    it('应该从数据库中查找 hash', () => {
      // 测试一个已知的 hash
      const result = lookupFaviconHash(653481582);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].techName).toBe('Cloudflare');
    });

    it('应该返回空数组当 hash 不在数据库中', () => {
      const result = lookupFaviconHash(999999999);
      expect(result.length).toBe(0);
    });

    it('应该返回正确的置信度', () => {
      const result = lookupFaviconHash(653481582);
      expect(result[0].confidence).toBe(95);
    });
  });

  describe('FAVICON_HASH_DATABASE', () => {
    it('数据库应该有条目', () => {
      expect(FAVICON_HASH_DATABASE.length).toBeGreaterThan(0);
    });

    it('所有条目应该有必要的字段', () => {
      for (const entry of FAVICON_HASH_DATABASE) {
        expect(entry.hash).toBeDefined();
        expect(entry.techName).toBeDefined();
        expect(entry.confidence).toBeGreaterThan(0);
        expect(entry.confidence).toBeLessThanOrEqual(100);
      }
    });

    it('数据库应该包含多种技术类别', () => {
      const categories = new Set<string>();
      for (const entry of FAVICON_HASH_DATABASE) {
        if (entry.category) {
          categories.add(entry.category);
        }
      }
      expect(categories.size).toBeGreaterThanOrEqual(3);
    });
  });
});
