import type { AssetRecord, PortalDataset, PublicField } from "../../shared/contracts.js";
import type { AppState, UserRecord } from "./seed.js";

type PortalChannel = "internal" | "public";

const ipStatusLabels: Record<string, string> = {
  preparation: "准备申请", applied: "已申请", accepted: "已受理", reviewing: "审查中", granted: "已授权",
  registered: "已登记", rejected: "已驳回", expired: "已到期", abandoned: "已放弃"
};

const TYPE_MODULE: Record<string, string> = {
  case: "cases",
  industry: "industries",
  platform: "platforms",
  software: "software",
  saas: "saas",
  scene: "scenes",
  hardware: "hardware",
  equipment: "hardware",
  document: "company-docs",
  ip: "company-docs",
  governance: "governance"
};

const normalizeKey = (value = "") => value.replace(/\s+/g, "").replace(/行业库$/, "").toLowerCase();
const clone = <T>(value: T): T => structuredClone(value);

export function canAccessAsset(asset: AssetRecord, user: UserRecord, action: "view" | "preview" | "download" = "view") {
  if (user.roleCodes.some((code) => ["ASSET_ADMIN", "ASSET_AUDITOR"].includes(code))) return true;
  if (asset.ownerId === user.id) return true;
  if (user.roleCodes.includes("MODULE_REVIEWER") && asset.departmentId === user.departmentId) return true;
  return asset.audienceTemplates.some((rule) => {
    if (!rule.actions.includes(action)) return false;
    if (rule.subjectType === "company") return true;
    if (rule.subjectType === "department") return rule.subjectId === user.departmentId;
    return rule.subjectId === user.id;
  });
}

export const canReadAsset = (asset: AssetRecord, user: UserRecord) => canAccessAsset(asset, user, "view");

function includesField(asset: AssetRecord, field: PublicField, channel: PortalChannel) {
  if (channel === "internal") return true;
  if (field === "amount") return asset.showAmountPublic && asset.publicFields.includes("amount");
  return asset.publicFields.includes(field);
}

function visibleAttachments(asset: AssetRecord, channel: PortalChannel) {
  return asset.attachments.filter((file) => file.isCurrent !== false && (channel === "internal" || file.visibility === "public"));
}

function displayAllows(asset: AssetRecord, state: AppState, channel: PortalChannel) {
  const moduleId = TYPE_MODULE[asset.type];
  if (moduleId === "governance") return channel === "internal";
  const module = state.settings.displayModules.find((item) => item.id === moduleId);
  return module ? (channel === "public" ? module.publicVisible : module.visible) : true;
}

function selectedAssets(state: AppState, channel: PortalChannel, user?: UserRecord) {
  return state.assets
    .filter((asset) => asset.status === "published")
    .filter((asset) => channel === "public" ? asset.channel === "both" && !["confidential", "restricted"].includes(asset.sensitivity) : Boolean(user && canReadAsset(asset, user)))
    .filter((asset) => displayAllows(asset, state, channel))
    .sort((left, right) => Number(right.featured) - Number(left.featured) || left.sortOrder - right.sortOrder);
}

function mapByAsset<T>(assets: AssetRecord[], baseline: T[], keyOf: (item: T) => string, convert: (asset: AssetRecord, item?: T) => T) {
  return assets.map((asset) => {
    const wanted = normalizeKey(asset.portalKey || asset.title);
    const found = baseline.find((item) => normalizeKey(keyOf(item)) === wanted);
    return convert(asset, found ? clone(found) : undefined);
  });
}

function rekeyVisuals(source: Record<string, any>, assets: AssetRecord[], channel: PortalChannel) {
  const result: Record<string, any> = {};
  for (const asset of assets) {
    const oldKey = Object.keys(source).find((key) => normalizeKey(key) === normalizeKey(asset.portalKey || asset.title));
    const visual = oldKey ? clone(source[oldKey]) : {};
    if (channel === "public") {
      const summary = includesField(asset, "summary", channel) ? asset.summary : "公开资产资料";
      visual.description = summary;
      visual.detail = summary;
    }
    result[asset.title] = visual;
  }
  return result;
}

