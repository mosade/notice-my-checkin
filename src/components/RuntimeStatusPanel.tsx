import { Card, Table, Tag } from "antd";
import type { AppRuntimeSnapshot, RuntimeWindowState } from "../lib/types";

type Props = {
  snapshot?: AppRuntimeSnapshot;
};

const statusText: Record<RuntimeWindowState["status"], string> = {
  idle: "Idle",
  checking: "Checking",
  not_checked_in: "Not Checked In",
  reminding: "Reminding",
  checked_in: "Checked In",
  expired: "Expired",
  error: "Error",
};

const statusColor: Record<RuntimeWindowState["status"], string> = {
  idle: "default",
  checking: "processing",
  not_checked_in: "warning",
  reminding: "warning",
  checked_in: "success",
  expired: "error",
  error: "error",
};

export function RuntimeStatusPanel({ snapshot }: Props) {
  return (
    <Card
      title="Runtime Status"
      extra={<Tag color={snapshot?.checking ? "success" : "default"}>{snapshot?.checking ? "Checking" : "Paused"}</Tag>}
    >
      <Table
        rowKey="reminderWindowId"
        dataSource={snapshot?.states ?? []}
        pagination={false}
        scroll={{ x: 760 }}
        locale={{ emptyText: "No runtime records" }}
        columns={[
          { title: "Window", dataIndex: "reminderWindowId" },
          { title: "Date", dataIndex: "date" },
          {
            title: "Status",
            dataIndex: "status",
            render: (status: RuntimeWindowState["status"]) => <Tag color={statusColor[status]}>{statusText[status]}</Tag>,
          },
          { title: "Last Checked", dataIndex: "lastCheckedAt", render: (value?: string) => value ?? "-" },
          {
            title: "Next Reminder",
            render: (_: unknown, state: RuntimeWindowState) => state.nextReminderAt ?? state.lastError ?? "-",
          },
        ]}
      />
    </Card>
  );
}
