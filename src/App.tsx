import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Layout, Space, Spin, Switch, Typography } from "antd";
import "./App.css";
import { BrowserSettings } from "./components/BrowserSettings";
import { DetectionSettings } from "./components/DetectionSettings";
import { ReminderWindowEditor } from "./components/ReminderWindowEditor";
import { RuntimeStatusPanel } from "./components/RuntimeStatusPanel";
import { validateConfig } from "./lib/config";
import { checkinApi } from "./lib/electron";
import type { AppConfig, AppRuntimeSnapshot, CheckResult, ReminderAction } from "./lib/types";

const { Content } = Layout;
const { Text, Title } = Typography;

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
    setMessage("Manual check completed.");
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
    return (
      <Layout className="app-shell loading">
        <Spin tip={message || "Loading"} />
      </Layout>
    );
  }

  const save = async () => {
    if (validationErrors.length > 0) return;
    const saved = await checkinApi.saveConfig(config);
    setConfig(saved);
    setMessage("Configuration saved.");
  };

  const testBrowser = async () => {
    const saved = await checkinApi.saveConfig(config);
    setConfig(saved);
    const result = await checkinApi.testBrowser();
    setBrowserTest(result);
  };

  return (
    <Layout className="app-shell">
      <Content>
        <header className="topbar">
        <div>
          <Title level={2}>Check-in Reminder</Title>
          <Text type="secondary">{snapshot?.checking ? "Background checks are running." : "Background checks are paused."}</Text>
        </div>
        <Space wrap className="toolbar">
          <Button
            icon={snapshot?.checking ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={snapshot?.checking ? pause : start}
          >
            {snapshot?.checking ? "Pause Checks" : "Start Checks"}
          </Button>
          <Button icon={<SyncOutlined />} onClick={checkNow}>
            Check Now
          </Button>
          <Button icon={<BellOutlined />} onClick={() => checkinApi.testReminder()}>
            Test Reminder
          </Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={validationErrors.length > 0} onClick={save}>
            Save Settings
          </Button>
        </Space>
      </header>

      <Space direction="vertical" size={16} className="page-stack">
        {message ? <Alert type="success" showIcon message={message} /> : null}
        {validationErrors.length > 0 ? <Alert type="error" showIcon message={validationErrors.join("; ")} /> : null}

        <section className="settings-grid">
          <Card title="Application" className="settings-card">
            <Space direction="vertical" size={16}>
              <Space align="center">
                <Switch
                  checked={config.autoStartChecking}
                  checkedChildren="On"
                  unCheckedChildren="Off"
                  onChange={(checked) => setConfig({ ...config, autoStartChecking: checked })}
                />
                <Text>Start checking automatically after launch</Text>
              </Space>
              <Space align="center">
                <Switch
                  checked={config.hideToTrayOnClose}
                  checkedChildren="On"
                  unCheckedChildren="Off"
                  onChange={(checked) => setConfig({ ...config, hideToTrayOnClose: checked })}
                />
                <Text>Hide the main window to the tray on close</Text>
              </Space>
            </Space>
          </Card>
          <BrowserSettings config={config} browserTest={browserTest} onChange={setConfig} onTest={testBrowser} />
          <DetectionSettings config={config} onChange={setConfig} />
        </section>
        <ReminderWindowEditor config={config} onChange={setConfig} />
        <RuntimeStatusPanel snapshot={snapshot} />
      </Space>
      </Content>
    </Layout>
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
    setMessage(current?.status === "checked_in" ? "Check-in confirmed." : "No check-in record found yet.");
    setBusy(false);
  };

  return (
    <Layout className="reminder-shell">
      <Card size="small" className="reminder-card">
        <Space direction="vertical" size={8}>
          <Title level={4}>{action?.error ? "Check Failed" : "No Check-in Record Found"}</Title>
          <Text className="reminder-window-name">
            {action ? `${action.windowName} ${action.timeRange}` : "Waiting for reminder data"}
          </Text>
          <Alert
            type={action?.error ? "error" : "info"}
            showIcon
            message={action?.error ? `Check failed: ${action.error}` : `Last checked: ${action?.lastCheckedAt ?? "-"}`}
          />
          {message ? <Alert type="warning" showIcon message={message} /> : null}
          <Space wrap>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              disabled={!action || busy}
              loading={busy}
              onClick={confirm}
            >
              I Have Checked In
            </Button>
            <Button size="small" icon={<ClockCircleOutlined />} disabled={!action || busy} onClick={snooze}>
              Remind Me Later
            </Button>
          </Space>
        </Space>
      </Card>
    </Layout>
  );
}

export default App;
