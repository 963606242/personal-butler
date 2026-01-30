# 数据存储位置与外部访问

## 数据库文件在哪里

应用使用 **SQLite**（单文件数据库），路径为：

```
{用户数据目录}/personal-butler/personal-butler.db
```

**用户数据目录** 由 Electron 的 `app.getPath('userData')` 决定，因系统而异：

| 系统   | 典型路径 |
|--------|----------|
| Windows | `C:\Users\<你的用户名>\AppData\Roaming\personal-butler` |
| macOS   | `~/Library/Application Support/personal-butler` |
| Linux   | `~/.config/personal-butler` |

因此，数据库文件的完整路径示例：

- **Windows**：`C:\Users\<用户名>\AppData\Roaming\personal-butler\personal-butler\personal-butler.db`
- **macOS**：`~/Library/Application Support/personal-butler/personal-butler/personal-butler.db`
- **Linux**：`~/.config/personal-butler/personal-butler/personal-butler.db`

在应用内：打开 **设置 → 数据与重置**，可看到当前环境的数据库路径，并支持一键复制。

---

## 外部如何访问

### 方式一：通过本地 HTTP API（推荐）

应用在 **设置 → AI 调用本应用** 中开启并保存后，会启动本地 HTTP API（默认 `http://127.0.0.1:3847`）。  
外部脚本、Clawdbot、Cron 等可通过该 API 读写习惯、日程、倒数日、今日摘要等，**无需直接操作数据库文件**。

详见：[api-bridge.md](./api-bridge.md)

### 方式二：直接读写数据库文件

- **备份**：关闭应用后，将 `personal-butler.db` 复制到其他目录即可。
- **只读查看**：应用运行时，SQLite 允许多个只读连接。可用 [DB Browser for SQLite](https://sqlitebrowser.org/) 等工具以**只读**方式打开该文件查看数据；不要在同一时间用工具写入，否则可能损坏数据库。
- **写入/迁移**：若需用外部程序写入或做数据迁移，建议**先退出应用**，再操作数据库文件，完成后再启动应用。

---

## 小结

| 需求           | 建议做法 |
|----------------|----------|
| 外部程序读/写数据 | 使用本地 API（见 api-bridge.md） |
| 备份数据库     | 关闭应用后复制 `personal-butler.db` |
| 查看表结构/数据 | 用 SQLite 工具以只读方式打开，或关闭应用后随意打开 |
