// Pilot dashboard. Reads aggregate measures from the server when one is running; otherwise
// (static hosting, or by choice) computes them from the seeded synthetic cohort.

import { computeMetrics } from "./metrics.js";
import { syntheticEvents, SYNTHETIC_COHORT } from "./synthetic.js";
import en from "./locales/en.js";

const $ = (s) => document.querySelector(s);
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const fmt = (v, digits = 1) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(digits));
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let token = "";
try {
  token = sessionStorage.getItem("reroute-pilot-token") ?? "";
} catch {}

async function serverSummary(cohort) {
  try {
    const response = await fetch(`api/pilot/summary${cohort ? `?cohort=${encodeURIComponent(cohort)}` : ""}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 401) return { unauthorized: true };
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function synthetic() {
  const { events, end } = syntheticEvents();
  return { cohorts: [], metrics: computeMetrics(events, { end }), synthetic: true };
}

async function load(choice) {
  if (choice === SYNTHETIC_COHORT) return synthetic();
  const result = await serverSummary(choice || null);
  if (result?.unauthorized) {
    $("#token-box").hidden = false;
    return { unauthorized: true };
  }
  return result ?? { ...synthetic(), offline: true };
}

function populateCohorts(cohorts, current) {
  const options = [`<option value="">All real cohorts</option>`, ...cohorts.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`), `<option value="${SYNTHETIC_COHORT}">Synthetic demo cohort</option>`];
  $("#cohort").innerHTML = options.join("");
  $("#cohort").value = current;
}

function banner(data) {
  if (data.synthetic) {
    return `<div class="banner"><strong>SYNTHETIC DEMO DATA.</strong> These ${data.metrics.participants} “participants” are generated from a fixed seed to show how each measure works. They are not people and say nothing about whether ReRoute helps.${data.offline ? " (No pilot server is running here.)" : ""}</div>`;
  }
  return `<div class="banner">Real pilot events · data through ${escapeHtml(data.metrics.end)} · ${data.metrics.simulatedExcluded} simulated journeys excluded.</div>`;
}

function tile(label, value, detail, headline = false) {
  return `<div class="tile${headline ? " headline" : ""}"><div class="label">${label}</div><div class="value">${value}</div><small>${detail}</small></div>`;
}

// Vertical bars, one per week, 0–100%. Values are labelled (only four bars) and every bar
// has a hover/focus tooltip with its denominator.
function weeklyChart(weekly) {
  const w = 480,
    h = 220,
    left = 36,
    bottom = 28,
    top = 18;
  const plotH = h - top - bottom;
  const band = (w - left) / weekly.length;
  const barW = Math.min(56, band * 0.5);
  const y = (v) => top + plotH * (1 - v);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((v) => `<line class="gridline" x1="${left}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${left - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`)
    .join("");
  const bars = weekly
    .map((row, i) => {
      const cx = left + band * i + band / 2;
      const v = row.metGoalRate;
      const label = `Week ${row.week}`;
      const tip = v == null ? `${label}: too few participant-weeks to show` : `${label}: ${pct(v)} met their goal (${row.metGoal} of ${row.eligible} participant-weeks)`;
      const bar =
        v == null
          ? ""
          : `<path class="bar" d="M${cx - barW / 2} ${y(0)}V${y(v) + 4}a4 4 0 0 1 4 -4H${cx + barW / 2 - 4}a4 4 0 0 1 4 4V${y(0)}Z"/><text class="value-label" x="${cx}" y="${y(v) - 6}" text-anchor="middle">${pct(v)}</text>`;
      return `<rect class="hit" x="${cx - band / 2}" y="${top}" width="${band}" height="${plotH}" tabindex="0" data-tip="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}"/>${bar}<text x="${cx}" y="${h - 8}" text-anchor="middle">${label}</text>`;
    })
    .join("");
  const table = `<details><summary>Show as table</summary><table><thead><tr><th>Week</th><th>Participant-weeks</th><th>Met goal</th><th>Rate</th><th>Mean active days</th></tr></thead><tbody>${weekly
    .map((r) => `<tr><td>Week ${r.week}</td><td class="num">${r.eligible}</td><td class="num">${r.metGoal}</td><td class="num">${pct(r.metGoalRate)}</td><td class="num">${fmt(r.meanActiveDays)}</td></tr>`)
    .join("")}</tbody></table></details>`;
  return `<div class="chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Share of participant-weeks meeting the weekly goal, weeks 1 to 4"><g class="axis">${grid}${bars}</g></svg></div>${table}`;
}

