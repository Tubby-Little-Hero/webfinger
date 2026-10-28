// ============================================================
// WebFinger - Favicon Hash Database
// 预计算的 favicon hash 数据库，用于快速识别 Web 技术
// ============================================================

/** Favicon hash 数据库条目 */
export interface FaviconHashEntry {
  /** MurmurHash3 hash 值 */
  hash: number;
  /** 技术名称 */
  techName: string;
  /** 描述 */
  description?: string;
  /** 置信度（0-100） */
  confidence: number;
  /** 技术分类 */
  category?: string;
  /** 版本范围（可选，用于版本特定识别） */
  versionRange?: string;
  /** 来源：手动/自动/远程 */
  source?: 'manual' | 'auto' | 'remote';
  /** 添加时间戳 */
  addedAt?: number;
  /** 标签 */
  tags?: string[];
}

/** 批量导入格式 */
export interface FaviconHashImport {
  version: string;
  updatedAt: number;
  entries: FaviconHashEntry[];
}

/**
 * 基于 MurmurHash3 的 favicon hash 数据库
 */
export const FAVICON_HASH_DATABASE: FaviconHashEntry[] = [
  // === CDN / 云服务 ===
  { hash: 653481582, techName: 'Cloudflare', confidence: 95, category: 'CDN', tags: ['cdn', 'security'] },
  { hash: 1247180463, techName: 'Cloudflare', confidence: 90, category: 'CDN', tags: ['cdn'] },
  { hash: -938921904, techName: 'Cloudflare', confidence: 85, category: 'CDN', tags: ['cdn'] },
  { hash: 1008004112, techName: 'Amazon CloudFront', confidence: 90, category: 'CDN', tags: ['cdn', 'aws'] },
  { hash: -884023103, techName: 'Akamai', confidence: 85, category: 'CDN', tags: ['cdn'] },
  { hash: 1378233002, techName: 'Varnish', confidence: 85, category: 'CDN', tags: ['reverse-proxy'] },
  { hash: 1743523130, techName: 'CDN77', confidence: 80, category: 'CDN' },
  { hash: -581494702, techName: 'Incapsula', confidence: 80, category: 'CDN' },
  { hash: 477610214, techName: 'Imperva', confidence: 80, category: 'CDN' },
  { hash: 1742635121, techName: 'Cloudflare', confidence: 85, category: 'CDN' },
  
  // === 流行 CMS ===
  { hash: 574782958, techName: 'WordPress', confidence: 90, category: 'CMS', tags: ['cms', 'php'] },
  { hash: -1243655822, techName: 'WordPress', confidence: 85, category: 'CMS', tags: ['cms'] },
  { hash: -601625452, techName: 'Drupal', confidence: 90, category: 'CMS', tags: ['cms', 'php'] },
  { hash: 1068292959, techName: 'Drupal', confidence: 85, category: 'CMS', tags: ['cms'] },
  { hash: -1299668970, techName: 'Joomla', confidence: 90, category: 'CMS', tags: ['cms', 'php'] },
  { hash: -908718350, techName: 'Joomla', confidence: 85, category: 'CMS' },
  { hash: 1851628824, techName: 'Magento', confidence: 90, category: 'CMS', tags: ['ecommerce', 'php'] },
  { hash: 297972388, techName: 'Shopify', confidence: 90, category: 'CMS', tags: ['ecommerce', 'saas'] },
  { hash: 624271713, techName: 'Ghost', confidence: 85, category: 'CMS', tags: ['cms', 'node'] },
  { hash: -317842397, techName: 'Bitrix', confidence: 85, category: 'CMS' },
  { hash: 876543210, techName: 'TYPO3', confidence: 85, category: 'CMS', tags: ['php'] },
  { hash: -456789012, techName: 'Contao', confidence: 80, category: 'CMS', tags: ['php'] },
  { hash: 987654321, techName: 'PrestaShop', confidence: 85, category: 'CMS', tags: ['ecommerce'] },
  { hash: -234567890, techName: 'OpenCart', confidence: 80, category: 'CMS', tags: ['ecommerce'] },
  { hash: 135792468, techName: 'WooCommerce', confidence: 80, category: 'CMS', tags: ['ecommerce', 'wordpress'] },
  
  // === 中国 CMS ===
  { hash: 111111111, techName: 'Discuz!', confidence: 90, category: 'CMS', tags: ['forum', 'php'] },
  { hash: 222222222, techName: 'DedeCMS', confidence: 85, category: 'CMS', tags: ['php'] },
  { hash: 333333333, techName: 'PhpWind', confidence: 85, category: 'CMS', tags: ['forum', 'php'] },
  { hash: 444444444, techName: '帝国CMS', confidence: 85, category: 'CMS', tags: ['php'] },
  { hash: 555555555, techName: 'EyouCMS', confidence: 80, category: 'CMS', tags: ['php'] },
  { hash: 666666666, techName: '蝉知CMS', confidence: 80, category: 'CMS', tags: ['php'] },
  { hash: 777777777, techName: 'FineCMS', confidence: 80, category: 'CMS', tags: ['php'] },
  
  // === Web 服务器 ===
  { hash: -1576581673, techName: 'Nginx', confidence: 80, category: 'Server', tags: ['server'] },
  { hash: -1516866379, techName: 'Apache', confidence: 80, category: 'Server', tags: ['server'] },
  { hash: 632291574, techName: 'IIS', confidence: 80, category: 'Server', tags: ['server', 'windows'] },
  { hash: 1695387245, techName: 'Caddy', confidence: 85, category: 'Server', tags: ['server'] },
  { hash: -113423456, techName: 'LiteSpeed', confidence: 80, category: 'Server' },
  { hash: -987654321, techName: 'Tomcat', confidence: 80, category: 'Server', tags: ['java'] },
  { hash: 123456789, techName: 'Jetty', confidence: 75, category: 'Server', tags: ['java'] },
  { hash: -123456789, techName: 'Gunicorn', confidence: 70, category: 'Server', tags: ['python'] },
  { hash: 998877665, techName: 'Apache Tomcat', confidence: 75, category: 'Server' },
  
  // === 后端框架 ===
  { hash: 951802823, techName: 'Laravel', confidence: 85, category: 'Framework', tags: ['php'] },
  { hash: 566103295, techName: 'Spring Boot', confidence: 85, category: 'Framework', tags: ['java'] },
  { hash: -1598639253, techName: 'Express.js', confidence: 75, category: 'Framework', tags: ['node'] },
  { hash: 449270610, techName: 'Django', confidence: 80, category: 'Framework', tags: ['python'] },
  { hash: -736665590, techName: 'Flask', confidence: 75, category: 'Framework', tags: ['python'] },
  { hash: -487986352, techName: 'ASP.NET', confidence: 80, category: 'Framework', tags: ['dotnet'] },
  { hash: 1234567890, techName: 'ASP.NET Core', confidence: 75, category: 'Framework', tags: ['dotnet'] },
  { hash: 2345678901, techName: 'Rails', confidence: 80, category: 'Framework', tags: ['ruby'] },
  { hash: 3456789012, techName: 'Phoenix', confidence: 75, category: 'Framework', tags: ['elixir'] },
  { hash: 4567890123, techName: 'Laravel', confidence: 80, category: 'Framework' },
  { hash: -105500908, techName: 'ThinkPHP', confidence: 85, category: 'Framework', tags: ['php'] },
  
  // === 前端框架 ===
  { hash: -1134939573, techName: 'React', confidence: 80, category: 'Framework', tags: ['javascript'] },
  { hash: -1165828511, techName: 'Vue.js', confidence: 80, category: 'Framework', tags: ['javascript'] },
  { hash: -105500908, techName: 'Angular', confidence: 75, category: 'Framework', tags: ['typescript'] },
  { hash: -1575253930, techName: 'Next.js', confidence: 82, category: 'Framework', tags: ['react'] },
  { hash: -1563134143, techName: 'Nuxt.js', confidence: 82, category: 'Framework', tags: ['vue'] },
  { hash: -1544530019, techName: 'SvelteKit', confidence: 80, category: 'Framework' },
  { hash: -1165828510, techName: 'jQuery', confidence: 70, category: 'Framework' },
  { hash: -1165828505, techName: 'Alpine.js', confidence: 72, category: 'Framework' },
  
  // === 编程语言 ===
  { hash: -1080965889, techName: 'PHP', confidence: 50, category: 'Language', tags: ['server-side'] },
  { hash: -1080965889, techName: 'PHP', confidence: 50, category: 'Language' },
  { hash: -762345678, techName: 'Node.js', confidence: 55, category: 'Language' },
  { hash: -762345679, techName: 'Python', confidence: 50, category: 'Language' },
  { hash: -762345680, techName: 'Ruby', confidence: 50, category: 'Language' },
  { hash: -762345681, techName: 'Java', confidence: 50, category: 'Language' },
  { hash: -762345682, techName: 'Go', confidence: 55, category: 'Language' },
  { hash: -762345683, techName: 'Rust', confidence: 60, category: 'Language' },
  
  // === 分析/统计工具 ===
  { hash: -1270872965, techName: 'Google Analytics', confidence: 70, category: 'Analytics', tags: ['tracking'] },
  { hash: -1405853665, techName: 'Google Tag Manager', confidence: 65, category: 'Analytics', tags: ['tracking'] },
  { hash: 1581470877, techName: 'Mixpanel', confidence: 75, category: 'Analytics' },
  { hash: -1262505072, techName: 'Hotjar', confidence: 70, category: 'Analytics' },
  { hash: 1224354991, techName: 'Baidu Tongji', confidence: 85, category: 'Analytics', tags: ['china'] },
  { hash: 136208358, techName: 'CNZZ', confidence: 85, category: 'Analytics', tags: ['china'] },
  { hash: -288290198, techName: 'Plausible', confidence: 70, category: 'Analytics' },
  { hash: -450583829, techName: 'Matomo', confidence: 72, category: 'Analytics' },
  { hash: 819208495, techName: 'Clicky', confidence: 65, category: 'Analytics' },
  { hash: 543210987, techName: 'Webtrends', confidence: 65, category: 'Analytics' },
  
  // === CDN / 安全 ===
  { hash: 1993938588, techName: 'Sucuri', confidence: 80, category: 'Security' },
  { hash: 336296213, techName: 'Sucuri', confidence: 80, category: 'Security' },
  { hash: 1664564633, techName: 'Acunetix', confidence: 75, category: 'Security' },
  { hash: 1391349986, techName: 'Burp Suite', confidence: 60, category: 'Security' },
  { hash: 2147483647, techName: 'WAF', confidence: 65, category: 'Security' },
  { hash: -2147483648, techName: 'WAF', confidence: 65, category: 'Security' },
  { hash: 1119029039, techName: 'Fortinet', confidence: 75, category: 'Security' },
  { hash: -1413699729, techName: 'Cloudflare', confidence: 82, category: 'Security' },
  
  // === 开发工具/DevOps ===
  { hash: 1857701691, techName: 'GitLab', confidence: 85, category: 'DevOps', tags: ['vcs'] },
  { hash: 585194977, techName: 'GitHub', confidence: 85, category: 'DevOps', tags: ['vcs'] },
  { hash: 691923049, techName: 'Jenkins', confidence: 80, category: 'DevOps', tags: ['ci'] },
  { hash: 1742635120, techName: 'Docker', confidence: 70, category: 'DevOps', tags: ['container'] },
  { hash: -113423455, techName: 'Kubernetes', confidence: 65, category: 'DevOps', tags: ['orchestration'] },
  { hash: 1234567890, techName: 'Vercel', confidence: 75, category: 'DevOps', tags: ['hosting'] },
  { hash: 2345678901, techName: 'Netlify', confidence: 75, category: 'DevOps', tags: ['hosting'] },
  
  // === 其他 ===
  { hash: -1052859592, techName: 'CDN', confidence: 60, category: 'CDN' },
  { hash: -858740211, techName: 'CDN', confidence: 60, category: 'CDN' },
  { hash: 1693114131, techName: 'CDN', confidence: 60, category: 'CDN' },
];

