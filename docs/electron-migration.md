# Electron 接入文档

本文档记录当前 Electron 方向的接入方案。项目不保留旧桌面运行时兼容层，检测逻辑只按 Playwright 页面自动化实现。

## 目标

- 桌面能力由 Electron 主进程负责。
- 渲染层继续使用 Vite + React。
- 前端通过 `window.checkinApi` 调用 Electron preload 暴露的白名单 API。
- 打卡检测使用 Playwright：打开目标网页、等待自动登录回跳、点击页面元素、捕获目标接口 response、判断是否已打卡。
- Playwright 不下载浏览器，使用用户配置的本机浏览器可执行文件或系统环境已有浏览器。

## 目录结构

```text
electron/
  checkin-worker.ts
  checkin-worker-core.mjs
  checkin-worker-core.test.mjs

src/
  lib/electron.ts
```

后续补齐 Electron 主进程时建议继续放在 `electron/`：

```text
electron/
  main.ts
  preload.ts
  ipc.ts
  config.ts
  scheduler.ts
  windows.ts
  tray.ts
  time.ts
```

## 前端 API

前端不直接使用 `ipcRenderer`，只调用 `window.checkinApi`。当前 `src/lib/electron.ts` 已经提供统一入口：

```ts
checkinApi.loadConfig();
checkinApi.saveConfig(config);
checkinApi.getRuntimeSnapshot();
checkinApi.startChecking();
checkinApi.pauseChecking();
checkinApi.runCheckNow();
checkinApi.testBrowser();
checkinApi.testReminder();
checkinApi.snoozeReminder(windowId);
checkinApi.confirmCheckedIn(windowId);
```

Electron preload 需要实现同名方法，并用 `contextBridge.exposeInMainWorld("checkinApi", api)` 暴露给渲染层。

## 检测配置

当前检测配置结构：

```ts
export type DetectionConfig = {
  mode: "mock" | "playwright_page";
  targetUrl: string;
  triggerSelector: string;
  responseUrlPattern: string;
  mockCheckedIn: boolean;
  checkedInKeyword: string;
  loginTimeoutSeconds: number;
  responseTimeoutSeconds: number;
};
```

字段含义：

- `targetUrl`：目标网页 urlA。
- `triggerSelector`：回到 urlA 后点击的元素选择器。
- `responseUrlPattern`：点击后需要捕获的目标接口 URL 片段或正则字符串。
- `checkedInKeyword`：用于判断已打卡的 response body 关键词。
- `loginTimeoutSeconds`：等待自动登录并回到 urlA 的最长时间。
- `responseTimeoutSeconds`：点击元素后等待目标接口 response 的最长时间。

## Playwright 检测流程

`electron/checkin-worker.ts` 已实现第一版流程：

1. 校验 `targetUrl`、`triggerSelector`、`responseUrlPattern`、`checkedInKeyword`。
2. 使用 `chromium.launchPersistentContext(userDataDir, options)` 启动持久化上下文。
3. 打开 `targetUrl`。
4. 如果站点跳转到登录页，由站点自动登录。
5. 等待 URL 回到 `targetUrl` 的 origin + pathname。
6. 等待 `triggerSelector` 出现。
7. 先注册 `page.waitForResponse(...)`。
8. 点击 `triggerSelector`。
9. 捕获匹配 `responseUrlPattern` 的 response。
10. 读取 response body。
11. `response.status()` 为 2xx 且 body 包含 `checkedInKeyword` 时判定已打卡。

核心可测试函数在 `electron/checkin-worker-core.mjs`：

- `matchesResponseUrl(responseUrl, pattern)`
- `isSameTargetPage(currentUrl, targetUrl)`
- `classifyCheckinResponse(status, body, checkedInKeyword)`
- `missingPlaywrightPageConfig(config)`

## 错误码

| 错误码 | 场景 |
| --- | --- |
| `MISSING_TARGET_URL` | 未配置目标网页 |
| `MISSING_TRIGGER_SELECTOR` | 未配置点击元素 |
| `MISSING_RESPONSE_PATTERN` | 未配置目标接口匹配规则 |
| `MISSING_CHECKED_IN_KEYWORD` | 未配置判断关键词 |
| `LOGIN_TIMEOUT` | 未在超时时间内回到目标网页 |
| `TRIGGER_NOT_FOUND` | 目标网页上找不到点击元素 |
| `RESPONSE_TIMEOUT` | 点击后未捕获目标接口 response |
| `CHECKIN_RESPONSE_NOT_OK` | 目标接口返回非 2xx |
| `PLAYWRIGHT_PAGE_CHECK_FAILED` | 其他 Playwright 运行错误 |

## 后续接入步骤

1. 新增 Electron `main.ts` 和 `preload.ts`。
2. 在 preload 中暴露 `window.checkinApi`。
3. 在主进程实现配置读写、窗口管理、托盘、调度器。
4. 在调度器中调用 `runCheck(config)`。
5. 配置 Electron 构建脚本和打包脚本。

## 验证

```bash
npm run build
npm run test:worker
```
