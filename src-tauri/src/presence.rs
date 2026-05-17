use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresencePayload {
    pub client_id: String,
    pub details: String,
    pub state: String,
    pub large_image_key: String,
    pub small_image_key: String,
    pub button_one_label: String,
    pub button_one_url: String,
    pub button_two_label: String,
    pub button_two_url: String,
    pub show_elapsed_time: bool,
    #[serde(default = "default_true")]
    pub show_buttons: bool,
    pub auto_reconnect: bool,
    pub start_minimized: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceStartRequest {
    pub payload: PresencePayload,
    pub transport: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceSession {
    pub running: bool,
    pub client_id: String,
    pub details: String,
    pub state: String,
    pub activity_label: String,
    pub transport: String,
}

#[derive(Debug)]
pub struct PresenceRuntime {
    client: Option<DiscordIpcClient>,
    active_client_id: Option<String>,
}

pub type PresenceState = Mutex<PresenceRuntime>;

impl PresenceRuntime {
    pub fn new() -> Self {
        Self {
            client: None,
            active_client_id: None,
        }
    }

    fn start(
        &mut self,
        payload: PresencePayload,
        transport: &str,
    ) -> Result<PresenceSession, String> {
        validate_payload(&payload)?;

        if transport == "Disabled" {
            return Err("RPC transport is disabled in Settings.".to_string());
        }

        if transport == "Mock transport" {
            self.client = None;
            self.active_client_id = None;
            return Ok(session_from_payload(&payload, "Mock transport"));
        }

        let client_id = trimmed(&payload.client_id);
        let activity = build_activity(&payload);

        if self.active_client_id.as_deref() == Some(client_id.as_str()) {
            if let Some(client) = self.client.as_mut() {
                match client.set_activity(activity.clone()) {
                    Ok(()) => return Ok(session_from_payload(&payload, "Local IPC")),
                    Err(error) if payload.auto_reconnect => {
                        client
                            .reconnect()
                            .map_err(|_| "Discord IPC disconnected and reconnect failed. Open Discord desktop, then try again.".to_string())?;
                        client.set_activity(activity).map_err(|_| {
                            format!(
                                "Discord rejected the activity payload after reconnect: {error}"
                            )
                        })?;
                        return Ok(session_from_payload(&payload, "Local IPC"));
                    }
                    Err(error) => {
                        return Err(format!("Discord rejected the activity payload: {error}"));
                    }
                }
            }
        }

        let _ = self.stop();
        let mut client = DiscordIpcClient::new(client_id.as_str());
        client
            .connect()
            .map_err(|_| "Discord is not running or IPC is unavailable. Open Discord desktop, then try again.".to_string())?;
        client
            .set_activity(activity)
            .map_err(|error| format!("Discord rejected the activity payload: {error}"))?;

        self.active_client_id = Some(client_id);
        self.client = Some(client);
        Ok(session_from_payload(&payload, "Local IPC"))
    }

    fn stop(&mut self) -> PresenceSession {
        if let Some(client) = self.client.as_mut() {
            let _ = client.clear_activity();
            let _ = client.close();
        }
        self.client = None;
        self.active_client_id = None;

        stopped_session()
    }
}

fn trimmed(value: &str) -> String {
    value.trim().to_string()
}

fn validate_payload(payload: &PresencePayload) -> Result<(), String> {
    let client_id = payload.client_id.trim();

    if client_id.is_empty() {
        return Err("Client ID is required.".to_string());
    }

    if !client_id
        .chars()
        .all(|character| character.is_ascii_digit())
    {
        return Err("Client ID must be a numeric Discord application ID.".to_string());
    }

    if payload.details.trim().is_empty() {
        return Err("Details are required.".to_string());
    }

    if payload.state.trim().is_empty() {
        return Err("State is required.".to_string());
    }

    if payload.details.trim().chars().count() > 128 {
        return Err("Details must be 128 characters or fewer.".to_string());
    }

    if payload.state.trim().chars().count() > 128 {
        return Err("State must be 128 characters or fewer.".to_string());
    }

    if payload.show_buttons {
        for (label, url) in [
            (&payload.button_one_label, &payload.button_one_url),
            (&payload.button_two_label, &payload.button_two_url),
        ] {
            let label = label.trim();
            let url = url.trim();

            if label.is_empty() && url.is_empty() {
                continue;
            }

            if label.is_empty() || label.chars().count() > 32 {
                return Err("Button labels must be 1-32 characters when a URL is set.".to_string());
            }

            if !(url.starts_with("https://") || url.starts_with("http://")) {
                return Err("Button URLs must start with http:// or https://.".to_string());
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn start_presence(
    state: tauri::State<'_, PresenceState>,
    request: PresenceStartRequest,
) -> Result<PresenceSession, String> {
    state
        .lock()
        .map_err(|_| "Presence runtime is unavailable.".to_string())?
        .start(request.payload, request.transport.trim())
}

#[tauri::command]
pub fn stop_presence(state: tauri::State<'_, PresenceState>) -> PresenceSession {
    state
        .lock()
        .map(|mut runtime| runtime.stop())
        .unwrap_or_else(|_| stopped_session())
}

fn session_from_payload(payload: &PresencePayload, transport: &str) -> PresenceSession {
    PresenceSession {
        running: true,
        client_id: trimmed(&payload.client_id),
        details: trimmed(&payload.details),
        state: trimmed(&payload.state),
        activity_label: "Playing Presence Studio".to_string(),
        transport: transport.to_string(),
    }
}

fn stopped_session() -> PresenceSession {
    PresenceSession {
        running: false,
        client_id: String::new(),
        details: String::new(),
        state: String::new(),
        activity_label: "Presence stopped".to_string(),
        transport: "Idle".to_string(),
    }
}

fn build_activity(payload: &PresencePayload) -> activity::Activity<'static> {
    let mut assets = activity::Assets::new();
    let large_image_key = trimmed(&payload.large_image_key);
    let small_image_key = trimmed(&payload.small_image_key);

    if !large_image_key.is_empty() {
        assets = assets
            .large_image(large_image_key)
            .large_text("Presence Studio");
    }

    if !small_image_key.is_empty() {
        assets = assets.small_image(small_image_key).small_text("Custom RPC");
    }

    let mut next_activity = activity::Activity::new()
        .name("Presence Studio")
        .details(trimmed(&payload.details))
        .state(trimmed(&payload.state))
        .activity_type(activity::ActivityType::Playing)
        .assets(assets);

    if payload.show_buttons {
        let mut buttons = Vec::new();
        let button_one_label = trimmed(&payload.button_one_label);
        let button_one_url = trimmed(&payload.button_one_url);
        let button_two_label = trimmed(&payload.button_two_label);
        let button_two_url = trimmed(&payload.button_two_url);

        if is_valid_button(&button_one_label, &button_one_url) {
            buttons.push(activity::Button::new(button_one_label, button_one_url));
        }

        if is_valid_button(&button_two_label, &button_two_url) {
            buttons.push(activity::Button::new(button_two_label, button_two_url));
        }

        if !buttons.is_empty() {
            next_activity = next_activity.buttons(buttons);
        }
    }

    if payload.show_elapsed_time {
        next_activity = next_activity.timestamps(activity::Timestamps::new().start(now_millis()));
    }

    next_activity
}

fn is_valid_button(label: &str, url: &str) -> bool {
    !label.is_empty() && (url.starts_with("https://") || url.starts_with("http://"))
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_payload() -> PresencePayload {
        PresencePayload {
            client_id: "1249029374529826816".to_string(),
            details: "Building a portfolio project".to_string(),
            state: "Editing custom RPC".to_string(),
            large_image_key: "presence-studio".to_string(),
            small_image_key: "presence-studio-badge".to_string(),
            button_one_label: "GitHub".to_string(),
            button_one_url: "https://github.com/redca".to_string(),
            button_two_label: "Portfolio".to_string(),
            button_two_url: "https://redca.dev".to_string(),
            show_elapsed_time: true,
            show_buttons: true,
            auto_reconnect: true,
            start_minimized: false,
        }
    }

    #[test]
    fn start_presence_accepts_valid_safe_payload() {
        let mut runtime = PresenceRuntime::new();
        let session = runtime
            .start(valid_payload(), "Mock transport")
            .expect("valid payload should start");

        assert!(session.running);
        assert_eq!(session.client_id, "1249029374529826816");
        assert_eq!(session.details, "Building a portfolio project");
        assert_eq!(session.state, "Editing custom RPC");
        assert_eq!(session.activity_label, "Playing Presence Studio");
        assert_eq!(session.transport, "Mock transport");
    }

    #[test]
    fn start_presence_rejects_blank_client_id() {
        let mut payload = valid_payload();
        payload.client_id = "   ".to_string();

        let mut runtime = PresenceRuntime::new();
        let error = runtime
            .start(payload, "Mock transport")
            .expect_err("blank client id should fail");

        assert_eq!(error, "Client ID is required.");
    }

    #[test]
    fn start_presence_rejects_non_numeric_client_id() {
        let mut payload = valid_payload();
        payload.client_id = "not-a-discord-app".to_string();

        let mut runtime = PresenceRuntime::new();
        let error = runtime
            .start(payload, "Mock transport")
            .expect_err("non-numeric client id should fail");

        assert_eq!(error, "Client ID must be a numeric Discord application ID.");
    }

    #[test]
    fn start_presence_rejects_missing_details() {
        let mut payload = valid_payload();
        payload.details = String::new();

        let mut runtime = PresenceRuntime::new();
        let error = runtime
            .start(payload, "Mock transport")
            .expect_err("blank details should fail");

        assert_eq!(error, "Details are required.");
    }

    #[test]
    fn start_presence_rejects_invalid_button_url() {
        let mut payload = valid_payload();
        payload.button_one_url = "github.com/redca".to_string();

        let mut runtime = PresenceRuntime::new();
        let error = runtime
            .start(payload, "Mock transport")
            .expect_err("invalid url should fail");

        assert_eq!(error, "Button URLs must start with http:// or https://.");
    }

    #[test]
    fn activity_payload_includes_valid_buttons() {
        let activity = build_activity(&valid_payload());
        let json = serde_json::to_value(activity).expect("activity should serialize");
        let buttons = json
            .get("buttons")
            .and_then(|value| value.as_array())
            .expect("valid buttons should serialize");

        assert_eq!(buttons.len(), 2);
        assert_eq!(
            buttons[0].get("label").and_then(|value| value.as_str()),
            Some("GitHub")
        );
        assert_eq!(
            buttons[0].get("url").and_then(|value| value.as_str()),
            Some("https://github.com/redca")
        );
    }

    #[test]
    fn activity_payload_omits_buttons_when_disabled() {
        let mut payload = valid_payload();
        payload.show_buttons = false;
        payload.button_one_url = "not a url".to_string();

        validate_payload(&payload).expect("disabled buttons should skip button validation");

        let activity = build_activity(&payload);
        let json = serde_json::to_value(activity).expect("activity should serialize");

        assert!(json.get("buttons").is_none());
    }

    #[test]
    fn stop_presence_returns_idle_session() {
        let mut runtime = PresenceRuntime::new();
        let session = runtime.stop();

        assert!(!session.running);
        assert_eq!(session.activity_label, "Presence stopped");
        assert_eq!(session.transport, "Idle");
    }

    #[test]
    fn start_presence_rejects_disabled_transport() {
        let mut runtime = PresenceRuntime::new();

        let error = runtime
            .start(valid_payload(), "Disabled")
            .expect_err("disabled transport should fail");

        assert_eq!(error, "RPC transport is disabled in Settings.");
    }
}
