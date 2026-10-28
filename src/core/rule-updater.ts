// ============================================================
// WebFinger - Remote Rule Updater
// 远程规则更新机制：版本控制、增量更新、缓存管理
// ============================================================

import type {
  TechnologyRule,
  TechnologyRules,
} from './types';
import {
  FaviconHashEntry,
  addFaviconHashes,
  getFaviconDbStats,
} from './fingerprint/favicon-hash-db';

/** 远程规则源配置 */
export interface RuleSource {
  /** 源名称 */
  name: string;
  /** 远程 URL */
  url: string;
  /** 源类型 */
  type: 'full' | 'incremental';
  /** 最后更新时间 */
  lastUpdated?: number;
  /** 更新间隔（毫秒） */
  updateInterval: number;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

/** 规则包元数据 */
export interface RulePackage {
  /** 包版本 */
  version: string;
  /** 最低客户端版本 */
  minClientVersion: string;
  /** 更新时间 */
  updatedAt: number;
  /** 规则变更摘要 */
  changelog: RuleChangelog[];
  /** 规则数据 */
  rules: TechnologyRules;
  /** Favicon hash 数据 */
  favicons: FaviconHashEntry[];
  /** 签名（用于验证） */
  signature?: string;
}

/** 变更日志 */
export interface RuleChangelog {
  /** 变更类型 */
  type: 'add' | 'update' | 'remove';
  /** 受影响的技术名 */
  tech: string;
  /** 变更描述 */
  description?: string;
}

/** 更新状态 */
export interface UpdateStatus {
  lastUpdateAttempt: number;
  lastSuccessfulUpdate: number;
  nextScheduledUpdate: number;
  updateCount: number;
  failureCount: number;
  lastError?: string;
  currentVersion?: string;
}

/** 更新结果 */
export interface UpdateResult {
  success: boolean;
  rulesAdded: number;
  rulesUpdated: number;
  rulesRemoved: number;
  faviconsAdded: number;
  newVersion?: string;
  message?: string;
}

/** 本地缓存的规则数据 */
interface CachedRules {
  version: string;
  updatedAt: number;
  rules: TechnologyRules;
  favicons: FaviconHashEntry[];
}

const DEFAULT_SOURCES: RuleSource[] = [
  {
    name: 'webfinger-official',
    url: 'https://rules.webfinger.io/v1/rules.json',
    type: 'full',
    updateInterval: 24 * 60 * 60 * 1000, // 24 小时
    enabled: true,
    priority: 10,
  },
  {
    name: 'webfinger-community',
    url: 'https://rules.webfinger.io/v1/community.json',
    type: 'incremental',
    updateInterval: 12 * 60 * 60 * 1000, // 12 小时
    enabled: true,
    priority: 5,
  },
];

/**
 * 远程规则更新器
 */
export class RuleUpdater {
  private sources: RuleSource[];
  private status: UpdateStatus;
  private cachedRules: CachedRules | null = null;
  
  // 回调
  public onUpdate?: (result: UpdateResult) => void;
  public onError?: (error: Error, source: RuleSource) => void;
  public onProgress?: (progress: number, source: RuleSource) => void;

  constructor(sources: RuleSource[] = DEFAULT_SOURCES) {
    this.sources = [...sources];
    this.status = {
      lastUpdateAttempt: 0,
      lastSuccessfulUpdate: 0,
      nextScheduledUpdate: Date.now() + 24 * 60 * 60 * 1000,
      updateCount: 0,
      failureCount: 0,
    };
  }

