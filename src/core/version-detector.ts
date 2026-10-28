// ============================================================
// WebFinger - Version Detection Engine
// 从各种来源提取和验证技术版本号
// ============================================================

import type { 
  VersionDetection, 
  VersionRangeRule, 
  TechnologyRule,
  CollectedPageData,
  ResponseHeaders,
} from './types';

export interface DetectedVersion {
  version: string;
  source: string;
  confidence: number;
  note?: string;
}

/**
 * 从各种来源检测版本号
 */
export function detectVersion(
  rule: TechnologyRule,
  pageData: CollectedPageData,
  headers: ResponseHeaders
): DetectedVersion[] {
  const results: DetectedVersion[] = [];
  
  if (!rule.versionDetection || rule.versionDetection.length === 0) {
    return results;
  }

  for (const detection of rule.versionDetection) {
    const value = extractValue(detection.source, detection.pattern, pageData, headers);
    if (value === null) continue;

    const version = normalizeVersion(value, detection.transform);
    if (!version) continue;

    // 验证版本格式
    if (detection.validate) {
      const validateRegex = new RegExp(detection.validate);
      if (!validateRegex.test(version)) continue;
    }

    results.push({
      version,
      source: detection.source,
      confidence: 100,
    });
  }

  // 应用版本范围规则
  if (rule.versionRanges && results.length > 0) {
    for (const result of results) {
      const rangeMatch = findMatchingRange(rule.versionRanges, result.version);
      if (rangeMatch) {
        result.confidence = rangeMatch.confidence;
        result.note = rangeMatch.note;
      }
    }
  }

  // 版本别名处理
  if (rule.versionAliases && results.length > 0) {
    for (const result of results) {
      const alias = rule.versionAliases[result.version];
      if (alias) {
        result.version = alias;
        result.note = (result.note ? result.note + '; ' : '') + `版本别名: ${alias}`;
      }
    }
  }

  return results;
}

/**
 * 从指定来源提取版本值
 */
function extractValue(
  source: string,
  pattern: string,
  pageData: CollectedPageData,
  headers: ResponseHeaders
): string | null {
  const regex = new RegExp(pattern, 'i');

  switch (source) {
    case 'header':
      for (const [key, value] of Object.entries(headers)) {
        if (regex.test(key) || regex.test(value)) {
          const match = value.match(regex);
          if (match) return match[match.length - 1] || value;
          return value;
        }
      }
      break;

    case 'meta':
      for (const meta of pageData.meta) {
        const haystack = `${meta.name} ${meta.property || ''} ${meta.content}`;
        const match = haystack.match(regex);
        if (match) return match[match.length - 1] || meta.content;
      }
      break;

    case 'html':
      const htmlMatch = pageData.html.match(regex);
      if (htmlMatch) return htmlMatch[htmlMatch.length - 1] || htmlMatch[0];
      break;

    case 'js':
      // 从 JS 全局变量中提取
      for (const [key, value] of Object.entries(pageData.jsGlobals)) {
        if (regex.test(key)) {
          const match = value.match(regex);
          if (match) return match[match.length - 1] || value;
          return value;
        }
      }
      // 从内联脚本中提取
      for (const script of pageData.scripts) {
        const match = script.match(regex);
        if (match) return match[match.length - 1] || match[0];
      }
      break;

    case 'script':
      for (const src of pageData.scriptSrc) {
        const match = src.match(regex);
        if (match) return match[match.length - 1] || src;
      }
      break;

    case 'cookie':
      for (const [key, value] of Object.entries(pageData.cookies)) {
        if (regex.test(key)) {
          return value;
        }
      }
      break;

    case 'text':
      // 从页面纯文本中提取
      const textMatch = pageData.html.replace(/<[^>]+>/g, '').match(regex);
      if (textMatch) return textMatch[textMatch.length - 1] || textMatch[0];
      break;
  }

  return null;
}

/**
 * 版本标准化处理
 */
