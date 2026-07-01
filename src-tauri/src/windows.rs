use crate::scheduler::ReminderAction;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const REMINDER_LABEL: &str = "reminder";

pub fn show_main_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn hide_reminder_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(REMINDER_LABEL) {
        window.hide().map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn show_reminder_window(app: &tauri::AppHandle, action: &ReminderAction) -> Result<(), String> {
    let window = ensure_reminder_window(app)?;
    window
        .emit("reminder-update", action)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn ensure_reminder_window(app: &tauri::AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(REMINDER_LABEL) {
        return Ok(window);
    }
    WebviewWindowBuilder::new(
        app,
        REMINDER_LABEL,
        WebviewUrl::App("index.html#/reminder".into()),
    )
    .title("打卡提醒")
    .inner_size(420.0, 220.0)
    .resizable(false)
    .always_on_top(true)
    .visible(false)
    .build()
    .map_err(|error| error.to_string())
}
