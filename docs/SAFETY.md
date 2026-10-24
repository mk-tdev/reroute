# Responsible AI, safety and data governance

## Where AI is and isn't used

| Decision | Made by | Why |
| --- | --- | --- |
| Which detours are suggested, in what order | **Rule-based engine** (`dist/js/engine.js`) | Deterministic, testable, and every suggestion carries a human-readable reason. |
| What each activity asks the person to do | **Fixed library** (`dist/js/content.js`, text in `locales/`) | Draft content written to be gentle and low-intensity; must be reviewed by a qualified professional before any pilot. |
| A one- or two-sentence encouraging note on the top detour | **Claude** (`server/coach.mjs`), optional and off by default | Adds warmth and context-specific wording. It never chooses activities, adds steps, or gives advice. |

If the AI is off, unavailable, slow, refuses, or produces anything that fails the checks, the person sees the library text instead. The app works without AI.

## Guardrails on the AI note

1. **No personal data in.** The browser sends only allowlisted identifiers: a barrier id, an activity id, up to three reason codes, the hour (0–23), and the language. The server converts the hour into a coarse time of day before prompting. There is no free-text input anywhere in the app, so there is no prompt-injection path.
2. **Constrained output.** The request uses structured outputs (JSON schema with a single `note` string) and a system prompt that forbids medical content, guilt, obligation, invented steps, and any number except the activity's minutes.
3. **Checked before display.** Every note is rejected unless it is 20–280 characters, at most three sentences, in the requested script, free of links and emoji, contains no number other than the activity duration, and has no banned terms (diagnosis, treatment, weight, calories, pain, "must", "fail", and Arabic equivalents).
4. **Refusals are handled.** The request enables the API's server-side fallback; if the final response is still a refusal (or anything other than a normal end), no note is shown.
5. **Bounded cost and abuse.** 30 coach requests per minute per address, a 2 KB request limit, a 15-second timeout, one retry, and a cache keyed on the (non-personal) request.
6. **Disclosed.** Notes are labelled "Written by AI from a reviewed activity. Not medical advice."

Tests: `tests/coach.test.mjs` covers input validation, prompt contents, every rejection rule, refusal and error handling, caching, and the request parameters.

Model: `claude-opus-5-5` by default (override with `REROUTE_COACH_MODEL`). A production deployment should run an evaluation set of barrier × activity × time × language combinations, reviewed by the content professional, before enabling notes for participants.

## Data the app handles

| Data | Where it lives | Who can see it | How to remove it |
| --- | --- | --- | --- |
| Journeys, rest days, plans, settings, detour offers | `localStorage` on the device | Only the person | *Privacy → Delete everything*, or clear site data |
| Approximate location (if weather is on) | Sent to Open-Meteo, rounded to 0.1° (~10 km); not stored by ReRoute | Open-Meteo | Turn weather off |
| Coach request (if AI notes are on) | Sent to the ReRoute server, then to Anthropic | Server operator; Anthropic per its API terms | Turn AI notes off |
| Pilot events (only after joining with a code) | `data/events.jsonl` on the pilot server | Pilot organiser, as aggregates | *Leave the pilot*; operator deletes by participant id on request |

Pilot events contain a random participant id generated on the device, a cohort code, dates, and ids from the content tables. The server rejects any event with other shapes and stores only known fields. Nothing is sent while demo tools have shifted the island's clock. The dashboard suppresses any group smaller than five participants (or five offers) and excludes simulated journeys.

People can download everything stored about them on the device (*Privacy → Download my data*).

## Safety boundaries

- ReRoute suggests short, low-intensity movement. It does not assess fitness or health, and it tells people to stop or rest whenever they need.
- The About sheet advises checking with a health professional if a condition affects how someone moves.
- No employer monitoring: an organiser sees only cohort-level aggregates, never individual records, in the dashboard.

## Before a real pilot

- Professional review of every activity in English and Arabic, with suitability notes (pregnancy, mobility limits, heat).
- Native-speaker review of the Arabic strings.
- Ethics review, consent text, and a data-processing agreement covering the pilot server and Anthropic.
- Set `PILOT_ADMIN_TOKEN`, serve over HTTPS, and define a retention period for `data/events.jsonl`.
- Accessibility audit with screen-reader users (VoiceOver, TalkBack) in both languages.
