# 提醒打卡应用设计方案

## 背景

项目当前是一个初始的 Tauri 2 + React 19 + Vite + TypeScript 桌面应用。目标是实现一个仅支持 Windows 的本地提醒打卡工具：用户可以配置多个提醒时间段，应用在时间段内检测是否已经打卡；如果未检测到打卡记录，则弹出置顶提醒窗口；用户关闭或选择稍后提醒后，应用按配置间隔再次检测并提醒。

真实登录链接和检测接口暂未确定。第一版需要实现完整应用骨架、调度链路、置顶提醒、后台托盘和 Playwright 检测框架，但检测结果先由 mock adapter 提供。

## 目标

- 支持 Windows 桌面端。
- 支持多个提醒时间段。
- 支持每个时间段配置提醒间隔。
- 支持启动后自动开始检测。
- 支持关闭主窗口后隐藏到系统托盘。
- 支持置顶提醒窗口。
- 支持用户点击“我已打卡”后立即复查。
- 支持用户点击“稍后提醒”或关闭提醒窗口后按间隔再次提醒。
- 支持配置 Playwright 使用的本机浏览器路径。
- 支持 Playwright 有界面和无头两种运行方式。
- 使用应用目录下的 JSON 文件保存配置。
- 第一版检测逻辑使用 mock adapter，后续可替换为真实登录和接口检测 adapter。

## 非目标

- 第一版不支持 macOS 或 Linux。
- 第一版不实现真实接口 B 的通用 HTTP 配置和 JSON 判断表达式。
- 第一版不强制实现开机自启。
- 第一版不把配置写入 Windows 应用数据目录。
- 第一版不处理跨天时间段，例如 `23:00-01:00`。

## 推荐架构

采用 Tauri/Rust 桌面壳 + React 配置界面 + Node Playwright worker。

React 前端负责配置页面、当前检测状态、时间段列表、手动开始/暂停、立即检测、测试提醒和查看最近检测结果。

Tauri/Rust 主进程负责 Windows 桌面能力：主窗口、置顶提醒窗口、系统托盘、隐藏/显示、退出、读取/写入本地 JSON 配置、启动/停止调度器，以及调用 Node worker 执行单次检测。

Node Playwright worker 负责检测流程骨架：读取检测配置，按需启动指定本机浏览器，支持 `headless` 开关，预留登录链接 A 的跳转和 cookie 获取流程。第一版默认检测结果由 mock adapter 返回。

Checkin adapter 先实现 `MockCheckinAdapter`，接口固定为“检查当前是否已打卡”。后续真实 `链接 A / 接口 B` 确定后，新增或替换为 `PlaywrightHttpCheckinAdapter`，不影响 UI、调度器和提醒窗口。

选择该架构的原因：

- Playwright 属于 Node 生态，放在 Node worker 中接入最自然。
- Tauri/Rust 更适合控制 Windows 桌面能力和应用生命周期。
- React 适合快速实现配置和状态 UI。
- mock adapter 能先验证主业务链路，避免在真实接口未知时过早设计复杂通用配置。

## 配置文件

配置文件放在应用目录下：

- 开发环境：项目目录下的 `config/app-config.json`
- 打包后：应用 exe 同级目录或应用资源目录旁的 `config/app-config.json`

如果配置文件不存在，应用首次启动时自动创建默认配置。日志后续可放在同一目录下的 `logs/`。

Windows 权限限制需要明确：如果应用被安装到 `C:\Program Files\...`，普通用户可能没有写入应用目录的权限。第一版建议使用免安装目录或用户可写目录运行。

配置结构：

```ts
type AppConfig = {
  autoStartChecking: boolean;
  hideToTrayOnClose: boolean;
  browser: {
    executablePath: string;
    headless: boolean;
    userDataDir: string;
  };
  detection: {
    mode: "mock";
    loginUrl: string;
    apiUrl: string;
    mockCheckedIn: boolean;
  };
  reminderWindows: ReminderWindow[];
};

type ReminderWindow = {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  remindIntervalMinutes: number;
};
```

字段说明：

- `autoStartChecking`：应用启动后是否自动开始检测。
- `hideToTrayOnClose`：关闭主窗口时是否隐藏到托盘。
- `browser.executablePath`：本机浏览器路径，例如 `C:\Program Files\Google\Chrome\Application\chrome.exe`。
- `browser.headless`：是否使用无头模式。
- `browser.userDataDir`：Playwright 用户数据目录，用于后续持久化登录会话。
- `detection.mode`：第一版固定为 `mock`。
- `detection.loginUrl`：登录链接 A，占位保存。
- `detection.apiUrl`：接口 B，占位保存。
- `detection.mockCheckedIn`：mock 检测结果。
- `reminderWindows`：多个提醒时间段。

