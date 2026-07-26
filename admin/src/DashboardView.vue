<script setup>
import { computed } from "vue";
import {
  Activity,
  AlertTriangle,
  Archive,
  Boxes,
  CalendarClock,
  Cable,
  ChevronRight,
  CircleCheck,
  Clock3,
  Copyright,
  Download,
  Eye,
  FileWarning,
  Gauge,
  GitPullRequest,
  Lightbulb,
  ReceiptText,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserRound,
  WalletCards,
  Workflow
} from "@lucide/vue";
import ChartCubeChart from "./components/ChartCubeChart.vue";

const props = defineProps({
  dashboard: { type: Object, required: true },
  version: { type: String, default: "v1.0.3" }
});
const emit = defineEmits(["navigate"]);
const chartColors = ["#2f73f6", "#21aa78", "#ff8a3d", "#e65769", "#7357e8", "#2ba9bd"];

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`;
  return `¥${amount.toLocaleString("zh-CN")}`;
}

const metrics = computed(() => {
  const data = props.dashboard.metrics || {};
  return [
    { id: "total", label: "无形资产总量", value: data.totalAssets || 0, note: `${data.publishedAssets || 0} 项已发布`, footer: `${data.publicAssets || 0} 项可公开展示`, icon: Boxes, tone: "blue", route: "assets.overview" },
    { id: "active", label: "近30天活跃资产", value: data.activeAssets30d || 0, note: `${data.usageEvents30d || 0} 次访问、下载与调用`, footer: "反映实际复用价值", icon: Activity, tone: "green", route: "logs.portal-download" },
    { id: "idle", label: "90天闲置资产", value: data.idleAssets90d || 0, note: "无访问、下载或系统调用", footer: "建议复核、推广或归档", icon: Archive, tone: "amber", route: "governance.utilization" },
    { id: "todo", label: "待办事项", value: data.pendingActions || 0, note: `${data.pendingReviews || 0} 项内容待审核`, footer: `${data.taskFailures || 0} 项系统任务异常`, icon: GitPullRequest, tone: "cyan", route: "workflow.reviews" },
    { id: "warning", label: "更新维护预警", value: data.updateWarnings || 0, note: "内容、资料与使用状态复核", footer: "按负责人推进处理", icon: AlertTriangle, tone: "red", route: "governance.lifecycle" },
    { id: "cost", label: "本年公共维护费用", value: formatCompactMoney(data.maintenanceCostYtd), note: `预算 ${formatCompactMoney(data.maintenanceBudgetYtd)}`, footer: "含通信、网络、云与知识产权", icon: WalletCards, tone: "violet", route: "governance.cost" }
  ];
});

const actionRows = computed(() => props.dashboard.pendingActions || []);
const warningRows = computed(() => props.dashboard.maintenanceWarnings || []);
const popularRows = computed(() => props.dashboard.popularAssets || []);
const idleRows = computed(() => props.dashboard.idleAssets || []);
const ipRows = computed(() => props.dashboard.ipComposition || []);
const freshnessRows = computed(() => props.dashboard.freshnessSummary || []);
const expense = computed(() => props.dashboard.expenseSummary || { categories: [], trend: [], upcoming: [] });
const managementTips = computed(() => props.dashboard.managementTips || []);
const ipTotal = computed(() => ipRows.value.reduce((sum, item) => sum + Number(item.value || 0), 0));
const ipCount = computed(() => ipRows.value.filter((item) => item.name !== "其他无形资产").reduce((sum, item) => sum + Number(item.value || 0), 0));
const ipRate = computed(() => ipTotal.value ? Math.round(ipCount.value / ipTotal.value * 100) : 0);

const popularChartData = computed(() => popularRows.value.map((item) => ({ name: item.title, value: Number(item.total || 0) })));
const ipChartData = computed(() => ipRows.value.map((item) => ({ name: item.name, value: Number(item.value || 0) })));
const freshnessChartData = computed(() => freshnessRows.value.map((item) => ({ name: item.name, value: Number(item.value || 0) })));
const expenseCategoryData = computed(() => (expense.value.categories || []).map((item) => ({ name: item.label, value: Number((item.amount / 10000).toFixed(1)) })));
const expenseTrendData = computed(() => (expense.value.trend || []).flatMap((item) => [
  { date: item.label, series: "实际费用", value: Number((item.actual / 10000).toFixed(1)) },
  { date: item.label, series: "预算", value: Number((item.budget / 10000).toFixed(1)) }
]));
const activityTrendData = computed(() => (props.dashboard.activityTrend || []).flatMap((item) => [
  { date: item.label, series: "内容维护", value: Number(item.maintenance || 0) },
  { date: item.label, series: "访问下载", value: Number(item.accessDownloads || 0) },
  { date: item.label, series: "系统协同", value: Number(item.systemCollaboration || 0) }
]));

function formatDate(value, includeTime = false) {
  if (!value) return "未发生使用";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const datePart = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  return includeTime ? `${datePart} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : datePart;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 });
}

