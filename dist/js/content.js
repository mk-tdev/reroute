// Island routes and the detour activity library. Pure data: shared by the browser app,
// the recommendation engine, and the coach server. User-facing text lives in locales/.

// Routes are fixed places on the island. `unlock` is the number of completed journeys
// needed before the mist lifts from that route.
export const routes = {
  scenic: {
    id: "scenic",
    minutes: 10,
    icon: "leaf",
    setting: "outdoor",
    x: 329,
    y: 492,
    path: "M399 568C375 563 344 548 339 527S324 509 329 492",
  },
  short: {
    id: "short",
    minutes: 3,
    icon: "steps",
    setting: "indoor",
    x: 500,
    y: 530,
    path: "M410 568C434 583 471 578 481 556S496 546 500 530",
  },
  together: {
    id: "together",
    minutes: 8,
    icon: "people",
    setting: "any",
    x: 417,
    y: 635,
    path: "M401 581C376 596 382 618 417 635",
  },
  grove: {
    id: "grove",
    minutes: 4,
    icon: "leaf",
    setting: "any",
    x: 213,
    y: 371,
    unlock: 1,
    path: "M322 489C291 473 279 430 249 416S220 391 213 371",
  },
  cove: {
    id: "cove",
    minutes: 5,
    icon: "water",
    setting: "any",
    x: 598,
    y: 400,
    unlock: 2,
    path: "M503 527C532 512 535 479 556 468S586 439 598 400",
  },
  summit: {
    id: "summit",
    minutes: 6,
    icon: "sun",
    setting: "any",
    x: 400,
    y: 241,
    unlock: 3,
    path: "M394 474C416 425 380 370 400 330S411 278 400 241",
  },
};

// Places revealed by the first three completed journeys, in order.
export const places = [
  { id: "grove", icon: "leaf" },
  { id: "cove", icon: "water" },
  { id: "summit", icon: "sun" },
];

// What can get in the way. Each barrier is matched to detours that remain feasible.
export const barriers = [
  { id: "time", icon: "clock" },
  { id: "energy", icon: "cloud" },
  { id: "weather", icon: "rain" },
  { id: "space", icon: "home" },
  { id: "motivation", icon: "heart" },
];

// Detour library. Every entry is a short, low-intensity movement option written as draft
// wellbeing content; it must be reviewed by a qualified professional before a pilot.
//   setting:   indoor | outdoor | seated | any
//   intensity: gentle | light
//   barriers:  which setbacks this option still works around
export const activities = {
  "tiny-window": {
    minutes: 2,
    setting: "indoor",
    intensity: "light",
    icon: "clock",
    barriers: ["time", "space", "motivation"],
  },
  "seated-reset": {
    minutes: 1,
    setting: "seated",
    intensity: "gentle",
    icon: "seat",
    barriers: ["energy", "space", "time"],
  },
  "breathe-stretch": {
    minutes: 2,
    setting: "seated",
    intensity: "gentle",
    icon: "leaf",
    barriers: ["energy", "motivation"],
  },
  "indoor-wander": {
    minutes: 3,
    setting: "indoor",
    intensity: "light",
    icon: "home",
    barriers: ["weather", "space"],
  },
  "stairs-loop": {
    minutes: 3,
    setting: "indoor",
    intensity: "light",
    icon: "stairs",
    barriers: ["time", "weather"],
  },
  "call-walk": {
    minutes: 5,
    setting: "any",
    intensity: "light",
    icon: "phone",
    barriers: ["time", "motivation"],
  },
  "waiting-moves": {
    minutes: 2,
    setting: "indoor",
    intensity: "gentle",
    icon: "steps",
    barriers: ["time", "motivation", "space"],
  },
  "sheltered-walk": {
    minutes: 10,
    setting: "indoor",
    intensity: "light",
    icon: "home",
    barriers: ["weather"],
  },
  "shade-walk": {
    minutes: 5,
    setting: "outdoor",
    intensity: "light",
    icon: "sun",
    barriers: ["space", "motivation"],
  },
  "one-song": {
    minutes: 3,
    setting: "indoor",
    intensity: "light",
    icon: "music",
    barriers: ["motivation", "space", "weather"],
  },
  "desk-stretch": {
    minutes: 2,
    setting: "seated",
    intensity: "gentle",
    icon: "seat",
    barriers: ["space", "time", "energy"],
  },
  "slow-walk": {
    minutes: 3,
    setting: "any",
    intensity: "gentle",
    icon: "steps",
    barriers: ["energy", "motivation"],
  },
};
for (const [id, activity] of Object.entries(activities)) activity.id = id;

// Detour ids from the v2 prototype, mapped to their closest library entry.
export const legacyDetours = {
  time: "tiny-window",
  energy: "seated-reset",
  weather: "indoor-wander",
  space: "desk-stretch",
};

export const isActivity = (id) => Object.hasOwn(activities, id);
export const isRoute = (id) => Object.hasOwn(routes, id);
