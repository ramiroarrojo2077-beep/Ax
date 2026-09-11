/* Bucle principal: controles, fisica arcade, rivales, camara, HUD y sonido. */
(function () {
  'use strict';

  var MAX_SPEED = 92;          // m/s  (~331 km/h)
  var RIVALS = 7;
  var START_POS = 20;

  var canvas = document.getElementById('scene');

  /* Calidad: en telefonos bajamos resolucion y apagamos sombras. */
  var mobile = (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) ||
    Math.min(window.innerWidth, window.innerHeight) < 520;
  var forced = /[?&]q=(low|high)/.exec(location.search);
  var QUALITY = forced ? forced[1] : (mobile ? 'low' : 'high');

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, antialias: QUALITY === 'high', powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY === 'high' ? 2 : 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  if (QUALITY === 'high') {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdce9f0, 300, 1120);

  var camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.3, 9000);
  camera.position.set(0, 2.5, -8.5);

  var sky = Sky.create(scene, renderer, QUALITY);
  var track = Track.create(scene);

  // ---- autos ---------------------------------------------------------------
  var alpine = {};
  for (var key in CarFactory.LIVERIES.alpine) alpine[key] = CarFactory.LIVERIES.alpine[key];
  alpine.blobShadow = QUALITY !== 'high';
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
      blobShadow: QUALITY !== 'high', blobOpacity: 0.42
    });
    scene.add(car.root);
    rivals.push({
      car: car, z: 0, lat: 0, targetLat: 0, speed: 60, passed: false, hitCd: 0, phase: Math.random() * 6.28
    });
  }

  var LANES = [-5.0, -2.6, 0, 2.6, 5.0];

  function resetRival(r, index, dist) {
    r.z = dist + 55 + Math.random() * 230 + index * 38;
    r.lat = LANES[(Math.random() * LANES.length) | 0];
    r.targetLat = r.lat;
    r.speed = 39 + Math.random() * 17;
    r.passed = false;
    r.hitCd = 0;
  }

  // ---- estado --------------------------------------------------------------
  var S = {
    started: false, paused: false, over: false,
    speed: 0, dist: 0, lat: 0, latVel: 0,
    steer: 0, throttle: 0, brake: 0,
    pos: START_POS, passes: 0, lap: 1, best: 0,
    shake: 0, offTrack: false, hits: 0, time: 0, flash: 0
  };

  // ---- controles -----------------------------------------------------------
  var keys = {};
  var touch = { left: false, right: false, gas: false, brake: false };

  function keyFlag(e, down) {
    var k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) >= 0) e.preventDefault();
    keys[k] = down;
    if (down) {
      if (!S.started) start();
      if (k === 'p' || k === 'escape') togglePause();
      if (k === 'r') restart();
      if (k === 'm') Sound.toggle();
    }
  }
  window.addEventListener('keydown', function (e) { keyFlag(e, true); });
  window.addEventListener('keyup', function (e) { keyFlag(e, false); });

  function bindTouch(id, prop) {
    var el = document.getElementById(id);
    if (!el) return;
    function on(e) { e.preventDefault(); touch[prop] = true; if (!S.started) start(); }
    function off(e) { e.preventDefault(); touch[prop] = false; }
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindTouch('tc-left', 'left');
  bindTouch('tc-right', 'right');
  bindTouch('tc-gas', 'gas');
  bindTouch('tc-brake', 'brake');

  function input() {
    var left = keys['arrowleft'] || keys['a'] || touch.left;
    var right = keys['arrowright'] || keys['d'] || touch.right;
    var gas = keys['arrowup'] || keys['w'] || touch.gas;
    var brk = keys['arrowdown'] || keys['s'] || keys[' '] || touch.brake;
    return {
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      gas: gas ? 1 : 0,
      brake: brk ? 1 : 0
    };
  }

  // ---- sonido --------------------------------------------------------------
  var Sound = {
    ctx: null, on: true, master: null, osc1: null, osc2: null, filter: null,
    init: function () {
      if (this.ctx) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.0;
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
    update: function (rev, throttle, off) {
      if (!this.ctx) return;
      var f = 55 + rev * 210;
      this.osc1.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
      this.osc2.frequency.setTargetAtTime(f * 1.503, this.ctx.currentTime, 0.05);
      this.filter.frequency.setTargetAtTime(600 + rev * 2600 + (off ? 900 : 0), this.ctx.currentTime, 0.08);
      var vol = this.on ? (0.035 + throttle * 0.045 + rev * 0.02) : 0;
      this.master.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
    },
    toggle: function () {
      this.on = !this.on;
      var b = document.getElementById('mute');
      if (b) b.textContent = this.on ? '🔊' : '🔇';
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
  };
  var muteBtn = document.getElementById('mute');
  if (muteBtn) muteBtn.addEventListener('click', function () { Sound.init(); Sound.toggle(); });

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
    var g = Math.min(8, Math.max(1, Math.floor(speed / (MAX_SPEED / 8)) + 1));
    return g;
  }
  function revOf(speed) {
    var band = MAX_SPEED / 8;
    var r = (speed % band) / band;
    return Math.min(1, 0.25 + r * 0.75 + (speed > MAX_SPEED * 0.97 ? 0.2 : 0));
  }

  var hudTick = 0;
  function updateHud(rev) {
    if (el.speed) el.speed.textContent = Math.round(S.speed * 3.6);
    if (el.gear) el.gear.textContent = gearOf(S.speed);
    if (el.pos) el.pos.textContent = 'P' + S.pos;
    if (el.lap) el.lap.textContent = S.lap;
    if (el.passes) el.passes.textContent = S.passes;
    if (el.best) el.best.textContent = Math.round(S.best * 3.6);
    var lit = Math.round(rev * el.revs.length);
    for (var i = 0; i < el.revs.length; i++) {
      el.revs[i].classList.toggle('on', i < lit);
    }
  }

  function message(text, time) {
    if (!el.msg) return;
    el.msg.textContent = text;
    el.msg.classList.add('show');
    S.flash = time || 1.4;
  }

  // ---- arranque ------------------------------------------------------------
  function start() {
    if (S.started) return;
    S.started = true;
    if (el.overlay) el.overlay.classList.add('hidden');
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    message('¡VAMOS!', 1.2);
  }

  function restart() {
    S.speed = 0; S.dist = 0; S.lat = 0; S.latVel = 0;
    S.pos = START_POS; S.passes = 0; S.lap = 1; S.time = 0; S.hits = 0; S.best = 0;
    for (var i = 0; i < rivals.length; i++) resetRival(rivals[i], i, 0);
    message('REINICIO', 1.0);
  }

  function togglePause() {
    if (!S.started) return;
    S.paused = !S.paused;
    message(S.paused ? 'PAUSA' : 'VAMOS', S.paused ? 999 : 0.8);
  }
  var startBtn = document.getElementById('startbtn');
  if (startBtn) startBtn.addEventListener('click', start);
  canvas.addEventListener('pointerdown', function () { if (!S.started) start(); });

  for (var k = 0; k < rivals.length; k++) resetRival(rivals[k], k, 0);

  // ---- simulacion ----------------------------------------------------------
  var tmp = { x: 0, z: 0, yaw: 0 };

  function step(dt) {
    var ctl = input();

    // direccion suavizada
    S.steer += (ctl.steer - S.steer) * Math.min(1, dt * 9);
    S.throttle += (ctl.gas - S.throttle) * Math.min(1, dt * 6);
    S.brake += (ctl.brake - S.brake) * Math.min(1, dt * 10);

    S.offTrack = Math.abs(S.lat) > track.ROAD_HALF + 0.5;
    var grip = S.offTrack ? 0.45 : 1;

    // aceleracion / frenada / resistencia
    var accel = 14 * (1 - 0.55 * S.speed / MAX_SPEED) * S.throttle * (S.offTrack ? 0.35 : 1);
    var drag = 0.8 + S.speed * S.speed * 0.00065 + (S.offTrack ? 9 : 0);
    S.speed += (accel - drag - S.brake * 34) * dt;
    if (S.speed < 0) S.speed = 0;
    if (S.speed > MAX_SPEED) S.speed = MAX_SPEED;
    if (S.offTrack && S.speed > 58) S.speed = 58;
    if (S.speed > S.best) S.best = S.speed;

    // lateral: la curva empuja hacia afuera, hay que contravolantear
    var kappa = track.curvatureAt(S.dist);
    var push = -kappa * S.speed * S.speed * 0.62;
    var authority = 62 * grip * Math.min(1, S.speed / 22);
    S.latVel += (push + S.steer * authority) * dt;
    S.latVel *= Math.pow(0.02, dt);
    S.latVel = Math.max(-19, Math.min(19, S.latVel));
    S.lat += S.latVel * dt;
    if (S.lat > 34) { S.lat = 34; S.latVel = 0; }
    if (S.lat < -34) { S.lat = -34; S.latVel = 0; }

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
      r.lat += (r.targetLat + Math.sin(r.phase) * 0.5 - r.lat) * Math.min(1, dt * 1.2);
      if (Math.random() < dt * 0.12) r.targetLat = LANES[(Math.random() * LANES.length) | 0];
      if (r.hitCd > 0) r.hitCd -= dt;

      var rel = r.z - S.dist;
      if (!r.passed && rel < -3) {
        r.passed = true;
        S.passes++;
        if (S.pos > 1) S.pos--;
        message(S.pos === 1 ? '¡P1! LIDERAS LA CARRERA' : 'ADELANTAMIENTO  P' + S.pos, 1.3);
      }
      if (rel < -110 || rel > track.VIEW + 120) resetRival(r, i, S.dist);

      // colision simple
      var dx = r.lat - S.lat;
      if (r.hitCd <= 0 && Math.abs(rel) < 4.4 && Math.abs(dx) < 1.95) {
        r.hitCd = 0.8;
        S.hits++;
        S.speed = Math.min(S.speed, r.speed * 0.72);
        var dir = dx >= 0 ? -1 : 1;
        S.latVel += dir * 8;
        r.lat += -dir * 1.2;
        S.shake = 0.5;
        message('¡CONTACTO!', 0.9);
      }

      track.toLocal(r.z, r.lat, tmp);
      r.car.root.position.set(tmp.x, 0, tmp.z);
      r.car.root.rotation.y = tmp.yaw;
      r.car.root.visible = rel > -60 && rel < track.VIEW + 80;
      var spin = r.speed * dt / 0.36;
      for (var w = 0; w < r.car.wheels.length; w++) r.car.wheels[w].userData.spin.rotation.x += spin;
    }

    // ---- auto del jugador
    player.root.position.set(S.lat, 0, 0);
    var yaw = -Math.atan2(S.latVel, Math.max(12, S.speed)) * 0.85;
    player.root.rotation.y = yaw;
    var roll = -S.steer * 0.035 - S.latVel * 0.004;
    player.body.rotation.z = roll;
    player.body.rotation.x = (S.brake * 0.02 - S.throttle * 0.012) + (S.offTrack ? Math.sin(S.time * 34) * 0.012 : 0);
    player.body.position.y = S.offTrack ? Math.abs(Math.sin(S.time * 26)) * 0.05 : 0;

    var pSpin = S.speed * dt / 0.36;
    for (var pw = 0; pw < player.wheels.length; pw++) player.wheels[pw].userData.spin.rotation.x += pSpin;
    player.steered[0].rotation.y = S.steer * 0.30;
    player.steered[1].rotation.y = S.steer * 0.30;

    // ---- camara
    S.shake = Math.max(0, S.shake - dt * 1.5);
    var speedN = S.speed / MAX_SPEED;
    var shakeAmt = S.shake * 0.25 + (S.offTrack ? 0.05 : 0) + speedN * 0.012;
    var camX = S.lat * 0.82 + S.steer * 0.5;
    camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y = 2.55 + Math.sin(S.time * 30) * shakeAmt;
    camera.position.z = -8.6 - speedN * 1.2;
    camera.fov = 62 + speedN * 16;
    camera.updateProjectionMatrix();
    camera.lookAt(S.lat * 0.45 + S.steer * 1.2, 1.25, 26);
    camera.rotation.z += -S.steer * 0.012 + Math.sin(S.time * 22) * shakeAmt * 0.02;

    sky.update(track.heading(), camera.position.x, camera.position.z);

    // ---- HUD
    var rev = revOf(S.speed);
    Sound.update(rev * (0.35 + speedN * 0.65), S.throttle, S.offTrack);
    if ((hudTick++ % 3) === 0) updateHud(rev);
    document.body.classList.toggle('offtrack', S.offTrack);
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
    if (S.started && !S.paused) step(dt);
    else track.update(S.dist);
    renderer.render(scene, camera);
  }

  // primera composicion antes de arrancar
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
    if (document.hidden && S.started) { S.paused = true; message('PAUSA', 999); }
  });
})();
