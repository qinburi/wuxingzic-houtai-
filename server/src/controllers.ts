import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type { AssetRecord, DalingPersonnelChange, IpBusinessVersion, IpProfile, IpRelationType, PortalEventInput } from "../../shared/contracts.js";
import { AuthGuard, safeUser, sessionUser, signSession } from "./auth.js";
import { canAccessAsset } from "./portal-dataset.js";
import type { UserRecord } from "./seed.js";
import { StateService } from "./state.service.js";
import { StorageService } from "./storage.service.js";

const actor = (request: { user: UserRecord }) => request.user;
const disposition = (name: string, inline = false) => `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`;

@Controller("auth")
export class AuthController {
  constructor(private readonly state: StateService) {}

  @Post("login")
  async login(@Body() body: { phone?: string; password?: string }, @Req() request: any) {
    if (!body.phone || !body.password) throw new BadRequestException("请输入手机号和密码");
    const user = await this.state.authenticate(body.phone, body.password, request.ip || "local", request.headers["user-agent"] || "unknown");
    if (!user) throw new BadRequestException("手机号或密码错误");
    return { token: signSession(user), user: safeUser(user), expiresIn: 28800 };
  }

  @UseGuards(AuthGuard)
  @Get("me")
  me(@Req() request: any) {
    return safeUser(actor(request));
  }

  @Post("mock-sms")
  mockSms(@Body() body: { phone?: string }) {
    if (!body.phone) throw new BadRequestException("请输入手机号");
    return { sent: true, developmentCode: "246810", expiresIn: 300 };
  }
}

@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly state: StateService) {}
  @Get()
  get(@Req() request: any) { return this.state.dashboard(actor(request)); }
}

@UseGuards(AuthGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly state: StateService) {}

  @Get()
  list(@Req() request: any, @Query("type") type?: string, @Query("status") status?: string, @Query("keyword") keyword?: string, @Query("channel") channel?: string) {
    return this.state.listAssets({ type, status, keyword, channel }, actor(request));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() request: any) { return this.state.assetForActor(id, actor(request)); }

  @Post()
  create(@Body() body: Partial<AssetRecord>, @Req() request: any) { return this.state.createAsset(body, actor(request)); }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<AssetRecord>, @Req() request: any) { return this.state.updateAsset(id, body, actor(request)); }

  @Delete(":id")
  archive(@Param("id") id: string, @Req() request: any) { return this.state.archiveAsset(id, actor(request)); }

  @Post(":id/submit-review")
  submitReview(@Param("id") id: string, @Req() request: any) { return this.state.submitReview(id, actor(request)); }

  @Get(":id/access-preview")
  accessPreview(@Param("id") id: string, @Req() request: any) {
    const asset = this.state.assetForAccessPreview(id, actor(request));
    const publicVisible = asset.channel === "both" && !["confidential", "restricted"].includes(asset.sensitivity);
    return {
      public: { visible: publicVisible, amountVisible: publicVisible && asset.showAmountPublic && asset.publicFields.includes("amount"), attachments: publicVisible && asset.publicFields.includes("attachments") ? asset.attachments.map((file) => ({ name: file.name, mode: file.publicMode })) : [] },
      company: { visible: true, amountVisible: true, actions: ["查看", "预览", "下载"] },
      department: { visible: true, department: asset.departmentName, actions: ["查看", "预览", "下载"] },
      person: { visible: true, owner: asset.ownerName, actions: ["查看", "预览", "下载"] },
      systems: asset.systemIds.map((systemId) => ({ system: this.state.snapshot().systems.find((item) => item.id === systemId)?.name || systemId, fields: "全部字段", attachments: "全部附件（含后续新增）" }))
    };
  }

  @Get(":id/ip-relations")
  relations(@Param("id") id: string, @Req() request: any) { return this.state.ipRelationsForAsset(id, actor(request)); }

  @Post(":id/ip-relations")
  bindIp(@Param("id") id: string, @Body() body: { ipAssetId?: string; relationType?: IpRelationType; contributionNote?: string }, @Req() request: any) {
    return this.state.createIpRelation(id, body, actor(request));
  }

  @Post(":id/ip-relations/quick-create")
  quickCreateIp(@Param("id") id: string, @Body() body: { title?: string; code?: string; ipProfile?: Partial<IpProfile>; relationType?: IpRelationType; contributionNote?: string }, @Req() request: any) {
    return this.state.quickCreateIpRelation(id, body, actor(request));
  }

  @Patch(":assetId/ip-relations/:relationId")
  updateIpRelation(@Param("relationId") relationId: string, @Body() body: { relationType?: IpRelationType; contributionNote?: string }, @Req() request: any) {
    return this.state.updateIpRelation(relationId, body, actor(request));
  }

  @Delete(":assetId/ip-relations/:relationId")
  removeIpRelation(@Param("relationId") relationId: string, @Req() request: any) {
    return this.state.removeIpRelation(relationId, actor(request));
  }
}

