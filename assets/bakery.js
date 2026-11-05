/* Tiny Bakery — an idle game about bread and mild despair.
   Everything is rendered from this file into #bakery. State is saved to
   localStorage; progress continues (at half speed) while the tab is closed. */
(function () {
  'use strict';

  var root = document.getElementById('bakery');
  if (!root) return;

  var SAVE_KEY = 'tiny-bakery-v1';
  var GROWTH = 1.15;
  var OFFLINE_CAP_S = 8 * 3600;
  var OFFLINE_RATE = 0.5;
  var OFFLINE_GAP_S = 90;       // a gap longer than this between ticks counts as "away"
  var BRANCH_THRESHOLD = 1e6;   // loaves in one run before a branch is worth opening
  var BRANCH_BONUS = 0.1;       // +10% production per branch

  // ---------- number formatting ----------

  var SHORT = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td', 'Qad', 'Qid', 'Sxd', 'Spd', 'Ocd', 'Nod', 'Vg'];
  var WORDS = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];

  function scaled(n) {
    var i = Math.floor(Math.log10(n) / 3);
    var v = n / Math.pow(10, i * 3);
    if (v >= 999.995) { i += 1; v = n / Math.pow(10, i * 3); }
    return { i: i, v: v };
  }
  function trim(v) { return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0); }

  // compact form for buttons and rates
  function fmt(n, decimals) {
    if (!isFinite(n)) return 'lots';
    if (n < 1000) return decimals ? String(Math.round(n * 10) / 10) : String(Math.floor(n));
    var s = scaled(n);
    if (s.i >= SHORT.length) return n.toExponential(2).replace('e+', 'e');
    return trim(s.v) + SHORT[s.i];
  }
  // spelled-out form for the headline counter: "4.52 octillion"
  function fmtWords(n) {
    if (!isFinite(n)) return 'lots';
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    var s = scaled(n);
    if (s.i >= WORDS.length) return n.toExponential(3).replace('e+', ' x 10^');
    return trim(s.v) + ' ' + WORDS[s.i];
  }
  function fmtTime(s) {
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm';
    return Math.floor(s) + 's';
  }

  // ---------- pixel sprites ----------

  var PAL = { k: '#2b1810', b: '#b5651d', l: '#e0a458', c: '#f6e3b4', w: '#ffffff', r: '#c0392b', g: '#4e9f3d', y: '#f2c230', s: '#9aa5b1', d: '#5b6770', p: '#e8a0a0', u: '#3b6ea5', o: '#e67e22', n: '#7a4a2b', v: '#6c3fa0', m: '#1b1530' };

  function sprite(rows, px) {
    var w = 0, rects = '', x, y;
    for (y = 0; y < rows.length; y++) w = Math.max(w, rows[y].length);
    for (y = 0; y < rows.length; y++) {
      for (x = 0; x < rows[y].length; x++) {
        var col = PAL[rows[y].charAt(x)];
        if (col) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + col + '"/>';
      }
    }
    return '<svg class="bk-sprite" viewBox="0 0 ' + w + ' ' + rows.length + '" width="' + (w * px) + '" height="' + (rows.length * px) + '" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  var LOAF = [
    '................',
    '.....kkkkkk.....',
    '...kkllllllkk...',
    '..kllbllbllllk..',
    '.klllllllllllbk.',
    '.klbllllbllllbk.',
    '.kllllllllllllk.',
    '.kllllllllllbbk.',
    '.kbllllllllbbbk.',
    '..kbbbbbbbbbbk..',
    '...kkkkkkkkkk...',
    '................'
  ];
  var S_CUSTOMER = ['..nnnn..', '.nnnnnn.', '..pppp..', '.pkppkp.', '.pppppp.', '..pkkp..', '.rrrrrr.', '.rrrrrr.'];
  var S_PIGEON = ['........', '..ss....', '.ssks...', '.sssyy..', 'sssss...', '.ssss...', '..y.y...', '........'];
  var S_INSPECTOR = ['.kkkkkk.', 'kkkkkkkk', '..pppp..', '.pkppkp.', '..pppp..', '.kwwwwk.', '.kwkkwk.', '..d..d..'];

  // ---------- game data ----------

  var BUILDINGS = [
    { name: 'Intern', plural: 'Interns', cost: 15, cps: 0.2, blurb: "Holds the mitt. That's the job.",
      art: ['...rrr..', '.r.rrr..', 'rrrrrrr.', 'rrrrrrr.', '.rrrrrr.', '..rrrr..', '..wwww..', '..wwww..'] },
    { name: 'Sourdough Starter', plural: 'Sourdough Starters', cost: 100, cps: 1, blurb: 'Named Gerald. Bubbles with opinions.',
      art: ['..kkkk..', '..cccc..', '.kkkkkk.', '.kwwwwk.', '.kwcwwk.', '.kwwcwk.', '.kwwwwk.', '..kkkk..'] },
    { name: 'Countertop Oven', plural: 'Countertop Ovens', cost: 1100, cps: 8, blurb: 'Smells wonderful. Sounds worrying.',
      art: ['kkkkkkkk', 'ksksskks', 'kddddddk', 'kdyyyydk', 'kdyoyydk', 'kdyyyydk', 'kddddddk', 'kkkkkkkk'] },
    { name: 'Unpaid Apprentice', plural: 'Unpaid Apprentices', cost: 12000, cps: 47, blurb: 'Paid in exposure. Unfortunately, so is everyone.',
      art: ['..wwww..', '..wwww..', '...pp...', '..pkkp..', '...pp...', '.wwwwww.', '.wwwwww.', '..u..u..'] },
    { name: 'Industrial Mixer', plural: 'Industrial Mixers', cost: 130000, cps: 260, blurb: "It has a setting called 'Menace'.",
      art: ['...ss...', '...ss...', '..kssk..', '.kddddk.', 'kdccccdk', 'kdccccdk', '.kddddk.', '..kkkk..'] },
    { name: 'Bread Conveyor', plural: 'Bread Conveyors', cost: 1.4e6, cps: 1400, blurb: 'A loaf goes in. Many loaves come out. Somehow.',
      art: ['........', '..bb.bb.', '.bbbbbbb', 'kkkkkkkk', 'sdsdsdsd', 'kkkkkkkk', '.d....d.', '.d....d.'] },
    { name: 'Wheat Field Annex', plural: 'Wheat Field Annexes', cost: 2e7, cps: 7800, blurb: 'Legally an annex. Spiritually a county.',
      art: ['.y..y..y', 'yyyyyyyy', '.g..g..g', '.g..g..g', '.g..g..g', '.g..g..g', 'gggggggg', 'kkkkkkkk'] },
    { name: 'Temporal Proofing Chamber', plural: 'Temporal Proofing Chambers', cost: 3.3e8, cps: 44000, blurb: 'Bakes bread slightly before you ask for it.',
      art: ['..kkkk..', '.kuuuuk.', 'kuuwwuuk', 'kuuwwuuk', 'kuwwuuuk', 'kuuuuuuk', '.kuuuuk.', '..kkkk..'] },
    { name: 'Orbital Bakery', plural: 'Orbital Bakeries', cost: 5.1e9, cps: 260000, blurb: 'Zero gravity. Perfect crumb. Constant crumbs.',
      art: ['..y..y..', '........', 'ss.kk.ss', 'ssukkuss', 'ss.kk.ss', '........', '..y..y..', '........'] },
    { name: 'Dyson Oven', plural: 'Dyson Ovens', cost: 7.5e10, cps: 1.6e6, blurb: 'Surrounds a star. Preheats in a decade.',
      art: ['..oooo..', '.oyyyyo.', 'oyyoyyyo', 'oyoooyyo', 'oyyoyyyo', 'oyyyyyyo', '.oyyyyo.', '..oooo..'] },
    { name: 'Galactic Yeast Cartel', plural: 'Galactic Yeast Cartels', cost: 1.2e12, cps: 1e7, blurb: 'They rise. That is the whole threat.',
      art: ['m.m.m.m.', '.mvvvvm.', 'mvvwvwvm', 'mvvvvvvm', 'mvkkkkvm', '.mvvvvm.', 'm.m..m.m', '........'] },
    { name: 'Universal Loaf Compiler', plural: 'Universal Loaf Compilers', cost: 2e13, cps: 6.5e7, blurb: 'Reads the laws of physics as a recipe.',
      art: ['kkkkkkkk', 'kgggggk.', 'kgkggggk', 'kggkgggk', 'kgggkggk', 'kggggkgk', 'kkkkkkkk', '..kkkk..'] },
    { name: 'Bread-Universe Conversion Engine', plural: 'Bread-Universe Conversion Engines', cost: 4e15, cps: 5e8, blurb: 'Turns everything else into bread. Everything.',
      art: ['..llll..', '.llbbll.', 'llbkkbll', 'lbkllkbl', 'lbkllkbl', 'llbkkbll', '.llbbll.', '..llll..'] }
  ];
  BUILDINGS.forEach(function (b, i) { b.id = i; });

  var BUILDING_UP_NAMES = [
    ['Oven Mitt Training Video', 'Mandatory Fun Hour', 'Employee Of The Month (Every Month)'],
    ['Warmer Windowsill', 'Motivational Podcasts For Gerald', 'Gerald Learns His Worth'],
    ['Lower The Smoke Alarm Volume', 'Second Rack, Same Heat', 'Oven Achieves Self-Awareness'],
    ['Free Apron', 'Exposure Bucks', 'Apprentice Becomes Slightly Less Of An Apprentice'],
    ['Bigger Bowl', 'Questionable Wiring', 'Mixer Mixes Mixer'],
    ['Faster Belt, Sorry About The Pigeons', 'Laminated Safety Poster', 'Belt Loops Back On Itself'],
    ['Scarecrow With A Clipboard', 'Farm Gossip Network', 'The Annex Annexes The Neighbours'],
    ["Proof Yesterday's Bread Today", "Proof Tomorrow's Bread Yesterday", 'Dough Exceeds Time Limit'],
    ['Slightly Larger Airlock', 'Crumb Collection Satellite', 'Station Becomes A Croissant'],
    ['Add A Second Star', 'Oven Mitt, Stellar Grade', 'Sun Files A Complaint'],
    ['Gentler Threats', 'Loyalty Cards, Interstellar', 'Cartel Goes Public'],
    ['Fewer Semicolons', 'Compile On Weekends', 'Compiler Compiles A Better Compiler'],
    ['Bigger Everything', 'Smaller Everything Else', 'Engine Reads The Manual']
  ];
  var TIERS = [{ own: 1, mult: 10 }, { own: 10, mult: 100 }, { own: 25, mult: 2500 }];

  var UPGRADES = [];
  BUILDINGS.forEach(function (b, i) {
    TIERS.forEach(function (t, j) {
      UPGRADES.push({ id: 'b' + i + '_' + j, name: BUILDING_UP_NAMES[i][j], desc: 'Doubles the output of ' + b.plural + '.', cost: b.cost * t.mult, type: 'building', target: i, own: t.own });
    });
  });
  UPGRADES.push(
    { id: 'c1', name: 'Slightly Better Spatula', desc: 'Clicking is twice as effective.', cost: 100, type: 'click', mult: 2, req: 50 },
    { id: 'c2', name: 'Wrist Brace (Unlicensed)', desc: 'Clicking is twice as effective.', cost: 5000, type: 'click', mult: 2, req: 2500 },
    { id: 'c3', name: 'Hands Of Dough', desc: 'Each click also bakes 1% of a second of production.', cost: 75000, type: 'kneed', req: 30000 },
    { id: 'g1', name: 'Hire A Cat', desc: 'All production +10%. The cat does nothing.', cost: 25000, type: 'global', mult: 1.1, req: 10000 },
    { id: 'g2', name: 'Hire A Second Cat', desc: 'All production +10%. Still nothing.', cost: 2.5e6, type: 'global', mult: 1.1, req: 1e6 },
    { id: 'g3', name: 'Cat Union', desc: 'All production +25%. Demands are modest. For now.', cost: 4e8, type: 'global', mult: 1.25, req: 1e8 },
    { id: 'g4', name: 'Cat Parliament', desc: 'All production +50%. Motions are mostly naps.', cost: 6e11, type: 'global', mult: 1.5, req: 1e11 },
    { id: 'g5', name: 'Cats, But Everywhere', desc: 'All production doubled. Nobody remembers hiring them.', cost: 8e14, type: 'global', mult: 2, req: 1e14 }
  );

  var MILESTONES = [
    [1, 'First loaf. It is bread. Congratulations.'],
    [100, "A customer asks for 'the usual'. You have no usual."],
    [1e3, 'A thousand loaves. The smoke alarm has been briefed.'],
    [1e4, "The local paper calls you 'ambitious'. They mean it as a warning."],
    [1e5, 'A bakery this size needs a business plan. You have a sandwich bag.'],
    [1e6, 'One million loaves. The town is experiencing bread-adjacent changes.'],
    [1e7, "The town's bread supply is now exclusively yours. Nobody voted on this."],
    [1e9, 'A billion loaves. Economists have started using your name as a verb.'],
    [1e12, 'Other bakeries have stopped returning your calls. Also existing.'],
    [1e15, 'The country has been informed that it is now a bread country.'],
    [1e18, 'Bread is legal tender. The central bank is asking questions.'],
    [1e21, 'The oceans are warm and slightly yeasty.'],
    [1e24, 'The Moon is a loaf now. You decide not to think about it.'],
    [1e27, 'The planet is 4% bread by mass. Gerald has opinions.'],
    [1e30, 'The Sun is being proofed.'],
    [1e33, 'Other civilizations have received your complimentary sample.'],
    [1e36, 'Galaxy-wide baguette incident. Insurance has declined to comment.'],
    [1e42, 'You are no longer sure what the bread is for. The bread is.'],
    [1e50, 'All matter within reach is bread or becoming bread.'],
    [1e60, 'The universe is a loaf. It is warm. You did this.']
  ];

  var IDLE_LINES = [
    'Gerald has been named employee of the month. Gerald is a jar.',
    'The bread rises. So do prices.',
    'A customer asks if the bread is gluten-free. You laugh for a while.',
    "Sales are up. Nobody knows why. Don't look into it.",
    "Someone left a one-star review: 'Too much bread.'",
    "The intern asks what the starter is for. We don't speak of it.",
    'Local pigeon population: concerning.',
    "Today's special: yesterday's special.",
    'You consider a career in pastries. The thought passes.',
    "A man in the shop says he is 'just here for the smell'. He stays six hours.",
    'Breadcrumbs are accumulating. This is normal.',
    'The oven makes a noise. You decide it is fine.'
  ];

  // ---------- state ----------

  function newState() {
    var now = Date.now();
    return { loaves: 0, runTotal: 0, total: 0, clicks: 0, b: {}, up: {}, branches: 0, runs: 0,
      buffs: { prod: { until: 0, mult: 1 }, click: { until: 0, mult: 1 } },
      seen: {}, log: [], started: now, saved: now };
  }
  var s = newState();

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      var d = JSON.parse(raw), base = newState();
      Object.keys(base).forEach(function (k) { if (d[k] !== undefined) base[k] = d[k]; });
      ['b', 'up', 'seen'].forEach(function (k) { if (!base[k] || typeof base[k] !== 'object') base[k] = {}; });
      if (!base.buffs || !base.buffs.prod || !base.buffs.click) base.buffs = newState().buffs;
      if (!Array.isArray(base.log)) base.log = [];
      s = base;
      return true;
    } catch (e) { return false; }
  }
  function save() {
    try {
      s.saved = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) { /* storage unavailable: play on without saving */ }
  }

  // ---------- economy ----------

  function owned(i) { return s.b[i] || 0; }

  function buildingMult(i) {
    var m = 1;
    for (var k = 0; k < UPGRADES.length; k++) {
      var u = UPGRADES[k];
      if (u.type === 'building' && u.target === i && s.up[u.id]) m *= 2;
    }
    return m;
  }
  function globalMult() {
    var m = 1 + s.branches * BRANCH_BONUS;
    for (var k = 0; k < UPGRADES.length; k++) {
      var u = UPGRADES[k];
      if (u.type === 'global' && s.up[u.id]) m *= u.mult;
    }
    return m;
  }
  function baseCps() {
    var t = 0;
    for (var i = 0; i < BUILDINGS.length; i++) t += owned(i) * BUILDINGS[i].cps * buildingMult(i);
    return t * globalMult();
  }
  function cps(now) {
    var c = baseCps();
    if (s.buffs.prod.until > now) c *= s.buffs.prod.mult;
    return c;
  }
  function clickValue(now) {
    var v = 1;
    for (var k = 0; k < UPGRADES.length; k++) {
      var u = UPGRADES[k];
      if (!s.up[u.id]) continue;
      if (u.type === 'click') v *= u.mult;
    }
    if (s.up.c3) v += baseCps() * 0.01;
    v *= 1 + s.branches * BRANCH_BONUS;
    if (s.buffs.click.until > now) v *= s.buffs.click.mult;
    return v;
  }
  function earn(n) { s.loaves += n; s.runTotal += n; s.total += n; }

  function costFor(b, n) {
    return Math.ceil(b.cost * Math.pow(GROWTH, owned(b.id)) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1));
  }
  function maxAffordable(b) {
    var n = 0;
    while (n < 1000 && costFor(b, n + 1) <= s.loaves) n++;
    return n;
  }
  var buyMode = 1; // 1, 10 or 'max'
  function buyAmount(b) {
    if (buyMode === 'max') return Math.max(1, maxAffordable(b));
    return buyMode;
  }
  function buy(i) {
    var b = BUILDINGS[i], n = buyAmount(b), c = costFor(b, n);
    if (s.loaves < c) return;
    s.loaves -= c;
    s.b[i] = owned(i) + n;
    refresh(true);
  }
  function upgradeAvailable(u) {
    if (s.up[u.id]) return false;
    if (u.type === 'building') return owned(u.target) >= u.own;
    return s.runTotal >= u.req;
  }
  function buyUpgrade(id) {
    for (var k = 0; k < UPGRADES.length; k++) {
      var u = UPGRADES[k];
      if (u.id === id && upgradeAvailable(u) && s.loaves >= u.cost) {
        s.loaves -= u.cost;
        s.up[id] = true;
        refresh(true);
        return;
      }
    }
  }

  function branchGain() {
    return Math.max(0, Math.floor(Math.cbrt(s.runTotal / BRANCH_THRESHOLD)));
  }
  function openBranch() {
    var gain = branchGain();
    if (gain < 1) return;
    var msg = 'Open a new branch? Your loaves, staff and upgrades reset. You gain ' + gain + ' branch' + (gain === 1 ? '' : 'es') + ', which stay forever (+10% production each).';
    if (!window.confirm(msg)) return;
    s.branches += gain;
    s.runs += 1;
    s.loaves = 0; s.runTotal = 0; s.b = {}; s.up = {};
    s.buffs = newState().buffs;
    clearEvent();
    say('Branch opened. The new location is identical to this one, which is the whole strategy.');
    save();
    refresh(true);
  }

  // ---------- DOM ----------

  root.innerHTML =
    '<div class="bk">' +
      '<div class="bk-ticker" role="status" aria-live="polite" id="bk-ticker"></div>' +
      '<div class="bk-main">' +
        '<section class="bk-panel bk-stage" id="bk-stage" aria-label="Bakery">' +
          '<div class="bk-count-label">LOAVES BAKED</div>' +
          '<div class="bk-count" id="bk-count">0</div>' +
          '<div class="bk-rates">per second <b id="bk-cps">0</b> &middot; per click <b id="bk-cpc">1</b></div>' +
          '<button class="bk-loaf" id="bk-loaf" aria-label="Bake a loaf">' + sprite(LOAF, 12) + '</button>' +
          '<div class="bk-buffs" id="bk-buffs"></div>' +
        '</section>' +
        '<section class="bk-panel bk-side">' +
          '<div class="bk-tabs" role="tablist">' +
            '<button class="bk-tab" role="tab" data-tab="staff" aria-selected="true">STAFF</button>' +
            '<button class="bk-tab" role="tab" data-tab="ups" aria-selected="false" id="bk-tab-ups">UPGRADES</button>' +
            '<button class="bk-tab" role="tab" data-tab="branch" aria-selected="false">BRANCH</button>' +
            '<button class="bk-tab" role="tab" data-tab="log" aria-selected="false">LOG</button>' +
          '</div>' +
          '<div class="bk-pane" data-pane="staff" role="tabpanel">' +
            '<div class="bk-modes" role="group" aria-label="Buy amount">' +
              '<button class="bk-btn" data-mode="1" aria-pressed="true">x1</button>' +
              '<button class="bk-btn" data-mode="10" aria-pressed="false">x10</button>' +
              '<button class="bk-btn" data-mode="max" aria-pressed="false">MAX</button>' +
            '</div>' +
            '<ul class="bk-list" id="bk-list"></ul>' +
          '</div>' +
          '<div class="bk-pane" data-pane="ups" role="tabpanel" hidden>' +
            '<div class="bk-upgrades" id="bk-ups"></div>' +
          '</div>' +
          '<div class="bk-pane bk-prestige" data-pane="branch" role="tabpanel" hidden>' +
            '<p id="bk-pinfo"></p>' +
            '<button class="bk-btn bk-go" id="bk-pbtn">OPEN A NEW BRANCH</button>' +
          '</div>' +
          '<div class="bk-pane" data-pane="log" role="tabpanel" hidden>' +
            '<ul class="bk-feed" id="bk-feed"></ul>' +
            '<div class="bk-foot">' +
              '<div class="bk-stats" id="bk-stats"></div>' +
              '<button class="bk-btn" id="bk-save">SAVE</button>' +
              '<button class="bk-btn" id="bk-reset">RESET</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +
    '</div>';

  // the game fits the viewport; page chrome shrinks around it (see bakery.css)
  document.body.classList.add('bk-page');

  function $(id) { return document.getElementById(id); }
  var elTicker = $('bk-ticker'), elCount = $('bk-count'), elCps = $('bk-cps'), elCpc = $('bk-cpc');
  var elStage = $('bk-stage'), elLoaf = $('bk-loaf'), elBuffs = $('bk-buffs'), elList = $('bk-list');
  var elUps = $('bk-ups'), elPinfo = $('bk-pinfo'), elPbtn = $('bk-pbtn'), elFeed = $('bk-feed'), elStats = $('bk-stats');

  // building rows are created once and updated in place
  var rows = BUILDINGS.map(function (b, i) {
    var li = document.createElement('li');
    li.className = 'bk-row';
    li.innerHTML =
      '<div class="bk-icon">' + sprite(b.art, 4) + '</div>' +
      '<div><span class="bk-name">' + b.name + '</span><span class="bk-owned"></span>' +
      '<div class="bk-desc">' + b.blurb + '</div><div class="bk-desc bk-each"></div></div>' +
      '<button class="bk-btn bk-buy"><span class="bk-buy-n"></span><small></small></button>';
    li.querySelector('.bk-buy').addEventListener('click', function () { buy(i); });
    elList.appendChild(li);
    return { li: li, owned: li.querySelector('.bk-owned'), each: li.querySelector('.bk-each'), btn: li.querySelector('.bk-buy'), n: li.querySelector('.bk-buy-n'), cost: li.querySelector('small') };
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-mode]'), function (btn) {
    btn.addEventListener('click', function () {
      var m = btn.getAttribute('data-mode');
      buyMode = m === 'max' ? 'max' : parseInt(m, 10);
      Array.prototype.forEach.call(root.querySelectorAll('[data-mode]'), function (o) {
        o.setAttribute('aria-pressed', o === btn ? 'true' : 'false');
      });
      refresh(false);
    });
  });

  var elTabUps = $('bk-tab-ups');
  function showTab(name) {
    Array.prototype.forEach.call(root.querySelectorAll('.bk-tab'), function (t) {
      t.setAttribute('aria-selected', t.getAttribute('data-tab') === name ? 'true' : 'false');
    });
    Array.prototype.forEach.call(root.querySelectorAll('.bk-pane'), function (p) {
      p.hidden = p.getAttribute('data-pane') !== name;
    });
  }
  Array.prototype.forEach.call(root.querySelectorAll('.bk-tab'), function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
  });

  // ---------- ticker, log, floaters ----------

  var lastSay = 0;
  function say(text) {
    elTicker.textContent = text;
    lastSay = Date.now();
  }
  function idleLine() {
    var pool = IDLE_LINES.slice();
    if (owned(7) > 0) pool.push('The Temporal Proofing Chamber produced a loaf dated next Thursday.');
    if (s.branches > 0) pool.push("Your other branch sends a postcard. It just says 'bread'.");
    if (owned(8) > 0) pool.push('Mission control asks the orbital bakery to stop sending crumbs back.');
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function checkMilestones() {
    for (var i = 0; i < MILESTONES.length; i++) {
      if (s.total >= MILESTONES[i][0] && !s.seen[i]) {
        s.seen[i] = true;
        s.log.unshift(MILESTONES[i][1]);
        if (s.log.length > 40) s.log.length = 40;
        say(MILESTONES[i][1]);
        renderFeed();
      }
    }
  }
  function renderFeed() {
    if (!s.log.length) { elFeed.innerHTML = '<li>Nothing has happened yet. Bake something.</li>'; return; }
    elFeed.innerHTML = '';
    s.log.slice(0, 8).forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      elFeed.appendChild(li);
    });
  }

  function floater(text, x, y) {
    var f = document.createElement('div');
    f.className = 'bk-float';
    f.textContent = text;
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    elStage.appendChild(f);
    window.setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 900);
  }

  elLoaf.addEventListener('click', function (e) {
    var now = Date.now(), v = clickValue(now);
    earn(v);
    s.clicks += 1;
    var r = elStage.getBoundingClientRect(), x, y;
    if (e.detail === 0) { var lr = elLoaf.getBoundingClientRect(); x = lr.left - r.left + lr.width / 2; y = lr.top - r.top; }
    else { x = e.clientX - r.left; y = e.clientY - r.top; }
    floater('+' + fmt(v, true), Math.max(4, x - 12), Math.max(4, y - 10));
    elLoaf.classList.add('pop');
    window.setTimeout(function () { elLoaf.classList.remove('pop'); }, 70);
    refresh(false);
  });

  // ---------- random events ----------

  var pending = null;       // { el, until, kind }
  var nextEventAt = Date.now() + (30 + Math.random() * 30) * 1000;

  function clearEvent() {
    if (pending && pending.el && pending.el.parentNode) pending.el.parentNode.removeChild(pending.el);
    pending = null;
  }
  function pickKind() {
    var r = Math.random() * 100;
    if (r < 40) return 'lucky';
    if (r < 65) return 'frenzy';
    if (r < 85) return 'queue';
    return 'inspector';
  }
  var EVENT_ART = { lucky: S_CUSTOMER, frenzy: S_PIGEON, queue: S_CUSTOMER, inspector: S_INSPECTOR };
  var EVENT_LABEL = { lucky: 'A regular customer', frenzy: 'A pigeon with flour', queue: 'A queue forming', inspector: 'A health inspector' };

  function spawnEvent(now) {
    var kind = pickKind();
    var btn = document.createElement('button');
    btn.className = 'bk-event';
    btn.setAttribute('aria-label', EVENT_LABEL[kind] + ' (click)');
    btn.innerHTML = sprite(EVENT_ART[kind], 6);
    var w = elStage.clientWidth, h = elStage.clientHeight;
    btn.style.left = Math.round(10 + Math.random() * Math.max(10, w - 80)) + 'px';
    btn.style.top = Math.round(60 + Math.random() * Math.max(10, h - 150)) + 'px';
    btn.addEventListener('click', function () { resolveEvent(kind); });
    elStage.appendChild(btn);
    pending = { el: btn, until: now + 13000, kind: kind };
  }

  function resolveEvent(kind) {
    var now = Date.now();
    clearEvent();
    if (kind === 'lucky') {
      var gain = Math.min(s.loaves * 0.15, cps(now) * 900) + 13;
      earn(gain);
      say('A regular tips generously: +' + fmt(gain, true) + ' loaves. They will not say what for.');
    } else if (kind === 'frenzy') {
      s.buffs.prod = { until: now + 30000, mult: 7 };
      say('The pigeon drops a bag of flour and leaves. Production x7 for 30 seconds.');
    } else if (kind === 'queue') {
      s.buffs.click = { until: now + 15000, mult: 15 };
      say('A queue forms for no reason. Clicks are worth x15 for 15 seconds.');
    } else {
      showChoice();
    }
    refresh(false);
  }

  function showChoice() {
    var box = document.createElement('div');
    box.className = 'bk-choice';
    box.innerHTML =
      '<p>A health inspector arrives. He has questions, a clipboard, and an expression.</p>' +
      '<button class="bk-btn" data-c="a">OFFER A FREE LOAF</button>' +
      '<button class="bk-btn" data-c="b">PRETEND TO BE CLOSED</button>';
    elStage.appendChild(box);
    pending = { el: box, until: Date.now() + 20000, kind: 'choice' };
    var done = function (c) {
      var now = Date.now();
      clearEvent();
      if (c === 'a') {
        if (Math.random() < 0.7) {
          s.buffs.prod = { until: now + 45000, mult: 5 };
          say('He approves, loudly, to other inspectors. Production x5 for 45 seconds.');
        } else {
          var lost = s.loaves * 0.05;
          s.loaves -= lost;
          say('He takes the whole tray. -' + fmt(lost, true) + ' loaves. He leaves a four-star review anyway.');
        }
      } else {
        var quiet = cps(now) * 60 + 5;
        earn(quiet);
        say('You pretend to be a different bakery. It goes well. +' + fmt(quiet, true) + ' loaves.');
      }
      refresh(false);
    };
    Array.prototype.forEach.call(box.querySelectorAll('[data-c]'), function (b) {
      b.addEventListener('click', function () { done(b.getAttribute('data-c')); });
    });
  }

  function eventTick(now) {
    if (pending && now >= pending.until) {
      if (pending.kind === 'choice') say('The inspector gets bored and leaves. You were never here.');
      clearEvent();
    }
    if (!pending && now >= nextEventAt) {
      spawnEvent(now);
      nextEventAt = now + (60 + Math.random() * 60) * 1000;
    }
  }

  // ---------- rendering ----------

  var upKey = '';

  function refresh(full) {
    var now = Date.now(), c = cps(now);

    elCount.textContent = fmtWords(s.loaves);
    elCps.textContent = fmt(c, true);
    elCpc.textContent = fmt(clickValue(now), true);

    for (var i = 0; i < BUILDINGS.length; i++) {
      var b = BUILDINGS[i], r = rows[i];
      // always refresh the row's contents, even when it's hidden, so a
      // prestige reset never leaves stale counts behind
      var seen = i === 0 || owned(i) > 0 || s.runTotal >= b.cost * 0.5;
      r.li.hidden = !seen;
      var n = buyAmount(b), cost = costFor(b, n);
      r.owned.textContent = owned(i) ? 'x' + owned(i) : '';
      r.each.textContent = 'Each bakes ' + fmt(b.cps * buildingMult(i) * globalMult(), true) + '/s';
      r.n.textContent = 'BUY ' + n;
      r.cost.textContent = fmt(cost) + ' loaves';
      r.btn.disabled = s.loaves < cost;
    }

    // upgrades: rebuild only when the visible set changes
    var avail = UPGRADES.filter(upgradeAvailable).sort(function (a, b) { return a.cost - b.cost; }).slice(0, 12);
    var key = avail.map(function (u) { return u.id; }).join(',');
    if (key !== upKey || full) {
      upKey = key;
      elUps.innerHTML = '';
      if (!avail.length) {
        var p = document.createElement('p');
        p.className = 'bk-empty';
        p.textContent = 'Nothing to buy yet. Keep baking.';
        elUps.appendChild(p);
      }
      avail.forEach(function (u) {
        var btn = document.createElement('button');
        btn.className = 'bk-up';
        btn.setAttribute('data-id', u.id);
        btn.innerHTML = '<span class="bk-up-name"></span><span class="bk-up-desc"></span><span class="bk-up-cost"></span>';
        btn.querySelector('.bk-up-name').textContent = u.name;
        btn.querySelector('.bk-up-desc').textContent = u.desc;
        btn.querySelector('.bk-up-cost').textContent = fmt(u.cost) + ' loaves';
        btn.addEventListener('click', function () { buyUpgrade(u.id); });
        elUps.appendChild(btn);
      });
    }
    Array.prototype.forEach.call(elUps.querySelectorAll('.bk-up'), function (btn) {
      var u = null;
      for (var k = 0; k < UPGRADES.length; k++) if (UPGRADES[k].id === btn.getAttribute('data-id')) u = UPGRADES[k];
      var can = u && s.loaves >= u.cost;
      btn.classList.toggle('can', !!can);
      btn.classList.toggle('cant', !can);
    });
    var canCount = elUps.querySelectorAll('.bk-up.can').length;
    elTabUps.textContent = canCount ? 'UPGRADES (' + canCount + ')' : 'UPGRADES';

    // buffs
    var bh = '';
    if (s.buffs.prod.until > now) bh += '<span class="bk-buff">PRODUCTION x' + s.buffs.prod.mult + ' ' + Math.ceil((s.buffs.prod.until - now) / 1000) + 's</span>';
    if (s.buffs.click.until > now) bh += '<span class="bk-buff">CLICKS x' + s.buffs.click.mult + ' ' + Math.ceil((s.buffs.click.until - now) / 1000) + 's</span>';
    if (elBuffs.innerHTML !== bh) elBuffs.innerHTML = bh;

    // prestige
    var gain = branchGain();
    elPinfo.innerHTML =
      'Branches open: <b>' + s.branches + '</b> (production +' + fmt(s.branches * BRANCH_BONUS * 100) + '%). ' +
      (gain >= 1
        ? 'Opening one now gives <b>+' + fmt(gain) + '</b> more. Staff, upgrades and loaves reset.'
        : 'Bake ' + fmt(BRANCH_THRESHOLD) + ' loaves in a single run to qualify. This run: ' + fmtWords(s.runTotal) + '.');
    elPbtn.disabled = gain < 1;

    elStats.textContent = 'All-time loaves: ' + fmtWords(s.total) + ' · Clicks: ' + fmt(s.clicks) + ' · Branches opened: ' + s.runs;

    checkMilestones();
  }

  elPbtn.addEventListener('click', openBranch);
  $('bk-save').addEventListener('click', function () { save(); say('Game saved. The bread remembers.'); });
  $('bk-reset').addEventListener('click', function () {
    if (!window.confirm('Delete your save and start over? The bread will forget everything.')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    clearEvent();
    s = newState();
    upKey = '';
    say('Fresh start. Same bread.');
    refresh(true);
    renderFeed();
  });

  // ---------- offline progress ----------

  var AWAY_LINES = [
    'The bakery ran itself. Mostly badly.',
    'Gerald held down the fort.',
    'Nobody noticed you were gone, which is both a relief and an insult.',
    'The pigeons took shifts.'
  ];
  function applyOffline(dt) {
    var secs = Math.min(dt, OFFLINE_CAP_S);
    var gain = baseCps() * secs * OFFLINE_RATE;
    if (secs < 60 || gain <= 0) return;
    earn(gain);
    showWelcome(secs, gain, dt > OFFLINE_CAP_S);
  }
  function showWelcome(secs, gain, capped) {
    var m = document.createElement('div');
    m.className = 'bk-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', 'Welcome back');
    m.innerHTML = '<div class="bk-modal-box"><h3>WELCOME BACK</h3><p></p><button class="bk-btn bk-go">BACK TO WORK</button></div>';
    m.querySelector('p').textContent = 'You were away for ' + fmtTime(secs) + (capped ? ' (the bakery stops caring after 8 hours)' : '') +
      '. Production ran at half speed and baked ' + fmtWords(gain) + ' loaves. ' + AWAY_LINES[Math.floor(Math.random() * AWAY_LINES.length)];
    var close = function () { if (m.parentNode) m.parentNode.removeChild(m); };
    m.querySelector('button').addEventListener('click', close);
    root.appendChild(m);
    m.querySelector('button').focus();
  }

  // ---------- main loop ----------

  var lastTick = Date.now();
  function tick() {
    var now = Date.now(), dt = (now - lastTick) / 1000;
    lastTick = now;
    if (dt > OFFLINE_GAP_S) applyOffline(dt);
    else if (dt > 0) earn(cps(now) * dt);
    eventTick(now);
    if (now - lastSay > 15000) say(idleLine());
    refresh(false);
  }

  if (load()) applyOffline((Date.now() - s.saved) / 1000);
  renderFeed();
  say('Welcome to the bakery. The bread is not going to bake itself. Well. Eventually it will.');
  refresh(true);
  lastTick = Date.now();
  window.setInterval(tick, 100);
  window.setInterval(save, 15000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
})();
