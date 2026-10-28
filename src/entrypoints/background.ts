// ============================================================
// WebFinger - Background Service Worker
// 核心调度器：拦截请求、协调数据采集、执行规则匹配、
//           漏洞情报查询、AI分析
// ============================================================

import type {
  CollectedPageData,
  ResponseHeaders,
  DetectionResult,
  VulnerabilityResult,
  AIAnalysisResult,
  AIAnalysisRequest,
} from '../core/types';
import { Analyzer } from '../core/analyzer';
import { parseResponseHeaders } from '../core/collectors/headers';
import { lookupVulnerabilities } from '../core/vulnerability/lookup';
import { cleanVulnCache } from '../core/vulnerability/lookup';
import { getAIConfig } from '../core/ai/ai-config';
import {
  analyzeVulnExploitability,
  analyzeOverallRisk,
  analyzeAttackSurface,
} from '../core/ai/ai-client';
import allRules from '../rules/index';

export default defineBackground(() => {
  // 初始化分析器
  const analyzer = new Analyzer();
  analyzer.loadRules(allRules);
  console.log(`[WebFinger] Loaded ${Object.keys(allRules).length} technology rules`);

  // Tab 状态存储
  interface TabState {
    url: string;
    hostname: string;
    responseHeaders: ResponseHeaders;
    pageData: CollectedPageData | null;
    result: DetectionResult | null;
    vulnResult: VulnerabilityResult | null;
    scanned: boolean;
    scanning: boolean;
    vulnLoading: boolean;
  }

  const tabStates = new Map<number, TabState>();

  function getOrCreateTabState(tabId: number, url: string): TabState {
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch {}

    const existing = tabStates.get(tabId);
    
    // 如果 tab 已存在但 URL 发生变化，重置状态
    if (existing && existing.url !== url) {
      // URL 变化，创建新的状态，保留 tabId
      console.debug('[WebFinger] Tab URL changed, resetting state:', existing.url, '→', url);
      const newState: TabState = {
        url,
        hostname,
        responseHeaders: {},
        pageData: null,
        result: null,
        vulnResult: null,
        scanned: false,
        scanning: false,
        vulnLoading: false,
      };
      tabStates.set(tabId, newState);
      return newState;
    }
    
    if (!existing) {
      const newState: TabState = {
        url,
        hostname,
        responseHeaders: {},
        pageData: null,
        result: null,
        vulnResult: null,
        scanned: false,
        scanning: false,
        vulnLoading: false,
      };
      tabStates.set(tabId, newState);
      return newState;
    }
    
    return existing;
  }

  /** 向 content script 请求页面数据 */
  async function requestPageData(tabId: number): Promise<CollectedPageData | null> {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      }).catch(() => {});
      const response = await browser.tabs.sendMessage(tabId, { type: 'COLLECT_PAGE_DATA' });
      return response?.data || null;
    } catch {
      return null;
    }
  }

  // ---- 网络拦截：采集响应头 ----
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      if (details.type !== 'main_frame' || details.tabId < 0) return;
      const state = getOrCreateTabState(details.tabId, details.url);
      state.responseHeaders = parseResponseHeaders(details.responseHeaders);
      state.url = details.url;
    },
    { urls: ['*://*/*'], types: ['main_frame'] },
    ['responseHeaders']
  );

  // ---- 页面载入完成后触发扫描 ----
  browser.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0 || details.tabId < 0) return;
    const tabId = details.tabId;
    const state = getOrCreateTabState(tabId, details.url);
    if (state.scanning) return;
    state.scanning = true;

    try {
      const pageData = await requestPageData(tabId);
      if (pageData) {
        state.pageData = pageData;
        state.result = await analyzer.analyze(pageData, state.responseHeaders);
        const count = state.result.technologies.length;
        browser.action.setBadgeText({ tabId, text: count > 0 ? count.toString() : '' });
        browser.action.setBadgeBackgroundColor({ color: '#6366f1' });
        console.log(`[WebFinger] ${state.hostname}: detected ${count} technologies`);

        // 自动触发漏洞查询（后台静默加载）
        triggerVulnLookup(tabId, state);
      }
      state.scanned = true;
    } catch (err) {
      console.error('[WebFinger] Scan error:', err);
    } finally {
      state.scanning = false;
    }
  });

  /** 后台自动查询漏洞 */
  async function triggerVulnLookup(tabId: number, state: TabState) {
    if (!state.result || state.vulnLoading) return;
    const techs = state.result.technologies;
    if (techs.length === 0) return;

    state.vulnLoading = true;
    try {
      const vulnResult = await lookupVulnerabilities(techs);
      state.vulnResult = vulnResult;
      console.log(`[WebFinger] ${state.hostname}: found ${vulnResult.totalCount} vulnerabilities`);
    } catch (err) {
      console.error('[WebFinger] Vuln lookup error:', err);
    } finally {
      state.vulnLoading = false;
    }
  }

  // ---- 消息处理 ----
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse);
    return true;
  });

  async function handleMessage(message: any): Promise<any> {
    switch (message.type) {
      case 'GET_DETECTIONS': {
        const state = tabStates.get(message.tabId);
        if (state?.result) {
          return {
            type: 'DETECTIONS_RESULT',
            result: state.result,
            vulnLoading: state.vulnLoading,
          };
        }
        if (state?.scanning) {
          return { type: 'SCAN_TRIGGERED' };
        }
        if (message.tabId) {
          try {
            const pageData = await requestPageData(message.tabId);
            if (pageData && state) {
              state.pageData = pageData;
              state.result = await analyzer.analyze(pageData, state.responseHeaders);
              state.scanned = true;
              // 后台触发漏洞查询
              triggerVulnLookup(message.tabId, state);
              return {
                type: 'DETECTIONS_RESULT',
                result: state.result,
                vulnLoading: state.vulnLoading,
              };
            }
          } catch {}
        }
        return { type: 'ERROR', message: 'No data available' };
      }

      case 'PAGE_DATA': {
        const state = tabStates.get(message.tabId);
        if (state && message.data) {
          state.pageData = message.data;
        }
        return { type: 'ACK' };
      }

      case 'RESCAN_PAGE': {
        const state = tabStates.get(message.tabId);
        if (state) {
          state.scanned = false;
          state.scanning = false;
          state.result = null;
          state.vulnResult = null;
          state.vulnLoading = false;
        }
        return { type: 'SCAN_TRIGGERED' };
      }

      // ============================================================
      // 漏洞情报
      // ============================================================
      case 'GET_VULNERABILITIES': {
        const state = tabStates.get(message.tabId);

        // 如果已有缓存，直接返回
        if (state?.vulnResult) {
          return { type: 'VULNERABILITIES_RESULT', result: state.vulnResult };
        }

        // 如果正在加载，返回 loading 状态
        if (state?.vulnLoading) {
          return { type: 'VULN_LOADING' };
        }

        // 需要查询
        if (state?.result?.technologies.length) {
          try {
            state.vulnLoading = true;
            const vulnResult = await lookupVulnerabilities(state.result.technologies);
            state.vulnResult = vulnResult;
            state.vulnLoading = false;
            return { type: 'VULNERABILITIES_RESULT', result: vulnResult };
          } catch (err: any) {
            state.vulnLoading = false;
            return { type: 'ERROR', message: `漏洞查询失败: ${err.message}` };
          }
        }

        // 无技术栈数据
        return {
          type: 'VULNERABILITIES_RESULT',
          result: {
            technologies: [],
            totalCount: 0,
            criticalCount: 0,
            highCount: 0,
          } as VulnerabilityResult,
        };
      }

      // ============================================================
      // AI 分析
      // ============================================================
      case 'AI_ANALYZE': {
        const request = message.request as AIAnalysisRequest;
        const state = tabStates.get(message.tabId);

        try {
          const aiConfig = await getAIConfig();
          if (!aiConfig.enabled) {
            return {
              type: 'AI_ANALYSIS_RESULT',
              result: {
                type: request.type,
                content: '',
                model: '',
                provider: aiConfig.provider,
                timestamp: Date.now(),
                error: 'AI 功能未启用，请在设置中配置 API Key',
              } as AIAnalysisResult,
            };
          }

          switch (request.type) {
            case 'vuln-analysis': {
              // 从漏洞数据中找到对应的漏洞详情
              let cveId = request.context.cveId || 'CVE-Unknown';
              let cvssScore = 0;
              let description = '';
              let affectedVersions = '';

              if (state?.vulnResult && message.vulnId) {
                for (const tech of state.vulnResult.technologies) {
                  const vuln = tech.vulnerabilities.find((v) => v.id === message.vulnId);
                  if (vuln) {
                    cveId = vuln.id;
                    cvssScore = vuln.cvssScore;
                    description = vuln.summary;
                    affectedVersions = vuln.affectedVersions;
                    break;
                  }
                }
              }

              const result = await analyzeVulnExploitability(
                request.context.techName,
                request.context.version,
                cveId,
                cvssScore,
                description,
                affectedVersions,
              );
              result.provider = aiConfig.provider;
              return { type: 'AI_ANALYSIS_RESULT', result };
            }

            case 'risk-assessment': {
              if (!state?.result) {
                return {
                  type: 'AI_ANALYSIS_RESULT',
                  result: {
                    type: request.type,
                    content: '',
                    model: '',
                    provider: aiConfig.provider,
                    timestamp: Date.now(),
                    error: '请先完成技术栈扫描',
                  } as AIAnalysisResult,
                };
              }

              const techList = state.result.technologies.map((t) => ({
                name: t.name,
                version: t.version,
              }));
              const vCount = state.vulnResult?.totalCount || 0;
              const cCount = state.vulnResult?.criticalCount || 0;
              const hCount = state.vulnResult?.highCount || 0;

              const result = await analyzeOverallRisk(techList, vCount, cCount, hCount);
              result.provider = aiConfig.provider;
              return { type: 'AI_ANALYSIS_RESULT', result };
            }

            case 'attack-surface': {
              if (!state?.result) {
                return {
                  type: 'AI_ANALYSIS_RESULT',
                  result: {
                    type: request.type,
                    content: '',
                    model: '',
                    provider: aiConfig.provider,
                    timestamp: Date.now(),
                    error: '请先完成技术栈扫描',
                  } as AIAnalysisResult,
                };
              }

              const techList = state.result.technologies.map((t) => {
                const catId = t.categories[0];
                const catName = getCategoryName(catId);
                return { name: t.name, version: t.version, category: catName };
              });

              const result = await analyzeAttackSurface(techList, state.responseHeaders);
              result.provider = aiConfig.provider;
              return { type: 'AI_ANALYSIS_RESULT', result };
            }

            default:
              return {
                type: 'AI_ANALYSIS_RESULT',
                result: {
                  type: request.type,
                  content: '',
                  model: '',
                  provider: aiConfig.provider,
                  timestamp: Date.now(),
                  error: `不支持的分析类型: ${request.type}`,
                } as AIAnalysisResult,
              };
          }
        } catch (err: any) {
          return {
            type: 'AI_ANALYSIS_RESULT',
            result: {
              type: request.type,
              content: '',
              model: '',
              provider: 'openai',
              timestamp: Date.now(),
              error: `AI 分析失败: ${err.message}`,
            } as AIAnalysisResult,
          };
        }
      }

      default:
        return { type: 'ERROR', message: `Unknown message type: ${message.type}` };
    }
  }

  // Tab 关闭时清理
  browser.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
  });

  // 定期清理漏洞缓存（每小时）
  setInterval(() => {
    cleanVulnCache();
  }, 60 * 60 * 1000);
});

/** 分类 ID → 名称映射（用于 AI 分析上下文） */
function getCategoryName(catId: number): string {
  const categories: Record<number, string> = {
    1: 'CMS',
    2: '论坛',
    3: '博客',
    4: 'Web框架',
    5: '前端框架',
    6: 'JavaScript库',
    7: 'Web服务器',
    8: 'CDN',
    9: 'WAF',
    10: '分析/统计',
    11: '编程语言',
    12: '数据库',
    13: '操作系统',
    14: 'SSL/TLS',
    15: '蜜罐',
    16: '其他',
  };
  return categories[catId] || '其他';
}
