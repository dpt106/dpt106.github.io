/* Is Mork Coming? — the two hours between the 17:30 ping and the 19:30 kick-off.
   You are Don. Get the busiest man in the group online before the session
   starts, keep the vibes up, and try not to be the one who decides anything.
   Once Mork is in he is fully locked in, so the whole fight is the lead-up.
   Rendered into #gamenight. */
(function () {
  'use strict';

  var root = document.getElementById('gamenight');
  if (!root) return;

  var START = 17 * 60 + 30;     // the group chat pings at 5:30 PM
  var WINDOW_MIN = 120;         // kick-off is two hours later, at 7:30 PM
  var ROUND_MIN = 15;           // each round costs 15 minutes
  var BASE_READY = 2;           // Mork drifts towards free a little each round
  var BASE_VIBES = -2;          // and the mood drifts down a bit
  var WIN_READY = 65;           // readiness needed at kick-off for Mork to be on time
  var LATE_READY = 40;          // enough to turn up late and fall asleep on the controller
  var ENDINGS_KEY = 'is-mork-coming-endings';
  var ENDING_COUNT = 4;

  var DAYS = {
    sunday: { name: 'Sunday', next: 'Wednesday', blurb: 'Family dinner, then baths. Mork is a hostage until 7.', workWeight: 1 },
    wednesday: { name: 'Wednesday', next: 'Sunday', blurb: 'Work is overrunning. Mork is a hostage until it stops.', workWeight: 2 }
  };

  // ---------- pixel sprites ----------

  var PAL = { k: '#1a1018', f: '#f0c8a0', n: '#7a4a2b', m: '#2b2540', g: '#3f9a4a', r: '#c8433a', u: '#3b6ea5', w: '#f4f4f4', y: '#ffd54a', s: '#aab4c0', d: '#4a5568', b: '#8a5a2b' };

  function sprite(rows, px) {
    var w = 0, rects = '', x, y;
    for (y = 0; y < rows.length; y++) w = Math.max(w, rows[y].length);
    for (y = 0; y < rows.length; y++) {
      for (x = 0; x < rows[y].length; x++) {
        var col = PAL[rows[y].charAt(x)];
        if (col) rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + col + '"/>';
      }
    }
    return '<svg class="gn-sprite" viewBox="0 0 ' + w + ' ' + rows.length + '" width="' + (w * px) + '" height="' + (rows.length * px) + '" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>';
  }

  // shared body: H hair, S skin, T shirt (placeholders swapped per character)
  var BASE = [
    '...kkkkkk...', '..kHHHHHHk..', '..kHHHHHHk..', '..kSSSSSSk..', '..kSkSSkSk..', '..kSSSSSSk..',
    '..kSSkkSSk..', '...kSSSSk...', '.kTTTTTTTTk.', 'kTTTTTTTTTTk', 'kTTTTTTTTTTk', 'kSTTTTTTTTSk',
    '.kTTTTTTTTk.', '..kkkkkkkk..'
  ];
  // final canvas is 14 wide: 1px margin each side, one extra row on top for accessories
  function build(spec) {
    var map = { H: spec.hair, S: 'f', T: spec.shirt };
    var rows = [spec.top || '..............'];
    BASE.forEach(function (r) {
      var m = '';
      for (var i = 0; i < r.length; i++) m += map[r.charAt(i)] || r.charAt(i);
      rows.push('.' + m + '.');
    });
    (spec.edits || []).concat([[5, 13, 'd'], [6, 13, 'd'], [7, 13, 'k'], [8, 13, 'd'], [9, 13, 'd'], [10, 13, 'd']]).forEach(function (e) {
      var row = rows[e[1]];
      rows[e[1]] = row.substr(0, e[0]) + e[2] + row.substr(e[0] + 1);
    });
    return rows;
  }

  var CHARS = {
    don: {
      name: 'DON',
      rows: build({ hair: 'n', shirt: 'u', edits: [[4, 5, 'k'], [5, 5, 'k'], [6, 5, 'k'], [7, 5, 'k'], [8, 5, 'k'], [9, 5, 'k'], [6, 10, 'w'], [7, 10, 'w']] })
    },
    tom: {
      name: 'TOM',
      rows: build({ hair: 'g', shirt: 'r', top: '...yyyyyyyy...',
        edits: [[5, 7, 'k'], [8, 7, 'k'], [12, 6, 's'], [13, 6, 's'], [12, 7, 's'],
          [13, 8, 'n'], [13, 9, 'n'], [13, 10, 'n'], [13, 11, 'n'], [13, 12, 'n'], [13, 13, 'n'], [13, 14, 'n']] })
    },
    mork: {
      name: 'MORK',
      rows: build({ hair: 'm', shirt: 'w', edits: [[6, 10, 'r'], [7, 10, 'r'], [6, 11, 'r'], [7, 11, 'r'], [6, 12, 'r'], [11, 5, 'u'],
        [0, 9, 'd'], [0, 10, 'y'], [0, 11, 'd']] })
    }
  };

  // group-chat phone shown at the top of the "TV"
  var PHONE = [
    '.kkkkkk.', 'kwwwwwwk', 'kwggggwk', 'kwwwwwwk', 'kwwwbbwk', 'kwwwwwwk', 'kwggwwwk', 'kwwwwwwk', 'kwwwwwwk', 'kkkkkkkk'
  ];

  // ---------- events ----------
  // Effects: p = Mork readiness, v = vibes, t = extra minutes lost, d = minutes
  // the kick-off is pushed back, plus counters: steals, maybes, easy. A choice
  // can instead carry ok/bad outcomes, resolved by luck (risk) or by the
  // Timber! mini-game.

  var EVENTS = [
    { id: 'ping', first: true, who: ['don'],
      title: '5:30 PM. The group chat',
      text: "Two hours to kick-off, the usual notice. Tom has been online since two. Mork has not been seen since breakfast. You hold the phone.",
      choices: [
        { label: "Send a casual 'you in tonight?'", p: 6, v: 2, easy: 1, msg: "Tom replies in four seconds. Mork replies in a way that isn't a reply: a thumbs-up on Tom's message." },
        { label: 'Tag Mork directly', p: 10, v: -2, msg: "A tag is a summons. He sees it, sighs audibly, and starts to think about his evening." },
        { label: "Let Tom write the invite", p: -4, v: 6, msg: "It is called 'The Gathering'. It is four paragraphs. Mork will need a lawyer to read it." }
      ] },
    { id: 'seen', who: ['mork'],
      title: 'Mork has read it',
      text: 'Two ticks. Both blue. Nothing else. This is not unusual, and it is also not a yes.',
      choices: [
        { label: 'Wait', p: 2, v: 0, easy: 1, msg: "You wait. The two blue ticks sit there like a pair of tiny, accusing eyes." },
        { label: 'Send a gif', p: 4, v: 4, msg: 'Mork responds with a single laughing emoji. An advance.' },
        { label: 'Call him', p: 8, v: -6, msg: "He answers on speaker, mid-drive, with three children audible. 'Can't talk,' he says, talking." }
      ] },
    { id: 'headset', who: ['tom', 'mork'],
      title: "Mork's headset is at Tom's",
      text: "Mork would join, but his headset is on Tom's shelf. It has been there since last month. Tom calls it 'safekeeping'.",
      choices: [
        { label: "Tell Tom to return it", p: 8, v: -4, steals: 1, msg: "Tom agrees to drop it round 'at some point', a phrase with no length." },
        { label: 'Lend Mork your spare', p: 10, v: 2, t: 15, msg: 'It does not fit him. He joins with one ear. This is considered a win.' },
        { label: 'Let it go', p: 0, v: 2, steals: 1, easy: 1, msg: "Mork will use earbuds. They keep falling out. He'll find peace in it." }
      ] },
    { id: 'work', who: ['mork'], work: true,
      title: 'Mork is stuck at work',
      text: "'Just finishing something.' The something has no end. It's 5:50.",
      choices: [
        { label: 'Offer to push kick-off to 8:00', p: 12, v: -5, d: 30, msg: "Tom agrees at once. He needs the extra half hour for something he won't describe." },
        { label: "Tell him we'll hold a seat", p: 6, v: 3, msg: 'A bar chart appears in Mork\'s head. He feels guilty about it.' },
        { label: 'Say nothing, pray', p: 0, v: 0, t: 15, easy: 1, msg: 'Fifteen minutes. Nothing. The prayer is received.' }
      ] },
    { id: 'dinner', who: ['mork'],
      title: 'Mork is doing the kids\' dinner',
      text: "He sends one photo. It's chicken dippers. He sends no caption. It is a cry for help.",
      choices: [
        { label: 'Suggest takeaway', p: 8, v: -2, msg: "'Great shout.' He orders it in under a minute. The man is a machine." },
        { label: "Send a 'tactical dipper' recipe", p: 2, v: 5, msg: 'You have invented several types of dipper. He is surprisingly into them.' },
        { label: 'Say nothing', p: 0, v: 0, msg: 'The dippers are dealt with, eventually, in silence.' }
      ] },
    { id: 'bedtime', who: ['mork'],
      title: 'Bedtime stories',
      text: "Mork's youngest wants 'one more'. Mork has read the same book six times in his own head this week.",
      choices: [
        { label: 'Send Tom to read the story', p: 4, v: 6, msg: "Tom's story features a lumberjack who is wise and forgiven. It runs 20 minutes. It works." },
        { label: 'Send an encouraging voice note', p: -2, v: 5, msg: 'Mork smiles. He also sleeps through the first chapter himself.' },
        { label: 'Tell him to read the short one', p: 8, v: -3, t: 15, msg: "'There's no short one, Don.' There's a short one." }
      ] },
    { id: 'partner', who: ['mork'],
      title: "The dishwasher clause",
      text: "Mork says he's allowed to game 'if the dishwasher is done'. The dishwasher is currently a full time job.",
      choices: [
        { label: "Offer to 'help' remotely", p: 6, v: 2, msg: "You read him the instructions off the machine. He is not grateful. It's loaded fast." },
        { label: 'Remind him he never gets interrupted when he plays', p: 4, v: 4, msg: "Mork brightens: it's true. When he's in, he's in. The phone goes in a drawer." },
        { label: 'Tell him to leave it', p: 10, v: -6, msg: "He leaves it. Tomorrow he will think about this. Tomorrow isn't tonight." }
      ] },
    { id: 'easy', who: ['don'],
      title: 'What time are we actually starting?',
      text: "Mork says whenever. Tom says now. Everybody waits for Don to confirm something.",
      choices: [
        { label: "'I'm easy.'", p: 2, v: -2, t: 15, easy: 1, msg: 'Fifteen minutes pass. Nobody picks a time.' },
        { label: "'7:30. Like always.'", p: 8, v: -2, msg: "A decision. Out of character. Everyone is unsettled and, quietly, impressed." },
        { label: 'Suggest 7:45', p: 4, v: 2, d: 15, msg: "'Fine,' says Mork, who has not been this agreeable since the wedding." }
      ] },
    { id: 'gathering', who: ['tom'],
      title: "Tom's manifesto",
      text: "Tom sends a long message about tonight's importance. It is titled 'The Gathering' and uses the word 'destiny' twice.",
      choices: [
        { label: 'Like it', p: -3, v: 6, msg: "Tom is lit from within. Mork is, quietly, a bit more tired." },
        { label: 'Mute the chat', p: 3, v: -4, msg: "Peace. Tom doesn't notice for forty minutes." },
        { label: "Reply: 'it's just a game'", p: 4, v: -8, msg: "'Just,' Tom says, in a voice note that lasts three minutes." }
      ] },
    { id: 'maybe', who: ['mork'],
      title: "Mork says 'maybe'",
      text: "Mork's 'maybe' has a historical success rate of about 40%. Dinner is almost over. He is either coming or has fallen asleep.",
      choices: [
        { label: "Accept the maybe", p: 3, v: 0, maybes: 1, msg: "You set a place for a maybe. It's a very thin one." },
        { label: 'Ask for a yes or no', p: 8, v: -4, maybes: 1, msg: "He replies with 'yes?'. You count it." },
        { label: 'Send a beer emoji', p: 5, v: 3, maybes: 1, msg: "A single beer emoji does what four paragraphs could not." }
      ] },
    { id: 'chop', who: ['tom'], chop: true,
      title: 'Tom is chopping a tree',
      text: "Tom is in the lobby, chopping a virtual tree. He has been chopping for three hours. 'Just warming up,' he says.",
      choices: [
        { label: 'Ask him to stop', p: 0, v: -5, msg: "'It's not about the trees, Don.' It's entirely about the trees." },
        { label: 'Join him', sub: 'Timber! mini-game', timber: true,
          ok: { p: 4, v: 12, msg: "Two grown men, one tree, absolute silence. Mork sees you both online and feels left out in the best way." },
          bad: { p: 0, v: 3, msg: "Tom out-chops you and says nothing. He doesn't need to." } },
        { label: "Say nothing. It's fine.", p: 0, v: 2, easy: 1, msg: 'You are very relaxed about this. The tree is not.' }
      ] },
    { id: 'charger', who: ['tom', 'mork'],
      title: "Mork's controller is dead",
      text: "Mork's controller charger is currently at Tom's, with the headset, the jacket, and several items of Mork's bathroom.",
      choices: [
        { label: 'Offer Mork yours', p: 10, v: 0, t: 15, msg: 'It takes fifteen minutes to arrive by neighbour. Mork is grateful in the way of tired men.' },
        { label: 'Tell Tom to return it', sub: 'Risky', risk: 0.5,
          ok: { p: 14, v: 2, steals: 1, msg: "Tom returns the charger with two other things. He calls this 'a cleanse'." },
          bad: { p: -4, v: -8, steals: 1, msg: "Tom gives a speech about generosity. He keeps the charger as a statement." } },
        { label: 'Say nothing', p: 0, v: 0, steals: 1, easy: 1, msg: 'Mork will find a way. He always does, in the end. After a bit.' }
      ] },
    { id: 'pizza', who: ['don', 'tom', 'mork'],
      title: 'Order Mork a pizza',
      text: "You can order a pizza to Mork's door. It's not strictly allowed. It's not strictly forbidden.",
      choices: [
        { label: 'Order it', p: 8, v: 8, msg: "His kids love you for roughly ten minutes. Mork loves you for longer." },
        { label: 'Pizza for the whole chat', p: 4, v: 12, t: 15, msg: 'Three pizzas, three doors. A sacred moment of coordination.' }
      ] },
    { id: 'kidsasleep', who: ['mork'], lucky: true,
      title: 'The kids are asleep',
      text: "A miracle: both kids are asleep before 7. Mork sends a single message: 'Do not speak to me. I am coming.'",
      choices: [
        { label: 'Send nothing. Hold your breath.', p: 25, v: 8, msg: "Even Tom stays quiet. The world holds its breath for a full minute." }
      ] },
    { id: 'tomback', who: ['tom'],
      title: 'Tom is back',
      text: "Tom has been gone for three weeks. No messages, no explanation. He returns with a tan, a new watch and a calm you don't trust. 'It was a retreat,' he says.",
      choices: [
        { label: 'Ask where he really was', p: 0, v: -4, msg: "'A retreat.' He says it twice, straight-faced. The watch is from a shop in Geneva." },
        { label: "Don't ask", p: 2, v: 4, easy: 1, msg: "You don't ask. This is mostly why you're still friends." },
        { label: 'Ask about the watch', p: 2, v: 2, msg: "'A gift.' He doesn't say from whom. He is already looking at a tree." }
      ] },
    { id: 'tomgone', who: ['tom'],
      title: 'Tom has gone quiet',
      text: "Mid-conversation, Tom stops replying. His status says 'last seen 4 minutes ago', then 'last seen 4 minutes ago' again, for twenty minutes. This has happened before. It lasted three weeks.",
      choices: [
        { label: 'Wait. He always comes back', p: 2, v: 0, t: 15, easy: 1, msg: "He comes back with 'sorry, signal'. There was no signal for the whole of Tuesday." },
        { label: "Message: 'you ok?'", p: 0, v: 3, msg: "'Fine. Away.' Tom does not say from what, or to where." },
        { label: 'Check the news for a heist', p: 4, v: 4, msg: "Nothing today. The headlines are still, technically, tomorrow's." }
      ] },
    { id: 'solo', who: ['tom'],
      title: "Tom wants to start without Mork",
      text: "'He knows the deal.' Tom has already queued the boss. He has already named the party after himself.",
      choices: [
        { label: 'Calm Tom', p: 2, v: 4, msg: "You talk him down with nothing. The nothing works." },
        { label: 'Let him queue', p: -6, v: -10, msg: "He queues. He waits. He writes a 'for the record' message nobody asked for." }
      ] }
  ];

  // Tom disappears for weeks at a time and has never explained where
  var TOM_RUMOURS = [
    'Rumour: Tom spent the last three weeks on a silent retreat. Nobody can confirm it; Tom is not silent.',
    "Rumour: Tom was in Lisbon, for work he won't name, with a tan he won't explain.",
    "Tom mentions 'the Geneva thing' and immediately changes the subject.",
    "Tom says a relative of his is wanted by Interpol. 'Different Tom,' he adds, unprompted.",
    "Tom's last known location was 'somewhere warm'. He says it like a password."
  ];

  // ---------- state ----------

  var g = null;

  function newGame(dayKey) {
    var day = DAYS[dayKey];
    return { dayKey: dayKey, day: day, clock: START, leaveAt: START + WINDOW_MIN, shifts: 0,
      progress: 0, vibes: 40, pool: [], ev: null, phase: 'event', result: null, ending: null, started: false,
      stats: { trees: 0, steals: 0, maybes: 0, easy: 0, lostMin: 0 } };
  }

  function fmtClock(m) {
    var h = Math.floor(m / 60) % 24, mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function pickEvent() {
    if (!g.started) { g.started = true; return EVENTS.filter(function (e) { return e.first; })[0]; }
    if (!g.pool.length) g.pool = EVENTS.filter(function (e) { return !e.first; }).map(function (e) { return e.id; });
    var cand = g.pool.map(function (id) { return EVENTS.filter(function (e) { return e.id === id; })[0]; });
    var weights = cand.map(function (e) {
      var w = e.lucky ? 0.5 : 1;
      if (e.work) w *= g.day.workWeight;
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total, i = 0;
    while (i < cand.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    g.pool.splice(g.pool.indexOf(cand[i].id), 1);
    return cand[i];
  }

  // where Mork is, as the evening wears on
  function morkStatus() {
    if (g && g.ending === 'win') return 'IN THE LOBBY';
    if (g && g.ending === 'late') return 'ASLEEP, PAD IN HAND';
    if (g && g.ending === 'noshow') return 'ASLEEP';
    var m = g ? g.clock - START : 0;
    if (m < 30) return 'STILL AT WORK';
    if (m < 60) return 'COMMUTING';
    if (m < 90) return 'DINNER + BATHS';
    if (m < 120) return 'BEDTIME';
    return 'SOMEWHERE';
  }

  // ---------- endings log ----------

  function endingsFound() {
    try { return JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]'); } catch (e) { return []; }
  }
  function recordEnding(key) {
    var list = endingsFound();
    if (list.indexOf(key) === -1) list.push(key);
    try { localStorage.setItem(ENDINGS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
    return list;
  }

  // ---------- rendering ----------

  root.innerHTML =
    '<div class="gn">' +
      '<div class="gn-top">' +
        '<div class="gn-clock" id="gn-clock"></div>' +
        '<div class="gn-meter">VIBES <div class="gn-bar"><i id="gn-vibes"></i></div></div>' +
      '</div>' +
      '<div class="gn-tv">' +
        '<div class="gn-boss"><div id="gn-boss"></div>' +
          '<div class="gn-hp">MORK READINESS <div class="gn-bar"><i id="gn-hp"></i></div></div></div>' +
        '<div class="gn-couch" id="gn-couch"></div>' +
      '</div>' +
      '<div class="gn-card" id="gn-card" aria-live="polite"></div>' +
    '</div>';

  document.body.classList.add('gn-page');

  var elClock = document.getElementById('gn-clock'), elVibes = document.getElementById('gn-vibes');
  var elHp = document.getElementById('gn-hp'), elCard = document.getElementById('gn-card'), elCouch = document.getElementById('gn-couch');
  document.getElementById('gn-boss').innerHTML = sprite(PHONE, 8);

  var couchEls = {};
  ['don', 'tom', 'mork'].forEach(function (id) {
    var d = document.createElement('div');
    d.className = 'gn-char';
    d.innerHTML = sprite(CHARS[id].rows, 6) + '<span>' + CHARS[id].name + '</span><small></small>';
    elCouch.appendChild(d);
    couchEls[id] = d;
  });

  function setStatus() {
    var tomText = g && g.ending ? (g.ending === 'rage' ? 'STARTED WITHOUT YOU' : 'CHOPPING') : 'BACK FROM A "RETREAT"';
    couchEls.don.querySelector('small').textContent = 'ON THE SOFA';
    couchEls.tom.querySelector('small').textContent = tomText;
    couchEls.mork.querySelector('small').textContent = morkStatus();
  }

  function setActors(ev) {
    Object.keys(couchEls).forEach(function (id) {
      var on = !!ev && ev.who.indexOf(id) !== -1;
      couchEls[id].classList.toggle('active', on);
    });
  }

  function renderMeters() {
    setStatus();
    if (!g) {
      elClock.innerHTML = 'GAME NIGHT';
      elVibes.style.width = '40%';
      elHp.style.width = '0%';
      return;
    }
    elClock.innerHTML = fmtClock(g.clock) + '<small>KICK-OFF AT ' + fmtClock(g.leaveAt) + '</small>';
    elVibes.style.width = clamp(g.vibes, 0, 100) + '%';
    elVibes.classList.toggle('low', g.vibes <= 25);
    elHp.style.width = clamp(g.progress, 0, 100) + '%';
  }

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderIntro() {
    g = null;
    setActors(null);
    renderMeters();
    var found = endingsFound().length;
    elCard.innerHTML =
      '<h2>IS MORK COMING?</h2>' +
      "<p>Kick-off is 7:30. The chat pings at 5:30. Tom has been online since two, his first appearance in three weeks, and won't say where he's been. Mork is the busiest man you know, but once he's in the lobby nothing gets through: no calls, no kids, no work. The only hard part is getting him there. You are Don. You are, famously, easy.</p>" +
      '<div class="gn-choices">' +
        '<button class="gn-btn" data-day="sunday">SUNDAY<small>' + DAYS.sunday.blurb + '</small></button>' +
        '<button class="gn-btn" data-day="wednesday">WEDNESDAY<small>' + DAYS.wednesday.blurb + '</small></button>' +
      '</div>' +
      '<p class="gn-found">Endings found: ' + found + ' / ' + ENDING_COUNT + '</p>';
  }

  function renderEvent() {
    var ev = g.ev;
    setActors(ev);
    renderMeters();
    var html = '<h2>' + esc(ev.title) + '</h2><p>' + esc(ev.text) + '</p><div class="gn-choices">';
    ev.choices.forEach(function (c, i) {
      html += '<button class="gn-btn" data-choice="' + i + '">' + esc(c.label) + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</button>';
    });
    elCard.innerHTML = html + '</div>';
  }

  function chip(label, val, goodWhenPositive) {
    if (!val) return '';
    var good = goodWhenPositive ? val > 0 : val < 0;
    return '<span class="gn-chip ' + (good ? 'good' : 'bad') + '">' + label + ' ' + (val > 0 ? '+' : '') + val + '</span>';
  }

  function renderResult() {
    var r = g.result;
    renderMeters();
    var chips = chip('READY', r.p, true) + chip('VIBES', r.v, true);
    if (r.mins > ROUND_MIN) chips += '<span class="gn-chip bad">+' + (r.mins - ROUND_MIN) + ' MIN LOST</span>';
    if (r.d) chips += '<span class="gn-chip neutral">KICK-OFF +' + r.d + ' MIN</span>';
    elCard.innerHTML =
      '<h2>' + esc(g.ev.title) + '</h2>' +
      '<p>' + esc(r.msg) + '</p>' +
      '<p>' + esc(r.trees) + '</p>' +
      '<div class="gn-chips">' + chips + '</div>' +
      '<button class="gn-btn gn-go" data-next="1">CONTINUE</button>';
    var b = elCard.querySelector('[data-next]');
    if (b) b.focus();
  }

  var VERDICT = {
    win: ['MORK IS IN', function () {
      return 'Mork joins at ' + fmtClock(g.clock) + ', headset on, phone in another room: a man transformed. Nothing gets through. Tom claims credit for the entire evening.';
    }],
    late: ['MORK, ARRIVING LATE', function () {
      return "He joins at 8:40, exhausted, and plays with the focus of a monk. By 9:15 he's asleep with the controller in his hand. Tom keeps playing and describes it as 'his best work'.";
    }],
    noshow: ['NO MORK', function () {
      return 'No answer. No message. Mork is probably asleep on a sofa somewhere, and happier for it. You and Tom play as a duo while Tom explains trees for three hours. See you ' + g.day.next + '.';
    }],
    rage: ['TOM STARTED WITHOUT HIM', function () {
      return "The vibes hit zero. Tom queued the boss alone, wrote a 'for the record' message and named the party after himself. Mork woke up to forty-two notifications and mutes the chat.";
    }]
  };

  function renderEnd() {
    var v = VERDICT[g.ending], st = g.stats;
    setActors(null);
    renderMeters();
    var found = recordEnding(g.ending).length;
    var lines = [
      'Trees felled by Tom: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'Tom stole nothing. <b>Suspicious.</b>'
        : st.steals < 3 ? "Tom 'borrowed' <b>" + st.steals + '</b> thing' + (st.steals === 1 ? '' : 's') + ' of Mork\'s'
        : 'Tom now owns most of Mork\'s stuff: <b>' + st.steals + '</b> items',
      "Where Tom has been for three weeks: <b>unconfirmed</b> (retreat, or heist)",
      st.maybes === 0 ? "Mork never said 'maybe'. <b>He knew.</b>" : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.easy === 0 ? 'Don made decisions. <b>Out of character.</b>' : "Don said 'I'm easy' (or meant it) <b>" + st.easy + '</b> time' + (st.easy === 1 ? '' : 's')
    ];
    elCard.setAttribute('data-ending', g.ending);
    elCard.innerHTML =
      '<h2>' + v[0] + '</h2><p>' + v[1]() + '</p>' +
      '<ul class="gn-stats">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
      '<button class="gn-btn gn-go" data-again="1">PLAY AGAIN</button>' +
      '<p class="gn-found">Endings found: ' + found + ' / ' + ENDING_COUNT + '</p>';
    var b = elCard.querySelector('[data-again]');
    if (b) b.focus();
  }

  // ---------- game flow ----------

  function applyEffects(o) {
    var p = (o.p || 0) + BASE_READY, v = (o.v || 0) + BASE_VIBES, mins = ROUND_MIN + (o.t || 0);
    g.progress = clamp(g.progress + p, 0, 100);
    g.vibes = clamp(g.vibes + v, 0, 100);
    g.clock += mins;
    if (o.d && g.shifts < 2) { g.leaveAt += o.d; g.shifts++; }
    g.stats.steals += o.steals || 0;
    g.stats.maybes += o.maybes || 0;
    g.stats.easy += o.easy || 0;
    g.stats.lostMin += o.t || 0;
    var trees = 1 + Math.floor(Math.random() * 4);
    g.stats.trees += trees;
    var aside = 'Meanwhile, Tom fells ' + trees + ' tree' + (trees === 1 ? '' : 's') + ' in the lobby.';
    if (Math.random() < 0.2) aside = TOM_RUMOURS[Math.floor(Math.random() * TOM_RUMOURS.length)];
    return { p: p, v: v, d: o.d || 0, mins: mins, msg: o.msg, trees: aside };
  }

  function resolve(outcome) {
    g.result = applyEffects(outcome);
    g.phase = 'result';
    renderResult();
  }

  function choose(i) {
    var c = g.ev.choices[i];
    if (!c) return;
    if (c.timber) { startTimber(c); return; }
    if (c.risk) { resolve(Math.random() < c.risk ? c.ok : c.bad); return; }
    resolve(c);
  }

  function nextRound() {
    if (g.progress >= 100) { g.ending = 'win'; renderEnd(); return; }
    if (g.vibes <= 0) { g.ending = 'rage'; renderEnd(); return; }
    if (g.clock >= g.leaveAt) {
      g.ending = g.progress >= WIN_READY ? 'win' : g.progress >= LATE_READY ? 'late' : 'noshow';
      renderEnd();
      return;
    }
    g.ev = pickEvent();
    g.phase = 'event';
    renderEvent();
  }

  // Timber! — tap CHOP enough times before the clock runs out
  var timber = null;
  var TIMBER_TAPS = 20, TIMBER_MS = 5000;

  function startTimber(choice) {
    timber = { choice: choice, taps: 0, done: false };
    elCard.innerHTML =
      '<div class="gn-timber"><h2>TIMBER!</h2><p>Tap CHOP ' + TIMBER_TAPS + ' times before the tree wins.</p>' +
      '<button class="gn-btn" id="gn-chop">CHOP</button>' +
      '<div class="gn-bar"><i id="gn-chop-bar" style="width:0"></i></div>' +
      '<p id="gn-chop-info">0 / ' + TIMBER_TAPS + '</p></div>';
    var btn = document.getElementById('gn-chop');
    btn.focus();
    btn.addEventListener('click', function () {
      if (!timber || timber.done) return;
      timber.taps++;
      document.getElementById('gn-chop-bar').style.width = Math.min(100, timber.taps / TIMBER_TAPS * 100) + '%';
      document.getElementById('gn-chop-info').textContent = timber.taps + ' / ' + TIMBER_TAPS;
      if (timber.taps >= TIMBER_TAPS) finishTimber();
    });
    timber.timer = window.setTimeout(finishTimber, TIMBER_MS);
  }
  function finishTimber() {
    if (!timber || timber.done) return;
    timber.done = true;
    window.clearTimeout(timber.timer);
    var win = timber.taps >= TIMBER_TAPS, c = timber.choice;
    timber = null;
    resolve(win ? c.ok : c.bad);
  }

  elCard.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-day')) { g = newGame(t.getAttribute('data-day')); nextRound(); }
    else if (t.hasAttribute('data-choice')) choose(parseInt(t.getAttribute('data-choice'), 10));
    else if (t.hasAttribute('data-next')) nextRound();
    else if (t.hasAttribute('data-again')) { elCard.removeAttribute('data-ending'); renderIntro(); }
  });

  renderIntro();
})();
