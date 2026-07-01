use crate::windows::show_main_window;
use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, AppHandle, Emitter};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("open", "打开")
        .text("toggle-checking", "开始/暂停检测")
        .text("check-now", "立即检测")
        .separator()
        .text("quit", "退出")
        .build()?;

    let mut builder = TrayIconBuilder::with_id("checkin-tray")
        .tooltip("打卡提醒")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = show_main_window(app);
            }
            "toggle-checking" => {
                let _ = app.emit("tray-toggle-checking", ());
            }
            "check-now" => {
                let _ = app.emit("tray-check-now", ());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
