# 汉脑无形资产管理后台开发说明

## 1. 项目定位与边界

本仓库是“汉脑无形资产工作台”的独立管理后台，负责资产维护、知识产权、审核发布、组织权限、资料文件、系统开放、任务协同和审计分析。

本仓库包含：

- Vue 3 管理端。
- NestJS 业务 API。
- PostgreSQL 或本地 JSON 持久化。
- MinIO 或本地目录文件存储。
- 隔离的公网匿名行为采集服务。
- 管理端和服务端共享 TypeScript 契约。

原静态工作台属于另一个仓库，是本系统发布数据的只读消费端。修改本仓库时必须遵守：

- 不复制、修改或提交原静态首页的 `index.html`、`app.html`、`src/`、`docs/`、`public/versions/`。
- 不覆盖 `v1.0.0` 至 `v1.0.3` 的任何历史静态快照。
- 后台发布数据必须保持 `PortalDataset` 对旧首页数据结构的兼容。
- 需要改变门户视觉或交互时，单独在门户仓库处理，不在本仓库实现。

## 2. 技术栈与本地地址

- 管理端：Vue 3、`@lucide/vue`、Vite。
- 服务端：NestJS、TypeScript、Express 平台适配器。
- 数据：PostgreSQL 或本地 JSON。
- 文件：MinIO 或本地目录。
- 水印：`pdf-lib`、`sharp`。
- 测试：Node Test Runner、`tsx`。
- Node.js：`^20.19.0` 或 `>=22.12.0`，推荐使用 `.nvmrc` 中版本。

本地服务：

| 服务 | 地址 | 命令 |
|---|---|---|
| 管理后台 | `http://127.0.0.1:5174/` | `npm run dev:admin` |
| 业务 API | `http://127.0.0.1:3100/api/health` | `npm run dev:server` |
| 匿名采集 | `http://127.0.0.1:8787/health` | `npm run dev:collector` |

本地模拟管理员：

- 手机号：`10000000000`
- 密码：`Admin@123`

此账号只用于本地开发。生产环境必须配置独立的 `JWT_SECRET`、`BOOTSTRAP_ADMIN_PHONE`、达铃回调密钥和系统客户端密钥。

## 3. 常用命令

首次运行：

```bash
npm install
cp .env.example .env
```

开发：

```bash
npm run dev:server
npm run dev:admin
npm run dev:collector
```

构建与测试：

```bash
npm run build
npm run build:admin
npm run build:pages
npm run build:server
npm run test
```

`npm run dev:server` 会先编译服务端，再运行 `server/dist/server/src/main.js`。服务端源码变化后要重启该命令。

`npm run build:pages` 会先构建管理端，再把 `admin-dist/index.html` 和资源同步到仓库根目录的 `index.html`、`assets/`，用于 GitHub Pages 的 `main / root` 发布模式。根目录这些文件是管理后台发布产物，不属于原静态工作台。

## 4. 目录职责

### 管理端

- `admin/index.html`：Vue 管理端入口。
- `admin/src/App.vue`：后台主体，包含导航、列表、编辑器、审核、配置和弹窗。
- `admin/src/api.js`：API 基地址、令牌、请求和下载封装。
- `admin/src/styles.css`：管理端布局、表格、表单、状态和响应式样式。
- `admin/vite.config.js`：管理端构建配置，输出到 `admin-dist/`。

当前管理端模块：

- 工作台
- 资产中心
- 知识产权
- 资料与文件
- 投入与治理
- 展示配置
- 审核发布
- 组织与权限
- 系统开放
- 系统任务
- 日志与分析
- 系统管理

### 服务端

- `server/src/main.ts`：NestJS 启动、`/api` 前缀、CORS 和请求体限制。
- `server/src/app.module.ts`：控制器和服务注册。
- `server/src/controllers.ts`：HTTP 路由、参数接收和文件响应。
- `server/src/state.service.ts`：核心领域规则，修改业务行为时优先阅读。
- `server/src/seed.ts`：本地部门、人员、资产、系统、模板和初始状态。
- `server/src/auth.ts`：JWT 会话、登录用户解析和认证守卫。
- `server/src/persistence.service.ts`：JSON/PostgreSQL 持久化和备份。
- `server/src/storage.service.ts`：本地/MinIO 文件存储和动态水印。
- `server/src/portal-dataset.ts`：内部、公开门户数据裁剪及稳定关系索引。
- `server/sql/001_initial.sql`：PostgreSQL 状态表和只追加审计归档。
- `server/test/state.test.ts`：核心领域行为测试。

### 共享、采集与基线数据

