use crate::presence::PresencePayload;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

const SUPPORTED_TRANSPORTS: [&str; 3] = ["Local IPC", "Mock transport", "Disabled"];

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PresenceProfile {
    pub id: String,
    pub name: String,
    pub updated_at: String,
    pub payload: PresencePayload,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetItem {
    pub id: String,
    pub key: String,
    pub kind: String,
    pub tone: String,
    pub preview_data_url: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StudioSettings {
    pub launch_at_login: bool,
    pub minimize_to_tray: bool,
    pub show_notifications: bool,
    pub developer_mode: bool,
    pub rpc_transport: String,
    pub preview_username: String,
    pub preview_avatar_data_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StudioStore {
    profiles: Vec<PresenceProfile>,
    assets: Vec<AssetItem>,
    settings: StudioSettings,
    storage_path: Option<PathBuf>,
}

pub type StudioState = Mutex<StudioStore>;

impl Default for StudioStore {
    fn default() -> Self {
        Self {
            profiles: vec![
                PresenceProfile {
                    id: "profile-coding".to_string(),
                    name: "Coding Portfolio".to_string(),
                    updated_at: "Today".to_string(),
                    payload: seed_payload(
                        "Building a portfolio project",
                        "Editing custom RPC",
                        "presence-studio",
                        "presence-studio-badge",
                    ),
                },
                PresenceProfile {
                    id: "profile-gaming".to_string(),
                    name: "Gaming Night".to_string(),
                    updated_at: "Yesterday".to_string(),
                    payload: seed_payload(
                        "Tuning the neon loadout",
                        "Queueing ranked ideas",
                        "arena-core",
                        "party",
                    ),
                },
                PresenceProfile {
                    id: "profile-watching".to_string(),
                    name: "Watch Mode".to_string(),
                    updated_at: "2 days ago".to_string(),
                    payload: seed_payload(
                        "Watching release notes",
                        "Collecting inspiration",
                        "cinema-mode",
                        "spark",
                    ),
                },
            ],
            assets: vec![
                AssetItem {
                    id: "asset-presence-studio".to_string(),
                    key: "presence-studio".to_string(),
                    kind: "Large image".to_string(),
                    tone: "Purple core".to_string(),
                    preview_data_url: Some("/rpc/presence-studio.png".to_string()),
                },
                AssetItem {
                    id: "asset-presence-studio-badge".to_string(),
                    key: "presence-studio-badge".to_string(),
                    kind: "Small image".to_string(),
                    tone: "Violet badge".to_string(),
                    preview_data_url: Some("/rpc/presence-studio-badge.png".to_string()),
                },
                AssetItem {
                    id: "asset-arena-core".to_string(),
                    key: "arena-core".to_string(),
                    kind: "Large image".to_string(),
                    tone: "Indigo arena".to_string(),
                    preview_data_url: None,
                },
                AssetItem {
                    id: "asset-spark".to_string(),
                    key: "spark".to_string(),
                    kind: "Small image".to_string(),
                    tone: "Violet spark".to_string(),
                    preview_data_url: None,
                },
            ],
            settings: StudioSettings {
                launch_at_login: false,
                minimize_to_tray: true,
                show_notifications: true,
                developer_mode: false,
                rpc_transport: "Local IPC".to_string(),
                preview_username: "redca".to_string(),
                preview_avatar_data_url: None,
            },
            storage_path: None,
        }
    }
}

impl StudioStore {
    pub fn load_or_default(storage_path: PathBuf) -> Self {
        let mut store = fs::read_to_string(&storage_path)
            .ok()
            .and_then(|contents| serde_json::from_str::<PersistedStudioStore>(&contents).ok())
            .map(StudioStore::from_persisted)
            .unwrap_or_default();

        store.storage_path = Some(storage_path);
        store
    }

    pub fn list_profiles(&self) -> Vec<PresenceProfile> {
        self.profiles.clone()
    }

    pub fn save_profile(
        &mut self,
        id: Option<String>,
        name: String,
        payload: PresencePayload,
    ) -> Result<PresenceProfile, String> {
        let name = name.trim().to_string();

        if name.is_empty() {
            return Err("Profile name is required.".to_string());
        }

        let profile = PresenceProfile {
            id: id.unwrap_or_else(|| format!("profile-{}", slugify(&name))),
            name,
            updated_at: now_label(),
            payload,
        };

        if let Some(index) = self
            .profiles
            .iter()
            .position(|existing| existing.id == profile.id)
        {
            self.profiles[index] = profile.clone();
        } else {
            self.profiles.insert(0, profile.clone());
        }

        self.persist()?;
        Ok(profile)
    }

    pub fn delete_profile(&mut self, id: String) -> Result<(), String> {
        let original_len = self.profiles.len();
        self.profiles.retain(|profile| profile.id != id);

        if self.profiles.len() == original_len {
            return Err("Profile was not found.".to_string());
        }

        self.persist()
    }

    pub fn list_assets(&self) -> Vec<AssetItem> {
        self.assets.clone()
    }

    pub fn add_asset(
        &mut self,
        key: String,
        kind: String,
        preview_data_url: Option<String>,
    ) -> Result<AssetItem, String> {
        let key = slugify(&key);
        let kind = kind.trim().to_string();
        let preview_data_url = preview_data_url.filter(|value| value.starts_with("data:image/"));

        if key.is_empty() {
            return Err("Asset key is required.".to_string());
        }

        let asset = AssetItem {
            id: format!("asset-{}", key),
            key,
            kind: if kind.is_empty() {
                "Large image".to_string()
            } else {
                kind
            },
            tone: "Custom glow".to_string(),
            preview_data_url,
        };

        self.assets.retain(|existing| existing.key != asset.key);
        self.assets.insert(0, asset.clone());
        self.persist()?;
        Ok(asset)
    }

    pub fn delete_asset(&mut self, id: String) -> Result<(), String> {
        let original_len = self.assets.len();
        self.assets.retain(|asset| asset.id != id);

        if self.assets.len() == original_len {
            return Err("Asset was not found.".to_string());
        }

        self.persist()
    }

    pub fn get_settings(&self) -> StudioSettings {
        self.settings.clone()
    }

    pub fn save_settings(&mut self, settings: StudioSettings) -> Result<StudioSettings, String> {
        self.settings = sanitize_settings(settings)?;
        self.persist()?;
        Ok(self.settings.clone())
    }

    fn persist(&self) -> Result<(), String> {
        let Some(storage_path) = &self.storage_path else {
            return Ok(());
        };

        if let Some(parent) = storage_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| "Could not create app data folder.".to_string())?;
        }

        let contents = serde_json::to_string_pretty(&PersistedStudioStore::from(self))
            .map_err(|_| "Could not serialize studio data.".to_string())?;
        fs::write(storage_path, contents).map_err(|_| "Could not save studio data.".to_string())
    }
}

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct PersistedStudioStore {
    profiles: Vec<PresenceProfile>,
    assets: Vec<AssetItem>,
    settings: StudioSettings,
}

impl From<&StudioStore> for PersistedStudioStore {
    fn from(store: &StudioStore) -> Self {
        Self {
            profiles: store.profiles.clone(),
            assets: store.assets.clone(),
            settings: store.settings.clone(),
        }
    }
}

impl StudioStore {
    fn from_persisted(persisted: PersistedStudioStore) -> Self {
        Self {
            profiles: if persisted.profiles.is_empty() {
                StudioStore::default().profiles
            } else {
                persisted.profiles
            },
            assets: if persisted.assets.is_empty() {
                StudioStore::default().assets
            } else {
                persisted.assets
            },
            settings: sanitize_settings(persisted.settings)
                .unwrap_or_else(|_| StudioStore::default().settings),
            storage_path: None,
        }
    }
}

fn sanitize_settings(mut settings: StudioSettings) -> Result<StudioSettings, String> {
    settings.rpc_transport = settings.rpc_transport.trim().to_string();
    settings.preview_username = settings.preview_username.trim().to_string();

    if !SUPPORTED_TRANSPORTS.contains(&settings.rpc_transport.as_str()) {
        return Err("RPC transport is not supported.".to_string());
    }

    if settings.preview_username.is_empty() {
        settings.preview_username = StudioStore::default().settings.preview_username;
    }

    if settings
        .preview_avatar_data_url
        .as_ref()
        .is_some_and(|value| !value.starts_with("data:image/"))
    {
        settings.preview_avatar_data_url = None;
    }

    Ok(settings)
}

fn seed_payload(
    details: &str,
    state: &str,
    large_image_key: &str,
    small_image_key: &str,
) -> PresencePayload {
    PresencePayload {
        client_id: "1249029374529826816".to_string(),
        details: details.to_string(),
        state: state.to_string(),
        large_image_key: large_image_key.to_string(),
        small_image_key: small_image_key.to_string(),
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

fn slugify(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn now_label() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    format!("Saved {seconds}")
}

#[tauri::command]
pub fn list_profiles(state: tauri::State<'_, StudioState>) -> Result<Vec<PresenceProfile>, String> {
    state
        .lock()
        .map(|store| store.list_profiles())
        .map_err(|_| "Studio store is unavailable.".to_string())
}

#[tauri::command]
pub fn save_profile(
    state: tauri::State<'_, StudioState>,
    id: Option<String>,
    name: String,
    payload: PresencePayload,
) -> Result<PresenceProfile, String> {
    state
        .lock()
        .map_err(|_| "Studio store is unavailable.".to_string())?
        .save_profile(id, name, payload)
}

#[tauri::command]
pub fn delete_profile(state: tauri::State<'_, StudioState>, id: String) -> Result<(), String> {
    state
        .lock()
        .map_err(|_| "Studio store is unavailable.".to_string())?
        .delete_profile(id)
}

#[tauri::command]
pub fn list_assets(state: tauri::State<'_, StudioState>) -> Result<Vec<AssetItem>, String> {
    state
        .lock()
        .map(|store| store.list_assets())
        .map_err(|_| "Studio store is unavailable.".to_string())
}

#[tauri::command]
pub fn add_asset(
    state: tauri::State<'_, StudioState>,
    key: String,
    kind: String,
    preview_data_url: Option<String>,
) -> Result<AssetItem, String> {
    state
        .lock()
        .map_err(|_| "Studio store is unavailable.".to_string())?
        .add_asset(key, kind, preview_data_url)
}

#[tauri::command]
pub fn delete_asset(state: tauri::State<'_, StudioState>, id: String) -> Result<(), String> {
    state
        .lock()
        .map_err(|_| "Studio store is unavailable.".to_string())?
        .delete_asset(id)
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, StudioState>) -> Result<StudioSettings, String> {
    state
        .lock()
        .map(|store| store.get_settings())
        .map_err(|_| "Studio store is unavailable.".to_string())
}

#[tauri::command]
pub fn save_settings(
    state: tauri::State<'_, StudioState>,
    settings: StudioSettings,
) -> Result<StudioSettings, String> {
    state
        .lock()
        .map_err(|_| "Studio store is unavailable.".to_string())?
        .save_settings(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(details: &str) -> PresencePayload {
        PresencePayload {
            client_id: "1249029374529826816".to_string(),
            details: details.to_string(),
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
    fn default_store_contains_profiles_assets_and_settings() {
        let store = StudioStore::default();

        assert_eq!(store.list_profiles().len(), 3);
        assert_eq!(store.list_assets().len(), 4);
        assert_eq!(store.get_settings().rpc_transport, "Local IPC");
    }

    #[test]
    fn save_profile_creates_new_profile_with_trimmed_name() {
        let mut store = StudioStore::default();

        let saved = store
            .save_profile(
                None,
                "  Portfolio Launch  ".to_string(),
                payload("Launching work"),
            )
            .expect("profile should save");

        assert_eq!(saved.name, "Portfolio Launch");
        assert_eq!(saved.payload.details, "Launching work");
        assert!(store
            .list_profiles()
            .iter()
            .any(|profile| profile.id == saved.id));
    }

    #[test]
    fn save_profile_updates_existing_profile() {
        let mut store = StudioStore::default();
        let existing_id = store.list_profiles()[0].id.clone();

        let saved = store
            .save_profile(
                Some(existing_id.clone()),
                "Updated Coding".to_string(),
                payload("Refactoring panels"),
            )
            .expect("profile should update");

        assert_eq!(saved.id, existing_id);
        assert_eq!(saved.name, "Updated Coding");
        assert_eq!(
            store.list_profiles()[0].payload.details,
            "Refactoring panels"
        );
    }

    #[test]
    fn save_profile_rejects_blank_name() {
        let mut store = StudioStore::default();

        let error = store
            .save_profile(None, " ".to_string(), payload("Invalid"))
            .expect_err("blank profile name should fail");

        assert_eq!(error, "Profile name is required.");
    }

    #[test]
    fn delete_profile_removes_existing_profile() {
        let mut store = StudioStore::default();
        let existing_id = store.list_profiles()[0].id.clone();

        store
            .delete_profile(existing_id.clone())
            .expect("profile should delete");

        assert!(!store
            .list_profiles()
            .iter()
            .any(|profile| profile.id == existing_id));
    }

    #[test]
    fn add_asset_creates_sanitized_asset_key() {
        let mut store = StudioStore::default();

        let asset = store
            .add_asset(" Neon Pulse ".to_string(), "Large image".to_string(), None)
            .expect("asset should save");

        assert_eq!(asset.key, "neon-pulse");
        assert_eq!(asset.kind, "Large image");
        assert!(store.list_assets().iter().any(|item| item.id == asset.id));
    }

    #[test]
    fn add_asset_updates_existing_asset_key_without_duplicates() {
        let mut store = StudioStore::default();

        store
            .add_asset("Neon Pulse".to_string(), "Large image".to_string(), None)
            .expect("asset should save");
        let updated = store
            .add_asset(
                " neon-pulse ".to_string(),
                "Small image".to_string(),
                Some("data:image/png;base64,abc".to_string()),
            )
            .expect("asset should update");

        let matching_assets = store
            .list_assets()
            .into_iter()
            .filter(|asset| asset.key == "neon-pulse")
            .collect::<Vec<_>>();

        assert_eq!(matching_assets.len(), 1);
        assert_eq!(updated.kind, "Small image");
        assert_eq!(
            matching_assets[0].preview_data_url,
            Some("data:image/png;base64,abc".to_string())
        );
    }

    #[test]
    fn save_settings_persists_settings() {
        let mut store = StudioStore::default();
        let settings = StudioSettings {
            launch_at_login: true,
            minimize_to_tray: true,
            show_notifications: false,
            developer_mode: true,
            rpc_transport: "Mock transport".to_string(),
            preview_username: "redca".to_string(),
            preview_avatar_data_url: None,
        };

        let saved = store
            .save_settings(settings.clone())
            .expect("settings should persist");

        assert_eq!(saved, settings);
        assert_eq!(store.get_settings(), settings);
    }

    #[test]
    fn save_settings_rejects_unknown_transport() {
        let mut store = StudioStore::default();
        let settings = StudioSettings {
            launch_at_login: false,
            minimize_to_tray: true,
            show_notifications: true,
            developer_mode: false,
            rpc_transport: "Unsafe token bridge".to_string(),
            preview_username: "redca".to_string(),
            preview_avatar_data_url: None,
        };

        let error = store
            .save_settings(settings)
            .expect_err("unknown transport should fail");

        assert_eq!(error, "RPC transport is not supported.");
        assert_eq!(store.get_settings().rpc_transport, "Local IPC");
    }

    #[test]
    fn delete_asset_removes_existing_asset() {
        let mut store = StudioStore::default();
        let existing_id = store.list_assets()[0].id.clone();

        store
            .delete_asset(existing_id.clone())
            .expect("asset should delete");

        assert!(!store
            .list_assets()
            .iter()
            .any(|asset| asset.id == existing_id));
    }

    #[test]
    fn load_or_default_uses_persisted_store() {
        let mut path = std::env::temp_dir();
        path.push(format!("presence-studio-test-{}.json", now_label()));
        let mut store = StudioStore::load_or_default(path.clone());
        store
            .save_profile(None, "Persist Me".to_string(), payload("Stored on disk"))
            .expect("profile should save");

        let reloaded = StudioStore::load_or_default(path.clone());
        let _ = fs::remove_file(path);

        assert!(reloaded
            .list_profiles()
            .iter()
            .any(|profile| profile.name == "Persist Me"));
    }
}
