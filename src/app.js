(function () {
  'use strict';

  // ---------- renderer / scene / camera ----------
  var canvas = document.getElementById('c');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) {
    document.getElementById('fallback').style.display = 'flex';
    return;
  }
  if (!renderer.getContext()) {
    document.getElementById('fallback').style.display = 'flex';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  if (renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = false;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6ea);
  scene.fog = new THREE.Fog(0xdfe6ea, 14, 30);

  var ROOM_W = 8.4;   // along X
  var ROOM_D = 4.6;   // along Z
  var WALL_H = 3.0;
  var WALL_T = 0.15;

  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  // Positioned off to the open front-left of the room, elevated, looking
  // back across it toward the doorway — see the controls.target comment
  // below for why. Kept off to the left and pulled back this far so the
  // leftmost washer still clears the frame even though the look-at point
  // is well off-center (near the doorway, not room-center).
  camera.position.set(ROOM_W * 0.22, 5.0, ROOM_D * 2.5);

  // ---------- lights ----------
  var hemi = new THREE.HemisphereLight(0xf3ede2, 0x8a6a4a, 0.65);
  scene.add(hemi);

  var sun = new THREE.DirectionalLight(0xfff3df, 1.05);
  sun.position.set(ROOM_W * 0.3, 6.5, ROOM_D * 2.4);
  sun.target.position.set(ROOM_W * 0.5, 0, ROOM_D * 0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);

  var fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
  fill.position.set(-4, 4, -3);
  scene.add(fill);

  // ---------- procedural textures ----------
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function shade(hex, amt) {
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function createBrickTexture(baseHex, repeatX, repeatY) {
    var cw = 512, ch = 256;
    var cnv = makeCanvas(cw, ch);
    var ctx = cnv.getContext('2d');
    ctx.fillStyle = shade(baseHex, -10);
    ctx.fillRect(0, 0, cw, ch);

    var brickW = 64, brickH = 26, mortar = 5;
    var rows = Math.ceil(ch / brickH) + 1;
    for (var row = 0; row < rows; row++) {
      var y = row * brickH;
      var offset = (row % 2 === 0) ? 0 : -brickW / 2;
      for (var x = offset; x < cw + brickW; x += brickW) {
        var variance = Math.floor(Math.random() * 18) - 9;
        ctx.fillStyle = shade(baseHex, variance);
        ctx.fillRect(x + mortar / 2, y + mortar / 2, brickW - mortar, brickH - mortar);
      }
    }
    // subtle paint roller streaks
    ctx.globalAlpha = 0.05;
    for (var i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
      ctx.fillRect(Math.random() * cw, Math.random() * ch, Math.random() * 40 + 10, 1.5);
    }
    ctx.globalAlpha = 1;

    var tex = new THREE.CanvasTexture(cnv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function createFloorTexture() {
    var cw = 512, ch = 512;
    var cnv = makeCanvas(cw, ch);
    var ctx = cnv.getContext('2d');
    ctx.fillStyle = '#c7c9cc';
    ctx.fillRect(0, 0, cw, ch);
    var tile = 64;
    for (var y = 0; y < ch; y += tile) {
      for (var x = 0; x < cw; x += tile) {
        var v = Math.floor(Math.random() * 14) - 7;
        ctx.fillStyle = shade(0xc7c9cc, v);
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }
    ctx.strokeStyle = 'rgba(120,124,130,0.5)';
    ctx.lineWidth = 2;
    for (var gx = 0; gx <= cw; gx += tile) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ch); ctx.stroke();
    }
    for (var gy = 0; gy <= ch; gy += tile) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(cw, gy); ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(cnv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ROOM_W / 1.1, ROOM_D / 1.1);
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function createLogoTexture() {
    var cnv = makeCanvas(512, 128);
    var ctx = cnv.getContext('2d');
    ctx.fillStyle = '#0d5aa7';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPEED QUEEN', 256, 52);
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#cfe3f7';
    ctx.fillText('C O M M E R C I A L', 256, 92);
    var tex = new THREE.CanvasTexture(cnv);
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var brickTex = createBrickTexture(0xb5522b, ROOM_W / 1.4, WALL_H / 1.4);
  var brickTexSide = createBrickTexture(0xb5522b, ROOM_D / 1.4, WALL_H / 1.4);
  var floorTex = createFloorTexture();
  var logoTex = createLogoTexture();

  var wallMatBack = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.92, metalness: 0.02 });
  var wallMatSide = new THREE.MeshStandardMaterial({ map: brickTexSide, roughness: 0.92, metalness: 0.02 });
  var trimMat = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.6 });
  var baseboardMat = new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.7 });

  // ---------- floor ----------
  var floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  var floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 });
  var floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM_W / 2, 0, ROOM_D / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------- walls ----------
  // Back wall runs along X at Z=0, split by a doorway gap.
  var doorGapStart = 5.6, doorGapEnd = 6.9, doorHeight = 2.15;
  function addWallSegment(x0, x1, mat) {
    var w = x1 - x0;
    if (w <= 0.01) return;
    var geo = new THREE.BoxGeometry(w, WALL_H, WALL_T);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x0 + w / 2, WALL_H / 2, -WALL_T / 2);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  addWallSegment(0, doorGapStart, wallMatBack);
  addWallSegment(doorGapEnd, ROOM_W, wallMatBack);
  // header above the doorway
  (function () {
    var w = doorGapEnd - doorGapStart;
    var headerH = WALL_H - doorHeight;
    var geo = new THREE.BoxGeometry(w, headerH, WALL_T);
    var mesh = new THREE.Mesh(geo, wallMatBack);
    mesh.position.set((doorGapStart + doorGapEnd) / 2, doorHeight + headerH / 2, -WALL_T / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  })();
  // door casing trim posts + header face
  function trimBox(x, y, z, w, h, d) {
    var geo = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(geo, trimMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  trimBox(doorGapStart - 0.04, doorHeight / 2, -WALL_T / 2, 0.08, doorHeight, WALL_T + 0.04);
  trimBox(doorGapEnd + 0.04, doorHeight / 2, -WALL_T / 2, 0.08, doorHeight, WALL_T + 0.04);
  trimBox((doorGapStart + doorGapEnd) / 2, doorHeight + 0.04, -WALL_T / 2, (doorGapEnd - doorGapStart) + 0.16, 0.08, WALL_T + 0.04);

  // Right wall runs along Z at X = ROOM_W
  var rightWall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, ROOM_D), wallMatSide);
  rightWall.position.set(ROOM_W + WALL_T / 2, WALL_H / 2, ROOM_D / 2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // baseboards
  function baseboard(x, z, w, d) {
    var geo = new THREE.BoxGeometry(w, 0.12, d);
    var mesh = new THREE.Mesh(geo, baseboardMat);
    mesh.position.set(x, 0.06, z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  baseboard(doorGapStart / 2, 0.05, doorGapStart, 0.1);
  baseboard((doorGapEnd + ROOM_W) / 2, 0.05, ROOM_W - doorGapEnd, 0.1);
  baseboard(ROOM_W - 0.05, ROOM_D / 2, 0.1, ROOM_D);

  // ---------- appliance materials ----------
  var bodyWhite = new THREE.MeshStandardMaterial({ color: 0xf2f2ef, roughness: 0.45, metalness: 0.15 });
  var bodyAlmond = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.5, metalness: 0.1 });
  var doorGlass = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.12, metalness: 0.3 });
  var chrome = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, roughness: 0.25, metalness: 0.85 });
  var panelBlue = new THREE.MeshStandardMaterial({ color: 0x0d5aa7, roughness: 0.5, metalness: 0.2 });
  var knobDark = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.4, metalness: 0.3 });
  var legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

  function addShadowFlags(obj) {
    obj.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  function decalPlane(w, h) {
    var geo = new THREE.PlaneGeometry(w, h);
    var mat = new THREE.MeshStandardMaterial({ map: logoTex, roughness: 0.5, metalness: 0.1 });
    return new THREE.Mesh(geo, mat);
  }

  var drumDarkMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 });
  var doorWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.4, metalness: 0.08 });

  // A rounded-rectangle outline centered on its own origin, for the flat
  // washer door panel (ShapeGeometry gives it a +Z-facing normal already,
  // matching how the round door/glass discs are oriented).
  function roundedRectShape(w, h, r) {
    var x = -w / 2, y = -h / 2;
    var shape = new THREE.Shape();
    shape.moveTo(x, y + r);
    shape.lineTo(x, y + h - r);
    shape.quadraticCurveTo(x, y + h, x + r, y + h);
    shape.lineTo(x + w - r, y + h);
    shape.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
    shape.lineTo(x + w, y + r);
    shape.quadraticCurveTo(x + w, y, x + w - r, y);
    shape.lineTo(x + r, y);
    shape.quadraticCurveTo(x, y, x, y + r);
    return shape;
  }

  // Local convention: appliance footprint centered on X, back face at Z=0, front face at Z=depth, base at Y=0.
  // doorStyle: 'round' (default, chrome-rimmed glass circle) or 'rect' (white rounded-rectangle panel).
  function makeFrontLoad(width, height, depth, bodyMat, doorStyle) {
    var g = new THREE.Group();

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    cabinet.position.set(0, height / 2, depth / 2);
    g.add(cabinet);

    var doorR = Math.min(width, height) * 0.32;
    var doorY = height * 0.42;

    // Dark recessed drum, visible once the door swings open.
    var drum = new THREE.Mesh(new THREE.CylinderGeometry(doorR - 0.01, doorR - 0.01, 0.02, 24), drumDarkMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, doorY, depth + 0.005);
    g.add(drum);

    // Door is hinged on its left edge so it can swing open.
    // Sized (with margin) to fully cover the circular drum hole behind it.
    var doorW = doorR * 2.6, doorH = doorR * 2.8;
    var doorHalfW = doorStyle === 'rect' ? doorW / 2 : doorR;
    var doorPivot = new THREE.Group();
    doorPivot.position.set(-doorHalfW, doorY, depth + 0.02);
    g.add(doorPivot);

    if (doorStyle === 'rect') {
      // Extruded (not flat) and left proud of the cabinet face so it reads
      // as a solid door, including edge-on while swung open.
      var doorThickness = 0.045;
      var doorShape = roundedRectShape(doorW, doorH, doorR * 0.4);
      var doorGeo = new THREE.ExtrudeGeometry(doorShape, { depth: doorThickness, bevelEnabled: false, curveSegments: 12 });
      var doorPanel = new THREE.Mesh(doorGeo, doorWhiteMat);
      doorPanel.position.set(doorHalfW, 0, 0);
      doorPivot.add(doorPanel);
    } else {
      var rim = new THREE.Mesh(new THREE.CylinderGeometry(doorR + 0.035, doorR + 0.035, 0.03, 28), chrome);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(doorR, 0, 0);
      doorPivot.add(rim);

      var glass = new THREE.Mesh(new THREE.CylinderGeometry(doorR, doorR, 0.02, 28), doorGlass);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(doorR, 0, 0.015);
      doorPivot.add(glass);
    }

    var panelH = height * 0.16;
    var panel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, panelH, 0.05), panelBlue);
    panel.position.set(0, height - panelH / 2 - 0.03, depth + 0.02);
    g.add(panel);

    var decal = decalPlane(width * 0.8, panelH * 0.7);
    decal.position.set(0, height - panelH / 2 - 0.03, depth + 0.05);
    g.add(decal);

    var legH = 0.08;
    [-1, 1].forEach(function (sx) {
      [0.05, depth - 0.05].forEach(function (lz) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), legMat);
        leg.position.set(sx * (width / 2 - 0.06), legH / 2, lz);
        g.add(leg);
      });
    });

    // Markers used by the click-to-play dog animation (not rendered geometry).
    var doorOpening = new THREE.Object3D();
    doorOpening.position.set(0, doorY, depth + 0.03);
    g.add(doorOpening);

    var standMarker = new THREE.Object3D();
    standMarker.position.set(0, 0, depth + 0.55);
    g.add(standMarker);

    g.userData.isMachineRoot = true;
    g.userData.kind = 'front';
    g.userData.doorPivot = doorPivot;
    g.userData.doorOpenAngle = -1.9;
    g.userData.doorOpening = doorOpening;
    g.userData.standMarker = standMarker;

    addShadowFlags(g);
    return g;
  }

  function makeTopLoad(width, height, depth, bodyMat) {
    var g = new THREE.Group();
    var tubY = height * 0.86;
    var lidH = height * 0.05;

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, tubY, depth), bodyMat);
    cabinet.position.set(0, tubY / 2, depth / 2);
    g.add(cabinet);

    var tub = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.4, width * 0.4, 0.03, 24), drumDarkMat);
    tub.position.set(0, tubY + 0.005, depth / 2);
    g.add(tub);

    // Lid is hinged along its back edge so it can tilt open.
    var lidDepth = depth * 0.95;
    var lidPivot = new THREE.Group();
    lidPivot.position.set(0, tubY, depth / 2 - lidDepth / 2);
    g.add(lidPivot);

    // White, with rounded corners in footprint (extruded up out of the
    // shape's plane, then rotated so that extrusion becomes the lid's
    // thickness instead of its width or depth).
    var lidW = width * 0.97;
    var lidCorner = Math.min(lidW, lidDepth) * 0.15;
    var lidShape = roundedRectShape(lidW, lidDepth, lidCorner);
    var lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: lidH, bevelEnabled: false, curveSegments: 10 });
    var lid = new THREE.Mesh(lidGeo, doorWhiteMat);
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(0, 0, lidDepth / 2);
    lidPivot.add(lid);

    var console_ = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, height * 0.14, 0.08), panelBlue);
    console_.position.set(0, height * 0.86 + height * 0.05 + (height * 0.14) / 2, depth * 0.12);
    g.add(console_);

    var decal = decalPlane(width * 0.75, height * 0.1);
    decal.position.set(0, height * 0.86 + height * 0.05 + (height * 0.14) / 2, depth * 0.12 + 0.045);
    g.add(decal);

    for (var i = -1; i <= 1; i++) {
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), knobDark);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(i * width * 0.22, height * 0.86 + height * 0.05 + (height * 0.14) / 2, depth * 0.12 + 0.05);
      g.add(knob);
    }

    var legH = 0.08;
    [-1, 1].forEach(function (sx) {
      [0.05, depth - 0.05].forEach(function (lz) {
        var leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, legH, 0.06), legMat);
        leg.position.set(sx * (width / 2 - 0.06), legH / 2, lz);
        g.add(leg);
      });
    });

    // Markers used by the click-to-play dog animation (not rendered geometry).
    var doorOpening = new THREE.Object3D();
    doorOpening.position.set(0, tubY + 0.06, depth / 2);
    g.add(doorOpening);

    var standMarker = new THREE.Object3D();
    standMarker.position.set(0, 0, depth + 0.55);
    g.add(standMarker);

    g.userData.isMachineRoot = true;
    g.userData.kind = 'top';
    g.userData.lidPivot = lidPivot;
    // Leans forward of vertical (rather than tipping past it) so the open
    // lid's swept path fully brackets the console's depth, obscuring it.
    g.userData.doorOpenAngle = -1.35;
    g.userData.doorOpening = doorOpening;
    g.userData.standMarker = standMarker;

    addShadowFlags(g);
    return g;
  }

  function makeStackedDryerColumn(width, depth) {
    var g = new THREE.Group();
    var h1 = 0.98, h2 = 0.95;
    var bottom = makeFrontLoad(width, h1, depth, bodyWhite, 'rect');
    g.add(bottom);
    var top = makeFrontLoad(width, h2, depth, bodyWhite, 'rect');
    top.position.y = h1 + 0.03;
    g.add(top);
    var seam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.01, 0.03, depth + 0.01), legMat);
    seam.position.set(0, h1 + 0.015, depth / 2);
    g.add(seam);
    return g;
  }

  // ---------- layout helper: centers a row of items of given widths within [start,end] ----------
  function layoutRow(widths, start, end, gap) {
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (widths.length - 1);
    var cursor = start + (end - start - total) / 2;
    var centers = [];
    for (var i = 0; i < widths.length; i++) {
      centers.push(cursor + widths[i] / 2);
      cursor += widths[i] + gap;
    }
    return centers;
  }

  // Machines a user can click to trigger the dog animation.
  var machines = [];

  // ---------- place washers on back wall (facing +Z into the room) ----------
  var flW = 0.72, flD = 0.70, flH = 1.00;
  var tlW = 0.68, tlD = 0.68, tlH = 1.05;
  var washerWidths = [flW, flW, tlW, tlW, tlW];
  var washerCenters = layoutRow(washerWidths, 0.35, doorGapStart - 0.25, 0.16);

  for (var wi = 0; wi < washerWidths.length; wi++) {
    var unit;
    if (wi < 2) {
      unit = makeFrontLoad(flW, flH, flD, bodyWhite);
    } else {
      unit = makeTopLoad(tlW, tlH, tlD, bodyAlmond);
    }
    unit.position.set(washerCenters[wi], 0, WALL_T);
    scene.add(unit);
    machines.push(unit);
  }

  // ---------- place dryers on right wall (facing -X into the room) ----------
  var dfW = 0.72, dfD = 0.70;
  var dryerWidths = [dfW, dfW, dfW]; // standalone, stack col 1, stack col 2
  var dryerCenters = layoutRow(dryerWidths, 0.35, ROOM_D - 0.35, 0.22);

  var standaloneDryer = makeFrontLoad(dfW, 1.0, dfD, bodyWhite, 'rect');
  standaloneDryer.rotation.y = -Math.PI / 2;
  standaloneDryer.position.set(ROOM_W - WALL_T, 0, dryerCenters[0]);
  scene.add(standaloneDryer);
  machines.push(standaloneDryer);

  [1, 2].forEach(function (idx) {
    var col = makeStackedDryerColumn(dfW, dfD);
    col.rotation.y = -Math.PI / 2;
    col.position.set(ROOM_W - WALL_T, 0, dryerCenters[idx]);
    scene.add(col);
    col.children.forEach(function (child) {
      if (child.userData && child.userData.isMachineRoot) machines.push(child);
    });
  });

  // ---------- click-to-play dog animation ----------
  // A tiny sequential animator: each step runs for `duration` ms, calling
  // update(t) every frame with t in [0,1], then onEnd() before the next step.
  function Sequencer(steps) {
    this.steps = steps;
    this.index = 0;
    this.stepStart = performance.now();
    this.done = steps.length === 0;
    if (!this.done && steps[0].onStart) steps[0].onStart();
  }
  Sequencer.prototype.tick = function (now) {
    if (this.done) return;
    var step = this.steps[this.index];
    var t = Math.min(1, (now - this.stepStart) / step.duration);
    step.update(t);
    if (t >= 1) {
      if (step.onEnd) step.onEnd();
      this.index++;
      if (this.index >= this.steps.length) { this.done = true; return; }
      this.stepStart = now;
      var next = this.steps[this.index];
      if (next.onStart) next.onStart();
    }
  };

  function angleLerp(a, b, t) {
    var d = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    return a + d * t;
  }

  // orient 'z' = cones point forward (mouth breath), 'up' = cones point up (ground fire).
  function buildFlameCluster(orient, scaleMul) {
    scaleMul = scaleMul || 1;
    // Normal (non-additive) blending so the flame reads as solid orange/red
    // instead of adding onto the bright background and washing out toward
    // white. Explicit renderOrder keeps the orange core stably drawn on top
    // of the red outer cone regardless of camera angle.
    var specs = [
      { r: 0.085 * scaleMul, h: 0.66 * scaleMul, color: 0xd22600, opacity: 0.92, renderOrder: 0 },
      { r: 0.05 * scaleMul, h: 0.42 * scaleMul, color: 0xff7a00, opacity: 0.95, renderOrder: 1 }
    ];
    var group = new THREE.Group();
    var cones = specs.map(function (spec) {
      var mat = new THREE.MeshBasicMaterial({
        color: spec.color, transparent: true, opacity: spec.opacity, depthWrite: false
      });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(spec.r, spec.h, 10), mat);
      cone.renderOrder = spec.renderOrder;
      if (orient === 'z') {
        cone.rotation.x = Math.PI / 2;
        cone.position.z = spec.h / 2;
      } else {
        cone.position.y = spec.h / 2;
      }
      group.add(cone);
      return cone;
    });
    return { group: group, cones: cones };
  }

  function buildDog() {
    var furMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.85 });
    var furDarkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.85 });
    var blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });

    var dog = new THREE.Group();
    var hip = 0.22, bodyW = 0.18, bodyH = 0.20, bodyL = 0.46;

    var body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL), furMat);
    body.position.set(0, hip + bodyH / 2, 0);
    dog.add(body);

    var neckPivot = new THREE.Group();
    neckPivot.position.set(0, hip + bodyH * 0.72, bodyL / 2);
    dog.add(neckPivot);

    var headW = 0.15, headH = 0.14, headD = 0.15;
    var head = new THREE.Mesh(new THREE.BoxGeometry(headW, headH, headD), furMat);
    head.position.set(0, headH * 0.15, headD / 2);
    neckPivot.add(head);

    var snout = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.09), furMat);
    snout.position.set(0, headH * 0.05, headD + 0.045);
    neckPivot.add(snout);

    [-1, 1].forEach(function (sx) {
      var ear = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.06), furDarkMat);
      ear.position.set(sx * headW * 0.38, headH * 0.15 + headH * 0.55, headD * 0.35);
      ear.rotation.z = sx * 0.3;
      neckPivot.add(ear);

      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), blackMat);
      eye.position.set(sx * headW * 0.28, headH * 0.2, headD + 0.01);
      neckPivot.add(eye);
    });

    var nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), blackMat);
    nose.position.set(0, headH * 0.03, headD + 0.09);
    neckPivot.add(nose);

    // Fire-breath cluster, hidden until the incineration step.
    var mouthFire = buildFlameCluster('z');
    var mouthFireGroup = mouthFire.group;
    mouthFireGroup.position.set(0, headH * 0.02, headD + 0.09);
    neckPivot.add(mouthFireGroup);
    mouthFireGroup.visible = false;

    // Where a carried item hangs from the mouth, in neckPivot-local space.
    var mouthLocalPos = new THREE.Vector3(0, headH * 0.02 - 0.03, headD + 0.06);

    function makeLeg(sx, sz) {
      var pivot = new THREE.Group();
      pivot.position.set(sx * (bodyW / 2 - 0.015), hip, sz * (bodyL * 0.32));
      dog.add(pivot);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, hip, 0.05), furDarkMat);
      leg.position.set(0, -hip / 2, 0);
      pivot.add(leg);
      var paw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.07), blackMat);
      paw.position.set(0, -hip + 0.015, 0.01);
      pivot.add(paw);
      return pivot;
    }
    var legFL = makeLeg(1, 1), legFR = makeLeg(-1, 1), legBL = makeLeg(1, -1), legBR = makeLeg(-1, -1);

    var tailPivot = new THREE.Group();
    tailPivot.position.set(0, hip + bodyH * 0.78, -bodyL / 2);
    tailPivot.rotation.x = -0.4;
    dog.add(tailPivot);
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.26, 8), furDarkMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.13;
    tailPivot.add(tail);

    addShadowFlags(dog);
    dog.visible = false;
    scene.add(dog);

    return {
      root: dog,
      neckPivot: neckPivot,
      legFL: legFL, legFR: legFR, legBL: legBL, legBR: legBR,
      tailPivot: tailPivot,
      mouthFireGroup: mouthFireGroup,
      mouthLocalPos: mouthLocalPos
    };
  }
  var dog = buildDog();

  function setLegs(swing) {
    dog.legFL.rotation.x = swing;
    dog.legBR.rotation.x = swing;
    dog.legFR.rotation.x = -swing;
    dog.legBL.rotation.x = -swing;
  }

  function walkStep(from, to, heading, speed) {
    var dist = from.distanceTo(to);
    var duration = Math.max(280, (dist / speed) * 1000);
    var strideLen = 0.5;
    var numStrides = Math.max(1, Math.round(dist / strideLen));
    return {
      duration: duration,
      onStart: function () { dog.root.visible = true; },
      update: function (t) {
        dog.root.position.set(from.x + (to.x - from.x) * t, 0, from.z + (to.z - from.z) * t);
        dog.root.rotation.y = heading;
        var phase = t * numStrides * Math.PI * 2;
        setLegs(Math.sin(phase) * 0.55);
        dog.root.position.y = Math.abs(Math.sin(phase)) * 0.015;
        dog.tailPivot.rotation.y = Math.sin(phase * 1.3) * 0.45;
        dog.neckPivot.rotation.x = Math.sin(phase) * 0.04;
      }
    };
  }

  function turnStep(heading0, heading1, duration) {
    return {
      duration: duration || 260,
      update: function (t) {
        dog.root.rotation.y = angleLerp(heading0, heading1, t);
        setLegs(0);
        dog.tailPivot.rotation.y = Math.sin(t * Math.PI * 4) * 0.3;
      }
    };
  }

  function createLaundryPile() {
    var g = new THREE.Group();
    var colors = [0xd94f4f, 0x3f7cd6, 0xf2f2ef, 0x4fae5c, 0xe0c23c, 0x9a5fc9];
    var n = 5;
    for (var i = 0; i < n; i++) {
      var s = 0.09 + Math.random() * 0.06;
      var mat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.85
      });
      var piece = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.7, s * 1.1), mat);
      var ang = (i / n) * Math.PI * 2;
      piece.position.set(Math.cos(ang) * 0.06, s * 0.35 + i * 0.015, Math.sin(ang) * 0.06);
      piece.rotation.set(Math.random() * 1, Math.random() * Math.PI * 2, Math.random() * 1);
      g.add(piece);
    }
    addShadowFlags(g);
    return g;
  }

  function cylinderBetween(p1, p2, radius, material) {
    var dir = new THREE.Vector3().subVectors(p2, p1);
    var len = Math.max(0.01, dir.length());
    var geo = new THREE.CylinderGeometry(radius, radius, len, 8);
    var mesh = new THREE.Mesh(geo, material);
    var mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  var peeMat = new THREE.MeshStandardMaterial({
    color: 0xffe600, transparent: true, opacity: 0.85, roughness: 0.25, emissive: 0x7a6400, emissiveIntensity: 0.6
  });
  var puddleMat = new THREE.MeshStandardMaterial({
    color: 0xe0c400, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.1,
    emissive: 0x6b5a00, emissiveIntensity: 0.35
  });

  var sequencer = null;
  var doorwayX = (doorGapStart + doorGapEnd) / 2;

  function startDogShow(machineRoot) {
    if (sequencer && !sequencer.done) return;

    var kind = machineRoot.userData.kind;
    var doorOpeningPos = new THREE.Vector3();
    machineRoot.userData.doorOpening.getWorldPosition(doorOpeningPos);
    var standPos = new THREE.Vector3();
    machineRoot.userData.standMarker.getWorldPosition(standPos);
    standPos.y = 0;
    var machineHeading = machineRoot.rotation.y + Math.PI;

    var outsidePos = new THREE.Vector3(doorwayX, 0, -1.3);
    var doorwayPos = new THREE.Vector3(doorwayX, 0, 0.35);

    // A random spot away from the walls, near the middle of the room floor.
    var randomSpot = new THREE.Vector3(
      ROOM_W * 0.5 + (Math.random() - 0.5) * 2.2,
      0,
      ROOM_D * 0.5 + (Math.random() - 0.5) * 1.4
    );
    var carryHeading = Math.atan2(randomSpot.x - standPos.x, randomSpot.z - standPos.z);
    var forwardVec = new THREE.Vector3(Math.sin(carryHeading), 0, Math.cos(carryHeading));
    var laundryTarget = randomSpot.clone().add(forwardVec.clone().multiplyScalar(0.32));
    laundryTarget.y = 0;
    // Where the dog backs up to before breathing fire, still facing the laundry.
    var backUpPos = randomSpot.clone().add(forwardVec.clone().multiplyScalar(-0.55));
    backUpPos.y = 0;

    var enterHeading = Math.atan2(doorwayPos.x - outsidePos.x, doorwayPos.z - outsidePos.z);
    var approachHeading = Math.atan2(standPos.x - doorwayPos.x, standPos.z - doorwayPos.z);
    var exitHeadingA = Math.atan2(doorwayPos.x - backUpPos.x, doorwayPos.z - backUpPos.z);
    var exitHeadingB = Math.atan2(outsidePos.x - doorwayPos.x, outsidePos.z - doorwayPos.z);

    var laundry = createLaundryPile();
    laundry.visible = false;
    laundry.position.copy(doorOpeningPos);
    laundry.scale.setScalar(0.001);
    scene.add(laundry);

    var openPivot = kind === 'front' ? machineRoot.userData.doorPivot : machineRoot.userData.lidPivot;
    var openAxis = kind === 'front' ? 'y' : 'x';
    var openAngle = machineRoot.userData.doorOpenAngle;

    var peeStream = null;
    var puddle = null;
    var laundryFire = null;
    var mouthWorldAtGrab = new THREE.Vector3();
    var spitStartPos = new THREE.Vector3();

    var steps = [
      walkStep(outsidePos, doorwayPos, enterHeading, 1.6),
      walkStep(doorwayPos, standPos, approachHeading, 1.6),
      turnStep(approachHeading, machineHeading, 260),

      // Open the door / lid.
      {
        duration: 550,
        update: function (t) {
          var e = t * t * (3 - 2 * t);
          openPivot.rotation[openAxis] = openAngle * e;
          dog.neckPivot.rotation.x = 0.35 * e;
        }
      },

      // Pull the laundry out and up into the dog's mouth.
      {
        duration: 700,
        onStart: function () {
          laundry.visible = true;
          dog.root.updateMatrixWorld(true);
          mouthWorldAtGrab.copy(dog.mouthLocalPos).applyMatrix4(dog.neckPivot.matrixWorld);
        },
        update: function (t) {
          var e = t * t * (3 - 2 * t);
          laundry.position.lerpVectors(doorOpeningPos, mouthWorldAtGrab, e);
          laundry.position.y += Math.sin(e * Math.PI) * 0.12;
          laundry.scale.setScalar(0.001 + e * 0.999);
          laundry.rotation.y = e * 3.2;
        },
        onEnd: function () {
          dog.neckPivot.add(laundry);
          laundry.position.copy(dog.mouthLocalPos);
          laundry.rotation.set(0, 0, 0);
          laundry.scale.setScalar(1);
        }
      },

      // Shake the life out of it.
      {
        duration: 1000,
        update: function (t) {
          var shake = Math.sin(t * Math.PI * 2 * 6);
          dog.neckPivot.rotation.z = shake * 0.4;
          dog.neckPivot.rotation.x = 0.35 - 0.2 * Math.min(1, t / 0.3);
          laundry.rotation.z = -shake * 0.5;
          laundry.rotation.x = Math.sin(t * Math.PI * 2 * 5 + 1) * 0.3;
        },
        onEnd: function () {
          dog.neckPivot.rotation.z = 0;
          dog.neckPivot.rotation.x = 0.15;
          laundry.rotation.set(0, 0, 0);
        }
      },

      // Carry it to a spot near the middle of the room.
      walkStep(standPos, randomSpot, carryHeading, 1.5),

      // Spit it out onto the floor.
      {
        duration: 450,
        onStart: function () {
          laundry.getWorldPosition(spitStartPos);
          scene.add(laundry);
          laundry.position.copy(spitStartPos);
          laundry.rotation.set(0, 0, 0);
          laundry.scale.setScalar(1);
        },
        update: function (t) {
          var e = t * t * (3 - 2 * t);
          laundry.position.x = spitStartPos.x + (laundryTarget.x - spitStartPos.x) * e;
          laundry.position.z = spitStartPos.z + (laundryTarget.z - spitStartPos.z) * e;
          laundry.position.y = spitStartPos.y * (1 - e) + Math.sin(e * Math.PI) * 0.18;
          laundry.rotation.x = e * 4;
          dog.neckPivot.rotation.x = 0.15 + Math.sin(e * Math.PI) * 0.25;
        },
        onEnd: function () {
          laundry.position.copy(laundryTarget);
          laundry.rotation.set(0, 0, 0);
          dog.neckPivot.rotation.x = 0;
        }
      },

      // Lift a leg and pee on the pile for 2 seconds.
      {
        duration: 2000,
        onStart: function () {
          var hipPos = new THREE.Vector3();
          dog.legBR.getWorldPosition(hipPos);
          hipPos.y = 0.16;
          peeStream = cylinderBetween(hipPos, laundryTarget.clone().setY(0.02), 0.012, peeMat);
          scene.add(peeStream);
          peeStream.visible = false;

          puddle = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), puddleMat);
          puddle.rotation.x = -Math.PI / 2;
          puddle.position.set(laundryTarget.x, 0.003, laundryTarget.z);
          puddle.scale.setScalar(0.001);
          scene.add(puddle);
        },
        update: function (t) {
          var liftIn = Math.min(1, t / 0.12);
          dog.legBR.rotation.z = -1.1 * (t < 0.85 ? liftIn : liftIn * (1 - (t - 0.85) / 0.15));
          dog.legBR.rotation.x = -0.3 * liftIn;
          if (peeStream) peeStream.visible = t > 0.1 && t < 0.95;
          puddle.scale.setScalar(Math.max(0.001, t * t * (3 - 2 * t)));
        },
        onEnd: function () {
          dog.legBR.rotation.z = 0;
          dog.legBR.rotation.x = 0;
          if (peeStream) { scene.remove(peeStream); peeStream.geometry.dispose(); peeStream = null; }
        }
      },

      // Back up a step, still facing the laundry, before breathing fire on it.
      walkStep(randomSpot, backUpPos, carryHeading, 1.1),

      // Breathe red-and-orange fire for 1 second.
      {
        duration: 1000,
        onStart: function () {
          dog.mouthFireGroup.visible = true;
          dog.neckPivot.rotation.x = 0.35;
        },
        update: function () {
          dog.mouthFireGroup.children.forEach(function (cone) {
            var j = 0.85 + Math.random() * 0.3;
            cone.scale.set(j, j, 0.9 + Math.random() * 0.3);
          });
        },
        onEnd: function () {
          dog.mouthFireGroup.visible = false;
          dog.neckPivot.rotation.x = 0;
        }
      },

      // The laundry catches and burns with its own flame for 1 second.
      {
        duration: 1000,
        onStart: function () {
          laundryFire = buildFlameCluster('up', 0.75);
          laundryFire.group.position.copy(laundryTarget);
          laundryFire.group.position.y += 0.02;
          scene.add(laundryFire.group);
        },
        update: function (t) {
          laundryFire.cones.forEach(function (cone) {
            var jx = 0.8 + Math.random() * 0.35;
            var jy = 0.85 + Math.random() * 0.3;
            cone.scale.set(jx, jy, jx);
          });
          var burn = Math.max(0.001, 1 - t);
          laundry.scale.setScalar(burn);
          laundry.rotation.y += 0.18;

          // The puddle rushes away fast, gone well before the laundry is.
          if (puddle) {
            var puddleWindow = 0.22;
            if (t >= puddleWindow) {
              scene.remove(puddle);
              puddle.geometry.dispose();
              puddle = null;
            } else {
              puddle.scale.setScalar(Math.max(0.001, 1 - Math.sqrt(t / puddleWindow)));
            }
          }
        },
        onEnd: function () {
          scene.remove(laundry);
          laundry.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
          scene.remove(laundryFire.group);
          laundryFire.group.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
        }
      },

      // Close up (the door closes itself back at the machine) and head out.
      {
        duration: 400,
        update: function (t) {
          var e = 1 - t;
          openPivot.rotation[openAxis] = openAngle * e * e;
        }
      },
      turnStep(carryHeading, exitHeadingA, 260),
      walkStep(backUpPos, doorwayPos, exitHeadingA, 1.7),
      turnStep(exitHeadingA, exitHeadingB, 200)
    ];
    var finalWalk = walkStep(doorwayPos, outsidePos, exitHeadingB, 1.7);
    finalWalk.onEnd = function () { dog.root.visible = false; };
    steps.push(finalWalk);

    sequencer = new Sequencer(steps);
  }

  // ---------- click / tap detection on machines ----------
  var raycaster = new THREE.Raycaster();
  var pointerNDC = new THREE.Vector2();
  var pointerDownInfo = null;

  function machineFromIntersect(hits) {
    if (!hits.length) return null;
    var obj = hits[0].object;
    while (obj && !(obj.userData && obj.userData.isMachineRoot)) obj = obj.parent;
    return obj;
  }

  function pick(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    return machineFromIntersect(raycaster.intersectObjects(machines, true));
  }

  renderer.domElement.addEventListener('pointerdown', function (e) {
    pointerDownInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  renderer.domElement.addEventListener('pointerup', function (e) {
    if (!pointerDownInfo) return;
    var dx = e.clientX - pointerDownInfo.x, dy = e.clientY - pointerDownInfo.y;
    var moved = Math.sqrt(dx * dx + dy * dy);
    var elapsed = performance.now() - pointerDownInfo.t;
    pointerDownInfo = null;
    if (moved > 6 || elapsed > 600) return; // was a drag/orbit, not a tap
    if (sequencer && !sequencer.done) return;
    var hit = pick(e.clientX, e.clientY);
    if (hit) startDogShow(hit);
  });
  renderer.domElement.addEventListener('pointermove', function (e) {
    if (sequencer && !sequencer.done) { renderer.domElement.style.cursor = 'default'; return; }
    var hit = pick(e.clientX, e.clientY);
    renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
  });

  // ---------- controls ----------
  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  // Framed on the left doorway post (doorGapStart), low enough to tilt the
  // view down and show the tops of the washers, at a depth that keeps every
  // machine's front on screen alongside it.
  controls.target.set(doorGapStart, 0.45, ROOM_D * 0.37);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.screenSpacePanning = true;
  controls.update();

  // ---------- resize ----------
  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, true);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- render loop ----------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (sequencer && !sequencer.done) sequencer.tick(performance.now());
    renderer.render(scene, camera);
  }
  animate();

  // ---------- instructions fade ----------
  var hint = document.getElementById('hint');
  if (hint) {
    var faded = false;
    function fadeHint() {
      if (faded) return;
      faded = true;
      hint.style.opacity = '0';
    }
    canvas.addEventListener('pointerdown', function () { setTimeout(fadeHint, 1200); }, { once: true });
    setTimeout(fadeHint, 9000);
  }
})();
