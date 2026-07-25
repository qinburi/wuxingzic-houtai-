# 汉脑无形资产管理后台运行手册

## 1. 本地服务

| 服务 | 地址 | 说明 |
|---|---|---|
| 管理后台 | `http://127.0.0.1:5174/` | Vue 3 管理端 |
| 业务 API | `http://127.0.0.1:3100/api/health` | NestJS 服务端 |
| 匿名采集 | `http://127.0.0.1:8787/health` | 隔离的公开行为采集服务 |

原静态工作台不在本仓库，由独立门户仓库维护。本后台只通过 `PortalDataset`、授权附件接口和行为采集接口为其提供数据能力。

本地模拟管理员：

- 手机号：`10000000000`
- 密码：`Admin@123`

该账号仅供本地联调。生产环境必须设置 `BOOTSTRAP_ADMIN_PHONE`、高强度 `JWT_SECRET`，并通过达铃人员数据初始化账号。

## 2. 启动与验证

首次运行：

```bash
nvm use
npm install
cp .env.example .env
```

分别启动：

```bash
npm run dev:server
npm run dev:admin
npm run dev:collector
```

构建与测试：

```bash
npm run build
npm run test
```

`npm run dev:server` 会先编译服务端再启动。服务端代码变化后需要重启。

## 3. 数据与文件驱动

默认本地驱动：

```dotenv
DATA_DRIVER=file
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=server/uploads
```

业务状态保存在 `server/data/`，附件保存在 `server/uploads/`。这些目录均被 Git 忽略。

PostgreSQL：

```dotenv
DATA_DRIVER=postgres
DATABASE_URL=postgres://hannao:strong-password@postgres.internal:5432/hannao_assets
```

服务启动时创建状态表和只追加审计归档，也可预先执行 `server/sql/001_initial.sql`。生产业务账号不得拥有修改或删除审计归档的权限。

MinIO：

```dotenv
STORAGE_DRIVER=minio
MINIO_ENDPOINT=minio.internal
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=replace-me
MINIO_SECRET_KEY=replace-me
MINIO_BUCKET=hannao-assets
```

机密和严格受限的 PDF、图片在预览或下载时动态写入姓名、手机号尾号、时间和下载编号。其他类型仍经过授权接口，但不会改写文件正文。

## 4. 达铃对接

全量同步：

```http
POST /api/organization/sync
Authorization: Bearer <admin-token>
```

当前适配器使用模拟数据。真实达铃全量 API 至少提供：

- `dalingId`：永久人员关联键
- `phone`：登录账号
- `employeeCode`：员工工号
- `departmentId`、`departmentCode`、`departmentName`
- `position`
- `roleCodes`、`permissionCodes`
- `status`

人员变更回调：

```http
POST /api/organization/webhooks/daling
Content-Type: application/json
X-Daling-Secret: <DALING_WEBHOOK_SECRET>
```

```json
{
  "eventId": "evt-20260724-0001",
  "eventType": "transfer",
  "dalingId": "DEMO-DL-1003",
  "phone": "10000000002",
  "departmentCode": "DEMO_TECH",
  "departmentName": "示例技术组",
  "position": "演示技术维护员",
  "roleCodes": ["ASSET_EDITOR"],
  "permissionCodes": ["ASSET_TECH"],
  "occurredAt": "2026-07-24T12:00:00.000Z"
}
```

`eventId` 用于幂等。调岗、离职和编码变化会更新员工状态并重算最终个人权限。日志不得保存完整原始回调报文。

## 5. 门户数据接口

本后台生成内部和公开两类 `PortalDataset`：

- 内部数据按登录人员最终权限裁剪。
- 公开数据只包含审核批准的字段、金额和附件模式。
- 发布数据保持对原静态工作台结构兼容。
- 服务端默认读取 `public/portal-data.local.json`；该文件被 Git 忽略，缺失时使用空的兼容基线。
- `public/portal-data.example.json` 仅含虚构迁移记录，不包含真实资产、员工或历史数据。

需要导入现有门户数据时，在本地创建基线并配置：

