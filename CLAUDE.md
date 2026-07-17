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

Clicking (or tapping) any washer/dryer plays a scripted animation, built as an ordered list of steps in `startDogShow(machineRoot)`: walk in through the doorway → approach and face the machine → open its door/lid → pull the laundry up into its mouth → shake it for 1s → carry it to a random spot near the middle of the floor → spit it out → lift a leg and pee on it for 2s (bright yellow stream) → back up a step, still facing it → breathe red/orange fire at it for 1s → the laundry catches and burns with its own flame for 1s until nothing's left → door closes itself → walk back out. This is the "more features coming soon" part of the codebase — expect it to keep growing.

- **Machine registry**: `makeFrontLoad`/`makeTopLoad` mark their returned group with `userData.isMachineRoot = true` plus `userData.kind` (`'front'`/`'top'`), `doorPivot`/`lidPivot`, `doorOpenAngle`, and two invisible `Object3D` markers — `doorOpening` (where laundry emerges) and `standMarker` (where the dog stops, one appliance-depth in front of the door). Every individually-clickable unit (5 washers + 5 dryers, including each stacked-dryer half) is pushed into the flat `machines` array as it's placed; that array is what gets raycast.
- **Hinges, not static doors**: front-load doors are a child `doorPivot` group hinged on the door's left edge (`rotation.y` swings it open); top-load lids are a child `lidPivot` group hinged on the back edge (`rotation.x` tilts it open). A dark disc/tub mesh sits behind/under each, revealed once the door or lid opens. If you change appliance proportions, sanity-check that the open angle (`doorOpenAngle`) still clears neighboring appliances and the wall — the top-load angle is deliberately smaller than the front-load one because the lid hinges near the wall and has little clearance.
- **Picking**: `pointerdown`/`pointerup` are compared by distance and elapsed time to distinguish a tap from an orbit-drag (OrbitControls listens to the same events independently) before raycasting against `machines`. A hit mesh's ancestor chain is walked up to the nearest `isMachineRoot` object.
- **Sequencer**: `Sequencer` is a minimal step player — an array of `{duration, update(t), onStart, onEnd}` objects played in order, driven from the main `animate()` loop via `sequencer.tick(now)`. `walkStep`/`turnStep` are the two reusable step builders (position/heading lerp plus a procedural leg-swing gait keyed off distance traveled, so a walk always ends on a neutral leg pose). Every position/heading is derived from the clicked machine's `doorOpening`/`standMarker` world positions and a freshly randomized floor spot, not hand-placed coordinates, so the same code works for any machine.
- **Carrying the laundry**: while "in the dog's mouth," the laundry pile mesh is actually reparented as a child of `dog.neckPivot` at `dog.mouthLocalPos`, so it automatically follows every head shake and walk-cycle nod for free. It's reparented back to `scene` (at its current world position, via `getWorldPosition`) right before the spit-out toss. Any time a step needs a fresh world-space point mid-hierarchy-change, it calls `dog.root.updateMatrixWorld(true)` first — `three.js` only auto-refreshes matrices during `renderer.render()`, so a value read immediately after changing a rotation in the same frame needs an explicit refresh or it'll be one frame stale.
- **Fire**: `buildFlameCluster(orient, scaleMul)` is a shared helper (layered red + orange cones) used both for the dog's mouth-fire and for the laundry's own burning-in-place fire; `orient: 'z'` points the cones forward (breath), `orient: 'up'` points them up (ground fire). Deliberately *not* additive blending — additive only adds light on top of whatever's behind it, so against this scene's bright background it washed out toward white instead of reading as orange/red. Normal blending plus an explicit `renderOrder` (red base drawn first, orange core drawn on top) keeps the color solid and the layering stable across camera angles.
- **Cleanup**: the laundry pile, its burn-phase flame cluster, and the pee-stream mesh are created fresh per play and disposed (`geometry.dispose()`/`material.dispose()`) at the end of their step — the floor is left untouched, nothing persists between plays.

## Workflow

1. Edit `src/app.js` (or `src/shell-head.html` for DOM/CSS changes).
2. Run `./build.sh` to regenerate `index.html`.
3. Open `index.html` in a browser to check the change (no server needed).
4. Commit both the `src/`/`vendor/` changes and the regenerated `index.html` together.
