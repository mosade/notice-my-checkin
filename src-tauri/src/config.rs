use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{self, ErrorKind},
    path::{Path, PathBuf},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub auto_start_checking: bool,
    pub hide_to_tray_on_close: bool,
    pub browser: BrowserConfig,
    pub detection: DetectionConfig,
    pub reminder_windows: Vec<ReminderWindow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserConfig {
    pub executable_path: String,
    pub headless: bool,
    pub user_data_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionConfig {
    #[serde(rename = "mode")]
    pub mode_: String,
    pub login_url: String,
    pub api_url: String,
    pub mock_checked_in: bool,
    #[serde(default)]
    pub checked_in_keyword: String,
    #[serde(default = "default_login_timeout_seconds")]
    pub login_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReminderWindow {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub start_time: String,
    pub end_time: String,
    pub remind_interval_minutes: u32,
}

pub fn default_config() -> AppConfig {
    AppConfig {
        auto_start_checking: true,
        hide_to_tray_on_close: true,
        browser: BrowserConfig {
            executable_path: String::new(),
            headless: true,
            user_data_dir: "browser-profile".to_string(),
        },
        detection: DetectionConfig {
            mode_: "mock".to_string(),
            login_url: String::new(),
            api_url: String::new(),
            mock_checked_in: false,
            checked_in_keyword: String::new(),
            login_timeout_seconds: default_login_timeout_seconds(),
        },
        reminder_windows: vec![
            ReminderWindow {
                id: "morning".to_string(),
                name: "上午打卡".to_string(),
                enabled: true,
                start_time: "08:00".to_string(),
                end_time: "09:00".to_string(),
                remind_interval_minutes: 15,
            },
            ReminderWindow {
                id: "evening".to_string(),
                name: "下午打卡".to_string(),
                enabled: true,
                start_time: "17:30".to_string(),
                end_time: "18:30".to_string(),
                remind_interval_minutes: 15,
            },
        ],
    }
}

fn default_login_timeout_seconds() -> u64 {
    30
}

pub fn read_or_create_config(path: &Path) -> io::Result<AppConfig> {
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw).map_err(|error| {
            io::Error::new(
                ErrorKind::InvalidData,
                format!("invalid config json at {}: {error}", path.display()),
            )
        }),
        Err(error) if error.kind() == ErrorKind::NotFound => {
            let config = default_config();
            write_config(path, &config)?;
            Ok(config)
        }
        Err(error) => Err(error),
    }
}

pub fn write_config(path: &Path, config: &AppConfig) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|error| io::Error::new(ErrorKind::InvalidData, error))?;
    fs::write(path, format!("{raw}\n"))
}

pub fn app_config_path() -> io::Result<PathBuf> {
    let cwd = std::env::current_dir()?;
    let base = if cwd.file_name().is_some_and(|name| name == "src-tauri") {
        cwd.parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| cwd.clone())
    } else {
        cwd
    };
    Ok(base.join("config").join("app-config.json"))
}
