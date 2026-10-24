// Shared interface pieces: the bottom sheet, toasts, small markup helpers, and sound.

import { icon } from "./icons.js";

export const $ = (selector) => document.querySelector(selector);

// Escape anything that didn't come from our own string tables before it reaches innerHTML.
export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const button = (text, action, kind = "primary", extra = "") =>
  `<button class="${kind}" data-action="${action}" ${extra}>${text}</button>`;

export const title = (eyebrow, heading, symbol) =>
  `<div class="sheet-eyebrow">${eyebrow}</div>${symbol ? `<div class="sheet-symbol">${icon(symbol)}</div>` : ""}<h2 id="sheet-title">${heading}</h2>`;

export const toggle = (name, label, on, note = "", disabled = false) =>
  `<label class="toggle-row"><span><strong>${label}</strong>${note ? `<small>${note}</small>` : ""}</span><input type="checkbox" role="switch" data-setting="${name}" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}></label>`;

// The sheet is a modal <dialog>. Hooks let the app stop timers and walking when it opens.
const sheet = { lastFocus: null, onOpen: () => {}, onClose: () => {}, blocked: () => false };
export const configureSheet = (hooks) => Object.assign(sheet, hooks);

export function openSheet(html) {
  if (sheet.blocked()) return;
  sheet.onOpen();
  $("#sheet-content").innerHTML = html;
  if (!$("#sheet").open) {
    sheet.lastFocus = document.activeElement;
    $("#sheet").showModal();
  }
  $("#sheet").scrollTop = 0;
}

export function closeSheet() {
  sheet.onClose();
  if ($("#sheet").open) $("#sheet").close();
  sheet.lastFocus?.focus?.();
}

export function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}

let audio = null;
export function chime(enabled, win = false) {
  if (!enabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    (win ? [523.25, 659.25, 783.99] : [659.25]).forEach((hz, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      const t = audio.currentTime + i * 0.13;
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g);
      g.connect(audio.destination);
      o.start(t);
      o.stop(t + 0.75);
    });
  } catch {}
}

export function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 25; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    s.style.cssText = `--dx:${(Math.random() - 0.5) * 550}px;--dy:${(Math.random() - 0.7) * 450}px;--rot:${Math.random() * 400}deg;--spark-color:${["#e0bd71", "#9cb87d", "#f3ead1", "#9cbfb3"][i % 4]};animation-delay:${Math.random() * 0.2}s`;
    $("#sparkles").append(s);
    setTimeout(() => s.remove(), 2200);
  }
}

// Offer a JSON file to save, e.g. the person's data export.
export function download(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
