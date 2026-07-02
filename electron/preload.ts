import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig, AppRuntimeSnapshot, CheckResult, ManualCheckResult, ReminderAction } from "./types.js";

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.off(channel, listener);
}

contextBridge.exposeInMainWorld("checkinApi", {
  loadConfig: () => ipcRenderer.invoke("config:load") as Promise<AppConfig>,
  saveConfig: (config: AppConfig) => ipcRenderer.invoke("config:save", config) as Promise<AppConfig>,
  getRuntimeSnapshot: () => ipcRenderer.invoke("runtime:snapshot") as Promise<AppRuntimeSnapshot>,
  startChecking: () => ipcRenderer.invoke("checking:start") as Promise<AppRuntimeSnapshot>,
  pauseChecking: () => ipcRenderer.invoke("checking:pause") as Promise<AppRuntimeSnapshot>,
  runCheckNow: () => ipcRenderer.invoke("checking:run-now") as Promise<ManualCheckResult>,
  testBrowser: () => ipcRenderer.invoke("browser:test") as Promise<CheckResult>,
  testReminder: () => ipcRenderer.invoke("reminder:test") as Promise<void>,
  reminderReady: () => ipcRenderer.invoke("reminder:ready") as Promise<void>,
  reminderDisplayReady: () => ipcRenderer.invoke("reminder:display-ready") as Promise<void>,
  snoozeReminder: (windowId: string) =>
    ipcRenderer.invoke("reminder:snooze", windowId) as Promise<AppRuntimeSnapshot>,
  confirmCheckedIn: (windowId: string) =>
    ipcRenderer.invoke("reminder:confirm", windowId) as Promise<AppRuntimeSnapshot>,
  onRuntimeUpdate: (callback: (snapshot: AppRuntimeSnapshot) => void) =>
    subscribe<AppRuntimeSnapshot>("runtime:update", callback),
  onReminderUpdate: (callback: (action: ReminderAction) => void) =>
    subscribe<ReminderAction>("reminder:update", callback),
  onTrayToggleChecking: (callback: () => void) => subscribe<void>("tray:toggle-checking", callback),
  onTrayCheckNow: (callback: () => void) => subscribe<void>("tray:check-now", callback),
});
