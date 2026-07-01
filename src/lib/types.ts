export type AppConfig = {
  autoStartChecking: boolean;
  hideToTrayOnClose: boolean;
  browser: BrowserConfig;
  detection: DetectionConfig;
  reminderWindows: ReminderWindow[];
};

export type BrowserConfig = {
  executablePath: string;
  headless: boolean;
  userDataDir: string;
};

export type DetectionConfig = {
  mode: "mock";
  loginUrl: string;
  apiUrl: string;
  mockCheckedIn: boolean;
};

export type ReminderWindow = {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  remindIntervalMinutes: number;
};

export type RuntimeWindowState = {
  reminderWindowId: string;
  date: string;
  status: ReminderRuntimeStatus;
  lastCheckedAt?: string;
  nextReminderAt?: string;
  lastError?: string;
};

export type ReminderRuntimeStatus =
  | "idle"
  | "checking"
  | "not_checked_in"
  | "reminding"
  | "checked_in"
  | "expired"
  | "error";

export type AppRuntimeSnapshot = {
  checking: boolean;
  states: RuntimeWindowState[];
};

export type ReminderAction = {
  windowId: string;
  windowName: string;
  timeRange: string;
  lastCheckedAt?: string;
  error?: string;
  showReminder: boolean;
};

export type CheckResult = {
  ok: boolean;
  checkedIn: boolean;
  checkedAt: string;
  error?: {
    code: string;
    message: string;
  };
};
