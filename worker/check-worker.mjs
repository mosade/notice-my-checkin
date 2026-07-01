import process from "node:process";
import { checkMock } from "./adapters/mock-checkin-adapter.mjs";
import { validateBrowserConfig } from "./browser/launch-browser.mjs";

export async function check(request) {
  if (request.detection.mode !== "mock") {
    return error("UNSUPPORTED_MODE", "第一版仅支持 mock 检测模式");
  }
  return checkMock(request.detection);
}

export async function run(commandName, request) {
  if (commandName === "test-browser") {
    return validateBrowserConfig(request.browser);
  }
  return check(request);
}

async function main() {
  const input = await readStdin();
  const request = JSON.parse(input);
  const commandName = process.argv[2] ?? "check";
  const result = await run(commandName, request);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function error(code, message) {
  return {
    ok: false,
    checkedIn: false,
    checkedAt: new Date().toISOString(),
    error: {
      code,
      message,
    },
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((caught) => {
    const result = error("WORKER_EXCEPTION", caught?.message ?? String(caught));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}
