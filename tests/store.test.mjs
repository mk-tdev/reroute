import test from "node:test";
import assert from "node:assert/strict";
import { load, save, sanitize, fresh, KEY, LEGACY_KEY } from "../dist/js/store.js";

const memory = (entries = {}) => {
  const data = { ...entries };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v), removeItem: (k) => delete data[k], data };
};

test("a missing or corrupt save starts fresh", () => {
  assert.deepEqual(load(memory()), fresh());
  assert.deepEqual(load(memory({ [KEY]: "{not json" })), fresh());
});

test("v2 demo days migrate to real dates ending today, with detours mapped to the library", () => {
  const legacy = {
    day: 3,
    journeys: [
      { id: "short", day: 1, minutes: 3 },
      { id: "time", day: 3, minutes: 2, simulated: true },
      { id: "removed-route", day: 2 },
    ],
    rests: [2],
    sound: true,
  };
  const state = load(memory({ [LEGACY_KEY]: JSON.stringify(legacy) }), new Date(2026, 9, 24, 10));
  assert.deepEqual(
    state.journeys.map((j) => [j.id, j.kind, j.date, j.simulated]),
    [
      ["short", "route", "2026-10-22", false],
      ["tiny-window", "detour", "2026-10-24", true],
    ],
  );
  assert.deepEqual(state.rests, ["2026-10-23"]);
  assert.equal(state.settings.sound, true);
  assert.equal(state.onboarded, false);
});

test("sanitize drops unknown ids, bad dates and invalid plans", () => {
  const state = sanitize({
    goal: { daysPerWeek: 12 },
    plans: { time: "call-walk", energy: "not-real", nonsense: "one-song" },
    journeys: [
      { id: "call-walk", kind: "detour", date: "2026-10-01" },
      { id: "call-walk", kind: "detour", date: "yesterday" },
      { id: "<script>", kind: "route", date: "2026-10-01" },
    ],
    rests: ["2026-10-02", "2026-10-02", 7],
    settings: { ai: "yes", locale: "ar" },
  });
  assert.equal(state.goal.daysPerWeek, 3);
  assert.deepEqual(state.plans, { time: "call-walk" });
  assert.equal(state.journeys.length, 1);
  assert.deepEqual(state.rests, ["2026-10-02"]);
  assert.equal(state.settings.ai, true);
  assert.equal(state.settings.locale, "ar");
});

test("save then load round-trips", () => {
  const storage = memory();
  const state = fresh();
  state.onboarded = true;
  state.plans.weather = "indoor-wander";
  state.journeys.push({ id: "scenic", kind: "route", date: "2026-10-24", minutes: 10, simulated: false });
  save(state, storage);
  assert.deepEqual(load(storage), state);
});
