export function matchesResponseUrl(responseUrl, pattern) {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  if (responseUrl.includes(trimmed)) return true;

  try {
    return new RegExp(trimmed).test(responseUrl);
  } catch {
    return false;
  }
}

export function isSameTargetPage(currentUrl, targetUrl) {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.origin === target.origin && current.pathname === target.pathname;
  } catch {
    return false;
  }
}

export function classifyCheckinResponse(status, body, checkedInKeyword) {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    checkedIn: ok && body.includes(checkedInKeyword),
  };
}

export function missingPlaywrightPageConfig(config) {
  const detection = config.detection;
  if (!detection.targetUrl?.trim()) return "MISSING_TARGET_URL";
  if (!detection.triggerSelector?.trim()) return "MISSING_TRIGGER_SELECTOR";
  if (!detection.responseUrlPattern?.trim()) return "MISSING_RESPONSE_PATTERN";
  if (!detection.checkedInKeyword?.trim()) return "MISSING_CHECKED_IN_KEYWORD";
  return "";
}

export function workerError(code, message) {
  return {
    ok: false,
    checkedIn: false,
    checkedAt: new Date().toISOString(),
    error: { code, message },
  };
}
