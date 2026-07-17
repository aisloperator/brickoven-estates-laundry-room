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
  camera.position.set(ROOM_W * 0.85, 3.4, ROOM_D * 2.05);

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
  var lidTop = new THREE.MeshStandardMaterial({ color: 0xd7dadd, roughness: 0.3, metalness: 0.6 });
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

  // Local convention: appliance footprint centered on X, back face at Z=0, front face at Z=depth, base at Y=0.
  function makeFrontLoad(width, height, depth, bodyMat) {
    var g = new THREE.Group();

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    cabinet.position.set(0, height / 2, depth / 2);
    g.add(cabinet);

    var doorR = Math.min(width, height) * 0.32;
    var doorY = height * 0.42;
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(doorR + 0.035, doorR + 0.035, 0.03, 28), chrome);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, doorY, depth + 0.02);
    g.add(rim);

    var glass = new THREE.Mesh(new THREE.CylinderGeometry(doorR, doorR, 0.02, 28), doorGlass);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, doorY, depth + 0.035);
    g.add(glass);

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

    addShadowFlags(g);
    return g;
  }

  function makeTopLoad(width, height, depth, bodyMat) {
    var g = new THREE.Group();

    var cabinet = new THREE.Mesh(new THREE.BoxGeometry(width, height * 0.86, depth), bodyMat);
    cabinet.position.set(0, (height * 0.86) / 2, depth / 2);
    g.add(cabinet);

    var lid = new THREE.Mesh(new THREE.BoxGeometry(width * 0.97, height * 0.05, depth * 0.95), lidTop);
    lid.position.set(0, height * 0.86 + (height * 0.05) / 2, depth / 2);
    g.add(lid);

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

    addShadowFlags(g);
    return g;
  }

  function makeStackedDryerColumn(width, depth) {
    var g = new THREE.Group();
    var h1 = 0.98, h2 = 0.95;
    var bottom = makeFrontLoad(width, h1, depth, bodyWhite);
    g.add(bottom);
    var top = makeFrontLoad(width, h2, depth, bodyWhite);
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
  }

  // ---------- place dryers on right wall (facing -X into the room) ----------
  var dfW = 0.72, dfD = 0.70;
  var dryerWidths = [dfW, dfW, dfW]; // standalone, stack col 1, stack col 2
  var dryerCenters = layoutRow(dryerWidths, 0.35, ROOM_D - 0.35, 0.22);

  var standaloneDryer = makeFrontLoad(dfW, 1.0, dfD, bodyWhite);
  standaloneDryer.rotation.y = -Math.PI / 2;
  standaloneDryer.position.set(ROOM_W - WALL_T, 0, dryerCenters[0]);
  scene.add(standaloneDryer);

  [1, 2].forEach(function (idx) {
    var col = makeStackedDryerColumn(dfW, dfD);
    col.rotation.y = -Math.PI / 2;
    col.position.set(ROOM_W - WALL_T, 0, dryerCenters[idx]);
    scene.add(col);
  });

  // ---------- controls ----------
  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(ROOM_W * 0.5, 1.0, ROOM_D * 0.5);
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
