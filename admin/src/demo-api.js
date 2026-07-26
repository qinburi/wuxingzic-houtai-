const STORAGE_KEY = "hannao_admin_demo_state_v1";
const TOKEN_KEY = "hannao_admin_token";
const DEMO_TOKEN = "hannao-pages-demo-session";
const DEMO_DATE = "2026-07-25T06:30:00.000Z";

const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const departments = [
  { id: "dept-product", name: "产品中心", code: "PRODUCT", memberCount: 18 },
  { id: "dept-tech", name: "技术中心", code: "TECH", memberCount: 26 },
  { id: "dept-industry", name: "行业事业部", code: "INDUSTRY", memberCount: 14 },
  { id: "dept-delivery", name: "交付中心", code: "DELIVERY", memberCount: 21 }
];

const users = [
  ["user-admin", "DL-1001", "演示管理员", "10000000000", "HN-001", "dept-product", "产品管理员", ["ASSET_ADMIN"], ["ASSET_ALL", "IP_VIEW", "IP_EDIT", "IP_REVIEW", "IP_PUBLISH", "IP_EXPORT"]],
  ["user-reviewer", "DL-1002", "演示审核员", "10000000001", "HN-002", "dept-tech", "技术审核员", ["MODULE_REVIEWER"], ["ASSET_TECH", "IP_VIEW", "IP_REVIEW"]],
  ["user-editor", "DL-1003", "演示维护员", "10000000002", "HN-003", "dept-industry", "行业维护员", ["ASSET_EDITOR"], ["ASSET_INDUSTRY", "IP_VIEW"]],
  ["user-auditor", "DL-1004", "演示审计员", "10000000003", "HN-004", "dept-delivery", "资产审计员", ["ASSET_AUDITOR"], ["AUDIT_READ", "IP_VIEW", "IP_EXPORT"]]
].map(([id, dalingId, name, phone, employeeCode, departmentId, position, roleCodes, permissionCodes]) => ({
  id, dalingId, name, phone, employeeCode, departmentId,
  departmentName: departments.find((item) => item.id === departmentId).name,
  position, roleCodes, permissionCodes, status: "active", lastLoginAt: DEMO_DATE
}));

const groups = [
  ["case", "案例资产", ["服装数字工厂案例", "五金数字工厂案例", "智能仓储案例"]],
  ["industry", "行业内容", ["服装行业库", "五金行业库", "医疗行业库"]],
  ["platform", "核心平台", ["工业联网平台", "AI数据底座"]],
  ["software", "产品矩阵", ["ERP管理系统", "MES执行系统", "WMS仓储系统", "APS排产系统"]],
  ["saas", "SaaS应用", ["达铃协同", "薪安", "鉴富宝"]],
  ["scene", "场景运营库", ["工位机生产报工", "RFID批次追溯"]],
  ["hardware", "智能硬件", ["工业工位机", "手持终端", "边缘计算机"]],
  ["equipment", "智能设备", ["AGV调度设备", "视觉检测设备"]],
  ["document", "资料资产", ["公司介绍", "数字工厂解决方案", "项目验收模板"]],
  ["governance", "治理资产", ["年度续费事项", "低利用率资产清单"]]
];

function makeAttachment(assetId, title, materialType = "资料说明") {
  return {
    id: `file-${assetId}-1`, name: `${title}-资料说明.pdf`, mimeType: "application/pdf", size: 368640,
    version: 1, publicMode: "preview", visibility: "internal", materialType, isCurrent: true,
    storageKey: `demo/${assetId}/overview.pdf`, createdAt: DEMO_DATE
  };
}

