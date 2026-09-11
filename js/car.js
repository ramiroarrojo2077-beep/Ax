/* Construccion del monoplaza. El auto del jugador imita al Alpine:
   celeste con detalles rosas, piloto visible con casco, visor y halo.
   Los rivales usan la misma carroceria en rojo, negro y plateado. */
window.CarFactory = (function () {
  'use strict';

  /* Caja con seccion variable (permite morros y pontones afinados). */
  function taper(wA, hA, wB, hB, len, yA, yB) {
    var a = wA / 2, b = wB / 2, ha = hA / 2, hb = hB / 2, l = len / 2;
    var ya = yA || 0;
    var yb = (yB === undefined ? ya : yB);
    var v = new Float32Array([
      -a, ya - ha, -l, a, ya - ha, -l, a, ya + ha, -l, -a, ya + ha, -l,
      -b, yb - hb, l, b, yb - hb, l, b, yb + hb, l, -b, yb + hb, l
    ]);
    var idx = [
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      3, 7, 6, 3, 6, 2,
      0, 4, 7, 0, 7, 3,
      1, 6, 5, 1, 2, 6
    ];
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.setIndex(idx);
    var flat = g.toNonIndexed();
    flat.computeVertexNormals();
    g.dispose();
    return flat;
  }

  /* Pintura metalizada: usa el mapa de entorno de la escena para reflejar
     el cielo, como la carroceria real. */
  function mat(color, gloss) {
    var g = gloss === undefined ? 70 : gloss;
    return new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.30,
      roughness: Math.max(0.08, 0.52 - g / 300),
      envMapIntensity: 0.85
    });
  }

  function box(w, h, d, m, x, y, z) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    return mesh;
  }

  function wheel(radius, width, rimColor, detail) {
    var pivot = new THREE.Group();
    var spin = new THREE.Group();

    var tyreGeo = new THREE.CylinderGeometry(radius, radius, width, detail ? 22 : 12);
    tyreGeo.rotateZ(Math.PI / 2);
    var tyre = new THREE.Mesh(tyreGeo, new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.78, metalness: 0.05 }));
    spin.add(tyre);

    var rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, detail ? 20 : 10);
    rimGeo.rotateZ(Math.PI / 2);
    var rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.95, roughness: 0.28, envMapIntensity: 1.3 }));
    spin.add(rim);

    // disco de freno + bujes
    var discGeo = new THREE.CylinderGeometry(radius * 0.46, radius * 0.46, width * 0.55, detail ? 18 : 8);
    discGeo.rotateZ(Math.PI / 2);
    var disc = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({ color: 0x3b3f46, metalness: 0.7, roughness: 0.55 }));
    spin.add(disc);
    var hubGeo = new THREE.CylinderGeometry(radius * 0.17, radius * 0.17, width + 0.06, 10);
    hubGeo.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0xf0c02a, metalness: 0.8, roughness: 0.35 })));

    if (detail) {
      for (var sp = 0; sp < 5; sp++) {
        var spoke = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.7, radius * 1.05, 0.045),
          new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.8, roughness: 0.4 })
        );
        spoke.rotation.x = (sp / 5) * Math.PI;
        spin.add(spoke);
      }
      var stripe = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.84, 0.024, 6, 26),
        new THREE.MeshBasicMaterial({ color: 0xf0c02a })
      );
      stripe.rotation.y = Math.PI / 2;
      stripe.position.x = width / 2 - 0.03;
      spin.add(stripe);
    }
    pivot.add(spin);
    pivot.userData.spin = spin;
    return pivot;
  }

  /* opts: body, accent, trim, rim, helmet, helmetAccent, suit, number, detail */
  function build(opts) {
    var g = new THREE.Group();
    var bodyMat = mat(opts.body, 95);
    var accentMat = mat(opts.accent, 95);
    var trimMat = mat(opts.trim || 0x15171c, 60);
    var darkMat = mat(0x15171c, 40);
    var detail = opts.detail !== false;

    // ---- plataforma y monocasco
    var floor = new THREE.Mesh(taper(1.45, 0.08, 1.15, 0.08, 4.9), trimMat);
    floor.position.set(0, 0.16, -0.1);
    g.add(floor);

    var tub = new THREE.Mesh(taper(0.86, 0.52, 0.62, 0.42, 1.9, 0.0, -0.02), bodyMat);
    tub.position.set(0, 0.46, 0.75);
    g.add(tub);

    var nose = new THREE.Mesh(taper(0.60, 0.40, 0.26, 0.20, 1.9, 0, -0.06), bodyMat);
    nose.position.set(0, 0.46, 2.6);
    g.add(nose);

    // punta rosa del morro
    var tip = new THREE.Mesh(taper(0.26, 0.20, 0.18, 0.14, 0.35, -0.06, -0.08), accentMat);
    tip.position.set(0, 0.46, 3.7);
    g.add(tip);

    // ---- pontones
    for (var s = -1; s <= 1; s += 2) {
      var pod = new THREE.Mesh(taper(0.30, 0.28, 0.66, 0.52, 1.9, 0.02, 0.0), bodyMat);
      pod.position.set(s * 0.62, 0.44, -0.35);
      g.add(pod);
      var podStripe = new THREE.Mesh(taper(0.16, 0.05, 0.40, 0.06, 1.94, 0.02, 0.0), accentMat);
      podStripe.position.set(s * 0.70, 0.63, -0.35);
      g.add(podStripe);
      // entrada de aire
      var inlet = box(0.10, 0.34, 0.5, darkMat, s * 0.94, 0.5, 0.55);
      g.add(inlet);
      // deflector lateral
      var bargeboard = box(0.06, 0.30, 0.9, trimMat, s * 0.86, 0.38, 1.35);
      bargeboard.rotation.y = s * 0.12;
      g.add(bargeboard);
    }

    // ---- tapa motor y airbox
    var engine = new THREE.Mesh(taper(0.24, 0.26, 0.82, 0.60, 2.4, 0.0, 0.02), bodyMat);
    engine.position.set(0, 0.52, -1.35);
    g.add(engine);

    var spine = new THREE.Mesh(taper(0.10, 0.10, 0.26, 0.22, 2.3, 0.0, 0.0), accentMat);
    spine.position.set(0, 0.86, -1.3);
    g.add(spine);

    var airbox = new THREE.Mesh(taper(0.34, 0.32, 0.26, 0.26, 0.66), bodyMat);
    airbox.position.set(0, 0.92, -0.42);
    g.add(airbox);
    var intake = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.18, 12), darkMat);
    intake.rotation.x = Math.PI / 2;
    intake.position.set(0, 0.95, -0.14);
    g.add(intake);

    // ---- aleron delantero
    var fwMain = box(2.02, 0.06, 0.62, accentMat, 0, 0.15, 3.56);
    fwMain.rotation.x = -0.08;
    g.add(fwMain);
    var fwFlap = box(1.96, 0.05, 0.40, bodyMat, 0, 0.31, 3.30);
    fwFlap.rotation.x = -0.24;
    g.add(fwFlap);
    var fwTop = box(1.90, 0.04, 0.26, accentMat, 0, 0.42, 3.12);
    fwTop.rotation.x = -0.34;
    g.add(fwTop);
    for (var e = -1; e <= 1; e += 2) {
      var ep = new THREE.Mesh(taper(0.05, 0.44, 0.05, 0.30, 0.7, 0.06, 0.0), bodyMat);
      ep.position.set(e * 1.01, 0.32, 3.42);
      g.add(ep);
      var pillar = box(0.05, 0.22, 0.3, darkMat, e * 0.12, 0.3, 3.62);
      g.add(pillar);
    }

    // ---- aleron trasero
    var rwMain = box(1.30, 0.07, 0.48, accentMat, 0, 1.30, -2.40);
    rwMain.rotation.x = 0.15;
    g.add(rwMain);
    var rwFlap = box(1.26, 0.05, 0.30, bodyMat, 0, 1.50, -2.54);
    rwFlap.rotation.x = 0.44;
    g.add(rwFlap);
    for (var r = -1; r <= 1; r += 2) {
      var rep = new THREE.Mesh(taper(0.05, 0.86, 0.05, 0.70, 0.78, 0.02, 0.06), bodyMat);
      rep.position.set(r * 0.66, 1.22, -2.44);
      g.add(rep);
      var fin = box(0.04, 0.10, 0.5, accentMat, r * 0.66, 1.62, -2.42);
      g.add(fin);
    }
    // pilon central del aleron
    var pylon = new THREE.Mesh(taper(0.12, 0.52, 0.10, 0.34, 0.5, 0.0, 0.10), trimMat);
    pylon.position.set(0, 1.02, -2.36);
    g.add(pylon);
    var beam = box(1.05, 0.05, 0.26, trimMat, 0, 0.56, -2.48);
    g.add(beam);
    var gearbox = new THREE.Mesh(taper(0.34, 0.36, 0.46, 0.44, 0.75, 0.0, 0.02), trimMat);
    gearbox.position.set(0, 0.52, -2.15);
    g.add(gearbox);
    var diffuser = new THREE.Mesh(taper(1.15, 0.30, 1.0, 0.22, 0.6, 0.0, 0.06), darkMat);
    diffuser.position.set(0, 0.26, -2.3);
    g.add(diffuser);
    var rearLight = box(0.12, 0.12, 0.06, new THREE.MeshBasicMaterial({ color: 0xff2a2a }), 0, 0.52, -2.66);
    g.add(rearLight);

    // ---- piloto
    var cockpit = box(0.7, 0.3, 1.0, darkMat, 0, 0.62, 0.55);
    g.add(cockpit);
    var shoulders = new THREE.Mesh(taper(0.5, 0.26, 0.42, 0.24, 0.5), mat(opts.suit || 0x1b2440, 30));
    shoulders.position.set(0, 0.70, 0.38);
    g.add(shoulders);

    var helmetMat = mat(opts.helmet || 0xf2f2f2, 120);
    var helmet = new THREE.Mesh(new THREE.SphereGeometry(0.165, detail ? 20 : 12, detail ? 16 : 10), helmetMat);
    helmet.scale.set(1, 1.05, 1.12);
    helmet.position.set(0, 0.91, 0.62);
    g.add(helmet);

    var crest = new THREE.Mesh(new THREE.SphereGeometry(0.167, 16, 12, 0, Math.PI * 2, 0, 0.55), mat(opts.helmetAccent || 0xff4fa3, 120));
    crest.scale.set(1, 1.05, 1.12);
    crest.position.copy(helmet.position);
    g.add(crest);

    var visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.172, 18, 14, -0.55, 1.1, 1.05, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0d1016, metalness: 1.0, roughness: 0.06, envMapIntensity: 2.0 })
    );
    visor.scale.set(1, 1.05, 1.12);
    visor.position.copy(helmet.position);
    visor.rotation.y = Math.PI / 2;
    g.add(visor);

    var halo = null;
    if (detail) {
      var curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.36, 0.74, 0.05),
        new THREE.Vector3(0.32, 1.00, 0.62),
        new THREE.Vector3(0.00, 1.06, 1.02),
        new THREE.Vector3(-0.32, 1.00, 0.62),
        new THREE.Vector3(-0.36, 0.74, 0.05)
      ]);
      halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.036, 6, false), trimMat);
      g.add(halo);
      var strut = box(0.06, 0.3, 0.06, trimMat, 0, 0.9, 1.0);
      g.add(strut);

      // brazos y volante
      var suitMat = mat(opts.suit || 0x1b2440, 30);
      for (var arm = -1; arm <= 1; arm += 2) {
        var a1 = box(0.11, 0.11, 0.42, suitMat, arm * 0.18, 0.70, 0.75);
        a1.rotation.x = -0.25;
        g.add(a1);
        var hand = box(0.09, 0.09, 0.1, darkMat, arm * 0.16, 0.76, 0.98);
        g.add(hand);
      }
      var steering = box(0.3, 0.16, 0.05, darkMat, 0, 0.76, 1.02);
      steering.rotation.x = 0.5;
      g.add(steering);

      // espejos
      for (var mi = -1; mi <= 1; mi += 2) {
        var stalk = box(0.22, 0.03, 0.03, trimMat, mi * 0.46, 0.68, 0.95);
        g.add(stalk);
        var mirror = box(0.12, 0.09, 0.04, accentMat, mi * 0.56, 0.68, 0.95);
        g.add(mirror);
      }
    }

    // ---- numero en el airbox
    if (opts.number) {
      var ptex = GFX.plate(opts.number, opts.accent, opts.body);
      for (var ns = -1; ns <= 1; ns += 2) {
        var plate = new THREE.Mesh(
          new THREE.PlaneGeometry(0.3, 0.3),
          new THREE.MeshBasicMaterial({ map: ptex, transparent: true })
        );
        plate.position.set(ns * 0.17, 0.95, -0.45);
        plate.rotation.y = ns * Math.PI / 2;
        g.add(plate);
      }
    }

    // ---- ruedas
    var rimColor = opts.rim || 0xb9bfc7;
    var fl = wheel(0.34, 0.32, rimColor, detail); fl.position.set(-0.86, 0.34, 1.75);
    var fr = wheel(0.34, 0.32, rimColor, detail); fr.position.set(0.86, 0.34, 1.75);
    var rl = wheel(0.38, 0.46, rimColor, detail); rl.position.set(-0.88, 0.38, -1.65);
    var rr = wheel(0.38, 0.46, rimColor, detail); rr.position.set(0.88, 0.38, -1.65);
    g.add(fl, fr, rl, rr);

    if (detail) {
      var armMat = trimMat;
      for (var w = -1; w <= 1; w += 2) {
        for (var k = 0; k < 2; k++) {
          var fa = box(0.62, 0.05, 0.05, armMat, w * 0.48, 0.34 + k * 0.12, 1.75 + (k ? 0.22 : -0.22));
          g.add(fa);
          var ra = box(0.6, 0.05, 0.05, armMat, w * 0.5, 0.38 + k * 0.12, -1.65 + (k ? 0.24 : -0.24));
          g.add(ra);
        }
      }
    }

    // proyeccion de sombras reales
    g.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
    });

    var holder = new THREE.Group();   // carroceria (con balanceo) + sombra de contacto
    holder.add(g);

    if (opts.blobShadow !== false) {
      var shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 6.2),
        new THREE.MeshBasicMaterial({ map: GFX.blob(), transparent: true, opacity: opts.blobOpacity || 0.5, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      shadow.renderOrder = 1;
      holder.add(shadow);
    }

    return {
      root: holder,
      body: g,
      wheels: [fl, fr, rl, rr],
      steered: [fl, fr],
      helmet: helmet
    };
  }

  var LIVERIES = {
    alpine: { body: 0x2ab6f0, accent: 0xff4fa3, trim: 0x14202e, rim: 0xd6dbe2, helmet: 0x2ab6f0, helmetAccent: 0xff4fa3, suit: 0x14284a, number: 10 },
    red: { body: 0xcc1122, accent: 0x22252b, trim: 0x1a1c20, rim: 0xc9ced6, helmet: 0xf2f2f2, helmetAccent: 0xcc1122, suit: 0x8c1220, number: 16 },
    black: { body: 0x1a1d22, accent: 0xc9ced6, trim: 0x0e0f12, rim: 0x8f959d, helmet: 0x1a1d22, helmetAccent: 0xf0c02a, suit: 0x24272d, number: 4 },
    silver: { body: 0xc3cad3, accent: 0x2f3a46, trim: 0x1b1f26, rim: 0x7f858d, helmet: 0xdfe4ea, helmetAccent: 0x2f7fd0, suit: 0x39404a, number: 44 }
  };

  return { build: build, LIVERIES: LIVERIES };
})();
