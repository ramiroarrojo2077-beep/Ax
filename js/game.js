/* Bucle principal: fisica arcade, rivales, camara, HUD, efectos y sonido. */
(function () {
  'use strict';

  var MAX_SPEED = 92;          // m/s  (~331 km/h)
  var RIVALS = 7;
  var START_POS = 20;
  var LANES = [-5.2, -2.6, 0, 2.6, 5.2];

  var canvas = document.getElementById('scene');

  /* Calidad: en telefonos bajamos resolucion, sombras y particulas. */
  var coarse = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
    Math.min(window.innerWidth, window.innerHeight) < 520;
  var forced = /[?&]q=(low|high)/.exec(location.search);
  var QUALITY = forced ? forced[1] : (coarse ? 'low' : 'high');
  var HIGH = QUALITY === 'high';

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: HIGH, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, HIGH ? 2 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  if (HIGH) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdce9f0, 300, 1120);

  var camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.3, 9000);
  camera.position.set(0, 2.5, -8.5);

  var sky = Sky.create(scene, renderer, QUALITY);
  var track = Track.create(scene);
  var fx = FX.create(scene, HIGH ? 300 : 140);

  // ---- autos ---------------------------------------------------------------
  var alpine = {};
  for (var key in CarFactory.LIVERIES.alpine) alpine[key] = CarFactory.LIVERIES.alpine[key];
  alpine.blobShadow = !HIGH;
  var player = CarFactory.build(alpine);
  scene.add(player.root);

  var rivalColors = ['red', 'black', 'silver'];
  var rivals = [];
  for (var i = 0; i < RIVALS; i++) {
    var livery = CarFactory.LIVERIES[rivalColors[i % 3]];
    var car = CarFactory.build({
      body: livery.body, accent: livery.accent, trim: livery.trim, rim: livery.rim,
      helmet: livery.helmet, helmetAccent: livery.helmetAccent, suit: livery.suit,
      number: livery.number, detail: false,
      blobShadow: !HIGH, blobOpacity: 0.42
    });
    scene.add(car.root);
    rivals.push({
      car: car, z: 0, lat: 0, targetLat: 0, speed: 55,
      passed: false, hitCd: 0, phase: Math.random() * 6.28
    });
  }

  /* Nadie aparece pegado al jugador ni encima de otro rival. */
  function laneBusy(lane, z, ignore) {
    for (var k = 0; k < rivals.length; k++) {
      var o = rivals[k];
      if (o === ignore) continue;
      if (Math.abs(o.targetLat - lane) < 2.2 && Math.abs(o.z - z) < 50) return true;
    }
    return false;
  }

  function resetRival(r, index, dist, near) {
    var lane = 0, z = 0, tries = 0;
    do {
      z = near
        ? dist + 90 + Math.random() * 230 + index * 30
        : dist + 230 + Math.random() * 480 + index * 34;
      lane = LANES[(Math.random() * LANES.length) | 0];
      tries++;
    } while (laneBusy(lane, z, r) && tries < 14);
    r.z = z;
    r.lat = lane;
    r.targetLat = lane;
    r.speed = 39 + Math.random() * 17;
    r.passed = false;
    r.hitCd = 0;
  }

  // ---- estado --------------------------------------------------------------
  var S = {
    started: false, paused: false,
    speed: 0, dist: 0, lat: 0, latVel: 0,
    steer: 0, throttle: 0, brake: 0,
    pos: START_POS, passes: 0, lap: 1, best: 0,
    shake: 0, offTrack: false, onKerb: false, hits: 0, time: 0, flash: 0
  };

  // ---- HUD -----------------------------------------------------------------
  var el = {
    speed: document.getElementById('speed'),
    gear: document.getElementById('gear'),
    pos: document.getElementById('pos'),
    lap: document.getElementById('lap'),
    passes: document.getElementById('passes'),
    best: document.getElementById('best'),
    msg: document.getElementById('msg'),
    overlay: document.getElementById('overlay'),
    rush: document.getElementById('rush'),
    revs: []
  };
  var revBar = document.getElementById('revbar');
  if (revBar) {
    for (var v = 0; v < 18; v++) {
      var led = document.createElement('i');
      if (v > 13) led.className = 'red';
      else if (v > 9) led.className = 'amber';
      revBar.appendChild(led);
      el.revs.push(led);
    }
  }

  function gearOf(speed) {
    return Math.min(8, Math.max(1, Math.floor(speed / (MAX_SPEED / 8)) + 1));
  }
  function revOf(speed) {
    var band = MAX_SPEED / 8;
    var r = (speed % band) / band;
    if (speed >= MAX_SPEED - 0.5) return 1;
    return Math.min(1, 0.22 + r * 0.78);
  }

  var hud = { kmh: -1, gear: -1, pos: '', lap: -1, passes: -1, best: -1, lit: -1 };
  function updateHud(rev) {
    var kmh = Math.round(S.speed * 3.6);
    if (el.speed && kmh !== hud.kmh) { el.speed.textContent = kmh; hud.kmh = kmh; }
    var g = gearOf(S.speed);
    if (el.gear && g !== hud.gear) { el.gear.textContent = g; hud.gear = g; }
    var p = 'P' + S.pos;
    if (el.pos && p !== hud.pos) { el.pos.textContent = p; hud.pos = p; }
    if (el.lap && S.lap !== hud.lap) { el.lap.textContent = S.lap; hud.lap = S.lap; }
    if (el.passes && S.passes !== hud.passes) { el.passes.textContent = S.passes; hud.passes = S.passes; }
    var best = Math.round(S.best * 3.6);
    if (el.best && best !== hud.best) { el.best.textContent = best; hud.best = best; }
    var lit = Math.round(rev * el.revs.length);
    if (lit !== hud.lit) {
      for (var i = 0; i < el.revs.length; i++) el.revs[i].classList.toggle('on', i < lit);
      hud.lit = lit;
    }
  }

  function message(text, time) {
    if (!el.msg) return;
    el.msg.textContent = text;
    el.msg.classList.add('show');
    S.flash = time || 1.4;
  }

  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { } }
  }

  // ---- sonido --------------------------------------------------------------
  var Sound = {
    ctx: null, on: true, master: null, osc1: null, osc2: null, filter: null,
    init: function () {
      if (this.ctx) { this.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1200;
      this.osc1 = this.ctx.createOscillator(); this.osc1.type = 'sawtooth';
      this.osc2 = this.ctx.createOscillator(); this.osc2.type = 'square';
      this.osc1.frequency.value = 60; this.osc2.frequency.value = 90;
      var g2 = this.ctx.createGain(); g2.gain.value = 0.35;
      this.osc1.connect(this.filter);
      this.osc2.connect(g2); g2.connect(this.filter);
      this.filter.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.osc1.start(); this.osc2.start();
    },
    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    update: function (rev, throttle, off) {
      if (!this.ctx) return;
      var f = 55 + rev * 210;
      var t = this.ctx.currentTime;
      this.osc1.frequency.setTargetAtTime(f, t, 0.05);
      this.osc2.frequency.setTargetAtTime(f * 1.503, t, 0.05);
      this.filter.frequency.setTargetAtTime(600 + rev * 2600 + (off ? 900 : 0), t, 0.08);
      var vol = (this.on && S.started && !S.paused) ? (0.03 + throttle * 0.045 + rev * 0.02) : 0;
      this.master.gain.setTargetAtTime(vol, t, 0.1);
    },
    toggle: function () {
      this.on = !this.on;
      this.init();
      var b = document.getElementById('mute');
      if (b) {
        b.textContent = this.on ? '🔊' : '🔇';
        b.setAttribute('aria-pressed', this.on ? 'false' : 'true');
      }
    }
  };
  var muteBtn = document.getElementById('mute');
  if (muteBtn) {
    muteBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    muteBtn.addEventListener('click', function (e) { e.stopPropagation(); Sound.toggle(); });
  }

  // ---- arranque / pausa / reinicio -----------------------------------------
  function start() {
    if (S.started) return;
    S.started = true;
    S.paused = false;
    document.body.classList.remove('paused');
    if (el.overlay) el.overlay.classList.add('hidden');
    Sound.init();
    message('¡VAMOS!', 1.2);
  }

  function restart() {
    S.speed = 0; S.dist = 0; S.lat = 0; S.latVel = 0;
    S.steer = 0; S.throttle = 0; S.brake = 0;
    S.pos = START_POS; S.passes = 0; S.lap = 1; S.time = 0;
    S.hits = 0; S.best = 0; S.shake = 0; S.offTrack = false; S.onKerb = false;
    S.paused = false;
    document.body.classList.remove('paused', 'offtrack');
    camera.position.x = 0;
    fx.clear();
    for (var k = 0; k < rivals.length; k++) resetRival(rivals[k], k, 0, true);
    Input.reset();
    message('REINICIO', 1.0);
  }

  function togglePause() {
    if (!S.started) return;
    S.paused = !S.paused;
    document.body.classList.toggle('paused', S.paused);
    if (S.paused) message('PAUSA · P PARA SEGUIR', 9999);
    else { message('VAMOS', 0.8); Sound.resume(); }
  }

  var pauseBtn = document.getElementById('pausebtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    pauseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!S.started) start(); else togglePause();
    });
  }

  var startBtn = document.getElementById('startbtn');
  if (startBtn) {
    startBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    startBtn.addEventListener('click', start);
  }

  Input.init(document.body);
  Input.onPress(function (k) {
    Sound.resume();
    if (!S.started) { start(); return; }
    if (k === 'p' || k === 'escape') togglePause();
    else if (k === 'r') restart();
    else if (k === 'm') Sound.toggle();
  });
  canvas.addEventListener('pointerdown', function () { if (!S.started) start(); });

  for (var k2 = 0; k2 < rivals.length; k2++) resetRival(rivals[k2], k2, 0, true);

  // ---- simulacion ----------------------------------------------------------
  var tmp = { x: 0, z: 0, yaw: 0 };
  var padPauseDown = false;

  function step(dt) {
    var ctl = Input.read();

    // joystick: boton start pausa
    var padPause = Input.gamepadPressed(9);
    if (padPause && !padPauseDown) togglePause();
    padPauseDown = padPause;
    if (S.paused) return;

    // direccion: entra progresiva y vuelve al centro mas rapido
    var steerRate = (Math.abs(ctl.steer) < 0.02) ? 11 : 7;
    S.steer += (ctl.steer - S.steer) * Math.min(1, dt * steerRate);
    S.throttle += (ctl.gas - S.throttle) * Math.min(1, dt * 7);
    S.brake += (ctl.brake - S.brake) * Math.min(1, dt * 12);

    var wasOff = S.offTrack;
    var absLat = Math.abs(S.lat);
    S.onKerb = absLat > track.ROAD_HALF - 0.2 && absLat <= track.ROAD_HALF + 1.2;
    S.offTrack = absLat > track.ROAD_HALF + 1.2;
    var grip = S.offTrack ? 0.45 : (S.onKerb ? 0.85 : 1);
    if (S.offTrack && !wasOff) buzz(40);

    // motor, resistencia y frenos
    var accel = 14 * (1 - 0.55 * S.speed / MAX_SPEED) * S.throttle * (S.offTrack ? 0.35 : 1);
    var drag = 0.8 + S.speed * S.speed * 0.00065 + (S.offTrack ? 9 : 0);
    S.speed += (accel - drag - S.brake * 34) * dt;
    if (S.speed < 0) S.speed = 0;
    if (S.speed > MAX_SPEED) S.speed = MAX_SPEED;
    if (S.offTrack && S.speed > 58) S.speed = 58;
    if (S.speed > S.best) S.best = S.speed;

    // lateral: la curva empuja hacia afuera y el peralte ayuda a sostenerla
    var kappa = track.curvatureAt(S.dist);
    var bank = track.bankAt(S.dist);
    var push = -kappa * S.speed * S.speed * 0.62 - bank * 9.8 * 0.5;
    var authority = 62 * grip * Math.min(1, S.speed / 22) * (1 - 0.3 * (S.speed / MAX_SPEED));
    S.latVel += (push + S.steer * authority) * dt;
    S.latVel *= Math.pow(0.02, dt);
    if (S.latVel > 19) S.latVel = 19;
    if (S.latVel < -19) S.latVel = -19;
    S.lat += S.latVel * dt;
    if (S.lat > 30) { S.lat = 30; S.latVel = 0; }
    if (S.lat < -30) { S.lat = -30; S.latVel = 0; }

    var prevDist = S.dist;
    S.dist += S.speed * dt;
    S.time += dt;

    if (Math.floor(S.dist / track.LAP_LENGTH) > Math.floor(prevDist / track.LAP_LENGTH)) {
      S.lap++;
      message('VUELTA ' + S.lap, 1.6);
    }

    track.update(S.dist);

    // ---- rivales
    for (var i = 0; i < rivals.length; i++) {
      var r = rivals[i];
      r.z += r.speed * dt;
      r.phase += dt * 0.5;
      if (r.hitCd > 0) r.hitCd -= dt;
      if (Math.random() < dt * 0.1) {
        var cand = LANES[(Math.random() * LANES.length) | 0];
        if (!laneBusy(cand, r.z, r)) r.targetLat = cand;
      }

      // no se pisan entre ellos: el de atras se corre
      for (var j = 0; j < rivals.length; j++) {
        if (j === i) continue;
        var o = rivals[j];
        if (Math.abs(o.z - r.z) < 13 && Math.abs(o.lat - r.lat) < 2.4) {
          if (r.z < o.z) {
            r.targetLat = r.lat + (r.lat <= o.lat ? -2.6 : 2.6);
            r.speed -= 4 * dt;
          }
        }
      }
      if (r.targetLat > 5.4) r.targetLat = 5.4;
      if (r.targetLat < -5.4) r.targetLat = -5.4;
      r.lat += (r.targetLat + Math.sin(r.phase) * 0.45 - r.lat) * Math.min(1, dt * 1.3);
      if (r.speed < 34) r.speed = 34;

      var rel = r.z - S.dist;
      if (!r.passed && rel < -3) {
        r.passed = true;
        S.passes++;
        if (S.pos > 1) S.pos--;
        message(S.pos === 1 ? '¡P1! LIDERÁS LA CARRERA' : 'ADELANTAMIENTO · P' + S.pos, 1.3);
      }
      if (rel < -110 || rel > track.VIEW + 120) resetRival(r, i, S.dist);

      // choque con el jugador
      var dx = r.lat - S.lat;
      if (r.hitCd <= 0 && Math.abs(rel) < 4.4 && Math.abs(dx) < 1.95) {
        r.hitCd = 1.0;
        S.hits++;
        S.speed = Math.min(S.speed, Math.max(r.speed * 0.85, 26));
        var dir = dx >= 0 ? -1 : 1;
        S.latVel = dir * 9;
        S.lat += dir * 0.5;
        r.lat -= dir * 1.4;
        r.targetLat = r.lat;
        S.shake = 0.6;
        buzz([25, 30, 25]);
        fx.burst(track.screenX(S.lat + dx * 0.5), 2.2, 10);
        message('¡CONTACTO!', 0.9);
      }

      track.toLocal(r.z, r.lat, tmp);
      r.car.root.position.set(tmp.x, track.surfaceY(r.lat, r.z), tmp.z);
      r.car.root.rotation.y = tmp.yaw;
      r.car.root.rotation.z = -Math.atan(track.bankAt(r.z));
      r.car.root.visible = rel > -60 && rel < track.VIEW + 80;
      var spin = r.speed * dt / 0.36;
      for (var w = 0; w < r.car.wheels.length; w++) r.car.wheels[w].userData.spin.rotation.x += spin;
    }

    // ---- auto del jugador
    player.root.position.set(track.screenX(S.lat), track.surfaceY(S.lat, S.dist), 0);
    player.root.rotation.y = -Math.atan2(S.latVel, Math.max(12, S.speed)) * 0.85;
    player.root.rotation.z = -Math.atan(bank);
    player.body.rotation.z = -S.steer * 0.035 - S.latVel * 0.004;
    player.body.rotation.x = (S.brake * 0.02 - S.throttle * 0.012) +
      ((S.offTrack || S.onKerb) ? Math.sin(S.time * 34) * 0.012 : 0);
    player.body.position.y = (S.offTrack || S.onKerb)
      ? Math.abs(Math.sin(S.time * 26)) * (S.offTrack ? 0.05 : 0.03) : 0;

    var pSpin = S.speed * dt / 0.36;
    for (var pw = 0; pw < player.wheels.length; pw++) player.wheels[pw].userData.spin.rotation.x += pSpin;
    player.steered[0].rotation.y = -S.steer * 0.30;
    player.steered[1].rotation.y = -S.steer * 0.30;
    if (player.brakeLight) {
      player.brakeLight.material.color.setHex(S.brake > 0.15 ? 0xff3b3b : 0x5c1418);
    }

    // ---- particulas
    var carX = track.screenX(S.lat);
    if (S.offTrack && S.speed > 8) {
      fx.dust(carX - 0.9, -1.6);
      fx.dust(carX + 0.9, -1.6);
    } else if (S.brake > 0.5 && S.speed > 30) {
      fx.smoke(carX - 0.9, -1.6);
      fx.smoke(carX + 0.9, -1.6);
    }
    fx.update(dt, S.speed);

    // ---- camara
    S.shake = Math.max(0, S.shake - dt * 1.5);
    var speedN = S.speed / MAX_SPEED;
    var shakeAmt = S.shake * 0.25 + (S.offTrack ? 0.05 : 0) +
      (S.onKerb ? 0.03 : 0) + speedN * 0.012;
    var camX = track.screenX(S.lat * 0.82) - S.steer * 0.5;
    camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y = 2.55 + track.surfaceY(S.lat, S.dist) + Math.sin(S.time * 30) * shakeAmt;
    camera.position.z = -8.6 - speedN * 1.2;
    camera.fov = 62 + speedN * 16;
    camera.updateProjectionMatrix();
    camera.lookAt(track.screenX(S.lat * 0.45) - S.steer * 1.2, 1.25, 26);
    camera.rotation.z += -bank * 0.5 + S.steer * 0.012 + Math.sin(S.time * 22) * shakeAmt * 0.02;

    sky.update(track.heading(), camera.position.x, camera.position.z);

    // ---- HUD
    var rev = revOf(S.speed);
    Sound.update(rev * (0.35 + speedN * 0.65), S.throttle, S.offTrack);
    updateHud(rev);
    document.body.classList.toggle('offtrack', S.offTrack);
    if (el.rush) el.rush.style.opacity = Math.max(0, (speedN - 0.55) / 0.45) * 0.75;
    if (S.flash > 0) {
      S.flash -= dt;
      if (S.flash <= 0 && el.msg) el.msg.classList.remove('show');
    }
  }

  // ---- bucle ---------------------------------------------------------------
  var last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S.started) step(dt);
    else track.update(S.dist);
    renderer.render(scene, camera);
  }

  track.update(0);
  player.root.position.set(0, 0, 0);
  sky.update(0, 0, -8.5);
  requestAnimationFrame(frame);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && S.started && !S.paused) togglePause();
  });
})();
