// Pilot event intake. Events are pseudonymous: a random participant id generated on the
// device, a cohort code, dates, and ids from the content tables. Anything else is dropped.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { activities, barriers, routes } from "../dist/js/content.js";
import { isDateKey } from "../dist/js/habit.js";

const TYPES = new Set(["join", "leave", "start", "journey", "rest", "offer"]);
const known = (id) => Object.hasOwn(activities, id) || Object.hasOwn(routes, id);
const barrierIds = new Set(barriers.map((b) => b.id));

// Returns a clean copy of the event, or null if anything is malformed.
export function cleanEvent(e) {
  if (!e || typeof e !== "object") return null;
  if (typeof e.participant !== "string" || !/^[A-Za-z0-9-]{8,40}$/.test(e.participant)) return null;
  if (typeof e.cohort !== "string" || !/^[a-z0-9-]{4,24}$/.test(e.cohort)) return null;
  if (!TYPES.has(e.type) || !isDateKey(e.date)) return null;
  const out = { participant: e.participant, cohort: e.cohort, type: e.type, date: e.date };
  if (e.barrier != null) {
    if (!barrierIds.has(e.barrier)) return null;
    out.barrier = e.barrier;
  }
  if (e.type === "join" && Number.isInteger(e.goal) && e.goal >= 1 && e.goal <= 7) out.goal = e.goal;
  if (e.type === "start" || e.type === "journey") {
    if (!known(e.activity) || (e.kind !== "route" && e.kind !== "detour")) return null;
    out.activity = e.activity;
    out.kind = e.kind;
  }
  if (e.type === "journey") {
    if (!Number.isInteger(e.minutes) || e.minutes < 0 || e.minutes > 60) return null;
    out.minutes = e.minutes;
    out.simulated = e.simulated === true;
  }
  if (e.type === "offer") {
    if (!out.barrier || !Array.isArray(e.activities) || e.activities.length > 5 || !e.activities.every((a) => Object.hasOwn(activities, a))) return null;
    out.activities = e.activities;
  }
  return out;
}

export function createPilotStore(file) {
  return {
    async append(events) {
      const clean = events.map(cleanEvent).filter(Boolean);
      if (clean.length) {
        await mkdir(dirname(file), { recursive: true });
        await appendFile(file, clean.map((e) => JSON.stringify({ ...e, received: new Date().toISOString() })).join("\n") + "\n");
      }
      return { accepted: clean.length, rejected: events.length - clean.length };
    },
    async all() {
      let text = "";
      try {
        text = await readFile(file, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
      return text
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          try {
            return cleanEvent(JSON.parse(line));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    },
  };
}
