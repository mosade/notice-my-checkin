/// <reference types="vite/client" />

import type { AppConfig, AppRuntimeSnapshot, CheckResult, ReminderAction } from "./lib/types";

export {};

declare global {
  interface Window {
    checkinApi?: {
      loadConfig: () => Promise<AppConfig>;
      saveConfig: (config: AppConfig) => Promise<AppConfig>;
      getRuntimeSnapshot: () => Promise<AppRuntimeSnapshot>;
      startChecking: () => Promise<AppRuntimeSnapshot>;
      pauseChecking: () => Promise<AppRuntimeSnapshot>;
      runCheckNow: () => Promise<ReminderAction[]>;
      testBrowser: () => Promise<CheckResult>;
      testReminder: () => Promise<void>;
      snoozeReminder: (windowId: string) => Promise<AppRuntimeSnapshot>;
      confirmCheckedIn: (windowId: string) => Promise<AppRuntimeSnapshot>;
      onRuntimeUpdate: (callback: (snapshot: AppRuntimeSnapshot) => void) => () => void;
      onReminderUpdate: (callback: (action: ReminderAction) => void) => () => void;
      onTrayToggleChecking: (callback: () => void) => () => void;
      onTrayCheckNow: (callback: () => void) => () => void;
    };
  }
}
