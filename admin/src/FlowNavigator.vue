<script setup>
import { computed, ref } from "vue";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Cable,
  Clock3,
  Copyright,
  Database,
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  GitPullRequest,
  Globe2,
  History,
  KeyRound,
  Link2,
  LockKeyhole,
  PanelTop,
  Paperclip,
  RefreshCw,
  Scale,
  Send,
  Server,
  ShieldCheck,
  Users,
  Workflow
} from "@lucide/vue";
import { flowDefinitions } from "./flow-navigation.js";
import { buildFlowLayout, FLOW_LAYOUT } from "./flow-layout.js";
import { buildPortalUrl, DEFAULT_PORTAL_URL } from "./portal-links.js";

const props = defineProps({
  accessibleRouteIds: { type: Array, default: () => [] },
  portalBaseUrl: { type: String, default: DEFAULT_PORTAL_URL }
});
const emit = defineEmits(["navigate", "blocked"]);

const iconComponents = {
  Activity, AlertTriangle, Boxes, Cable, Clock3, Copyright, Database, Download, ExternalLink, FileArchive,
  FileText, GitPullRequest, Globe2, History, KeyRound, Link2, LockKeyhole, PanelTop, Paperclip,
  RefreshCw, Scale, Send, Server, ShieldCheck, Users, Workflow
};
const activeFlowId = ref(flowDefinitions[0].id);
const hoveredNodeId = ref("");
const hoveredLaneId = ref("");
const activeFlow = computed(() => flowDefinitions.find((flow) => flow.id === activeFlowId.value) || flowDefinitions[0]);
const accessibleRoutes = computed(() => new Set(props.accessibleRouteIds));
const layout = computed(() => buildFlowLayout(activeFlow.value));
const activeNodeId = computed(() => hoveredNodeId.value);
const lanePalette = [
  { color: "#3976b8", soft: "#eef5fc" },
  { color: "#2f946f", soft: "#edf8f3" },
  { color: "#b7791f", soft: "#fff8e9" },
  { color: "#7761ad", soft: "#f6f2fc" },
  { color: "#248b96", soft: "#edf8f9" }
];

function iconComponent(name) {
  return iconComponents[name] || FileText;
}

function isLocked(node) {
  return node.target.type === "admin" && !accessibleRoutes.value.has(node.target.routeId);
}

function activateNode(node) {
  if (isLocked(node)) {
    emit("blocked", node.permissionHint || "当前账号无权访问此节点");
    return;
  }
  emit("navigate", node.target.routeId);
}

function portalHref(node) {
  if (node.target.type !== "portal") return undefined;
  return buildPortalUrl(props.portalBaseUrl, node.target, window.location.href);
}

function switchFlow(flowId) {
  activeFlowId.value = flowId;
  hoveredNodeId.value = "";
  hoveredLaneId.value = "";
}

function laneStyle(laneIndex) {
  const palette = lanePalette[laneIndex % lanePalette.length];
  return {
    "--lane-color": palette.color,
    "--lane-soft": palette.soft,
    left: `${FLOW_LAYOUT.canvasSidePadding + laneIndex * layout.value.laneWidth}px`,
    top: `${FLOW_LAYOUT.headerHeight}px`,
    width: `${layout.value.laneWidth}px`,
    height: `${layout.value.height - FLOW_LAYOUT.headerHeight}px`
  };
}

