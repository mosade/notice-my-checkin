import type { AppConfig, AppRuntimeSnapshot, CheckResult, ManualCheckResult } from "./types";

function unavailable<T>(name: string): Promise<T> {
  return Promise.reject(new Error(`Electron API is not available: ${name}`));
}

export const checkinApi = window.checkinApi ?? {
  loadConfig: () => unavailable<AppConfig>("loadConfig"),
  saveConfig: () => unavailable<AppConfig>("saveConfig"),
  getRuntimeSnapshot: () => unavailable<AppRuntimeSnapshot>("getRuntimeSnapshot"),
  startChecking: () => unavailable<AppRuntimeSnapshot>("startChecking"),
  pauseChecking: () => unavailable<AppRuntimeSnapshot>("pauseChecking"),
  runCheckNow: () => unavailable<ManualCheckResult>("runCheckNow"),
  testBrowser: () => unavailable<CheckResult>("testBrowser"),
  testReminder: () => unavailable<void>("testReminder"),
  reminderReady: () => unavailable<void>("reminderReady"),
  reminderDisplayReady: () => unavailable<void>("reminderDisplayReady"),
  snoozeReminder: () => unavailable<AppRuntimeSnapshot>("snoozeReminder"),
  confirmCheckedIn: () => unavailable<AppRuntimeSnapshot>("confirmCheckedIn"),
  onRuntimeUpdate: () => () => undefined,
  onReminderUpdate: () => () => undefined,
  onTrayToggleChecking: () => () => undefined,
  onTrayCheckNow: () => () => undefined,
};
