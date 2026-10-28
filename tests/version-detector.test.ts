import { describe, it, expect } from 'vitest';
import { 
  detectVersion, 
  normalizeVersion, 
  isVersionInRange, 
  compareVersions,
  getVersionInfo,
  type DetectedVersion,
} from '../src/core/version-detector';
import type { TechnologyRule, CollectedPageData, ResponseHeaders } from '../src/core/types';

function createMockPageData(overrides: Partial<CollectedPageData> = {}): CollectedPageData {
  return {
    url: 'https://example.com',
    hostname: 'example.com',
    html: '<html><head><meta name="generator" content="WordPress 6.4.2"></head><body></body></html>',
    meta: [{ name: 'generator', content: 'WordPress 6.4.2' }],
    scriptSrc: ['/wp-includes/js/jquery.min.js?ver=3.7.1'],
    scripts: ["var wpVersion = '6.4.2';"],
    cssClasses: [],
    jsGlobals: { wpVersion: '6.4.2', jQuery: '3.7.1' },
    cookies: { 'wordpress_logged_in': 'test' },
    faviconUrl: '/favicon.ico',
    ...overrides,
  };
}

function createMockHeaders(overrides: Record<string, string> = {}): ResponseHeaders {
  return {
    'x-powered-by': 'PHP/8.2.0',
    'server': 'nginx/1.24.0',
    'x-generator': 'WordPress 6.4.2',
    ...overrides,
  };
}