  /**
   * 执行一次完整的规则更新
   */
  async update(force: boolean = false): Promise<UpdateResult> {
    // 检查是否需要更新
    if (!force && !this.shouldUpdate()) {
      return {
        success: true,
        rulesAdded: 0,
        rulesUpdated: 0,
        rulesRemoved: 0,
        faviconsAdded: 0,
        message: 'No update needed',
      };
    }

    this.status.lastUpdateAttempt = Date.now();

    const result: UpdateResult = {
      success: true,
      rulesAdded: 0,
      rulesUpdated: 0,
      rulesRemoved: 0,
      faviconsAdded: 0,
    };

    // 按优先级排序，高优先级先更新
    const sortedSources = [...this.sources]
      .filter((s) => s.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const source of sortedSources) {
      try {
        this.onProgress?.(0.5, source);
        const pkg = await this.fetchPackage(source);
        
        // 验证包
        if (!this.validatePackage(pkg)) {
          result.success = false;
          result.message = `Invalid package from ${source.name}`;
          this.status.failureCount++;
          this.onError?.(new Error('Invalid package'), source);
          continue;
        }

        this.onProgress?.(1, source);

        // 应用规则
        const rulesResult = this.applyRules(pkg.rules, source);
        result.rulesAdded += rulesResult.added;
        result.rulesUpdated += rulesResult.updated;
        result.rulesRemoved += rulesResult.removed;

        // 应用 favicon
        if (pkg.favicons && pkg.favicons.length > 0) {
          const added = addFaviconHashes(pkg.favicons);
          result.faviconsAdded += added;
        }

        // 更新元数据
        source.lastUpdated = Date.now();
        result.newVersion = pkg.version;

        // 更新缓存
        this.cachedRules = {
          version: pkg.version,
          updatedAt: Date.now(),
          rules: pkg.rules,
          favicons: pkg.favicons,
        };

      } catch (err) {
        this.status.failureCount++;
        const error = err instanceof Error ? err : new Error(String(err));
        this.onError?.(error, source);
        
        if (this.status.failureCount >= 3) {
          // 连续失败 3 次，暂时停止更新
          this.status.nextScheduledUpdate = Date.now() + 48 * 60 * 60 * 1000;
        }
      }
    }

    // 更新状态
    this.status.updateCount++;
    if (result.success) {
      this.status.lastSuccessfulUpdate = Date.now();
      this.status.failureCount = 0;
      this.status.currentVersion = result.newVersion;
      this.status.nextScheduledUpdate = Date.now() + 24 * 60 * 60 * 1000;
    } else {
      this.status.lastError = result.message;
    }

    this.onUpdate?.(result);
    return result;
  }

  /**
   * 检查是否需要更新
   */
  private shouldUpdate(): boolean {
    return Date.now() >= this.status.nextScheduledUpdate;
  }

