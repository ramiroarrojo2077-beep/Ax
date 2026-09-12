/* Pista: curvatura, cintas de asfalto/pasto/pianos/vallas y decorado
   (tribunas, arboles, porticos). Todo se dibuja en un marco local que gira
   con el auto: el jugador siempre mira hacia +Z y el mundo rota a su
   alrededor, por eso el panorama del fondo se mueve de lado a lado. */
window.Track = (function () {
  'use strict';

  var ROAD_HALF = 7.2;      // media anchura del asfalto
  var KERB = 1.1;           // ancho del piano
  var GRASS = 17;           // pasto hasta la valla
  var WALL_X = ROAD_HALF + KERB + GRASS;
  var SEG = 8;              // largo de cada seccion de cinta
  var SEGMENTS = 122;       // secciones visibles (976 m)
  var BEHIND = -72;         // metros de pista dibujados detras del auto
  var LAP_LENGTH = 3000;    // metros por vuelta

  // Curvatura: suma de senos. Amplitud / longitud de onda.
  var WAVES = [
    { amp: 95, len: 1000, ph: 0.0 },
    { amp: 42, len: 430, ph: 1.7 },
    { amp: 16, len: 205, ph: 0.6 }
  ];

  function curveX(z) {
    var s = 0;
    for (var i = 0; i < WAVES.length; i++) {
      s += WAVES[i].amp * Math.sin(z / WAVES[i].len + WAVES[i].ph);
    }
    return s;
  }
  function slopeAt(z) {
    var s = 0;
    for (var i = 0; i < WAVES.length; i++) {
      s += (WAVES[i].amp / WAVES[i].len) * Math.cos(z / WAVES[i].len + WAVES[i].ph);
    }
    return s;
  }
  function curvatureAt(z) {
    var s = 0;
    for (var i = 0; i < WAVES.length; i++) {
      s -= (WAVES[i].amp / (WAVES[i].len * WAVES[i].len)) * Math.sin(z / WAVES[i].len + WAVES[i].ph);
    }
    return s;
  }

  /* Peralte: en las curvas la pista se inclina hacia adentro. El efecto se
     desvanece hacia el pasto para que las vallas y tribunas no se muevan. */
  var BANK_K = 130, BANK_MAX = 0.085;

  function bankAt(z) {
    var b = -curvatureAt(z) * BANK_K;
    return b > BANK_MAX ? BANK_MAX : (b < -BANK_MAX ? -BANK_MAX : b);
  }

  function bankFalloff(lateral) {
    var a = Math.abs(lateral);
    if (a <= ROAD_HALF + KERB) return 1;
    var f = 1 - (a - ROAD_HALF - KERB) / 12;
    return f > 0 ? f : 0;
  }

  function surfaceY(lateral, z) {
    return lateral * bankAt(z) * bankFalloff(lateral);
  }

  // ---- marco local --------------------------------------------------------
  var dist = 0, x0 = 0, h0 = 0, cosH = 1, sinH = 0;

  function setPlayer(d) {
    dist = d;
    x0 = curveX(d);
    h0 = Math.atan(slopeAt(d));
    cosH = Math.cos(h0);
    sinH = Math.sin(h0);
  }

  var _o = { x: 0, z: 0, yaw: 0 };
  /* Convierte (metro de pista, desplazamiento lateral) a coordenadas de
     pantalla. La camara mira hacia +Z, asi que su derecha es el -X del
     mundo: por eso se invierte el eje X (y con el, el rumbo). Sin esa
     inversion, doblar a la derecha movia el auto hacia la izquierda. */
  function toLocal(worldZ, lateral, out) {
    out = out || _o;
    var s = slopeAt(worldZ);
    var inv = 1 / Math.sqrt(1 + s * s);
    var wx = curveX(worldZ) + lateral * inv;
    var wz = worldZ - lateral * s * inv;
    var dx = wx - x0, dz = wz - dist;
    out.x = -(dx * cosH - dz * sinH);
    out.z = dx * sinH + dz * cosH;
    out.yaw = -(Math.atan(s) - h0);
    return out;
  }

  /* Posicion en pantalla de un desplazamiento lateral (derecha = positivo). */
  function screenX(lateral) { return -lateral; }

  // ---- cintas -------------------------------------------------------------
  function Ribbon(opt) {
    this.a = opt.offsetA; this.b = opt.offsetB;
    this.ya = opt.yA || 0; this.yb = (opt.yB === undefined ? opt.yA || 0 : opt.yB);
    this.uv = opt.uvScale || 10;
    this.uRep = opt.uRepeat || 1;
    this.segs = opt.segments || SEGMENTS;
    this.segLen = opt.segLength || SEG;
    this.start = (opt.start === undefined ? BEHIND : opt.start);

    var n = this.segs + 1;
    var geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    var uvs = new Float32Array(n * 2 * 2);
    var idx = [];
    for (var i = 0; i < this.segs; i++) {
      var o = i * 2;
      idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
    this.swapUV = !!opt.swapUV;   // carteles: el dibujo corre a lo largo, no a lo alto
    for (var j = 0; j < n; j++) {
      if (this.swapUV) {
        uvs[j * 4 + 0] = 0; uvs[j * 4 + 1] = 0;
        uvs[j * 4 + 2] = 0; uvs[j * 4 + 3] = this.uRep;
      } else {
        uvs[j * 4 + 0] = 0; uvs[j * 4 + 1] = 0;
        uvs[j * 4 + 2] = this.uRep; uvs[j * 4 + 3] = 0;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.uvAttr = new THREE.BufferAttribute(uvs, 2);
    geo.setAttribute('uv', this.uvAttr);
    geo.setIndex(idx);
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));

    var mat = new THREE.MeshStandardMaterial({
      map: opt.map || null,
      color: opt.color === undefined ? 0xffffff : opt.color,
      roughness: opt.roughness === undefined ? 0.95 : opt.roughness,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: !!opt.transparent
    });
    if (opt.bumpMap) { mat.bumpMap = opt.bumpMap; mat.bumpScale = opt.bumpScale || 0.05; }
    if (opt.polygonOffset) {
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -4;
    }
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = opt.receiveShadow !== false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opt.renderOrder || 0;
    this.geo = geo;
    this.vertical = (this.a === this.b);
  }

  var _pa = { x: 0, z: 0, yaw: 0 }, _pb = { x: 0, z: 0, yaw: 0 };
  Ribbon.prototype.update = function (d) {
    var p = this.pos, uv = this.uvAttr.array;
    for (var i = 0; i <= this.segs; i++) {
      var wz = d + this.start + i * this.segLen;
      toLocal(wz, this.a, _pa);
      toLocal(wz, this.b, _pb);
      var o = i * 6;
      var bank = surfaceY(this.a, wz);
      var bankB = surfaceY(this.b, wz);
      p[o] = _pa.x; p[o + 1] = this.ya + bank; p[o + 2] = _pa.z;
      p[o + 3] = _pb.x; p[o + 4] = this.yb + bankB; p[o + 5] = _pb.z;
      var v = wz / this.uv;
      if (this.swapUV) { uv[i * 4] = v; uv[i * 4 + 2] = v; }
      else { uv[i * 4 + 1] = v; uv[i * 4 + 3] = v; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
  };

  // ---- decorado -----------------------------------------------------------
  function buildGrandstand() {
    var g = new THREE.Group();
    var W = 64, D = 20;

    var base = new THREE.Mesh(
      new THREE.BoxGeometry(W, 2.5, D),
      new THREE.MeshLambertMaterial({ color: 0x9aa2ab })
    );
    base.position.y = 1.25;
    g.add(base);

    // gradas con el publico, inclinadas hacia la pista
    var seats = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 2, 17),
      new THREE.MeshLambertMaterial({ map: GFX.crowd(), side: THREE.DoubleSide })
    );
    seats.material.map = GFX.crowd().clone();
    seats.material.map.needsUpdate = true;
    seats.material.map.repeat.set(6, 2);
    seats.rotation.x = -Math.PI / 2 + 1.18;
    seats.position.set(0, 8.0, -1.0);
    g.add(seats);

    // pared trasera
    var back = new THREE.Mesh(
      new THREE.BoxGeometry(W, 14, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x7d858f })
    );
    back.position.set(0, 7, -D / 2);
    g.add(back);

    // techo + columnas
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(W + 3, 0.9, D + 3),
      new THREE.MeshLambertMaterial({ color: 0x22303f })
    );
    roof.position.set(0, 16.5, -1.5);
    g.add(roof);
    var pillarMat = new THREE.MeshLambertMaterial({ color: 0x59626c });
    for (var i = -1; i <= 1; i += 2) {
      var p = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 1), pillarMat);
      p.position.set(i * (W / 2 - 2), 8, D / 2 - 1);
      g.add(p);
    }
    // franja de color en el frente del techo
    var band = new THREE.Mesh(
      new THREE.BoxGeometry(W + 3, 1.6, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2ab6f0 })
    );
    band.position.set(0, 15.6, D / 2 + 1.2);
    g.add(band);
    return g;
  }

  function buildTree() {
    var g = new THREE.Group();
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.38, 3.2, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2f })
    );
    trunk.position.y = 1.6;
    g.add(trunk);
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6b30 });
    for (var i = 0; i < 3; i++) {
      var cone = new THREE.Mesh(new THREE.ConeGeometry(2.6 - i * 0.6, 3.4, 7), leafMat);
      cone.position.y = 3.4 + i * 1.5;
      g.add(cone);
    }
    return g;
  }

  function buildFlagPole(color) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9dde2 })
    );
    pole.position.y = 3;
    g.add(pole);
    var flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.1),
      new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide })
    );
    flag.position.set(0.9, 5.2, 0);
    g.add(flag);
    g.userData.flag = flag;
    return g;
  }

  function buildGantry() {
    var g = new THREE.Group();
    var mat = new THREE.MeshLambertMaterial({ color: 0x2a3038 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), mat);
    legL.position.set(-ROAD_HALF - 1.6, 4.5, 0);
    var legR = legL.clone(); legR.position.x = ROAD_HALF + 1.6;
    g.add(legL, legR);
    var beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2 + 5, 1.6, 1.2), mat);
    beam.position.y = 9.4;
    g.add(beam);
    var flag = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2 + 4, 1.5),
      new THREE.MeshBasicMaterial({ map: GFX.checker(), side: THREE.DoubleSide })
    );
    flag.position.set(0, 7.9, 0.1);
    g.add(flag);

    var line = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, 2.2),
      new THREE.MeshBasicMaterial({ map: GFX.checker(), side: THREE.DoubleSide, depthWrite: false })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.07, 0);
    line.renderOrder = 2;
    g.add(line);
    return g;
  }

  // ---- API ---------------------------------------------------------------
  function create(scene) {
    var ribbons = [];
    function add(r) { ribbons.push(r); scene.add(r.mesh); return r; }

    var grassTex = GFX.grass();
    add(new Ribbon({ offsetA: -170, offsetB: -(ROAD_HALF + KERB), yA: -0.12, yB: -0.04, map: grassTex, uvScale: 16, uRepeat: 12 }));
    add(new Ribbon({ offsetA: ROAD_HALF + KERB, offsetB: 170, yA: -0.04, yB: -0.12, map: grassTex, uvScale: 16, uRepeat: 12 }));

    // pianos con relieve real (suben hacia afuera)
    var kerbTex = GFX.kerb();
    add(new Ribbon({ offsetA: -(ROAD_HALF + KERB), offsetB: -ROAD_HALF, yA: 0.13, yB: 0.045, map: kerbTex, uvScale: 2.2, uRepeat: 1, roughness: 0.75 }));
    add(new Ribbon({ offsetA: ROAD_HALF, offsetB: ROAD_HALF + KERB, yA: 0.045, yB: 0.13, map: kerbTex, uvScale: 2.2, uRepeat: 1, roughness: 0.75 }));

    add(new Ribbon({
      offsetA: -ROAD_HALF, offsetB: ROAD_HALF, yA: 0.04,
      map: GFX.asphalt(), bumpMap: GFX.asphaltBump(), bumpScale: 0.035,
      uvScale: 11, uRepeat: 1, roughness: 0.88, polygonOffset: true
    }));

    var wallTex = GFX.wall();
    /* La valla de la izquierda se ve desde la cara opuesta: con la misma
       textura los carteles saldrian al reves, asi que usa una copia
       espejada. */
    var wallTexFlip = wallTex.clone();
    wallTexFlip.needsUpdate = true;
    wallTexFlip.wrapS = wallTexFlip.wrapT = THREE.RepeatWrapping;
    wallTexFlip.repeat.set(-1, 1);
    add(new Ribbon({
      offsetA: -WALL_X, offsetB: -WALL_X, yA: 0, yB: 2.6, map: wallTex,
      uvScale: 52, uRepeat: 1, swapUV: true, roughness: 0.7, receiveShadow: false
    }));
    add(new Ribbon({
      offsetA: WALL_X, offsetB: WALL_X, yA: 0, yB: 2.6, map: wallTexFlip,
      uvScale: 52, uRepeat: 1, swapUV: true, roughness: 0.7, receiveShadow: false
    }));

    // props reciclables
    var props = [];
    function prop(obj, worldZ, lateral, spacing, yaw) {
      scene.add(obj);
      var p = { obj: obj, z: worldZ, lat: lateral, spacing: spacing, yawOff: yaw || 0 };
      props.push(p);
      return p;
    }

    var standProto = buildGrandstand();
    var STAND_GAP = 210;
    for (var i = 0; i < 8; i++) {
      var s = standProto.clone();
      var right = (i % 2 === 0);
      prop(s, i * STAND_GAP, right ? WALL_X + 30 : -(WALL_X + 30), STAND_GAP * 8, right ? Math.PI / 2 : -Math.PI / 2);
    }

    var treeProto = buildTree();
    var TREE_GAP = 46;
    for (var t = 0; t < 34; t++) {
      var tr = treeProto.clone();
      var side = (t % 2 === 0) ? 1 : -1;
      var lat = side * (WALL_X + 42 + ((t * 37) % 70));
      var sc = 0.8 + ((t * 17) % 10) / 10;
      tr.scale.setScalar(sc);
      prop(tr, t * TREE_GAP + ((t * 13) % 30), lat, TREE_GAP * 34);
    }

    var flagColors = [0x2ab6f0, 0xff4fa3, 0xf5b301, 0xe8ecf2];
    var FLAG_GAP = 85;
    for (var f = 0; f < 14; f++) {
      var fp = buildFlagPole(flagColors[f % flagColors.length]);
      prop(fp, f * FLAG_GAP + 30, (f % 2 ? 1 : -1) * (WALL_X + 4), FLAG_GAP * 14);
    }

    var gantries = [];
    for (var q = 0; q < 2; q++) {
      var gt = buildGantry();
      gantries.push(prop(gt, (q + 1) * LAP_LENGTH, 0, LAP_LENGTH * 2));
    }

    var tmp = { x: 0, z: 0, yaw: 0 };

    return {
      ROAD_HALF: ROAD_HALF,
      LAP_LENGTH: LAP_LENGTH,
      VIEW: SEGMENTS * SEG,
      curveX: curveX,
      slopeAt: slopeAt,
      curvatureAt: curvatureAt,
      bankAt: bankAt,
      surfaceY: surfaceY,
      screenX: screenX,
      setPlayer: setPlayer,
      toLocal: toLocal,
      heading: function () { return h0; },
      update: function (d) {
        setPlayer(d);
        for (var i = 0; i < ribbons.length; i++) ribbons[i].update(d);
        for (var j = 0; j < props.length; j++) {
          var p = props[j];
          while (p.z - d < -120) p.z += p.spacing;
          while (p.z - d > SEGMENTS * SEG + p.spacing - 90) p.z -= p.spacing;
          toLocal(p.z, p.lat, tmp);
          p.obj.position.set(tmp.x, surfaceY(p.lat, p.z), tmp.z);
          p.obj.rotation.y = tmp.yaw + p.yawOff;
          p.obj.visible = tmp.z > -120 && tmp.z < 1200;
        }
      }
    };
  }

  return { create: create, ROAD_HALF: ROAD_HALF, LAP_LENGTH: LAP_LENGTH };
})();
