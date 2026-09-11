/* Controles: teclado, pantalla tactil (botones y volante por arrastre) y
   joystick USB/Bluetooth. Devuelve una lectura analogica -1..1. */
window.Input = (function () {
  'use strict';

  var keys = {};
  var touch = { left: false, right: false, gas: false, brake: false };
  var drag = { active: false, id: null, x0: 0, value: 0 };
  var listeners = { press: [] };

  var DRAG_FULL = 90;   // pixeles de arrastre para giro completo

  function onPress(fn) { listeners.press.push(fn); }
  function firePress(key) {
    for (var i = 0; i < listeners.press.length; i++) listeners.press[i](key);
  }

  function keyName(e) {
    var k = e.key ? e.key.toLowerCase() : '';
    if (k === 'spacebar') k = ' ';
    return k;
  }

  function bindKeyboard() {
    var block = ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '];
    window.addEventListener('keydown', function (e) {
      var k = keyName(e);
      if (block.indexOf(k) >= 0) e.preventDefault();
      if (!keys[k]) firePress(k);
      keys[k] = true;
    });
    window.addEventListener('keyup', function (e) { keys[keyName(e)] = false; });
    // si la ventana pierde el foco las teclas quedaban trabadas
    window.addEventListener('blur', reset);
  }

  function reset() {
    for (var k in keys) keys[k] = false;   // se limpia en el lugar: la ref se comparte
    touch.left = touch.right = touch.gas = touch.brake = false;
    drag.active = false; drag.id = null; drag.value = 0;
  }

  function bindButton(id, prop) {
    var el = document.getElementById(id);
    if (!el) return;
    function down(e) {
      e.preventDefault();
      e.stopPropagation();
      touch[prop] = true;
      firePress('touch');
    }
    function up(e) {
      e.preventDefault();
      e.stopPropagation();
      touch[prop] = false;
    }
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* Volante por arrastre: se toca cualquier parte de la pantalla y se mueve
     el dedo a los costados. Mas natural que apretar flechas. */
  function bindDrag(target) {
    target.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      drag.active = true;
      drag.id = e.pointerId;
      drag.x0 = e.clientX;
      drag.value = 0;
      firePress('touch');
    });
    target.addEventListener('pointermove', function (e) {
      if (!drag.active || e.pointerId !== drag.id) return;
      var d = (e.clientX - drag.x0) / DRAG_FULL;
      drag.value = d > 1 ? 1 : (d < -1 ? -1 : d);
    });
    function end(e) {
      if (e.pointerId !== drag.id) return;
      drag.active = false;
      drag.id = null;
      drag.value = 0;
    }
    target.addEventListener('pointerup', end);
    target.addEventListener('pointercancel', end);
  }

  function gamepad() {
    if (!navigator.getGamepads) return null;
    var pads = navigator.getGamepads();
    for (var i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) return pads[i];
    }
    return null;
  }

  function axis(v, dead) {
    if (v === undefined) return 0;
    var d = dead || 0.18;
    if (Math.abs(v) < d) return 0;
    return (v - Math.sign(v) * d) / (1 - d);
  }

  function read() {
    var steer = 0, gas = 0, brake = 0;

    if (keys['arrowleft'] || keys['a']) steer -= 1;
    if (keys['arrowright'] || keys['d']) steer += 1;
    if (keys['arrowup'] || keys['w']) gas = 1;
    if (keys['arrowdown'] || keys['s'] || keys[' ']) brake = 1;

    if (touch.left) steer -= 1;
    if (touch.right) steer += 1;
    if (touch.gas) gas = 1;
    if (touch.brake) brake = 1;
    if (drag.active && Math.abs(drag.value) > 0.02) steer += drag.value;

    var gp = gamepad();
    if (gp) {
      steer += axis(gp.axes[0]);
      var rt = gp.buttons[7], lt = gp.buttons[6];
      if (rt && rt.value > 0.08) gas = Math.max(gas, rt.value);
      else if (gp.buttons[0] && gp.buttons[0].pressed) gas = 1;
      if (lt && lt.value > 0.08) brake = Math.max(brake, lt.value);
      else if (gp.buttons[1] && gp.buttons[1].pressed) brake = 1;
    }

    return {
      steer: steer > 1 ? 1 : (steer < -1 ? -1 : steer),
      gas: gas,
      brake: brake
    };
  }

  function gamepadPressed(index) {
    var gp = gamepad();
    return !!(gp && gp.buttons[index] && gp.buttons[index].pressed);
  }

  function init(dragTarget) {
    bindKeyboard();
    bindButton('tc-left', 'left');
    bindButton('tc-right', 'right');
    bindButton('tc-gas', 'gas');
    bindButton('tc-brake', 'brake');
    if (dragTarget) bindDrag(dragTarget);
    window.addEventListener('gamepadconnected', function () { firePress('gamepad'); });
  }

  return {
    init: init, read: read, onPress: onPress, reset: reset,
    keys: keys, gamepadPressed: gamepadPressed,
    isTouching: function () { return drag.active || touch.gas || touch.left || touch.right || touch.brake; }
  };
})();
