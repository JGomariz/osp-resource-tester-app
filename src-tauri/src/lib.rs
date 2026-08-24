use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How long a request gets before it is cut off. The engine names this figure
/// in the Spanish timeout message (`TIMEOUT_SECONDS` in
/// `src/engine/networkError.ts`); nothing enforces the pair, so change both.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

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

/// A request that never got an answer, described for the engine to classify.
/// Deciding *which* failure this is, and what to tell the user about it, is
/// the engine's job; this layer only makes sure nothing it needs is lost.
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSendError {
    /// `reqwest`'s own verdict — the one thing the engine cannot work out from
    /// the text, since a timeout and a dropped connection read alike.
    pub timed_out: bool,
    /// The error and every cause beneath it, joined.
    pub detail: String,
}

impl HttpSendError {
    fn from_reqwest(error: reqwest::Error) -> Self {
        Self {
            timed_out: error.is_timeout(),
            detail: describe(&error),
        }
    }

    /// A failure raised here rather than by `reqwest`, so never a timeout.
    fn plain(detail: String) -> Self {
        Self {
            timed_out: false,
            detail,
        }
    }
}

/// Joins an error with every cause under it. `reqwest`'s own `Display` stops
/// at the top — "error sending request for url (…)" — which names no cause at
/// all, and the cause is exactly what tells DNS from refused from TLS.
fn describe(error: &(dyn std::error::Error + 'static)) -> String {
    let mut parts = vec![error.to_string()];
    let mut cause = error.source();
    while let Some(inner) = cause {
        parts.push(inner.to_string());
        cause = inner.source();
    }
    parts.join(": ")
}

/// Performs an HTTP request on behalf of the frontend. Pure transport: no
/// domain logic lives here — the TypeScript engine decides what to send.
/// Public so the smoke test can round-trip it; the Tauri command below is a
/// private delegate (a `pub` command at the crate root trips E0255 via the
/// `#[macro_export]` that `#[tauri::command]` adds for public functions).
pub async fn send(request: HttpSendRequest) -> Result<HttpSendResponse, HttpSendError> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(request.skip_tls_verification)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(HttpSendError::from_reqwest)?;

    let method = reqwest::Method::from_bytes(request.method.as_bytes())
        .map_err(|_| HttpSendError::plain(format!("invalid HTTP method: {}", request.method)))?;

    let mut builder = client.request(method, &request.url);
    for (name, value) in &request.headers {
        builder = builder.header(name, value);
    }

    let started = Instant::now();
    let response = builder.send().await.map_err(HttpSendError::from_reqwest)?;

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

    let body = response.text().await.map_err(HttpSendError::from_reqwest)?;
    let duration_ms = started.elapsed().as_millis() as u64;

    Ok(HttpSendResponse {
        status,
        headers,
        body,
        duration_ms,
    })
}

#[tauri::command]
async fn http_send(request: HttpSendRequest) -> Result<HttpSendResponse, HttpSendError> {
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

    #[test]
    fn error_serializes_to_frontend_camel_case_json() {
        let error = HttpSendError {
            timed_out: true,
            detail: "error sending request: operation timed out".to_string(),
        };

        let json = serde_json::to_value(&error).expect("error should serialize");

        assert_eq!(json["timedOut"], true);
        assert_eq!(json["detail"], "error sending request: operation timed out");
    }

    /// An error with a cause under it, to exercise the chain walk.
    #[derive(Debug)]
    struct Layer(&'static str, Option<Box<Layer>>);

    impl std::fmt::Display for Layer {
        fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str(self.0)
        }
    }

    impl std::error::Error for Layer {
        fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
            self.1
                .as_ref()
                .map(|inner| inner.as_ref() as &(dyn std::error::Error + 'static))
        }
    }

    // The engine tells DNS from refused from TLS by reading this string, and
    // every one of those words lives in a cause, not in the top-level message.
    #[test]
    fn describe_keeps_every_cause_under_the_error() {
        let error = Layer(
            "error sending request for url (https://zuul-uat.int.si.orange.es:9061/lines)",
            Some(Box::new(Layer(
                "tcp connect error",
                Some(Box::new(Layer("Connection refused (os error 61)", None))),
            ))),
        );

        assert_eq!(
            describe(&error),
            "error sending request for url (https://zuul-uat.int.si.orange.es:9061/lines): tcp connect error: Connection refused (os error 61)"
        );
    }

    #[test]
    fn describe_handles_an_error_with_no_cause() {
        assert_eq!(describe(&Layer("builder error", None)), "builder error");
    }

    #[test]
    fn a_failure_raised_here_is_never_reported_as_a_timeout() {
        let error = HttpSendError::plain("invalid HTTP method: GO".to_string());

        assert!(!error.timed_out);
        assert_eq!(error.detail, "invalid HTTP method: GO");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![http_send])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