function makeAsset(type, category, title, index) {
  const owner = users[index % users.length];
  const status = index % 11 === 0 ? "reviewing" : index % 7 === 0 ? "draft" : "published";
  const id = `asset-${type}-${String(index + 1).padStart(3, "0")}`;
  return {
    id, portalKey: title, code: `HN-${type.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
    type, title, category, summary: `${title}的无形资产沉淀、责任归属、资料证据和复用信息。`,
    ownerId: owner.id, ownerName: owner.name, departmentId: owner.departmentId, departmentName: owner.departmentName,
    sensitivity: index % 9 === 0 ? "confidential" : index % 5 === 0 ? "department" : "company",
    channel: index % 3 === 0 ? "both" : "internal", status, version: status === "published" ? `V1.${index % 5}` : "V0.1",
    amount: 120000 + index * 28000, showAmountPublic: index % 6 === 0,
    publicFields: ["summary", "version", "attachments", ...(index % 6 === 0 ? ["amount"] : [])],
    featured: index < 8, sortOrder: index + 1, attachments: [makeAttachment(id, title)],
    audienceTemplates: [{ id: `aud-${id}`, subjectType: "department", subjectId: owner.departmentId, subjectName: owner.departmentName, actions: ["view", "preview", "download"] }],
    systemIds: index % 6 === 0 ? ["sys-erp", "sys-mes"] : [], lockVersion: 1, createdAt: DEMO_DATE, updatedAt: DEMO_DATE
  };
}

function makeIpAsset(kind, title, index) {
  const base = makeAsset("ip", kind === "patent" ? "专利" : "软件著作权", title, 40 + index);
  const obtained = kind === "patent" ? "2024-05-22" : "2025-03-18";
  base.status = "published";
  base.code = `HN-IP-${String(index + 1).padStart(3, "0")}`;
  base.attachments = [makeAttachment(base.id, title, kind === "patent" ? "专利证书" : "登记证书")];
  base.ipProfile = {
    kind, patentType: kind === "patent" ? (index % 2 ? "utility_model" : "invention") : undefined,
    shortName: kind === "software_copyright" ? title.replace(/软件$/, "") : "",
    applicationNumber: kind === "patent" ? `CN2024${String(index + 1).padStart(6, "0")}` : "",
    publicationNumber: kind === "patent" ? `CN118${String(index + 1).padStart(6, "0")}A` : "",
    registrationNumber: kind === "software_copyright" ? `2025SR${String(120000 + index)}` : "",
    certificateNumber: kind === "patent" ? `专利证字第${8800 + index}号` : `软著登字第${9900 + index}号`,
    legalStatus: kind === "patent" ? "granted" : "registered", rightsHolder: "浙江汉脑数智科技有限公司",
    applicationAgency: "研发与产品中心", agency: "合作知识产权代理机构", applicationDate: "2023-05-22",
    acceptedAt: "2023-06-06", obtainedAt: obtained, expiresAt: kind === "patent" ? "2043-05-21" : "2075-12-31",
    annualFeeDueAt: kind === "patent" ? "2026-10-30" : undefined, nextReviewAt: kind === "software_copyright" ? "2026-10-01" : undefined,
    completedAt: kind === "software_copyright" ? "2024-09-30" : undefined, firstPublishedAt: kind === "software_copyright" ? "2024-11-18" : undefined,
    primaryOwnerId: "user-admin", primaryOwnerName: "演示管理员", collaboratorIds: ["user-editor"], collaboratorNames: ["演示维护员"],
    technicalSummary: kind === "patent" ? `${title}的技术方案、实施路径和成果边界。` : undefined,
    claimsSummary: kind === "patent" ? "核心权利要求及其与产品能力的对应关系。" : undefined,
    productVersion: kind === "software_copyright" ? "V1.0" : undefined,
    functionalDescription: kind === "software_copyright" ? `${title}对应的软件功能、模块组成和发布内容。` : undefined,
    notes: "由知识产权台账统一维护。", reminderSystemIds: ["sys-daling"]
  };
  return base;
}

function initialState() {
  let index = 0;
  const assets = groups.flatMap(([type, category, names]) => names.map((title) => makeAsset(type, category, title, index++)));
  const ipAssets = [
    makeIpAsset("patent", "生产数据智能处理方法", 0),
    makeIpAsset("patent", "设备异常预警装置", 1),
    makeIpAsset("software_copyright", "汉脑ERP管理软件", 2),
    makeIpAsset("software_copyright", "汉脑MES执行软件", 3)
  ];
  assets.push(...ipAssets);
  const relations = [
    { id: "relation-1", ipAssetId: ipAssets[0].id, relatedAssetId: assets.find((item) => item.type === "case").id, relationType: "core", contributionNote: "案例核心算法成果", status: "published", pendingRemoval: false, createdAt: DEMO_DATE, updatedAt: DEMO_DATE },
    { id: "relation-2", ipAssetId: ipAssets[2].id, relatedAssetId: assets.find((item) => item.type === "software").id, relationType: "core", contributionNote: "产品对应软件版本", status: "published", pendingRemoval: false, createdAt: DEMO_DATE, updatedAt: DEMO_DATE }
  ];
  const reviews = assets.filter((item) => item.status === "reviewing").map((asset, reviewIndex) => ({
    id: `review-${reviewIndex + 1}`, assetId: asset.id, assetTitle: asset.title, revisionId: `${asset.id}-r1`,
    submitterId: asset.ownerId, submitterName: asset.ownerName, reviewerId: "user-reviewer", reviewerName: "演示审核员", status: "pending", submittedAt: DEMO_DATE
  }));
  const systems = [
    { id: "sys-erp", name: "汉脑ERP", code: "ERP", status: "active", baseUrl: "https://erp.internal.example", taskTemplateId: "tpl-erp", credentialHint: "client_erp_****32", lastCheckedAt: DEMO_DATE },
    { id: "sys-mes", name: "汉脑MES", code: "MES", status: "active", baseUrl: "https://mes.internal.example", taskTemplateId: "tpl-mes", credentialHint: "client_mes_****91", lastCheckedAt: DEMO_DATE },
    { id: "sys-daling", name: "达铃协同", code: "DALING", status: "warning", baseUrl: "https://daling.internal.example", taskTemplateId: "tpl-daling", credentialHint: "client_daling_****08", lastCheckedAt: DEMO_DATE }
  ];
  const templates = systems.map((system) => ({ id: system.taskTemplateId, name: `${system.name}资产评审任务`, systemId: system.id, taskType: "PROJECT_ASSET", projectCode: `${system.code}-ASSET`, titleTemplate: "[无形资产] {{asset.title}}", ownerField: "asset.ownerId", version: 1, enabled: true }));
  const logs = [
    ["login", "登录成功", "管理后台", "演示管理员"], ["operation", "更新资产", "服装数字工厂案例", "演示维护员"],
    ["permission", "重算部门权限", "产品中心", "系统任务"], ["portal", "查看资产详情", "工业联网平台", "演示维护员"],
    ["download", "下载资料", "数字工厂解决方案.pdf", "演示管理员"], ["system", "系统调用", "ERP资产接口", "汉脑ERP"],
    ["task", "创建项目任务", "WMS仓储资产任务", "系统任务"]
  ].map((item, logIndex) => ({ id: `log-${logIndex + 1}`, kind: item[0], actorId: `actor-${logIndex}`, actorName: item[3], departmentName: "系统与资产治理", action: item[1], targetType: item[0], targetId: `target-${logIndex}`, targetName: item[2], result: "success", ip: "匿名演示", device: "GitHub Pages", requestId: `DEMO-${String(logIndex + 1).padStart(5, "0")}`, detail: "演示环境初始化记录", createdAt: new Date(Date.parse(DEMO_DATE) - logIndex * 3600000).toISOString() }));
  return {
    users, departments, assets, relations, reviews, systems, templates, logs, businessVersions: [
      { id: "ip-version-1", ipAssetId: ipAssets[2].id, version: "V1.0", name: "首次登记版本", releasedAt: "2025-01-10", description: "ERP核心业务功能版本", relatedProductVersion: "V1.0", ownerId: "user-admin", ownerName: "演示管理员", createdAt: DEMO_DATE }
    ],
    archiveRevisions: [], reminders: [
      { id: "reminder-1", ipAssetId: ipAssets[1].id, ipAssetTitle: ipAssets[1].title, type: "annual_fee", dueAt: "2026-10-30", remindAt: "2026-07-30", status: "open", ownerId: "user-admin", ownerName: "演示管理员", systemIds: ["sys-daling"], createdAt: DEMO_DATE }
    ], migrationIssues: [], dispatches: [
      { id: "dispatch-1", idempotencyKey: "demo-dispatch-1", assetId: assets[0].id, assetTitle: assets[0].title, revisionId: `${assets[0].id}-r1`, systemId: "sys-mes", systemName: "汉脑MES", templateId: "tpl-mes", status: "failed", attempt: 5, error: "演示：负责人字段映射待确认", createdAt: DEMO_DATE, updatedAt: DEMO_DATE }
    ], releases: [
      { id: "release-103", version: "v1.0.3", title: "三层导航与版本快照增强版", status: "published", assetCount: assets.length, publicAssetCount: assets.filter((item) => item.channel === "both").length, publisherName: "演示管理员", publishedAt: "2026-07-24T09:00:00.000Z", changes: ["三层导航", "版本快照", "资产治理入口"] }
    ], settings: {
      currentVersion: "v1.0.3", lastHrSyncAt: DEMO_DATE, nextAccessReviewAt: "2027-01-01T00:00:00.000Z", storageDriver: "demo", dataDriver: "browser",
      ipReminderRules: { expiry: [180, 90, 30, 7], annual_fee: [90, 30, 7], document_review: [30, 7] }, lastBackupAt: null,
      displayModules: [
        ["company-docs", "公司资料分类", true, true, 1, 12], ["cases", "案例资产", true, true, 2, 3], ["industries", "行业内容", true, true, 3, 8],
        ["platforms", "核心平台", true, false, 4, 4], ["software", "产品矩阵", true, true, 5, 9], ["saas", "SaaS应用", true, true, 6, 8],
        ["scenes", "场景运营库", true, false, 7, 4], ["hardware", "智能硬件与设备", true, true, 8, 10]
      ].map(([id, name, visible, publicVisible, sort, featured]) => ({ id, name, visible, publicVisible, sort, featured, fields: ["title", "summary", "version"] }))
    }
  };
}

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialState();
  } catch {
    return initialState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function parseBody(options) {
  if (options.body instanceof FormData) return options.body;
  if (!options.body) return {};
  try { return JSON.parse(options.body); } catch { return {}; }
}

function currentUser(state) {
  return clone(state.users[0]);
}

function enrichedRelations(state) {
  return state.relations.map((relation) => {
    const ipAsset = state.assets.find((item) => item.id === relation.ipAssetId);
    const relatedAsset = state.assets.find((item) => item.id === relation.relatedAssetId);
    return { ...relation, ipAssetTitle: ipAsset?.title || relation.ipAssetId, ipKind: ipAsset?.ipProfile?.kind, relatedAssetTitle: relatedAsset?.title || relation.relatedAssetId, relatedAssetType: relatedAsset?.type };
  });
}

function ipWorkspace(state) {
  const ipAssets = state.assets.filter((item) => item.type === "ip" && item.status !== "archived").map((asset) => ({
    ...asset,
    relationCount: state.relations.filter((relation) => relation.ipAssetId === asset.id && !relation.pendingRemoval).length,
    nextReminder: state.reminders.find((reminder) => reminder.ipAssetId === asset.id && ["scheduled", "open"].includes(reminder.status))
  }));
  return {
    metrics: {
      total: ipAssets.length, patents: ipAssets.filter((item) => item.ipProfile?.kind === "patent").length,
      copyrights: ipAssets.filter((item) => item.ipProfile?.kind === "software_copyright").length,
      applying: ipAssets.filter((item) => ["preparation", "applied", "accepted", "reviewing"].includes(item.ipProfile?.legalStatus)).length,
      obtained: ipAssets.filter((item) => ["granted", "registered"].includes(item.ipProfile?.legalStatus)).length,
      expiring: 0, annualFees: state.reminders.filter((item) => item.type === "annual_fee" && item.status === "open").length,
      missingDocuments: ipAssets.filter((item) => !item.attachments.length).length, migrationIssues: state.migrationIssues.filter((item) => item.status === "pending").length
    },
    assets: ipAssets, businessVersions: state.businessVersions, archiveRevisions: state.archiveRevisions,
    relations: enrichedRelations(state), reminders: state.reminders, migrationIssues: state.migrationIssues, reminderRules: state.settings.ipReminderRules
  };
}

function dashboard(state) {
  const assets = state.assets.filter((item) => item.status !== "archived");
  const publishedAssets = assets.filter((item) => item.status === "published");
  const publicAssets = publishedAssets.filter((item) => item.channel === "both" && !["confidential", "restricted"].includes(item.sensitivity));
  const ipAssets = assets.filter((item) => item.type === "ip" && item.ipProfile);
  const pendingReviews = state.reviews.filter((item) => item.status === "pending");
  const taskFailures = state.dispatches.filter((item) => ["failed", "retrying"].includes(item.status));
  const openReminders = state.reminders.filter((item) => item.status === "open");
  const statusSummary = [
    { status: "reviewing", label: "审核中", count: assets.filter((item) => ["reviewing", "approved"].includes(item.status)).length, color: "#2f73f6" },
    { status: "published", label: "已发布", count: publishedAssets.length, color: "#26b982" },
    { status: "draft", label: "草稿", count: assets.filter((item) => ["draft", "rejected"].includes(item.status)).length, color: "#ff8a3d" }
  ];
  const activityValues = {
    maintenance: [4, 6, 5, 8, 7, 9, 12],
    accessDownloads: [7, 9, 8, 11, 10, 13, 15],
    systemCollaboration: [2, 3, 4, 3, 5, 4, 6]
  };
  const activityTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(DEMO_DATE);
    date.setDate(date.getDate() - (6 - index));
    return {
      date: date.toISOString().slice(0, 10),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      maintenance: activityValues.maintenance[index],
      accessDownloads: activityValues.accessDownloads[index],
      systemCollaboration: activityValues.systemCollaboration[index]
    };
  });
  const departmentContributions = Object.entries(assets.reduce((result, item) => {
    result[item.departmentName] = (result[item.departmentName] || 0) + 1;
    return result;
  }, {})).map(([department, count]) => ({ department, count })).sort((left, right) => right.count - left.count);
  const demoNow = Date.parse(DEMO_DATE);
  const ipDeadlines = state.reminders.map((reminder) => {
    const asset = state.assets.find((item) => item.id === reminder.ipAssetId);
    return {
      id: reminder.id,
      assetId: reminder.ipAssetId,
      title: asset?.title || reminder.ipAssetTitle || "知识产权事项",
      typeLabel: reminder.type === "annual_fee" ? "年费" : reminder.type === "expiry" ? "期限" : "资料复核",
      dueDate: reminder.dueDate,
      ownerName: reminder.ownerName,
      daysRemaining: Math.ceil((Date.parse(reminder.dueDate) - demoNow) / 86400000)
    };
  }).filter((item) => Number.isFinite(item.daysRemaining)).sort((left, right) => left.daysRemaining - right.daysRemaining).slice(0, 6);
  const governanceRisks = [
    { id: "pending-reviews", title: "待审核内容", detail: `${pendingReviews.length} 项内容等待模块评审`, count: pendingReviews.length, tone: "warning", routeId: "workflow.reviews" },
    { id: "ip-deadlines", title: "知识产权期限", detail: `${openReminders.length} 项提醒等待处理`, count: openReminders.length, tone: openReminders.length ? "danger" : "success", routeId: "ip.deadlines" },
    { id: "migration-issues", title: "待确认绑定", detail: `${state.migrationIssues.filter((item) => item.status === "pending").length} 项历史关系待确认`, count: state.migrationIssues.filter((item) => item.status === "pending").length, tone: "warning", routeId: "ip.migration" },
    { id: "task-failures", title: "系统协同异常", detail: `${taskFailures.length} 项任务等待重试或人工处理`, count: taskFailures.length, tone: taskFailures.length ? "danger" : "success", routeId: "tasks.exceptions" }
  ];
  return {
    metrics: {
      totalAssets: assets.length,
      publishedAssets: publishedAssets.length,
      pendingReviews: pendingReviews.length,
      approvedReviews: state.reviews.filter((item) => item.status === "approved").length,
      taskFailures: taskFailures.length,
      publicAssets: publicAssets.length,
      publicCoverage: assets.length ? Math.round(publicAssets.length / assets.length * 100) : 0,
      ipAssets: ipAssets.length,
      patents: ipAssets.filter((item) => item.ipProfile?.kind === "patent").length,
      copyrights: ipAssets.filter((item) => item.ipProfile?.kind === "software_copyright").length,
      governancePending: pendingReviews.length + taskFailures.length + openReminders.length,
      accessReviews: state.users.filter((item) => item.status === "active").length,
      attachments: assets.reduce((sum, item) => sum + item.attachments.length, 0)
    },
    currentVersion: state.settings.currentVersion,
    lastHrSyncAt: state.settings.lastHrSyncAt,
    activityTrend,
    statusSummary,
    departmentContributions,
    governanceRisks,
    ipDeadlines,
    systemStatuses: state.systems.map((system) => ({ ...system, taskFailures: taskFailures.filter((item) => item.systemId === system.id).length })),
    recentReviews: state.reviews.slice(0, 6), recentLogs: state.logs.slice(0, 8), recentTasks: state.dispatches.slice(0, 6),
    typeSummary: Object.entries(assets.reduce((result, item) => ({ ...result, [item.type]: (result[item.type] || 0) + 1 }), {})).map(([type, count]) => ({ type, count }))
  };
}

function assetDetail(state, id) {
  const asset = state.assets.find((item) => item.id === id);
  if (!asset) fail("资产不存在", 404);
  return asset;
}

function ipDetail(state, id) {
  const asset = assetDetail(state, id);
  return {
    asset,
    businessVersions: state.businessVersions.filter((item) => item.ipAssetId === id),
    archiveRevisions: state.archiveRevisions.filter((item) => item.ipAssetId === id),
    relations: enrichedRelations(state).filter((item) => item.ipAssetId === id),
    reminders: state.reminders.filter((item) => item.ipAssetId === id)
  };
}

function accessPreview(state, asset) {
  const publicVisible = asset.channel === "both" && !["confidential", "restricted"].includes(asset.sensitivity);
  return {
    public: { visible: publicVisible, amountVisible: publicVisible && asset.showAmountPublic && asset.publicFields.includes("amount"), attachments: publicVisible && asset.publicFields.includes("attachments") ? asset.attachments.map((file) => ({ name: file.name, mode: file.publicMode })) : [] },
    company: { visible: true, amountVisible: true, actions: ["查看", "预览", "下载"] },
    department: { visible: true, department: asset.departmentName, actions: ["查看", "预览", "下载"] },
    person: { visible: true, owner: asset.ownerName, actions: ["查看", "预览", "下载"] },
    systems: asset.systemIds.map((id) => ({ system: state.systems.find((item) => item.id === id)?.name || id, fields: "全部字段", attachments: "全部附件（含后续新增）" }))
  };
}

export async function demoRequest(path, options = {}) {
  await new Promise((resolve) => setTimeout(resolve, 90));
  const method = String(options.method || "GET").toUpperCase();
  const body = parseBody(options);
  const state = readState();

  if (path === "/auth/login" && method === "POST") {
    if (body.phone !== "10000000000" || body.password !== "Admin@123") fail("手机号或密码错误", 401);
    sessionStorage.setItem(TOKEN_KEY, DEMO_TOKEN);
    state.logs.unshift({ id: uid("log"), kind: "login", actorId: state.users[0].id, actorName: state.users[0].name, departmentName: state.users[0].departmentName, action: "登录成功", targetType: "session", targetId: "github-pages", targetName: "GitHub Pages 演示环境", result: "success", ip: "匿名演示", device: navigator.userAgent, requestId: uid("DEMO"), detail: "仅保存在当前浏览器", createdAt: new Date().toISOString() });
    saveState(state);
    return { token: DEMO_TOKEN, user: currentUser(state), expiresIn: 28800, demo: true };
  }
  if (sessionStorage.getItem(TOKEN_KEY) !== DEMO_TOKEN) fail("演示会话已失效，请重新登录", 401);

  if (path === "/auth/me") return currentUser(state);
  if (path === "/dashboard") return dashboard(state);
  if (path === "/assets" && method === "GET") return clone(state.assets);
  if (path === "/workflow/reviews" && method === "GET") return clone(state.reviews);
  if (path === "/workflow/releases" && method === "GET") return clone(state.releases);
  if (path === "/organization" && method === "GET") return { departments: clone(state.departments), users: clone(state.users), mappings: [
    { id: "map-1", sourceCode: "ASSET_ADMIN", sourceType: "role", targetRole: "超级管理员", dataScope: "全部资产", enabled: true, updatedAt: DEMO_DATE },
    { id: "map-2", sourceCode: "MODULE_REVIEWER", sourceType: "role", targetRole: "模块审核人", dataScope: "本部门资产", enabled: true, updatedAt: DEMO_DATE },
    { id: "map-3", sourceCode: "ASSET_EDITOR", sourceType: "role", targetRole: "资产维护人", dataScope: "负责资产", enabled: true, updatedAt: DEMO_DATE }
  ], settings: clone(state.settings) };
  if (path === "/integrations" && method === "GET") return { systems: clone(state.systems), templates: clone(state.templates), dispatches: clone(state.dispatches) };
  if (path === "/logs" && method === "GET") return clone(state.logs);
  if (path === "/display-config" && method === "GET") return clone(state.settings.displayModules);
  if (path === "/ip-assets/workspace" && method === "GET") return ipWorkspace(state);

  let match = path.match(/^\/assets\/([^/]+)\/access-preview$/);
  if (match && method === "GET") return accessPreview(state, assetDetail(state, match[1]));
  match = path.match(/^\/assets\/([^/]+)\/ip-relations$/);
  if (match && method === "GET") return enrichedRelations(state).filter((item) => item.relatedAssetId === match[1]);
  match = path.match(/^\/assets\/([^/]+)$/);
  if (match && method === "GET") return clone(assetDetail(state, match[1]));
  match = path.match(/^\/ip-assets\/([^/]+)$/);
  if (match && method === "GET") return ipDetail(state, match[1]);

  if ((path === "/assets" || path === "/ip-assets") && method === "POST") {
    const created = { ...clone(body), id: uid("asset"), code: body.code || `HN-${body.type === "ip" ? "IP" : "ASSET"}-${state.assets.length + 1}`, status: "draft", lockVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), attachments: body.attachments || [], audienceTemplates: body.audienceTemplates || [], systemIds: body.systemIds || [] };
    state.assets.unshift(created); saveState(state); return clone(created);
  }
  match = path.match(/^\/(?:assets|ip-assets)\/([^/]+)$/);
  if (match && method === "PATCH") {
    const index = state.assets.findIndex((item) => item.id === match[1]);
    if (index < 0) fail("资产不存在", 404);
    state.assets[index] = { ...state.assets[index], ...clone(body), lockVersion: Number(state.assets[index].lockVersion || 0) + 1, updatedAt: new Date().toISOString() };
    saveState(state); return clone(state.assets[index]);
  }
  match = path.match(/^\/assets\/([^/]+)$/);
  if (match && method === "DELETE") { assetDetail(state, match[1]).status = "archived"; saveState(state); return { archived: true }; }
  match = path.match(/^\/assets\/([^/]+)\/submit-review$/);
  if (match && method === "POST") {
    const asset = assetDetail(state, match[1]); asset.status = "reviewing"; asset.updatedAt = new Date().toISOString();
    if (!state.reviews.some((item) => item.assetId === asset.id && item.status === "pending")) state.reviews.unshift({ id: uid("review"), assetId: asset.id, assetTitle: asset.title, revisionId: `${asset.id}-r${asset.lockVersion}`, submitterId: asset.ownerId, submitterName: asset.ownerName, reviewerId: "user-reviewer", reviewerName: "演示审核员", status: "pending", submittedAt: new Date().toISOString() });
    saveState(state); return { submitted: true };
  }
  match = path.match(/^\/workflow\/reviews\/([^/]+)\/decision$/);
  if (match && method === "POST") {
    const review = state.reviews.find((item) => item.id === match[1]); if (!review) fail("审核记录不存在", 404);
    review.status = body.decision === "approve" ? "approved" : "rejected"; review.comment = body.comment; review.decidedAt = new Date().toISOString();
    const asset = assetDetail(state, review.assetId); asset.status = body.decision === "approve" ? "approved" : "rejected";
    saveState(state); return clone(review);
  }
  if (path === "/workflow/releases" && method === "POST") {
    const release = { id: uid("release"), version: body.version, title: body.title, status: "published", assetCount: state.assets.length, publicAssetCount: state.assets.filter((item) => item.channel === "both").length, publisherName: state.users[0].name, publishedAt: new Date().toISOString(), changes: body.changes || [], stateSnapshotPath: "browser://demo-snapshot" };
    state.releases.unshift(release); state.settings.currentVersion = body.version; saveState(state); return clone(release);
  }
  match = path.match(/^\/workflow\/releases\/([^/]+)\/rollback$/);
  if (match && method === "POST") { const release = state.releases.find((item) => item.id === match[1]); if (!release) fail("发布版本不存在", 404); state.settings.currentVersion = release.version; saveState(state); return { rolledBack: true }; }
  if (path === "/display-config" && method === "PATCH") { state.settings.displayModules = clone(body.modules || []); saveState(state); return clone(state.settings.displayModules); }
  if (path === "/organization/sync" && method === "POST") { state.settings.lastHrSyncAt = new Date().toISOString(); saveState(state); return { syncedUsers: state.users.length, syncedDepartments: state.departments.length, completedAt: state.settings.lastHrSyncAt }; }
  match = path.match(/^\/integrations\/systems\/([^/]+)\/test$/);
  if (match && method === "POST") { const system = state.systems.find((item) => item.id === match[1]); if (!system) fail("系统不存在", 404); system.status = "active"; system.lastCheckedAt = new Date().toISOString(); saveState(state); return { systemId: system.id, status: system.status, checkedAt: system.lastCheckedAt, latencyMs: 42 }; }
  match = path.match(/^\/integrations\/dispatches\/([^/]+)\/retry$/);
  if (match && method === "POST") { const task = state.dispatches.find((item) => item.id === match[1]); if (!task) fail("任务不存在", 404); task.status = "created"; task.attempt += 1; task.externalTaskId = `DEMO-${Date.now()}`; task.updatedAt = new Date().toISOString(); saveState(state); return clone(task); }
  if (path === "/system-management/backup" && method === "POST") { state.settings.lastBackupAt = new Date().toISOString(); saveState(state); return { path: "browser://local-storage/demo-backup", verified: true, createdAt: state.settings.lastBackupAt }; }

  match = path.match(/^\/ip-assets\/([^/]+)\/business-versions$/);
  if (match && method === "POST") { const version = { ...clone(body), id: uid("ip-version"), ipAssetId: match[1], ownerName: state.users.find((item) => item.id === body.ownerId)?.name || state.users[0].name, createdAt: new Date().toISOString() }; state.businessVersions.unshift(version); saveState(state); return clone(version); }
  match = path.match(/^\/assets\/([^/]+)\/ip-relations$/);
  if (match && method === "POST") { if (state.relations.some((item) => item.relatedAssetId === match[1] && item.ipAssetId === body.ipAssetId && !item.pendingRemoval)) fail("该知识产权已经绑定到当前资产"); const relation = { id: uid("relation"), ipAssetId: body.ipAssetId, relatedAssetId: match[1], relationType: body.relationType || "supporting", contributionNote: body.contributionNote || "", status: "draft", pendingRemoval: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; state.relations.unshift(relation); saveState(state); return clone(relation); }
  match = path.match(/^\/assets\/([^/]+)\/ip-relations\/quick-create$/);
  if (match && method === "POST") { const created = { ...makeIpAsset(body.ipProfile?.kind || "patent", body.title, state.assets.length), id: uid("asset-ip"), code: body.code || `HN-IP-${state.assets.length + 1}`, status: "draft", ipProfile: { ...makeIpAsset(body.ipProfile?.kind || "patent", body.title, state.assets.length).ipProfile, ...clone(body.ipProfile) } }; state.assets.unshift(created); state.relations.unshift({ id: uid("relation"), ipAssetId: created.id, relatedAssetId: match[1], relationType: body.relationType || "supporting", contributionNote: body.contributionNote || "", status: "draft", pendingRemoval: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); saveState(state); return { asset: clone(created) }; }
  match = path.match(/^\/assets\/[^/]+\/ip-relations\/([^/]+)$/);
  if (match && method === "DELETE") { const relation = state.relations.find((item) => item.id === match[1]); if (!relation) fail("关联不存在", 404); if (relation.status === "published") relation.pendingRemoval = true; else state.relations = state.relations.filter((item) => item.id !== relation.id); saveState(state); return { removed: true }; }
  match = path.match(/^\/ip-assets\/reminders\/([^/]+)\/complete$/);
  if (match && method === "POST") { const reminder = state.reminders.find((item) => item.id === match[1]); if (!reminder) fail("提醒不存在", 404); reminder.status = "completed"; reminder.note = body.note || ""; saveState(state); return clone(reminder); }
  match = path.match(/^\/ip-assets\/migration-issues\/([^/]+)\/resolve$/);
  if (match && method === "POST") { const issue = state.migrationIssues.find((item) => item.id === match[1]); if (!issue) fail("待确认记录不存在", 404); issue.status = "resolved"; issue.relatedAssetId = body.relatedAssetId; saveState(state); return clone(issue); }
  match = path.match(/^\/files\/upload\/([^/]+)$/);
  if (match && method === "POST") { const asset = assetDetail(state, match[1]); const file = body instanceof FormData ? body.get("file") : null; const attachment = { id: uid("file"), name: file?.name || "演示附件.pdf", mimeType: file?.type || "application/octet-stream", size: file?.size || 1024, version: 1, publicMode: body.get?.("publicMode") || "preview", visibility: body.get?.("visibility") || "internal", materialType: body.get?.("materialType") || "资料说明", isCurrent: true, storageKey: "browser://demo-file", createdAt: new Date().toISOString() }; asset.attachments.push(attachment); saveState(state); return clone(attachment); }

  fail(`演示模式暂不支持此操作：${method} ${path}`, 501);
}

export async function demoDownload(path) {
  const state = readState();
  if (path === "/workflow/public-package") return new Blob([JSON.stringify({ demo: true, version: state.settings.currentVersion, assets: state.assets.filter((item) => item.status === "published" && item.channel === "both") }, null, 2)], { type: "application/json;charset=utf-8" });
  if (path === "/ip-assets/export") {
    const rows = [["内部编号", "名称", "类型", "法律状态", "负责人"], ...state.assets.filter((item) => item.type === "ip").map((item) => [item.code, item.title, item.ipProfile?.kind, item.ipProfile?.legalStatus, item.ipProfile?.primaryOwnerName])];
    return new Blob(["\ufeff", rows.map((row) => row.map((value) => `"${String(value || "").replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  }
  fail("演示模式没有可下载的文件", 404);
}
