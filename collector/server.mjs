import { createServer } from "node:http";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const port = Number(process.env.COLLECTOR_PORT || 8787);
const allowedOrigins = (process.env.COLLECTOR_ALLOWED_ORIGINS || "http://127.0.0.1:5173").split(",");
const eventTypes = new Set(["module_view", "detail_view", "search", "preview", "download", "version_view", "external_link"]);
const deviceTypes = new Set(["desktop", "tablet", "mobile"]);
const outputPath = path.resolve("collector/data/events.ndjson");

function corsHeaders(origin) {
  return allowedOrigins.includes(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin"
  } : {};
}

function normalizeEvent(input) {
  if (!input || typeof input !== "object" || !eventTypes.has(input.eventType)) return null;
  return {
    eventId: String(input.eventId || "").slice(0, 80),
    eventType: input.eventType,
    assetId: String(input.assetId || "").slice(0, 100),
    module: String(input.module || "").slice(0, 80),
    source: String(input.source || "direct").slice(0, 80),
    deviceType: deviceTypes.has(input.deviceType) ? input.deviceType : "desktop",
    occurredAt: Number.isNaN(Date.parse(input.occurredAt)) ? new Date().toISOString() : input.occurredAt,
    receivedAt: new Date().toISOString()
  };
}

const server = createServer(async (request, response) => {
  const origin = String(request.headers.origin || "");
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    response.writeHead(204, headers);
    return response.end();
  }
  if (request.url === "/health" && request.method === "GET") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end(JSON.stringify({ status: "ok", service: "hannao-public-collector" }));
  }
  if (request.url !== "/v1/events" || request.method !== "POST" || !allowedOrigins.includes(origin)) {
    response.writeHead(404, headers);
    return response.end();
  }

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64 * 1024) {
      response.writeHead(413, headers);
      return response.end();
    }
  }

  try {
    const body = JSON.parse(raw || "{}");
    const events = (Array.isArray(body.events) ? body.events : []).slice(0, 30).map(normalizeEvent).filter(Boolean);
    if (events.length) {
      await mkdir(path.dirname(outputPath), { recursive: true });
      await appendFile(outputPath, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    }
    response.writeHead(202, { ...headers, "Content-Type": "application/json" });
    response.end(JSON.stringify({ accepted: events.length }));
  } catch {
    response.writeHead(400, { ...headers, "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "invalid_event_payload" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Hannao public collector: http://127.0.0.1:${port}/health`);
});
