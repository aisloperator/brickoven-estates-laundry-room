# Brickoven Estates Laundry Room

An interactive 3D preview of the Brickoven Estates apartment building laundry room, built with [Three.js](https://threejs.org/).

**Live:** https://www.aisloperator.com/brickoven-estates-laundry-room/

Created by [AI Sloperator](https://www.aisloperator.com/) and Claude Code, July 2026. No license is given.

## What's here

`index.html` is a single, self-contained HTML file — Three.js and OrbitControls are inlined directly into the page, so it runs entirely offline in a browser with no build step, server, or network access required.

The scene renders:

- A room with brick-orange painted walls (procedural brick texture) and a tiled floor, with a doorway gap and trim casing between the two appliance walls
- A back wall with a row of 5 Speed Queen-style commercial washers: 2 front-loaders and 3 top-loaders
- A side wall (at a right angle to the washer wall) with 5 Speed Queen-style dryers: 1 standalone front-loader and a 2×2 array of 4 stacked dryers
- Framed posters: one above dryer 6, and 3 more evenly spaced on the wall above the washers

Each machine has a number on its control panel — washers 1-5, dryers 6-10.

Click (or tap) any washer or dryer: a dog walks in through the doorway, opens it, pulls the laundry into its mouth and shakes it, carries it to the middle of the room and spits it out, pees on it, then breathes fire on it until it burns to nothing, before heading back out.

Somewhere in the room is a messy pile of books — click (or tap) any one of them and a book flies in and opens up to fill most of the screen. Click again anywhere to close it.

Each machine also shows a live status floating in front of it: a green checkmark if it's idle, its remaining run time in red minutes if it's running, or a red X if its status can't be determined. With no `?data=` link (see below), click "Random Fake Data" (top-right) to randomize all 10 machines for a demo.

### Real status data

Loading the page as `index.html?data=<url>`, where `<url>` is a CSC Go QR-code URL (the kind printed on a sticker on a real CSC Go washer/dryer, `https://mycscgo.com/qr/<code>`), replaces "Random Fake Data" with an "Update Real Data" button that loads and displays that laundry room's actual machine statuses, and reloads them again on every press.

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
