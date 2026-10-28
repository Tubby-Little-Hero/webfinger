#!/usr/bin/env node
// ============================================================
// WebFinger - Favicon Hash Generator
// 批量生成网站 favicon 的 MurmurHash3 hash
// 用于扩展指纹识别数据库
// ============================================================

import { computeFaviconHash, addFaviconHash } from '../src/core/fingerprint/favicon-hash-db';
import type { FaviconHashEntry } from '../src/core/fingerprint/favicon-hash-db';

/** 预定义的技术列表（基于 Wappalyzer 数据） */
const TECH_LIST: Array<{ name: string; category: string; url: string; confidence: number }> = [
  // CDN / 云服务
  { name: 'Cloudflare', category: 'CDN', url: 'https://www.cloudflare.com/favicon.ico', confidence: 95 },
  { name: 'Amazon CloudFront', category: 'CDN', url: 'https://aws.amazon.com/favicon.ico', confidence: 90 },
  { name: 'Akamai', category: 'CDN', url: 'https://www.akamai.com/favicon.ico', confidence: 85 },
  { name: 'Varnish', category: 'CDN', url: 'https://varnish-cache.org/favicon.ico', confidence: 85 },
  { name: 'CDN77', category: 'CDN', url: 'https://www.cdn77.com/favicon.ico', confidence: 80 },
  { name: 'Incapsula', category: 'CDN', url: 'https://www.incapsula.com/favicon.ico', confidence: 80 },
  { name: 'Imperva', category: 'CDN', url: 'https://www.imperva.com/favicon.ico', confidence: 80 },
  
  // CMS
  { name: 'WordPress', category: 'CMS', url: 'https://wordpress.org/favicon.ico', confidence: 90 },
  { name: 'Drupal', category: 'CMS', url: 'https://www.drupal.org/favicon.ico', confidence: 90 },
  { name: 'Joomla', category: 'CMS', url: 'https://www.joomla.org/favicon.ico', confidence: 90 },
  { name: 'Magento', category: 'CMS', url: 'https://magento.com/favicon.ico', confidence: 90 },
  { name: 'Shopify', category: 'CMS', url: 'https://www.shopify.com/favicon.ico', confidence: 90 },
  { name: 'Ghost', category: 'CMS', url: 'https://ghost.org/favicon.ico', confidence: 85 },
  { name: 'Bitrix', category: 'CMS', url: 'https://bitrix.org/favicon.ico', confidence: 85 },
  { name: 'TYPO3', category: 'CMS', url: 'https://typo3.org/favicon.ico', confidence: 85 },
  { name: 'PrestaShop', category: 'CMS', url: 'https://www.prestashop.com/favicon.ico', confidence: 85 },
  
  // 中国 CMS
  { name: 'Discuz!', category: 'CMS', url: 'https://www.discuz.net/favicon.ico', confidence: 90 },
  { name: 'DedeCMS', category: 'CMS', url: 'https://www.dedecms.com/favicon.ico', confidence: 85 },
  
  // Web 服务器
  { name: 'Nginx', category: 'Server', url: 'https://nginx.org/favicon.ico', confidence: 80 },
  { name: 'Apache', category: 'Server', url: 'https://httpd.apache.org/favicon.ico', confidence: 80 },
  { name: 'IIS', category: 'Server', url: 'https://www.iis.net/favicon.ico', confidence: 80 },
  { name: 'Caddy', category: 'Server', url: 'https://caddyserver.com/favicon.ico', confidence: 85 },
  { name: 'LiteSpeed', category: 'Server', url: 'https://www.litespeedtech.com/favicon.ico', confidence: 80 },
  { name: 'Tomcat', category: 'Server', url: 'https://tomcat.apache.org/favicon.ico', confidence: 80 },
  
  // 框架
  { name: 'Laravel', category: 'Framework', url: 'https://laravel.com/favicon.ico', confidence: 85 },
  { name: 'Spring Boot', category: 'Framework', url: 'https://spring.io/favicon.ico', confidence: 85 },
  { name: 'Express.js', category: 'Framework', url: 'https://expressjs.com/favicon.ico', confidence: 75 },
  { name: 'Django', category: 'Framework', url: 'https://www.djangoproject.com/favicon.ico', confidence: 80 },
  { name: 'Flask', category: 'Framework', url: 'https://flask.palletsprojects.com/favicon.ico', confidence: 75 },
  { name: 'ASP.NET', category: 'Framework', url: 'https://dotnet.microsoft.com/favicon.ico', confidence: 80 },
  { name: 'Rails', category: 'Framework', url: 'https://rubyonrails.org/favicon.ico', confidence: 80 },
  { name: 'Phoenix', category: 'Framework', url: 'https://www.phoenixframework.org/favicon.ico', confidence: 75 },
  
  // 前端框架
  { name: 'React', category: 'Framework', url: 'https://react.dev/favicon.ico', confidence: 80 },
  { name: 'Vue.js', category: 'Framework', url: 'https://vuejs.org/favicon.ico', confidence: 80 },
  { name: 'Angular', category: 'Framework', url: 'https://angular.io/favicon.ico', confidence: 75 },
  { name: 'Next.js', category: 'Framework', url: 'https://nextjs.org/favicon.ico', confidence: 82 },
  { name: 'Nuxt.js', category: 'Framework', url: 'https://nuxt.com/favicon.ico', confidence: 82 },
  
  // 分析工具
  { name: 'Google Analytics', category: 'Analytics', url: 'https://analytics.google.com/favicon.ico', confidence: 70 },
  { name: 'Google Tag Manager', category: 'Analytics', url: 'https://tagmanager.google.com/favicon.ico', confidence: 65 },
  { name: 'Baidu Tongji', category: 'Analytics', url: 'https://tongji.baidu.com/favicon.ico', confidence: 85 },
  { name: 'CNZZ', category: 'Analytics', url: 'https://www.cnzz.com/favicon.ico', confidence: 85 },
  { name: 'Plausible', category: 'Analytics', url: 'https://plausible.io/favicon.ico', confidence: 70 },
  { name: 'Matomo', category: 'Analytics', url: 'https://matomo.org/favicon.ico', confidence: 72 },
  
  // DevOps
  { name: 'GitLab', category: 'DevOps', url: 'https://gitlab.com/favicon.ico', confidence: 85 },
  { name: 'GitHub', category: 'DevOps', url: 'https://github.com/favicon.ico', confidence: 85 },
  { name: 'Jenkins', category: 'DevOps', url: 'https://www.jenkins.io/favicon.ico', confidence: 80 },
  { name: 'Docker', category: 'DevOps', url: 'https://www.docker.com/favicon.ico', confidence: 70 },
  { name: 'Vercel', category: 'DevOps', url: 'https://vercel.com/favicon.ico', confidence: 75 },
  { name: 'Netlify', category: 'DevOps', url: 'https://www.netlify.com/favicon.ico', confidence: 75 },
  
  // 安全
  { name: 'Sucuri', category: 'Security', url: 'https://sucuri.net/favicon.ico', confidence: 80 },
  { name: 'Cloudflare', category: 'Security', url: 'https://www.cloudflare.com/favicon.ico', confidence: 82 },
];

