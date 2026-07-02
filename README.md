# 打卡提醒

Vite + React 前端，目标运行时为 Electron。打卡检测逻辑使用 Playwright 页面自动化：打开目标网页，等待站点自动登录回跳，点击指定元素，捕获目标接口 response，并根据关键词判断是否已打卡。

## Scripts

- `npm run dev`：启动 Vite 开发服务并打开 Electron 应用。
- `npm run build`：TypeScript 检查，构建前端，并编译 Electron 主进程到 `dist-electron/`。
- `npm run test:worker`：运行 Playwright 检测核心逻辑测试。

Electron 主进程迁移说明见 `docs/electron-migration.md`。

## 中国网络

项目的 `postinstall` 已设置：

- `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`

也就是说安装依赖时 Electron binary 走国内镜像，Playwright 不下载浏览器。
