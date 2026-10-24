// ReRoute controller: connects persisted state, the habit loop, detour recommendations,
// and the island. camera.js and motion.js load first as classic scripts and expose
// islandCamera and islandMotion.

import { routes, activities, barriers, places } from "./content.js";
import { icon, icons } from "./icons.js";
import { t, num, setLocale, locale, supportedLocales } from "./i18n.js";
import * as store from "./store.js";
import * as habit from "./habit.js";
import { recommend, planOptions } from "./engine.js";
import { islandMarkup, travelPath, smallIsland } from "./scenery.js";
import * as services from "./services.js";
import {
  $,
  button,
  title,
  toggle,
  escapeHtml,
  openSheet,
  closeSheet,
  configureSheet,
  toast,
  chime,
  celebrate,
  download,
} from "./ui.js";

let state = store.load();
let selected = null; // the route or detour currently open: { id, kind, minutes, ..., barrier? }
let interval = null;
let unlocking = false;
let suggestion = 0; // increments per detour sheet so a late AI note can't land on a newer one

const save = () => store.save(state);
const today = () => habit.today(state);
const total = () => state.journeys.length;
const doneToday = () => habit.movedOn(state, today());
const bridgeFound = () => state.journeys.some((j) => j.kind === "detour");
const sound = (win) => chime(state.settings.sound, win);

// A route or library activity, normalised for the sheets and the walk.
function entry(id, barrier = null) {
  if (routes[id]) return { ...routes[id], kind: "route" };
  if (activities[id]) return { ...activities[id], kind: "detour", barrier };
  return null;
}
const nameOf = (e) => t(e.kind === "route" ? `route.${e.id}.name` : `act.${e.id}.name`);
const descOf = (e) => t(e.kind === "route" ? `route.${e.id}.desc` : `act.${e.id}.desc`);
const contextOf = (e) =>
  e.kind === "route" ? t(`route.${e.id}.context`) : `${t(`setting.${e.setting}`)} · ${t(`intensity.${e.intensity}`)}`;
const formatDate = (key, options) => new Intl.DateTimeFormat(locale() === "ar" ? "ar-AE" : "en-GB", options).format(new Date(`${key}T12:00`));

// Pilot events are pseudonymous and only sent after the person joins. Nothing is sent
// while demo tools have shifted the island's clock, so demo days never reach pilot data.
const track = (type, fields = {}) => {
  if (state.pilot && !state.demoOffset) services.sendPilotEvent(state.pilot, { type, date: today(), ...fields });
};

configureSheet({
  blocked: () => unlocking,
  onOpen: () => {
    islandMotion.stop();
    clearInterval(interval);
  },
  onClose: () => clearInterval(interval),
});

// ---- Home --------------------------------------------------------------------------

function applyStaticText() {
  document.title = t("meta.title");
  for (const el of document.querySelectorAll("[data-i18n]")) el.innerHTML = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  $("#menu").innerHTML = icon("menu");
  $("#journey-icon").innerHTML = icon("book");
  $("#moon-icon").innerHTML = icon("moon");
}

function render(reveal = -1) {
  const date = today();
  const away = habit.lapse(state, date);
  const rested = habit.restedOn(state, date);
  const mood = doneToday() ? "done" : away ? "back" : rested ? "rest" : "default";
  $("#chapter").textContent = total() ? t("chapter.wider") : t("chapter.fresh");
  $("#greeting").textContent = t(`greet.${mood}`);
  $("#subtitle").textContent = t(`sub.${mood}`);
  const hint = state.session
    ? "hint.session"
    : doneToday()
      ? total() < 4
        ? "hint.doneMore"
        : "hint.doneAll"
      : rested
        ? "hint.rest"
        : "hint.default";
  setHint(t(hint));
  renderRibbon();
  $("#sound").innerHTML = icon(state.settings.sound ? "sound" : "mute");
  $("#sound").setAttribute("aria-label", t(state.settings.sound ? "sound.off" : "sound.on"));
  $("#sound").setAttribute("aria-pressed", state.settings.sound);
  renderIsland(reveal);
}

function setHint(text) {
  $("#hint").innerHTML = `<span class="hint-dot"></span>${text}`;
}

