import { isPortalTargetAnchor } from "../../shared/portal-targets.js";

export const DEFAULT_PORTAL_URL = typeof window !== "undefined" && window.location.hostname.endsWith("github.io")
  ? "https://qinburi.github.io/-/"
  : "http://127.0.0.1:5173/app.html";

export function buildPortalUrl(baseUrl, target = {}, currentUrl = DEFAULT_PORTAL_URL) {
  const url = new URL(baseUrl || DEFAULT_PORTAL_URL, currentUrl);
  if (target.mode === "public") url.searchParams.set("portalMode", "public");
  else url.searchParams.delete("portalMode");
  url.hash = isPortalTargetAnchor(target.anchor) ? target.anchor : "";
  return url.href;
}
