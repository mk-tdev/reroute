# Pilot protocol (proposed)

**Status: not yet run.** This is the plan the software is built to support. Nothing here is a result.

## Question

Does helping people adapt a movement plan when something gets in the way (detours, if-then plans) and welcoming them back after a break (no streak reset) improve **return after a lapse** compared with a fixed-plan version of the same app?

## Design

- **Setting:** an opt-in workplace or community wellbeing programme. Participation is voluntary; the organiser sees only aggregates.
- **Participants:** adults who want manageable movement breaks around busy routines. Exclusions and suitability guidance to be set with the reviewing professional.
- **Arms:** ReRoute as built, compared with a fixed-plan variant (same island, routes and timer, but no detour suggestions, no if-then plans, and no welcome-back flow). Allocation by cohort code.
- **Duration:** 4 weeks per participant, plus a short baseline questionnaire.
- **Sample:** a feasibility pilot (for example, 40–60 people per arm) to estimate variance and recruitment, not to prove efficacy.

## Measures (as implemented in `dist/js/metrics.js`)

| Measure | Definition | Role |
| --- | --- | --- |
| **Return within 7 days of a lapse** | A lapse is 2+ days with no movement and no chosen rest. Among lapses observed for at least 7 days, the share followed by movement within 7 days. Also: median days to return. | **Primary** |
| Weeks meeting own goal | Completed participant-weeks with active days ≥ the participant's weekly goal. | Secondary |
| Detour acceptance and completion | Detours started ÷ offers; detours finished ÷ started, overall and per barrier. | Process |
| Retention | Any movement or chosen rest in week 2 and in week 4, among those observed through that week. | Secondary |
| Experience | Usability (SUS), perceived pressure, and an open question on barriers, collected by questionnaire outside the app. | Secondary |

Rules fixed before enrolment:

- Simulated ("preview completion") journeys and demo-shifted days are excluded at the source.
- Denominators are reported for every rate; groups under five are suppressed.
- Participants who leave stop contributing from the day they leave; their earlier events remain unless they ask for deletion.
- Missing questionnaires are reported, not imputed.
- Report uncertainty, dropouts and any adverse experiences alongside positive results.

## Limitations to state up front

- Activity is self-reported. A later phase could compare against device step counts with explicit consent.
- Lapses are inferred from app use; someone may be active without logging it.
- A four-week feasibility pilot cannot show long-term habit formation.

## Running it with this repository

```sh
npm install
PILOT_ADMIN_TOKEN=<choose one> ANTHROPIC_API_KEY=<optional> npm start
```

Participants open the app, choose *Menu → Join a pilot study*, and enter the cohort code. The organiser opens `/pilot.html`, enters the admin token, and selects the cohort. With no real participants yet, the dashboard shows a clearly labelled synthetic cohort.