- `shared/contracts.ts`：前后端共享契约，是领域对象和枚举的唯一结构来源。
- `collector/server.mjs`：公网匿名行为采集服务，只接受白名单事件字段。
- `public/portal-data.example.json`：仅含虚构记录的门户基线结构和迁移测试示例。
- `public/assets/brand/hannao-logo-transparent.png`：管理端品牌 Logo。
- `OPERATIONS.md`：本地运行、达铃、系统调用、备份和生产部署手册。
- `.env.example`：环境变量示例，禁止填写真实生产密钥。

## 5. 提交和运行数据规则

应提交：

- `admin/`、`server/src/`、`server/test/`、`server/sql/`。
- `shared/`、`collector/server.mjs`。
- 管理端所需品牌资源和不含业务内容的数据结构示例。
- `package.json`、`package-lock.json`、`.env.example`、文档。
- GitHub Pages 使用的根 `index.html` 和 `assets/admin.*` 管理端发布产物。

禁止提交：

- `.env` 和任何真实密钥。
- `node_modules/`、`admin-dist/`、`server/dist/`。
- `server/data/`、`server/uploads/`、`server/backups/`、`server/releases/`。
- `collector/data/`。
- `public/portal-data.json`、`public/portal-data.local.json` 等真实门户基线。
- 登录、权限、下载登记、行为日志等本地运行数据。
- 原静态门户文件、构建产物和历史版本快照。
- `.DS_Store`、日志、压缩包和临时文件。

## 6. 核心数据契约

`shared/contracts.ts` 定义：

- `AssetRecord`：所有资产统一记录。
- `AttachmentRecord`：文件版本、材料类型、访问范围和存储键。
- `AudienceTemplate`：公司、部门或人员授权模板。
- `IpProfile`：专利和软件著作权结构化档案。
- `IpBusinessVersion`：知识产权业务版本。
- `IpArchiveRevision`：知识产权档案修订快照。
- `IpRelationRecord`：知识产权和案例、产品等资产的多对多关系。
- `IpReminderRecord`：期限、年费、复核和负责人接管提醒。
- `IpMigrationIssue`：历史台账中未唯一匹配的待确认关系。
- `ReviewRecord`：审核任务。
- `TaskDispatchRecord`：目标系统任务分发和重试记录。
- `AuditRecord`：登录、操作、权限、门户、下载、系统和任务日志。
- `PortalDataset`：兼容原静态工作台的发布数据。

新增或修改字段时至少检查：

1. `shared/contracts.ts`
2. `server/src/seed.ts`
3. `server/src/state.service.ts`
4. `server/src/portal-dataset.ts`
5. `admin/src/App.vue`
6. `server/test/state.test.ts`
7. `PortalDataset` 向后兼容性

不要在管理端和服务端维护两套枚举或中文标签，优先复用共享契约。

## 7. 权限与发布规则

数据级别：

- `company`：公司内部可见。
- `department`：指定部门可见。
- `confidential`：机密。
- `restricted`：严格受限。

发布渠道：

- `internal`：仅内部。
- `both`：内部并公开。

内部动作：

- `view`
- `preview`
- `download`
- `system_call`

重要约束：

- 公开字段由 `publicFields` 逐项控制。
- 金额只有 `showAmountPublic` 为真且 `publicFields` 包含 `amount` 才能公开。
- 公开附件支持仅预览、匿名下载、登记下载。
- 内部授权可按公司、部门、人员配置，最终必须展开到个人权限。
- 公司系统需要独立 `system_call` 授权，附件仍要走短时授权地址。
- 权限必须在服务端再次校验，不能只依赖前端隐藏按钮。
- 审核人不能审核自己的提交。
- 发布必须生成内部和公开双渠道快照，并检查字段、金额和附件差异。
- 权限变化、调岗和离职后必须重算最终个人权限。

主要编码：

- `ASSET_ADMIN`：超级管理员。
- `ASSET_EDITOR`：资产维护人。
- `MODULE_REVIEWER`：模块审核人。
- `ASSET_AUDITOR`：审计员。
- `ASSET_PUBLISHER`：统一发布人。
- `ORG_ADMIN`：组织与权限管理员。
- `SYSTEM_ADMIN`：系统开放和备份管理员。
- `IP_VIEW`、`IP_EDIT`、`IP_REVIEW`、`IP_PUBLISH`、`IP_EXPORT`：知识产权权限。

新增权限必须同时补充达铃映射、服务端校验、管理端入口和测试。

## 8. 达铃组织同步

达铃人员永久关联键是 `dalingId`，手机号仅作为登录账号，不能替代永久键。

接口：

```http
POST /api/organization/sync
POST /api/organization/webhooks/daling
X-Daling-Secret: <secret>
```

全量同步至少接收员工 ID、手机号、工号、部门、岗位、状态、角色编码和权限编码。回调用 `eventId` 幂等。调岗、离职和权限编码变化后要重算最终权限。

当前全量同步和目标系统连接器是本地模拟实现。真实接口接通前，不得在文档或界面宣称已连接生产达铃或生产业务系统。

