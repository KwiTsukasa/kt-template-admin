import type { Recordable } from '@vben/types';

import { useAppConfig } from '@vben/hooks';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';

import { refreshTokenApi } from '#/api/core';
import { requestClient } from '#/api/request';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

export namespace LlmApi {
  export type Provider =
    | 'anthropic'
    | 'codex'
    | 'deepseek'
    | 'moonshot'
    | 'openai'
    | 'zhipu';

  export type ConnectionStatus =
    | 'connected'
    | 'disabled'
    | 'error'
    | 'untested';

  export interface ProviderCatalogItem {
    defaultBaseUrl: string;
    label: string;
    protocol: 'anthropic' | 'codex-gateway' | 'openai-compatible';
    provider: Provider;
    requiresApiKey: boolean;
  }

  export interface Config {
    baseUrl: string;
    connectionStatus: ConnectionStatus;
    createTime: string;
    enabled: boolean;
    firstTokenLatencyMs?: null | number;
    hasApiKey: boolean;
    id: string;
    isDefault: boolean;
    lastErrorMessage?: null | string;
    lastTestedAt?: null | string;
    name: string;
    provider: Provider;
    providerLabel: string;
    requiresApiKey: boolean;
    updateTime: string;
  }

  export interface ConfigInput {
    apiKey?: string;
    baseUrl: string;
    enabled: boolean;
    isDefault: boolean;
    name: string;
    provider: Provider;
  }

  export interface ConfigQuery extends Recordable<any> {
    keyword?: string;
    pageNo?: number;
    pageSize?: number;
    provider?: Provider;
    status?: ConnectionStatus;
  }

  export interface ConfigSummary {
    connected: number;
    disabled: number;
    error: number;
    total: number;
  }

  export interface PageResult<T> {
    items: T[];
    list?: T[];
    total: number;
  }

  export interface ConnectionTestResult {
    checkedAt: string;
    firstTokenLatencyMs: number;
    latencyMs: number;
    model: string;
    preview: string;
  }

  export interface ModelCapabilityOption {
    id: string;
    label: string;
  }

  export interface ModelCatalogItem {
    defaultReasoningEffort: null | string;
    defaultServiceTier: null | string;
    id: string;
    label: string;
    reasoningEfforts: ModelCapabilityOption[];
    serviceTiers: ModelCapabilityOption[];
  }

  export interface ConfigModelsResult {
    fetchedAt: string;
    items: ModelCatalogItem[];
    provider: Provider;
  }

  export interface Conversation {
    active: boolean;
    configId: string;
    createTime: string;
    id: string;
    lastMessageAt?: null | string;
    messageCount: number;
    scene: 'general' | 'media-governance';
    sceneRefId?: null | string;
    selectedModel?: null | string;
    selectedReasoningEffort?: null | string;
    selectedServiceTier?: null | string;
    title: string;
    updateTime: string;
  }

  export interface Message {
    content: string;
    createTime: string;
    errorMessage?: null | string;
    finishReason?: null | string;
    id: string;
    metadata?: null | Record<string, unknown>;
    model?: null | string;
    reasoningContent?: null | string;
    role: 'assistant' | 'user';
    sequence: number;
    status: 'completed' | 'failed' | 'interrupted' | 'streaming';
    usage?: null | Record<string, number>;
  }

  export interface ConversationDetail {
    config: Config;
    conversation: Conversation;
    messages: Message[];
  }

  export type StreamEvent =
    | {
        assistantMessageId: string;
        content: string;
        sequence: number;
        turnId: string;
        type: 'reasoning-delta' | 'text-delta';
      }
    | {
        assistantMessageId: string;
        finishReason?: null | string;
        metadata?: Record<string, unknown>;
        model: string;
        sequence: number;
        turnId: string;
        type: 'done';
        usage?: Record<string, number>;
      }
    | {
        assistantMessageId: string;
        model: string;
        providerThreadId?: string;
        sequence: number;
        turnId: string;
        type: 'start';
        userMessageId: string;
      };
}

/**
 * 获取固定供应商目录及默认端点。
 * @returns 六类供应商目录。
 */
export function getLlmProviders() {
  return requestClient.get<LlmApi.ProviderCatalogItem[]>('/llm/providers');
}

/**
 * 按卡片页筛选条件读取连接分页。
 * @param params - 关键词、供应商、状态和分页条件。
 * @returns 大模型连接分页。
 */
export function getLlmConfigs(params: LlmApi.ConfigQuery) {
  return requestClient.get<LlmApi.PageResult<LlmApi.Config>>('/llm/configs', {
    params,
  });
}

/**
 * 请求服务端按互斥连接状态聚合的看板计数，避免页面自行重复分类。
 * @returns 总数、已连接、异常和已停用计数。
 */
export function getLlmConfigSummary() {
  return requestClient.get<LlmApi.ConfigSummary>('/llm/configs/summary');
}

/**
 * 读取不回显 API Key 的单连接视图，凭据只以布尔状态表示。
 * @param id - 连接 Snowflake ID。
 * @returns 脱敏连接详情。
 */