function renderRibbon() {
  const s = habit.stats(state, today());
  const done = num(s.activeThisWeek);
  const goal = num(s.goal);
  const dots = s.week
    .map((d) => `<i class="day-dot ${d.status}${d.isToday ? " today" : ""}" title="${formatDate(d.date, { weekday: "long" })}: ${t(`day.${d.status}`)}"></i>`)
    .join("");
  $("#ribbon").innerHTML = `<span class="ribbon-dots" aria-hidden="true">${dots}</span><span>${t("ribbon.week", { done, goal })}${
    s.comebacks ? ` · <strong>${t("ribbon.comebacks", { n: s.comebacks, shown: num(s.comebacks) })}</strong>` : ""
  }</span>`;
  $("#ribbon").setAttribute("aria-label", t("ribbon.aria", { done, goal }));
}

function renderIsland(reveal) {
  $("#island").innerHTML = islandMarkup({
    total: total(),
    bridge: bridgeFound(),
    visited: new Set(state.journeys.map((j) => j.id)),
    reveal,
  });
  islandMotion.attach($("#island"));
  for (const el of $("#island").querySelectorAll("[data-route],[data-bridge]")) {
    const activate = () => (el.dataset.bridge ? bridgeSheet() : choose(el.dataset.route));
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  }
}

const walkTo = (e, finished = false) => islandMotion.walk(travelPath(e, finished), e.id);

// ---- Routes, timer, completion -------------------------------------------------------

async function choose(id) {
  if (unlocking) return;
  const route = routes[id];
  if (route?.unlock > total()) return locked(id);
  if (state.session) return showTimer();
  const destination = entry(id);
  if (!destination) return;
  selected = destination;
  sound();
  setHint(t("hint.walking"));
  if (await walkTo(destination)) {
    selected = destination;
    setHint(t("hint.arrived"));
    details();
  }
}

function details(reasons = []) {
  const r = selected;
  if (!r) return;
  const eyebrow = r.kind === "detour" ? "details.eyebrowDetour" : r.unlock ? "details.eyebrowPlace" : "details.eyebrowRoute";
  const why = reasons.length ? `<ul class="reasons">${reasons.map((code) => `<li>${t(`reason.${code}`)}</li>`).join("")}</ul>` : "";
  const actions = doneToday()
    ? `<p class="tiny">${t("details.alreadyToday")}</p>${button(t("details.tomorrow"), "close", "secondary")}${button(t("details.skipDay"), "skip-day", "quiet")}`
    : `${button(t("details.go"), "start")}${button(t("details.plansChanged"), "barriers", "secondary")}<p class="tiny">${t("details.safety")}</p>`;
  openSheet(
    `${title(t(eyebrow), nameOf(r), r.icon)}<p>${descOf(r)}</p><div class="route-meta">${icon("clock")} ${t("details.minutes", { minutes: num(r.minutes) })} <span>·</span> ${contextOf(r)}</div>${why}${actions}`,
  );
}

function start() {
  if (doneToday() || !selected) return;
  state.session = {
    id: selected.id,
    kind: selected.kind,
    barrier: selected.barrier ?? null,
    remaining: selected.minutes * 60,
    deadline: Date.now() + selected.minutes * 60000,
  };
  const offer = currentOffer(selected.id);
  if (offer) offer.accepted = true;
  save();
  track("start", { activity: selected.id, kind: selected.kind, barrier: selected.barrier ?? null });
  showTimer();
}

const currentOffer = (activity) =>
  [...state.offers].reverse().find((o) => o.date === today() && o.activity === activity && !o.completed);

function secondsLeft() {
  const s = state.session;
  return !s ? 0 : s.deadline ? Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000)) : s.remaining;
}

function showTimer() {
  if (!state.session) return;
  selected = entry(state.session.id, state.session.barrier);
  const detour = selected.kind === "detour";
  openSheet(
    `${title(t(detour ? "timer.eyebrowDetour" : "timer.eyebrow"), nameOf(selected))}<p>${t("timer.body")}</p><div class="timer-wrap"><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="74"/><circle class="progress-ring" id="ring" cx="80" cy="80" r="74"/></svg><div class="timer-digits"><span id="time" dir="ltr">00:00</span><small id="timer-label">${t("timer.pace")}</small></div></div><div class="timer-controls">${button(t(state.session.deadline ? "timer.pause" : "timer.resume"), "pause", "secondary")}${button(t("timer.done"), "finish")}</div>${button(t("details.plansChanged"), "barriers", "quiet")}${button(t("timer.preview"), "simulate", "quiet")}<p class="tiny">${t("timer.previewNote")}</p>`,
  );
  tick();
  interval = setInterval(tick, 500);
}

