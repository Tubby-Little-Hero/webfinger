import { describe, it, expect } from 'vitest';
import { 
  parseRobotsTxt, 
  parseSitemapXml, 
  getRobotsTxtUrl,
  getSitemapUrls,
  RobotsTxtAnalysis,
  SitemapAnalysis 
} from '../src/core/fingerprint/robots-analyzer';

describe('Robots.txt / Sitemap 分析测试', () => {
  
  describe('parseRobotsTxt', () => {
    it('应该解析基本的 robots.txt', () => {
      const content = `User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /public/
Sitemap: https://example.com/sitemap.xml`;

      const result = parseRobotsTxt(content);
      
      expect(result.exists).toBe(true);
      expect(result.sitemaps).toContain('https://example.com/sitemap.xml');
      expect(result.disallowPaths).toContain('/admin/');
      expect(result.disallowPaths).toContain('/private/');
      expect(result.allowPaths).toContain('/public/');
    });

    it('应该检测后台路径', () => {
      const content = `User-agent: *
Disallow: /wp-admin/
Disallow: /phpmyadmin/`;

      const result = parseRobotsTxt(content);
      
      expect(result.techHints.some(h => h.includes('wp-admin'))).toBe(true);
      expect(result.techHints.some(h => h.includes('phpmyadmin'))).toBe(true);
    });

    it('应该检测 CMS 指纹', () => {
      const content = `User-agent: *
Disallow: /wp-content/
Disallow: /drupal/`;

      const result = parseRobotsTxt(content);
      
      expect(result.techHints.some(h => h.includes('WordPress'))).toBe(true);
      expect(result.techHints.some(h => h.includes('Drupal'))).toBe(true);
    });

    it('应该忽略注释', () => {
      const content = `# This is a comment
User-agent: *
# Another comment
Disallow: /admin/`;

      const result = parseRobotsTxt(content);
      
      expect(result.disallowPaths).toContain('/admin/');
      expect(result.disallowPaths.length).toBe(1);
    });

    it('应该处理空内容', () => {
      const result = parseRobotsTxt('');
      
      expect(result.exists).toBe(true);
      expect(result.disallowPaths.length).toBe(0);
      expect(result.sitemaps.length).toBe(0);
    });

    it('应该处理多个 User-agent', () => {
      const content = `User-agent: Googlebot
Disallow: /admin/
User-agent: Bingbot
Disallow: /private/`;

      const result = parseRobotsTxt(content);
      
      expect(result.userAgents).toContain('Googlebot');
      expect(result.userAgents).toContain('Bingbot');
    });
  });

  describe('parseSitemapXml', () => {
    it('应该解析基本的 sitemap', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/about</loc>
  </url>
</urlset>`;

      const result = parseSitemapXml(content);
      
      expect(result.exists).toBe(true);
      expect(result.urlCount).toBe(2);
      expect(result.urlExamples).toContain('https://example.com/');
      expect(result.urlExamples).toContain('https://example.com/about');
    });

    it('应该检测 URL 模式', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/2024/01/01/article1.html</loc></url>
  <url><loc>https://example.com/2024-01-02/article2.php</loc></url>
</urlset>`;

      const result = parseSitemapXml(content);
      
      expect(result.urlPatterns.some(p => p.includes('日期路径格式'))).toBe(true);
      expect(result.urlPatterns.some(p => p.includes('HTML'))).toBe(true);
      expect(result.urlPatterns.some(p => p.includes('PHP'))).toBe(true);
    });

    it('应该检测技术指纹', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/wp-content/uploads/2024/image.jpg</loc></url>
  <url><loc>https://example.com/wp-admin/</loc></url>
</urlset>`;

      const result = parseSitemapXml(content);
      
      expect(result.techHints.some(h => h.includes('WordPress'))).toBe(true);
    });

    it('应该处理空的 sitemap', () => {
      const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

      const result = parseSitemapXml(content);
      
      expect(result.exists).toBe(true);
      expect(result.urlCount).toBe(0);
    });
  });

  describe('getRobotsTxtUrl', () => {
    it('应该生成正确的 robots.txt URL', () => {
      expect(getRobotsTxtUrl('https://example.com/page')).toBe('https://example.com/robots.txt');
      expect(getRobotsTxtUrl('http://example.com:8080/path')).toBe('http://example.com:8080/robots.txt');
    });

    it('应该处理无效 URL', () => {
      expect(getRobotsTxtUrl('invalid-url')).toBe('');
    });
  });

  describe('getSitemapUrls', () => {
    it('应该返回多个可能的 sitemap URL', () => {
      const urls = getSitemapUrls('https://example.com/page');
      
      expect(urls).toContain('https://example.com/sitemap.xml');
      expect(urls).toContain('https://example.com/sitemap_index.xml');
      expect(urls.length).toBeGreaterThan(3);
    });

    it('应该处理无效 URL', () => {
      const urls = getSitemapUrls('invalid-url');
      expect(urls.length).toBe(0);
    });
  });
});
