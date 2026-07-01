pub mod config;
pub mod scheduler;
pub mod time;
pub mod tray;
pub mod windows;
pub mod worker;

use chrono::Local;
use config::{app_config_path, read_or_create_config, write_config, AppConfig};
use scheduler::{AppRuntimeSnapshot, CheckOutcome, ReminderAction, Scheduler};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{Emitter, Manager, State, WindowEvent};

#[derive(Clone)]
pub struct AppState {
    config_path: PathBuf,
    project_root: PathBuf,
    scheduler: Arc<Mutex<Scheduler>>,
    running: Arc<Mutex<Option<Arc<AtomicBool>>>>,
    active_reminder: Arc<Mutex<Option<String>>>,
}

#[tauri::command]
fn load_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    Ok(state.scheduler.lock().map_err(lock_error)?.config())
}

#[tauri::command]
fn save_config(config: AppConfig, state: State<'_, AppState>) -> Result<AppConfig, String> {
    write_config(&state.config_path, &config).map_err(|error| error.to_string())?;
    state
        .scheduler
        .lock()
        .map_err(lock_error)?
        .replace_config(config.clone());
    Ok(config)
}

#[tauri::command]
fn get_runtime_snapshot(state: State<'_, AppState>) -> Result<AppRuntimeSnapshot, String> {
    runtime_snapshot(&state)
}

