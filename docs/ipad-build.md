# 在 iPad 上打包为原生应用

本项目已接入 **Capacitor**，可将 Web 应用打包为 iOS/iPadOS 原生应用，在 iPad 上安装使用（非浏览器）。

## 前提

- **需要 Mac**：编译、签名、真机运行和上架 App Store 均需在 Mac 上使用 Xcode。
- 已安装 **Xcode**（从 App Store 安装）及 **Xcode Command Line Tools**。

## 快速步骤

### 1. 构建 Web 并同步到 iOS 工程

在项目根目录执行：

```bash
npm run build:ios
```

或分步执行：

```bash
npm run build:react    # 生成 dist/
npx cap sync ios       # 将 dist 复制到 ios/App/App/public 并更新原生依赖
```

### 2. 在 Mac 上打开 Xcode 并运行

```bash
npx cap open ios
```

在 Xcode 中：

- 选择 **iPad** 或 **iPhone** 模拟器，或连接真机；
- 点击 **Run**（▶️）即可在 iPad/iPhone 上运行。

### 3. 真机安装

- 在 Xcode 顶部选择你的 iPad/iPhone 设备；
- 首次运行需在设备上信任开发者证书：**设置 → 通用 → VPN 与设备管理** 中信任你的 Apple ID；
- 若需长期安装或上架，需加入 [Apple 开发者计划](https://developer.apple.com/programs/)（付费）并配置签名。

## 数据与能力说明

- **本地优先**：所有数据优先存于本机。Windows 版为 SQLite，iPad/Web 版为 sql.js + IndexedDB，**不依赖自建服务器**。
- **同步**：Windows 与 iPad 均支持同一套**网盘同步**（OneDrive / Google Drive / Dropbox / **WebDAV**）。数据加密后存于您自己的网盘，无需在本应用注册账号；其他设备配置相同网盘与加密密码即可拉取。iPad 上推荐使用 **WebDAV**（如坚果云、Nextcloud）或按设置页完成 OAuth 登录。
- **通知**：若已安装 `@capacitor/local-notifications`，可在 iPad 上使用本地通知；否则为占位实现。

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run build:ios` | 构建 Web 并执行 `cap sync ios` |
| `npm run cap:sync` | 仅同步 Web 资源到各平台（不构建） |
| `npx cap open ios` | 用 Xcode 打开 iOS 工程（需在 Mac 上执行） |

## 在 Windows 上开发时

- 可在 Windows 上正常执行 `npm run build:react`、`npm run build:ios`、`npx cap sync`。
- **无法**在 Windows 上执行 `npx cap open ios` 或编译/运行 iOS 应用，需在 Mac 上完成打开 Xcode、运行模拟器/真机、归档上架等操作。

## 多设备支持

- 当前 iOS 目标为 **Universal**（iPhone + iPad），同一应用可在 iPhone 与 iPad 上安装。
- 界面已做安全区适配（`env(safe-area-inset-*)`），在刘海屏与带 Home 条的设备上内容不会被遮挡。
