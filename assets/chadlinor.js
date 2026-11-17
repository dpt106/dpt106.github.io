/* Chadlinor — a whole fantasy world, and Tim only ever chops trees in
   Chadwood, its forest. Woodcutting is the only skill that matters.
   Tap trees, fill your pack, sell logs, buy better axes, chop bigger
   trees, reach level 99. Renders into #chadlinor. Progress and the mute
   setting are kept in localStorage. */
(function () {
  'use strict';

  var root = document.getElementById('chadlinor');
  if (!root) return;
  var FACE_SRC = root.getAttribute('data-face');
  var PORTRAIT_SRC = root.getAttribute('data-portrait');
  var HOME = root.getAttribute('data-home') || '/';
  document.body.classList.add('cw-page');

  // ---------- constants ----------
  var COLS = 14, ROWS = 14, TS = 40, W = COLS * TS, H = ROWS * TS;
  var TICK = 0.6, INV = 28, SPEED = 4.2, MAX = 99;
  var SAVE_KEY = 'chadlinor-save', MUTE_KEY = 'chadlinor-mute';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TREES = [
    { name: 'Sapling', log: 'Twigs', req: 1, xp: 10, val: 3, p: 0.55, fall: 1, respawn: 5 },
    { name: 'Birch', log: 'Birch logs', req: 8, xp: 25, val: 10, p: 0.42, fall: 0.25, respawn: 8 },
    { name: 'Chestnut', log: 'Chestnut logs', req: 20, xp: 50, val: 28, p: 0.34, fall: 0.2, respawn: 10 },
    { name: 'Cedar', log: 'Cedar logs', req: 35, xp: 90, val: 65, p: 0.28, fall: 0.15, respawn: 13 },
    { name: 'Redwood', log: 'Redwood logs', req: 55, xp: 160, val: 150, p: 0.22, fall: 0.12, respawn: 18 },
    { name: 'Ancient Chadwood', log: 'Chadwood logs', req: 80, xp: 330, val: 380, p: 0.16, fall: 0.08, respawn: 25 }
  ];
  var BARK = ['#9a7448', '#ece6d8', '#7a4b2a', '#8b5a3c', '#a2442b', '#5a3a22'];
  var RING = ['#e3c690', '#f6ead0', '#e0b27a', '#e9bf8f', '#e08a62', '#ffd36b'];

  var AXES = [
    { name: 'Butter knife', power: 0.45, req: 1, price: 0, head: '#d9dde2', note: 'It came with the house.' },
    { name: 'Rusty hatchet', power: 0.75, req: 1, price: 40, head: '#a5643a', note: 'Tetanus included.' },
    { name: 'Decent axe', power: 1.0, req: 10, price: 350, head: '#9aa4ad', note: 'An axe. Finally.' },
    { name: 'Lumberjack axe', power: 1.3, req: 22, price: 2000, head: '#c23b32', note: 'Comes with a free flannel shirt (not included).' },
    { name: 'Double-bit axe', power: 1.65, req: 40, price: 9000, head: '#59c2c9', note: 'Twice the bits.' },
    { name: 'The Chadsaw', power: 2.2, req: 65, price: 40000, head: '#ff8a1e', note: 'Technically not an axe. Nobody is checking.' }
  ];
  var AUTO_PRICE = 2500;

  var SKILLS = [
    ['Fishing', 'Tim does not fish. Fish cannot be chopped.'],
    ['Cooking', 'Tim eats sandwiches. Pre-made.'],
    ['Mining', 'Rocks are just trees that gave up.'],
    ['Combat', 'Tim has never been in a fight. The trees have.'],
    ['Magic', 'The only magic Tim needs is a sharp edge.'],
    ['Sewing', 'Classified. Do not ask about the thread.'],
    ['Grenades', 'Already maxed. See: Chaddle.', 99],
    ['Small Talk', '"Busy. Chopping."'],
    ['Cardio', 'Walking to the next tree counts.'],
    ['Texting Back', 'Seen. Three days ago.'],
    ['Board Games', 'Has a tree to get back to.']
  ];

  var BOT_LINES = [
    'selling birch logs 10 ea', 'anyone know where the fishing is?', 'is this game literally just trees',
    'free axe sharpening, trade me', 'brb dinner', 'lag', 'this birch is mine', 'i heard one of the trees has a face',
    'nice axe', 'whats the sewing machine in ur profile pic about', 'where is everyone', 'logbert scammed me',
    'chadlinor is so big', 'just got back from the castle, tim u missed a whole dragon'
  ];
  var PLACES = [
    ['anyone been to the desert?', 'There are no trees there.'],
    ['tim come see the castle', 'Is it made of wood?'],
    ['dragon spotted up north, who’s coming', 'Does it have trees?'],
    ['tim have u ever left this forest', 'Why would I.'],
    ['theres a whole ocean in chadlinor u know', 'Can’t chop an ocean.'],
    ['big quest starting in the city, need 1 more', 'The city has no trees.']
  ];
  var ASK_LINES = ['lvl?', 'tim do u ever stop', 'wanna do a quest?', 'tim come to the pub', 'u chop here often?', 'tim r u ignoring me'];
  var BOT_AUTO_LINES = ['is tim a bot?', 'reported.', 'hes chopping in his sleep', 'that is 100% a bot', 'tim? TIM?'];
  var GZ = ['gz', 'grats', 'gz tim', 'nice one', 'nerd', 'gz!!'];
  var TIM_REPLIES = ['Busy. Chopping.', 'No.', 'Can’t. Tree.', 'One more tree.', 'Woodcutting is the only quest.', 'Shh.', 'Later.'];
  var ANCIENT_LINES = ['Ow.', 'Easy, mate.', 'We have the same face.', 'Is this about the grenades?', 'I knew your dad.', 'Have you tried fishing?'];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fmt(n) { return Math.floor(n).toLocaleString('en-GB'); }

  // ---------- xp ----------
  function xpFor(L) { return L <= 1 ? 0 : Math.round(900 * (Math.pow(1.05, L - 1) - 1)); }
  function levelOf(x) { var L = 1; while (L < MAX && x >= xpFor(L + 1)) L++; return L; }

  // ---------- save ----------
  var S = {
    xp: 0, coins: 0, axe: 0, inv: [], auto: false, autoOn: false,
    logs: 0, felled: 0, nests: 0, stolen: 0, earned: 0, played: 0, got99: false
  };
  var returning = false;
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var d = JSON.parse(raw);
      Object.keys(S).forEach(function (k) { if (d[k] !== undefined && typeof d[k] === typeof S[k]) S[k] = d[k]; });
      S.inv = (Array.isArray(d.inv) ? d.inv : []).filter(function (t) { return t >= 0 && t < TREES.length; }).slice(0, INV);
      if (S.axe < 0 || S.axe >= AXES.length) S.axe = 0;
      returning = S.xp > 0;
    }
  } catch (e) { /* ignore */ }
  var wiping = false;
  function save() { if (wiping) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function level() { return levelOf(S.xp); }

  // ---------- map ----------
  var MAP = [
    '.e..:e..e~~#..',
    'e...:..e.~~#X.',
    '..b.:....~.#..',
    'b...:.......:.',
    '..b.:::::::::.',
    'b...:..S...d..',
    '.b..:....f.d.d',
    '....:......d..',
    'a.a.:..f...d.d',
    '.a..:.......c.',
    'a.a.:..c.c....',
    '.a..:f..c..c..',
    '~~a.:.c...c..~',
    '~~~.:...f...~~'
  ];
  var TREE_CH = 'abcdeX';
  var ground = [], treeAt = [], trees = [], stall = null;
  MAP.forEach(function (row, r) {
    ground.push([]); treeAt.push([]);
    for (var c = 0; c < COLS; c++) {
      var ch = row.charAt(c), g = 'grass';
      if (ch === ':') g = 'path';
      else if (ch === '~') g = 'water';
      else if (ch === '#') g = 'fence';
      else if (ch === 'f') g = 'flowers';
      else if (ch === 'S') { g = 'stall'; stall = { c: c, r: r }; }
      ground[r].push(g);
      var ti = TREE_CH.indexOf(ch), t = null;
      if (ti >= 0) {
        t = { c: c, r: r, type: ti, down: false, regrow: 0, shake: 0, fallT: 0, fallDir: 1, say: null };
        trees.push(t);
      }
      treeAt[r].push(t);
    }
  });
  function blocked(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    var g = ground[r][c];
    return g === 'water' || g === 'fence' || g === 'stall' || !!treeAt[r][c];
  }

  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function bfs(sc, sr, goal) {
    var N = COLS * ROWS, prev = new Int16Array(N), seen = new Uint8Array(N);
    var start = sr * COLS + sc, q = [start];
    seen[start] = 1;
    for (var i = 0; i < q.length; i++) {
      var k = q[i], c = k % COLS, r = (k / COLS) | 0;
      if (goal(c, r)) {
        var path = [];
        while (k !== start) { path.unshift([k % COLS, (k / COLS) | 0]); k = prev[k]; }
        return path;
      }
      for (var j = 0; j < 8; j++) {
        var nc = c + DIRS[j][0], nr = r + DIRS[j][1];
        if (blocked(nc, nr)) continue;
        if (j >= 4 && (blocked(nc, r) || blocked(c, nr))) continue;
        var nk = nr * COLS + nc;
        if (seen[nk]) continue;
        seen[nk] = 1; prev[nk] = k; q.push(nk);
      }
    }
    return null;
  }
  function adjacentTo(tc, tr) {
    return function (c, r) { return Math.abs(c - tc) <= 1 && Math.abs(r - tr) <= 1 && !(c === tc && r === tr); };
  }

  // ---------- entities ----------
  function makeChar(c, r, name) {
    return { x: c, y: r, tx: c, ty: r, path: [], name: name, face: 1, walk: 0, say: null, sayT: 0 };
  }
  var tim = makeChar(5, 7, 'Tim');
  tim.goal = null; tim.chop = null; tim.chopT = 0; tim.swing = 0; tim.idle = 0;

  var BOT_DEFS = [
    ['Chadfield2', '#3a6fb0', '#3b2a1c'], ['xX_LogLord_Xx', '#2b2b2b', '#c9a23c'],
    ['Woody_1987', '#4f8a3a', '#7a3b1c'], ['Sapling Steve', '#b06a2a', '#e8d6a0']
  ];
  var bots = BOT_DEFS.map(function (d) {
    var spot = randomFree();
    var b = makeChar(spot[0], spot[1], d[0]);
    b.shirt = d[1]; b.hair = d[2]; b.wait = 1 + Math.random() * 4; b.talk = 6 + Math.random() * 14;
    return b;
  });
  function randomFree() {
    for (var i = 0; i < 200; i++) {
      var c = (Math.random() * COLS) | 0, r = (Math.random() * ROWS) | 0;
      if (!blocked(c, r)) return [c, r];
    }
    return [5, 7];
  }

  // ---------- DOM ----------
  root.className = 'cw';
  root.innerHTML =
    '<div class="cw-hud">' +
      '<a href="' + HOME + '" aria-label="Back to home">←</a>' +
      '<span class="cw-title">Chadlinor</span>' +
      '<span><span class="cw-k">Woodcutting</span><span class="cw-lvl"></span><span class="cw-bar" title=""><i></i></span></span>' +
      '<span><span class="cw-k">Coins</span><span class="cw-coins"></span></span>' +
      '<span class="cw-spacer"></span>' +
      '<button class="cw-auto" type="button" aria-pressed="false" hidden>Autochop</button>' +
      '<button class="cw-mute" type="button"></button>' +
    '</div>' +
    '<div class="cw-main">' +
      '<div class="cw-stage"><div class="cw-board">' +
        '<canvas tabindex="0" aria-label="The forest. Tap a tree to chop it, tap the stall to trade. Keyboard: arrow keys walk, space chops the nearest tree, S goes to the stall."></canvas>' +
        '<div class="cw-ov" hidden></div>' +
      '</div></div>' +
      '<div class="cw-side">' +
        '<div class="cw-tabs" role="tablist">' +
          '<button class="cw-tab" role="tab" data-tab="pack" aria-selected="true">Pack</button>' +
          '<button class="cw-tab" role="tab" data-tab="skills" aria-selected="false">Skills</button>' +
          '<button class="cw-tab" role="tab" data-tab="stats" aria-selected="false">Stats</button>' +
        '</div>' +
        '<div class="cw-panel" role="tabpanel"></div>' +
      '</div>' +
    '</div>' +
    '<div class="cw-chat" aria-live="polite"></div>';

  var $ = function (s) { return root.querySelector(s); };
  var stage = $('.cw-stage'), board = $('.cw-board'), canvas = $('canvas'), ov = $('.cw-ov');
  var panel = $('.cw-panel'), chat = $('.cw-chat');
  var ctx = canvas.getContext('2d');
  var el = { lvl: $('.cw-lvl'), bar: $('.cw-bar'), barFill: $('.cw-bar i'), coins: $('.cw-coins'), auto: $('.cw-auto'), mute: $('.cw-mute') };

  var faceImg = new Image(); faceImg.src = FACE_SRC;
  var portraitImg = new Image(); portraitImg.src = PORTRAIT_SRC;

  // ---------- log icons ----------
  var ICONS = TREES.map(function (t, i) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    if (i === 0) {
      g.lineCap = 'round';
      [[12, 50, 52, 16, 6], [10, 34, 54, 40, 5], [18, 56, 46, 22, 4]].forEach(function (s) {
        g.strokeStyle = '#6b4a2a'; g.lineWidth = s[4] + 2; g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); g.stroke();
        g.strokeStyle = BARK[0]; g.lineWidth = s[4]; g.stroke();
      });
      return c.toDataURL();
    }
    g.translate(32, 32); g.rotate(-0.5);
    var lw = 44, lh = 22;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-lw / 2 + 2, -lh / 2 + 4, lw, lh);
    g.fillStyle = BARK[i]; g.fillRect(-lw / 2, -lh / 2, lw, lh);
    g.strokeStyle = i === 1 ? '#2a2a2a' : 'rgba(0,0,0,0.3)'; g.lineWidth = 2;
    for (var k = 0; k < 4; k++) {
      g.beginPath(); var x = -lw / 2 + 6 + k * 9; g.moveTo(x, -lh / 2 + 3); g.lineTo(x + 3, lh / 2 - 3); g.stroke();
    }
    g.fillStyle = RING[i]; g.beginPath(); g.ellipse(lw / 2, 0, 6, lh / 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(90,50,20,0.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(lw / 2, 0, 3, lh / 4, 0, 0, Math.PI * 2); g.stroke();
    if (i === 5) { g.fillStyle = 'rgba(255,230,120,0.9)'; g.beginPath(); g.arc(-6, -2, 2.5, 0, 7); g.arc(6, 3, 2, 0, 7); g.fill(); }
    return c.toDataURL();
  });

  // ---------- sizing / background ----------
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
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var r = 0; r < ROWS; r++) {
      for (var cc = 0; cc < COLS; cc++) {
        var x = cc * TS, y = r * TS, kind = ground[r][cc];
        var shade = ((cc + r) % 2) ? 0 : 6;
        g.fillStyle = 'rgb(' + (74 + shade) + ',' + (128 + shade) + ',' + (52 + shade / 2) + ')';
        g.fillRect(x, y, TS, TS);
        for (var k = 0; k < 6; k++) {
          g.fillStyle = rnd() < 0.5 ? 'rgba(30,70,20,0.35)' : 'rgba(150,200,90,0.25)';
          g.fillRect(x + rnd() * TS, y + rnd() * TS, 2, 3);
        }
        if (kind === 'path') {
          g.fillStyle = '#b99a62'; g.fillRect(x, y, TS, TS);
          for (k = 0; k < 7; k++) { g.fillStyle = rnd() < 0.5 ? '#a3854f' : '#cbb07a'; g.fillRect(x + rnd() * TS, y + rnd() * TS, 3, 2); }
        } else if (kind === 'water') {
          g.fillStyle = '#2f6ea3'; g.fillRect(x, y, TS, TS);
          g.strokeStyle = 'rgba(190,230,255,0.35)'; g.lineWidth = 1.5;
          for (k = 0; k < 2; k++) {
            var wy = y + 10 + k * 18 + rnd() * 4, wx = x + 4 + rnd() * 12;
            g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 6, wy - 4, wx + 12, wy); g.quadraticCurveTo(wx + 18, wy + 4, wx + 24, wy); g.stroke();
          }
        } else if (kind === 'flowers') {
          for (k = 0; k < 6; k++) {
            g.fillStyle = pick(['#ffd7f0', '#ffe066', '#ffffff', '#c9a0ff']);
            g.beginPath(); g.arc(x + 6 + rnd() * 28, y + 6 + rnd() * 28, 2.4, 0, 7); g.fill();
          }
        } else if (kind === 'fence') {
          g.fillStyle = '#6b4a2a';
          g.fillRect(x + 17, y + 4, 6, 32);
          g.fillStyle = '#8a6237';
          g.fillRect(x + 15, y + 2, 10, 5);
          g.fillStyle = '#7a5530'; g.fillRect(x + 19, y, 2, TS);
        }
      }
    }
    // soft shoreline
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) {
      if (ground[r][cc] !== 'water') continue;
      g.strokeStyle = 'rgba(220,240,255,0.35)'; g.lineWidth = 2;
      if (r > 0 && ground[r - 1][cc] !== 'water') { g.beginPath(); g.moveTo(cc * TS, r * TS + 1); g.lineTo(cc * TS + TS, r * TS + 1); g.stroke(); }
      if (cc < COLS - 1 && ground[r][cc + 1] !== 'water') { g.beginPath(); g.moveTo(cc * TS + TS - 1, r * TS); g.lineTo(cc * TS + TS - 1, r * TS + TS); g.stroke(); }
      if (cc > 0 && ground[r][cc - 1] !== 'water') { g.beginPath(); g.moveTo(cc * TS + 1, r * TS); g.lineTo(cc * TS + 1, r * TS + TS); g.stroke(); }
    }
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
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.02);
  }
  function noise(len, freq, vol, q) {
    var a = audio(); if (!a) return;
    var n = Math.floor(a.sampleRate * len);
    var buf = a.createBuffer(1, n, a.sampleRate), dd = buf.getChannelData(0);
    for (var i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1.2; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start();
  }
  function sndChop() { noise(0.09, 700 + Math.random() * 200, 0.35); tone(140, 0.07, 'square', 0.03); }
  function sndLog() { tone(660, 0.08, 'triangle', 0.06); tone(880, 0.1, 'triangle', 0.05, 0.06); }
  function sndFall() {
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
    g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.8);
    setTimeout(function () { noise(0.5, 180, 0.6, 0.7); }, 650);
  }
  function sndCoins() { tone(1320, 0.08, 'sine', 0.07); tone(1760, 0.12, 'sine', 0.06, 0.07); tone(2093, 0.14, 'sine', 0.05, 0.14); }
  function sndLevel() {
    [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.09, i * 0.11); });
    tone(262, 0.7, 'sine', 0.06, 0.55);
  }
  function sndFanfare() {
    [392, 523, 659, 784, 659, 784, 1047, 1047].forEach(function (f, i) { tone(f, 0.3, 'triangle', 0.1, i * 0.16); tone(f / 2, 0.3, 'sine', 0.05, i * 0.16); });
  }
  function sndNope() { tone(180, 0.15, 'square', 0.04); tone(140, 0.2, 'square', 0.04, 0.12); }
  function setMute(m) {
    muted = m;
    el.mute.textContent = m ? '🔇' : '🔊';
    el.mute.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  el.mute.addEventListener('click', function () { setMute(!muted); });
  setMute(muted);

  // ---------- chat ----------
  function say(html, cls) {
    var p = document.createElement('p');
    if (cls) p.className = cls;
    p.innerHTML = html;
    chat.appendChild(p);
    while (chat.childNodes.length > 60) chat.removeChild(chat.firstChild);
    chat.scrollTop = chat.scrollHeight;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function speak(ent, text) {
    ent.say = text; ent.sayT = 3.2;
    var cls = ent === tim ? 'tim' : 'who';
    say('<span class="' + cls + '">' + esc(ent.name) + ':</span> ' + esc(text));
  }

  // ---------- HUD + panels ----------
  var tab = 'pack';
  function updateHud() {
    var L = level();
    el.lvl.textContent = L;
    var a = xpFor(L), b = xpFor(L + 1), pct = L >= MAX ? 100 : (S.xp - a) / (b - a) * 100;
    el.barFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    el.bar.title = L >= MAX ? fmt(S.xp) + ' xp. Maxed.' : fmt(S.xp) + ' / ' + fmt(b) + ' xp';
    el.coins.textContent = fmt(S.coins);
    el.auto.hidden = !S.auto;
    el.auto.setAttribute('aria-pressed', S.autoOn ? 'true' : 'false');
    el.auto.textContent = S.autoOn ? 'Autochop: ON' : 'Autochop: off';
  }
  function renderPanel() {
    root.querySelectorAll('.cw-tab').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    var h = '';
    if (tab === 'pack') {
      h += '<div class="cw-inv">';
      for (var i = 0; i < INV; i++) {
        var t = S.inv[i];
        h += t === undefined
          ? '<button class="cw-slot" type="button" aria-label="Empty slot" tabindex="-1"></button>'
          : '<button class="cw-slot" type="button" data-drop="' + i + '" title="' + TREES[t].log + ' — tap to drop" aria-label="Drop ' + TREES[t].log + '"><img alt="" src="' + ICONS[t] + '"></button>';
      }
      h += '</div><div class="cw-invfoot"><span>' + S.inv.length + ' / ' + INV + '</span>' +
        (S.inv.length ? '<button class="cw-small-btn" type="button" data-act="dropall">Drop all</button>' : '') + '</div>';
    } else if (tab === 'skills') {
      var L = level(), total = L;
      h += '<div class="cw-skills"><button type="button" class="cw-skill main' + (L >= MAX ? ' max' : '') + '" data-skill="-1">Woodcutting<b>' + L + '</b></button>';
      SKILLS.forEach(function (s, k) {
        var lv = s[2] || 1; total += lv;
        h += '<button type="button" class="cw-skill' + (lv >= MAX ? ' max' : '') + '" data-skill="' + k + '">' + s[0] + '<b>' + lv + '</b></button>';
      });
      h += '</div><div class="cw-total">Total level: ' + total + '</div>';
    } else {
      var mins = Math.floor(S.played / 60);
      var rows = [
        ['Axe', AXES[S.axe].name], ['Logs chopped', fmt(S.logs)], ['Trees felled', fmt(S.felled)],
        ['Bird’s nests', fmt(S.nests)], ['Logs lost to squirrels', fmt(S.stolen)],
        ['Coins earned', fmt(S.earned)], ['Time chopping', mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm'],
        ['Other hobbies', 'none']
      ];
      h += '<dl class="cw-stats">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
        '<p style="margin:10px 0 0;text-align:right"><button class="cw-small-btn" type="button" data-act="reset">Start over</button></p>';
    }
    panel.innerHTML = h;
  }
  root.querySelector('.cw-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.cw-tab'); if (!b) return;
    tab = b.getAttribute('data-tab'); renderPanel();
  });
  panel.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-drop')) {
      var i = +b.getAttribute('data-drop'), t = S.inv[i];
      if (t === undefined) return;
      S.inv.splice(i, 1);
      say('You drop the ' + TREES[t].log.toLowerCase() + '. They roll away sadly.', 'sys');
      renderPanel();
    } else if (b.getAttribute('data-act') === 'dropall') {
      var n = S.inv.length; S.inv = [];
      say('You drop ' + n + ' logs on the floor. A true power-chopper.', 'sys');
      renderPanel();
    } else if (b.getAttribute('data-act') === 'reset') {
      showReset();
    } else if (b.hasAttribute('data-skill')) {
      var k = +b.getAttribute('data-skill');
      if (k < 0) {
        var L = level();
        say(L >= MAX ? 'Woodcutting 99. ' + fmt(S.xp) + ' xp. Nothing left to prove. Keep chopping anyway.'
          : 'Woodcutting ' + L + '. ' + fmt(xpFor(L + 1) - S.xp) + ' xp to level ' + (L + 1) + '.', 'good');
      } else say(SKILLS[k][0] + ': ' + SKILLS[k][1], 'sys');
    }
  });
  el.auto.addEventListener('click', function () {
    S.autoOn = !S.autoOn;
    say(S.autoOn ? 'Autochop engaged. Tim’s eyes glaze over.' : 'Autochop off. Tim blinks for the first time in a while.', 'sys');
    if (!S.autoOn) stopAll();
    updateHud(); save();
  });

  // ---------- effects ----------
  var particles = [], floats = [], marker = null, banner = null;
  function burst(x, y, n, colors, speed) {
    if (REDUCED) n = Math.ceil(n / 4);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = (0.3 + Math.random()) * (speed || 120);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.6 + Math.random() * 0.6, max: 1.2, c: pick(colors), g: 160 });
    }
  }
  function chips(x, y, color) {
    for (var i = 0; i < (REDUCED ? 2 : 5); i++) {
      particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, life: 0.5, max: 0.5, c: color, g: 400, sq: 1 });
    }
  }
  function floatText(text, x, y, color) { floats.push({ text: text, x: x, y: y, life: 1.4, c: color }); }

  // ---------- actions ----------
  function stopAll() { tim.goal = null; tim.chop = null; tim.path = []; }
  function walkTo(c, r) {
    tim.chop = null; tim.goal = null;
    var p = bfs(tim.tx, tim.ty, function (x, y) { return x === c && y === r; });
    if (p) { tim.path = p; marker = { x: c * TS + TS / 2, y: r * TS + TS / 2, t: 0.6, c: '#ffe14a' }; }
  }
  function canChop(t) { return level() >= TREES[t.type].req; }
  function goTree(t, quiet) {
    var info = TREES[t.type];
    if (!canChop(t)) {
      if (!quiet) { say('You need a Woodcutting level of ' + info.req + ' to chop the ' + info.name + '.', 'bad'); sndNope(); }
      return false;
    }
    if (t.down) { if (!quiet) say('It’s a stump. Give it a minute.', 'sys'); return false; }
    var p = bfs(tim.tx, tim.ty, adjacentTo(t.c, t.r));
    if (!p) return false;
    // chop from the side if it's not much further: looks better, and keeps the trunk visible
    var side = bfs(tim.tx, tim.ty, function (c, r) { return r === t.r && Math.abs(c - t.c) === 1; });
    if (side && side.length <= p.length + 2) p = side;
    tim.chop = null; tim.path = p; tim.goal = { kind: 'tree', tree: t };
    marker = { x: t.c * TS + TS / 2, y: t.r * TS + TS / 2, t: 0.6, c: '#ff5a3a' };
    return true;
  }
  function goStall() {
    var p = bfs(tim.tx, tim.ty, adjacentTo(stall.c, stall.r));
    if (!p) return;
    tim.chop = null; tim.path = p; tim.goal = { kind: 'stall' };
    marker = { x: stall.c * TS + TS / 2, y: stall.r * TS + TS / 2, t: 0.6, c: '#ff5a3a' };
  }
  function arrive() {
    var g = tim.goal; tim.goal = null;
    if (!g) return;
    if (g.kind === 'tree') {
      var t = g.tree;
      if (t.down) { say('Someone else got there first. (It was gravity.)', 'sys'); return; }
      if (S.inv.length >= INV) { fullMsg(); return; }
      faceToward(t.c, t.r);
      tim.chop = t; tim.chopT = TICK * 0.5;
      if (!S.autoOn) say('You swing your ' + AXES[S.axe].name.toLowerCase().replace(/^the /, '') + ' at the ' + TREES[t.type].name + '.', 'sys');
    } else if (g.kind === 'stall') {
      faceToward(stall.c, stall.r);
      if (S.autoOn) autoTrade(); else showShop();
    }
  }
  function faceToward(c, r) { if (c !== tim.tx) tim.face = c > tim.tx ? 1 : -1; }
  function fullMsg() {
    say('Your pack is full. Go and see Logbert at the stall.', 'bad');
  }

  function chopTick() {
    var t = tim.chop, info = TREES[t.type];
    if (t.down) { tim.chop = null; return; }
    if (S.inv.length >= INV) { tim.chop = null; fullMsg(); return; }
    tim.swing = 1; t.shake = 1;
    sndChop();
    chips(t.c * TS + TS / 2 - tim.face * 8, t.r * TS + TS - 18, BARK[t.type]);
    var L = level();
    var p = Math.min(0.9, info.p * AXES[S.axe].power * (1 + (L - info.req) / 40));
    if (Math.random() >= p) return;

    // got a log
    S.inv.push(t.type); S.logs++;
    sndLog();
    floatText('+' + info.xp + ' xp', tim.x * TS + TS / 2, tim.y * TS - 34, '#bfff8a');
    if (!S.autoOn || Math.random() < 0.15) say('You get some ' + info.log.toLowerCase() + '.', 'good');
    gainXP(info.xp);

    if (t.type === 5 && Math.random() < 0.18) {
      var line = pick(ANCIENT_LINES);
      t.say = line; t.sayT = 3.2;
      say('<span class="tree">Ancient Chadwood:</span> ' + esc(line));
    }
    if (Math.random() < 1 / 70) {
      var gold = Math.round((20 + Math.random() * 40) * (t.type + 1));
      S.coins += gold; S.earned += gold; S.nests++;
      say('A bird’s nest falls out of the ' + info.name + '! There are ' + fmt(gold) + ' coins in it. Birds, eh.', 'good');
      floatText('+' + fmt(gold) + ' coins', t.c * TS + TS / 2, t.r * TS - 10, '#ffd34a');
      sndCoins();
    } else if (S.inv.length > 1 && Math.random() < 1 / 140) {
      var idx = (Math.random() * S.inv.length) | 0, lost = S.inv.splice(idx, 1)[0];
      S.stolen++;
      say('A squirrel steals your ' + TREES[lost].log.toLowerCase() + ' and stares at you. You let it go.', 'bad');
    }
    if (Math.random() < info.fall) {
      t.down = true; t.regrow = info.respawn; t.fallT = 0.7; t.fallDir = tim.x < t.c ? 1 : -1;
      S.felled++; tim.chop = null;
      sndFall();
      if (Math.random() < 0.4) speak(tim, 'Timber!');
      else if (!S.autoOn) say('The ' + info.name + ' falls over. Timber.', 'sys');
    }
    if (S.inv.length >= INV) { tim.chop = null; if (!S.autoOn) fullMsg(); }
    renderPanel(); updateHud();
  }

  function gainXP(n) {
    var before = level();
    S.xp += n;
    var after = level();
    if (after > before) levelUp(before, after);
  }
  function levelUp(from, to) {
    sndLevel();
    banner = { title: to >= MAX ? 'WOODCUTTING 99!' : 'Level up!', sub: 'Woodcutting is now ' + to + '.', t: 3 };
    burst(tim.x * TS + TS / 2, tim.y * TS - 20, 40, ['#ffd34a', '#8fd45a', '#ffffff', '#ff8a3a'], 160);
    say('Congratulations! Your Woodcutting level is now ' + to + '.', 'good');
    TREES.forEach(function (t) { if (t.req > from && t.req <= to && t.req > 1) say('You can now chop ' + t.name + ' trees.', 'good'); });
    AXES.forEach(function (a) { if (a.req > from && a.req <= to && a.req > 1) say('You can now wield the ' + a.name + '. Logbert has one. For a price.', 'good'); });
    if (Math.random() < 0.6) {
      var b = pick(bots);
      setTimeout(function () { speak(b, pick(GZ)); }, 600 + Math.random() * 900);
    }
    if (to >= MAX && !S.got99) {
      S.got99 = true; save();
      setTimeout(show99, 1800);
    }
    renderPanel();
  }

  function sellAll() {
    if (!S.inv.length) return 0;
    var total = 0;
    S.inv.forEach(function (t) { total += TREES[t].val; });
    S.coins += total; S.earned += total; S.inv = [];
    sndCoins();
    floatText('+' + fmt(total) + ' coins', stall.c * TS + TS / 2, stall.r * TS - 10, '#ffd34a');
    renderPanel(); updateHud(); save();
    return total;
  }
  function buyAxe(i) {
    var a = AXES[i];
    if (i <= S.axe || S.coins < a.price || level() < a.req) return false;
    S.coins -= a.price; S.axe = i;
    say('You buy ' + (/^The /.test(a.name) ? a.name : 'the ' + a.name) + '. ' + a.note, 'good');
    sndCoins(); updateHud(); renderPanel(); save();
    return true;
  }
  function autoTrade() {
    var n = S.inv.length, got = sellAll();
    if (n) say('Autochop sold ' + n + ' logs for ' + fmt(got) + ' coins. Logbert looks uneasy.', 'sys');
    for (var i = AXES.length - 1; i > S.axe; i--) if (buyAxe(i)) break;
  }

  function bestTree() {
    var L = level(), best = null, bestTier = -1, bestD = 1e9;
    trees.forEach(function (t) {
      if (t.down || TREES[t.type].req > L) return;
      var d = Math.abs(t.c - tim.tx) + Math.abs(t.r - tim.ty);
      if (t.type > bestTier || (t.type === bestTier && d < bestD)) { best = t; bestTier = t.type; bestD = d; }
    });
    return best;
  }
  function nearestTree() {
    var best = null, bestD = 1e9;
    trees.forEach(function (t) {
      if (t.down || !canChop(t)) return;
      var d = Math.hypot(t.c - tim.tx, t.r - tim.ty);
      if (d < bestD) { best = t; bestD = d; }
    });
    return best;
  }

  // ---------- update ----------
  function moveChar(e, dt, speed) {
    var moving = false, step = speed * dt;
    while (step > 0) {
      var dx = e.tx - e.x, dy = e.ty - e.y, dist = Math.hypot(dx, dy);
      if (dist < 1e-4) {
        e.x = e.tx; e.y = e.ty;
        if (!e.path.length) break;
        var n = e.path.shift(); e.tx = n[0]; e.ty = n[1];
        if (e.tx !== e.x) e.face = e.tx > e.x ? 1 : -1;
        continue;
      }
      moving = true;
      var m = Math.min(step, dist);
      e.x += dx / dist * m; e.y += dy / dist * m; step -= m;
    }
    if (moving) e.walk += dt * 10; else e.walk = 0;
    if (e.sayT > 0) { e.sayT -= dt; if (e.sayT <= 0) e.say = null; }
    return moving;
  }

  var overlayOpen = false, saveT = 0;
  function update(dt) {
    if (!document.hidden) S.played += dt;
    var moving = moveChar(tim, dt, SPEED);
    if (!moving && !tim.path.length && tim.goal) arrive();
    if (tim.chop) {
      tim.chopT += dt;
      if (tim.chopT >= TICK) { tim.chopT -= TICK; chopTick(); }
    }
    tim.swing = Math.max(0, tim.swing - dt * 3.2);

    // autochop brain
    if (S.autoOn && !overlayOpen && !tim.chop && !tim.goal && !tim.path.length && !moving) {
      tim.idle += dt;
      if (tim.idle > 0.5) {
        tim.idle = 0;
        if (S.inv.length >= INV) goStall();
        else { var t = bestTree(); if (t) goTree(t, true); }
      }
    } else tim.idle = 0;

    trees.forEach(function (t) {
      if (t.shake > 0) t.shake = Math.max(0, t.shake - dt * 4);
      if (t.fallT > 0) t.fallT = Math.max(0, t.fallT - dt);
      if (t.sayT > 0) { t.sayT -= dt; if (t.sayT <= 0) t.say = null; }
      if (t.down) {
        t.regrow -= dt;
        if (t.regrow <= 0) {
          t.down = false;
          burst(t.c * TS + TS / 2, t.r * TS + TS / 2, 10, ['#b6ff7a', '#ffffff'], 60);
        }
      }
    });

    bots.forEach(function (b) {
      var m = moveChar(b, dt, 2.3);
      if (!m && !b.path.length) {
        b.wait -= dt;
        if (b.wait <= 0) {
          b.wait = 2 + Math.random() * 5;
          var tc = Math.max(0, Math.min(COLS - 1, Math.round(b.tx + (Math.random() - 0.5) * 8)));
          var tr = Math.max(0, Math.min(ROWS - 1, Math.round(b.ty + (Math.random() - 0.5) * 8)));
          if (!blocked(tc, tr)) b.path = bfs(b.tx, b.ty, function (x, y) { return x === tc && y === tr; }) || [];
        }
      }
      b.talk -= dt;
      if (b.talk <= 0) {
        b.talk = 14 + Math.random() * 22;
        if (overlayOpen) return;
        var r = Math.random();
        if (S.autoOn && r < 0.35) speak(b, pick(BOT_AUTO_LINES));
        else if (r < 0.3) {
          var pl = pick(PLACES);
          speak(b, pl[0]);
          setTimeout(function () { if (!S.autoOn) speak(tim, pl[1]); }, 1400 + Math.random() * 1200);
        } else if (r < 0.55) {
          var q = pick(ASK_LINES);
          speak(b, q);
          setTimeout(function () {
            if (S.autoOn) return; // a bot does not chat back
            speak(tim, q === 'lvl?' ? 'Woodcutting ' + level() + '. Only one that counts.' : pick(TIM_REPLIES));
          }, 1400 + Math.random() * 1200);
        } else speak(b, pick(BOT_LINES));
      }
    });

    particles = particles.filter(function (p) {
      p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      return p.life > 0;
    });
    floats = floats.filter(function (f) { f.life -= dt; f.y -= 26 * dt; return f.life > 0; });
    if (marker) { marker.t -= dt; if (marker.t <= 0) marker = null; }
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }

    saveT += dt;
    if (saveT > 5) { saveT = 0; save(); if (tab === 'stats') renderPanel(); }
  }

  // ---------- drawing ----------
  var hover = null, now = 0;
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function shadow(x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

  function drawStanding(type, cx, by) {
    var g = ctx;
    if (type === 0) {
      g.fillStyle = '#7a5530'; g.fillRect(cx - 1.5, by - 16, 3, 16);
      circle(cx, by - 20, 9, '#5fae3a'); circle(cx - 3, by - 23, 5, '#8fd45a');
    } else if (type === 1) {
      g.fillStyle = BARK[1]; g.fillRect(cx - 3.5, by - 32, 7, 32);
      g.fillStyle = '#2a2a2a'; [6, 13, 21, 27].forEach(function (y, i) { g.fillRect(cx - (i % 2 ? 1 : 3.5), by - y, 4, 2); });
      circle(cx - 9, by - 34, 11, '#6fb046'); circle(cx + 9, by - 34, 11, '#6fb046'); circle(cx, by - 44, 13, '#86c654');
      circle(cx - 4, by - 47, 6, '#a6dd70');
    } else if (type === 2) {
      g.fillStyle = BARK[2]; g.fillRect(cx - 5, by - 24, 10, 24);
      circle(cx - 12, by - 30, 13, '#2f7a2c'); circle(cx + 12, by - 30, 13, '#2f7a2c'); circle(cx, by - 40, 16, '#3f8f35');
      circle(cx - 5, by - 45, 7, '#5aa848');
      g.fillStyle = '#8a4b1c'; [[-10, 28], [9, 33], [2, 40], [-3, 30]].forEach(function (p) { g.beginPath(); g.arc(cx + p[0], by - p[1], 2.2, 0, 7); g.fill(); });
    } else if (type === 3) {
      g.fillStyle = BARK[3]; g.fillRect(cx - 3.5, by - 14, 7, 14);
      [['#24604e', 0, 22], ['#2d725c', 16, 18], ['#378a6f', 30, 13]].forEach(function (l) {
        g.fillStyle = l[0]; g.beginPath(); g.moveTo(cx - l[2], by - 10 - l[1]); g.lineTo(cx + l[2], by - 10 - l[1]); g.lineTo(cx, by - 38 - l[1]); g.closePath(); g.fill();
      });
    } else if (type === 4) {
      g.fillStyle = BARK[4]; g.fillRect(cx - 6, by - 50, 12, 50);
      g.fillStyle = 'rgba(60,15,5,0.35)'; g.fillRect(cx - 2, by - 48, 2, 46); g.fillRect(cx + 3, by - 40, 1.5, 36);
      g.fillStyle = '#1f4a28'; g.beginPath(); g.ellipse(cx, by - 70, 15, 28, 0, 0, 7); g.fill();
      circle(cx - 10, by - 54, 9, '#24552e'); circle(cx + 10, by - 58, 9, '#24552e');
      g.fillStyle = '#2f6a38'; g.beginPath(); g.ellipse(cx - 3, by - 78, 7, 14, 0, 0, 7); g.fill();
    } else {
      // the Ancient Chadwood
      g.fillStyle = BARK[5];
      g.beginPath(); g.moveTo(cx - 20, by); g.quadraticCurveTo(cx - 12, by - 6, cx - 13, by - 46); g.lineTo(cx + 13, by - 46);
      g.quadraticCurveTo(cx + 12, by - 6, cx + 20, by); g.closePath(); g.fill();
      var gl = 0.5 + 0.5 * Math.sin(now * 2);
      g.save();
      g.beginPath(); g.ellipse(cx, by - 26, 9.5, 12, 0, 0, Math.PI * 2); g.clip();
      if (faceImg.complete && faceImg.naturalWidth) g.drawImage(faceImg, cx - 13, by - 40, 26, 26);
      g.fillStyle = 'rgba(120,70,25,0.42)'; g.fillRect(cx - 13, by - 40, 26, 30);
      g.restore();
      g.strokeStyle = '#3d2614'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, by - 26, 10, 12.5, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,200,80,' + (0.12 + gl * 0.12) + ')'; g.beginPath(); g.arc(cx, by - 62, 40, 0, 7); g.fill();
      circle(cx - 17, by - 54, 15, '#c46f1f'); circle(cx + 17, by - 54, 15, '#c46f1f');
      circle(cx - 8, by - 70, 17, '#e0962e'); circle(cx + 10, by - 72, 16, '#e0962e');
      circle(cx, by - 84, 13, '#f2b84b'); circle(cx - 4, by - 88, 6, '#ffd77a');
      for (var i = 0; i < 4; i++) {
        var a = now * 0.8 + i * 1.6, sx = cx + Math.cos(a) * 24, sy = by - 66 + Math.sin(a * 1.3) * 18;
        g.fillStyle = 'rgba(255,240,170,' + (0.5 + 0.5 * Math.sin(now * 4 + i)) + ')';
        g.fillRect(sx - 1, sy - 1, 2.5, 2.5);
      }
    }
  }
  function drawTree(t) {
    var cx = t.c * TS + TS / 2, by = t.r * TS + TS - 7, big = t.type === 5;
    shadow(cx, by, big ? 20 : 13, big ? 6 : 4.5);
    if (t.down) {
      var sw = big ? 15 : t.type === 0 ? 3 : 7;
      ctx.fillStyle = BARK[t.type]; ctx.fillRect(cx - sw, by - 7, sw * 2, 7);
      ctx.fillStyle = RING[t.type]; ctx.beginPath(); ctx.ellipse(cx, by - 7, sw, sw * 0.4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(110,60,20,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, by - 7, sw * 0.5, sw * 0.2, 0, 0, 7); ctx.stroke();
      if (t.fallT > 0) {
        var k = 1 - t.fallT / 0.7;
        ctx.save(); ctx.globalAlpha = Math.min(1, t.fallT / 0.25);
        ctx.translate(cx, by - 6); ctx.rotate(t.fallDir * k * k * 1.5);
        drawStanding(t.type, 0, 0);
        ctx.restore();
      }
      return;
    }
    var sh = t.shake > 0 ? Math.sin(now * 70) * t.shake * 1.8 : 0;
    drawStanding(t.type, cx + sh, by);
  }

  function drawStall() {
    var x = stall.c * TS, y = stall.r * TS, cx = x + TS / 2;
    shadow(cx, y + TS - 6, 22, 5);
    // Logbert, behind the counter
    drawPerson(cx, y + TS - 14, { shirt: '#5b3b8a', hair: '#ddd', hat: true }, 0.9);
    ctx.fillStyle = '#7a5530'; ctx.fillRect(x - 2, y + 16, TS + 4, 20);
    ctx.fillStyle = '#9a7448'; ctx.fillRect(x - 4, y + 14, TS + 8, 5);
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(x - 2, y - 18, 4, 36); ctx.fillRect(x + TS - 2, y - 18, 4, 36);
    for (var i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f3e7c9' : '#c0392b';
      ctx.beginPath(); ctx.moveTo(x - 6 + i * 9, y - 22); ctx.lineTo(x + 3 + i * 9, y - 22); ctx.lineTo(x + 3 + i * 9, y - 12); ctx.lineTo(x - 6 + i * 9, y - 12); ctx.fill();
    }
    ctx.drawImage(logIconImgs[2], x + 2, y + 18, 16, 16);
    ctx.drawImage(logIconImgs[4], x + 20, y + 18, 16, 16);
    label('Logbert', cx, y - 26, '#ffe14a');
  }
  var logIconImgs = ICONS.map(function (src) { var im = new Image(); im.src = src; return im; });

  function label(text, x, y, color) {
    ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function bubble(text, x, y) {
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var w = ctx.measureText(text).width;
    x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x)); y = Math.max(14, y);
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#000'; ctx.strokeText(text, x, y);
    ctx.fillStyle = '#ffff3a'; ctx.fillText(text, x, y);
  }

  function drawPerson(x, y, look, s, walk) {
    s = s || 1;
    var bob = walk ? Math.abs(Math.sin(walk)) * 2 : 0, legA = walk ? Math.sin(walk) * 4 : 0;
    ctx.fillStyle = '#2d2a3a';
    ctx.fillRect(x - 6 * s + legA * 0.5, y - 10 * s, 5 * s, 10 * s);
    ctx.fillRect(x + 1 * s - legA * 0.5, y - 10 * s, 5 * s, 10 * s);
    ctx.fillStyle = look.shirt; rr(ctx, x - 9 * s, y - 27 * s - bob, 18 * s, 19 * s, 5 * s); ctx.fill();
    var hy = y - 36 * s - bob;
    circle(x, hy, 9 * s, '#f0c8a0');
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(x, hy - 1 * s, 9.5 * s, Math.PI, 0); ctx.fill();
    if (look.hat) { ctx.fillStyle = '#3b2a1c'; ctx.fillRect(x - 12 * s, hy - 6 * s, 24 * s, 3 * s); ctx.fillRect(x - 7 * s, hy - 14 * s, 14 * s, 9 * s); }
    ctx.fillStyle = '#222'; ctx.fillRect(x - 4 * s, hy + 1 * s, 2 * s, 2 * s); ctx.fillRect(x + 2 * s, hy + 1 * s, 2 * s, 2 * s);
  }

  function drawBot(b) {
    var x = b.x * TS + TS / 2, y = b.y * TS + TS - 6;
    shadow(x, y, 10, 3.5);
    drawPerson(x, y, b, 0.85, b.walk);
    label(b.name, x, y - 46, '#9fd7ff');
    if (b.say) bubble(b.say, x, y - 58);
  }

  function drawAxe(len, color) {
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke();
    if (S.axe === 0) {
      ctx.fillStyle = color; rr(ctx, -2, -len - 12, 5, 14, 2); ctx.fill();
    } else if (S.axe === 5) {
      ctx.fillStyle = color; rr(ctx, -6, -len - 4, 12, 10, 2); ctx.fill();
      ctx.fillStyle = '#c9ced4'; rr(ctx, -2.5, -len - 22, 6, 20, 3); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.strokeRect(-2.5, -len - 22, 6, 20); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, -len + 2); ctx.lineTo(9, -len - 4); ctx.lineTo(9, -len + 8); ctx.closePath(); ctx.fill();
      if (S.axe === 4) { ctx.beginPath(); ctx.moveTo(0, -len + 2); ctx.lineTo(-9, -len - 4); ctx.lineTo(-9, -len + 8); ctx.closePath(); ctx.fill(); }
    }
  }

  function drawTim() {
    var x = tim.x * TS + TS / 2, y = tim.y * TS + TS - 6, f = tim.face;
    var bob = tim.walk ? Math.abs(Math.sin(tim.walk)) * 2 : 0, legA = tim.walk ? Math.sin(tim.walk) * 4 : 0;
    shadow(x, y, 11, 4);
    if (S.got99) {
      ctx.fillStyle = '#2f7a2c';
      ctx.beginPath(); ctx.moveTo(x - 9, y - 27 - bob); ctx.lineTo(x + 9, y - 27 - bob); ctx.lineTo(x + 13, y - 3); ctx.lineTo(x - 13, y - 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd34a'; ctx.fillRect(x - 13, y - 6, 26, 3);
    }
    ctx.fillStyle = '#2d2a3a';
    ctx.fillRect(x - 6 + legA * 0.5, y - 10, 5, 10);
    ctx.fillRect(x + 1 - legA * 0.5, y - 10, 5, 10);
    // maroon tee, as per the reference photo
    ctx.fillStyle = '#6b2236'; rr(ctx, x - 10, y - 28 - bob, 20, 20, 6); ctx.fill();
    // axe arm
    var swing = tim.chop ? tim.swing : 0;
    var ang = tim.chop ? (-0.2 - (1 - swing) * 1.6 + swing * 0.3) : 0.25;
    ctx.save();
    ctx.translate(x + f * 7, y - 22 - bob);
    ctx.scale(f, 1);
    ctx.rotate(ang + (tim.chop ? 1.1 : 0));
    drawAxe(16, AXES[S.axe].head);
    ctx.restore();
    ctx.fillStyle = '#e8b896'; ctx.beginPath(); ctx.arc(x + f * 9, y - 18 - bob, 3, 0, 7); ctx.fill();
    // big photo head
    var hy = y - 42 - bob, hr = 14;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, hy, hr, 0, Math.PI * 2); ctx.clip();
    if (faceImg.complete && faceImg.naturalWidth) {
      if (f < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
      ctx.drawImage(faceImg, x - hr - 2, hy - hr - 1, hr * 2 + 4, hr * 2 + 4);
    } else { ctx.fillStyle = '#f0c8a0'; ctx.fillRect(x - hr, hy - hr, hr * 2, hr * 2); }
    ctx.restore();
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, hy, hr, 0, Math.PI * 2); ctx.stroke();
    if (S.autoOn) { ctx.fillStyle = 'rgba(160,255,160,0.85)'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('zzz', x + 16, hy - 12 + Math.sin(now * 3) * 2); }
    if (tim.say) bubble(tim.say, x, hy - hr - 6);
  }

  function hitTest(wx, wy) {
    var best = null, bestY = -1;
    trees.forEach(function (t) {
      var cx = t.c * TS + TS / 2, by = t.r * TS + TS - 4;
      var hw = t.type === 5 ? 28 : 16, top = by - (t.down ? 18 : [30, 58, 58, 72, 100, 104][t.type]);
      if (wx >= cx - hw && wx <= cx + hw && wy >= top && wy <= by && by > bestY) { best = { kind: 'tree', tree: t }; bestY = by; }
    });
    var sx = stall.c * TS, sy = stall.r * TS;
    if (wx >= sx - 6 && wx <= sx + TS + 6 && wy >= sy - 26 && wy <= sy + TS && sy + TS > bestY) best = { kind: 'stall' };
    if (best) return best;
    var c = Math.floor(wx / TS), r = Math.floor(wy / TS);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return blocked(c, r) ? { kind: 'blocked', c: c, r: r } : { kind: 'walk', c: c, r: r };
  }
  function hoverText(h) {
    if (!h) return null;
    if (h.kind === 'tree') {
      var info = TREES[h.tree.type];
      if (h.tree.down) return ['Stump (' + info.name + ')', '#cfc0a0'];
      return level() >= info.req ? ['Chop down ' + info.name, '#ffffff'] : ['Chop down ' + info.name + ' (level ' + info.req + ')', '#ff8a7a'];
    }
    if (h.kind === 'stall') return ['Trade with Logbert', '#ffe14a'];
    if (h.kind === 'walk') return ['Walk here', '#ffffff'];
    return null;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bg) ctx.drawImage(bg, 0, 0);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

    if (hover && (hover.kind === 'walk')) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(hover.c * TS + 1, hover.r * TS + 1, TS - 2, TS - 2);
    }
    if (marker) {
      var mk = marker.t / 0.6, ms = 6;
      ctx.strokeStyle = marker.c; ctx.globalAlpha = mk; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(marker.x - ms, marker.y - ms); ctx.lineTo(marker.x + ms, marker.y + ms);
      ctx.moveTo(marker.x + ms, marker.y - ms); ctx.lineTo(marker.x - ms, marker.y + ms); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // depth-sorted scene
    var items = [];
    trees.forEach(function (t) { items.push({ y: t.r + 0.9, d: function () { drawTree(t); } }); });
    items.push({ y: stall.r + 0.9, d: drawStall });
    bots.forEach(function (b) { items.push({ y: b.y + 0.95, d: function () { drawBot(b); } }); });
    items.push({ y: tim.y + 0.96, d: drawTim });
    items.sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (it) { it.d(); });

    trees.forEach(function (t) { if (t.say) bubble(t.say, t.c * TS + TS / 2, t.r * TS - 70); });

    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      ctx.fillStyle = p.c;
      if (p.sq) ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
    floats.forEach(function (f) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.c; ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    var ht = hoverText(hover);
    if (ht && !overlayOpen) {
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(ht[0], 8, 18);
      ctx.fillStyle = ht[1]; ctx.fillText(ht[0], 8, 18);
    }

    if (banner) {
      var a = Math.min(1, banner.t * 2, (3 - banner.t) * 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,14,6,0.85)'; rr(ctx, W / 2 - 150, 34, 300, 64, 12); ctx.fill();
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '28px MedievalSharp, Georgia, serif'; ctx.fillStyle = '#ffcf4a'; ctx.fillText(banner.title, W / 2, 66);
      ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#f3e7c9'; ctx.fillText(banner.sub, W / 2, 87);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- input ----------
  function toWorld(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
  }
  canvas.addEventListener('pointermove', function (e) { var p = toWorld(e); hover = hitTest(p[0], p[1]); });
  canvas.addEventListener('pointerleave', function () { hover = null; });
  canvas.addEventListener('pointerdown', function (e) {
    if (overlayOpen) return;
    audio();
    var p = toWorld(e), h = hitTest(p[0], p[1]);
    if (e.pointerType !== 'mouse') hover = null;
    if (!h) return;
    if (S.autoOn && h.kind !== 'blocked') { S.autoOn = false; updateHud(); say('You grab the wheel. Autochop off.', 'sys'); }
    if (h.kind === 'tree') goTree(h.tree);
    else if (h.kind === 'stall') goStall();
    else if (h.kind === 'walk') walkTo(h.c, h.r);
  });
  canvas.addEventListener('keydown', function (e) {
    if (overlayOpen) return;
    var k = e.key, d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
    if (d) {
      e.preventDefault();
      var c = tim.tx + d[0], r = tim.ty + d[1];
      if (!blocked(c, r)) walkTo(c, r);
    } else if (k === ' ' || k === 'Enter') {
      e.preventDefault(); audio();
      var t = nearestTree();
      if (t) goTree(t); else say('Nothing you can chop is standing. The forest needs a moment.', 'sys');
    } else if (k === 's' || k === 'S') { goStall(); }
  });

  // ---------- overlays ----------
  function openOv(html) {
    ov.innerHTML = '<div class="cw-card">' + html + '</div>';
    ov.hidden = false; overlayOpen = true;
    var b = ov.querySelector('[data-focus]') || ov.querySelector('button');
    if (b) b.focus();
  }
  function closeOv() { ov.hidden = true; ov.innerHTML = ''; overlayOpen = false; canvas.focus(); }
  ov.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act');
    audio();
    if (act === 'close') closeOv();
    else if (act === 'start') { closeOv(); say(returning ? 'Welcome back. The trees regrew while you were away. Mostly.' : 'Welcome to Chadlinor. Tim heads straight for the trees. Tap one. Chop it. That’s it.', 'good'); }
    else if (act === 'sell') {
      var n = S.inv.length, got = sellAll();
      say('Logbert takes ' + n + ' logs and gives you ' + fmt(got) + ' coins. He seems pleased. Too pleased.', 'good');
      showShop();
    } else if (act === 'axe') { buyAxe(+b.getAttribute('data-i')); showShop(); }
    else if (act === 'auto') {
      if (S.auto || S.coins < AUTO_PRICE) return;
      S.coins -= AUTO_PRICE; S.auto = true; S.autoOn = true;
      sndCoins(); updateHud(); save();
      say('You buy Autochop™. Tim will now chop, sell and upgrade on his own. This is definitely allowed.', 'good');
      closeOv();
    } else if (act === 'reset-yes') {
      wiping = true;
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* ignore */ }
      location.reload();
    }
  });
  ov.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.getAttribute('data-kind') !== 'intro') closeOv(); });

  function showIntro() {
    ov.setAttribute('data-kind', 'intro');
    openOv(
      '<img class="cw-face" alt="Tim" src="' + FACE_SRC + '">' +
      '<h2>Chadlinor</h2>' +
      (returning
        ? '<p>Welcome back. Woodcutting <b>' + level() + '</b>, ' + fmt(S.coins) + ' coins, and absolutely no other interests.</p>'
        : '<p>Welcome to Chadlinor: a vast world of quests, dragons, deserts, castles and a whole economy.</p><p><b>Tim chops trees in Chadwood.</b></p>') +
      '<p class="dim">Tap a tree to chop it. Fill your pack, sell logs to Logbert at the stall, buy better axes, chop bigger trees. Get Woodcutting to 99. That’s the whole game.</p>' +
      '<button class="cw-btn" type="button" data-act="start" data-focus>' + (returning ? 'Back to the trees' : 'Pick up the butter knife') + '</button>'
    );
  }

  function showShop() {
    ov.setAttribute('data-kind', 'shop');
    var L = level(), counts = {}, total = 0;
    S.inv.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; total += TREES[t].val; });
    var h = '<div class="cw-shop"><h2 style="text-align:center">Logbert’s Logs</h2>' +
      '<p class="dim" style="text-align:center">“Logs in, coins out. No questions. Especially about where the trees go.”</p>' +
      '<h3>Sell</h3>';
    if (S.inv.length) {
      h += '<div class="cw-sell">' + Object.keys(counts).map(function (t) { return counts[t] + ' × ' + TREES[t].log + ' (' + TREES[t].val + ' ea)'; }).join('<br>') + '</div>' +
        '<button class="cw-btn" type="button" data-act="sell" data-focus style="width:100%">Sell all for ' + fmt(total) + ' coins</button>';
    } else h += '<p class="dim">Your pack is empty. Logbert looks at you like you’ve wasted his time. You have.</p>';
    h += '<h3>Axes</h3>';
    AXES.forEach(function (a, i) {
      if (i === 0) return;
      var right;
      if (i === S.axe) right = '<span class="tag">Wielding</span>';
      else if (i < S.axe) right = '<span class="tag" style="color:var(--cw-dim)">Outgrown</span>';
      else right = '<button class="cw-small-btn" type="button" data-act="axe" data-i="' + i + '"' + (S.coins < a.price || L < a.req ? ' disabled' : '') + '>' + fmt(a.price) + '</button>';
      h += '<div class="cw-row"><div class="nm"><b>' + a.name + '</b><span>Level ' + a.req + ' · power ' + a.power + 'x · ' + a.note + '</span></div>' + right + '</div>';
    });
    h += '<h3>Extras</h3><div class="cw-row"><div class="nm"><b>Autochop™</b><span>Chops, sells and buys axes while you watch. Definitely not a bot.</span></div>' +
      (S.auto ? '<span class="tag">Owned</span>' : '<button class="cw-small-btn" type="button" data-act="auto"' + (S.coins < AUTO_PRICE ? ' disabled' : '') + '>' + fmt(AUTO_PRICE) + '</button>') + '</div>' +
      '<p style="text-align:center;margin-top:12px"><button class="cw-btn ghost" type="button" data-act="close">Back to chopping</button></p></div>';
    openOv(h);
  }

  function showReset() {
    ov.setAttribute('data-kind', 'reset');
    openOv('<h2>Start over?</h2><p>Your level, coins and axes will be gone. The trees will not remember you.</p>' +
      '<p><button class="cw-btn" type="button" data-act="reset-yes">Wipe it</button> <button class="cw-btn ghost" type="button" data-act="close" data-focus>Keep chopping</button></p>');
  }

  function show99() {
    ov.setAttribute('data-kind', '99');
    sndFanfare();
    var mins = Math.floor(S.played / 60);
    openOv(
      '<div class="cw-photo-wrap"><img class="cw-photo" alt="Tim, Woodcutting 99" src="' + PORTRAIT_SRC + '"></div>' +
      '<h2>Woodcutting 99</h2>' +
      '<p>Tim is now the finest woodcutter in all of Chadlinor. He has still not seen the rest of it.</p>' +
      '<p>You are awarded the <span class="cw-cape">Cape of Chopping</span>. It is green. It smells of sap.</p>' +
      '<p class="dim">' + fmt(S.logs) + ' logs · ' + fmt(S.felled) + ' trees felled · ' + (mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + ' minutes') + ' · every other skill still level 1</p>' +
      '<button class="cw-btn" type="button" data-act="close" data-focus>Keep chopping anyway</button>'
    );
    burst(tim.x * TS + TS / 2, tim.y * TS - 20, 80, ['#ffd34a', '#8fd45a', '#ffffff', '#ff8a3a', '#7fc7ff'], 220);
  }

  // ---------- main loop ----------
  var last = 0;
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t; now = t / 1000;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });

  resize();
  updateHud();
  renderPanel();
  say('Chadlinor. A whole world out there. Tim is in Chadwood, the forest bit, and is not leaving.', 'sys');
  showIntro();
  requestAnimationFrame(frame);
})();
