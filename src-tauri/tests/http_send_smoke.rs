use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;

use resource_tester_lib::{send, HttpSendRequest};

/// Minimal HTTP/1.1 server: accepts one connection, captures the raw request
/// (a GET ends with the blank line after the headers) and replies with a
/// canned JSON response.
fn spawn_one_shot_server(listener: TcpListener) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept failed");
        let mut received = Vec::new();
        let mut buffer = [0u8; 1024];
        loop {
            let read = stream.read(&mut buffer).expect("read failed");
            if read == 0 {
                break;
            }
            received.extend_from_slice(&buffer[..read]);
            if received.windows(4).any(|window| window == b"\r\n\r\n") {
                break;
            }
        }
        let body = r#"{"ok":true}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        stream.write_all(response.as_bytes()).expect("write failed");
        String::from_utf8_lossy(&received).to_string()
    })
}

#[tokio::test]
async fn http_send_round_trips_against_a_local_server() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind failed");
    let address = listener.local_addr().expect("no local addr");
    let server = spawn_one_shot_server(listener);

    let response = send(HttpSendRequest {
        method: "GET".to_string(),
        url: format!("http://{address}/ping"),
        headers: HashMap::from([(
            "x-test-header".to_string(),
            "walking-skeleton".to_string(),
        )]),
        skip_tls_verification: false,
    })
    .await
    .expect("http_send failed");

    let received = server.join().expect("server thread panicked").to_lowercase();
    assert!(
        received.starts_with("get /ping http/1.1"),
        "unexpected request line: {received}"
    );
    assert!(
        received.contains("x-test-header: walking-skeleton"),
        "custom header not forwarded: {received}"
    );

    assert_eq!(response.status, 200);
    assert_eq!(response.body, r#"{"ok":true}"#);
    assert_eq!(
        response.headers.get("content-type").map(String::as_str),
        Some("application/json")
    );
    assert!(response.duration_ms < 30_000);
}
