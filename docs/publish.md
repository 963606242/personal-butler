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

### 2. 国内网络 / 下载超时

打包时会从网络下载 Electron（约 108MB）。若从 GitHub 下载超时，项目已默认使用国内镜像 `https://npmmirror.com/mirrors/electron/`。  
若仍失败，可手动指定镜像后再打包：

```bash
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm run build

# 或一行（cmd）
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ && npm run build
```

### 3. 打包产物位置

- **输出目录**：`dist-electron/`
- **Windows（当前）**：使用 `dir` 目标，产物为 **未打包目录**  
  - 可执行程序：`dist-electron/win-unpacked/Personal Butler.exe`  
  - 可直接运行该 exe，或将整个 `win-unpacked` 文件夹打包成 zip 分发给用户
- **若需要 NSIS 安装包**：将 `package.json` 中 `build.win.target` 改为 `"nsis"` 后重新打包。此时会从 GitHub 下载 winCodeSign，国内网络可能需代理或多次重试；或设置环境变量使用镜像：  
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://release.autoshopee.com/mirrors/electron-builder-binaries/`

### 4. 无图标与跳过 exe 编辑说明

当前配置为 `signAndEditExecutable: false`，**不会**下载或解压 winCodeSign，可避免在 Windows 上因“创建符号链接需管理员/开发者模式”导致的解压失败。exe 使用 Electron 默认图标。  
若需自定义 exe 图标或版本信息：在 `build.win` 中设置 `"signAndEditExecutable": true` 并配置 `"icon": "build/icon.ico"`，且需以**管理员身份**运行打包，或先在 **设置 → 隐私与安全 → 面向开发人员** 中开启 **开发人员模式**（以便创建符号链接），然后执行 `npm run build`。

### 5. 发布到 GitHub Release（可选）

1. 在 GitHub 仓库页面点击 **Releases** → **Create a new release**
2. 填写 Tag（如 `v1.0.0`）、标题和说明
3. 将 `dist-electron/` 下的安装包（如 `Personal Butler 1.0.0 Setup.exe`）拖入 “Attach binaries” 上传
4. 发布后，用户即可在 Release 页面下载安装包

---

## 三、常用命令速查

| 操作           | 命令              |
|----------------|-------------------|
| 开发运行       | `npm run dev`     |
| 打包应用       | `npm run build`   |
| 仅构建前端     | `npm run build:react` |
| 仅打包 Electron | `npm run build:electron` |
| 推送到 GitHub  | `git push`        |