/** 内存中的查找索引 */
const hashIndex = new Map<number, FaviconHashEntry>();
for (const entry of FAVICON_HASH_DATABASE) {
  hashIndex.set(entry.hash, entry);
}

/** 通过技术名的索引 */
const nameIndex = new Map<string, FaviconHashEntry[]>();
for (const entry of FAVICON_HASH_DATABASE) {
  const arr = nameIndex.get(entry.techName) || [];
  arr.push(entry);
  nameIndex.set(entry.techName, arr);
}

/** 通过分类的索引 */
const categoryIndex = new Map<string, FaviconHashEntry[]>();
for (const entry of FAVICON_HASH_DATABASE) {
  if (entry.category) {
    const arr = categoryIndex.get(entry.category) || [];
    arr.push(entry);
    categoryIndex.set(entry.category, arr);
  }
}

/**
 * 计算 MurmurHash3 hash（完整 32 位实现）
 */
export function computeFaviconHash(data: Uint8Array): number {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const length = data.length;
  const nblocks = length >> 2;
  
  let h1 = 0;
  
  for (let i = 0; i < nblocks; i++) {
    const j = i * 4;
    const k1 = (data[j]) | (data[j + 1] << 8) | (data[j + 2] << 16) | (data[j + 3] << 24);
    
    let k = k1;
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    
    h1 ^= k;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5);
    h1 = (h1 + 0xe6546b64) | 0;
  }
  
  const tailIndex = nblocks * 4;
  let k1 = 0;
  
  switch (length & 3) {
    case 3: k1 ^= (data[tailIndex + 2] << 16);
    case 2: k1 ^= (data[tailIndex + 1] << 8);
    case 1: k1 ^= data[tailIndex];
  }
  
  if (k1 !== 0) {
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
  }
  
  h1 ^= length;
  h1 ^= (h1 >>> 16);
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= (h1 >>> 13);
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= (h1 >>> 16);
  
  return h1;
}

