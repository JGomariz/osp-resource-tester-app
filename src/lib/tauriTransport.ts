import { invoke } from "@tauri-apps/api/core";
import type { HttpRequest, HttpResponse, Transport } from "../engine";

/**
 * Production Transport: forwards engine requests to the Rust `http_send`
 * command. The send flow slice wires this into the engine.
 */
export const tauriTransport: Transport = (request: HttpRequest) =>
  invoke<HttpResponse>("http_send", { request });
