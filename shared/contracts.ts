export const ASSET_TYPES = [
  "case",
  "industry",
  "platform",
  "software",
  "saas",
  "scene",
  "hardware",
  "equipment",
  "document",
  "ip",
  "governance"
] as const;

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  case: "案例资产",
  industry: "行业内容",
  platform: "核心平台",
  software: "产品矩阵",
  saas: "SaaS应用",
  scene: "场景运营库",
  hardware: "智能硬件",
  equipment: "智能设备",
  document: "资料资产",
  ip: "知识产权",
  governance: "治理资产"
};

export const SENSITIVITY_LABELS = {
  company: "内部公开",
  department: "部门可见",
  confidential: "机密",
  restricted: "严格受限"
} as const;

export const REVISION_STATUS_LABELS = {
  draft: "草稿",
  reviewing: "待审核",
  approved: "已评审",
  published: "已发布",
  rejected: "已驳回",
  archived: "已归档"
} as const;

export const ACCESS_ACTIONS = ["view", "preview", "download", "system_call"] as const;
export const PUBLIC_FIELDS = ["summary", "version", "owner", "department", "amount", "attachments"] as const;

export const IP_KIND_LABELS = {
  patent: "专利",
  software_copyright: "软件著作权"
} as const;

export const PATENT_TYPE_LABELS = {
  invention: "发明专利",
  utility_model: "实用新型",
  design: "外观设计"
} as const;

export const IP_LEGAL_STATUS_LABELS = {
  preparation: "准备申请",
  applied: "已申请",
  accepted: "已受理",
  reviewing: "审查中",
  granted: "已授权",
  registered: "已登记",
  rejected: "已驳回",
  expired: "已到期",
  abandoned: "已放弃"
} as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type Sensitivity = keyof typeof SENSITIVITY_LABELS;
export type RevisionStatus = keyof typeof REVISION_STATUS_LABELS;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];
export type PublishChannel = "internal" | "both";
export type PublicDownloadMode = "preview" | "anonymous" | "registered";
export type PublicField = (typeof PUBLIC_FIELDS)[number];
export type IpKind = keyof typeof IP_KIND_LABELS;
export type PatentType = keyof typeof PATENT_TYPE_LABELS;
export type IpLegalStatus = keyof typeof IP_LEGAL_STATUS_LABELS;
export type IpRelationType = "core" | "supporting" | "derived";
export type IpRelationStatus = "draft" | "reviewing" | "approved" | "published" | "rejected" | "archived";
export type IpReminderType = "expiry" | "annual_fee" | "document_review" | "owner_handover";
export type IpFileVisibility = "internal" | "public";
export type MaintenanceExpenseCategory = "telecom" | "network" | "cloud" | "ip_application" | "ip_annual_fee" | "software_subscription" | "other";
export type MaintenanceExpenseStatus = "planned" | "pending" | "paid" | "overdue";

export interface AttachmentRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  version: number;
  publicMode: PublicDownloadMode;
  materialType?: string;
  visibility?: IpFileVisibility;
  businessVersionId?: string;
  isCurrent?: boolean;
  replacesAttachmentId?: string;
  storageKey: string;
  createdAt: string;
}

export interface IpProfile {
  kind: IpKind;
  patentType?: PatentType;
  shortName?: string;
  applicationNumber?: string;
  publicationNumber?: string;
  registrationNumber?: string;
  certificateNumber?: string;
  legalStatus: IpLegalStatus;
  rightsHolder: string;
  applicationAgency?: string;
  agency?: string;
  applicationDate?: string;
  acceptedAt?: string;
  obtainedAt?: string;
  expiresAt?: string;
  annualFeeDueAt?: string;
  completedAt?: string;
  firstPublishedAt?: string;
  nextReviewAt?: string;
  primaryOwnerId: string;
  primaryOwnerName: string;
  collaboratorIds: string[];
  collaboratorNames: string[];
  technicalSummary?: string;
  claimsSummary?: string;
  productVersion?: string;
  functionalDescription?: string;
  notes?: string;
  reminderSystemIds: string[];
  reminderOverrides?: Partial<Record<IpReminderType, number[]>>;
}