时间段校验规则：

- `startTime < endTime`
- 第一版只支持同一天时间段。
- `remindIntervalMinutes >= 1`
- 允许多个时间段重叠，但 UI 应提示用户存在重叠；第一版不强制禁止。

## 运行时状态

每个时间段按日期维护独立运行时状态。

```ts
type RuntimeWindowState = {
  reminderWindowId: string;
  date: string;
  status: ReminderRuntimeStatus;
  lastCheckedAt?: string;
  nextReminderAt?: string;
  lastError?: string;
};

type ReminderRuntimeStatus =
  | "idle"
  | "checking"
  | "not_checked_in"
  | "reminding"
  | "checked_in"
  | "expired"
  | "error";
```

状态含义：

- `idle`：当前未进入该时间段。
- `checking`：正在执行检测。
- `not_checked_in`：检测成功，但未检测到打卡记录。
- `reminding`：提醒窗口正在显示或等待用户处理。
- `checked_in`：该时间段当天已经检测到打卡。
- `expired`：时间段已结束，未继续提醒。
- `error`：检测失败，例如 worker 异常或浏览器路径无效。

## 调度流程

调度逻辑由 Rust 主进程管理，Node worker 只执行单次检测。

应用启动流程：

1. 读取应用目录下 `config/app-config.json`。
2. 如果文件不存在，创建默认配置。
3. 打开主窗口。
4. 如果 `autoStartChecking = true`，启动调度器。

调度器流程：

1. 每 30 秒检查当前时间是否进入任一启用时间段。
2. 对每个时间段按当天日期单独管理状态。
3. 时间段开始后立即执行一次检测。
4. 如果检测到已打卡，将该时间段当天状态标记为 `checked_in`。
5. 如果未检测到打卡，打开置顶提醒窗口，并记录 `nextReminderAt = now + remindIntervalMinutes`。
6. 如果检测失败，将状态标记为 `error`，显示错误提醒，并按提醒间隔重试。

用户关闭提醒或点击“稍后提醒”：

1. 隐藏提醒窗口。
2. 不改变打卡状态。
3. 到达 `nextReminderAt` 后再次执行检测。
4. 若仍未打卡，再次弹出置顶提醒。

用户点击“我已打卡”：

1. 立即执行一次检测。
2. 若检测为已打卡，关闭提醒窗口，该时间段当天停止提醒。
3. 若仍未打卡，显示“暂未检测到打卡记录”，关闭后继续按间隔提醒。
4. 若检测失败，显示错误信息，并继续按间隔重试。

离开时间段：

1. 到达 `endTime` 后，该时间段当天停止提醒。
2. 如果此前没有检测到打卡，状态标记为 `expired`。
3. 第二天同一时间段重置状态。

## 窗口和托盘

第一版包含主窗口、提醒窗口和系统托盘。

主窗口 `main`：

- 默认启动时显示。
- 用于配置、查看状态、手动开始/暂停、立即检测、测试浏览器、测试提醒窗口。

提醒窗口 `reminder`：

- 检测到未打卡或检测异常时创建或显示。
- 设置为 always on top。
- 显示时聚焦。
- 建议尺寸 `420x220`。
- 不作为普通后台窗口使用。
- 关闭按钮等同于“稍后提醒”。

提醒窗口内容：

- 标题：`还没有检测到打卡记录`
- 当前时间段名称，例如 `上午打卡 08:00-09:00`
- 最近检测时间。
- 错误场景显示简短错误，例如 `检测失败：浏览器路径无效`。
- 按钮：`我已打卡` 和 `稍后提醒`。

置顶策略：

1. 每次提醒触发时调用窗口 `show`。
2. 调用 `set_focus`。
3. 调用 `set_always_on_top(true)`。
4. 如果提醒窗口已存在，更新内容并重新聚焦。
5. 用户关闭后隐藏窗口，不销毁运行状态。
6. 时间段结束或确认已打卡后关闭或隐藏提醒窗口。

系统托盘：

- 关闭主窗口时，如果 `hideToTrayOnClose = true`，隐藏主窗口而不是退出。
- 托盘菜单包含：`打开`、`开始检测`/`暂停检测`、`立即检测`、`退出`。
- `退出` 才真正结束应用和调度器。