@UseGuards(AuthGuard)
@Controller("ip-assets")
export class IpAssetsController {
  constructor(private readonly state: StateService) {}

  @Get("workspace")
  workspace(@Req() request: any) { return this.state.ipWorkspace(actor(request)); }

  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename*=UTF-8''hannao-ip-assets.csv")
  export(@Req() request: any) { return `\ufeff${this.state.exportIpAssets(actor(request))}`; }

  @Get()
  list(@Req() request: any, @Query("kind") kind?: string, @Query("status") status?: string, @Query("keyword") keyword?: string) {
    return this.state.listIpAssets({ kind, status, keyword }, actor(request));
  }

  @Get(":id")
  detail(@Param("id") id: string, @Req() request: any) { return this.state.ipAssetDetail(id, actor(request)); }

  @Post()
  create(@Body() body: Partial<AssetRecord>, @Req() request: any) { return this.state.createIpAsset(body, actor(request)); }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<AssetRecord>, @Req() request: any) { return this.state.updateIpAsset(id, body, actor(request)); }

  @Post(":id/business-versions")
  addVersion(@Param("id") id: string, @Body() body: Partial<IpBusinessVersion>, @Req() request: any) { return this.state.addIpBusinessVersion(id, body, actor(request)); }

  @Post("reminders/:id/complete")
  completeReminder(@Param("id") id: string, @Body() body: { note?: string }, @Req() request: any) { return this.state.completeIpReminder(id, body.note || "", actor(request)); }

  @Post("migration-issues/:id/resolve")
  resolveMigration(@Param("id") id: string, @Body() body: { relatedAssetId?: string }, @Req() request: any) {
    if (!body.relatedAssetId) throw new BadRequestException("请选择要绑定的资产");
    return this.state.resolveIpMigrationIssue(id, body.relatedAssetId, actor(request));
  }
}

@UseGuards(AuthGuard)
@Controller("workflow")
export class WorkflowController {
  constructor(private readonly state: StateService) {}

  @Get("reviews")
  reviews() { return this.state.listReviews(); }

  @Post("reviews/:id/decision")
  decide(@Param("id") id: string, @Body() body: { decision?: "approve" | "reject"; comment?: string }, @Req() request: any) {
    if (!body.decision) throw new BadRequestException("请选择审核结果");
    return this.state.decideReview(id, body.decision, body.comment || "", actor(request));
  }

  @Get("releases")
  releases() { return this.state.releases(); }

  @Post("releases")
  release(@Body() body: { version?: string; title?: string; changes?: string[] }, @Req() request: any) {
    if (!body.version || !body.title) throw new BadRequestException("请输入版本号和标题");
    return this.state.createRelease({ version: body.version, title: body.title, changes: body.changes }, actor(request));
  }

  @Post("releases/:id/rollback")
  rollback(@Param("id") id: string, @Req() request: any) { return this.state.rollbackRelease(id, actor(request)); }

  @Get("public-package")
  @Header("Content-Type", "application/json; charset=utf-8")
  @Header("Content-Disposition", "attachment; filename=hannao-public-release.json")
  publicPackage() { return this.state.publicPackage(); }
}

@UseGuards(AuthGuard)
@Controller("display-config")
export class DisplayConfigController {
  constructor(private readonly state: StateService) {}
  @Get()
  get() { return this.state.displayConfig(); }
  @Patch()
  update(@Body() body: { modules?: any[] }, @Req() request: any) { return this.state.updateDisplayConfig(body.modules || [], actor(request)); }
}

@UseGuards(AuthGuard)
@Controller("organization")
export class OrganizationController {
  constructor(private readonly state: StateService) {}

  @Get()
  get() {
    const snapshot = this.state.snapshot();
    return { departments: snapshot.departments, users: snapshot.users.map(safeUser), mappings: snapshot.mappings, settings: snapshot.settings };
  }

  @Post("sync")
  sync(@Req() request: any) { return this.state.hrSync(actor(request)); }
}

@Controller("organization/webhooks")
export class DalingWebhookController {
  constructor(private readonly state: StateService) {}

  @Post("daling")
  change(@Body() body: DalingPersonnelChange, @Headers("x-daling-secret") secret = "") {
    return this.state.applyDalingPersonnelChange(body, secret);
  }
}

