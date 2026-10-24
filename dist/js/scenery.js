// Island artwork as SVG strings. Rendering only: no state is read or written here, and
// geometry is shared with motion.js (paths) and camera.js (world coordinates).

import { icons } from "./icons.js";
import { routes } from "./content.js";
import { t, num } from "./i18n.js";

function tree(x, y, s = 1, variant = 0) {
  const type = variant % 3,
    delay = -((x + y) % 53) / 10;
  return `<g class="living-tree" transform="translate(${x} ${y}) scale(${s})"><ellipse class="tree-shadow" cx="12" cy="7" rx="23" ry="7" transform="rotate(19 12 7)" fill="#314d3f" opacity=".21"/><path d="M0 7v-36m0 20-7-9m7 3 8-11" fill="none" stroke="#746548" stroke-width="4" stroke-linecap="round"/><path d="M-1 5v-31" stroke="#b1a176" stroke-width="1.2"/><g class="tree-crown" style="--wind-delay:${delay}s;--wind-duration:${5 + (x % 4)}s"><ellipse cx="0" cy="-28" rx="20" ry="28" fill="url(#leaves-${type})"/><ellipse cx="-10" cy="-22" rx="13" ry="17" fill="url(#leaves-${type})"/><ellipse cx="10" cy="-19" rx="12" ry="16" fill="url(#leaves-${type})"/><ellipse cx="-5" cy="-43" rx="9" ry="10" fill="#e2eca9" opacity=".16"/><path d="M-12-32q-3 6-2 10M-4-47q-5 1-7 6" fill="none" stroke="#eff0b5" stroke-width="1.6" opacity=".32" stroke-linecap="round"/></g></g>`;
}
function pine(x, y, s = 1) {
  return `<g class="living-tree" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="13" cy="7" rx="25" ry="7" transform="rotate(18 13 7)" fill="#314d3f" opacity=".2"/><path d="M0 7v-42" stroke="#82704d" stroke-width="4"/><g class="pine-crown" style="--wind-delay:${-(x % 40) / 10}s;--wind-duration:${6 + (y % 3)}s"><path d="M0-46-24-3Q0 9 24-3Z" fill="#3e7059"/><path d="M0-46-24-3Q-12 1 0 2Z" fill="#81aa72"/><path d="M0-59-20-20Q0-9 20-20Z" fill="#4b8061"/><path d="M0-59-20-20Q-10-16 0-15Z" fill="#99b87b"/><path d="M0-73-15-38Q0-30 15-38Z" fill="#5b8c67"/><path d="M0-73-15-38Q-7-35 0-34Z" fill="#b4c98a"/></g></g>`;
}
function land(d, depth = 18, fill = "url(#grass)") {
  const h = depth * 1.9;
  return `<g class="terrain"><path d="${d}" transform="translate(9 ${h + 13})" fill="#446f61" opacity=".15"/><path d="${d}" transform="translate(0 ${h})" fill="#657f68" stroke="#637b62" stroke-width="2"/><path d="${d}" transform="translate(0 ${h * 0.76})" fill="url(#earth)"/><path d="${d}" transform="translate(0 ${h * 0.43})" fill="#a8aa7e"/><path d="${d}" transform="translate(0 ${h * 0.32})" fill="#8f9b70"/><path d="${d}" transform="translate(0 6)" fill="#d5ca91" stroke="#d4cc9d" stroke-width="5"/><path d="${d}" fill="${fill}" stroke="#dce1a8" stroke-width="2"/><path d="${d}" fill="url(#sunlit-ground)"/></g>`;
}
const mainLand =
  "M220 509C218 464 266 434 329 442 363 405 449 409 485 441 547 431 589 461 587 506 621 547 581 592 548 601 532 650 462 680 398 667 340 694 274 660 264 627 212 617 196 552 220 509Z";
const groveLand =
  "M138 358C129 326 173 301 208 314 248 291 291 323 288 351 315 376 276 409 250 406 223 433 174 416 166 398 133 393 121 373 138 358Z";
const coveLand =
  "M533 384C531 355 571 337 600 350 638 334 672 364 660 390 687 418 649 449 619 443 589 471 548 450 550 428 522 420 510 394 533 384Z";
