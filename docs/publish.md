# 上传 GitHub 与打包发布

## 一、上传到 GitHub

### 1. 在 GitHub 上创建仓库

1. 打开 [GitHub](https://github.com/new)
2. 仓库名建议：`personal-butler`（或自定义）
3. 选择 **Public**，**不要**勾选 “Add a README”（本地已有）
4. 创建仓库后，记下仓库地址，例如：`https://github.com/你的用户名/personal-butler.git`

### 2. 本地关联并推送

在项目根目录（`personal-butler`）执行：

```bash
# 若尚未初始化
git init

# 添加所有文件
git add .

# 首次提交
git commit -m "chore: initial commit - Personal Butler"

# 添加远程（把下面的 URL 换成你的仓库地址）
git remote add origin https://github.com/你的用户名/personal-butler.git

# 推送到 main 分支（若默认是 master 则改为 git push -u origin master）
git branch -M main
git push -u origin main
```

若使用 SSH：

```bash
git remote add origin git@github.com:你的用户名/personal-butler.git
git push -u origin main
```

---

## 二、打包应用

### 1. 一键打包

```bash
npm run build
```

会先执行 `vite build` 构建前端，再执行 `electron-builder` 打包桌面应用。

### 2. 打包报错「Access is denied」/「remove ... Access is denied」

electron-builder 会先清空 `dist-electron\win-unpacked` 再打包。若报错 **remove ... d3dcompiler_47.dll: Access is denied**，说明该目录下的文件被占用。请：

1. **关闭正在运行的 Personal Butler.exe**（若之前运行过打包好的 exe，先退出）
2. 关闭打开该文件夹的资源管理器窗口（若有）
3. 手动删除整个 `dist-electron` 文件夹（或至少删除 `dist-electron\win-unpacked`）
4. 再执行 `npm run build`

若仍报错，可重启电脑后再打包，或暂时关闭杀毒/安全软件对项目目录的实时扫描。

### 3. 国内网络 / 下载超时

打包时会从网络下载 Electron（约 108MB）。若从 GitHub 下载超时，项目已默认使用国内镜像 `https://npmmirror.com/mirrors/electron/`。  
若仍失败，可手动指定镜像后再打包：

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm run build

# 或一行（cmd）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ && npm run build
```

### 5. 主进程依赖说明

`main.js` 会加载 `src/services/` 下的数据库、API 桥接、日志等模块；打包时已在 `package.json` 的 `build.files` 中列入 `database-main.js`、`ai-bridge-server.js`、`logger.js`。若以后在 main 进程里新增 `require('./src/...')`，需在 `build.files` 中补充对应文件，否则打包后运行 exe 会报「找不到模块」。

### 4. 打包产物位置

- **输出目录**：`dist-electron/`
- **Windows（当前）**：使用 `dir` 目标，产物为 **未打包目录**  
  - 可执行程序：`dist-electron/win-unpacked/Personal Butler.exe`  
  - 可直接运行该 exe，或将整个 `win-unpacked` 文件夹打包成 zip 分发给用户
- **若需要 NSIS 安装包**：将 `package.json` 中 `build.win.target` 改为 `"nsis"` 后重新打包。此时会从 GitHub 下载 winCodeSign，国内网络可能需代理或多次重试；或设置环境变量使用镜像：  
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://release.autoshopee.com/mirrors/electron-builder-binaries/`

### 6. 无图标与跳过 exe 编辑说明

当前配置为 `signAndEditExecutable: false`，**不会**下载或解压 winCodeSign，可避免在 Windows 上因“创建符号链接需管理员/开发者模式”导致的解压失败。exe 使用 Electron 默认图标。  
若需自定义 exe 图标或版本信息：在 `build.win` 中设置 `"signAndEditExecutable": true` 并配置 `"icon": "build/icon.ico"`，且需以**管理员身份**运行打包，或先在 **设置 → 隐私与安全 → 面向开发人员** 中开启 **开发人员模式**（以便创建符号链接），然后执行 `npm run build`。

### 7. 减小打包体积

体积主要来自 **Electron + Chromium 运行时**（约 150–200 MB），应用代码（dist + 主进程）通常只有几 MB。当前已做减包处理：

- **`electronLanguages`: ["en-US", "zh-CN"]**：只保留英文与简体中文语言包，删除其余约 50 个 locale（可减少约 20–40 MB）。

重新执行 `npm run build` 后再 `npm run pack:zip`，zip 体积会明显减小。若仍需更小体积，可考虑使用 Electron 的 [compact 构建](https://www.electronjs.org/docs/latest/tutorial/small-binaries)（需改构建方式）。

### 8. 打压缩包并上传到 GitHub Release

**1. 打 zip 包**

在项目根目录执行（需已执行过 `npm run build`）：

```bash
npm run pack:zip
```

会在 `dist-electron/` 下生成 **`Personal-Butler-1.0.0-win-x64.zip`**（版本号取自 `package.json` 的 `version`）。解压后为同名文件夹，内含 `Personal Butler.exe` 及运行所需文件。

**2. 上传到 GitHub Release**

1. 打开你的仓库页面 → **Releases** → **Create a new release**
2. **Choose a tag**：输入新标签（如 `v1.0.0`），选 “Create new tag”
3. **Release title**：如 `v1.0.0` 或 `Personal Butler 1.0.0`
4. **Describe this release**：可写更新说明
5. 将 **`dist-electron/Personal-Butler-1.0.0-win-x64.zip`** 拖到 “Attach binaries by dropping them here or selecting them”
6. 点击 **Publish release**

发布后，用户可在 Release 页下载该 zip，解压后运行 `Personal Butler.exe`。

---

## 三、常用命令速查

| 操作           | 命令              |
|----------------|-------------------|
| 开发运行       | `npm run dev`     |
| 打包应用       | `npm run build`   |
| 打 zip 供 Release | `npm run pack:zip` |
| 仅构建前端     | `npm run build:react` |
| 仅打包 Electron | `npm run build:electron` |
| 推送到 GitHub  | `git push`        |