@UseGuards(AuthGuard)
@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly state: StateService) {}

  @Get()
  get() {
    const snapshot = this.state.snapshot();
    return { systems: snapshot.systems, templates: snapshot.taskTemplates, dispatches: snapshot.taskDispatches };
  }

  @Post("dispatches/:id/retry")
  retry(@Param("id") id: string, @Req() request: any) { return this.state.retryTask(id, actor(request)); }

  @Post("systems/:id/test")
  test(@Param("id") id: string, @Req() request: any) { return this.state.testIntegration(id, actor(request)); }
}

@UseGuards(AuthGuard)
@Controller("logs")
export class LogsController {
  constructor(private readonly state: StateService) {}
  @Get()
  list(@Req() request: any, @Query("kind") kind?: string) { return this.state.logs(kind, actor(request)); }
}

@Controller("portal")
export class PortalController {
  constructor(private readonly state: StateService, private readonly storage: StorageService) {}

  @UseGuards(AuthGuard)
  @Get("dataset")
  dataset(@Req() request: any) { return this.state.portalDataset(actor(request)); }

  @Post("events")
  events(@Body() body: { events?: PortalEventInput[] }, @Req() request: any) {
    const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
    return this.state.recordPortalEvents(body.events || [], sessionUser(token, this.state));
  }

  @Get("public-package")
  publicPackage() { return this.state.publicPackage(); }

  @Post("assets/:assetId/files/:fileId/register-download")
  registerDownload(@Param("assetId") assetId: string, @Param("fileId") fileId: string, @Body() body: any) {
    return this.state.registerPublicDownload(assetId, fileId, body);
  }

  @Get("assets/:assetId/files/:fileId/preview")
  async preview(@Param("assetId") assetId: string, @Param("fileId") fileId: string, @Res() response: Response) {
    try {
      const { asset, file } = this.state.publicAssetFile(assetId, fileId, undefined, "preview");
      const buffer = await this.storage.watermarked(file.storageKey, file.mimeType);
      await this.state.recordFileAccess(asset, file.id, undefined, "success", "公开附件预览", `文件版本 V${file.version}`);
      response.setHeader("Content-Type", file.mimeType);
      response.setHeader("Content-Disposition", disposition(file.name, true));
      response.setHeader("Cache-Control", "private, no-store");
      return response.send(buffer);
    } catch (error) {
      await this.state.recordPublicFileDenial(assetId, fileId, error instanceof Error ? error.message : "公开预览未授权");
      throw error;
    }
  }

  @Get("assets/:assetId/files/:fileId/download")
  async download(@Param("assetId") assetId: string, @Param("fileId") fileId: string, @Query("grant") grant: string | undefined, @Res() response: Response) {
    try {
      const { asset, file } = this.state.publicAssetFile(assetId, fileId, grant, "download");
      const buffer = await this.storage.watermarked(file.storageKey, file.mimeType);
      await this.state.recordFileAccess(asset, file.id, undefined, "success", "公开附件下载", `下载模式 ${file.publicMode}，文件版本 V${file.version}`);
      response.setHeader("Content-Type", file.mimeType);
      response.setHeader("Content-Disposition", disposition(file.name));
      response.setHeader("Cache-Control", "private, no-store");
      return response.send(buffer);
    } catch (error) {
      await this.state.recordPublicFileDenial(assetId, fileId, error instanceof Error ? error.message : "公开下载未授权");
      throw error;
    }
  }

  @Get("system/:clientCode/assets/:assetId")
  systemAsset(@Param("clientCode") clientCode: string, @Param("assetId") assetId: string, @Headers("x-client-secret") secret = "") {
    return this.state.systemAsset(clientCode, secret, assetId);
  }

  @Get("system/:clientCode/assets/:assetId/files/:fileId")
  async systemFile(@Param("clientCode") clientCode: string, @Param("assetId") assetId: string, @Param("fileId") fileId: string, @Headers("x-client-secret") secret: string, @Query("grant") grant = "", @Res() response: Response) {
    const { file } = await this.state.systemAssetFile(clientCode, secret || "", assetId, fileId, grant);
    const buffer = await this.storage.watermarked(file.storageKey, file.mimeType);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", disposition(file.name));
    response.setHeader("Cache-Control", "private, no-store");
    return response.send(buffer);
  }
}

@UseGuards(AuthGuard)
@Controller("files")
export class FilesController {
  constructor(private readonly state: StateService, private readonly storage: StorageService) {}

