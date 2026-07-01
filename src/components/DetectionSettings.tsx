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
        <span className="badge">mock</span>
      </div>
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
      <label className="switch-row">
        <input
          type="checkbox"
          checked={config.detection.mockCheckedIn}
          onChange={(event) => updateDetection({ mockCheckedIn: event.currentTarget.checked })}
        />
        mock 返回已打卡
      </label>
    </section>
  );
}