describe('版本检测引擎测试', () => {
  
  describe('detectVersion', () => {
    it('应该从 meta 标签检测版本', () => {
      const rule: TechnologyRule = {
        name: 'WordPress',
        website: 'https://wordpress.org',
        cats: [1],
        meta: { generator: 'WordPress' },
        versionDetection: [
          { source: 'meta', pattern: 'WordPress\\s+(\\d+[\\d.]*)' },
        ],
      };

      const pageData = createMockPageData({
        meta: [{ name: 'generator', content: 'WordPress 6.4.2' }],
      });

      const versions = detectVersion(rule, pageData, createMockHeaders());
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBe('6.4.2');
      expect(versions[0].source).toBe('meta');
    });

    it('应该从 header 检测版本', () => {
      const rule: TechnologyRule = {
        name: 'Nginx',
        website: 'https://nginx.org',
        cats: [2],
        headers: { server: 'nginx' },
        versionDetection: [
          { source: 'header', pattern: 'nginx[/-](\\d+[\\d.]*)' },
        ],
      };

      const pageData = createMockPageData();
      const headers = createMockHeaders({ server: 'nginx/1.24.0' });

      const versions = detectVersion(rule, pageData, headers);
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBe('1.24.0');
    });

    it('应该从 JS 全局变量检测版本', () => {
      const rule: TechnologyRule = {
        name: 'WordPress',
        website: 'https://wordpress.org',
        cats: [1],
        js: { wpVersion: '' },
        versionDetection: [
          { source: 'js', pattern: 'wpVersion' },
        ],
      };

      const pageData = createMockPageData({
        jsGlobals: { wpVersion: '6.4.2' },
      });

      const versions = detectVersion(rule, pageData, createMockHeaders());
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBe('6.4.2');
    });

    it('应该从 script src 检测版本', () => {
      const rule: TechnologyRule = {
        name: 'jQuery',
        website: 'https://jquery.com',
        cats: [3],
        scriptSrc: ['jquery'],
        versionDetection: [
          { source: 'script', pattern: '[?&]v(?:er)?=(\\d+[\\d.]*)' },
        ],
      };

      const pageData = createMockPageData({
        scriptSrc: ['/js/jquery.min.js?ver=3.7.1'],
      });

      const versions = detectVersion(rule, pageData, createMockHeaders());
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBe('3.7.1');
    });

    it('应该从 cookie 检测版本', () => {
      const rule: TechnologyRule = {
        name: 'Django',
        website: 'https://djangoproject.com',
        cats: [4],
        cookies: { django_version: '' },
        versionDetection: [
          { source: 'cookie', pattern: 'django' },
        ],
      };

      const pageData = createMockPageData({
        cookies: { django_version: '4.2.0' },
      });

      const versions = detectVersion(rule, pageData, createMockHeaders());
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].version).toBe('4.2.0');
    });

    it('应该应用版本范围规则调整置信度', () => {
      const rule: TechnologyRule = {
        name: 'WordPress',
        website: 'https://wordpress.org',
        cats: [1],
        meta: { generator: 'WordPress' },
        versionDetection: [
          { source: 'meta', pattern: 'WordPress\\s+(\\d+[\\d.]*)' },
        ],
        versionRanges: [
          { range: '>= 6.0, < 7.0', confidence: 90, note: '稳定版' },
          { range: '>= 7.0', confidence: 95, note: '最新版' },
        ],
      };

      const pageData = createMockPageData({
        meta: [{ name: 'generator', content: 'WordPress 6.4.2' }],
      });

      const versions = detectVersion(rule, pageData, createMockHeaders());
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].confidence).toBe(90);
      expect(versions[0].note).toContain('稳定版');
    });

    it('应该处理无版本检测规则的情况', () => {
      const rule: TechnologyRule = {
        name: 'BasicTech',
        website: 'https://example.com',
        cats: [1],
        headers: { server: 'basic' },
      };

      const versions = detectVersion(rule, createMockPageData(), createMockHeaders());
      expect(versions.length).toBe(0);
    });
  });

  describe('normalizeVersion', () => {
    it('应该清理版本前缀', () => {
      expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
      expect(normalizeVersion('V2.0')).toBe('2.0');
    });

    it('应该处理版本关键字', () => {
      expect(normalizeVersion('version 1.2.3')).toBe('1.2.3');
      expect(normalizeVersion('Ver 2.0')).toBe('2.0');
      expect(normalizeVersion('Release 5.6.7')).toBe('5.6.7');
    });

    it('应该处理 transform 参数', () => {
      expect(normalizeVersion('1.2.3', 'semver')).toBe('1.2.3');
      expect(normalizeVersion('1.2', 'semver')).toBe('1.2.0');
      expect(normalizeVersion('1', 'semver')).toBe('1.0.0');
      
      expect(normalizeVersion('2024-01-01', 'date')).toBe('2024-01-01');
      expect(normalizeVersion('3.14', 'float')).toBe('3.14');
      expect(normalizeVersion('123abc', 'integer')).toBe('123');
    });

    it('应该返回 null 对于无效版本', () => {
      expect(normalizeVersion('')).toBeNull();
      expect(normalizeVersion('abc')).toBeNull();
    });
  });

  describe('isVersionInRange', () => {
    it('应该处理精确匹配', () => {
      expect(isVersionInRange('6.4.2', '6.4.2')).toBe(true);
      expect(isVersionInRange('6.4.2', '6.4.1')).toBe(false);
    });

    it('应该处理 >= 条件', () => {
      expect(isVersionInRange('6.4.2', '>= 6.0')).toBe(true);
      expect(isVersionInRange('5.9.0', '>= 6.0')).toBe(false);
    });

    it('应该处理 <= 条件', () => {
      expect(isVersionInRange('5.9.0', '<= 6.0')).toBe(true);
      expect(isVersionInRange('6.4.2', '<= 6.0')).toBe(false);
    });

    it('应该处理多个条件组合', () => {
      expect(isVersionInRange('6.4.2', '>= 6.0, < 7.0')).toBe(true);
      expect(isVersionInRange('7.0.0', '>= 6.0, < 7.0')).toBe(false);
      expect(isVersionInRange('5.0.0', '>= 6.0, < 7.0')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('应该比较简单版本', () => {
      expect(compareVersions('6.4.2', '6.4.1', '>')).toBe(true);
      expect(compareVersions('6.4.2', '6.4.2', '==')).toBe(true);
      expect(compareVersions('6.4.2', '6.4.2', '!=')).toBe(false);
    });

    it('应该比较不同长度的版本', () => {
      expect(compareVersions('6.4', '6.4.0', '==')).toBe(true);
      expect(compareVersions('6.4.1', '6.4', '>')).toBe(true);
      expect(compareVersions('6.4', '6.4.5', '<')).toBe(true);
    });

    it('应该比较不同主版本', () => {
      expect(compareVersions('7.0.0', '6.9.9', '>')).toBe(true);
      expect(compareVersions('5.0.0', '6.0.0', '<')).toBe(true);
    });
  });

  describe('getVersionInfo', () => {
    it('应该返回版本检测信息', () => {
      const rule: TechnologyRule = {
        name: 'Test',
        website: 'https://test.com',
        cats: [1],
        versionDetection: [
          { source: 'meta', pattern: 'ver=(\\d+)' },
        ],
        versionRanges: [
          { range: '>= 1.0', confidence: 80 },
        ],
        knownVersions: ['1.0', '2.0'],
      };

      const info = getVersionInfo(rule);
      expect(info.hasVersionDetection).toBe(true);
      expect(info.detectionSources).toEqual(['meta']);
      expect(info.knownVersionCount).toBe(2);
      expect(info.rangeCount).toBe(1);
    });

    it('应该处理无版本信息的规则', () => {
      const rule: TechnologyRule = {
        name: 'Simple',
        website: 'https://simple.com',
        cats: [1],
      };

      const info = getVersionInfo(rule);
      expect(info.hasVersionDetection).toBe(false);
      expect(info.detectionSources).toEqual([]);
      expect(info.knownVersionCount).toBe(0);
      expect(info.rangeCount).toBe(0);
    });
  });
});
