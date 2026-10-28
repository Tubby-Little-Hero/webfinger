// ============================================================
// WebFinger - Rules Engine
// 规则匹配引擎核心：加载规则、正则匹配、置信度计算、关系解析
// ============================================================

import type {
  TechnologyRule,
  TechnologyRules,
  CollectedPageData,
  ResponseHeaders,
  DetectedTechnology,
  MatchedPattern,
} from './types';
import { detectVersion } from './version-detector';

// ---- 辅助函数 ----

/** 解析带修饰符的 pattern 字符串 (兼容 Wappalyzer 格式) */
interface ParsedPattern {
  regex: RegExp;
  confidence: number;
  version: string | null;
}

function parsePattern(pattern: string): ParsedPattern {
  const parts = pattern.split('\\;');
  const regexStr = parts[0].trim();
  let confidence = 100;
  let version: string | null = null;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part.startsWith('confidence:')) {
      confidence = parseInt(part.substring(11), 10) || 100;
    } else if (part.startsWith('version:')) {
      version = part.substring(8).trim() || null;
    }
  }

  return { regex: new RegExp(regexStr, 'i'), confidence, version };
}

/** 确保值是数组形式 */
function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

/** 提取版本号 */
function extractVersion(
  match: RegExpMatchArray,
  versionTemplate: string | null
): string | undefined {
  if (!versionTemplate) return undefined;

  let result = versionTemplate;
  // 替换 \\1 \\2 等捕获组引用
  result = result.replace(/\\(\d+)/g, (_, n) => {
    const idx = parseInt(n, 10);
    return match[idx] || '';
  });

  // 处理三元表达式 \\1?a:b
  result = result.replace(/\\(\d+)\?([^:]*):([^\\]*)/g, (_, n, a, b) => {
    const idx = parseInt(n, 10);
    return match[idx] ? a : b;
  });

  return result.trim() || undefined;
}

// ---- 规则引擎 ----

export class RulesEngine {
  private rules: TechnologyRules = {};
  private ruleNames: string[] = [];
  private compiledCache: Map<string, ParsedPattern> = new Map();

  /** 加载规则集 */
  loadRules(rules: TechnologyRules): void {
    this.rules = { ...this.rules, ...rules };
    this.ruleNames = Object.keys(this.rules);
    this.compiledCache.clear();
    // 预编译所有规则的正则
    for (const [name, rule] of Object.entries(rules)) {
      this.precompileRule(name, rule);
    }
  }

  /** 从缓存获取或编译正则模式 */
  private getOrCompilePattern(pattern: string): ParsedPattern {
    // 使用 pattern 本身作为 key（因为在不同规则中 pattern 可能相同）
    const cached = this.compiledCache.get(pattern);
    if (cached) {
      // 复用正则对象时需要重置 lastIndex（全局匹配标志可能导致问题）
      cached.regex.lastIndex = 0;
      return cached;
    }
    
    try {
      const parsed = parsePattern(pattern);
      this.compiledCache.set(pattern, parsed);
      return parsed;
    } catch {
      // 返回一个不会匹配任何内容的正则
      return { regex: new RegExp('^$', 'i'), confidence: 100, version: null };
    }
  }

  /** 获取所有技术名称 */
  getRuleNames(): string[] {
    return this.ruleNames;
  }

  /** 获取单个规则 */
  getRule(name: string): TechnologyRule | undefined {
    return this.rules[name];
  }

