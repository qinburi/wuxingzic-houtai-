import { randomUUID, scryptSync } from "node:crypto";
import type {
  AssetRecord,
  AssetType,
  AuditRecord,
  DisplayModuleConfig,
  ExternalSystemRecord,
  IpArchiveRevision,
  IpBusinessVersion,
  IpMigrationIssue,
  IpRelationRecord,
  IpReminderRecord,
  IpReminderType,
  MaintenanceExpenseRecord,
  PortalDataset,
  PublicDownloadRegistration,
  ReviewRecord,
  TaskDispatchRecord
} from "../../shared/contracts.js";

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  parentId?: string;
  memberCount: number;
}

export interface UserRecord {
  id: string;
  dalingId: string;
  name: string;
  phone: string;
  employeeCode: string;
  departmentId: string;
  departmentName: string;
  position: string;
  roleCodes: string[];
  permissionCodes: string[];
  status: "active" | "disabled";
  passwordHash: string;
  lastLoginAt?: string;
  failedLoginCount?: number;
  lockedUntil?: string;
}

export interface PermissionMappingRecord {
  id: string;
  sourceCode: string;
  sourceType: "position" | "role" | "permission";
  targetRole: string;
  dataScope: string;
  enabled: boolean;
  updatedAt: string;
}

export interface TaskTemplateRecord {
  id: string;
  name: string;
  systemId: string;
  taskType: string;
  projectCode: string;
  titleTemplate: string;
  ownerField: string;
  version: number;
  enabled: boolean;
}

export interface ReleaseRecord {
  id: string;
  version: string;
  title: string;
  status: "published" | "draft" | "rolled_back";
  assetCount: number;
  publicAssetCount: number;
  publisherName: string;
  publishedAt: string;
  changes: string[];
  internalSnapshotPath?: string;
  publicSnapshotPath?: string;
  stateSnapshotPath?: string;
  affectedSystemIds?: string[];
  diff?: { added: number; updated: number; removed: number };
}

export interface AppState {
  departments: DepartmentRecord[];
  users: UserRecord[];
  mappings: PermissionMappingRecord[];
  assets: AssetRecord[];
  ipBusinessVersions: IpBusinessVersion[];
  ipArchiveRevisions: IpArchiveRevision[];
  ipRelations: IpRelationRecord[];
  ipReminders: IpReminderRecord[];
  ipMigrationIssues: IpMigrationIssue[];
  maintenanceExpenses: MaintenanceExpenseRecord[];
  reviews: ReviewRecord[];
  systems: ExternalSystemRecord[];
  taskTemplates: TaskTemplateRecord[];
  taskDispatches: TaskDispatchRecord[];
  releases: ReleaseRecord[];
  logs: AuditRecord[];
  downloadRegistrations: PublicDownloadRegistration[];
  processedEventIds: string[];
  settings: {
    currentVersion: string;
    lastHrSyncAt: string;
    nextAccessReviewAt: string;
    storageDriver: string;
    dataDriver: string;
    ipReminderRules: Record<Exclude<IpReminderType, "owner_handover">, number[]>;
    ipDefaultSystemIds: string[];
    displayModules: DisplayModuleConfig[];
    lastBackupAt?: string;
    lastBackupPath?: string;
  };
}

