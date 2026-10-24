// Optional network helpers. Each one is opt-in, times out quickly, and returns null on any
// failure so the app keeps working offline or without a server.

const withTimeout = (ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
};

async function getJson(url, options = {}, ms = 6000) {
  const t = withTimeout(ms);
  try {
    const response = await fetch(url, { ...options, signal: t.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    t.done();
  }
}

// ---- Server capabilities -------------------------------------------------------------
// The static build has no /api; the Node server (server/index.mjs) adds coach and pilot.
let capabilities;
export async function serverCapabilities() {
  capabilities ??= getJson("api/health", {}, 2500).then((r) => ({ ai: !!r?.ai, pilot: !!r?.pilot }));
  return capabilities;
}

// ---- Weather (Open-Meteo, no key) -----------------------------------------------------
// Coordinates are rounded to 0.1° (about 10 km) before leaving the device. Cached for an hour.
const WEATHER_TTL = 60 * 60 * 1000;
let weatherCache = null;

export function classifyWeather({ temperature, precipitation, code }) {
  return {
    temperature,
    raining: precipitation > 0.1 || (code >= 51 && code <= 99),
    hot: temperature >= 32,
    cold: temperature <= 5,
  };
}

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { maximumAge: WEATHER_TTL, timeout: 8000 });
  });
}

// Returns { weather } on success, or { error: "denied" | "failed" }.
export async function localWeather() {
  if (weatherCache && Date.now() - weatherCache.at < WEATHER_TTL) return { weather: weatherCache.weather };
  let coords;
  try {
    coords = (await position()).coords;
  } catch {
    return { error: "denied" };
  }
  const lat = coords.latitude.toFixed(1);
  const lon = coords.longitude.toFixed(1);
  const data = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,weather_code`,
  );
  if (!data?.current) return { error: "failed" };
  const weather = classifyWeather({
    temperature: data.current.temperature_2m,
    precipitation: data.current.precipitation,
    code: data.current.weather_code,
  });
  weatherCache = { at: Date.now(), weather };
  return { weather };
}

// ---- AI coach ------------------------------------------------------------------------
// Only identifiers and the hour are sent; the server owns the prompt and validates output.
export async function coachNote({ barrier, activity, reasons, hour, locale }) {
  const result = await getJson(
    "api/coach",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ barrier, activity, reasons, hour, locale }),
    },
    12000,
  );
  if (!result || typeof result.note !== "string" || !result.note.trim() || result.note.length > 320) return null;
  return result.note.trim();
}

// ---- Pilot telemetry -----------------------------------------------------------------
// Pseudonymous events, only after the person joins with a pilot code. Failed sends are
// queued locally and retried on the next event; nothing is sent after leaving.
const QUEUE_KEY = "reroute-pilot-queue";

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
};
const writeQueue = (queue) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-500)));
  } catch {}
};

export const validPilotCode = (code) => /^[A-Za-z0-9-]{4,24}$/.test(code);
export const newParticipantId = () =>
  crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export async function sendPilotEvent(pilot, event) {
  if (!pilot) return;
  const queue = [...readQueue(), { ...event, participant: pilot.participant, cohort: pilot.cohort }];
  const ok = await getJson("api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: queue }),
  });
  writeQueue(ok?.accepted >= 0 ? [] : queue);
}

export const clearPilotQueue = () => writeQueue([]);
