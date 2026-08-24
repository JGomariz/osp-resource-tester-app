import { invoke } from "@tauri-apps/api/core";
import type { HttpRequest, HttpResponse, Transport } from "../engine";
import { transportFailureFrom } from "../engine";

/**
 * Production Transport: forwards engine requests to the Rust `http_send`
 * command. A rejection is turned back into the engine's own failure type, so
 * the diagnosis reads the same facts whatever rejected.
 */
export const tauriTransport: Transport = async (request: HttpRequest) => {
  try {
    return await invoke<HttpResponse>("http_send", { request });
  } catch (rejection) {
    throw transportFailureFrom(rejection);
  }
};
