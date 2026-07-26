export const FLOW_LAYOUT = Object.freeze({
  canvasMinWidth: 1120,
  canvasSidePadding: 28,
  laneMinWidth: 220,
  headerHeight: 72,
  rowHeight: 116,
  nodeHeight: 64,
  singleNodeWidth: 150,
  parallelNodeMaxWidth: 126,
  parallelGap: 12
});

function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return groups;
}

function distributePort(node, edges, edge, otherNodeByEdge) {
  if (edges.length <= 1) return node.x + node.width / 2;
  const sorted = [...edges].sort((left, right) => {
    const leftNode = otherNodeByEdge(left);
    const rightNode = otherNodeByEdge(right);
    return (leftNode?.x || 0) - (rightNode?.x || 0) || left.index - right.index;
  });
  const rank = sorted.findIndex((candidate) => candidate.index === edge.index);
  const usableWidth = Math.max(24, node.width - 34);
  return node.x + node.width / 2 + (rank - (sorted.length - 1) / 2) * (usableWidth / (sorted.length - 1));
}

function pathFromPoints(points) {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`).join(" ");
}

function buildEdgeGeometry(edge, nodeMap, outgoing, incoming, width) {
  const from = nodeMap.get(edge.from);
  const to = nodeMap.get(edge.to);
  if (!from || !to) return null;

  const sourceEdges = outgoing.get(from.id) || [edge];
  const targetEdges = incoming.get(to.id) || [edge];
  const sourcePortX = distributePort(from, sourceEdges, edge, (candidate) => nodeMap.get(candidate.to));
  const targetPortX = distributePort(to, targetEdges, edge, (candidate) => nodeMap.get(candidate.from));
  let points;
  let labelX;
  let labelY;

  if (to.row < from.row) {
    const routeLeft = Math.min(from.laneIndex, to.laneIndex) < (nodeMap.size > 0 ? 2 : 0);
    const sourceX = routeLeft ? from.x : from.x + from.width;
    const targetX = routeLeft ? to.x : to.x + to.width;
    const sideX = routeLeft
      ? Math.max(8, Math.min(sourceX, targetX) - 34 - (edge.index % 2) * 10)
      : Math.min(width - 8, Math.max(sourceX, targetX) + 34 + (edge.index % 2) * 10);
    const sourceY = from.y + from.height / 2;
    const targetY = to.y + to.height / 2;
    points = [[sourceX, sourceY], [sideX, sourceY], [sideX, targetY], [targetX, targetY]];
    labelX = (sideX + targetX) / 2;
    labelY = targetY - 9;
  } else if (to.row === from.row) {
    const leftToRight = to.x >= from.x;
    const sourceX = leftToRight ? from.x + from.width : from.x;
    const targetX = leftToRight ? to.x : to.x + to.width;
    const centerY = from.y + from.height / 2;
    points = [[sourceX, centerY], [targetX, centerY]];
    labelX = (sourceX + targetX) / 2;
    labelY = centerY - 9;
  } else {
    const sourceY = from.y + from.height;
    const targetY = to.y;
    const edgeRank = sourceEdges.findIndex((candidate) => candidate.index === edge.index);
    const channelOffset = (edgeRank - (sourceEdges.length - 1) / 2) * 8;
    const useLateChannel = edge.route === "late" && to.row - from.row > 1;
    const channelY = useLateChannel
      ? targetY - (FLOW_LAYOUT.rowHeight - to.height) / 2 + channelOffset
      : sourceY + (FLOW_LAYOUT.rowHeight - from.height) / 2 + channelOffset;
    points = Math.abs(sourcePortX - targetPortX) < 1
      ? [[sourcePortX, sourceY], [targetPortX, targetY]]
      : [[sourcePortX, sourceY], [sourcePortX, channelY], [targetPortX, channelY], [targetPortX, targetY]];
    labelX = Math.abs(sourcePortX - targetPortX) < 1 ? sourcePortX + 30 : (sourcePortX + targetPortX) / 2;
    labelY = channelY - 9;
  }

  const labelWidth = edge.label ? Math.max(38, Array.from(edge.label).length * 10 + 16) : 0;
  return { ...edge, path: pathFromPoints(points), points, labelX, labelY, labelWidth };
}

export function buildFlowLayout(flow, availableWidth = 0) {
  const width = Math.max(
    FLOW_LAYOUT.canvasMinWidth,
    FLOW_LAYOUT.canvasSidePadding * 2 + flow.lanes.length * FLOW_LAYOUT.laneMinWidth,
    Number.isFinite(availableWidth) ? Math.floor(availableWidth) : 0
  );
  const laneWidth = (width - FLOW_LAYOUT.canvasSidePadding * 2) / flow.lanes.length;
  const maxRow = Math.max(1, ...flow.nodes.map((node) => node.row));
  const height = FLOW_LAYOUT.headerHeight + maxRow * FLOW_LAYOUT.rowHeight;
  const slotGroups = groupBy(flow.nodes, (node) => `${node.lane}:${node.row}`);
  const positionedNodes = [];

  for (const nodes of slotGroups.values()) {
    const ordered = [...nodes].sort((left, right) => left.sequence - right.sequence);
    const laneIndex = Math.max(0, flow.lanes.findIndex((lane) => lane.id === ordered[0].lane));
    const laneLeft = FLOW_LAYOUT.canvasSidePadding + laneIndex * laneWidth;
    const nodeWidth = ordered.length === 1
      ? FLOW_LAYOUT.singleNodeWidth
      : Math.min(
        FLOW_LAYOUT.parallelNodeMaxWidth,
        Math.floor((laneWidth - 12 - (ordered.length - 1) * FLOW_LAYOUT.parallelGap) / ordered.length)
      );
    const totalWidth = ordered.length * nodeWidth + (ordered.length - 1) * FLOW_LAYOUT.parallelGap;
    ordered.forEach((node, slotIndex) => {
      positionedNodes.push({
        ...node,
        x: laneLeft + (laneWidth - totalWidth) / 2 + slotIndex * (nodeWidth + FLOW_LAYOUT.parallelGap),
        y: FLOW_LAYOUT.headerHeight + (node.row - 1) * FLOW_LAYOUT.rowHeight + (FLOW_LAYOUT.rowHeight - FLOW_LAYOUT.nodeHeight) / 2,
        width: nodeWidth,
        height: FLOW_LAYOUT.nodeHeight,
        laneIndex,
        slotIndex,
        slotCount: ordered.length
      });
    });
  }

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const indexedEdges = flow.edges.map((edge, index) => ({ ...edge, index, id: `${flow.id}:${edge.from}:${edge.to}:${index}` }));
  const outgoing = groupBy(indexedEdges, (edge) => edge.from);
  const incoming = groupBy(indexedEdges, (edge) => edge.to);
  const edges = indexedEdges.map((edge) => buildEdgeGeometry(edge, nodeMap, outgoing, incoming, width)).filter(Boolean);

  return { width, height, maxRow, laneWidth, nodes: positionedNodes, edges };
}
