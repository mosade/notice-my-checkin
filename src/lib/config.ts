import type { AppConfig, ReminderWindow } from "./types";
import { findOverlaps, validateReminderWindow } from "./time";

export function validateConfig(config: AppConfig): string[] {
  const errors = config.reminderWindows.flatMap((window) =>
    validateReminderWindow(window).map((error) => `${window.name || window.id}: ${error}`),
  );
  if (config.detection.mode !== "mock") {
    errors.push("第一版仅支持 mock 检测模式");
  }
  return errors;
}

export function overlapText(config: AppConfig): string {
  const overlaps = findOverlaps(config.reminderWindows);
  return overlaps.length > 0 ? `存在重叠时间段：${overlaps.join("、")}` : "";
}

export function createReminderWindow(): ReminderWindow {
  const id = `window-${Date.now()}`;
  return {
    id,
    name: "新提醒",
    enabled: true,
    startTime: "09:00",
    endTime: "10:00",
    remindIntervalMinutes: 15,
  };
}
