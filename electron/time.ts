export function minutesFromTime(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function timeInWindow(currentTime: string, startTime: string, endTime: string): boolean {
  const current = minutesFromTime(currentTime);
  const start = minutesFromTime(startTime);
  const end = minutesFromTime(endTime);
  return current !== null && start !== null && end !== null && current >= start && current < end;
}

export function isAtOrAfter(currentTime: string, targetTime: string): boolean {
  const current = minutesFromTime(currentTime);
  const target = minutesFromTime(targetTime);
  return current !== null && target !== null && current >= target;
}

export function addMinutes(time: string, minutes: number): string | undefined {
  const value = minutesFromTime(time);
  if (value === null) return undefined;
  const next = Math.min(23 * 60 + 59, value + minutes);
  const hour = Math.floor(next / 60).toString().padStart(2, "0");
  const minute = (next % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function nowParts(): { date: string; time: string } {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}
