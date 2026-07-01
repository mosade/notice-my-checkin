import type { AppConfig } from "../lib/types";

type Props = {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
};

export function DetectionSettings({ config, onChange }: Props) {
  const updateDetection = (patch: Partial<AppConfig["detection"]>) =>
    onChange({ ...config, detection: { ...config.detection, ...patch } });

  return (
    <section className="panel">
      <div className="section-title">
        <h2>检测</h2>
        <span className="badge">{config.detection.mode}</span>
      </div>
      <label>
        检测模式
        <select
          value={config.detection.mode}
          onChange={(event) =>
            updateDetection({ mode: event.currentTarget.value as AppConfig["detection"]["mode"] })
          }
        >
          <option value="mock">mock</option>
          <option value="chrome_http">chrome_http</option>
        </select>
      </label>
      <label>
        登录链接 A
        <input
          value={config.detection.loginUrl}
          onChange={(event) => updateDetection({ loginUrl: event.currentTarget.value })}
          placeholder="https://example.com/login"
        />
      </label>
      <label>
        接口 B
        <input
          value={config.detection.apiUrl}
          onChange={(event) => updateDetection({ apiUrl: event.currentTarget.value })}
          placeholder="https://example.com/api/checkin"
        />
      </label>
      <label>
        已打卡判断关键词
        <input
          value={config.detection.checkedInKeyword}
          onChange={(event) => updateDetection({ checkedInKeyword: event.currentTarget.value })}
          placeholder="已打卡"
        />
      </label>
      <label>
        自动登录超时秒数
        <input
          type="number"
          min={1}
          value={config.detection.loginTimeoutSeconds}
          onChange={(event) =>
            updateDetection({ loginTimeoutSeconds: Number(event.currentTarget.value) })
          }
        />
      </label>
      <label className="switch-row">
        <input
          type="checkbox"
          checked={config.detection.mockCheckedIn}
          disabled={config.detection.mode !== "mock"}
          onChange={(event) => updateDetection({ mockCheckedIn: event.currentTarget.checked })}
        />
        mock 返回已打卡
      </label>
    </section>
  );
}
