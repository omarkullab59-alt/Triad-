# Workspace overhaul: analysis, plan and decisions

## 1. Findings (before)

| Area | Finding | Severity |
|---|---|---|
| Performance | Every tool switch created a new `WebGLRenderer`, PMREM environment and shader set, which froze the page for 1.5–2 s while shaders compiled. | high |
| Interaction | No undo/redo. One wrong slider move could not be taken back except with the browser's Back button. | high |
| Interaction | No keyboard shortcuts besides arrow keys on the focused canvas; no fixed camera views (front / side / top). | medium |
| Layout | The editor scrolled as one long web page (header, footer, sticky stepbar). The viewport lost space to the page chrome; on desktop the footer was reachable inside a tool. | medium |
| Feedback | Build state was only shown as "Building…" in the weight label; no triangle count, size or build time; errors only as warnings in the panel. | medium |
| Viewport tools | Glyph buttons (⟲ ⟳ + − ⌂) with no tooltips; flat-view switch floated over the hint text. | low |
| Design system | Tokens covered colours only; spacing, control heights, radii and elevation were ad hoc (1.5px borders, 4 / 6 / 8 px radii, 36 / 40 / 44 px heights mixed). | medium |
| Code | Notes panel re-imported `lib/designs.js` dynamically although it was already imported statically. | low |
| Code | Listeners on the canvas were never removed (fine with a throw-away renderer, a leak once the renderer is shared). | — (fixed together with the shared renderer) |

## 2. Decisions

* **Shared renderer.** `viewer.js` keeps one `WebGLRenderer` + environment for the whole session and hands the same canvas to each tool. Compiled shaders stay cached, so switching tools no longer recompiles them. Per-tool listeners use an `AbortSignal` (`viewer.signal`) and are removed on `destroy()`.
* **Desktop workspace layout (≥ 960 px).** Tools fill the window (`100dvh`, no page scroll, no footer): viewport left, properties panel right (scrolls on its own), viewport toolbar on top, status bar at the bottom. Below 960 px the layout stays stacked and touch-first (44 px targets on coarse pointers).
* **Dark first.** Without a saved choice the Studio starts in dark mode (the workspace look). Light and Auto remain selectable; the key is still shared with the TRIAD site.
* **Lime stays the only accent.** Lime marks the active / primary state only; everything else is neutral graphite.
* **Undo / redo** works on the design state (parameters, material, colours, engraving, print, destroy mode). Uploaded pictures and 3D files are not part of the history (they live outside the state on purpose: they are big and never go into links).
* **Honest labels.** Nothing visible is a placeholder: every toolbar button, menu item and shortcut has a working action; AI rendering in Draw still needs the Cloudflare Worker and says so.

## 3. Shortcuts

| Key | Action |
|---|---|
| Ctrl/⌘ Z · Ctrl/⌘ Shift Z · Ctrl/⌘ Y | Undo · redo |
| Ctrl/⌘ S | Save project (notes, concept art, collection) |
| Ctrl/⌘ E | Export panel |
| 1 · 3 · 7 · 0 | Front · side · top · perspective view |
| F | Frame the object |
| W | Wireframe on / off |
| G | Ground grid on / off |
| + / − | Zoom |
| Arrows (viewport focused) | Turn |
| ? | Shortcut list |
| Right-click on the viewport | Context menu |

## 4. Verified results (headless Chromium, software WebGL)

* Tool switch (hash change → model built): ring → pendant 434 ms, → clothing 794 ms, → ring 339 ms, → plate 563 ms, → ring again 292 ms (before: 1.5–2 s per switch).
* All 19 3D tools: every choice chip and switch in the Design panel clicked once (15–37 per tool), all Export buttons enabled, no console errors, no failed builds.
* Undo / redo (toolbar and Ctrl Z / Ctrl Shift Z), camera keys 0 1 3 7, W, G, F, ?, Ctrl S, Ctrl E, right-click menu (15 items, Esc closes), tooltips and viewport PNG export checked.
* Desktop window: the page itself never scrolls (panel scrolls on its own). Phone (iPhone 13 emulation): no horizontal overflow; viewport toolbar scrolls sideways.
* Light mode, project save via Ctrl S → shows up under “Recent projects” on the start screen → reopens with its notes.
