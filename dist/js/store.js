// Persisted state for one person on one device. Everything stays in localStorage unless
// the person joins a pilot (see telemetry.js), and they can export or delete it at any time.

import { routes, activities, barriers, legacyDetours, isActivity, isRoute } from "./content.js";
import { addDays, dateKey, isDateKey } from "./habit.js";

export const KEY = "reroute-world-v3";
export const LEGACY_KEY = "reroute-world-v2";

export const fresh = () => ({
  version: 3,
  onboarded: false,
  goal: { daysPerWeek: 3 },
  plans: {}, // barrier id → activity id: "If <barrier>, then I'll <activity>"
  journeys: [], // { id, kind: "route" | "detour", date, minutes, simulated, barrier? }
  rests: [], // date keys
  offers: [], // { date, barrier, activity, rank, accepted, completed }
  session: null, // active timer
  settings: { sound: false, ai: false, weather: false, locale: null },
  pilot: null, // { participant, cohort, joinedOn } once the person opts in
  demoOffset: 0, // days a reviewer has skipped ahead in demo mode
  welcomedBackOn: null,
});

const knownJourney = (id) => isRoute(id) || isActivity(id);
const validBarrier = (id) => barriers.some((b) => b.id === id);

// Bring a v2 save (numbered demo days, four fixed detours) forward. Demo day N becomes a
// real date counted back from today so the most recent day lands on today.
export function migrateV2(raw, now = new Date()) {
  const state = fresh();
  const lastDay = Math.max(raw.day || 1, ...raw.journeys.map((j) => j.day || 1));
  const toDate = (day) => addDays(dateKey(now), (day || 1) - lastDay);
  state.journeys = raw.journeys
    .map((j) => {
      const id = legacyDetours[j.id] ?? j.id;
      if (!knownJourney(id)) return null;
      const kind = isActivity(id) ? "detour" : "route";
      return { id, kind, date: toDate(j.day), minutes: j.minutes ?? (routes[id] ?? activities[id]).minutes, simulated: !!j.simulated };
    })
    .filter(Boolean);
  state.rests = (raw.rests || []).map(toDate);
  state.settings.sound = !!raw.sound;
  // Anyone with v2 history has already seen the island; ask about plans on next open.
  state.onboarded = false;
  return state;
}

// Accept only well-formed records, so a corrupted or hand-edited save can't break the app.
export function sanitize(raw) {
  const state = fresh();
  if (!raw || typeof raw !== "object") return state;
  if (raw.goal && Number.isInteger(raw.goal.daysPerWeek) && raw.goal.daysPerWeek >= 1 && raw.goal.daysPerWeek <= 7) {
    state.goal.daysPerWeek = raw.goal.daysPerWeek;
  }
  for (const [barrier, activity] of Object.entries(raw.plans || {})) {
    if (validBarrier(barrier) && isActivity(activity)) state.plans[barrier] = activity;
  }
  state.journeys = (raw.journeys || []).filter(
    (j) => j && knownJourney(j.id) && isDateKey(j.date) && (j.kind === "route" || j.kind === "detour"),
  );
  state.rests = [...new Set((raw.rests || []).filter(isDateKey))];
  state.offers = (raw.offers || [])
    .filter((o) => o && isDateKey(o.date) && validBarrier(o.barrier) && isActivity(o.activity))
    .slice(-200);
  if (raw.session && knownJourney(raw.session.id)) state.session = raw.session;
  const s = raw.settings || {};
  state.settings = { sound: !!s.sound, ai: !!s.ai, weather: !!s.weather, locale: typeof s.locale === "string" ? s.locale : null };
  if (raw.pilot && typeof raw.pilot.participant === "string") state.pilot = raw.pilot;
  state.onboarded = !!raw.onboarded;
  state.demoOffset = Number.isInteger(raw.demoOffset) && raw.demoOffset >= 0 ? raw.demoOffset : 0;
  state.welcomedBackOn = isDateKey(raw.welcomedBackOn) ? raw.welcomedBackOn : null;
  return state;
}

export function load(storage = globalThis.localStorage, now = new Date()) {
  try {
    const current = storage.getItem(KEY);
    if (current) return sanitize(JSON.parse(current));
    const legacy = JSON.parse(storage.getItem(LEGACY_KEY));
    if (legacy && Array.isArray(legacy.journeys) && Array.isArray(legacy.rests)) return sanitize(migrateV2(legacy, now));
  } catch {}
  return fresh();
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function erase(storage = globalThis.localStorage) {
  try {
    storage.removeItem(KEY);
    storage.removeItem(LEGACY_KEY);
  } catch {}
}