  @Post("upload/:assetId")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 1024 * 1024 * 500 } }))
  async upload(@Param("assetId") assetId: string, @UploadedFile() file: any, @Body() body: { materialType?: string; visibility?: "internal" | "public"; publicMode?: "preview" | "anonymous" | "registered"; businessVersionId?: string; replacesAttachmentId?: string }, @Req() request: any) {
    if (!file) throw new BadRequestException("请选择文件");
    const asset = this.state.assetById(assetId);
    const fileId = randomUUID();
    const key = `${asset.type}/${asset.id}/${fileId}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const stored = await this.storage.put(key, file.buffer, file.mimetype || "application/octet-stream");
    const previous = body.replacesAttachmentId ? asset.attachments.find((item) => item.id === body.replacesAttachmentId) : undefined;
    const attachments = asset.attachments.map((item) => previous && item.id === previous.id ? { ...item, isCurrent: false } : item);
    const publicMode = ["preview", "anonymous", "registered"].includes(body.publicMode || "") ? body.publicMode! : "preview";
    const attachment = {
      id: fileId,
      name: file.originalname,
      mimeType: stored.mimeType,
      size: stored.size,
      version: previous ? previous.version + 1 : Math.max(0, ...asset.attachments.filter((item) => item.name === file.originalname).map((item) => item.version)) + 1,
      publicMode,
      materialType: body.materialType?.trim() || "其他材料",
      visibility: body.visibility === "public" ? "public" as const : "internal" as const,
      businessVersionId: body.businessVersionId || undefined,
      isCurrent: true,
      replacesAttachmentId: previous?.id,
      storageKey: stored.key,
      createdAt: new Date().toISOString()
    };
    await this.state.updateAsset(asset.id, { attachments: [...attachments, attachment], lockVersion: asset.lockVersion }, actor(request));
    return attachment;
  }

  @Get("grant/:assetId/:fileId")
  async grant(@Param("assetId") assetId: string, @Param("fileId") fileId: string, @Query("action") action: "preview" | "download" = "download", @Req() request: any) {
    const asset = this.state.assetById(assetId);
    const file = asset.attachments.find((item) => item.id === fileId);
    if (!file) throw new BadRequestException("附件不存在");
    const user = actor(request);
    if (!canAccessAsset(asset, user, action)) {
      await this.state.recordFileAccess(asset, file.id, user, "denied", action === "preview" ? "内部附件预览拒绝" : "内部附件下载拒绝", "最终个人权限不包含所需操作");
      throw new BadRequestException("当前账号没有此附件的操作权限");
    }
    const downloadId = randomUUID().slice(0, 8);
    return {
      url: `/api/files/download/${asset.id}/${file.id}?action=${action}&request=${downloadId}`,
      expiresIn: 300,
      watermark: `${user.name} · ${user.phone.slice(-4)} · ${new Date().toLocaleString("zh-CN")} · ${downloadId}`
    };
  }

  @Get("download/:assetId/:fileId")
  async download(@Param("assetId") assetId: string, @Param("fileId") fileId: string, @Query("action") action: "preview" | "download" = "download", @Query("request") requestId: string | undefined, @Req() request: any, @Res() response: Response) {
    const asset = this.state.assetById(assetId);
    const file = asset.attachments.find((item) => item.id === fileId);
    if (!file) throw new BadRequestException("附件不存在");
    const user = actor(request);
    if (!canAccessAsset(asset, user, action)) {
      await this.state.recordFileAccess(asset, file.id, user, "denied", "内部附件访问拒绝", `请求编号 ${requestId || "-"}`);
      throw new BadRequestException("当前账号没有此附件的操作权限");
    }
    const watermark = ["confidential", "restricted"].includes(asset.sensitivity) ? `${user.name} · ${user.phone.slice(-4)} · ${new Date().toLocaleString("zh-CN")} · ${requestId || randomUUID().slice(0, 8)}` : undefined;
    const buffer = await this.storage.watermarked(file.storageKey, file.mimeType, watermark);
    await this.state.recordFileAccess(asset, file.id, user, "success", action === "preview" ? "内部附件预览" : "内部附件下载", `文件版本 V${file.version}，请求编号 ${requestId || "-"}${watermark ? "，已添加动态水印" : ""}`);
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("Content-Disposition", disposition(file.name, action === "preview"));
    response.setHeader("Cache-Control", "private, no-store");
    return response.send(buffer);
  }
}

@UseGuards(AuthGuard)
@Controller("system-management")
export class SystemManagementController {
  constructor(private readonly state: StateService) {}
  @Post("backup")
  backup(@Req() request: any) { return this.state.createBackup(actor(request)); }
}

@Controller("health")
export class HealthController {
  constructor(private readonly state: StateService) {}
  @Get()
  get() {
    return { status: "ok", service: "hannao-asset-api", version: this.state.snapshot().settings.currentVersion, time: new Date().toISOString(), drivers: { data: this.state.snapshot().settings.dataDriver, storage: this.state.snapshot().settings.storageDriver } };
  }
}
