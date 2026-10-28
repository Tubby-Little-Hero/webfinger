// ============================================================
// WebFinger - Robots.txt / Sitemap Analyzer
// 分析 robots.txt 和 sitemap.xml 获取技术指纹
// ============================================================

export interface RobotsTxtAnalysis {
  /** 是否存在 robots.txt */
  exists: boolean;
  /** 找到的 sitemap URL 列表 */
  sitemaps: string[];
  /** 禁止的路径列表 */
  disallowPaths: string[];
  /** 允许的路径列表 */
  allowPaths: string[];
  /** 用户代理规则 */
  userAgents: string[];
  /** 可能的技术指纹线索 */
  techHints: string[];
}

export interface SitemapAnalysis {
  /** 是否存在 sitemap */
  exists: boolean;
  /** URL 总数 */
  urlCount: number;
  /** 找到的 URL 示例（前20个） */
  urlExamples: string[];
  /** URL 模式特征 */
  urlPatterns: string[];
  /** 可能的技术指纹线索 */
  techHints: string[];
}

/**
 * 解析 robots.txt 内容
 */
export function parseRobotsTxt(content: string): RobotsTxtAnalysis {
  const analysis: RobotsTxtAnalysis = {
    exists: true,
    sitemaps: [],
    disallowPaths: [],
    allowPaths: [],
    userAgents: [],
    techHints: [],
  };

  const lines = content.split(/\r?\n/);
  let currentUserAgent = '*';
  const seenUserAgents = new Set<string>();

  for (const line of lines) {
    const trimmedLineRaw = line.trim();
    const trimmedLine = trimmedLineRaw.toLowerCase();

    // 跳过空行和注释
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // 解析指令（使用 trim 后的行进行匹配，避免前导空格导致 ^ 匹配失败）
    const match = trimmedLineRaw.match(/^(\w[\w-]*)\s*:\s*(.+)$/i);
    if (!match) continue;

    const directive = match[1].toLowerCase();
    const value = match[2].trim();

    switch (directive) {
      case 'sitemap':
        analysis.sitemaps.push(value);
        break;

      case 'disallow':
        if (value) {
          analysis.disallowPaths.push(value);
          // 检测常见的后台路径
          if (isAdminPath(value)) {
            analysis.techHints.push(`发现后台路径: ${value}`);
          }
        }
        break;

      case 'allow':
        if (value) {
          analysis.allowPaths.push(value);
        }
        break;

      case 'user-agent':
        if (!seenUserAgents.has(value)) {
          seenUserAgents.add(value);
          analysis.userAgents.push(value);
        }
        break;
    }
  }

  // 检测 robots.txt 中的技术指纹
  analysis.techHints.push(...detectTechFromRobots(content, analysis));

  return analysis;
}

/**
 * 检查是否是常见的后台路径
 */
function isAdminPath(path: string): boolean {
  const adminPatterns = [
    /^\/admin/i,
    /^\/wp-admin/i,
    /^\/wp-login/i,
    /^\/administrator/i,
    /^\/backend/i,
    /^\/manager/i,
    /^\/dashboard/i,
    /^\/cpanel/i,
    /^\/phpmyadmin/i,
    /^\/phpinfo/i,
    /^\/server-status/i,
    /^\/\.git/i,
    /^\/\.env/i,
    /^\/backup/i,
    /^\/config/i,
    /^\/console/i,
    /^\/debug/i,
    /^\/error/i,
  ];

  return adminPatterns.some((pattern) => pattern.test(path));
}

/**
 * 从 robots.txt 内容中检测技术指纹
 */
function detectTechFromRobots(
  content: string,
  analysis: RobotsTxtAnalysis
): string[] {
  const hints: string[] = [];
  const lowerContent = content.toLowerCase();

  // CMS 指纹
  if (lowerContent.includes('wp-')) {
    hints.push('可能使用 WordPress');
  }
  if (lowerContent.includes('/drupal')) {
    hints.push('可能使用 Drupal');
  }
  if (lowerContent.includes('/joomla')) {
    hints.push('可能使用 Joomla');
  }

  // 框架指纹
  if (lowerContent.includes('/cgi-bin')) {
    hints.push('可能使用 CGI 程序');
  }
  if (lowerContent.includes('/.env')) {
    hints.push('环境配置文件路径暴露');
  }
  if (lowerContent.includes('/.git')) {
    hints.push('Git 版本控制目录暴露');
  }

  // 后台管理
  const disallowPaths = analysis.disallowPaths.join(' ');
  if (disallowPaths.includes('admin')) {
    hints.push('存在后台管理系统');
  }
  if (disallowPaths.includes('backend')) {
    hints.push('存在后端管理系统');
  }

  return hints;
}

/**
 * 解析 sitemap.xml 内容
 */