export interface IpBusinessVersion {
  id: string;
  ipAssetId: string;
  version: string;
  name: string;
  releasedAt: string;
  description: string;
  relatedProductVersion?: string;
  ownerId: string;
  ownerName: string;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IpArchiveRevision {
  id: string;
  ipAssetId: string;
  revisionNo: number;
  action: "create" | "update" | "file" | "review" | "publish";
  changes: string[];
  snapshot: Record<string, unknown>;
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface IpRelationRecord {
  id: string;
  ipAssetId: string;
  relatedAssetId: string;
  relationType: IpRelationType;
  contributionNote: string;
  status: IpRelationStatus;
  pendingRemoval: boolean;
  removalStatus?: "draft" | "reviewing" | "approved" | "rejected";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface IpReminderRecord {
  id: string;
  ipAssetId: string;
  ipAssetTitle: string;
  type: IpReminderType;
  dueDate: string;
  remindAt: string;
  offsetDays: number;
  status: "scheduled" | "open" | "completed" | "cancelled";
  ownerId: string;
  ownerName: string;
  collaboratorIds: string[];
  systemIds: string[];
  taskDispatchIds: string[];
  generated: boolean;
  triggeredAt?: string;
  completedAt?: string;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IpMigrationIssue {
  id: string;
  sourceCode: string;
  sourceTitle: string;
  relatedName: string;
  reason: "unmatched" | "ambiguous";
  candidateAssetIds: string[];
  status: "pending" | "resolved";
  createdAt: string;
}

export interface AudienceTemplate {
  id: string;
  subjectType: "company" | "department" | "person";
  subjectId: string;
  subjectName: string;
  actions: AccessAction[];
}

export interface MaintenanceExpenseRecord {
  id: string;
  name: string;
  category: MaintenanceExpenseCategory;
  period: string;
  amount: number;
  budgetAmount: number;
  vendor: string;
  dueDate: string;
  ownerId: string;
  ownerName: string;
  departmentId: string;
  departmentName: string;
  status: MaintenanceExpenseStatus;
  source: "manual" | "kingdee";
  kingdeeAccountCode?: string;
  kingdeeVoucherNo?: string;
  relatedAssetIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  portalKey?: string;
  code: string;
  type: AssetType;
  title: string;
  category: string;
  summary: string;
  ownerId: string;
  ownerName: string;
  departmentId: string;
  departmentName: string;
  sensitivity: Sensitivity;
  channel: PublishChannel;
  status: RevisionStatus;
  version: string;
  amount: number;
  showAmountPublic: boolean;
  publicFields: PublicField[];
  featured: boolean;
  sortOrder: number;
  attachments: AttachmentRecord[];
  audienceTemplates: AudienceTemplate[];
  systemIds: string[];
  ipProfile?: IpProfile;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DisplayModuleConfig {
  id: string;
  name: string;
  visible: boolean;
  publicVisible: boolean;
  sort: number;
  featured: number;
  fields: string[];
}

export interface PublicDownloadRegistration {
  id: string;
  assetId: string;
  fileId: string;
  name: string;
  organization: string;
  phone: string;
  purpose: string;
  consent: boolean;
  consentedAt: string;
  grantToken: string;
  expiresAt: string;
}

export interface DalingPersonnelChange {
  eventId: string;
  eventType: "upsert" | "transfer" | "disable";
  dalingId: string;
  name?: string;
  phone?: string;
  employeeCode?: string;
  departmentId?: string;
  departmentCode?: string;
  departmentName?: string;
  position?: string;
  roleCodes?: string[];
  permissionCodes?: string[];
  occurredAt: string;
}

export interface ReviewRecord {
  id: string;
  assetId: string;
  assetTitle: string;
  revisionId: string;
  submitterId: string;
  submitterName: string;
  reviewerId: string;
  reviewerName: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  submittedAt: string;
  decidedAt?: string;
  comment?: string;
}

export interface ExternalSystemRecord {
  id: string;
  name: string;
  code: string;
  status: "active" | "disabled" | "warning";
  baseUrl: string;
  taskTemplateId: string;
  credentialHint: string;
  lastCheckedAt: string;
}

export interface TaskDispatchRecord {
  id: string;
  idempotencyKey: string;
  assetId: string;
  assetTitle: string;
  revisionId: string;
  systemId: string;
  systemName: string;
  templateId: string;
  status: "queued" | "created" | "retrying" | "failed" | "invalidated";
  externalTaskId?: string;
  externalUrl?: string;
  attempt: number;
  nextRetryAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  kind: "login" | "operation" | "permission" | "portal" | "download" | "system" | "task";
  actorId: string;
  actorName: string;
  departmentName: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  result: "success" | "denied" | "failed";
  ip: string;
  device: string;
  requestId: string;
  detail: string;
  createdAt: string;
}

export interface PortalEventInput {
  eventId: string;
  eventType: "module_view" | "detail_view" | "search" | "preview" | "download" | "version_view" | "external_link";
  assetId?: string;
  module?: string;
  source?: string;
  deviceType?: "desktop" | "tablet" | "mobile";
  occurredAt: string;
}

export interface PortalDataset {
  [key: string]: unknown;
  appVersionInfo: {
    currentVersion: string;
    history: Array<Record<string, unknown>>;
  };
  displayConfig?: DisplayModuleConfig[];
  publishedAssets?: Array<Record<string, unknown>>;
  ipAssetRelations?: Record<string, { patents: string[]; copyrights: string[] }>;
}
