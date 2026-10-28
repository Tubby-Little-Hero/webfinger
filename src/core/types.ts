// ============================================================
// WebFinger - Core Type Definitions
// 核心类型定义：技术规则、指纹检测结果、漏洞信息、AI配置等
// ============================================================

// ---- 分类定义 ----
export interface Category {
  id: number;
  name: string;
  nameZh: string;
  icon: string;
  priority: number;
}

// ---- 技术规则 ----
export interface DomSelector {
  /** CSS 选择器 - 元素存在性检测 */
  exists?: string | string[];
  /** 文本内容匹配（正则） */
  text?: string | string[];
  /** 属性匹配：key=属性名, value=正则模式 */
  attributes?: Record<string, string>;
  /** DOM 元素属性检查 */
  properties?: Record<string, unknown>;
  /** 子元素选择器链 */
  children?: string | string[];
  /** 计数匹配：元素数量 >= min, <= max */
  count?: { min?: number; max?: number; selector: string };
  /** class 选择器 */
  className?: string | string[];
  /** id 选择器 */
  id?: string | string[];
}

/** 版本检测源 */
export interface VersionDetection {
  /** 从哪个来源检测版本 */
  source: 'header' | 'meta' | 'html' | 'js' | 'cookie' | 'script' | 'text';
  /** 匹配模式（正则） */
  pattern: string;
  /** 捕获组索引（默认1） */
  captureGroup?: number;
  /** 版本格式验证正则 */
  validate?: string;
  /** 特殊处理函数名 */
  transform?: 'semver' | 'date' | 'integer' | 'float';
}

/** 版本范围规则 */
export interface VersionRangeRule {
  /** 版本范围，如 ">= 7.0, < 8.0" */
  range: string;
  /** 该版本范围内的置信度 */
  confidence: number;
  /** 该版本范围内的额外信息 */
  note?: string;
}

export interface TechnologyRule {
  name: string;
  description?: string;
  website: string;
  icon?: string;
  cats: number[];
  priority?: number;

  // 检测方法（全部可选）
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  html?: string | string[];
  text?: string | string[];
  meta?: Record<string, string>;
  scriptSrc?: string | string[];
  scripts?: string | string[];
  js?: Record<string, string>;
  css?: string | string[];
  url?: string | string[];
  dom?: Record<string, DomSelector>;
  robots?: string | string[];
  favicon?: string;

  // 版本检测
  versionDetection?: VersionDetection[];
  /** 版本特定规则：检测到特定版本时调整置信度 */
  versionRanges?: VersionRangeRule[];
  /** 已知的版本列表（用于精确匹配） */
  knownVersions?: string[];
  /** 版本别名映射 */
  versionAliases?: Record<string, string>;

  // 关系
  implies?: string | string[];
  requires?: string | string[];
  requiresCategory?: number | number[];
  excludes?: string | string[];

  // 元数据
  oss?: boolean;
  saas?: boolean;
  pricing?: string[];
  cpe?: string;           // CPE v2.3 identifier
  /** 最低支持版本 */
  minVersion?: string;
  /** 最长支持版本 */
  maxVersion?: string;
}

// 规则索引（按名称索引）
export type TechnologyRules = Record<string, TechnologyRule>;

// ---- 采集的数据 ----
export interface MetaTag {
  name: string;
  content: string;
  property?: string;
}

/** 采集的 DOM 节点信息（简化版，用于指纹匹配） */
export interface DomNodeInfo {
  /** CSS 选择器路径 */
  selector: string;
  /** 元素标签名 */
  tag: string;
  /** 元素 class 列表 */
  className: string;
  /** 元素 id */
  id: string;
  /** 元素文本内容（前200字符） */
  text: string;
  /** 关键属性（src, href, data-* 等） */
  keyAttributes: Record<string, string>;
}

export interface CollectedPageData {
  url: string;
  hostname: string;
  html: string;
  meta: MetaTag[];
  scriptSrc: string[];
  scripts: string[];
  cssClasses: string[];
  jsGlobals: Record<string, string>;
  cookies: Record<string, string>;
  faviconUrl: string | null;
  /** Favicon 的计算 hash 值 */
  faviconHash?: number;
  /** 采集的 DOM 节点列表（用于结构特征检测） */
  domNodes?: DomNodeInfo[];
  /** iframe URL 列表 */
  iframes?: string[];
  /** fetch/XHR 请求的 URL 特征 */
  apiEndpoints?: string[];
  /** Service Worker 脚本 URL */
  serviceWorkers?: string[];
  /** HTTP 响应状态码 */
  statusCode?: number;
  /** 响应时间（ms） */
  responseTime?: number;
}

