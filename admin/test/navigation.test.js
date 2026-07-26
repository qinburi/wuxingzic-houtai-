import assert from "node:assert/strict";
import test from "node:test";
import { canAccessMenuItem, filterNavigationForUser, flattenNavigation, navigationGroups, sanitizeNavigationState } from "../src/navigation.js";

test("navigation ids are unique and every leaf belongs to one group", () => {
  const items = flattenNavigation();
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.ok(items.every((item) => item.groupId && item.module));
  for (const group of navigationGroups.filter((item) => !item.standalone)) {
    assert.deepEqual(group.columns.flatMap((column) => column.itemIds).sort(), group.children.map((item) => item.id).sort());
  }
});

test("administrator can see all menu groups", () => {
  const groups = filterNavigationForUser({ roleCodes: ["ASSET_ADMIN"], permissionCodes: [] });
  assert.deepEqual(groups.map((group) => group.id), navigationGroups.map((group) => group.id));
  assert.ok(flattenNavigation(groups).some((item) => item.id === "flow.navigator" && item.hiddenInMenu));
});

test("ip editor sees ip pages but not organization or system settings", () => {
  const user = { roleCodes: ["ASSET_EDITOR"], permissionCodes: ["IP_VIEW", "IP_EDIT"] };
  const items = flattenNavigation(filterNavigationForUser(user));
  assert.ok(items.some((item) => item.id === "ip.patents"));
  assert.ok(!items.some((item) => item.id === "organization.people"));
  assert.ok(!items.some((item) => item.id === "settings.storage"));
  assert.equal(canAccessMenuItem({ access: "logs" }, user), true);
});

test("asset scope codes only expose matching asset submenus", () => {
  const user = { roleCodes: ["ASSET_EDITOR"], permissionCodes: ["ASSET_EQUIPMENT"] };
  const ids = flattenNavigation(filterNavigationForUser(user)).map((item) => item.id);
  assert.ok(ids.includes("assets.hardware"));
  assert.ok(ids.includes("assets.equipment"));
  assert.ok(!ids.includes("assets.industry"));
  assert.ok(!ids.includes("documents.overview"));
});

test("state restoration removes inaccessible tabs without reopening a floating menu", () => {
  const groups = filterNavigationForUser({ roleCodes: ["ASSET_EDITOR"], permissionCodes: ["ASSET_INDUSTRY"] });
  const restored = sanitizeNavigationState({ activeId: "assets.case", expandedGroupId: "audit-system", tabs: ["assets.case", "settings.storage"] }, groups);
  assert.equal(restored.activeId, "assets.case");
  assert.equal(restored.expandedGroupId, "");
  assert.deepEqual(restored.tabs, ["dashboard", "assets.case"]);
});

test("invalid state falls back to dashboard", () => {
  const groups = filterNavigationForUser({ roleCodes: [], permissionCodes: [] });
  assert.deepEqual(sanitizeNavigationState({ activeId: "missing", tabs: ["missing"] }, groups), {
    activeId: "dashboard",
    tabs: ["dashboard"],
    expandedGroupId: ""
  });
});

test("flow navigator is restored for every authenticated user without becoming a sidebar group", () => {
  const groups = filterNavigationForUser({ roleCodes: [], permissionCodes: [] });
  const restored = sanitizeNavigationState({ activeId: "flow.navigator", tabs: ["flow.navigator"] }, groups);
  assert.equal(restored.activeId, "flow.navigator");
  assert.deepEqual(restored.tabs, ["dashboard", "flow.navigator"]);
  assert.equal(groups.find((group) => group.id === "home").children[0].id, "dashboard");
});