#[tauri::command]
fn start_checking(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AppRuntimeSnapshot, String> {
    start_scheduler_loop(app, &state)?;
    runtime_snapshot(&state)
}

#[tauri::command]
fn pause_checking(state: State<'_, AppState>) -> Result<AppRuntimeSnapshot, String> {
    stop_scheduler_loop(&state)?;
    runtime_snapshot(&state)
}

#[tauri::command]
fn run_check_now(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<ReminderAction>, String> {
    let (date, current_time) = now_parts();
    let windows = {
        let mut scheduler = state.scheduler.lock().map_err(lock_error)?;
        let mut windows = scheduler.due_windows(&date, &current_time);
        if windows.is_empty() {
            let config = scheduler.config();
            windows = config
                .reminder_windows
                .into_iter()
                .filter(|window| window.enabled)
                .collect();
        }
        windows
    };
    let actions = run_checks_for_windows(&app, &state, &date, &current_time, windows)?;
    emit_runtime(&app, &state);
    Ok(actions)
}

#[tauri::command]
fn test_browser(state: State<'_, AppState>) -> Result<worker::CheckResult, String> {
    let config = state.scheduler.lock().map_err(lock_error)?.config();
    worker::test_browser(&state.project_root, &config).map_err(|error| error.to_string())
}

#[tauri::command]
fn test_reminder(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let config = state.scheduler.lock().map_err(lock_error)?.config();
    let window = config
        .reminder_windows
        .iter()
        .find(|window| window.enabled)
        .ok_or_else(|| "没有启用的提醒时间段".to_string())?;
    let action = ReminderAction {
        window_id: window.id.clone(),
        window_name: window.name.clone(),
        time_range: format!("{}-{}", window.start_time, window.end_time),
        last_checked_at: Some(now_parts().1),
        error: None,
        show_reminder: true,
    };
    *state.active_reminder.lock().map_err(lock_error)? = Some(action.window_id.clone());
    windows::show_reminder_window(&app, &action)
}

#[tauri::command]
fn snooze_reminder(
    window_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AppRuntimeSnapshot, String> {
    let current_time = now_parts().1;
    state
        .scheduler
        .lock()
        .map_err(lock_error)?
        .snooze(&window_id, &current_time)?;
    *state.active_reminder.lock().map_err(lock_error)? = None;
    windows::hide_reminder_window(&app)?;
    emit_runtime(&app, &state);
    runtime_snapshot(&state)
}

#[tauri::command]
fn confirm_checked_in(
    window_id: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<AppRuntimeSnapshot, String> {
    let (date, current_time) = now_parts();
    let config = state.scheduler.lock().map_err(lock_error)?.config();
    let result = worker::check_once(&state.project_root, &config, &window_id)
        .map_err(|error| error.to_string())?;
    let outcome = check_outcome(&result);
    let error = result.error.as_ref().map(|error| error.message.clone());
    let action = state
        .scheduler
        .lock()
        .map_err(lock_error)?
        .apply_check_result(&window_id, &date, &current_time, outcome, error);
    match action {
        Some(action) => {
            *state.active_reminder.lock().map_err(lock_error)? = Some(action.window_id.clone());
            windows::show_reminder_window(&app, &action)?;
        }
        None => {
            *state.active_reminder.lock().map_err(lock_error)? = None;
            windows::hide_reminder_window(&app)?;
        }
    }
    emit_runtime(&app, &state);
    runtime_snapshot(&state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_path = app_config_path().expect("resolve config path");
    let config = read_or_create_config(&config_path).expect("load app config");
    let project_root = config_path
        .parent()
        .and_then(|path| path.parent())
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().expect("current dir"));
    let auto_start = config.auto_start_checking;
    let state = AppState {
        config_path,
        project_root,
        scheduler: Arc::new(Mutex::new(Scheduler::new(config))),
        running: Arc::new(Mutex::new(None)),
        active_reminder: Arc::new(Mutex::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state.clone())
        .setup(move |app| {
            let reminder_window =
                windows::ensure_reminder_window(app.handle()).map_err(std::io::Error::other)?;
            tray::setup_tray(app.handle())?;
            wire_window_close_handlers(app.handle(), state.clone());
            wire_reminder_close(reminder_window, app.handle().clone(), state.clone());
            if auto_start {
                let _ = start_scheduler_loop(app.handle().clone(), &state);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            get_runtime_snapshot,
            start_checking,
            pause_checking,
            run_check_now,
            test_browser,
            test_reminder,
            snooze_reminder,
            confirm_checked_in
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_scheduler_loop(app: tauri::AppHandle, state: &AppState) -> Result<(), String> {
    let mut running_guard = state.running.lock().map_err(lock_error)?;
    if running_guard.is_some() {
        return Ok(());
    }
    let running = Arc::new(AtomicBool::new(true));
    *running_guard = Some(running.clone());
    let thread_state = state.clone();
    thread::spawn(move || {
        while running.load(Ordering::SeqCst) {
            let (date, current_time) = now_parts();
            let due = {
                let Ok(mut scheduler) = thread_state.scheduler.lock() else {
                    break;
                };
                scheduler.due_windows(&date, &current_time)
            };
            if !due.is_empty() {
                let _ = run_checks_for_windows(&app, &thread_state, &date, &current_time, due);
                emit_runtime(&app, &thread_state);
            }
            thread::sleep(Duration::from_secs(30));
        }
    });
    Ok(())
}

fn stop_scheduler_loop(state: &AppState) -> Result<(), String> {
    if let Some(flag) = state.running.lock().map_err(lock_error)?.take() {
        flag.store(false, Ordering::SeqCst);
    }
    Ok(())
}

fn run_checks_for_windows(
    app: &tauri::AppHandle,
    state: &AppState,
    date: &str,
    current_time: &str,
    windows_to_check: Vec<config::ReminderWindow>,
) -> Result<Vec<ReminderAction>, String> {
    let mut actions = Vec::new();
    for window in windows_to_check {
        let config = state.scheduler.lock().map_err(lock_error)?.config();
        let result = worker::check_once(&state.project_root, &config, &window.id)
            .map_err(|error| error.to_string())?;
        let outcome = check_outcome(&result);
        let error = result.error.as_ref().map(|error| error.message.clone());
        let action = state
            .scheduler
            .lock()
            .map_err(lock_error)?
            .apply_check_result(&window.id, date, current_time, outcome, error);
        if let Some(action) = action {
            *state.active_reminder.lock().map_err(lock_error)? = Some(action.window_id.clone());
            windows::show_reminder_window(app, &action)?;
            actions.push(action);
        } else if state.active_reminder.lock().map_err(lock_error)?.as_deref()
            == Some(window.id.as_str())
        {
            *state.active_reminder.lock().map_err(lock_error)? = None;
            windows::hide_reminder_window(app)?;
        }
    }
    Ok(actions)
}

fn wire_window_close_handlers(app: &tauri::AppHandle, state: AppState) {
    if let Some(main_window) = app.get_webview_window("main") {
        let main_state = state.clone();
        let main_to_hide = main_window.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let hide_to_tray = main_state
                    .scheduler
                    .lock()
                    .map(|scheduler| scheduler.config().hide_to_tray_on_close)
                    .unwrap_or(true);
                if hide_to_tray {
                    api.prevent_close();
                    let _ = main_to_hide.hide();
                }
            }
        });
    }
}

fn wire_reminder_close(window: tauri::WebviewWindow, app: tauri::AppHandle, state: AppState) {
    let window_to_hide = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if let Ok(mut active) = state.active_reminder.lock() {
                if let Some(window_id) = active.take() {
                    let current_time = now_parts().1;
                    if let Ok(mut scheduler) = state.scheduler.lock() {
                        let _ = scheduler.snooze(&window_id, &current_time);
                    }
                }
            }
            let _ = window_to_hide.hide();
            emit_runtime(&app, &state);
        }
    });
}

fn runtime_snapshot(state: &AppState) -> Result<AppRuntimeSnapshot, String> {
    let checking = state.running.lock().map_err(lock_error)?.is_some();
    let states = state.scheduler.lock().map_err(lock_error)?.runtime_states();
    Ok(AppRuntimeSnapshot { checking, states })
}

fn emit_runtime(app: &tauri::AppHandle, state: &AppState) {
    if let Ok(snapshot) = runtime_snapshot(state) {
        let _ = app.emit("runtime-update", snapshot);
    }
}

fn check_outcome(result: &worker::CheckResult) -> CheckOutcome {
    if result.ok && result.checked_in {
        CheckOutcome::CheckedIn
    } else if result.ok {
        CheckOutcome::NotCheckedIn
    } else {
        CheckOutcome::Error
    }
}

fn now_parts() -> (String, String) {
    let now = Local::now();
    (
        now.format("%Y-%m-%d").to_string(),
        now.format("%H:%M").to_string(),
    )
}

fn lock_error<T>(_: std::sync::PoisonError<T>) -> String {
    "state lock poisoned".to_string()
}
