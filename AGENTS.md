# 汉脑无形资产管理后台开发说明

## 1. 项目边界

本仓库是“汉脑无形资产工作台”的独立管理后台，负责资产维护、知识产权、审核发布、组织权限、资料文件、系统开放、任务协同和审计分析。

技术组成：

- Vue 3 管理端。
- NestJS + TypeScript 业务 API。
- PostgreSQL 或本地 JSON 持久化。
- MinIO 或本地目录文件存储。
- 独立公网匿名行为采集服务。
- 前后端共享 TypeScript 契约。

原静态工作台属于另一个仓库。本仓库只提供 `PortalDataset`、授权附件接口和行为采集能力，不得复制、修改或提交原门户的 `index.html`、`app.html`、`src/`、`docs/`、`public/versions/`，也不得覆盖 `v1.0.0` 至 `v1.0.3` 历史快照。

## 2. 运行与发布

要求 Node.js `^20.19.0` 或 `>=22.12.0`。

```bash
npm install
cp .env.example .env
npm run dev:server
npm run dev:admin
npm run dev:collector
```

本地地址：

| 服务 | 地址 |
|---|---|
| 管理后台 | `http://127.0.0.1:5174/` |
| 业务 API | `http://127.0.0.1:3100/api/health` |
| 匿名采集 | `http://127.0.0.1:8787/health` |

本地及 Pages 演示账号：`10000000000` / `Admin@123`。不得用于生产。

验证命令：

```bash
npm run build
npm run build:pages
npm run test
git diff --check
git status --short
```

`npm run build:pages` 将管理端产物写入根目录 `index.html` 和 `assets/`，供 GitHub Pages 使用。`admin-dist/` 不提交。

## 3. 关键文件

- `admin/src/App.vue`：管理端模块、编辑器、审核、配置和工作台。
- `admin/src/styles.css`：管理端布局和响应式规则。
- `admin/src/api.js`：真实 API 请求和下载封装。
- `admin/src/demo-api.js`：GitHub Pages 浏览器内演示数据。
- `admin/src/components/ChartCubeChart.vue`：工作台 AntV G2 图表封装。
- `admin/src/iconfont.js`：工作台 iconfont.cn Symbol 兼容和本地兜底。
- `server/src/controllers.ts`：HTTP 路由，保持轻量。
- `server/src/state.service.ts`：核心领域、权限、审核、发布和幂等规则。
- `server/src/portal-dataset.ts`：内部和公开数据裁剪。
- `server/src/persistence.service.ts`：JSON/PostgreSQL 状态及备份。
- `server/src/storage.service.ts`：本地/MinIO 文件和动态水印。
- `server/src/seed.ts`：仅用于开发的虚构种子数据。
- `server/test/state.test.ts`：核心领域测试。
- `shared/contracts.ts`：领域对象和枚举的唯一结构来源。
- `collector/server.mjs`：匿名行为采集白名单服务。
- `OPERATIONS.md`：部署、达铃、存储和运维说明。

新增字段至少同步检查契约、种子、`StateService`、门户裁剪、管理端、服务端测试和 `PortalDataset` 兼容性。不要在前后端维护两套枚举。

## 4. 管理模块

管理端包含：工作台、资产中心、知识产权、资料与文件、投入与治理、展示配置、审核发布、组织与权限、系统开放、系统任务、日志与分析、系统管理。

资产类型包含案例、行业、平台、产品、SaaS、场景、硬件、设备、资料、知识产权和治理资产。

## 5. 权限与发布

数据级别：`company`、`department`、`confidential`、`restricted`。

发布渠道：`internal` 或 `both`。内部动作：`view`、`preview`、`download`、`system_call`。

关键规则：

- 服务端必须再次校验数据、预览、下载和系统调用权限，不能只隐藏前端按钮。
- 公开字段由 `publicFields` 逐项批准。
- 金额只有 `showAmountPublic` 为真且 `publicFields` 含 `amount` 时才公开。
- 公开附件支持仅预览、匿名下载、登记下载。
- 公司、部门、人员授权最终展开为个人权限。
- 公司系统需独立授权，附件使用短时地址；撤销授权后立即失效。
- 维护人不能审核自己的提交。
- 发布版本号使用 `vX.Y.Z`，生成内部、公开和后台状态三份快照。
- 机密和严格受限内容不能进入公开渠道。

主要编码：`ASSET_ADMIN`、`ASSET_EDITOR`、`MODULE_REVIEWER`、`ASSET_AUDITOR`、`ASSET_PUBLISHER`、`ORG_ADMIN`、`SYSTEM_ADMIN`、`IP_VIEW`、`IP_EDIT`、`IP_REVIEW`、`IP_PUBLISH`、`IP_EXPORT`。

新增权限时同步更新达铃映射、服务端校验、管理端入口和测试。

## 6. 达铃同步

`dalingId` 是人员永久关联键，手机号只用于登录。