function nodeStyle(node) {
  const palette = lanePalette[node.laneIndex % lanePalette.length];
  return {
    "--lane-color": palette.color,
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`
  };
}

function isEdgeHighlighted(edge) {
  return Boolean(activeNodeId.value) && (edge.from === activeNodeId.value || edge.to === activeNodeId.value);
}

function isNodeConnected(node) {
  if (!activeNodeId.value) return false;
  if (node.id === activeNodeId.value) return true;
  return activeFlow.value.edges.some((edge) =>
    (edge.from === activeNodeId.value && edge.to === node.id) ||
    (edge.to === activeNodeId.value && edge.from === node.id)
  );
}

const mobileNodes = computed(() => [...activeFlow.value.nodes].sort((a, b) => a.sequence - b.sequence));

function incomingLabel(node) {
  return activeFlow.value.edges.find((edge) => edge.to === node.id && edge.label)?.label || "";
}
</script>

<template>
  <section class="flow-navigator">
    <header class="flow-heading">
      <div><Workflow :size="21" /><div><h2>全流程导航</h2><p>门户展示、后台维护、审核发布、权限开放和持续治理</p></div></div>
      <span>{{ activeFlow.lanes.length }} 个角色泳道</span>
    </header>

    <nav class="flow-tabs" aria-label="无形资产业务流程">
      <button
        v-for="flow in flowDefinitions"
        :key="flow.id"
        :class="{ active: activeFlowId === flow.id }"
        type="button"
        @click="switchFlow(flow.id)"
      >
        <component :is="iconComponent(flow.lanes[0].icon)" :size="16" />
        <span>{{ flow.label }}</span>
      </button>
    </nav>

    <div class="flow-title-row">
      <div><h3>{{ activeFlow.title }}</h3><p>{{ activeFlow.description }}</p></div>
      <div class="flow-title-meta">
        <div class="flow-legend" aria-label="流程连线图例">
          <span><i class="legend-primary"></i>主流程</span>
          <span><i class="legend-system"></i>系统协同</span>
          <span><i class="legend-return"></i>返工与异常</span>
        </div>
        <span>{{ activeFlow.nodes.length }} 个流程节点</span>
      </div>
    </div>

    <div class="flow-board">
      <div class="flow-canvas-viewport">
        <div class="flow-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
          <div class="flow-direction-label"><span>业务流程</span><b>↓</b></div>
          <div
            v-for="(lane, laneIndex) in activeFlow.lanes"
            :key="lane.id"
            class="flow-lane"
            :class="{ muted: hoveredLaneId && hoveredLaneId !== lane.id, focused: hoveredLaneId === lane.id }"
            :style="laneStyle(laneIndex)"
            @mouseenter="hoveredLaneId = lane.id"
            @mouseleave="hoveredLaneId = ''"
          >
            <div class="flow-lane-label" :style="{ top: `-${FLOW_LAYOUT.headerHeight}px`, height: `${FLOW_LAYOUT.headerHeight}px` }">
              <component :is="iconComponent(lane.icon)" :size="18" />
              <span>{{ lane.label }}</span>
            </div>
          </div>

          <span
            v-for="rowIndex in layout.maxRow"
            :key="`row-${rowIndex}`"
            class="flow-row-guide"
            :style="{ top: `${FLOW_LAYOUT.headerHeight + rowIndex * FLOW_LAYOUT.rowHeight}px` }"
          ></span>

          <svg class="flow-connectors" :viewBox="`0 0 ${layout.width} ${layout.height}`" aria-hidden="true">
            <defs>
              <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
              <marker id="flow-arrow-warning" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
              <marker id="flow-arrow-system" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
            </defs>
            <g
              v-for="edge in layout.edges"
              :key="edge.id"
              :class="[
                `edge-${edge.kind || 'primary'}`,
                { highlighted: isEdgeHighlighted(edge), subdued: activeNodeId && !isEdgeHighlighted(edge) }
              ]"
            >
              <path :d="edge.path" :marker-end="`url(#${edge.kind === 'system' ? 'flow-arrow-system' : ['warning','return'].includes(edge.kind) ? 'flow-arrow-warning' : 'flow-arrow'})`" />
              <template v-if="edge.label">
                <rect class="edge-label-bg" :x="edge.labelX - edge.labelWidth / 2" :y="edge.labelY - 11" :width="edge.labelWidth" height="16" rx="8" />
                <text :x="edge.labelX" :y="edge.labelY" text-anchor="middle">{{ edge.label }}</text>
              </template>
            </g>
          </svg>

          <component
            v-for="node in layout.nodes"
            :key="node.id"
            :is="node.target.type === 'portal' ? 'a' : 'button'"
            class="flow-node"
            :class="[
              `tone-${node.tone}`,
              {
                locked: isLocked(node),
                connected: isNodeConnected(node),
                subdued: activeNodeId && !isNodeConnected(node),
                'lane-subdued': hoveredLaneId && hoveredLaneId !== node.lane
              }
            ]"
            :style="nodeStyle(node)"
            :type="node.target.type === 'admin' ? 'button' : undefined"
            :href="portalHref(node)"
            :target="node.target.type === 'portal' ? '_blank' : undefined"
            :rel="node.target.type === 'portal' ? 'noopener noreferrer' : undefined"
            :aria-disabled="String(isLocked(node))"
            :title="isLocked(node) ? node.permissionHint : node.meta"
            @click="node.target.type === 'admin' && activateNode(node)"
            @mouseenter="hoveredNodeId = node.id"
            @mouseleave="hoveredNodeId === node.id && (hoveredNodeId = '')"
            @focus="hoveredNodeId = node.id"
            @blur="hoveredNodeId === node.id && (hoveredNodeId = '')"
          >
            <span class="node-icon"><component :is="isLocked(node) ? LockKeyhole : iconComponent(node.icon)" :size="17" /></span>
            <span class="node-copy"><b>{{ node.label }}</b><small>{{ isLocked(node) ? node.permissionHint : node.meta }}</small></span>
            <ExternalLink v-if="node.target.type === 'portal' && !isLocked(node)" class="node-external" :size="12" />
          </component>
        </div>
      </div>

      <ol class="flow-mobile-list">
        <li v-for="node in mobileNodes" :key="node.id">
          <span class="mobile-sequence">{{ node.sequence }}</span>
          <div class="mobile-node-context">
            <em>{{ activeFlow.lanes.find((lane) => lane.id === node.lane)?.label }}</em>
            <small v-if="incomingLabel(node)">{{ incomingLabel(node) }}</small>
          </div>
          <component
            :is="node.target.type === 'portal' ? 'a' : 'button'"
            :type="node.target.type === 'admin' ? 'button' : undefined"
            :href="portalHref(node)"
            :target="node.target.type === 'portal' ? '_blank' : undefined"
            :rel="node.target.type === 'portal' ? 'noopener noreferrer' : undefined"
            :class="[`tone-${node.tone}`, { locked: isLocked(node) }]"
            :aria-disabled="String(isLocked(node))"
            @click="node.target.type === 'admin' && activateNode(node)"
          >
            <span><component :is="isLocked(node) ? LockKeyhole : iconComponent(node.icon)" :size="18" /></span>
            <div><b>{{ node.label }}</b><small>{{ isLocked(node) ? node.permissionHint : node.meta }}</small></div>
            <ExternalLink v-if="node.target.type === 'portal' && !isLocked(node)" :size="14" />
          </component>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.flow-navigator { min-height: calc(100vh - 134px); padding: 16px 18px 28px; color: #24333d; background: #edf1f4; }
.flow-heading { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 4px 14px; }
.flow-heading > div { display: flex; align-items: center; gap: 10px; }.flow-heading > div > svg { color: #2c8996; }
.flow-heading h2, .flow-title-row h3 { margin: 0; letter-spacing: 0; }.flow-heading h2 { font-size: 17px; }.flow-heading p, .flow-title-row p { margin: 4px 0 0; color: #74838d; font-size: 11px; }
.flow-heading > span, .flow-title-row > span { flex: 0 0 auto; color: #667681; font-size: 10px; }
.flow-tabs { min-height: 48px; display: flex; align-items: stretch; overflow: auto hidden; background: white; border: 1px solid #d4dce1; }
.flow-tabs button { min-width: 164px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 15px; color: #495a65; background: white; border: 0; border-right: 1px solid #dce3e7; font-weight: 700; white-space: nowrap; }
.flow-tabs button:hover { background: #f6f9fa; }.flow-tabs button.active { color: white; background: #263f50; box-shadow: inset 0 -3px #42c9a8; }
.flow-title-row { min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 10px 15px; background: #f8fafb; border: 1px solid #d4dce1; border-top: 0; }
.flow-title-row h3 { font-size: 15px; }
.flow-title-meta { flex: 0 0 auto; display: flex; align-items: center; gap: 18px; }.flow-title-meta > span { color: #667681; font-size: 10px; }
.flow-legend { display: flex; align-items: center; gap: 13px; color: #6b7a84; font-size: 9px; }.flow-legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }.flow-legend i { width: 22px; height: 0; border-top: 2px solid #75828a; }.flow-legend .legend-system { border-color: #269aab; border-top-style: dashed; }.flow-legend .legend-return { border-color: #df8b17; border-top-style: dashed; }
.flow-board { background: white; border: 1px solid #d4dce1; border-top: 0; }
.flow-canvas-viewport { max-width: 100%; overflow: auto; }
.flow-canvas { position: relative; min-width: 100%; overflow: hidden; background: #fbfcfd; }
.flow-direction-label { position: absolute; z-index: 4; left: 3px; top: 7px; display: grid; justify-items: center; gap: 1px; color: #77858e; font-size: 8px; pointer-events: none; }
.flow-direction-label span { writing-mode: vertical-rl; }.flow-direction-label b { color: #37a68d; font-size: 12px; }
.flow-lane { position: absolute; z-index: 0; background: color-mix(in srgb, var(--lane-soft) 44%, white); border-right: 1px dashed #c7d2d8; transition: opacity .18s ease, background .18s ease; }
.flow-lane:first-of-type { border-left: 1px dashed #c7d2d8; }.flow-lane.muted { opacity: .4; }.flow-lane.focused { background: color-mix(in srgb, var(--lane-soft) 78%, white); }
.flow-lane-label { position: absolute; left: 0; width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 0 10px; color: #30434e; background: #f4f7f8; border-top: 3px solid var(--lane-color); border-right: 1px dashed #c7d2d8; border-bottom: 1px solid #c7d2d8; font-size: 11px; font-weight: 700; text-align: center; transition: background .18s ease; }
.flow-lane.focused .flow-lane-label { background: var(--lane-soft); }.flow-lane-label svg { flex: 0 0 auto; color: var(--lane-color); }
.flow-row-guide { position: absolute; z-index: 1; left: 28px; right: 28px; border-top: 1px dashed #d9e0e4; pointer-events: none; }
.flow-connectors { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.flow-connectors > g { transition: opacity .16s ease; }.flow-connectors > g > path { fill: none; stroke: #75828a; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.flow-connectors text { fill: #586973; font-size: 9px; font-weight: 700; }.flow-connectors .edge-label-bg { fill: rgba(255, 255, 255, .96); stroke: #d9e1e5; stroke-width: 1; }
.flow-connectors marker path { fill: #75828a; }.flow-connectors #flow-arrow-warning path { fill: #df8b17; }.flow-connectors #flow-arrow-system path { fill: #269aab; }
.flow-connectors .edge-warning > path, .flow-connectors .edge-return > path { stroke: #df8b17; stroke-dasharray: 6 5; }.flow-connectors .edge-warning text, .flow-connectors .edge-return text { fill: #bd7210; }.flow-connectors .edge-warning .edge-label-bg, .flow-connectors .edge-return .edge-label-bg { fill: #fffaf0; stroke: #efc47f; }
.flow-connectors .edge-system > path { stroke: #269aab; stroke-dasharray: 4 4; }.flow-connectors .edge-system text { fill: #237f8d; }.flow-connectors .edge-system .edge-label-bg { fill: #f1fbfc; stroke: #8ccbd2; }
.flow-connectors > g.subdued { opacity: .12; }.flow-connectors > g.highlighted { opacity: 1; }.flow-connectors > g.highlighted > path { stroke-width: 3; filter: drop-shadow(0 1px 2px rgba(32, 65, 82, .2)); }
.flow-node { position: absolute; z-index: 3; display: grid; grid-template-columns: 25px minmax(0, 1fr); align-items: center; gap: 5px; padding: 6px 8px; color: #2e434e; text-align: left; text-decoration: none; background: #f4fbf7; border: 1px solid #4dac78; border-radius: 4px; box-shadow: inset 3px 0 var(--lane-color), 0 1px 2px rgba(24, 43, 55, .08); transition: opacity .16s ease, transform .16s ease, box-shadow .16s ease; }
.flow-node:hover { z-index: 4; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(24, 43, 55, .13); }.flow-node:focus-visible { outline: 2px solid #2f73f6; outline-offset: 2px; }
.node-icon { width: 24px; height: 24px; display: grid; place-items: center; color: #27875f; background: rgba(255,255,255,.78); border-radius: 3px; }
.node-copy { min-width: 0; }.node-copy b { display: -webkit-box; overflow: hidden; font-size: 10px; line-height: 1.25; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.node-copy small { display: block; margin-top: 3px; overflow: hidden; color: #70808a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.node-external { position: absolute; right: 4px; top: 4px; color: #2f73f6; }
.tone-portal { color: #315f9e; background: #f1f6ff; border-color: #4e83d4; }.tone-portal .node-icon { color: #326ec2; }
.tone-ip { color: #554594; background: #f6f3ff; border-color: #8370d4; }.tone-ip .node-icon { color: #705ac2; }
.tone-review, .tone-warning { color: #7e5b18; background: #fff9eb; border-color: #e0a33a; }.tone-review .node-icon, .tone-warning .node-icon { color: #c37a10; }
.tone-publish { color: #58408d; background: #f8f4ff; border-color: #8569c0; }.tone-publish .node-icon { color: #7452b5; }
.tone-system { color: #236b75; background: #f0fafb; border-color: #43a6b4; }.tone-system .node-icon { color: #278c9a; }
.tone-audit { color: #4f5d67; background: #f6f8f9; border-color: #8f9ca4; }.tone-audit .node-icon { color: #65757f; }
.tone-danger { color: #8a3941; background: #fff4f5; border-color: #d76771; }.tone-danger .node-icon { color: #c34f59; }
.flow-node.connected { z-index: 4; box-shadow: inset 3px 0 var(--lane-color), 0 0 0 2px rgba(47, 115, 246, .16), 0 5px 12px rgba(24, 43, 55, .12); }.flow-node.subdued, .flow-node.lane-subdued { opacity: .28; }
.flow-node.locked { color: #68757d; background: #f0f2f3; border-color: #aeb8be; border-style: dashed; box-shadow: inset 3px 0 var(--lane-color); }.flow-node.locked .node-icon { color: #7d8a92; }.flow-node.locked:hover { transform: none; box-shadow: inset 3px 0 var(--lane-color); }
.flow-mobile-list { display: none; margin: 0; padding: 12px; list-style: none; }

@media (max-width: 900px) {
  .flow-navigator { min-height: calc(100vh - 130px); padding: 10px 8px 18px; }
  .flow-heading { align-items: flex-start; padding: 2px 5px 11px; }.flow-heading > span { margin-top: 4px; }
  .flow-tabs button { min-width: 148px; min-height: 44px; padding: 0 11px; }
  .flow-title-row { min-height: 62px; padding: 9px 11px; }.flow-title-meta { display: none; }
  .flow-canvas-viewport { display: none; }.flow-mobile-list { display: block; }
  .flow-mobile-list li { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 0 0 17px; }
  .flow-mobile-list li:not(:last-child)::after { content: ""; position: absolute; left: 13px; top: 28px; bottom: 1px; border-left: 1px dashed #96a4ad; }
  .mobile-sequence { position: relative; z-index: 1; width: 27px; height: 27px; display: grid; place-items: center; color: white; background: #344b59; border-radius: 50%; font-size: 10px; font-weight: 700; }
  .mobile-node-context { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
  .mobile-node-context em { color: #667781; font-size: 10px; font-style: normal; font-weight: 700; }.mobile-node-context small { color: #bd7210; font-size: 9px; }
  .flow-mobile-list button, .flow-mobile-list a { grid-column: 2; width: 100%; min-height: 62px; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 10px; color: #2e434e; text-align: left; text-decoration: none; border: 1px solid #4dac78; border-radius: 4px; }
  .flow-mobile-list button > span, .flow-mobile-list a > span { width: 32px; height: 32px; display: grid; place-items: center; background: rgba(255,255,255,.8); border-radius: 3px; }
  .flow-mobile-list button b, .flow-mobile-list a b { display: block; font-size: 12px; }.flow-mobile-list button small, .flow-mobile-list a small { display: block; margin-top: 4px; color: #71818a; font-size: 9px; }
  .flow-mobile-list button.locked { color: #68757d; background: #f0f2f3; border-color: #aeb8be; border-style: dashed; }
}

@media (max-width: 520px) {
  .flow-heading > span { display: none; }.flow-heading p { max-width: 270px; line-height: 1.45; }
  .flow-tabs { scroll-snap-type: x mandatory; }.flow-tabs button { min-width: 158px; scroll-snap-align: start; }
}
</style>
