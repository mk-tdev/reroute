// Line icons drawn on a 24×24 grid. Stroke styling comes from the surrounding CSS.
export const icons = {
  leaf: '<path d="M19 4C8 3 3 8 6 15s14 3 13-11Z"/><path d="M4 21 16 8M9 15h5"/>',
  steps:
    '<path d="M9 3c-3 0-4 6-2 8 3 2 6-6 2-8ZM15 11c-3 0-4 6-2 8 3 2 6-6 2-8Z"/><path d="m5 14 3 1m5 7 3-1"/>',
  people:
    '<circle cx="9" cy="7" r="3"/><path d="M3 19v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v1"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v16"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4Zm12-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4Zm12 1 5 5m0-5-5 5"/>',
  menu: '<path d="M5 8h14M5 16h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  cloud: '<path d="M5 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 1 1 1 10Z"/>',
  rain: '<path d="M4 13a4 4 0 0 1 1-8 6 6 0 0 1 11 1 4 4 0 1 1 3 7M6 17l-1 3m7-3-1 3m7-3-1 3"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M10 21v-7h4v7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  water: '<path d="M2 8q3-4 6 0t6 0 6 0M2 15q3-4 6 0t6 0 6 0"/>',
  lock: '<rect x="6" y="10" width="12" height="10" rx="3"/><path d="M9 10V7a3 3 0 0 1 6 0v3m-3 5v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bridge: '<path d="M3 18V8m18 10V8M3 9q9 13 18 0M7 13v5m5-3v3m5-5v5M2 18h20"/>',
  spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  seat: '<path d="M7 4v9h10M7 13l-1 7m11-7 1 7M10 9h7"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  stairs: '<path d="M3 20h5v-5h5v-5h5V5h3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
};

export const icon = (name, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
