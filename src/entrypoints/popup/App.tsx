// ============================================================
// WebFinger - Popup App
// 三Tab布局：技术指纹 / 漏洞情报 / AI分析
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import type {
  DetectionResult,
  VulnerabilityResult,
  AIAnalysisResult,
  AIAnalysisType,
} from '../../core/types';
import { Header } from '../../components/Header';
import { TechList } from '../../components/fingerprint/TechList';
import { VulnList } from '../../components/vulnerability/VulnList';
import { AIPanel } from '../../components/ai/AIPanel';
import { EmptyState } from '../../components/EmptyState';

type Tab = 'fingerprint' | 'vulnerabilities' | 'ai';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('fingerprint');
  const [loading, setLoading] = useState(true);
  const [vulnLoading, setVulnLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // 检测结果
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [vulnResult, setVulnResult] = useState<VulnerabilityResult | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);

  // 获取当前 tab
  const getCurrentTabId = useCallback(async (): Promise<number | null> => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      return tab?.id || null;
    } catch {
      return null;
    }
  }, []);

  // 加载检测数据
  useEffect(() => {
    loadDetections();
  }, []);

  const loadDetections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tabId = await getCurrentTabId();
      if (!tabId) {
        setError('无法获取当前标签页');
        setLoading(false);
        return;
      }

      const response = await browser.runtime.sendMessage({
        type: 'GET_DETECTIONS',
        tabId,
      });

      if (response?.type === 'DETECTIONS_RESULT') {
        setDetectionResult(response.result);
        // 后台可能已经开始查询漏洞了
        if (response.vulnLoading) {
          setVulnLoading(true);
        }
      } else if (response?.type === 'SCAN_TRIGGERED') {
        // 扫描已触发，稍后再试
        setError(null);
      } else if (response?.type === 'ERROR') {
        setError(response.message);
      }
    } catch (e: any) {
      setError(e?.message || '通信失败，请刷新页面后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载漏洞数据
  const loadVulnerabilities = useCallback(async () => {
    setVulnLoading(true);
    try {
      const tabId = await getCurrentTabId();
      if (!tabId) return;

      const response = await browser.runtime.sendMessage({
        type: 'GET_VULNERABILITIES',
        tabId,
      });

      if (response?.type === 'VULNERABILITIES_RESULT') {
        setVulnResult(response.result);
        setVulnLoading(false);
      } else if (response?.type === 'VULN_LOADING') {
        // 后台正在查询，保持 loading 状态
        setVulnLoading(true);
        // 3秒后重试
        setTimeout(() => loadVulnerabilities(), 3000);
      }
    } catch (e) {
      setVulnLoading(false);
    }
  }, []);

  // Tab 切换时加载对应数据
  useEffect(() => {
    if (activeTab === 'vulnerabilities' && !vulnResult && !vulnLoading) {
      loadVulnerabilities();
    }
  }, [activeTab]);

  // AI 分析处理
  const handleAIAnalyze = useCallback(
    async (request: { type: string; cveId?: string; techName?: string; version?: string }) => {
      setAiLoading(true);
      setAiResult(null);
      try {
        const tabId = await getCurrentTabId();
        if (!tabId) throw new Error('无法获取当前标签页');

        const analysisType: AIAnalysisType = request.type as AIAnalysisType;

        const response = await browser.runtime.sendMessage({
          type: 'AI_ANALYZE',
          tabId,
          request: {
            type: analysisType,
            context: {
              techName: request.techName || '',
              version: request.version,
              cveId: request.cveId,
              allTechnologies: detectionResult?.technologies || [],
            },
          },
          vulnId: request.cveId,
        });

        if (response?.type === 'AI_ANALYSIS_RESULT') {
          setAiResult(response.result);
        } else if (response?.type === 'ERROR') {
          setAiResult({
            type: analysisType,
            content: '',
            model: '',
            provider: 'openai',
            timestamp: Date.now(),
            error: response.message,
          });
        }
      } catch (err: any) {
        setAiResult({
          type: request.type as AIAnalysisType,
          content: '',
          model: '',
          provider: 'openai',
          timestamp: Date.now(),
          error: err?.message || '分析请求失败',
        });
      } finally {
        setAiLoading(false);
      }
    },
    [detectionResult]
  );

  const tabs: Array<{ key: Tab; label: string; badge?: number }> = [
    { key: 'fingerprint', label: '技术指纹', badge: detectionResult?.technologies.length },
    { key: 'vulnerabilities', label: '漏洞情报', badge: vulnResult?.totalCount },
    { key: 'ai', label: 'AI分析' },
  ];

  return (
    <div className="popup-container flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <Header
        hostname={detectionResult?.hostname || ''}
        url={detectionResult?.url || ''}
        loading={loading}
        onRefresh={loadDetections}
      />

      {/* Tab Bar */}
      <div className="flex border-b border-[#1e1e2e] bg-[#0a0a0f]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2.5 text-[13px] font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] ${
                activeTab === tab.key
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'bg-gray-800 text-gray-400'
              }`}>
                {tab.badge}
              </span>
            )}
            {vulnLoading && tab.key === 'vulnerabilities' && (
              <span className="ml-1 inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-indigo-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: '430px' }}>
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-gray-400">正在分析...</span>
            </div>
          </div>
        )}

        {error && (
          <EmptyState
            icon="⚠️"
            title="分析失败"
            description={error}
            action={{ label: '重试', onClick: loadDetections }}
          />
        )}

        {!loading && !error && activeTab === 'fingerprint' && (
          <TechList result={detectionResult} />
        )}

        {!loading && !error && activeTab === 'vulnerabilities' && (
          vulnLoading && !vulnResult ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">正在查询漏洞数据库...</span>
                <span className="text-xs text-gray-500">NVD · OSV · CNVD</span>
              </div>
            </div>
          ) : (
            <VulnList
              result={vulnResult}
              loading={vulnLoading}
              onRefresh={loadVulnerabilities}
            />
          )
        )}

        {!loading && !error && activeTab === 'ai' && (
          aiLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">AI 分析中...</span>
                <span className="text-xs text-gray-500">这可能需要 10-30 秒</span>
              </div>
            </div>
          ) : (
            <AIPanel
              result={aiResult}
              detectionResult={detectionResult}
              vulnResult={vulnResult}
              onAnalyze={handleAIAnalyze}
            />
          )
        )}
      </div>

      {/* Footer */}
      {!loading && detectionResult && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1e1e2e] bg-[#14141f]">
          <span className="text-[11px] text-gray-500">
            检测到 <strong className="text-gray-300">{detectionResult.technologies.length}</strong> 项技术
            {detectionResult.securityHeaders.filter(h => h.present).length > 0 &&
              ` · ${detectionResult.securityHeaders.filter(h => h.present).length} 安全头`
            }
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                JSON.stringify(detectionResult.technologies, null, 2)
              );
            }}
            className="text-[11px] text-gray-400 hover:text-indigo-400 transition-colors"
          >
            复制 JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
