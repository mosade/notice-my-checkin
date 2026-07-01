use crate::config::{AppConfig, BrowserConfig};
use chromiumoxide::browser::{Browser, BrowserConfig as ChromeConfig};
use futures_util::StreamExt;
use reqwest::header::COOKIE;
use serde::{Deserialize, Serialize};
use std::{
    fs, io,
    path::Path,
    time::{Duration, Instant},
};

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionOutcome {
    NeedsLogin,
    CheckedIn,
    NotCheckedIn,
}

pub fn check_once(
    _project_root: &Path,
    config: &AppConfig,
    _window_id: &str,
) -> io::Result<CheckResult> {
    match config.detection.mode_.as_str() {
        "mock" => Ok(success(config.detection.mock_checked_in)),
        "chrome_http" => run_chrome_http_check(config),
        other => Ok(failure(
            "UNSUPPORTED_MODE",
            format!("unsupported detection mode: {other}"),
        )),
    }
}

pub fn test_browser(_project_root: &Path, config: &AppConfig) -> io::Result<CheckResult> {
    validate_browser_config(&config.browser)
}

pub fn cookie_header_from_pairs(pairs: &[(String, String)]) -> String {
    pairs
        .iter()
        .map(|(name, value)| format!("{name}={value}"))
        .collect::<Vec<_>>()
        .join("; ")
}

pub fn classify_api_response(
    status_code: u16,
    body: &str,
    checked_in_keyword: &str,
) -> DetectionOutcome {
    if status_code == 401 || status_code == 403 || (300..400).contains(&status_code) {
        return DetectionOutcome::NeedsLogin;
    }
    if !checked_in_keyword.is_empty() && body.contains(checked_in_keyword) {
        DetectionOutcome::CheckedIn
    } else {
        DetectionOutcome::NotCheckedIn
    }
}

fn run_chrome_http_check(config: &AppConfig) -> io::Result<CheckResult> {
    if config.detection.login_url.trim().is_empty() {
        return Ok(failure("MISSING_LOGIN_URL", "登录链接不能为空"));
    }
    if config.detection.api_url.trim().is_empty() {
        return Ok(failure("MISSING_API_URL", "检测接口不能为空"));
    }
    if config.detection.checked_in_keyword.trim().is_empty() {
        return Ok(failure(
            "MISSING_CHECKED_IN_KEYWORD",
            "已打卡判断关键词不能为空",
        ));
    }

    let runtime = tokio::runtime::Runtime::new().map_err(io::Error::other)?;
    Ok(runtime.block_on(run_chrome_http_check_async(config)))
}

async fn run_chrome_http_check_async(config: &AppConfig) -> CheckResult {
    match run_chrome_http_check_inner(config).await {
        Ok(checked_in) => success(checked_in),
        Err(error) => failure("CHROME_HTTP_CHECK_FAILED", error.to_string()),
    }
}

async fn run_chrome_http_check_inner(
    config: &AppConfig,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let chrome_config = build_chrome_config(&config.browser)?;
    let (mut browser, mut handler) = Browser::launch(chrome_config).await?;
    let handle = tokio::spawn(async move {
        while let Some(event) = handler.next().await {
            if event.is_err() {
                break;
            }
        }
    });

    let result = async {
        let _page = browser.new_page(config.detection.login_url.clone()).await?;
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(10))
            .build()?;
        let deadline =
            Instant::now() + Duration::from_secs(config.detection.login_timeout_seconds.max(1));

        loop {
            let cookies = browser.get_cookies().await?;
            let pairs = cookies
                .iter()
                .map(|cookie| (cookie.name.clone(), cookie.value.clone()))
                .collect::<Vec<_>>();
            let cookie_header = cookie_header_from_pairs(&pairs);
            let mut request = client.get(&config.detection.api_url);
            if !cookie_header.is_empty() {
                request = request.header(COOKIE, cookie_header);
            }

            let response = request.send().await?;
            let status = response.status().as_u16();
            let body = response.text().await.unwrap_or_default();

            match classify_api_response(status, &body, &config.detection.checked_in_keyword) {
                DetectionOutcome::CheckedIn => return Ok(true),
                DetectionOutcome::NotCheckedIn => return Ok(false),
                DetectionOutcome::NeedsLogin if Instant::now() >= deadline => {
                    return Err("等待自动登录超时".into());
                }
                DetectionOutcome::NeedsLogin => {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }
    .await;

    let _ = browser.close().await;
    let _ = browser.wait().await;
    let _ = handle.await;
    result
}

fn build_chrome_config(
    browser: &BrowserConfig,
) -> Result<ChromeConfig, Box<dyn std::error::Error + Send + Sync>> {
    let mut builder = ChromeConfig::builder()
        .launch_timeout(Duration::from_secs(20))
        .request_timeout(Duration::from_secs(15));
    if !browser.headless {
        builder = builder.with_head();
    }
    if !browser.executable_path.trim().is_empty() {
        builder = builder.chrome_executable(&browser.executable_path);
    }
    if !browser.user_data_dir.trim().is_empty() {
        fs::create_dir_all(&browser.user_data_dir)?;
        builder = builder.user_data_dir(&browser.user_data_dir);
    }
    builder.build().map_err(Into::into)
}

fn validate_browser_config(browser: &BrowserConfig) -> io::Result<CheckResult> {
    if !browser.executable_path.trim().is_empty() {
        let metadata = match fs::metadata(&browser.executable_path) {
            Ok(metadata) => metadata,
            Err(_) => {
                return Ok(failure("BROWSER_NOT_FOUND", "浏览器路径不存在或不可读取"));
            }
        };
        if !metadata.is_file() {
            return Ok(failure("BROWSER_NOT_FILE", "浏览器路径不是文件"));
        }
    }
    if !browser.user_data_dir.trim().is_empty() {
        if let Err(error) = fs::create_dir_all(&browser.user_data_dir) {
            return Ok(failure(
                "USER_DATA_DIR_NOT_WRITABLE",
                format!("用户数据目录不可写：{error}"),
            ));
        }
        if !fs::metadata(&browser.user_data_dir)
            .map(|metadata| metadata.is_dir())
            .unwrap_or(false)
        {
            return Ok(failure(
                "USER_DATA_DIR_NOT_DIRECTORY",
                "用户数据目录不是文件夹",
            ));
        }
    }
    Ok(CheckResult {
        ok: true,
        checked_in: false,
        checked_at: now(),
        error: None,
    })
}

fn success(checked_in: bool) -> CheckResult {
    CheckResult {
        ok: true,
        checked_in,
        checked_at: now(),
        error: None,
    }
}

fn failure(code: impl Into<String>, message: impl Into<String>) -> CheckResult {
    CheckResult {
        ok: false,
        checked_in: false,
        checked_at: now(),
        error: Some(WorkerError {
            code: code.into(),
            message: message.into(),
        }),
    }
}

fn now() -> String {
    chrono::Local::now().to_rfc3339()
}