function buildDocuments(assets: AssetRecord[]) {
  const groups = new Map<string, Array<[string, number]>>();
  for (const asset of assets.filter((item) => item.type === "document" || item.type === "ip")) {
    const group = asset.type === "ip" ? "知识产权" : asset.category || "资料资产";
    const list = groups.get(group) || [];
    list.push([asset.title, 1]);
    groups.set(group, list);
  }
  const matrix = [...groups.entries()];
  const ledger = Object.fromEntries(matrix.map(([group, items]) => [group, Object.fromEntries(items.map(([title]) => [title, [[title, "后台发布资产", "当前版本", "已发布"]]]))]));
  return {
    companyDocMatrix: matrix,
    docs: matrix.map(([group, items]) => [group, items.map(([title, count]) => [title, count, 0, 0])]),
    docContentLedger: ledger
  };
}

function publicAssetRows(assets: AssetRecord[], channel: PortalChannel) {
  return assets.map((asset) => {
    const row: Record<string, unknown> = {
      id: asset.id,
      code: asset.code,
      type: asset.type,
      title: asset.title,
      category: asset.category,
      channel: asset.channel
    };
    if (includesField(asset, "summary", channel)) row.summary = asset.summary;
    if (includesField(asset, "version", channel)) row.version = asset.version;
    if (includesField(asset, "owner", channel)) row.ownerName = asset.ownerName;
    if (includesField(asset, "department", channel)) row.departmentName = asset.departmentName;
    if (includesField(asset, "amount", channel)) row.amount = asset.amount;
    if (includesField(asset, "attachments", channel)) {
      row.attachments = visibleAttachments(asset, channel).map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        version: file.version,
        publicMode: file.publicMode,
        previewUrl: `/api/portal/assets/${asset.id}/files/${file.id}/preview`,
        downloadUrl: file.publicMode === "anonymous" ? `/api/portal/assets/${asset.id}/files/${file.id}/download` : undefined
      }));
    }
    return row;
  });
}

function buildHistory(state: AppState, baseline: PortalDataset) {
  const history = clone(baseline.appVersionInfo?.history || []);
  for (const item of history) item.status = "历史版本";
  for (const release of [...state.releases].reverse()) {
    const existing = history.find((item) => item.version === release.version);
    const entry = {
      version: release.version,
      date: release.publishedAt.slice(0, 10),
      title: release.title,
      status: release.version === state.settings.currentVersion ? "当前版本" : "历史版本",
      systemUrl: release.version === "v1.0.3" ? "versions/v1.0.3/index.html" : "",
      modules: ["后台审核发布", "双渠道快照"],
      changes: release.changes
    };
    if (existing) Object.assign(existing, entry);
    else history.unshift(entry);
  }
  return history;
}