export function parseSitemapXml(content: string): SitemapAnalysis {
  const analysis: SitemapAnalysis = {
    exists: true,
    urlCount: 0,
    urlExamples: [],
    urlPatterns: [],
    techHints: [],
  };

  try {
    // 简单的 XML 解析（不使用 XML 库以保持轻量）
    const urlMatches = content.match(/<loc>([^<]+)<\/loc>/g) || [];

    analysis.urlCount = urlMatches.length;

    // 提取前 20 个 URL 示例
    analysis.urlExamples = urlMatches
      .slice(0, 20)
      .map((m) => m.replace(/<\/?loc>/g, ''));

    // 分析 URL 模式
    analysis.urlPatterns = extractUrlPatterns(analysis.urlExamples);

    // 检测技术指纹
    analysis.techHints = detectTechFromSitemap(analysis);
  } catch {
    analysis.exists = false;
  }

  return analysis;
}

/**
 * 提取 URL 模式
 */
function extractUrlPatterns(urls: string[]): string[] {
  if (urls.length === 0) return [];

  const patterns = new Set<string>();

  for (const url of urls) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      // 检查日期格式（可能是博客/新闻系统）
      if (/\d{4}\/\d{1,2}\/\d{1,2}/.test(path)) {
        patterns.add('日期路径格式 (YYYY/MM/DD)');
      }
      if (/\d{4}-\d{2}-\d{2}/.test(path)) {
        patterns.add('日期路径格式 (YYYY-MM-DD)');
      }

      // 检查技术特征
      if (path.includes('.html')) {
        patterns.add('静态 HTML 页面');
      }
      if (path.includes('.php')) {
        patterns.add('PHP 页面');
      }
      if (path.includes('.asp') || path.includes('.aspx')) {
        patterns.add('ASP/ASP.NET 页面');
      }
      if (path.includes('.jsp')) {
        patterns.add('JSP 页面');
      }

      // 检查 WordPress 特征
      if (path.includes('wp-')) {
        patterns.add('WordPress 特征');
      }
    } catch {
      // 忽略无效 URL
    }
  }

  return Array.from(patterns);
}

/**
 * 从 sitemap 中检测技术指纹
 */
function detectTechFromSitemap(analysis: SitemapAnalysis): string[] {
  const hints: string[] = [];
  const urlExamples = analysis.urlExamples.join(' ');
  const patterns = analysis.urlPatterns.join(' ');

  // CMS 检测
  if (urlExamples.includes('wp-') || urlExamples.includes('wordpress')) {
    hints.push('可能使用 WordPress');
  }
  if (urlExamples.includes('drupal')) {
    hints.push('可能使用 Drupal');
  }
  if (urlExamples.includes('joomla')) {
    hints.push('可能使用 Joomla');
  }

  // 技术栈检测
  if (patterns.includes('.php')) {
    hints.push('使用 PHP');
  }
  if (patterns.includes('.asp') || patterns.includes('.aspx')) {
    hints.push('使用 ASP.NET');
  }
  if (patterns.includes('.jsp')) {
    hints.push('使用 Java/JSP');
  }

  // 内容系统检测
  if (patterns.includes('日期路径格式')) {
    hints.push('可能是博客/新闻系统');
  }

  return hints;
}

/**
 * 获取 robots.txt URL
 */
export function getRobotsTxtUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}/robots.txt`;
  } catch {
    return '';
  }
}

/**
 * 获取 sitemap URL（多种可能位置）
 */
export function getSitemapUrls(baseUrl: string): string[] {
  try {
    const url = new URL(baseUrl);
    const origin = `${url.protocol}//${url.host}`;
    return [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap/sitemap.xml`,
      `${origin}/wp-sitemap.xml`, // WordPress 默认
      `${origin}/sitemap.xml.gz`, // 压缩版本
    ];
  } catch {
    return [];
  }
}

/**
 * 获取 robots.txt 并分析
 */
export async function fetchAndAnalyzeRobotsTxt(
  baseUrl: string
): Promise<RobotsTxtAnalysis | null> {
  const robotsUrl = getRobotsTxtUrl(baseUrl);
  if (!robotsUrl) return null;

  try {
    const response = await fetch(robotsUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { exists: false, sitemaps: [], disallowPaths: [], allowPaths: [], userAgents: [], techHints: [] };
    }

    const content = await response.text();
    return parseRobotsTxt(content);
  } catch {
    return null;
  }
}

/**
 * 获取 sitemap 并分析
 */
export async function fetchAndAnalyzeSitemap(
  baseUrl: string,
  robotsAnalysis?: RobotsTxtAnalysis | null
): Promise<SitemapAnalysis | null> {
  const sitemapUrls = getSitemapUrls(baseUrl);
  
  // 如果有 robots.txt 提供的 sitemap，优先使用
  if (robotsAnalysis?.sitemaps.length) {
    sitemapUrls.unshift(...robotsAnalysis.sitemaps);
  }

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const content = await response.text();
        return parseSitemapXml(content);
      }
    } catch {
      // 尝试下一个 URL
      continue;
    }
  }

  return null;
}
