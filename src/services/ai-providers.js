/**
 * AI 对话提供商：Ollama、OpenAI 协议、Anthropic 协议
 * 支持官方 OpenAI/Anthropic 及兼容服务（如 Xiaomi MiMo）。
 * 配置来自设置页，优先于环境变量。
 */
import { getConfigStr } from './config';
import { isElectron, fetchJsonPost as platformFetchJsonPost } from '../platform';

const OPENAI_OFFICIAL = 'https://api.openai.com/v1';
const ANTHROPIC_OFFICIAL = 'https://api.anthropic.com/v1';

function getProvider() {
  return getConfigStr('ai_provider') || 'ollama';
}

function getOllamaBase() {
  const v = getConfigStr('ollama_base_url');
  return (v && v.trim()) || 'http://localhost:11434';
}

function getOllamaModel() {
  const v = getConfigStr('ollama_model');
  return (v && v.trim()) || 'llama3.2';
}

function getOpenAIBase() {
  const v = getConfigStr('openai_base_url');
  return (v && v.trim()) || '';
}

function getOpenAIKey() {
  return getConfigStr('openai_api_key') || '';
}

function getOpenAIModel() {
  const v = getConfigStr('openai_model');
  return (v && v.trim()) || 'gpt-4o-mini';
}

function getAnthropicBase() {
  const v = getConfigStr('anthropic_base_url');
  return (v && v.trim()) || '';
}

function getAnthropicKey() {
  return getConfigStr('anthropic_api_key') || '';
}

function getAnthropicModel() {
  const v = getConfigStr('anthropic_model');
  return (v && v.trim()) || 'claude-3-5-haiku-20241022';
}

function resolveOpenAICompletionsUrl() {
  const base = getOpenAIBase();
  if (!base) return `${OPENAI_OFFICIAL}/chat/completions`;
  const b = base.replace(/\/$/, '');
  if (b.endsWith('/v1')) return `${b}/chat/completions`;
  return `${b}/v1/chat/completions`;
}

function resolveAnthropicMessagesUrl() {
  const base = getAnthropicBase();
  if (!base) return `${ANTHROPIC_OFFICIAL}/messages`;
  const b = base.replace(/\/$/, '');
  if (b.endsWith('/v1')) return `${b}/messages`;
  return `${b}/v1/messages`;
}

async function postJson(url, body) {
  if (isElectron()) {
    const r = await platformFetchJsonPost({ url, body });
    if (!r.success) throw new Error(r.errorBody || `HTTP ${r.status}`);
    return r.data;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}

async function chatOllama(messages) {
  const base = getOllamaBase().replace(/\/$/, '');
  const model = getOllamaModel();
  const url = `${base}/api/chat`;
  const data = await postJson(url, { model, messages, stream: false });
  const msg = data.message;
  if (!msg || typeof msg.content !== 'string') throw new Error('Ollama 返回格式异常');
  return msg.content;
}

/**
 * 调用 OpenAI 协议 /v1/chat/completions
 * 支持官方 OpenAI 或兼容服务（如 Xiaomi MiMo：base https://api.xiaomimimo.com/v1）
 */
async function chatOpenAI(messages) {
  const key = getOpenAIKey();
  if (!key) throw new Error('请在设置中配置 OpenAI API Key');
  const model = getOpenAIModel();
  const url = resolveOpenAICompletionsUrl();
  let data;
  if (isElectron()) {
    const r = await platformFetchJsonPost({
      url,
      body: { model, messages },
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.success) throw new Error(r.errorBody || `OpenAI 协议请求失败 ${r.status}`);
    data = r.data;
  } else {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    data = await res.json();
  }
  const choice = data.choices?.[0];
  if (!choice?.message?.content) throw new Error('OpenAI 协议返回格式异常');
  return choice.message.content;
}

/**
 * 调用 Anthropic 协议 /v1/messages
 * 支持官方 Anthropic 或兼容服务（可配置 API 地址）。
 */
async function chatAnthropic(messages) {
  const key = getAnthropicKey();
  if (!key) throw new Error('请在设置中配置 Anthropic API Key');
  const model = getAnthropicModel();
  const url = resolveAnthropicMessagesUrl();
  const system = messages.find((m) => m.role === 'system')?.content;
  const msgs = messages.filter((m) => m.role === 'user' || m.role === 'assistant');

  const body = {
    model,
    max_tokens: 2048,
    messages: msgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (system) body.system = system;

  let data;
  if (isElectron()) {
    const r = await platformFetchJsonPost({
      url,
      body,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    });
    if (!r.success) throw new Error(r.errorBody || `Anthropic 协议请求失败 ${r.status}`);
    data = r.data;
  } else {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    data = await res.json();
  }
  const block = data.content?.find((b) => b.type === 'text');
  if (!block?.text) throw new Error('Anthropic 协议返回格式异常');
  return block.text;
}

/**
 * 统一入口：根据当前提供商发送对话，返回助手回复文本
 * @param {Array<{ role: 'user'|'assistant'|'system', content: string }>} messages
 * @returns {Promise<string>}
 */
export async function chat(messages) {
  const provider = getProvider();
  if (provider === 'openai') return chatOpenAI(messages);
  if (provider === 'anthropic') return chatAnthropic(messages);
  return chatOllama(messages);
}

export function getActiveProvider() {
  return getProvider();
}

export function isAIConfigured() {
  const p = getProvider();
  if (p === 'ollama') return true;
  if (p === 'openai') return !!getOpenAIKey();
  if (p === 'anthropic') return !!getAnthropicKey();
  return false;
}
