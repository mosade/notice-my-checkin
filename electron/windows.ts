import path from "node:path";
import { BrowserWindow, app } from "electron";
import type { ReminderAction } from "./types.js";

let mainWindow: BrowserWindow | undefined;
let reminderWindow: BrowserWindow | undefined;

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
  loadRenderer(mainWindow);
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
  loadRenderer(reminderWindow, "#/reminder");
  return reminderWindow;
}

export function showReminderWindow(action: ReminderAction): void {
  const window = ensureReminderWindow();
  window.webContents.send("reminder:update", action);
  window.show();
  window.setAlwaysOnTop(true);
  window.focus();
}

export function hideReminderWindow(): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    reminderWindow.hide();
  }
}

export function getReminderWindow(): BrowserWindow | undefined {
  return reminderWindow;
}

function loadRenderer(window: BrowserWindow, hash = ""): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void window.loadURL(`${devUrl}${hash}`);
    return;
  }
  void window.loadFile(path.join(app.getAppPath(), "dist", "index.html"), { hash: hash.replace(/^#/, "") });
}
