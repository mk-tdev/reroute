// Calendar-day habit logic. Pure functions over the persisted state so they can be tested
// without a browser. Dates are local "YYYY-MM-DD" keys; arithmetic happens at UTC noon to
// stay clear of daylight-saving edges.

export const LAPSE_DAYS = 2; // this many days with no activity and no chosen rest counts as a lapse

const toUtcNoon = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
};
const fromUtc = (ms) => new Date(ms).toISOString().slice(0, 10);

export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export const addDays = (key, n) => fromUtc(toUtcNoon(key) + n * 86400000);
export const daysBetween = (from, to) => Math.round((toUtcNoon(to) - toUtcNoon(from)) / 86400000);
export const isDateKey = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// "Today" for the app: the real local date plus any demo offset the reviewer has applied.
export const today = (state, now = new Date()) => addDays(dateKey(now), state.demoOffset || 0);

export const journeysOn = (state, date) => state.journeys.filter((j) => j.date === date);
export const movedOn = (state, date) => state.journeys.some((j) => j.date === date);
export const restedOn = (state, date) => state.rests.includes(date);

// Most recent date the person engaged at all: a journey or a deliberately chosen rest.
export function lastEngaged(state, before) {
  let latest = null;
  for (const date of [...state.journeys.map((j) => j.date), ...state.rests]) {
    if (date < before && (!latest || date > latest)) latest = date;
  }
  return latest;
}

// A lapse is a gap of LAPSE_DAYS or more days with neither movement nor chosen rest.
// Returns null when there's no history yet or the person is already back today.
export function lapse(state, date) {
  if (movedOn(state, date) || restedOn(state, date)) return null;
  const last = lastEngaged(state, date);
  if (!last) return null;
  const gap = daysBetween(last, date) - 1;
  return gap >= LAPSE_DAYS ? { since: last, gap } : null;
}

// Every return after a lapse, in date order: { gap, returnedOn, viaDetour }.
export function comebacks(state) {
  const engaged = [...new Set([...state.journeys.map((j) => j.date), ...state.rests])].sort();
  const result = [];
  for (let i = 1; i < engaged.length; i++) {
    const gap = daysBetween(engaged[i - 1], engaged[i]) - 1;
    const returned = engaged[i];
    const moved = journeysOn(state, returned);
    if (gap >= LAPSE_DAYS && moved.length) {
      result.push({ gap, returnedOn: returned, viaDetour: moved.some((j) => j.kind === "detour") });
    }
  }
  return result;
}

// Seven days ending today, oldest first, each marked moved / detour / rest / none / future.
export function week(state, date) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(date, i - 6);
    const moved = journeysOn(state, day);
    const status = moved.some((j) => j.kind === "detour")
      ? "detour"
      : moved.length
        ? "moved"
        : restedOn(state, day)
          ? "rest"
          : "none";
    return { date: day, status, isToday: day === date };
  });
}

export function stats(state, date) {
  const recent = week(state, date);
  const activeThisWeek = recent.filter((d) => d.status === "moved" || d.status === "detour").length;
  const back = comebacks(state);
  return {
    activeThisWeek,
    goal: state.goal?.daysPerWeek ?? 3,
    detoursCompleted: state.journeys.filter((j) => j.kind === "detour").length,
    comebacks: back.length,
    totalMinutes: state.journeys.reduce((sum, j) => sum + (j.minutes || 0), 0),
    activeDays: new Set(state.journeys.map((j) => j.date)).size,
    waysFound: new Set(state.journeys.map((j) => j.id)).size,
    week: recent,
  };
}
