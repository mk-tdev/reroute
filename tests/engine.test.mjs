import test from "node:test";
import assert from "node:assert/strict";
import { recommend, history, planOptions } from "../dist/js/engine.js";
import { activities, barriers } from "../dist/js/content.js";

const ids = (recs) => recs.map((r) => r.activity.id);

test("every barrier has at least three feasible detours", () => {
  for (const b of barriers) assert.ok(planOptions(b.id).length >= 3, b.id);
});

test("only detours that fit the barrier are suggested, at most three", () => {
  const recs = recommend({ barrier: "energy" });
  assert.ok(recs.length <= 3 && recs.length > 0);
  for (const r of recs) assert.ok(activities[r.activity.id].barriers.includes("energy"));
});

test("the person's own if-then plan always ranks first and says so", () => {
  const recs = recommend({ barrier: "time", plans: { time: "call-walk" } });
  assert.equal(recs[0].activity.id, "call-walk");
  assert.equal(recs[0].reasons[0], "yourPlan");
});

test("outdoor options drop when it's raining or hot; indoor ones explain why", () => {
  const dry = recommend({ barrier: "motivation", context: { hour: 8 }, limit: 10 });
  assert.ok(ids(dry).includes("shade-walk"));
  const hot = recommend({ barrier: "motivation", context: { hour: 14, weather: { hot: true } }, limit: 10 });
  assert.equal(ids(hot).at(-1), "shade-walk");
  assert.ok(hot[0].reasons.includes("heatIndoor"));
});

test("low energy prefers gentle options", () => {
  const recs = recommend({ barrier: "energy" });
  assert.equal(activities[recs[0].activity.id].intensity, "gentle");
});

test("past completions lift an option; a same-day decline lowers it", () => {
  const before = ids(recommend({ barrier: "weather", today: "2026-10-20" }));
  const target = before[2];
  const offers = Array.from({ length: 3 }, (_, i) => ({ date: `2026-10-1${i}`, barrier: "weather", activity: target, accepted: true, completed: true }));
  const after = recommend({ barrier: "weather", offers, today: "2026-10-20" });
  assert.equal(after[0].activity.id, target);
  assert.ok(after[0].reasons.includes("workedBefore"));

  const declined = [{ date: "2026-10-20", barrier: "weather", activity: before[0], accepted: false, completed: false }];
  assert.notEqual(ids(recommend({ barrier: "weather", offers: declined, today: "2026-10-20" }))[0], before[0]);
});

test("results are deterministic and reasons are capped at two", () => {
  const a = recommend({ barrier: "space", context: { hour: 22 } });
  const b = recommend({ barrier: "space", context: { hour: 22 } });
  assert.deepEqual(a, b);
  for (const r of a) assert.ok(r.reasons.length <= 2);
});

test("history tallies offers per activity", () => {
  const h = history([
    { activity: "one-song", accepted: true, completed: true, date: "2026-10-01" },
    { activity: "one-song", accepted: false, completed: false, date: "2026-10-02" },
  ]);
  assert.deepEqual(h["one-song"], { offered: 2, accepted: 1, completed: 1, lastDeclined: "2026-10-02" });
});
