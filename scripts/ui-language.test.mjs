import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const interfaceFiles = [
  "index.html",
  "src/App.tsx",
  "src/components/BrowserSettings.tsx",
  "src/components/DetectionSettings.tsx",
  "src/components/ReminderWindowEditor.tsx",
  "src/components/RuntimeStatusPanel.tsx",
  "src/lib/config.ts",
  "src/lib/time.ts",
  "electron/checkin-worker.ts",
  "electron/config.ts",
  "electron/main.ts",
  "electron/tray.ts",
];

const reactUiFiles = [
  "src/App.tsx",
  "src/components/BrowserSettings.tsx",
  "src/components/DetectionSettings.tsx",
  "src/components/ReminderWindowEditor.tsx",
  "src/components/RuntimeStatusPanel.tsx",
];

test("interface-facing files do not contain Chinese text", async () => {
  const matches = [];

  for (const file of interfaceFiles) {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (/\p{Script=Han}/u.test(line)) {
        matches.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(matches, []);
});

test("React UI is built with Ant Design", async () => {
  const imports = await Promise.all(reactUiFiles.map((file) => readFile(file, "utf8")));
  assert.ok(imports.some((content) => content.includes('from "antd"')));
  assert.ok((await readFile("src/main.tsx", "utf8")).includes('antd/dist/reset.css'));
});

test("reminder popup uses a compact non-scrolling layout", async () => {
  const [appSource, cssSource] = await Promise.all([readFile("src/App.tsx", "utf8"), readFile("src/App.css", "utf8")]);

  assert.match(appSource, /<Card[^>]+size="small"[^>]+className="reminder-card"/);
  assert.match(appSource, /<Space direction="vertical" size=\{8\}/);
  assert.match(appSource, /<Title level=\{4\}/);
  assert.match(cssSource, /\.reminder-shell\s*\{[^}]*height: 100vh;/s);
  assert.match(cssSource, /\.reminder-shell\s*\{[^}]*overflow: hidden;/s);
  assert.doesNotMatch(cssSource, /\.reminder-shell\s*\{[^}]*min-height: 100vh;/s);
});

test("reminder window is created lazily after an action exists", async () => {
  const mainSource = await readFile("electron/main.ts", "utf8");
  const readyBlock = mainSource.match(/app\.whenReady\(\)\.then\(async \(\) => \{(?<body>[\s\S]*?)\n\}\);/);

  assert.ok(readyBlock?.groups?.body);
  assert.doesNotMatch(readyBlock.groups.body, /ensureReminderWindow\(/);
  assert.match(mainSource, /showReminderWindow\(action\);/);
});

test("reminder action is sent only after the reminder page is ready", async () => {
  const [windowsSource, mainSource, preloadSource, appSource] = await Promise.all([
    readFile("electron/windows.ts", "utf8"),
    readFile("electron/main.ts", "utf8"),
    readFile("electron/preload.ts", "utf8"),
    readFile("src/App.tsx", "utf8"),
  ]);
  const showReminderWindow = windowsSource.match(/export function showReminderWindow[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(windowsSource, /let reminderWindowReadyResolve: \(\(\) => void\) \| undefined;/);
  assert.match(showReminderWindow, /reminderWindowReady/);
  assert.match(showReminderWindow, /webContents\.send\("reminder:update", action\)/);
  assert.doesNotMatch(showReminderWindow, /window\.show\(\)/);
  assert.doesNotMatch(showReminderWindow, /const window = ensureReminderWindow\(\);\s*window\.webContents\.send/s);
  assert.match(mainSource, /ipcMain\.handle\("reminder:ready"/);
  assert.match(preloadSource, /reminderReady: \(\) => ipcRenderer\.invoke\("reminder:ready"\)/);
  assert.match(appSource, /checkinApi\.reminderReady\(\)/);
});

test("reminder window is shown only after the renderer has rendered action data", async () => {
  const [mainSource, preloadSource, appSource, viteEnvSource, electronFallbackSource, windowsSource] = await Promise.all([
    readFile("electron/main.ts", "utf8"),
    readFile("electron/preload.ts", "utf8"),
    readFile("src/App.tsx", "utf8"),
    readFile("src/vite-env.d.ts", "utf8"),
    readFile("src/lib/electron.ts", "utf8"),
    readFile("electron/windows.ts", "utf8"),
  ]);
  const showReminderWindow = windowsSource.match(/export function showReminderWindow[\s\S]*?\n\}/)?.[0] ?? "";

  assert.doesNotMatch(showReminderWindow, /window\.show\(\)/);
  assert.match(windowsSource, /export function displayReminderWindow\(\): void/);
  assert.match(mainSource, /ipcMain\.handle\("reminder:display-ready"/);
  assert.match(preloadSource, /reminderDisplayReady: \(\) => ipcRenderer\.invoke\("reminder:display-ready"\)/);
  assert.match(viteEnvSource, /reminderDisplayReady: \(\) => Promise<void>;/);
  assert.match(electronFallbackSource, /reminderDisplayReady: \(\) => unavailable<void>\("reminderDisplayReady"\)/);
  assert.match(appSource, /checkinApi\.reminderDisplayReady\(\)/);
  assert.match(appSource, /if \(!action\) return null;/);
  assert.doesNotMatch(appSource, /Waiting for reminder data/);
});

test("Check Now reports the immediate detection result", async () => {
  const appSource = await readFile("src/App.tsx", "utf8");

  assert.match(appSource, /const \[checkNowBusy, setCheckNowBusy\] = useState\(false\);/);
  assert.match(appSource, /const result = await checkinApi\.runCheckNow\(\);/);
  assert.match(appSource, /result\.check\.ok/);
  assert.match(appSource, /Manual check completed/);
  assert.match(appSource, /Manual check failed/);
  assert.doesNotMatch(appSource, /No reminder window is active right now/);
  assert.match(appSource, /loading=\{checkNowBusy\}/);
});
