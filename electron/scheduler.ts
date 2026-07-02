import { addMinutes, isAtOrAfter, minutesFromTime, timeInWindow } from "./time.js";
import type { AppConfig, CheckOutcome, ReminderAction, ReminderWindow, RuntimeWindowState } from "./types.js";

type TimeParts = {
  date: string;
  time: string;
};

const DAY_MINUTES = 24 * 60;

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

  nextDueAt(current: TimeParts): Date | undefined {
    const currentMinute = minutesFromTime(current.time);
    if (currentMinute === null) return undefined;

    let next: Date | undefined;
    for (const window of this.config.reminderWindows) {
      if (!window.enabled) continue;

      const start = minutesFromTime(window.startTime);
      const end = minutesFromTime(window.endTime);
      if (start === null || end === null || start >= end) continue;

      this.ensureState(window, current.date);
      this.expireIfNeeded(window, current.time);

      const dueMinute = this.nextDueMinute(window, currentMinute, start, end);
      if (dueMinute === undefined) continue;

      const dueAt = dateAtMinute(current.date, dueMinute);
      if (!dueAt) continue;
      if (!next || dueAt < next) next = dueAt;
    }

    return next;
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

  activeWindows(date: string, currentTime: string): ReminderWindow[] {
    const active: ReminderWindow[] = [];
    for (const window of this.config.reminderWindows) {
      if (!window.enabled) continue;
      this.ensureState(window, date);
      this.expireIfNeeded(window, currentTime);
      if (timeInWindow(currentTime, window.startTime, window.endTime)) {
        active.push(window);
      }
    }
    return active;
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
    if (!timeInWindow(currentTime, window.startTime, window.endTime)) {
      this.expireIfNeeded(window, currentTime);
      return undefined;
    }

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

  private nextDueMinute(window: ReminderWindow, currentMinute: number, start: number, end: number): number | undefined {
    if (currentMinute < start) return start;
    if (currentMinute >= end) return DAY_MINUTES + start;

    const state = this.states.get(window.id);
    if (!state) return currentMinute;

    if (state.status === "idle" || state.status === "not_checked_in" || state.status === "error") {
      if (!state.nextReminderAt) return currentMinute;

      const nextReminderMinute = minutesFromTime(state.nextReminderAt);
      if (nextReminderMinute === null) return currentMinute;
      if (nextReminderMinute >= end) return DAY_MINUTES + start;
      return Math.max(currentMinute, nextReminderMinute);
    }

    return DAY_MINUTES + start;
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

function dateAtMinute(date: string, minute: number): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const value = new Date(Number(year), Number(month) - 1, Number(day), 0, minute, 0, 0);
  if (Number.isNaN(value.getTime())) return undefined;
  return value;
}
