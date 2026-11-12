/* Peg Commando — a short peg-bouncing game. Lob grenades from the top,
   bounce them off pegs, and knock out every orange target across three
   sectors. Renders into #commando. Only the best score and the mute
   setting are kept (localStorage). */
(function () {
  'use strict';

  var root = document.getElementById('commando');
  if (!root) return;
  var FACE_SRC = root.getAttribute('data-face');
  var WIN_SRC = root.getAttribute('data-win');
  var HOME = root.getAttribute('data-home') || '/';
  document.body.classList.add('pc-page');

  // ---------- constants ----------
  var W = 600, H = 800;
  var BALL_R = 8, PEG_R = 10, GRAV = 900, SPEED = 640;
  var LX = 300, LY = 54, BARREL = 50, FACE_R = 34;
  var SHOTS = 10, STEP = 1 / 240;
  var BUCKET_Y = H - 30, BUCKET_W = 96;
  var SLOT_TOP = H - 70, SLOT_VALUES = [10000, 25000, 50000, 25000, 10000];
  var AMMO_BONUS = 2500;
  var BEST_KEY = 'peg-commando-best', MUTE_KEY = 'peg-commando-mute';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var COLORS = {
    blue: ['#4b7fa8', '#bfe3ff'],
    orange: ['#e86a17', '#ffd27a'],
    green: ['#4f9a2c', '#c8ff8a'],
    purple: ['#9b46c9', '#f0b8ff']
  };
  var POINTS = { blue: 10, orange: 100, green: 10, purple: 500 };

  var QUIPS = {
    start: ['Clear the orange. Leave nothing standing.', 'Ten grenades. Should be plenty.', 'Fresh sector. Let’s get dirty.'],
    miss: ['Nobody saw that.', 'Warning shot.', 'The jungle got lucky.', 'I meant to do that.'],
    small: ['Light work.', 'Keep moving.', 'Acceptable.', 'Warming up.'],
    good: ['Now we’re talking.', 'Boom. Next.', 'That’s how it’s done.', 'Textbook.'],
    huge: ['TOTAL DEVASTATION!', 'I didn’t even aim.', 'They’ll write songs about that.', 'Absolute carnage!'],
    bucket: ['Resupply! Free grenade.', 'Never waste a grenade.', 'Back in the crate. Classic.'],
    air: ['AIR SUPPORT INBOUND!', 'DANGER CLOSE!', 'Light ’em up!'],
    purple: ['Bonus target! Nice.', 'Ooh, shiny.'],
    low: ['Running low. Make ’em count.', 'Last few. Breathe.'],
    final: ['That’s the last one!', 'Target eliminated!']
  };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // ---------- levels ----------
  function peg(x, y) { return { x: x, y: y, type: 'blue', hit: false, gone: false }; }

  var LEVELS = [
    { name: 'Landing Zone', build: function () {
      var p = [];
      for (var r = 0; r < 7; r++) {
        var y = 230 + r * 64, off = r % 2 ? 30 : 0;
        for (var x = 60 + off; x <= W - 60; x += 60) p.push(peg(x, y));
      }
      return p;
    } },
    { name: 'The Canopy', build: function () {
      var p = [];
      [[160, 9], [240, 13], [320, 17]].forEach(function (a) {
        for (var i = 0; i < a[1]; i++) {
          var t = Math.PI * (0.2 + 0.6 * i / (a[1] - 1));
          p.push(peg(300 + a[0] * Math.cos(t), 150 + a[0] * Math.sin(t)));
        }
      });
      [150, 450].forEach(function (cx) {
        for (var i = 0; i < 8; i++) {
          var t = i / 8 * Math.PI * 2;
          p.push(peg(cx + 56 * Math.cos(t), 620 + 56 * Math.sin(t)));
        }
      });
      for (var x = 240; x <= 360; x += 40) p.push(peg(x, 560));
      return p;
    } },
    { name: 'Volcano HQ', build: function () {
      var p = [], i, q;
      for (i = 0; i < 16; i++) {
        q = peg(0, 0); q.orbit = { cx: 300, cy: 440, r: 125, a: i / 16 * Math.PI * 2, w: 0.55 }; p.push(q);
      }
      for (i = 0; i < 8; i++) {
        q = peg(0, 0); q.orbit = { cx: 300, cy: 440, r: 58, a: i / 8 * Math.PI * 2, w: -0.9 }; p.push(q);
      }
      for (i = 0; i < 9; i++) {
        var y = 210 + i * 58, z = i % 2 ? 18 : 0;
        p.push(peg(62 + z, y), peg(W - 62 - z, y));
      }
      for (var x = 160; x <= 440; x += 56) p.push(peg(x, 200));
      [[200, 660], [250, 690], [300, 700], [350, 690], [400, 660]].forEach(function (c) { p.push(peg(c[0], c[1])); });
      return p;
    } }
  ];

  // ---------- DOM ----------
  root.className = 'pc';
  root.innerHTML =
    '<div class="pc-hud">' +
      '<a href="' + HOME + '" aria-label="Back to home">←</a>' +
      '<span><span class="pc-k">SECTOR</span><span class="pc-v pc-lvl"></span> <span class="pc-name pc-hot"></span></span>' +
      '<span><span class="pc-k">TARGETS</span><span class="pc-v pc-hot pc-tgt"></span></span>' +
      '<span><span class="pc-k">AMMO</span><span class="pc-ammo"></span></span>' +
      '<span><span class="pc-k">MULT</span><span class="pc-v pc-mult"></span></span>' +
      '<span class="pc-spacer"></span>' +
      '<span><span class="pc-k">SCORE</span><span class="pc-v pc-score"></span></span>' +
      '<button class="pc-mute" type="button"></button>' +
    '</div>' +
    '<div class="pc-stage"><div class="pc-board">' +
      '<canvas aria-label="Game board. Aim with the mouse, a finger, or the arrow keys; click, release or press space to throw." tabindex="0"></canvas>' +
      '<div class="pc-ov" hidden></div>' +
    '</div></div>';

  var $ = function (s) { return root.querySelector(s); };
  var stage = $('.pc-stage'), board = $('.pc-board'), canvas = $('canvas'), ov = $('.pc-ov');
  var ctx = canvas.getContext('2d');
  var el = { lvl: $('.pc-lvl'), name: $('.pc-name'), tgt: $('.pc-tgt'), ammo: $('.pc-ammo'), mult: $('.pc-mult'), score: $('.pc-score'), mute: $('.pc-mute') };

  var faceImg = new Image(); faceImg.src = FACE_SRC;
  var winImg = new Image(); winImg.src = WIN_SRC; // preload for the finale

  // ---------- sizing ----------
  var scale = 1, dpr = 1, bg = null;
  function resize() {
    var bw = stage.clientWidth, bh = stage.clientHeight;
    if (!bw || !bh) return;
    scale = Math.min(bw / W, bh / H);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    board.style.width = Math.floor(W * scale) + 'px';
    board.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.floor(W * scale * dpr);
    canvas.height = Math.floor(H * scale * dpr);
    bg = buildBackground();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  function buildBackground() {
    var c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    var g = c.getContext('2d');
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#16301f'); grd.addColorStop(0.55, '#0c1e13'); grd.addColorStop(1, '#050d08');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // misty tree trunks
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(120,150,120,' + (0.04 + rnd() * 0.05) + ')';
      var tx = rnd() * W, tw = 14 + rnd() * 30;
      g.fillRect(tx, 0, tw, H);
    }
    // fronds on the sides
    for (i = 0; i < 26; i++) {
      var side = i % 2, fx = side ? W + 10 - rnd() * 40 : -10 + rnd() * 40, fy = rnd() * H;
      var len = 60 + rnd() * 90, ang = (side ? Math.PI : 0) + (rnd() - 0.5) * 1.2;
      g.save(); g.translate(fx, fy); g.rotate(ang);
      g.fillStyle = 'rgba(' + (20 + rnd() * 20 | 0) + ',' + (60 + rnd() * 40 | 0) + ',30,0.55)';
      g.beginPath(); g.moveTo(0, 0);
      g.quadraticCurveTo(len * 0.5, -len * 0.25, len, 0);
      g.quadraticCurveTo(len * 0.5, len * 0.25, 0, 0);
      g.fill(); g.restore();
    }
    // fire glow, bottom right
    var fire = g.createRadialGradient(W + 20, H - 60, 10, W + 20, H - 60, 320);
    fire.addColorStop(0, 'rgba(255,140,40,0.35)'); fire.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = fire; g.fillRect(0, 0, W, H);
    return c;
  }

  // ---------- audio ----------
  var actx = null, muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* ignore */ }
  function audio() {
    if (muted) return null;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  function tone(f, d, type, vol, delay) {
    var a = audio(); if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function boom(big) {
    var a = audio(); if (!a) return;
    var len = big ? 0.9 : 0.35, n = Math.floor(a.sampleRate * len);
    var buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = big ? 700 : 1400;
    g.gain.value = big ? 0.6 : 0.3;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  var SCALE = [0, 2, 4, 7, 9];
  function hitSound(n) {
    var i = Math.min(n - 1, 17);
    tone(330 * Math.pow(2, (12 * Math.floor(i / 5) + SCALE[i % 5]) / 12), 0.18, 'triangle', 0.1);
  }
  function fanfare() { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.35, 'square', 0.06, i * 0.12); }); }
  function sadTrombone() { [392, 370, 349, 311].forEach(function (f, i) { tone(f, i === 3 ? 0.7 : 0.3, 'sawtooth', 0.05, i * 0.3); }); }
  function setMute(m) {
    muted = m;
    el.mute.textContent = m ? '🔇' : '🔊';
    el.mute.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  el.mute.addEventListener('click', function () { setMute(!muted); });
  setMute(muted);

  // ---------- state ----------
  var S = {
    state: 'intro', level: 0, score: 0, levelStart: 0,
    pegs: [], shots: SHOTS, orangeTotal: 0, orangeLeft: 0, mult: 1,
    ball: null, lit: [], combo: 0, shotScore: 0,
    aim: Math.PI / 2, bucketX: W / 2, bucketDir: 1,
    final: false, slow: 0, clearT: 0, afterClear: null,
    stuckT: 0, stuckX: 0, stuckY: 0,
    quip: null, banner: null, flash: 0, shake: 0, time: 0
  };
  var parts = [], pops = [];

  function startLevel(i) {
    S.level = i; S.levelStart = S.score;
    S.pegs = LEVELS[i].build();
    updateOrbits(0);
    var idx = S.pegs.map(function (_, k) { return k; });
    shuffle(idx);
    var nOrange = Math.round(S.pegs.length * 0.3);
    for (var k = 0; k < nOrange; k++) S.pegs[idx[k]].type = 'orange';
    S.pegs[idx[nOrange]].type = 'green';
    S.pegs[idx[nOrange + 1]].type = 'green';
    S.orangeTotal = S.orangeLeft = nOrange;
    S.shots = SHOTS; S.mult = 1; S.ball = null; S.lit = []; S.final = false; S.slow = 0;
    S.bucketX = W / 2;
    assignPurple();
    S.state = 'aim';
    say(pick(QUIPS.start));
    S.banner = { text: 'SECTOR ' + (i + 1) + ': ' + LEVELS[i].name.toUpperCase(), t: 2.2 };
    hud();
    hideOverlay();
    canvas.focus({ preventScroll: true });
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
  }
  function assignPurple() {
    var blues = [];
    S.pegs.forEach(function (p) {
      if (p.type === 'purple') p.type = 'blue';
      if (p.type === 'blue' && !p.gone) blues.push(p);
    });
    if (blues.length) blues[Math.floor(Math.random() * blues.length)].type = 'purple';
  }
  function updateMult() {
    var f = 1 - S.orangeLeft / S.orangeTotal;
    S.mult = f >= 0.85 ? 5 : f >= 0.65 ? 3 : f >= 0.4 ? 2 : 1;
  }
  function say(text) { S.quip = { text: text, t: 2.6 }; }

  function hud() {
    el.lvl.textContent = (S.level + 1) + '/' + LEVELS.length;
    el.name.textContent = LEVELS[S.level].name;
    el.tgt.textContent = S.orangeLeft;
    var a = '';
    for (var i = 0; i < Math.max(SHOTS, S.shots); i++) a += '<i' + (i < S.shots ? '' : ' class="used"') + '></i>';
    el.ammo.innerHTML = a;
    el.ammo.setAttribute('aria-label', S.shots + ' grenades');
    el.mult.textContent = '×' + S.mult;
    el.score.textContent = S.score.toLocaleString('en-GB');
  }

  // ---------- aiming & firing ----------
  function pointerPos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function aimAt(pt) {
    var a = Math.atan2(pt.y - LY, pt.x - LX);
    if (a < 0) a = a < -Math.PI / 2 ? Math.PI : 0;
    S.aim = Math.max(0.08, Math.min(Math.PI - 0.08, a));
  }
  var pressed = false;
  canvas.addEventListener('pointerdown', function (e) {
    pressed = true; aimAt(pointerPos(e));
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (pressed || e.pointerType === 'mouse') aimAt(pointerPos(e));
  });
  canvas.addEventListener('pointerup', function (e) {
    if (!pressed) return;
    pressed = false; aimAt(pointerPos(e)); fire();
  });
  canvas.addEventListener('pointercancel', function () { pressed = false; });
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { S.aim = Math.min(Math.PI - 0.08, S.aim + (e.shiftKey ? 0.005 : 0.03)); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { S.aim = Math.max(0.08, S.aim - (e.shiftKey ? 0.005 : 0.03)); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { fire(); e.preventDefault(); }
  });

  function fire() {
    if (S.state !== 'aim' || S.shots <= 0) return;
    S.shots--;
    var c = Math.cos(S.aim), s = Math.sin(S.aim);
    S.ball = { x: LX + c * BARREL, y: LY + s * BARREL, vx: c * SPEED, vy: s * SPEED, spin: 0 };
    S.lit = []; S.combo = 0; S.shotScore = 0;
    S.stuckT = 0; S.stuckX = S.ball.x; S.stuckY = S.ball.y;
    S.state = 'fly';
    S.recoil = 1;
    tone(110, 0.15, 'square', 0.08);
    hud();
  }

  // ---------- physics ----------
  function updateOrbits(dt) {
    for (var i = 0; i < S.pegs.length; i++) {
      var p = S.pegs[i];
      if (!p.orbit) continue;
      var o = p.orbit; o.a += o.w * dt;
      p.x = o.cx + o.r * Math.cos(o.a); p.y = o.cy + o.r * Math.sin(o.a);
    }
  }
  function bounceOff(b, cx, cy, r, e) {
    var dx = b.x - cx, dy = b.y - cy, rr = r + BALL_R, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 === 0) return false;
    var d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    b.x = cx + nx * rr; b.y = cy + ny * rr;
    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    return true;
  }

  function step(dt) {
    S.time += dt;
    updateOrbits(dt);
    if (!S.final) {
      S.bucketX += 150 * S.bucketDir * dt;
      if (S.bucketX > W - BUCKET_W / 2 - 6) { S.bucketX = W - BUCKET_W / 2 - 6; S.bucketDir = -1; }
      if (S.bucketX < BUCKET_W / 2 + 6) { S.bucketX = BUCKET_W / 2 + 6; S.bucketDir = 1; }
    }
    var b = S.ball;
    if (!b || S.state !== 'fly') return;

    b.vy += GRAV * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.spin += b.vx * dt * 0.05;

    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.9; }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.9; }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy) * 0.9; }

    for (var i = 0; i < S.pegs.length; i++) {
      var p = S.pegs[i];
      if (p.gone) continue;
      if (bounceOff(b, p.x, p.y, PEG_R, 0.72)) hitPeg(p);
    }

    if (S.final) {
      for (var k = 1; k < 5; k++) {
        var dx = k * W / 5;
        bounceOff(b, dx, SLOT_TOP, 5, 0.5);
        if (b.y > SLOT_TOP && Math.abs(b.x - dx) < BALL_R + 3) {
          if (b.x < dx) { b.x = dx - BALL_R - 3; b.vx = -Math.abs(b.vx) * 0.5; }
          else { b.x = dx + BALL_R + 3; b.vx = Math.abs(b.vx) * 0.5; }
        }
      }
      if (b.y > H - 22) { landSlot(Math.max(0, Math.min(4, Math.floor(b.x / (W / 5))))); return; }
    } else {
      bounceOff(b, S.bucketX - BUCKET_W / 2, BUCKET_Y, 6, 0.6);
      bounceOff(b, S.bucketX + BUCKET_W / 2, BUCKET_Y, 6, 0.6);
      if (b.y > BUCKET_Y + 4 && b.vy > 0 && Math.abs(b.x - S.bucketX) < BUCKET_W / 2 - 6) { catchBucket(); return; }
    }

    if (b.y > H + BALL_R * 2) { endShot(); return; }

    // stuck detection: if the ball barely moves for a second, clear lit pegs around it
    S.stuckT += dt;
    if (S.stuckT > 1) {
      var mx = b.x - S.stuckX, my = b.y - S.stuckY;
      if (mx * mx + my * my < 15 * 15) {
        var freed = false;
        S.pegs.forEach(function (q) {
          if (q.hit && !q.gone && Math.hypot(q.x - b.x, q.y - b.y) < PEG_R + BALL_R + 6) { popPeg(q); freed = true; }
        });
        if (!freed) { b.vx += (Math.random() - 0.5) * 300; b.vy -= 150; }
      }
      S.stuckT = 0; S.stuckX = b.x; S.stuckY = b.y;
    }
  }

  function hitPeg(p) {
    if (p.hit) return;
    p.hit = true; S.lit.push(p); S.combo++;
    var pts = POINTS[p.type] * S.mult;
    S.score += pts; S.shotScore += pts;
    popup(p.x, p.y - 16, '+' + pts, COLORS[p.type][1]);
    hitSound(S.combo);
    if (p.type === 'orange') {
      S.orangeLeft--; updateMult();
      if (S.orangeLeft === 0) startFinal();
    } else if (p.type === 'green') {
      airstrike(p);
    } else if (p.type === 'purple') {
      say(pick(QUIPS.purple));
    }
    hud();
  }

  function airstrike(p) {
    say(pick(QUIPS.air));
    boom(true);
    S.shake = 0.5; S.flash = 0.35;
    burst(p.x, p.y, 40, ['#fff2b0', '#ffb347', '#ff6a1a', '#5a5a5a'], 380);
    parts.push({ ring: true, x: p.x, y: p.y, r: 10, max: 130, life: 0.45, t: 0 });
    S.pegs.forEach(function (q) {
      if (!q.gone && !q.hit && Math.hypot(q.x - p.x, q.y - p.y) < 130) hitPeg(q);
    });
  }

  function startFinal() {
    S.final = true; S.slow = 1.6; S.flash = 0.5;
    say(pick(QUIPS.final));
    S.banner = { text: 'LAST TARGET DOWN!', t: 2 };
    boom(true);
  }

  function catchBucket() {
    S.shots++;
    popup(S.bucketX, BUCKET_Y - 30, 'FREE GRENADE!', '#c8ff8a', 1.6);
    [523, 784].forEach(function (f, i) { tone(f, 0.25, 'square', 0.06, i * 0.1); });
    endShot(true);
  }

  function landSlot(i) {
    var pts = SLOT_VALUES[i];
    S.score += pts; S.ball = null;
    popup((i + 0.5) * W / 5, SLOT_TOP - 20, '+' + pts.toLocaleString('en-GB'), '#ffd27a', 2);
    for (var k = 0; k < 6; k++) {
      setTimeout(function () {
        burst(60 + Math.random() * (W - 120), 150 + Math.random() * 400, 30,
          ['#ff8a2a', '#ffd27a', '#c8ff8a', '#bfe3ff', '#f0b8ff'], 300);
        boom(false);
      }, k * 220);
    }
    fanfare();
    S.shake = 0.6;
    beginClear(levelComplete);
    hud();
  }

  function endShot(caught) {
    S.ball = null;
    var n = S.combo;
    if (!caught) {
      if (n === 0) say(pick(QUIPS.miss));
      else if (n < 5) say(pick(QUIPS.small));
      else if (n < 12) say(pick(QUIPS.good));
      else say(pick(QUIPS.huge));
    } else say(pick(QUIPS.bucket));
    if (n >= 10) {
      var bonus = n * 100 * S.mult;
      S.score += bonus;
      S.banner = { text: n + '-PEG RAMPAGE +' + bonus.toLocaleString('en-GB'), t: 1.6 };
    }
    beginClear(function () {
      if (S.shots <= 0) { levelFailed(); return; }
      if (S.shots <= 2 && !caught) say(pick(QUIPS.low));
      assignPurple();
      S.state = 'aim';
      hud();
    });
  }

  function beginClear(after) {
    S.state = 'clearing'; S.clearT = 0.15; S.afterClear = after;
  }
  function popPeg(p) {
    p.gone = true;
    burst(p.x, p.y, 10, [COLORS[p.type][0], COLORS[p.type][1]], 160);
  }

  // ---------- effects ----------
  function burst(x, y, n, cols, sp) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7);
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, t: 0,
        c: cols[i % cols.length], s: 2 + Math.random() * 3 });
    }
  }
  function popup(x, y, text, color, life) { pops.push({ x: x, y: y, text: text, c: color, t: 0, life: life || 0.9 }); }

  function fx(dt) {
    var i;
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      if (p.ring) { p.r = 10 + (p.max - 10) * (p.t / p.life); continue; }
      p.vy += 400 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t >= pops[i].life) pops.splice(i, 1); }
    if (S.quip) { S.quip.t -= dt; if (S.quip.t <= 0) S.quip = null; }
    if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
    S.flash = Math.max(0, S.flash - dt);
    S.shake = Math.max(0, S.shake - dt);
    S.recoil = Math.max(0, (S.recoil || 0) - dt * 5);
    if (S.slow > 0) S.slow -= dt;
    if (S.state === 'clearing') {
      S.clearT -= dt;
      while (S.clearT <= 0 && S.state === 'clearing') {
        var next = null;
        for (var k = 0; k < S.lit.length; k++) if (!S.lit[k].gone) { next = S.lit[k]; break; }
        if (next) { popPeg(next); S.clearT += 0.045; tone(900 + Math.random() * 300, 0.04, 'square', 0.025); }
        else { S.state = 'wait'; S.lit = []; var f = S.afterClear; S.afterClear = null; setTimeout(f, 250); }
      }
    }
  }

  // ---------- drawing ----------
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) ctx.drawImage(bg, 0, 0);
    var k = scale * dpr, sx = 0, sy = 0;
    if (S.shake > 0 && !REDUCED) { sx = (Math.random() - 0.5) * 14 * S.shake; sy = (Math.random() - 0.5) * 14 * S.shake; }
    ctx.setTransform(k, 0, 0, k, sx * k, sy * k);

    // embers drifting up from the fire
    ctx.fillStyle = 'rgba(255,160,60,0.6)';
    for (var e = 0; e < 14; e++) {
      var ey = (H - ((S.time * 40 + e * 97) % 420)), ex = W - 30 - ((e * 53) % 120) + Math.sin(S.time * 2 + e) * 10;
      ctx.globalAlpha = 0.25 + 0.35 * ((e * 31) % 10) / 10;
      ctx.fillRect(ex, ey, 2, 2);
    }
    ctx.globalAlpha = 1;

    if (S.final) drawSlots(); else drawBucket();
    if (S.state === 'aim') drawGuide();
    drawPegs();
    if (S.ball) drawBall(S.ball);
    drawLauncher();
    drawParts();
    drawPops();
    drawQuip();
    drawBanner();

    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(255,240,200,' + Math.min(0.5, S.flash) + ')';
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    if (S.slow > 0 && S.state === 'fly') {
      ctx.strokeStyle = 'rgba(255,138,42,' + (0.4 + 0.3 * Math.sin(S.time * 20)) + ')';
      ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
    }
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }

  function drawPegs() {
    for (var i = 0; i < S.pegs.length; i++) {
      var p = S.pegs[i];
      if (p.gone) continue;
      var c = COLORS[p.type];
      if (p.hit) {
        ctx.fillStyle = c[1]; ctx.globalAlpha = 0.25; circle(p.x, p.y, PEG_R + 6); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = c[1];
      } else ctx.fillStyle = c[0];
      circle(p.x, p.y, PEG_R); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke();
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; circle(p.x - 3, p.y - 3, 3); ctx.fill();
      if (p.type === 'orange') {
        ctx.strokeStyle = p.hit ? '#7a2c00' : '#ffd27a'; ctx.lineWidth = 1.5;
        circle(p.x, p.y, 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8); ctx.stroke();
      } else if (p.type === 'green') {
        ctx.fillStyle = '#eaffd0'; star(p.x, p.y, 6, 2.6); ctx.fill();
      } else if (p.type === 'purple') {
        ctx.strokeStyle = 'rgba(240,184,255,' + (0.5 + 0.5 * Math.sin(S.time * 6)) + ')'; ctx.lineWidth = 2;
        circle(p.x, p.y, PEG_R + 4 + 2 * Math.sin(S.time * 6)); ctx.stroke();
      }
    }
  }
  function star(x, y, R, r) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    ctx.closePath();
  }

  function drawBall(b) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
    ctx.fillStyle = '#4d5a2a'; circle(0, 0, BALL_R); ctx.fill();
    ctx.strokeStyle = '#232a12'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-BALL_R, 0); ctx.lineTo(BALL_R, 0); ctx.moveTo(0, -BALL_R); ctx.lineTo(0, BALL_R); ctx.stroke();
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-3, -BALL_R - 4, 6, 4);
    ctx.strokeStyle = '#c9cdd1'; ctx.lineWidth = 1.5; circle(5, -BALL_R - 3, 3); ctx.stroke();
    ctx.restore();
  }

  function drawGuide() {
    var c = Math.cos(S.aim), s = Math.sin(S.aim);
    var b = { x: LX + c * BARREL, y: LY + s * BARREL, vx: c * SPEED, vy: s * SPEED };
    var dt = 1 / 120;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (var i = 0; i < 70; i++) {
      b.vy += GRAV * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < BALL_R || b.x > W - BALL_R) b.vx = -b.vx;
      var hit = false;
      for (var j = 0; j < S.pegs.length; j++) {
        var p = S.pegs[j];
        if (!p.gone && Math.hypot(p.x - b.x, p.y - b.y) < PEG_R + BALL_R) { hit = true; break; }
      }
      if (i % 4 === 0) { ctx.globalAlpha = 0.7 * (1 - i / 70); circle(b.x, b.y, 2.5); ctx.fill(); }
      if (hit) break;
    }
    ctx.globalAlpha = 1;
  }

  function drawLauncher() {
    var a = S.aim, rec = (S.recoil || 0) * 8;
    // rifle barrel
    ctx.save(); ctx.translate(LX, LY); ctx.rotate(a);
    ctx.fillStyle = '#1b1d1a';
    ctx.fillRect(FACE_R - 10 - rec, -7, 36, 14);
    ctx.fillRect(FACE_R + 20 - rec, -4, 22, 8);
    ctx.fillStyle = '#3a3d36'; ctx.fillRect(FACE_R + 2 - rec, 6, 8, 12);
    ctx.restore();
    // face
    ctx.save();
    ctx.translate(LX, LY); ctx.rotate((a - Math.PI / 2) * 0.25);
    circle(0, 0, FACE_R); ctx.save(); ctx.clip();
    if (faceImg.complete && faceImg.naturalWidth) ctx.drawImage(faceImg, -FACE_R, -FACE_R, FACE_R * 2, FACE_R * 2);
    else { ctx.fillStyle = '#7a5a3a'; ctx.fillRect(-FACE_R, -FACE_R, FACE_R * 2, FACE_R * 2); }
    ctx.restore();
    circle(0, 0, FACE_R); ctx.lineWidth = 4; ctx.strokeStyle = '#c9b77a'; ctx.stroke();
    ctx.restore();
  }

  function drawBucket() {
    var x = S.bucketX, l = x - BUCKET_W / 2;
    ctx.fillStyle = '#4b5a2b'; ctx.fillRect(l, BUCKET_Y, BUCKET_W, H - BUCKET_Y);
    ctx.strokeStyle = '#2b3418'; ctx.lineWidth = 3; ctx.strokeRect(l + 1.5, BUCKET_Y + 1.5, BUCKET_W - 3, H - BUCKET_Y);
    ctx.fillStyle = '#d8cf9a'; ctx.font = '14px "Black Ops One", Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('AMMO', x, BUCKET_Y + 16);
    ctx.fillStyle = '#8b8f86';
    circle(l, BUCKET_Y, 6); ctx.fill(); circle(l + BUCKET_W, BUCKET_Y, 6); ctx.fill();
  }

  function drawSlots() {
    var w = W / 5;
    for (var i = 0; i < 5; i++) {
      var hot = i === 2;
      ctx.fillStyle = hot ? 'rgba(255,138,42,0.35)' : 'rgba(255,210,122,' + (i % 2 ? 0.2 : 0.12) + ')';
      ctx.fillRect(i * w, SLOT_TOP, w, H - SLOT_TOP);
      ctx.fillStyle = '#ffe9c2'; ctx.font = '17px "Black Ops One", Impact, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((SLOT_VALUES[i] / 1000) + 'K', (i + 0.5) * w, H - 30);
    }
    ctx.fillStyle = '#c9b77a';
    for (var k = 1; k < 5; k++) {
      ctx.fillRect(k * w - 3, SLOT_TOP, 6, H - SLOT_TOP);
      circle(k * w, SLOT_TOP, 5); ctx.fill();
    }
  }

  function drawParts() {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], f = 1 - p.t / p.life;
      if (p.ring) {
        ctx.strokeStyle = 'rgba(255,200,120,' + f + ')'; ctx.lineWidth = 6 * f + 1;
        circle(p.x, p.y, p.r); ctx.stroke(); continue;
      }
      ctx.globalAlpha = f; ctx.fillStyle = p.c;
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawPops() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < pops.length; i++) {
      var p = pops[i], f = p.t / p.life;
      ctx.globalAlpha = 1 - f * f;
      ctx.font = (p.text.length > 6 ? 20 : 15) + 'px "Black Ops One", Impact, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(p.text, p.x, p.y - f * 30);
      ctx.fillStyle = p.c; ctx.fillText(p.text, p.x, p.y - f * 30);
    }
    ctx.globalAlpha = 1;
  }

  function wrap(text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = words[i]; } else line = t;
    }
    lines.push(line);
    return lines;
  }
  function drawQuip() {
    if (!S.quip) return;
    ctx.font = '15px system-ui, sans-serif';
    var onLeft = S.aim < Math.PI / 2; // keep the bubble away from the barrel
    var lines = wrap(S.quip.text, 190), lw = 0;
    lines.forEach(function (l) { lw = Math.max(lw, ctx.measureText(l).width); });
    var bw = lw + 20, bh = lines.length * 19 + 12;
    var bx = onLeft ? LX - FACE_R - 14 - bw : LX + FACE_R + 14, by = Math.max(6, LY - bh / 2);
    ctx.globalAlpha = Math.min(1, S.quip.t * 3);
    ctx.fillStyle = '#f4ecd8';
    roundRect(bx, by, bw, bh, 10); ctx.fill();
    ctx.beginPath();
    if (onLeft) { ctx.moveTo(bx + bw, LY - 6); ctx.lineTo(bx + bw + 10, LY); ctx.lineTo(bx + bw, LY + 6); }
    else { ctx.moveTo(bx, LY - 6); ctx.lineTo(bx - 10, LY); ctx.lineTo(bx, LY + 6); }
    ctx.fill();
    ctx.fillStyle = '#1b1a14'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, bx + 10, by + 7 + i * 19); });
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawBanner() {
    if (!S.banner) return;
    var t = S.banner.t;
    ctx.globalAlpha = Math.min(1, t * 2);
    ctx.font = '30px "Black Ops One", Impact, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = Math.min(W - 20, ctx.measureText(S.banner.text).width + 40);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect((W - w) / 2, 128, w, 46);
    ctx.fillStyle = '#ff8a2a';
    ctx.fillText(S.banner.text, W / 2, 152, W - 40);
    ctx.globalAlpha = 1;
  }

  // ---------- overlays ----------
  function showOverlay(html, onBtn) {
    ov.innerHTML = '<div class="pc-card">' + html + '</div>';
    ov.hidden = false;
    var btns = ov.querySelectorAll('button[data-act]');
    btns.forEach(function (b) { b.addEventListener('click', function () { audio(); onBtn(b.getAttribute('data-act')); }); });
    if (btns[0]) btns[0].focus({ preventScroll: true });
  }
  function hideOverlay() { ov.hidden = true; ov.innerHTML = ''; }
  function faceHtml() { return '<img class="pc-face" src="' + FACE_SRC + '" alt="The Commando">'; }
  function best() { try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; } }

  function intro() {
    S.state = 'intro';
    var b = best();
    showOverlay(
      faceHtml() +
      '<h2>PEG COMMANDO</h2>' +
      '<p>The jungle is crawling with orange targets. You have ten grenades per sector and a man who believes in you.</p>' +
      '<ul>' +
        '<li><span class="pc-dot" style="background:#e86a17"></span>Hit every orange target to clear a sector</li>' +
        '<li><span class="pc-dot" style="background:#4f9a2c"></span>Green calls in an airstrike</li>' +
        '<li><span class="pc-dot" style="background:#9b46c9"></span>Purple is worth big points</li>' +
        '<li>Land in the moving ammo crate for a free grenade</li>' +
      '</ul>' +
      '<p class="pc-small">Aim with mouse or finger, then click or let go to throw. Arrow keys + space work too.</p>' +
      (b ? '<p class="pc-small">Best score: ' + b.toLocaleString('en-GB') + '</p>' : '') +
      '<button class="pc-btn" type="button" data-act="go">LOCK &amp; LOAD</button>',
      function () { S.score = 0; startLevel(0); }
    );
  }

  function levelComplete() {
    var bonus = S.shots * AMMO_BONUS;
    S.score += bonus; hud();
    if (S.level === LEVELS.length - 1) { victory(bonus); return; }
    S.state = 'over';
    showOverlay(
      faceHtml() +
      '<h2>SECTOR CLEARED</h2>' +
      '<div class="pc-stats">' +
        '<div>Grenades left: <b>' + S.shots + '</b> × ' + AMMO_BONUS.toLocaleString('en-GB') + ' = <b>' + bonus.toLocaleString('en-GB') + '</b></div>' +
        '<div>Score: <b>' + S.score.toLocaleString('en-GB') + '</b></div>' +
      '</div>' +
      '<p>“' + pick(['Not bad, rookie.', 'One down. The jungle remembers.', 'I’ve seen worse. Mostly from me.']) + '”</p>' +
      '<button class="pc-btn" type="button" data-act="next">NEXT: ' + LEVELS[S.level + 1].name.toUpperCase() + '</button>',
      function () { startLevel(S.level + 1); }
    );
  }

  function levelFailed() {
    S.state = 'over';
    sadTrombone();
    showOverlay(
      faceHtml() +
      '<h2>OUT OF GRENADES</h2>' +
      '<p>' + S.orangeLeft + ' target' + (S.orangeLeft === 1 ? '' : 's') + ' still standing in ' + LEVELS[S.level].name + '.</p>' +
      '<p>“' + pick(['Regroup. Go again.', 'That was a reconnaissance run.', 'Pain is temporary. Pegs are forever.']) + '”</p>' +
      '<button class="pc-btn" type="button" data-act="retry">RETRY SECTOR</button>',
      function () { S.score = S.levelStart; startLevel(S.level); }
    );
  }

  function victory(bonus) {
    S.state = 'over';
    var prev = best(), isBest = S.score > prev;
    if (isBest) { try { localStorage.setItem(BEST_KEY, String(S.score)); } catch (e) { /* ignore */ } }
    setTimeout(fanfare, 400);
    showOverlay(
      '<div class="pc-photo-wrap"><img class="pc-photo" src="' + WIN_SRC + '" alt="The Commando, filthy and grinning, giving a thumbs up">' +
      '<span class="pc-stamp">MISSION ACCOMPLISHED</span></div>' +
      '<h2>THE JUNGLE IS QUIET</h2>' +
      '<div class="pc-stats">' +
        '<div>Final grenade bonus: <b>' + bonus.toLocaleString('en-GB') + '</b></div>' +
        '<div>Final score: <b>' + S.score.toLocaleString('en-GB') + '</b></div>' +
        '<div>' + (isBest ? '<b>NEW BEST!</b>' : 'Best: ' + prev.toLocaleString('en-GB')) + '</div>' +
      '</div>' +
      '<button class="pc-btn" type="button" data-act="again">REDEPLOY</button>',
      function () { S.score = 0; startLevel(0); }
    );
  }

  // ---------- loop ----------
  var last = 0, acc = 0;
  function frame(t) {
    var dt = Math.min(0.05, last ? (t - last) / 1000 : 0);
    last = t;
    var ts = S.slow > 0 ? 0.3 : 1;
    acc += dt * ts;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    fx(dt);
    draw();
    requestAnimationFrame(frame);
  }

  resize();
  // a decorative board behind the briefing
  S.pegs = LEVELS[0].build();
  S.pegs.forEach(function (p, i) { if (i % 3 === 0) p.type = 'orange'; });
  S.orangeTotal = S.orangeLeft = 20;
  hud();
  intro();
  requestAnimationFrame(frame);
})();
