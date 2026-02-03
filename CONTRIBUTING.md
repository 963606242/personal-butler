# 贡献指南

欢迎对 Personal Butler（个人管家）提建议或贡献代码。

## 如何参与

- **Bug、建议、讨论**：在仓库 [Issues](https://github.com/963606242/personal-butler/issues) 里新建 Issue，尽量写清复现步骤或需求。
- **代码贡献**：Fork 本仓库 → 在分支上修改 → 提交 [Pull Request](https://github.com/963606242/personal-butler/pulls)，并简要说明改动目的。

## 开发与提交

- 本地：`npm install` 后 `npm run dev` 跑起开发环境。
- 提交前建议在本地执行 `npm run build:react` 确保能通过构建。
- PR 描述里请说明：改了什么、为什么这样改（若只修 typo/文档可简短写一句）。

## 代码与风格

- 现有代码以 React + Ant Design + Zustand 为主，新代码请与现有风格一致。
- 多语言文案在 `src/i18n/locales/`（zh-CN、en-US），新增界面请同时补中英文。

没有强制流程，保持友好沟通即可。感谢你的参与。
