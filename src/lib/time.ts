import type { ReminderWindow } from "./types";

export function minutesFromTime(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function validateReminderWindow(window: ReminderWindow): string[] {
  const errors: string[] = [];
  const start = minutesFromTime(window.startTime);
  const end = minutesFromTime(window.endTime);
  if (!window.name.trim()) errors.push("名称不能为空");
  if (start === null) errors.push("开始时间格式无效");
  if (end === null) errors.push("结束时间格式无效");
  if (start !== null && end !== null && start >= end) {
    errors.push("开始时间必须早于结束时间");
  }
  if (!Number.isFinite(window.remindIntervalMinutes) || window.remindIntervalMinutes < 1) {
    errors.push("提醒间隔至少 1 分钟");
  }
  return errors;
}

export function findOverlaps(windows: ReminderWindow[]): string[] {
  const overlaps: string[] = [];
  const enabled = windows.filter((window) => window.enabled);
  for (let leftIndex = 0; leftIndex < enabled.length; leftIndex += 1) {
    const left = enabled[leftIndex];
    const leftStart = minutesFromTime(left.startTime);
    const leftEnd = minutesFromTime(left.endTime);
    if (leftStart === null || leftEnd === null) continue;
    for (const right of enabled.slice(leftIndex + 1)) {
      const rightStart = minutesFromTime(right.startTime);
      const rightEnd = minutesFromTime(right.endTime);
      if (rightStart === null || rightEnd === null) continue;
      if (leftStart < rightEnd && rightStart < leftEnd) {
        overlaps.push(`${left.name} / ${right.name}`);
      }
    }
  }
  return overlaps;
}