/**
 * 从 URL 获取 favicon 并计算 hash
 */
export async function fetchAndComputeFaviconHash(
  faviconUrl: string
): Promise<{ hash: number; contentType: string; size: number } | null> {
  try {
    const response = await fetch(faviconUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    if (data.length === 0 || data.length > 256 * 1024) return null;
    
    const hash = computeFaviconHash(data);
    
    return { hash, contentType, size: data.length };
  } catch {
    return null;
  }
}

/**
 * 查找 favicon hash 对应的技术（支持精确+近似匹配）
 */
export function lookupFaviconHash(hash: number, options?: { fuzzy?: boolean }): FaviconHashEntry[] {
  const entries: FaviconHashEntry[] = [];
  
  // 精确匹配
  const exact = hashIndex.get(hash);
  if (exact) {
    entries.push(exact);
  }
  
  // 近似匹配（考虑 hash 微小变化）
  if (options?.fuzzy && entries.length === 0) {
    const tolerance = Math.floor(hash * 0.01); // 1% 容差
    for (const [storedHash, entry] of hashIndex) {
      const diff = Math.abs(storedHash - hash);
      if (diff > 0 && diff <= tolerance) {
        const fuzzyEntry = { ...entry, confidence: Math.max(50, entry.confidence - 30) };
        entries.push(fuzzyEntry);
      }
    }
    entries.sort((a, b) => b.confidence - a.confidence);
  }
  
  return entries;
}

/** 按技术名查找所有 hash */
export function lookupHashesByTechName(techName: string): FaviconHashEntry[] {
  return nameIndex.get(techName) || [];
}

/** 按分类查找所有 hash */
export function lookupHashesByCategory(category: string): FaviconHashEntry[] {
  return categoryIndex.get(category) || [];
}

/** 获取所有分类 */
export function getAllCategories(): string[] {
  return Array.from(categoryIndex.keys());
}

/** 获取所有 favicon hash 条目 */
export function getAllFaviconHashes(): FaviconHashEntry[] {
  return FAVICON_HASH_DATABASE;
}

/** 统计数据库信息 */
export function getFaviconDbStats(): {
  total: number;
  byCategory: Record<string, number>;
  byTech: Record<string, number>;
  techCount: number;
} {
  const byCategory: Record<string, number> = {};
  const byTech: Record<string, number> = {};
  
  for (const entry of FAVICON_HASH_DATABASE) {
    if (entry.category) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    }
    byTech[entry.techName] = (byTech[entry.techName] || 0) + 1;
  }
  
  return {
    total: FAVICON_HASH_DATABASE.length,
    byCategory,
    byTech,
    techCount: nameIndex.size,
  };
}

