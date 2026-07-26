import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { BadRequestException, ConflictException } from "@nestjs/common";
import type { AppState } from "../src/seed.js";
import { StateService } from "../src/state.service.js";

class MemoryPersistence {
  state: AppState | null = null;
  async load() { return this.state; }
  async save(state: AppState) { this.state = structuredClone(state); }
}

async function createService(persistence = new MemoryPersistence()) {
  const service = new StateService(persistence as never);
  const previousDatasetPath = process.env.PORTAL_DATASET_PATH;
  process.env.PORTAL_DATASET_PATH = "public/portal-data.example.json";
  try {
    await service.onModuleInit();
  } finally {
    if (previousDatasetPath === undefined) delete process.env.PORTAL_DATASET_PATH;
    else process.env.PORTAL_DATASET_PATH = previousDatasetPath;
  }
  return service;
}

test("本地管理员可以登录，错误密码会写入拒绝日志", async () => {
  const service = await createService();
  const user = await service.authenticate("10000000000", "Admin@123", "127.0.0.1", "node-test");
  assert.equal(user?.name, "演示管理员");
  const denied = await service.authenticate("10000000000", "wrong", "127.0.0.1", "node-test");
  assert.equal(denied, null);
  assert.equal(service.logs("login")[0].result, "denied");
});

test("治理工作台返回完整指标和可视化数据", async () => {
  const service = await createService();
  const dashboard = service.dashboard();
  assert.equal(dashboard.activityTrend.length, 7);
  assert.equal(dashboard.statusSummary.reduce((sum, item) => sum + item.count, 0), dashboard.metrics.totalAssets);
  assert.ok(dashboard.departmentContributions.length > 0);
  assert.ok(dashboard.governanceRisks.some((item) => item.routeId === "workflow.reviews"));
  assert.equal(dashboard.systemStatuses.length, service.snapshot().systems.length);
  assert.equal(dashboard.metrics.ipAssets, dashboard.metrics.patents + dashboard.metrics.copyrights);
  assert.ok(dashboard.metrics.publicCoverage >= 0 && dashboard.metrics.publicCoverage <= 100);
});

test("乐观锁阻止旧版本覆盖资产", async () => {
  const service = await createService();
  const asset = service.listAssets({})[1];
  const actor = service.userById("user-demo-admin")!;
  await service.updateAsset(asset.id, { title: `${asset.title}-更新`, lockVersion: asset.lockVersion }, actor);
  await assert.rejects(() => service.updateAsset(asset.id, { title: "旧数据覆盖", lockVersion: asset.lockVersion - 1 }, actor), ConflictException);
});

test("维护人不能审核自己提交的内容", async () => {
  const service = await createService();
  const review = service.listReviews()[0];
  const submitter = service.userById(review.submitterId)!;
  await assert.rejects(() => service.decideReview(review.id, "approve", "自审", submitter), ConflictException);
});

test("审核通过后按系统创建幂等项目任务", async () => {
  const service = await createService();
  const review = service.listReviews().find((item) => service.assetById(item.assetId).systemIds.length > 0)!;
  const reviewer = service.userById(review.reviewerId)!;
  const before = service.taskDispatches().length;
  await service.decideReview(review.id, "approve", "评审通过", reviewer);
  const created = service.taskDispatches().slice(0, service.taskDispatches().length - before);
  assert.equal(created.length, service.assetById(review.assetId).systemIds.length);
  assert.equal(new Set(created.map((item) => item.idempotencyKey)).size, created.length);
  assert.ok(created.every((item) => item.status === "created" && item.externalUrl));
});

test("公开数据包只包含公开发布资产并按规则隐藏金额", async () => {
  const service = await createService();
  const publicPackage = await service.publicPackage();
  const assets = publicPackage.publishedAssets!;
  assert.ok(assets.length > 0);
  assert.ok(assets.every((asset) => service.assetById(String(asset.id)).channel === "both"));
  const hidden = assets.find((asset) => !service.assetById(String(asset.id)).showAmountPublic);
  assert.equal(hidden?.amount, undefined);
  assert.ok(Array.isArray(publicPackage.caseAssets));
  assert.ok(Array.isArray(publicPackage.software));
  assert.ok(!assets.some((asset) => String(asset.id) === "asset-case-001"), "机密案例不得进入公开数据包");
  assert.ok(Object.values(publicPackage.employeeDirectory as Record<string, unknown>).length <= 1, "公开数据不得携带内部员工目录");
});