export function getLlmConfig(id: string) {
  return requestClient.get<LlmApi.Config>(`/llm/configs/${id}`);
}

/**
 * 按连接供应商协议实时发现当前可用模型。
 * @param id - 连接 Snowflake ID。
 * @returns 带抓取时间、供应商和模型标识/标签的实时结果。
 */
export function getLlmConfigModels(id: string) {
  return requestClient.get<LlmApi.ConfigModelsResult>(
    `/llm/configs/${id}/models`,
  );
}

/**
 * 在提交前裁剪连接文本并剔除空白 API Key，防止写入无效凭据。
 * @param data - 连接名称、供应商、端点、凭据和状态。
 * @returns 新连接脱敏视图。
 */
export function createLlmConfig(data: LlmApi.ConfigInput) {
  return requestClient.post<LlmApi.Config>(
    '/llm/configs',
    normalizeConfigInput(data),
  );
}

/**
 * 空白 API Key 在 PUT 前被剔除，避免编辑名称或端点时清空既有凭据。
 * @param id - 连接 Snowflake ID。
 * @param data - 待保存的连接字段。
 * @returns 更新后的脱敏连接视图。
 */
export function updateLlmConfig(id: string, data: LlmApi.ConfigInput) {
  return requestClient.put<LlmApi.Config>(
    `/llm/configs/${id}`,
    normalizeConfigInput(data),
  );
}

/**
 * 仅请求软删除已停用连接，历史对话仍由服务端保留。
 * @param id - 连接 Snowflake ID。
 * @returns 被删除的连接标识。
 */
export function deleteLlmConfig(id: string) {
  return requestClient.delete<{ id: string }>(`/llm/configs/${id}`);
}

/**
 * 只变更连接可用性，并接收服务端重新计算状态后的脱敏视图。
 * @param id - 连接 Snowflake ID。
 * @param enabled - 目标启用状态。
 * @returns 更新后的连接视图。
 */
export function setLlmConfigEnabled(id: string, enabled: boolean) {
  return requestClient.post<LlmApi.Config>(`/llm/configs/${id}/enabled`, {
    enabled,
  });
}

/**
 * 把指定连接设为唯一默认项。
 * @param id - 连接 Snowflake ID。
 * @returns 更新后的连接视图。
 */
export function setDefaultLlmConfig(id: string) {
  return requestClient.post<LlmApi.Config>(`/llm/configs/${id}/default`);
}

/**
 * 以已保存凭据发起流式探测，可选模型只影响本次首 Token 验证。
 * @param id - 连接 Snowflake ID。
 * @param model - 可选测试模型。
 * @returns 首 Token 延迟、总耗时和短预览。
 */
export function testLlmConfig(id: string, model?: string) {
  const body: { model?: string } = {};
  if (model) body.model = model;
  return requestClient.post<LlmApi.ConnectionTestResult>(
    `/llm/configs/${id}/test`,
    body,
  );
}

/**
 * 获取当前连接最近对话。
 * @param configId - 连接 Snowflake ID。
 * @returns 最近对话摘要数组。
 */
export function getLlmConversations(configId: string) {
  return requestClient.get<LlmApi.Conversation[]>('/llm/conversations', {
    params: { configId, limit: 100 },
  });
}

/**
 * 新会话仅绑定 configId 且不预写消息，并由统一 POST SSE 持久化首轮正文。
 * @param configId - 连接 Snowflake ID。
 * @returns 新对话摘要。
 */
export function createLlmConversation(configId: string) {
  return requestClient.post<LlmApi.Conversation>('/llm/conversations', {
    configId,
  });
}

/**
 * 一次恢复会话元数据、脱敏连接和有序消息，供页面重建发送上下文。
 * @param id - 对话 Snowflake ID。
 * @returns 对话详情。
 */
export function getLlmConversation(id: string) {
  return requestClient.get<LlmApi.ConversationDetail>(
    `/llm/conversations/${id}`,
  );
}

/**
 * 请求删除没有活动生成的会话，生成中的目标由服务端拒绝。
 * @param id - 对话 Snowflake ID。
 * @returns 被删除的对话标识。
 */
export function deleteLlmConversation(id: string) {
  return requestClient.delete<{ id: string }>(`/llm/conversations/${id}`);
}

/**
 * 通过带认证的 POST fetch 消费统一 SSE，并把每个事件交给调用方。
 * @param conversationId - 对话 Snowflake ID。
 * @param input - 同时携带幂等标识、用户正文、实时模型及其可选推理/速度档位的单轮输入。
 * @param input.clientMessageId - 当前发送动作生成的客户端幂等标识。
 * @param input.content - 需要进入标准对话历史的用户正文。
 * @param input.model - 从实时目录选择并由服务端再次校验的模型标识。
 * @param input.reasoningEffort - 当前模型支持时选择的推理强度；省略表示使用默认值。
 * @param input.serviceTier - 当前模型支持时选择的速度或服务档位；省略表示使用标准档。
 * @param onEvent - 按到达顺序接收 start、增量与 done 的回调。
 * @param signal - 页面停止生成或卸载时取消请求的信号。
 * @throws 响应无正文或未在取消前收到 done 事件时抛出流合同错误。
 */