  /** 预编译一条规则的所有 pattern */
  private precompileRule(name: string, rule: TechnologyRule): void {
    const compileList = (patterns: string | string[] | undefined) => {
      for (const p of toArray(patterns)) {
        if (!this.compiledCache.has(p)) {
          try {
            const parsed = parsePattern(p);
            this.compiledCache.set(p, parsed);
          } catch {
            // 忽略无效正则
            this.compiledCache.set(p, { regex: new RegExp('^$', 'i'), confidence: 100, version: null });
          }
        }
      }
    };

    const compileMap = (map: Record<string, string> | undefined) => {
      if (!map) return;
      for (const [, pattern] of Object.entries(map)) {
        if (!pattern) continue;
        if (!this.compiledCache.has(pattern)) {
          try {
            const parsed = parsePattern(pattern);
            this.compiledCache.set(pattern, parsed);
          } catch {
            this.compiledCache.set(pattern, { regex: new RegExp('^$', 'i'), confidence: 100, version: null });
          }
        }
      }
    };

    compileList(rule.html);
    compileList(rule.text);
    compileList(rule.scriptSrc);
    compileList(rule.scripts);
    compileList(rule.css);
    compileList(rule.url);
    compileList(rule.robots);
    compileMap(rule.headers);
    compileMap(rule.cookies);
    compileMap(rule.meta);
    compileMap(rule.js);
  }

