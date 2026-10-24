// AI coach: writes one short, encouraging note for a detour the rule-based engine already
// chose. The model never picks activities or sees personal data; it only rewords a vetted
// library entry. Every note is checked before it reaches the person, and any failure falls
// back to the library text in the app.

import { activities, barriers } from "../dist/js/content.js";
import { REASONS } from "../dist/js/engine.js";
import en from "../dist/js/locales/en.js";

export const MODEL = process.env.REROUTE_COACH_MODEL || "claude-opus-5-5";
const LOCALES = { en: "English", ar: "Modern Standard Arabic" };

export const SYSTEM = `You write one short note inside ReRoute, a movement-break app. The app has already chosen a gentle activity because something got in the way of the person's plan. Your note helps them feel it is still worth doing.

Rules:
- One or two sentences, under 220 characters in total.
- Warm, plain and specific to the barrier and the activity. No exclamation marks, no emoji.
- Never mention health conditions, symptoms, diagnoses, treatment, weight, calories, or medical benefits, and never give medical advice.
- Never imply guilt, failure or obligation. Rest is always a fine choice.
- If you mention a duration, use exactly the activity's minutes. Use no other numbers.
- Do not add steps that aren't in the activity description.
- Write in the requested language only.`;

export const NOTE_SCHEMA = {
  type: "object",
  properties: { note: { type: "string", description: "The note shown to the person." } },
  required: ["note"],
  additionalProperties: false,
};

const hourBucket = (hour) => (hour < 5 ? "night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night");

// Only allowlisted identifiers get through; there is no free text from the person.
export function validateRequest(body) {
  if (!body || typeof body !== "object") return null;
  const { barrier, activity, reasons = [], hour, locale = "en" } = body;
  if (!barriers.some((b) => b.id === barrier)) return null;
  if (!Object.hasOwn(activities, activity)) return null;
  if (!Array.isArray(reasons) || reasons.length > 3 || !reasons.every((r) => REASONS.includes(r))) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Object.hasOwn(LOCALES, locale)) return null;
  return { barrier, activity, reasons, time: hourBucket(hour), locale };
}

export function buildPrompt({ barrier, activity, reasons, time, locale }) {
  const a = activities[activity];
  return [
    `Language: ${LOCALES[locale]}`,
    `What got in the way: ${en[`barrier.${barrier}`]}`,
    `Time of day: ${time}`,
    `Activity: ${en[`act.${activity}.name`]} (${a.minutes} min, ${a.setting}, ${a.intensity})`,
    `Activity description: ${en[`act.${activity}.desc`]}`,
    `Why the app chose it: ${reasons.map((r) => en[`reason.${r}`]).join(" ") || "It fits the barrier."}`,
  ].join("\n");
}

const BANNED = {
  en: /\b(diagnos|cure|treat|therap|symptom|disease|illness|calorie|weight|burn|fat\b|doctor|medic|prescri|injur|pain|lazy|fail|guilt|should have|must|guarantee|heal)/i,
  ar: /(تشخيص|علاج|طبيب|دواء|مرض|أعراض|سعرات|وزن|دهون|حرق|كسول|فشل|ذنب|يجب|ألم|إصابة)/,
};
const ARABIC = /[؀-ۿ]/;
const DIGITS = /[0-9٠-٩]+/g;
const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

// Returns null when the note is acceptable, otherwise a short reason for the server log.
export function checkNote(note, { activity, locale }) {
  if (typeof note !== "string") return "not a string";
  const text = note.trim();
  if (text.length < 20 || text.length > 280) return "length";
  if ((text.match(/[.!?؟]/g) || []).length > 3) return "too many sentences";
  if (/https?:|www\.|[<>{}]/i.test(text)) return "markup or link";
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return "emoji";
  if (BANNED.en.test(text) || BANNED.ar.test(text)) return "banned term";
  if (locale === "ar" ? !ARABIC.test(text) : ARABIC.test(text)) return "wrong language";
  const minutes = String(activities[activity].minutes);
  if ((text.match(DIGITS) || []).some((n) => toLatin(n) !== minutes)) return "unexpected number";
  return null;
}

// createCoach({ client }) → { available, note(body) }. The client is an Anthropic SDK
// instance (or a test double with the same beta.messages.create shape).
export function createCoach({ client, log = console } = {}) {
  const cache = new Map();

  async function ask(request) {
    const response = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 2048,
        // Server-side fallback lets another model answer if a safety classifier declines.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM,
        output_config: { effort: "low", format: { type: "json_schema", schema: NOTE_SCHEMA } },
        messages: [{ role: "user", content: buildPrompt(request) }],
      },
      { timeout: 15000, maxRetries: 1 },
    );
    if (response.stop_reason !== "end_turn") {
      log.warn?.(`coach: stop_reason ${response.stop_reason}`);
      return null;
    }
    const text = response.content.find((block) => block.type === "text")?.text;
    try {
      return JSON.parse(text).note?.trim() ?? null;
    } catch {
      log.warn?.("coach: response was not valid JSON");
      return null;
    }
  }

  return {
    available: !!client,
    async note(body) {
      const request = validateRequest(body);
      if (!request) return { status: 400, body: { error: "invalid request" } };
      if (!client) return { status: 503, body: { error: "coach unavailable" } };
      const key = JSON.stringify(request);
      if (cache.has(key)) return { status: 200, body: { note: cache.get(key), source: "ai", cached: true } };
      let note = null;
      try {
        note = await ask(request);
      } catch (error) {
        log.warn?.(`coach: ${error.status ?? ""} ${error.name}: ${error.message}`);
        return { status: 502, body: { error: "coach failed" } };
      }
      const problem = checkNote(note, request);
      if (problem) {
        log.warn?.(`coach: rejected note (${problem})`);
        return { status: 422, body: { error: "note rejected" } };
      }
      if (cache.size > 500) cache.clear();
      cache.set(key, note);
      return { status: 200, body: { note, source: "ai", model: MODEL } };
    },
  };
}

// Load the SDK only when a credential is configured, so the server runs without it.
export async function createDefaultCoach(log = console) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return createCoach({ client: null, log });
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return createCoach({ client: new Anthropic(), log });
  } catch (error) {
    log.warn?.(`coach: @anthropic-ai/sdk not installed (${error.message}); run npm install to enable AI notes`);
    return createCoach({ client: null, log });
  }
}
