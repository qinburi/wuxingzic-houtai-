# 汉脑无形资产管理后台开发说明

| 项目项 | 内容 |
|---|---|
| 项目名称 | 汉脑无形资产管理后台（包名：`hannao-intangible-assets-admin`） |
| 技术栈 | Node.js `^20.19.0` 或 `>=22.12.0`、JavaScript ES Modules、TypeScript 5.7（strict/ES2022/NodeNext）、Vue 3、NestJS 11、Vite 8、AntV G2、PostgreSQL/本地 JSON、MinIO/本地文件、Node Test Runner、`tsx` |
| 项目类型 | 多入口全栈 Web 管理应用：Vue 管理端、NestJS Web API、匿名采集服务和 GitHub Pages 演示包 |

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

## 2. 常用命令与运行地址

要求 Node.js `^20.19.0` 或 `>=22.12.0`。

首次安装和初始化：

```bash
npm install
cp .env.example .env
```

启动服务（分别在独立终端执行）：

```bash
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

构建和 Pages 发布包：

```bash
npm run build:admin
npm run build:server
npm run build
npm run build:all
npm run build:pages
npm run start:server
```

测试、单文件测试和类型检查：

```bash
npm run test
npm run test:admin
npm run test:server
node --test admin/test/navigation.test.js
node --test admin/test/flow-navigation.test.js
npx tsx --test server/test/state.test.ts
npx tsc -p server/tsconfig.json --noEmit
```

提交前检查：

```bash
git diff --check
git status --short
```

`npm run build:pages` 将管理端产物写入根目录 `index.html` 和 `assets/`，供 GitHub Pages 使用。`admin-dist/` 不提交。

`npm run dev:server` 会先编译服务端，再执行 `server/dist/server/src/main.js`。当前没有 ESLint、Prettier 或独立格式化脚本，不得编造 `npm run lint` 或 `npm run format`；按现有文件风格编辑，并用 `git diff --check` 检查空白错误。

## 3. 目录结构与职责

```text
.
├── admin/src/            # Vue 管理端、菜单、流程、API、图表和演示数据
├── admin/test/           # 菜单权限、状态恢复和流程布局测试
├── collector/            # 隔离的公网匿名行为采集服务
├── scripts/              # GitHub Pages 管理端发布脚本
├── server/src/           # NestJS API、领域规则、持久化和文件存储
├── server/test/          # 服务端领域行为测试
├── server/sql/           # PostgreSQL 状态表和只追加审计约束
├── shared/               # 前后端共享 TypeScript 契约
├── public/               # 品牌资源和脱敏门户示例数据
└── assets/               # build:pages 生成并提交的 Pages 静态资源
```

关键文件：

- `admin/src/App.vue`：管理端模块、编辑器、审核、配置和工作台。
- `admin/src/DashboardView.vue`：治理工作台指标、ChartCube 图表和风险入口。
- `admin/src/FlowNavigator.vue`、`flow-navigation.js`、`flow-layout.js`：可点击业务流程、节点定义和无重叠布局。
- `admin/src/navigation.js`：集中式菜单、权限过滤和页签恢复；`portal-links.js`：受白名单约束的门户跳转。
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
- `scripts/publish-admin-pages.mjs`：将 `admin-dist/` 转换为根目录 Pages 入口和 `assets/`。
- `server/sql/001_initial.sql`：PostgreSQL 状态持久化和审计不可变约束。
- `OPERATIONS.md`：部署、达铃、存储和运维说明。
- `.env.example`：无真实密钥的环境变量模板；`package.json`：运行、构建、测试和发布脚本来源。

生成目录与运行数据：

- `admin-dist/`、`server/dist/`：构建输出，不直接编辑且不提交。
- `server/data/`、`server/uploads/`、`server/backups/`、`server/releases/`、`collector/data/`：运行状态、附件、备份、快照和采集数据，不提交。
- 根目录 `index.html` 和 `assets/`：`npm run build:pages` 生成的 Pages 产物；只有管理端发布任务才更新并提交。

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

## 11. 代码规范

### JavaScript 与 TypeScript

- 统一使用 ES Modules。服务端启用 TypeScript `strict`、ES2022 和 `NodeNext`；相对导入写编译后的 `.js` 后缀，例如 `import { StateService } from "./state.service.js"`。
- 公开方法、跨模块函数和异步边界必须声明明确类型。禁止用大范围 `any` 绕过契约；不确定输入使用 `unknown` 并在使用前收窄。
- 优先使用 `const`，仅在重新赋值时使用 `let`；异步流程使用 `async`/`await`，不得留下未处理 Promise。
- 可变状态和测试快照使用 `structuredClone`，避免浅拷贝共享嵌套对象；文件路径使用 `path.resolve` 或 `path.join`，不手工拼接分隔符。
- 控制器只处理参数、身份和响应转换。权限、验证、幂等、状态流转、审计和持久化放在 `StateService` 或专用领域服务。
- 服务端使用 NestJS 的 `BadRequestException`、`ForbiddenException`、`NotFoundException`、`ConflictException` 等表达失败，不临时创造另一套错误协议。
- 领域类型、枚举和跨端字段统一放在 `shared/contracts.ts`，禁止前后端复制同义常量或中文标签。
- 仅为非显然的领域规则添加简短注释，不写逐行复述代码的注释。

### Vue、图表与样式

- 管理端复用 `admin/src/api.js` 和现有组件边界；Pages 演示能力集中在 `demo-api.js`，不得混入真实 API 实现。
- 标准功能图标优先使用 `@lucide/vue`；指标图标通过 `IconFont.vue` 和 `iconfont.js` 使用现有 iconfont 兼容层。
- 工作台图表统一复用 `ChartCubeChart.vue` 和 AntV G2；图表数据、常驻标签、加载失败及空状态必须完整呈现。
- API 加载、空数据、失败、无权限和提交中状态必须有明确反馈。前端按钮隐藏不能代替服务端授权。
- CSS 遵循现有命名、双引号、分号和响应式断点。固定格式组件使用稳定的网格或尺寸约束，避免悬浮、数字和文字引起布局跳动。

### 日志、状态与文件

- 领域代码禁止使用 `console.log`。启动日志使用 NestJS Logger；运行错误只记录结构化、脱敏的必要上下文。
- 状态写入遵循“权限校验 -> 版本/业务校验 -> 状态更新 -> 追加审计 -> 持久化”，失败时不得留下部分写入。
- 文件换版新增 `AttachmentRecord`、递增版本并设置 `replacesAttachmentId`，禁止覆盖原文件或历史记录。
- 修改保持聚焦，不在单一需求中顺带重构 `App.vue`、共享契约或生成产物。

## 12. 测试与 Mock 要求

测试使用 Node Test Runner、`node:assert/strict` 和 `tsx`，不使用 Jest/Vitest 语法。

完整和单文件命令：

```bash
npm run test
npm run test:admin
npm run test:server
node --test admin/test/navigation.test.js
node --test admin/test/flow-navigation.test.js
npx tsx --test server/test/state.test.ts
npx tsc -p server/tsconfig.json --noEmit
```

- 每个测试独立创建服务和状态，不依赖执行顺序，不复用其他测试修改过的对象。
- 管理端导航或流程变化必须补充 `admin/test/`，校验唯一导航 ID、权限过滤、状态恢复、节点目标及节点/连线无重叠。
- 优先使用构造函数注入和小型内存 fake。参考 `server/test/state.test.ts` 的 `MemoryPersistence`：`load()` 返回内存状态，`save()` 使用 `structuredClone`，然后调用 `StateService.onModuleInit()`。
- 使用 `server/src/seed.ts` 的确定性数据作为 fixture；需要稳定时间、ID 或外部响应时，在测试边界固定输入。
- 单元测试不得连接真实 PostgreSQL、MinIO、短信、达铃或目标系统，也不得写入本地运行状态、上传、备份和发布目录。
- 只有依赖注入无法覆盖时才使用 `node:test` mock；每个测试结束后恢复 mock，禁止全局状态和跨测试污染。
- 权限拒绝、下载拒绝、回调幂等、任务重试和异常路径同时断言异常类型、领域结果及审计记录。
- 修复缺陷必须增加修复前会失败的回归测试；修改权限、发布、文件、知识产权、达铃或任务时必须增加对应服务端测试。
- UI 变更还需人工验证 Pages 演示与真实 API 两种模式，并检查桌面和 `390x844` 手机视口无重叠、裁切或整页横向溢出。

## 13. 禁止事项

- 禁止复制、修改或提交原静态门户源码、`docs/`、`public/versions/` 及 `v1.0.0` 至 `v1.0.3` 历史页面。
- 禁止提交 `.env`、真实手机号、密码、JWT、验证码、达铃密钥、系统客户端密钥、完整回调报文、文件正文或生产门户数据。
- 禁止在日志中记录密码、令牌、验证码、系统密钥、完整请求体、原始公网 IP、手机号、自由文本或文件内容。
- 禁止只依赖前端隐藏实现权限；查询、预览、下载、公开字段和系统调用必须由服务端再次校验。
- 禁止修改或删除只追加审计记录，或绕过 PostgreSQL 审计归档约束。
- 禁止覆盖附件历史、用手机号代替永久 `dalingId`、允许维护人自审，或公开机密/严格受限内容。
- 禁止提交 `node_modules/`、`admin-dist/`、`server/dist/`、运行状态、上传、备份、发布快照、采集数据和日志。
- 禁止把模拟达铃、短信、目标系统或 Pages 演示数据描述为生产连接。
- 禁止为通过类型检查使用大范围 `as any`、为通过测试删除断言，或手工编辑本应由 `build:pages` 生成的压缩资源。
- 禁止回退用户已有修改、删除不明文件、强制推送或未经确认改写远端历史。

## 14. 修改与验证流程

1. 先读共享契约和相关服务端领域规则。
2. 判断变化是否影响管理端、API、持久化、门户、权限、文件或审计。
3. 保持修改聚焦，不进行无关重构。
4. 领域约束放在服务端，并补充对应测试。
5. UI 变更至少验证桌面和 `390x844` 手机视口。
6. 发布前运行匹配风险范围的构建、测试和 `git diff --check`。
7. 确认没有运行数据、密钥、原静态门户或历史快照变更。

## 15. Git 规则

远端：`https://github.com/qinburi/wuxingzic-houtai-.git`，默认分支 `main`。

- 不回退用户修改，不强推。
- 推送前获取远端状态；出现新提交先检查和合并。
- 只提交当前任务相关源码、文档和必要 Pages 产物。
- 推送超时时可用 `git -c http.version=HTTP/1.1 push origin main` 重试，禁止 `--force`。
- 推送后确认远端提交、Pages 部署状态，并打开线上页面验证。
