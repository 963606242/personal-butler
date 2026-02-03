# 在 iPhone 上运行 Personal Butler

当前应用是 **Electron 桌面应用**（Windows），无法直接装到 iPhone。要在 iOS 上运行，需要换一种「壳」或形态。下面三种方式可选。

---

## 重要：Xcode 与 Mac

- **Xcode 只能在 Mac 上使用**，苹果没有提供 Windows 版，因此在 **Windows 上无法安装或使用 Xcode**。
- 若选择 **Capacitor** 或 **React Native** 做 iOS 版，编译、签名、真机/模拟器、上架 App Store 都需要在 Mac 上完成，**需要有一台 Mac**（购买、借用，或使用云 Mac 服务）。
- **若目前没有 Mac**，可优先考虑 **PWA**（见下方「方式二」）：在 Windows 上开发、部署网页，用户在 iPhone 的 Safari 里「添加到主屏幕」即可使用，无需 Mac。数据层需改为后端或浏览器端（如 IndexedDB）。

---

## 方式一：Capacitor（推荐，复用现有前端）

用 **Capacitor** 把现有的 React 前端包成 iOS 应用，在 iPhone 的 WebView 里跑同一套页面。

### 优点

- 复用绝大部分 React 代码（页面、状态、业务逻辑）
- 一套代码：桌面用 Electron，手机用 Capacitor
- 可上架 App Store（需苹果开发者账号）

### 前提

- **需要 Mac**，并安装 **Xcode**（用于编译、签名、真机/模拟器）
- 当前应用依赖 Electron 主进程（数据库 better-sqlite3、IPC、本地 API 等），在 iOS 上这些要换成 Capacitor 插件或纯前端方案

### 大致步骤