  /**
   * 获取远程规则包
   */
  private async fetchPackage(source: RuleSource): Promise<RulePackage> {
    const response = await fetch(source.url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WebFinger-Plugin/1.0',
        ...(this.status.currentVersion ? {
          'If-None-Match': this.status.currentVersion,
        } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 304) {
      // 没有更新
      return {
        version: this.status.currentVersion || '0.0.0',
        minClientVersion: '0.0.0',
        updatedAt: Date.now(),
        changelog: [],
        rules: {},
        favicons: [],
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as RulePackage;
    return data;
  }

  /**
   * 验证规则包
   */
  private validatePackage(pkg: RulePackage): boolean {
    if (!pkg || typeof pkg !== 'object') return false;
    if (!pkg.version || !pkg.rules) return false;
    if (typeof pkg.version !== 'string') return false;
    if (typeof pkg.rules !== 'object') return false;
    
    // 验证每个规则的基本结构
    for (const [name, rule] of Object.entries(pkg.rules)) {
      if (!rule || typeof rule !== 'object') return false;
      if (!rule.name || !rule.website) return false;
    }

    return true;
  }

  /**
   * 应用规则到系统
   */
  private applyRules(
    newRules: TechnologyRules,
    source: RuleSource
  ): { added: number; updated: number; removed: number } {
    let added = 0;
    let updated = 0;
    let removed = 0;

    // 获取当前已加载的规则
    const currentRules = this.getCurrentRules();
    const currentNames = new Set(Object.keys(currentRules));
    const newNames = new Set(Object.keys(newRules));

    // 检测新增和更新
    for (const [name, rule] of Object.entries(newRules)) {
      if (currentNames.has(name)) {
        const existing = currentRules[name];
        // 检查是否有实质变化
        if (JSON.stringify(existing) !== JSON.stringify(rule)) {
          updated++;
        }
      } else {
        added++;
      }
    }

    // 检测移除
    if (source.type === 'full') {
      for (const name of currentNames) {
        if (!newNames.has(name)) {
          removed++;
        }
      }
    }

    return { added, updated, removed };
  }

  /**
   * 获取当前加载的规则（可被覆盖）
   */
  private getCurrentRules(): TechnologyRules {
    // 默认返回空对象，实际由 RulesEngine 提供
    return {};
  }

  /**
   * 添加自定义规则源
   */
  addSource(source: RuleSource): void {
    // 避免重复
    const idx = this.sources.findIndex((s) => s.name === source.name);
    if (idx >= 0) {
      this.sources[idx] = source;
    } else {
      this.sources.push(source);
    }
  }

  /**
   * 移除规则源
   */
  removeSource(name: string): boolean {
    const idx = this.sources.findIndex((s) => s.name === name);
    if (idx >= 0) {
      this.sources.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * 启用/禁用规则源
   */
  setSourceEnabled(name: string, enabled: boolean): boolean {
    const source = this.sources.find((s) => s.name === name);
    if (source) {
      source.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * 获取规则源列表
   */
  getSources(): RuleSource[] {
    return [...this.sources];
  }

  /**
   * 获取更新状态
   */
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  /**
   * 获取本地缓存信息
   */
  getCacheInfo(): {
    hasCache: boolean;
    version?: string;
    ruleCount: number;
    faviconCount: number;
  } {
    const faviconStats = getFaviconDbStats();
    return {
      hasCache: !!this.cachedRules,
      version: this.cachedRules?.version,
      ruleCount: this.cachedRules ? Object.keys(this.cachedRules.rules).length : 0,
      faviconCount: faviconStats.total,
    };
  }

  /**
   * 重置更新状态（用于调试）
   */
  reset(): void {
    this.status = {
      lastUpdateAttempt: 0,
      lastSuccessfulUpdate: 0,
      nextScheduledUpdate: Date.now(),
      updateCount: 0,
      failureCount: 0,
    };
    this.cachedRules = null;
    this.sources = [];
  }

  /**
   * 获取内置的默认规则源
   */
  static getDefaultSources(): RuleSource[] {
    return DEFAULT_SOURCES.map((s) => ({ ...s }));
  }
}

/**
 * 规则包签名验证（简化版本）
 * 生产环境应使用 HMAC-SHA256 签名
 */
export function verifyPackageSignature(
  pkg: RulePackage,
  publicKey?: string
): boolean {
  if (!pkg.signature) return false;
  if (!publicKey) return true; // 没有公钥时跳过验证
  
  // 生产环境实现：
  // 1. 解析签名
  // 2. 计算数据摘要
  // 3. 使用公钥验证签名
  return true; // 简化实现
}

/**
 * 生成规则变更日志的 diff
 */
export function diffRulePackages(
  oldPkg: RulePackage | null,
  newPkg: RulePackage
): RuleChangelog[] {
  const changes: RuleChangelog[] = [];

  if (!oldPkg) {
    // 全量添加
    for (const name of Object.keys(newPkg.rules)) {
      changes.push({ type: 'add', tech: name });
    }
    return changes;
  }

  const oldNames = new Set(Object.keys(oldPkg.rules));
  const newNames = new Set(Object.keys(newPkg.rules));

  // 新增
  for (const name of newNames) {
    if (!oldNames.has(name)) {
      changes.push({ type: 'add', tech: name });
    }
  }

  // 移除
  for (const name of oldNames) {
    if (!newNames.has(name)) {
      changes.push({ type: 'remove', tech: name });
    }
  }

  // 更新
  for (const name of oldNames) {
    if (newNames.has(name)) {
      const oldRule = JSON.stringify(oldPkg.rules[name]);
      const newRule = JSON.stringify(newPkg.rules[name]);
      if (oldRule !== newRule) {
        changes.push({ type: 'update', tech: name });
      }
    }
  }

  return changes;
}
