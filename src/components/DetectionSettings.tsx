import { Card, Form, Input, InputNumber, Select, Space, Switch, Tag } from "antd";
import type { AppConfig } from "../lib/types";

type Props = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

export function DetectionSettings({ config, onChange }: Props) {
  const updateDetection = (patch: Partial<AppConfig["detection"]>) =>
    onChange({ ...config, detection: { ...config.detection, ...patch } });

  return (
    <Card title="Detection" className="settings-card" extra={<Tag color="blue">{config.detection.mode}</Tag>}>
      <Form layout="vertical">
        <Form.Item label="Detection mode">
          <Select
          value={config.detection.mode}
            onChange={(mode: AppConfig["detection"]["mode"]) => updateDetection({ mode })}
            options={[
              { value: "mock", label: "Mock" },
              { value: "playwright_page", label: "Playwright Page" },
            ]}
          />
        </Form.Item>
        <Form.Item label="Target page URL">
          <Input
          value={config.detection.targetUrl}
          onChange={(event) => updateDetection({ targetUrl: event.currentTarget.value })}
          placeholder="https://example.com/checkin"
        />
        </Form.Item>
        <Form.Item label="Trigger selector">
          <Input
          value={config.detection.triggerSelector}
          onChange={(event) => updateDetection({ triggerSelector: event.currentTarget.value })}
            placeholder="button:has-text('Search')"
        />
        </Form.Item>
        <Form.Item label="Response URL pattern">
          <Input
          value={config.detection.responseUrlPattern}
          onChange={(event) => updateDetection({ responseUrlPattern: event.currentTarget.value })}
          placeholder="/api/checkin/status"
        />
        </Form.Item>
        <Form.Item label="Checked-in keyword">
          <Input
          value={config.detection.checkedInKeyword}
          onChange={(event) => updateDetection({ checkedInKeyword: event.currentTarget.value })}
            placeholder="checked in"
        />
        </Form.Item>
        <Form.Item label="Auto-login timeout seconds">
          <InputNumber
            min={1}
            className="full-width-control"
          value={config.detection.loginTimeoutSeconds}
            onChange={(value) => updateDetection({ loginTimeoutSeconds: Number(value) })}
        />
        </Form.Item>
        <Form.Item label="Response wait timeout seconds">
          <InputNumber
            min={1}
            className="full-width-control"
          value={config.detection.responseTimeoutSeconds}
            onChange={(value) => updateDetection({ responseTimeoutSeconds: Number(value) })}
        />
        </Form.Item>
        <Form.Item>
          <Space align="center">
            <Switch
              checked={config.detection.mockCheckedIn}
              disabled={config.detection.mode !== "mock"}
              checkedChildren="On"
              unCheckedChildren="Off"
              onChange={(checked) => updateDetection({ mockCheckedIn: checked })}
            />
            Mock returns checked in
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