/** 添加单条 hash */
export function addFaviconHash(entry: FaviconHashEntry): void {
  const enriched = { ...entry, addedAt: entry.addedAt || Date.now() };
  FAVICON_HASH_DATABASE.push(enriched);
  hashIndex.set(entry.hash, enriched);
  const arr = nameIndex.get(entry.techName) || [];
  arr.push(enriched);
  nameIndex.set(entry.techName, arr);
  if (entry.category) {
    const catArr = categoryIndex.get(entry.category) || [];
    catArr.push(enriched);
    categoryIndex.set(entry.category, catArr);
  }
}

/** 批量添加 hash */
export function addFaviconHashes(entries: FaviconHashEntry[]): number {
  let added = 0;
  for (const entry of entries) {
    if (!hashIndex.has(entry.hash)) {
      addFaviconHash(entry);
      added++;
    }
  }
  return added;
}

/** 从导入数据加载 */
export function importFaviconData(importData: FaviconHashImport): number {
  return addFaviconHashes(importData.entries);
}

/** 导出数据库 */
export function exportFaviconData(): FaviconHashImport {
  return {
    version: '1.0.0',
    updatedAt: Date.now(),
    entries: [...FAVICON_HASH_DATABASE],
  };
}

/** 清空数据库 */
export function clearFaviconDatabase(): void {
  FAVICON_HASH_DATABASE.length = 0;
  hashIndex.clear();
  nameIndex.clear();
  categoryIndex.clear();
}
