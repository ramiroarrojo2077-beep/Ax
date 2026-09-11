/* Texturas generadas por canvas: asfalto (con relieve), pasto, pianos,
   vallas, tribuna, cielo panoramico, sombras y numeros de auto. */
window.GFX = (function () {
  'use strict';

  var cache = {};

  function canvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function srgb(tex) {
    if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if ('encoding' in tex && THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function toTexture(c, repX, repY, linear) {
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = 8;
    return linear ? t : srgb(t);
  }

  function memo(key, fn) {
    if (!cache[key]) cache[key] = fn();
    return cache[key];
  }

  /* --- pista ------------------------------------------------------------ */
  function asphaltCanvas() {
    return memo('asphaltCanvas', function () {
      var w = 1024, h = 1024, c = canvas(w, h), g = c.getContext('2d');
      g.fillStyle = '#43474d'; g.fillRect(0, 0, w, h);
      // grano
      var img = g.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = (Math.random() * 46) | 0;
        d[i] = Math.min(255, d[i] + n - 20);
        d[i + 1] = Math.min(255, d[i + 1] + n - 20);
        d[i + 2] = Math.min(255, d[i + 2] + n - 18);
      }
      g.putImageData(img, 0, 0);
      // piedritas
      for (var s = 0; s < 5200; s++) {
        var v = 70 + Math.random() * 90;
        g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 6) + ',' + (0.12 + Math.random() * 0.25) + ')';
        g.beginPath();
        g.arc(Math.random() * w, Math.random() * h, 0.8 + Math.random() * 2.4, 0, 6.283);
        g.fill();
      }
      // parches de reasfaltado
      for (var p = 0; p < 7; p++) {
        g.fillStyle = 'rgba(58,62,68,' + (0.25 + Math.random() * 0.3) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 80 + Math.random() * 260, 40 + Math.random() * 150);
      }
      // goma en la trazada
      var lane = g.createLinearGradient(0, 0, w, 0);
      lane.addColorStop(0.00, 'rgba(0,0,0,0)');
      lane.addColorStop(0.26, 'rgba(20,20,24,0.30)');
      lane.addColorStop(0.40, 'rgba(20,20,24,0.10)');
      lane.addColorStop(0.60, 'rgba(20,20,24,0.10)');
      lane.addColorStop(0.74, 'rgba(20,20,24,0.30)');
      lane.addColorStop(1.00, 'rgba(0,0,0,0)');
      g.fillStyle = lane; g.fillRect(0, 0, w, h);
      // lineas blancas de borde
      g.fillStyle = '#eef2f5';
      g.fillRect(w * 0.022, 0, w * 0.018, h);
      g.fillRect(w * 0.960, 0, w * 0.018, h);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      g.fillRect(w * 0.040, 0, w * 0.006, h);
      g.fillRect(w * 0.954, 0, w * 0.006, h);
      return c;
    });
  }

  function asphalt() { return memo('asphalt', function () { return toTexture(asphaltCanvas(), 1, 1); }); }

  /* Mapa de relieve derivado del asfalto (mismo grano, en escala de grises). */
  function asphaltBump() {
    return memo('asphaltBump', function () {
      var src = asphaltCanvas();
      var w = 512, h = 512, c = canvas(w, h), g = c.getContext('2d');
      g.drawImage(src, 0, 0, w, h);
      var img = g.getImageData(0, 0, w, h), d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
        d[i] = d[i + 1] = d[i + 2] = lum;
      }
      g.putImageData(img, 0, 0);
      return toTexture(c, 1, 1, true);
    });
  }

  function grass() {
    return memo('grass', function () {
      var w = 512, h = 512, c = canvas(w, h), g = c.getContext('2d');
      g.fillStyle = '#4c8a33'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,0.045)';
      for (var y = 0; y < h; y += 128) g.fillRect(0, y, w, 64);
      for (var i = 0; i < 26000; i++) {
        var t = Math.random();
        g.fillStyle = t > 0.66 ? 'rgba(104,166,70,0.55)'
          : t > 0.33 ? 'rgba(60,112,42,0.55)'
            : 'rgba(38,84,32,0.45)';
        g.fillRect(Math.random() * w, Math.random() * h, 1.6, 3.2);
      }
      // manchas de tierra
      for (var s = 0; s < 12; s++) {
        var gr = g.createRadialGradient(Math.random() * w, Math.random() * h, 2, Math.random() * w, Math.random() * h, 40 + Math.random() * 70);
        gr.addColorStop(0, 'rgba(120,104,64,0.22)');
        gr.addColorStop(1, 'rgba(120,104,64,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      return toTexture(c, 1, 1);
    });
  }

  function kerb() {
    return memo('kerb', function () {
      var w = 64, h = 128, c = canvas(w, h), g = c.getContext('2d');
      g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d81f2a'; g.fillRect(0, 0, w, h / 2);
      var grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0.22)');
      grd.addColorStop(0.35, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.14)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, h / 2 - 2, w, 3);
      // desgaste
      for (var i = 0; i < 300; i++) {
        g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.18) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      return toTexture(c, 1, 1);
    });
  }

  function wall() {
    return memo('wall', function () {
      var w = 2048, h = 256, c = canvas(w, h), g = c.getContext('2d');
      var panels = [
        ['#14203c', '#ffffff', 'GRAN PREMIO'],
        ['#eef0f4', '#14203c', 'CIRCUITO 3D'],
        ['#d81f2a', '#ffffff', 'VELOCIDAD'],
        ['#1d1f24', '#ff4fa3', 'PADDOCK'],
        ['#2ab6f0', '#08202f', 'BOX BOX'],
        ['#f5b301', '#1d1f24', 'PIT LANE']
      ];
      var pw = w / panels.length;
      for (var i = 0; i < panels.length; i++) {
        var p = panels[i];
        g.fillStyle = p[0]; g.fillRect(i * pw, 0, pw, h);
        var sh = g.createLinearGradient(0, 0, 0, h);
        sh.addColorStop(0, 'rgba(255,255,255,0.10)');
        sh.addColorStop(0.5, 'rgba(255,255,255,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.28)');
        g.fillStyle = sh; g.fillRect(i * pw, 0, pw, h);
        g.fillStyle = p[1];
        g.font = 'bold 76px sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(p[2], i * pw + pw / 2, h / 2 - 6);
      }
      // barrera tecpro arriba
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(0, 0, w, 14);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (var b = 0; b < w; b += 120) g.fillRect(b, 0, 5, 14);
      return toTexture(c, 1, 1);
    });
  }

  function crowd() {
    return memo('crowd', function () {
      var w = 1024, h = 512, c = canvas(w, h), g = c.getContext('2d');
      g.fillStyle = '#262b33'; g.fillRect(0, 0, w, h);
      var rows = 22;
      for (var r = 0; r < rows; r++) {
        var y = h - (r + 1) * (h / rows);
        g.fillStyle = 'rgba(0,0,0,0.30)';
        g.fillRect(0, y + h / rows - 4, w, 4);
        for (var x = 0; x < w; x += 11) {
          if (Math.random() < 0.10) continue;
          var t = Math.random(), col;
          if (t < 0.28) col = '#e4e9f0';
          else if (t < 0.46) col = '#2ab6f0';
          else if (t < 0.60) col = '#ff4fa3';
          else if (t < 0.74) col = '#d81f2a';
          else if (t < 0.86) col = '#f5b301';
          else col = '#1c2027';
          g.fillStyle = col;
          g.fillRect(x + Math.random() * 2, y + 4 + Math.random() * 4, 7, 12);
          g.fillStyle = 'rgba(235,206,178,0.95)';
          g.beginPath();
          g.arc(x + 3.5 + Math.random() * 2, y + 3 + Math.random() * 2, 2.6, 0, 6.283);
          g.fill();
        }
      }
      return toTexture(c, 1, 1);
    });
  }

  /* --- cielo ------------------------------------------------------------- */
  function sky() {
    return memo('sky', function () {
      var w = 2048, h = 1024, c = canvas(w, h), g = c.getContext('2d');
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.00, '#0c2f6d');
      grad.addColorStop(0.18, '#1e5aa8');
      grad.addColorStop(0.34, '#4f95d6');
      grad.addColorStop(0.46, '#93c8ee');
      grad.addColorStop(0.52, '#cbe3f3');
      grad.addColorStop(0.56, '#e6eef2');
      grad.addColorStop(0.62, '#d9e3e0');
      grad.addColorStop(1.00, '#93a58e');
      g.fillStyle = grad; g.fillRect(0, 0, w, h);

      // sol
      var sx = w * 0.20, sy = h * 0.17;
      var halo = g.createRadialGradient(sx, sy, 4, sx, sy, 420);
      halo.addColorStop(0.00, 'rgba(255,255,248,1)');
      halo.addColorStop(0.06, 'rgba(255,250,225,0.92)');
      halo.addColorStop(0.24, 'rgba(255,238,190,0.34)');
      halo.addColorStop(1.00, 'rgba(255,238,190,0)');
      g.fillStyle = halo; g.fillRect(sx - 440, sy - 440, 880, 880);

      // cumulos con base plana y sombra inferior
      function cumulus(cx, cy, scale, alpha) {
        var lobes = 7 + ((Math.random() * 5) | 0);
        var w0 = 150 * scale;
        // sombra
        for (var i = 0; i < lobes; i++) {
          var px = cx + (i / (lobes - 1) - 0.5) * w0 * 2;
          var py = cy + Math.sin(i / lobes * Math.PI) * -22 * scale + 12 * scale;
          var rad = (34 + Math.random() * 40) * scale;
          var gs = g.createRadialGradient(px, py, 1, px, py, rad);
          gs.addColorStop(0, 'rgba(168,186,205,' + (alpha * 0.55) + ')');
          gs.addColorStop(1, 'rgba(168,186,205,0)');
          g.fillStyle = gs;
          g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
        for (var j = 0; j < lobes; j++) {
          var qx = cx + (j / (lobes - 1) - 0.5) * w0 * 2;
          var qy = cy + Math.sin(j / lobes * Math.PI) * -30 * scale;
          var r2 = (32 + Math.random() * 46) * scale;
          var gr = g.createRadialGradient(qx, qy - r2 * 0.25, 2, qx, qy, r2);
          gr.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
          gr.addColorStop(0.55, 'rgba(252,253,255,' + (alpha * 0.75) + ')');
          gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr;
          g.fillRect(qx - r2, qy - r2, r2 * 2, r2 * 2);
        }
      }
      for (var i = 0; i < 16; i++) {
        cumulus(Math.random() * w, h * (0.16 + Math.random() * 0.24), 0.55 + Math.random() * 1.0, 0.7 + Math.random() * 0.3);
      }
      // cirros altos
      for (var k = 0; k < 10; k++) {
        var cx2 = Math.random() * w, cy2 = h * (0.05 + Math.random() * 0.14);
        var gr2 = g.createRadialGradient(cx2, cy2, 4, cx2, cy2, 220);
        gr2.addColorStop(0, 'rgba(255,255,255,0.30)');
        gr2.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr2;
        g.save(); g.translate(cx2, cy2); g.scale(1, 0.22); g.translate(-cx2, -cy2);
        g.fillRect(cx2 - 240, cy2 - 240, 480, 480);
        g.restore();
      }
      return toTexture(c, 1, 1);
    });
  }

  function blob() {
    return memo('blob', function () {
      var s = 128, c = canvas(s, s), g = c.getContext('2d');
      var gr = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.7)');
      gr.addColorStop(0.55, 'rgba(0,0,0,0.32)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      return new THREE.CanvasTexture(c);
    });
  }

  function checker() {
    return memo('checker', function () {
      var s = 128, c = canvas(s, s), g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#15171c';
      var n = 8, q = s / n;
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          if ((x + y) % 2 === 0) g.fillRect(x * q, y * q, q, q);
        }
      }
      return toTexture(c, 8, 1);
    });
  }

  function plate(num, bg, fg) {
    var key = 'plate' + num + bg + fg;
    return memo(key, function () {
      var s = 128, c = canvas(s, s), g = c.getContext('2d');
      g.clearRect(0, 0, s, s);
      g.fillStyle = bg;
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, 6.283); g.fill();
      g.strokeStyle = fg; g.lineWidth = 5;
      g.beginPath(); g.arc(s / 2, s / 2, s * 0.44, 0, 6.283); g.stroke();
      g.fillStyle = fg;
      g.font = 'bold 74px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(num), s / 2, s / 2 + 4);
      var t = new THREE.CanvasTexture(c);
      t.anisotropy = 8;
      return srgb(t);
    });
  }

  return {
    asphalt: asphalt, asphaltBump: asphaltBump, grass: grass, kerb: kerb,
    wall: wall, crowd: crowd, sky: sky, blob: blob, checker: checker, plate: plate
  };
})();
