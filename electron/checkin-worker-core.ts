import type { AppConfig, CheckResult } from "./types.js";

export function matchesResponseUrl(responseUrl: string, pattern: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (responseUrl.includes(trimmed)) return true;

  try {
    return new RegExp(trimmed).test(responseUrl);
  } catch {
    return false;
  }
}

export function isSameTargetPage(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.origin === target.origin && current.pathname === target.pathname;
  } catch {
    return false;
  }
}

export function classifyCheckinResponse(
  status: number,
  body: string,
  checkedInKeyword: string,
): { ok: boolean; checkedIn: boolean } {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    checkedIn: ok && body.includes(checkedInKeyword),
  };
}

export function missingPlaywrightPageConfig(config: AppConfig): string {
  const detection = config.detection;
  if (!detection.targetUrl?.trim()) return "MISSING_TARGET_URL";
  if (!detection.triggerSelector?.trim()) return "MISSING_TRIGGER_SELECTOR";
  if (!detection.responseUrlPattern?.trim()) return "MISSING_RESPONSE_PATTERN";
  if (!detection.checkedInKeyword?.trim()) return "MISSING_CHECKED_IN_KEYWORD";
  return "";
}

export function workerError(code: string, message: string): CheckResult {
  return {
    ok: false,
    checkedIn: false,
    checkedAt: new Date().toISOString(),
    error: { code, message },
  };
}
