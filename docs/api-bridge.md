# 本地 API：可被 AI 调用

在 **设置 → AI 调用本应用** 中开启并保存后，本应用会在本机启动一个 HTTP API（仅监听 `127.0.0.1`），供外部 AI、脚本或插件读取/写入习惯、日程、倒数等数据。

## 基础信息

- **Base URL**：`http://127.0.0.1:3847`（端口可在设置中修改，默认 3847）
- **数据库文件**：应用数据存储在本地 SQLite 文件中；路径与外部访问方式见 [data-storage.md](./data-storage.md)。
- **认证**：若在设置中填写了 API Key，请求头需带 `X-API-Key: <你的 Key>` 或 `Authorization: Bearer <你的 Key>`
- **格式**：请求/响应均为 JSON；`Content-Type: application/json`

## 接口列表

### 健康检查

- **GET** `/api/v1/health`  
  返回 `{ "ok": true, "service": "personal-butler", "version": "1.0" }`

### 当前用户

- **GET** `/api/v1/me`  
  返回 `{ "user_id": "..." }`（当前应用内唯一用户 ID）

### 习惯

- **GET** `/api/v1/habits`  
  返回当前用户的所有习惯：`{ "habits": [ { "id", "name", "frequency", "period", "reminder_time", "target_days" }, ... ] }`

- **GET** `/api/v1/habits/:id/logs?from=YYYY-MM-DD&to=YYYY-MM-DD`  
  返回指定习惯在时间范围内的打卡记录：`{ "habit_id", "logs": [ { "habit_id", "date", "completed", "notes" }, ... ] }`

- **POST** `/api/v1/habits/:id/log`  
  写入或更新某天的打卡。  
  Body：`{ "date": "YYYY-MM-DD", "completed": true, "notes": "可选" }`  
  不传 `date` 则默认为今天。

### 日程

- **GET** `/api/v1/schedule?from=时间戳&to=时间戳`  
  返回在 [from, to] 时间内有重叠的日程；`from`/`to` 为毫秒时间戳。

- **POST** `/api/v1/schedule`  
  创建一条日程。  
  Body：`{ "title", "start_time", "end_time", "location?", "notes?", "priority?", "tags?" }`  
  `start_time`/`end_time` 可为毫秒时间戳或 ISO 日期时间字符串。

### 倒数 / 纪念日

- **GET** `/api/v1/countdown/events`  
  返回当前用户的所有倒数/纪念日事件。

### 个人资料摘要

- **GET** `/api/v1/profile`  
  返回当前用户的资料摘要（如 gender、city、occupation、interests 等），供 AI 做个性化回复。

### 今日摘要 / 晨报数据

- **GET** `/api/v1/summary`  
  返回当日聚合数据，供外部定时任务（Cron）、Clawdbot 等生成晨报或推送。  
  响应示例：
  ```json
  {
    "date": "2025-01-29",
    "profile": { "gender": "male", "city": {...}, "occupation": "...", "interests": "..." },
    "today_schedule": [ { "id", "title", "start_time", "end_time", "location" }, ... ],
    "habits": [ { "id", "name", "reminder_time", "today_completed" }, ... ],
    "countdown_upcoming": [ { "id", "type", "title", "target_date", "days_until" }, ... ]
  }
  ```
  外部脚本可请求此接口后，将数据交给 LLM 生成一段晨报文案，再通过 Telegram / 邮件等发送。

## 示例

```bash
# 健康检查
curl http://127.0.0.1:3847/api/v1/health

# 带 API Key 获取习惯列表
curl -H "X-API-Key: 你的Key" http://127.0.0.1:3847/api/v1/habits

# 为习惯 id 打卡今天
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: 你的Key" \
  -d '{"date":"2025-01-29","completed":true}' \
  http://127.0.0.1:3847/api/v1/habits/<习惯id>/log

# 创建日程
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: 你的Key" \
  -d '{"title":"开会","start_time":1738141200000,"end_time":1738144800000}' \
  http://127.0.0.1:3847/api/v1/schedule
```

## 与 Clawdbot / 脚本联动

本 API 仅监听 `127.0.0.1`，适合与本机运行的 Clawdbot、自建 Bot 或 Cron 脚本配合使用。

### 场景一：Clawdbot 技能调用个人管家

在 Clawdbot 的技能或 Agent 中，让 LLM 通过 HTTP 调用本应用：

1. **读今日摘要再生成晨报**（Cron 定时触发）  
   - 请求 `GET http://127.0.0.1:3847/api/v1/summary`（若设置了 API Key，请求头加 `X-API-Key`）。  
   - 将返回的 `today_schedule`、`habits`、`countdown_upcoming` 等交给 LLM，生成一段晨报文案，再通过 Telegram/WhatsApp 等发送给用户。

2. **用户说「帮我记一下明天 10 点开会」**  
   - 解析出 title、start_time（如明天 10:00 的时间戳）。  
   - 请求 `POST http://127.0.0.1:3847/api/v1/schedule`，Body：`{"title":"开会","start_time":...,"end_time":...}`。

3. **用户说「今天跑步打卡」**  
   - 请求 `GET http://127.0.0.1:3847/api/v1/habits` 拿到习惯列表，匹配到「跑步」对应的 `id`。  
   - 请求 `POST http://127.0.0.1:3847/api/v1/habits/<id>/log`，Body：`{"date":"2025-01-29","completed":true}`。

### 场景二：本机 Cron 每日晨报

```bash
# 每天 8 点请求摘要，可再接 jq 或自写脚本把 JSON 交给 LLM 生成文案并发送
0 8 * * * curl -s -H "X-API-Key: 你的Key" http://127.0.0.1:3847/api/v1/summary > /tmp/pb-summary.json
```

### 场景三：curl 快速示例

```bash
# 获取今日摘要（晨报数据）
curl -H "X-API-Key: 你的Key" http://127.0.0.1:3847/api/v1/summary

# 创建日程（start_time/end_time 为毫秒时间戳或 ISO 字符串）
curl -X POST -H "Content-Type: application/json" -H "X-API-Key: 你的Key" \
  -d '{"title":"团队站会","start_time":"2025-01-30T09:00:00.000Z","end_time":"2025-01-30T09:30:00.000Z"}' \
  http://127.0.0.1:3847/api/v1/schedule
```

## 扩展可能

- 与 ChatGPT、Claude、Clawdbot 等配合：用本地 Agent 或插件请求上述 API，实现「让 AI 帮你记习惯、写日程」。
- 语音助手：本机脚本调用 API 读写数据，再与语音输入/输出结合。
- 自动化：定时脚本读取 `/api/v1/summary` 生成晨报，或根据规则自动写入打卡、日程。
