# Personal Butler · 个人管家

本地优先的智能生活管理桌面应用，数据存于本机，支持日程、习惯、倒数日、装备/服装、天气、新闻与 AI 助手；可选开启本地 HTTP API 供外部脚本或 AI 调用。

---

## 特性

- **本地优先**：数据存储在本地 SQLite，可完全离线使用
- **日程管理**：日历视图、重复规则、提醒、冲突检测
- **习惯追踪**：打卡、周期、统计与图表
- **倒数 / 纪念日**：生日、纪念日、倒数日与提醒
- **装备与服装**：装备管理、服装与搭配
- **天气与新闻**：可选 API 接入（设置页配置优先于 .env）
- **AI 助手**：支持 Ollama / OpenAI 协议 / Anthropic 协议；仪表盘 AI 建议与一键执行
- **多语言**：简体中文、English
- **本地 API**：可选开启 HTTP API（仅 127.0.0.1），供 Clawdbot、Cron、脚本读写数据

---

## 技术栈

| 类别     | 技术 |
|----------|------|
| 桌面壳   | Electron |
| 前端     | React 18 + Vite |
| UI       | Ant Design 5 |
| 状态     | Zustand |
| 本地库   | SQLite (better-sqlite3) |

---

## 快速开始

### 环境要求

- Node.js 18+
- （可选）Python / Visual Studio Build Tools（用于 better-sqlite3 编译）

### 安装与运行

```bash
# 克隆后进入项目目录
cd personal-butler

# 安装依赖
npm install

# 开发模式（同时启动 Vite + Electron）
npm run dev
```

浏览器访问 `http://localhost:3000` 或使用自动打开的 Electron 窗口。

### 构建

```bash
# 构建前端 + 打包 Electron（Windows 默认输出到 dist-electron）
npm run build
```

单独步骤：

- `npm run build:react`：仅构建 React 产物到 `dist/`
- `npm run build:electron`：仅执行 electron-builder

---

## 配置

- **应用内设置**：设置页中的 API Keys、主题、语言、AI 配置等会写入本地数据库，**优先于环境变量**。
- **环境变量**（可选）：若不想在设置页填写，可在项目根目录创建 `.env`，参考 `.env.example`。  
  常用变量：`VITE_TIANAPI_KEY`、`VITE_JISUAPI_KEY`、`VITE_NEWS_API_KEY`、`VITE_WEATHER_API_KEY` 等。

---

## 项目结构

```
personal-butler/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本（暴露安全 API）
├── index.html
├── vite.config.js
├── package.json
├── docs/                # 文档
│   ├── api-bridge.md    # 本地 API 说明（可被 AI/脚本调用）
│   ├── data-storage.md  # 数据库路径与外部访问
│   └── ...
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/      # 通用与业务组件
│   ├── pages/           # 页面
│   ├── services/        # 接口、数据库封装、AI 等
│   ├── stores/          # Zustand 状态
│   ├── context/         # React Context（主题、i18n、引导）
│   ├── i18n/locales/    # 中英文文案
│   └── utils/
└── build/               # 图标等构建资源（若存在）
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/api-bridge.md](docs/api-bridge.md) | 本地 HTTP API：接口列表、认证、与 Clawdbot/脚本联动 |
| [docs/data-storage.md](docs/data-storage.md) | 数据库文件路径（各系统）、备份与外部访问方式 |
| [docs/publish.md](docs/publish.md) | **上传 GitHub 与打包发布**（创建仓库、推送、打安装包、Release） |
| [快速开始.md](快速开始.md) | 安装、运行、构建简要说明 |
| [开发指南.md](开发指南.md) | 开发状态与模块说明 |

---

## 数据与隐私

- 所有业务数据（日程、习惯、倒数日、装备、服装、设置等）均存储在本地 SQLite 文件中。
- 数据库路径见 **设置 → 数据与重置** 中的「数据库文件位置」，或阅读 [docs/data-storage.md](docs/data-storage.md)。
- 天气、新闻、AI 等需联网功能依赖用户在设置页或 .env 中配置的 API Key，密钥仅存本地。

---

## 首次推送到 Git

- 已通过 `.gitignore` 排除：`node_modules/`、`dist/`、`dist-electron/`、`.env`、本地数据库文件等。
- 建议**提交** `package-lock.json`，以便他人与 CI 使用 `npm ci` 获得一致依赖。
- 不要提交 `.env`（仅保留并提交 `.env.example` 作为模板）。

---

## 许可证

MIT License，详见 [LICENSE](LICENSE)。