function actionTypeLabel(type) {
  return type === "review" ? "内容审核" : type === "ip" ? "知识产权" : "系统任务";
}

function warningTypeLabel(kind) {
  return kind === "idle" ? "闲置" : kind === "missing_file" ? "资料缺失" : "待更新";
}

function expenseStatusLabel(status) {
  return status === "overdue" ? "已逾期" : status === "planned" ? "待确认" : status === "pending" ? "待支付" : "已完成";
}

function percentage(value, total = ipTotal.value) {
  return total ? `${(Number(value || 0) / total * 100).toFixed(1)}%` : "0%";
}
</script>

<template>
  <section class="executive-dashboard">
    <header class="dashboard-heading">
      <div>
        <span class="scope-chip"><ShieldCheck :size="14" />{{ dashboard.scopeLabel || "全公司" }}</span>
        <h1>无形资产经营与治理驾驶舱</h1>
        <p>从使用价值、维护责任、知识产权和公共费用识别本期管理重点</p>
      </div>
      <div class="heading-actions">
        <button class="flow-entry" type="button" @click="emit('navigate', 'flow.navigator')"><Workflow :size="16" />导航流程</button>
        <span><b>{{ dashboard.currentVersion || version }}</b> 当前版本</span>
        <span><RefreshCw :size="13" />组织同步 {{ formatDate(dashboard.lastHrSyncAt, true) }}</span>
      </div>
    </header>

    <div class="executive-metrics">
      <button v-for="item in metrics" :key="item.id" type="button" @click="emit('navigate', item.route)">
        <span :class="`metric-icon ${item.tone}`"><component :is="item.icon" :size="23" /></span>
        <div><small>{{ item.label }}</small><strong>{{ item.value }}</strong><p>{{ item.note }}</p></div>
        <footer>{{ item.footer }}<ChevronRight :size="14" /></footer>
      </button>
    </div>

    <div class="priority-grid">
      <section class="dashboard-panel todo-panel">
        <header><div><GitPullRequest :size="18" /><h2>待办事项</h2><em>{{ actionRows.length }}</em></div><button type="button" @click="emit('navigate', 'workflow.reviews')">全部待办<ChevronRight :size="15" /></button></header>
        <div class="action-list">
          <button v-for="item in actionRows.slice(0, 5)" :key="item.id" type="button" @click="emit('navigate', item.routeId)">
            <span :class="`action-type ${item.priority}`">{{ actionTypeLabel(item.type) }}</span>
            <div><b>{{ item.title }}</b><small>{{ item.detail }}</small></div>
            <span class="owner"><UserRound :size="13" />{{ item.ownerName }}</span>
            <time><Clock3 :size="13" />{{ formatDate(item.dueDate) }}</time>
            <ChevronRight :size="15" />
          </button>
          <div v-if="!actionRows.length" class="dashboard-empty"><CircleCheck :size="25" /><b>当前没有待办事项</b><span>审核、提醒和异常任务会自动汇总到这里</span></div>
        </div>
      </section>

      <section class="dashboard-panel warning-panel">
        <header><div><FileWarning :size="18" /><h2>更新维护预警</h2><em class="danger">{{ warningRows.length }}</em></div><button type="button" @click="emit('navigate', 'governance.lifecycle')">治理台账<ChevronRight :size="15" /></button></header>
        <div class="warning-summary">
          <div><strong>{{ dashboard.metrics?.idleAssets90d || 0 }}</strong><span>闲置资产</span></div>
          <div><strong>{{ freshnessRows.find(item => item.name === '超过180天')?.value || 0 }}</strong><span>超180天未更新</span></div>
          <div><strong>{{ dashboard.metrics?.updateWarnings || 0 }}</strong><span>预警总数</span></div>
        </div>
        <div class="warning-list">
          <button v-for="item in warningRows.slice(0, 4)" :key="item.id" type="button" @click="emit('navigate', item.routeId)">
            <span :class="item.severity"><AlertTriangle :size="15" />{{ warningTypeLabel(item.kind) }}</span>
            <div><b>{{ item.title }}</b><small>{{ item.detail }}</small></div>
            <ChevronRight :size="15" />
          </button>
        </div>
      </section>
    </div>

    <div class="value-grid">
      <section class="dashboard-panel popular-panel">
        <header><div><Gauge :size="18" /><h2>无形资产调用使用排行 Top 5</h2></div><span>近30天，按访问、下载和系统调用总次数</span></header>
        <div class="popular-content">
          <ChartCubeChart class="popular-chart" variant="bar" :data="popularChartData" :colors="chartColors" />
          <div class="popular-list">
            <button v-for="(item, index) in popularRows" :key="item.id" type="button" @click="emit('navigate', item.routeId)">
              <strong>{{ index + 1 }}</strong>
              <div><b>{{ item.title }}</b><small>{{ item.typeLabel }} · {{ item.ownerName }}</small></div>
              <span><Eye :size="12" />{{ item.views }}</span><span><Download :size="12" />{{ item.downloads }}</span><span><Cable :size="12" />{{ item.systemCalls }}</span>
              <em>{{ item.total }}</em>
            </button>
          </div>
        </div>
      </section>

      <section class="dashboard-panel ip-panel">
        <header><div><Scale :size="18" /><h2>专利 / 软著资产占比</h2></div><button type="button" @click="emit('navigate', 'ip.overview')">知识产权<ChevronRight :size="15" /></button></header>
        <div class="donut-content">
          <div class="donut-wrap"><ChartCubeChart variant="donut" :data="ipChartData" :colors="['#2f73f6', '#20ad7a', '#dfe6ea']" /><div><strong>{{ ipRate }}%</strong><span>知识产权占比</span></div></div>
          <div class="compact-legend">
            <button v-for="(item, index) in ipRows" :key="item.name" type="button" @click="emit('navigate', item.routeId)"><i :style="{ background: ['#2f73f6', '#20ad7a', '#cbd6dc'][index] }"></i><span>{{ item.name }}</span><strong>{{ item.value }}</strong><em>{{ percentage(item.value) }}</em></button>
          </div>
        </div>
      </section>

      <section class="dashboard-panel freshness-panel">
        <header><div><RefreshCw :size="18" /><h2>资产内容新鲜度</h2></div><button type="button" @click="emit('navigate', 'governance.lifecycle')">更新维护<ChevronRight :size="15" /></button></header>
        <ChartCubeChart class="freshness-chart" variant="donut" :data="freshnessChartData" :colors="['#20ad7a', '#ff9a3d', '#e65769']" />
        <div class="freshness-legend"><div v-for="(item, index) in freshnessRows" :key="item.name"><i :style="{ background: ['#20ad7a', '#ff9a3d', '#e65769'][index] }"></i><span>{{ item.name }}</span><strong>{{ item.value }}</strong></div></div>
      </section>
    </div>

    <div class="finance-grid">
      <section class="dashboard-panel expense-trend-panel">
        <header><div><WalletCards :size="18" /><h2>公共无形资产维护费用趋势</h2></div><span>单位：万元 · 预留金蝶科目与凭证同步</span></header>
        <div class="expense-kpis">
          <div><span>本年累计</span><strong>{{ formatMoney(expense.ytdActual) }}</strong></div>
          <div><span>本年预算</span><strong>{{ formatMoney(expense.ytdBudget) }}</strong></div>
          <div><span>预算执行</span><strong>{{ expense.budgetRate || 0 }}%</strong></div>
        </div>
        <ChartCubeChart class="expense-trend-chart" variant="line" :data="expenseTrendData" :colors="['#2f73f6', '#9eabb3']" />
      </section>

      <section class="dashboard-panel expense-category-panel">
        <header><div><ReceiptText :size="18" /><h2>费用分类构成</h2></div><button type="button" @click="emit('navigate', 'governance.cost')">投入成本<ChevronRight :size="15" /></button></header>
        <ChartCubeChart class="expense-category-chart" variant="bar" :data="expenseCategoryData" :colors="chartColors" />
      </section>

      <section class="dashboard-panel upcoming-panel">
        <header><div><CalendarClock :size="18" /><h2>近期维护费用</h2></div><span>60天内</span></header>
        <button v-for="item in (expense.upcoming || []).slice(0, 5)" :key="item.id" type="button" @click="emit('navigate', 'governance.cost')">
          <span><ReceiptText :size="15" /></span><div><b>{{ item.name }}</b><small>{{ item.vendor }} · {{ item.ownerName }}</small></div><strong>{{ formatMoney(item.amount) }}</strong><em :class="item.status">{{ expenseStatusLabel(item.status) }} · {{ formatDate(item.dueDate) }}</em>
        </button>
        <div v-if="!expense.upcoming?.length" class="dashboard-empty compact"><CircleCheck :size="24" /><b>近期无待处理费用</b></div>
      </section>
    </div>

    <div class="insight-grid">
      <section class="dashboard-panel activity-panel">
        <header><div><Activity :size="18" /><h2>近7日维护与使用趋势</h2></div><span>内容维护、访问下载、系统协同</span></header>
        <ChartCubeChart class="activity-chart" variant="line" :data="activityTrendData" :colors="['#2f73f6', '#20ad7a', '#ff8a3d']" />
      </section>

      <section class="dashboard-panel idle-panel">
        <header><div><Archive :size="18" /><h2>闲置资产优先复核</h2></div><button type="button" @click="emit('navigate', 'governance.utilization')">利用率治理<ChevronRight :size="15" /></button></header>
        <button v-for="item in idleRows.slice(0, 4)" :key="item.id" type="button" @click="emit('navigate', item.routeId)"><span>{{ item.typeLabel }}</span><div><b>{{ item.title }}</b><small>{{ item.departmentName }} · {{ item.ownerName }}</small></div><em>{{ item.idleDays ? `${item.idleDays} 天未使用` : '暂无使用记录' }}</em><ChevronRight :size="15" /></button>
      </section>

      <section class="dashboard-panel guidance-panel">
        <header><div><Lightbulb :size="18" /><h2>本期管理提示</h2></div><span>面向老板与资产管理者</span></header>
        <div><article v-for="(tip, index) in managementTips" :key="tip"><span>{{ index + 1 }}</span><p>{{ tip }}</p></article></div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.executive-dashboard { min-width: 0; padding-bottom: 24px; color: #263640; background: #edf2f5; }
.dashboard-heading { min-height: 92px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 14px 24px; background: #f8fafb; border-bottom: 1px solid #d4dde2; }
.dashboard-heading > div:first-child { min-width: 0; display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 11px; }.dashboard-heading h1 { margin: 0; font-size: 21px; letter-spacing: 0; }.dashboard-heading p { grid-column: 2; margin: 4px 0 0; color: #71818c; font-size: 11px; }.scope-chip { grid-row: 1 / 3; min-height: 34px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; color: #17634f; background: #e7f5ef; border: 1px solid #a8d6c4; border-radius: 4px; font-size: 10px; font-weight: 700; }
.heading-actions { display: flex; align-items: center; gap: 13px; color: #778690; font-size: 10px; white-space: nowrap; }.heading-actions > span { display: inline-flex; align-items: center; gap: 5px; }.heading-actions b { color: #30414c; }.flow-entry { min-height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; color: #235f67; background: #eef9f6; border: 1px solid #8bcabd; border-radius: 4px; font-size: 11px; font-weight: 700; }
.executive-metrics { display: grid; grid-template-columns: repeat(6, minmax(145px, 1fr)); gap: 10px; padding: 14px 16px 0; }.executive-metrics > button { min-width: 0; min-height: 126px; display: grid; grid-template-columns: 42px minmax(0, 1fr); align-items: center; gap: 10px; padding: 12px 13px 0; text-align: left; background: white; border: 1px solid #d4dde2; border-radius: 5px; box-shadow: 0 1px 3px rgba(27, 46, 57, .06); }.executive-metrics > button:hover { border-color: #9eafb9; transform: translateY(-1px); }.metric-icon { width: 40px; height: 40px; display: grid; place-items: center; color: white; border-radius: 5px; }.metric-icon.blue { background: #2f73f6; }.metric-icon.green { background: #20ad78; }.metric-icon.amber { background: #e99525; }.metric-icon.cyan { background: #20a8bb; }.metric-icon.red { background: #e45466; }.metric-icon.violet { background: #7058dc; }.executive-metrics small { display: block; overflow: hidden; color: #71818c; font-size: 10px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.executive-metrics strong { display: block; margin-top: 2px; color: #15232b; font-size: 24px; line-height: 1.1; }.executive-metrics p { margin: 5px 0 0; overflow: hidden; color: #7d8b94; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.executive-metrics footer { grid-column: 1 / 3; min-height: 31px; display: flex; align-items: center; justify-content: space-between; color: #82909a; border-top: 1px solid #e7ecef; font-size: 9px; }
.dashboard-panel { min-width: 0; overflow: hidden; background: white; border: 1px solid #d4dde2; border-radius: 5px; box-shadow: 0 1px 3px rgba(27, 46, 57, .05); }.dashboard-panel > header { min-height: 49px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 14px; border-bottom: 1px solid #dce4e8; }.dashboard-panel > header > div { min-width: 0; display: flex; align-items: center; gap: 8px; }.dashboard-panel > header svg { color: #1680a9; }.dashboard-panel h2 { margin: 0; font-size: 14px; letter-spacing: 0; }.dashboard-panel header > span { overflow: hidden; color: #7b8993; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.dashboard-panel header button { display: inline-flex; align-items: center; gap: 3px; padding: 0; color: #167fa8; background: transparent; border: 0; font-size: 10px; white-space: nowrap; }.dashboard-panel header em { min-width: 21px; height: 20px; display: grid; place-items: center; padding: 0 5px; color: #aa6718; background: #fff0dc; border-radius: 10px; font-size: 9px; font-style: normal; }.dashboard-panel header em.danger { color: #b83c49; background: #fbe9ec; }
.priority-grid { display: grid; grid-template-columns: minmax(560px, 1.45fr) minmax(430px, 1fr); gap: 10px; padding: 10px 16px 0; }.todo-panel, .warning-panel { min-height: 338px; }.action-list > button { width: 100%; min-height: 56px; display: grid; grid-template-columns: 58px minmax(0, 1fr) 92px 72px 15px; align-items: center; gap: 9px; padding: 7px 13px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.action-list > button:hover, .warning-list > button:hover, .popular-list button:hover, .upcoming-panel > button:hover, .idle-panel > button:hover { background: #f7fafb; }.action-type { min-height: 24px; display: grid; place-items: center; color: #9a631c; background: #fff2df; border-radius: 3px; font-size: 9px; }.action-type.urgent { color: #b33443; background: #fbe9ec; }.action-list div { min-width: 0; }.action-list b, .warning-list b { display: block; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }.action-list small, .warning-list small { display: block; margin-top: 4px; overflow: hidden; color: #7d8c96; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.action-list .owner, .action-list time { display: inline-flex; align-items: center; gap: 4px; overflow: hidden; color: #70808a; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.action-list > button > svg { color: #8c99a1; }
.warning-summary { display: grid; grid-template-columns: repeat(3, 1fr); background: #f8fafb; border-bottom: 1px solid #e2e8eb; }.warning-summary div { min-height: 66px; display: grid; place-content: center; gap: 3px; text-align: center; border-right: 1px solid #e2e8eb; }.warning-summary div:last-child { border-right: 0; }.warning-summary strong { color: #c25140; font-size: 19px; }.warning-summary span { color: #7a8993; font-size: 9px; }.warning-list > button { width: 100%; min-height: 55px; display: grid; grid-template-columns: 68px minmax(0, 1fr) 15px; align-items: center; gap: 9px; padding: 7px 13px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.warning-list > button > span { min-height: 25px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; color: #a96618; background: #fff0dc; border-radius: 3px; font-size: 9px; }.warning-list > button > span.danger { color: #b63442; background: #fbe9ec; }.warning-list > button > svg { color: #8c99a1; }
.value-grid { display: grid; grid-template-columns: minmax(560px, 1.55fr) minmax(290px, .75fr) minmax(270px, .7fr); gap: 10px; padding: 10px 16px 0; }.value-grid .dashboard-panel { min-height: 350px; }.popular-content { min-height: 300px; display: grid; grid-template-columns: minmax(300px, .95fr) minmax(360px, 1.05fr); gap: 8px; padding: 8px; }.popular-content > * { min-width: 0; max-width: 100%; }.popular-chart { width: 100%; height: 284px; }.popular-list { min-width: 0; align-self: center; border: 1px solid #e2e8eb; }.popular-list button { width: 100%; min-width: 0; min-height: 51px; display: grid; grid-template-columns: 24px minmax(0, 1fr) 37px 37px 37px 28px; align-items: center; gap: 5px; padding: 6px 8px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.popular-list button:last-child { border-bottom: 0; }.popular-list button > strong { width: 21px; height: 21px; display: grid; place-items: center; color: #487084; background: #eaf1f5; border-radius: 3px; font-size: 9px; }.popular-list button:first-child > strong { color: white; background: #2f73f6; }.popular-list div { min-width: 0; }.popular-list b { display: block; overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.popular-list small { display: block; margin-top: 3px; overflow: hidden; color: #83919a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.popular-list button > span { min-width: 0; display: inline-flex; align-items: center; gap: 2px; color: #71818c; font-size: 8px; }.popular-list button > em { color: #1f6fa0; font-size: 11px; font-style: normal; font-weight: 700; text-align: right; }
.donut-content { min-height: 300px; display: grid; grid-template-rows: 190px auto; align-items: center; padding: 12px; }.donut-wrap { position: relative; width: 184px; height: 184px; justify-self: center; }.donut-wrap > .chartcube-chart { width: 100%; height: 100%; }.donut-wrap > div:last-child { position: absolute; inset: 35%; display: grid; place-content: center; text-align: center; pointer-events: none; }.donut-wrap strong { font-size: 22px; }.donut-wrap span { margin-top: 3px; color: #7b8993; font-size: 8px; white-space: nowrap; }.compact-legend button { width: 100%; min-height: 32px; display: grid; grid-template-columns: 8px minmax(0, 1fr) 24px 39px; align-items: center; gap: 6px; padding: 0; text-align: left; background: white; border: 0; border-bottom: 1px solid #e6ebee; font-size: 9px; }.compact-legend i { width: 7px; height: 7px; border-radius: 2px; }.compact-legend strong { text-align: right; }.compact-legend em { color: #81909a; font-style: normal; text-align: right; }
.freshness-chart { width: 184px; height: 184px; margin: 10px auto 0; }.freshness-legend { padding: 3px 14px 12px; }.freshness-legend div { min-height: 32px; display: grid; grid-template-columns: 8px minmax(0, 1fr) 26px; align-items: center; gap: 7px; border-bottom: 1px solid #e6ebee; font-size: 9px; }.freshness-legend i { width: 7px; height: 7px; border-radius: 2px; }.freshness-legend strong { text-align: right; }
.finance-grid { display: grid; grid-template-columns: minmax(470px, 1.35fr) minmax(340px, .9fr) minmax(320px, .75fr); gap: 10px; padding: 10px 16px 0; }.finance-grid .dashboard-panel { min-height: 356px; }.expense-kpis { display: grid; grid-template-columns: repeat(3, 1fr); margin: 10px 12px 0; background: #f7fafb; border: 1px solid #e1e8eb; }.expense-kpis div { min-height: 56px; display: grid; place-content: center; gap: 4px; padding: 7px; text-align: center; border-right: 1px solid #e1e8eb; }.expense-kpis div:last-child { border-right: 0; }.expense-kpis span { color: #7b8993; font-size: 8px; }.expense-kpis strong { font-size: 13px; }.expense-trend-chart { width: 100%; height: 230px; padding: 2px 8px 8px; }.expense-category-chart { width: 100%; height: 295px; padding: 10px 9px 5px; }.upcoming-panel > button { width: 100%; min-height: 57px; display: grid; grid-template-columns: 31px minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; column-gap: 8px; padding: 7px 11px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.upcoming-panel > button > span { grid-row: 1 / 3; width: 29px; height: 29px; display: grid; place-items: center; color: #8d661f; background: #fff2df; border-radius: 4px; }.upcoming-panel > button div { min-width: 0; }.upcoming-panel b, .upcoming-panel small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.upcoming-panel b { font-size: 10px; }.upcoming-panel small { margin-top: 3px; color: #81909a; font-size: 8px; }.upcoming-panel > button > strong { font-size: 10px; text-align: right; }.upcoming-panel > button > em { grid-column: 3; color: #a76718; font-size: 8px; font-style: normal; text-align: right; }
.insight-grid { display: grid; grid-template-columns: minmax(450px, 1.25fr) minmax(340px, .9fr) minmax(330px, .85fr); gap: 10px; padding: 10px 16px 0; }.insight-grid .dashboard-panel { min-height: 310px; }.activity-chart { width: 100%; height: 255px; padding: 3px 8px 7px; }.idle-panel > button { width: 100%; min-height: 56px; display: grid; grid-template-columns: 66px minmax(0, 1fr) 82px 15px; align-items: center; gap: 8px; padding: 7px 12px; text-align: left; background: white; border: 0; border-bottom: 1px solid #e7ecef; }.idle-panel > button > span { min-height: 24px; display: grid; place-items: center; color: #9d661d; background: #fff2df; border-radius: 3px; font-size: 8px; }.idle-panel > button div { min-width: 0; }.idle-panel b, .idle-panel small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.idle-panel b { font-size: 10px; }.idle-panel small { margin-top: 4px; color: #81909a; font-size: 8px; }.idle-panel em { color: #b65642; font-size: 8px; font-style: normal; text-align: right; }.idle-panel > button > svg { color: #8c99a1; }.guidance-panel > div { display: grid; gap: 0; padding: 8px 13px; }.guidance-panel article { min-height: 69px; display: grid; grid-template-columns: 27px 1fr; align-items: center; gap: 9px; border-bottom: 1px solid #e5ebee; }.guidance-panel article:last-child { border-bottom: 0; }.guidance-panel article span { width: 25px; height: 25px; display: grid; place-items: center; color: #176e6a; background: #e6f5f1; border-radius: 50%; font-size: 9px; font-weight: 700; }.guidance-panel p { margin: 0; color: #52636e; font-size: 10px; line-height: 1.65; }
.dashboard-empty { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: #779084; font-size: 10px; }.dashboard-empty span { color: #87959d; font-size: 9px; }.dashboard-empty.compact { min-height: 210px; }
@media (max-width: 1500px) { .executive-metrics { grid-template-columns: repeat(3, 1fr); }.value-grid { grid-template-columns: 1fr 1fr; }.popular-panel { grid-column: 1 / 3; }.finance-grid { grid-template-columns: 1.25fr .9fr; }.upcoming-panel { grid-column: 1 / 3; }.upcoming-panel { display: grid; grid-template-columns: 1fr 1fr; }.upcoming-panel > header { grid-column: 1 / 3; }.insight-grid { grid-template-columns: 1fr 1fr; }.guidance-panel { grid-column: 1 / 3; }.guidance-panel > div { grid-template-columns: repeat(3, 1fr); }.guidance-panel article { min-height: 80px; padding: 0 12px; border-right: 1px solid #e5ebee; border-bottom: 0; } }
@media (max-width: 1160px) { .priority-grid { grid-template-columns: 1fr; }.todo-panel, .warning-panel { min-height: 0; }.popular-content { grid-template-columns: 1fr; }.popular-chart { height: 250px; }.finance-grid, .insight-grid { grid-template-columns: 1fr 1fr; }.expense-trend-panel, .activity-panel { grid-column: 1 / 3; } }
@media (max-width: 900px) { .dashboard-heading { align-items: flex-start; flex-direction: column; padding: 13px; }.heading-actions { flex-wrap: wrap; }.executive-metrics, .priority-grid, .value-grid, .finance-grid, .insight-grid { padding: 8px 8px 0; gap: 8px; }.executive-metrics { grid-template-columns: 1fr 1fr; }.value-grid, .finance-grid, .insight-grid { grid-template-columns: 1fr; }.popular-panel, .upcoming-panel, .guidance-panel, .expense-trend-panel, .activity-panel { grid-column: auto; }.upcoming-panel { display: block; }.upcoming-panel > header { grid-column: auto; }.guidance-panel > div { grid-template-columns: 1fr; }.guidance-panel article { min-height: 66px; padding: 0; border-right: 0; border-bottom: 1px solid #e5ebee; }.action-list > button { grid-template-columns: 58px minmax(0, 1fr) 70px 15px; }.action-list time { display: none; }.finance-grid .dashboard-panel, .value-grid .dashboard-panel, .insight-grid .dashboard-panel { min-height: 0; } }
@media (max-width: 560px) { .dashboard-heading > div:first-child { grid-template-columns: 1fr; }.scope-chip { grid-row: auto; width: fit-content; margin-bottom: 7px; }.dashboard-heading p { grid-column: auto; line-height: 1.5; }.heading-actions > span:last-child, .dashboard-panel > header > span { display: none; }.executive-metrics { grid-template-columns: 1fr; }.executive-metrics > button { min-height: 112px; }.action-list > button { grid-template-columns: 54px minmax(0, 1fr) 15px; }.action-list .owner { display: none; }.warning-summary { grid-template-columns: 1fr 1fr 1fr; }.popular-content { padding: 5px; }.popular-list button { grid-template-columns: 23px minmax(0, 1fr) 29px; }.popular-list button > span { display: none; }.popular-list button > em { display: block; }.popular-chart { height: 260px; }.expense-kpis { grid-template-columns: 1fr; }.expense-kpis div { min-height: 48px; border-right: 0; border-bottom: 1px solid #e1e8eb; }.expense-kpis div:last-child { border-bottom: 0; }.idle-panel > button { grid-template-columns: 58px minmax(0, 1fr) 15px; }.idle-panel em { display: none; } }
</style>
