import React, { useState, useEffect } from 'react';
import type { DetectionResult, VulnerabilityResult, AIAnalysisResult } from '../../core/types';
import { EmptyState } from '../EmptyState';

interface AIPanelProps {
  result: AIAnalysisResult | null;
  detectionResult: DetectionResult | null;
  vulnResult: VulnerabilityResult | null;
  onAnalyze: (request: {
    type: string;
    cveId?: string;
    techName?: string;
    version?: string;
  }) => Promise<void>;
}

const SCENARIOS = [
  {
    id: 'risk-assessment',
    name: '综合风险评估',
    icon: '📊',
    description: '基于已识别的技术栈 + 全部漏洞进行总体风险评估',
    requiresTech: true,
  },
  {
    id: 'attack-surface',
    name: '攻击面分析',
    icon: '🎯',
    description: '分析当前技术栈组合可能存在的攻击路径',
    requiresTech: true,
  },
];

export const AIPanel: React.FC<AIPanelProps> = ({
  result,
  detectionResult,
  vulnResult,
  onAnalyze,
}) => {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAIConfig();
  }, []);

  const checkAIConfig = async () => {
    try {
      const { getAIConfig } = await import('../../core/ai/ai-config');
      const config = await getAIConfig();
      setAiConfigured(config.enabled && !!config.apiKey);
    } catch {
      setAiConfigured(false);
    }
  };

  const handleAnalyze = async (scenarioId: string) => {
    setAnalyzing(true);
    setError(null);
    try {
      await onAnalyze({ type: scenarioId });
    } catch (err: any) {
      setError(err.message || '分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  // 加载中
  if (aiConfigured === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // AI 未配置
  if (!aiConfigured) {
    return (
      <div className="py-4 px-3">
        <EmptyState
          icon="🤖"
          title="AI 分析未启用"
          description="接入你自己的 AI 模型来辅助分析漏洞的可利用性和攻击面。支持 OpenAI、DeepSeek、Anthropic Claude、智谱GLM-4、Moonshot 等模型。"
        />
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] text-gray-600 mb-2">支持的模型:</p>
          {[
            { name: 'OpenAI', models: 'GPT-4o / GPT-4' },
            { name: 'DeepSeek', models: 'deepseek-chat / deepseek-reasoner' },
            { name: 'Anthropic', models: 'Claude 4 Sonnet' },
            { name: '智谱AI', models: 'GLM-4 / GLM-4-Flash' },
            { name: 'Moonshot', models: 'moonshot-v1-8k' },
            { name: '自定义', models: 'OpenAI 兼容接口' },
          ].map((p) => (
            <div key={p.name} className="flex justify-between text-[10px] text-gray-500">
              <span>• {p.name}</span>
              <span className="text-gray-600">{p.models}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => browser.runtime.openOptionsPage?.()}
          className="w-full mt-4 py-2 rounded-lg bg-indigo-600/20 text-xs text-indigo-400
                     hover:bg-indigo-600/30 transition-colors font-medium"
        >
          前往设置 → 配置AI
        </button>
      </div>
    );
  }

  // 展示 AI 分析结果
  if (result) {
    const typeLabels: Record<string, string> = {
      'vuln-analysis': '漏洞可利用性分析',
      'risk-assessment': '综合风险评估',
      'attack-surface': '攻击面分析',
    };

    return (
      <div className="py-3 px-3">
        <div className="rounded-lg bg-[#14141f] border border-[#1e1e2e] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🤖</span>
            <span className="text-xs font-medium text-gray-300">
              {typeLabels[result.type] || 'AI 分析'}
            </span>
            {result.model && (
              <span className="text-[10px] text-gray-600">({result.model})</span>
            )}
            {result.duration !== undefined && (
              <span className="text-[10px] text-gray-600 ml-auto">{result.duration}ms</span>
            )}
          </div>

          {result.error ? (
            <div className="text-[11px] text-red-400 py-2">
              错误: {result.error}
            </div>
          ) : (
            <div className="text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {result.content}
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-[#1e1e2e] flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              ⚠️ AI 分析仅供参考，不构成安全建议
            </span>
            <button
              onClick={() => window.location.reload()}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              重新分析
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 选择分析场景
  return (
    <div className="py-4 px-3">
      <p className="text-xs text-gray-500 text-center mb-4">
        选择 AI 分析场景
      </p>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {SCENARIOS.map((scenario) => {
          const disabled = scenario.requiresTech && !detectionResult?.technologies.length;
          const techCount = detectionResult?.technologies.length || 0;
          const vulnCount = vulnResult?.totalCount || 0;

          return (
            <button
              key={scenario.id}
              disabled={disabled || analyzing}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                disabled
                  ? 'bg-[#14141f]/50 border border-[#1e1e2e]/50 opacity-50 cursor-not-allowed'
                  : 'bg-[#14141f] border border-[#1e1e2e] hover:border-indigo-500/30'
              } ${analyzing ? 'animate-pulse' : ''}`}
              onClick={() => handleAnalyze(scenario.id)}
            >
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">{scenario.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-200 mb-0.5">
                    {scenario.name}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {scenario.description}
                  </div>
                  {scenario.id === 'risk-assessment' && techCount > 0 && (
                    <div className="mt-1.5 flex gap-2 text-[10px] text-gray-500">
                      <span>{techCount} 项技术</span>
                      {vulnCount > 0 && <span>· {vulnCount} 个漏洞</span>}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 针对单个漏洞的分析（从漏洞tab跳转） */}
      {vulnResult && vulnResult.totalCount > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-gray-600 mb-2">
            提示: 在"漏洞情报"页展开漏洞后，可针对单个CVE进行更详细的可利用性分析
          </p>
        </div>
      )}
    </div>
  );
};