const summitLand =
  "M334 237C322 208 353 190 379 197 400 175 442 184 454 211 485 220 476 251 458 259 453 289 401 301 376 282 340 286 321 259 334 237Z";
function cloud(x, y, s = 1, cls = "") {
  return `<g class="float-cloud ${cls}" opacity=".9"><g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="5" rx="44" ry="15" fill="#f5f8ec"/><ellipse cx="-16" cy="-4" rx="22" ry="18" fill="#fafbec"/><ellipse cx="12" cy="-9" rx="24" ry="20" fill="#fbfbed"/><ellipse cx="31" cy="2" rx="20" ry="12" fill="#f4f8eb"/></g></g>`;
}
function pin(r, visited) {
  const label = t(`route.${r.id}.label`);
  const name = t(`route.${r.id}.name`);
  const aria = visited ? t("pin.ariaVisited", { label, minutes: num(r.minutes) }) : t("pin.aria", { label, minutes: num(r.minutes) });
  return `<g class="path-button ${visited ? "visited" : ""}" data-route="${r.id}" role="button" tabindex="0" aria-label="${aria}"><title>${name}</title><path class="route-line" d="${r.path}"/><path class="route-hit" d="${r.path}"/><g transform="translate(${r.x} ${r.y})"><circle class="pin-ring" r="29"/><circle class="pin-disc" r="20"/><g class="pin-icon" transform="translate(-11 -11) scale(.92)">${icons[visited ? "check" : r.icon]}</g><text class="pin-label" text-anchor="middle" y="39">${label}</text><text class="pin-time" text-anchor="middle" y="53">${t("pin.minutes", { minutes: num(r.minutes) })}</text><circle r="37" fill="transparent"/></g></g>`;
}
function lockedPin(r, remaining) {
  const label = t(`route.${r.id}.label`);
  return `<g class="locked-pin path-button" data-route="${r.id}" tabindex="0" role="button" aria-label="${t("pin.ariaLocked", { label, count: num(remaining) })}"><g transform="translate(${r.x} ${r.y - 1})"><circle class="locked-disc" r="19"/><g class="pin-icon" style="stroke:#9bad91" transform="translate(-9 -10) scale(.8)">${icons.lock}</g><text class="locked-label" y="35" text-anchor="middle">${label}</text><circle r="37" fill="transparent"/></g></g>`;
}
export function islandMarkup({ total, bridge, visited, reveal = -1 }) {
  let flowers = "";
  for (let i = 0; i < 27; i++) {
    const x = 273 + ((i * 47) % 258),
      y = 467 + ((i * 31) % 165);
    flowers += `<g transform="translate(${x} ${y})"><path d="M0 0v-5" stroke="#9aad73" stroke-width="1.2"/><circle cy="-6" r="2.3" fill="${i % 3 ? "#f3eac0" : "#d4a477"}"/></g>`;
  }
  const grove = total >= 1,
    cove = total >= 2,
    summit = total >= 3;
  return `<defs><radialGradient id="leaves-0" cx="28%" cy="18%" r="80%"><stop stop-color="#c2d58a"/><stop offset=".44" stop-color="#8fb571"/><stop offset="1" stop-color="#416f51"/></radialGradient><radialGradient id="leaves-1" cx="28%" cy="18%" r="80%"><stop stop-color="#aaca8c"/><stop offset=".48" stop-color="#6d9d70"/><stop offset="1" stop-color="#345d4b"/></radialGradient><radialGradient id="leaves-2" cx="28%" cy="18%" r="80%"><stop stop-color="#d4dc92"/><stop offset=".5" stop-color="#9cba71"/><stop offset="1" stop-color="#5b7e50"/></radialGradient><radialGradient id="sunlit-ground" cx="25%" cy="10%" r="85%"><stop stop-color="#fff2b7" stop-opacity=".22"/><stop offset=".65" stop-color="#d9e6ac" stop-opacity="0"/><stop offset="1" stop-color="#315e43" stop-opacity=".12"/></radialGradient><linearGradient id="fall-shade" x2="1" y2="0"><stop stop-color="#498e89"/><stop offset=".4" stop-color="#a8ddcb"/><stop offset=".72" stop-color="#d9f2d7"/><stop offset="1" stop-color="#65ada1"/></linearGradient><linearGradient id="grass" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#c7d39b"/><stop offset="1" stop-color="#a1ba80"/></linearGradient><linearGradient id="earth" x2="0" y2="1"><stop stop-color="#b9b285"/><stop offset=".5" stop-color="#8f9773"/><stop offset="1" stop-color="#596f5a"/></linearGradient><linearGradient id="pool" x2="1" y2="1"><stop stop-color="#3e8f87"/><stop offset=".48" stop-color="#77b9a7"/><stop offset="1" stop-color="#b1dcc1"/></linearGradient><linearGradient id="peak" x2="1" y2="1"><stop stop-color="#b1bb98"/><stop offset="1" stop-color="#83977d"/></linearGradient><filter id="ground-shadow" x="-50%" width="200%" y="-100%" height="300%"><feGaussianBlur stdDeviation="11"/></filter><filter id="pin-shadow" x="-50%" width="200%" y="-50%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#647d49" flood-opacity=".14"/></filter><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="fog-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter></defs>
<g fill="none" stroke="#a9c4b8" stroke-width="1.2" opacity=".4"><ellipse cx="398" cy="556" rx="239" ry="153"/><ellipse cx="398" cy="556" rx="261" ry="166" stroke-dasharray="90 30 25 40"/><ellipse cx="205" cy="376" rx="103" ry="59"/><ellipse cx="597" cy="411" rx="99" ry="59"/><ellipse cx="398" cy="256" rx="90" ry="52"/></g><g fill="none" stroke="#b3cdc0" stroke-width="1.3" stroke-linecap="round">${Array.from(
      { length: 29 },
      (_, i) => {
        const x = 108 + ((i * 97) % 580),
          y = 213 + ((i * 67) % 490);
        return `<path class="water-glint ocean-current" style="animation-delay:-${i % 5}s" d="M${x} ${y}q8 3 17 0"/>`;
      },
    ).join(
      "",
    )}</g><ellipse cx="404" cy="658" rx="186" ry="38" fill="#6d9981" opacity=".17" filter="url(#ground-shadow)"/>
<g data-region="summit" opacity="${summit ? 1 : 0.19}" class="${reveal === 2 ? "new-area" : ""}">${land(summitLand, 17)}<path d="m353 236 34-74 20 34 14-18 35 60-43 27Z" fill="url(#peak)"/><path d="m387 162 20 34 14-18-8 87-24-23Z" fill="#94a185"/><path d="m374 190 13-28 13 23-10-3-7 9-4-4Z" fill="#e7e7ce"/><path d="m411 191 10-13 9 16-9-4-6 5Z" fill="#d2d8bb"/>${pine(349, 248, 0.55)}${tree(453, 251, 0.55, 0)}<path d="M421 256v-30" stroke="#8d8055" stroke-width="2"/><path d="m422 226 16 4-16 7" fill="#d7a66a"/></g>
<g data-region="grove" opacity="${grove ? 1 : 0.2}" class="${reveal === 0 ? "new-area" : ""}">${land(groveLand, 17)}${pine(185, 342, 1.1)}${tree(226, 336, 1.2, 1)}${tree(255, 352, 0.87, 0)}${tree(153, 361, 0.8, 2)}${pine(173, 385, 0.7)}${tree(269, 381, 0.6, 1)}<path d="M180 391q26-21 62-7" fill="none" stroke="#e2dfad" stroke-width="7"/><g transform="translate(232 390)"><path d="M-8 0h19m-16-6h14m-14 4v7m14-7v7" stroke="#9b8658" stroke-width="3"/></g></g>
<g data-region="cove" opacity="${cove ? 1 : 0.19}" class="${reveal === 1 ? "new-area" : ""}">${land(coveLand, 16)}<path d="M554 398q13-22 40-13t28 27q-12 23-39 15t-29-29" fill="url(#pool)"/><path class="cove-shimmer" d="M562 402q17-8 34 0m-24 11q14-5 25-1" fill="none" stroke="#d1e6ce" stroke-width="2"/><path d="M576 426q10 11 2 35" stroke="#c6e2d0" stroke-width="9" fill="none" opacity=".75"/><path class="waterfall-current" stroke-dasharray="7 9" d="M578 431q6 12-1 31" stroke="#e1efdb" stroke-width="2" fill="none"/>${tree(632, 384, 0.8, 2)}${tree(649, 410, 0.62, 1)}<ellipse cx="548" cy="393" rx="9" ry="5" fill="#abb58e"/><path d="M620 432h23m-19-5 13 0" stroke="#a29062" stroke-width="3"/></g>
${land(mainLand, 25)}<g fill="none" stroke="#8d9c71" stroke-width="2" opacity=".45"><path d="m226 557 4 23m15 11 2 19m30 18 4 24m75 16 1 14m83-15-2 20m60-30-2 18m56-57-6 25m29-72-3 25"/></g><path d="M396 575C366 561 336 554 337 521S304 478 324 463M410 574C454 601 489 567 498 537M398 581C365 599 386 626 417 635" fill="none" stroke="#d8d9a8" stroke-width="17" stroke-linecap="round"/><path d="M396 575C366 561 336 554 337 521S304 478 324 463M410 574C454 601 489 567 498 537M398 581C365 599 386 626 417 635" fill="none" stroke="#ebe3b5" stroke-width="9" stroke-linecap="round"/>
${pine(332, 453, 0.85)}${tree(371, 444, 1.05, 1)}${tree(446, 448, 1.1, 0)}${pine(479, 460, 0.84)}${tree(526, 482, 0.85, 2)}${tree(553, 507, 0.72, 1)}${tree(266, 510, 0.9, 1)}${pine(280, 542, 0.67)}${tree(288, 599, 0.8, 2)}${tree(338, 648, 0.8, 0)}${pine(479, 638, 0.72)}${tree(531, 587, 0.68, 1)}<g transform="translate(416 491)"><ellipse cy="23" rx="35" ry="12" fill="#6f8553" opacity=".15"/><path d="m-25-3 44-5 3 37-43 4Z" fill="#f2e7c4"/><path d="m-25-3 21-32 30 27Z" fill="#c48c61"/><path d="m-4-35 30 27 8-4L6-40Z" fill="#ae7857"/><path d="m-4-35-28 34 7-2Z" fill="#e0a173"/><path d="m3 12 10-1v19l-10 1Z" fill="#8b815b"/><path d="m-15 7 10-1v10l-10 1Z" fill="#9aaf90"/><path d="M18-16v-20h6v25Z" fill="#bba27d"/><path d="m20-41 2-5m0-6-2-4" fill="none" stroke="#f8f5e7" stroke-width="3" stroke-linecap="round" opacity=".7"/></g>
<g class="living-water" aria-hidden="true"><path d="M454 607C474 623 429 634 440 664" fill="none" stroke="#c4d3a2" stroke-width="15" stroke-linecap="round"/><path d="M454 607C474 623 429 634 440 664" fill="none" stroke="#77b6a4" stroke-width="10" stroke-linecap="round"/><path class="stream-current" d="M454 607C474 623 429 634 440 664" fill="none" stroke="#d6eed0" stroke-width="2" stroke-dasharray="8 18"/><ellipse cx="454" cy="605" rx="24" ry="13" fill="#819b70"/><ellipse cx="453" cy="602" rx="23" ry="11" fill="url(#pool)"/><ellipse class="pond-ripple" cx="452" cy="601" rx="10" ry="3" fill="none" stroke="#e2f5d9" stroke-width="1"/><ellipse class="pond-ripple delayed" cx="452" cy="601" rx="10" ry="3" fill="none" stroke="#e2f5d9" stroke-width="1"/><path d="M435 659Q438 679 434 710Q440 716 448 711Q448 681 445 659Z" fill="url(#fall-shade)"/><path class="waterfall-current" d="M438 662Q442 686 438 710M443 664Q446 689 444 710" fill="none" stroke="#e1f6dc" stroke-width="2" stroke-linecap="round" stroke-dasharray="8 12"/><ellipse class="fall-foam" cx="441" cy="712" rx="13" ry="4" fill="#e2f1d7" opacity=".75"/><ellipse class="pond-ripple" cx="441" cy="714" rx="17" ry="5" fill="none" stroke="#d6e8cc" stroke-width="1.4"/></g><g aria-hidden="true"><path d="m470 494 8-9 13 3 4 9-13 5Z" fill="#81917b"/><path d="m470 494 8-9 13 3-9 7Z" fill="#c6c9a2"/><path d="m309 586 5-7 9 1 5 8-12 4Z" fill="#7f9275"/><path d="m309 586 5-7 9 1-7 7Z" fill="#c5cca0"/></g>${flowers}<g transform="translate(383 538)"><path d="M0 12v-27" stroke="#938258" stroke-width="2"/><path d="m-11-13 24-2 6 5-6 5-24 2Z" fill="#c6b27d"/><path d="m-7-9 18-1" stroke="#ece2b6" stroke-width="1.5"/></g>
${grove ? '<g class="new-area"><path d="m277 447 29 27" stroke="#917a57" stroke-width="16"/><path d="m277 443 29 27" stroke="#c6ad77" stroke-width="14"/><path d="m274 446 9-9m-3 15 9-9m-2 15 9-9m-3 15 9-9m-3 15 9-9" stroke="#9f895f" stroke-width="2"/></g>' : ""}${cove ? '<path d="m541 474 22-18" stroke="#e4dcae" stroke-width="9" stroke-dasharray="4 5" stroke-linecap="round"/>' : ""}${summit ? '<path d="M402 422C413 392 378 357 401 314" stroke="#d8d9b2" stroke-width="9" stroke-dasharray="4 6" stroke-linecap="round" fill="none"/>' : ""}
<g opacity="${bridge ? 1 : 0.12}" class="${bridge && reveal >= 0 ? "new-area" : ""}"><ellipse cx="167" cy="584" rx="43" ry="15" fill="#a1b89b" opacity=".3"/>${land("M132 565C137 547 171 542 193 554 218 566 198 585 172 587 142 594 122 578 132 565Z", 10)}${tree(163, 561, 0.6, 2)}<path d="M193 572q32-28 65-15" fill="none" stroke="#8c7654" stroke-width="14"/><path d="M193 568q32-28 65-15" fill="none" stroke="#c9b080" stroke-width="11"/><path d="m199 558 2 14m8-19 2 14m8-18 1 14m9-16 0 13m10-13-1 13m10-12-2 13" stroke="#9a865f" stroke-width="2"/><path d="M191 560q32-28 67-15" fill="none" stroke="#a2936c" stroke-width="1.7"/>${bridge ? '<g class="path-button" data-bridge="true" role="button" tabindex="0" aria-label="${t("bridge.aria")}"><circle cx="167" cy="569" r="36" fill="transparent"/><text class="pin-label" x="166" y="610" text-anchor="middle">${t("bridge.label")}</text></g>' : ""}</g>
${!grove || reveal === 0 ? mist("grove", reveal === 0) : ""}${!cove || reveal === 1 ? mist("cove", reveal === 1) : ""}${!summit || reveal === 2 ? mist("summit", reveal === 2) : ""}

<g class="bird" fill="none" stroke="#91a487" stroke-width="1.5" stroke-linecap="round"><path d="M521 278q5-5 10 0 5-5 10 0M546 263q4-4 8 0 4-4 8 0M274 216q4-4 8 0 4-4 8 0"/></g>${cloud(136, 475, 0.6, "cloud-slow")}${cloud(665, 568, 0.75)}${cloud(478, 139, 0.7, "cloud-slow")}<g fill="#faf6c7">${Array.from({ length: 9 }, (_, i) => `<circle class="firefly" style="animation-delay:-${i * 0.7}s" cx="${291 + i * 31}" cy="${472 + ((i * 19) % 140)}" r="2"/>`).join("")}</g>
<g id="traveller" class="traveller" transform="translate(400 568)" aria-hidden="true"><g transform="scale(1.3)"><ellipse class="traveller-shadow" cy="1" rx="8" ry="3" fill="#506c47" opacity=".22"/><g class="traveller-facing"><g class="traveller-body"><path class="leg leg-left" d="M-3-6V0" stroke="#47654b" stroke-width="3" stroke-linecap="round"/><path class="leg leg-right" d="M3-6V0" stroke="#47654b" stroke-width="3" stroke-linecap="round"/><path class="arm arm-left" d="M-6-16-9-10" stroke="#d9aa79" stroke-width="2.5" stroke-linecap="round"/><path class="arm arm-right" d="M6-16 9-10" stroke="#d9aa79" stroke-width="2.5" stroke-linecap="round"/><rect x="-6" y="-21" width="12" height="16" rx="5" fill="#d69c66"/><rect x="-8" y="-18" width="5" height="10" rx="2" fill="#ad784f"/><circle cy="-25" r="5.5" fill="#e8c49a"/><circle cx="2" cy="-25" r=".8" fill="#4e6144"/><path d="M-7-27q7-11 14 0Z" fill="#617f55"/><path d="M-8-26H8" stroke="#617f55" stroke-width="2.5" stroke-linecap="round"/></g></g></g></g>
${Object.values(routes)
  .map((r) => (r.unlock > total ? lockedPin(r, r.unlock - total) : pin(r, visited.has(r.id))))
  .join("")}`;
}

