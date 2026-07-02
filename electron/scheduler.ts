import { addMinutes, isAtOrAfter, timeInWindow } from "./time.js";
import type { AppConfig, CheckOutcome, ReminderAction, ReminderWindow, RuntimeWindowState } from "./types.js";

export class Scheduler {
  private config: AppConfig;
  private states = new Map<string, RuntimeWindowState>();

  constructor(config: AppConfig) {
    this.config = config;
  }

  getConfig(): AppConfig {
    return structuredClone(this.config);
  }

  replaceConfig(config: AppConfig): void {
    this.config = config;
    for (const windowId of this.states.keys()) {
      if (!config.reminderWindows.some((window) => window.id === windowId)) {
        this.states.delete(windowId);
      }
    }
  }

  runtimeStates(): RuntimeWindowState[] {
    return [...this.states.values()].sort((left, right) =>
      left.reminderWindowId.localeCompare(right.reminderWindowId),
    );
  }

  dueWindows(date: string, currentTime: string): ReminderWindow[] {
    const due: ReminderWindow[] = [];
    for (const window of this.config.reminderWindows) {
      if (!window.enabled) continue;
      this.ensureState(window, date);
      this.expireIfNeeded(window, currentTime);
      if (timeInWindow(currentTime, window.startTime, window.endTime) && this.isDue(window, currentTime)) {
        const state = this.states.get(window.id);
        if (state) state.status = "checking";
        due.push(window);
      }
    }
    return due;
  }

  applyCheckResult(
    windowId: string,
    date: string,
    currentTime: string,
    outcome: CheckOutcome,
    error?: string,
  ): ReminderAction | undefined {
    const window = this.config.reminderWindows.find((item) => item.id === windowId);
    if (!window) return undefined;
    this.ensureState(window, date);
    const state = this.states.get(windowId);
    if (!state) return undefined;

    state.lastCheckedAt = currentTime;
    if (outcome === "checked_in") {
      state.status = "checked_in";
      state.nextReminderAt = undefined;
      state.lastError = undefined;
      return undefined;
    }

    if (outcome === "not_checked_in") {
      state.status = "reminding";
      state.nextReminderAt = addMinutes(currentTime, window.remindIntervalMinutes);
      state.lastError = undefined;
      return actionFrom(window, state);
    }

    state.status = "error";
    state.nextReminderAt = addMinutes(currentTime, window.remindIntervalMinutes);
    state.lastError = error;
    return actionFrom(window, state, error);
  }

  snooze(windowId: string, currentTime: string): void {
    const window = this.config.reminderWindows.find((item) => item.id === windowId);
    const state = this.states.get(windowId);
    if (!window || !state) return;
    if (state.status !== "checked_in" && state.status !== "expired") {
      state.status = "not_checked_in";
      state.nextReminderAt = addMinutes(currentTime, window.remindIntervalMinutes);
    }
  }

  private ensureState(window: ReminderWindow, date: string): void {
    const existing = this.states.get(window.id);
    if (!existing || existing.date !== date) {
      this.states.set(window.id, {
        reminderWindowId: window.id,
        date,
        status: "idle",
      });
    }
  }

  private expireIfNeeded(window: ReminderWindow, currentTime: string): void {
    if (!isAtOrAfter(currentTime, window.endTime)) return;
    const state = this.states.get(window.id);
    if (state && state.status !== "checked_in" && state.status !== "idle") {
      state.status = "expired";
      state.nextReminderAt = undefined;
    }
  }

  private isDue(window: ReminderWindow, currentTime: string): boolean {
    const state = this.states.get(window.id);
    if (!state) return true;
    if (state.status === "idle" || state.status === "not_checked_in" || state.status === "error") {
      return state.nextReminderAt ? isAtOrAfter(currentTime, state.nextReminderAt) : true;
    }
    return false;
  }
}

function actionFrom(window: ReminderWindow, state: RuntimeWindowState, error?: string): ReminderAction {
  return {
    windowId: window.id,
    windowName: window.name,
    timeRange: `${window.startTime}-${window.endTime}`,
    lastCheckedAt: state.lastCheckedAt,
    error,
    showReminder: true,
  };
}
