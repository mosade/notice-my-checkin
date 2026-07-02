import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { BrowserSettings } from "./components/BrowserSettings";
import { DetectionSettings } from "./components/DetectionSettings";
import { ReminderWindowEditor } from "./components/ReminderWindowEditor";
import { RuntimeStatusPanel } from "./components/RuntimeStatusPanel";
import { validateConfig } from "./lib/config";
import { checkinApi } from "./lib/electron";
import type { AppConfig, AppRuntimeSnapshot, CheckResult, ReminderAction } from "./lib/types";

function App() {
  const isReminder = window.location.hash === "#/reminder";
  return isReminder ? <ReminderView /> : <MainView />;
}

function MainView() {
  const [config, setConfig] = useState<AppConfig>();
  const [snapshot, setSnapshot] = useState<AppRuntimeSnapshot>();
  const [browserTest, setBrowserTest] = useState<CheckResult>();
  const [message, setMessage] = useState("");
  const validationErrors = useMemo(() => (config ? validateConfig(config) : []), [config]);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await checkinApi.getRuntimeSnapshot());
  }, []);

  const start = useCallback(async () => {
    setSnapshot(await checkinApi.startChecking());
  }, []);

  const pause = useCallback(async () => {
    setSnapshot(await checkinApi.pauseChecking());
  }, []);

  const checkNow = useCallback(async () => {
    await checkinApi.runCheckNow();
    await refreshSnapshot();
    setMessage("已完成立即检测");
  }, [refreshSnapshot]);

  useEffect(() => {
    checkinApi.loadConfig().then(setConfig).catch((error) => setMessage(String(error)));
    refreshSnapshot().catch((error) => setMessage(String(error)));
    const unlistenRuntime = checkinApi.onRuntimeUpdate(setSnapshot);
    const unlistenToggle = checkinApi.onTrayToggleChecking(() => {
      if (snapshot?.checking) {
        pause().catch((error) => setMessage(String(error)));
      } else {
        start().catch((error) => setMessage(String(error)));
      }
    });
    const unlistenCheck = checkinApi.onTrayCheckNow(() => {
      checkNow().catch((error) => setMessage(String(error)));
    });
    return () => {
      unlistenRuntime();
      unlistenToggle();
      unlistenCheck();
    };
  }, [checkNow, pause, refreshSnapshot, snapshot?.checking, start]);

  if (!config) {
    return <main className="app-shell loading">{message || "加载中"}</main>;
  }

  const save = async () => {
    if (validationErrors.length > 0) return;
    const saved = await checkinApi.saveConfig(config);
    setConfig(saved);
    setMessage("配置已保存");
  };

  const testBrowser = async () => {
    const saved = await checkinApi.saveConfig(config);
    setConfig(saved);
    const result = await checkinApi.testBrowser();
    setBrowserTest(result);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>打卡提醒</h1>
          <p>{snapshot?.checking ? "后台检测运行中" : "后台检测已暂停"}</p>
        </div>
        <div className="toolbar">
          <button type="button" onClick={snapshot?.checking ? pause : start}>
            {snapshot?.checking ? "暂停检测" : "开始检测"}
          </button>
          <button type="button" onClick={checkNow}>
            立即检测
          </button>
          <button type="button" onClick={() => checkinApi.testReminder()}>
            测试提醒
          </button>
          <button type="button" disabled={validationErrors.length > 0} onClick={save}>
            保存配置
          </button>
        </div>
      </header>

      {message ? <p className="result ok">{message}</p> : null}
      {validationErrors.length > 0 ? <p className="result bad">{validationErrors.join("；")}</p> : null}

      <section className="settings-grid">
        <section className="panel">
          <div className="section-title">
            <h2>应用</h2>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={config.autoStartChecking}
              onChange={(event) => setConfig({ ...config, autoStartChecking: event.currentTarget.checked })}
            />
            启动后自动检测
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={config.hideToTrayOnClose}
              onChange={(event) => setConfig({ ...config, hideToTrayOnClose: event.currentTarget.checked })}
            />
            关闭主窗口隐藏到托盘
          </label>
        </section>
        <BrowserSettings config={config} browserTest={browserTest} onChange={setConfig} onTest={testBrowser} />
        <DetectionSettings config={config} onChange={setConfig} />
        <ReminderWindowEditor config={config} onChange={setConfig} />
        <RuntimeStatusPanel snapshot={snapshot} />
      </section>
    </main>
  );
}

function ReminderView() {
  const [action, setAction] = useState<ReminderAction>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unlisten = checkinApi.onReminderUpdate(setAction);
    return () => {
      unlisten();
    };
  }, []);

  const snooze = async () => {
    if (!action) return;
    setBusy(true);
    await checkinApi.snoozeReminder(action.windowId);
    setBusy(false);
  };

  const confirm = async () => {
    if (!action) return;
    setBusy(true);
    const snapshot = await checkinApi.confirmCheckedIn(action.windowId);
    const current = snapshot.states.find((state) => state.reminderWindowId === action.windowId);
    setMessage(current?.status === "checked_in" ? "已确认打卡" : "暂未检测到打卡记录");
    setBusy(false);
  };

  return (
    <main className="reminder-shell">
      <h1>{action?.error ? "检测失败" : "还没有检测到打卡记录"}</h1>
      <p className="reminder-window-name">
        {action ? `${action.windowName} ${action.timeRange}` : "等待提醒数据"}
      </p>
      <p className={action?.error ? "result bad" : "muted"}>
        {action?.error ? `检测失败：${action.error}` : `最近检测：${action?.lastCheckedAt ?? "-"}`}
      </p>
      {message ? <p className="result warn">{message}</p> : null}
      <div className="reminder-actions">
        <button type="button" disabled={!action || busy} onClick={confirm}>
          我已打卡
        </button>
        <button type="button" disabled={!action || busy} className="ghost" onClick={snooze}>
          稍后提醒
        </button>
      </div>
    </main>
  );
}

export default App;
