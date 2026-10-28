// ============================================================
// WebFinger - Analyzer (分析协调器)
// 协调数据采集、规则匹配、漏洞查询、AI分析的全流程
// ============================================================

import { RulesEngine } from './rules-engine';
import type {
  CollectedPageData,
  ResponseHeaders,
  DetectionResult,
  SecurityHeader,
  DetectedTechnology,
} from './types';

// 安全响应头检查列表
interface SecurityHeaderConfig {
  name: string;
  description: string;
  // 可选：验证函数，返回 'good' | 'warning' | 'bad' | 'missing'
  validate?: (value: string) => { severity: 'good' | 'warning' | 'bad'; message?: string };
}

const SECURITY_HEADERS: SecurityHeaderConfig[] = [
  {
    name: 'content-security-policy',
    description: '防止XSS和代码注入攻击',
    validate: (value) => {
      // 检查是否存在过于宽松的 CSP
      if (value.includes("'unsafe-inline'") && value.includes("'unsafe-eval'")) {
        return { severity: 'warning', message: '包含 unsafe-inline 和 unsafe-eval，防护较弱' };
      }
      if (value === "*" || value.includes("'*'")) {
        return { severity: 'bad', message: 'CSP 策略过于宽松' };
      }
      return { severity: 'good' };
    },
  },
  {
    name: 'strict-transport-security',
    description: '强制HTTPS连接(HSTS)',
    validate: (value) => {
      // 检查 HSTS max-age 值是否足够长（至少 1 年）
      const match = value.match(/max-age=(\d+)/);
      if (match) {
        const maxAge = parseInt(match[1], 10);
        if (maxAge >= 31536000) {
          return { severity: 'good' };
        } else if (maxAge >= 2592000) {
          return { severity: 'warning', message: 'max-age 较短，建议至少 1 年' };
        } else {
          return { severity: 'bad', message: 'max-age 过短，建议至少 1 年' };
        }
      }
      return { severity: 'warning', message: '未找到 max-age 配置' };
    },
  },
  {
    name: 'x-frame-options',
    description: '防止点击劫持攻击',
    validate: (value) => {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'deny' || lowerValue === 'sameorigin') {
        return { severity: 'good' };
      }
      return { severity: 'warning', message: '非标准配置，建议使用 DENY 或 SAMEORIGIN' };
    },
  },
  {
    name: 'x-content-type-options',
    description: '防止MIME类型嗅探',
    validate: (value) => {
      if (value.toLowerCase() === 'nosniff') {
        return { severity: 'good' };
      }
      return { severity: 'warning', message: '建议设置为 nosniff' };
    },
  },
  {
    name: 'x-xss-protection',
    description: '浏览器XSS过滤器',
    validate: (value) => {
      if (value === '0' || value === '1; mode=block') {
        return { severity: 'good' };
      }
      return { severity: 'warning', message: '建议设置为 1; mode=block' };
    },
  },
  {
    name: 'referrer-policy',
    description: '控制Referrer信息泄露',
    validate: (value) => {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'strict-origin-when-cross-origin' || 
          lowerValue === 'no-referrer' ||
          lowerValue === 'strict-origin') {
        return { severity: 'good' };
      }
      if (lowerValue === 'unsafe-url') {
        return { severity: 'bad', message: '会泄露完整 URL，存在信息泄露风险' };
      }
      return { severity: 'warning', message: '建议使用 strict-origin-when-cross-origin' };
    },
  },
  {
    name: 'permissions-policy',
    description: '限制浏览器API使用权限',
  },
  {
    name: 'cross-origin-opener-policy',
    description: '跨域隔离策略(COOP)',
    validate: (value) => {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'same-origin' || lowerValue === 'same-origin-allow-popups') {
        return { severity: 'good' };
      }
      if (lowerValue === 'unsafe-none') {
        return { severity: 'warning', message: '无隔离，存在风险' };
      }
      return { severity: 'good' };
    },
  },
  {
    name: 'cross-origin-embedder-policy',
    description: '跨域嵌入策略(COEP)',
    validate: (value) => {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'require-corp') {
        return { severity: 'good' };
      }
      if (lowerValue === 'unsafe-none') {
        return { severity: 'warning', message: '允许所有跨域嵌入' };
      }
      return { severity: 'good' };
    },
  },
  {
    name: 'cross-origin-resource-policy',
    description: '跨域资源策略(CORP)',
  },
];

export class Analyzer {
  private engine: RulesEngine;

  constructor() {
    this.engine = new RulesEngine();
  }

  /** 加载规则集 */
  loadRules(rules: import('./types').TechnologyRules): void {
    this.engine.loadRules(rules);
  }

  /** 获取规则引擎实例 */
  getEngine(): RulesEngine {
    return this.engine;
  }

  /** 分析安全响应头（包含配置值验证） */
  analyzeSecurityHeaders(responseHeaders: ResponseHeaders): SecurityHeader[] {
    const lowerHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(responseHeaders)) {
      lowerHeaders[key.toLowerCase()] = value;
    }

    return SECURITY_HEADERS.map(({ name, description, validate }) => {
      const value = lowerHeaders[name];
      
      if (!value) {
        return {
          name,
          present: false,
          value: undefined,
          severity: 'missing',
          description,
          message: '响应头缺失',
        };
      }
      
      // 如果有验证函数，执行配置值验证
      if (validate) {
        const result = validate(value);
        return {
          name,
          present: true,
          value,
          severity: result.severity,
          description,
          message: result.message,
        };
      }
      
      return {
        name,
        present: true,
        value,
        severity: 'good',
        description,
      };
    });
  }

  /** 执行完整检测流程 */
  async analyze(
    pageData: CollectedPageData,
    responseHeaders: ResponseHeaders
  ): Promise<DetectionResult> {
    // 1. 规则引擎匹配
    const technologies = this.engine.detect(pageData, responseHeaders);

    // 2. 安全头检查
    const securityHeaders = this.analyzeSecurityHeaders(responseHeaders);

    return {
      url: pageData.url,
      hostname: pageData.hostname,
      timestamp: Date.now(),
      technologies,
      securityHeaders,
    };
  }

  /** 从检测结果中提取技术名和版本列表（用于漏洞查询） */
  extractTechVersions(technologies: DetectedTechnology[]): Array<{
    name: string;
    version?: string;
    cpe?: string;
  }> {
    return technologies.map((tech) => ({
      name: tech.name,
      version: tech.version,
      cpe: this.engine.getCPE(tech.name),
    }));
  }

  /** 获取检测统计 */
  getStats(result: DetectionResult) {
    const categories = new Set<number>();
    let inferredCount = 0;
    let highConfidenceCount = 0;

    for (const tech of result.technologies) {
      for (const cat of tech.categories) categories.add(cat);
      if (tech.inferred) inferredCount++;
      if (tech.confidence >= 80) highConfidenceCount++;
    }

    return {
      totalTechnologies: result.technologies.length,
      categoryCount: categories.size,
      inferredCount,
      highConfidenceCount,
      securityHeadersPresent: result.securityHeaders.filter((h) => h.present).length,
      securityHeadersMissing: result.securityHeaders.filter((h) => !h.present).length,
    };
  }
}
