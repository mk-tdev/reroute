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

`dist/index.html`, `dist/style.css`, `dist/app.js`, `dist/motion.js`, and `dist/camera.js` are the complete buildless app. The map is original SVG, including large touch targets, labelled paths, unlock states, and ambient animations. Google Fonts supplies optional typography; system fonts remain as fallbacks.

## Island motion

The character samples the actual SVG curves by arc length, with a walking gait and direction changes. A new tap cancels the old destination, retraces the walked path, and takes the new branch. Unlocks retain the mist while its layers drift apart; the completion sheet waits until the reveal finishes. Reduced motion and backgrounding settle animations immediately. Progress is saved before the reveal begins.

Run animation lifecycle checks with `node --test tests/*.test.cjs`.

## Exploring the island

Drag with one finger or a mouse; pinch with two fingers or scroll to zoom. Zoom stays anchored beneath the gesture. Manual exploration pauses the follow camera; the crosshair resumes it and the corner icon frames the whole island. The camera gently follows walking and frames new areas during mist reveals. Arrow keys pan a focused island, +/− zoom, and R resets the view. Camera position is transient; habit progress remains saved.

## Living scenery

The island uses lightweight 2.5D SVG art: layered cliff faces, directional light, rounded gradient tree crowns, faceted pines, and projected shadows. Tree canopies sway independently of their rooted trunks. Animated currents connect the main pond to a waterfall; foam and expanding ripples finish the water motion. Cove water animates too. Decorative layers do not intercept taps. CSS animations pause when the tab is hidden and are disabled with reduced motion. This is illustrated depth, not a rotatable WebGL mesh.
