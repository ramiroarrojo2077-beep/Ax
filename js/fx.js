/* Particulas simples: polvo al pisar el pasto, humo de gomas al frenar y
   estallido en los contactos. Un solo THREE.Points con pool fijo. */
window.FX = (function () {
  'use strict';

  function create(scene, max) {
    max = max || 260;
    var pos = new Float32Array(max * 3);
    var col = new Float32Array(max * 4);
    var vel = new Float32Array(max * 3);
    var life = new Float32Array(max);
    var span = new Float32Array(max);
    var next = 0;

    for (var i = 0; i < max; i++) pos[i * 3 + 1] = -60;   // dormidas bajo el suelo

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    var mat = new THREE.PointsMaterial({
      size: 1.1,
      map: GFX.puff(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 3;
    scene.add(points);

    function spawn(x, y, z, vx, vy, vz, r, g, b, a, secs) {
      var i = next;
      next = (next + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      col[i * 4] = r; col[i * 4 + 1] = g; col[i * 4 + 2] = b; col[i * 4 + 3] = a;
      life[i] = secs; span[i] = secs;
    }

    var rnd = function (n) { return (Math.random() - 0.5) * n; };

    return {
      points: points,

      dust: function (x, z) {
        spawn(x + rnd(0.5), 0.15, z + rnd(0.5),
          rnd(2.2), 0.7 + Math.random() * 1.4, -2 - Math.random() * 3,
          0.58, 0.47, 0.28, 0.55 + Math.random() * 0.25, 0.75 + Math.random() * 0.4);
      },

      smoke: function (x, z) {
        spawn(x + rnd(0.4), 0.18, z + rnd(0.3),
          rnd(1.2), 0.9 + Math.random() * 1.0, -1 - Math.random() * 2,
          0.72, 0.72, 0.74, 0.35 + Math.random() * 0.2, 0.6 + Math.random() * 0.5);
      },

      burst: function (x, z, n) {
        for (var k = 0; k < (n || 12); k++) {
          spawn(x + rnd(1.4), 0.4 + Math.random() * 0.6, z + rnd(1.4),
            rnd(7), 1.5 + Math.random() * 2.5, rnd(5),
            0.92, 0.86, 0.72, 0.8, 0.5 + Math.random() * 0.4);
        }
      },

      update: function (dt, scrollSpeed) {
        var scroll = scrollSpeed * dt;
        for (var i = 0; i < max; i++) {
          if (life[i] <= 0) continue;
          life[i] -= dt;
          if (life[i] <= 0) {
            pos[i * 3 + 1] = -60;
            col[i * 4 + 3] = 0;
            continue;
          }
          vel[i * 3 + 1] -= 1.6 * dt;              // se asientan despacio
          vel[i * 3] *= 0.96;
          vel[i * 3 + 2] *= 0.96;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt - scroll;
          if (pos[i * 3 + 1] < 0.05) pos[i * 3 + 1] = 0.05;
          col[i * 4 + 3] *= Math.pow(0.06, dt / Math.max(0.05, span[i]));
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },

      clear: function () {
        for (var i = 0; i < max; i++) {
          life[i] = 0; col[i * 4 + 3] = 0; pos[i * 3 + 1] = -60;
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      }
    };
  }

  return { create: create };
})();
