import { describe, it, expect, beforeEach } from 'vitest';
import { RulesEngine } from '../src/core/rules-engine';
import type { 
  TechnologyRules, 
  CollectedPageData, 
  ResponseHeaders,
  DetectedTechnology 
} from '../src/core/types';

// 准备测试规则
const testRules: TechnologyRules = {
  TestFramework: {
    name: 'TestFramework',
    description: '测试框架',
    website: 'https://test.example.com',
    cats: [12],
    priority: 1,
    js: { 'TestFramework': '' },
    scriptSrc: ['test-framework\\.min\\.js'],
    html: ['data-test-framework'],
    dom: {
      rootElement: { exists: ['#test-root', '[data-test-framework]'] },
      versionAttr: { attributes: { 'data-version': '[\\d.]+' } }
    }
  },
  TestCMS: {
    name: 'TestCMS',
    description: '测试 CMS',
    website: 'https://test-cms.example.com',
    cats: [1],
    priority: 2,
    headers: { 'X-Powered-By': 'TestCMS' },
    cookies: { 'test_cms_session': '' },
    meta: { 'generator': 'TestCMS' },
    dom: {
      bodyClass: { className: ['test-cms-body'] }
    }
  }
};

describe('规则引擎 - 新增功能测试', () => {
  
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
    engine.loadRules(testRules);
  });

  describe('DOM 选择器匹配', () => {
    it('应该匹配存在性选择器', () => {
      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '<div id="test-root">Test</div>',
        meta: [],
        scriptSrc: [],
        scripts: [],
        cssClasses: ['test-root'],
        jsGlobals: {},
        cookies: {},
        faviconUrl: null,
        domNodes: [
          {
            selector: 'div#test-root',
            tag: 'div',
            className: '',
            id: 'test-root',
            text: 'Test',
            keyAttributes: {}
          }
        ]
      };
      const headers: ResponseHeaders = {};

      const results = engine.detect(pageData, headers);
      const testFramework = results.find(r => r.name === 'TestFramework');
      
      expect(testFramework).toBeDefined();
      expect(testFramework?.matchedMethods).toContain('dom');
    });

    it('应该匹配属性模式', () => {
      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '<div data-version="2.0.0">Test</div>',
        meta: [],
        scriptSrc: [],
        scripts: [],
        cssClasses: [],
        jsGlobals: {},
        cookies: {},
        faviconUrl: null,
        domNodes: [
          {
            selector: 'div',
            tag: 'div',
            className: '',
            id: '',
            text: 'Test',
            keyAttributes: { 'data-version': '2.0.0' }
          }
        ]
      };
      const headers: ResponseHeaders = {};

      const results = engine.detect(pageData, headers);
      const testFramework = results.find(r => r.name === 'TestFramework');
      
      expect(testFramework).toBeDefined();
    });

    it('应该匹配 class 选择器', () => {
      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '<body class="test-cms-body"><h1>Test</h1></body>',
        meta: [],
        scriptSrc: [],
        scripts: [],
        cssClasses: ['test-cms-body'],
        jsGlobals: {},
        cookies: {},
        faviconUrl: null,
        domNodes: [
          {
            selector: 'body',
            tag: 'body',
            className: 'test-cms-body',
            id: '',
            text: 'Test',
            keyAttributes: {}
          }
        ]
      };
      const headers: ResponseHeaders = {};

      const results = engine.detect(pageData, headers);
      const testCMS = results.find(r => r.name === 'TestCMS');
      
      expect(testCMS).toBeDefined();
      expect(testCMS?.matchedMethods).toContain('dom');
    });
  });

  describe('加权置信度计算', () => {
    it('多种方法匹配应该获得更高置信度', () => {
      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '<script src="test-framework.min.js" data-test-framework></script>',
        meta: [],
        scriptSrc: ['https://example.com/test-framework.min.js'],
        scripts: [],
        cssClasses: [],
        jsGlobals: { 'TestFramework': '2.0.0' },
        cookies: {},
        faviconUrl: null,
        domNodes: [
          {
            selector: 'script',
            tag: 'script',
            className: '',
            id: '',
            text: '',
            keyAttributes: {}
          }
        ]
      };
      const headers: ResponseHeaders = {};

      const results = engine.detect(pageData, headers);
      const testFramework = results.find(r => r.name === 'TestFramework');
      
      expect(testFramework).toBeDefined();
      // 多种方法匹配时置信度应该较高
      expect(testFramework?.confidence).toBeGreaterThan(50);
    });

    it('单一方法匹配应该获得较低置信度', () => {
      const simpleRules: TechnologyRules = {
        SimpleTech: {
          name: 'SimpleTech',
          description: '简单技术',
          website: 'https://simple.example.com',
          cats: [12],
          priority: 1,
          js: { 'SimpleTech': '' }
        }
      };
      
      const simpleEngine = new RulesEngine();
      simpleEngine.loadRules(simpleRules);

      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '',
        meta: [],
        scriptSrc: [],
        scripts: [],
        cssClasses: [],
        jsGlobals: { 'SimpleTech': '1.0' },
        cookies: {},
        faviconUrl: null
      };
      const headers: ResponseHeaders = {};

      const results = simpleEngine.detect(pageData, headers);
      const simpleTech = results.find(r => r.name === 'SimpleTech');
      
      expect(simpleTech).toBeDefined();
      // 单一方法匹配时置信度应该较低（js 权重80，单一匹配降分后 <= 80）
      expect(simpleTech?.confidence).toBeLessThanOrEqual(80);
    });
  });

  describe('多种检测方法组合', () => {
    it('应该结合 headers、meta、dom 多种方法检测', () => {
      const pageData: CollectedPageData = {
        url: 'https://example.com',
        hostname: 'example.com',
        html: '<body class="test-cms-body"></body>',
        meta: [{ name: 'generator', content: 'TestCMS', property: undefined }],
        scriptSrc: [],
        scripts: [],
        cssClasses: ['test-cms-body'],
        jsGlobals: {},
        cookies: { 'test_cms_session': 'abc123' },
        faviconUrl: null,
        domNodes: [
          {
            selector: 'body',
            tag: 'body',
            className: 'test-cms-body',
            id: '',
            text: '',
            keyAttributes: {}
          }
        ]
      };
      const headers: ResponseHeaders = {
        'x-powered-by': 'TestCMS'
      };

      const results = engine.detect(pageData, headers);
      const testCMS = results.find(r => r.name === 'TestCMS');
      
      expect(testCMS).toBeDefined();
      expect(testCMS?.matchedMethods.length).toBeGreaterThanOrEqual(3);
    });
  });
});
