const assetChildren = [
  ["assets.overview", "资产总览", "Boxes"],
  ["assets.case", "案例资产", "FileText", "case"],
  ["assets.industry", "行业内容", "Building2", "industry"],
  ["assets.platform", "核心平台", "Monitor", "platform"],
  ["assets.software", "产品矩阵", "PanelTop", "software"],
  ["assets.saas", "SaaS应用", "Server", "saas"],
  ["assets.scene", "场景运营库", "Activity", "scene"],
  ["assets.hardware", "智能硬件", "Cable", "hardware"],
  ["assets.equipment", "智能设备", "Workflow", "equipment"]
].map(([id, label, icon, assetType]) => ({ id, label, icon, module: "assets", assetType, access: "asset" }));

export const navigationGroups = [
  {
    id: "home",
    label: "工作台",
    icon: "LayoutDashboard",
    standalone: true,
    children: [
      { id: "dashboard", label: "工作台", icon: "LayoutDashboard", module: "dashboard", access: "all" },
      { id: "flow.navigator", label: "导航流程", icon: "Workflow", module: "flow", access: "all", hiddenInMenu: true }
    ]
  },
  { id: "asset-management", label: "资产管理", icon: "Boxes", children: assetChildren },
  {
    id: "intellectual-property",
    label: "知识产权",
    icon: "Scale",
    children: [
      ["ip.overview", "知识产权总览", "Scale", "overview"],
      ["ip.patents", "专利台账", "FileText", "patents"],
      ["ip.copyrights", "软著台账", "Copyright", "copyrights"],
      ["ip.deadlines", "期限与年费", "Clock3", "deadlines", "ip-reminders"],
      ["ip.versions", "版本记录", "History", "versions"],
      ["ip.relations", "关联资产", "Link2", "relations"],
      ["ip.migration", "待确认绑定", "AlertTriangle", "migration", "ip-migration"]
    ].map(([id, label, icon, section, badge]) => ({ id, label, icon, module: "ip", section, badge, access: "ip" }))
  },
  {
    id: "document-archive",
    label: "资料档案",
    icon: "FolderArchive",
    children: [
      { id: "documents.overview", label: "资料总览", icon: "FolderArchive", module: "documents", assetType: "document", access: "document" },
      { id: "documents.marketing", label: "宣传资料", icon: "FileText", module: "documents", assetType: "document", categories: ["宣传资料"], access: "document" },
      { id: "documents.corporate", label: "企业档案", icon: "Building2", module: "documents", assetType: "document", categories: ["企业档案"], access: "document" },
      { id: "documents.files", label: "文件中心", icon: "Paperclip", module: "documents", assetType: "document", filesOnly: true, access: "document" }
    ]
  },
  {
    id: "governance-operations",
    label: "治理运营",
    icon: "Gauge",
    children: [
      { id: "governance.overview", label: "治理总览", icon: "Gauge", module: "governance", assetType: "governance", access: "governance" },
      { id: "governance.cost", label: "投入成本", icon: "Database", module: "governance", assetType: "governance", categories: ["投入成本"], access: "governance" },
      { id: "governance.lifecycle", label: "生命周期", icon: "History", module: "governance", assetType: "governance", categories: ["生命周期"], access: "governance" },
      { id: "governance.utilization", label: "利用率与闲置", icon: "Activity", module: "governance", assetType: "governance", categories: ["利用率与闲置"], access: "governance" },
      { id: "governance.renewal", label: "续费管理", icon: "RefreshCw", module: "governance", assetType: "governance", categories: ["续费管理"], access: "governance" }
    ]
  },
  {
    id: "publishing-display",
    label: "发布与展示",
    icon: "PanelTop",
    children: [
      { id: "display.config", label: "首页展示配置", icon: "PanelTop", module: "display", access: "display" },
      { id: "workflow.reviews", label: "内容审核", icon: "GitPullRequest", module: "workflow", section: "reviews", badge: "reviews", access: "review" },
      { id: "workflow.releases", label: "发布版本", icon: "Send", module: "workflow", section: "releases", access: "publish" }
    ]
  },
  {
    id: "organization-permissions",
    label: "组织与权限",
    icon: "Users",
    children: [
      { id: "organization.sync", label: "达铃组织", icon: "RefreshCw", module: "organization", section: "sync", access: "organization" },
      { id: "organization.people", label: "部门与人员", icon: "Users", module: "organization", section: "people", access: "organization" },
      { id: "organization.mappings", label: "岗位与权限映射", icon: "KeyRound", module: "organization", section: "mappings", access: "organization" },
      { id: "organization.review", label: "权限复核", icon: "ShieldCheck", module: "organization", section: "review", access: "organization" }
    ]
  },
  {
    id: "system-collaboration",
    label: "系统开放与协同",
    icon: "Cable",
    children: [
      { id: "integrations.systems", label: "公司系统", icon: "Server", module: "integrations", section: "systems", access: "system" },
      { id: "integrations.templates", label: "任务模板", icon: "FileText", module: "integrations", section: "templates", access: "system" },
      { id: "tasks.all", label: "系统任务", icon: "Workflow", module: "tasks", access: "tasks" },
      { id: "tasks.exceptions", label: "异常任务", icon: "AlertTriangle", module: "tasks", taskStatuses: ["failed", "retrying"], badge: "task-errors", access: "tasks" }
    ]
  },
  {
    id: "audit-system",
    label: "日志与系统",
    icon: "FileArchive",
    children: [
      { id: "logs.all", label: "全部日志", icon: "FileArchive", module: "logs", access: "logs" },
      { id: "logs.auth-operation", label: "登录与操作", icon: "Activity", module: "logs", logKinds: ["login", "operation", "permission"], access: "logs" },
      { id: "logs.portal-download", label: "访问与下载", icon: "Download", module: "logs", logKinds: ["portal", "download"], access: "logs" },
      { id: "logs.system", label: "系统调用", icon: "Server", module: "logs", logKinds: ["system"], access: "logs" },
      { id: "logs.task", label: "任务日志", icon: "Workflow", module: "logs", logKinds: ["task"], access: "logs" },
      { id: "settings.health", label: "运行检查", icon: "Monitor", module: "settings", section: "health", access: "settings" },
      { id: "settings.storage", label: "存储与备份", icon: "Database", module: "settings", section: "storage", access: "settings" }
    ]
  }
];