```http
POST /api/organization/sync
POST /api/organization/webhooks/daling
X-Daling-Secret: <secret>
```

全量数据包含员工 ID、手机号、工号、部门、岗位、状态、角色编码和权限编码。回调以 `eventId` 幂等。调岗、离职或编码变化后重算最终权限；知识产权负责人停用时保留历史责任人并生成接管提醒。

当前达铃和目标系统连接器是模拟实现。真实接口接通前，不得宣称已连接生产系统。

## 7. 知识产权

专利和软著统一使用 `AssetRecord.type = "ip"`，差异放在 `IpProfile.kind`。

- 授权专利提交审核前必须有获得时间和证书号。
- 已登记软著必须有登记号、获得时间和对应软件版本。
- 主负责人和协同人按达铃人员 ID 关联。
- 一项知识产权可绑定多个资产，一个资产可绑定多项知识产权。
- 可关联案例、平台、产品、SaaS、场景、硬件和设备，同一组合不得重复。
- 已发布关系解除只生成待审核解除，不删除档案、版本或文件。
- 业务版本 `IpBusinessVersion` 与档案修订 `IpArchiveRevision` 分离。
- 历史台账迁移必须幂等；歧义记录进入 `IpMigrationIssue`。
- 商标仅预留结构，不强行迁移。

附件更新创建新记录：递增 `version`，旧文件设 `isCurrent = false`，并通过 `replacesAttachmentId` 关联。到期、年费和复核日期由维护人确认，系统只生成提醒，不作法律结论。

## 8. 审核、任务与审计

流程：`draft -> reviewing -> approved -> published`，驳回进入 `rejected`，发布后可归档。

- 审核通过后，每个修订、每个目标系统独立建单。
- 失败按 1 分钟、5 分钟、15 分钟、1 小时、6 小时重试，之后转人工待办。
- 撤回或作废保留原任务并发送作废说明；不支持时生成站内待办。
- 知识产权提醒幂等键为“知识产权 ID + 提醒类型 + 到期日期 + 目标系统”。
- 工作台只保存任务创建结果、编号和跳转链接，不同步执行进度。

所有登录、维护、上传、换版、绑定、解除、审核、发布、权限、下载、提醒和任务行为写入只追加审计日志。密码、JWT、验证码、密钥、文件正文和完整回调报文不得进入日志。

连续五次密码失败锁定 15 分钟。公网采集不得保存身份、原始 IP、手机号或自由文本。

## 9. 文件与存储

默认本地驱动：

```dotenv
DATA_DRIVER=file
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=server/uploads
```

生产可切换 `DATA_DRIVER=postgres` 和 `STORAGE_DRIVER=minio`。PostgreSQL 业务账号不得修改或删除审计归档。

所有文件预览和下载经过授权接口。机密和严格受限 PDF、图片动态添加姓名、手机号尾号、时间和下载编号水印。

不得提交 `.env`、真实密钥、`node_modules/`、`admin-dist/`、`server/dist/`、`server/data/`、`server/uploads/`、`server/backups/`、`server/releases/`、`collector/data/`、日志或真实门户数据。

## 10. UI 约束

- 管理端保持深色顶部栏、左侧图标导航、紧凑表格和汉脑蓝绿配色。
- 标准功能图标优先使用 `@lucide/vue`；工作台指标图标使用 iconfont Symbol 兼容层。
- 卡片圆角不超过 8px，不嵌套装饰卡片。
- 桌面、平板、手机均不得整页横向溢出、文字重叠或控件跳动。
- 工作台图表使用 `ChartCubeChart.vue` 和 AntV G2，不引入旧 G2Plot。
- “近 7 日资产活跃趋势”的每个数据点常驻显示数值。
- “资产状态构成”的环形分段常驻显示数量，图例显示数量和占比。
- “部门资产贡献”使用细横向条形，末端常驻显示数值；不得恢复为粗条。

## 11. 修改与验证流程

1. 先读共享契约和相关服务端领域规则。
2. 判断变化是否影响管理端、API、持久化、门户、权限、文件或审计。
3. 保持修改聚焦，不进行无关重构。
4. 领域约束放在服务端，并补充对应测试。
5. UI 变更至少验证桌面和 `390x844` 手机视口。
6. 发布前运行匹配风险范围的构建、测试和 `git diff --check`。
7. 确认没有运行数据、密钥、原静态门户或历史快照变更。

## 12. Git 规则

远端：`https://github.com/qinburi/wuxingzic-houtai-.git`，默认分支 `main`。

- 不回退用户修改，不强推。
- 推送前获取远端状态；出现新提交先检查和合并。
- 只提交当前任务相关源码、文档和必要 Pages 产物。
- 推送超时时可用 `git -c http.version=HTTP/1.1 push origin main` 重试，禁止 `--force`。
- 推送后确认远端提交、Pages 部署状态，并打开线上页面验证。
