<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Cable,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Copyright,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileText,
  Filter,
  FolderArchive,
  Gauge,
  GitPullRequest,
  Home,
  History,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Link2,
  LogOut,
  Menu,
  Monitor,
  MoreHorizontal,
  PanelTop,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Upload,
  UserRound,
  Users,
  Workflow,
  X
} from "@lucide/vue";
import { ASSET_TYPE_LABELS, IP_KIND_LABELS, IP_LEGAL_STATUS_LABELS, PATENT_TYPE_LABELS, REVISION_STATUS_LABELS, SENSITIVITY_LABELS } from "../../shared/contracts.ts";
import logoUrl from "../../public/assets/brand/hannao-logo-transparent.png";
import { api, download, getToken, isDemoMode, patch, post, remove, setToken } from "./api.js";

const navItems = [
  { id: "dashboard", label: "工作台", icon: LayoutDashboard },
  { id: "assets", label: "资产中心", icon: Boxes },
  { id: "ip", label: "知识产权", icon: Scale },
  { id: "documents", label: "资料与文件", icon: FolderArchive },
  { id: "governance", label: "投入与治理", icon: Gauge },
  { id: "display", label: "展示配置", icon: PanelTop },
  { id: "workflow", label: "审核发布", icon: GitPullRequest },
  { id: "organization", label: "组织与权限", icon: Users },
  { id: "integrations", label: "系统开放", icon: Cable },
  { id: "tasks", label: "系统任务", icon: Workflow },
  { id: "logs", label: "日志与分析", icon: FileArchive },
  { id: "settings", label: "系统管理", icon: Settings }
];

const assetTypeOptions = Object.entries(ASSET_TYPE_LABELS);
const statusOptions = Object.entries(REVISION_STATUS_LABELS);
const sensitivityOptions = Object.entries(SENSITIVITY_LABELS);
const token = ref(getToken());
const currentUser = ref(null);
const activeModule = ref("dashboard");
const openedTabs = ref([{ id: "dashboard", label: "工作台", icon: LayoutDashboard }]);
const loading = ref(false);
const mobileMenu = ref(false);
const toast = reactive({ visible: false, message: "", tone: "success" });
const loginForm = reactive({ phone: "10000000000", password: "Admin@123", busy: false });

const dashboard = ref({ metrics: {}, recentReviews: [], recentLogs: [], recentTasks: [], typeSummary: [] });
const assets = ref([]);
const reviews = ref([]);
const releases = ref([]);
const organization = ref({ departments: [], users: [], mappings: [], settings: {} });
const integrations = ref({ systems: [], templates: [], dispatches: [] });
const logs = ref([]);
const ipWorkspace = ref({ metrics: {}, assets: [], businessVersions: [], archiveRevisions: [], relations: [], reminders: [], migrationIssues: [], reminderRules: {} });
const ipSection = ref("overview");
const ipFilters = reactive({ keyword: "", kind: "", status: "" });
const ipEditor = reactive({ open: false, tab: "basic", saving: false, isNew: false, data: null, detail: null });
const ipUpload = reactive({ materialType: "证书", visibility: "internal", publicMode: "preview", businessVersionId: "", replacesAttachmentId: "" });
const ipVersionForm = reactive({ version: "V1.0", name: "", releasedAt: "", description: "", relatedProductVersion: "", ownerId: "" });
const relationForm = reactive({ ipAssetId: "", relatedAssetId: "", relationType: "supporting", contributionNote: "", quick: false, title: "", kind: "patent", legalStatus: "preparation", referenceNumber: "" });

const filters = reactive({ keyword: "", type: "", status: "", channel: "", page: 1, pageSize: 10 });
const expandedRows = ref(new Set());
const selectedRows = ref(new Set());
const editor = reactive({ open: false, tab: "basic", saving: false, isNew: false, data: null, ipRelations: [] });
const modal = reactive({ open: false, type: "", title: "", data: null, comment: "", decision: "approve", selected: [], busy: false });
const logKind = ref("");
const logFilters = reactive({ keyword: "", date: "" });
const displayFieldOptions = [["title", "名称"], ["summary", "说明"], ["version", "版本"], ["owner", "负责人"], ["department", "部门"], ["amount", "金额"], ["attachments", "附件"]];

const displayModules = ref([
  { id: "company-docs", name: "公司资料分类", visible: true, publicVisible: true, sort: 1, featured: 12 },
  { id: "cases", name: "案例资产", visible: true, publicVisible: true, sort: 2, featured: 3 },
  { id: "industries", name: "行业内容", visible: true, publicVisible: true, sort: 3, featured: 8 },
  { id: "platforms", name: "核心平台", visible: true, publicVisible: false, sort: 4, featured: 4 },
  { id: "software", name: "产品矩阵", visible: true, publicVisible: true, sort: 5, featured: 9 },
  { id: "saas", name: "SaaS应用", visible: true, publicVisible: true, sort: 6, featured: 8 },
  { id: "scenes", name: "场景运营库", visible: true, publicVisible: false, sort: 7, featured: 4 },
  { id: "hardware", name: "智能硬件与设备", visible: true, publicVisible: true, sort: 8, featured: 10 }
]);

const activeNav = computed(() => navItems.find((item) => item.id === activeModule.value) || navItems[0]);
const scopedAssets = computed(() => {
  const scope = activeModule.value === "documents"
    ? ["document", "ip"]
    : activeModule.value === "governance"
      ? ["governance"]
      : ["case", "industry", "platform", "software", "saas", "scene", "hardware", "equipment"];
  const keyword = filters.keyword.trim().toLowerCase();
  return assets.value.filter((asset) => {
    if (!scope.includes(asset.type)) return false;
    if (filters.type && asset.type !== filters.type) return false;
    if (filters.status && asset.status !== filters.status) return false;
    if (filters.channel && asset.channel !== filters.channel) return false;
    if (keyword && !`${asset.title} ${asset.code} ${asset.ownerName} ${asset.departmentName}`.toLowerCase().includes(keyword)) return false;
    return true;
  });
});
const pageCount = computed(() => Math.max(1, Math.ceil(scopedAssets.value.length / filters.pageSize)));
const pagedAssets = computed(() => scopedAssets.value.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize));
const filteredLogs = computed(() => logs.value.filter((log) => {
  if (logKind.value && log.kind !== logKind.value) return false;
  const keyword = logFilters.keyword.trim().toLowerCase();
  if (keyword && !`${log.actorName} ${log.departmentName} ${log.action} ${log.targetName}`.toLowerCase().includes(keyword)) return false;
  if (logFilters.date && !String(log.createdAt).startsWith(logFilters.date)) return false;
  return true;
}));
const filteredIpAssets = computed(() => ipWorkspace.value.assets.filter((asset) => {
  if (ipSection.value === "patents" && asset.ipProfile?.kind !== "patent") return false;
  if (ipSection.value === "copyrights" && asset.ipProfile?.kind !== "software_copyright") return false;
  if (ipFilters.kind && asset.ipProfile?.kind !== ipFilters.kind) return false;
  if (ipFilters.status && asset.ipProfile?.legalStatus !== ipFilters.status) return false;
  const keyword = ipFilters.keyword.trim().toLowerCase();
  return !keyword || `${asset.title} ${asset.code} ${asset.ipProfile?.applicationNumber || ""} ${asset.ipProfile?.registrationNumber || ""} ${asset.ipProfile?.primaryOwnerName || ""}`.toLowerCase().includes(keyword);
}));
const relationTargetAssets = computed(() => assets.value.filter((asset) => ["case", "platform", "software", "saas", "scene", "hardware", "equipment"].includes(asset.type)));

function notify(message, tone = "success") {
  toast.message = message;
  toast.tone = tone;
  toast.visible = true;
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => { toast.visible = false; }, 2800);
}

function formatDate(value, withTime = true) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", withTime ? { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false } : { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
}