export interface ResponseHeaders {
  [key: string]: string;
}

// ---- 检测结果 ----
export interface MatchedPattern {
  method: string;          // 匹配方法 (headers/html/meta/...)
  pattern: string;         // 匹配到的模式
  value: string;           // 匹配到的值
}

export interface DetectedTechnology {
  name: string;
  description: string;
  website: string;
  icon: string;
  categories: number[];
  confidence: number;      // 0-100
  version?: string;
  /** 版本检测置信度 */
  versionConfidence?: number;
  /** 版本备注信息 */
  versionNote?: string;
  matchedMethods: string[];
  matchedPatterns: MatchedPattern[];
  inferred: boolean;       // 是否由 implies 推导
}

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  severity: 'good' | 'warning' | 'bad' | 'missing';
  description: string;
  message?: string;  // 可选的验证消息
}

export interface DetectionResult {
  url: string;
  hostname: string;
  timestamp: number;
  technologies: DetectedTechnology[];
  securityHeaders: SecurityHeader[];
}

// ---- 漏洞信息 ----
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface Vulnerability {
  id: string;                // CVE-2024-xxxx, CNVD-2024-xxxx, GHSA-xxxx
  source: 'NVD' | 'OSV' | 'CNVD';
  summary: string;
  severity: Severity;
  cvssScore: number;
  cvssVector?: string;
  publishedDate: string;
  modifiedDate?: string;
  affectedVersions: string;
  fixedVersion?: string;
  references: string[];
  relatedTech: string;
  hasPoC?: boolean;
}

export interface VulnerabilityResult {
  technologies: Array<{
    name: string;
    version?: string;
    vulnerabilities: Vulnerability[];
  }>;
  totalCount: number;
  criticalCount: number;
  highCount: number;
}

// ---- AI 配置 ----
export type AIProvider =
  | 'openai'
  | 'deepseek'
  | 'anthropic'
  | 'zhipu'
  | 'moonshot'
  | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  enabled: boolean;
}

// AI 提供商默认配置统一在 ai-config.ts 中定义
// 此处保留类型重导出以兼容旧引用
export { AI_PROVIDER_DEFAULTS } from './ai/ai-config';

// ---- AI 分析 ----
export type AIAnalysisType = 'vuln-analysis' | 'risk-assessment' | 'attack-surface';

export interface AIAnalysisRequest {
  type: AIAnalysisType;
  context: {
    techName: string;
    version?: string;
    cveId?: string;
    allTechnologies?: DetectedTechnology[];
  };
}

export interface AIAnalysisResult {
  id?: string;
  type: AIAnalysisType;
  targetCVE?: string;
  content: string;
  model: string;
  provider: AIProvider;
  timestamp: number;
  duration?: number;
  error?: string;
}

// ---- 消息通信 ----
export type MessageType =
  // Popup → Background
  | { type: 'GET_DETECTIONS'; tabId: number }
  | { type: 'RESCAN_PAGE'; tabId: number }
  | { type: 'GET_VULNERABILITIES'; tabId: number }
  | { type: 'AI_ANALYZE'; request: AIAnalysisRequest; vulnId?: string }
  // Content Script → Background
  | { type: 'PAGE_DATA'; tabId: number; data: CollectedPageData }
  | { type: 'JS_GLOBALS'; tabId: number; globals: Record<string, string> }
  // Background → Popup
  | { type: 'DETECTIONS_RESULT'; result: DetectionResult; vulnLoading?: boolean }
  | { type: 'VULNERABILITIES_RESULT'; result: VulnerabilityResult }
  | { type: 'VULN_LOADING' }
  | { type: 'AI_ANALYSIS_RESULT'; result: AIAnalysisResult }
  | { type: 'SCAN_TRIGGERED' }
  | { type: 'ACK' }
  | { type: 'ERROR'; message: string };