  /** 对采集数据执行所有规则的匹配 */
  detect(
    pageData: CollectedPageData,
    responseHeaders: ResponseHeaders
  ): DetectedTechnology[] {
    const results: DetectedTechnology[] = [];
    const detectedNames = new Set<string>();

    for (const name of this.ruleNames) {
      const rule = this.rules[name];
      if (!rule) continue;

      // 检查 requires 条件
      if (rule.requires) {
        const requires = toArray(rule.requires);
        if (!requires.some((r) => detectedNames.has(r))) {
          continue;
        }
      }

      // 检查 requiresCategory 条件
      if (rule.requiresCategory) {
        const reqCats = toArray(rule.requiresCategory);
        const hasCat = results.some((r) =>
          r.categories.some((c) => reqCats.includes(c))
        );
        if (!hasCat) continue;
      }

      const detection = this.matchRule(name, rule, pageData, responseHeaders);
      if (detection) {
        results.push(detection);
        detectedNames.add(name);
      }
    }

    // Pass 2: 处理 implies 关系
    this.resolveImplications(results, detectedNames);

    // Pass 3: 处理 excludes 关系
    this.resolveExclusions(results);

    // 按置信度降序排列
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /** 匹配单条规则 */
  private matchRule(
    name: string,
    rule: TechnologyRule,
    pageData: CollectedPageData,
    responseHeaders: ResponseHeaders
  ): DetectedTechnology | null {
    const matchedMethods: string[] = [];
    const matchedPatterns: MatchedPattern[] = [];
    let totalConfidence = 0;
    let version: string | undefined;
    let methodCount = 0;

    // headers 匹配
    if (rule.headers) {
      for (const [headerName, pattern] of Object.entries(rule.headers)) {
        const headerValue = responseHeaders[headerName.toLowerCase()];
        if (!headerValue && !pattern) continue;
        if (!pattern) {
          // 只检查 header 是否存在
          if (responseHeaders[headerName.toLowerCase()]) {
            matchedMethods.push('headers');
            matchedPatterns.push({
              method: 'headers',
              pattern: headerName,
              value: responseHeaders[headerName.toLowerCase()],
            });
            totalConfidence += 100;
            methodCount++;
          }
          continue;
        }
        const parsed = this.getOrCompilePattern(pattern);
        if (headerValue && parsed.regex.test(headerValue)) {
          matchedMethods.push('headers');
          matchedPatterns.push({ method: 'headers', pattern, value: headerValue });
          totalConfidence += parsed.confidence;
          methodCount++;
          if (parsed.version) {
            const m = headerValue.match(parsed.regex);
            if (m) version = extractVersion(m, parsed.version);
          }
        }
      }
    }

    // cookies 匹配
    if (rule.cookies) {
      for (const [cookieName, pattern] of Object.entries(rule.cookies)) {
        const cookieValue = pageData.cookies[cookieName];
        if (!pattern) {
          if (cookieName in pageData.cookies) {
            matchedMethods.push('cookies');
            matchedPatterns.push({
              method: 'cookies',
              pattern: cookieName,
              value: cookieValue || '(exists)',
            });
            totalConfidence += 100;
            methodCount++;
          }
          continue;
        }
        const parsed = this.getOrCompilePattern(pattern);
        if (cookieValue && parsed.regex.test(cookieValue)) {
          matchedMethods.push('cookies');
          matchedPatterns.push({ method: 'cookies', pattern, value: cookieValue });
          totalConfidence += parsed.confidence;
          methodCount++;
          if (parsed.version) {
            const m = cookieValue.match(parsed.regex);
            if (m) version = extractVersion(m, parsed.version);
          }
        }
      }
    }

    // html 匹配
    if (rule.html) {
      const { match, ver } = this.matchStringList(rule.html, pageData.html, 'html');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = parsePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // meta 匹配
    if (rule.meta) {
      for (const [metaName, pattern] of Object.entries(rule.meta)) {
        const meta = pageData.meta.find(
          (m) => m.name?.toLowerCase() === metaName.toLowerCase() ||
                 m.property?.toLowerCase() === metaName.toLowerCase()
        );
        if (!meta) continue;
        if (!pattern) {
          matchedMethods.push('meta');
          matchedPatterns.push({ method: 'meta', pattern: metaName, value: meta.content });
          totalConfidence += 100;
          methodCount++;
          continue;
        }
        const parsed = this.getOrCompilePattern(pattern);
        if (parsed.regex.test(meta.content)) {
          matchedMethods.push('meta');
          matchedPatterns.push({ method: 'meta', pattern, value: meta.content });
          totalConfidence += parsed.confidence;
          methodCount++;
          if (parsed.version) {
            const m = meta.content.match(parsed.regex);
            if (m) version = extractVersion(m, parsed.version);
          }
        }
      }
    }

    // scriptSrc 匹配
    if (rule.scriptSrc) {
      const allSrc = pageData.scriptSrc.join('\n');
      const { match, ver } = this.matchStringList(rule.scriptSrc, allSrc, 'scriptSrc');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = this.getOrCompilePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // scripts (inline JS) 匹配
    if (rule.scripts) {
      const allScripts = pageData.scripts.join('\n');
      const { match, ver } = this.matchStringList(rule.scripts, allScripts, 'scripts');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = this.getOrCompilePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // css 匹配
    if (rule.css) {
      const allCss = pageData.cssClasses.join(' ');
      const { match, ver } = this.matchStringList(rule.css, allCss, 'css');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = this.getOrCompilePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // js (globals) 匹配
    if (rule.js) {
      for (const [jsVar, pattern] of Object.entries(rule.js)) {
        const value = pageData.jsGlobals[jsVar];
        if (value === undefined) continue;
        if (!pattern) {
          matchedMethods.push('js');
          matchedPatterns.push({ method: 'js', pattern: jsVar, value });
          totalConfidence += 100;
          methodCount++;
          continue;
        }
        const parsed = this.getOrCompilePattern(pattern);
        if (parsed.regex.test(value)) {
          matchedMethods.push('js');
          matchedPatterns.push({ method: 'js', pattern, value });
          totalConfidence += parsed.confidence;
          methodCount++;
          if (parsed.version) {
            const m = value.match(parsed.regex);
            if (m) version = extractVersion(m, parsed.version);
          }
        }
      }
    }

    // url 匹配
    if (rule.url) {
      const { match, ver } = this.matchStringList(rule.url, pageData.url, 'url');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = this.getOrCompilePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // text 匹配
    if (rule.text) {
      // 从 HTML 中提取纯文本进行匹配
      const textContent = pageData.html.replace(/<[^>]+>/g, ' ');
      const { match, ver } = this.matchStringList(rule.text, textContent, 'text');
      matchedMethods.push(...match.map((m) => m.method));
      matchedPatterns.push(...match);
      totalConfidence += match.reduce((sum, m) => {
        const p = this.getOrCompilePattern(m.pattern);
        return sum + p.confidence;
      }, 0);
      methodCount += match.length;
      if (ver) version = ver;
    }

    // dom (结构特征) 匹配
    if (rule.dom && pageData.domNodes) {
      const domMatch = this.matchDomSelectors(rule.dom, pageData.domNodes);
      matchedMethods.push(...domMatch.methods);
      matchedPatterns.push(...domMatch.patterns);
      totalConfidence += domMatch.totalConfidence;
      methodCount += domMatch.methods.length;
      if (domMatch.version) version = domMatch.version;
    }

    // favicon hash 匹配
    if (rule.favicon && pageData.faviconUrl && pageData.faviconHash !== undefined) {
      // 检查 favicon hash 是否在规则中
      const expectedHash = parseInt(rule.favicon, 10);
      if (!isNaN(expectedHash) && pageData.faviconHash === expectedHash) {
        matchedMethods.push('favicon');
        matchedPatterns.push({
          method: 'favicon',
          pattern: rule.favicon,
          value: `Favicon hash matched: ${pageData.faviconHash}`,
        });
        totalConfidence += 95; // favicon 匹配置信度高
        methodCount++;
      }
    }

    if (matchedMethods.length === 0) return null;

    // 版本检测
    let detectedVersion: string | undefined = version;
    let versionConfidence = 0;
    let versionNote: string | undefined;

    if (rule.versionDetection && rule.versionDetection.length > 0) {
      const versionResults = detectVersion(rule, pageData, headers);
      if (versionResults.length > 0) {
        // 取置信度最高的版本
        const best = versionResults.reduce((a, b) => 
          a.confidence >= b.confidence ? a : b
        );
        detectedVersion = best.version;
        versionConfidence = best.confidence;
        versionNote = best.note;
        matchedMethods.push('version');
        matchedPatterns.push({
          method: 'version',
          pattern: best.source,
          value: `Detected version: ${best.version}`,
        });
        methodCount++;
        totalConfidence += best.confidence;
      }
    }

    // 基于权重的置信度计算
    const confidence = this.calculateWeightedConfidence(
      matchedMethods,
      matchedPatterns,
      totalConfidence,
      methodCount
    );

    return {
      name,
      description: rule.description || '',
      website: rule.website,
      icon: rule.icon || '',
      categories: rule.cats,
      confidence,
      version: detectedVersion || version,
      versionConfidence: versionConfidence || undefined,
      versionNote,
      matchedMethods: [...new Set(matchedMethods)],
      matchedPatterns,
      inferred: false,
    };
  }

  /** 匹配字符串列表（使用预编译缓存） */
  private matchStringList(
    patterns: string | string[],
    target: string,
    method: string
  ): { match: MatchedPattern[]; ver: string | undefined } {
    const results: MatchedPattern[] = [];
    let version: string | undefined;

    for (const pattern of toArray(patterns)) {
      try {
        const parsed = this.getOrCompilePattern(pattern);
        const match = target.match(parsed.regex);
        if (match) {
          results.push({
            method,
            pattern,
            value: match[0].substring(0, 200), // 截断长值
          });
          if (parsed.version && !version) {
            version = extractVersion(match, parsed.version);
          }
        }
      } catch {
        // 忽略无效正则
      }
    }

    return { match: results, ver: version };
  }

  /** 匹配 DOM 选择器规则 */
  private matchDomSelectors(
    domRules: Record<string, import('./types').DomSelector>,
    domNodes: import('./types').DomNodeInfo[]
  ): {
    methods: string[];
    patterns: MatchedPattern[];
    totalConfidence: number;
    version?: string;
  } {
    const methods: string[] = [];
    const patterns: MatchedPattern[] = [];
    let totalConfidence = 0;
    let version: string | undefined;

    for (const [selectorName, domRule] of Object.entries(domRules)) {
      let matched = false;
      let ruleConfidence = 100;

      // 1. 检查元素是否存在 (exists)
      if (domRule.exists) {
        const selectors = toArray(domRule.exists);
        for (const sel of selectors) {
          const exists = domNodes.some((node) => {
            // 检查 node.selector 是否包含该选择器
            if (node.selector.includes(sel)) return true;
            // 检查 className
            if (node.className && sel.startsWith('.')) {
              const className = sel.slice(1);
              if (node.className.includes(className)) return true;
            }
            // 检查 id
            if (node.id && sel.startsWith('#')) {
              if (node.id === sel.slice(1)) return true;
            }
            // 检查标签
            if (node.tag === sel.replace(/[.#].*/g, '')) return true;
            return false;
          });

          if (exists) {
            matched = true;
            methods.push('dom');
            patterns.push({
              method: 'dom',
              pattern: selectorName,
              value: `Element exists: ${sel}`,
            });
            break;
          }
        }
        if (!matched) continue;
      }

      // 2. 检查 class 名称
      if (domRule.className) {
        const classPatterns = toArray(domRule.className);
        const classMatched = domNodes.some((node) => {
          if (!node.className) return false;
          return classPatterns.some((pattern) => 
            node.className.includes(pattern)
          );
        });
        if (classMatched) {
          matched = true;
          methods.push('dom');
          patterns.push({
            method: 'dom',
            pattern: selectorName,
            value: 'Class pattern matched',
          });
        }
      }

      // 3. 检查 id
      if (domRule.id) {
        const idPatterns = toArray(domRule.id);
        const idMatched = domNodes.some((node) => {
          if (!node.id) return false;
          return idPatterns.some((pattern) => node.id === pattern);
        });
        if (idMatched) {
          matched = true;
          methods.push('dom');
          patterns.push({
            method: 'dom',
            pattern: selectorName,
            value: 'ID pattern matched',
          });
        }
      }

      // 4. 检查文本内容
      if (domRule.text) {
        const textPatterns = toArray(domRule.text);
        for (const textPattern of textPatterns) {
          const regex = new RegExp(textPattern, 'i');
          const textMatched = domNodes.some((node) => 
            regex.test(node.text)
          );
          if (textMatched) {
            matched = true;
            methods.push('dom');
            patterns.push({
              method: 'dom',
              pattern: selectorName,
              value: 'Text pattern matched',
            });
            break;
          }
        }
      }

      // 5. 检查属性
      if (domRule.attributes) {
        const attrMatched = Object.entries(domRule.attributes).every(
          ([attrName, attrPattern]) => {
            return domNodes.some((node) => {
              const value = node.keyAttributes[attrName];
              if (!value) return false;
              try {
                return new RegExp(attrPattern, 'i').test(value);
              } catch {
                return value.includes(attrPattern);
              }
            });
          }
        );
        if (attrMatched) {
          matched = true;
          methods.push('dom');
          patterns.push({
            method: 'dom',
            pattern: selectorName,
            value: 'Attributes matched',
          });
        }
      }

      if (matched) {
        totalConfidence += ruleConfidence;
      }
    }

    return { methods, patterns, totalConfidence, version };
  }

  /** Pass 2: 解析 implies 关系 */
  private resolveImplications(
    results: DetectedTechnology[],
    detectedNames: Set<string>
  ): void {
    const toAdd: DetectedTechnology[] = [];

    for (const tech of results) {
      const rule = this.rules[tech.name];
      if (!rule?.implies) continue;

      for (const implied of toArray(rule.implies)) {
        // 处理 implied 可能带 version/confidence 修饰符
        const cleanName = implied.split('\\;')[0].trim();
        if (detectedNames.has(cleanName)) continue;

        const impliedRule = this.rules[cleanName];
        if (!impliedRule) continue;

        toAdd.push({
          name: cleanName,
          description: impliedRule.description || '',
          website: impliedRule.website,
          icon: impliedRule.icon || '',
          categories: impliedRule.cats,
          confidence: 50, // 推断的置信度较低
          matchedMethods: ['implies'],
          matchedPatterns: [{
            method: 'implies',
            pattern: `Implied by ${tech.name}`,
            value: tech.name,
          }],
          inferred: true,
        });
        detectedNames.add(cleanName);
      }
    }

    results.push(...toAdd);
  }

  /** Pass 3: 排除关系 */
  private resolveExclusions(results: DetectedTechnology[]): void {
    const namesToRemove = new Set<string>();

    for (const tech of results) {
      const rule = this.rules[tech.name];
      if (!rule?.excludes) continue;

      for (const excluded of toArray(rule.excludes)) {
        const cleanName = excluded.split('\\;')[0].trim();
        // 如果被排除的技术是推断出来的，则删除
        const target = results.find((r) => r.name === cleanName);
        if (target?.inferred) {
          namesToRemove.add(cleanName);
        }
      }
    }

    // 移除被排除的技术
    const idx = results.length;
    for (let i = results.length - 1; i >= 0; i--) {
      if (namesToRemove.has(results[i].name)) {
        results.splice(i, 1);
      }
    }
  }

  /**
   * 计算加权置信度
   * 不同检测方法有不同的权重：
   * - favicon: 95 (独特性高)
   * - headers: 90 (服务器特征明显)
   * - meta: 85 (generator 等可靠)
   * - js (全局变量): 80
   * - html: 75 (可能被修改)
   * - scriptSrc: 75
   * - cookies: 70
   * - css: 65 (可能被主题修改)
   * - dom: 70
   * - url: 60 (容易被修改)
   * - text: 55
   */
  private calculateWeightedConfidence(
    methods: string[],
    patterns: MatchedPattern[],
    totalConfidence: number,
    methodCount: number
  ): number {
    // 方法权重映射
    const methodWeights: Record<string, number> = {
      favicon: 95,
      headers: 90,
      meta: 85,
      js: 80,
      html: 75,
      scriptSrc: 75,
      scripts: 75,
      cookies: 70,
      dom: 70,
      css: 65,
      url: 60,
      text: 55,
    };

    // 1. 基础置信度（基于已有的 totalConfidence）
    let baseConfidence = Math.min(
      Math.round(totalConfidence / Math.max(methodCount, 1)),
      100
    );

    // 2. 方法多样性加成
    const uniqueMethods = new Set(methods);
    let diversityBonus = 0;
    
    if (uniqueMethods.size >= 4) {
      diversityBonus = 15; // 4+ 种方法匹配，显著加成
    } else if (uniqueMethods.size >= 3) {
      diversityBonus = 10;
    } else if (uniqueMethods.size >= 2) {
      diversityBonus = 5;
    }

    // 3. 高权重方法加成
    let highWeightBonus = 0;
    for (const method of uniqueMethods) {
      const weight = methodWeights[method] || 50;
      if (weight >= 80) {
        highWeightBonus += 5; // 每种高权重方法额外加成
      }
    }

    // 4. 稳定性惩罚
    // 如果只有单一方法匹配，降低置信度
    let stabilityPenalty = 0;
    if (uniqueMethods.size === 1) {
      const onlyMethod = uniqueMethods.values().next().value;
      const weight = methodWeights[onlyMethod] || 50;
      // 单一方法匹配时给予基础惩罚，权重越低惩罚越大
      stabilityPenalty = 30;
      if (weight >= 90) {
        stabilityPenalty = 20; // 高权重方法略有降分
      }
    }

    // 综合计算
    let finalConfidence = baseConfidence + diversityBonus + highWeightBonus - stabilityPenalty;

    // 边界检查
    finalConfidence = Math.max(0, Math.min(100, finalConfidence));

    return Math.round(finalConfidence);
  }

  /** 根据技术名和版本匹配 CPE */
  getCPE(name: string): string | undefined {
    return this.rules[name]?.cpe;
  }
}