function formatSize(value) {
  const size = Number(value || 0);
  return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

async function login() {
  loginForm.busy = true;
  try {
    const result = await post("/auth/login", loginForm);
    setToken(result.token);
    token.value = result.token;
    currentUser.value = result.user;
    await hydrate();
    notify("登录成功");
  } catch (error) {
    notify(error.message, "error");
  } finally {
    loginForm.busy = false;
  }
}

function logout() {
  setToken("");
  token.value = "";
  currentUser.value = null;
}

async function hydrate() {
  loading.value = true;
  try {
    const [me, dashboardData, assetData, reviewData, releaseData, organizationData, integrationData, logData, displayData, ipData] = await Promise.all([
      api("/auth/me"), api("/dashboard"), api("/assets"), api("/workflow/reviews"), api("/workflow/releases"), api("/organization"), api("/integrations"), api("/logs"), api("/display-config"), api("/ip-assets/workspace")
    ]);
    currentUser.value = me;
    dashboard.value = dashboardData;
    assets.value = assetData;
    reviews.value = reviewData;
    releases.value = releaseData;
    organization.value = organizationData;
    integrations.value = integrationData;
    logs.value = logData;
    displayModules.value = displayData;
    ipWorkspace.value = ipData;
  } catch (error) {
    if (error.status === 401) logout();
    notify(error.message, "error");
  } finally {
    loading.value = false;
  }
}

function switchModule(id) {
  activeModule.value = id;
  editor.open = false;
  ipEditor.open = false;
  filters.page = 1;
  mobileMenu.value = false;
  if (!openedTabs.value.some((tab) => tab.id === id)) {
    const item = navItems.find((nav) => nav.id === id);
    openedTabs.value.push(item);
  }
}

function closeTab(id) {
  if (id === "dashboard") return;
  const index = openedTabs.value.findIndex((tab) => tab.id === id);
  openedTabs.value = openedTabs.value.filter((tab) => tab.id !== id);
  if (activeModule.value === id) switchModule(openedTabs.value[Math.max(0, index - 1)]?.id || "dashboard");
}

function resetFilters() {
  Object.assign(filters, { keyword: "", type: "", status: "", channel: "", page: 1 });
}

function toggleExpanded(id) {
  const next = new Set(expandedRows.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedRows.value = next;
}

function toggleSelected(id) {
  const next = new Set(selectedRows.value);
  next.has(id) ? next.delete(id) : next.add(id);
  selectedRows.value = next;
}

function newAsset() {
  const defaults = activeModule.value === "documents" ? { type: "document", category: "资料资产" } : activeModule.value === "governance" ? { type: "governance", category: "治理资产" } : { type: "case", category: "案例资产" };
  editor.data = { ...defaults, title: "", code: "", summary: "", ownerId: currentUser.value.id, ownerName: currentUser.value.name, departmentId: currentUser.value.departmentId, departmentName: currentUser.value.departmentName, sensitivity: "company", channel: "internal", version: "V0.1", amount: 0, showAmountPublic: false, publicFields: ["summary", "version", "attachments"], featured: false, systemIds: [], attachments: [], audienceTemplates: [], lockVersion: 0 };
  editor.isNew = true;
  editor.open = true;
  editor.tab = "basic";
  editor.ipRelations = [];
}

async function editAsset(asset) {
  editor.data = cloneData(asset);
  editor.data.publicFields ||= ["summary", "version", "attachments", ...(editor.data.showAmountPublic ? ["amount"] : [])];
  editor.isNew = false;
  editor.open = true;
  editor.tab = "basic";
  editor.ipRelations = [];
  if (["case", "platform", "software", "saas", "scene", "hardware", "equipment"].includes(asset.type)) {
    try { editor.ipRelations = await api(`/assets/${asset.id}/ip-relations`); }
    catch (error) { notify(error.message, "error"); }
  }
}

function emptyIpProfile(kind = "patent") {
  return {
    kind,
    patentType: kind === "patent" ? "invention" : undefined,
    shortName: "",
    applicationNumber: "",
    publicationNumber: "",
    registrationNumber: "",
    certificateNumber: "",
    legalStatus: "preparation",
    rightsHolder: "浙江汉脑数智科技有限公司",
    applicationAgency: "",
    agency: "",
    applicationDate: "",
    acceptedAt: "",
    obtainedAt: "",
    expiresAt: "",
    annualFeeDueAt: "",
    completedAt: "",
    firstPublishedAt: "",
    nextReviewAt: "",
    primaryOwnerId: currentUser.value.id,
    primaryOwnerName: currentUser.value.name,
    collaboratorIds: [],
    collaboratorNames: [],
    technicalSummary: "",
    claimsSummary: "",
    productVersion: kind === "software_copyright" ? "V1.0" : "",
    functionalDescription: "",
    notes: "",
    reminderSystemIds: ["sys-daling"]
  };
}

function newIpAsset(kind = "patent") {
  ipEditor.data = {
    type: "ip", title: "", code: "", category: kind === "patent" ? "专利" : "软件著作权", summary: "",
    ownerId: currentUser.value.id, ownerName: currentUser.value.name, departmentId: currentUser.value.departmentId, departmentName: currentUser.value.departmentName,
    sensitivity: "company", channel: "internal", version: "V0.1", amount: 0, showAmountPublic: false,
    publicFields: ["summary", "version", "attachments"], featured: false, systemIds: [], attachments: [], audienceTemplates: [], lockVersion: 0,
    ipProfile: emptyIpProfile(kind)
  };
  ipEditor.detail = { businessVersions: [], archiveRevisions: [], relations: [], reminders: [] };
  ipEditor.isNew = true;
  ipEditor.open = true;
  ipEditor.tab = "basic";
  Object.assign(ipVersionForm, { version: "V1.0", name: "", releasedAt: "", description: "", relatedProductVersion: "", ownerId: currentUser.value.id });
}

async function editIpAsset(asset) {
  try {
    const detail = await api(`/ip-assets/${asset.id}`);
    ipEditor.data = cloneData(detail.asset);
    ipEditor.detail = cloneData(detail);
    ipEditor.isNew = false;
    ipEditor.open = true;
    ipEditor.tab = "basic";
    Object.assign(ipVersionForm, { version: "V1.0", name: "", releasedAt: "", description: "", relatedProductVersion: "", ownerId: detail.asset.ipProfile.primaryOwnerId });
  } catch (error) { notify(error.message, "error"); }
}

async function saveIpAsset(submitAfter = false) {
  if (!ipEditor.data.title.trim()) return notify("请输入知识产权名称", "error");
  ipEditor.saving = true;
  try {
    const saved = ipEditor.isNew ? await post("/ip-assets", ipEditor.data) : await patch(`/ip-assets/${ipEditor.data.id}`, ipEditor.data);
    ipEditor.data = cloneData(saved);
    ipEditor.isNew = false;
    if (submitAfter) {
      await post(`/assets/${saved.id}/submit-review`, {});
      ipEditor.open = false;
      notify("知识产权档案已提交审核");
    } else {
      notify("知识产权档案已保存");
      ipEditor.detail = cloneData(await api(`/ip-assets/${saved.id}`));
    }
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
  finally { ipEditor.saving = false; }
}

async function saveAsset(submitAfter = false) {
  if (!editor.data.title.trim()) return notify("请输入资产名称", "error");
  editor.saving = true;
  try {
    const saved = editor.isNew
      ? await post("/assets", editor.data)
      : await patch(`/assets/${editor.data.id}`, editor.data);
    editor.data = cloneData(saved);
    editor.isNew = false;
    if (submitAfter) {
      await post(`/assets/${saved.id}/submit-review`, {});
      notify("已提交模块审核");
      editor.open = false;
    } else notify("资产已保存");
    await hydrate();
  } catch (error) {
    notify(error.message, "error");
  } finally {
    editor.saving = false;
  }
}

async function archiveAsset(asset) {
  modal.open = true;
  modal.type = "archive";
  modal.title = "归档资产";
  modal.data = asset;
  modal.comment = "";
}

async function openAccessPreview(asset) {
  try {
    modal.data = await api(`/assets/${asset.id}/access-preview`);
    modal.title = `${asset.title} · 权限预览`;
    modal.type = "access";
    modal.open = true;
  } catch (error) { notify(error.message, "error"); }
}

function openDecision(review, decision) {
  modal.open = true;
  modal.type = "decision";
  modal.title = decision === "approve" ? "审核通过" : "审核驳回";
  modal.data = review;
  modal.decision = decision;
  modal.comment = "";
}

function openRelease() {
  const latest = releases.value[0]?.version || "v1.0.3";
  const numbers = latest.replace("v", "").split(".").map(Number);
  modal.open = true;
  modal.type = "release";
  modal.title = "发布新版本";
  modal.data = { version: `v${numbers[0]}.${numbers[1]}.${numbers[2] + 1}`, title: "资产内容与权限更新", changes: "" };
}

async function confirmModal() {
  modal.busy = true;
  try {
    if (modal.type === "decision") {
      await post(`/workflow/reviews/${modal.data.id}/decision`, { decision: modal.decision, comment: modal.comment });
      notify(modal.decision === "approve" ? "审核通过，系统任务已自动创建" : "已驳回并通知维护人");
    } else if (modal.type === "release") {
      await post("/workflow/releases", { version: modal.data.version, title: modal.data.title, changes: modal.data.changes.split("\n").filter(Boolean) });
      notify("内部与公开双渠道快照已生成");
    } else if (modal.type === "archive") {
      await remove(`/assets/${modal.data.id}`);
      notify("资产已归档，目标任务已发送作废通知");
    } else if (modal.type === "fields") {
      modal.data.fields = [...modal.selected];
      notify("字段配置已更新，请保存展示配置");
      modal.open = false;
      return;
    }
    modal.open = false;
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
  finally { modal.busy = false; }
}

async function saveDisplayConfig() {
  try {
    displayModules.value = await patch("/display-config", { modules: displayModules.value });
    notify("展示配置已保存，将在下次发布快照时生效");
  } catch (error) { notify(error.message, "error"); }
}

function openFieldConfig(module) {
  modal.open = true;
  modal.type = "fields";
  modal.title = `${module.name} · 公开字段`;
  modal.data = module;
  modal.selected = [...(module.fields || [])];
}

function toggleModalField(field) {
  const next = new Set(modal.selected);
  next.has(field) ? next.delete(field) : next.add(field);
  modal.selected = [...next];
}

async function downloadPublicPackage() {
  try {
    await download("/workflow/public-package", `hannao-public-${organization.value.settings.currentVersion || "current"}.json`);
    notify("公开静态数据包已下载");
  } catch (error) { notify(error.message, "error"); }
}

async function rollbackRelease(release) {
  if (!window.confirm(`确认回滚到 ${release.version}？资产内容和展示配置将恢复到该版本快照。`)) return;
  try {
    await post(`/workflow/releases/${release.id}/rollback`, {});
    notify(`已回滚到 ${release.version}`);
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function testSystem(system) {
  try {
    const result = await post(`/integrations/systems/${system.id}/test`, {});
    notify(`连接测试通过，耗时 ${result.latencyMs}ms`);
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

function openDetail(title, data) {
  modal.open = true;
  modal.type = "detail";
  modal.title = title;
  modal.data = data;
}

function exportLogs() {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["时间", "类型", "操作人", "部门", "行为", "对象", "来源", "结果", "请求编号", "详情"], ...filteredLogs.value.map((log) => [log.createdAt, log.kind, log.actorName, log.departmentName, log.action, log.targetName, `${log.ip} ${log.device}`, log.result, log.requestId, log.detail])];
  const blob = new Blob(["\ufeff", rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hannao-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createBackup() {
  try {
    const result = await post("/system-management/backup", {});
    notify(`备份与恢复校验完成：${result.path}`);
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

function previewPublicPortal() {
  const portalUrl = import.meta.env.VITE_PORTAL_URL || "http://127.0.0.1:5173/app.html";
  window.open(`${portalUrl}${portalUrl.includes("?") ? "&" : "?"}portalMode=public`, "_blank", "noopener");
}

async function syncHr() {
  try {
    const result = await post("/organization/sync", {});
    notify(`达铃同步完成：${result.syncedUsers} 人`);
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function retryTask(task) {
  try {
    await post(`/integrations/dispatches/${task.id}/retry`, {});
    notify("任务已重新创建");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function uploadAttachment(event) {
  const file = event.target.files?.[0];
  if (!file || !editor.data?.id) return;
  const form = new FormData();
  form.append("file", file);
  try {
    await post(`/files/upload/${editor.data.id}`, form);
    notify("附件上传完成");
    editor.data = cloneData(await api(`/assets/${editor.data.id}`));
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
  event.target.value = "";
}

async function uploadIpAttachment(event) {
  const file = event.target.files?.[0];
  if (!file || !ipEditor.data?.id) return;
  const form = new FormData();
  form.append("file", file);
  form.append("materialType", ipUpload.materialType);
  form.append("visibility", ipUpload.visibility);
  form.append("publicMode", ipUpload.publicMode);
  if (ipUpload.businessVersionId) form.append("businessVersionId", ipUpload.businessVersionId);
  if (ipUpload.replacesAttachmentId) form.append("replacesAttachmentId", ipUpload.replacesAttachmentId);
  try {
    await post(`/files/upload/${ipEditor.data.id}`, form);
    const detail = await api(`/ip-assets/${ipEditor.data.id}`);
    ipEditor.data = cloneData(detail.asset);
    ipEditor.detail = cloneData(detail);
    Object.assign(ipUpload, { replacesAttachmentId: "", businessVersionId: "" });
    notify("知识产权材料已上传并生成文件版本");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
  event.target.value = "";
}

async function addIpVersion() {
  if (!ipEditor.data?.id) return notify("请先保存知识产权档案", "error");
  try {
    await post(`/ip-assets/${ipEditor.data.id}/business-versions`, ipVersionForm);
    ipEditor.detail = cloneData(await api(`/ip-assets/${ipEditor.data.id}`));
    Object.assign(ipVersionForm, { version: "", name: "", releasedAt: "", description: "", relatedProductVersion: "", ownerId: ipEditor.data.ipProfile.primaryOwnerId });
    notify("业务版本已新增");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function bindExistingIp(fromIpEditor = false) {
  const relatedAssetId = fromIpEditor ? relationForm.relatedAssetId : editor.data?.id;
  const ipAssetId = fromIpEditor ? ipEditor.data?.id : relationForm.ipAssetId;
  if (!relatedAssetId || !ipAssetId) return notify("请选择要绑定的知识产权和资产", "error");
  try {
    await post(`/assets/${relatedAssetId}/ip-relations`, { ipAssetId, relationType: relationForm.relationType, contributionNote: relationForm.contributionNote });
    if (fromIpEditor) ipEditor.detail = cloneData(await api(`/ip-assets/${ipEditor.data.id}`));
    else editor.ipRelations = await api(`/assets/${editor.data.id}/ip-relations`);
    Object.assign(relationForm, { ipAssetId: "", relatedAssetId: "", relationType: "supporting", contributionNote: "" });
    notify("已建立待审核知识产权关联");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function quickCreateAndBindIp() {
  if (!editor.data?.id || !relationForm.title.trim()) return notify("请先保存资产并填写知识产权名称", "error");
  const profile = emptyIpProfile(relationForm.kind);
  profile.legalStatus = relationForm.legalStatus;
  if (relationForm.kind === "patent") profile.applicationNumber = relationForm.referenceNumber;
  else profile.registrationNumber = relationForm.referenceNumber;
  try {
    await post(`/assets/${editor.data.id}/ip-relations/quick-create`, { title: relationForm.title, ipProfile: profile, relationType: relationForm.relationType, contributionNote: relationForm.contributionNote });
    editor.ipRelations = await api(`/assets/${editor.data.id}/ip-relations`);
    Object.assign(relationForm, { quick: false, title: "", kind: "patent", legalStatus: "preparation", referenceNumber: "", contributionNote: "" });
    notify("知识产权草稿已创建并绑定");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function removeIpBinding(relation, fromIpEditor = false) {
  if (!window.confirm("确认解除这条知识产权关联？已发布关联将在审核发布后生效。")) return;
  try {
    await remove(`/assets/${relation.relatedAssetId}/ip-relations/${relation.id}`);
    if (fromIpEditor) ipEditor.detail = cloneData(await api(`/ip-assets/${ipEditor.data.id}`));
    else editor.ipRelations = await api(`/assets/${editor.data.id}/ip-relations`);
    notify("解除申请已保存");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

async function completeIpReminder(reminder) {
  const note = window.prompt("填写处理结果", "已完成缴费或资料复核");
  if (note === null) return;
  try {
    await post(`/ip-assets/reminders/${reminder.id}/complete`, { note });
    notify("提醒已完成");
    await hydrate();
    if (ipEditor.data?.id === reminder.ipAssetId) ipEditor.detail = cloneData(await api(`/ip-assets/${ipEditor.data.id}`));
  } catch (error) { notify(error.message, "error"); }
}

async function exportIpAssets() {
  try {
    await download("/ip-assets/export", `hannao-ip-assets-${new Date().toISOString().slice(0, 10)}.csv`);
    notify("知识产权台账已导出");
  } catch (error) { notify(error.message, "error"); }
}

async function resolveMigrationIssue(issue) {
  const target = relationTargetAssets.value.find((asset) => asset.title === issue.relatedName) || relationTargetAssets.value[0];
  if (!target) return notify("没有可用于绑定的资产", "error");
  try {
    await post(`/ip-assets/migration-issues/${issue.id}/resolve`, { relatedAssetId: target.id });
    notify("历史绑定已确认，等待随资产审核发布");
    await hydrate();
  } catch (error) { notify(error.message, "error"); }
}

function toggleSystem(systemId, target = editor.data) {
  const list = new Set(target.systemIds || []);
  list.has(systemId) ? list.delete(systemId) : list.add(systemId);
  target.systemIds = [...list];
}

function toggleIpReminderSystem(systemId) {
  const list = new Set(ipEditor.data.ipProfile.reminderSystemIds || []);
  list.has(systemId) ? list.delete(systemId) : list.add(systemId);
  ipEditor.data.ipProfile.reminderSystemIds = [...list];
}

function syncPublicAmountField() {
  const fields = new Set(editor.data.publicFields || []);
  editor.data.showAmountPublic ? fields.add("amount") : fields.delete("amount");
  editor.data.publicFields = [...fields];
}

function statusTone(status) {
  if (["published", "approved", "created", "success", "active"].includes(status)) return "success";
  if (["reviewing", "pending", "retrying", "warning"].includes(status)) return "warning";
  if (["rejected", "failed", "denied", "disabled"].includes(status)) return "danger";
  return "neutral";
}

onMounted(async () => {
  if (token.value) await hydrate();
});
</script>

<template>
  <div v-if="!token" class="login-screen">
    <section class="login-brand">
      <img :src="logoUrl" alt="汉脑科技" />
      <div>
        <b>汉脑无形资产</b>
        <span>管理后台</span>
      </div>
      <div class="login-brand-lines" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p>资产归档 · 权限治理 · 审核发布 · 系统协同</p>
    </section>
    <form class="login-panel" @submit.prevent="login">
      <div class="login-title">
        <span><LockKeyhole :size="18" /></span>
        <div><h1>账号登录</h1><p>{{ isDemoMode ? 'GitHub Pages 在线演示' : '使用达铃同步的手机号' }}</p></div>
      </div>
      <label><span>手机号码</span><div class="input-with-icon"><Smartphone :size="17" /><input v-model="loginForm.phone" inputmode="numeric" autocomplete="username" /></div></label>
      <label><span>登录密码</span><div class="input-with-icon"><KeyRound :size="17" /><input v-model="loginForm.password" type="password" autocomplete="current-password" /></div></label>
      <div class="login-options"><label><input type="checkbox" checked /> 保持本次登录</label><button type="button">忘记密码</button></div>
      <button class="primary login-submit" type="submit" :disabled="loginForm.busy"><RefreshCw v-if="loginForm.busy" class="spin" :size="18" /><ShieldCheck v-else :size="18" />登录管理后台</button>
      <div class="login-state" :class="{ demo: isDemoMode }"><CircleCheck :size="15" />{{ isDemoMode ? '演示数据仅保存在当前浏览器' : '达铃组织同步服务正常' }}</div>
    </form>
  </div>

  <div v-else class="admin-shell">
    <header class="topbar">
      <button class="mobile-menu" type="button" aria-label="打开导航" @click="mobileMenu = !mobileMenu"><Menu :size="20" /></button>
      <div class="top-brand"><img :src="logoUrl" alt="汉脑科技" /><span>无形资产管理</span></div>
      <button class="home-button" type="button" title="返回工作台" @click="switchModule('dashboard')"><Home :size="19" /></button>
      <nav class="workspace-tabs" aria-label="已打开页面">
        <button v-for="tab in openedTabs" :key="tab.id" :class="{ active: activeModule === tab.id }" type="button" @click="switchModule(tab.id)">
          <component :is="tab.icon" :size="15" /><span>{{ tab.label }}</span><X v-if="tab.id !== 'dashboard'" :size="14" @click.stop="closeTab(tab.id)" />
        </button>
      </nav>
      <div class="top-actions">
        <span v-if="isDemoMode" class="demo-chip">演示环境</span>
        <span class="version-chip">{{ organization.settings?.currentVersion || 'v1.0.3' }}</span>
        <button type="button" title="运行状态"><Monitor :size="18" /></button>
        <button type="button" title="刷新数据" @click="hydrate"><RefreshCw :class="{ spin: loading }" :size="18" /></button>
        <button type="button" title="消息待办"><Bell :size="18" /><i v-if="reviews.filter(item => item.status === 'pending').length"></i></button>
        <button type="button" title="退出登录" @click="logout"><LogOut :size="18" /></button>
      </div>
    </header>

    <aside class="sidebar" :class="{ open: mobileMenu }">
      <button v-for="item in navItems" :key="item.id" :class="{ active: activeModule === item.id }" type="button" @click="switchModule(item.id)">
        <span><component :is="item.icon" :size="22" /></span><em>{{ item.label }}</em>
        <b v-if="item.id === 'workflow' && reviews.filter(review => review.status === 'pending').length">{{ reviews.filter(review => review.status === 'pending').length }}</b>
        <b v-if="item.id === 'tasks' && integrations.dispatches.filter(task => task.status === 'failed').length">{{ integrations.dispatches.filter(task => task.status === 'failed').length }}</b>
        <b v-if="item.id === 'ip' && (ipWorkspace.reminders.filter(reminder => reminder.status === 'open').length + ipWorkspace.migrationIssues.filter(issue => issue.status === 'pending').length)">{{ ipWorkspace.reminders.filter(reminder => reminder.status === 'open').length + ipWorkspace.migrationIssues.filter(issue => issue.status === 'pending').length }}</b>
      </button>
    </aside>
    <button v-if="mobileMenu" class="mobile-scrim" type="button" aria-label="关闭导航" @click="mobileMenu = false"></button>

    <main class="workspace">
      <template v-if="ipEditor.open">
        <div class="editor-header ip-editor-header">
          <button type="button" title="返回知识产权台账" @click="ipEditor.open = false"><ArrowLeft :size="20" /></button>
          <div><h1>{{ ipEditor.isNew ? '新增知识产权' : ipEditor.data.title }}</h1><p>{{ ipEditor.data.code || '保存后生成内部编号' }} · {{ IP_KIND_LABELS[ipEditor.data.ipProfile.kind] }} · {{ REVISION_STATUS_LABELS[ipEditor.data.status] || '草稿' }}</p></div>
          <div class="editor-actions"><button type="button" :disabled="ipEditor.saving" @click="saveIpAsset(false)"><Save :size="17" />保存草稿</button><button class="primary" type="button" :disabled="ipEditor.saving" @click="saveIpAsset(true)"><Send :size="17" />提交审核</button></div>
        </div>
        <nav class="editor-tabs ip-editor-tabs">
          <button v-for="tab in [{id:'basic',label:'档案信息'},{id:'versions',label:'业务版本'},{id:'relations',label:'关联资产'},{id:'files',label:'证书材料'},{id:'access',label:'访问与系统'},{id:'reminders',label:'期限与年费'},{id:'history',label:'修订历史'}]" :key="tab.id" :class="{ active: ipEditor.tab === tab.id }" type="button" @click="ipEditor.tab = tab.id">{{ tab.label }}</button>
        </nav>

        <form class="editor-form ip-editor-form" @submit.prevent>
          <template v-if="ipEditor.tab === 'basic'">
            <div class="form-section-title"><h2>知识产权基本档案</h2><span>获得时间、期限和编号均以已确认资料为准</span></div>
            <div class="form-grid three-columns">
              <label><span>档案类型 *</span><select v-model="ipEditor.data.ipProfile.kind" @change="ipEditor.data.category = ipEditor.data.ipProfile.kind === 'patent' ? '专利' : '软件著作权'"><option v-for="(label, value) in IP_KIND_LABELS" :key="value" :value="value">{{ label }}</option></select></label>
              <label><span>内部编号</span><input v-model="ipEditor.data.code" placeholder="系统自动生成" /></label>
              <label><span>法律状态 *</span><select v-model="ipEditor.data.ipProfile.legalStatus"><option v-for="(label, value) in IP_LEGAL_STATUS_LABELS" :key="value" :value="value">{{ label }}</option></select></label>
              <label class="wide-two"><span>{{ ipEditor.data.ipProfile.kind === 'patent' ? '专利名称' : '软件全称' }} *</span><input v-model="ipEditor.data.title" /></label>
              <label><span>简称</span><input v-model="ipEditor.data.ipProfile.shortName" /></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'patent'"><span>专利类型</span><select v-model="ipEditor.data.ipProfile.patentType"><option v-for="(label, value) in PATENT_TYPE_LABELS" :key="value" :value="value">{{ label }}</option></select></label>
              <label><span>{{ ipEditor.data.ipProfile.kind === 'patent' ? '申请号' : '登记号' }}</span><input v-if="ipEditor.data.ipProfile.kind === 'patent'" v-model="ipEditor.data.ipProfile.applicationNumber" /><input v-else v-model="ipEditor.data.ipProfile.registrationNumber" /></label>
              <label><span>{{ ipEditor.data.ipProfile.kind === 'patent' ? '公开号' : '证书号' }}</span><input v-if="ipEditor.data.ipProfile.kind === 'patent'" v-model="ipEditor.data.ipProfile.publicationNumber" /><input v-else v-model="ipEditor.data.ipProfile.certificateNumber" /></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'patent'"><span>证书号</span><input v-model="ipEditor.data.ipProfile.certificateNumber" /></label>
              <label><span>权利人 / 著作权人</span><input v-model="ipEditor.data.ipProfile.rightsHolder" /></label>
              <label><span>主负责人 *</span><select v-model="ipEditor.data.ipProfile.primaryOwnerId"><option v-for="user in organization.users" :key="user.id" :value="user.id">{{ user.name }} · {{ user.position }}</option></select></label>
              <label><span>协同人</span><select v-model="ipEditor.data.ipProfile.collaboratorIds" multiple><option v-for="user in organization.users" :key="user.id" :value="user.id">{{ user.name }} · {{ user.departmentName }}</option></select></label>
              <label><span>负责部门</span><select v-model="ipEditor.data.departmentId" @change="ipEditor.data.departmentName = organization.departments.find(dept => dept.id === ipEditor.data.departmentId)?.name || ipEditor.data.departmentName"><option v-for="dept in organization.departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option></select></label>
            </div>
            <div class="form-section-title"><h2>时间与机构</h2><span>系统只按确认日期提醒，不代替法律期限判断</span></div>
            <div class="form-grid three-columns">
              <label><span>申请日期</span><input v-model="ipEditor.data.ipProfile.applicationDate" type="date" /></label>
              <label><span>受理日期</span><input v-model="ipEditor.data.ipProfile.acceptedAt" type="date" /></label>
              <label><span>获得 / 登记时间</span><input v-model="ipEditor.data.ipProfile.obtainedAt" type="date" /></label>
              <label><span>到期时间</span><input v-model="ipEditor.data.ipProfile.expiresAt" type="date" /></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'patent'"><span>下次年费时间</span><input v-model="ipEditor.data.ipProfile.annualFeeDueAt" type="date" /></label>
              <label v-else><span>下次资料复核</span><input v-model="ipEditor.data.ipProfile.nextReviewAt" type="date" /></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'software_copyright'"><span>开发完成日期</span><input v-model="ipEditor.data.ipProfile.completedAt" type="date" /></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'software_copyright'"><span>首次发表日期</span><input v-model="ipEditor.data.ipProfile.firstPublishedAt" type="date" /></label>
              <label><span>申请机构</span><input v-model="ipEditor.data.ipProfile.applicationAgency" /></label>
              <label><span>代理机构</span><input v-model="ipEditor.data.ipProfile.agency" /></label>
            </div>
            <div class="form-section-title"><h2>{{ ipEditor.data.ipProfile.kind === 'patent' ? '技术与权利内容' : '软件版本内容' }}</h2></div>
            <div class="form-grid">
              <label v-if="ipEditor.data.ipProfile.kind === 'software_copyright'"><span>对应软件版本 *</span><input v-model="ipEditor.data.ipProfile.productVersion" /></label>
              <label class="wide"><span>{{ ipEditor.data.ipProfile.kind === 'patent' ? '技术方案摘要' : '主要功能说明' }}</span><textarea v-if="ipEditor.data.ipProfile.kind === 'patent'" v-model="ipEditor.data.ipProfile.technicalSummary" rows="4"></textarea><textarea v-else v-model="ipEditor.data.ipProfile.functionalDescription" rows="4"></textarea></label>
              <label v-if="ipEditor.data.ipProfile.kind === 'patent'" class="wide"><span>权利要求摘要</span><textarea v-model="ipEditor.data.ipProfile.claimsSummary" rows="4"></textarea></label>
              <label class="wide"><span>档案说明</span><textarea v-model="ipEditor.data.summary" rows="4"></textarea></label>
              <label class="wide"><span>内部备注</span><textarea v-model="ipEditor.data.ipProfile.notes" rows="3"></textarea></label>
            </div>
          </template>

          <template v-else-if="ipEditor.tab === 'versions'">
            <div class="form-section-title"><h2>业务版本</h2><span>专利记录技术方案批次，软著记录对应软件版本</span></div>
            <div class="ip-version-list"><div v-for="version in ipEditor.detail?.businessVersions || []" :key="version.id"><span><BookOpen :size="18" /></span><div><b>{{ version.version }} · {{ version.name }}</b><small>{{ formatDate(version.releasedAt, false) }} · {{ version.ownerName }}</small><p>{{ version.description }}</p></div><em>{{ version.relatedProductVersion || '独立版本' }}</em></div><div v-if="!ipEditor.detail?.businessVersions?.length" class="empty-row">暂无业务版本</div></div>
            <div class="form-section-title"><h2>新增业务版本</h2></div>
            <div class="form-grid three-columns">
              <label><span>版本号 *</span><input v-model="ipVersionForm.version" placeholder="V1.0" /></label><label><span>版本名称 *</span><input v-model="ipVersionForm.name" /></label><label><span>发布日期 *</span><input v-model="ipVersionForm.releasedAt" type="date" /></label>
              <label><span>关联产品版本</span><input v-model="ipVersionForm.relatedProductVersion" /></label><label><span>负责人</span><select v-model="ipVersionForm.ownerId"><option v-for="user in organization.users" :key="user.id" :value="user.id">{{ user.name }}</option></select></label>
              <label class="wide"><span>版本内容 *</span><textarea v-model="ipVersionForm.description" rows="4"></textarea></label>
            </div><button class="section-action primary" type="button" :disabled="ipEditor.isNew" @click="addIpVersion"><Plus :size="16" />新增版本</button>
          </template>

          <template v-else-if="ipEditor.tab === 'relations'">
            <div class="form-section-title"><h2>关联案例与应用</h2><span>解除绑定不会删除知识产权本体或证书</span></div>
            <div class="ip-relation-list"><div v-for="relation in ipEditor.detail?.relations || []" :key="relation.id"><span><Link2 :size="18" /></span><div><b>{{ relation.relatedAssetTitle }}</b><small>{{ ASSET_TYPE_LABELS[relation.relatedAssetType] }} · {{ relation.relationType === 'core' ? '核心成果' : relation.relationType === 'derived' ? '衍生成果' : '支撑成果' }}</small><p>{{ relation.contributionNote || '未填写贡献说明' }}</p></div><em :class="`status ${statusTone(relation.status)}`">{{ relation.pendingRemoval ? '待解除' : REVISION_STATUS_LABELS[relation.status] || relation.status }}</em><button type="button" title="解除关联" @click="removeIpBinding(relation, true)"><Trash2 :size="16" /></button></div><div v-if="!ipEditor.detail?.relations?.length" class="empty-row">尚未关联案例或应用</div></div>
            <div class="relation-compose"><label><span>选择资产</span><select v-model="relationForm.relatedAssetId"><option value="">请选择</option><option v-for="asset in relationTargetAssets" :key="asset.id" :value="asset.id">{{ ASSET_TYPE_LABELS[asset.type] }} · {{ asset.title }}</option></select></label><label><span>关系类型</span><select v-model="relationForm.relationType"><option value="core">核心成果</option><option value="supporting">支撑成果</option><option value="derived">衍生成果</option></select></label><label class="grow"><span>贡献说明</span><input v-model="relationForm.contributionNote" /></label><button class="primary" type="button" :disabled="ipEditor.isNew" @click="bindExistingIp(true)"><Link2 :size="16" />建立关联</button></div>
          </template>

          <template v-else-if="ipEditor.tab === 'files'">
            <div class="form-section-title split-title"><div><h2>证书与申请材料</h2><span>新版本不会覆盖原文件，历史版本保留审计</span></div></div>
            <div class="ip-upload-bar"><label><span>材料类型</span><select v-model="ipUpload.materialType"><option v-for="item in (ipEditor.data.ipProfile.kind === 'patent' ? ['证书','受理通知书','申请书','权利要求书','说明书','缴费凭证','代理材料','其他材料'] : ['登记证书','申请表','软件说明书','鉴别材料','版本说明','其他材料'])" :key="item">{{ item }}</option></select></label><label><span>访问范围</span><select v-model="ipUpload.visibility"><option value="internal">仅内部</option><option value="public">公开</option></select></label><label v-if="ipUpload.visibility === 'public'"><span>公开方式</span><select v-model="ipUpload.publicMode"><option value="preview">仅在线查看</option><option value="anonymous">匿名下载</option><option value="registered">登记后下载</option></select></label><label><span>所属业务版本</span><select v-model="ipUpload.businessVersionId"><option value="">不指定</option><option v-for="version in ipEditor.detail?.businessVersions || []" :key="version.id" :value="version.id">{{ version.version }} · {{ version.name }}</option></select></label><label class="upload-button" :class="{ disabled: ipEditor.isNew }"><Upload :size="17" />上传文件<input type="file" :disabled="ipEditor.isNew" @change="uploadIpAttachment" /></label></div>
            <div v-if="ipUpload.replacesAttachmentId" class="impact-banner"><History :size="18" /><span>正在为“{{ ipEditor.data.attachments.find(file => file.id === ipUpload.replacesAttachmentId)?.name }}”上传新版本。</span><button type="button" @click="ipUpload.replacesAttachmentId = ''">取消</button></div>
            <div class="file-list ip-file-list"><div v-for="file in ipEditor.data.attachments" :key="file.id" :class="{ historical: file.isCurrent === false }"><span><FileText :size="20" /></span><div><b>{{ file.name }}</b><small>{{ file.materialType }} · {{ formatSize(file.size) }} · V{{ file.version }} · {{ file.visibility === 'public' ? '公开' : '仅内部' }}</small></div><select v-model="file.materialType"><option v-for="item in ['证书','登记证书','受理通知书','申请书','申请表','权利要求书','说明书','软件说明书','鉴别材料','版本说明','缴费凭证','代理材料','其他材料']" :key="item">{{ item }}</option></select><select v-model="file.visibility"><option value="internal">仅内部</option><option value="public">公开</option></select><select v-if="file.visibility === 'public'" v-model="file.publicMode"><option value="preview">在线查看</option><option value="anonymous">匿名下载</option><option value="registered">登记下载</option></select><em v-else class="status neutral">内部文件</em><button v-if="file.isCurrent !== false" type="button" title="上传新版本" @click="ipUpload.replacesAttachmentId = file.id"><History :size="16" /></button></div><div v-if="!ipEditor.data.attachments.length" class="empty-state compact"><Paperclip :size="30" /><b>暂无证书或申请材料</b></div></div>
            <button class="section-action" type="button" @click="saveIpAsset(false)"><Save :size="16" />保存文件分类与权限</button>
          </template>

          <template v-else-if="ipEditor.tab === 'access'">
            <div class="form-section-title"><h2>公开展示与数据级别</h2><span>公开文件仍需在证书材料中逐项批准</span></div>
            <div class="form-grid"><label><span>发布渠道</span><select v-model="ipEditor.data.channel"><option value="internal">仅内部</option><option value="both">内部并公开</option></select></label><label><span>内部数据级别</span><select v-model="ipEditor.data.sensitivity"><option v-for="item in sensitivityOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label></div>
            <div class="form-section-title"><h2>授权系统</h2><span>读取证书文件必须获得知识产权档案的系统授权</span></div>
            <div class="system-selector"><button v-for="system in integrations.systems" :key="system.id" :class="{ selected: ipEditor.data.systemIds.includes(system.id) }" type="button" @click="toggleSystem(system.id, ipEditor.data)"><span><Server :size="20" /></span><div><b>{{ system.name }}</b><small>档案与文件调用</small></div><i><Check :size="15" /></i></button></div>
            <div class="form-section-title"><h2>提醒任务系统</h2><span>到期、年费和接管待办发送到选中系统</span></div>
            <div class="system-selector"><button v-for="system in integrations.systems" :key="system.id" :class="{ selected: ipEditor.data.ipProfile.reminderSystemIds.includes(system.id) }" type="button" @click="toggleIpReminderSystem(system.id)"><span><Bell :size="20" /></span><div><b>{{ system.name }}</b><small>提醒任务连接器</small></div><i><Check :size="15" /></i></button></div>
          </template>

          <template v-else-if="ipEditor.tab === 'reminders'">
            <div class="form-section-title"><h2>期限、年费与资料复核</h2><span>默认到期180/90/30/7天、年费90/30/7天提醒</span></div>
            <div class="ip-reminder-list"><div v-for="reminder in ipEditor.detail?.reminders || []" :key="reminder.id"><span><Clock3 :size="18" /></span><div><b>{{ reminder.type === 'expiry' ? '期限到期' : reminder.type === 'annual_fee' ? '专利年费' : reminder.type === 'owner_handover' ? '负责人接管' : '资料复核' }}</b><small>处理日 {{ formatDate(reminder.dueDate, false) }} · 提前 {{ reminder.offsetDays }} 天</small></div><em :class="`status ${reminder.status === 'completed' ? 'success' : reminder.status === 'open' ? 'warning' : 'neutral'}`">{{ reminder.status === 'completed' ? '已完成' : reminder.status === 'open' ? '待处理' : '已计划' }}</em><button v-if="reminder.status === 'open'" type="button" @click="completeIpReminder(reminder)"><Check :size="16" />完成</button></div><div v-if="!ipEditor.detail?.reminders?.length" class="empty-row">填写期限、年费或复核日期后自动生成提醒</div></div>
          </template>

          <template v-else>
            <div class="form-section-title"><h2>档案修订历史</h2><span>字段、附件、审核与发布记录只追加保留</span></div>
            <div class="ip-history-list"><div v-for="revision in ipEditor.detail?.archiveRevisions || []" :key="revision.id"><span>R{{ revision.revisionNo }}</span><div><b>{{ revision.changes.join('、') }}</b><small>{{ revision.actorName }} · {{ formatDate(revision.createdAt) }}</small></div><em>{{ revision.action }}</em></div><div v-if="!ipEditor.detail?.archiveRevisions?.length" class="empty-row">保存后生成首条修订记录</div></div>
          </template>
        </form>
      </template>

      <template v-else-if="editor.open">
        <div class="editor-header">
          <button type="button" title="返回列表" @click="editor.open = false"><ArrowLeft :size="20" /></button>
          <div><h1>{{ editor.isNew ? '新增无形资产' : editor.data.title }}</h1><p>{{ editor.data.code || '保存后生成资产编号' }} · {{ REVISION_STATUS_LABELS[editor.data.status] || '草稿' }}</p></div>
          <div class="editor-actions"><button type="button" @click="saveAsset(false)"><Save :size="17" />保存草稿</button><button class="primary" type="button" @click="saveAsset(true)"><Send :size="17" />提交审核</button></div>
        </div>
        <nav class="editor-tabs">
          <button v-for="tab in [{id:'basic',label:'基本信息'},{id:'access',label:'访问与发布'},{id:'ip',label:'知识产权',target:true},{id:'systems',label:'系统协同'},{id:'files',label:'附件资料'}].filter(tab => !tab.target || ['case','platform','software','saas','scene','hardware','equipment'].includes(editor.data.type))" :key="tab.id" :class="{ active: editor.tab === tab.id }" type="button" @click="editor.tab = tab.id">{{ tab.label }}</button>
        </nav>

        <form class="editor-form" @submit.prevent>
          <template v-if="editor.tab === 'basic'">
            <div class="form-section-title"><h2>资产基本信息</h2><span>必填项用于首页展示和资产检索</span></div>
            <div class="form-grid">
              <label><span>资产名称 *</span><input v-model="editor.data.title" /></label>
              <label><span>资产编号</span><input v-model="editor.data.code" placeholder="系统自动生成" /></label>
              <label><span>资产类型 *</span><select v-model="editor.data.type"><option v-for="item in assetTypeOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
              <label><span>业务分类</span><input v-model="editor.data.category" /></label>
              <label><span>负责人</span><select v-model="editor.data.ownerId" @change="Object.assign(editor.data, { ownerName: organization.users.find(user => user.id === editor.data.ownerId)?.name || editor.data.ownerName })"><option v-for="user in organization.users" :key="user.id" :value="user.id">{{ user.name }} · {{ user.position }}</option></select></label>
              <label><span>负责部门</span><select v-model="editor.data.departmentId" @change="Object.assign(editor.data, { departmentName: organization.departments.find(dept => dept.id === editor.data.departmentId)?.name || editor.data.departmentName })"><option v-for="dept in organization.departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option></select></label>
              <label><span>当前版本</span><input v-model="editor.data.version" /></label>
              <label><span>投入金额</span><input v-model.number="editor.data.amount" type="number" min="0" /></label>
              <label class="wide"><span>资产说明</span><textarea v-model="editor.data.summary" rows="5"></textarea></label>
            </div>
          </template>

          <template v-else-if="editor.tab === 'access'">
            <div class="form-section-title"><h2>发布渠道与数据级别</h2><span>服务端按最终权限返回字段和附件</span></div>
            <div class="form-grid">
              <label><span>发布渠道</span><select v-model="editor.data.channel"><option value="internal">仅内部</option><option value="both">内部并公开</option></select></label>
              <label><span>内部数据级别</span><select v-model="editor.data.sensitivity"><option v-for="item in sensitivityOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
            </div>
            <div class="setting-lines">
              <label><span><b>公开显示投入金额</b><small>关闭后公开数据包不包含金额字段</small></span><input v-model="editor.data.showAmountPublic" class="switch" type="checkbox" @change="syncPublicAmountField" /></label>
              <label><span><b>首页推荐展示</b><small>仅影响已获授权人员的排序</small></span><input v-model="editor.data.featured" class="switch" type="checkbox" /></label>
            </div>
            <div v-if="editor.data.channel === 'both'" class="form-section-title"><h2>公开字段</h2><span>名称和分类为基础字段，其余字段可逐项开放</span></div>
            <div v-if="editor.data.channel === 'both'" class="public-field-grid"><label v-for="field in displayFieldOptions.filter(item => item[0] !== 'amount')" :key="field[0]"><input v-model="editor.data.publicFields" type="checkbox" :value="field[0]" /><span>{{ field[1] }}</span></label></div>
            <div class="form-section-title split-title"><h2>内部授权模板</h2><button type="button"><Plus :size="16" />新增授权</button></div>
            <div class="permission-table"><div class="permission-head"><span>授权对象</span><span>类型</span><span>查看</span><span>预览</span><span>下载</span></div><div v-for="rule in editor.data.audienceTemplates" :key="rule.id" class="permission-row"><b>{{ rule.subjectName }}</b><span>{{ rule.subjectType === 'department' ? '部门' : rule.subjectType === 'company' ? '公司' : '人员' }}</span><i v-for="action in ['view','preview','download']" :key="action" :class="{ allowed: rule.actions.includes(action) }"><Check :size="14" /></i></div><div v-if="!editor.data.audienceTemplates.length" class="empty-row">尚未配置内部授权模板</div></div>
          </template>

          <template v-else-if="editor.tab === 'ip'">
            <div class="form-section-title"><h2>关联专利与软件著作权</h2><span>证书材料保存在知识产权档案，不重复上传到当前资产</span></div>
            <div class="ip-relation-list"><div v-for="relation in editor.ipRelations" :key="relation.id"><span><Scale :size="18" /></span><div><b>{{ relation.ipAssetTitle }}</b><small>{{ relation.ipKind === 'patent' ? '专利' : '软件著作权' }} · {{ relation.relationType === 'core' ? '核心成果' : relation.relationType === 'derived' ? '衍生成果' : '支撑成果' }}</small><p>{{ relation.contributionNote || '未填写贡献说明' }}</p></div><em :class="`status ${statusTone(relation.status)}`">{{ relation.pendingRemoval ? '待解除' : REVISION_STATUS_LABELS[relation.status] || relation.status }}</em><button type="button" title="解除关联" @click="removeIpBinding(relation)"><Trash2 :size="16" /></button></div><div v-if="!editor.ipRelations.length" class="empty-row">当前资产尚未绑定知识产权</div></div>
            <div class="form-section-title split-title"><div><h2>绑定已有档案</h2><span>可按名称和编号选择已建档专利或软著</span></div><button type="button" @click="relationForm.quick = !relationForm.quick"><Plus :size="16" />{{ relationForm.quick ? '返回绑定已有' : '快速新建' }}</button></div>
            <div v-if="!relationForm.quick" class="relation-compose"><label class="grow"><span>知识产权档案</span><select v-model="relationForm.ipAssetId"><option value="">请选择</option><option v-for="asset in ipWorkspace.assets" :key="asset.id" :value="asset.id">{{ asset.ipProfile.kind === 'patent' ? '专利' : '软著' }} · {{ asset.title }} · {{ asset.code }}</option></select></label><label><span>关系类型</span><select v-model="relationForm.relationType"><option value="core">核心成果</option><option value="supporting">支撑成果</option><option value="derived">衍生成果</option></select></label><label class="grow"><span>贡献说明</span><input v-model="relationForm.contributionNote" placeholder="说明该成果在当前资产中的作用" /></label><button class="primary" type="button" :disabled="editor.isNew" @click="bindExistingIp(false)"><Link2 :size="16" />绑定</button></div>
            <div v-else class="quick-ip-form"><div class="form-grid three-columns"><label><span>类型</span><select v-model="relationForm.kind"><option value="patent">专利</option><option value="software_copyright">软件著作权</option></select></label><label><span>名称 *</span><input v-model="relationForm.title" /></label><label><span>当前状态</span><select v-model="relationForm.legalStatus"><option v-for="(label, value) in IP_LEGAL_STATUS_LABELS" :key="value" :value="value">{{ label }}</option></select></label><label><span>{{ relationForm.kind === 'patent' ? '申请号' : '登记号' }}</span><input v-model="relationForm.referenceNumber" /></label><label><span>关系类型</span><select v-model="relationForm.relationType"><option value="core">核心成果</option><option value="supporting">支撑成果</option><option value="derived">衍生成果</option></select></label><label class="wide"><span>贡献说明</span><textarea v-model="relationForm.contributionNote" rows="3"></textarea></label></div><button class="section-action primary" type="button" :disabled="editor.isNew" @click="quickCreateAndBindIp"><Plus :size="16" />创建草稿并绑定</button></div>
          </template>

          <template v-else-if="editor.tab === 'systems'">
            <div class="form-section-title"><h2>目标系统与项目任务</h2><span>评审通过后自动向选中系统创建新任务</span></div>
            <div class="system-selector">
              <button v-for="system in integrations.systems" :key="system.id" :class="{ selected: editor.data.systemIds.includes(system.id) }" type="button" @click="toggleSystem(system.id)">
                <span><Server :size="20" /></span><div><b>{{ system.name }}</b><small>{{ system.code }} · {{ system.baseUrl }}</small></div><i><Check :size="15" /></i>
              </button>
            </div>
            <div v-if="editor.data.systemIds.length" class="impact-banner"><AlertTriangle :size="18" /><span>资产发布后，后续新增附件将自动继承以上 {{ editor.data.systemIds.length }} 个系统的读取权限。</span></div>
            <div class="form-section-title"><h2>任务生成规则</h2></div>
            <div class="rule-summary"><div><span>触发点</span><b>模块评审通过</b></div><div><span>修订策略</span><b>每个修订新建任务</b></div><div><span>附件交付</span><b>资产链接 + 授权接口</b></div><div><span>失败处理</span><b>5次自动重试</b></div></div>
          </template>

          <template v-else>
            <div class="form-section-title split-title"><div><h2>附件资料</h2><span>文档、图片和视频统一版本管理</span></div><label class="upload-button" :class="{ disabled: editor.isNew }"><Upload :size="17" />上传附件<input type="file" :disabled="editor.isNew" @change="uploadAttachment" /></label></div>
            <div class="file-list">
              <div v-for="file in editor.data.attachments" :key="file.id"><span><FileText :size="20" /></span><div><b>{{ file.name }}</b><small>{{ formatSize(file.size) }} · V{{ file.version }} · {{ formatDate(file.createdAt) }}</small></div><select v-model="file.publicMode"><option value="preview">仅在线查看</option><option value="anonymous">匿名下载</option><option value="registered">登记后下载</option></select><button type="button" title="更多"><MoreHorizontal :size="18" /></button></div>
              <div v-if="!editor.data.attachments.length" class="empty-state compact"><Paperclip :size="30" /><b>暂无附件</b></div>
            </div>
          </template>
        </form>
      </template>

      <template v-else>
        <header class="page-header">
          <div><span>{{ activeNav.label }}</span><h1>{{ activeNav.label }}</h1></div>
          <div class="page-header-actions">
            <button v-if="activeModule === 'organization'" type="button" @click="syncHr"><RefreshCw :size="17" />同步达铃</button>
            <button v-if="activeModule === 'workflow'" class="primary" type="button" @click="openRelease"><Send :size="17" />发布版本</button>
            <button v-if="activeModule === 'ip'" type="button" @click="exportIpAssets"><Download :size="17" />导出台账</button>
            <button v-if="activeModule === 'ip'" class="primary" type="button" @click="newIpAsset('patent')"><Plus :size="17" />新增知识产权</button>
            <button v-if="['assets','documents','governance'].includes(activeModule)" class="primary" type="button" @click="newAsset"><Plus :size="17" />新增资产</button>
          </div>
        </header>

        <section v-if="activeModule === 'dashboard'" class="dashboard-view">
          <div class="metric-grid">
            <button type="button" @click="switchModule('assets')"><span class="blue"><Boxes :size="21" /></span><div><small>资产总数</small><strong>{{ dashboard.metrics.totalAssets || 0 }}</strong><em>全模块在册</em></div></button>
            <button type="button" @click="switchModule('workflow')"><span class="amber"><Clock3 :size="21" /></span><div><small>待审核</small><strong>{{ dashboard.metrics.pendingReviews || 0 }}</strong><em>需要处理</em></div></button>
            <button type="button" @click="switchModule('tasks')"><span class="red"><AlertTriangle :size="21" /></span><div><small>任务异常</small><strong>{{ dashboard.metrics.taskFailures || 0 }}</strong><em>待重试处理</em></div></button>
            <button type="button" @click="switchModule('display')"><span class="green"><ExternalLink :size="21" /></span><div><small>公开资产</small><strong>{{ dashboard.metrics.publicAssets || 0 }}</strong><em>当前发布</em></div></button>
            <button type="button" @click="switchModule('organization')"><span class="violet"><ShieldCheck :size="21" /></span><div><small>权限复核</small><strong>{{ dashboard.metrics.accessReviews || 0 }}</strong><em>下次半年复核</em></div></button>
            <button type="button" @click="switchModule('documents')"><span class="gray"><Paperclip :size="21" /></span><div><small>附件资料</small><strong>{{ dashboard.metrics.attachments || 0 }}</strong><em>受控文件</em></div></button>
          </div>
          <div class="dashboard-layout">
            <section class="work-panel review-panel"><header><div><h2>待审核内容</h2><span>{{ dashboard.recentReviews.length }} 项</span></div><button type="button" @click="switchModule('workflow')">查看全部<ChevronRight :size="16" /></button></header><div class="review-list"><button v-for="review in dashboard.recentReviews" :key="review.id" type="button" @click="switchModule('workflow')"><span class="asset-type-mark"><FileText :size="18" /></span><div><b>{{ review.assetTitle }}</b><small>{{ review.submitterName }} · {{ formatDate(review.submittedAt) }}</small></div><em>待审核</em></button><div v-if="!dashboard.recentReviews.length" class="empty-row">暂无待审核内容</div></div></section>
            <section class="work-panel asset-bars"><header><div><h2>资产构成</h2><span>当前在册</span></div></header><div class="bar-list"><div v-for="item in dashboard.typeSummary" :key="item.type"><span>{{ ASSET_TYPE_LABELS[item.type] }}</span><i><b :style="{ width: `${Math.max(8, item.count / Math.max(...dashboard.typeSummary.map(row => row.count)) * 100)}%` }"></b></i><strong>{{ item.count }}</strong></div></div></section>
            <section class="work-panel task-panel"><header><div><h2>系统任务协同</h2><span>最近创建</span></div><button type="button" @click="switchModule('tasks')">任务中心<ChevronRight :size="16" /></button></header><div class="task-mini-list"><div v-for="task in dashboard.recentTasks" :key="task.id"><span :class="`dot ${statusTone(task.status)}`"></span><div><b>{{ task.assetTitle }}</b><small>{{ task.systemName }} · 第{{ task.attempt }}次</small></div><em :class="`status ${statusTone(task.status)}`">{{ task.status === 'created' ? '已创建' : task.status === 'failed' ? '失败' : '重试中' }}</em></div><div v-if="!dashboard.recentTasks.length" class="empty-row">暂无系统任务</div></div></section>
            <section class="work-panel log-panel"><header><div><h2>最近操作</h2><span>安全审计</span></div><button type="button" @click="switchModule('logs')">审计中心<ChevronRight :size="16" /></button></header><div class="log-mini-list"><div v-for="log in dashboard.recentLogs" :key="log.id"><span><Activity :size="16" /></span><div><b>{{ log.action }}</b><small>{{ log.actorName }} · {{ log.targetName }}</small></div><time>{{ formatDate(log.createdAt) }}</time></div></div></section>
          </div>
        </section>

        <section v-else-if="activeModule === 'ip'" class="ip-workspace-view">
          <nav class="ip-subnav">
            <button v-for="item in [['overview','总览'],['patents','专利台账'],['copyrights','软著台账'],['deadlines','期限与年费'],['versions','版本记录'],['relations','关联资产'],['migration','待确认绑定']]" :key="item[0]" :class="{ active: ipSection === item[0] }" type="button" @click="ipSection = item[0]">{{ item[1] }}<b v-if="item[0] === 'deadlines' && ipWorkspace.reminders.filter(reminder => reminder.status === 'open').length">{{ ipWorkspace.reminders.filter(reminder => reminder.status === 'open').length }}</b><b v-if="item[0] === 'migration' && ipWorkspace.migrationIssues.filter(issue => issue.status === 'pending').length">{{ ipWorkspace.migrationIssues.filter(issue => issue.status === 'pending').length }}</b></button>
          </nav>

          <div v-if="ipSection === 'overview'" class="ip-metric-grid">
            <button type="button" @click="ipSection = 'patents'"><Scale :size="20" /><span>专利</span><strong>{{ ipWorkspace.metrics.patents || 0 }}</strong><small>在册档案</small></button>
            <button type="button" @click="ipSection = 'copyrights'"><Copyright :size="20" /><span>软件著作权</span><strong>{{ ipWorkspace.metrics.copyrights || 0 }}</strong><small>登记档案</small></button>
            <button type="button"><Clock3 :size="20" /><span>申请与审查中</span><strong>{{ ipWorkspace.metrics.applying || 0 }}</strong><small>持续跟进</small></button>
            <button type="button"><CircleCheck :size="20" /><span>已获得</span><strong>{{ ipWorkspace.metrics.obtained || 0 }}</strong><small>授权或登记</small></button>
            <button type="button" @click="ipSection = 'deadlines'"><AlertTriangle :size="20" /><span>180天内到期</span><strong>{{ ipWorkspace.metrics.expiring || 0 }}</strong><small>期限风险</small></button>
            <button type="button" @click="ipSection = 'deadlines'"><Bell :size="20" /><span>年费待处理</span><strong>{{ ipWorkspace.metrics.annualFees || 0 }}</strong><small>已生成任务</small></button>
            <button type="button"><Paperclip :size="20" /><span>资料缺失</span><strong>{{ ipWorkspace.metrics.missingDocuments || 0 }}</strong><small>无证书材料</small></button>
          </div>

          <template v-if="['overview','patents','copyrights'].includes(ipSection)">
            <div class="filter-bar ip-filter-bar"><label><span>关键字</span><div><Search :size="16" /><input v-model="ipFilters.keyword" placeholder="名称 / 编号 / 负责人" /></div></label><label><span>知识产权类型</span><select v-model="ipFilters.kind"><option value="">全部类型</option><option v-for="(label, value) in IP_KIND_LABELS" :key="value" :value="value">{{ label }}</option></select></label><label><span>法律状态</span><select v-model="ipFilters.status"><option value="">全部状态</option><option v-for="(label, value) in IP_LEGAL_STATUS_LABELS" :key="value" :value="value">{{ label }}</option></select></label><div class="filter-actions"><button class="primary" type="button"><Search :size="16" />查询</button><button type="button" @click="Object.assign(ipFilters, { keyword:'', kind:'', status:'' })"><RotateCcw :size="16" />重置</button></div></div>
            <div class="ip-table"><div class="ip-table-head"><span>内部编号</span><span>名称 / 类型</span><span>申请号 / 登记号</span><span>法律状态</span><span>获得时间</span><span>到期 / 复核</span><span>主负责人</span><span>关联</span><span>下次提醒</span><span>操作</span></div><div v-for="asset in filteredIpAssets" :key="asset.id"><b>{{ asset.code }}</b><div><strong>{{ asset.title }}</strong><small>{{ asset.ipProfile.kind === 'patent' ? PATENT_TYPE_LABELS[asset.ipProfile.patentType] : asset.ipProfile.productVersion || '软件版本待补' }}</small></div><span>{{ asset.ipProfile.applicationNumber || asset.ipProfile.registrationNumber || '-' }}</span><em :class="`status ${['granted','registered'].includes(asset.ipProfile.legalStatus) ? 'success' : ['rejected','expired','abandoned'].includes(asset.ipProfile.legalStatus) ? 'danger' : 'warning'}`">{{ IP_LEGAL_STATUS_LABELS[asset.ipProfile.legalStatus] }}</em><span>{{ formatDate(asset.ipProfile.obtainedAt, false) }}</span><span>{{ formatDate(asset.ipProfile.expiresAt || asset.ipProfile.nextReviewAt, false) }}</span><span>{{ asset.ipProfile.primaryOwnerName }}<small>{{ asset.departmentName }}</small></span><span>{{ asset.relationCount }} 项</span><span>{{ asset.nextReminder ? formatDate(asset.nextReminder.remindAt, false) : '-' }}</span><div class="row-actions"><button type="button" title="查看并编辑" @click="editIpAsset(asset)"><Pencil :size="16" /></button><button type="button" title="权限预览" @click="openAccessPreview(asset)"><Eye :size="16" /></button></div></div><div v-if="!filteredIpAssets.length" class="empty-state"><Scale :size="34" /><b>没有符合条件的知识产权档案</b></div></div>
          </template>

          <section v-else-if="ipSection === 'deadlines'" class="work-panel ip-panel"><header><div><h2>期限、年费与资料复核</h2><span>提醒日期由系统规则生成，处理日期以人工确认档案为准</span></div></header><div class="ip-reminder-table"><div class="head"><span>知识产权</span><span>提醒类型</span><span>处理日期</span><span>提醒节点</span><span>负责人</span><span>任务系统</span><span>状态</span><span>操作</span></div><div v-for="reminder in ipWorkspace.reminders" :key="reminder.id"><b>{{ reminder.ipAssetTitle }}</b><span>{{ reminder.type === 'expiry' ? '期限到期' : reminder.type === 'annual_fee' ? '专利年费' : reminder.type === 'owner_handover' ? '负责人接管' : '资料复核' }}</span><span>{{ formatDate(reminder.dueDate, false) }}</span><span>提前 {{ reminder.offsetDays }} 天</span><span>{{ reminder.ownerName }}</span><span>{{ reminder.systemIds.map(id => integrations.systems.find(system => system.id === id)?.name).filter(Boolean).join('、') || '后台待办' }}</span><em :class="`status ${reminder.status === 'completed' ? 'success' : reminder.status === 'open' ? 'warning' : 'neutral'}`">{{ reminder.status === 'completed' ? '已完成' : reminder.status === 'open' ? '待处理' : '已计划' }}</em><button v-if="reminder.status === 'open'" type="button" @click="completeIpReminder(reminder)"><Check :size="16" />完成</button><button v-else type="button" @click="editIpAsset(ipWorkspace.assets.find(asset => asset.id === reminder.ipAssetId))"><Eye :size="16" />档案</button></div></div></section>

          <section v-else-if="ipSection === 'versions'" class="ip-version-overview"><div class="work-panel"><header><div><h2>业务版本记录</h2><span>技术方案与软件发布版本</span></div></header><div class="ip-version-list"><div v-for="version in ipWorkspace.businessVersions" :key="version.id"><span><BookOpen :size="18" /></span><div><b>{{ ipWorkspace.assets.find(asset => asset.id === version.ipAssetId)?.title }} · {{ version.version }}</b><small>{{ version.name }} · {{ formatDate(version.releasedAt, false) }}</small><p>{{ version.description }}</p></div><em>{{ version.ownerName }}</em></div></div></div><div class="work-panel"><header><div><h2>最近档案修订</h2><span>系统自动保存</span></div></header><div class="ip-history-list"><div v-for="revision in ipWorkspace.archiveRevisions.slice(0, 30)" :key="revision.id"><span>R{{ revision.revisionNo }}</span><div><b>{{ ipWorkspace.assets.find(asset => asset.id === revision.ipAssetId)?.title || revision.ipAssetId }}</b><small>{{ revision.changes.join('、') }} · {{ revision.actorName }}</small></div><em>{{ formatDate(revision.createdAt) }}</em></div></div></div></section>

          <section v-else-if="ipSection === 'relations'" class="work-panel ip-panel"><header><div><h2>知识产权与资产关系</h2><span>多对多稳定ID关联</span></div></header><div class="ip-relation-table"><div class="head"><span>知识产权</span><span>类型</span><span>关联资产</span><span>资产类型</span><span>关系</span><span>贡献说明</span><span>状态</span><span>操作</span></div><div v-for="relation in ipWorkspace.relations.filter(item => item.status !== 'archived')" :key="relation.id"><b>{{ relation.ipAssetTitle }}</b><span>{{ relation.ipKind === 'patent' ? '专利' : '软著' }}</span><span>{{ relation.relatedAssetTitle }}</span><span>{{ ASSET_TYPE_LABELS[relation.relatedAssetType] }}</span><span>{{ relation.relationType === 'core' ? '核心成果' : relation.relationType === 'derived' ? '衍生成果' : '支撑成果' }}</span><span>{{ relation.contributionNote }}</span><em :class="`status ${statusTone(relation.status)}`">{{ relation.pendingRemoval ? '待解除' : REVISION_STATUS_LABELS[relation.status] || relation.status }}</em><button type="button" @click="editIpAsset(ipWorkspace.assets.find(asset => asset.id === relation.ipAssetId))"><Eye :size="16" />查看</button></div></div></section>

          <section v-else class="work-panel ip-panel"><header><div><h2>历史台账待确认绑定</h2><span>只自动处理唯一匹配，避免错误关联</span></div></header><div class="migration-list"><div v-for="issue in ipWorkspace.migrationIssues.filter(item => item.status === 'pending')" :key="issue.id"><span><AlertTriangle :size="18" /></span><div><b>{{ issue.sourceTitle }}</b><small>{{ issue.sourceCode }} · 历史关联“{{ issue.relatedName }}” · {{ issue.reason === 'ambiguous' ? '存在多个候选' : '未找到匹配资产' }}</small></div><button type="button" @click="resolveMigrationIssue(issue)"><Link2 :size="16" />确认绑定</button></div><div v-if="!ipWorkspace.migrationIssues.filter(item => item.status === 'pending').length" class="empty-state"><CircleCheck :size="34" /><b>历史知识产权关联已全部确认</b></div></div></section>
        </section>

        <section v-else-if="['assets','documents','governance'].includes(activeModule)" class="list-view">
          <div class="filter-bar">
            <label><span>关键字</span><div><Search :size="16" /><input v-model="filters.keyword" placeholder="资产名称 / 编号 / 负责人" @keyup.enter="filters.page = 1" /></div></label>
            <label><span>资产类型</span><select v-model="filters.type"><option value="">全部类型</option><option v-for="item in assetTypeOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
            <label><span>处理状态</span><select v-model="filters.status"><option value="">全部状态</option><option v-for="item in statusOptions" :key="item[0]" :value="item[0]">{{ item[1] }}</option></select></label>
            <label><span>发布渠道</span><select v-model="filters.channel"><option value="">全部渠道</option><option value="internal">仅内部</option><option value="both">内部并公开</option></select></label>
            <div class="filter-actions"><button class="primary" type="button" @click="filters.page = 1"><Search :size="16" />查询</button><button type="button" title="重置条件" @click="resetFilters"><RotateCcw :size="16" />重置</button><button type="button"><SlidersHorizontal :size="16" />高级查询</button></div>
          </div>
          <div class="table-toolbar"><span>已选择 <b>{{ selectedRows.size }}</b> 项</span><div><button type="button"><Download :size="16" />导出</button><button type="button"><Filter :size="16" />列设置</button></div></div>
          <div class="data-table asset-table">
            <div class="table-head table-row"><span></span><span><input type="checkbox" /></span><span>#</span><span>资产编号</span><span>资产名称</span><span>类型</span><span>负责人 / 部门</span><span>渠道</span><span>状态</span><span>操作</span></div>
            <template v-for="(asset, index) in pagedAssets" :key="asset.id">
              <div class="table-row"><button type="button" class="expand" @click="toggleExpanded(asset.id)"><ChevronDown v-if="expandedRows.has(asset.id)" :size="16" /><ChevronRight v-else :size="16" /></button><span><input type="checkbox" :checked="selectedRows.has(asset.id)" @change="toggleSelected(asset.id)" /></span><span>{{ (filters.page - 1) * filters.pageSize + index + 1 }}</span><b>{{ asset.code }}</b><div class="asset-name"><strong>{{ asset.title }}</strong><small>{{ asset.version }} · 更新 {{ formatDate(asset.updatedAt) }}</small></div><span>{{ ASSET_TYPE_LABELS[asset.type] }}</span><div class="owner-cell"><b>{{ asset.ownerName }}</b><small>{{ asset.departmentName }}</small></div><span><em class="channel" :class="asset.channel">{{ asset.channel === 'both' ? '内部 / 公开' : '仅内部' }}</em></span><span><em :class="`status ${statusTone(asset.status)}`">{{ REVISION_STATUS_LABELS[asset.status] }}</em></span><div class="row-actions"><button type="button" title="查看权限" @click="openAccessPreview(asset)"><Eye :size="16" /></button><button type="button" title="编辑资产" @click="editAsset(asset)"><Pencil :size="16" /></button><button type="button" title="归档资产" @click="archiveAsset(asset)"><Archive :size="16" /></button></div></div>
              <div v-if="expandedRows.has(asset.id)" class="expanded-row"><div><span>资产说明</span><b>{{ asset.summary }}</b></div><div><span>数据级别</span><b>{{ SENSITIVITY_LABELS[asset.sensitivity] }}</b></div><div><span>投入金额</span><b>{{ formatAmount(asset.amount) }}</b></div><div><span>关联资料</span><b>{{ asset.attachments.length }} 个附件</b></div><div><span>授权系统</span><b>{{ asset.systemIds.length ? asset.systemIds.map(id => integrations.systems.find(system => system.id === id)?.name).join('、') : '未开放' }}</b></div><button type="button" @click="editAsset(asset)">查看完整详情</button></div>
            </template>
            <div v-if="!pagedAssets.length" class="empty-state"><Boxes :size="34" /><b>没有符合条件的资产</b></div>
          </div>
          <footer class="pagination"><span>共 {{ scopedAssets.length }} 项数据</span><div><select v-model.number="filters.pageSize"><option :value="10">10项/页</option><option :value="20">20项/页</option></select><button :disabled="filters.page <= 1" type="button" @click="filters.page--"><ChevronRight class="flip" :size="16" /></button><button v-for="page in pageCount" :key="page" :class="{ active: filters.page === page }" type="button" @click="filters.page = page">{{ page }}</button><button :disabled="filters.page >= pageCount" type="button" @click="filters.page++"><ChevronRight :size="16" /></button></div></footer>
        </section>

        <section v-else-if="activeModule === 'workflow'" class="workflow-view">
          <div class="workflow-summary"><div><span><Clock3 :size="20" /></span><b>{{ reviews.filter(item => item.status === 'pending').length }}</b><small>待审核</small></div><div><span><CircleCheck :size="20" /></span><b>{{ reviews.filter(item => item.status === 'approved').length }}</b><small>已通过</small></div><div><span><CircleX :size="20" /></span><b>{{ reviews.filter(item => item.status === 'rejected').length }}</b><small>已驳回</small></div><div><span><Send :size="20" /></span><b>{{ releases.length }}</b><small>发布版本</small></div></div>
          <section class="work-panel review-queue"><header><div><h2>内容审核队列</h2><span>通过后自动创建目标系统项目任务</span></div></header><div class="review-table"><div class="review-table-head"><span>资产内容</span><span>提交人</span><span>审核人</span><span>提交时间</span><span>状态</span><span>操作</span></div><div v-for="review in reviews" :key="review.id"><div><b>{{ review.assetTitle }}</b><small>{{ review.revisionId }}</small></div><span>{{ review.submitterName }}</span><span>{{ review.reviewerName }}</span><span>{{ formatDate(review.submittedAt) }}</span><em :class="`status ${statusTone(review.status)}`">{{ review.status === 'pending' ? '待审核' : review.status === 'approved' ? '已通过' : '已驳回' }}</em><div class="row-actions"><button v-if="review.status === 'pending'" class="approve" type="button" @click="openDecision(review, 'approve')"><Check :size="16" />通过</button><button v-if="review.status === 'pending'" type="button" @click="openDecision(review, 'reject')"><X :size="16" />驳回</button><button v-else type="button"><Eye :size="16" />详情</button></div></div></div></section>
          <section class="work-panel release-list"><header><div><h2>发布版本</h2><span>内部与公开双渠道快照</span></div></header><div class="release-row" v-for="release in releases" :key="release.id"><span><GitPullRequest :size="19" /></span><div><b>{{ release.version }} · {{ release.title }}</b><small>{{ release.publisherName }} · {{ formatDate(release.publishedAt) }}</small></div><strong>{{ release.assetCount }} 内部 / {{ release.publicAssetCount }} 公开</strong><em :class="`status ${statusTone(release.status)}`">{{ release.status === 'published' ? '已发布' : release.status === 'rolled_back' ? '已回滚' : release.status }}</em><button type="button" @click="downloadPublicPackage"><Download :size="16" />公开包</button><button v-if="release.version !== organization.settings.currentVersion && release.stateSnapshotPath" type="button" @click="rollbackRelease(release)"><RotateCcw :size="16" />回滚</button></div></section>
        </section>

        <section v-else-if="activeModule === 'organization'" class="organization-view">
          <div class="org-summary"><div><Building2 :size="22" /><b>{{ organization.departments.length }}</b><span>组织部门</span></div><div><Users :size="22" /><b>{{ organization.users.length }}</b><span>同步人员</span></div><div><ShieldCheck :size="22" /><b>{{ organization.mappings.length }}</b><span>编码映射</span></div><div><RefreshCw :size="22" /><b>{{ formatDate(organization.settings.lastHrSyncAt) }}</b><span>最近同步</span></div></div>
          <div class="org-layout"><section class="work-panel"><header><div><h2>达铃组织人员</h2><span>手机号用于登录，达铃ID用于永久关联</span></div></header><div class="people-table"><div class="people-head"><span>员工</span><span>部门 / 岗位</span><span>达铃编码</span><span>工作台角色</span><span>状态</span></div><div v-for="person in organization.users" :key="person.id"><div><span class="avatar">{{ person.name.slice(0, 1) }}</span><b>{{ person.name }}<small>{{ person.phone }}</small></b></div><span>{{ person.departmentName }}<small>{{ person.position }}</small></span><span>{{ person.employeeCode }}<small>{{ person.dalingId }}</small></span><span>{{ person.roleCodes.join('、') }}</span><em :class="`status ${statusTone(person.status)}`">{{ person.status === 'active' ? '在职' : '停用' }}</em></div></div></section><section class="work-panel mapping-panel"><header><div><h2>权限编码映射</h2><span>达铃编码生成个人最终权限</span></div></header><div class="mapping-list"><div v-for="mapping in organization.mappings" :key="mapping.id"><span><KeyRound :size="17" /></span><div><b>{{ mapping.sourceCode }}</b><small>{{ mapping.sourceType }} · {{ mapping.dataScope }}</small></div><em>{{ mapping.targetRole }}</em><i :class="{ active: mapping.enabled }"></i></div></div><footer><span>下次权限复核</span><b>{{ formatDate(organization.settings.nextAccessReviewAt, false) }}</b></footer></section></div>
        </section>

        <section v-else-if="activeModule === 'integrations'" class="integration-view">
          <div class="system-grid"><article v-for="system in integrations.systems" :key="system.id"><header><span><Server :size="21" /></span><em :class="`status ${statusTone(system.status)}`">{{ system.status === 'active' ? '连接正常' : '需要检查' }}</em></header><h2>{{ system.name }}</h2><p>{{ system.code }} · {{ system.baseUrl }}</p><dl><div><dt>任务模板</dt><dd>{{ integrations.templates.find(item => item.id === system.taskTemplateId)?.name }}</dd></div><div><dt>客户端凭据</dt><dd>{{ system.credentialHint }}</dd></div><div><dt>最近检查</dt><dd>{{ formatDate(system.lastCheckedAt) }}</dd></div></dl><footer><button type="button" @click="testSystem(system)"><Activity :size="16" />连接测试</button><button type="button" @click="openDetail(`${system.name} · 连接配置`, system)"><Pencil :size="16" />配置</button></footer></article><button class="new-system" type="button" @click="openDetail('登记公司系统', { note: '生产环境登记需配置系统编码、客户端凭据、IP白名单和任务模板版本。' })"><Plus :size="24" /><b>登记公司系统</b></button></div>
          <section class="work-panel template-panel"><header><div><h2>项目任务映射模板</h2><span>每个目标系统独立配置</span></div></header><div class="template-table"><div><b>模板名称</b><b>目标系统</b><b>项目编码</b><b>任务类型</b><b>版本</b><b>状态</b></div><div v-for="template in integrations.templates" :key="template.id"><span>{{ template.name }}</span><span>{{ integrations.systems.find(system => system.id === template.systemId)?.name }}</span><span>{{ template.projectCode }}</span><span>{{ template.taskType }}</span><span>V{{ template.version }}</span><em :class="`status ${template.enabled ? 'success' : 'neutral'}`">{{ template.enabled ? '已启用' : '停用' }}</em></div></div></section>
        </section>

        <section v-else-if="activeModule === 'tasks'" class="tasks-view">
          <div class="task-stats"><div><CircleCheck :size="20" /><b>{{ integrations.dispatches.filter(item => item.status === 'created').length }}</b><span>创建成功</span></div><div><RefreshCw :size="20" /><b>{{ integrations.dispatches.filter(item => item.status === 'retrying').length }}</b><span>自动重试</span></div><div><AlertTriangle :size="20" /><b>{{ integrations.dispatches.filter(item => item.status === 'failed').length }}</b><span>人工处理</span></div><div><Archive :size="20" /><b>{{ integrations.dispatches.filter(item => item.status === 'invalidated').length }}</b><span>作废通知</span></div></div>
          <section class="work-panel task-list"><header><div><h2>系统项目任务</h2><span>每个资产修订、每个目标系统独立建单</span></div></header><div class="task-table"><div class="task-head"><span>资产 / 修订</span><span>目标系统</span><span>目标任务</span><span>尝试次数</span><span>更新时间</span><span>状态</span><span>操作</span></div><div v-for="task in integrations.dispatches" :key="task.id"><div><b>{{ task.assetTitle }}</b><small>{{ task.revisionId }}</small></div><span>{{ task.systemName }}</span><span><a v-if="task.externalUrl" :href="task.externalUrl" target="_blank">{{ task.externalTaskId }}<ExternalLink :size="13" /></a><small v-else>{{ task.error || '等待创建' }}</small></span><span>{{ task.attempt }} / 5</span><span>{{ formatDate(task.updatedAt) }}</span><em :class="`status ${statusTone(task.status)}`">{{ task.status === 'created' ? '已创建' : task.status === 'failed' ? '失败' : task.status === 'invalidated' ? '已作废' : '重试中' }}</em><div><button v-if="task.status === 'failed'" type="button" @click="retryTask(task)"><RefreshCw :size="16" />重试</button><button v-else type="button" @click="openDetail(`${task.assetTitle} · 任务详情`, task)"><Eye :size="16" />详情</button></div></div></div></section>
        </section>

        <section v-else-if="activeModule === 'logs'" class="logs-view">
          <div class="log-tabs"><button v-for="item in [['','全部日志'],['login','登录日志'],['operation','操作日志'],['permission','权限日志'],['portal','访问日志'],['download','下载日志'],['system','系统调用'],['task','任务日志']]" :key="item[0]" :class="{ active: logKind === item[0] }" type="button" @click="logKind = item[0]">{{ item[1] }}</button></div>
          <div class="filter-bar compact-filter"><label><span>操作人员</span><div><Search :size="16" /><input v-model="logFilters.keyword" placeholder="姓名 / 部门" /></div></label><label><span>发生时间</span><input v-model="logFilters.date" type="date" /></label><div class="filter-actions"><button class="primary" type="button"><Search :size="16" />查询</button><button type="button" @click="exportLogs"><Download :size="16" />权限内导出</button></div></div>
          <div class="log-table"><div class="log-head"><span>时间</span><span>类型</span><span>操作人 / 部门</span><span>行为</span><span>对象</span><span>来源</span><span>结果</span><span>详情</span></div><div v-for="log in filteredLogs.slice(0, 50)" :key="log.id"><span>{{ formatDate(log.createdAt) }}</span><span>{{ log.kind }}</span><span>{{ log.actorName }}<small>{{ log.departmentName }}</small></span><b>{{ log.action }}</b><span>{{ log.targetName }}</span><span>{{ log.ip }}<small>{{ log.device }}</small></span><em :class="`status ${statusTone(log.result)}`">{{ log.result === 'success' ? '成功' : log.result === 'denied' ? '拒绝' : '失败' }}</em><button type="button" title="查看详情" @click="openDetail(`${log.action} · 审计详情`, log)"><Eye :size="16" /></button></div></div>
        </section>

        <section v-else-if="activeModule === 'display'" class="display-view">
          <div class="display-toolbar"><div><Monitor :size="19" /><span>当前发布版本</span><b>{{ organization.settings.currentVersion }}</b></div><div><button type="button" @click="previewPublicPortal"><Eye :size="16" />公开访客预览</button><button type="button" @click="openDetail('指定人员权限预览', { note: '请在资产列表点击眼睛图标，可查看公开访客、公司员工、负责部门、指定人员和授权系统五种最终权限。' })"><UserRound :size="16" />指定人员预览</button><button class="primary" type="button" @click="saveDisplayConfig"><Save :size="16" />保存配置</button></div></div>
          <div class="display-table"><div class="display-head"><span>排序</span><span>首页模块</span><span>内部显示</span><span>公开显示</span><span>推荐数量</span><span>操作</span></div><div v-for="module in displayModules" :key="module.id"><b>{{ module.sort }}</b><span>{{ module.name }}</span><input v-model="module.visible" class="switch" type="checkbox" /><input v-model="module.publicVisible" class="switch" type="checkbox" /><input v-model.number="module.featured" type="number" min="0" max="30" /><button type="button" @click="openFieldConfig(module)"><Pencil :size="16" />配置字段</button></div></div>
          <section class="preview-strip"><header><h2>三层导航配置</h2><button type="button"><Plus :size="16" />新增入口</button></header><div><span v-for="label in ['公司资料','案例资产','行业内容','核心平台','产品矩阵','SaaS应用','场景运营库','智能硬件','智能设备','资产治理','版本留痕']" :key="label">{{ label }}</span></div></section>
        </section>

        <section v-else class="settings-view">
          <div class="settings-section"><header><h2>运行服务</h2><span>本地开发环境</span></header><div class="service-list"><div><span class="service-icon"><Database :size="20" /></span><div><b>数据持久化</b><small>{{ organization.settings.dataDriver === 'postgres' ? 'PostgreSQL' : '本地文件适配器' }}</small></div><em class="status success">正常</em></div><div><span class="service-icon"><FolderArchive :size="20" /></span><div><b>文件存储</b><small>{{ organization.settings.storageDriver === 'minio' ? 'MinIO对象存储' : '本地文件适配器' }}</small></div><em class="status success">正常</em></div><div><span class="service-icon"><RefreshCw :size="20" /></span><div><b>达铃组织同步</b><small>模拟全量API + 变更回调</small></div><em class="status success">正常</em></div><div><span class="service-icon"><Activity :size="20" /></span><div><b>公网匿名采集</b><small>独立白名单事件服务</small></div><em class="status warning">本地模拟</em></div></div></div>
          <div class="settings-grid"><section><header><h2>备份策略</h2><button type="button" @click="createBackup"><RefreshCw :size="16" />立即备份</button></header><dl><div><dt>日备份</dt><dd>保留30天</dd></div><div><dt>月备份</dt><dd>保留12个月</dd></div><div><dt>恢复演练</dt><dd>每季度</dd></div><div><dt>最近验证</dt><dd>{{ organization.settings.lastBackupAt ? formatDate(organization.settings.lastBackupAt) : '待首次执行' }}</dd></div></dl></section><section><header><h2>日志保留</h2></header><dl><div><dt>安全审计</dt><dd>5年</dd></div><div><dt>行为明细</dt><dd>1年</dd></div><div><dt>过期处理</dt><dd>汇总归档</dd></div><div><dt>记录模式</dt><dd>只追加</dd></div></dl></section><section><header><h2>文件安全</h2></header><dl><div><dt>机密预览</dt><dd>动态水印</dd></div><div><dt>机密下载</dt><dd>动态水印</dd></div><div><dt>下载地址</dt><dd>5分钟有效</dd></div><div><dt>原始文件</dt><dd>受审计访问</dd></div></dl></section></div>
        </section>
      </template>
    </main>

    <div v-if="modal.open" class="modal-backdrop" @click.self="modal.open = false">
      <section class="modal" :class="`modal-${modal.type}`" role="dialog" aria-modal="true">
        <header><h2>{{ modal.title }}</h2><button type="button" aria-label="关闭" @click="modal.open = false"><X :size="20" /></button></header>
        <template v-if="modal.type === 'decision'"><div class="modal-notice"><AlertTriangle v-if="modal.decision === 'approve'" :size="18" /><CircleX v-else :size="18" /><span>{{ modal.decision === 'approve' ? '通过后将冻结当前修订，并自动向已授权系统创建项目任务。' : '驳回后资产返回维护人，需修改后重新提交。' }}</span></div><label class="modal-field"><span>审核意见</span><textarea v-model="modal.comment" rows="5" :placeholder="modal.decision === 'approve' ? '填写评审结论' : '请填写驳回原因'"></textarea></label></template>
        <template v-else-if="modal.type === 'release'"><div class="modal-notice"><Send :size="18" /><span>发布将同时生成内部快照与公开静态数据包。</span></div><div class="modal-grid"><label><span>版本号</span><input v-model="modal.data.version" /></label><label><span>版本标题</span><input v-model="modal.data.title" /></label><label class="wide"><span>修改内容</span><textarea v-model="modal.data.changes" rows="5" placeholder="每行一项修改内容"></textarea></label></div></template>
        <template v-else-if="modal.type === 'archive'"><div class="archive-confirm"><Archive :size="34" /><h3>确认归档“{{ modal.data.title }}”</h3><p>资产不会物理删除。已创建的目标系统任务将保留，并追加修订作废说明。</p></div></template>
        <template v-else-if="modal.type === 'access'"><div class="access-preview"><article><header><ExternalLink :size="18" /><b>公开访客</b></header><p>{{ modal.data.public.visible ? '可查看公开内容' : '不可查看' }}</p><span>金额：{{ modal.data.public.amountVisible ? '显示' : '隐藏' }}</span><span>附件：{{ modal.data.public.attachments.length }} 项</span></article><article><header><Building2 :size="18" /><b>公司员工</b></header><p>{{ modal.data.company.visible ? '可查看内部内容' : '不可查看' }}</p><span>金额：显示</span><span>{{ modal.data.company.actions?.join('、') }}</span></article><article><header><Users :size="18" /><b>负责部门</b></header><p>{{ modal.data.department.department }}</p><span>{{ modal.data.department.actions?.join('、') }}</span></article><article><header><UserRound :size="18" /><b>指定人员</b></header><p>{{ modal.data.person.owner }}</p><span>{{ modal.data.person.actions?.join('、') }}</span></article><article class="wide"><header><Server :size="18" /><b>公司系统</b></header><div v-if="modal.data.systems.length" v-for="system in modal.data.systems" :key="system.system"><b>{{ system.system }}</b><span>{{ system.fields }} · {{ system.attachments }}</span></div><p v-else>未向公司系统开放</p></article></div></template>
        <template v-else-if="modal.type === 'fields'"><div class="field-checkbox-grid"><button v-for="field in displayFieldOptions" :key="field[0]" :class="{ selected: modal.selected.includes(field[0]) }" type="button" @click="toggleModalField(field[0])"><i><Check :size="15" /></i><span>{{ field[1] }}</span></button></div></template>
        <template v-else-if="modal.type === 'detail'"><div class="detail-record"><div v-for="(value, key) in modal.data" :key="key"><span>{{ key }}</span><b>{{ Array.isArray(value) ? value.join('、') : typeof value === 'object' && value !== null ? JSON.stringify(value) : value }}</b></div></div></template>
        <footer v-if="!['access','detail'].includes(modal.type)"><button type="button" @click="modal.open = false">取消</button><button class="primary" type="button" :disabled="modal.busy" @click="confirmModal"><Check :size="17" />确认</button></footer>
      </section>
    </div>
    <div v-if="toast.visible" class="toast" :class="toast.tone"><CircleCheck v-if="toast.tone === 'success'" :size="18" /><CircleX v-else :size="18" />{{ toast.message }}</div>
  </div>
</template>
