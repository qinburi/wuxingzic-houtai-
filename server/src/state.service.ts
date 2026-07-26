import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AssetRecord,
  AuditRecord,
  DalingPersonnelChange,
  DisplayModuleConfig,
  IpArchiveRevision,
  IpBusinessVersion,
  IpKind,
  IpLegalStatus,
  IpProfile,
  IpRelationRecord,
  IpRelationType,
  IpReminderRecord,
  IpReminderType,
  PortalDataset,
  PortalEventInput,
  PublicDownloadRegistration,
  ReviewRecord,
  TaskDispatchRecord
} from "../../shared/contracts.js";
import { buildPortalDataset, canReadAsset } from "./portal-dataset.js";
import { createSeedState, hashPassword, type AppState, type ReleaseRecord, type UserRecord } from "./seed.js";
import { PersistenceService } from "./persistence.service.js";

const retryDelays = [60_000, 300_000, 900_000, 3_600_000, 21_600_000];
const relationTargetTypes = new Set(["case", "platform", "software", "saas", "scene", "hardware", "equipment"]);
const dayMs = 86_400_000;
const normalizeName = (value = "") => value.replace(/\s+/g, "").toLowerCase();

@Injectable()
export class StateService implements OnModuleInit {
  private state: AppState = createSeedState();
  private retryTimer?: NodeJS.Timeout;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    const seed = createSeedState();
    this.state = (await this.persistence.load()) || seed;
    this.state.downloadRegistrations ||= [];
    this.state.processedEventIds ||= [];
    this.state.ipBusinessVersions ||= [];
    this.state.ipArchiveRevisions ||= [];
    this.state.ipRelations ||= [];
    this.state.ipReminders ||= [];
    this.state.ipMigrationIssues ||= [];
    this.state.settings.displayModules ||= seed.settings.displayModules;
    this.state.settings.ipReminderRules ||= seed.settings.ipReminderRules;
    this.state.settings.ipDefaultSystemIds ||= seed.settings.ipDefaultSystemIds;
    this.state.assets.forEach((asset) => {
      asset.portalKey ||= asset.title;
      asset.publicFields ||= ["summary", "version", "attachments", ...(asset.showAmountPublic ? ["amount" as const] : [])];
      asset.attachments.forEach((file) => {
        file.visibility ||= "internal";
        file.materialType ||= "其他材料";
        file.isCurrent ??= true;
      });
    });
    await this.migrateLegacyIpLedger();
    this.refreshAllIpReminders();
    await this.processDueIpReminders();
    if (this.persistence instanceof PersistenceService) await this.ensureCurrentReleaseSnapshots();
    await this.persistence.save(this.state);
    this.retryTimer = setInterval(() => void Promise.all([this.processDueRetries(), this.processDueIpReminders()]), 30_000);
    this.retryTimer.unref();
  }

  snapshot() {
    return this.state;
  }

  private async persist() {
    await this.persistence.save(this.state);
  }

  private isAdmin(actor: UserRecord) {
    return actor.roleCodes.includes("ASSET_ADMIN");
  }

  private assertRole(actor: UserRecord, roles: string[], message: string) {
    if (!this.isAdmin(actor) && !actor.roleCodes.some((code) => roles.includes(code))) throw new ForbiddenException(message);
  }

  private hasPermission(actor: UserRecord, permission: string) {
    return this.isAdmin(actor) || actor.permissionCodes.includes(permission) || actor.roleCodes.includes(permission);
  }

  private canMaintainIp(asset: AssetRecord, actor: UserRecord) {
    const profile = asset.ipProfile;
    return this.isAdmin(actor)
      || this.hasPermission(actor, "IP_EDIT")
      || profile?.primaryOwnerId === actor.id
      || Boolean(profile?.collaboratorIds.includes(actor.id));
  }

  private canMaintain(asset: AssetRecord, actor: UserRecord) {
    if (asset.type === "ip" && asset.ipProfile) return this.canMaintainIp(asset, actor);
    return this.isAdmin(actor) || asset.ownerId === actor.id || (actor.roleCodes.includes("ASSET_EDITOR") && asset.departmentId === actor.departmentId);
  }

  private audit(input: Omit<AuditRecord, "id" | "requestId" | "createdAt">) {
    const record: AuditRecord = {
      ...input,
      id: randomUUID(),
      requestId: randomUUID(),
      createdAt: new Date().toISOString()
    };
    this.state.logs.unshift(record);
    return record;
  }

  private normalizeIpProfile(profile: Partial<IpProfile>, actor: UserRecord, strict = false): IpProfile {
    const primaryOwner = this.state.users.find((user) => user.id === (profile.primaryOwnerId || actor.id));
    if (!primaryOwner) throw new BadRequestException("知识产权主负责人不存在");
    const collaboratorIds = [...new Set((profile.collaboratorIds || []).filter((id) => id !== primaryOwner.id))];
    const collaborators = collaboratorIds.map((id) => this.state.users.find((user) => user.id === id)).filter(Boolean) as UserRecord[];
    if (collaborators.length !== collaboratorIds.length) throw new BadRequestException("知识产权协同人包含无效人员");
    const normalized: IpProfile = {
      kind: profile.kind || "patent",
      patentType: profile.kind === "software_copyright" ? undefined : profile.patentType || "invention",
      shortName: profile.shortName?.trim() || "",
      applicationNumber: profile.applicationNumber?.trim() || "",
      publicationNumber: profile.publicationNumber?.trim() || "",
      registrationNumber: profile.registrationNumber?.trim() || "",
      certificateNumber: profile.certificateNumber?.trim() || "",
      legalStatus: profile.legalStatus || "preparation",
      rightsHolder: profile.rightsHolder?.trim() || "浙江汉脑数智科技有限公司",
      applicationAgency: profile.applicationAgency?.trim() || "",
      agency: profile.agency?.trim() || "",
      applicationDate: profile.applicationDate || "",
      acceptedAt: profile.acceptedAt || "",
      obtainedAt: profile.obtainedAt || "",
      expiresAt: profile.expiresAt || "",
      annualFeeDueAt: profile.annualFeeDueAt || "",
      completedAt: profile.completedAt || "",
      firstPublishedAt: profile.firstPublishedAt || "",
      nextReviewAt: profile.nextReviewAt || "",
      primaryOwnerId: primaryOwner.id,
      primaryOwnerName: primaryOwner.name,
      collaboratorIds,
      collaboratorNames: collaborators.map((user) => user.name),
      technicalSummary: profile.technicalSummary?.trim() || "",
      claimsSummary: profile.claimsSummary?.trim() || "",
      productVersion: profile.productVersion?.trim() || "",
      functionalDescription: profile.functionalDescription?.trim() || "",
      notes: profile.notes?.trim() || "",
      reminderSystemIds: [...new Set(profile.reminderSystemIds || this.state.settings.ipDefaultSystemIds || [])],
      reminderOverrides: profile.reminderOverrides || {}
    };
    if (strict && normalized.kind === "patent" && normalized.legalStatus === "granted" && (!normalized.obtainedAt || !normalized.certificateNumber)) {
      throw new BadRequestException("已授权专利必须填写获得时间和证书号");
    }
    if (strict && normalized.kind === "software_copyright" && normalized.legalStatus === "registered" && (!normalized.registrationNumber || !normalized.obtainedAt || !normalized.productVersion)) {
      throw new BadRequestException("已登记软著必须填写登记号、获得时间和对应软件版本");
    }
    return normalized;
  }

  private recordIpRevision(asset: AssetRecord, action: IpArchiveRevision["action"], actor: UserRecord, changes: string[]) {
    const revision: IpArchiveRevision = {
      id: randomUUID(),
      ipAssetId: asset.id,
      revisionNo: this.state.ipArchiveRevisions.filter((item) => item.ipAssetId === asset.id).length + 1,
      action,
      changes: changes.length ? changes : ["保存知识产权档案"],
      snapshot: structuredClone({
        code: asset.code,
        title: asset.title,
        summary: asset.summary,
        status: asset.status,
        version: asset.version,
        channel: asset.channel,
        ipProfile: asset.ipProfile,
        attachments: asset.attachments.map(({ storageKey: _storageKey, ...file }) => file)
      }),
      actorId: actor.id,
      actorName: actor.name,
      createdAt: new Date().toISOString()
    };
    this.state.ipArchiveRevisions.unshift(revision);
    return revision;
  }

  private refreshIpReminders(asset: AssetRecord) {
    if (asset.type !== "ip" || !asset.ipProfile) return;
    this.state.ipReminders = this.state.ipReminders.filter((reminder) => reminder.ipAssetId !== asset.id || !reminder.generated || reminder.status !== "scheduled");
    const profile = asset.ipProfile;
    const sources: Array<{ type: Exclude<IpReminderType, "owner_handover">; dueDate?: string }> = [
      { type: "expiry", dueDate: profile.expiresAt },
      { type: "annual_fee", dueDate: profile.annualFeeDueAt },
      { type: "document_review", dueDate: profile.nextReviewAt }
    ];
    for (const source of sources) {
      if (!source.dueDate || Number.isNaN(Date.parse(source.dueDate))) continue;
      const offsets = profile.reminderOverrides?.[source.type] || this.state.settings.ipReminderRules[source.type] || [];
      for (const offsetDays of offsets) {
        const dueTime = Date.parse(`${source.dueDate}T09:00:00+08:00`);
        if (dueTime < Date.now() - 365 * dayMs) continue;
        const id = `ip-reminder:${asset.id}:${source.type}:${source.dueDate}:${offsetDays}`;
        if (this.state.ipReminders.some((item) => item.id === id)) continue;
        const createdAt = new Date().toISOString();
        this.state.ipReminders.push({
          id,
          ipAssetId: asset.id,
          ipAssetTitle: asset.title,
          type: source.type,
          dueDate: source.dueDate,
          remindAt: new Date(dueTime - offsetDays * dayMs).toISOString(),
          offsetDays,
          status: "scheduled",
          ownerId: profile.primaryOwnerId,
          ownerName: profile.primaryOwnerName,
          collaboratorIds: [...profile.collaboratorIds],
          systemIds: [...(profile.reminderSystemIds.length ? profile.reminderSystemIds : this.state.settings.ipDefaultSystemIds)],
          taskDispatchIds: [],
          generated: true,
          createdAt,
          updatedAt: createdAt
        });
      }
    }
  }

  private refreshAllIpReminders() {
    for (const asset of this.state.assets) this.refreshIpReminders(asset);
    this.state.ipReminders.sort((left, right) => Date.parse(left.remindAt) - Date.parse(right.remindAt));
  }

  private dispatchIpReminderTasks(reminder: IpReminderRecord) {
    const asset = this.state.assets.find((item) => item.id === reminder.ipAssetId);
    if (!asset) return;
    for (const systemId of reminder.systemIds) {
      const system = this.state.systems.find((item) => item.id === systemId && item.status !== "disabled");
      if (!system) continue;
      const template = this.state.taskTemplates.find((item) => item.id === system.taskTemplateId && item.enabled);
      if (!template) continue;
      const idempotencyKey = `${asset.id}:${reminder.type}:${reminder.dueDate}:${system.id}`;
      const existing = this.state.taskDispatches.find((item) => item.idempotencyKey === idempotencyKey);
      if (existing) {
        if (!reminder.taskDispatchIds.includes(existing.id)) reminder.taskDispatchIds.push(existing.id);
        continue;
      }
      const createdAt = new Date().toISOString();
      const record: TaskDispatchRecord = {
        id: randomUUID(),
        idempotencyKey,
        assetId: asset.id,
        assetTitle: asset.title,
        revisionId: reminder.id,
        systemId: system.id,
        systemName: system.name,
        templateId: template.id,
        status: "created",
        externalTaskId: `${system.code}-IP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        externalUrl: `${system.baseUrl}/tasks/ip/${encodeURIComponent(asset.code)}`,
        attempt: 1,
        createdAt,
        updatedAt: createdAt
      };
      this.state.taskDispatches.unshift(record);
      reminder.taskDispatchIds.push(record.id);
      this.audit({ kind: "task", actorId: "system", actorName: "知识产权提醒", departmentName: "资产治理", action: "创建知识产权提醒任务", targetType: "ip_reminder", targetId: reminder.id, targetName: `${asset.title} / ${system.name}`, result: "success", ip: "internal", device: "connector", detail: `到期日 ${reminder.dueDate}，幂等键 ${idempotencyKey}` });
    }
  }

  private async processDueIpReminders() {
    let changed = false;
    for (const reminder of this.state.ipReminders) {
      if (reminder.status !== "scheduled" || Date.parse(reminder.remindAt) > Date.now()) continue;
      reminder.status = "open";
      reminder.triggeredAt = new Date().toISOString();
      reminder.updatedAt = reminder.triggeredAt;
      this.dispatchIpReminderTasks(reminder);
      changed = true;
    }
    if (changed) await this.persist();
  }

  private async migrateLegacyIpLedger() {
    const baseline = await this.baselinePortalDataset();
    const ledger = baseline.ipAssetLedger as Record<string, { items?: unknown[] }> | undefined;
    if (!ledger) return;
    const actor = this.state.users.find((user) => this.isAdmin(user)) || this.state.users[0];
    const rows: Array<{ kind: IpKind; item: any[] }> = [
      ...(ledger.patent?.items || []).map((item) => ({ kind: "patent" as const, item: item as any[] })),
      ...(ledger.copyright?.items || []).map((item) => ({ kind: "software_copyright" as const, item: item as any[] }))
    ];
    for (const { kind, item } of rows) {
      const [code, title, relatedName, date, legacyStatus] = item.map((value) => String(value || ""));
      let asset = this.state.assets.find((candidate) => candidate.type === "ip" && (candidate.code === code || normalizeName(candidate.title) === normalizeName(title)));
      const legalStatus: IpLegalStatus = /申报|申请/.test(legacyStatus) ? "applied" : kind === "patent" ? "granted" : "registered";
      if (!asset) {
        const createdAt = new Date().toISOString();
        asset = {
          id: randomUUID(), portalKey: title, code, type: "ip", title, category: kind === "patent" ? "专利" : "软件著作权",
          summary: `${title}的知识产权档案、证书资料和关联资产。`, ownerId: actor.id, ownerName: actor.name,
          departmentId: actor.departmentId, departmentName: actor.departmentName, sensitivity: "company", channel: "internal",
          status: "published", version: "V1.0", amount: 0, showAmountPublic: false, publicFields: ["summary", "version", "attachments"],
          featured: false, sortOrder: this.state.assets.length + 1, attachments: [], audienceTemplates: [], systemIds: [], lockVersion: 1,
          ipProfile: this.normalizeIpProfile({
            kind, patentType: kind === "patent" ? "invention" : undefined, legalStatus, rightsHolder: "浙江汉脑数智科技有限公司",
            obtainedAt: legalStatus === "granted" || legalStatus === "registered" ? date : "", applicationDate: legalStatus === "applied" ? date : "",
            applicationNumber: kind === "patent" ? code : "", registrationNumber: kind === "software_copyright" ? code : "",
            productVersion: kind === "software_copyright" ? "V1.0" : "", primaryOwnerId: actor.id, collaboratorIds: ["user-demo-document"], reminderSystemIds: this.state.settings.ipDefaultSystemIds
          }, actor),
          createdAt, updatedAt: createdAt
        };
        this.state.assets.push(asset);
        this.recordIpRevision(asset, "create", actor, ["从历史知识产权台账迁移"]);
      } else if (!asset.ipProfile) {
        asset.ipProfile = this.normalizeIpProfile({ kind, legalStatus, rightsHolder: "浙江汉脑数智科技有限公司", obtainedAt: date, primaryOwnerId: asset.ownerId, collaboratorIds: [], reminderSystemIds: this.state.settings.ipDefaultSystemIds }, actor);
      }
      if (kind === "software_copyright" && !this.state.ipBusinessVersions.some((version) => version.ipAssetId === asset!.id)) {
        const createdAt = new Date().toISOString();
        this.state.ipBusinessVersions.push({ id: randomUUID(), ipAssetId: asset.id, version: asset.ipProfile?.productVersion || "V1.0", name: "首次登记版本", releasedAt: date, description: `${title}登记版本的主要功能和发布内容。`, relatedProductVersion: asset.ipProfile?.productVersion, ownerId: asset.ownerId, ownerName: asset.ownerName, attachmentIds: [], createdAt, updatedAt: createdAt });
      }
      const matches = this.state.assets.filter((candidate) => relationTargetTypes.has(candidate.type) && [candidate.title, candidate.portalKey].some((value) => normalizeName(value) === normalizeName(relatedName)));
      if (matches.length === 1) {
        const exists = this.state.ipRelations.some((relation) => relation.ipAssetId === asset!.id && relation.relatedAssetId === matches[0].id && relation.status !== "archived");
        if (!exists) {
          const createdAt = new Date().toISOString();
          this.state.ipRelations.push({ id: randomUUID(), ipAssetId: asset.id, relatedAssetId: matches[0].id, relationType: "core", contributionNote: "由历史知识产权台账自动迁移", status: "published", pendingRemoval: false, createdBy: actor.id, createdByName: actor.name, createdAt, updatedAt: createdAt, publishedAt: createdAt });
        }
      } else if (relatedName && !this.state.ipMigrationIssues.some((issue) => issue.sourceCode === code && issue.relatedName === relatedName)) {
        this.state.ipMigrationIssues.push({ id: randomUUID(), sourceCode: code, sourceTitle: title, relatedName, reason: matches.length ? "ambiguous" : "unmatched", candidateAssetIds: matches.map((candidate) => candidate.id), status: "pending", createdAt: new Date().toISOString() });
      }
    }
  }

  verifyPassword(user: UserRecord, password: string) {
    const [salt, expected] = user.passwordHash.split(":");
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length * 2 && timingSafeEqual(Buffer.from(expected, "hex"), actual);
  }

  async authenticate(phone: string, password: string, ip: string, device: string) {
    const user = this.state.users.find((item) => item.phone === phone && item.status === "active");
    const locked = Boolean(user?.lockedUntil && Date.parse(user.lockedUntil) > Date.now());
    const success = Boolean(user && !locked && this.verifyPassword(user, password));
    if (user && !success && !locked) {
      user.failedLoginCount = Number(user.failedLoginCount || 0) + 1;
      if (user.failedLoginCount >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60_000).toISOString();
        user.failedLoginCount = 0;
      }
    }
    const nowLocked = Boolean(user?.lockedUntil && Date.parse(user.lockedUntil) > Date.now());
    this.audit({
      kind: "login",
      actorId: user?.id || "anonymous",
      actorName: user?.name || phone,
      departmentName: user?.departmentName || "-",
      action: success ? "登录成功" : nowLocked ? "账号锁定" : "登录失败",
      targetType: "session",
      targetId: phone,
      targetName: "管理后台",
      result: success ? "success" : "denied",
      ip,
      device,
      detail: success ? "手机号密码验证通过" : nowLocked ? "连续登录失败，账号锁定15分钟" : "账号不存在、停用或密码错误"
    });
    if (!user || !success) {
      await this.persist();
      return null;
    }
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date().toISOString();
    await this.persist();
    return user;
  }

  userById(id: string) {
    return this.state.users.find((item) => item.id === id);
  }

  ipWorkspace(actor: UserRecord) {
    const assets = this.listIpAssets({}, actor);
    const now = Date.now();
    const in180Days = now + 180 * dayMs;
    return {
      metrics: {
        total: assets.length,
        patents: assets.filter((asset) => asset.ipProfile?.kind === "patent").length,
        copyrights: assets.filter((asset) => asset.ipProfile?.kind === "software_copyright").length,
        applying: assets.filter((asset) => ["preparation", "applied", "accepted", "reviewing"].includes(asset.ipProfile?.legalStatus || "")).length,
        obtained: assets.filter((asset) => ["granted", "registered"].includes(asset.ipProfile?.legalStatus || "")).length,
        expiring: assets.filter((asset) => asset.ipProfile?.expiresAt && Date.parse(asset.ipProfile.expiresAt) >= now && Date.parse(asset.ipProfile.expiresAt) <= in180Days).length,
        annualFees: this.state.ipReminders.filter((item) => item.type === "annual_fee" && item.status === "open").length,
        missingDocuments: assets.filter((asset) => asset.attachments.length === 0).length,
        migrationIssues: this.state.ipMigrationIssues.filter((item) => item.status === "pending").length
      },
      assets,
      businessVersions: this.state.ipBusinessVersions,
      archiveRevisions: this.state.ipArchiveRevisions.slice(0, 80),
      relations: this.enrichedIpRelations(),
      reminders: this.state.ipReminders,
      migrationIssues: this.state.ipMigrationIssues,
      reminderRules: this.state.settings.ipReminderRules
    };
  }

  listIpAssets(filters: { kind?: string; status?: string; keyword?: string }, actor: UserRecord) {
    const keyword = filters.keyword?.trim().toLowerCase();
    return this.state.assets.filter((asset) => {
      if (asset.type !== "ip" || !asset.ipProfile || asset.status === "archived") return false;
      if (!this.hasPermission(actor, "IP_VIEW") && !canReadAsset(asset, actor) && !this.canMaintainIp(asset, actor)) return false;
      if (filters.kind && asset.ipProfile.kind !== filters.kind) return false;
      if (filters.status && asset.ipProfile.legalStatus !== filters.status) return false;
      if (keyword && !`${asset.title} ${asset.code} ${asset.ipProfile.applicationNumber} ${asset.ipProfile.registrationNumber} ${asset.ipProfile.primaryOwnerName}`.toLowerCase().includes(keyword)) return false;
      return true;
    }).map((asset) => {
      const relations = this.state.ipRelations.filter((relation) => relation.ipAssetId === asset.id && relation.status === "published" && !relation.pendingRemoval);
      const nextReminder = this.state.ipReminders.filter((reminder) => reminder.ipAssetId === asset.id && ["scheduled", "open"].includes(reminder.status)).sort((left, right) => Date.parse(left.remindAt) - Date.parse(right.remindAt))[0];
      return { ...asset, relationCount: relations.length, nextReminder };
    }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  ipAssetDetail(id: string, actor: UserRecord) {
    const asset = this.assetById(id);
    if (asset.type !== "ip" || !asset.ipProfile) throw new NotFoundException("知识产权档案不存在");
    if (!this.hasPermission(actor, "IP_VIEW") && !canReadAsset(asset, actor) && !this.canMaintainIp(asset, actor)) throw new ForbiddenException("当前账号没有知识产权查看权限");
    return {
      asset,
      businessVersions: this.state.ipBusinessVersions.filter((item) => item.ipAssetId === id),
      archiveRevisions: this.state.ipArchiveRevisions.filter((item) => item.ipAssetId === id),
      relations: this.enrichedIpRelations().filter((item) => item.ipAssetId === id),
      reminders: this.state.ipReminders.filter((item) => item.ipAssetId === id)
    };
  }

  async createIpAsset(input: Partial<AssetRecord>, actor: UserRecord) {
    if (!this.hasPermission(actor, "IP_EDIT")) throw new ForbiddenException("当前账号没有知识产权维护权限");
    return this.createAsset({ ...input, type: "ip", category: input.ipProfile?.kind === "software_copyright" ? "软件著作权" : "专利" }, actor);
  }

  async updateIpAsset(id: string, input: Partial<AssetRecord>, actor: UserRecord) {
    const asset = this.assetById(id);
    if (asset.type !== "ip" || !asset.ipProfile) throw new NotFoundException("知识产权档案不存在");
    if (!this.canMaintainIp(asset, actor)) throw new ForbiddenException("当前账号不能维护该知识产权档案");
    return this.updateAsset(id, { ...input, status: asset.status === "published" ? "draft" : input.status }, actor);
  }

  exportIpAssets(actor: UserRecord) {
    if (!this.hasPermission(actor, "IP_EXPORT")) throw new ForbiddenException("当前账号没有知识产权导出权限");
    const header = ["内部编号", "类型", "名称", "申请号/登记号", "法律状态", "获得时间", "到期时间", "负责人", "关联资产数", "下次提醒"];
    const rows = this.listIpAssets({}, actor).map((asset) => [
      asset.code,
      asset.ipProfile?.kind === "patent" ? "专利" : "软件著作权",
      asset.title,
      asset.ipProfile?.applicationNumber || asset.ipProfile?.registrationNumber || "",
      asset.ipProfile?.legalStatus || "",
      asset.ipProfile?.obtainedAt || "",
      asset.ipProfile?.expiresAt || "",
      asset.ipProfile?.primaryOwnerName || "",
      String(asset.relationCount),
      asset.nextReminder?.remindAt || ""
    ]);
    return [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  }

  async addIpBusinessVersion(ipAssetId: string, input: Partial<IpBusinessVersion>, actor: UserRecord) {
    const asset = this.assetById(ipAssetId);
    if (asset.type !== "ip" || !asset.ipProfile) throw new NotFoundException("知识产权档案不存在");
    if (!this.canMaintainIp(asset, actor)) throw new ForbiddenException("当前账号不能维护该知识产权版本");
    if (!input.version?.trim() || !input.name?.trim() || !input.releasedAt || !input.description?.trim()) throw new BadRequestException("请完整填写版本号、版本名称、发布日期和版本内容");
    if (this.state.ipBusinessVersions.some((item) => item.ipAssetId === ipAssetId && item.version.toLowerCase() === input.version!.trim().toLowerCase())) throw new ConflictException("该业务版本号已存在");
    const owner = this.state.users.find((user) => user.id === (input.ownerId || asset.ipProfile!.primaryOwnerId));
    if (!owner) throw new BadRequestException("版本负责人不存在");
    const createdAt = new Date().toISOString();
    const version: IpBusinessVersion = {
      id: randomUUID(), ipAssetId, version: input.version.trim(), name: input.name.trim(), releasedAt: input.releasedAt,
      description: input.description.trim(), relatedProductVersion: input.relatedProductVersion?.trim() || "",
      ownerId: owner.id, ownerName: owner.name, attachmentIds: input.attachmentIds || [], createdAt, updatedAt: createdAt
    };
    this.state.ipBusinessVersions.unshift(version);
    this.recordIpRevision(asset, "update", actor, [`新增业务版本 ${version.version}`]);
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "新增知识产权业务版本", targetType: "ip_version", targetId: version.id, targetName: `${asset.title} ${version.version}`, result: "success", ip: "local", device: "admin", detail: version.description });
    await this.persist();
    return version;
  }

  private enrichedIpRelations() {
    return this.state.ipRelations.map((relation) => {
      const ipAsset = this.state.assets.find((asset) => asset.id === relation.ipAssetId);
      const relatedAsset = this.state.assets.find((asset) => asset.id === relation.relatedAssetId);
      return { ...relation, ipAssetTitle: ipAsset?.title || relation.ipAssetId, ipKind: ipAsset?.ipProfile?.kind, relatedAssetTitle: relatedAsset?.title || relation.relatedAssetId, relatedAssetType: relatedAsset?.type };
    });
  }

  ipRelationsForAsset(assetId: string, actor: UserRecord) {
    this.assetForActor(assetId, actor);
    return this.enrichedIpRelations().filter((relation) => relation.relatedAssetId === assetId && relation.status !== "archived");
  }

  async createIpRelation(relatedAssetId: string, input: { ipAssetId?: string; relationType?: IpRelationType; contributionNote?: string }, actor: UserRecord) {
    const relatedAsset = this.assetById(relatedAssetId);
    if (!relationTargetTypes.has(relatedAsset.type)) throw new BadRequestException("该资产类型不支持绑定专利或软著");
    if (!this.canMaintain(relatedAsset, actor)) throw new ForbiddenException("当前账号不能维护该资产的知识产权关联");
    const ipAsset = this.assetById(input.ipAssetId || "");
    if (ipAsset.type !== "ip" || !ipAsset.ipProfile) throw new BadRequestException("请选择有效的专利或软著档案");
    if (!this.hasPermission(actor, "IP_VIEW") && !canReadAsset(ipAsset, actor) && !this.canMaintainIp(ipAsset, actor)) throw new ForbiddenException("当前账号不能查看该知识产权档案");
    const existing = this.state.ipRelations.find((relation) => relation.ipAssetId === ipAsset.id && relation.relatedAssetId === relatedAsset.id && relation.status !== "archived" && !relation.pendingRemoval);
    if (existing) throw new ConflictException("该知识产权已经与当前资产绑定");
    const createdAt = new Date().toISOString();
    const relation: IpRelationRecord = {
      id: randomUUID(), ipAssetId: ipAsset.id, relatedAssetId: relatedAsset.id,
      relationType: input.relationType || "supporting", contributionNote: input.contributionNote?.trim() || "",
      status: "draft", pendingRemoval: false, createdBy: actor.id, createdByName: actor.name, createdAt, updatedAt: createdAt
    };
    this.state.ipRelations.unshift(relation);
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "绑定知识产权", targetType: "ip_relation", targetId: relation.id, targetName: `${relatedAsset.title} / ${ipAsset.title}`, result: "success", ip: "local", device: "admin", detail: `${relation.relationType}，等待随资产审核发布` });
    await this.persist();
    return relation;
  }

  async quickCreateIpRelation(relatedAssetId: string, input: { title?: string; code?: string; ipProfile?: Partial<IpProfile>; relationType?: IpRelationType; contributionNote?: string }, actor: UserRecord) {
    const relatedAsset = this.assetById(relatedAssetId);
    if (!relationTargetTypes.has(relatedAsset.type) || !this.canMaintain(relatedAsset, actor)) throw new ForbiddenException("当前账号不能在该资产下快速新建知识产权");
    if (!input.title?.trim() || !input.ipProfile?.kind) throw new BadRequestException("请填写知识产权名称并选择专利或软著");
    const profile = this.normalizeIpProfile({ ...input.ipProfile, primaryOwnerId: input.ipProfile.primaryOwnerId || actor.id }, actor);
    const ipAsset = await this.createAsset({
      type: "ip", title: input.title.trim(), code: input.code || `HN-IP-${Date.now()}`,
      category: profile.kind === "patent" ? "专利" : "软件著作权", summary: input.contributionNote || `${input.title}知识产权档案`,
      ownerId: profile.primaryOwnerId, ownerName: profile.primaryOwnerName, departmentId: relatedAsset.departmentId, departmentName: relatedAsset.departmentName,
      channel: "internal", sensitivity: "company", version: "V0.1", ipProfile: profile
    }, actor);
    const relation = await this.createIpRelation(relatedAssetId, { ipAssetId: ipAsset.id, relationType: input.relationType, contributionNote: input.contributionNote }, actor);
    return { ipAsset, relation };
  }

  async updateIpRelation(id: string, input: { relationType?: IpRelationType; contributionNote?: string }, actor: UserRecord) {
    const relation = this.state.ipRelations.find((item) => item.id === id);
    if (!relation) throw new NotFoundException("知识产权关联不存在");
    const relatedAsset = this.assetById(relation.relatedAssetId);
    if (!this.canMaintain(relatedAsset, actor)) throw new ForbiddenException("当前账号不能维护该关联");
    if (relation.status === "published") throw new ConflictException("已发布关联请先解除后重新绑定，避免未审核内容直接生效");
    relation.relationType = input.relationType || relation.relationType;
    relation.contributionNote = input.contributionNote?.trim() ?? relation.contributionNote;
    relation.updatedAt = new Date().toISOString();
    await this.persist();
    return relation;
  }

  async removeIpRelation(id: string, actor: UserRecord) {
    const relation = this.state.ipRelations.find((item) => item.id === id);
    if (!relation) throw new NotFoundException("知识产权关联不存在");
    const relatedAsset = this.assetById(relation.relatedAssetId);
    if (!this.canMaintain(relatedAsset, actor)) throw new ForbiddenException("当前账号不能解除该关联");
    if (relation.status === "published") {
      relation.pendingRemoval = true;
      relation.removalStatus = "draft";
    } else {
      relation.status = "archived";
    }
    relation.updatedAt = new Date().toISOString();
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "申请解除知识产权关联", targetType: "ip_relation", targetId: relation.id, targetName: relatedAsset.title, result: "success", ip: "local", device: "admin", detail: "解除将在审核发布后生效，知识产权档案和文件继续保留" });
    await this.persist();
    return relation;
  }

  async completeIpReminder(id: string, note: string, actor: UserRecord) {
    const reminder = this.state.ipReminders.find((item) => item.id === id);
    if (!reminder) throw new NotFoundException("知识产权提醒不存在");
    const asset = this.assetById(reminder.ipAssetId);
    if (!this.canMaintainIp(asset, actor) && !this.hasPermission(actor, "IP_EDIT")) throw new ForbiddenException("当前账号不能处理该提醒");
    reminder.status = "completed";
    reminder.completedAt = new Date().toISOString();
    reminder.updatedAt = reminder.completedAt;
    reminder.completionNote = note.trim() || "已处理";
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "完成知识产权提醒", targetType: "ip_reminder", targetId: reminder.id, targetName: asset.title, result: "success", ip: "local", device: "admin", detail: reminder.completionNote });
    await this.persist();
    return reminder;
  }

  async resolveIpMigrationIssue(id: string, relatedAssetId: string, actor: UserRecord) {
    if (!this.hasPermission(actor, "IP_EDIT")) throw new ForbiddenException("当前账号没有知识产权迁移处理权限");
    const issue = this.state.ipMigrationIssues.find((item) => item.id === id);
    if (!issue) throw new NotFoundException("待确认绑定记录不存在");
    const ipAsset = this.state.assets.find((asset) => asset.type === "ip" && (asset.code === issue.sourceCode || asset.title === issue.sourceTitle));
    if (!ipAsset) throw new NotFoundException("迁移来源知识产权不存在");
    const relation = await this.createIpRelation(relatedAssetId, { ipAssetId: ipAsset.id, relationType: "supporting", contributionNote: "人工确认历史知识产权绑定" }, actor);
    issue.status = "resolved";
    await this.persist();
    return { issue, relation };
  }

  dashboard() {
    const assets = this.state.assets.filter((asset) => asset.status !== "archived");
    const publishedAssets = assets.filter((asset) => asset.status === "published");
    const publicAssets = publishedAssets.filter((asset) => asset.channel === "both" && !["confidential", "restricted"].includes(asset.sensitivity));
    const ipAssets = assets.filter((asset) => asset.type === "ip" && asset.ipProfile);
    const pendingReviews = this.state.reviews.filter((review) => review.status === "pending");
    const taskFailures = this.state.taskDispatches.filter((task) => task.status === "failed" || task.status === "retrying");
    const openReminders = this.state.ipReminders.filter((reminder) => reminder.status === "open");
    const governancePending = pendingReviews.length + taskFailures.length + openReminders.length;

    const statusSummary = [
      { status: "reviewing", label: "审核中", count: assets.filter((asset) => ["reviewing", "approved"].includes(asset.status)).length, color: "#2f73f6" },
      { status: "published", label: "已发布", count: publishedAssets.length, color: "#26b982" },
      { status: "draft", label: "草稿", count: assets.filter((asset) => ["draft", "rejected"].includes(asset.status)).length, color: "#ff8a3d" }
    ];

    const dateKey = (value: string | Date) => {
      const date = new Date(value);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    const activityTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return { date: dateKey(date), label: `${date.getMonth() + 1}/${date.getDate()}`, maintenance: 0, accessDownloads: 0, systemCollaboration: 0 };
    });
    const trendByDate = new Map(activityTrend.map((item) => [item.date, item]));
    this.state.logs.forEach((log) => {
      const row = trendByDate.get(dateKey(log.createdAt));
      if (!row) return;
      if (["operation", "permission"].includes(log.kind)) row.maintenance += 1;
      if (["portal", "download"].includes(log.kind)) row.accessDownloads += 1;
      if (["system", "task"].includes(log.kind)) row.systemCollaboration += 1;
    });

    const departmentContributions = Object.entries(assets.reduce<Record<string, number>>((result, asset) => {
      result[asset.departmentName] = (result[asset.departmentName] || 0) + 1;
      return result;
    }, {})).map(([department, count]) => ({ department, count })).sort((left, right) => right.count - left.count);

    const now = Date.now();
    const ipDeadlines = ipAssets.flatMap((asset) => {
      const profile = asset.ipProfile!;
      return [
        profile.annualFeeDueAt ? { id: `${asset.id}-annual-fee`, assetId: asset.id, title: asset.title, type: "annual_fee", typeLabel: "年费", dueDate: profile.annualFeeDueAt, ownerName: profile.primaryOwnerName } : undefined,
        profile.nextReviewAt ? { id: `${asset.id}-review`, assetId: asset.id, title: asset.title, type: "review", typeLabel: "资料复核", dueDate: profile.nextReviewAt, ownerName: profile.primaryOwnerName } : undefined,
        profile.expiresAt ? { id: `${asset.id}-expiry`, assetId: asset.id, title: asset.title, type: "expiry", typeLabel: "期限", dueDate: profile.expiresAt, ownerName: profile.primaryOwnerName } : undefined
      ].filter(Boolean);
    }).map((item) => ({
      ...item!,
      daysRemaining: Math.ceil((Date.parse(item!.dueDate) - now) / dayMs)
    })).filter((item) => Number.isFinite(item.daysRemaining)).sort((left, right) => left.daysRemaining - right.daysRemaining).slice(0, 6);

    const missingIpDocuments = ipAssets.filter((asset) => asset.attachments.length === 0).length;
    const expiringIp = ipDeadlines.filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 180).length;
    const governanceRisks = [
      { id: "pending-reviews", title: "待审核内容", detail: `${pendingReviews.length} 项内容等待模块评审`, count: pendingReviews.length, tone: "warning", routeId: "workflow.reviews" },
      { id: "ip-deadlines", title: "知识产权期限", detail: `${expiringIp} 项在 180 天内需要处理`, count: expiringIp, tone: expiringIp ? "danger" : "success", routeId: "ip.deadlines" },
      { id: "missing-ip-documents", title: "知识产权资料", detail: `${missingIpDocuments} 项档案缺少证书或材料`, count: missingIpDocuments, tone: missingIpDocuments ? "warning" : "success", routeId: "ip.overview" },
      { id: "task-failures", title: "系统协同异常", detail: `${taskFailures.length} 项任务等待重试或人工处理`, count: taskFailures.length, tone: taskFailures.length ? "danger" : "success", routeId: "tasks.exceptions" }
    ];

    const systemStatuses = this.state.systems.map((system) => ({
      id: system.id,
      name: system.name,
      code: system.code,
      status: system.status,
      lastCheckedAt: system.lastCheckedAt,
      taskFailures: taskFailures.filter((task) => task.systemId === system.id).length
    }));

    return {
      metrics: {
        totalAssets: assets.length,
        publishedAssets: publishedAssets.length,
        pendingReviews: pendingReviews.length,
        taskFailures: taskFailures.length,
        publicAssets: publicAssets.length,
        publicCoverage: assets.length ? Math.round(publicAssets.length / assets.length * 100) : 0,
        ipAssets: ipAssets.length,
        patents: ipAssets.filter((asset) => asset.ipProfile?.kind === "patent").length,
        copyrights: ipAssets.filter((asset) => asset.ipProfile?.kind === "software_copyright").length,
        governancePending,
        approvedReviews: this.state.reviews.filter((review) => review.status === "approved").length,
        accessReviews: this.state.users.filter((user) => user.status === "active").length,
        attachments: assets.reduce((sum, asset) => sum + asset.attachments.length, 0)
      },
      currentVersion: this.state.settings.currentVersion,
      lastHrSyncAt: this.state.settings.lastHrSyncAt,
      activityTrend,
      statusSummary,
      departmentContributions,
      governanceRisks,
      ipDeadlines,
      systemStatuses,
      recentReviews: this.state.reviews.slice(0, 6),
      recentLogs: this.state.logs.slice(0, 8),
      recentTasks: this.state.taskDispatches.slice(0, 6),
      typeSummary: Object.entries(assets.reduce<Record<string, number>>((result, asset) => {
        result[asset.type] = (result[asset.type] || 0) + 1;
        return result;
      }, {})).map(([type, count]) => ({ type, count }))
    };
  }

  listAssets(filters: { type?: string; status?: string; keyword?: string; channel?: string }, actor?: UserRecord) {
    const keyword = filters.keyword?.trim().toLowerCase();
    return this.state.assets.filter((asset) => {
      if (actor && !canReadAsset(asset, actor) && !this.canMaintain(asset, actor)) return false;
      if (filters.type && asset.type !== filters.type) return false;
      if (filters.status && asset.status !== filters.status) return false;
      if (filters.channel && asset.channel !== filters.channel) return false;
      if (keyword && !`${asset.title} ${asset.code} ${asset.ownerName} ${asset.departmentName}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }

  assetById(id: string) {
    const asset = this.state.assets.find((item) => item.id === id);
    if (!asset) throw new NotFoundException("资产不存在");
    return asset;
  }

  assetForActor(id: string, actor: UserRecord) {
    const asset = this.assetById(id);
    if (!canReadAsset(asset, actor) && !this.canMaintain(asset, actor)) throw new ForbiddenException("当前账号没有该资产的查看权限");
    return asset;
  }

  assetForAccessPreview(id: string, actor: UserRecord) {
    this.assertRole(actor, ["ASSET_EDITOR", "MODULE_REVIEWER", "ASSET_PUBLISHER", "ORG_ADMIN"], "当前账号没有权限预览能力");
    const asset = this.assetById(id);
    const scopedReviewer = actor.roleCodes.includes("MODULE_REVIEWER") && actor.departmentId === asset.departmentId;
    if (!this.isAdmin(actor) && !this.canMaintain(asset, actor) && !scopedReviewer && !actor.roleCodes.includes("ASSET_PUBLISHER")) throw new ForbiddenException("只能预览负责范围内的资产权限");
    return asset;
  }

  async createAsset(input: Partial<AssetRecord>, actor: UserRecord) {
    if (input.type === "ip") {
      if (!this.hasPermission(actor, "IP_EDIT") && !actor.roleCodes.includes("ASSET_EDITOR")) throw new ForbiddenException("当前账号没有知识产权快速建档权限");
    } else {
      this.assertRole(actor, ["ASSET_EDITOR"], "当前账号没有资产维护权限");
    }
    const createdAt = new Date().toISOString();
    const ipProfile = input.type === "ip" ? this.normalizeIpProfile(input.ipProfile || {}, actor) : undefined;
    const asset: AssetRecord = {
      id: randomUUID(),
      portalKey: input.portalKey,
      code: input.code || `HN-ASSET-${Date.now()}`,
      type: input.type || "document",
      title: input.title || "未命名资产",
      category: input.category || "资料资产",
      summary: input.summary || "",
      ownerId: input.ownerId || actor.id,
      ownerName: input.ownerName || actor.name,
      departmentId: input.departmentId || actor.departmentId,
      departmentName: input.departmentName || actor.departmentName,
      sensitivity: input.sensitivity || "company",
      channel: input.channel || "internal",
      status: "draft",
      version: input.version || "V0.1",
      amount: Number(input.amount || 0),
      showAmountPublic: Boolean(input.showAmountPublic),
      publicFields: input.publicFields || ["summary", "version", "attachments", ...(input.showAmountPublic ? ["amount"] as const : [])],
      featured: Boolean(input.featured),
      sortOrder: this.state.assets.length + 1,
      attachments: (input.attachments || []).map((file) => ({ ...file, visibility: file.visibility || "internal", materialType: file.materialType || "其他材料", isCurrent: file.isCurrent ?? true })),
      audienceTemplates: input.audienceTemplates || [],
      systemIds: input.systemIds || [],
      ipProfile,
      lockVersion: 1,
      createdAt,
      updatedAt: createdAt
    };
    this.state.assets.unshift(asset);
    if (asset.ipProfile) {
      this.recordIpRevision(asset, "create", actor, ["创建知识产权草稿"]);
      this.refreshIpReminders(asset);
    }
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "新增资产", targetType: "asset", targetId: asset.id, targetName: asset.title, result: "success", ip: "local", device: "admin", detail: `创建草稿 ${asset.code}` });
    await this.persist();
    return asset;
  }

  async updateAsset(id: string, input: Partial<AssetRecord>, actor: UserRecord) {
    const asset = this.assetById(id);
    if (!this.canMaintain(asset, actor)) throw new ForbiddenException("只能维护本人或本部门负责的资产");
    if (input.lockVersion !== undefined && Number(input.lockVersion) !== asset.lockVersion) throw new ConflictException("资产已被其他人员更新，请刷新后重试");
    const before = { title: asset.title, status: asset.status, channel: asset.channel, sensitivity: asset.sensitivity, systemIds: asset.systemIds, ipProfile: asset.ipProfile, attachments: asset.attachments };
    const nextInput = { ...input };
    if (asset.type === "ip" && input.ipProfile) nextInput.ipProfile = this.normalizeIpProfile(input.ipProfile, actor);
    if (nextInput.attachments) nextInput.attachments = nextInput.attachments.map((file) => ({ ...file, visibility: file.visibility || "internal", materialType: file.materialType || "其他材料", isCurrent: file.isCurrent ?? true }));
    Object.assign(asset, nextInput, { id: asset.id, lockVersion: asset.lockVersion + 1, updatedAt: new Date().toISOString() });
    if (asset.ipProfile) {
      const changes = Object.keys(nextInput).filter((key) => key !== "lockVersion").map((key) => `更新${key}`);
      this.recordIpRevision(asset, nextInput.attachments ? "file" : "update", actor, changes);
      this.refreshIpReminders(asset);
    }
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "更新资产", targetType: "asset", targetId: asset.id, targetName: asset.title, result: "success", ip: "local", device: "admin", detail: JSON.stringify({ before, after: { title: asset.title, status: asset.status, channel: asset.channel, sensitivity: asset.sensitivity, systemIds: asset.systemIds } }) });
    await this.persist();
    return asset;
  }

  async archiveAsset(id: string, actor: UserRecord) {
    const asset = this.assetById(id);
    if (!this.canMaintain(asset, actor)) throw new ForbiddenException("当前账号没有归档该资产的权限");
    asset.status = "archived";
    asset.lockVersion += 1;
    asset.updatedAt = new Date().toISOString();
    await this.invalidateTasks(asset, actor);
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "归档资产", targetType: "asset", targetId: asset.id, targetName: asset.title, result: "success", ip: "local", device: "admin", detail: "资产已归档，关联目标任务已发送作废通知" });
    await this.persist();
    return asset;
  }

  listReviews() {
    return this.state.reviews;
  }

  async submitReview(assetId: string, actor: UserRecord) {
    const asset = this.assetById(assetId);
    if (!this.canMaintain(asset, actor)) throw new ForbiddenException("当前账号不能提交该资产审核");
    if (asset.ipProfile) asset.ipProfile = this.normalizeIpProfile(asset.ipProfile, actor, true);
    asset.status = "reviewing";
    asset.lockVersion += 1;
    const reviewer = this.state.users.find((user) => user.id !== actor.id && (asset.ipProfile ? user.permissionCodes.includes("IP_REVIEW") : user.roleCodes.includes("MODULE_REVIEWER"))) || this.state.users.find((user) => user.id !== actor.id && user.roleCodes.includes("MODULE_REVIEWER")) || this.state.users[1];
    this.state.ipRelations.filter((relation) => relation.relatedAssetId === asset.id).forEach((relation) => {
      if (relation.status === "draft" || relation.status === "rejected") relation.status = "reviewing";
      if (relation.pendingRemoval && ["draft", "rejected"].includes(relation.removalStatus || "draft")) relation.removalStatus = "reviewing";
      relation.updatedAt = new Date().toISOString();
    });
    const review: ReviewRecord = {
      id: randomUUID(),
      assetId: asset.id,
      assetTitle: asset.title,
      revisionId: `${asset.id}-r${asset.lockVersion}`,
      submitterId: actor.id,
      submitterName: actor.name,
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      status: "pending",
      submittedAt: new Date().toISOString()
    };
    this.state.reviews.unshift(review);
    if (asset.ipProfile) this.recordIpRevision(asset, "review", actor, ["提交知识产权审核"]);
    await this.persist();
    return review;
  }

  async decideReview(id: string, decision: "approve" | "reject", comment: string, actor: UserRecord) {
    const review = this.state.reviews.find((item) => item.id === id);
    if (!review) throw new NotFoundException("审核任务不存在");
    if (review.submitterId === actor.id) throw new ConflictException("维护人不能审核自己提交的内容");
    const reviewedAsset = this.assetById(review.assetId);
    if (!this.isAdmin(actor) && !actor.roleCodes.includes("MODULE_REVIEWER") && !(reviewedAsset.type === "ip" && this.hasPermission(actor, "IP_REVIEW"))) throw new ForbiddenException("当前账号没有模块审核权限");
    if (!this.isAdmin(actor) && review.reviewerId !== actor.id) throw new ForbiddenException("该审核任务未分配给当前账号");
    if (review.status !== "pending") throw new ConflictException("该审核任务已处理");
    const asset = reviewedAsset;
    review.status = decision === "approve" ? "approved" : "rejected";
    review.decidedAt = new Date().toISOString();
    review.comment = comment;
    asset.status = decision === "approve" ? "approved" : "rejected";
    asset.lockVersion += 1;
    this.state.ipRelations.filter((relation) => relation.relatedAssetId === asset.id).forEach((relation) => {
      if (relation.status === "reviewing") relation.status = decision === "approve" ? "approved" : "rejected";
      if (relation.removalStatus === "reviewing") relation.removalStatus = decision === "approve" ? "approved" : "rejected";
      relation.updatedAt = new Date().toISOString();
    });
    if (decision === "approve") await this.dispatchTasks(asset, review.revisionId);
    if (asset.ipProfile) this.recordIpRevision(asset, "review", actor, [decision === "approve" ? "知识产权审核通过" : "知识产权审核驳回"]);
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: decision === "approve" ? "审核通过" : "审核驳回", targetType: "review", targetId: review.id, targetName: asset.title, result: "success", ip: "local", device: "admin", detail: comment || "无补充说明" });
    await this.persist();
    return review;
  }

  private async dispatchTasks(asset: AssetRecord, revisionId: string) {
    for (const systemId of asset.systemIds) {
      const system = this.state.systems.find((item) => item.id === systemId);
      if (!system) continue;
      const template = this.state.taskTemplates.find((item) => item.id === system.taskTemplateId && item.enabled);
      if (!template) continue;
      const idempotencyKey = `${revisionId}:${system.id}:${template.id}`;
      if (this.state.taskDispatches.some((item) => item.idempotencyKey === idempotencyKey)) continue;
      const record: TaskDispatchRecord = {
        id: randomUUID(),
        idempotencyKey,
        assetId: asset.id,
        assetTitle: asset.title,
        revisionId,
        systemId: system.id,
        systemName: system.name,
        templateId: template.id,
        status: "created",
        externalTaskId: `${system.code}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        externalUrl: `${system.baseUrl}/tasks/${encodeURIComponent(asset.code)}`,
        attempt: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.state.taskDispatches.unshift(record);
      this.audit({ kind: "task", actorId: "system", actorName: "系统任务", departmentName: "资产治理", action: "自动创建项目任务", targetType: "task", targetId: record.id, targetName: `${system.name} / ${asset.title}`, result: "success", ip: "internal", device: "connector", detail: `幂等键 ${idempotencyKey}` });
    }
  }

  private async invalidateTasks(asset: AssetRecord, actor: UserRecord) {
    const tasks = this.state.taskDispatches.filter((item) => item.assetId === asset.id && item.status === "created");
    for (const task of tasks) {
      task.status = "invalidated";
      task.updatedAt = new Date().toISOString();
      this.audit({ kind: "task", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "发送任务作废通知", targetType: "task", targetId: task.id, targetName: `${task.systemName} / ${asset.title}`, result: "success", ip: "internal", device: "connector", detail: "保留目标任务并追加资产修订作废说明" });
    }
  }

  async retryTask(id: string, actor: UserRecord) {
    const task = this.state.taskDispatches.find((item) => item.id === id);
    if (!task) throw new NotFoundException("任务分发记录不存在");
    task.attempt += 1;
    task.status = "created";
    task.error = undefined;
    task.externalTaskId ||= `RETRY-${Date.now()}`;
    task.externalUrl ||= `${this.state.systems.find((item) => item.id === task.systemId)?.baseUrl || "#"}/tasks/${task.externalTaskId}`;
    task.nextRetryAt = undefined;
    task.updatedAt = new Date().toISOString();
    this.audit({ kind: "task", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "人工重试项目任务", targetType: "task", targetId: task.id, targetName: task.assetTitle, result: "success", ip: "local", device: "admin", detail: `第 ${task.attempt} 次创建成功` });
    await this.persist();
    return task;
  }

  private async processDueRetries() {
    let changed = false;
    const current = Date.now();
    for (const task of this.state.taskDispatches) {
      if (task.status !== "retrying" || !task.nextRetryAt || Date.parse(task.nextRetryAt) > current) continue;
      task.attempt += 1;
      if (task.attempt >= retryDelays.length) {
        task.status = "failed";
        task.nextRetryAt = undefined;
      } else {
        task.nextRetryAt = new Date(current + retryDelays[task.attempt]).toISOString();
      }
      task.updatedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) await this.persist();
  }

  taskDispatches() {
    return this.state.taskDispatches;
  }

  releases() {
    return this.state.releases;
  }

  async createRelease(input: { version: string; title: string; changes?: string[] }, actor: UserRecord) {
    this.assertRole(actor, ["ASSET_PUBLISHER"], "当前账号没有统一发布权限");
    if (!/^v\d+\.\d+\.\d+$/.test(input.version)) throw new ConflictException("版本号必须符合 vX.Y.Z");
    if (this.state.releases.some((item) => item.version === input.version)) throw new ConflictException("版本号已存在");
    const approved = this.state.assets.filter((asset) => asset.status === "approved");
    if (!approved.length) throw new ConflictException("没有已评审且待发布的资产");
    const unsafePublic = approved.find((asset) => asset.channel === "both" && ["confidential", "restricted"].includes(asset.sensitivity));
    if (unsafePublic) throw new ConflictException(`“${unsafePublic.title}”为机密或严格受限资产，不能进入公开渠道`);
    const approvedRelations = this.state.ipRelations.filter((relation) => relation.status === "approved" || relation.removalStatus === "approved");
    const unresolvedRelation = approvedRelations.find((relation) => {
      if (relation.removalStatus === "approved") return false;
      const ipAsset = this.state.assets.find((asset) => asset.id === relation.ipAssetId);
      return !ipAsset || !["published", "approved"].includes(ipAsset.status);
    });
    if (unresolvedRelation) throw new ConflictException("存在知识产权尚未发布的关联，请先完成知识产权档案审核");
    const previousIds = new Set(this.state.assets.filter((asset) => asset.status === "published").map((asset) => asset.id));
    approved.forEach((asset) => {
      asset.status = "published";
      asset.updatedAt = new Date().toISOString();
      if (asset.ipProfile) this.recordIpRevision(asset, "publish", actor, [`随版本 ${input.version} 发布`]);
    });
    approvedRelations.forEach((relation) => {
      if (relation.removalStatus === "approved") {
        relation.status = "archived";
        relation.pendingRemoval = false;
        relation.removalStatus = undefined;
      } else if (relation.status === "approved") {
        relation.status = "published";
        relation.publishedAt = new Date().toISOString();
      }
      relation.updatedAt = new Date().toISOString();
    });
    const affectedSystemIds = [...new Set(approved.flatMap((asset) => asset.systemIds))];
    const release: ReleaseRecord = {
      id: randomUUID(),
      version: input.version,
      title: input.title,
      status: "published",
      assetCount: this.state.assets.filter((asset) => asset.status === "published").length,
      publicAssetCount: this.state.assets.filter((asset) => asset.status === "published" && asset.channel === "both").length,
      publisherName: actor.name,
      publishedAt: new Date().toISOString(),
      changes: input.changes || [],
      affectedSystemIds,
      diff: {
        added: approved.filter((asset) => !previousIds.has(asset.id)).length,
        updated: approved.filter((asset) => previousIds.has(asset.id)).length,
        removed: 0
      }
    };
    this.state.releases.unshift(release);
    this.state.settings.currentVersion = release.version;
    const baseline = await this.baselinePortalDataset();
    const snapshotActor = this.isAdmin(actor) ? actor : { ...actor, roleCodes: [...actor.roleCodes, "ASSET_ADMIN"] };
    const internalSnapshot = buildPortalDataset(baseline, this.state, "internal", snapshotActor);
    const publicSnapshot = buildPortalDataset(baseline, this.state, "public");
    const snapshotDir = path.resolve(process.cwd(), "server/releases", release.version);
    await mkdir(snapshotDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(snapshotDir, "internal.json"), JSON.stringify(internalSnapshot, null, 2), "utf8"),
      writeFile(path.join(snapshotDir, "public.json"), JSON.stringify(publicSnapshot, null, 2), "utf8"),
      writeFile(path.join(snapshotDir, "state.json"), JSON.stringify({ assets: this.state.assets, displayModules: this.state.settings.displayModules, ipBusinessVersions: this.state.ipBusinessVersions, ipArchiveRevisions: this.state.ipArchiveRevisions, ipRelations: this.state.ipRelations, ipReminders: this.state.ipReminders }, null, 2), "utf8")
    ]);
    release.internalSnapshotPath = path.relative(process.cwd(), path.join(snapshotDir, "internal.json"));
    release.publicSnapshotPath = path.relative(process.cwd(), path.join(snapshotDir, "public.json"));
    release.stateSnapshotPath = path.relative(process.cwd(), path.join(snapshotDir, "state.json"));
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "发布版本", targetType: "release", targetId: release.id, targetName: release.version, result: "success", ip: "local", device: "admin", detail: `${release.assetCount} 项内部资产，${release.publicAssetCount} 项公开资产` });
    await this.persist();
    return release;
  }

  private async ensureCurrentReleaseSnapshots() {
    const release = this.state.releases.find((item) => item.version === this.state.settings.currentVersion);
    if (!release || (release.internalSnapshotPath && release.publicSnapshotPath && release.stateSnapshotPath)) return;
    const baseline = await this.baselinePortalDataset();
    const admin = this.state.users.find((user) => this.isAdmin(user)) || this.state.users[0];
    const snapshotDir = path.resolve(process.cwd(), "server/releases", release.version);
    await mkdir(snapshotDir, { recursive: true });
    const internalPath = path.join(snapshotDir, "internal.json");
    const publicPath = path.join(snapshotDir, "public.json");
    const statePath = path.join(snapshotDir, "state.json");
    await Promise.all([
      writeFile(internalPath, JSON.stringify(buildPortalDataset(baseline, this.state, "internal", admin), null, 2), "utf8"),
      writeFile(publicPath, JSON.stringify(buildPortalDataset(baseline, this.state, "public"), null, 2), "utf8"),
      writeFile(statePath, JSON.stringify({ assets: this.state.assets, displayModules: this.state.settings.displayModules, ipBusinessVersions: this.state.ipBusinessVersions, ipArchiveRevisions: this.state.ipArchiveRevisions, ipRelations: this.state.ipRelations, ipReminders: this.state.ipReminders }, null, 2), "utf8")
    ]);
    release.internalSnapshotPath = path.relative(process.cwd(), internalPath);
    release.publicSnapshotPath = path.relative(process.cwd(), publicPath);
    release.stateSnapshotPath = path.relative(process.cwd(), statePath);
  }

  async rollbackRelease(id: string, actor: UserRecord) {
    this.assertRole(actor, ["ASSET_PUBLISHER"], "当前账号没有版本回滚权限");
    const target = this.state.releases.find((item) => item.id === id);
    if (!target) throw new NotFoundException("发布版本不存在");
    if (target.version === this.state.settings.currentVersion) throw new ConflictException("该版本已是当前版本");
    if (!target.stateSnapshotPath) throw new ConflictException("该版本没有可恢复的后台状态快照");
    const snapshot = JSON.parse(await readFile(path.resolve(process.cwd(), target.stateSnapshotPath), "utf8"));
    if (!Array.isArray(snapshot.assets) || !Array.isArray(snapshot.displayModules)) throw new ConflictException("版本状态快照不完整");
    const current = this.state.releases.find((item) => item.version === this.state.settings.currentVersion);
    if (current) current.status = "rolled_back";
    target.status = "published";
    this.state.assets = snapshot.assets;
    this.state.settings.displayModules = snapshot.displayModules;
    this.state.ipBusinessVersions = snapshot.ipBusinessVersions || this.state.ipBusinessVersions;
    this.state.ipArchiveRevisions = snapshot.ipArchiveRevisions || this.state.ipArchiveRevisions;
    this.state.ipRelations = snapshot.ipRelations || this.state.ipRelations;
    this.state.ipReminders = snapshot.ipReminders || this.state.ipReminders;
    this.state.settings.currentVersion = target.version;
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "回滚发布版本", targetType: "release", targetId: target.id, targetName: target.version, result: "success", ip: "local", device: "admin", detail: "已恢复资产和展示配置状态快照" });
    await this.persist();
    return target;
  }

  async hrSync(actor: UserRecord) {
    this.assertRole(actor, ["ORG_ADMIN"], "当前账号没有组织同步权限");
    this.state.settings.lastHrSyncAt = new Date().toISOString();
    this.audit({ kind: "permission", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "达铃全量同步", targetType: "organization", targetId: "daling", targetName: "组织人员与权限编码", result: "success", ip: "internal", device: "daling-adapter", detail: `同步 ${this.state.users.length} 人、${this.state.departments.length} 个部门并重算个人最终权限` });
    await this.persist();
    return { syncedUsers: this.state.users.length, syncedDepartments: this.state.departments.length, completedAt: this.state.settings.lastHrSyncAt };
  }

  async applyDalingPersonnelChange(input: DalingPersonnelChange, secret: string) {
    const expected = process.env.DALING_WEBHOOK_SECRET || "daling-local-webhook-secret";
    const actualBuffer = Buffer.from(secret || "");
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new ForbiddenException("达铃回调凭据无效");
    if (!input.eventId || !input.dalingId || !input.eventType || Number.isNaN(Date.parse(input.occurredAt))) throw new BadRequestException("达铃人员变更事件字段不完整");
    const eventKey = `daling:${input.eventId}`;
    if (this.state.processedEventIds.includes(eventKey)) return { accepted: true, duplicate: true };
    let user = this.state.users.find((item) => item.dalingId === input.dalingId);
    const department = this.state.departments.find((item) => item.id === input.departmentId || item.code === input.departmentCode || item.name === input.departmentName);
    if (!user) {
      if (!input.name || !input.phone || !input.employeeCode || !department) throw new BadRequestException("新增人员缺少姓名、手机号、工号或有效部门");
      user = {
        id: `user-${randomUUID()}`,
        dalingId: input.dalingId,
        name: input.name,
        phone: input.phone,
        employeeCode: input.employeeCode,
        departmentId: department.id,
        departmentName: department.name,
        position: input.position || "员工",
        roleCodes: input.roleCodes || [],
        permissionCodes: input.permissionCodes || [],
        status: input.eventType === "disable" ? "disabled" : "active",
        passwordHash: hashPassword(randomUUID())
      };
      this.state.users.push(user);
    } else {
      if (input.name) user.name = input.name;
      if (input.phone) user.phone = input.phone;
      if (input.employeeCode) user.employeeCode = input.employeeCode;
      if (department) {
        user.departmentId = department.id;
        user.departmentName = department.name;
      }
      if (input.position) user.position = input.position;
      if (input.roleCodes) user.roleCodes = [...input.roleCodes];
      if (input.permissionCodes) user.permissionCodes = [...input.permissionCodes];
      user.status = input.eventType === "disable" ? "disabled" : "active";
    }
    if (input.eventType === "disable") {
      for (const asset of this.state.assets.filter((item) => item.type === "ip" && item.ipProfile?.primaryOwnerId === user!.id)) {
        const exists = this.state.ipReminders.some((reminder) => reminder.ipAssetId === asset.id && reminder.type === "owner_handover" && ["scheduled", "open"].includes(reminder.status));
        if (exists || !asset.ipProfile) continue;
        const createdAt = new Date().toISOString();
        const reminder: IpReminderRecord = {
          id: `ip-handover:${asset.id}:${input.eventId}`,
          ipAssetId: asset.id,
          ipAssetTitle: asset.title,
          type: "owner_handover",
          dueDate: createdAt.slice(0, 10),
          remindAt: createdAt,
          offsetDays: 0,
          status: "open",
          ownerId: user.id,
          ownerName: user.name,
          collaboratorIds: [...asset.ipProfile.collaboratorIds],
          systemIds: [...(asset.ipProfile.reminderSystemIds.length ? asset.ipProfile.reminderSystemIds : this.state.settings.ipDefaultSystemIds)],
          taskDispatchIds: [],
          generated: false,
          triggeredAt: createdAt,
          createdAt,
          updatedAt: createdAt
        };
        this.state.ipReminders.unshift(reminder);
        this.dispatchIpReminderTasks(reminder);
      }
    }
    this.state.departments.forEach((item) => { item.memberCount = this.state.users.filter((person) => person.status === "active" && person.departmentId === item.id).length; });
    this.state.processedEventIds.push(eventKey);
    this.state.processedEventIds = this.state.processedEventIds.slice(-5000);
    this.audit({ kind: "permission", actorId: "daling", actorName: "达铃人事系统", departmentName: user.departmentName, action: "处理人员变更回调", targetType: "person", targetId: user.dalingId, targetName: user.name, result: "success", ip: "internal", device: "daling-webhook", detail: `${input.eventType} 已同步并重算最终个人权限` });
    await this.persist();
    return { accepted: true, duplicate: false, userId: user.id, status: user.status };
  }

  async recordPortalEvents(events: PortalEventInput[], actor?: UserRecord) {
    let accepted = 0;
    for (const event of events.slice(0, 50)) {
      if (this.state.processedEventIds.includes(event.eventId)) continue;
      this.state.processedEventIds.push(event.eventId);
      this.audit({ kind: event.eventType === "download" ? "download" : "portal", actorId: actor?.id || "public-anonymous", actorName: actor?.name || "匿名访客", departmentName: actor?.departmentName || "公开渠道", action: event.eventType, targetType: event.assetId ? "asset" : "module", targetId: event.assetId || event.module || "portal", targetName: event.module || event.assetId || "无形资产工作台", result: "success", ip: actor ? "internal" : "anonymized", device: event.deviceType || "unknown", detail: `来源 ${event.source || "direct"}` });
      accepted += 1;
    }
    this.state.processedEventIds = this.state.processedEventIds.slice(-5000);
    if (accepted) await this.persist();
    return { accepted };
  }

  logs(kind?: string, actor?: UserRecord) {
    let rows = kind ? this.state.logs.filter((log) => log.kind === kind) : this.state.logs;
    if (!actor || this.isAdmin(actor) || actor.roleCodes.includes("ASSET_AUDITOR")) return rows;
    if (actor.roleCodes.includes("MODULE_REVIEWER")) rows = rows.filter((log) => log.departmentName === actor.departmentName || log.actorId === actor.id);
    else rows = rows.filter((log) => log.actorId === actor.id);
    return rows;
  }

  private async baselinePortalDataset(): Promise<PortalDataset> {
    const datasetPath = path.resolve(process.cwd(), process.env.PORTAL_DATASET_PATH || "public/portal-data.local.json");
    try {
      return JSON.parse(await readFile(datasetPath, "utf8")) as PortalDataset;
    } catch {
      return { appVersionInfo: { currentVersion: this.state.settings.currentVersion, history: [] } };
    }
  }

  async portalDataset(actor: UserRecord) {
    return buildPortalDataset(await this.baselinePortalDataset(), this.state, "internal", actor);
  }

  async publicPackage() {
    return buildPortalDataset(await this.baselinePortalDataset(), this.state, "public");
  }

  displayConfig() {
    return this.state.settings.displayModules;
  }

  async updateDisplayConfig(input: DisplayModuleConfig[], actor: UserRecord) {
    this.assertRole(actor, ["ASSET_PUBLISHER"], "当前账号没有展示配置权限");
    const known = new Set(this.state.settings.displayModules.map((item) => item.id));
    if (!Array.isArray(input) || input.some((item) => !known.has(item.id))) throw new BadRequestException("展示模块配置不完整");
    this.state.settings.displayModules = input.map((item) => ({
      ...item,
      visible: Boolean(item.visible),
      publicVisible: Boolean(item.publicVisible),
      sort: Math.max(1, Number(item.sort || 1)),
      featured: Math.max(0, Math.min(30, Number(item.featured || 0))),
      fields: Array.isArray(item.fields) ? item.fields : []
    })).sort((left, right) => left.sort - right.sort);
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "保存首页展示配置", targetType: "display", targetId: "portal", targetName: "首页模块与渠道", result: "success", ip: "local", device: "admin", detail: `${input.length} 个展示模块已更新，将在下次发布快照时生效` });
    await this.persist();
    return this.state.settings.displayModules;
  }

  async testIntegration(id: string, actor: UserRecord) {
    this.assertRole(actor, ["SYSTEM_ADMIN"], "当前账号没有系统开放配置权限");
    const system = this.state.systems.find((item) => item.id === id);
    if (!system) throw new NotFoundException("目标系统不存在");
    system.lastCheckedAt = new Date().toISOString();
    if (system.status !== "disabled") system.status = "active";
    this.audit({ kind: "system", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "目标系统连接测试", targetType: "system", targetId: system.id, targetName: system.name, result: "success", ip: "internal", device: "connector", detail: "模拟连接、凭据与任务接口检查通过" });
    await this.persist();
    return { systemId: system.id, status: system.status, checkedAt: system.lastCheckedAt, latencyMs: 86 };
  }

  async createBackup(actor: UserRecord) {
    this.assertRole(actor, ["SYSTEM_ADMIN"], "当前账号没有备份执行权限");
    const result = await this.persistence.backup(this.state);
    this.state.settings.lastBackupAt = result.verifiedAt;
    this.state.settings.lastBackupPath = result.path;
    this.audit({ kind: "operation", actorId: actor.id, actorName: actor.name, departmentName: actor.departmentName, action: "执行数据备份与恢复校验", targetType: "backup", targetId: result.path, targetName: "数据库与业务状态", result: "success", ip: "local", device: "admin", detail: `${result.bytes} 字节，校验时间 ${result.verifiedAt}` });
    await this.persist();
    return result;
  }

  private externalSystem(clientCode: string, secret: string) {
    const system = this.state.systems.find((item) => item.code.toLowerCase() === clientCode.toLowerCase() && item.status === "active");
    if (!system) throw new ForbiddenException("系统客户端不存在或已停用");
    const expected = process.env[`SYSTEM_CLIENT_SECRET_${system.code}`] || `${system.code.toLowerCase()}-local-secret`;
    const actualBuffer = Buffer.from(secret || "");
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new ForbiddenException("系统客户端凭据无效");
    return system;
  }

  private systemGrant(systemId: string, assetId: string, fileId: string, secret: string) {
    const expiresAt = Date.now() + 5 * 60_000;
    const payload = `${systemId}|${assetId}|${fileId}|${expiresAt}`;
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    return { token: `${expiresAt}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
  }

  private verifySystemGrant(systemId: string, assetId: string, fileId: string, secret: string, grant: string) {
    const [expiresRaw, signature = ""] = String(grant || "").split(".");
    const expiresAt = Number(expiresRaw);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new ForbiddenException("系统附件地址已过期");
    const expected = createHmac("sha256", secret).update(`${systemId}|${assetId}|${fileId}|${expiresAt}`).digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) throw new ForbiddenException("系统附件地址无效");
  }

  async systemAsset(clientCode: string, secret: string, assetId: string) {
    const system = this.externalSystem(clientCode, secret);
    const asset = this.assetById(assetId);
    if (asset.status !== "published" || !asset.systemIds.includes(system.id)) throw new ForbiddenException("该系统未获得此资产的调用权限");
    this.audit({ kind: "system", actorId: system.id, actorName: system.name, departmentName: "公司系统", action: "读取资产全部字段", targetType: "asset", targetId: asset.id, targetName: asset.title, result: "success", ip: "internal", device: "client-credentials", detail: `返回 ${Object.keys(asset).length} 个字段和 ${asset.attachments.length} 个附件引用` });
    await this.persist();
    const attachments = asset.attachments.map((file) => {
      const { token, expiresAt } = this.systemGrant(system.id, asset.id, file.id, secret);
      const { storageKey: _storageKey, ...safeFile } = file;
      return { ...safeFile, expiresAt, downloadUrl: `/api/portal/system/${system.code}/assets/${asset.id}/files/${file.id}?grant=${encodeURIComponent(token)}` };
    });
    return {
      ...asset,
      attachments
    };
  }

  async systemAssetFile(clientCode: string, secret: string, assetId: string, fileId: string, grant: string) {
    const system = this.externalSystem(clientCode, secret);
    this.verifySystemGrant(system.id, assetId, fileId, secret, grant);
    const asset = this.assetById(assetId);
    const file = asset.attachments.find((item) => item.id === fileId);
    if (!file || asset.status !== "published" || !asset.systemIds.includes(system.id)) throw new ForbiddenException("该系统未获得此附件的调用权限");
    this.audit({ kind: "system", actorId: system.id, actorName: system.name, departmentName: "公司系统", action: "读取资产附件", targetType: "file", targetId: file.id, targetName: `${asset.title} / ${file.name}`, result: "success", ip: "internal", device: "client-credentials", detail: `附件版本 V${file.version}，${file.size} 字节` });
    await this.persist();
    return { asset, file };
  }

  async registerPublicDownload(assetId: string, fileId: string, input: Omit<PublicDownloadRegistration, "id" | "assetId" | "fileId" | "consentedAt" | "grantToken" | "expiresAt">) {
    const { asset, file } = this.publicAssetFile(assetId, fileId);
    if (file.publicMode !== "registered") throw new BadRequestException("该附件不需要登记下载");
    if (!input.name?.trim() || !input.organization?.trim() || !/^1\d{10}$/.test(input.phone || "") || !input.purpose?.trim() || input.consent !== true) throw new BadRequestException("请完整填写姓名、单位、手机号、用途并同意下载记录");
    const registration: PublicDownloadRegistration = {
      ...input,
      id: randomUUID(), assetId, fileId,
      consentedAt: new Date().toISOString(),
      grantToken: randomUUID(),
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString()
    };
    this.state.downloadRegistrations.unshift(registration);
    this.audit({ kind: "download", actorId: "public-registered", actorName: input.name, departmentName: input.organization, action: "公开附件登记", targetType: "asset", targetId: asset.id, targetName: asset.title, result: "success", ip: "anonymized", device: "public", detail: `用途已登记，请求编号 ${registration.id}` });
    await this.persist();
    return { grantToken: registration.grantToken, expiresAt: registration.expiresAt, downloadUrl: `/api/portal/assets/${assetId}/files/${fileId}/download?grant=${registration.grantToken}` };
  }

  publicAssetFile(assetId: string, fileId: string, grantToken?: string, purpose: "preview" | "download" = "preview") {
    const asset = this.assetById(assetId);
    const file = asset.attachments.find((item) => item.id === fileId);
    if (!file || file.isCurrent === false || file.visibility !== "public" || asset.status !== "published" || asset.channel !== "both" || ["confidential", "restricted"].includes(asset.sensitivity) || !asset.publicFields.includes("attachments")) throw new NotFoundException("公开附件不存在");
    if (purpose === "download" && file.publicMode === "preview") throw new ForbiddenException("该附件仅支持在线查看");
    if (purpose === "download" && file.publicMode === "registered") {
      const registration = this.state.downloadRegistrations.find((item) => item.grantToken === grantToken && item.assetId === assetId && item.fileId === fileId && Date.parse(item.expiresAt) > Date.now());
      if (!registration) throw new ForbiddenException("下载登记凭据无效或已过期");
    }
    return { asset, file };
  }

  async recordFileAccess(asset: AssetRecord, fileId: string, actor: UserRecord | undefined, result: "success" | "denied", action: string, detail: string) {
    this.audit({ kind: "download", actorId: actor?.id || "public-anonymous", actorName: actor?.name || "匿名访客", departmentName: actor?.departmentName || "公开渠道", action, targetType: "file", targetId: fileId, targetName: asset.title, result, ip: actor ? "internal" : "anonymized", device: actor ? "admin" : "public", detail });
    await this.persist();
  }

  async recordPublicFileDenial(assetId: string, fileId: string, detail: string) {
    const asset = this.state.assets.find((item) => item.id === assetId);
    this.audit({ kind: "download", actorId: "public-anonymous", actorName: "匿名访客", departmentName: "公开渠道", action: "公开附件访问拒绝", targetType: "file", targetId: fileId, targetName: asset?.title || assetId, result: "denied", ip: "anonymized", device: "public", detail: detail.slice(0, 240) });
    await this.persist();
  }
}
