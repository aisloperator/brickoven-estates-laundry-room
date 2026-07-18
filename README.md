# Brickoven Estates Laundry Room

An interactive 3D preview of the Brickoven Estates apartment building laundry room, built with [Three.js](https://threejs.org/).

**Live:** https://www.aisloperator.com/brickoven-estates-laundry-room/

## What's here

`index.html` is a single, self-contained HTML file — Three.js and OrbitControls are inlined directly into the page, so it runs entirely offline in a browser with no build step, server, or network access required.

The scene renders:

- A room with brick-orange painted walls (procedural brick texture) and a tiled floor, with a doorway gap and trim casing between the two appliance walls
- A back wall with a row of 5 Speed Queen-style commercial washers: 2 front-loaders and 3 top-loaders
- A side wall (at a right angle to the washer wall) with 5 Speed Queen-style dryers: 1 standalone front-loader and a 2×2 array of 4 stacked dryers
- A framed poster on the wall above dryer 6

Each machine has a number on its control panel — washers 1-5, dryers 6-10.

Click (or tap) any washer or dryer: a dog walks in through the doorway, opens it, pulls the laundry into its mouth and shakes it, carries it to the middle of the room and spits it out, pees on it, then breathes fire on it until it burns to nothing, before heading back out.

## Viewing it

Open `index.html` directly in Chrome, Firefox, or Safari — double-click the file or run:

```sh
open index.html        # macOS
xdg-open index.html    # Linux
```

### Controls

| Input | Action |
|---|---|
| Left drag / one-finger drag | Orbit the camera |
| Scroll wheel / pinch | Zoom |
| Right drag / two-finger drag | Pan |
| Click / tap a machine | Play the dog animation |

## Status

This is an early preview. More features are coming soon.
