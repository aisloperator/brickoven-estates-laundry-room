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
  // Initial position is set further down (near controls.target), once
  // washerCenters exists — it's aimed at washer 5, so it needs that.

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

  // Each machine gets its own texture (not a shared one) since the label
  // — its identifying number — differs per machine.
  // showCommercial/mainFontSize let the front-load washers keep the
  // original smaller label + "COMMERCIAL" subtitle, while every other
  // machine gets a bigger label with no subtitle (see makeFrontLoad's
  // isFrontLoadWasher and makeTopLoad).
  function createLogoTexture(label, showCommercial, mainFontSize) {
    var cnv = makeCanvas(512, 128);
    var ctx = cnv.getContext('2d');
    ctx.fillStyle = '#2e2e2e';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + mainFontSize + 'px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, showCommercial ? 52 : 64);
    if (showCommercial) {
      ctx.font = '20px Arial, sans-serif';
      ctx.fillStyle = '#c9c9c9';
      ctx.fillText('C O M M E R C I A L', 256, 92);
    }
    var tex = new THREE.CanvasTexture(cnv);
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // Simple two-lobe heart via bezier curves, centered horizontally at cx,
  // spanning roughly [cy, cy + size] vertically.
  function drawHeart(ctx, cx, cy, size, color) {
    var topCurveHeight = size * 0.3;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + topCurveHeight);
    ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight);
    ctx.bezierCurveTo(
      cx - size / 2, cy + (topCurveHeight + size / 2),
      cx, cy + (topCurveHeight + size / 2),
      cx, cy + size
    );
    ctx.bezierCurveTo(
      cx, cy + (topCurveHeight + size / 2),
      cx + size / 2, cy + (topCurveHeight + size / 2),
      cx + size / 2, cy + topCurveHeight
    );
    ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight);
    ctx.closePath();
    ctx.fill();
  }

  // Generic poster texture: solid background + border, plus an arbitrary
  // list of text lines ({text, y, color, font}). Portrait, matching the
  // 3ft x 4ft (3:4) poster it's mapped onto. lines can be empty for a
  // blank poster. extra(ctx), if given, runs after the text for any
  // additional canvas drawing (e.g. drawHeart) a specific design needs.
  function createPosterTexture(bgColor, borderColor, lines, extra) {
    var cnv = makeCanvas(384, 512);
    var ctx = cnv.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 384, 512);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 364, 492);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach(function (line) {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 192, line.y);
    });
    if (extra) extra(ctx);
    var tex = new THREE.CanvasTexture(cnv);
    tex.anisotropy = 4;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  var POSTER_BOLD_32 = 'bold 32px Arial, sans-serif';
  var POSTER_SMALL = '22px Arial, sans-serif';

  function dryerWarningPosterTexture() {
    return createPosterTexture('#b8dff2', '#7fb8d9', [
      { text: "Please don't use", y: 150, color: '#cc5500', font: POSTER_BOLD_32 },
      { text: 'dryer fabric sheets,', y: 195, color: '#cc5500', font: POSTER_BOLD_32 },
      { text: 'wool balls, etc.', y: 240, color: '#cc5500', font: POSTER_BOLD_32 },
      { text: 'in the dryers', y: 285, color: '#cc5500', font: POSTER_BOLD_32 },
      { text: 'They make some neighbors sick', y: 365, color: '#5a5650', font: POSTER_SMALL }
    ]);
  }

  function promptRemovalPosterTexture() {
    return createPosterTexture('#f7e26b', '#d4b83a', [
      { text: 'Please remember to', y: 150, color: '#c81e1e', font: POSTER_BOLD_32 },
      { text: 'remove laundry from', y: 195, color: '#c81e1e', font: POSTER_BOLD_32 },
      { text: 'machines promptly.', y: 240, color: '#c81e1e', font: POSTER_BOLD_32 },
      { text: 'Our building does', y: 320, color: '#2a2a28', font: POSTER_SMALL },
      { text: 'a lot of laundry', y: 350, color: '#2a2a28', font: POSTER_SMALL }
    ]);
  }

  function heDetergentPosterTexture() {
    var blue = 'bold 32px Arial, sans-serif';
    return createPosterTexture('#e3f5df', '#9dcf94', [
      { text: 'These are High', y: 150, color: '#1a56c4', font: blue },
      { text: 'Efficiency', y: 195, color: '#1a56c4', font: blue },
      { text: 'washers.', y: 240, color: '#1a56c4', font: blue },
      { text: "Too much 'HE' detergent", y: 320, color: '#2a2a28', font: POSTER_SMALL },
      { text: 'will leave residue in', y: 350, color: '#2a2a28', font: POSTER_SMALL },
      { text: 'clothes and machines', y: 380, color: '#2a2a28', font: POSTER_SMALL }
    ]);
  }

  function donationPosterTexture() {
    var green = 'bold 26px Arial, sans-serif';
    return createPosterTexture('#e3f5df', '#9dcf94', [
      { text: 'Unwanted clothes can', y: 110, color: '#1f7a3d', font: green },
      { text: 'be donated via', y: 148, color: '#1f7a3d', font: green },
      { text: 'Helpsy.com pickup,', y: 186, color: '#1f7a3d', font: green },
      { text: 'neighborhood donation', y: 224, color: '#1f7a3d', font: green },
      { text: 'boxes, or at Goodwill', y: 262, color: '#1f7a3d', font: green },
      { text: 'or Boomerangs in', y: 300, color: '#1f7a3d', font: green },
      { text: 'Central Square', y: 338, color: '#1f7a3d', font: green }
    ], function (ctx) {
      drawHeart(ctx, 192, 400, 70, '#2fa84f');
    });
  }

  var brickTex = createBrickTexture(0xb5522b, ROOM_W / 1.4, WALL_H / 1.4);
  var brickTexSide = createBrickTexture(0xb5522b, ROOM_D / 1.4, WALL_H / 1.4);
  var floorTex = createFloorTexture();

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
  // One shared white for every appliance surface (cabinets, doors, lids,
  // panels/consoles) — previously 3 slightly different off-whites. Kept off
  // pure white and reasonably matte (not glossy/metallic) so shading and
  // shadows still read clearly rather than blowing out.
  var applianceWhite = new THREE.MeshStandardMaterial({ color: 0xededea, roughness: 0.45, metalness: 0.1 });
  var doorGlass = new THREE.MeshStandardMaterial({
    color: 0x14161b, roughness: 0.12, metalness: 0.3,
    transparent: true, opacity: 0.25, depthWrite: false
  });
  // Moderate (not near-1) metalness: this scene has no environment map, so a
  // near-fully-metallic material has almost no diffuse reflectance and reads
  // as black except for a single direct-light highlight. This blend keeps a
  // bright, mostly-uniform silver base color (from the diffuse term) plus a
  // tight specular glint (low roughness), without relying on reflections.
  var chrome = new THREE.MeshStandardMaterial({ color: 0xe2e5e7, roughness: 0.28, metalness: 0.45 });
  var legMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

  function addShadowFlags(obj) {
    obj.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
  }

  function decalPlane(w, h, label, showCommercial, mainFontSize) {
    var geo = new THREE.PlaneGeometry(w, h);
    var tex = createLogoTexture(label, showCommercial, mainFontSize);
    var mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
    return new THREE.Mesh(geo, mat);
  }

  var drumDarkMat = new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.6 });

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
  function makeFrontLoad(width, height, depth, bodyMat, doorStyle, extraPanelH, machineNumber, label) {
    var g = new THREE.Group();

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    cabinet.position.set(0, height / 2, depth / 2);
    g.add(cabinet);

    var doorR = Math.min(width, height) * 0.32;
    // Control panel height/position, worked out before the door so a taller
    // panel (extraPanelH) can push the door down to keep clear of it rather
    // than the two overlapping.
    var panelH = height * 0.16 + (extraPanelH || 0);
    var panelBottom = height - panelH - 0.03;
    var doorY = Math.min(height * 0.42, panelBottom - 0.04 - doorR - 0.035);

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
      var doorThickness = 0.0225;
      var doorShape = roundedRectShape(doorW, doorH, doorR * 0.4);
      var doorGeo = new THREE.ExtrudeGeometry(doorShape, { depth: doorThickness, bevelEnabled: false, curveSegments: 12 });
      var doorPanel = new THREE.Mesh(doorGeo, applianceWhite);
      doorPanel.position.set(doorHalfW, 0, 0);
      doorPivot.add(doorPanel);
    } else {
      // A ring (not a solid disc) — a filled disc here would sit as an
      // opaque backing directly behind the whole glass pane, defeating its
      // transparency regardless of the glass material's own opacity. Given
      // real depth (extruded, like the rect door panel elsewhere) rather
      // than flat, so it reads as a 3D bezel.
      var rimAnnulus = new THREE.Shape();
      rimAnnulus.absarc(0, 0, doorR + 0.035, 0, Math.PI * 2, false);
      var rimHole = new THREE.Path();
      rimHole.absarc(0, 0, doorR, 0, Math.PI * 2, true);
      rimAnnulus.holes.push(rimHole);
      var rimThickness = 0.025;
      var rimGeo = new THREE.ExtrudeGeometry(rimAnnulus, { depth: rimThickness, bevelEnabled: false, curveSegments: 28 });
      var rim = new THREE.Mesh(rimGeo, chrome);
      rim.position.set(doorR, 0, 0);
      doorPivot.add(rim);

      var glass = new THREE.Mesh(new THREE.CylinderGeometry(doorR, doorR, 0.02, 28), doorGlass);
      glass.rotation.x = Math.PI / 2;
      glass.position.set(doorR, 0, 0.015);
      doorPivot.add(glass);
    }

    var panelThickness = 0.025;
    var panelZ = depth + 0.02;
    var panel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, panelH, panelThickness), applianceWhite);
    panel.position.set(0, height - panelH / 2 - 0.03, panelZ);
    g.add(panel);

    // Sits flush against the panel's own front face, not a fixed offset
    // from the cabinet, so it tracks panelThickness if that ever changes.
    // Only the round-door style is a front-load washer (dryers use 'rect')
    // — everyone else gets a bigger label with no "COMMERCIAL" subtitle.
    var isFrontLoadWasher = doorStyle !== 'rect';
    var decal = decalPlane(width * 0.8, panelH * 0.7, label, isFrontLoadWasher, isFrontLoadWasher ? 46 : 58);
    decal.position.set(0, height - panelH / 2 - 0.03, panelZ + panelThickness / 2 + 0.005);
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
    g.userData.machineNumber = machineNumber;
    g.userData.machineLabel = label;

    addShadowFlags(g);
    return g;
  }

  function makeTopLoad(width, height, depth, bodyMat, machineNumber, label) {
    var g = new THREE.Group();
    var tubY = height * 0.86;
    var lidH = height * 0.025;

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, tubY, depth), bodyMat);
    cabinet.position.set(0, tubY / 2, depth / 2);
    g.add(cabinet);

    // Console position/size, worked out first: the lid hinge and drum are
    // both placed relative to it so the open lid ends up directly in front
    // of the console instead of just swinging up and away from it. Pushed
    // close to the cabinet's back edge to leave as much depth as possible
    // for the (approximately square) lid in front of it.
    // Flush with the top of the cabinet (tubY), not the top of the lid
    // (tubY + lidH) — the console sits at a different z than the lid (see
    // hingeZ below) so there's no overlap either way.
    var consoleY = tubY + (height * 0.14) / 2;
    var consoleZ = depth * 0.07;
    var consoleD = 0.08;
    var consoleFrontZ = consoleZ + consoleD / 2;

    // Lid is hinged just in front of the console (offset by the lid's own
    // thickness, so it doesn't clip into it) rather than at the cabinet's
    // back edge. Rotating almost exactly to vertical then leaves the whole
    // lid standing as a flat panel right in front of the console, at
    // roughly the hinge's z position, obscuring it.
    var lidW = width * 0.97;
    var lidDepth = lidW * 0.85; // approximately square, tied to width rather than cabinet depth
    var hingeZ = consoleFrontZ + lidH + 0.01;
    var lidPivot = new THREE.Group();
    lidPivot.position.set(0, tubY, hingeZ);
    g.add(lidPivot);

    // White, with rounded corners in footprint (extruded up out of the
    // shape's plane, then rotated so that extrusion becomes the lid's
    // thickness instead of its width or depth).
    var lidCorner = Math.min(lidW, lidDepth) * 0.15;
    var lidShape = roundedRectShape(lidW, lidDepth, lidCorner);
    var lidGeo = new THREE.ExtrudeGeometry(lidShape, { depth: lidH, bevelEnabled: false, curveSegments: 10 });
    var lid = new THREE.Mesh(lidGeo, applianceWhite);
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(0, 0, lidDepth / 2);
    lidPivot.add(lid);

    // Large drum — only slightly smaller than the lid's own width/depth —
    // sized/centered to fit fully under it.
    var drumR = Math.min(lidDepth, lidW) * 0.46;
    var tub = new THREE.Mesh(new THREE.CylinderGeometry(drumR, drumR, 0.03, 24), drumDarkMat);
    tub.position.set(0, tubY + 0.005, hingeZ + lidDepth / 2);
    g.add(tub);

    var console_ = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, height * 0.14, consoleD), applianceWhite);
    console_.position.set(0, consoleY, consoleZ);
    g.add(console_);

    // Top-load washers aren't front-load washers either — bigger label, no
    // "COMMERCIAL" subtitle, same as the dryers.
    var decal = decalPlane(width * 0.75, height * 0.1, label, false, 58);
    decal.position.set(0, consoleY, consoleZ + 0.045);
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
    doorOpening.position.set(0, tubY + 0.06, hingeZ + lidDepth / 2);
    g.add(doorOpening);

    var standMarker = new THREE.Object3D();
    standMarker.position.set(0, 0, depth + 0.55);
    g.add(standMarker);

    g.userData.isMachineRoot = true;
    g.userData.kind = 'top';
    g.userData.lidPivot = lidPivot;
    // Exactly vertical: at this angle the whole lid becomes a flat panel
    // sitting right at the hinge's z position (see hingeZ above), standing
    // directly in front of the console and obscuring it.
    g.userData.doorOpenAngle = -Math.PI / 2;
    g.userData.doorOpening = doorOpening;
    g.userData.standMarker = standMarker;
    g.userData.machineNumber = machineNumber;
    g.userData.machineLabel = label;

    addShadowFlags(g);
    return g;
  }

  function makeStackedDryerColumn(width, depth, topNumber, topLabel, bottomNumber, bottomLabel) {
    var g = new THREE.Group();
    var h1 = 0.98, h2 = 0.95;
    var bottom = makeFrontLoad(width, h1, depth, applianceWhite, 'rect', undefined, bottomNumber, bottomLabel);
    g.add(bottom);
    var top = makeFrontLoad(width, h2, depth, applianceWhite, 'rect', undefined, topNumber, topLabel);
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

  // ---------- layout helper: like layoutRow, but keyed off one item's fixed
  // center instead of centering the whole row in a span ----------
  function layoutRowAnchored(widths, gap, anchorIndex, anchorCenter) {
    var centers = new Array(widths.length);
    centers[anchorIndex] = anchorCenter;
    for (var i = anchorIndex - 1; i >= 0; i--) {
      centers[i] = centers[i + 1] - (widths[i + 1] / 2 + gap + widths[i] / 2);
    }
    for (var j = anchorIndex + 1; j < widths.length; j++) {
      centers[j] = centers[j - 1] + (widths[j - 1] / 2 + gap + widths[j] / 2);
    }
    return centers;
  }

  var INCH = 0.0254;

  // Machines a user can click to trigger the dog animation.
  var machines = [];

  // ---------- place washers on back wall (facing +Z into the room) ----------
  var FOOT = 0.3048;
  var flW = 0.72, flD = 0.70, flH = 1.00 + FOOT;
  // Deeper than a front-loader: the top-load lid needs to be roughly
  // square (see makeTopLoad) and still clear its hinge, which sits in
  // front of the console rather than at the cabinet's back edge.
  var tlW = 0.68, tlD = 0.8, tlH = 1.05;
  var washerWidths = [flW, flW, tlW, tlW, tlW];
  // Washer 5 (last/rightmost) is anchored at the position the old evenly-
  // centered layout put it, then the rest of the row is laid out from there
  // with a tight 1-inch gap, so washer 5 doesn't move.
  var washer5AnchorX = layoutRow(washerWidths, 0.35, doorGapStart - 0.25, 0.16)[washerWidths.length - 1];
  var washerCenters = layoutRowAnchored(washerWidths, INCH, washerWidths.length - 1, washer5AnchorX);

  // Machine numbers: washers 1-5 left to right, dryer 6 (standalone, nearest
  // the doorway), then the 2x2 stacked array 7-10 (top/bottom of the first
  // stacked column, then top/bottom of the second).
  // Footprints (XZ bounding boxes), used later so the dog's walk can check
  // whether a direct diagonal path is actually clear of every washer before
  // falling back to a safer routed one.
  var washerFootprints = [];
  for (var wi = 0; wi < washerWidths.length; wi++) {
    var unit;
    var washerNumber = wi + 1;
    var washerLabel = 'WASHER ' + washerNumber;
    var thisWasherDepth = wi < 2 ? flD : tlD;
    if (wi < 2) {
      unit = makeFrontLoad(flW, flH, flD, applianceWhite, undefined, FOOT, washerNumber, washerLabel);
    } else {
      unit = makeTopLoad(tlW, tlH, tlD, applianceWhite, washerNumber, washerLabel);
    }
    unit.position.set(washerCenters[wi], 0, WALL_T);
    scene.add(unit);
    machines.push(unit);
    washerFootprints.push({
      xMin: washerCenters[wi] - washerWidths[wi] / 2,
      xMax: washerCenters[wi] + washerWidths[wi] / 2,
      zMin: WALL_T,
      zMax: WALL_T + thisWasherDepth
    });
  }

  // ---------- place dryers on right wall (facing -X into the room) ----------
  var dfW = 0.72, dfD = 0.70;
  var dryerWidths = [dfW, dfW, dfW]; // standalone, stack col 1, stack col 2
  // Dryer 6 (standalone, first) is anchored at the position the old evenly-
  // centered layout put it, then the two stacks are laid out from there
  // with a tight 1-inch gap, so dryer 6 doesn't move.
  var dryer6AnchorZ = layoutRow(dryerWidths, 0.35, ROOM_D - 0.35, 0.22)[0];
  var dryerCenters = layoutRowAnchored(dryerWidths, INCH, 0, dryer6AnchorZ);

  var standaloneDryer = makeFrontLoad(dfW, 1.0, dfD, applianceWhite, 'rect', undefined, 6, 'DRYER 6');
  standaloneDryer.rotation.y = -Math.PI / 2;
  standaloneDryer.position.set(ROOM_W - WALL_T, 0, dryerCenters[0]);
  scene.add(standaloneDryer);
  machines.push(standaloneDryer);

  [1, 2].forEach(function (idx) {
    var topNumber = 5 + idx * 2;
    var bottomNumber = topNumber + 1;
    var col = makeStackedDryerColumn(dfW, dfD, topNumber, 'DRYER ' + topNumber, bottomNumber, 'DRYER ' + bottomNumber);
    col.rotation.y = -Math.PI / 2;
    col.position.set(ROOM_W - WALL_T, 0, dryerCenters[idx]);
    scene.add(col);
    col.children.forEach(function (child) {
      if (child.userData && child.userData.isMachineRoot) machines.push(child);
    });
  });

  // A framed poster, front face at local +Z (same convention as the
  // appliances) so it can be placed on the dryer wall the same way they are.
  function makePoster(width, height, texture) {
    var g = new THREE.Group();
    var frameThickness = 0.035;
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x3b2e22, roughness: 0.6 });
    var frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, height + 0.08, frameThickness), frameMat);
    frame.position.set(0, 0, frameThickness / 2);
    g.add(frame);

    var faceMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
    var face = new THREE.Mesh(new THREE.PlaneGeometry(width, height), faceMat);
    face.position.set(0, 0, frameThickness + 0.005);
    g.add(face);

    addShadowFlags(g);
    return g;
  }

  // Portrait, 3ft x 4ft. Mounted over dryer 6 (the standalone unit,
  // dryerCenters[0]), y=2.0 centers it in the wall space between its
  // cabinet top (1.0) and the top of the wall (WALL_H, 3.0). Net -1ft from
  // dryerCenters[0] (+1ft "left" toward +Z, then 2ft back the other way
  // toward -Z/"right", for someone facing this wall).
  var poster = makePoster(0.9144, 1.2192, dryerWarningPosterTexture());
  poster.rotation.y = -Math.PI / 2;
  poster.position.set(ROOM_W - 0.02, 2.0, dryerCenters[0] - 0.3048);
  scene.add(poster);

  // 3 more posters on the back wall above the washers, evenly distributed
  // between the left edge of washer 1 and the right edge of washer 5: the
  // span is divided into 3 equal segments and each poster centered in its
  // own segment. No rotation needed here (the back wall already faces +Z,
  // same as the washers' own local convention). Middle one has a message;
  // the other two are blank placeholders for now.
  var washersLeftEdge = washerCenters[0] - washerWidths[0] / 2;
  var washersRightEdge = washerCenters[washerCenters.length - 1] + washerWidths[washerWidths.length - 1] / 2;
  var washersSpan = washersRightEdge - washersLeftEdge;
  var backWallPosterY = (Math.max(flH, tlH) + WALL_H) / 2;
  var backWallPosterTextures = [heDetergentPosterTexture, promptRemovalPosterTexture, donationPosterTexture];
  for (var pi = 0; pi < 3; pi++) {
    var backPoster = makePoster(0.9144, 1.2192, backWallPosterTextures[pi]());
    backPoster.position.set(washersLeftEdge + washersSpan * (pi + 0.5) / 3, backWallPosterY, 0.02);
    scene.add(backPoster);
  }

  // A messy pile of dozens of solid-colored hardcover books, in the open
  // front-left floor area — the far corner from the initial camera's focus
  // (washer 5 / the doorway, back-right), so it's tucked out of the way
  // rather than front-and-center.
  var bookPageMat = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.85 });

  function createBookPile(count, numCols, maxRadius) {
    numCols = numCols || 6;
    maxRadius = maxRadius === undefined ? 0.28 : maxRadius;
    var g = new THREE.Group();
    var colors = [
      0xb33a3a, 0x2e5fa3, 0x2f8f4e, 0xd4a017, 0x6b3fa0, 0x1f8a8a,
      0xd2691e, 0x8a3b5c, 0x3a3a8a, 0x4a7c2f, 0xc9822e, 0x5c2e8a
    ];
    // A handful of loose "columns" so books pile up in stacks rather than
    // floating independently, like they'd actually settle when dropped.
    var cols = [];
    for (var c = 0; c < numCols; c++) {
      var ang = Math.random() * Math.PI * 2;
      var r = Math.random() * maxRadius;
      cols.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, h: 0 });
    }
    for (var i = 0; i < count; i++) {
      var col = cols[i % numCols];
      var bw = 0.14 + Math.random() * 0.07;
      var bt = 0.028 + Math.random() * 0.018;
      var bd = 0.19 + Math.random() * 0.07;
      var coverMat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.55
      });
      // Book lies flat: width along X, thickness along Y, depth along Z.
      // BoxGeometry's per-face material order is [+X,-X,+Y,-Y,+Z,-Z] —
      // spine (-X) plus front/back cover (+Y/-Y) get the cover color; the
      // fore-edge (+X) and top/bottom edges (+Z/-Z) are the cream page block.
      var book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bt, bd),
        [bookPageMat, coverMat, coverMat, coverMat, bookPageMat, bookPageMat]
      );
      book.position.set(
        col.x + (Math.random() - 0.5) * 0.05,
        col.h + bt / 2,
        col.z + (Math.random() - 0.5) * 0.05
      );
      book.rotation.y = Math.random() * Math.PI * 2;
      if (Math.random() < 0.12) {
        // An occasional askew, half-toppled book for a natural messy look.
        book.rotation.x = (Math.random() - 0.5) * 0.5;
        book.rotation.z = (Math.random() - 0.5) * 0.5;
      }
      col.h += bt + 0.002;
      g.add(book);
    }
    addShadowFlags(g);
    return g;
  }
  // 4 stacks in the front-left corner (the open corner where x=0 meets
  // z=ROOM_D — no wall geometry there, but it's the corner the books were
  // already in). One tight in the corner itself, one a few inches out along
  // the x=0 edge, one a few inches out along the z=ROOM_D edge (the edge
  // that runs parallel to, and is the room's opposite side from, the
  // washer wall), and one further along that same z=ROOM_D edge. This
  // whole area is well clear of every appliance regardless of x, since no
  // machine's footprint extends anywhere near z=ROOM_D. Pushed right up
  // against their respective edges (small edgeInset, just enough to clear
  // a stack's own radius) and spaced at half their original separation.
  var edgeInset = 0.2;
  var cornerStackSpecs = [
    { x: edgeInset, z: ROOM_D - edgeInset, count: 23 },        // tight in the corner
    { x: edgeInset, z: ROOM_D - edgeInset - 0.33, count: 23 }, // along the x=0 edge
    { x: edgeInset + 0.33, z: ROOM_D - edgeInset, count: 22 }, // along the far (z=ROOM_D) edge
    { x: edgeInset + 0.58, z: ROOM_D - edgeInset, count: 22 }  // further along that same far edge
  ];
  cornerStackSpecs.forEach(function (spec) {
    var stack = createBookPile(spec.count, 3, 0.16);
    stack.position.set(spec.x, 0, spec.z);
    scene.add(stack);
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

  // 8 overlapping upward cones clustered around a center point, each with
  // its own base height/phase so they flicker independently — reads as a
  // small licking fire rather than one uniform cone shape. Offsets are laid
  // out around a ring (with jitter) rather than hand-placed so the count is
  // just a loop bound.
  function buildFlameTongues(scaleMul) {
    scaleMul = scaleMul || 1;
    var count = 8;
    var colors = [0xd22600, 0xff7a00];
    var group = new THREE.Group();
    var cones = [];
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      var ringR = (0.03 + Math.random() * 0.055) * scaleMul;
      var offX = Math.cos(angle) * ringR;
      var offZ = Math.sin(angle) * ringR;
      var r = (0.045 + Math.random() * 0.02) * scaleMul;
      var h = (0.36 + Math.random() * 0.2) * scaleMul;
      var mat = new THREE.MeshBasicMaterial({ color: colors[i % 2], transparent: true, opacity: 0.88, depthWrite: false });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
      cone.position.set(offX, h / 2, offZ);
      cone.renderOrder = i;
      cone.userData.baseX = offX;
      cone.userData.baseZ = offZ;
      cone.userData.baseHeight = h;
      cone.userData.phase = Math.random() * Math.PI * 2;
      group.add(cone);
      cones.push(cone);
    }
    return { group: group, cones: cones };
  }

  // Like buildFlameTongues, but for a fire *breath* rather than a ground
  // fire: all cones share one base point (the mouth) instead of being
  // offset around a ring, each angled outward at a random angle from local
  // +Z (forward) so they spread like a spray instead of all pointing the
  // same direction from the same spot.
  function buildFlameSpray(count, scaleMul) {
    scaleMul = scaleMul || 1;
    var colors = [0xd22600, 0xff7a00];
    var maxSpread = 0.5; // radians of deviation from straight-ahead
    var group = new THREE.Group();
    var cones = [];
    for (var i = 0; i < count; i++) {
      var theta = Math.random() * maxSpread;
      var phi = Math.random() * Math.PI * 2;
      var dir = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
      );
      var r = (0.045 + Math.random() * 0.02) * scaleMul;
      var h = (0.3 + Math.random() * 0.22) * scaleMul;
      var mat = new THREE.MeshBasicMaterial({ color: colors[i % 2], transparent: true, opacity: 0.88, depthWrite: false });
      var cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat);
      // ConeGeometry's local axis is +Y; align that with the random spray
      // direction, then push it out along that same direction so the
      // cone's base (not its center) sits at the shared origin.
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.position.copy(dir).multiplyScalar(h / 2);
      cone.renderOrder = i;
      cone.userData.dir = dir;
      cone.userData.baseHeight = h;
      cone.userData.phase = Math.random() * Math.PI * 2;
      group.add(cone);
      cones.push(cone);
    }
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

    // Fire-breath spray, hidden until the fire-breathing step.
    var mouthFire = buildFlameSpray(7);
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

  // A straight line between the doorway and a washer's stand position can
  // cut across the back wall's cabinet zone (z up to ~0.95) diagonally,
  // clipping through whichever washer sits between the doorway and the
  // target — the doorway is on the same wall as the washers, unlike the
  // dryer wall. Routes through an intermediate point instead: first get to
  // the depth (z) of whichever endpoint is farther from the wall — that
  // "strafing" leg then only ever moves at a z beyond every cabinet's
  // front face — then close the remaining single-axis gap. Degenerate
  // (zero-length) legs are dropped. Safe (if unnecessary) for dryer
  // targets too, so it's used for every walk to/from the doorway.
  function safeBackWallPath(from, to, speed) {
    var safeZ = Math.max(from.z, to.z);
    var viaFrom = new THREE.Vector3(from.x, 0, safeZ);
    var viaTo = new THREE.Vector3(to.x, 0, safeZ);
    var steps = [];
    var finalHeading;
    if (Math.abs(from.z - safeZ) > 0.01) {
      steps.push(walkStep(from, viaFrom, Math.atan2(viaFrom.x - from.x, viaFrom.z - from.z), speed));
    }
    finalHeading = Math.atan2(viaTo.x - viaFrom.x, viaTo.z - viaFrom.z);
    steps.push(walkStep(viaFrom, viaTo, finalHeading, speed));
    if (Math.abs(to.z - safeZ) > 0.01) {
      finalHeading = Math.atan2(to.x - viaTo.x, to.z - viaTo.z);
      steps.push(walkStep(viaTo, to, finalHeading, speed));
    }
    return { steps: steps, finalHeading: finalHeading };
  }

  // Segment (p1->p2) vs axis-aligned box, in the XZ plane (slab method).
  function segmentIntersectsBox(p1, p2, box) {
    var lo = 0, hi = 1;
    function clip(v1, v2, minV, maxV) {
      var d = v2 - v1;
      if (Math.abs(d) < 1e-9) return v1 >= minV && v1 <= maxV;
      var t1 = (minV - v1) / d, t2 = (maxV - v1) / d;
      if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      return lo <= hi;
    }
    return clip(p1.x, p2.x, box.xMin, box.xMax) && clip(p1.z, p2.z, box.zMin, box.zMax);
  }

  function pathClearOfWashers(p1, p2, excludeBox) {
    for (var i = 0; i < washerFootprints.length; i++) {
      var box = washerFootprints[i];
      if (box !== excludeBox && segmentIntersectsBox(p1, p2, box)) return false;
    }
    return true;
  }

  // Prefers a single natural diagonal walk; only falls back to the safer
  // (but more rectilinear) routed path if the direct one would actually
  // clip a washer. excludeBox lets the target machine's own footprint be
  // ignored, since walking up to its standMarker is the point.
  function planWalk(from, to, speed, excludeBox) {
    if (pathClearOfWashers(from, to, excludeBox)) {
      var heading = Math.atan2(to.x - from.x, to.z - from.z);
      return { steps: [walkStep(from, to, heading, speed)], finalHeading: heading };
    }
    return safeBackWallPath(from, to, speed);
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
      piece.userData.origColor = mat.color.clone();
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
  var charredColor = new THREE.Color(0x0a0806);

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
    // The target washer's own footprint doesn't count as an obstacle —
    // walking up to its standMarker is the point.
    var targetWasherBox = (machineRoot.userData.machineNumber >= 1 && machineRoot.userData.machineNumber <= 5)
      ? washerFootprints[machineRoot.userData.machineNumber - 1] : null;
    var approachPath = planWalk(doorwayPos, standPos, 1.6, targetWasherBox);
    var approachHeading = approachPath.finalHeading;
    var exitPath = planWalk(backUpPos, doorwayPos, 1.7, targetWasherBox);
    var exitHeadingA = exitPath.finalHeading;
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
      // Routed via safeBackWallPath (not a direct walkStep) so the dog
      // doesn't cut diagonally through whichever washer sits between the
      // doorway and the target.
      ...approachPath.steps,
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
        update: function (t) {
          dog.mouthFireGroup.children.forEach(function (cone) {
            // Same flicker approach as the ground fire's tongues, but each
            // cone re-centers along its own sprayed-out direction (not
            // straight up) so its base stays anchored at the mouth.
            var wob = 0.7 + 0.5 * Math.abs(Math.sin(t * 16 + cone.userData.phase));
            var h = cone.userData.baseHeight * wob;
            cone.scale.y = wob;
            cone.position.copy(cone.userData.dir).multiplyScalar(h / 2);
            var jxz = 0.9 + Math.random() * 0.2;
            cone.scale.x = jxz;
            cone.scale.z = jxz;
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
          laundryFire = buildFlameTongues(0.75);
          laundryFire.group.position.copy(laundryTarget);
          laundryFire.group.position.y += 0.02;
          scene.add(laundryFire.group);
        },
        update: function (t) {
          laundryFire.cones.forEach(function (cone) {
            // Each tongue flickers its height independently (own phase),
            // re-centering so its base stays pinned to the floor as it
            // grows/shrinks rather than scaling from the middle.
            var wob = 0.7 + 0.5 * Math.abs(Math.sin(t * 16 + cone.userData.phase));
            var h = cone.userData.baseHeight * wob;
            cone.scale.y = wob;
            cone.position.y = h / 2;
            var jxz = 0.9 + Math.random() * 0.2;
            cone.scale.x = jxz;
            cone.scale.z = jxz;
          });
          var burn = Math.max(0.001, 1 - t);
          laundry.scale.setScalar(burn);
          laundry.rotation.y += 0.18;
          laundry.traverse(function (o) {
            if (o.isMesh && o.userData.origColor) {
              o.material.color.copy(o.userData.origColor).lerp(charredColor, t);
            }
          });

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
      ...exitPath.steps,
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
  // Initial view: aimed at washer 5 (rightmost, nearest the doorway) rather
  // than the doorway itself. Camera position is target + a fixed offset
  // (elevated, off to the front-left, ~6ft eye height), scaled down from an
  // earlier, looser framing to sit tighter around just the machines rather
  // than the whole room; x was later nudged further right (less negative)
  // for a better angle. Checked against the angle from camera to the
  // farthest-away machine in each direction (leftmost washer, far
  // dryer-wall corner) and the tallest point (stacked dryer top) against
  // this camera's half-FOV (22.5 deg vertical; horizontal is wider, so
  // vertical is the tighter constraint) — all still land with a bit of
  // margin at this offset, tightest on the far dryer corner (~1-1.5 deg).
  // If washer/room/dryer proportions change enough to matter, redo that
  // check before just nudging the numbers — don't push x further right
  // without rechecking, that margin is already thin.
  var washer5X = washerCenters[washerCenters.length - 1];
  var camTarget = new THREE.Vector3(washer5X, 0.45, WALL_T + tlD * 0.5);
  var camOffset = new THREE.Vector3(-3.70, 0.96, 7.63);
  camera.position.copy(camTarget).add(camOffset);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.copy(camTarget);
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
