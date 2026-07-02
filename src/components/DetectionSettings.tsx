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
          <option value="playwright_page">playwright_page</option>
        </select>
      </label>
      <label>
        目标网页 URL
        <input
          value={config.detection.targetUrl}
          onChange={(event) => updateDetection({ targetUrl: event.currentTarget.value })}
          placeholder="https://example.com/checkin"
        />
      </label>
      <label>
        触发点击元素
        <input
          value={config.detection.triggerSelector}
          onChange={(event) => updateDetection({ triggerSelector: event.currentTarget.value })}
          placeholder="button:has-text('查询')"
        />
      </label>
      <label>
        目标接口匹配
        <input
          value={config.detection.responseUrlPattern}
          onChange={(event) => updateDetection({ responseUrlPattern: event.currentTarget.value })}
          placeholder="/api/checkin/status"
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
      <label>
        接口响应等待秒数
        <input
          type="number"
          min={1}
          value={config.detection.responseTimeoutSeconds}
          onChange={(event) =>
            updateDetection({ responseTimeoutSeconds: Number(event.currentTarget.value) })
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
