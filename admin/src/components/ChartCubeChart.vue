<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  variant: { type: String, required: true },
  data: { type: Array, default: () => [] },
  colors: { type: Array, default: () => ["#246bfd", "#14b87a", "#ff8a34", "#ef4f67", "#31b7d9", "#7357e8"] }
});

const host = ref(null);
let chart;
let ChartClass;

function chartOptions() {
  const common = {
    autoFit: true,
    animate: { enter: { type: "fadeIn", duration: 320 } },
    tooltip: { shared: true },
    theme: { type: "classic", margin: 0 }
  };

  if (props.variant === "donut") {
    return {
      ...common,
      type: "interval",
      data: props.data,
      coordinate: { type: "theta", innerRadius: 0.68, outerRadius: 0.94 },
      transform: [{ type: "stackY" }],
      encode: { y: "value", color: "name" },
      scale: { color: { range: props.colors } },
      axis: false,
      legend: false,
      style: { stroke: "#ffffff", lineWidth: 2 },
      labels: [{
        text: "value",
        position: "inside",
        style: { fill: "#ffffff", fontSize: 9, fontWeight: 700 }
      }]
    };
  }

  if (props.variant === "bar") {
    return {
      ...common,
      type: "interval",
      data: props.data,
      coordinate: { transform: [{ type: "transpose" }] },
      encode: { x: "name", y: "value", color: "name" },
      scale: {
        x: { paddingInner: 0.8, paddingOuter: 0.2 },
        color: { range: props.colors },
        y: { nice: true }
      },
      axis: {
        x: { title: false, labelFontSize: 11, labelFill: "#697784", tick: false },
        y: { title: false, labelFontSize: 10, labelFill: "#8a969e", gridStroke: "#edf1f4" }
      },
      legend: false,
      style: { radius: 3 },
      labels: [{ text: "value", position: "right", style: { fill: "#465460", fontSize: 10 } }]
    };
  }

  return {
    ...common,
    type: "view",
    scale: { color: { range: props.colors }, y: { nice: true } },
    axis: {
      x: { title: false, labelFontSize: 10, labelFill: "#8a969e", tick: false, line: false },
      y: { title: false, labelFontSize: 10, labelFill: "#8a969e", gridStroke: "#edf1f4", line: false }
    },
    legend: { color: { position: "top", itemLabelFontSize: 11, itemLabelFill: "#5f6e7a" } },
    children: [
      {
        type: "line",
        data: props.data,
        encode: { x: "date", y: "value", color: "series" },
        style: { lineWidth: 2.2 },
        shape: "smooth"
      },
      {
        type: "point",
        data: props.data,
        encode: { x: "date", y: "value", color: "series" },
        style: { r: 3, stroke: "#ffffff", lineWidth: 1.5 },
        labels: [{
          text: "value",
          position: "top",
          style: { dy: -5, fill: "#44535f", fontSize: 9, fontWeight: 600, stroke: "#ffffff", lineWidth: 3 }
        }]
      }
    ]
  };
}

async function renderChart() {
  await nextTick();
  if (!host.value || !props.data.length) return;
  ChartClass ||= (await import("@antv/g2")).Chart;
  chart?.destroy();
  chart = new ChartClass({ container: host.value, autoFit: true });
  chart.options(chartOptions());
  await chart.render();
}

onMounted(renderChart);
watch(() => [props.variant, props.data, props.colors], renderChart, { deep: true });
onBeforeUnmount(() => chart?.destroy());
</script>

<template>
  <div ref="host" class="chartcube-chart" :data-chartcube="variant"></div>
</template>
