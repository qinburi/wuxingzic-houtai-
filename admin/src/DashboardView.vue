<script setup>
import { computed } from "vue";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronRight,
  CircleCheck,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  GitPullRequest,
  Scale,
  Server,
  ShieldCheck,
  Workflow
} from "@lucide/vue";
import ChartCubeChart from "./components/ChartCubeChart.vue";

const props = defineProps({
  dashboard: { type: Object, required: true },
  version: { type: String, default: "v1.0.3" }
});
const emit = defineEmits(["navigate"]);
const chartColors = ["#2f73f6", "#2fb982", "#ff8a3d", "#ec5064", "#7455e9"];

const metrics = computed(() => {
  const data = props.dashboard.metrics || {};
  const publishedRate = data.totalAssets ? Math.round((data.publishedAssets || 0) / data.totalAssets * 100) : 0;
  return [
    { id: "total", label: "资产总数", value: data.totalAssets || 0, suffix: "", note: "全模块在册", footer: "较上次发布稳定", icon: Boxes, tone: "blue", route: "assets.overview" },
    { id: "published", label: "已发布资产", value: data.publishedAssets || 0, suffix: "", note: "可进入消费端", footer: `${publishedRate}% 在册占比`, icon: ShieldCheck, tone: "green", route: "workflow.releases" },
    { id: "reviews", label: "待审核内容", value: data.pendingReviews || 0, suffix: "", note: "等待模块评审", footer: `${data.approvedReviews || 0} 项已通过`, icon: GitPullRequest, tone: "amber", route: "workflow.reviews" },
    { id: "public", label: "公开覆盖率", value: data.publicCoverage || 0, suffix: "%", note: `${data.publicAssets || 0} 项对外展示`, footer: "金额与附件逐项控制", icon: ExternalLink, tone: "cyan", route: "display.config" },
    { id: "ip", label: "知识产权", value: data.ipAssets || 0, suffix: "", note: `${data.patents || 0} 专利 / ${data.copyrights || 0} 软著`, footer: `${data.ipAssets || 0} 项在册`, icon: FileText, tone: "violet", route: "ip.overview" },
    { id: "governance", label: "治理待处理", value: data.governancePending || 0, suffix: "", note: "审核、期限与异常", footer: `${data.taskFailures || 0} 项系统异常`, icon: AlertTriangle, tone: "red", route: "governance.overview" }
  ];
});

const trendRows = computed(() => props.dashboard.activityTrend || []);
const trendSeries = computed(() => [
  { key: "maintenance", label: "内容维护", color: "#2f73f6", values: trendRows.value.map((row) => Number(row.maintenance || 0)) },
  { key: "accessDownloads", label: "访问下载", color: "#1fb477", values: trendRows.value.map((row) => Number(row.accessDownloads || 0)) },
  { key: "systemCollaboration", label: "系统协同", color: "#ff7f32", values: trendRows.value.map((row) => Number(row.systemCollaboration || 0)) }
]);
const trendChartData = computed(() => trendRows.value.flatMap((row) => trendSeries.value.map((series) => ({
  date: row.label,
  series: series.label,
  value: Number(row[series.key] || 0)
}))));

const statusRows = computed(() => props.dashboard.statusSummary || []);
const statusTotal = computed(() => statusRows.value.reduce((sum, item) => sum + Number(item.count || 0), 0));
const statusChartData = computed(() => statusRows.value.map((item) => ({ name: item.label, value: Number(item.count || 0) })));

const departmentRows = computed(() => props.dashboard.departmentContributions || []);
const departmentChartData = computed(() => departmentRows.value.map((item) => ({
  name: item.department.replace("与解决方案部", "中心").replace("工业软件研发部", "技术中心").replace("行业应用部", "行业事业部").replace("现场交付部", "交付中心").replace("智能装备研发部", "装备中心"),
  value: Number(item.count || 0)
})));
const riskRows = computed(() => props.dashboard.governanceRisks || []);
const deadlineRows = computed(() => props.dashboard.ipDeadlines || []);
const systemRows = computed(() => props.dashboard.systemStatuses || []);

function percentage(value, total = statusTotal.value) {
  return total ? `${(Number(value || 0) / total * 100).toFixed(1)}%` : "0%";
}

