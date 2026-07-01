import { createReminderWindow, overlapText } from "../lib/config";
import { validateReminderWindow } from "../lib/time";
import type { AppConfig, ReminderWindow } from "../lib/types";

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
    <section className="panel wide-panel">
      <div className="section-title">
        <h2>提醒时间段</h2>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...config,
              reminderWindows: [...config.reminderWindows, createReminderWindow()],
            })
          }
        >
          新增
        </button>
      </div>
      {warning ? <p className="result warn">{warning}</p> : null}
      <div className="window-list">
        {config.reminderWindows.map((window) => {
          const errors = validateReminderWindow(window);
          return (
            <div className="window-row" key={window.id}>
              <label className="compact-check">
                <input
                  type="checkbox"
                  checked={window.enabled}
                  onChange={(event) => updateWindow(window.id, { enabled: event.currentTarget.checked })}
                />
              </label>
              <label>
                名称
                <input
                  value={window.name}
                  onChange={(event) => updateWindow(window.id, { name: event.currentTarget.value })}
                />
              </label>
              <label>
                开始
                <input
                  type="time"
                  value={window.startTime}
                  onChange={(event) => updateWindow(window.id, { startTime: event.currentTarget.value })}
                />
              </label>
              <label>
                结束
                <input
                  type="time"
                  value={window.endTime}
                  onChange={(event) => updateWindow(window.id, { endTime: event.currentTarget.value })}
                />
              </label>
              <label>
                间隔
                <input
                  type="number"
                  min={1}
                  value={window.remindIntervalMinutes}
                  onChange={(event) =>
                    updateWindow(window.id, {
                      remindIntervalMinutes: Number(event.currentTarget.value),
                    })
                  }
                />
              </label>
              <button type="button" className="ghost" onClick={() => removeWindow(window.id)}>
                删除
              </button>
              {errors.length > 0 ? <p className="row-error">{errors.join("，")}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
