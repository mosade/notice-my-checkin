use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use notice_my_checkin_lib::config::{default_config, read_or_create_config, write_config};
use notice_my_checkin_lib::scheduler::{CheckOutcome, Scheduler, TickInput};
use notice_my_checkin_lib::time::{
    find_overlaps, minutes_from_time, time_in_window, validate_window,
};

#[test]
fn default_config_matches_first_release_contract() {
    let config = default_config();

    assert!(config.auto_start_checking);
    assert!(config.hide_to_tray_on_close);
    assert!(config.browser.headless);
    assert_eq!(config.detection.mode_, "mock");
    assert_eq!(config.reminder_windows.len(), 2);
    assert!(config
        .reminder_windows
        .iter()
        .all(|window| window.remind_interval_minutes >= 1));
}

#[test]
fn config_is_created_and_round_trips_json() {
    let dir = std::env::temp_dir().join(format!(
        "checkin-config-test-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos()
    ));
    let path = dir.join("config").join("app-config.json");

    let mut config = read_or_create_config(&path).expect("created config");
    config.detection.mock_checked_in = true;
    config.reminder_windows[0].name = "早上打卡".to_string();
    write_config(&path, &config).expect("write config");

    let reloaded = read_or_create_config(&path).expect("reload config");
    assert!(reloaded.detection.mock_checked_in);
    assert_eq!(reloaded.reminder_windows[0].name, "早上打卡");

    fs::remove_dir_all(dir).expect("cleanup");
}

#[test]
fn time_helpers_reject_cross_day_windows_and_detect_overlaps() {
    assert_eq!(minutes_from_time("08:30").unwrap(), 510);
    assert!(time_in_window("08:30", "08:00", "09:00").unwrap());
    assert!(!time_in_window("09:00", "08:00", "09:00").unwrap());
    assert!(validate_window("08:00", "09:00", 5).is_ok());
    assert!(validate_window("23:00", "01:00", 5).is_err());
    assert!(validate_window("08:00", "09:00", 0).is_err());

    let config = default_config();
    assert!(find_overlaps(&config.reminder_windows).is_empty());
}

#[test]
fn scheduler_enters_window_checks_and_marks_not_checked_in() {
    let config = default_config();
    let mut scheduler = Scheduler::new(config);

    let actions = scheduler.tick(TickInput {
        date: "2026-07-01",
        current_time: "08:01",
        check_result: Some(CheckOutcome::NotCheckedIn),
    });

    assert_eq!(actions.len(), 1);
    assert_eq!(actions[0].window_id, "morning");
    assert!(actions[0].show_reminder);

    let states = scheduler.runtime_states();
    let morning = states
        .iter()
        .find(|state| state.reminder_window_id == "morning")
        .expect("morning state");
    assert_eq!(morning.status, "reminding");
    assert_eq!(morning.next_reminder_at.as_deref(), Some("08:16"));
}

#[test]
fn scheduler_respects_later_reminder_confirm_and_expiry() {
    let config = default_config();
    let mut scheduler = Scheduler::new(config);

    scheduler.tick(TickInput {
        date: "2026-07-01",
        current_time: "08:01",
        check_result: Some(CheckOutcome::NotCheckedIn),
    });
    scheduler.snooze("morning", "08:01").expect("snooze");

    assert!(scheduler
        .tick(TickInput {
            date: "2026-07-01",
            current_time: "08:10",
            check_result: None,
        })
        .is_empty());
    assert_eq!(
        scheduler
            .tick(TickInput {
                date: "2026-07-01",
                current_time: "08:16",
                check_result: Some(CheckOutcome::CheckedIn),
            })
            .len(),
        0
    );

    let morning = scheduler
        .runtime_states()
        .into_iter()
        .find(|state| state.reminder_window_id == "morning")
        .expect("morning state");
    assert_eq!(morning.status, "checked_in");

    let mut expired = Scheduler::new(default_config());
    expired.tick(TickInput {
        date: "2026-07-01",
        current_time: "08:01",
        check_result: Some(CheckOutcome::NotCheckedIn),
    });
    expired.tick(TickInput {
        date: "2026-07-01",
        current_time: "09:01",
        check_result: None,
    });

    let morning = expired
        .runtime_states()
        .into_iter()
        .find(|state| state.reminder_window_id == "morning")
        .expect("morning state");
    assert_eq!(morning.status, "expired");
}