function formatDate(value, includeTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  return includeTime ? `${datePart} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : datePart;
}

function deadlineTone(days) {
  if (days < 0 || days <= 30) return "danger";
  if (days <= 180) return "warning";
  return "neutral";
}

function systemTone(status) {
  return status === "active" ? "success" : status === "warning" ? "warning" : "neutral";
}
</script>

<template>
  <section class="governance-dashboard">
    <header class="governance-heading">
      <div><h1>无形资产治理总览</h1><p>资产、知识产权、发布、权限和系统协同的统一运行视图</p></div>
      <div><button class="flow-entry" type="button" @click="emit('navigate', 'flow.navigator')"><Workflow :size="16" />导航流程</button><i></i><span>当前版本</span><b>{{ dashboard.currentVersion || version }}</b><i></i><span>最近组织同步 {{ formatDate(dashboard.lastHrSyncAt, true) }}</span></div>
    </header>

    <div class="governance-metrics">
      <button v-for="item in metrics" :key="item.id" type="button" @click="emit('navigate', item.route)">
        <span :class="`metric-icon ${item.tone}`"><component :is="item.icon" :size="27" /></span>
        <div><small>{{ item.label }}</small><strong>{{ item.value }}<em>{{ item.suffix }}</em></strong><p>{{ item.note }}</p></div>
        <footer>{{ item.footer }}</footer>
      </button>
    </div>

    <div class="governance-charts">
      <section class="governance-panel trend-panel">
        <header><div><Activity :size="20" /><h2>近 7 日资产活跃趋势</h2></div><span>内容维护、访问下载与系统协同</span></header>
        <ChartCubeChart class="trend-chart" variant="line" :data="trendChartData" :colors="trendSeries.map((series) => series.color)" />
      </section>

      <section class="governance-panel status-panel">
        <header><div><Activity :size="20" /><h2>资产状态构成</h2></div><span>当前在册</span></header>
        <div class="status-content">
          <div class="donut-chart-wrap"><ChartCubeChart variant="donut" :data="statusChartData" :colors="statusRows.map((item) => item.color)" /><div><strong>{{ statusTotal }}</strong><span>资产总数</span></div></div>
          <div class="status-legend">
            <div v-for="item in statusRows" :key="item.status"><i :style="{ background: item.color }"></i><span>{{ item.label }}</span><strong>{{ item.count }}</strong><em>{{ percentage(item.count) }}</em></div>
          </div>
        </div>
      </section>

      <section class="governance-panel department-panel">
        <header><div><Database :size="20" /><h2>部门资产贡献</h2></div><span>按责任部门</span></header>
        <ChartCubeChart class="department-chart" variant="bar" :data="departmentChartData" :colors="chartColors" />
      </section>
    </div>

    <div class="governance-lists">
      <section class="governance-panel risk-panel">
        <header><div><AlertTriangle :size="20" /><h2>重点治理风险</h2></div><button type="button" @click="emit('navigate', 'governance.overview')">查看全部<ChevronRight :size="16" /></button></header>
        <button v-for="risk in riskRows" :key="risk.id" class="risk-row" type="button" @click="emit('navigate', risk.routeId)">
          <span :class="risk.tone"><AlertTriangle v-if="risk.tone !== 'success'" :size="18" /><CircleCheck v-else :size="18" /></span>
          <div><b>{{ risk.title }}</b><small>{{ risk.detail }}</small></div><strong>{{ risk.count }}</strong><ChevronRight :size="16" />
        </button>
      </section>

      <section class="governance-panel deadline-panel">
        <header><div><FileText :size="20" /><h2>知识产权期限</h2></div><button type="button" @click="emit('navigate', 'ip.deadlines')">期限台账<ChevronRight :size="16" /></button></header>
        <button v-for="item in deadlineRows" :key="item.id" type="button" @click="emit('navigate', 'ip.deadlines')">
          <span><Scale :size="18" /></span><div><b>{{ item.title }}</b><small>{{ item.typeLabel }} · {{ item.ownerName }} · {{ formatDate(item.dueDate) }}</small></div>
          <em :class="deadlineTone(item.daysRemaining)">{{ item.daysRemaining < 0 ? `逾期 ${Math.abs(item.daysRemaining)} 天` : `${item.daysRemaining} 天` }}</em>
        </button>
        <div v-if="!deadlineRows.length" class="dashboard-empty"><CircleCheck :size="23" />暂无临近期限</div>
      </section>

      <section class="governance-panel systems-panel">
        <header><div><Server :size="20" /><h2>开放系统状态</h2></div><button type="button" @click="emit('navigate', 'integrations.systems')">系统中心<ChevronRight :size="16" /></button></header>
        <button v-for="system in systemRows" :key="system.id" type="button" @click="emit('navigate', 'integrations.systems')">
          <span :class="systemTone(system.status)"><Server :size="18" /></span><div><b>{{ system.name }}</b><small>{{ system.code }} · 检查于 {{ formatDate(system.lastCheckedAt, true) }}</small></div>
          <em :class="systemTone(system.status)">{{ system.status === 'active' ? '运行正常' : system.status === 'warning' ? '需要关注' : '已停用' }}</em>
        </button>
        <footer><Workflow :size="16" />{{ systemRows.length }} 个系统已登记，{{ dashboard.metrics?.taskFailures || 0 }} 项任务异常</footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.governance-dashboard { min-width: 0; padding-bottom: 24px; color: #24333d; background: #edf2f5; }
.governance-heading { min-height: 84px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 28px; background: #f8fafb; border-bottom: 1px solid #d5dde2; }
.governance-heading > div:first-child { min-width: 0; display: flex; align-items: baseline; gap: 14px; }.governance-heading h1 { margin: 0; font-size: 20px; letter-spacing: 0; }.governance-heading p { margin: 0; color: #72818c; font-size: 12px; }
.governance-heading > div:last-child { display: flex; align-items: center; gap: 10px; color: #7b8993; font-size: 11px; white-space: nowrap; }.governance-heading b { color: #34434d; font-size: 12px; }.governance-heading i { width: 1px; height: 22px; background: #d4dce1; }
.flow-entry { min-height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; color: #235f67; background: #eef9f6; border: 1px solid #8bcabd; border-radius: 4px; font-size: 11px; font-weight: 700; }.flow-entry:hover { color: #174c53; background: #e2f5ef; border-color: #55ad9b; }
.governance-metrics { display: grid; grid-template-columns: repeat(6, minmax(150px, 1fr)); gap: 12px; padding: 16px 18px 0; }
.governance-metrics button { min-width: 0; min-height: 142px; display: grid; grid-template-columns: 50px minmax(0, 1fr); align-items: center; gap: 12px; padding: 14px 16px 0; text-align: left; background: white; border: 1px solid #d5dde2; border-radius: 5px; box-shadow: 0 1px 3px rgba(30, 49, 62, .07); }.governance-metrics button:hover { border-color: #aab9c3; transform: translateY(-1px); }
.metric-icon { width: 48px; height: 48px; display: grid; place-items: center; color: white; border-radius: 6px; }.metric-icon.blue { background: #2f73f6; }.metric-icon.green { background: #15b77a; }.metric-icon.amber { background: #f4a022; }.metric-icon.cyan { background: #27aec4; }.metric-icon.violet { background: #7354e8; }.metric-icon.red { background: #ea4f63; }
.governance-metrics small { display: block; color: #7a8994; font-size: 12px; font-weight: 700; }.governance-metrics strong { display: block; margin-top: 1px; color: #101a21; font-size: 28px; line-height: 1.05; }.governance-metrics strong em { margin-left: 3px; color: #657580; font-size: 14px; font-style: normal; }.governance-metrics p { margin: 7px 0 0; overflow: hidden; color: #6e7d87; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.governance-metrics footer { grid-column: 1 / 3; min-height: 34px; display: flex; align-items: center; color: #83919b; border-top: 1px solid #e7ecef; font-size: 10px; }
.governance-charts { display: grid; grid-template-columns: minmax(430px, 1.75fr) minmax(300px, 1fr) minmax(320px, 1fr); gap: 12px; padding: 12px 18px 0; }
.governance-panel { min-width: 0; background: white; border: 1px solid #d5dde2; border-radius: 5px; box-shadow: 0 1px 3px rgba(30, 49, 62, .05); overflow: hidden; }.governance-panel > header { min-height: 51px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 16px; border-bottom: 1px solid #dce3e7; }.governance-panel > header > div { min-width: 0; display: flex; align-items: center; gap: 9px; }.governance-panel > header svg { color: #1580ae; }.governance-panel h2 { margin: 0; font-size: 15px; letter-spacing: 0; }.governance-panel header span { overflow: hidden; color: #7b8993; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.governance-panel header button { display: inline-flex; align-items: center; gap: 4px; padding: 0; color: #1681ae; background: transparent; border: 0; font-size: 11px; white-space: nowrap; }
.trend-panel, .status-panel, .department-panel { min-height: 380px; }.trend-legend { display: flex; gap: 22px; padding: 13px 18px 0; color: #75848e; font-size: 10px; }.trend-legend span { display: flex; align-items: center; gap: 7px; }.trend-legend i { width: 13px; height: 3px; border-radius: 2px; }
.trend-chart { display: block; width: 100%; height: 300px; padding: 4px 10px 8px; }
.status-content { min-height: 326px; display: grid; grid-template-columns: minmax(150px, 1.15fr) minmax(145px, .85fr); align-items: center; gap: 14px; padding: 20px 16px; }.donut-chart-wrap { position: relative; width: min(210px, 100%); aspect-ratio: 1; justify-self: center; }.donut-chart-wrap > .chartcube-chart { width: 100%; height: 100%; }.donut-chart-wrap > div:last-child { position: absolute; inset: 34%; display: grid; place-items: center; align-content: center; pointer-events: none; text-align: center; }.donut-chart-wrap strong { font-size: 27px; }.donut-chart-wrap span { margin-top: 5px; color: #7b8993; font-size: 10px; }
.status-legend > div { min-height: 48px; display: grid; grid-template-columns: 10px minmax(54px, 1fr) auto auto; align-items: center; gap: 7px; border-bottom: 1px solid #e4e9ec; font-size: 11px; }.status-legend i { width: 8px; height: 8px; border-radius: 2px; }.status-legend span { color: #5d6d77; }.status-legend strong { font-size: 12px; }.status-legend em { color: #89969e; font-size: 10px; font-style: normal; }
.department-chart { width: 100%; height: 310px; padding: 12px 12px 6px; }
.governance-lists { display: grid; grid-template-columns: 1.15fr 1.15fr 1fr; gap: 12px; padding: 12px 18px 0; }.governance-lists .governance-panel { min-height: 278px; }
.risk-row { width: 100%; min-height: 55px; display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 16px; align-items: center; gap: 9px; padding: 7px 15px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.risk-row:hover, .deadline-panel > button:hover, .systems-panel > button:hover { background: #f7f9fa; }.risk-row > span, .deadline-panel > button > span, .systems-panel > button > span { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 4px; }.risk-row > span.warning, .risk-row > span.danger { color: #c66b1c; background: #fff0dc; }.risk-row > span.success { color: #218a5f; background: #e7f5ee; }.risk-row div, .deadline-panel > button div, .systems-panel > button div { min-width: 0; }.risk-row b, .deadline-panel > button b, .systems-panel > button b { display: block; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.risk-row small, .deadline-panel > button small, .systems-panel > button small { display: block; margin-top: 3px; overflow: hidden; color: #80909a; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.risk-row > strong { font-size: 14px; }
.deadline-panel > button, .systems-panel > button { width: 100%; min-height: 55px; display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 7px 15px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.deadline-panel > button > span { color: #267eb0; background: #e9f3f8; }.deadline-panel em, .systems-panel em { padding: 3px 7px; border-radius: 3px; font-size: 9px; font-style: normal; white-space: nowrap; }.deadline-panel em.danger { color: #b83441; background: #fbeaec; }.deadline-panel em.warning, .systems-panel em.warning { color: #a76016; background: #fff0dc; }.deadline-panel em.neutral, .systems-panel em.neutral { color: #64737d; background: #edf1f3; }
.systems-panel > button > span.success { color: #1b8a5b; background: #e6f5ed; }.systems-panel > button > span.warning { color: #b76a18; background: #fff0dc; }.systems-panel > button > span.neutral { color: #687782; background: #edf1f3; }.systems-panel em.success { color: #1b8257; background: #e6f5ed; }.systems-panel > footer { min-height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 15px; color: #7c8a94; background: #f8fafb; font-size: 9px; }
.dashboard-empty { min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #789087; font-size: 11px; }
@media (max-width: 1450px) { .governance-metrics { grid-template-columns: repeat(3, 1fr); }.governance-charts { grid-template-columns: 1.55fr 1fr; }.department-panel { grid-column: 1 / 3; min-height: 290px; }.governance-lists { grid-template-columns: 1fr 1fr; }.systems-panel { grid-column: 1 / 3; } }
@media (max-width: 900px) { .governance-heading { align-items: flex-start; flex-direction: column; padding: 14px; }.governance-heading > div:first-child { display: block; }.governance-heading p { margin-top: 5px; }.governance-heading > div:last-child { flex-wrap: wrap; }.governance-metrics { grid-template-columns: 1fr 1fr; padding: 10px 8px 0; gap: 8px; }.governance-metrics button { min-height: 130px; padding: 11px 10px 0; }.governance-charts, .governance-lists { grid-template-columns: 1fr; padding: 8px 8px 0; gap: 8px; }.department-panel, .systems-panel { grid-column: auto; }.trend-panel, .status-panel, .department-panel { min-height: 0; }.trend-chart { min-height: 245px; }.status-content { min-height: 280px; }.governance-lists .governance-panel { min-height: 0; } }
@media (max-width: 520px) { .governance-heading > div:last-child span:last-child, .governance-heading i { display: none; }.flow-entry { min-height: 32px; padding: 0 10px; }.governance-metrics { grid-template-columns: 1fr; }.governance-metrics button { min-height: 116px; grid-template-columns: 44px minmax(0, 1fr); }.metric-icon { width: 42px; height: 42px; }.status-content { grid-template-columns: 1fr; }.donut-chart-wrap { width: 170px; }.trend-chart { min-width: 540px; }.trend-panel { overflow-x: auto; } }
</style>
