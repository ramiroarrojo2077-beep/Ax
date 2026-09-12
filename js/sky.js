/* Entorno: cupula de cielo, cordillera 3D, suelo, luces, sombras y mapa de
   reflejos. Todo el grupo rota con la orientacion del auto, por eso el
   panorama se desplaza de lado a lado mientras uno avanza. */
window.Sky = (function () {
  'use strict';

  function create(scene, renderer, quality) {
    var hi = quality !== 'low';
    var group = new THREE.Group();

    var skyTex = GFX.sky();
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(4800, 48, 28),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    dome.renderOrder = -10;
    group.add(dome);

    var mountains = Terrain.create(quality);
    group.add(mountains);

    scene.add(group);

    // suelo
    var groundTex = GFX.grass().clone();
    groundTex.needsUpdate = true;
    groundTex.repeat.set(220, 220);
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(14000, 14000),
      new THREE.MeshLambertMaterial({ color: 0x6d8f4e, map: groundTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    scene.add(ground);

    // reflejos del cielo para la carroceria
    if (renderer && THREE.PMREMGenerator) {
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        var env = pmrem.fromEquirectangular(skyTex).texture;
        scene.environment = env;
        pmrem.dispose();
      } catch (e) { /* sin entorno, se ve igual pero mas mate */ }
    }

    // luces
    var hemi = new THREE.HemisphereLight(0xc6ddf2, 0x4a6b34, 0.45);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xfff3e0, 1.2);
    sun.position.set(-90, 120, 70);
    if (hi) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 320;
      sun.shadow.camera.left = -62;
      sun.shadow.camera.right = 62;
      sun.shadow.camera.top = 62;
      sun.shadow.camera.bottom = -62;
      sun.shadow.bias = -0.0012;
      sun.shadow.normalBias = 0.035;
    }
    scene.add(sun);
    scene.add(sun.target);

    var fill = new THREE.DirectionalLight(0xbfd8ff, 0.12);
    fill.position.set(70, 50, -110);
    scene.add(fill);

    return {
      group: group,
      ground: ground,
      sun: sun,
      update: function (heading, camX, camZ) {
        group.rotation.y = heading;   // el marco local esta espejado en X
        group.position.set(camX, 0, camZ);
        ground.position.x = camX;
        ground.position.z = camZ;
        // el foco de sombras se adelanta al auto para que los rivales
        // tambien proyecten antes de llegar
        sun.position.set(camX - 70, 105, camZ + 100);
        sun.target.position.set(camX, 0, camZ + 45);
        sun.target.updateMatrixWorld();
      }
    };
  }

  return { create: create };
})();
