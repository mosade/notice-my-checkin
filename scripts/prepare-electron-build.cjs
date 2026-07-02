const { copyFileSync, existsSync, readdirSync, renameSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const outDir = join(process.cwd(), "dist-electron");

for (const file of readdirSync(outDir)) {
  if (file.endsWith(".js")) {
    renameSync(join(outDir, file), join(outDir, file.replace(/\.js$/, ".cjs")));
  }
}

for (const file of readdirSync(outDir)) {
  if (!file.endsWith(".cjs")) continue;
  const path = join(outDir, file);
  let raw = require("node:fs").readFileSync(path, "utf8");
  raw = raw.replaceAll('require("./config.js")', 'require("./config.cjs")');
  raw = raw.replaceAll('require("./scheduler.js")', 'require("./scheduler.cjs")');
  raw = raw.replaceAll('require("./tray.js")', 'require("./tray.cjs")');
  raw = raw.replaceAll('require("./types.js")', 'require("./types.cjs")');
  raw = raw.replaceAll('require("./time.js")', 'require("./time.cjs")');
  raw = raw.replaceAll('require("./windows.js")', 'require("./windows.cjs")');
  raw = raw.replaceAll('require("./checkin-worker.js")', 'require("./checkin-worker.cjs")');
  raw = raw.replaceAll('require("./checkin-worker-core.js")', 'require("./checkin-worker-core.cjs")');
  require("node:fs").writeFileSync(path, raw);
}

writeFileSync(join(outDir, "package.json"), '{"type":"commonjs"}\n');

if (existsSync(join(process.cwd(), "electron", "checkin-worker-core.mjs"))) {
  copyFileSync(join(process.cwd(), "electron", "checkin-worker-core.mjs"), join(outDir, "checkin-worker-core.mjs"));
}
