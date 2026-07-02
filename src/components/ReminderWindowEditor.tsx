import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Space, Switch, Typography } from "antd";
import { createReminderWindow, overlapText } from "../lib/config";
import { validateReminderWindow } from "../lib/time";
import type { AppConfig, ReminderWindow } from "../lib/types";

const { Text } = Typography;

type Props = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

export function ReminderWindowEditor({ config, onChange }: Props) {
  const updateWindow = (id: string, patch: Partial<ReminderWindow>) => {
    onChange({
      ...config,
      reminderWindows: config.reminderWindows.map((window) =>
        window.id === id ? { ...window, ...patch } : window,
      ),
    });
  };

  const removeWindow = (id: string) => {
    onChange({
      ...config,
      reminderWindows: config.reminderWindows.filter((window) => window.id !== id),
    });
  };

  const warning = overlapText(config);

  return (
    <Card
      title="Reminder Windows"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() =>
            onChange({
              ...config,
              reminderWindows: [...config.reminderWindows, createReminderWindow()],
            })
          }
        >
          Add Window
        </Button>
      }
    >
      {warning ? <Alert type="warning" showIcon message={warning} className="section-alert" /> : null}
      <div className="window-list">
        {config.reminderWindows.length === 0 ? <Empty description="No reminder windows" /> : null}
        {config.reminderWindows.map((window) => {
          const errors = validateReminderWindow(window);
          return (
            <div className="window-row-card" key={window.id}>
              <Form layout="vertical" className="window-row">
                <Form.Item label="Enabled">
                  <Switch
                  checked={window.enabled}
                    checkedChildren="On"
                    unCheckedChildren="Off"
                    onChange={(enabled) => updateWindow(window.id, { enabled })}
                />
                </Form.Item>
                <Form.Item label="Name">
                  <Input
                  value={window.name}
                  onChange={(event) => updateWindow(window.id, { name: event.currentTarget.value })}
                />
                </Form.Item>
                <Form.Item label="Start">
                  <Input
                  type="time"
                  value={window.startTime}
                  onChange={(event) => updateWindow(window.id, { startTime: event.currentTarget.value })}
                />
                </Form.Item>
                <Form.Item label="End">
                  <Input
                  type="time"
                  value={window.endTime}
                  onChange={(event) => updateWindow(window.id, { endTime: event.currentTarget.value })}
                />
                </Form.Item>
                <Form.Item label="Interval">
                  <InputNumber
                    min={1}
                    className="full-width-control"
                  value={window.remindIntervalMinutes}
                    addonAfter="min"
                    onChange={(value) =>
                    updateWindow(window.id, {
                        remindIntervalMinutes: Number(value),
                    })
                  }
                />
                </Form.Item>
                <Form.Item label="Action">
                  <Button danger icon={<DeleteOutlined />} onClick={() => removeWindow(window.id)}>
                    Delete
                  </Button>
                </Form.Item>
              </Form>
              {errors.length > 0 ? (
                <Space direction="vertical">
                  {errors.map((error) => (
                    <Text type="danger" key={error}>
                      {error}
                    </Text>
                  ))}
                </Space>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
