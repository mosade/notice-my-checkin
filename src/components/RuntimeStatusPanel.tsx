import type { AppRuntimeSnapshot, RuntimeWindowState } from "../lib/types";

type Props = {
  snapshot?: AppRuntimeSnapshot;
};

const statusText: Record<RuntimeWindowState["status"], string> = {
  idle: "空闲",
  checking: "检测中",
  not_checked_in: "未打卡",
  reminding: "提醒中",
  checked_in: "已打卡",
  expired: "已过期",
  error: "异常",
};

export function RuntimeStatusPanel({ snapshot }: Props) {
  return (
    <section className="panel wide-panel">
      <div className="section-title">
        <h2>运行状态</h2>
        <span className={snapshot?.checking ? "badge live" : "badge"}>{snapshot?.checking ? "检测中" : "已暂停"}</span>
      </div>
      <div className="status-table">
        <div className="status-head">时间段</div>
        <div className="status-head">日期</div>
        <div className="status-head">状态</div>
        <div className="status-head">最近检测</div>
        <div className="status-head">下次提醒</div>
        {(snapshot?.states.length ?? 0) === 0 ? (
          <p className="empty-state">暂无运行记录</p>
        ) : (
          snapshot?.states.map((state) => (
            <StatusRow key={state.reminderWindowId} state={state} />
          ))
        )}
      </div>
    </section>
  );
}

function StatusRow({ state }: { state: RuntimeWindowState }) {
  return (
    <>
      <div>{state.reminderWindowId}</div>
      <div>{state.date}</div>
      <div>
        <span className={`status-pill ${state.status}`}>{statusText[state.status]}</span>
      </div>
      <div>{state.lastCheckedAt ?? "-"}</div>
      <div>{state.nextReminderAt ?? state.lastError ?? "-"}</div>
    </>
  );
}
