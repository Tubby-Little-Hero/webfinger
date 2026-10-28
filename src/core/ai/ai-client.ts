// ============================================================
// WebFinger - AI Client (通用 AI API 调用接口)
// 支持 OpenAI 兼容格式 + Anthropic 格式
// ============================================================

import type { AIConfig, AIAnalysisResult } from '../types';
import { getAIConfig, validateAIConfig } from './ai-config';
import { buildVulnAnalysisPrompt, buildRiskAssessmentPrompt, buildAttackSurfacePrompt } from './prompt-templates';

/** AI聊天消息 */
interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** AI 非流式调用 */
export async function callAI(
  messages: AIMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    configOverride?: AIConfig;
  }
): Promise<string> {
  const config = options?.configOverride || (await getAIConfig());
  const validation = validateAIConfig(config);

  if (!validation.valid) {
    throw new Error(`AI 配置无效: ${validation.error}`);
  }

  if (config.provider === 'anthropic') {
    return callAnthropic(config, messages, options);
  }

  // OpenAI 兼容格式（OpenAI / DeepSeek / 智谱 / Moonshot / custom）
  return callOpenAICompatible(config, messages, options);
}

/** OpenAI 兼容 API 调用 */
async function callOpenAICompatible(
  config: AIConfig,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  // 清理 endpoint
  let baseUrl = config.endpoint.replace(/\/+$/, '');
  // 确保 endpoint 不包含 /chat/completions 后缀
  baseUrl = baseUrl.replace(/\/chat\/completions$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'User-Agent': 'WebFinger/1.0',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    // 仅保留 status code，不泄露 API 响应内容
    console.debug('[WebFinger] AI API error response:', await response.text().catch(() => ''));
    throw new Error(`AI API 请求失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Anthropic Claude API 调用 */
async function callAnthropic(
  config: AIConfig,
  messages: AIMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  let baseUrl = config.endpoint.replace(/\/+$/, '');
  // 同样清理可能的 /messages 后缀
  baseUrl = baseUrl.replace(/\/messages$/, '');

  // 提取 system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMessages = messages.filter((m) => m.role !== 'system');

  // Anthropic 需要 Messages API 格式
  const body: any = {
    model: config.model,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
    messages: userMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'User-Agent': 'WebFinger/1.0',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    console.debug('[WebFinger] Anthropic API error response:', await response.text().catch(() => ''));
    throw new Error(`Anthropic API 请求失败 (HTTP ${response.status})`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

/** AI 漏洞可利用性分析 */
export async function analyzeVulnExploitability(
  techName: string,
  version: string | undefined,
  cveId: string,
  cvssScore: number,
  description: string,
  affectedVersions: string
): Promise<AIAnalysisResult> {
  const { system, user } = buildVulnAnalysisPrompt(
    techName, version, cveId, cvssScore, description, affectedVersions
  );

  const startTime = Date.now();

  try {
    const config = await getAIConfig();
    const content = await callAI([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    return {
      id: `ai-${Date.now()}`,
      type: 'vuln-analysis',
      targetCVE: cveId,
      content,
      timestamp: Date.now(),
      model: config.model,
      provider: config.provider,
      duration: Date.now() - startTime,
    };
  } catch (err: any) {
    throw new Error(`AI 分析失败: ${err.message}`);
  }
}

/** AI 综合风险评估 */
export async function analyzeOverallRisk(
  techList: Array<{ name: string; version?: string }>,
  vulnCount: number,
  criticalCount: number,
  highCount: number
): Promise<AIAnalysisResult> {
  const { system, user } = buildRiskAssessmentPrompt(
    techList, vulnCount, criticalCount, highCount
  );

  const startTime = Date.now();

  try {
    const config = await getAIConfig();
    const content = await callAI([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    return {
      id: `ai-${Date.now()}`,
      type: 'risk-assessment',
      content,
      timestamp: Date.now(),
      model: config.model,
      provider: config.provider,
      duration: Date.now() - startTime,
    };
  } catch (err: any) {
    throw new Error(`AI 风险评估失败: ${err.message}`);
  }
}

/** AI 攻击面分析 */
export async function analyzeAttackSurface(
  techList: Array<{ name: string; version?: string; category: string }>,
  headers: Record<string, string>
): Promise<AIAnalysisResult> {
  const { system, user } = buildAttackSurfacePrompt(techList, headers);

  const startTime = Date.now();

  try {
    const config = await getAIConfig();
    const content = await callAI([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ]);

    return {
      id: `ai-${Date.now()}`,
      type: 'attack-surface',
      content,
      timestamp: Date.now(),
      model: config.model,
      provider: config.provider,
      duration: Date.now() - startTime,
    };
  } catch (err: any) {
    throw new Error(`AI 攻击面分析失败: ${err.message}`);
  }
}