test("首页行为事件按事件ID去重", async () => {
  const service = await createService();
  const event = { eventId: "same-event", eventType: "detail_view" as const, assetId: "asset-case-001", occurredAt: new Date().toISOString() };
  const first = await service.recordPortalEvents([event]);
  const second = await service.recordPortalEvents([event]);
  assert.equal(first.accepted, 1);
  assert.equal(second.accepted, 0);
});

test("展示配置保存后可从持久化状态重新加载", async () => {
  const persistence = new MemoryPersistence();
  const service = await createService(persistence);
  const admin = service.userById("user-demo-admin")!;
  const modules = service.displayConfig().map((item, index) => ({ ...item, publicVisible: index === 0, sort: modulesLength() - index }));
  const saved = await service.updateDisplayConfig(modules, admin);
  assert.equal(saved[0].sort, 1);
  const reloaded = await createService(persistence);
  assert.deepEqual(reloaded.displayConfig(), saved);

  function modulesLength() { return service.displayConfig().length; }
});

test("登记下载必须校验访客资料与同意记录", async () => {
  const service = await createService();
  const asset = service.snapshot().assets.find((item) => item.status === "published" && item.channel === "both" && item.sensitivity === "company" && item.attachments[0]?.publicMode === "registered")!;
  await assert.rejects(() => service.registerPublicDownload(asset.id, asset.attachments[0].id, { name: "测试访客", organization: "测试单位", phone: "123", purpose: "方案评估", consent: true }), BadRequestException);
  const grant = await service.registerPublicDownload(asset.id, asset.attachments[0].id, { name: "测试访客", organization: "测试单位", phone: "13800138000", purpose: "方案评估", consent: true });
  assert.match(grant.downloadUrl, /grant=/);
  assert.ok(Date.parse(grant.expiresAt) > Date.now());
});

test("发布生成内部、公开和可回滚状态三份快照", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const asset = service.snapshot().assets.find((item) => item.status === "draft" && !["confidential", "restricted"].includes(item.sensitivity))!;
  asset.status = "approved";
  const release = await service.createRelease({ version: "v9.9.9", title: "自动化发布验收", changes: ["快照测试"] }, admin);
  assert.ok(release.internalSnapshotPath && release.publicSnapshotPath && release.stateSnapshotPath);
  const [internal, publicData, state] = await Promise.all([
    readFile(release.internalSnapshotPath!, "utf8"),
    readFile(release.publicSnapshotPath!, "utf8"),
    readFile(release.stateSnapshotPath!, "utf8")
  ]);
  assert.equal(JSON.parse(internal).portalChannel, "internal");
  assert.equal(JSON.parse(publicData).portalChannel, "public");
  assert.ok(Array.isArray(JSON.parse(state).assets));
});

test("达铃人员变更回调使用永久ID并按事件幂等", async () => {
  const service = await createService();
  const event = { eventId: "evt-transfer-1", eventType: "transfer" as const, dalingId: "DEMO-DL-1003", departmentCode: "DEMO_TECH", position: "演示技术维护员", roleCodes: ["ASSET_EDITOR"], permissionCodes: ["ASSET_TECH"], occurredAt: new Date().toISOString() };
  const first = await service.applyDalingPersonnelChange(event, "daling-local-webhook-secret");
  const second = await service.applyDalingPersonnelChange(event, "daling-local-webhook-secret");
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(service.userById("user-demo-editor-a")?.departmentId, "dept-demo-tech");
});

test("系统附件地址包含五分钟授权并可校验读取", async () => {
  const service = await createService();
  const asset = service.snapshot().assets.find((item) => item.status === "published" && item.systemIds.includes("sys-erp"))!;
  const payload = await service.systemAsset("ERP", "erp-local-secret", asset.id);
  const attachment = payload.attachments[0];
  const grant = new URL(`http://local${attachment.downloadUrl}`).searchParams.get("grant")!;
  const result = await service.systemAssetFile("ERP", "erp-local-secret", asset.id, attachment.id, grant);
  assert.equal(result.file.id, attachment.id);
  assert.ok(Date.parse(attachment.expiresAt) > Date.now());
});

