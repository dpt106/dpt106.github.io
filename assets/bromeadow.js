/* Mr Bromeadow Clicker — poke the face, earn Broms, buy increasingly
   unreasonable things. Renders into #bromeadow. Progress is saved to
   localStorage and keeps ticking (at half speed) while the tab is closed. */
(function () {
  'use strict';

  var root = document.getElementById('bromeadow');
  if (!root) return;
  var FACE = root.getAttribute('data-face');

  var SAVE_KEY = 'mr-bromeadow-v1';
  var GROWTH = 1.15;
  var OFFLINE_CAP_S = 8 * 3600;
  var OFFLINE_RATE = 0.5;
  var ACH_BONUS = 0.02; // +2% production per achievement

  // ---------- numbers ----------

  var SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
  var WORDS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion'];
  function scaled(n) {
    var i = Math.floor(Math.log10(n) / 3);
    var v = n / Math.pow(10, i * 3);
    if (v >= 999.995) { i += 1; v = n / Math.pow(10, i * 3); }
    return { i: i, v: v };
  }
  function trim(v) { return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0); }
  function fmt(n, dec) {
    if (!isFinite(n)) return 'lots';
    if (n < 1000) return dec ? String(Math.round(n * 10) / 10) : String(Math.floor(n));
    var s = scaled(n);
    if (s.i >= SHORT.length) return n.toExponential(2).replace('e+', 'e');
    return trim(s.v) + SHORT[s.i];
  }
  function fmtWords(n) {
    if (!isFinite(n)) return 'lots';
    if (n < 1e6) return Math.floor(n).toLocaleString('en-GB');
    var s = scaled(n);
    if (s.i >= WORDS.length) return n.toExponential(3).replace('e+', ' × 10^');
    return trim(s.v) + ' ' + WORDS[s.i];
  }
  function fmtTime(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + Math.floor(s % 60) + 's';
    return Math.floor(s) + 's';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- content ----------

  var PRODUCERS = [
    { id: 'spool',   icon: '🧵', name: 'Thread Spool',        cost: 15,     cps: 0.1,    desc: 'Slowly unwinds. Slowly earns. Mr Bromeadow approves of slowly.' },
    { id: 'smirk',   icon: '😏', name: 'Knowing Smirk',       cost: 100,    cps: 1,      desc: 'He knows something. Nobody knows what. It pays.' },
    { id: 'sewing',  icon: '🪡', name: 'Sewing Machine',      cost: 1100,   cps: 8,      desc: 'Hems trousers for profit. Mostly his own.' },
    { id: 'shirt',   icon: '👕', name: 'Maroon Shirt Mill',   cost: 12000,  cps: 47,     desc: 'Only one colour. Only one cut. Absolute volume.' },
    { id: 'curtain', icon: '🪟', name: 'Net Curtain Network', cost: 130000, cps: 260,    desc: 'Curtains twitch across the nation. Information is currency.' },
    { id: 'fanclub', icon: '📣', name: 'Fan Club',            cost: 1.4e6,  cps: 1400,   desc: 'Membership is mandatory. Dues are paid in Broms.' },
    { id: 'shoulder',icon: '👀', name: 'Over-the-Shoulder Look', cost: 2e7, cps: 7800,   desc: 'Perfected over decades. Bankable in every jurisdiction.' },
    { id: 'clone',   icon: '🧬', name: 'Bromeadow Clone Vat', cost: 3.3e8,  cps: 44000,  desc: 'Each clone is equally unimpressed. Productivity is unaffected.' },
    { id: 'statue',  icon: '🗿', name: 'Giant Bust',          cost: 5.1e9,  cps: 260000, desc: 'A forty-metre Bromeadow head. Tourists pay to be glanced at.' },
    { id: 'multi',   icon: '🌌', name: 'Bromeadowverse',      cost: 7.5e10, cps: 1.6e6,  desc: 'Every timeline. Every universe. Same smirk.' }
  ];
  var PBY = {};
  PRODUCERS.forEach(function (p) { PBY[p.id] = p; });

  var TIERS = [
    { need: 1,   mult: 10,    adj: 'Polished' },
    { need: 10,  mult: 100,   adj: 'Turbo' },
    { need: 25,  mult: 2000,  adj: 'Bespoke' },
    { need: 50,  mult: 1e5,   adj: 'Legendary' },
    { need: 100, mult: 1e7,   adj: 'Cosmic' }
  ];

  var UPGRADES = [];
  PRODUCERS.forEach(function (p) {
    TIERS.forEach(function (t, i) {
      UPGRADES.push({
        id: p.id + '-' + i, icon: p.icon, name: t.adj + ' ' + p.name,
        cost: p.cost * t.mult, desc: p.name + ' production ×2.',
        unlocked: function (s) { return (s.owned[p.id] || 0) >= t.need; },
        kind: 'prod', target: p.id
      });
    });
  });
  [
    [100, 'Firmer Poke', 1], [600, 'Two-Finger Technique', 1], [8000, 'Forehead Flick', 50],
    [9e4, 'The Double Tap', 200], [5e6, 'Professional Poker', 1000], [5e8, 'Finger of Fate', 3000], [5e10, 'The Divine Prod', 6000]
  ].forEach(function (c, i) {
    UPGRADES.push({
      id: 'click-' + i, icon: '👆', name: c[1], cost: c[0], desc: 'Pokes are twice as strong.',
      unlocked: function (s) { return s.clicks >= c[2]; }, kind: 'click'
    });
  });
  [[5e4, 'Smug Aura'], [5e6, 'Raised Eyebrow'], [5e8, 'Quiet Confidence'], [5e10, 'Unshakeable Calm']].forEach(function (c, i) {
    UPGRADES.push({
      id: 'cps-click-' + i, icon: '✨', name: c[1], cost: c[0], desc: 'Each poke also earns 1% of your Broms per second.',
      unlocked: function (s) { return s.total >= c[0] / 4; }, kind: 'clickcps'
    });
  });
  [[1e6, 'Maroon Is The New Black'], [1e8, 'Sewing Circle Sponsorship'], [1e10, 'Mr Bromeadow Day'], [1e12, 'Bromeadow Studies (BA Hons)']].forEach(function (c, i) {
    UPGRADES.push({
      id: 'global-' + i, icon: '🏆', name: c[1], cost: c[0], desc: 'All production +25%.',
      unlocked: function (s) { return s.total >= c[0] / 4; }, kind: 'global'
    });
  });
  UPGRADES.push({ id: 'shiny-0', icon: '🌟', name: 'Polished Forehead', cost: 7.7e5, desc: 'Shiny Bromeadows appear twice as often.', unlocked: function (s) { return s.shinies >= 3; }, kind: 'shiny' });
  UPGRADES.push({ id: 'shiny-1', icon: '🌟', name: 'Lingering Glance', cost: 7.7e7, desc: 'Shiny Bromeadows stay twice as long.', unlocked: function (s) { return s.shinies >= 7; }, kind: 'shinylong' });
  var UBY = {};
  UPGRADES.forEach(function (u) { UBY[u.id] = u; });

  var ACHIEVEMENTS = [
    ['First Contact', 'Poke Mr Bromeadow once.', function (s) { return s.clicks >= 1; }],
    ['Persistent', 'Poke him 100 times.', function (s) { return s.clicks >= 100; }],
    ['He Felt That', 'Poke him 1,000 times.', function (s) { return s.clicks >= 1000; }],
    ['Restraining Order', 'Poke him 5,000 times.', function (s) { return s.clicks >= 5000; }],
    ['Pocket Money', 'Earn 1,000 Broms in total.', function (s) { return s.total >= 1e3; }],
    ['Bromillionaire', 'Earn 1 million Broms.', function (s) { return s.total >= 1e6; }],
    ['Brombillionaire', 'Earn 1 billion Broms.', function (s) { return s.total >= 1e9; }],
    ['Too Many Broms', 'Earn 1 trillion Broms.', function (s) { return s.total >= 1e12; }],
    ['Heat Death', 'Earn 1 quadrillion Broms.', function (s) { return s.total >= 1e15; }],
    ['Haberdasher', 'Own 50 Thread Spools.', function (s) { return (s.owned.spool || 0) >= 50; }],
    ['Smirk Collector', 'Own 50 Knowing Smirks.', function (s) { return (s.owned.smirk || 0) >= 50; }],
    ['Clone Wars', 'Own a Bromeadow Clone Vat.', function (s) { return (s.owned.clone || 0) >= 1; }],
    ['All Of Him', 'Own a Bromeadowverse.', function (s) { return (s.owned.multi || 0) >= 1; }],
    ['Ooh, Shiny', 'Catch a Shiny Bromeadow.', function (s) { return s.shinies >= 1; }],
    ['Shiny Hunter', 'Catch 10 Shiny Bromeadows.', function (s) { return s.shinies >= 10; }],
    ['Industrialist', 'Reach 1,000 Broms per second.', function (s) { return cps() >= 1e3; }],
    ['Engine Of Smug', 'Reach 1 million Broms per second.', function (s) { return cps() >= 1e6; }],
    ['Upgraded', 'Buy 10 upgrades.', function (s) { return s.upgrades.length >= 10; }],
    ['Fully Bespoke', 'Buy 40 upgrades.', function (s) { return s.upgrades.length >= 40; }],
    ['It\'s Spreading', 'Make Mr Bromeadow copy himself.', function (s) { return mutStage(s.clicks) >= 2; }],
    ['Do Not Look Directly At Him', 'Open the third eye.', function (s) { return mutStage(s.clicks) >= 6; }],
    ['What Have You Done', 'Reach Eldritch Bromeadow.', function (s) { return mutStage(s.clicks) >= 9; }],
    ['The Iron Finger', 'Hold on. Just... hold on.', function (s) { return s.secret >= 1; }, true]
  ];

  var NEWS = [
    [0, 'Local man looks over his shoulder. Nation holds its breath.'],
    [0, 'Mr Bromeadow has seen your pokes. He has chosen not to comment.'],
    [0, 'Experts agree: that is, technically, a smile.'],
    [10, 'A single thread spool changes hands. Haberdashery analysts "cautiously optimistic".'],
    [100, 'Mr Bromeadow raises an eyebrow. By about a millimetre.'],
    [500, 'Sewing machine heard humming at 3am. Mr Bromeadow: "It does that."'],
    [2000, 'National maroon shirt shortage enters its second week.'],
    [10000, 'Neighbours report net curtains "twitching with purpose".'],
    [50000, 'Mr Bromeadow Fan Club membership card now accepted at most supermarkets.'],
    [2e5, 'Study finds 9 in 10 people feel "faintly judged" by the Bromeadow look.'],
    [1e6, 'BREAKING: A million Broms. Mr Bromeadow reportedly "fine with it".'],
    [5e6, 'Haircut prices plummet as nation adopts the Bromeadow Short Back & Sides.'],
    [3e7, 'Clone #4,117 asks for a day off. Request declined by Clone #4,118.'],
    [2e8, 'Scientists confirm the smirk can be seen from the International Space Station.'],
    [1e9, 'Bank of England considers replacing the pound with the Brom. Mr Bromeadow shrugs.'],
    [1e10, 'Giant Bust #3 erected overnight. Pigeons unsure how to feel.'],
    [1e11, 'A new constellation has been named "The Glance".'],
    [1e12, 'In a parallel universe, Mr Bromeadow is poking YOUR face. He seems to be enjoying it.'],
    [1e14, 'The universe now runs on Broms. Physics departments cancel all lectures.']
  ];

  // ---------- mutation ----------
  // Pokes feed a mutation level. Each stage adds +10% production and makes
  // Mr Bromeadow a little less Mr Bromeadow.
  var MUTATIONS = [
    [0,    'Mr Bromeadow',        ''],
    [40,   'Slightly Swollen',    'He seems... bigger? Keep poking.'],
    [120,  'Bromeadow ×2',        'He has started copying himself.'],
    [250,  'Bulging',             'Something is happening with the eyes.'],
    [450,  'Wobbly',              'His face has lost structural integrity.'],
    [750,  'The Swarm',           'There are a lot of him now.'],
    [1150, 'Third Eye Open',      'He can see your browser history.'],
    [1700, 'Melting',             'Mr Bromeadow is becoming a liquid.'],
    [2500, 'The Bromass',         'One face. Many faces. All faces.'],
    [3600, 'Eldritch Bromeadow',  'Ph\'nglui mglw\'nafh Bromeadow.']
  ];
  var MUT_BONUS = 0.1;
  var MUT_NEWS = [
    [1, 'Witnesses describe Mr Bromeadow as "puffier than usual".'],
    [2, 'Second Mr Bromeadow spotted. Both deny everything.'],
    [3, 'Optician reports "unprecedented" eye measurements.'],
    [4, 'Mr Bromeadow\'s face now classified as a non-Newtonian fluid.'],
    [5, 'Town council asks residents to stop counting the Bromeadows.'],
    [6, 'The third eye has started blinking out of sync. Experts uneasy.'],
    [7, 'Mr Bromeadow politely asks for a mop.'],
    [8, 'The Bromass has applied for planning permission.'],
    [9, 'IT IS TOO LATE TO STOP POKING.'],
    [9, 'The faces are humming. It sounds a bit like a sewing machine.']
  ];
  function mutStage(clicks) {
    var st = 0;
    for (var i = 0; i < MUTATIONS.length; i++) if (clicks >= MUTATIONS[i][0]) st = i;
    return st;
  }
  // continuous level: stage + progress towards the next one
  function mutLevel(clicks) {
    var st = mutStage(clicks), lo = MUTATIONS[st][0];
    var hi = st + 1 < MUTATIONS.length ? MUTATIONS[st + 1][0] : lo * 2;
    return Math.min(st + (clicks - lo) / (hi - lo), MUTATIONS.length);
  }

  // ---------- state ----------

  function fresh() {
    return { broms: 0, total: 0, clicks: 0, clickEarned: 0, shinies: 0, owned: {}, upgrades: [], ach: [], started: Date.now(), last: Date.now(), sound: true, mutate: true, mstage: 0, secret: 0 };
  }
  var S = fresh();
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      var loaded = JSON.parse(raw);
      for (var k in loaded) if (Object.prototype.hasOwnProperty.call(S, k)) S[k] = loaded[k];
    }
  } catch (e) { /* no storage: play without saving */ }
  function save() {
    S.last = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  var buffs = []; // {kind, mult, until, label}
  function has(id) { return S.upgrades.indexOf(id) >= 0; }
  function count(kind) { var n = 0; S.upgrades.forEach(function (id) { if (UBY[id] && UBY[id].kind === kind) n++; }); return n; }
  function buffMult(kind) {
    var m = 1, now = Date.now();
    buffs.forEach(function (b) { if (b.kind === kind && b.until > now) m *= b.mult; });
    return m;
  }
  function prodMult(id) { var n = 0; S.upgrades.forEach(function (u) { if (UBY[u] && UBY[u].kind === 'prod' && UBY[u].target === id) n++; }); return Math.pow(2, n); }
  function globalMult() { return Math.pow(1.25, count('global')) * (1 + ACH_BONUS * S.ach.length) * (1 + MUT_BONUS * mutStage(S.clicks)); }
  function producerCps(p) { return (S.owned[p.id] || 0) * p.cps * prodMult(p.id) * globalMult(); }
  function baseCps() { var t = 0; PRODUCERS.forEach(function (p) { t += producerCps(p); }); return t; }
  function cps() { return baseCps() * buffMult('cps'); }
  function clickValue() { return (Math.pow(2, count('click')) + cps() * 0.01 * count('clickcps')) * buffMult('click'); }
  function costOf(p, n) {
    var o = S.owned[p.id] || 0;
    return p.cost * Math.pow(GROWTH, o) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1);
  }
  function maxAffordable(p) {
    var o = S.owned[p.id] || 0, c = p.cost * Math.pow(GROWTH, o);
    var n = Math.floor(Math.log(S.broms * (GROWTH - 1) / c + 1) / Math.log(GROWTH));
    return Math.max(0, n);
  }
  function earn(n) { S.broms += n; S.total += n; }

  // ---------- sound ----------

  var actx = null;
  function blip(freq, dur, type, vol) {
    if (!S.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(vol || 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + dur);
    } catch (e) {}
  }

  // ---------- DOM ----------

  // Magnifier patches over parts of the photo (positions as fractions of the
  // image). src = which pixels to show, dst = where to put them.
  var FEATURES = [
    { cls: 'eye',   src: [0.285, 0.57], dst: [0.285, 0.57], w: 0.2 },
    { cls: 'eye',   src: [0.486, 0.50], dst: [0.486, 0.50], w: 0.2 },
    { cls: 'eye3',  src: [0.486, 0.50], dst: [0.40, 0.30],  w: 0.18 },
    { cls: 'mouth', src: [0.42, 0.80],  dst: [0.42, 0.80],  w: 0.3 }
  ];
  function featureHtml(f) {
    var l = (f.dst[0] - f.w / 2) * 100, t = (f.dst[1] - f.w / 2) * 100;
    var il = -(f.src[0] - f.w / 2) / f.w * 100, it = -(f.src[1] - f.w / 2) / f.w * 100;
    return '<span class="mb-feat mb-' + f.cls + '" style="left:' + l + '%;top:' + t + '%;width:' + f.w * 100 + '%;height:' + f.w * 100 + '%">' +
      '<img src="' + esc(FACE) + '" alt="" draggable="false" style="width:' + 100 / f.w + '%;left:' + il + '%;top:' + it + '%"></span>';
  }

  document.body.classList.add('mb-page');
  root.innerHTML =
    '<div class="mb">' +
      '<div class="mb-ticker" aria-live="polite"></div>' +
      '<div class="mb-main">' +
        '<section class="mb-stage">' +
          '<div class="mb-count"><span class="mb-num">0</span> <span class="mb-unit">Broms</span></div>' +
          '<div class="mb-rate">0 per second</div>' +
          '<div class="mb-clones" aria-hidden="true"></div>' +
          '<div class="mb-face-wrap">' +
            '<div class="mb-glow"></div>' +
            '<button class="mb-face" type="button" aria-label="Poke Mr Bromeadow">' +
              '<div class="mb-flesh"><img src="' + esc(FACE) + '" alt="" draggable="false">' + FEATURES.map(featureHtml).join('') + '</div>' +
            '</button>' +
          '</div>' +
          '<div class="mb-name">Mr Bromeadow</div>' +
          '<div class="mb-mut"><div class="mb-mut-bar"><span></span></div><div class="mb-mut-label"></div></div>' +
          '<div class="mb-buffs"></div>' +
        '</section>' +
        '<section class="mb-side">' +
          '<div class="mb-tabs" role="tablist">' +
            '<button class="mb-tab" role="tab" data-tab="shop" aria-selected="true">Shop</button>' +
            '<button class="mb-tab" role="tab" data-tab="upg" aria-selected="false">Upgrades <span class="mb-badge" hidden></span></button>' +
            '<button class="mb-tab" role="tab" data-tab="stats" aria-selected="false">Stats</button>' +
          '</div>' +
          '<div class="mb-pane" data-pane="shop">' +
            '<div class="mb-modes">Buy: <button data-mode="1" class="on">×1</button><button data-mode="10">×10</button><button data-mode="100">×100</button><button data-mode="max">Max</button></div>' +
            '<div class="mb-shop"></div>' +
          '</div>' +
          '<div class="mb-pane" data-pane="upg" hidden><div class="mb-upgrades"></div><p class="mb-empty">Keep poking. Upgrades appear as you progress.</p></div>' +
          '<div class="mb-pane" data-pane="stats" hidden><div class="mb-stats"></div><h3>Achievements <span class="mb-achcount"></span></h3><div class="mb-achs"></div>' +
            '<div class="mb-foot"><button class="mb-sound"></button> <button class="mb-mutate"></button> <button class="mb-reset">Reset game</button></div></div>' +
        '</section>' +
      '</div>' +
      '<div class="mb-toasts" aria-live="polite"></div>' +
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="mb-warp" x="-15%" y="-15%" width="130%" height="130%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="n"><animate attributeName="baseFrequency" dur="9s" values="0.009;0.02;0.009" repeatCount="indefinite"/></feTurbulence>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter></svg>' +
    '</div>';

  function $(sel) { return root.querySelector(sel); }
  var elNum = $('.mb-num'), elRate = $('.mb-rate'), elFace = $('.mb-face'), elWrap = $('.mb-face-wrap');
  var elTicker = $('.mb-ticker'), elBuffs = $('.mb-buffs'), elShop = $('.mb-shop'), elUpg = $('.mb-upgrades');
  var elStats = $('.mb-stats'), elAchs = $('.mb-achs'), elToasts = $('.mb-toasts'), elBadge = $('.mb-badge');
  var mode = '1';
  var elStage = $('.mb-stage'), elClones = $('.mb-clones'), elFlesh = $('.mb-flesh'), elName = $('.mb-name');
  var elMutBar = $('.mb-mut-bar span'), elMutLabel = $('.mb-mut-label'), elDisp = root.querySelector('feDisplacementMap');
  var elEyes = root.querySelectorAll('.mb-eye'), elEye3 = $('.mb-eye3'), elMouth = $('.mb-mouth');

  // shop rows
  var rows = {};
  PRODUCERS.forEach(function (p) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mb-row';
    b.innerHTML = '<span class="mb-icon">' + p.icon + '</span>' +
      '<span class="mb-info"><span class="mb-pname"></span><span class="mb-desc"></span></span>' +
      '<span class="mb-right"><span class="mb-owned">0</span><span class="mb-cost"></span></span>';
    b.addEventListener('click', function () { buyProducer(p); });
    elShop.appendChild(b);
    rows[p.id] = { el: b, name: b.querySelector('.mb-pname'), desc: b.querySelector('.mb-desc'), owned: b.querySelector('.mb-owned'), cost: b.querySelector('.mb-cost') };
  });

  function buyCount(p) {
    if (mode === 'max') return Math.max(1, maxAffordable(p));
    return +mode;
  }
  function buyProducer(p) {
    var n = buyCount(p), c = costOf(p, n);
    if (c > S.broms) return;
    S.broms -= c;
    S.owned[p.id] = (S.owned[p.id] || 0) + n;
    blip(520, 0.12, 'triangle', 0.05);
    refreshUpgrades();
    update();
  }

  root.querySelectorAll('.mb-modes button').forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      root.querySelectorAll('.mb-modes button').forEach(function (x) { x.classList.toggle('on', x === b); });
      update();
    });
  });
  root.querySelectorAll('.mb-tab').forEach(function (t) {
    t.addEventListener('click', function () {
      var name = t.getAttribute('data-tab');
      root.querySelectorAll('.mb-tab').forEach(function (x) { x.setAttribute('aria-selected', x === t ? 'true' : 'false'); });
      root.querySelectorAll('.mb-pane').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== name; });
      if (name === 'stats') renderStats();
    });
  });

  // upgrades
  var shownUpgrades = '';
  function availableUpgrades() {
    return UPGRADES.filter(function (u) { return !has(u.id) && u.unlocked(S); }).sort(function (a, b) { return a.cost - b.cost; });
  }
  function refreshUpgrades() {
    var list = availableUpgrades();
    var key = list.map(function (u) { return u.id; }).join(',');
    if (key === shownUpgrades) return;
    shownUpgrades = key;
    elUpg.innerHTML = '';
    list.forEach(function (u) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mb-upg';
      b.setAttribute('data-id', u.id);
      b.innerHTML = '<span class="mb-icon">' + u.icon + '</span><span class="mb-info"><span class="mb-pname">' + esc(u.name) + '</span><span class="mb-desc">' + esc(u.desc) + '</span></span><span class="mb-cost">' + fmt(u.cost) + '</span>';
      b.addEventListener('click', function () {
        if (S.broms < u.cost || has(u.id)) return;
        S.broms -= u.cost;
        S.upgrades.push(u.id);
        blip(880, 0.2, 'triangle', 0.06);
        toast(u.icon + ' ' + u.name);
        refreshUpgrades();
        update();
      });
      elUpg.appendChild(b);
    });
    $('.mb-empty').hidden = list.length > 0;
  }

  // ---------- poking ----------

  function addPokes(n) {
    var v = clickValue() * n;
    earn(v);
    S.clicks += n;
    S.clickEarned += v;
    var st = mutStage(S.clicks);
    if (st > S.mstage) {
      S.mstage = st;
      var m = MUTATIONS[st];
      toast('🧬 Mutation: ' + m[1] + '! ' + m[2] + ' (+' + Math.round(MUT_BONUS * 100) + '% production)', true);
      blip(220, 0.5, 'sawtooth', 0.04);
      setTimeout(function () { blip(150, 0.6, 'sawtooth', 0.04); }, 180);
      var mb = root.querySelector('.mb');
      mb.classList.remove('shake'); void mb.offsetWidth; mb.classList.add('shake');
    }
    return v;
  }
  function poke(x, y) {
    var v = addPokes(1);
    blip(300 + Math.random() * 120, 0.08, 'sine', 0.05);
    elFace.classList.remove('boop');
    void elFace.offsetWidth;
    elFace.classList.add('boop');
    var r = elWrap.getBoundingClientRect();
    var px = x == null ? r.width / 2 : x - r.left, py = y == null ? r.height / 2 : y - r.top;
    var f = document.createElement('span');
    f.className = 'mb-float';
    f.textContent = '+' + fmt(v, true);
    f.style.left = px + 'px';
    f.style.top = py + 'px';
    elWrap.appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
    for (var i = 0; i < 5; i++) {
      var c = document.createElement('span');
      c.className = 'mb-crumb';
      var a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 50;
      c.style.left = px + 'px';
      c.style.top = py + 'px';
      c.style.setProperty('--dx', Math.cos(a) * d + 'px');
      c.style.setProperty('--dy', Math.sin(a) * d + 'px');
      elWrap.appendChild(c);
      (function (el) { setTimeout(function () { el.remove(); }, 650); })(c);
    }
    update();
  }
  elFace.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    poke(e.clientX, e.clientY);
    startHold();
  });

  // ---------- secret: the Iron Finger ----------
  // Hold the poke down for 10 seconds and every half second after that is
  // worth 10 pokes (so it scales with your current poke strength).
  var HOLD_MS = 10000, RAPID_MS = 500, RAPID_MULT = 10;
  var holdTimer = null, rapidTimer = null;
  function startHold() {
    stopHold();
    holdTimer = setTimeout(function () {
      holdTimer = null;
      if (!S.secret) toast('🤫 Secret found: The Iron Finger! Keep holding for ' + RAPID_MULT + '× poke power every half second.', true, true);
      S.secret = (S.secret || 0) + 1;
      root.querySelector('.mb').classList.add('iron');
      rapid();
      rapidTimer = setInterval(rapid, RAPID_MS);
    }, HOLD_MS);
  }
  function rapid() {
    var v = addPokes(RAPID_MULT);
    blip(500 + Math.random() * 300, 0.06, 'square', 0.03);
    var f = document.createElement('span');
    f.className = 'mb-float mb-float-big';
    f.textContent = '+' + fmt(v, true) + ' (' + RAPID_MULT + '×)';
    f.style.left = (40 + Math.random() * 20) + '%';
    f.style.top = (35 + Math.random() * 20) + '%';
    elWrap.appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
    update();
  }
  function stopHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (rapidTimer) { clearInterval(rapidTimer); rapidTimer = null; }
    var mb = root.querySelector('.mb');
    if (mb) mb.classList.remove('iron');
  }
  window.addEventListener('pointerup', stopHold);
  window.addEventListener('pointercancel', stopHold);
  window.addEventListener('blur', stopHold);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopHold(); });
  elFace.addEventListener('click', function (e) { if (e.detail === 0) poke(); }); // keyboard
  elFace.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Shiny Bromeadow ----------

  var nextShiny = Date.now() + rand(40, 90) * 1000;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function spawnShiny() {
    var life = (has('shiny-1') ? 24 : 12) * 1000;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mb-shiny';
    b.setAttribute('aria-label', 'Shiny Bromeadow! Click it.');
    b.innerHTML = '<img src="' + esc(FACE) + '" alt="" draggable="false">';
    b.style.left = rand(5, 85) + 'vw';
    b.style.top = rand(15, 80) + 'vh';
    b.style.animationDuration = '1.6s, ' + life / 1000 + 's';
    document.body.appendChild(b);
    var gone = setTimeout(function () { b.remove(); }, life);
    b.addEventListener('click', function () {
      clearTimeout(gone);
      b.remove();
      S.shinies++;
      blip(660, 0.15, 'square', 0.04);
      setTimeout(function () { blip(990, 0.25, 'square', 0.04); }, 90);
      var roll = Math.random(), now = Date.now();
      if (roll < 0.45) {
        buffs.push({ kind: 'cps', mult: 7, until: now + 45000, label: 'Smirk Frenzy ×7' });
        toast('🌟 Smirk Frenzy! Production ×7 for 45s');
      } else if (roll < 0.85) {
        var gain = Math.min(S.broms * 0.15, cps() * 900) + 13;
        earn(gain);
        toast('🌟 Lucky glance! +' + fmt(gain) + ' Broms');
      } else {
        buffs.push({ kind: 'click', mult: 77, until: now + 13000, label: 'Poke Frenzy ×77' });
        toast('🌟 Poke Frenzy! Pokes ×77 for 13s');
      }
      update();
    });
  }

  // ---------- toasts, ticker, stats ----------

  function toast(msg, big, pin) {
    var t = document.createElement('div');
    t.className = 'mb-toast' + (big ? ' big' : '') + (pin ? ' pin' : '');
    t.textContent = msg;
    elToasts.appendChild(t);
    while (elToasts.children.length > 3) (elToasts.querySelector('.mb-toast:not(.big)') || elToasts.querySelector('.mb-toast:not(.pin)') || elToasts.firstChild).remove();
    setTimeout(function () { t.classList.add('out'); }, big ? 5500 : 3200);
    setTimeout(function () { t.remove(); }, big ? 6000 : 3700);
  }

  var lastNews = -1;
  function news() {
    var opts = [];
    NEWS.forEach(function (n, i) { if (S.total >= n[0]) opts.push(i); });
    var cnt = PRODUCERS.filter(function (p) { return S.owned[p.id]; });
    var pick, st = mutStage(S.clicks);
    if (st >= 1 && S.mutate && Math.random() < 0.35) {
      var mn = MUT_NEWS.filter(function (n) { return n[0] <= st; });
      elTicker.textContent = mn[Math.floor(Math.random() * mn.length)][1];
      return;
    }
    if (cnt.length && Math.random() < 0.25) {
      var p = cnt[Math.floor(Math.random() * cnt.length)];
      elTicker.textContent = 'Mr Bromeadow now owns ' + S.owned[p.id] + ' ' + p.name + (S.owned[p.id] === 1 ? '' : 's') + '. He has not asked why.';
      return;
    }
    do { pick = opts[Math.floor(Math.random() * opts.length)]; } while (opts.length > 1 && pick === lastNews);
    lastNews = pick;
    elTicker.textContent = NEWS[pick][1];
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach(function (a, i) {
      if (S.ach.indexOf(i) < 0 && a[2](S)) {
        S.ach.push(i);
        toast('🏅 Achievement: ' + a[0]);
      }
    });
  }

  function renderStats() {
    var played = (Date.now() - S.started) / 1000;
    var owned = 0;
    PRODUCERS.forEach(function (p) { owned += S.owned[p.id] || 0; });
    elStats.innerHTML = [
      ['Broms in the bank', fmtWords(S.broms)],
      ['Broms earned, all time', fmtWords(S.total)],
      ['Per second', fmt(cps(), true)],
      ['Per poke', fmt(clickValue(), true)],
      ['Pokes', S.clicks.toLocaleString('en-GB')],
      ['Broms from poking', fmtWords(S.clickEarned)],
      ['Things owned', owned.toLocaleString('en-GB')],
      ['Upgrades bought', S.upgrades.length + ' / ' + UPGRADES.length],
      ['Shiny Bromeadows caught', S.shinies],
      ['Achievement bonus', '+' + Math.round(ACH_BONUS * S.ach.length * 100) + '% production'],
      ['Mutation', MUTATIONS[mutStage(S.clicks)][1] + ' (+' + Math.round(MUT_BONUS * mutStage(S.clicks) * 100) + '% production)'],
      ['Playing for', fmtTime(played)]
    ].map(function (r) { return '<div class="mb-stat"><span>' + r[0] + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('');
    $('.mb-achcount').textContent = S.ach.length + ' / ' + ACHIEVEMENTS.length;
    elAchs.innerHTML = ACHIEVEMENTS.map(function (a, i) {
      var got = S.ach.indexOf(i) >= 0;
      if (a[3] && !got) return '<div class="mb-ach"><b>🔒 ???</b><span>A secret.</span></div>';
      return '<div class="mb-ach' + (got ? ' got' : '') + '" title="' + esc(a[1]) + '"><b>' + (got ? '🏅 ' : '🔒 ') + esc(a[0]) + '</b><span>' + esc(a[1]) + '</span></div>';
    }).join('');
    $('.mb-sound').textContent = S.sound ? '🔊 Sound on' : '🔇 Sound off';
    $('.mb-mutate').textContent = S.mutate ? '🧬 Mutations shown' : '🙂 Keep him normal';
  }
  $('.mb-mutate').addEventListener('click', function () { S.mutate = !S.mutate; save(); renderStats(); update(); });
  $('.mb-sound').addEventListener('click', function () { S.sound = !S.sound; save(); renderStats(); });
  $('.mb-reset').addEventListener('click', function () {
    if (!confirm('Reset everything? Mr Bromeadow will forget you ever met.')) return;
    S = fresh();
    buffs = [];
    shownLevel = -1;
    shownUpgrades = null;
    save();
    refreshUpgrades();
    renderStats();
    update();
  });

  // ---------- mutation visuals ----------

  var clones = [], shownLevel = -1;
  function ramp(L, from, to) { return Math.max(0, Math.min(1, (L - from) / (to - from))); }
  function addClone() {
    var c = document.createElement('button');
    c.type = 'button';
    c.tabIndex = -1;
    c.className = 'mb-clone';
    c.innerHTML = '<img src="' + esc(FACE) + '" alt="" draggable="false">';
    c.style.left = rand(2, 88) + '%';
    c.style.top = rand(2, 88) + '%';
    c.style.setProperty('--sz', rand(0.7, 1.3).toFixed(2));
    c.style.setProperty('--hue', Math.floor(rand(-60, 60)) + 'deg');
    c.style.setProperty('--flip', Math.random() < 0.5 ? -1 : 1);
    c.style.animationDuration = rand(2.5, 6).toFixed(1) + 's';
    c.style.animationDelay = (-rand(0, 5)).toFixed(1) + 's';
    c.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      poke(e.clientX, e.clientY);
      c.classList.remove('boop'); void c.offsetWidth; c.classList.add('boop');
    });
    elClones.appendChild(c);
    clones.push(c);
  }
  function renderMutation() {
    var L = S.mutate ? mutLevel(S.clicks) : 0;
    var st = mutStage(S.clicks);
    var next = MUTATIONS[st + 1];
    elName.textContent = st ? 'Mr Bromeadow · ' + MUTATIONS[st][1] : 'Mr Bromeadow';
    elMutBar.style.width = (next ? (S.clicks - MUTATIONS[st][0]) / (next[0] - MUTATIONS[st][0]) * 100 : 100) + '%';
    elMutLabel.textContent = next ? 'Mutation ' + st + '/' + (MUTATIONS.length - 1) + ' · ' + (next[0] - S.clicks) + ' pokes to the next' : 'Fully mutated. There is no going back.';
    if (Math.abs(L - shownLevel) < 0.004) return;
    shownLevel = L;

    // 1. he grows a little with every poke
    var grow = 1 + 0.3 * Math.pow(Math.min(S.mutate ? S.clicks : 0, 2500) / 2500, 0.6);
    elWrap.style.setProperty('--grow', grow.toFixed(4));
    // 2. clones
    var want = L < 2 ? 0 : Math.min(28, Math.floor((L - 2) * 3.5) + 1);
    while (clones.length < want) addClone();
    while (clones.length > want) clones.pop().remove();
    elClones.style.setProperty('--csz', (1 + ramp(L, 5, 9) * 0.8).toFixed(3));
    // 3. eyes bulge, third eye opens, mouth stretches
    var bulge = 1 + ramp(L, 3, 9) * 1.3;
    elEyes.forEach(function (e) { e.style.transform = 'scale(' + bulge.toFixed(3) + ')'; });
    var e3 = ramp(L, 6, 6.6);
    elEye3.style.opacity = e3;
    elEye3.style.transform = 'scale(' + (e3 * bulge).toFixed(3) + ')';
    var mw = ramp(L, 7, 9);
    elMouth.style.transform = 'scale(' + (1 + mw * 1.2).toFixed(3) + ',' + (1 + mw * 0.5).toFixed(3) + ')';
    // 4. wobble, warp, colour
    elFlesh.style.setProperty('--sk', (ramp(L, 4, 9) * 9).toFixed(2) + 'deg');
    elFlesh.style.setProperty('--st', (ramp(L, 4, 9) * 0.14).toFixed(3));
    var warp = ramp(L, 4, 9) * 38;
    elDisp.setAttribute('scale', warp.toFixed(1));
    var hue = ramp(L, 7, 10) * 70, sat = 1 + ramp(L, 7, 10) * 0.8;
    var filt = (warp > 0.5 ? 'url(#mb-warp) ' : '') + (hue > 0.5 ? 'hue-rotate(' + hue.toFixed(0) + 'deg) saturate(' + sat.toFixed(2) + ')' : '');
    elFlesh.style.filter = filt || 'none';
    elClones.classList.toggle('warped', L >= 4);
    var mb = root.querySelector('.mb');
    mb.classList.toggle('mutating', L >= 4);
    mb.classList.toggle('eldritch', L >= 9);
  }

  // ---------- update loop ----------

  function update() {
    renderMutation();
    elNum.textContent = fmtWords(S.broms);
    var c = cps();
    elRate.textContent = fmt(c, true) + ' per second · ' + fmt(clickValue(), true) + ' per poke';
    document.title = fmt(S.broms) + ' Broms · Mr Bromeadow';
    var anyVisibleNext = false;
    PRODUCERS.forEach(function (p, i) {
      var r = rows[p.id], o = S.owned[p.id] || 0;
      var prevOwned = i === 0 || (S.owned[PRODUCERS[i - 1].id] || 0) > 0;
      var revealed = o > 0 || prevOwned || S.total >= p.cost * 0.5;
      var n = buyCount(p), cost = costOf(p, n);
      r.el.hidden = !revealed && anyVisibleNext;
      if (!revealed) anyVisibleNext = true;
      r.el.classList.toggle('mystery', !revealed);
      r.name.textContent = revealed ? p.name + (n > 1 ? ' ×' + n : '') : '???';
      r.desc.textContent = revealed ? (o ? fmt(producerCps(p), true) + '/s total · ' : '') + p.desc : 'Keep earning to find out.';
      r.owned.textContent = o;
      r.cost.textContent = fmt(cost);
      r.el.disabled = cost > S.broms;
    });
    var list = availableUpgrades(), affordable = 0;
    list.forEach(function (u) { if (u.cost <= S.broms) affordable++; });
    elUpg.querySelectorAll('.mb-upg').forEach(function (b) { b.disabled = UBY[b.getAttribute('data-id')].cost > S.broms; });
    elBadge.hidden = !affordable;
    elBadge.textContent = affordable;
    var now = Date.now();
    buffs = buffs.filter(function (b) { return b.until > now; });
    elBuffs.innerHTML = buffs.map(function (b) { return '<span class="mb-buff">' + esc(b.label) + ' · ' + Math.ceil((b.until - now) / 1000) + 's</span>'; }).join('');
    root.querySelector('.mb').classList.toggle('frenzy', buffs.length > 0);
  }

  var lastTick = performance.now(), sinceSlow = 0;
  function tick() {
    var t = performance.now(), dt = Math.min((t - lastTick) / 1000, 1);
    lastTick = t;
    if (Date.now() - S.last > 60000) offline();
    S.last = Date.now();
    earn(cps() * dt);
    sinceSlow += dt;
    if (sinceSlow >= 0.25) {
      sinceSlow = 0;
      update();
      refreshUpgrades();
      checkAchievements();
      if (Date.now() > nextShiny && !document.hidden) {
        spawnShiny();
        var mult = has('shiny-0') ? 0.5 : 1;
        nextShiny = Date.now() + rand(60, 180) * 1000 * mult;
      }
    }
  }
  setInterval(tick, 50);
  setInterval(news, 9000);
  setInterval(save, 10000);
  setInterval(function () { if (!root.querySelector('[data-pane="stats"]').hidden) renderStats(); }, 1000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) save();
  });
  window.addEventListener('pagehide', save);

  // offline earnings: a wall-clock gap between ticks (tab closed or frozen)
  function offline() {
    var away = (Date.now() - S.last) / 1000;
    if (away < 60) return;
    var gain = baseCps() * Math.min(away, OFFLINE_CAP_S) * OFFLINE_RATE;
    S.last = Date.now();
    if (gain >= 1) {
      earn(gain);
      toast('While you were away (' + fmtTime(away) + '), Mr Bromeadow earned ' + fmt(gain) + ' Broms.');
    }
  }

  S.mstage = Math.max(S.mstage || 0, mutStage(S.clicks));
  offline();
  refreshUpgrades();
  update();
  news();
})();