// The walking route from the cottage to a destination. Detours head west toward the bridge.
export function travelPath(r, finished = false) {
  const root = "M400 568";
  const scenic = root + "L399 568" + routes.scenic.path.slice("M399 568".length);
  const short = root + "L410 568" + routes.short.path.slice("M410 568".length);
  let path;
  if (r.kind === "detour") path = root + "C355 583 298 570 258 553" + (finished ? "Q225 540 193 568L169 568" : "");
  else if (r.id === "grove") path = scenic + "L322 489" + r.path.slice("M322 489".length);
  else if (r.id === "cove") path = short + "L503 527" + r.path.slice("M503 527".length);
  else if (r.id === "summit") path = scenic + "Q350 475 394 474" + r.path.slice("M394 474".length);
  else path = root + "L" + r.path.slice(1);
  return path;
}
function mist(area, clearing) {
  const groups = {
    grove: [
      [185, 343, 1.5],
      [245, 373, 1.25],
      [136, 382, 0.65],
    ],
    cove: [
      [585, 386, 1.55],
      [633, 413, 0.95],
    ],
    summit: [
      [379, 225, 1.55],
      [438, 251, 1.1],
      [336, 258, 0.7],
    ],
  };
  return `<g class="fog ${clearing ? "clearing" : ""}" data-mist="${area}">${groups[area].map(([x, y, scale], i) => `<g class="mist-wisp" style="transform-origin:${x}px ${y}px">${cloud(x, y, scale, i % 2 ? "cloud-slow" : "")}</g>`).join("")}</g>`;
}

export function smallIsland(symbol) {
  return `<svg viewBox="0 0 170 120" aria-hidden="true"><ellipse cx="85" cy="94" rx="54" ry="12" fill="#dce6ce"/><path d="M28 70q5-23 57-23t57 23v10q-8 20-57 20T28 80Z" fill="#aebd8d"/><ellipse cx="85" cy="69" rx="57" ry="24" fill="#cbd8a6"/><path d="m51 74 15-8 14 8" fill="none" stroke="#eee7ba" stroke-width="4" stroke-linecap="round"/><path d="M108 75V39" stroke="#9a8b5f" stroke-width="3"/><ellipse cx="108" cy="34" rx="16" ry="23" fill="#8ea870"/><ellipse cx="103" cy="31" rx="10" ry="17" fill="#a9bf82"/><circle cx="63" cy="42" r="23" fill="#f9f4da" stroke="#e1d3a1"/><g transform="translate(51 30)" fill="none" stroke="#a9aa6b" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${icons[symbol]}</g><path d="m137 28 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#d7b97b"/></svg>`;
}
