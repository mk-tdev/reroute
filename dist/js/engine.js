// Detour recommender. Given what got in the way, the moment's context, the person's own
// if-then plans, and how past detours went, rank feasible options and explain each one.
// Deterministic and rule-based on purpose: every suggestion can be traced to a reason.

import { activities } from "./content.js";

// Reason codes are stable identifiers; the interface turns them into localized sentences.
// Ordered most specific first; that order decides which reasons are shown.
export const REASONS = [
  "yourPlan",
  "workedBefore",
  "heatIndoor",
  "weatherIndoor",
  "lowEnergyGentle",
  "lateGentle",
  "shortest",
  "morningLight",
  "somethingNew",
  "fitsBarrier",
];

const OUTDOOR_UNSUITABLE = (weather) => weather && (weather.raining || weather.hot || weather.cold);

// Per-activity history: how often it was offered, started, and completed.
export function history(offers = []) {
  const byActivity = {};
  for (const offer of offers) {
    const h = (byActivity[offer.activity] ??= { offered: 0, accepted: 0, completed: 0, lastDeclined: null });
    h.offered++;
    if (offer.accepted) h.accepted++;
    if (offer.completed) h.completed++;
    if (!offer.accepted) h.lastDeclined = offer.date;
  }
  return byActivity;
}

// Laplace-smoothed completion rate: an untried option starts at 0.5.
const successRate = (h) => ((h?.completed ?? 0) + 1) / ((h?.offered ?? 0) + 2);

export function score(activity, { barrier, context = {}, plans = {}, past = {}, today }) {
  const reasons = [];
  let points = 10;
  const h = past[activity.id];

  if (plans[barrier] === activity.id) {
    points += 100;
    reasons.push("yourPlan");
  }

  // Personal evidence outweighs generic fit once there is some.
  const rate = successRate(h);
  points += 40 * (rate - 0.5);
  if (h?.completed >= 1) reasons.push("workedBefore");
  if (h?.lastDeclined && today && h.lastDeclined === today) points -= 25;
  if (!h) {
    points += 3;
    reasons.push("somethingNew");
  }

  const { weather, hour } = context;
  if (activity.setting === "outdoor" && OUTDOOR_UNSUITABLE(weather)) {
    points -= 60;
  } else if (activity.setting !== "outdoor" && OUTDOOR_UNSUITABLE(weather)) {
    points += 8;
    reasons.push(weather.hot ? "heatIndoor" : "weatherIndoor");
  }
  if (Number.isInteger(hour) && (hour >= 21 || hour < 6)) {
    if (activity.intensity === "gentle") {
      points += 6;
      reasons.push("lateGentle");
    } else points -= 6;
  }
  if (Number.isInteger(hour) && hour >= 6 && hour < 10 && activity.setting === "outdoor" && !OUTDOOR_UNSUITABLE(weather)) {
    points += 5;
    reasons.push("morningLight");
  }
  if (barrier === "energy" && activity.intensity === "gentle") {
    points += 8;
    reasons.push("lowEnergyGentle");
  }
  if (barrier === "time") points -= activity.minutes * 2;

  reasons.push("fitsBarrier");
  return { activity, score: Math.round(points * 10) / 10, reasons };
}

// Top `limit` detours for this barrier, best first. Ties break on shorter, then id, so the
// output is stable for the same inputs.
export function recommend({ barrier, context = {}, plans = {}, offers = [], today, limit = 3 }) {
  const past = history(offers);
  const ranked = Object.values(activities)
    .filter((a) => a.barriers.includes(barrier) || plans[barrier] === a.id)
    .map((a) => score(a, { barrier, context, plans, past, today }))
    .sort((a, b) => b.score - a.score || a.activity.minutes - b.activity.minutes || a.activity.id.localeCompare(b.activity.id));
  const top = ranked.slice(0, limit);
  const shortest = Math.min(...top.map((r) => r.activity.minutes));
  for (const r of top) if (r.activity.minutes === shortest && barrier === "time") r.reasons.unshift("shortest");
  // Keep the explanation short: at most two reasons, most specific first.
  for (const r of top) r.reasons = [...new Set(r.reasons)].sort((a, b) => REASONS.indexOf(a) - REASONS.indexOf(b)).slice(0, 2);
  return top;
}

// Plan choices offered during onboarding: the options that fit each barrier.
export const planOptions = (barrier) =>
  Object.values(activities)
    .filter((a) => a.barriers.includes(barrier))
    .sort((a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id));
