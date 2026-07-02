import { existsSync, mkdirSync } from "node:fs";
import { BrowserWindow, app, ipcMain } from "electron";
import { readOrCreateConfig, writeConfig } from "./config.js";
import { Scheduler } from "./scheduler.js";
import { setupTray } from "./tray.js";
import type { AppConfig, AppRuntimeSnapshot, CheckOutcome, ReminderAction } from "./types.js";
import { nowParts } from "./time.js";
import { hideReminderWindow, createMainWindow, ensureReminderWindow, getMainWindow, getReminderWindow, showReminderWindow } from "./windows.js";
import { runCheck } from "./checkin-worker.js";

app.commandLine.appendSwitch("no-sandbox");

let scheduler: Scheduler;
let checkingTimer: NodeJS.Timeout | undefined;
let activeReminderWindowId: string | undefined;

app.whenReady().then(async () => {
  ensureUserDataDir();
  const config = await readOrCreateConfig();
  scheduler = new Scheduler(config);
  registerIpc();
  createMainWindow();
  ensureReminderWindow();
  wireWindowCloseHandlers();
  try {
    setupTray(toggleCheckingFromTray, checkNowFromTray);
  } catch (error) {
    console.warn("Tray setup failed:", error);
  }
  if (config.autoStartChecking) startSchedulerLoop();
});

app.on("window-all-closed", () => {
  // Keep the tray app alive until the user quits from the tray menu.
});

function registerIpc(): void {
  ipcMain.handle("config:load", () => scheduler.getConfig());
  ipcMain.handle("config:save", async (_event, config: AppConfig) => {
    await writeConfig(config);
    scheduler.replaceConfig(config);
    emitRuntime();
    return config;
  });
  ipcMain.handle("runtime:snapshot", () => runtimeSnapshot());
  ipcMain.handle("checking:start", () => {
    startSchedulerLoop();
    return runtimeSnapshot();
  });
  ipcMain.handle("checking:pause", () => {
    stopSchedulerLoop();
    return runtimeSnapshot();
  });
  ipcMain.handle("checking:run-now", () => runCheckNow());
  ipcMain.handle("browser:test", () => testBrowser());
  ipcMain.handle("reminder:test", () => testReminder());
  ipcMain.handle("reminder:snooze", (_event, windowId: string) => {
    scheduler.snooze(windowId, nowParts().time);
    activeReminderWindowId = undefined;
    hideReminderWindow();
    emitRuntime();
    return runtimeSnapshot();
  });
  ipcMain.handle("reminder:confirm", async (_event, windowId: string) => {
    const result = await runCheck(scheduler.getConfig());
    const { date, time } = nowParts();
    const action = scheduler.applyCheckResult(windowId, date, time, outcomeFrom(result), result.error?.message);
    handleAction(windowId, action);
    emitRuntime();
    return runtimeSnapshot();
  });
}

function startSchedulerLoop(): void {
  if (checkingTimer) return;
  checkingTimer = setInterval(() => {
    void runDueChecks();
  }, 30_000);
  void runDueChecks();
}

function stopSchedulerLoop(): void {
  if (!checkingTimer) return;
  clearInterval(checkingTimer);
  checkingTimer = undefined;
  emitRuntime();
}

async function runDueChecks(): Promise<ReminderAction[]> {
  const { date, time } = nowParts();
  const due = scheduler.dueWindows(date, time);
  const actions: ReminderAction[] = [];
  for (const window of due) {
    const result = await runCheck(scheduler.getConfig());
    const action = scheduler.applyCheckResult(window.id, date, time, outcomeFrom(result), result.error?.message);
    handleAction(window.id, action);
    if (action) actions.push(action);
  }
  emitRuntime();
  return actions;
}

async function runCheckNow(): Promise<ReminderAction[]> {
  const { date, time } = nowParts();
  const due = scheduler.dueWindows(date, time);
  const windows = due.length > 0 ? due : scheduler.getConfig().reminderWindows.filter((window) => window.enabled);
  const actions: ReminderAction[] = [];
  for (const window of windows) {
    const result = await runCheck(scheduler.getConfig());
    const action = scheduler.applyCheckResult(window.id, date, time, outcomeFrom(result), result.error?.message);
    handleAction(window.id, action);
    if (action) actions.push(action);
  }
  emitRuntime();
  return actions;
}

function testReminder(): void {
  const window = scheduler.getConfig().reminderWindows.find((item) => item.enabled);
  if (!window) throw new Error("没有启用的提醒时间段");
  const action: ReminderAction = {
    windowId: window.id,
    windowName: window.name,
    timeRange: `${window.startTime}-${window.endTime}`,
    lastCheckedAt: nowParts().time,
    showReminder: true,
  };
  activeReminderWindowId = window.id;
  showReminderWindow(action);
}

function testBrowser() {
  const browser = scheduler.getConfig().browser;
  if (browser.executablePath.trim() && !existsSync(browser.executablePath)) {
    return {
      ok: false,
      checkedIn: false,
      checkedAt: new Date().toISOString(),
      error: { code: "BROWSER_NOT_FOUND", message: "浏览器路径不存在或不可读取" },
    };
  }
  if (browser.userDataDir.trim()) mkdirSync(browser.userDataDir, { recursive: true });
  return { ok: true, checkedIn: false, checkedAt: new Date().toISOString() };
}

function handleAction(windowId: string, action: ReminderAction | undefined): void {
  if (action) {
    activeReminderWindowId = action.windowId;
    showReminderWindow(action);
  } else if (activeReminderWindowId === windowId) {
    activeReminderWindowId = undefined;
    hideReminderWindow();
  }
}

function runtimeSnapshot(): AppRuntimeSnapshot {
  return {
    checking: Boolean(checkingTimer),
    states: scheduler.runtimeStates(),
  };
}

function emitRuntime(): void {
  const snapshot = runtimeSnapshot();
  BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("runtime:update", snapshot));
}

function outcomeFrom(result: { ok: boolean; checkedIn: boolean }): CheckOutcome {
  if (result.ok && result.checkedIn) return "checked_in";
  if (result.ok) return "not_checked_in";
  return "error";
}

function wireWindowCloseHandlers(): void {
  const mainWindow = getMainWindow();
  mainWindow?.on("close", (event) => {
    if (scheduler.getConfig().hideToTrayOnClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  const reminderWindow = getReminderWindow();
  reminderWindow?.on("close", (event) => {
    event.preventDefault();
    if (activeReminderWindowId) {
      scheduler.snooze(activeReminderWindowId, nowParts().time);
      activeReminderWindowId = undefined;
    }
    reminderWindow.hide();
    emitRuntime();
  });
}

function toggleCheckingFromTray(): void {
  if (checkingTimer) stopSchedulerLoop();
  else startSchedulerLoop();
  BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("tray:toggle-checking"));
}

function checkNowFromTray(): void {
  BrowserWindow.getAllWindows().forEach((window) => window.webContents.send("tray:check-now"));
  void runCheckNow();
}

function ensureUserDataDir(): void {
  mkdirSync("browser-profile", { recursive: true });
}