const megaColumnDefinitions = {
  "asset-management": [
    { label: "资产内容", icon: "Boxes", itemIds: ["assets.overview", "assets.case", "assets.industry", "assets.platform", "assets.software"] },
    { label: "应用与设备", icon: "Cable", itemIds: ["assets.saas", "assets.scene", "assets.hardware", "assets.equipment"] }
  ],
  "intellectual-property": [
    { label: "知识产权台账", icon: "Scale", itemIds: ["ip.overview", "ip.patents", "ip.copyrights", "ip.deadlines"] },
    { label: "版本与关联", icon: "History", itemIds: ["ip.versions", "ip.relations", "ip.migration"] }
  ],
  "document-archive": [
    { label: "资料维护", icon: "FolderArchive", itemIds: ["documents.overview", "documents.marketing"] },
    { label: "档案与文件", icon: "Paperclip", itemIds: ["documents.corporate", "documents.files"] }
  ],
  "governance-operations": [
    { label: "价值治理", icon: "Gauge", itemIds: ["governance.overview", "governance.cost", "governance.lifecycle"] },
    { label: "运营治理", icon: "Activity", itemIds: ["governance.utilization", "governance.renewal"] }
  ],
  "publishing-display": [
    { label: "展示管理", icon: "PanelTop", itemIds: ["display.config"] },
    { label: "审核与发布", icon: "GitPullRequest", itemIds: ["workflow.reviews", "workflow.releases"] }
  ],
  "organization-permissions": [
    { label: "组织数据", icon: "Users", itemIds: ["organization.sync", "organization.people"] },
    { label: "权限治理", icon: "ShieldCheck", itemIds: ["organization.mappings", "organization.review"] }
  ],
  "system-collaboration": [
    { label: "系统开放", icon: "Server", itemIds: ["integrations.systems", "integrations.templates"] },
    { label: "任务协同", icon: "Workflow", itemIds: ["tasks.all", "tasks.exceptions"] }
  ],
  "audit-system": [
    { label: "日志审计", icon: "FileArchive", itemIds: ["logs.all", "logs.auth-operation", "logs.portal-download", "logs.system", "logs.task"] },
    { label: "系统运行", icon: "Monitor", itemIds: ["settings.health", "settings.storage"] }
  ]
};