export async function streamLlmConversationMessage(
  conversationId: string,
  input: {
    clientMessageId: string;
    content: string;
    model: string;
    reasoningEffort?: string;
    serviceTier?: string;
  },
  onEvent: (event: LlmApi.StreamEvent) => void,
  signal: AbortSignal,
) {
  const response = await fetchStream(
    `/llm/conversations/${conversationId}/messages/stream`,
    input,
    signal,
  );
  if (!response.body) throw new Error('流式响应正文不可用');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    buffer += decoder.decode(result.value, { stream: true });
    buffer = buffer.replaceAll('\r\n', '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseBrowserSseFrame(frame);
      if (event) {
        if (event.type === 'done') completed = true;
        onEvent(event);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
  buffer += decoder.decode();
  const finalEvent = parseBrowserSseFrame(buffer);
  if (finalEvent) {
    if (finalEvent.type === 'done') completed = true;
    onEvent(finalEvent);
  }
  if (!completed && !signal.aborted) {
    throw new Error('流式响应在完成事件前结束');
  }
}

/**
 * 删除空白 API Key 并规范文本字段，避免前端空串覆盖密钥。
 * @param data - 配置表单值。
 * @returns 可直接提交给后端的连接请求体。
 */
function normalizeConfigInput(data: LlmApi.ConfigInput) {
  const normalized: LlmApi.ConfigInput = {
    baseUrl: data.baseUrl.trim(),
    enabled: !!data.enabled,
    isDefault: !!data.isDefault,
    name: data.name.trim(),
    provider: data.provider,
  };
  const apiKey = data.apiKey?.trim();
  if (apiKey) normalized.apiKey = apiKey;
  return normalized;
}

/**
 * 复用当前认证上下文请求流，401 时最多刷新一次并拒绝非 SSE 响应。
 * @param path - 相对 API 路径。
 * @param body - JSON 请求体。
 * @param signal - 调用方取消信号。
 * @returns 成功的 text/event-stream 响应。
 * @throws 最终响应非成功状态或 Content-Type 不是 SSE 时抛出可读错误。
 */
async function fetchStream(path: string, body: unknown, signal: AbortSignal) {
  let response = await executeStreamFetch(path, body, signal);
  if (response.status === 401 && preferences.app.enableRefreshToken) {
    const refresh = await refreshTokenApi();
    const accessStore = useAccessStore();
    accessStore.setAccessToken(refresh.data);
    response = await executeStreamFetch(path, body, signal);
  }
  if (!response.ok) {
    throw new Error(await readStreamError(response));
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error('服务端未返回流式响应');
  }
  return response;
}

/**
 * 使用当前访问令牌执行一次流式 fetch。
 * @param path - 相对 API 路径。
 * @param body - JSON 请求体。
 * @param signal - 调用方取消信号。
 * @returns 原始 HTTP 响应。
 */
function executeStreamFetch(path: string, body: unknown, signal: AbortSignal) {
  const accessStore = useAccessStore();
  const headers: Record<string, string> = {
    'Accept-Language': preferences.app.locale,
    'Content-Type': 'application/json',
  };
  if (accessStore.accessToken) {
    headers.Authorization = `Bearer ${accessStore.accessToken}`;
  }
  return fetch(streamUrl(path), {
    body: JSON.stringify(body),
    credentials: 'include',
    headers,
    method: 'POST',
    signal,
  });
}

/**
 * 把相对 API 路径解析为当前 Origin 下的绝对流地址。
 * @param path - 以斜杠开头的 API 路径。
 * @returns 可交给 fetch 的绝对 URL。
 */
function streamUrl(path: string) {
  const base = new URL(apiURL, window.location.origin);
  const normalizedBase = base.pathname.replace(/\/+$/, '');
  base.pathname = `${normalizedBase}${path}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

/**
 * 从非成功响应中提取后端 err/msg，并回退到状态码说明。
 * @param response - 非 2xx HTTP 响应。
 * @returns 用户可读错误文本。
 */
async function readStreamError(response: Response) {
  const text = await response.text();
  if (text) {
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      const candidate = value.err || value.msg || value.message || value.error;
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    } catch {}
  }
  return `流式请求失败（HTTP ${response.status}）`;
}

/**
 * 解析浏览器收到的单个 SSE 帧，并把 error 事件转换为异常。
 * @param frame - 不含终止空行的 SSE 文本。
 * @returns 统一流事件；无 data 时返回 null。
 * @throws error 事件携带的供应商消息或统一流失败文案。
 */
function parseBrowserSseFrame(frame: string): LlmApi.StreamEvent | null {
  let eventName = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  if (eventName === 'error') {
    if (typeof parsed.message === 'string') throw new Error(parsed.message);
    throw new Error('大模型流式请求失败');
  }
  if (
    eventName !== 'start' &&
    eventName !== 'reasoning-delta' &&
    eventName !== 'text-delta' &&
    eventName !== 'done'
  ) {
    return null;
  }
  return { ...parsed, type: eventName } as LlmApi.StreamEvent;
}
