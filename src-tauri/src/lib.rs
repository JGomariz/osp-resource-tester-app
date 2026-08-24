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
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![http_send])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
