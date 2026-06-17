use std::collections::HashMap;

use ql_instances::auth::{self, AccountData, AccountType};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};
use crate::state::AppState;

// ---------- Data types ----------

/// Serializable account info returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub access_token: Option<String>,
    pub uuid: String,
    pub username: String,
    pub nice_username: String,
    pub account_type: String,
    pub needs_refresh: bool,
}

impl From<AccountData> for AccountInfo {
    fn from(a: AccountData) -> Self {
        Self {
            access_token: a.access_token,
            uuid: a.uuid,
            username: a.username,
            nice_username: a.nice_username,
            account_type: a.account_type.to_string(),
            needs_refresh: a.needs_refresh,
        }
    }
}

/// Microsoft device code response for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MsDeviceCodeResponse {
    pub user_code: String,
    pub verification_uri: String,
    pub message: String,
    pub expires_in: isize,
}

/// Result of a login operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResult {
    pub account: AccountInfo,
    pub is_needs_otp: bool,
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn get_accounts() -> Result<HashMap<String, AccountInfo>, String> {
    // We need to read account info from the instances config and profiles.
    // The ql_instances crate uses the keyring for refresh tokens,
    // so we read the profiles.json for the list of accounts.
    let accounts_dir = ql_core::LAUNCHER_DIR.join("accounts");

    if !tokio::fs::try_exists(&accounts_dir)
        .await
        .unwrap_or(false)
    {
        return Ok(HashMap::new());
    }

    let mut accounts = HashMap::new();

    let mut entries = tokio::fs::read_dir(&accounts_dir)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(Ok(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }

        if let Ok(contents) = tokio::fs::read_to_string(&path).await {
            if let Ok(data) = serde_json::from_str::<AccountData>(&contents) {
                accounts.insert(
                    data.username.clone(),
                    AccountInfo::from(data),
                );
            }
        }
    }

    Ok(accounts)
}

/// Full Microsoft device code response stored for polling.
#[derive(Debug, Clone)]
struct StoredMsAuth {
    user_code: String,
    device_code: String,
    expires_in: isize,
}

#[tauri::command]
pub async fn login_microsoft(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<MsDeviceCodeResponse, String> {
    let auth_code = auth::ms::login_1_link()
        .await
        .map_err(|e| e.to_string())?;

    // Store the device_code keyed by user_code for later polling
    {
        let mut codes = state.ms_device_codes.lock().await;
        codes.insert(
            auth_code.user_code.clone(),
            auth_code.device_code.clone(),
        );
    }

    Ok(MsDeviceCodeResponse {
        user_code: auth_code.user_code,
        verification_uri: auth_code.verification_uri,
        message: auth_code.message,
        expires_in: auth_code.expires_in,
    })
}

#[tauri::command]
pub async fn poll_microsoft_login(
    app: AppHandle,
    state: State<'_, AppState>,
    user_code: String,
) -> Result<Option<AccountInfo>, String> {
    use ql_core::CLIENT;

    // Retrieve stored device_code
    let device_code = {
        let codes = state.ms_device_codes.lock().await;
        match codes.get(&user_code) {
            Some(code) => code.clone(),
            None => return Err("No active Microsoft login session found. Please start a new login.".to_string()),
        }
    };

    // Single poll attempt (frontend handles the interval)
    let code_resp = CLIENT
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", auth::ms::CLIENT_ID),
            ("scope", "XboxLive.signin offline_access"),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("device_code", &device_code),
        ])
        .send()
        .await
        .map_err(|e| format!("Microsoft auth request error: {e}"))?;

    match code_resp.status() {
        reqwest::StatusCode::BAD_REQUEST => {
            let txt = code_resp.text().await.unwrap_or_default();
            let error: serde_json::Value = serde_json::from_str(&txt).unwrap_or_default();
            let error_code = error["error"].as_str().unwrap_or("");
            match error_code {
                "authorization_declined" | "expired_token" | "invalid_grant" => {
                    // Clean up stored code
                    state.ms_device_codes.lock().await.remove(&user_code);
                    return Err("Microsoft auth was declined or expired. Please try again.".to_string());
                }
                _ => Ok(None), // Still pending
            }
        }
        reqwest::StatusCode::OK => {
            // Clean up stored code
            state.ms_device_codes.lock().await.remove(&user_code);

            let text = code_resp.text().await.map_err(|e| e.to_string())?;
            let response: auth::ms::AuthTokenResponse =
                serde_json::from_str(&text).map_err(|e| e.to_string())?;

            let (sender, receiver) = std::sync::mpsc::channel();

            let app_clone = app.clone();
            tokio::spawn(async move {
                while let Ok(progress) = receiver.recv() {
                    let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
                }
            });

            let account_data = auth::ms::login_3_xbox(response, Some(sender), true)
                .await
                .map_err(|e| e.to_string())?;

            // Save account to disk
            save_account_to_disk(&account_data).await?;

            Ok(Some(AccountInfo::from(account_data)))
        }
        code => Err(format!("Microsoft auth error: HTTP {code}")),
    }
}

