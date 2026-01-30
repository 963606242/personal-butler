# AI 助手配置说明

AI 助手支持 **Ollama**、**OpenAI 协议**、**Anthropic 协议**。配置入口：**设置 → AI 助手**。

## OpenAI 协议

- **官方**：留空「API 地址」，填写 OpenAI API Key，模型如 `gpt-4o-mini`、`gpt-4o`。
- **兼容服务**：填写「API 地址」为兼容服务的 base URL，再填该服务的 API Key 与模型名。

### Xiaomi MiMo 示例

[Xiaomi MiMo](https://platform.xiaomimimo.com/#/docs/api/text-generation/openai-api) 提供 OpenAI 兼容接口：

| 设置项 | 值 |
|--------|-----|
| 提供商 | OpenAI 协议 |
| API 地址 | `https://api.xiaomimimo.com/v1` |
| API Key | 在 MiMo 平台申请 |
| 模型 | `mimo-v2-flash`（以平台文档为准） |

## Anthropic 协议

- **官方**：留空「API 地址」，填写 Anthropic API Key，模型如 `claude-3-5-haiku-20241022`。
- **兼容服务**：填写「API 地址」为兼容服务的 base URL（需支持 Anthropic `/v1/messages` 格式）。

## Ollama（本地）

- 无需 API Key。填写 Ollama 地址（默认 `http://localhost:11434`）与模型（如 `llama3.2`、`qwen2.5`）。

## 请求方式

- 浏览器环境：使用 `fetch` 直连配置的 API 地址。
- Electron：通过主进程 `fetch-json-post` 发送请求，可绕过部分代理限制。
