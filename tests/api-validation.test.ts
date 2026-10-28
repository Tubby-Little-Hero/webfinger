import { describe, it, expect } from 'vitest';

// 测试 API 响应验证逻辑

describe('API 响应结构验证测试', () => {
  
  // NVD 响应验证逻辑（从 nvd-client.ts 复制）
  function validateNVDResponse(data: unknown): data is Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    const response = data as Record<string, unknown>;
    
    if (!Array.isArray(response.vulnerabilities)) {
      return false;
    }
    
    return true;
  }

  // OSV 响应验证逻辑（从 osv-client.ts 复制）
  function validateOSVResponse(vulns: unknown): vulns is Array<Record<string, unknown>> {
    if (!Array.isArray(vulns)) {
      return false;
    }
    
    for (const item of vulns) {
      if (!item || typeof item !== 'object') {
        return false;
      }
      if (typeof (item as Record<string, unknown>).id !== 'string') {
        return false;
      }
    }
    
    return true;
  }

  describe('NVD 响应验证', () => {
    it('应该接受有效的响应结构', () => {
      const validResponse = {
        vulnerabilities: [
          { cve: { id: 'CVE-2024-1234' } },
        ],
      };
      expect(validateNVDResponse(validResponse)).toBe(true);
    });

    it('应该拒绝 null 响应', () => {
      expect(validateNVDResponse(null)).toBe(false);
    });

    it('应该拒绝 undefined 响应', () => {
      expect(validateNVDResponse(undefined)).toBe(false);
    });

    it('应该拒绝非对象响应', () => {
      expect(validateNVDResponse('string')).toBe(false);
      expect(validateNVDResponse(123)).toBe(false);
    });

    it('应该拒绝缺少 vulnerabilities 数组的响应', () => {
      const invalidResponse = { status: 'ok' };
      expect(validateNVDResponse(invalidResponse)).toBe(false);
    });

    it('应该接受空的 vulnerabilities 数组', () => {
      const emptyResponse = { vulnerabilities: [] };
      expect(validateNVDResponse(emptyResponse)).toBe(true);
    });
  });

  describe('OSV 响应验证', () => {
    it('应该接受有效的响应数组', () => {
      const validResponse = [
        { id: 'GHSA-xxxx-yyyy-zzzz' },
        { id: 'CVE-2024-1234' },
      ];
      expect(validateOSVResponse(validResponse)).toBe(true);
    });

    it('应该拒绝 null 响应', () => {
      expect(validateOSVResponse(null)).toBe(false);
    });

    it('应该拒绝非数组响应', () => {
      expect(validateOSVResponse({})).toBe(false);
      expect(validateOSVResponse('string')).toBe(false);
    });

    it('应该拒绝缺少 id 字段的元素', () => {
      const invalidResponse = [
        { id: 'valid-id' },
        { summary: 'no id' },  // 缺少 id
      ];
      expect(validateOSVResponse(invalidResponse)).toBe(false);
    });

    it('应该拒绝非对象元素', () => {
      const invalidResponse = [
        { id: 'valid-id' },
        'not-an-object',
      ];
      expect(validateOSVResponse(invalidResponse)).toBe(false);
    });

    it('应该接受空数组', () => {
      expect(validateOSVResponse([])).toBe(true);
    });
  });
});
