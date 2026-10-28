// ============================================================
// WebFinger - Storage Utilities
// WXT Storage API 封装
// ============================================================

import type { AIConfig } from '../core/types';

const STORAGE_KEYS = {
  DETECTION_CACHE: 'detectionCache',
  SETTINGS: 'settings',
} as const;

/**
 * @deprecated AI 配置已迁移至 core/ai/ai-config.ts
 * 请使用那里的 getAIConfig() / saveAIConfig() 方法
 * 那些方法包含 API Key 加密功能，更安全
 */
export async function getAIConfig(): Promise<AIConfig | null> {
  console.warn('[WebFinger] storage.getAIConfig() is deprecated. Use core/ai/ai-config.ts instead.');
  // 兼容旧代码，转发到新实现
  const { getAIConfig: getAIConfigSecure } = await import('../core/ai/ai-config');
  return getAIConfigSecure();
}

/**
 * @deprecated AI 配置已迁移至 core/ai/ai-config.ts
 * 请使用那里的 saveAIConfig() 方法，该方法会自动加密 API Key
 */
export async function saveAIConfig(config: AIConfig): Promise<void> {
  console.warn('[WebFinger] storage.saveAIConfig() is deprecated. Use core/ai/ai-config.ts instead.');
  const { saveAIConfig: saveAIConfigSecure } = await import('../core/ai/ai-config');
  await saveAIConfigSecure(config);
}

/** 获取用户设置 */
export async function getSettings(): Promise<Record<string, any>> {
  const result = await browser.storage.sync.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || {};
}

/** 保存用户设置 */
export async function saveSettings(settings: Record<string, any>): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/** 缓存检测结果 */
export async function cacheDetection(tabId: number, result: any): Promise<void> {
  const key = `detection_${tabId}`;
  await browser.storage.session.set({
    [key]: {
      result,
      timestamp: Date.now(),
    },
  });
}

/** 获取缓存的检测结果 */
export async function getCachedDetection(tabId: number): Promise<any | null> {
  const key = `detection_${tabId}`;
  const result = await browser.storage.session.get(key);
  return result[key]?.result || null;
}
