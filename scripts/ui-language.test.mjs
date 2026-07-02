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