const now = () => new Date().toISOString();
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const monthKey = (offset: number) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export function hashPassword(password: string, salt = "hannao-local-seed") {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const departments: DepartmentRecord[] = [
  { id: "dept-demo-product", name: "示例产品组", code: "DEMO_PRODUCT", memberCount: 3 },
  { id: "dept-demo-tech", name: "示例技术组", code: "DEMO_TECH", memberCount: 4 },
  { id: "dept-demo-industry", name: "示例行业组", code: "DEMO_INDUSTRY", memberCount: 2 },
  { id: "dept-demo-delivery", name: "示例交付组", code: "DEMO_DELIVERY", memberCount: 2 },
  { id: "dept-demo-equipment", name: "示例装备组", code: "DEMO_EQUIPMENT", memberCount: 2 }
];

const people = [
  ["user-demo-admin", "DEMO-DL-1001", "演示管理员", "10000000000", "DEMO-001", "dept-demo-product", "产品管理员", ["ASSET_ADMIN"], ["ASSET_ALL", "IP_VIEW", "IP_EDIT", "IP_REVIEW", "IP_PUBLISH", "IP_EXPORT"]],
  ["user-demo-reviewer-a", "DEMO-DL-1002", "演示审核员甲", "10000000001", "DEMO-002", "dept-demo-tech", "技术审核员", ["MODULE_REVIEWER"], ["ASSET_TECH", "IP_VIEW", "IP_REVIEW"]],
  ["user-demo-editor-a", "DEMO-DL-1003", "演示维护员甲", "10000000002", "DEMO-003", "dept-demo-industry", "行业维护员", ["ASSET_EDITOR"], ["ASSET_INDUSTRY"]],
  ["user-demo-editor-b", "DEMO-DL-1004", "演示维护员乙", "10000000003", "DEMO-004", "dept-demo-delivery", "交付维护员", ["ASSET_EDITOR"], ["ASSET_DELIVERY"]],
  ["user-demo-editor-c", "DEMO-DL-1005", "演示维护员丙", "10000000004", "DEMO-005", "dept-demo-equipment", "装备维护员", ["ASSET_EDITOR"], ["ASSET_EQUIPMENT"]],
  ["user-demo-reviewer-b", "DEMO-DL-1006", "演示审核员乙", "10000000005", "DEMO-006", "dept-demo-equipment", "装备审核员", ["MODULE_REVIEWER"], ["ASSET_EQUIPMENT"]],
  ["user-demo-document", "DEMO-DL-1007", "演示资料员", "10000000006", "DEMO-007", "dept-demo-product", "资料维护员", ["ASSET_EDITOR"], ["ASSET_DOCUMENT", "IP_VIEW", "IP_EDIT", "IP_EXPORT"]],
  ["user-demo-auditor", "DEMO-DL-1008", "演示审计员", "10000000007", "DEMO-008", "dept-demo-product", "资产审计员", ["ASSET_AUDITOR"], ["AUDIT_READ", "IP_VIEW", "IP_EXPORT"]]
] as const;

const users: UserRecord[] = people.map((person) => {
  const department = departments.find((item) => item.id === person[5])!;
  return {
    id: person[0],
    dalingId: person[1],
    name: person[2],
    phone: person[3],
    employeeCode: person[4],
    departmentId: person[5],
    departmentName: department.name,
    position: person[6],
    roleCodes: [...person[7]],
    permissionCodes: [...person[8]],
    status: "active",
    passwordHash: hashPassword("Admin@123")
  };
});

const assetGroups: Array<[AssetType, string, string[]]> = [
  ["case", "案例资产", ["示例服装数字工厂案例", "示例五金数字工厂案例", "示例智能仓储案例"]],
  ["industry", "行业内容", ["示例服装行业库", "示例五金行业库", "示例医疗行业库", "示例汽车零部件行业库", "示例食品行业库", "示例物流装备行业库"]],
  ["platform", "核心平台", ["示例工业联网平台", "示例内网工业平台", "示例AI数据底座", "示例企业工业底座"]],
  ["software", "产品矩阵", ["ERP", "MES", "WMS", "PLM", "PDM", "MRP", "APS", "IES", "CRM"]],
  ["saas", "SaaS应用", ["达铃", "考勤", "餐饮", "薪安", "万加", "鉴富宝", "标识解析", "优羽", "CRM SaaS", "工资条", "e维保", "扩展应用"]],
  ["scene", "场景运营库", ["手持机收发作业", "工位机生产报工", "大屏看板现场调度", "RFID批次追溯"]],
  ["hardware", "智能硬件", ["工位机", "手持机", "打印机", "广告机", "取餐机", "RFID", "边缘计算机", "硬件扩展"]],
  ["equipment", "智能设备", ["无源相控阵管控装置", "AGV", "提升机", "穿梭车", "机械臂", "立体库", "视觉检测设备", "工业相机", "电子看板", "装备扩展"]],
  ["document", "资料资产", ["示例公司介绍", "示例数字工厂方案", "示例资料归档制度", "示例SaaS服务协议", "示例宣传资料", "示例项目验收模板"]],
  ["document", "产品设计", ["示例移动排产产品设计", "示例工业软件交互规范"]],
  ["ip", "知识产权", ["示例生产数据处理方法", "示例设备异常预警装置", "示例仓储调度方法", "示例ERP管理软件", "示例MES执行软件", "示例品牌商标"]],
  ["governance", "治理资产", ["示例续费事项", "示例低利用率清单", "示例闲置设备清单", "示例移动排产设计", "示例访问审计策略"]]
];

function makeIpProfile(title: string, owner: UserRecord): AssetRecord["ipProfile"] {
  if (title.includes("商标")) return undefined;
  const copyright = title.includes("软件");
  const obtainedAt = copyright ? "2025-03-18" : "2024-05-22";
  return {
    kind: copyright ? "software_copyright" : "patent",
    patentType: copyright ? undefined : title.includes("装置") ? "utility_model" : "invention",
    shortName: copyright ? title.replace(/^汉脑/, "").replace(/软件$/, "") : "",
    applicationNumber: copyright ? "" : `CN${obtainedAt.replaceAll("-", "")}01`,
    publicationNumber: copyright ? "" : `CN${obtainedAt.slice(0, 4)}000001A`,
    registrationNumber: copyright ? `2025SR${String(title.length * 137).padStart(6, "0")}` : "",
    certificateNumber: copyright ? `软著登字第${title.length * 913}号` : `专利证字第${title.length * 827}号`,
    legalStatus: copyright ? "registered" : "granted",
    rightsHolder: "浙江汉脑数智科技有限公司",
    applicationAgency: "研发与产品中心",
    agency: "合作知识产权代理机构",
    applicationDate: copyright ? "2024-10-16" : "2023-05-22",
    acceptedAt: copyright ? "2025-02-12" : "2023-06-06",
    obtainedAt,
    expiresAt: copyright ? "2075-12-31" : "2043-05-21",
    annualFeeDueAt: copyright ? undefined : "2026-10-30",
    completedAt: copyright ? "2024-09-30" : undefined,
    firstPublishedAt: copyright ? "2024-11-18" : undefined,
    nextReviewAt: copyright ? "2026-10-01" : undefined,
    primaryOwnerId: owner.id,
    primaryOwnerName: owner.name,
    collaboratorIds: ["user-demo-document"].filter((id) => id !== owner.id),
    collaboratorNames: ["演示资料员"].filter((name) => name !== owner.name),
    technicalSummary: copyright ? undefined : `${title}的技术方案、实施路径和成果边界。`,
    claimsSummary: copyright ? undefined : "核心权利要求及其与产品能力的对应关系。",
    productVersion: copyright ? "V1.0" : undefined,
    functionalDescription: copyright ? `${title}对应的软件功能、模块组成和发布内容。` : undefined,
    notes: "由知识产权台账统一维护。",
    reminderSystemIds: ["sys-daling"]
  };
}

function makeAsset(type: AssetType, category: string, title: string, index: number): AssetRecord {
  const owner = users[index % users.length];
  const isReview = index % 17 === 0;
  const isDraft = !isReview && index % 13 === 0;
  const published = !isReview && !isDraft;
  const id = `asset-${type}-${String(index + 1).padStart(3, "0")}`;
  return {
    id,
    portalKey: title,
    code: `HN-${type.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
    type,
    title,
    category,
    summary: `${title}的无形资产沉淀、责任归属、资料证据和复用信息。`,
    ownerId: owner.id,
    ownerName: owner.name,
    departmentId: owner.departmentId,
    departmentName: owner.departmentName,
    sensitivity: index % 11 === 0 ? "confidential" : index % 7 === 0 ? "department" : "company",
    channel: index % 3 === 0 ? "both" : "internal",
    status: isReview ? "reviewing" : isDraft ? "draft" : "published",
    version: published ? `V${1 + (index % 4)}.${index % 10}` : "V0.1",
    amount: 120000 + index * 38000,
    showAmountPublic: index % 5 === 0,
    publicFields: ["summary", "version", "attachments", ...(index % 5 === 0 ? ["amount" as const] : [])],
    featured: index < 8,
    sortOrder: index + 1,
    attachments: [
      {
        id: `file-${type}-${index}-1`,
        name: `${title}-资料说明.pdf`,
        mimeType: "application/pdf",
        size: 1024 * (220 + index * 8),
        version: 1,
        publicMode: index % 3 === 0 ? "registered" : "preview",
        visibility: index % 3 === 0 ? "public" : "internal",
        materialType: type === "ip" ? "证书" : "资料说明",
        isCurrent: true,
        storageKey: `seed/${type}/${id}/overview.pdf`,
        createdAt: now()
      }
    ],
    audienceTemplates: [
      {
        id: `aud-${id}`,
        subjectType: "department",
        subjectId: owner.departmentId,
        subjectName: owner.departmentName,
        actions: ["view", "preview", "download"]
      }
    ],
    systemIds: index % 6 === 0 ? ["sys-erp", "sys-mes"] : index % 4 === 0 ? ["sys-daling"] : [],
    ipProfile: type === "ip" ? makeIpProfile(title, owner) : undefined,
    lockVersion: 1,
    createdAt: daysFromNow(-(260 + index * 3)),
    updatedAt: daysFromNow(-([12, 28, 46, 75, 104, 138, 186, 224][index % 8]))
  };
}

let assetIndex = 0;
const assets = assetGroups.flatMap(([type, category, names]) => names.map((name) => makeAsset(type, category, name, assetIndex++)));

const systems: ExternalSystemRecord[] = [
  { id: "sys-erp", name: "汉脑ERP", code: "ERP", status: "active", baseUrl: "https://erp.internal.example", taskTemplateId: "tpl-erp", credentialHint: "client_erp_****32", lastCheckedAt: now() },
  { id: "sys-mes", name: "汉脑MES", code: "MES", status: "active", baseUrl: "https://mes.internal.example", taskTemplateId: "tpl-mes", credentialHint: "client_mes_****91", lastCheckedAt: now() },
  { id: "sys-daling", name: "达铃协同", code: "DALING", status: "warning", baseUrl: "https://daling.internal.example", taskTemplateId: "tpl-daling", credentialHint: "client_daling_****08", lastCheckedAt: now() }
];

const taskTemplates: TaskTemplateRecord[] = systems.map((system, index) => ({
  id: system.taskTemplateId,
  name: `${system.name}资产评审任务`,
  systemId: system.id,
  taskType: index === 2 ? "ASSET_COLLABORATION" : "PROJECT_ASSET",
  projectCode: `${system.code}-ASSET`,
  titleTemplate: "[无形资产] {{asset.title}} {{revision.version}}",
  ownerField: "asset.ownerId",
  version: 1,
  enabled: true
}));

const reviews: ReviewRecord[] = assets.filter((asset) => asset.status === "reviewing").map((asset, index) => ({
  id: `review-${index + 1}`,
  assetId: asset.id,
  assetTitle: asset.title,
  revisionId: `${asset.id}-r${asset.lockVersion}`,
  submitterId: asset.ownerId,
  submitterName: asset.ownerName,
  reviewerId: index % 2 ? "user-demo-reviewer-a" : "user-demo-reviewer-b",
  reviewerName: index % 2 ? "演示审核员甲" : "演示审核员乙",
  status: "pending",
  submittedAt: new Date(Date.now() - (index + 1) * 86400000).toISOString()
}));

const usageProfiles = [
  ["ERP", 32, 9, 18],
  ["MES", 27, 7, 16],
  ["示例工业联网平台", 24, 5, 12],
  ["示例数字工厂方案", 18, 11, 3],
  ["WMS", 16, 4, 9],
  ["达铃", 13, 2, 8]
] as const;

const usageLogs: AuditRecord[] = usageProfiles.flatMap(([title, views, downloads, calls], profileIndex) => {
  const asset = assets.find((item) => item.title === title)!;
  const createLogs = (kind: "portal" | "download" | "system", count: number, offset: number) => Array.from({ length: count }, (_, index) => ({
    id: `log-usage-${profileIndex}-${kind}-${index}`,
    kind,
    actorId: kind === "system" ? "system-client" : users[(profileIndex + index) % users.length].id,
    actorName: kind === "system" ? "业务系统" : users[(profileIndex + index) % users.length].name,
    departmentName: asset.departmentName,
    action: kind === "portal" ? "查看资产详情" : kind === "download" ? "下载资产资料" : "系统调用资产",
    targetType: "asset",
    targetId: asset.id,
    targetName: asset.title,
    result: "success" as const,
    ip: "127.0.0.1",
    device: kind === "system" ? "connector" : "Chrome / macOS",
    requestId: randomUUID(),
    detail: "初始化使用记录",
    createdAt: daysFromNow(-((index * 3 + offset + profileIndex) % 28))
  }));
  return [...createLogs("portal", views, 0), ...createLogs("download", downloads, 1), ...createLogs("system", calls, 2)];
});

const logs: AuditRecord[] = [
  {
    id: "log-seed-login",
    kind: "login",
    actorId: users[0].id,
    actorName: users[0].name,
    departmentName: users[0].departmentName,
    action: "登录成功",
    targetType: "session",
    targetId: "admin",
    targetName: "无形资产管理后台",
    result: "success",
    ip: "127.0.0.1",
    device: "Chrome / macOS",
    requestId: randomUUID(),
    detail: "初始化审计记录",
    createdAt: now()
  },
  ...usageLogs
];

const expenseCategories: Array<[MaintenanceExpenseRecord["category"], string, number, number]> = [
  ["telecom", "企业通信与电话服务", 4600, 5000],
  ["network", "办公与机房网络专线", 12800, 14000],
  ["cloud", "云服务器与对象存储", 28600, 30000],
  ["software_subscription", "软件订阅与域名证书", 9200, 10000],
  ["ip_application", "专利与软著申请服务", 18000, 22000],
  ["ip_annual_fee", "专利年费与资料复核", 7600, 9000]
];

const maintenanceExpenses: MaintenanceExpenseRecord[] = Array.from({ length: 6 }, (_, monthIndex) => expenseCategories.map(([category, name, baseAmount, budgetAmount], categoryIndex) => {
  const period = monthKey(monthIndex - 5);
  const owner = users[(categoryIndex + 1) % users.length];
  const amount = baseAmount + monthIndex * (categoryIndex + 1) * 180;
  return {
    id: `expense-${period}-${category}`,
    name,
    category,
    period,
    amount,
    budgetAmount,
    vendor: ["中国电信", "企业网络服务商", "云资源服务商", "企业软件服务商", "知识产权代理机构", "知识产权管理机构"][categoryIndex],
    dueDate: monthIndex === 5 ? daysFromNow(categoryIndex === 4 ? 12 : categoryIndex === 2 ? 25 : 40 + categoryIndex) : `${period}-25T00:00:00.000Z`,
    ownerId: owner.id,
    ownerName: owner.name,
    departmentId: owner.departmentId,
    departmentName: owner.departmentName,
    status: (monthIndex === 5 && categoryIndex < 2 ? "pending" : "paid") as MaintenanceExpenseRecord["status"],
    source: (categoryIndex % 2 === 0 ? "kingdee" : "manual") as MaintenanceExpenseRecord["source"],
    kingdeeAccountCode: `6602.${String(categoryIndex + 1).padStart(2, "0")}`,
    kingdeeVoucherNo: monthIndex === 5 && categoryIndex < 2 ? undefined : `KD-${period.replace("-", "")}-${categoryIndex + 1}`,
    relatedAssetIds: category === "cloud" ? assets.filter((item) => ["platform", "saas"].includes(item.type)).slice(0, 4).map((item) => item.id) : category.startsWith("ip_") ? assets.filter((item) => item.type === "ip").slice(0, 3).map((item) => item.id) : [],
    notes: "演示费用，可由金蝶科目与凭证同步替换。",
    createdAt: `${period}-01T00:00:00.000Z`,
    updatedAt: now()
  };
})).flat();

export function createSeedState(): AppState {
  const state: AppState = {
    departments,
    users,
    mappings: [
      { id: "map-1", sourceCode: "ASSET_ADMIN", sourceType: "role", targetRole: "超级管理员", dataScope: "全部资产", enabled: true, updatedAt: now() },
      { id: "map-2", sourceCode: "MODULE_REVIEWER", sourceType: "role", targetRole: "模块审核人", dataScope: "本部门资产", enabled: true, updatedAt: now() },
      { id: "map-3", sourceCode: "ASSET_EDITOR", sourceType: "role", targetRole: "资产维护人", dataScope: "负责资产", enabled: true, updatedAt: now() },
      { id: "map-4", sourceCode: "ASSET_AUDITOR", sourceType: "role", targetRole: "审计员", dataScope: "审计日志", enabled: true, updatedAt: now() }
    ],
    assets,
    ipBusinessVersions: [],
    ipArchiveRevisions: [],
    ipRelations: [],
    ipReminders: [],
    ipMigrationIssues: [],
    maintenanceExpenses,
    reviews,
    systems,
    taskTemplates,
    taskDispatches: [
      {
        id: "dispatch-seed-1",
        idempotencyKey: "asset-software-001-r1:sys-mes:tpl-mes",
        assetId: "asset-software-001",
        assetTitle: "ERP",
        revisionId: "asset-software-001-r1",
        systemId: "sys-mes",
        systemName: "汉脑MES",
        templateId: "tpl-mes",
        status: "failed",
        attempt: 5,
        error: "目标系统负责人字段映射失败",
        createdAt: now(),
        updatedAt: now()
      }
    ],
    releases: [
      { id: "release-103", version: "v1.0.3", title: "三层导航与版本快照增强版", status: "published", assetCount: assets.length, publicAssetCount: assets.filter((asset) => asset.channel === "both").length, publisherName: "演示管理员", publishedAt: "2026-07-24T09:00:00.000Z", changes: ["三层导航", "版本快照", "资产治理入口"] }
    ],
    logs,
    downloadRegistrations: [],
    processedEventIds: [],
    settings: {
      currentVersion: "v1.0.3",
      lastHrSyncAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      nextAccessReviewAt: "2027-01-01T00:00:00.000Z",
      storageDriver: process.env.STORAGE_DRIVER || "local",
      dataDriver: process.env.DATA_DRIVER || "file",
      ipReminderRules: { expiry: [180, 90, 30, 7], annual_fee: [90, 30, 7], document_review: [30, 7] },
      ipDefaultSystemIds: ["sys-daling"],
      displayModules: [
        { id: "company-docs", name: "公司资料分类", visible: true, publicVisible: true, sort: 1, featured: 12, fields: ["title", "count"] },
        { id: "cases", name: "案例资产", visible: true, publicVisible: true, sort: 2, featured: 3, fields: ["title", "summary", "version"] },
        { id: "industries", name: "行业内容", visible: true, publicVisible: true, sort: 3, featured: 8, fields: ["title", "summary"] },
        { id: "platforms", name: "核心平台", visible: true, publicVisible: false, sort: 4, featured: 4, fields: ["title", "summary"] },
        { id: "software", name: "产品矩阵", visible: true, publicVisible: true, sort: 5, featured: 9, fields: ["title", "summary", "version"] },
        { id: "saas", name: "SaaS应用", visible: true, publicVisible: true, sort: 6, featured: 8, fields: ["title", "summary", "version"] },
        { id: "scenes", name: "场景运营库", visible: true, publicVisible: false, sort: 7, featured: 4, fields: ["title", "summary"] },
        { id: "hardware", name: "智能硬件与设备", visible: true, publicVisible: true, sort: 8, featured: 10, fields: ["title", "summary"] }
      ]
    }
  };
  const result = structuredClone(state);
  const bootstrapPhone = process.env.BOOTSTRAP_ADMIN_PHONE;
  const bootstrapAdmin = bootstrapPhone ? result.users.find((user) => user.phone === bootstrapPhone) : undefined;
  if (bootstrapAdmin) {
    result.users.forEach((user) => { user.roleCodes = user.roleCodes.filter((code) => code !== "ASSET_ADMIN"); });
    bootstrapAdmin.roleCodes.push("ASSET_ADMIN");
  }
  return result;
}
