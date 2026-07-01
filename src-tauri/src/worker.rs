use crate::config::{AppConfig, BrowserConfig, DetectionConfig};
use serde::{Deserialize, Serialize};
use std::{
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRequest {
    pub browser: BrowserConfig,
    pub detection: DetectionConfig,
    pub reminder_window_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub ok: bool,
    pub checked_in: bool,
    pub checked_at: String,
    pub error: Option<WorkerError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerError {
    pub code: String,
    pub message: String,
}

pub fn check_once(
    project_root: &Path,
    config: &AppConfig,
    window_id: &str,
) -> io::Result<CheckResult> {
    let request = CheckRequest {
        browser: config.browser.clone(),
        detection: config.detection.clone(),
        reminder_window_id: window_id.to_string(),
    };
    run_worker(project_root, "check", &request)
}

pub fn test_browser(project_root: &Path, config: &AppConfig) -> io::Result<CheckResult> {
    let request = CheckRequest {
        browser: config.browser.clone(),
        detection: config.detection.clone(),
        reminder_window_id: "browser-test".to_string(),
    };
    run_worker(project_root, "test-browser", &request)
}

fn run_worker(
    project_root: &Path,
    command_name: &str,
    request: &CheckRequest,
) -> io::Result<CheckResult> {
    let worker_path = project_root.join("worker").join("check-worker.mjs");
    let mut child = Command::new(node_binary())
        .arg(&worker_path)
        .arg(command_name)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| io::Error::new(io::ErrorKind::BrokenPipe, "worker stdin unavailable"))?;
        stdin.write_all(serde_json::to_string(request)?.as_bytes())?;
    }
    let output = child.wait_with_output()?;
    if !output.status.success() {
        return Ok(CheckResult {
            ok: false,
            checked_in: false,
            checked_at: chrono::Local::now().to_rfc3339(),
            error: Some(WorkerError {
                code: "WORKER_FAILED".to_string(),
                message: String::from_utf8_lossy(&output.stderr).trim().to_string(),
            }),
        });
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

fn node_binary() -> PathBuf {
    std::env::var_os("NODE")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("node"))
}