navigationGroups.forEach((group) => {
  group.columns = megaColumnDefinitions[group.id] || [];
});

export const legacyRouteMap = {
  dashboard: "dashboard",
  assets: "assets.overview",
  ip: "ip.overview",
  documents: "documents.overview",
  governance: "governance.overview",
  display: "display.config",
  workflow: "workflow.reviews",
  organization: "organization.sync",
  integrations: "integrations.systems",
  tasks: "tasks.all",
  logs: "logs.all",
  settings: "settings.health"
};

export function flattenNavigation(groups = navigationGroups) {
  return groups.flatMap((group) => group.children.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })));
}

export function canAccessMenuItem(item, user) {
  if (!user) return item.access === "all";
  const roles = new Set(user.roleCodes || []);
  const permissions = new Set(user.permissionCodes || []);
  if (roles.has("ASSET_ADMIN") || item.access === "all" || item.access === "logs") return true;
  if (item.access === "asset") {
    if (["MODULE_REVIEWER", "ASSET_AUDITOR", "ASSET_PUBLISHER"].some((code) => roles.has(code)) || permissions.has("ASSET_ALL")) return true;
    const typeScopes = {
      ASSET_INDUSTRY: ["case", "industry"],
      ASSET_TECH: ["platform", "software", "saas", "scene"],
      ASSET_DELIVERY: ["case", "scene"],
      ASSET_EQUIPMENT: ["hardware", "equipment"]
    };
    const allowedTypes = Object.entries(typeScopes).flatMap(([code, types]) => permissions.has(code) ? types : []);
    return item.assetType ? allowedTypes.includes(item.assetType) : allowedTypes.length > 0;
  }
  if (item.access === "document") return permissions.has("ASSET_DOCUMENT") || permissions.has("ASSET_ALL") || ["MODULE_REVIEWER", "ASSET_AUDITOR", "ASSET_PUBLISHER"].some((code) => roles.has(code));
  if (item.access === "governance") return permissions.has("ASSET_ALL") || ["MODULE_REVIEWER", "ASSET_AUDITOR", "ASSET_PUBLISHER"].some((code) => roles.has(code));
  if (item.access === "ip") return [...permissions].some((code) => code.startsWith("IP_"));
  if (item.access === "display") return roles.has("ASSET_PUBLISHER");
  if (item.access === "review") return roles.has("MODULE_REVIEWER") || permissions.has("IP_REVIEW");
  if (item.access === "publish") return roles.has("ASSET_PUBLISHER") || permissions.has("IP_PUBLISH");
  if (item.access === "organization") return roles.has("ORG_ADMIN");
  if (item.access === "system" || item.access === "settings") return roles.has("SYSTEM_ADMIN");
  if (item.access === "tasks") return ["SYSTEM_ADMIN", "MODULE_REVIEWER", "ASSET_PUBLISHER"].some((code) => roles.has(code)) || permissions.has("IP_REVIEW") || permissions.has("IP_PUBLISH");
  return false;
}

export function filterNavigationForUser(user, groups = navigationGroups) {
  return groups.map((group) => {
    const children = group.children.filter((item) => canAccessMenuItem(item, user));
    const visibleIds = new Set(children.map((item) => item.id));
    const columns = (group.columns || []).map((column) => ({
      ...column,
      items: column.itemIds.filter((id) => visibleIds.has(id)).map((id) => children.find((item) => item.id === id))
    })).filter((column) => column.items.length > 0);
    return { ...group, children, columns };
  }).filter((group) => group.children.length > 0);
}

export function sanitizeNavigationState(state, groups) {
  const items = flattenNavigation(groups);
  const validIds = new Set(items.map((item) => item.id));
  const requestedTabs = Array.isArray(state?.tabs) ? state.tabs : [];
  const tabs = ["dashboard", ...requestedTabs].filter((id, index, rows) => validIds.has(id) && rows.indexOf(id) === index);
  const activeId = validIds.has(state?.activeId) ? state.activeId : "dashboard";
  const expandedGroupId = "";
  return { activeId, tabs: tabs.length ? tabs : ["dashboard"], expandedGroupId };
}
