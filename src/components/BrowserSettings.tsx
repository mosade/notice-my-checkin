import type { AppConfig, CheckResult } from "../lib/types";

type Props = {
  config: AppConfig;
  browserTest?: CheckResult;
  onChange: (config: AppConfig) => void;
  onTest: () => void;
};

export function BrowserSettings({ config, browserTest, onChange, onTest }: Props) {
  const updateBrowser = (patch: Partial<AppConfig["browser"]>) =>
    onChange({ ...config, browser: { ...config.browser, ...patch } });

  return (
    <section className="panel">
      <div className="section-title">
        <h2>浏览器</h2>
        <button type="button" onClick={onTest}>
          测试浏览器
        </button>
      </div>
      <label>
        浏览器路径
        <input
          value={config.browser.executablePath}
          onChange={(event) => updateBrowser({ executablePath: event.currentTarget.value })}
          placeholder="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        />
      </label>
      <label>
        用户数据目录
        <input
          value={config.browser.userDataDir}
          onChange={(event) => updateBrowser({ userDataDir: event.currentTarget.value })}
          placeholder="browser-profile"
        />
      </label>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={config.browser.headless}
          onChange={(event) => updateBrowser({ headless: event.currentTarget.checked })}
        />
        无头模式
      </label>
      {browserTest ? (
        <p className={browserTest.ok ? "result ok" : "result bad"}>
          {browserTest.ok ? "浏览器配置可用" : browserTest.error?.message ?? "浏览器配置不可用"}
        </p>
      ) : null}
    </section>
  );
}
