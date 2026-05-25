# 敬拜歌库网站

这是一个静态中文敬拜歌谱库，可从 Google Sheets 读取歌曲信息，并通过 Google Drive 在线预览、下载 PDF 谱子。

## 目录结构

- `index.html` — 首页
- `assets/css/style.css` — 页面样式
- `assets/js/config.js` — 配置 Google Sheets CSV 链接
- `assets/js/app.js` — 网站逻辑

## 你需要准备的内容

1. GitHub 账户
2. Google 账户（用于 Google Sheets 和 Google Drive）
3. 你的歌谱 PDF 已上传到 Google Drive，并设置为“任何拥有链接的人都可以查看”

## Google Sheets 配置

1. 打开 Google Sheets，创建一个新表格。
2. 将第一行设置为列标题：
   - `Title`
   - `Chinese Title`
   - `Key`
   - `Theme`
   - `Occasion`
   - `Language`
   - `PDF Link`
   - `Notes`（可选）
3. 每首歌曲一行，填写对应内容。
4. `Theme` 和 `Occasion` 字段建议使用分号 `;` 分隔多个标签，例如：`敬拜; 赞美`。
5. 点击 `文件 > 发布到网站`，选择 `CSV`，复制生成的 URL。

## 配置网站

1. 在 `assets/js/config.js` 中，把 `sheetCsvUrl` 替换为你发布后的 Google Sheets CSV 链接。

```js
const CONFIG = {
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXXXXXXXX/pub?output=csv",
};
```

2. 如果你希望使用 GitHub Pages 部署：
   - 在 GitHub 上创建一个新仓库
   - 推送本项目到仓库
   - 在仓库设置里启用 GitHub Pages，选择 `main` 分支和根目录

## 添加新歌曲的步骤

1. 在 MuseScore 中编辑歌词和歌曲谱。
2. 导出 PDF。
3. 上传 PDF 到 Google Drive，设置为“任何拥有链接的人都可以查看”。
4. 在 Google Sheets 中新增一行，填写歌曲信息，并粘贴 PDF 链接。
5. 打开网站即可自动读取最新歌曲列表。

## 说明

- 该站点目前使用 Google Drive 的预览链接作为 PDF 在线查看方式。
- 如果你希望以后改成直接将 PDF 放在代码仓库内，也可以将 `PDF Link` 改成仓库中的 URL。
- 本项目内容完全免费，不需要 MuseScore Pro。`
