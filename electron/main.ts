import { existsSync, mkdirSync } from "node:fs";
import { BrowserWindow, app, ipcMain, powerMonitor } from "electron";
import { readOrCreateConfig, writeConfig } from "./config.js";
import { Scheduler } from "./scheduler.js";
import { setupTray } from "./tray.js";
import type { AppConfig, AppRuntimeSnapshot, CheckOutcome, ManualCheckResult, ReminderAction } from "./types.js";
import { nowParts } from "./time.js";
import {
  hideReminderWindow,
  createMainWindow,
  displayReminderWindow,
  getMainWindow,
  getReminderWindow,
  markReminderWindowReady,
  showReminderWindow,
} from "./windows.js";
import { runCheck } from "./checkin-worker.js";

app.commandLine.appendSwitch("no-sandbox");

let scheduler: Scheduler;
let checkingTimer: NodeJS.Timeout | undefined;
let checkingEnabled = false;
let dueChecksInProgress = false;
let activeReminderWindowId: string | undefined;
let reminderCloseHandlerWired = false;

const MAX_TIMEOUT_DELAY = 2_147_483_647;

app.whenReady().then(async () => {
  ensureUserDataDir();
  const config = await readOrCreateConfig();
  scheduler = new Scheduler(config);
  registerIpc();
  createMainWindow();
  wireMainWindowCloseHandler();
  try {
    setupTray(toggleCheckingFromTray, checkNowFromTray);
  } catch (error) {
    console.warn("Tray setup failed:", error);
  }
  powerMonitor.on("resume", () => {
    scheduleNextCheck();
    emitRuntime();
  });
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
    scheduleNextCheck();
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
  ipcMain.handle("reminder:ready", () => markReminderWindowReady());
  ipcMain.handle("reminder:display-ready", () => displayReminderWindow());
  ipcMain.handle("reminder:snooze", (_event, windowId: string) => {
    scheduler.snooze(windowId, nowParts().time);
    activeReminderWindowId = undefined;
    hideReminderWindow();
    scheduleNextCheck();
    emitRuntime();
    return runtimeSnapshot();
  });
  ipcMain.handle("reminder:confirm", async (_event, windowId: string) => {
    const result = await runCheck(scheduler.getConfig());
    const { date, time } = nowParts();
    const action = scheduler.applyCheckResult(windowId, date, time, outcomeFrom(result), result.error?.message);
    handleAction(windowId, action);
    scheduleNextCheck();
    emitRuntime();
    return runtimeSnapshot();
  });
}

function startSchedulerLoop(): void {
  if (checkingEnabled) return;
  checkingEnabled = true;
  scheduleNextCheck();
  emitRuntime();
}

function stopSchedulerLoop(): void {
  if (!checkingEnabled && !checkingTimer) return;
  checkingEnabled = false;
  clearCurrentTimer();
  emitRuntime();
}

function scheduleNextCheck(): void {
  clearCurrentTimer();
  if (!checkingEnabled) return;

  const nextAt = scheduler.nextDueAt(nowParts());
  if (!nextAt) return;

  checkingTimer = setTimeout(() => {
    checkingTimer = undefined;
    void runDueChecks()
      .catch((error) => console.error("Scheduled check failed:", error))
      .finally(scheduleNextCheck);
  }, delayUntil(nextAt));
}

function clearCurrentTimer(): void {
  if (!checkingTimer) return;
  clearTimeout(checkingTimer);
  checkingTimer = undefined;
}

async function runDueChecks(): Promise<ReminderAction[]> {
  if (dueChecksInProgress) return [];
  dueChecksInProgress = true;
  try {
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
  } finally {
    dueChecksInProgress = false;
  }
}

async function runCheckNow(): Promise<ManualCheckResult> {
  const { date, time } = nowParts();
  const result = await runCheck(scheduler.getConfig());
  const actions: ReminderAction[] = [];
  const windows = scheduler.activeWindows(date, time);
  for (const window of windows) {
    const action = scheduler.applyCheckResult(window.id, date, time, outcomeFrom(result), result.error?.message);
    handleAction(window.id, action);
    if (action) actions.push(action);
  }
  scheduleNextCheck();
  emitRuntime();
  return {
    check: result,
    checkedWindowCount: windows.length,
    actions,
  };
}

function testReminder(): void {
  const { time } = nowParts();
  const window = scheduler.getConfig().reminderWindows.find((item) => item.enabled);
  if (!window) throw new Error("No enabled reminder window");
  const action: ReminderAction = {
    windowId: window.id,
    windowName: window.name,
    timeRange: `${window.startTime}-${window.endTime}`,
    lastCheckedAt: time,
    showReminder: true,
  };
  activeReminderWindowId = window.id;
  showReminderWindow(action);
  wireReminderWindowCloseHandler();
}

function testBrowser() {
  const browser = scheduler.getConfig().browser;
  if (browser.executablePath.trim() && !existsSync(browser.executablePath)) {
    return {
      ok: false,
      checkedIn: false,
      checkedAt: new Date().toISOString(),
      error: { code: "BROWSER_NOT_FOUND", message: "Browser path does not exist or is not readable" },
    };
  }
  if (browser.userDataDir.trim()) mkdirSync(browser.userDataDir, { recursive: true });
  return { ok: true, checkedIn: false, checkedAt: new Date().toISOString() };
}

function handleAction(windowId: string, action: ReminderAction | undefined): void {
  if (action) {
    activeReminderWindowId = action.windowId;
    showReminderWindow(action);
    wireReminderWindowCloseHandler();
  } else if (activeReminderWindowId === windowId) {
    activeReminderWindowId = undefined;
    hideReminderWindow();
  }
}

function runtimeSnapshot(): AppRuntimeSnapshot {
  return {
    checking: checkingEnabled,
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

function wireMainWindowCloseHandler(): void {
  const mainWindow = getMainWindow();
  mainWindow?.on("close", (event) => {
    if (scheduler.getConfig().hideToTrayOnClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function wireReminderWindowCloseHandler(): void {
  if (reminderCloseHandlerWired) return;
  const reminderWindow = getReminderWindow();
  if (!reminderWindow) return;
  reminderCloseHandlerWired = true;
  reminderWindow.on("closed", () => {
    reminderCloseHandlerWired = false;
  });
  reminderWindow.on("close", (event) => {
    event.preventDefault();
    if (activeReminderWindowId) {
      scheduler.snooze(activeReminderWindowId, nowParts().time);
      activeReminderWindowId = undefined;
      scheduleNextCheck();
    }
    reminderWindow.hide();
    emitRuntime();
  });
}

function toggleCheckingFromTray(): void {
  if (checkingEnabled) stopSchedulerLoop();
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

function delayUntil(target: Date): number {
  return Math.min(Math.max(0, target.getTime() - Date.now()), MAX_TIMEOUT_DELAY);
}