export function buildPortalDataset(baseline: PortalDataset, state: AppState, channel: PortalChannel, user?: UserRecord): PortalDataset {
  const dataset = clone(baseline);
  const assets = selectedAssets(state, channel, user);
  const byType = (type: string) => assets.filter((asset) => asset.type === type);
  const owner = (asset: AssetRecord) => state.users.find((item) => item.id === asset.ownerId);
  const visibleAssetIds = new Set(assets.map((asset) => asset.id));
  const relations = state.ipRelations.filter((relation) => relation.status === "published" && !relation.pendingRemoval && visibleAssetIds.has(relation.ipAssetId) && visibleAssetIds.has(relation.relatedAssetId));
  const relationCounts = (assetId: string) => {
    const linked = relations.filter((relation) => relation.relatedAssetId === assetId);
    return {
      patents: linked.filter((relation) => state.assets.find((asset) => asset.id === relation.ipAssetId)?.ipProfile?.kind === "patent").length,
      copyrights: linked.filter((relation) => state.assets.find((asset) => asset.id === relation.ipAssetId)?.ipProfile?.kind === "software_copyright").length
    };
  };

  dataset.caseAssets = mapByAsset(byType("case"), (baseline.caseAssets || []) as any[], (item) => item.name, (asset, item: any = {}) => ({
    ...item,
    name: asset.title,
    industry: asset.category || item.industry || "综合行业",
    sourceYear: item.sourceYear || asset.createdAt.slice(0, 4),
    status: "normal",
    manager: includesField(asset, "owner", channel) ? owner(asset)?.employeeCode || item.manager || "HN-PUBLIC" : "HN-PUBLIC",
    engineer: includesField(asset, "owner", channel) ? item.engineer || owner(asset)?.employeeCode || "HN-PUBLIC" : "HN-PUBLIC",
    managerState: "active",
    engineerState: "active",
    patents: relationCounts(asset.id).patents,
    copyrights: relationCounts(asset.id).copyrights,
    calls: channel === "public" ? "0" : item.calls || "0",
    modules: channel === "public" ? [asset.category || "资产模块"] : item.modules || [asset.category || "资产模块"],
    components: channel === "public" ? [] : item.components || ["资料资产"],
    evolution: channel === "public" ? (includesField(asset, "version", channel) ? [`${asset.version} 公开发布`] : []) : item.evolution || [`${asset.createdAt.slice(0, 4)} 资产建档`],
    evidence: channel === "public" ? (includesField(asset, "attachments", channel) ? visibleAttachments(asset, channel).map((file) => file.name) : []) : item.evidence || visibleAttachments(asset, channel).map((file) => file.name),
    access: ["public"],
    cost: includesField(asset, "amount", channel) ? `${Math.round(asset.amount / 10000)}万` : "未公开",
    intro: includesField(asset, "summary", channel) ? asset.summary : "公开资产资料",
    contributors: channel === "internal" ? item.contributors || [[asset.ownerName, "资产维护", 100]] : []
  }));

  dataset.platforms = mapByAsset(byType("platform"), (baseline.platforms || []) as any[], (item) => item[1], (asset, item: any = ["platform", asset.title, 0]) => [item[0] || "platform", asset.title, channel === "public" ? 0 : item[2] || 0]);
  const product = (type: "software" | "saas") => mapByAsset(byType(type), (baseline[type] || []) as any[], (item) => item[0], (asset, item: any = [asset.title, asset.category, asset.version, 0, 0]) => [asset.title, asset.category || item[1] || "业务", includesField(asset, "version", channel) ? asset.version : "已发布", relationCounts(asset.id).patents, relationCounts(asset.id).copyrights]);
  dataset.software = product("software");
  dataset.saas = product("saas");
  dataset.sceneOperationLibrary = mapByAsset(byType("scene"), (baseline.sceneOperationLibrary || []) as any[], (item) => item.name, (asset, item: any = {}) => ({
    ...item,
    name: asset.title,
    device: channel === "public" ? asset.category || "现场终端" : item.device || asset.category || "现场终端",
    image: item.image || "./assets/photos/visuals/scene-workstation-reporting-upload.png",
    scene: includesField(asset, "summary", channel) ? asset.summary : "公开应用场景",
    role: channel === "public" ? "公开访客" : item.role || "业务人员",
    output: channel === "public" ? "公开资产资料" : item.output || "业务数据与资料",
    docs: channel === "public" ? (includesField(asset, "attachments", channel) ? visibleAttachments(asset, channel).map((file) => file.name) : []) : item.docs || visibleAttachments(asset, channel).map((file) => file.name)
  }));
  const device = (type: "hardware" | "equipment", image: string) => mapByAsset(byType(type), (baseline[type] || []) as any[], (item) => item[0], (asset, item: any = [asset.title, asset.category, image]) => [asset.title, asset.category || item[1] || "设备资产", item[2] || image]);
  dataset.hardware = device("hardware", "./assets/photos/workstation.jpg");
  dataset.equipment = device("equipment", "./assets/photos/agv.jpg");

  const industryBaseline = (baseline.industries || []) as any[];
  dataset.industries = mapByAsset(byType("industry"), industryBaseline, (item) => item[0], (asset, item: any = [asset.title.replace(/行业库$/, ""), [["资产资料", 0, 0]]]) => [asset.title.replace(/行业库$/, ""), channel === "public" ? [["公开行业资料", 0, 0]] : item[1] || [["资产资料", 0, 0]]]);

  dataset.caseVisuals = rekeyVisuals((baseline.caseVisuals || {}) as Record<string, any>, byType("case"), channel);
  dataset.softwareVisuals = rekeyVisuals((baseline.softwareVisuals || {}) as Record<string, any>, byType("software"), channel);
  dataset.saasVisuals = rekeyVisuals((baseline.saasVisuals || {}) as Record<string, any>, byType("saas"), channel);

  if (channel === "public" || !user?.roleCodes.includes("ASSET_ADMIN")) Object.assign(dataset, buildDocuments(assets));
  if (channel === "public") {
    dataset.employeeDirectory = { "HN-PUBLIC": { name: "资产负责人", role: "公开资料维护", department: "汉脑科技", status: "active", assets: [], note: "公开资料责任信息已登记。" } };
    const amountAssets = assets.filter((asset) => includesField(asset, "amount", channel));
    const sum = amountAssets.reduce((total, asset) => total + asset.amount, 0);
    dataset.costOverview = {
      totals: [["公开投入", sum ? `${Math.round(sum / 10000).toLocaleString("zh-CN")}万` : "未公开"]],
      distribution: [],
      rankings: amountAssets.slice(0, 8).map((asset) => [asset.title, `${Math.round(asset.amount / 10000)}万`, 100]),
      trend: [], costItems: [], workHours: [], deposits: []
    };
    const profiles = clone((baseline.productAssetProfiles || {}) as Record<string, any>);
    dataset.productAssetProfiles = Object.fromEntries([...byType("software"), ...byType("saas")].map((asset) => {
      const profile = profiles[asset.portalKey || asset.title] || profiles[asset.title] || {};
      return [asset.title, {
        costs: includesField(asset, "amount", channel) ? [["累计投入", `${Math.round(asset.amount / 10000)}万`]] : [["累计投入", "未公开"]],
        hours: [],
        versions: includesField(asset, "version", channel) ? [[asset.version, asset.updatedAt.slice(0, 10), "公开版本"]] : [],
        components: []
      }];
    }));
    dataset.assetAccessLogs = [];
    dataset.assetLifecycleDetails = [];
    dataset.designLibrary = [];
    dataset.renewalTodos = [];
    dataset.lowUtilizationAssets = [];
    dataset.idleAssetDetails = [];
    dataset.intake = [];
    dataset.roles = [];
    dataset.timeline = [];
    dataset.assetModules = [];
    dataset.evidenceMap = [];
    const publicIp = byType("ip");
    dataset.ipAssetLedger = {
      patent: { label: "专利", items: publicIp.filter((asset) => !asset.title.includes("软著")).map((asset) => [asset.code, asset.title, asset.category, asset.updatedAt.slice(0, 10), "已发布"]) },
      copyright: { label: "软著", items: publicIp.filter((asset) => asset.title.includes("软著")).map((asset) => [asset.code, asset.title, asset.category, asset.updatedAt.slice(0, 10), "已发布"]) }
    };
    const publicIndustryNames = new Set(byType("industry").map((asset) => asset.title.replace(/行业库$/, "")));
    dataset.industryVisuals = Object.fromEntries(Object.entries((baseline.industryVisuals || {}) as Record<string, unknown>).filter(([key]) => [...publicIndustryNames].some((name) => key.startsWith(`${name}/`))));
    const publicTitles = new Set(assets.map((asset) => asset.title));
  dataset.assetUiGalleries = Object.fromEntries(Object.entries((baseline.assetUiGalleries || {}) as Record<string, unknown>).filter(([key]) => publicTitles.has(key)));
  }

  const ipAssets = byType("ip").filter((asset) => asset.ipProfile);
  const ipItems = (kind: "patent" | "software_copyright") => ipAssets.filter((asset) => asset.ipProfile?.kind === kind).map((asset) => [
    asset.code,
    asset.title,
    relations.filter((relation) => relation.ipAssetId === asset.id).map((relation) => state.assets.find((item) => item.id === relation.relatedAssetId)?.title).filter(Boolean).join("、"),
    asset.ipProfile?.obtainedAt || asset.ipProfile?.applicationDate || "",
    ipStatusLabels[asset.ipProfile?.legalStatus || ""] || asset.ipProfile?.legalStatus || "",
    asset.id
  ]);
  dataset.ipAssetLedger = {
    patent: { label: "专利", items: ipItems("patent") },
    copyright: { label: "软著", items: ipItems("software_copyright") }
  };
  dataset.ipAssetRelations = Object.fromEntries(assets.map((asset) => {
    const linked = relations.filter((relation) => relation.relatedAssetId === asset.id);
    const value = {
      patents: linked.filter((relation) => state.assets.find((item) => item.id === relation.ipAssetId)?.ipProfile?.kind === "patent").map((relation) => relation.ipAssetId),
      copyrights: linked.filter((relation) => state.assets.find((item) => item.id === relation.ipAssetId)?.ipProfile?.kind === "software_copyright").map((relation) => relation.ipAssetId)
    };
    return [asset.portalKey || asset.title, value];
  }));

  dataset.displayConfig = clone(state.settings.displayModules);
  dataset.publishedAssets = publicAssetRows(assets, channel);
  dataset.portalChannel = channel;
  dataset.appVersionInfo = { currentVersion: state.settings.currentVersion, history: buildHistory(state, baseline) };
  return dataset;
}
