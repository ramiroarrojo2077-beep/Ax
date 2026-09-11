/* Cordillera real en 3D: malla polar generada con ruido fractal (fBm con
   crestas), coloreada por altura y con perspectiva aerea horneada en los
   vertices para que se funda con el horizonte. */
window.Terrain = (function () {
  'use strict';

  // ---- ruido -------------------------------------------------------------
  function hash(x, y) {
    var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function valueNoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = smooth(xf), v = smooth(yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  function fbm(x, y, octaves) {
    var sum = 0, amp = 1, freq = 1, norm = 0;
    for (var i = 0; i < octaves; i++) {
      sum += valueNoise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }
  function ridged(x, y, octaves) {
    var n = fbm(x, y, octaves);
    var r = 1 - Math.abs(n * 2 - 1);
    return r * r;
  }

  var INNER = 1750;     // donde arranca el relieve
  var OUTER = 5400;
  var RINGS = 26;
  var SECTORS = 190;

  function heightAt(x, z, r) {
    // mascara radial: llanura cerca de la pista, sierra a lo lejos
    var mask = Math.min(1, Math.max(0, (r - INNER) / 1300));
    mask = mask * mask * (3 - 2 * mask);
    var base = ridged(x * 0.00046, z * 0.00046, 5);
    var h = Math.pow(base, 1.28) * 820;
    h += fbm(x * 0.0021, z * 0.0021, 3) * 110;
    h += fbm(x * 0.0085, z * 0.0085, 2) * 26;
    // las cadenas del fondo son las mas altas
    h *= 0.45 + 0.55 * Math.min(1, (r - INNER) / 2600);
    return h * mask;
  }

  var ROCK = new THREE.Color(0x7d746a);
  var ROCK_DARK = new THREE.Color(0x4a443d);
  var FOREST = new THREE.Color(0x25491f);
  var MEADOW = new THREE.Color(0x568437);
  var SNOW = new THREE.Color(0xf4f8ff);
  var HAZE = new THREE.Color(0xb9cfe3);   // azul de la calima lejana
  var tmpC = new THREE.Color();

  function colorAt(h, jitter) {
    var c = tmpC;
    if (h < 70) c.copy(MEADOW);
    else if (h < 300) c.copy(MEADOW).lerp(FOREST, (h - 70) / 230);
    else if (h < 520) c.copy(FOREST).lerp(ROCK_DARK, (h - 300) / 220);
    else if (h < 700) c.copy(ROCK_DARK).lerp(ROCK, (h - 520) / 180);
    else c.copy(ROCK).lerp(SNOW, Math.min(1, (h - 700) / 130));
    c.offsetHSL(0, (jitter - 0.5) * 0.05, (jitter - 0.5) * 0.09);
    return c;
  }

  /* La cordillera se dibuja con iluminacion y calima horneadas en los
     vertices (material basico): asi la bruma no se vuelve a oscurecer con
     las luces y la base se funde exactamente con la niebla del suelo. */
  var SUN = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();

  function create(quality) {
    var rings = quality === 'low' ? 18 : RINGS;
    var sectors = quality === 'low' ? 130 : SECTORS;
    var verts = [], idx = [], heights = [], dists = [], jitters = [];

    var radii = [];
    for (var j = 0; j <= rings; j++) {
      var t = j / rings;
      radii.push(INNER - 420 + (OUTER - INNER + 420) * Math.pow(t, 1.4));
    }

    for (var ring = 0; ring <= rings; ring++) {
      var r = radii[ring];
      for (var s = 0; s <= sectors; s++) {
        var ang = (s / sectors) * Math.PI * 2;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        // el radio se deforma para que el borde no se lea circular
        var wobble = 1 + (valueNoise(ca * 3.1, sa * 3.1) - 0.5) * 0.22;
        var rr = r * wobble;
        var x = ca * rr, z = sa * rr;
        // algunos sectores son valles y otros cadenas altas
        var sector = 0.45 + 1.05 * fbm(ca * 1.7 + 11, sa * 1.7 + 7, 3);
        var h = heightAt(x, z, rr) * sector;
        verts.push(x, h - 4, z);
        heights.push(h);
        dists.push(rr);
        jitters.push(valueNoise(x * 0.02, z * 0.02));
      }
    }

    var row = sectors + 1;
    for (var ri = 0; ri < rings; ri++) {
      for (var si = 0; si < sectors; si++) {
        var a = ri * row + si, b = a + 1, c2 = a + row, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    // horneado de luz + perspectiva aerea
    var nor = geo.attributes.normal.array;
    var colors = new Float32Array(heights.length * 3);
    for (var v = 0; v < heights.length; v++) {
      var nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2];
      var diffuse = Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z);
      var skyTerm = 0.5 + 0.5 * ny;
      var shade = 0.40 + 0.60 * diffuse + 0.18 * skyTerm;
      var c = colorAt(heights[v], jitters[v]);
      var rr2 = dists[v];
      var ground = Math.min(1, Math.max(0, (rr2 - 1600) / 3900));
      var altitude = Math.min(1, Math.max(0, 1 - heights[v] / 700));
      var haze = Math.min(0.70, ground * (0.08 + 0.44 * altitude) + 0.06);
      colors[v * 3] = c.r * shade * (1 - haze) + HAZE.r * haze;
      colors[v * 3 + 1] = c.g * shade * (1 - haze) + HAZE.g * haze;
      colors[v * 3 + 2] = c.b * shade * (1 - haze) + HAZE.b * haze;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    var mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -7;
    return mesh;
  }

  return { create: create, heightAt: heightAt };
})();
