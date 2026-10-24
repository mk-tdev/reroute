import test from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, lapse, comebacks, week, stats, today } from "../dist/js/habit.js";
import { fresh } from "../dist/js/store.js";

const D = "2026-10-20";
const journey = (date, kind = "route", id = kind === "route" ? "short" : "tiny-window") => ({ id, kind, date, minutes: 3, simulated: false });

test("date arithmetic crosses month ends and is symmetric", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-10-30", "2026-11-02"), 3);
});

test("demo offset moves the app's notion of today", () => {
  const state = { ...fresh(), demoOffset: 2 };
  assert.equal(today(state, new Date(2026, 9, 20, 9)), "2026-10-22");
});

test("no lapse without history, after one quiet day, or on a chosen rest day", () => {
  const state = fresh();
  assert.equal(lapse(state, D), null);
  state.journeys.push(journey(addDays(D, -2)));
  assert.equal(lapse(state, D), null, "one missed day is not a lapse");
  state.rests.push(D);
  assert.equal(lapse(state, D), null);
});

test("two or more empty days is a lapse; a chosen rest in between is not", () => {
  const state = fresh();
  state.journeys.push(journey(addDays(D, -3)));
  assert.deepEqual(lapse(state, D), { since: addDays(D, -3), gap: 2 });
  state.rests.push(addDays(D, -1));
  assert.equal(lapse(state, D), null, "rest days count as engagement");
});

test("comebacks count returns after a lapse and note whether a detour was used", () => {
  const state = fresh();
  state.journeys.push(journey("2026-10-01"), journey("2026-10-02"), journey("2026-10-06", "detour"), journey("2026-10-07"), journey("2026-10-12"));
  assert.deepEqual(comebacks(state), [
    { gap: 3, returnedOn: "2026-10-06", viaDetour: true },
    { gap: 4, returnedOn: "2026-10-12", viaDetour: false },
  ]);
});

test("week view marks detour over plain movement and ends on today", () => {
  const state = fresh();
  state.journeys.push(journey(D, "route"), journey(D, "detour"), journey(addDays(D, -1)));
  state.rests.push(addDays(D, -2));
  const w = week(state, D);
  assert.equal(w.length, 7);
  assert.deepEqual(w.slice(-3).map((d) => d.status), ["rest", "moved", "detour"]);
  assert.equal(w.at(-1).isToday, true);
});

test("stats summarise the habit without streaks", () => {
  const state = fresh();
  state.goal.daysPerWeek = 4;
  state.journeys.push(journey(addDays(D, -10)), journey(addDays(D, -1), "detour"), journey(D));
  const s = stats(state, D);
  assert.equal(s.activeThisWeek, 2);
  assert.equal(s.goal, 4);
  assert.equal(s.comebacks, 1);
  assert.equal(s.detoursCompleted, 1);
  assert.equal(s.totalMinutes, 9);
});