function tick() {
  if (!state.session || !$("#time")) return;
  const n = secondsLeft();
  $("#time").textContent = `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  $("#ring").style.strokeDashoffset = 465 * (1 - n / (selected.minutes * 60));
  if (n === 0) {
    clearInterval(interval);
    $("#timer-label").textContent = t("timer.overtime");
    $('[data-action="pause"]').disabled = true;
  }
}

function pause() {
  const s = state.session;
  if (!s) return;
  if (s.deadline) {
    s.remaining = secondsLeft();
    s.deadline = null;
  } else {
    s.deadline = Date.now() + s.remaining * 1000;
  }
  save();
  showTimer();
}

async function finish(simulated) {
  if (doneToday() || !selected || unlocking) return;
  unlocking = true;
  const date = today();
  const completed = selected;
  const previous = total();
  const newBridge = completed.kind === "detour" && !bridgeFound();
  const returning = habit.lapse(state, date);
  state.journeys.push({
    id: completed.id,
    kind: completed.kind,
    date,
    minutes: completed.minutes,
    simulated,
    ...(completed.barrier ? { barrier: completed.barrier } : {}),
  });
  const offer = currentOffer(completed.id);
  if (offer) Object.assign(offer, { accepted: true, completed: true });
  state.session = null;
  save();
  track("journey", { activity: completed.id, kind: completed.kind, barrier: completed.barrier ?? null, minutes: completed.minutes, simulated });
  closeSheet();
  render(previous < 3 ? previous : -1);
  $(".world").classList.add("revealing");
  $(".world").setAttribute("aria-busy", "true");
  setHint(t(previous < 3 ? "hint.mist" : "hint.another"));
  sound(true);
  try {
    islandCamera.reveal(previous);
    await islandMotion.reveal();
    if (newBridge) await walkTo(completed, true);
  } finally {
    unlocking = false;
    $(".world").classList.remove("revealing");
    $(".world").removeAttribute("aria-busy");
  }
  setHint(t("hint.wider"));
  celebrate();
  const place = places[previous];
  const heading = returning ? "finish.titleComeback" : completed.kind === "detour" ? "finish.titleDetour" : "finish.titleRoute";
  const comebackLine = returning ? `<p class="comeback-line">${t("finish.comebackBody", { n: num(habit.comebacks(state).length) })}</p>` : "";
  const offerPlan =
    completed.kind === "detour" && completed.barrier && state.plans[completed.barrier] !== completed.id
      ? button(t("finish.savePlan", { barrier: t(`barrier.${completed.barrier}`) }), "save-plan", "secondary", `data-barrier="${completed.barrier}" data-id="${completed.id}"`)
      : "";
  openSheet(
    `${title(t("finish.eyebrow"), t(heading))}<div class="success-image">${smallIsland(place?.icon || completed.icon)}</div><span class="unlock-tag">${t(place ? "finish.newPlace" : "finish.another")}</span><h2 style="font-size:22px">${place ? t(`place.${place.id}.name`) : t("finish.keepsStories")}</h2><p>${place ? t(`place.${place.id}.desc`) : t("finish.keepsBody")}${newBridge ? t("finish.bridge") : ""}</p>${comebackLine}${offerPlan}${button(t("finish.see"), "close")}${button(t("details.skipDay"), "skip-day", "quiet")}${simulated ? `<p class="tiny">${t("finish.simulated")}</p>` : ""}`,
  );
}

// ---- Plans changed: adaptive detours ------------------------------------------------

function barrierSheet() {
  if (state.session) {
    state.session.remaining = secondsLeft();
    state.session.deadline = null;
    save();
  }
  const options = barriers
    .map((b) => `<button class="barrier" data-action="pick-barrier" data-barrier="${b.id}">${icon(b.icon)}${t(`barrier.${b.id}`)}</button>`)
    .join("");
  openSheet(
    `${title(t("barriers.eyebrow"), t("barriers.title"))}<p>${t("barriers.body")}</p><div class="barriers">${options}</div>${button(t("barriers.rest"), "rest", "secondary")}${button(t("barriers.back"), "back", "quiet")}`,
  );
}

async function suggestDetours(barrier) {
  const id = ++suggestion;
  const hour = new Date().getHours();
  let weather = null;
  if (state.settings.weather) {
    openSheet(`<div class="sheet-loading">${icon("cloud")}<p>${t("coach.loading")}</p></div>`);
    const result = await services.localWeather();
    if (id !== suggestion) return;
    weather = result.weather ?? null;
    if (result.error) toast(t(`weather.${result.error}`));
  }
  const recs = recommend({ barrier, context: { hour, weather }, plans: state.plans, offers: state.offers, today: today() });
  recs.forEach((r, rank) => state.offers.push({ date: today(), barrier, activity: r.activity.id, rank, accepted: false, completed: false }));
  state.offers = state.offers.slice(-200);
  save();
  track("offer", { barrier, activities: recs.map((r) => r.activity.id) });

  const [best, ...rest] = recs;
  const b = entry(best.activity.id, barrier);
  const used = [t("suggest.contextTime"), weather && t("suggest.contextWeather"), state.plans[barrier] && t("suggest.contextPlan"), state.offers.some((o) => o.completed) && t("suggest.contextHistory")].filter(Boolean);
  const alternatives = rest
    .map(({ activity, reasons }) => {
      const e = entry(activity.id, barrier);
      return `<button class="alt-detour" data-action="pick-detour" data-id="${e.id}" data-barrier="${barrier}" aria-label="${t("suggest.choose", { name: nameOf(e) })}"><span class="discovery-icon">${icon(e.icon)}</span><span><strong>${nameOf(e)}</strong><small>${t("details.minutes", { minutes: num(e.minutes) })} · ${t(`reason.${reasons[0]}`)}</small></span></button>`;
    })
    .join("");
  const aiOn = state.settings.ai && (await services.serverCapabilities()).ai;
  if (id !== suggestion) return;
  openSheet(
    `${title(t("suggest.eyebrow"), t("suggest.title"))}<div class="detour-card"><div class="detour-head"><span class="discovery-icon">${icon(b.icon)}</span><div><strong>${nameOf(b)}</strong><small>${t("details.minutes", { minutes: num(b.minutes) })} · ${contextOf(b)}</small></div></div><p>${descOf(b)}</p><div class="why"><span>${t("reason.label")}</span><ul class="reasons">${best.reasons.map((code) => `<li>${t(`reason.${code}`)}</li>`).join("")}</ul></div>${aiOn ? `<div class="coach-note" id="coach-note" aria-live="polite"><span>${icon("spark")}${t("coach.label")}</span><p class="coach-text">${t("coach.loading")}</p><small>${t("coach.disclosure")}</small></div>` : ""}${button(t("suggest.take"), "pick-detour", "primary", `data-id="${b.id}" data-barrier="${barrier}"`)}</div>${rest.length ? `<div class="sheet-subhead">${t("suggest.other")}</div>${alternatives}` : ""}${button(t("barriers.rest"), "rest", "secondary")}${button(t("barriers.back"), "back", "quiet")}<p class="tiny">${t("suggest.context", { parts: used.join(", ") })}</p>`,
  );
  if (aiOn) {
    const note = await services.coachNote({ barrier, activity: b.id, reasons: best.reasons, hour, locale: locale() });
    if (id !== suggestion || !$("#coach-note")) return;
    if (note) $("#coach-note .coach-text").textContent = note;
    else $("#coach-note").remove();
  }
}

function pickDetour(id, barrier) {
  const e = entry(id, barrier || null);
  if (!e) return;
  selected = e;
  state.session = null;
  save();
  sound();
  details();
}

function savePlan(barrier, id) {
  state.plans[barrier] = id;
  save();
  const btn = document.querySelector('[data-action="save-plan"]');
  if (btn) btn.outerHTML = `<p class="reason">${t("finish.planSaved")}</p>`;
}

// ---- Rest, lapses, and the journey book ----------------------------------------------

function restSheet() {
  openSheet(
    `${title(t("rest.eyebrow"), t("rest.title"), "moon")}<p>${t("rest.body")}</p>${button(t("rest.confirm"), "confirm-rest")}${button(t("rest.back"), "close", "quiet")}`,
  );
}

function confirmRest() {
  if (!habit.restedOn(state, today())) state.rests.push(today());
  state.session = null;
  save();
  track("rest");
  closeSheet();
  render();
  toast(t("rest.toast"));
}

function welcomeBack(gap) {
  state.welcomedBackOn = today();
  save();
  const id = state.plans.motivation ?? state.plans.time ?? "tiny-window";
  const e = entry(id, null);
  openSheet(
    `${title(t("back.eyebrow"), t("back.title"), "heart")}<p>${t("back.body", { gap, shown: num(gap) })}</p><p class="reason">${t("back.science")}</p><div class="sheet-subhead">${t("back.suggest")}</div><div class="discovery"><span class="discovery-icon">${icon(e.icon)}</span><div><strong>${nameOf(e)}</strong><small>${descOf(e)}</small></div></div>${button(t("back.start", { minutes: num(e.minutes) }), "pick-detour", "primary", `data-id="${e.id}"`)}${button(t("back.explore"), "close", "quiet")}`,
  );
}

function journeySheet() {
  const s = habit.stats(state, today());
  const days = s.week
    .map(
      (d) =>
        `<li class="${d.status}${d.isToday ? " today" : ""}"><span>${formatDate(d.date, { weekday: "narrow" })}</span><i title="${t(`day.${d.status}`)}"></i><span class="sr-only">${formatDate(d.date, { weekday: "long" })}: ${t(`day.${d.status}`)}</span></li>`,
    )
    .join("");
  const tiles = [
    ["statActive", s.activeDays],
    ["statComebacks", s.comebacks],
    ["statDetours", s.detoursCompleted],
    ["statMinutes", s.totalMinutes],
  ]
    .map(([key, value]) => `<div class="stat${key === "statComebacks" ? " highlight" : ""}"><strong>${num(value)}</strong><span>${t(`journey.${key}`)}</span></div>`)
    .join("");
  const plans = Object.entries(state.plans);
  const planList = plans.length
    ? plans.map(([b, a]) => `<li><span>${t(`barrier.${b}.if`)}</span> → <strong>${t(`act.${a}.name`)}</strong></li>`).join("")
    : `<li class="muted">${t("journey.noPlans")}</li>`;
  const ids = [...new Set(state.journeys.map((j) => j.id))];
  const ways = ids.length
    ? ids
        .map((id) => {
          const e = entry(id);
          const times = state.journeys.filter((j) => j.id === id).length;
          return `<div class="discovery"><span class="discovery-icon">${icon(e.icon)}</span><div><strong>${nameOf(e)}</strong><small>${times === 1 ? t("journey.triedOnce") : t("journey.tried", { n: num(times) })}${e.kind === "detour" ? t("journey.aroundSetback") : ""}</small></div></div>`;
        })
        .join("")
    : `<p>${t("journey.waysEmpty")}</p>`;
  openSheet(
    `${title(t("journey.eyebrow"), t("journey.title"), "book")}<div class="sheet-subhead">${t("ribbon.week", { done: num(s.activeThisWeek), goal: num(s.goal) })}</div><ol class="week-strip">${days}</ol><div class="stats">${tiles}</div><p class="tiny">${t("journey.comebackNote")}</p><div class="sheet-subhead">${t("journey.plans")}</div><ul class="plan-list">${planList}</ul>${button(t("journey.editPlans"), "plans", "secondary")}<div class="sheet-subhead">${t("journey.ways")}</div>${ways}${button(t("journey.back"), "close", "quiet")}`,
  );
}

// ---- Onboarding and plans ------------------------------------------------------------

const planSelect = (b) =>
  `<label class="plan-row"><span>${icon(barriers.find((x) => x.id === b).icon)}${t(`barrier.${b}.if`)}</span><select data-plan="${b}"><option value="">${t("onboard.planNone")}</option>${planOptions(b)
    .map((a) => `<option value="${a.id}" ${state.plans[b] === a.id ? "selected" : ""}>${t(`act.${a.id}.name`)} · ${t("details.minutes", { minutes: num(a.minutes) })}</option>`)
    .join("")}</select></label>`;

async function onboarding(step = 1) {
  const progress = `<p class="tiny step-count">${t("onboard.step", { n: num(step) })}</p>`;
  if (step === 1) {
    const chips = [2, 3, 4, 5]
      .map((n) => `<button class="chip ${state.goal.daysPerWeek === n ? "on" : ""}" data-action="set-goal" data-days="${n}" aria-pressed="${state.goal.daysPerWeek === n}">${t("onboard.days", { n, shown: num(n) })}</button>`)
      .join("");
    return openSheet(`${title(t("onboard.eyebrow1"), t("onboard.title1"), "flag")}<p>${t("onboard.body1")}</p><div class="chips">${chips}</div>${button(t("onboard.next"), "onboard-2")}${button(t("onboard.skip"), "onboard-done", "quiet")}${progress}`);
  }
  if (step === 2) {
    return openSheet(`${title(t("onboard.eyebrow2"), t("onboard.title2"), "bridge")}<p>${t("onboard.body2")}</p><div class="plans">${barriers.map((b) => planSelect(b.id)).join("")}</div>${button(t("onboard.next"), "onboard-3")}${button(t("onboard.skip"), "onboard-done", "quiet")}${progress}`);
  }
  const caps = await services.serverCapabilities();
  openSheet(
    `${title(t("onboard.eyebrow3"), t("onboard.title3"), "spark")}<p>${t("onboard.body3")}</p>${toggle("weather", t("onboard.weather"), state.settings.weather, t("onboard.weatherNote"))}${toggle("ai", t("onboard.ai"), state.settings.ai && caps.ai, caps.ai ? t("onboard.aiNote") : t("settings.aiUnavailable"), !caps.ai)}${button(t("onboard.finish"), "onboard-done")}${progress}`,
  );
}

function finishOnboarding() {
  state.onboarded = true;
  save();
  closeSheet();
  render();
}

function plansSheet() {
  openSheet(`${title(t("onboard.eyebrow2"), t("journey.plans"), "bridge")}<p>${t("onboard.body2")}</p><div class="plans">${barriers.map((b) => planSelect(b.id)).join("")}</div>${button(t("settings.done"), "journey")}`);
}

// ---- Menu, settings, privacy, pilot, demo --------------------------------------------

function menu() {
  const item = (action, key, arrow = "↗", vars) => `<button class="menu-item" data-action="${action}">${t(key, vars)} <span>${arrow}</span></button>`;
  openSheet(
    `${title(t("menu.eyebrow"), t("menu.title"))}${item("about", "menu.about")}${state.session ? item("timer", "menu.timer", "→") : ""}${item("journey", "menu.journey")}${item("plans", "menu.plans")}${item("settings", "menu.settings")}${item("privacy", "menu.privacy")}${state.pilot ? item("pilot", "menu.pilotJoined", "↗", { cohort: escapeHtml(state.pilot.cohort) }) : item("pilot", "menu.pilot")}${item("demo", "menu.demo")}${item("reset", "menu.reset", "↻")}<p class="tiny">${t("menu.footer", { date: formatDate(today(), { weekday: "long", day: "numeric", month: "long" }) })}</p>`,
  );
}

async function settingsSheet() {
  const caps = await services.serverCapabilities();
  const languages = supportedLocales
    .map((code) => `<option value="${code}" ${locale() === code ? "selected" : ""}>${code === "ar" ? "العربية" : "English"}</option>`)
    .join("");
  const goals = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => `<option value="${n}" ${state.goal.daysPerWeek === n ? "selected" : ""}>${t("onboard.days", { n, shown: num(n) })}</option>`)
    .join("");
  openSheet(
    `${title(t("settings.eyebrow"), t("settings.title"), "globe")}<label class="plan-row"><span>${t("settings.language")}</span><select data-setting="locale">${languages}</select></label><label class="plan-row"><span>${t("settings.goal")}</span><select data-setting="goal">${goals}</select></label>${toggle("sound", t("settings.sound"), state.settings.sound)}${toggle("weather", t("settings.weather"), state.settings.weather, t("onboard.weatherNote"))}${toggle("ai", t("settings.ai"), state.settings.ai && caps.ai, caps.ai ? t("onboard.aiNote") : t("settings.aiUnavailable"), !caps.ai)}${button(t("settings.done"), "close")}`,
  );
}

async function changeSetting(name, el) {
  if (name === "locale") {
    state.settings.locale = el.value;
    save();
    await setLocale(el.value);
    applyStaticText();
    render();
    return settingsSheet();
  }
  if (name === "goal") {
    state.goal.daysPerWeek = Number(el.value);
    save();
    return renderRibbon();
  }
  state.settings[name] = el.checked;
  save();
  if (name === "sound") {
    render();
    sound();
  }
  if (name === "weather" && el.checked) {
    const result = await services.localWeather();
    if (result.error) {
      state.settings.weather = false;
      el.checked = false;
      save();
      toast(t(`weather.${result.error}`));
    }
  }
}

function privacySheet() {
  openSheet(
    `${title(t("privacy.eyebrow"), t("privacy.title"), "shield")}<ul class="plain-list"><li>${t("privacy.local")}</li><li>${t("privacy.weather")}</li><li>${t("privacy.ai")}</li><li>${t("privacy.pilot")}</li></ul>${button(t("privacy.export"), "export", "secondary")}${button(t("privacy.erase"), "erase", "quiet")}`,
  );
}

function pilotSheet() {
  const body = `<p>${t("pilot.body")}</p><ul class="plain-list"><li>${t("pilot.shared")}</li><li>${t("pilot.notShared")}</li></ul>`;
  if (state.pilot) {
    return openSheet(`${title(t("pilot.eyebrow"), t("menu.pilotJoined", { cohort: escapeHtml(state.pilot.cohort) }), "chart")}${body}${button(t("pilot.leave"), "pilot-leave", "secondary")}${button(t("settings.done"), "close", "quiet")}`);
  }
  openSheet(
    `${title(t("pilot.eyebrow"), t("pilot.title"), "chart")}${body}<label class="field"><span>${t("pilot.code")}</span><input id="pilot-code" autocomplete="off" autocapitalize="characters" maxlength="24" spellcheck="false"></label>${button(t("pilot.join"), "pilot-join")}${button(t("settings.done"), "close", "quiet")}`,
  );
}

async function joinPilot() {
  const code = $("#pilot-code")?.value.trim() ?? "";
  if (!services.validPilotCode(code)) return toast(t("pilot.invalid"));
  if (!(await services.serverCapabilities()).pilot) return toast(t("pilot.offline"));
  state.pilot = { participant: services.newParticipantId(), cohort: code.toLowerCase(), joinedOn: today() };
  save();
  track("join", { goal: state.goal.daysPerWeek });
  toast(t("pilot.joined"));
  pilotSheet();
}

function leavePilot() {
  track("leave");
  state.pilot = null;
  services.clearPilotQueue();
  save();
  toast(t("pilot.left"));
  closeSheet();
}

function demoSheet() {
  openSheet(
    `${title(t("demo.eyebrow"), t("demo.title"), "clock")}<p>${t("demo.body")}</p>${button(t("demo.nextDay"), "skip-day", "secondary")}${button(t("demo.lapse"), "skip-lapse", "secondary")}<a class="secondary link-button" href="pilot.html" target="_blank" rel="noopener">${t("demo.dashboard")}</a>`,
  );
}

function skipDays(n) {
  islandCamera.reset();
  islandMotion.reset();
  state.demoOffset += n;
  state.session = null;
  save();
  closeSheet();
  render();
  toast(t("demo.toastDay", { date: formatDate(today(), { weekday: "long", day: "numeric", month: "long" }) }));
  greetOnOpen();
}

function aboutSheet() {
  openSheet(
    `${title(t("about.eyebrow"), t("about.title"), "sun")}<ol class="help-list"><li>${t("about.step1")}</li><li>${t("about.step2")}</li><li>${t("about.step3")}</li><li>${t("about.step4")}</li></ol><div class="sheet-subhead">${t("about.why")}</div><p>${t("about.evidence")}</p><p class="tiny">${t("about.note")}</p>${button(t("about.go"), "close")}`,
  );
}

function locked(id) {
  const n = routes[id].unlock - total();
  openSheet(
    `${title(t("locked.eyebrow"), t(`route.${id}.label`), "cloud")}<p>${t("locked.body", { n, shown: num(n) })}</p><p>${t("locked.pace")}</p>${button(t("locked.back"), "close")}`,
  );
}

function bridgeSheet() {
  openSheet(`${title(t("bridgeSheet.eyebrow"), t("bridgeSheet.title"), "bridge")}<p>${t("bridgeSheet.body")}</p>${button(t("bridgeSheet.keep"), "close")}`);
}

function resetIsland() {
  const keep = state.settings;
  state = store.fresh();
  state.settings = keep;
  selected = null;
  islandCamera.reset();
  islandMotion.reset();
  save();
  closeSheet();
  render();
  toast(t("reset.toast"));
  onboarding();
}

// ---- Events --------------------------------------------------------------------------

const actions = {
  close: closeSheet,
  start,
  pause,
  finish: () => finish(false),
  simulate: () => finish(true),
  barriers: barrierSheet,
  "pick-barrier": (el) => suggestDetours(el.dataset.barrier),
  "pick-detour": (el) => pickDetour(el.dataset.id, el.dataset.barrier),
  "save-plan": (el) => savePlan(el.dataset.barrier, el.dataset.id),
  back: () => (state.session ? showTimer() : selected ? details() : closeSheet()),
  rest: restSheet,
  "confirm-rest": confirmRest,
  journey: journeySheet,
  plans: plansSheet,
  about: aboutSheet,
  timer: showTimer,
  settings: settingsSheet,
  privacy: privacySheet,
  export: () => download(`reroute-data-${today()}.json`, state),
  erase: () =>
    openSheet(`${title(t("privacy.eyebrow"), t("privacy.erase"), "shield")}<p>${t("privacy.eraseConfirm")}</p>${button(t("privacy.erase"), "confirm-erase")}${button(t("reset.keep"), "privacy", "quiet")}`),
  "confirm-erase": () => {
    if (state.pilot) leavePilot();
    store.erase();
    services.clearPilotQueue();
    state = store.fresh();
    islandCamera.reset();
    islandMotion.reset();
    closeSheet();
    render();
    toast(t("privacy.erased"));
    onboarding();
  },
  pilot: pilotSheet,
  "pilot-join": joinPilot,
  "pilot-leave": leavePilot,
  demo: demoSheet,
  "skip-day": () => skipDays(1),
  "skip-lapse": () => skipDays(3),
  "set-goal": (el) => {
    state.goal.daysPerWeek = Number(el.dataset.days);
    save();
    onboarding(1);
  },
  "onboard-2": () => onboarding(2),
  "onboard-3": () => onboarding(3),
  "onboard-done": finishOnboarding,
  reset: () =>
    openSheet(`${title(t("reset.eyebrow"), t("reset.title"))}<p>${t("reset.body")}</p>${button(t("reset.confirm"), "confirm-reset")}${button(t("reset.keep"), "close", "quiet")}`),
  "confirm-reset": resetIsland,
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el) actions[el.dataset.action]?.(el);
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.setting) changeSetting(el.dataset.setting, el);
  if (el.dataset.plan) {
    if (el.value) state.plans[el.dataset.plan] = el.value;
    else delete state.plans[el.dataset.plan];
    save();
  }
});
$("#close").onclick = closeSheet;
$("#sheet").addEventListener("close", () => clearInterval(interval));
$("#sheet").addEventListener("click", (e) => {
  if (e.target !== $("#sheet")) return;
  const r = $("#sheet").getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeSheet();
});
$("#sound").onclick = () => {
  state.settings.sound = !state.settings.sound;
  save();
  render();
  sound();
  toast(t(state.settings.sound ? "sound.toastOn" : "sound.toastOff"));
};
$("#menu").onclick = menu;
$("#journey").onclick = journeySheet;
$("#ribbon").onclick = journeySheet;
$("#rest").onclick = restSheet;
$(".wordmark").onclick = (e) => {
  e.preventDefault();
  closeSheet();
};
// Stop decorative animation work when this world is not visible.
document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("ambient-paused", document.hidden));

// First open asks for a goal and plans; a return after a lapse is welcomed, once per day.
function greetOnOpen() {
  if (!state.onboarded) return onboarding();
  const away = habit.lapse(state, today());
  if (away && state.welcomedBackOn !== today()) welcomeBack(away.gap + 1); // days since last active
}

globalThis.rerouteT = t; // lets camera.js label its controls in the current language
const preferred = state.settings.locale ?? (navigator.language?.startsWith("ar") ? "ar" : "en");
await setLocale(preferred);
applyStaticText();
render();
greetOnOpen();
