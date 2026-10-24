// ReRoute server: serves dist/ and adds the optional APIs (AI coach, pilot events, pilot
// summary). No framework; the only optional dependency is @anthropic-ai/sdk for the coach.
//
//   npm start                        → http://127.0.0.1:4173
//   ANTHROPIC_API_KEY=... npm start  → enables AI notes
//   PILOT_ADMIN_TOKEN=... npm start  → requires a bearer token for the pilot summary

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultCoach } from "./coach.mjs";
import { createPilotStore } from "./pilot.mjs";
import { computeMetrics } from "../dist/js/metrics.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(here, "../dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "geolocation=(self), camera=(), microphone=()",
};

const send = (res, status, body, headers = {}) => {
  const json = typeof body !== "string" && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SECURITY_HEADERS, ...(json ? { "content-type": MIME[".json"], "cache-control": "no-store" } : {}), ...headers });
  res.end(json ? JSON.stringify(body) : body);
};

async function readJson(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("invalid json"), { status: 400 });
  }
}

// A small per-address limiter: enough to stop a loop from running up an API bill.
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length <= max;
  };
}

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 403, "Forbidden");
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    send(res, 200, body, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  } catch {
    send(res, 404, "Not found");
  }
}

export async function createApp({ coach, pilot, adminToken = process.env.PILOT_ADMIN_TOKEN, log = console } = {}) {
  coach ??= await createDefaultCoach(log);
  pilot ??= createPilotStore(resolve(here, "../data/events.jsonl"));
  const coachLimit = limiter(30, 60_000);
  const eventLimit = limiter(120, 60_000);

  return async (req, res) => {
    const url = new URL(req.url, "http://x");
    const ip = req.socket.remoteAddress ?? "?";
    try {
      if (url.pathname === "/api/health" && req.method === "GET") {
        return send(res, 200, { ai: coach.available, pilot: true });
      }
      if (url.pathname === "/api/coach" && req.method === "POST") {
        if (!coachLimit(ip)) return send(res, 429, { error: "slow down" });
        const result = await coach.note(await readJson(req, 2048));
        return send(res, result.status, result.body);
      }
      if (url.pathname === "/api/events" && req.method === "POST") {
        if (!eventLimit(ip)) return send(res, 429, { error: "slow down" });
        const body = await readJson(req, 128 * 1024);
        if (!Array.isArray(body?.events) || body.events.length > 500) return send(res, 400, { error: "events must be an array" });
        return send(res, 200, await pilot.append(body.events));
      }
      if (url.pathname === "/api/pilot/summary" && req.method === "GET") {
        if (adminToken && req.headers.authorization !== `Bearer ${adminToken}`) return send(res, 401, { error: "unauthorized" });
        const cohort = url.searchParams.get("cohort")?.toLowerCase() || null;
        const events = await pilot.all();
        const cohorts = [...new Set(events.map((e) => e.cohort))].sort();
        return send(res, 200, { cohorts, metrics: computeMetrics(events, { cohort }) });
      }
      if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "not found" });
      if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
      return serveStatic(req, res);
    } catch (error) {
      if (!error.status) log.error?.(error);
      return send(res, error.status ?? 500, { error: error.status ? error.message : "server error" });
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4173;
  const host = process.env.HOST || "127.0.0.1";
  const app = await createApp();
  createServer(app).listen(port, host, () => {
    const ai = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? "on" : "off (set ANTHROPIC_API_KEY)";
    console.log(`ReRoute on http://${host}:${port}  ·  AI notes: ${ai}  ·  pilot summary: ${process.env.PILOT_ADMIN_TOKEN ? "token required" : "open (local demo)"}`);
  });
}
