# Personal Butler · 个人管家

**本地优先**的桌面应用：日程、习惯、倒数日、装备/服装、天气、新闻与 AI 助手。数据存于本机。可选开启本地 HTTP API，供脚本或 AI（如 Clawdbot）读写数据。

**Languages:** [English](README.md)

---

## 特性

- **本地优先** — 数据存储在本地 SQLite，可完全离线使用
- **日程管理** — 日历视图、重复规则、提醒、冲突检测
- **习惯追踪** — 打卡、周期、统计与图表
- **倒数 / 纪念日** — 生日、纪念日、倒数日与提醒
- **装备与服装** — 装备管理、服装与搭配
- **天气与新闻** — 可选 API 接入（设置页或 .env 配置）
- **AI 助手** — 支持 Ollama / OpenAI / Anthropic；仪表盘建议与一键执行
- **多语言** — 简体中文、English
- **本地 API** — 可选 HTTP API（仅 127.0.0.1），供 Clawdbot、Cron、脚本读写数据

---

## 快速开始

### 环境要求

- Node.js 18+
- （可选）Python / Visual Studio Build Tools（用于 better-sqlite3 编译）

### 安装与运行

```bash
git clone https://github.com/963606242/personal-butler.git
cd personal-butler

npm install
npm run dev
```

浏览器访问 `http://localhost:3000` 或使用自动打开的 Electron 窗口。

### 构建（Windows）

```bash
npm run build
```

产物在 `dist-electron/win-unpacked/Personal Butler.exe`。打 zip 分发：`npm run pack:zip`，详见 [docs/publish.md](docs/publish.md)。

---

## 下载

可在 [Releases](https://github.com/963606242/personal-butler/releases) 下载 Windows 便携版 zip，解压后运行 `Personal Butler.exe`。

---

## 配置

- **应用内** — 设置页：API Keys、主题、语言、AI 提供商等，写入本地数据库，**优先于环境变量**。
- **环境变量（可选）** — 将 `.env.example` 复制为 `.env` 填写 Key（如 `VITE_WEATHER_API_KEY`、`VITE_NEWS_API_KEY`）。

---

## 技术栈

| 类别   | 技术 |
|--------|------|
| 桌面壳 | Electron |
| 前端   | React 18 + Vite |
| UI     | Ant Design 5 |
| 状态   | Zustand |
| 本地库 | SQLite (better-sqlite3) |

---

## 项目结构

```
personal-butler/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本（暴露安全 API）
├── index.html, vite.config.js, package.json
├── docs/                # 文档
│   ├── api-bridge.md    # 本地 HTTP API（可被 AI/脚本调用）
│   ├── data-storage.md  # 数据库路径与外部访问
│   └── publish.md       # 打包、zip、GitHub Release
├── src/
│   ├── main.jsx, App.jsx
│   ├── components/     # 通用与业务组件
│   ├── pages/           # 页面
│   ├── services/        # 接口、数据库、AI
│   ├── stores/          # Zustand 状态
│   ├── context/         # 主题、i18n、引导
│   ├── i18n/locales/    # 中英文文案
│   └── utils/
└── scripts/             # 如 pack-zip.ps1
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [docs/api-bridge.md](docs/api-bridge.md) | 本地 API：接口、认证、与 Clawdbot/脚本联动 |
| [docs/data-storage.md](docs/data-storage.md) | 数据库文件路径与外部访问方式 |
| [docs/publish.md](docs/publish.md) | 构建、打 zip、上传 GitHub Release |
| [docs/mobile-ios.md](docs/mobile-ios.md) | **在 iPhone 上运行**（Capacitor、PWA、React Native） |

---

## 数据与隐私

- 所有业务数据（日程、习惯、倒数日、设置等）均存储在本地 SQLite 文件中。
- 数据库路径见 **设置 → 数据与重置** 中的「数据库文件位置」，或 [docs/data-storage.md](docs/data-storage.md)。
- 天气、新闻、AI 等需联网功能依赖用户配置的 API Key，密钥仅存本地。

---

## 参与与首次推送到 Git

- 已通过 `.gitignore` 排除 `node_modules/`、`dist/`、`dist-electron/`、`.env`、本地数据库等。
- 建议**提交** `package-lock.json`，便于他人与 CI 使用 `npm ci` 获得一致依赖。
- 不要提交 `.env`，仅保留并提交 `.env.example` 作为模板。

---

## 许可证

MIT，详见 [LICENSE](LICENSE)。
