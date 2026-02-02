# Personal Butler

A **local-first** desktop app for life management: schedule, habits, countdowns, equipment & outfits, weather, news, and an AI assistant. Data stays on your machine. Optional local HTTP API lets scripts and AI (e.g. Clawdbot) read/write your data.

**Languages:** [简体中文](README.zh-CN.md)

---

## Features

- **Local-first** — SQLite on disk; works fully offline
- **Schedule** — Calendar view, recurrence, reminders, conflict checks
- **Habits** — Check-ins, frequency, stats and charts
- **Countdown & anniversaries** — Birthdays, milestones, reminders
- **Equipment & clothing** — Gear list, outfits
- **Weather & news** — Optional APIs (keys in Settings or `.env`)
- **AI assistant** — Ollama / OpenAI / Anthropic; dashboard suggestions and one-click actions
- **i18n** — English, 简体中文
- **Local API** — Optional HTTP API on `127.0.0.1` for scripts and AI to read/write data

---

## Quick start

### Requirements

- Node.js 18+
- (Optional) Python / Visual Studio Build Tools for building `better-sqlite3`

### Install and run

```bash
git clone https://github.com/963606242/personal-butler.git
cd personal-butler

npm install
npm run dev
```

Open `http://localhost:3000` or the Electron window.

### Build (Windows)

```bash
npm run build
```

Output: `dist-electron/win-unpacked/Personal Butler.exe`. To create a zip for distribution: `npm run pack:zip` (see [docs/publish.md](docs/publish.md)).

---

## Download

Pre-built Windows (portable zip) is available in [Releases](https://github.com/963606242/personal-butler/releases). Unzip and run `Personal Butler.exe`.

---

## Configuration

- **In-app** — Settings: API keys, theme, language, AI provider. Stored in local DB and override env vars.
- **Env (optional)** — Copy `.env.example` to `.env` for keys (e.g. `VITE_WEATHER_API_KEY`, `VITE_NEWS_API_KEY`).

---

## Tech stack

| Layer   | Tech                |
|---------|---------------------|
| Desktop | Electron            |
| UI      | React 18, Vite      |
| Components | Ant Design 5     |
| State   | Zustand             |
| DB      | SQLite (better-sqlite3) |

---

## Project structure

```
personal-butler/
├── main.js              # Electron main process
├── preload.js           # Preload (exposes safe API to renderer)
├── index.html, vite.config.js, package.json
├── docs/                # Documentation
│   ├── api-bridge.md    # Local HTTP API for AI/scripts
│   ├── data-storage.md  # DB path and external access
│   └── publish.md       # Build, zip, GitHub Release
├── src/
│   ├── main.jsx, App.jsx
│   ├── components/     # Shared and feature components
│   ├── pages/           # Route pages
│   ├── services/        # DB, API, AI
│   ├── stores/          # Zustand stores
│   ├── context/        # Theme, i18n, onboarding
│   ├── i18n/locales/    # en-US, zh-CN
│   └── utils/
└── scripts/             # e.g. pack-zip.ps1
```

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/api-bridge.md](docs/api-bridge.md) | Local API: endpoints, auth, use with Clawdbot/scripts |
| [docs/data-storage.md](docs/data-storage.md) | Where the DB file is and how to access it |
| [docs/publish.md](docs/publish.md) | Build, pack zip, upload to GitHub Releases |

---

## Privacy and data

- All app data (schedule, habits, countdowns, settings, etc.) is stored in a local SQLite file.
- DB path is shown in **Settings → Data & reset** (“Database file path”), or see [docs/data-storage.md](docs/data-storage.md).
- Weather, news, and AI use API keys you configure; keys are stored only locally.

---

## Contributing and first-time Git setup

- `.gitignore` already excludes `node_modules/`, `dist/`, `dist-electron/`, `.env`, and local DB files.
- Prefer committing `package-lock.json` for reproducible installs (`npm ci`).
- Do not commit `.env`; keep and commit `.env.example` as a template.

---

## License

MIT. See [LICENSE](LICENSE).