## Playwright Worker

worker 输入：

```ts
type CheckRequest = {
  browser: {
    executablePath: string;
    headless: boolean;
    userDataDir: string;
  };
  detection: {
    mode: "mock";
    loginUrl: string;
    apiUrl: string;
    mockCheckedIn: boolean;
  };
  reminderWindowId: string;
};
```

worker 输出：

```ts
type CheckResult = {
  ok: boolean;
  checkedIn: boolean;
  checkedAt: string;
  error?: {
    code: string;
    message: string;
  };
};
```

第一版 adapter 行为：

- `mode = "mock"` 时，不请求真实网络。
- 返回 `mockCheckedIn` 作为检测结果。
- 提供“测试浏览器”命令，验证浏览器路径、headless 模式和 `userDataDir` 可写性。

后续真实 adapter 预留流程：

1. 使用 Playwright 启动指定浏览器。
2. 打开 `loginUrl`。
3. 等待跳转完成或指定 URL 条件。
4. 从 browser context 获取 cookies/session。
5. 使用 cookie 请求 `apiUrl`。
6. 根据接口响应判断是否已打卡。

不在第一版实现通用 HTTP 配置的原因：

- 链接 A 和接口 B 都未确定。
- 真实登录链路可能包含重定向、单点登录、CSRF、特殊 header。
- 提前引入 JSONPath 或表达式配置会增加 UI 和调试复杂度。
- 等接口明确后写专用 adapter 更可靠。

## 建议文件结构

```text
src/
  App.tsx
  App.css
  components/
    BrowserSettings.tsx
    DetectionSettings.tsx
    ReminderWindowEditor.tsx
    RuntimeStatusPanel.tsx
  lib/
    config.ts
    time.ts
    types.ts
src-tauri/
  src/
    lib.rs
    config.rs
    scheduler.rs
    worker.rs
    tray.rs
    windows.rs
worker/
  check-worker.ts
  types.ts
  adapters/
    mock-checkin-adapter.ts
  browser/
    launch-browser.ts
config/
  app-config.json
logs/
```

Rust/Tauri 文件职责：

- `config.rs`：读取和写入应用目录下的 JSON 配置，首次启动创建默认配置。
- `scheduler.rs`：管理时间段状态、进入时间段检测、提醒间隔复查、跨天重置。
- `worker.rs`：调用 Node worker，传入 JSON，解析检测结果。
- `windows.rs`：管理主窗口和提醒窗口，置顶、聚焦、隐藏、显示。
- `tray.rs`：管理系统托盘菜单和事件。

React 文件职责：

- 配置表单。
- 保存配置。
- 手动开始和暂停检测。
- 立即检测。
- 测试浏览器。
- 测试提醒窗口。
- 展示 runtime 状态。

Worker 文件职责：

- `worker/check-worker.ts`：命令入口和参数解析。
- `worker/types.ts`：请求和响应类型。
- `worker/adapters/mock-checkin-adapter.ts`：mock 检测。
- `worker/browser/launch-browser.ts`：Playwright 启动和路径校验。

## 测试策略

前端：

- 时间段表单校验。
- 配置对象序列化和反序列化。
- 第一版以 `npm run build` 作为基础验证。

worker：

- mock adapter 单元测试。
- browser path 校验函数测试。
- worker 输入输出 JSON contract 测试。

Rust：

- 配置文件读写测试。
- 时间段命中判断测试。
- 调度状态转换测试：首次进入、未打卡、稍后提醒、已打卡、过期、跨天重置。

手动验收：

1. 设置一个当前时间附近的时间段。
2. 将 mock 结果设为未打卡，确认置顶弹窗出现。
3. 点击稍后提醒，确认间隔后再次出现。
4. 将 mock 结果改为已打卡，点击我已打卡，确认本时间段停止提醒。
5. 关闭主窗口，确认隐藏到托盘。
6. 通过托盘打开、暂停、立即检测和退出。
7. 测试指定浏览器路径。
8. 测试有界面和 headless 两种模式。

## 实施顺序建议

1. 建立共享类型和默认配置。
2. 实现配置文件读写。
3. 实现 React 配置页面。
4. 实现 worker mock adapter。
5. 实现 Rust 调用 worker 的单次检测。
6. 实现调度器和运行时状态。
7. 实现提醒窗口。
8. 实现托盘行为。
9. 实现测试浏览器命令。
10. 完成构建和手动验收。

