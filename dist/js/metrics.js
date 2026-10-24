// Pilot measures computed from pseudonymous events. Pure and shared by the Node server and
// the dashboard. Definitions follow docs/PILOT.md; simulated journeys never count.
//
// Event shape (validated server-side):
//   { participant, cohort, type: join|leave|start|journey|rest|offer, date: "YYYY-MM-DD",
//     goal?, activity?, activities?, kind?, barrier?, minutes?, simulated? }

import { addDays, daysBetween, LAPSE_DAYS } from "./habit.js";

export const MIN_CELL = 5; // groups smaller than this are suppressed to protect privacy
const WEEKS = 4;

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const rate = (num, den) => (den ? num / den : null);

function participants(events) {
  const people = new Map();
  for (const e of events) {
    const p = people.get(e.participant) ?? { id: e.participant, goal: 3, joined: e.date, active: new Set(), rests: new Set(), left: null };
    if (e.date < p.joined) p.joined = e.date;
    if (e.type === "join" && Number.isInteger(e.goal)) p.goal = e.goal;
    if (e.type === "journey" && !e.simulated) p.active.add(e.date);
    if (e.type === "rest") p.rests.add(e.date);
    if (e.type === "leave") p.left = e.date;
    people.set(e.participant, p);
  }
  return [...people.values()];
}

// Lapses for one person: runs of LAPSE_DAYS+ days with no movement and no chosen rest.
// A lapse is "returned" if movement follows; "open" if the window ends first.
function lapses(p, end) {
  const engaged = [...new Set([...p.active, ...p.rests])].sort();
  const result = [];
  for (let i = 0; i < engaged.length; i++) {
    const next = engaged[i + 1] ?? null;
    const gap = daysBetween(engaged[i], next ?? addDays(end, 1)) - 1;
    if (gap < LAPSE_DAYS) continue;
    if (next && p.active.has(next)) result.push({ start: addDays(engaged[i], 1), returned: true, daysToReturn: gap + 1 });
    else if (!next && !p.left) result.push({ start: addDays(engaged[i], 1), returned: false, observed: daysBetween(engaged[i], end) });
  }
  return result;
}

export function computeMetrics(events, { cohort = null, end = null, minCell = MIN_CELL } = {}) {
  const scoped = events.filter((e) => !cohort || e.cohort === cohort);
  const simulated = scoped.filter((e) => e.type === "journey" && e.simulated).length;
  const real = scoped.filter((e) => !(e.type === "journey" && e.simulated));
  const people = participants(real);
  const last = end ?? real.reduce((max, e) => (e.date > max ? e.date : max), "0000-00-00");
  const base = { cohort, participants: people.length, end: last, simulatedExcluded: simulated, minCell };
  if (people.length < minCell) return { ...base, suppressed: true };

  // Persistence: completed participant-weeks where active days met the person's goal.
  const weekly = Array.from({ length: WEEKS }, (_, w) => ({ week: w + 1, eligible: 0, metGoal: 0, engaged: 0, activeDays: 0 }));
  for (const p of people) {
    for (let w = 0; w < WEEKS; w++) {
      const from = addDays(p.joined, w * 7);
      const to = addDays(from, 6);
      if (to > last || (p.left && from > p.left)) continue;
      const days = [...p.active].filter((d) => d >= from && d <= to).length;
      const rows = weekly[w];
      rows.eligible++;
      rows.activeDays += days;
      if (days >= p.goal) rows.metGoal++;
      if (days || [...p.rests].some((d) => d >= from && d <= to)) rows.engaged++;
    }
  }
  const eligibleWeeks = weekly.reduce((s, w) => s + w.eligible, 0);
  const metWeeks = weekly.reduce((s, w) => s + w.metGoal, 0);

  // Recovery after lapse: returned within 7 days, among lapses observed for 7+ days.
  const all = people.flatMap((p) => lapses(p, last));
  const returnedTimes = all.filter((l) => l.returned).map((l) => l.daysToReturn);
  const observable = all.filter((l) => l.returned || l.observed >= 7);
  const back7 = observable.filter((l) => l.returned && l.daysToReturn <= 7).length;

  // Detour usefulness: offered → started → completed, per barrier.
  const byBarrier = {};
  for (const e of real) {
    if (!e.barrier) continue;
    const b = (byBarrier[e.barrier] ??= { barrier: e.barrier, offered: 0, started: 0, completed: 0 });
    if (e.type === "offer") b.offered++;
    if (e.type === "start" && e.kind === "detour") b.started++;
    if (e.type === "journey" && e.kind === "detour") b.completed++;
  }
  const barriers = Object.values(byBarrier)
    .map((b) => (b.offered < minCell ? { barrier: b.barrier, suppressed: true } : { ...b, acceptance: rate(b.started, b.offered), completion: rate(b.completed, b.started) }))
    .sort((a, b) => (b.offered ?? 0) - (a.offered ?? 0));
  const totals = Object.values(byBarrier).reduce((s, b) => ({ offered: s.offered + b.offered, started: s.started + b.started, completed: s.completed + b.completed }), { offered: 0, started: 0, completed: 0 });

  // Retention: engaged in week 2 / week 4, among people observed through that week.
  const retention = [2, 4].map((week) => {
    const row = weekly[week - 1];
    return { week, eligible: row.eligible, retained: row.engaged, rate: row.eligible >= minCell ? rate(row.engaged, row.eligible) : null };
  });

  return {
    ...base,
    suppressed: false,
    persistence: { eligibleWeeks, metGoal: metWeeks, rate: rate(metWeeks, eligibleWeeks) },
    recovery: {
      lapses: all.length,
      returned: returnedTimes.length,
      medianDaysToReturn: median(returnedTimes),
      within7: back7,
      observable: observable.length,
      rate: observable.length >= minCell ? rate(back7, observable.length) : null,
    },
    detours: { ...totals, acceptance: rate(totals.started, totals.offered), completion: rate(totals.completed, totals.started), byBarrier: barriers },
    retention,
    weekly: weekly.map((w) => ({ ...w, meanActiveDays: w.eligible ? w.activeDays / w.eligible : null, metGoalRate: w.eligible >= minCell ? rate(w.metGoal, w.eligible) : null })),
  };
}
