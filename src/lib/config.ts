import type { AppConfig, ReminderWindow } from "./types";
import { findOverlaps, validateReminderWindow } from "./time";

export function validateConfig(config: AppConfig): string[] {
  const errors = config.reminderWindows.flatMap((window) =>
    validateReminderWindow(window).map((error) => `${window.name || window.id}: ${error}`),
  );
  if (config.detection.mode !== "mock") {
    if (!config.detection.targetUrl.trim()) errors.push("Playwright mode requires a target page URL");
    if (!config.detection.triggerSelector.trim()) errors.push("Playwright mode requires a trigger selector");
    if (!config.detection.responseUrlPattern.trim()) errors.push("Playwright mode requires a response URL pattern");
    if (!config.detection.checkedInKeyword.trim()) errors.push("Playwright mode requires a checked-in keyword");
    if (
      !Number.isFinite(config.detection.loginTimeoutSeconds) ||
      config.detection.loginTimeoutSeconds < 1
    ) {
      errors.push("Auto-login timeout must be at least 1 second");
    }
    if (
      !Number.isFinite(config.detection.responseTimeoutSeconds) ||
      config.detection.responseTimeoutSeconds < 1
    ) {
      errors.push("Response wait timeout must be at least 1 second");
    }
  }
  return errors;
}

export function overlapText(config: AppConfig): string {
  const overlaps = findOverlaps(config.reminderWindows);
  return overlaps.length > 0 ? `Overlapping reminder windows: ${overlaps.join(", ")}` : "";
}

export function createReminderWindow(): ReminderWindow {
  const id = `window-${Date.now()}`;
  return {
    id,
    name: "New Reminder",
    enabled: true,
    startTime: "09:00",
    endTime: "10:00",
    remindIntervalMinutes: 15,
  };
}
