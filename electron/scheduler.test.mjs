import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { Scheduler } = require("../dist-electron/scheduler.cjs");

function createConfig(reminderWindows) {
  return {
    autoStartChecking: true,
    hideToTrayOnClose: true,
    browser: {
      executablePath: "",
      headless: true,
      userDataDir: "browser-profile",
    },
    detection: {
      mode: "mock",
      targetUrl: "",
      triggerSelector: "",
      responseUrlPattern: "",
      mockCheckedIn: false,
      checkedInKeyword: "已打卡",
      loginTimeoutSeconds: 30,
      responseTimeoutSeconds: 15,
    },
    reminderWindows,
  };
}

function enabledWindow(overrides = {}) {
  return {
    id: "morning",
    name: "Morning",
    enabled: true,
    startTime: "09:00",
    endTime: "10:00",
    remindIntervalMinutes: 15,
    ...overrides,
  };
}

function localIso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

test("returns now when an enabled window is currently due", () => {
  const scheduler = new Scheduler(createConfig([enabledWindow()]));

  const next = scheduler.nextDueAt({ date: "2026-07-02", time: "09:05" });

  assert.equal(localIso(next), "2026-07-02T09:05");
});

test("returns the next reminder time after a not-checked-in result", () => {
  const scheduler = new Scheduler(createConfig([enabledWindow()]));
  scheduler.applyCheckResult("morning", "2026-07-02", "09:05", "not_checked_in");
  scheduler.snooze("morning", "09:05");

  const next = scheduler.nextDueAt({ date: "2026-07-02", time: "09:06" });

  assert.equal(localIso(next), "2026-07-02T09:20");
});

test("moves to tomorrow's first enabled window after today's windows are done", () => {
  const scheduler = new Scheduler(
    createConfig([enabledWindow({ id: "afternoon", startTime: "14:00", endTime: "15:00" })]),
  );

  const next = scheduler.nextDueAt({ date: "2026-07-02", time: "15:30" });

  assert.equal(localIso(next), "2026-07-03T14:00");
});
