// ============================================================
// WebFinger - Options/Settings Page
// AI 配置、规则更新、显示偏好
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import type { AIConfig, AIProvider } from '../../core/types';
import { getAIConfig, saveAIConfig, getDefaultAIConfig, AI_PROVIDER_DEFAULTS } from '../../core/ai/ai-config';

// 显示偏好设置
interface DisplayPreferences {
  showConfidence: boolean;
  collapseInferred: boolean;
  highConfidenceOnly: boolean;
}

const DEFAULT_DISPLAY_PREFS: DisplayPreferences = {
  showConfidence: true,
  collapseInferred: false,
  highConfidenceOnly: false,
};

const OptionsApp: React.FC = () => {
  // AI 配置 state
  const [aiConfig, setAiConfig] = useState<AIConfig>(getDefaultAIConfig());
  const [displayPrefs, setDisplayPrefs] = useState<DisplayPreferences>(DEFAULT_DISPLAY_PREFS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 加载已有配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getAIConfig();
      setAiConfig(config);
      
      // 加载显示偏好
      const result = await browser.storage.sync.get('webfinger:display:prefs');
      const prefs = result['webfinger:display:prefs'];
      if (prefs) {
        setDisplayPrefs({ ...DEFAULT_DISPLAY_PREFS, ...prefs });
      }
    } catch (err) {
      console.error('[WebFinger] Failed to load config:', err);
      setError('加载配置失败');
    } finally {
      setLoaded(true);
    }
  };

  // Provider 变化时更新默认值
  const handleProviderChange = (provider: string) => {
    const aiProvider = provider as AIProvider;
    const defaults = AI_PROVIDER_DEFAULTS[aiProvider];
    
    setAiConfig(prev => ({
      ...prev,
      provider: aiProvider,
      endpoint: defaults?.endpoint || prev.endpoint,
      model: defaults?.model || prev.model,
      enabled: provider !== '',
    }));
  };

  // 处理表单变更
  const handleInputChange = useCallback((field: keyof AIConfig, value: string) => {
    setAiConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleDisplayPrefChange = useCallback((field: keyof DisplayPreferences) => {
    setDisplayPrefs(prev => ({ ...prev, [field]: !prev[field] }));
  }, []);

  // 保存设置
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // 验证配置
      if (aiConfig.enabled) {
        if (!aiConfig.apiKey || aiConfig.apiKey.length < 8) {
          throw new Error('API Key 格式无效（至少 8 位）');
        }
        if (!aiConfig.endpoint || !aiConfig.endpoint.startsWith('http')) {
          throw new Error('API Endpoint 必须以 http:// 或 https:// 开头');
        }
        if (!aiConfig.model) {
          throw new Error('未指定模型名称');
        }
      }

      // 保存 AI 配置
      await saveAIConfig(aiConfig);

      // 保存显示偏好
      await browser.storage.sync.set({
        'webfinger:display:prefs': displayPrefs,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-gray-500">加载配置中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-100 mb-8">
        🔒 WebFinger 设置
      </h1>

      {/* 错误提示 */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          ⚠️ {error}
        </div>
      )}

      {/* AI 配置 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">🤖 AI 模型配置</h2>
        <p className="text-sm text-gray-500 mb-4">
          配置你自己的 AI 模型来进行漏洞分析。所有数据直接发送到你指定的API端点，
          API Key 使用本地加密存储。不配置则 AI 分析功能不可用。
        </p>

        <div className="space-y-4 bg-[#14141f] rounded-xl p-4 border border-[#1e1e2e]">
          {/* Provider 选择 */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              AI 提供商
            </label>
            <select
              value={aiConfig.enabled ? aiConfig.provider : ''}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">未配置（禁用AI）</option>
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="zhipu">智谱AI (GLM-4)</option>
              <option value="moonshot">Moonshot (Kimi)</option>
              <option value="custom">自定义兼容接口</option>
            </select>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={aiConfig.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              placeholder="sk-..."
              disabled={!aiConfig.enabled}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              API Key 将使用 AES-GCM 本地加密后存储，不会上传到任何服务器
            </p>
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              API Endpoint
            </label>
            <input
              type="text"
              value={aiConfig.endpoint}
              onChange={(e) => handleInputChange('endpoint', e.target.value)}
              placeholder="https://api.openai.com/v1"
              disabled={!aiConfig.enabled}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              模型名称
            </label>
            <input
              type="text"
              value={aiConfig.model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              placeholder="gpt-4o"
              disabled={!aiConfig.enabled}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </section>

      {/* 显示偏好 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">⚙️ 显示偏好</h2>
        <div className="bg-[#14141f] rounded-xl p-4 border border-[#1e1e2e] space-y-3">
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">显示置信度百分比</span>
            <input
              type="checkbox"
              checked={displayPrefs.showConfidence}
              onChange={() => handleDisplayPrefChange('showConfidence')}
              className="toggle"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">折叠推断的技术项</span>
            <input
              type="checkbox"
              checked={displayPrefs.collapseInferred}
              onChange={() => handleDisplayPrefChange('collapseInferred')}
              className="toggle"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-gray-300">仅显示高置信度 (≥80%)</span>
            <input
              type="checkbox"
              checked={displayPrefs.highConfidenceOnly}
              onChange={() => handleDisplayPrefChange('highConfidenceOnly')}
              className="toggle"
            />
          </label>
        </div>
      </section>

      {/* 关于 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">ℹ️ 关于</h2>
        <div className="bg-[#14141f] rounded-xl p-4 border border-[#1e1e2e]">
          <div className="text-sm text-gray-400 space-y-1">
            <p>WebFinger v1.0.0</p>
            <p>网站技术栈指纹识别与漏洞分析浏览器扩展</p>
            <p className="text-gray-600 mt-2">
              <a
                href="https://github.com"
                className="text-indigo-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* 保存按钮 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? '保存中...' : saved ? '✅ 已保存' : '保存设置'}
      </button>
    </div>
  );
};

export default OptionsApp;
