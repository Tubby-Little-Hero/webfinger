// ============================================================
// WebFinger - AI Configuration Manager
// AI 配置管理：安全存储、验证、同步
// ============================================================

import type { AIConfig, AIProvider } from '../types';
import { decryptApiKey, encryptApiKey } from '../../utils/crypto';
import { browser } from 'wxt/browser';

const STORAGE_KEY = 'webfinger:ai:config';

/** 默认 AI 配置 */
export function getDefaultAIConfig(): AIConfig {
  return {
    provider: 'openai',
    apiKey: '',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    enabled: false,
  };
}

/** 获取 AI 配置 */
export async function getAIConfig(): Promise<AIConfig> {
  try {
    const result = await browser.storage.sync.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];

    if (!stored) return getDefaultAIConfig();

    // 解密 API Key
    let config: AIConfig = typeof stored === 'string' ? JSON.parse(stored) : stored;

    if (config.apiKey && config.apiKey.startsWith('enc:')) {
      try {
        config.apiKey = await decryptApiKey(config.apiKey.slice(4));
      } catch {
        config.apiKey = ''; // 解密失败则清空
      }
    }

    return { ...getDefaultAIConfig(), ...config };
  } catch {
    return getDefaultAIConfig();
  }
}

/** 保存 AI 配置 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
  // 加密 API Key 后再存储
  const stored: AIConfig = { ...config };

  if (stored.apiKey && !stored.apiKey.startsWith('enc:')) {
    const encrypted = await encryptApiKey(stored.apiKey);
    stored.apiKey = `enc:${encrypted}`;
  }

  await browser.storage.sync.set({
    [STORAGE_KEY]: JSON.stringify(stored),
  });
}

/** 验证 AI 配置是否有效 */
export function validateAIConfig(config: AIConfig): { valid: boolean; error?: string } {
  if (!config.enabled) {
    return { valid: false, error: 'AI 功能未启用' };
  }

  if (!config.apiKey || config.apiKey.length < 8) {
    return { valid: false, error: 'API Key 未设置或格式无效' };
  }

  if (!config.endpoint) {
    return { valid: false, error: 'API Endpoint 未设置' };
  }

  // 强制 HTTPS（允许 localhost 用于开发测试）
  const isLocalhost = config.endpoint.includes('localhost') || config.endpoint.includes('127.0.0.1');
  if (!config.endpoint.startsWith('https://') && !isLocalhost) {
    return { valid: false, error: 'API Endpoint 必须使用 HTTPS 协议（开发环境可使用 localhost）' };
  }

  if (!config.model) {
    return { valid: false, error: '未指定模型名称' };
  }

  return { valid: true };
}

/** AI 提供商默认配置 */
export const AI_PROVIDER_DEFAULTS: Record<AIProvider, { endpoint: string; model: string; name: string }> = {
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  anthropic: {
    name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-20250514',
  },
  zhipu: {
    name: '智谱AI',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
  },
  moonshot: {
    name: 'Moonshot',
    endpoint: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  custom: {
    name: '自定义',
    endpoint: 'https://your-api-endpoint.com/v1',
    model: 'your-model',
  },
};
