# CLAUDE.md

Guidance for working in this repo.

## What this is

`index.html` is an interactive 3D preview of the Brickoven Estates laundry room, rendered with Three.js. It is a single self-contained file with no build tooling required to *view* it — Three.js and OrbitControls are inlined so it runs fully offline in Chrome, Firefox, and Safari (drag/scroll/pinch to orbit, zoom, pan).

`index.html` is generated. Do not hand-edit it — edit the source below and run `./build.sh`.

## Source layout

- `src/app.js` — all scene logic: room/wall/appliance geometry, materials, procedural canvas textures, lighting, camera, and OrbitControls setup. This is the file to edit for new features.
- `src/shell-head.html` — everything before the big inline `<script>`: doctype, `<head>`, styles, and the body's static DOM (`#c` canvas, `#title`, `#hint`, `#fallback` overlays).
- `src/shell-tail.html` — closes the `<script>` tag and the document.
- `vendor/three.min.js`, `vendor/OrbitControls.js` — Three.js r0.128.0 (global/UMD build) and its matching non-module `OrbitControls.js`, vendored verbatim so the page needs zero network access. Don't bump the version casually — newer Three.js releases dropped the non-module `examples/js/controls/OrbitControls.js` in favor of ES modules, which would break the "single inlined script" approach this page relies on.
- `build.sh` — concatenates `shell-head.html` + `<script>` + the two vendor files + `app.js` + `shell-tail.html` into `index.html`. Run it after any change under `src/` or `vendor/`. It's deterministic — same inputs always produce byte-identical output.

## Scene conventions (in `src/app.js`)

- Units are meters. Room is `ROOM_W` (X) × `ROOM_D` (Z), walls are `WALL_H` tall / `WALL_T` thick.
- The back wall (at Z≈0, spanning X) holds the washers; it's split by a doorway gap (`doorGapStart`/`doorGapEnd`) with trim casing. The right wall (at X≈ROOM_W, spanning Z) holds the dryers, at a right angle to the back wall. There is no ceiling and only these two walls exist — it's an open-corner diorama so the orbit camera can always see inside.
- Appliance factories (`makeFrontLoad`, `makeTopLoad`, `makeStackedDryerColumn`) build geometry in a **local convention**: footprint centered on X, back face at local Z=0, front face at local Z=depth, base at Y=0. Placing an appliance is then just `position.set(x, 0, z)` for wall-facing-+Z placements (the washers), or the same plus `rotation.y = -Math.PI / 2` to face -X (the dryers on the right wall) — that rotation maps local +Z to world -X and local +X to world +Z, which is why the dryer row is laid out along `dryerCenters` (a Z-axis layout) even though the factory itself only knows about local Z depth.
- `layoutRow(widths, start, end, gap)` centers a row of items with given widths/gap inside a `[start, end]` span — used for both the washer row and the dryer row. Add/resize appliances by editing the `widths` arrays and factory calls, not by hand-placing coordinates.
- Textures (brick walls, floor tile, "SPEED QUEEN" control-panel decal) are generated procedurally on `<canvas>` at load time — no image assets. If you add a new canvas texture, set `tex.encoding = THREE.sRGBEncoding` on it (the renderer is configured for sRGB output; color-map textures left at the default `LinearEncoding` render washed out).

## Click-to-play dog animation

Clicking (or tapping) any washer/dryer plays a scripted animation: a dog walks in through the doorway, opens that machine's door/lid, pulls out a pile of laundry, pees on it, incinerates it with a fire-breath effect, then walks back out. This is the "more features coming soon" part of the codebase — expect it to keep growing.

- **Machine registry**: `makeFrontLoad`/`makeTopLoad` mark their returned group with `userData.isMachineRoot = true` plus `userData.kind` (`'front'`/`'top'`), `doorPivot`/`lidPivot`, `doorOpenAngle`, and two invisible `Object3D` markers — `doorOpening` (where laundry emerges) and `standMarker` (where the dog stops, one appliance-depth in front of the door). Every individually-clickable unit (5 washers + 5 dryers, including each stacked-dryer half) is pushed into the flat `machines` array as it's placed; that array is what gets raycast.
- **Hinges, not static doors**: front-load doors are a child `doorPivot` group hinged on the door's left edge (`rotation.y` swings it open); top-load lids are a child `lidPivot` group hinged on the back edge (`rotation.x` tilts it open). A dark disc/tub mesh sits behind/under each, revealed once the door or lid opens. If you change appliance proportions, sanity-check that the open angle (`doorOpenAngle`) still clears neighboring appliances and the wall — the top-load angle is deliberately smaller than the front-load one because the lid hinges near the wall and has little clearance.
- **Picking**: `pointerdown`/`pointerup` are compared by distance and elapsed time to distinguish a tap from an orbit-drag (OrbitControls listens to the same events independently) before raycasting against `machines`. A hit mesh's ancestor chain is walked up to the nearest `isMachineRoot` object.
- **Sequencer**: `Sequencer` is a minimal step player — an array of `{duration, update(t), onStart, onEnd}` objects played in order, driven from the main `animate()` loop via `sequencer.tick(now)`. `walkStep`/`turnStep` are the two reusable step builders (position/heading lerp plus a procedural leg-swing gait keyed off distance traveled, so a walk always ends on a neutral leg pose). `startDogShow(machineRoot)` builds the full step list per click, deriving every position/heading from the clicked machine's `doorOpening`/`standMarker` world positions rather than hand-placed coordinates, so it works for any machine without per-machine-type special-casing.
- **Cleanup**: the laundry pile and pee-stream meshes are created fresh per play and disposed (`geometry.dispose()`/`material.dispose()`) at the end of their step; scorch marks left on the floor persist but are capped (oldest removed past 16) to avoid unbounded growth over a long session.

## Workflow

1. Edit `src/app.js` (or `src/shell-head.html` for DOM/CSS changes).
2. Run `./build.sh` to regenerate `index.html`.
3. Open `index.html` in a browser to check the change (no server needed).
4. Commit both the `src/`/`vendor/` changes and the regenerated `index.html` together.
