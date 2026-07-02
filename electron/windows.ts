import path from "node:path";
import { BrowserWindow, app } from "electron";
import type { ReminderAction } from "./types.js";

let mainWindow: BrowserWindow | undefined;
let reminderWindow: BrowserWindow | undefined;
let reminderWindowReadyResolve: (() => void) | undefined;
let reminderWindowReady: Promise<void> | undefined;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void loadRenderer(mainWindow).catch((error) => console.error("Main window load failed:", error));
  return mainWindow;
}

export function getMainWindow(): BrowserWindow | undefined {
  return mainWindow;
}

export function showMainWindow(): void {
  if (!mainWindow) createMainWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

export function ensureReminderWindow(): BrowserWindow {
  if (reminderWindow && !reminderWindow.isDestroyed()) return reminderWindow;
  reminderWindow = new BrowserWindow({
    width: 420,
    height: 240,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), "dist-electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  reminderWindow.on("closed", () => {
    reminderWindow = undefined;
    reminderWindowReadyResolve = undefined;
    reminderWindowReady = undefined;
  });
  reminderWindowReady = new Promise((resolve) => {
    reminderWindowReadyResolve = resolve;
  });
  void loadRenderer(reminderWindow, "#/reminder").catch((error) => {
    console.error("Reminder window load failed:", error);
  });
  return reminderWindow;
}

export function markReminderWindowReady(): void {
  reminderWindowReadyResolve?.();
}

export function showReminderWindow(action: ReminderAction): void {
  const window = ensureReminderWindow();
  void reminderWindowReady?.then(() => {
    if (window.isDestroyed()) return;
    window.webContents.send("reminder:update", action);
  });
}

export function displayReminderWindow(): void {
  if (!reminderWindow || reminderWindow.isDestroyed()) return;
  reminderWindow.show();
  reminderWindow.setAlwaysOnTop(true);
  reminderWindow.focus();
}

export function hideReminderWindow(): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.hide();
  }
}

export function getReminderWindow(): BrowserWindow | undefined {
  return reminderWindow;
}

function loadRenderer(window: BrowserWindow, hash = ""): Promise<void> {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    return window.loadURL(`${devUrl}${hash}`);
  }
  return window.loadFile(path.join(app.getAppPath(), "dist", "index.html"), { hash: hash.replace(/^#/, "") });
}
