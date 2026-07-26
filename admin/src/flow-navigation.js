const adminTarget = (routeId) => ({ type: "admin", routeId });
const portalTarget = (mode, anchor) => ({ type: "portal", mode, anchor });

export const flowDefinitions = [
  {
    id: "asset-intake",
    label: "资产建档与绑定",
    title: "资产建档与知识产权绑定",
    description: "从现有资产查阅、分类建档到专利软著关系审核。",
    lanes: [
      { id: "business", label: "业务与门户使用人", icon: "Globe2" },
      { id: "asset", label: "资产维护人", icon: "Boxes" },
      { id: "ip", label: "知识产权维护人", icon: "Scale" },
      { id: "review", label: "模块审核人", icon: "GitPullRequest" }
    ],
    nodes: [
      { id: "browse-assets", label: "查看现有资产", meta: "内部门户", lane: "business", column: 1, row: 1, sequence: 1, icon: "Globe2", tone: "portal", target: portalTarget("internal", "cases-section") },
      { id: "classify-asset", label: "分类与资产建档", meta: "资产总览", lane: "asset", column: 2, row: 2, sequence: 2, icon: "Boxes", tone: "maintain", target: adminTarget("assets.overview"), permissionHint: "需资产维护权限" },
      { id: "attach-files", label: "维护资料与附件", meta: "文件中心", lane: "asset", column: 3, row: 3, sequence: 3, icon: "Paperclip", tone: "maintain", target: adminTarget("documents.files"), permissionHint: "需资料维护权限" },
      { id: "patent-ledger", label: "维护专利档案", meta: "专利台账", lane: "ip", column: 4, row: 4, sequence: 4, icon: "FileText", tone: "ip", target: adminTarget("ip.patents"), permissionHint: "需知识产权权限", offsetX: -54 },
      { id: "copyright-ledger", label: "维护软著档案", meta: "软著台账", lane: "ip", column: 4, row: 4, sequence: 5, icon: "Copyright", tone: "ip", target: adminTarget("ip.copyrights"), permissionHint: "需知识产权权限", offsetX: 54 },
      { id: "bind-ip", label: "绑定关联资产", meta: "核心/支撑/衍生", lane: "ip", column: 5, row: 5, sequence: 6, icon: "Link2", tone: "ip", target: adminTarget("ip.relations"), permissionHint: "需知识产权权限" },
      { id: "resolve-binding", label: "确认历史绑定", meta: "消除歧义记录", lane: "ip", column: 6, row: 6, sequence: 7, icon: "AlertTriangle", tone: "warning", target: adminTarget("ip.migration"), permissionHint: "需知识产权权限" },
      { id: "intake-review", label: "提交内容审核", meta: "档案与关系评审", lane: "review", column: 7, row: 7, sequence: 8, icon: "GitPullRequest", tone: "review", target: adminTarget("workflow.reviews"), permissionHint: "需模块审核权限" }
    ],
    edges: [
      { from: "browse-assets", to: "classify-asset", label: "新增或修订" },
      { from: "classify-asset", to: "attach-files" },
      { from: "attach-files", to: "patent-ledger", label: "专利" },
      { from: "attach-files", to: "copyright-ledger", label: "软著" },
      { from: "patent-ledger", to: "bind-ip" },
      { from: "copyright-ledger", to: "bind-ip" },
      { from: "bind-ip", to: "resolve-binding", label: "存在历史问题", kind: "warning" },
      { from: "bind-ip", to: "intake-review", label: "关系明确" },
      { from: "resolve-binding", to: "intake-review" }
    ]
  },
  {
    id: "review-release",
    label: "审核与发布",
    title: "审核、发布与门户展示",
    description: "内容评审、双渠道发布、系统建单和版本回滚。",
    lanes: [
      { id: "maintainer", label: "资产维护人", icon: "Boxes" },
      { id: "reviewer", label: "模块审核人", icon: "GitPullRequest" },
      { id: "publisher", label: "统一发布人", icon: "Send" },
      { id: "system", label: "协同系统", icon: "Server" },
      { id: "consumer", label: "门户使用人", icon: "Globe2" }
    ],
    nodes: [
      { id: "submit-draft", label: "提交资产修订", meta: "草稿进入评审", lane: "maintainer", column: 1, row: 1, sequence: 1, icon: "FileText", tone: "maintain", target: adminTarget("assets.overview"), permissionHint: "需资产维护权限" },
      { id: "content-review", label: "内容与关系审核", meta: "禁止维护人自审", lane: "reviewer", column: 2, row: 2, sequence: 2, icon: "GitPullRequest", tone: "review", target: adminTarget("workflow.reviews"), permissionHint: "需模块审核权限" },
      { id: "revise-rejection", label: "驳回后修订", meta: "保留修改记录", lane: "maintainer", column: 3, row: 3, sequence: 3, icon: "RefreshCw", tone: "warning", target: adminTarget("assets.overview"), permissionHint: "需资产维护权限" },
      { id: "display-config", label: "配置首页展示", meta: "字段、金额与附件", lane: "publisher", column: 3, row: 3, sequence: 4, icon: "PanelTop", tone: "publish", target: adminTarget("display.config"), permissionHint: "需统一发布人权限" },
      { id: "publish-version", label: "发布语义版本", meta: "内部/公开双快照", lane: "publisher", column: 4, row: 4, sequence: 5, icon: "Send", tone: "publish", target: adminTarget("workflow.releases"), permissionHint: "需统一发布人权限" },
      { id: "create-system-task", label: "自动创建系统任务", meta: "审核通过并行触发", lane: "system", column: 3, row: 3, sequence: 6, icon: "Workflow", tone: "system", target: adminTarget("tasks.all"), permissionHint: "需系统任务权限" },
      { id: "internal-portal", label: "进入内部门户", meta: "按个人权限过滤", lane: "consumer", column: 5, row: 5, sequence: 7, icon: "ShieldCheck", tone: "portal", target: portalTarget("internal", "cases-section"), offsetX: -54 },
      { id: "public-portal", label: "进入公开门户", meta: "仅批准公开内容", lane: "consumer", column: 5, row: 5, sequence: 8, icon: "ExternalLink", tone: "portal", target: portalTarget("public", "cases-section"), offsetX: 54 },
      { id: "release-rollback", label: "版本追溯与回滚", meta: "恢复后台状态快照", lane: "publisher", column: 6, row: 6, sequence: 9, icon: "History", tone: "warning", target: adminTarget("workflow.releases"), permissionHint: "需统一发布人权限" }
    ],
    edges: [
      { from: "submit-draft", to: "content-review" },
      { from: "content-review", to: "revise-rejection", label: "驳回", kind: "return" },
      { from: "revise-rejection", to: "content-review", label: "重新提交", kind: "return" },
      { from: "content-review", to: "display-config", label: "通过" },
      { from: "content-review", to: "create-system-task", label: "并行建单", kind: "system" },
      { from: "display-config", to: "publish-version" },
      { from: "publish-version", to: "internal-portal", label: "内部快照" },
      { from: "publish-version", to: "public-portal", label: "公开快照" },
      { from: "internal-portal", to: "release-rollback", label: "版本留痕", kind: "warning" },
      { from: "public-portal", to: "release-rollback", kind: "warning" }
    ]
  },
  {
    id: "permissions-systems",
    label: "权限与开放",
    title: "内外部权限与系统开放",
    description: "达铃组织同步、个人最终权限和公司系统授权。",
    lanes: [
      { id: "hr", label: "达铃人事系统", icon: "Users" },
      { id: "org", label: "组织权限管理员", icon: "KeyRound" },
      { id: "maintainer", label: "资产/IP维护人", icon: "Boxes" },
      { id: "system-admin", label: "系统管理员", icon: "Server" },
      { id: "client", label: "公司业务系统", icon: "Cable" }
    ],
    nodes: [
      { id: "daling-sync", label: "同步组织人员", meta: "全量API与变更回调", lane: "hr", column: 1, row: 1, sequence: 1, icon: "RefreshCw", tone: "system", target: adminTarget("organization.sync"), permissionHint: "需组织管理员权限" },
      { id: "people-departments", label: "核对部门与人员", meta: "永久关联达铃ID", lane: "org", column: 2, row: 2, sequence: 2, icon: "Users", tone: "maintain", target: adminTarget("organization.people"), permissionHint: "需组织管理员权限" },
      { id: "permission-mapping", label: "映射岗位与权限", meta: "稳定权限编码", lane: "org", column: 3, row: 3, sequence: 3, icon: "KeyRound", tone: "review", target: adminTarget("organization.mappings"), permissionHint: "需组织管理员权限" },
      { id: "permission-review", label: "复核最终个人权限", meta: "公司/部门/人员展开", lane: "org", column: 4, row: 4, sequence: 4, icon: "ShieldCheck", tone: "review", target: adminTarget("organization.review"), permissionHint: "需组织管理员权限" },
      { id: "asset-authorization", label: "配置资产与IP授权", meta: "查看/预览/下载/调用", lane: "maintainer", column: 5, row: 5, sequence: 5, icon: "LockKeyhole", tone: "ip", target: adminTarget("assets.overview"), permissionHint: "需资产维护权限" },
      { id: "register-system", label: "登记公司系统", meta: "凭据、IP与有效期", lane: "system-admin", column: 5, row: 5, sequence: 6, icon: "Server", tone: "system", target: adminTarget("integrations.systems"), permissionHint: "需系统管理员权限" },
      { id: "task-template", label: "配置任务模板", meta: "字段与负责人映射", lane: "system-admin", column: 6, row: 6, sequence: 7, icon: "FileText", tone: "system", target: adminTarget("integrations.templates"), permissionHint: "需系统管理员权限" },
      { id: "authorized-call", label: "系统读取与建单", meta: "短时附件授权", lane: "client", column: 7, row: 7, sequence: 8, icon: "Workflow", tone: "portal", target: adminTarget("tasks.all"), permissionHint: "需系统任务权限" },
      { id: "system-call-log", label: "核查系统调用", meta: "字段、附件与流量", lane: "system-admin", column: 8, row: 8, sequence: 9, icon: "FileArchive", tone: "audit", target: adminTarget("logs.system"), permissionHint: "需日志查看权限" }
    ],
    edges: [
      { from: "daling-sync", to: "people-departments" },
      { from: "people-departments", to: "permission-mapping" },
      { from: "permission-mapping", to: "permission-review" },
      { from: "permission-review", to: "asset-authorization" },
      { from: "permission-review", to: "register-system", label: "系统开放", kind: "system" },
      { from: "register-system", to: "task-template" },
      { from: "asset-authorization", to: "authorized-call", label: "调用授权", route: "late" },
      { from: "task-template", to: "authorized-call" },
      { from: "authorized-call", to: "system-call-log" }
    ]
  },
  {
    id: "usage-governance",
    label: "使用与治理",
    title: "访问使用、日志与持续治理",
    description: "从门户和系统消费回流到审计、期限与生命周期治理。",
    lanes: [
      { id: "visitor", label: "员工与公开访客", icon: "Globe2" },
      { id: "client", label: "公司业务系统", icon: "Server" },
      { id: "audit", label: "审计与日志人员", icon: "FileArchive" },
      { id: "governance", label: "资产治理人员", icon: "Activity" }
    ],
    nodes: [
      { id: "visit-internal", label: "访问内部门户", meta: "个人最终权限", lane: "visitor", column: 1, row: 1, sequence: 1, icon: "ShieldCheck", tone: "portal", target: portalTarget("internal", "cases-section"), offsetX: -54 },
      { id: "visit-public", label: "访问公开门户", meta: "匿名公开内容", lane: "visitor", column: 1, row: 1, sequence: 2, icon: "Globe2", tone: "portal", target: portalTarget("public", "cases-section"), offsetX: 54 },
      { id: "preview-download", label: "查看、预览与下载", meta: "公司资料与附件", lane: "visitor", column: 2, row: 2, sequence: 3, icon: "Download", tone: "portal", target: portalTarget("internal", "docMatrix") },
      { id: "system-consume", label: "系统读取资产附件", meta: "客户端凭据调用", lane: "client", column: 2, row: 2, sequence: 4, icon: "Server", tone: "system", target: adminTarget("integrations.systems"), permissionHint: "需系统管理员权限" },
      { id: "portal-log", label: "访问与下载日志", meta: "成功和拒绝均留痕", lane: "audit", column: 3, row: 3, sequence: 5, icon: "FileArchive", tone: "audit", target: adminTarget("logs.portal-download"), permissionHint: "需日志查看权限", offsetX: -54 },
      { id: "system-task-log", label: "系统与任务日志", meta: "调用、重试和结果", lane: "audit", column: 3, row: 3, sequence: 6, icon: "Workflow", tone: "audit", target: adminTarget("logs.task"), permissionHint: "需日志查看权限", offsetX: 54 },
      { id: "cost-governance", label: "投入成本治理", meta: "金额与工时", lane: "governance", column: 4, row: 4, sequence: 7, icon: "Database", tone: "maintain", target: adminTarget("governance.cost"), permissionHint: "需治理查看权限", offsetX: -54 },
      { id: "lifecycle-governance", label: "生命周期治理", meta: "版本与归档", lane: "governance", column: 4, row: 4, sequence: 8, icon: "History", tone: "maintain", target: adminTarget("governance.lifecycle"), permissionHint: "需治理查看权限", offsetX: 54 },
      { id: "utilization-governance", label: "利用率与闲置", meta: "低频和闲置处置", lane: "governance", column: 5, row: 5, sequence: 9, icon: "Activity", tone: "warning", target: adminTarget("governance.utilization"), permissionHint: "需治理查看权限", offsetX: -54 },
      { id: "renewal-governance", label: "续费与到期处理", meta: "费用和服务续期", lane: "governance", column: 5, row: 5, sequence: 10, icon: "RefreshCw", tone: "warning", target: adminTarget("governance.renewal"), permissionHint: "需治理查看权限", offsetX: 54 },
      { id: "ip-deadlines", label: "IP期限与年费", meta: "提醒和接管任务", lane: "governance", column: 6, row: 6, sequence: 11, icon: "Clock3", tone: "review", target: adminTarget("ip.deadlines"), permissionHint: "需知识产权权限", offsetX: -54 },
      { id: "task-exceptions", label: "处理异常任务", meta: "重试或人工待办", lane: "governance", column: 6, row: 6, sequence: 12, icon: "AlertTriangle", tone: "danger", target: adminTarget("tasks.exceptions"), permissionHint: "需系统任务权限", offsetX: 54 },
      { id: "revise-assets", label: "返回资产修订", meta: "形成持续治理闭环", lane: "governance", column: 7, row: 7, sequence: 13, icon: "RefreshCw", tone: "publish", target: adminTarget("assets.overview"), permissionHint: "需资产维护权限" }
    ],
    edges: [
      { from: "visit-internal", to: "preview-download" },
      { from: "visit-public", to: "preview-download" },
      { from: "preview-download", to: "portal-log" },
      { from: "system-consume", to: "system-task-log" },
      { from: "portal-log", to: "cost-governance", label: "行为回流" },
      { from: "system-task-log", to: "lifecycle-governance", label: "调用回流" },
      { from: "cost-governance", to: "utilization-governance" },
      { from: "lifecycle-governance", to: "renewal-governance" },
      { from: "utilization-governance", to: "ip-deadlines", label: "持续治理" },
      { from: "renewal-governance", to: "task-exceptions", label: "异常" , kind: "warning" },
      { from: "ip-deadlines", to: "revise-assets" },
      { from: "task-exceptions", to: "revise-assets", kind: "return" }
    ]
  }
];

export function allFlowNodes(definitions = flowDefinitions) {
  return definitions.flatMap((flow) => flow.nodes.map((node) => ({ ...node, flowId: flow.id })));
}
