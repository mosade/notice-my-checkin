import { ExperimentOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Space, Switch } from "antd";
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
    <Card
      title="Browser"
      className="settings-card"
      extra={
        <Button icon={<ExperimentOutlined />} onClick={onTest}>
          Test Browser
        </Button>
      }
    >
      <Form layout="vertical">
        <Form.Item label="Browser executable path">
          <Input
          value={config.browser.executablePath}
          onChange={(event) => updateBrowser({ executablePath: event.currentTarget.value })}
          placeholder="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        />
        </Form.Item>
        <Form.Item label="User data directory">
          <Input
          value={config.browser.userDataDir}
          onChange={(event) => updateBrowser({ userDataDir: event.currentTarget.value })}
          placeholder="browser-profile"
        />
        </Form.Item>
        <Form.Item>
          <Space align="center">
            <Switch
          checked={config.browser.headless}
              checkedChildren="On"
              unCheckedChildren="Off"
              onChange={(checked) => updateBrowser({ headless: checked })}
        />
            Headless mode
          </Space>
        </Form.Item>
      </Form>
      {browserTest ? (
        <Alert
          type={browserTest.ok ? "success" : "error"}
          showIcon
          message={browserTest.ok ? "Browser settings are valid." : browserTest.error?.message ?? "Browser settings are invalid."}
        />
      ) : null}
    </Card>
  );
}