const inlineBar = (v) => (v == null ? "—" : `<span class="inline-bar"><i style="width:${Math.round(v * 80)}px"></i><span>${pct(v)}</span></span>`);

function detourTable(detours) {
  const rows = detours.byBarrier
    .map((b) =>
      b.suppressed
        ? `<tr><td>${en[`barrier.${b.barrier}`]}</td><td colspan="3" class="note">Fewer than 5 offers; hidden</td></tr>`
        : `<tr><td>${en[`barrier.${b.barrier}`]}</td><td class="num">${b.offered}</td><td>${inlineBar(b.acceptance)}</td><td>${inlineBar(b.completion)}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>What got in the way</th><th>Offers</th><th>Accepted</th><th>Completed</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function render(data) {
  const m = data.metrics;
  $("#banner").innerHTML = banner(data);
  if (m.suppressed) {
    $("#content").innerHTML = `<div class="card empty">${m.participants} participant${m.participants === 1 ? "" : "s"} so far. Measures appear once at least ${m.minCell} people have joined, to protect privacy.</div>`;
    return;
  }
  const r = m.recovery;
  const week4 = m.retention.find((x) => x.week === 4);
  const week2 = m.retention.find((x) => x.week === 2);
  $("#content").innerHTML = `
    <section class="tiles" aria-label="Headline measures">
      ${tile("Returned within 7 days of a lapse", pct(r.rate), `${r.within7} of ${r.observable} observed lapses · median ${fmt(r.medianDaysToReturn)} days to return`, true)}
      ${tile("Weeks meeting own goal", pct(m.persistence.rate), `${m.persistence.metGoal} of ${m.persistence.eligibleWeeks} completed participant-weeks`)}
      ${tile("Detours accepted", pct(m.detours.acceptance), `${m.detours.started} started of ${m.detours.offered} offers`)}
      ${tile("Detours completed", pct(m.detours.completion), `${m.detours.completed} finished of ${m.detours.started} started`)}
      ${tile("Still engaged in week 2", pct(week2.rate), `${week2.retained} of ${week2.eligible} observed through week 2`)}
      ${tile("Still engaged in week 4", pct(week4.rate), `${week4.retained} of ${week4.eligible} observed through week 4`)}
    </section>
    <section class="grid">
      <div class="card"><h2>Weeks meeting the weekly goal</h2><small>Share of completed participant-weeks, by week since joining · ${m.participants} participants</small>${weeklyChart(m.weekly)}</div>
      <div class="card"><h2>Which detours help, by barrier</h2><small>From “Plans changed” offer to a finished detour</small>${detourTable(m.detours)}</div>
    </section>`;
  wireTooltips();
}

function wireTooltips() {
  const tip = $("#tooltip");
  const show = (el) => {
    const box = el.getBoundingClientRect();
    tip.textContent = el.dataset.tip;
    tip.style.left = `${box.left + box.width / 2 + scrollX}px`;
    tip.style.top = `${box.top + scrollY + 20}px`;
    tip.classList.add("show");
  };
  const hide = () => tip.classList.remove("show");
  for (const el of document.querySelectorAll("[data-tip]")) {
    el.addEventListener("pointerenter", () => show(el));
    el.addEventListener("pointerleave", hide);
    el.addEventListener("focus", () => show(el));
    el.addEventListener("blur", hide);
  }
}

async function refresh(choice) {
  $("#content").innerHTML = `<p class="empty">Loading…</p>`;
  const data = await load(choice);
  if (data.unauthorized) {
    $("#content").innerHTML = `<p class="card empty">This pilot server requires an admin token. Enter it above, or choose the synthetic demo cohort.</p>`;
    populateCohorts([], choice);
    return;
  }
  populateCohorts(data.cohorts ?? [], data.synthetic ? SYNTHETIC_COHORT : choice);
  render(data);
}

$("#cohort").addEventListener("change", (e) => refresh(e.target.value));
$("#token-go").addEventListener("click", () => {
  token = $("#token").value.trim();
  try {
    sessionStorage.setItem("reroute-pilot-token", token);
  } catch {}
  $("#token-box").hidden = true;
  refresh($("#cohort").value === SYNTHETIC_COHORT ? "" : $("#cohort").value);
});

// With no real participants yet, open on the synthetic cohort so the page is never empty.
const first = await load("");
if (!first.unauthorized && !first.synthetic && first.metrics.participants === 0) refresh(SYNTHETIC_COHORT);
else refresh("");
