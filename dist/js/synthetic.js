// A synthetic pilot cohort for demonstrating the dashboard. Generated from a fixed seed so
// every reviewer sees the same numbers. It is NOT participant data and shows nothing about
// whether ReRoute works; it exists to exercise the measures end to end.

import { addDays } from "./habit.js";
import { barriers } from "./content.js";
import { recommend } from "./engine.js";

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SYNTHETIC_COHORT = "synthetic-demo";

export function syntheticEvents({ people = 48, start = "2026-09-01", days = 35, seed = 2026 } = {}) {
  const random = mulberry32(seed);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const events = [];
  const end = addDays(start, days - 1);
  for (let i = 0; i < people; i++) {
    const participant = `syn-${String(i + 1).padStart(3, "0")}`;
    const joined = addDays(start, Math.floor(random() * 7));
    const goal = pick([2, 3, 3, 4, 5]);
    const drive = 0.3 + random() * 0.45; // chance of moving on a given day
    const dropAfter = random() < 0.2 ? 7 + Math.floor(random() * 14) : Infinity;
    const base = { participant, cohort: SYNTHETIC_COHORT };
    events.push({ ...base, type: "join", date: joined, goal });
    let breakLeft = 0;
    for (let d = 0; d < days; d++) {
      const date = addDays(joined, d);
      if (date > end || d > dropAfter) break;
      if (breakLeft > 0) {
        breakLeft--;
        continue;
      }
      if (random() < 0.06) {
        breakLeft = 2 + Math.floor(random() * 5); // life happens: a multi-day gap
        continue;
      }
      if (random() < 0.08) {
        events.push({ ...base, type: "rest", date });
        continue;
      }
      if (random() > drive) continue;
      if (random() < 0.35) {
        const barrier = pick(barriers).id;
        const recs = recommend({ barrier, context: { hour: 8 + Math.floor(random() * 12) } });
        events.push({ ...base, type: "offer", date, barrier, activities: recs.map((r) => r.activity.id) });
        if (random() < 0.62) {
          const chosen = recs[random() < 0.7 ? 0 : Math.min(recs.length - 1, 1)].activity;
          events.push({ ...base, type: "start", date, kind: "detour", barrier, activity: chosen.id });
          if (random() < 0.82) events.push({ ...base, type: "journey", date, kind: "detour", barrier, activity: chosen.id, minutes: chosen.minutes, simulated: false });
        }
      } else {
        const route = pick(["scenic", "short", "together", "grove", "cove"]);
        events.push({ ...base, type: "start", date, kind: "route", activity: route });
        events.push({ ...base, type: "journey", date, kind: "route", activity: route, minutes: 5, simulated: false });
      }
    }
  }
  return { events, end };
}
