use crate::config::ReminderWindow;

pub fn minutes_from_time(value: &str) -> Result<u32, String> {
    let (hour, minute) = value
        .split_once(':')
        .ok_or_else(|| format!("invalid time: {value}"))?;
    if hour.len() != 2 || minute.len() != 2 {
        return Err(format!("invalid time: {value}"));
    }
    let hour: u32 = hour
        .parse()
        .map_err(|_| format!("invalid hour in time: {value}"))?;
    let minute: u32 = minute
        .parse()
        .map_err(|_| format!("invalid minute in time: {value}"))?;
    if hour > 23 || minute > 59 {
        return Err(format!("invalid time: {value}"));
    }
    Ok(hour * 60 + minute)
}

pub fn time_in_window(current: &str, start: &str, end: &str) -> Result<bool, String> {
    let current = minutes_from_time(current)?;
    let start = minutes_from_time(start)?;
    let end = minutes_from_time(end)?;
    Ok(start < end && current >= start && current < end)
}

pub fn validate_window(start: &str, end: &str, interval_minutes: u32) -> Result<(), String> {
    let start = minutes_from_time(start)?;
    let end = minutes_from_time(end)?;
    if start >= end {
        return Err("startTime must be earlier than endTime".to_string());
    }
    if interval_minutes < 1 {
        return Err("remindIntervalMinutes must be at least 1".to_string());
    }
    Ok(())
}

pub fn find_overlaps(windows: &[ReminderWindow]) -> Vec<(String, String)> {
    let mut overlaps = Vec::new();
    for (index, left) in windows.iter().enumerate() {
        if !left.enabled {
            continue;
        }
        let Ok(left_start) = minutes_from_time(&left.start_time) else {
            continue;
        };
        let Ok(left_end) = minutes_from_time(&left.end_time) else {
            continue;
        };
        for right in windows.iter().skip(index + 1) {
            if !right.enabled {
                continue;
            }
            let Ok(right_start) = minutes_from_time(&right.start_time) else {
                continue;
            };
            let Ok(right_end) = minutes_from_time(&right.end_time) else {
                continue;
            };
            if left_start < right_end && right_start < left_end {
                overlaps.push((left.id.clone(), right.id.clone()));
            }
        }
    }
    overlaps
}

pub fn add_minutes(time: &str, minutes: u32) -> Result<String, String> {
    let total = minutes_from_time(time)? + minutes;
    Ok(format!("{:02}:{:02}", (total / 60) % 24, total % 60))
}

pub fn is_at_or_after(current: &str, target: &str) -> Result<bool, String> {
    Ok(minutes_from_time(current)? >= minutes_from_time(target)?)
}