1. **安装 Capacitor**（在现有项目根目录）  
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Personal Butler" "com.personalbutler.app"
   ```

2. **配置 `capacitor.config.ts`**  
   - `webDir` 指向 Vite 构建输出，例如：`dist`  
   - 与现有 `vite build` 输出一致即可  

3. **构建 Web 并添加 iOS 平台**  
   ```bash
   npm run build:react
   npx cap add ios
   npx cap copy
   npx cap open ios
   ```

4. **在 Xcode 中**  
   - 选择模拟器或真机，点击 Run，即可在 iPhone（或模拟器）里看到应用  
   - 真机需要 Apple ID 签名；上架需要付费开发者账号  

5. **必须做的改造**  
   - 应用里大量使用 `window.electronAPI`（数据库、设置路径、API 桥、文件选择、通知等）。  
   - 在 iOS 上没有 Electron，需要：  
     - **抽象一层「平台 API」**：例如 `getStorage()`、`getDb()`、`notify()` 等；  
     - **在 Electron 环境**：这些方法内部走 `window.electronAPI` 和主进程；  
     - **在 Capacitor 环境**：这些方法内部改用 Capacitor 插件（如 `@capacitor/preferences`、`@capacitor-community/sqlite`、本地通知等）。  
   - 数据库：Electron 用的是 better-sqlite3（Node），iOS 上可改用 Capacitor 的 SQLite 插件或前端 IndexedDB（如 Dexie），通过同一套「平台 API」封装，业务代码尽量不直接依赖 Electron。  

### iOS 重点：通知提醒 / 代办 / 日程（Reminders & Calendar）

你提到的「通知提醒等功能请支持 iOS 的提醒、代办与日程」，建议按**三层**来做（从易到难）：

1. **本地通知（提醒）**：用 Capacitor 的 LocalNotifications（iOS 系统通知中心展示）  
2. **系统代办（Reminders）**：用 iOS EventKit（`EKReminder`）写入系统“提醒事项”  
3. **系统日程（Calendar）**：用 iOS EventKit（`EKEvent`）写入系统“日历”

在本项目里我已经把这些能力抽象进 `src/platform`：

- `showReminderNotification()`：立即通知（Electron / Web / Capacitor 都可工作）
- `scheduleLocalNotification()` / `cancelLocalNotification()`：定时通知（Capacitor 侧优先）
- `upsertTodo()` / `deleteTodo()`：系统代办（iOS Reminders）
- `upsertCalendarEvent()` / `deleteCalendarEvent()`：系统日程（iOS Calendar）
- `requestPermission('notifications'|'calendar'|'reminders')`：统一权限入口

#### 需要哪些插件？

- **通知（推荐先做）**：`@capacitor/local-notifications`
- **日历/提醒事项**：社区插件可用性不稳定，推荐你做一个**自定义 Capacitor 原生插件**，在 iOS 端用 EventKit：
  - 日历：`EKEventStore` + `EKEvent`
  - 提醒事项：`EKEventStore` + `EKReminder`

#### 为什么要自定义插件？

因为你的业务对象（“日程/代办/提醒”）需要和系统对象做**双向映射**（至少保存 `systemId`），并处理权限、日历/列表选择、删除/更新等细节；这部分用 EventKit 最直接、可控。

#### 实现顺序（建议）

1. 先把所有“提醒”统一走 `scheduleLocalNotification`（iOS 立刻有系统通知体验）
2. 再加“同步到系统提醒事项（代办）”开关：保存时调用 `upsertTodo`
3. 最后加“同步到系统日历”开关：保存时调用 `upsertCalendarEvent`

整体工作量：**中等**，主要是抽一层平台抽象 + 在 Capacitor 里实现一遍存储/通知等。

---

## 方式二：PWA（添加到主屏幕）

把现有前端做成 **PWA**，用户在 Safari 里打开你的网站，然后「添加到主屏幕」，图标和体验类似 App。

### 优点

- 不需要 Mac/Xcode，不需要上架审核  
- 部署到任意 HTTPS 网站即可  
- 开发、迭代快  

### 限制与改造

- 当前数据与逻辑依赖 **Electron 主进程**（Node、SQLite、本地 API）。浏览器里没有 Node，也没有 better-sqlite3。  
- 因此要么：  
  - **A）后端方案**：用 Node/其他服务提供 API + 数据库，PWA 只做前端；需要服务器和部署；  
  - **B）纯前端方案**：把所有数据迁到浏览器端（如 IndexedDB / Dexie），不再依赖 Electron 主进程；这样 PWA 可完全静态部署，但和现有 Electron 版数据不互通，需要较大改造。  

若选 PWA，通常还会：  
- 在 `vite.config.js` 里配置 PWA 插件（如 `vite-plugin-pwa`）  
- 写 `manifest.json`、Service Worker（离线/缓存）  
- 前端请求统一走 HTTP/HTTPS 接口（后端或未来云端）  

---

## 方式三：React Native（完全重写为原生 App）

用 **React Native** 重新写一个 iOS（以及可选的 Android）应用，UI 和导航用原生组件，数据层可重新设计或复用部分逻辑。

### 优点

- 真正的原生体验和性能  
- 方便上架 App Store / Google Play  
- 不受 WebView 限制  

### 缺点

- **几乎全部重写**：新项目、新组件、新导航，只能复用业务思路和部分纯 JS 逻辑（如习惯规则、日期计算等）  
- 需要单独维护一套 RN 代码  

---

## 建议总结

| 目标                 | 建议方式   | 说明 |
|----------------------|------------|------|
| 尽快在 iPhone 上跑起来，且尽量复用现有代码 | **Capacitor** | 用现有 Vite 构建，加 iOS 壳；需做「平台 API」抽象并实现 Capacitor 端。 |
| 不想维护原生项目，先让用户用浏览器访问     | **PWA**    | 需要先解决数据与接口：要么接后端，要么改为纯前端存储（IndexedDB）。 |
| 追求最佳原生体验、长期做移动端           | **React Native** | 新开 RN 项目，按需复用业务逻辑。 |

**实际操作建议**：  
- 若有 Mac 且打算正式做 iOS 版：按 **方式一（Capacitor）** 做，从「平台抽象层」+ `npm run build:react` + `cap add ios` 开始。  
- 若暂时没有 Mac：可先做 **PWA**（方式二），用后端或 IndexedDB 把数据层跑通，在 Safari 里「添加到主屏幕」即可在 iPhone 上使用。

如需，我可以按你当前项目结构，写一份更具体的 **Capacitor 接入清单**（包括要改哪些文件、如何抽象 `window.electronAPI`、推荐用哪些 Capacitor 插件）。
