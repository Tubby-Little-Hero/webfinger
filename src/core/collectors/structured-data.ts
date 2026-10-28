import type { MetaTag } from '../types';

export interface StructuredData {
  type: string;
  data: Record<string, unknown>;
}

export interface OGMetadata {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
}

export interface TwitterCard {
  card?: string;
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
}

export interface PageMetadata {
  jsonLd: StructuredData[];
  og: OGMetadata;
  twitter: TwitterCard;
  canonicalUrl?: string;
  sitemapUrls: string[];
  hasDoctype: boolean;
  charset?: string;
  language?: string;
  viewport?: string;
  robots?: string;
}

export function collectStructuredData(doc: Document): StructuredData[] {
  const results: StructuredData[] = [];

  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const text = script.textContent || '';
      if (!text.trim()) continue;

      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item && typeof item === 'object') {
          results.push({
            type: item['@type'] || item['@context'] || 'Unknown',
            data: item,
          });
        }
      }
    } catch {
      const text = (script.textContent || '').trim();
      if (text.length > 10 && text.length < 100000) {
        results.push({
          type: 'jsonld-invalid',
          data: { raw: text.substring(0, 500) },
        });
      }
    }
  }

  const jsonScripts = doc.querySelectorAll('script[type="application/json"]');
  for (const script of jsonScripts) {
    try {
      const text = script.textContent || '';
      if (!text.trim() || text.length > 500000) continue;

      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        results.push({
          type: 'json',
          data: parsed,
        });
      }
    } catch {
    }
  }

  return results;
}

export function collectOGMetadata(doc: Document): OGMetadata {
  const og: OGMetadata = {};
  const metaTags = doc.querySelectorAll('meta[property^="og:"]');

  for (const tag of metaTags) {
    const property = tag.getAttribute('property') || '';
    const content = tag.getAttribute('content') || '';

    switch (property) {
      case 'og:title':
        og.title = content;
        break;
      case 'og:description':
        og.description = content;
        break;
      case 'og:image':
        og.image = content;
        break;
      case 'og:url':
        og.url = content;
        break;
      case 'og:type':
        og.type = content;
        break;
      case 'og:site_name':
        og.siteName = content;
        break;
    }
  }

  return og;
}

export function collectTwitterCard(doc: Document): TwitterCard {
  const card: TwitterCard = {};
  const metaTags = doc.querySelectorAll('meta[name^="twitter:"]');

  for (const tag of metaTags) {
    const name = tag.getAttribute('name') || '';
    const content = tag.getAttribute('content') || '';

    switch (name) {
      case 'twitter:card':
        card.card = content;
        break;
      case 'twitter:site':
        card.site = content;
        break;
      case 'twitter:creator':
        card.creator = content;
        break;
      case 'twitter:title':
        card.title = content;
        break;
      case 'twitter:description':
        card.description = content;
        break;
      case 'twitter:image':
        card.image = content;
        break;
    }
  }

  return card;
}

export function collectPageMetadata(doc: Document): PageMetadata {
  const jsonLd = collectStructuredData(doc);
  const og = collectOGMetadata(doc);
  const twitter = collectTwitterCard(doc);

  let canonicalUrl: string | undefined;
  const canonicalLink = doc.querySelector('link[rel="canonical"]');
  if (canonicalLink) {
    canonicalUrl = canonicalLink.getAttribute('href') || undefined;
  }

  const sitemapUrls: string[] = [];
  const sitemapLinks = doc.querySelectorAll('link[rel="sitemap"]');
  for (const link of sitemapLinks) {
    const href = link.getAttribute('href');
    if (href) sitemapUrls.push(href);
  }

  let charset: string | undefined;
  const metaCharset = doc.querySelector('meta[charset]');
  if (metaCharset) {
    charset = metaCharset.getAttribute('charset') || undefined;
  }

  let language: string | undefined;
  const htmlTag = doc.documentElement;
  language = htmlTag.getAttribute('lang') || undefined;

  let viewport: string | undefined;
  const metaViewport = doc.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    viewport = metaViewport.getAttribute('content') || undefined;
  }

  let robots: string | undefined;
  const metaRobots = doc.querySelector('meta[name="robots"]');
  if (metaRobots) {
    robots = metaRobots.getAttribute('content') || undefined;
  }

  return {
    jsonLd,
    og,
    twitter,
    canonicalUrl,
    sitemapUrls,
    hasDoctype: !!doc.doctype,
    charset,
    language,
    viewport,
    robots,
  };
}

export function getJsonLdTypes(doc: Document): string[] {
  const types: string[] = [];
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const text = script.textContent || '';
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (item && item['@type']) {
          const t = item['@type'];
          if (Array.isArray(t)) {
            types.push(...t);
          } else {
            types.push(String(t));
          }
        }
      }
    } catch {
    }
  }

  return [...new Set(types)];
}

export function getMetaTags(doc: Document): MetaTag[] {
  const metaTags: MetaTag[] = [];
  const elements = doc.querySelectorAll('meta');

  for (const el of elements) {
    const name = el.getAttribute('name') || el.getAttribute('property') || '';
    const content = el.getAttribute('content') || '';
    const property = el.getAttribute('property') || undefined;

    if (name || content) {
      metaTags.push({ name, content, property });
    }
  }

  return metaTags;
}
