import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { cleanEvent, createPilotStore } from "../server/pilot.mjs";
import { createApp } from "../server/index.mjs";
import { computeMetrics } from "../dist/js/metrics.js";
import { syntheticEvents } from "../dist/js/synthetic.js";

const base = { participant: "0b8f3c1e-aaaa-bbbb-cccc-123456789abc", cohort: "acme-2026", date: "2026-10-01" };

test("events keep only known fields and ids", () => {
  assert.deepEqual(cleanEvent({ ...base, type: "rest", name: "Sam", email: "x@y.z" }), { ...base, type: "rest" });
  assert.equal(cleanEvent({ ...base, type: "journey", activity: "x", kind: "route", minutes: 3 }), null);
  assert.equal(cleanEvent({ ...base, type: "offer", barrier: "time", activities: ["tiny-window", "free text"] }), null);
  assert.equal(cleanEvent({ ...base, cohort: "Has Spaces", type: "rest" }), null);
  assert.deepEqual(cleanEvent({ ...base, type: "journey", activity: "short", kind: "route", minutes: 3, simulated: "yes" }), {
    ...base,
    type: "journey",
    activity: "short",
    kind: "route",
    minutes: 3,
    simulated: false,
  });
});

test("small cohorts are suppressed", () => {
  const events = ["a", "b", "c"].map((p) => ({ ...base, participant: `person-${p}-0000`, type: "join" }));
  const m = computeMetrics(events);
  assert.equal(m.suppressed, true);
  assert.equal(m.persistence, undefined);
});

test("metrics exclude simulated journeys and count lapses and returns", () => {
  const people = Array.from({ length: 5 }, (_, i) => `person-${i}-00000`);
  const events = [];
  for (const participant of people) {
    events.push({ participant, cohort: "c1-test", type: "join", date: "2026-10-01", goal: 2 });
    for (const date of ["2026-10-01", "2026-10-02", "2026-10-06", "2026-10-08"]) {
      events.push({ participant, cohort: "c1-test", type: "journey", date, kind: "route", activity: "short", minutes: 3, simulated: false });
    }
    events.push({ participant, cohort: "c1-test", type: "journey", date: "2026-10-04", kind: "route", activity: "short", minutes: 3, simulated: true });
  }
  const m = computeMetrics(events, { end: "2026-10-14" });
  assert.equal(m.simulatedExcluded, 5);
  assert.equal(m.recovery.returned, 5, "the Oct 3–5 gap is a lapse with a return on the 6th");
  assert.equal(m.recovery.medianDaysToReturn, 4);
  assert.equal(m.persistence.eligibleWeeks, 10, "two complete weeks each");
  assert.equal(m.persistence.metGoal, 5, "week 1 had 3 active days; week 2 had 1");
});

test("the synthetic cohort is deterministic and produces every measure", () => {
  const a = syntheticEvents();
  assert.deepEqual(a, syntheticEvents());
  const m = computeMetrics(a.events, { end: a.end });
  assert.equal(m.participants, 48);
  for (const value of [m.persistence.rate, m.recovery.rate, m.detours.acceptance, m.detours.completion, m.retention[0].rate]) {
    assert.ok(value > 0 && value < 1, `rate in (0,1): ${value}`);
  }
});

test("server: health, coach validation, event intake, token-protected summary, no path traversal", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "reroute-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const coach = { available: false, note: async () => ({ status: 503, body: { error: "coach unavailable" } }) };
  const app = await createApp({ coach, pilot: createPilotStore(join(dir, "events.jsonl")), adminToken: "secret", log: { error() {} } });
  const server = createServer(app).listen(0);
  t.after(() => server.close());
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ai: false, pilot: true });
  assert.equal((await post("/api/coach", { barrier: "time" })).status, 503);
  assert.equal((await post("/api/events", { events: "nope" })).status, 400);
  const intake = await (await post("/api/events", { events: [{ ...base, type: "rest" }, { type: "bogus" }] })).json();
  assert.deepEqual(intake, { accepted: 1, rejected: 1 });
  assert.equal((await fetch(`${url}/api/pilot/summary`)).status, 401);
  const summary = await (await fetch(`${url}/api/pilot/summary`, { headers: { authorization: "Bearer secret" } })).json();
  assert.deepEqual(summary.cohorts, ["acme-2026"]);
  assert.equal(summary.metrics.suppressed, true);
  assert.equal((await fetch(`${url}/index.html`)).status, 200);
  assert.equal((await fetch(`${url}/..%2f..%2fpackage.json`)).status, 403);
});