/**
 * 获取 favicon 并计算 hash
 */
async function fetchAndHash(url: string): Promise<{ hash: number; size: number } | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    if (data.length === 0 || data.length > 256 * 1024) return null;

    const hash = computeFaviconHash(data);
    return { hash, size: data.length };
  } catch {
    return null;
  }
}

/**
 * 生成所有技术的 favicon hash
 */
async function generateAll(
  concurrency: number = 5
): Promise<FaviconHashEntry[]> {
  const results: FaviconHashEntry[] = [];
  const queue = [...TECH_LIST];
  
  console.log(`开始生成 ${queue.length} 个技术的 favicon hash (并发: ${concurrency})...\n`);

  let completed = 0;
  let failed = 0;

  async function worker() {
    while (queue.length > 0) {
      const tech = queue.shift()!;
      const result = await fetchAndHash(tech.url);
      
      completed++;
      
      if (result) {
        const entry: FaviconHashEntry = {
          hash: result.hash,
          techName: tech.name,
          confidence: tech.confidence,
          category: tech.category,
          description: `Favicon hash for ${tech.name} (${result.size} bytes)`,
          source: 'auto',
          addedAt: Date.now(),
          tags: ['auto-generated'],
        };
        results.push(entry);
        console.log(`  ✅ [${completed}/${TECH_LIST.length}] ${tech.name}: hash=${result.hash} (${result.size} bytes)`);
      } else {
        failed++;
        console.log(`  ❌ [${completed}/${TECH_LIST.length}] ${tech.name}: 获取失败`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  console.log(`\n完成: 成功 ${results.length}, 失败 ${failed}`);
  return results;
}

/**
 * 输出为 JavaScript 可导入的格式
 */
function exportAsModule(entries: FaviconHashEntry[]): string {
  return `// 自动生成的 favicon hash 数据
// 生成时间: ${new Date().toISOString()}
// 技术数量: ${entries.length}

export const AUTO_GENERATED_HASHES: FaviconHashEntry[] = ${JSON.stringify(entries, null, 2)};
`;
}

// 主程序
if (require.main === module) {
  const args = process.argv.slice(2);
  const concurrency = parseInt(args.find((_, i) => args[i - 1] === '--concurrency') || '5', 10);

  generateAll(concurrency)
    .then((entries) => {
      // 输出摘要
      const byCategory: Record<string, number> = {};
      const byTech: Record<string, number> = {};
      
      for (const entry of entries) {
        byCategory[entry.category || 'Unknown'] = (byCategory[entry.category || 'Unknown'] || 0) + 1;
        byTech[entry.techName] = (byTech[entry.techName] || 0) + 1;
      }

      console.log('\n📊 统计摘要:');
      console.log(`  总条目: ${entries.length}`);
      console.log(`  技术数量: ${Object.keys(byTech).length}`);
      console.log('\n  分类:');
      for (const [cat, count] of Object.entries(byCategory)) {
        console.log(`    - ${cat}: ${count}`);
      }

      // 如果有 --output 参数，写入文件
      const outputIdx = args.indexOf('--output');
      if (outputIdx >= 0 && args[outputIdx + 1]) {
        const fs = require('fs');
        const output = exportAsModule(entries);
        fs.writeFileSync(args[outputIdx + 1], output, 'utf-8');
        console.log(`\n📄 已写入: ${args[outputIdx + 1]}`);
      }
    })
    .catch((err) => {
      console.error('生成失败:', err);
      process.exit(1);
    });
}

export { generateAll, fetchAndHash, exportAsModule };