```dotenv
PORTAL_DATASET_PATH=public/portal-data.local.json
```

门户的页面结构、样式、交互和历史版本由外部门户仓库维护，本仓库不得覆盖。

## 6. 公司系统调用

系统使用客户端编码和密钥读取已授权资产：

```http
GET /api/portal/system/ERP/assets/<assetId>
X-Client-Secret: <SYSTEM_CLIENT_SECRET_ERP>
```

响应包含业务字段和附件元数据，附件地址使用短时授权：

```http
GET /api/portal/system/ERP/assets/<assetId>/files/<fileId>?grant=<short-lived-grant>
X-Client-Secret: <SYSTEM_CLIENT_SECRET_ERP>
```

撤销资产授权或停用系统后，未过期地址也必须立即失效。生产网关应增加 HTTPS、IP 白名单、限流和密钥轮换。

## 7. 审核、发布与任务

流程：

1. 维护人保存草稿并提交审核。
2. 非提交人的模块审核人通过或驳回。
3. 通过后冻结修订，并为每个目标系统创建独立任务。
4. 发布人填写 `vX.Y.Z` 版本号，生成内部、公开和后台状态快照。

快照目录为 `server/releases/<version>/`，属于运行产物，不提交 Git。

目标系统任务使用幂等键防重。失败按 1 分钟、5 分钟、15 分钟、1 小时、6 小时重试，之后生成站内人工待办。撤回或作废保留原任务，并向支持的目标系统追加作废说明。

## 8. 知识产权期限任务

专利到期、年费和软著复核日期必须由维护人确认，系统只据此生成提醒，不把计算结果当作法律结论。

默认提醒：

- 专利到期：提前 180、90、30、7 天。
- 年费：提前 90、30、7 天。
- 软著资料：每 12 个月复核。

知识产权任务以“知识产权 ID + 提醒类型 + 到期日期 + 目标系统”幂等。达铃发现主负责人停用时保留历史责任人，并向协同人、部门负责人和管理员生成接管任务。

## 9. 下载、采集与审计

公开附件模式：

- `preview`：仅在线查看。
- `anonymous`：匿名下载。
- `registered`：登记姓名、单位、手机号、用途和同意记录后下载。

内部文件按最终个人权限校验查看、预览和下载。成功和拒绝都记录资产、文件版本、结果和请求编号。

公网采集服务只接受允许的匿名事件字段，不保存身份、原始 IP、手机号或自由文本。采集进程不得访问业务数据库、MinIO、管理 API或内部人员数据。

接口密钥、密码、验证码、授权令牌和文件正文禁止进入日志。登录连续失败五次锁定十五分钟并记录审计事件。

## 10. 备份与生产部署

生产计划：

- 每日数据库与 MinIO 增量备份，保留 30 天。
- 每月完整备份，保留 12 个月。
- 每季度在隔离环境执行恢复演练。
- 审计日志保留 5 年。
- 行为明细保留 1 年，之后只保留汇总。

系统管理提供即时备份和恢复读取校验。定时调度由公司任务平台、Kubernetes CronJob 或系统计划任务负责。

生产至少拆分管理端、API、PostgreSQL、MinIO 和公网匿名采集五个安全边界。管理端和 API 只允许公司网络或统一身份网关访问；公网采集必须独立部署。

## 11. 上线前检查

- 修改所有示例密钥和模拟管理员凭据。
- 配置严格的 CORS、HTTPS、网关限流和客户端 IP 白名单。
- 验证数据库业务账号不能修改审计归档。
- 验证 MinIO 桶不是公开访问。
- 验证达铃全量同步、回调鉴权和 `eventId` 幂等。
- 验证调岗、离职后的权限重算和知识产权接管任务。
- 验证禁止自审、双渠道发布和公开字段裁剪。
- 验证下载授权、动态水印、短时系统附件地址和拒绝日志。
- 验证备份能够在隔离环境恢复。
- 验证 Git 中不包含 `.env`、运行状态、附件、日志、发布快照或静态门户文件。
