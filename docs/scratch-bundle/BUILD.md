# Scratch editor bundle — build recipe

The vendored static editor at `cs17_portal/public/scratch/` (served by Frappe at
`/assets/cs17_portal/scratch/editor.html`) is a **built** TurboWarp/scratch-gui fork
with our postMessage bridge compiled in. This file is the recipe to regenerate it so
the 24 MB blob is reproducible — the fork source tree and `node_modules` are NOT
committed, only the built output + this recipe + the bridge source.

## Source

- Repo: `https://github.com/TurboWarp/scratch-gui.git`
- Branch: `develop`
- Node: **v24** (see the repo's `.nvmrc`)

## Our changes to the fork

### 1. The postMessage bridge

We add a single module, `src/playground/cs17-bridge.js` (a copy is kept next to this
file as `cs17-bridge.js`), and import it from the editor playground entry so it is
compiled into `editor.html`'s bundle. It wires the Scratch VM to the host React page
over `postMessage` — protocol in `docs/scratch-integration-spec.md` section 3.

To wire it in, add this import near the top of the editor playground entry
(`src/playground/editor.jsx`, the entry that webpack builds into `editor.html`):

```js
import './cs17-bridge';
```

**Thumbnail capture uses `renderer.requestSnapshot()`, not `canvas.toDataURL()`.**
scratch-render creates its WebGL context without `preserveDrawingBuffer`, so reading
the canvas back directly returns an empty/white buffer. `requestSnapshot(cb)` renders
into a readable buffer and captures inside the same draw call, yielding a real stage
PNG. The bridge forces a `renderer.draw()` so the capture resolves immediately even on
an idle stage, and keeps it optional/non-blocking (a failed snapshot still sends the
`.sb3` without a thumbnail).

### 2. Read-only faculty player — `editor.html?readonly=1`

`editor.jsx` reads the `readonly` URL param and passes `isPlayerOnly` to the GUI, so
`editor.html?readonly=1` boots TurboWarp's built-in player-only view (stage +
green-flag/stop, no block palette / editing chrome). `render-interface.jsx` also
suppresses the player-only homepage extras (the project-URL input and the
`FeaturedProjects` grid, which fetches scratch.mit.edu and is dead offline) when
`readonly` is set, leaving just the stage and run controls.

The plain `editor.html` (no param) is the unchanged full student editor. Either way it
emits `ready`, accepts `load-project {sb3: ArrayBuffer}`, and runs the loaded project on
green flag.

**The dashboard does not use the param.** `ScratchFrame.vue` always loads the plain
`/assets/cs17_portal/scratch/editor.html`, for the student editor and for the read-only
players alike. When its `readOnly` prop is set, `applyScratchReadOnly()` in
`dashboard/src/lib/scratch.ts` adds a stylesheet to the iframe document that hides the
menu bar, the block palette, the tab list, the target pane and the backpack, makes the
blocks unclickable and blocks the context menu. The block workspace stays visible next
to the stage. The `?readonly=1` in a dashboard
URL (`/projects/:id/edit?readonly=1`) is the dashboard's own route query and is never
passed on to the iframe.

TurboWarp's anti-embed guard in `render-interface.jsx` (`isInvalidEmbed`) is also
disabled — we embed the editor in an iframe on purpose.

## publicPath (subpath hosting)

Frappe serves the bundle under `/assets/cs17_portal/scratch/`, not site root, so the
build must emit **relative** asset URLs. The webpack config already supports this:

```js
const root = process.env.ROOT || '';   // '' => relative publicPath
output: { publicPath: root }
```

Leaving `ROOT` unset (default `''`) yields a relative `publicPath`, so `editor.html`
references `js/…`, `static/…`, `images/…` relatively and resolves correctly under the
subpath. Do **not** set `ROOT` to an absolute path. `STATIC_PATH` defaults to
`/static` but its only absolute use is a Blockly media fallback that scratch-gui
overrides at runtime, so it is harmless.

## Build

```bash
nvm use            # node v24
npm ci
NODE_ENV=production npm run build   # ROOT unset -> build/ with relative paths, minified, no maps
```

`NODE_ENV=production` is required — the `build` npm script does not set it, and without
it webpack falls back to `development` mode (unminified, ~39 MB, with `.map` files).
Production mode emits ~24 MB, no source maps, hashed filenames under `js/<epoch>/`.

## Vendor into the app

```bash
# built output only — strip source maps, keep the test aids (harness.html, sample.sb3)
rsync -a --delete --exclude='*.map' --exclude='harness.html' --exclude='sample.sb3' \
    build/ <app>/cs17_portal/public/scratch/
cd <bench> && bench build --app cs17_portal
```

`harness.html` (a bare postMessage test page) and `sample.sb3` (a sample project) are
kept in the vendored dir as manual test aids; they are not produced by the build, so
the `--exclude` flags protect them from `--delete`.

Then verify: `http://cs17.localhost:8010/assets/cs17_portal/scratch/editor.html` loads
the full editor UI (no 404s in the network tab for `js/` or `static/`).
