# 安全政策

## 支持的版本

目前对当前主分支（main/master）的最近发布版本提供安全相关更新。

## 如何报告漏洞

如发现与安全相关的问题（如数据泄露、权限绕过、依赖严重漏洞等），请**不要**在公开 Issue 中描述细节。

请通过以下方式私下反馈：

- **GitHub 安全建议**：在仓库页打开 **Security** → **Advisories** → **Report a vulnerability**，或  
- **Issues**：新建一条 **Private security vulnerability** 类型的 Issue（若仓库已启用）。

我们会尽快确认并回复；修复后会在此或 Release 中说明（在不暴露利用细节的前提下）。

## 隐私与数据

- 应用数据存于本机 SQLite，详见 [docs/data-storage.md](docs/data-storage.md)。
- API 密钥等仅存于本地配置，不会上传到本仓库或第三方。

感谢你负责任地披露问题。
