import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./types.js";

export const configPath = path.resolve(process.cwd(), "config", "app-config.json");

export function defaultConfig(): AppConfig {
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
      checkedInKeyword: "",
      loginTimeoutSeconds: 30,
      responseTimeoutSeconds: 15,
    },
    reminderWindows: [
      {
        id: "morning",
        name: "上午打卡",
        enabled: true,
        startTime: "08:00",
        endTime: "09:00",
        remindIntervalMinutes: 15,
      },
      {
        id: "evening",
        name: "下午打卡",
        enabled: true,
        startTime: "17:30",
        endTime: "18:30",
        remindIntervalMinutes: 15,
      },
    ],
  };
}

export async function readOrCreateConfig(): Promise<AppConfig> {
  try {
    return JSON.parse(await readFile(configPath, "utf8")) as AppConfig;
  } catch (error) {
    if (isNotFound(error)) {
      const config = defaultConfig();
      await writeConfig(config);
      return config;
    }
    throw error;
  }
}

export async function writeConfig(config: AppConfig): Promise<AppConfig> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
