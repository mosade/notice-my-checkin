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
  if (!window.name.trim()) errors.push("Name is required");
  if (start === null) errors.push("Start time format is invalid");
  if (end === null) errors.push("End time format is invalid");
  if (start !== null && end !== null && start >= end) {
    errors.push("Start time must be earlier than end time");
  }
  if (!Number.isFinite(window.remindIntervalMinutes) || window.remindIntervalMinutes < 1) {
    errors.push("Reminder interval must be at least 1 minute");
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
