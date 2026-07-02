import type { AppConfig, ReminderWindow } from "./types";
import { findOverlaps, validateReminderWindow } from "./time";

export function validateConfig(config: AppConfig): string[] {
  const errors = config.reminderWindows.flatMap((window) =>
    validateReminderWindow(window).map((error) => `${window.name || window.id}: ${error}`),
  );
  if (config.detection.mode !== "mock") {
    if (!config.detection.targetUrl.trim()) errors.push("Playwright 模式需要目标网页 URL");
    if (!config.detection.triggerSelector.trim()) errors.push("Playwright 模式需要触发点击元素");
    if (!config.detection.responseUrlPattern.trim()) errors.push("Playwright 模式需要目标接口匹配规则");
    if (!config.detection.checkedInKeyword.trim()) errors.push("Playwright 模式需要已打卡判断关键词");
    if (
      !Number.isFinite(config.detection.loginTimeoutSeconds) ||
      config.detection.loginTimeoutSeconds < 1
    ) {
      errors.push("自动登录超时时间至少 1 秒");
    }
    if (
      !Number.isFinite(config.detection.responseTimeoutSeconds) ||
      config.detection.responseTimeoutSeconds < 1
    ) {
      errors.push("接口响应等待时间至少 1 秒");
    }
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