export function normalizeVersion(
  raw: string,
  transform?: string
): string | null {
  if (!raw) return null;
  
  let version = raw.trim();

  // 清理常见的前缀/后缀
  version = version.replace(/^[vV]?\s*/, '');
  version = version.replace(/\s*(?:version|ver|release)\s*[:：]?\s*/i, '');
  
  switch (transform) {
    case 'semver':
      // 确保符合 semver 格式
      if (/^\d+\.\d+\.\d+/.test(version)) return version;
      if (/^\d+\.\d+$/.test(version)) return `${version}.0`;
      if (/^\d+$/.test(version)) return `${version}.0.0`;
      return null;

    case 'date':
      // 日期版本
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(version)) return version;
      if (/^\d{4}Q\d$/.test(version)) return version;
      return null;

    case 'integer':
      const intMatch = version.match(/\d+/);
      return intMatch ? intMatch[0] : null;

    case 'float':
      const floatMatch = version.match(/\d+\.\d+/);
      return floatMatch ? floatMatch[0] : null;

    default:
      // 通用版本
      if (/^[\d.vV]+/.test(version)) return version;
      // 尝试从字符串中提取版本号
      const extracted = version.match(/\d+[\.\d]*/);
      return extracted ? extracted[0] : null;
  }
}

/**
 * 检查版本号是否在指定范围内
 */
export function isVersionInRange(version: string, range: string): boolean {
  const conditions = range.split(',').map((c) => c.trim());
  
  for (const condition of conditions) {
    if (!evaluateCondition(version, condition)) {
      return false;
    }
  }
  
  return true;
}

/**
 * 评估单个版本条件
 */
function evaluateCondition(version: string, condition: string): boolean {
  // 解析条件: >= 7.0, < 8.0, = 5.x, 7.x
  const patterns: Array<[RegExp, string, boolean]> = [
    [/^>\s*=\s*(.+)$/, '>=', true],
    [/^>=(.+)$/, '>=', true],
    [/^>\s*(.+)$/, '>', true],
    [/^>(.+)$/, '>', true],
    [/^<\s*=\s*(.+)$/, '<=', true],
    [/^<=(.+)$/, '<=', true],
    [/^<\s*(.+)$/, '<', true],
    [/^<(.+)$/, '<', true],
    [/^[=!]=\s*(.+)$/, '==', true],
    [/^!=\s*(.+)$/, '!=', true],
    [/^(\d[\d.xX]*)$/, '==', true], // 纯版本号表示精确匹配
  ];

  for (const [regex, op] of patterns) {
    const match = condition.match(regex);
    if (match) {
      const target = match[1];
      return compareVersions(version, target, op);
    }
  }

  return false;
}

/**
 * 版本比较
 */
export function compareVersions(
  v1: string,
  v2: string,
  op: '>' | '>=' | '<' | '<=' | '==' | '!='
): boolean {
  const parts1 = parseVersionParts(v1);
  const parts2 = parseVersionParts(v2);

  const len = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (op === '==') {
      if (p1 !== p2) return false;
    } else if (op === '!=') {
      if (p1 !== p2) return true;
    } else if (op === '>' || op === '>=') {
      if (p1 > p2) return true;
      if (p1 < p2) return false;
    } else if (op === '<' || op === '<=') {
      if (p1 < p2) return true;
      if (p1 > p2) return false;
    }
  }

  // 所有部分都相等
  return op === '==' || op === '>=' || op === '<=';
}

/**
 * 解析版本号为数字数组
 */
function parseVersionParts(version: string): number[] {
  return version
    .replace(/^[vV]/, '')
    .split(/[.\-]/)
    .map((p) => {
      const num = parseInt(p, 10);
      return isNaN(num) ? 0 : num;
    });
}

/**
 * 查找版本匹配的范围规则
 */
function findMatchingRange(
  ranges: VersionRangeRule[],
  version: string
): VersionRangeRule | null {
  for (const range of ranges) {
    if (isVersionInRange(version, range.range)) {
      return range;
    }
  }
  return null;
}

/**
 * 获取规则的版本信息摘要
 */
export function getVersionInfo(rule: TechnologyRule): {
  hasVersionDetection: boolean;
  detectionSources: string[];
  knownVersionCount: number;
  rangeCount: number;
} {
  return {
    hasVersionDetection: !!(rule.versionDetection && rule.versionDetection.length > 0),
    detectionSources: (rule.versionDetection || []).map((v) => v.source),
    knownVersionCount: rule.knownVersions?.length || 0,
    rangeCount: rule.versionRanges?.length || 0,
  };
}

/**
 * 批量检测版本（用于规则引擎调用）
 */
export function detectVersionsForAll(
  rules: TechnologyRule[],
  pageData: CollectedPageData,
  headers: ResponseHeaders
): Map<string, DetectedVersion[]> {
  const results = new Map<string, DetectedVersion[]>();
  
  for (const rule of rules) {
    if (rule.versionDetection && rule.versionDetection.length > 0) {
      const versions = detectVersion(rule, pageData, headers);
      if (versions.length > 0) {
        results.set(rule.name, versions);
      }
    }
  }
  
  return results;
}
