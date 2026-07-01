import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { check } from "./check-worker.mjs";
import { validateBrowserConfig } from "./browser/launch-browser.mjs";

const baseRequest = {
  browser: {
    executablePath: "",
    headless: true,
    userDataDir: "",
  },
  detection: {
    mode: "mock",
    loginUrl: "",
    apiUrl: "",
    mockCheckedIn: false,
  },
  reminderWindowId: "morning",
};

test("mock check returns configured checked-in result", async () => {
  const result = await check({
    ...baseRequest,
    detection: {
      ...baseRequest.detection,
      mockCheckedIn: true,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkedIn, true);
  assert.match(result.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("mock check reports unsupported mode as structured error", async () => {
  const result = await check({
    ...baseRequest,
    detection: {
      ...baseRequest.detection,
      mode: "real",
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.checkedIn, false);
  assert.equal(result.error.code, "UNSUPPORTED_MODE");
});

test("browser validator accepts empty path and writable user data dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "checkin-worker-"));
  try {
    const result = await validateBrowserConfig({
      executablePath: "",
      headless: true,
      userDataDir: dir,
    });

    assert.equal(result.ok, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("browser validator rejects missing executable path", async () => {
  const dir = await mkdtemp(join(tmpdir(), "checkin-worker-"));
  const missing = join(dir, "missing-browser.exe");
  try {
    const result = await validateBrowserConfig({
      executablePath: missing,
      headless: false,
      userDataDir: dir,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "BROWSER_NOT_FOUND");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("browser validator rejects file user data dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "checkin-worker-"));
  const filePath = join(dir, "profile");
  await writeFile(filePath, "");
  try {
    const result = await validateBrowserConfig({
      executablePath: "",
      headless: true,
      userDataDir: filePath,
    });

    assert.equal(result.ok, false);
    assert.equal(result.error.code, "USER_DATA_DIR_NOT_DIRECTORY");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