## 9. 知识产权规则

知识产权首期维护专利和软件著作权，商标只预留结构。

必须支持：

- 专利、软著完整档案和状态校验。
- 一名主负责人、多名协同人及负责部门，人员按 `dalingId` 关联。
- 业务版本与自动生成的档案修订版本分离。
- 文件递增版本，不覆盖历史文件。
- 知识产权和案例、平台、产品、SaaS、场景、硬件、设备多对多绑定。
- 同一知识产权和资产组合不得重复。
- 解除关系走待审核发布，不删除档案和历史。
- 到期、年费、复核提醒由维护人确认日期后生成。
- 主负责人离职时保留历史责任人，并生成接管提醒。

字段状态校验：

- 专利申请阶段可暂无证书号；授权后必须有获得时间和证书信息。
- 软著登记后必须有登记号、获得时间和对应软件版本。
- 档案与关联关系分别审核，统一发布后才进入门户和系统接口。
- 查看完整关联信息要求同时具备资产和知识产权查看权限。
- 系统读取证书等附件必须另有该知识产权的系统授权。

## 10. 审核、任务与幂等

内容流程：

1. 维护人保存草稿并提交审核。
2. 非提交人的模块审核人通过或驳回。
3. 通过后冻结修订，并向配置的目标系统创建独立任务。
4. 发布人填写语义版本号，生成内部、公开和后台状态快照。

任务要求：

- 每个修订、每个目标系统一条分发记录。
- 幂等键防止重复建单。
- 多系统允许部分成功。
- 失败按 1 分钟、5 分钟、15 分钟、1 小时、6 小时重试，之后转人工待办。
- 修订撤回或作废时保留原任务并发送作废说明。
- 目标系统不支持作废通知时生成站内人工待办。
- 工作台只记录创建结果、任务编号和跳转链接，不同步目标任务执行进度。

知识产权提醒任务使用“知识产权 ID + 提醒类型 + 到期日期 + 目标系统”作为幂等键。

## 11. 文件、日志与安全

- 所有下载必须经过授权接口，成功和拒绝都记录请求编号。
- 机密和严格受限 PDF、图片在预览或下载时动态添加姓名、手机号尾号、时间和下载编号水印。
- 文件更新递增文件版本，历史文件只对授权人员和审计员开放。
- 系统调用记录客户端、资产、返回字段、附件、流量和结果。
- 审计日志只追加，业务接口不得修改或删除。
- 密钥、密码、验证码、JWT、文件正文和完整回调报文不得进入日志。
- 公网采集不得记录身份、原始 IP、手机号或自由文本。
- 登录连续失败五次锁定十五分钟，并记录审计日志。

## 12. 数据和存储驱动

本地默认：

```dotenv
DATA_DRIVER=file
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=server/uploads
```

生产可切换：

```dotenv
DATA_DRIVER=postgres
DATABASE_URL=postgres://user:password@host:5432/database
STORAGE_DRIVER=minio
```

PostgreSQL 生产业务账号不能拥有修改或删除审计归档的权限。MinIO 密钥不得写入仓库。

## 13. 开发流程

1. 先读 `shared/contracts.ts` 和相关领域规则。
2. 判断变化是否影响管理端、API、持久化、门户契约、权限或审计。
3. 保持修改集中，不进行无关重构。
4. 领域约束必须在服务端实现，并补充测试。
5. 运行 `npm run build` 和 `npm run test`。
6. 检查 Git 变更中没有运行数据、密钥、静态门户或构建产物。

修改 UI 时沿用现有深色顶部栏、左侧图标导航、紧凑表格和蓝绿状态色。优先使用 `@lucide/vue` 图标，不手绘已有标准图标。保持桌面和移动视口文字不溢出、控件不重叠。

## 14. 验证清单

- 管理后台可打开并完成登录。
- 工作台和十二个管理模块可进入。
- 管理端与服务端构建通过。
- 服务端核心测试通过。
- 非授权用户不能通过直接 API 绕过权限。
- 公开字段、金额和附件模式裁剪正确。
- 专利、软著录入、版本、绑定、解除、提醒和系统任务符合规则。
- 禁止自审、双渠道发布、系统任务幂等和失败重试有效。
- 文件预览、下载、水印和拒绝日志有效。
- 达铃回调幂等，调岗或离职后权限重算有效。
- 审计日志不能通过业务接口修改或删除。
- `git status` 不包含密钥、运行数据、构建产物或原静态门户文件。

## 15. Git 规则

- 默认分支为 `main`。
- 不回退用户已有修改，不强推覆盖远端。
- 提交前检查目标远端和分支。
- 只提交后台源码、契约、必要基线数据和文档。
- 若远端出现新提交，先拉取并检查差异，再合并或变基。
- 推送失败时可以调整 Git HTTP 超时参数重试，但不得使用强制推送。
