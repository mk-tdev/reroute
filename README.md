# ReRoute

A mobile-first, island-led interactive prototype for the Sustaining Healthy Behaviors challenge.

## Run locally

From this folder:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173.

## Explore

- Tap any glowing path or its marker. Paths support keyboard focus and Enter/Space too.
- Start a movement timer, or select Plans changed to choose a context-specific detour.
- Preview completion simulates the activity and reveals a new island area.
- One completed journey per demo day: the grove unlocks first, then the cove, then the summit.
- A completed detour also reveals a bridge to a small island.
- Use the island menu to begin the next demo day, learn the controls, or reset local demo progress.
- Discoveries and rest days persist locally; rest never removes progress.
- Sound is optional and off by default; reduced-motion preferences are respected.

All suggestions are predefined. No AI service, wearable, patient data, messages, or health assessment is connected. The timer is real; completions are self-reported or explicitly simulated. No measured health outcome is claimed.

## Source

`dist/index.html`, `dist/style.css`, and `dist/app.js` are the complete buildless app. The map is original SVG, including large touch targets, labelled paths, unlock states, and ambient animations. Google Fonts supplies optional typography; system fonts remain as fallbacks.