test("连续五次密码失败会记录账号锁定", async () => {
  const service = await createService();
  for (let index = 0; index < 5; index += 1) await service.authenticate("10000000000", "wrong", "127.0.0.1", "node-test");
  const user = service.userById("user-demo-admin")!;
  assert.ok(user.lockedUntil && Date.parse(user.lockedUntil) > Date.now());
  assert.equal(service.logs("login")[0].action, "账号锁定");
});

test("历史专利软著台账迁移为结构化档案和稳定关联", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const workspace = service.ipWorkspace(admin);
  assert.ok(workspace.metrics.patents > 0);
  assert.ok(workspace.metrics.copyrights > 0);
  assert.ok(workspace.assets.every((asset) => asset.type === "ip" && asset.ipProfile));
  assert.ok(workspace.relations.some((relation) => relation.status === "published" && relation.ipAssetId && relation.relatedAssetId));
});

test("案例可快速新建知识产权并阻止重复绑定", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const related = service.snapshot().assets.find((asset) => asset.type === "software")!;
  const result = await service.quickCreateIpRelation(related.id, {
    title: "测试排产算法专利",
    ipProfile: { kind: "patent", legalStatus: "applied", applicationNumber: "CN-TEST-001" },
    relationType: "core",
    contributionNote: "排产约束计算核心成果"
  }, admin);
  assert.equal(result.ipAsset.type, "ip");
  assert.equal(result.relation.status, "draft");
  await assert.rejects(() => service.createIpRelation(related.id, { ipAssetId: result.ipAsset.id, relationType: "supporting" }, admin), ConflictException);
});

test("已登记软著提交审核前校验登记号获得时间和产品版本", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const asset = await service.createIpAsset({
    title: "测试软件著作权",
    ipProfile: {
      kind: "software_copyright",
      legalStatus: "registered",
      rightsHolder: "汉脑科技",
      primaryOwnerId: admin.id,
      primaryOwnerName: admin.name,
      collaboratorIds: [],
      collaboratorNames: [],
      reminderSystemIds: []
    }
  }, admin);
  await assert.rejects(() => service.submitReview(asset.id, admin), BadRequestException);
});

test("知识产权提醒按系统和到期日幂等创建任务", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const asset = service.ipWorkspace(admin).assets.find((item) => item.ipProfile?.kind === "patent")!;
  const dueDate = new Date().toISOString().slice(0, 10);
  await service.updateIpAsset(asset.id, { ipProfile: { ...asset.ipProfile!, annualFeeDueAt: dueDate, reminderOverrides: { annual_fee: [0] } }, lockVersion: asset.lockVersion }, admin);
  const before = service.taskDispatches().length;
  await (service as any).processDueIpReminders();
  await (service as any).processDueIpReminders();
  const created = service.taskDispatches().slice(0, service.taskDispatches().length - before).filter((task) => task.idempotencyKey.includes(":annual_fee:"));
  assert.equal(created.length, new Set(created.map((task) => task.idempotencyKey)).size);
  assert.ok(created.length > 0);
});

test("达铃停用知识产权负责人后生成接管提醒和系统任务", async () => {
  const service = await createService();
  const admin = service.userById("user-demo-admin")!;
  const asset = service.ipWorkspace(admin).assets.find((item) => item.ipProfile?.primaryOwnerId)!;
  const owner = service.userById(asset.ipProfile!.primaryOwnerId)!;
  await service.applyDalingPersonnelChange({ eventId: "evt-ip-owner-disable", eventType: "disable", dalingId: owner.dalingId, occurredAt: new Date().toISOString() }, "daling-local-webhook-secret");
  const reminder = service.snapshot().ipReminders.find((item) => item.ipAssetId === asset.id && item.type === "owner_handover");
  assert.equal(reminder?.status, "open");
  assert.ok(reminder?.taskDispatchIds.length);
});
