import { describe, it, expect, beforeEach } from 'vitest';
import { 
  RuleUpdater, 
  diffRulePackages, 
  verifyPackageSignature,
  RulePackage,
  RuleSource,
} from '../src/core/rule-updater';
import type { TechnologyRule, TechnologyRules } from '../src/core/types';

function createMockRule(name: string): TechnologyRule {
  return {
    name,
    website: `https://${name.toLowerCase()}.com`,
    cats: [1],
    headers: { server: name.toLowerCase() },
  };
}

function createMockPackage(version: string, rules: TechnologyRules): RulePackage {
  return {
    version,
    minClientVersion: '1.0.0',
    updatedAt: Date.now(),
    changelog: [],
    rules,
    favicons: [],
  };
}

describe('规则更新机制测试', () => {
  let updater: RuleUpdater;

  beforeEach(() => {
    updater = new RuleUpdater([]);
  });

  describe('RuleUpdater', () => {
    it('应该初始化为空状态', () => {
      const status = updater.getStatus();
      expect(status.updateCount).toBe(0);
      expect(status.failureCount).toBe(0);
      expect(status.lastSuccessfulUpdate).toBe(0);
    });

    it('应该支持自定义规则源', () => {
      const source: RuleSource = {
        name: 'test-source',
        url: 'https://example.com/rules.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      };

      updater.addSource(source);
      const sources = updater.getSources();
      expect(sources.length).toBe(1);
      expect(sources[0].name).toBe('test-source');
    });

    it('应该支持添加多个源', () => {
      updater.addSource({
        name: 'source1',
        url: 'https://example.com/1.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      });
      updater.addSource({
        name: 'source2',
        url: 'https://example.com/2.json',
        type: 'incremental',
        updateInterval: 7200000,
        enabled: true,
        priority: 5,
      });

      expect(updater.getSources().length).toBe(2);
    });

    it('应该防止重复添加同名源', () => {
      updater.addSource({
        name: 'duplicate',
        url: 'https://example.com/1.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      });
      updater.addSource({
        name: 'duplicate',
        url: 'https://example.com/2.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 5,
      });

      expect(updater.getSources().length).toBe(1);
      // 应该使用新的配置
      expect(updater.getSources()[0].priority).toBe(5);
    });

    it('应该支持移除源', () => {
      updater.addSource({
        name: 'to-remove',
        url: 'https://example.com/rules.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      });

      const result = updater.removeSource('to-remove');
      expect(result).toBe(true);
      expect(updater.getSources().length).toBe(0);
    });

    it('应该支持启用/禁用源', () => {
      updater.addSource({
        name: 'toggle',
        url: 'https://example.com/rules.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      });

      updater.setSourceEnabled('toggle', false);
      expect(updater.getSources()[0].enabled).toBe(false);

      updater.setSourceEnabled('toggle', true);
      expect(updater.getSources()[0].enabled).toBe(true);
    });

    it('应该支持重置状态', () => {
      // 模拟一些状态
      updater.addSource({
        name: 'test',
        url: 'https://example.com/rules.json',
        type: 'full',
        updateInterval: 3600000,
        enabled: true,
        priority: 10,
      });

      updater.reset();
      const status = updater.getStatus();
      expect(status.updateCount).toBe(0);
      expect(status.failureCount).toBe(0);
      expect(updater.getSources().length).toBe(0);
    });

    it('应该有默认源', () => {
      const defaults = RuleUpdater.getDefaultSources();
      expect(defaults.length).toBeGreaterThan(0);
      expect(defaults[0].name).toBe('webfinger-official');
      expect(defaults[0].type).toBe('full');
      expect(defaults[0].enabled).toBe(true);
    });
  });

  describe('diffRulePackages', () => {
    it('应该检测新增规则', () => {
      const oldPkg = createMockPackage('1.0.0', {});
      const newPkg = createMockPackage('2.0.0', {
        WordPress: createMockRule('WordPress'),
      });

      const changes = diffRulePackages(oldPkg, newPkg);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('add');
      expect(changes[0].tech).toBe('WordPress');
    });

    it('应该检测移除规则', () => {
      const oldPkg = createMockPackage('1.0.0', {
        WordPress: createMockRule('WordPress'),
      });
      const newPkg = createMockPackage('2.0.0', {});

      const changes = diffRulePackages(oldPkg, newPkg);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('remove');
      expect(changes[0].tech).toBe('WordPress');
    });

    it('应该检测更新规则', () => {
      const oldPkg = createMockPackage('1.0.0', {
        WordPress: createMockRule('WordPress'),
      });
      const updatedRule = {
        ...createMockRule('WordPress'),
        versionDetection: [{ source: 'meta' as const, pattern: 'ver=(\\d+)' }],
      };
      const newPkg = createMockPackage('2.0.0', {
        WordPress: updatedRule,
      });

      const changes = diffRulePackages(oldPkg, newPkg);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('update');
      expect(changes[0].tech).toBe('WordPress');
    });

    it('应该处理混合变更', () => {
      const oldPkg = createMockPackage('1.0.0', {
        WordPress: createMockRule('WordPress'),
        Drupal: createMockRule('Drupal'),
      });
      const newPkg = createMockPackage('2.0.0', {
        WordPress: { ...createMockRule('WordPress'), description: 'Updated' },
        Joomla: createMockRule('Joomla'),
      });

      const changes = diffRulePackages(oldPkg, newPkg);
      const types = changes.map((c) => c.type);
      
      expect(types).toContain('update');
      expect(types).toContain('add');
      expect(types).toContain('remove');
      expect(changes.find((c) => c.type === 'remove')?.tech).toBe('Drupal');
    });

    it('应该处理空的旧包', () => {
      const newPkg = createMockPackage('1.0.0', {
        WordPress: createMockRule('WordPress'),
      });

      const changes = diffRulePackages(null, newPkg);
      expect(changes.length).toBe(1);
      expect(changes[0].type).toBe('add');
    });
  });

  describe('verifyPackageSignature', () => {
    it('应该验证无签名的包', () => {
      const pkg = createMockPackage('1.0.0', {});
      const result = verifyPackageSignature(pkg);
      expect(result).toBe(false);
    });

    it('应该在无公钥时跳过验证', () => {
      const pkg = createMockPackage('1.0.0', {});
      pkg.signature = 'mock-signature';
      const result = verifyPackageSignature(pkg);
      expect(result).toBe(true); // 无公钥时返回 true
    });
  });

  describe('缓存信息', () => {
    it('应该返回初始空状态', () => {
      const info = updater.getCacheInfo();
      expect(info.hasCache).toBe(false);
      expect(info.ruleCount).toBe(0);
    });
  });
});