#[tauri::command]
pub async fn login_offline(
    username: String,
) -> Result<AccountInfo, String> {
    if username.trim().is_empty() {
        return Err("Username cannot be empty".to_string());
    }

    let account = AccountData {
        access_token: None,
        uuid: format!(
            "{:08x}{:04x}{:04x}{:04x}{:012x}",
            0,
            0,
            0,
            2,
            // Simple hash of username for offline UUID
            simple_hash(&username)
        ),
        refresh_token: String::new(),
        needs_refresh: false,
        username: username.clone(),
        nice_username: username,
        account_type: AccountType::Microsoft, // Offline uses MS type internally
    };

    Ok(AccountInfo::from(account))
}

/// Save account data to disk helper.
async fn save_account_to_disk(account_data: &AccountData) -> Result<(), String> {
    let accounts_dir = ql_core::LAUNCHER_DIR.join("accounts");
    tokio::fs::create_dir_all(&accounts_dir)
        .await
        .map_err(|e| e.to_string())?;

    let account_path = accounts_dir.join(format!("{}.json", account_data.username));
    let json = serde_json::to_string_pretty(account_data).unwrap_or_default();
    tokio::fs::write(&account_path, json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn login_yggdrasil(
    username: String,
    password: String,
    auth_type: String,
    auth_url: Option<String>,
) -> Result<LoginResult, String> {
    let account_type = match auth_type.as_str() {
        "LittleSkin" => AccountType::LittleSkin,
        _ => AccountType::ElyBy,
    };

    let result = auth::yggdrasil::login_new(username, password, account_type)
        .await
        .map_err(|e| e.to_string())?;

    let type_str = account_type.to_string();

    match result {
        auth::alt::Account::Account(account_data) => {
            save_account_to_disk(&account_data).await?;

            Ok(LoginResult {
                account: AccountInfo::from(account_data),
                is_needs_otp: false,
            })
        }
        auth::alt::Account::NeedsOTP => Ok(LoginResult {
            account: AccountInfo {
                access_token: None,
                uuid: String::new(),
                username: String::new(),
                nice_username: String::new(),
                account_type: type_str,
                needs_refresh: false,
            },
            is_needs_otp: true,
        }),
    }
}

// login_littleskin merged into login_yggdrasil above (same logic, different AccountType)

// login_littleskin is now handled by login_yggdrasil with auth_type="LittleSkin"

#[tauri::command]
pub async fn logout_account(
    username: String,
    account_type: String,
) -> Result<(), String> {
    let account_type = match account_type.as_str() {
        "ElyBy" => AccountType::ElyBy,
        "LittleSkin" => AccountType::LittleSkin,
        _ => AccountType::Microsoft,
    };

    auth::logout(&username, account_type).map_err(|e| e.to_string())?;

    // Also remove the account JSON file if it exists
    let account_path = ql_core::LAUNCHER_DIR
        .join("accounts")
        .join(format!("{}.json", username));

    if tokio::fs::try_exists(&account_path)
        .await
        .unwrap_or(false)
    {
        tokio::fs::remove_file(&account_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn select_account(
    _username: String,
) -> Result<(), String> {
    // Account selection is handled client-side; this is a no-op on the backend.
    Ok(())
}

#[tauri::command]
pub async fn refresh_account(
    app: AppHandle,
    username: String,
    account_type: String,
) -> Result<AccountInfo, String> {
    let account_type = match account_type.as_str() {
        "ElyBy" => AccountType::ElyBy,
        "LittleSkin" => AccountType::LittleSkin,
        _ => AccountType::Microsoft,
    };

    let refresh_token = auth::read_refresh_token(&username, account_type)
        .map_err(|e| e.to_string())?;

    let account_data = match account_type {
        AccountType::Microsoft => {
            let (sender, receiver) = std::sync::mpsc::channel();

            let app_clone = app.clone();
            tokio::spawn(async move {
                while let Ok(progress) = receiver.recv() {
                    let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
                }
            });

            auth::ms::login_refresh(username, refresh_token, Some(sender))
                .await
                .map_err(|e| e.to_string())?
        }
        AccountType::ElyBy | AccountType::LittleSkin => {
            auth::yggdrasil::login_refresh(username, refresh_token, account_type)
                .await
                .map_err(|e| e.to_string())?
        }
    };

    // Save updated account data
    save_account_to_disk(&account_data).await?;

    Ok(AccountInfo::from(account_data))
}

// ---------- Helpers ----------

/// Simple hash function for generating offline UUIDs from usernames.
fn simple_hash(s: &str) -> u64 {
    let mut hash: u64 = 0;
    for c in s.chars() {
        hash = hash.wrapping_mul(31).wrapping_add(c as u64);
    }
    hash
}
