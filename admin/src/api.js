import { demoDownload, demoRequest } from "./demo-api.js";

const configuredBaseUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const demoRequested = new URLSearchParams(window.location.search).get("demo") === "1";
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true" || demoRequested || (!configuredBaseUrl && window.location.hostname.endsWith("github.io"));
const baseUrl = configuredBaseUrl || "http://127.0.0.1:3100/api";

export function getToken() {
  return sessionStorage.getItem("hannao_admin_token") || "";
}

export function setToken(token) {
  if (token) sessionStorage.setItem("hannao_admin_token", token);
  else sessionStorage.removeItem("hannao_admin_token");
}

export async function api(path, options = {}) {
  if (isDemoMode) return demoRequest(path, options);
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (getToken()) headers.set("Authorization", `Bearer ${getToken()}`);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(result?.message || result?.error || String(result) || "请求失败");
    error.status = response.status;
    throw error;
  }
  return result;
}

export function post(path, body) {
  return api(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body || {}) });
}

export function patch(path, body) {
  return api(path, { method: "PATCH", body: JSON.stringify(body || {}) });
}

export function remove(path) {
  return api(path, { method: "DELETE" });
}

export async function download(path, filename) {
  if (isDemoMode) {
    const blob = await demoDownload(path);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const headers = new Headers();
  if (getToken()) headers.set("Authorization", `Bearer ${getToken()}`);
  const response = await fetch(`${baseUrl}${path}`, { headers });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "文件下载失败");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
