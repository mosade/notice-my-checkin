use crate::{
    config::{AppConfig, ReminderWindow},
    time::{add_minutes, is_at_or_after, minutes_from_time, time_in_window},
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWindowState {
    pub reminder_window_id: String,
    pub date: String,
    pub status: String,
    pub last_checked_at: Option<String>,
    pub next_reminder_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReminderAction {
    pub window_id: String,
    pub window_name: String,
    pub time_range: String,
    pub last_checked_at: Option<String>,
    pub error: Option<String>,
    pub show_reminder: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckOutcome {
    CheckedIn,
    NotCheckedIn,
    Error,
}

#[derive(Debug, Clone, Copy)]
pub struct TickInput<'a> {
    pub date: &'a str,
    pub current_time: &'a str,
    pub check_result: Option<CheckOutcome>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppRuntimeSnapshot {
    pub checking: bool,
    pub states: Vec<RuntimeWindowState>,
}

#[derive(Debug, Clone)]
pub struct Scheduler {
    config: AppConfig,
    states: HashMap<String, RuntimeWindowState>,
}

impl Scheduler {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config,
            states: HashMap::new(),
        }
    }

    pub fn config(&self) -> AppConfig {
        self.config.clone()
    }

    pub fn replace_config(&mut self, config: AppConfig) {
        self.config = config;
        self.states.retain(|window_id, _| {
            self.config
                .reminder_windows
                .iter()
                .any(|w| &w.id == window_id)
        });
    }

    pub fn runtime_states(&self) -> Vec<RuntimeWindowState> {
        let mut states: Vec<_> = self.states.values().cloned().collect();
        states.sort_by(|left, right| left.reminder_window_id.cmp(&right.reminder_window_id));
        states
    }

    pub fn tick(&mut self, input: TickInput<'_>) -> Vec<ReminderAction> {
        let mut actions = Vec::new();
        for window in self.config.reminder_windows.clone() {
            if !window.enabled {
                continue;
            }
            self.ensure_state(&window, input.date);
            self.expire_if_needed(&window, input.current_time);
            if !time_in_window(input.current_time, &window.start_time, &window.end_time)
                .unwrap_or(false)
            {
                continue;
            }
            let due = self.is_due(&window, input.current_time);
            if due {
                if let Some(outcome) = input.check_result {
                    if let Some(action) = self.apply_check_result(
                        &window.id,
                        input.date,
                        input.current_time,
                        outcome,
                        None,
                    ) {
                        actions.push(action);
                    }
                }
            }
        }
        actions
    }

    pub fn due_windows(&mut self, date: &str, current_time: &str) -> Vec<ReminderWindow> {
        let mut due = Vec::new();
        for window in self.config.reminder_windows.clone() {
            if !window.enabled {
                continue;
            }
            self.ensure_state(&window, date);
            self.expire_if_needed(&window, current_time);
            if time_in_window(current_time, &window.start_time, &window.end_time).unwrap_or(false)
                && self.is_due(&window, current_time)
            {
                if let Some(state) = self.states.get_mut(&window.id) {
                    state.status = "checking".to_string();
                }
                due.push(window);
            }
        }
        due
    }

    pub fn apply_check_result(
        &mut self,
        window_id: &str,
        date: &str,
        current_time: &str,
        outcome: CheckOutcome,
        error: Option<String>,
    ) -> Option<ReminderAction> {
        let window = self
            .config
            .reminder_windows
            .iter()
            .find(|window| window.id == window_id)?
            .clone();
        self.ensure_state(&window, date);
        let state = self.states.get_mut(window_id)?;
        state.last_checked_at = Some(current_time.to_string());
        match outcome {
            CheckOutcome::CheckedIn => {
                state.status = "checked_in".to_string();
                state.next_reminder_at = None;
                state.last_error = None;
                None
            }
            CheckOutcome::NotCheckedIn => {
                state.status = "reminding".to_string();
                state.next_reminder_at =
                    add_minutes(current_time, window.remind_interval_minutes).ok();
                state.last_error = None;
                Some(action_from(&window, state, None))
            }
            CheckOutcome::Error => {
                state.status = "error".to_string();
                state.next_reminder_at =
                    add_minutes(current_time, window.remind_interval_minutes).ok();
                state.last_error = error;
                Some(action_from(&window, state, state.last_error.clone()))
            }
        }
    }

    pub fn snooze(&mut self, window_id: &str, current_time: &str) -> Result<(), String> {
        let window = self
            .config
            .reminder_windows
            .iter()
            .find(|window| window.id == window_id)
            .ok_or_else(|| format!("unknown reminder window: {window_id}"))?;
        let state = self
            .states
            .get_mut(window_id)
            .ok_or_else(|| format!("missing runtime state: {window_id}"))?;
        if state.status != "checked_in" && state.status != "expired" {
            state.status = "not_checked_in".to_string();
            state.next_reminder_at = add_minutes(current_time, window.remind_interval_minutes).ok();
        }
        Ok(())
    }

    fn ensure_state(&mut self, window: &ReminderWindow, date: &str) {
        let reset = self
            .states
            .get(&window.id)
            .map(|state| state.date != date)
            .unwrap_or(true);
        if reset {
            self.states.insert(
                window.id.clone(),
                RuntimeWindowState {
                    reminder_window_id: window.id.clone(),
                    date: date.to_string(),
                    status: "idle".to_string(),
                    last_checked_at: None,
                    next_reminder_at: None,
                    last_error: None,
                },
            );
        }
    }

    fn expire_if_needed(&mut self, window: &ReminderWindow, current_time: &str) {
        let Ok(current) = minutes_from_time(current_time) else {
            return;
        };
        let Ok(end) = minutes_from_time(&window.end_time) else {
            return;
        };
        if current < end {
            return;
        }
        if let Some(state) = self.states.get_mut(&window.id) {
            if state.status != "checked_in" && state.status != "idle" {
                state.status = "expired".to_string();
                state.next_reminder_at = None;
            }
        }
    }

    fn is_due(&self, window: &ReminderWindow, current_time: &str) -> bool {
        let Some(state) = self.states.get(&window.id) else {
            return true;
        };
        match state.status.as_str() {
            "idle" | "not_checked_in" | "error" => state
                .next_reminder_at
                .as_deref()
                .map(|next| is_at_or_after(current_time, next).unwrap_or(false))
                .unwrap_or(true),
            "checking" | "reminding" | "checked_in" | "expired" => false,
            _ => false,
        }
    }
}

fn action_from(
    window: &ReminderWindow,
    state: &RuntimeWindowState,
    error: Option<String>,
) -> ReminderAction {
    ReminderAction {
        window_id: window.id.clone(),
        window_name: window.name.clone(),
        time_range: format!("{}-{}", window.start_time, window.end_time),
        last_checked_at: state.last_checked_at.clone(),
        error,
        show_reminder: true,
    }
}
