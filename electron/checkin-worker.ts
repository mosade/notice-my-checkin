import { chromium } from "playwright";
import {
  classifyCheckinResponse,
  isSameTargetPage,
  matchesResponseUrl,
  missingPlaywrightPageConfig,
  workerError,
} from "./checkin-worker-core.js";
import type { AppConfig, CheckResult } from "./types.js";

export async function runCheck(config: AppConfig): Promise<CheckResult> {
  if (config.detection.mode === "mock") {
    return {
      ok: true,
      checkedIn: config.detection.mockCheckedIn,
      checkedAt: new Date().toISOString(),
    };
  }

  return runPlaywrightPageCheck(config);
}

export async function runPlaywrightPageCheck(config: AppConfig): Promise<CheckResult> {
  const missing = missingPlaywrightPageConfig(config);
  if (missing) {
    return workerError(missing, configMessage(missing));
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(config.browser.userDataDir || "browser-profile", {
      executablePath: config.browser.executablePath.trim() || undefined,
      headless: config.browser.headless,
    });
    const page = await context.newPage();

    await page.goto(config.detection.targetUrl, { waitUntil: "domcontentloaded" });

    await page.waitForURL((url) => isSameTargetPage(url.toString(), config.detection.targetUrl), {
      timeout: seconds(config.detection.loginTimeoutSeconds, 30),
    });

    await page.waitForSelector(config.detection.triggerSelector, { timeout: 10_000 });

    const responsePromise = page.waitForResponse(
      (response) => matchesResponseUrl(response.url(), config.detection.responseUrlPattern),
      { timeout: seconds(config.detection.responseTimeoutSeconds, 15) },
    );

    await page.click(config.detection.triggerSelector);
    const response = await responsePromise;
    const body = await response.text();
    const classification = classifyCheckinResponse(response.status(), body, config.detection.checkedInKeyword);

    return {
      ok: classification.ok,
      checkedIn: classification.checkedIn,
      checkedAt: new Date().toISOString(),
      error: classification.ok
        ? undefined
        : {
            code: "CHECKIN_RESPONSE_NOT_OK",
            message: `目标接口返回 HTTP ${response.status()}`,
          },
    };
  } catch (error) {
    return workerError(classifyPlaywrightError(error), error instanceof Error ? error.message : String(error));
  } finally {
    await context?.close();
  }
}

function seconds(value: number, fallback: number): number {
  return Math.max(1, Number.isFinite(value) ? value : fallback) * 1000;
}

function configMessage(code: string): string {
  switch (code) {
    case "MISSING_TARGET_URL":
      return "目标网页 URL 不能为空";
    case "MISSING_TRIGGER_SELECTOR":
      return "触发点击元素不能为空";
    case "MISSING_RESPONSE_PATTERN":
      return "目标接口匹配规则不能为空";
    case "MISSING_CHECKED_IN_KEYWORD":
      return "已打卡判断关键词不能为空";
    default:
      return "检测配置不完整";
  }
}

function classifyPlaywrightError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Timeout") && message.includes("waitForURL")) return "LOGIN_TIMEOUT";
  if (message.includes("Timeout") && message.includes("waitForSelector")) return "TRIGGER_NOT_FOUND";
  if (message.includes("Timeout") && message.includes("waitForResponse")) return "RESPONSE_TIMEOUT";
  return "PLAYWRIGHT_PAGE_CHECK_FAILED";
}
