export const PORTAL_TARGET_ANCHORS = Object.freeze([
  "docMatrix",
  "cases-section",
  "software-section",
  "saas-section",
  "scene-section",
  "hardware-section",
  "equipment-section",
  "renewalTodos"
]);

const portalTargetAnchorSet = new Set(PORTAL_TARGET_ANCHORS);

export function isPortalTargetAnchor(value) {
  return portalTargetAnchorSet.has(String(value || ""));
}
