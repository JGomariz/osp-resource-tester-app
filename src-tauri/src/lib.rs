use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub skip_tls_verification: bool,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub duration_ms: u64,
}

/// Performs an HTTP request on behalf of the frontend. Pure transport: no
/// domain logic lives here — the TypeScript engine decides what to send.
/// Public so the smoke test can round-trip it; the Tauri command below is a
/// private delegate (a `pub` command at the crate root trips E0255 via the
/// `#[macro_export]` that `#[tauri::command]` adds for public functions).
pub async fn send(request: HttpSendRequest) -> Result<HttpSendResponse, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(request.skip_tls_verification)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?;

    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| format!("invalid HTTP method: {}", request.method))?;

    let mut builder = client.request(method, &request.url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }

    let started = Instant::now();
    let response = builder.send().await.map_err(|error| error.to_string())?;

    let status = response.status().as_u16();
    let mut headers: HashMap<String, String> = HashMap::new();
    for (name, value) in response.headers() {
        let value = String::from_utf8_lossy(value.as_bytes());
        let entry = headers.entry(name.to_string()).or_default();
        if !entry.is_empty() {
            entry.push_str(", ");
        }
        entry.push_str(&value);
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    let duration_ms = started.elapsed().as_millis() as u64;

    Ok(HttpSendResponse {
        status,
        headers,
        body,
        duration_ms,
    })
}

#[tauri::command]
async fn http_send(request: HttpSendRequest) -> Result<HttpSendResponse, String> {
    send(request).await
}

/// Name of the Catalog inside the app's config directory. The frontend never
/// builds this path itself — only the OS knows where the directory is.
const CATALOG_FILE: &str = "catalog.json";

/// Absolute path of the user-editable Catalog. Resolving it is all this does:
/// whether the file should be created, read or ignored is the engine's call.
fn catalog_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;

    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("no se pudo resolver la carpeta de configuración: {error}"))?;
    Ok(directory.join(CATALOG_FILE))
}

#[tauri::command]
fn catalog_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(catalog_file(&app)?.to_string_lossy().into_owned())
}

/// The Catalog's contents, or `None` when the file is not there — which the
/// engine reads as a first run. Only a genuine failure is an error: "missing"
/// is an ordinary answer, and must not be reported as one.
#[tauri::command]
fn catalog_read(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = catalog_file(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn catalog_write(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let path = catalog_file(&app)?;
    if let Some(directory) = path.parent() {
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    }
    std::fs::write(&path, contents).map_err(|error| error.to_string())
}

/// Opens the Catalog in the OS file manager, selecting it where the platform
/// can, so the user lands on the file rather than in a hidden directory.
#[tauri::command]
fn catalog_reveal(app: tauri::AppHandle) -> Result<(), String> {
    let path = catalog_file(&app)?;
    let exists = path.exists();
    // With no file to select there is still a directory worth opening — after
    // a failed first-run write, that is exactly where the user needs to look.
    let target = if exists {
        path.clone()
    } else {
        path.parent().unwrap_or(&path).to_path_buf()
    };

    let mut command = reveal_command(&target, exists);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("no se pudo abrir {}: {error}", target.display()))
}

fn reveal_command(target: &std::path::Path, select: bool) -> std::process::Command {
    if cfg!(target_os = "macos") {
        let mut command = std::process::Command::new("open");
        if select {
            command.arg("-R");
        }
        command.arg(target);
        command
    } else if cfg!(target_os = "windows") {
        let mut command = std::process::Command::new("explorer");
        if select {
            command.arg(format!("/select,{}", target.display()));
        } else {
            command.arg(target);
        }
        command
    } else {
        let mut command = std::process::Command::new("xdg-open");
        command.arg(target);
        command
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The frontend speaks camelCase JSON; a casing drift in the serde
    // attributes would only surface at runtime inside the webview, so both
    // directions are pinned here against the TypeScript field names.
    #[test]
    fn request_deserializes_from_frontend_camel_case_json() {
        let request: HttpSendRequest = serde_json::from_str(
            r#"{"method":"GET","url":"http://localhost/ping","headers":{"accept":"application/json"},"skipTlsVerification":true}"#,
        )
        .expect("request JSON should deserialize");

        assert_eq!(request.method, "GET");
        assert_eq!(request.url, "http://localhost/ping");
        assert!(request.skip_tls_verification);
        assert_eq!(
            request.headers.get("accept").map(String::as_str),
            Some("application/json")
        );
    }

    #[test]
    fn response_serializes_to_frontend_camel_case_json() {
        let response = HttpSendResponse {
            status: 200,
            headers: HashMap::from([("content-type".to_string(), "text/plain".to_string())]),
            body: "ok".to_string(),
            duration_ms: 7,
        };

        let json = serde_json::to_value(&response).expect("response should serialize");

        assert_eq!(json["status"], 200);
        assert_eq!(json["headers"]["content-type"], "text/plain");
        assert_eq!(json["body"], "ok");
        assert_eq!(json["durationMs"], 7);
    }

    fn spawned(command: &std::process::Command) -> (String, Vec<String>) {
        (
            command.get_program().to_string_lossy().into_owned(),
            command
                .get_args()
                .map(|arg| arg.to_string_lossy().into_owned())
                .collect(),
        )
    }

    // Selecting the file rather than dumping the user in the directory is the
    // whole point of "Abrir catálogo", and the flag differs per platform.
    #[test]
    fn reveal_selects_the_catalog_when_it_is_there() {
        let path = std::path::Path::new("/tmp/rt/catalog.json");
        let (program, args) = spawned(&reveal_command(path, true));

        if cfg!(target_os = "macos") {
            assert_eq!(program, "open");
            assert_eq!(args, ["-R", "/tmp/rt/catalog.json"]);
        } else if cfg!(target_os = "windows") {
            assert_eq!(program, "explorer");
            assert_eq!(args, ["/select,/tmp/rt/catalog.json"]);
        } else {
            assert_eq!(program, "xdg-open");
            assert_eq!(args, ["/tmp/rt/catalog.json"]);
        }
    }

    #[test]
    fn reveal_opens_the_directory_when_there_is_no_file_to_select() {
        let path = std::path::Path::new("/tmp/rt");
        let (_, args) = spawned(&reveal_command(path, false));

        assert_eq!(args, ["/tmp/rt"]);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            http_send,
            catalog_path,
            catalog_read,
            catalog_write,
            catalog_reveal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
