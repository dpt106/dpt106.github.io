/* Where's Mork? — the two hours between the 17:30 ping and the 19:30 kick-off.
   You are Don. Get the busiest man in the group online before the session
   starts, keep the vibes up, and try not to be the one who decides anything.
   Once Mork is in he is fully locked in, so the whole fight is the lead-up.
   Some choices launch a mini-game, and the gang on the sofa can be poked.
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
  var SWORD = [
    '.......ww', '......wsw', '.....wsw.', '....wsw..', '.y.wsw...', '..ysw....', '..byy....', '.b...y...', 'b........'
  ];

  var PHONE = [
    '.kkkkkk.', 'kwwwwwwk', 'kwggggwk', 'kwwwwwwk', 'kwwwbbwk', 'kwwwwwwk', 'kwggwwwk', 'kwwwwwwk', 'kwwwwwwk', 'kkkkkkkk'
  ];

  // ---------- events ----------
  // Effects: p = Mork readiness, v = vibes, t = extra minutes lost, d = minutes
  // the kick-off is pushed back, plus counters: steals, maybes, easy. A choice
  // can instead carry ok/bad outcomes, resolved by luck (risk) or by the
  // Timber! mini-game.

  var EVENTS = [
    { id: 'ping', first: true, who: ['don', 'tom'],
      title: '5:30 PM. The group chat',
      text: "Two hours to kick-off. Tom has been online since two. Mork hasn't been seen since breakfast. Somebody has to send the invite, and it won't be Mork.",
      choices: [
        { label: 'Send the casual invite', p: 8, v: 2, msg: "You send: 'You in tonight?' Tom replies in four seconds. Mork gives Tom's reply a thumbs-up." },
        { label: 'Let Tom write it', p: -2, v: 8, msg: "He calls it 'The Gathering'. Four paragraphs, and the word 'destiny' twice. Mork will need time to read it." }
      ] },
    { id: 'seen', who: ['mork'],
      title: 'Mork has read it',
      text: "Two blue ticks, and nothing else. That's normal for Mork. It's also not a yes.",
      choices: [
        { label: 'Wait', p: 2, v: 0, easy: 1, msg: 'You wait. The two ticks stare back at you.' },
        { label: 'Send a gif', p: 5, v: 4, msg: "Mork replies with one laughing emoji. For Mork, that's progress." },
        { label: "Catch him while he's typing", sub: 'Mini-game: timing', game: 'typing',
          ok: { p: 12, v: 4, msg: "'ok yeah go on then.' Four words. From Mork, that's a speech." },
          bad: { p: 0, v: -3, msg: "'Typing…' appears, then vanishes. Nothing arrives. Probably a work email." } }
      ] },
    { id: 'work', who: ['mork'], work: true,
      title: 'Mork is stuck at work',
      text: "'Just finishing something.' It's 5:50. He said that at 5:15 as well.",
      choices: [
        { label: 'Offer to push kick-off to 8:00', p: 12, v: -3, d: 30, msg: "Tom agrees instantly. He'll use the extra half hour to 'prepare'. He doesn't say what for." },
        { label: "Tell him we'll hold his seat", p: 6, v: 3, msg: "'Cheers, mate.' Small thing. He'll remember it." }
      ] },
    { id: 'dinner', who: ['mork'],
      title: "Mork is on kid's dinner",
      text: "He sends one photo: a plate of chicken dippers. No caption. You've never seen a clearer cry for help.",
      choices: [
        { label: 'Suggest takeaway', p: 8, v: -2, msg: "'Good shout.' Ordered within the minute. The man gets things done." },
        { label: 'Leave him to it', p: 2, v: 2, msg: 'Dinner happens eventually. Nobody says anything.' }
      ] },
    { id: 'bedtime', who: ['mork', 'tom'],
      title: 'Bedtime story',
      text: "Mork's kid wants 'one more'. Mork has read this book six times this week.",
      choices: [
        { label: 'Tom offers to read it on a call', p: 4, v: 8, msg: "Tom is brilliant at it, all the voices. The kid asks for him again. Tom says to 'remember his name'. For later." },
        { label: 'Tell him to read the short one', p: 8, v: -3, t: 15, msg: "'There is no short one, Don.' There is a short one." }
      ] },
    { id: 'partner', who: ['mork'],
      title: 'The dishwasher clause',
      text: "Mork can play 'once the dishwasher's done'. The dishwasher is a full-time job.",
      choices: [
        { label: 'Help him load it over video', sub: 'Mini-game: tap the plates', game: 'dishes',
          ok: { p: 14, v: 5, msg: "Done. He shuts the door like he's closing a vault. 'Right. Give me ten minutes.'" },
          bad: { p: 4, v: -2, t: 15, msg: "He's still going. You can hear the cutlery drawer from here." } },
        { label: 'Remind him nothing interrupts him once he is in', p: 5, v: 4, msg: "He perks up. It's true: once he's in, he's in. Phone goes in a drawer." },
        { label: 'Tell him to leave it', p: 10, v: -6, msg: "He leaves it. Tomorrow he'll regret this. Tomorrow isn't tonight." }
      ] },
    { id: 'easy', who: ['don'],
      title: 'What time are we starting?',
      text: "Mork says 'whenever'. Tom says 'now'. They're both looking at you.",
      choices: [
        { label: "'I'm easy.'", p: 2, v: -2, t: 15, easy: 1, msg: "Fifteen minutes go by. Nobody picks a time." },
        { label: "'7:30. Like always.'", p: 8, v: -2, msg: "A decision, from Don. Everyone is a bit thrown, and a bit impressed." }
      ] },
    { id: 'maybe', who: ['mork'],
      title: "Mork says 'maybe'",
      text: "Mork's 'maybe' comes good about 40% of the time. The other 60%, he's fallen asleep.",
      choices: [
        { label: 'Accept the maybe', p: 3, v: 0, maybes: 1, msg: "You put his name down in pencil. Very light pencil." },
        { label: 'Send a beer emoji', p: 6, v: 3, maybes: 1, msg: "One beer emoji. It does more than the four paragraphs did." }
      ] },
    { id: 'calm', who: ['tom'],
      title: 'Tom is far too excited',
      text: "'Tonight's going to be the best night in history.' He's made a playlist. He's made a banner. Someone has to calm him down.",
      choices: [
        { label: 'Calm Tom down', sub: 'Mini-game: hold and release', game: 'breathe',
          ok: { p: 2, v: 10, msg: "Tom breathes out. He takes the banner down and folds it. 'For later,' he says." },
          bad: { p: 0, v: 1, msg: "Tom breathes very fast and very keenly, and calls it a warm-up." } },
        { label: 'Let him run with it', p: -4, v: -6, msg: "The hype builds. Then a speech. It's about destiny." }
      ] },
    { id: 'chop', who: ['tom'], chop: true,
      title: 'Tom is chopping a tree',
      text: "Tom's in the lobby, chopping a tree. He's been at it three hours. 'Just warming up,' he says.",
      choices: [
        { label: 'Join him', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, msg: "Two grown men, one tree, total silence. Best part of the night." },
          bad: { p: 0, v: 3, msg: "Tom out-chops you and says nothing. He doesn't need to." } },
        { label: 'Leave him to it', p: 0, v: 2, easy: 1, msg: "You're very relaxed about it. The tree is not." }
      ] },
    { id: 'generous', who: ['tom', 'mork'],
      title: "Tom paid for Mork's PS Plus",
      text: "A whole year, no reason given. Tom's one of the nicest people alive. There's also a non-zero chance this isn't what it looks like.",
      choices: [
        { label: 'Thank him', p: 8, v: 8, msg: "Mork's nearly in tears. Tom waves it off, then asks for Mork's login. 'To check the renewal.'" },
        { label: 'Ask what the catch is', p: 2, v: -2, steals: 1, msg: "'There's no catch.' The gift card came from somewhere. Tom is already talking about something else." }
      ] },
    { id: 'steal', who: ['tom'],
      title: 'That sword was yours',
      text: "A legendary sword drops and you grab it. You look away for a second. It's in Tom's inventory. 'Safekeeping,' he says, warmly.",
      choices: [
        { label: 'Let it slide', p: 3, v: 3, steals: 1, easy: 1, msg: "You're chill about it. He gives you three smaller swords by way of apology. It isn't even." },
        { label: 'Grab it back', sub: 'Mini-game: reaction', game: 'grab',
          ok: { p: 10, v: 2, msg: "He hands it over at once, thrilled for you. Almost too thrilled." },
          bad: { p: 0, v: -8, t: 15, steals: 1, msg: "He thanks you for the sword, hugs you, and is gone. You're not sure who won." } }
      ] },
    { id: 'inventory', who: ['tom', 'mork'],
      title: "Tom is 'looking after' Mork's stuff",
      text: "Forty of Mork's items are in Tom's inventory 'for safekeeping'. Mork hasn't noticed. Tom looks like a man doing a good deed.",
      choices: [
        { label: 'Trust Tom', p: 2, v: 4, steals: 1, easy: 1, msg: "Of course. He's one of the nicest people alive. You think about it for longer than you'd like." },
        { label: 'Ask for an inventory', p: 6, v: -4, msg: "A spreadsheet arrives within the minute. It's very thorough, and it doesn't add up." }
      ] },
    { id: 'pizza', who: ['don', 'tom', 'mork'],
      title: 'Order Mork a pizza',
      text: "You can order a pizza straight to Mork's door. Not strictly allowed. Not strictly forbidden either.",
      choices: [
        { label: 'Order it', p: 8, v: 8, msg: "His kid loves you for ten minutes. Mork loves you for longer." },
        { label: 'Pizza for the whole chat', p: 4, v: 12, t: 15, msg: "Three pizzas, three doors, one order. A rare moment of teamwork." }
      ] },
    { id: 'kidsasleep', who: ['mork'], lucky: true,
      title: 'The kid is asleep',
      text: "A miracle: his kid's asleep before 7. Mork sends one message: 'Do not speak to me. On my way.'",
      choices: [
        { label: 'Send nothing. Hold your breath.', p: 25, v: 8, msg: "Even Tom stays quiet. For a full minute, nobody types." }
      ] },
    { id: 'tomback', who: ['tom'],
      title: 'Tom is back',
      text: "Three weeks. No messages, no explanation. Now he's online with a tan, a new watch and a calm you don't trust. 'It was a retreat,' he says.",
      choices: [
        { label: 'Ask where he really was', p: 0, v: -4, msg: "'A retreat.' He says it again, completely straight. The watch is from a shop in Geneva." },
        { label: "Don't ask", p: 2, v: 4, easy: 1, msg: "You don't ask. It's most of why you're still friends." }
      ] },
    { id: 'tomgone', who: ['tom'],
      title: 'Tom has gone quiet',
      text: "Mid-chat, Tom stops replying. 'Last seen 4 minutes ago', for twenty minutes. It's happened before. Last time it lasted three weeks.",
      choices: [
        { label: 'Wait. He always comes back', p: 2, v: 0, t: 15, easy: 1, msg: "He's back with 'sorry, signal'. There was no signal for all of Tuesday." },
        { label: "Message: 'you ok?'", p: 0, v: 3, msg: "'Fine. Away.' He doesn't say from what, or to where." }
      ] }
  ];

  // Tom disappears for weeks at a time and has never explained where
  var TOM_RUMOURS = [
    "Rumour: Tom spent three weeks on a silent retreat. Nobody believes it. Tom isn't silent.",
    "Rumour: Tom was in Lisbon, for work he won't name, with a tan he won't explain.",
    "Tom mentions 'the Geneva thing', then quickly changes the subject.",
    "Tom says a relative of his is wanted by Interpol. 'Different Tom,' he adds, unprompted.",
    "Tom's last known location: 'somewhere warm'. He says it like a password.",
    "Three strangers call Tom one of the nicest guys ever. Two of them are missing a wallet.",
    "Tom sent Mork's family a gift basket. Nobody knows why, and that's what bothers you."
  ];

  // ---------- state ----------

  var g = null;

  function newGame(dayKey) {
    var day = DAYS[dayKey];
    return { dayKey: dayKey, day: day, clock: START, leaveAt: START + WINDOW_MIN, shifts: 0,
      progress: 0, vibes: 40, pool: [], ev: null, phase: 'event', result: null, ending: null, started: false,
      stats: { trees: 0, steals: 0, maybes: 0, easy: 0, lostMin: 0, miniPlayed: 0, miniWon: 0 } };
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
        '<p class="gn-hint" id="gn-hint">TAP SOMEONE ON THE SOFA</p>' +
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
    var d = document.createElement('button');
    d.type = 'button';
    d.className = 'gn-char gn-char-' + id;
    d.setAttribute('aria-label', 'Poke ' + CHARS[id].name);
    d.innerHTML = sprite(CHARS[id].rows, 6) + '<span>' + CHARS[id].name + '</span><small></small><em class="gn-say" aria-live="polite"></em>';
    d.addEventListener('click', function () { poke(id); });
    elCouch.appendChild(d);
    couchEls[id] = d;
  });

  // ---------- poking the sofa ----------

  var QUIPS = {
    don: ["I'm easy.", 'Whatever you lot want.', 'Honestly, any time is fine.', '*sips drink*', "Don't look at me, I'm just here.", 'Seven-thirty-ish. Or not. Easy.'],
    tom: ['Has anyone seen my axe? Not that one. The other one.', "I'll look after that for you.", 'Just one more tree.',
      'Where was I? Nowhere. Next question.', "You're both my best friends. Equally. Mostly.", "Nice watch, isn't it? Gift.",
      'Did someone drop this? Safekeeping.']
  };
  var MORK_QUIPS = {
    'STILL AT WORK': ['On a call. Typing with one hand.', 'Two minutes. (It is never two minutes.)', "Can't talk. Spreadsheet."],
    'COMMUTING': ['On the train. Signal is a rumour.', 'Nearly home. Ish.'],
    'DINNER + BATHS': ['Chicken dipper situation.', 'Someone is wearing the bath.', 'Hands full. Literally.'],
    'BEDTIME': ['One more story. Then I am yours.', "Shh. He's nearly off.", 'The short one. There is no short one.'],
    'IN THE LOBBY': ['…', '(headset on, cannot hear you)', 'Locked in. Do not speak.'],
    'ASLEEP, PAD IN HAND': ['zzz…', '*presses X in his sleep*'],
    'ASLEEP': ['zzz…', '(seen, 11:48 PM)']
  };
  var pokes = { don: 0, tom: 0, mork: 0 }, sayT = {};

  function poke(id) {
    pokes[id]++;
    var line;
    if (id === 'mork') {
      var pool = MORK_QUIPS[morkStatus()] || ["Who's this?"];
      line = pokes.mork % 5 === 0 && !(g && g.ending) ? 'Mork has muted the chat for 1 hour.' : pool[Math.floor(Math.random() * pool.length)];
    } else if (id === 'tom' && pokes.tom % 4 === 0) {
      line = TOM_RUMOURS[Math.floor(Math.random() * TOM_RUMOURS.length)];
    } else {
      line = QUIPS[id][Math.floor(Math.random() * QUIPS[id].length)];
    }
    var el = couchEls[id], b = el.querySelector('.gn-say');
    b.textContent = line;
    b.classList.add('on');
    el.classList.remove('poked');
    void el.offsetWidth;
    el.classList.add('poked');
    window.clearTimeout(sayT[id]);
    sayT[id] = window.setTimeout(function () { b.classList.remove('on'); }, 2800);
    var hint = document.getElementById('gn-hint');
    if (hint) hint.parentNode.removeChild(hint);
  }

  function setStatus() {
    var tomText = g && g.ending ? (g.ending === 'rage' ? 'TOO EXCITED' : 'CHOPPING') : 'BACK FROM A "RETREAT"';
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
      '<h2>WHERE\'S MORK?</h2>' +
      "<p>Kick-off is 7:30. The chat pings at 5:30. Tom is online for the first time in three weeks. He's one of the nicest men alive, and there's a non-zero chance he's robbing you. Mork is the busiest man you know, but once he's in the lobby nothing gets through: no calls, no work, no interruptions. Getting him there is the hard part. You're Don. You're easy.</p>" +
      '<p>Some choices are mini-games. Poke the gang on the sofa any time.</p>' +
      '<div class="gn-choices">' +
        '<button class="gn-btn" data-key="1" data-day="sunday">SUNDAY<small>' + DAYS.sunday.blurb + '</small></button>' +
        '<button class="gn-btn" data-key="2" data-day="wednesday">WEDNESDAY<small>' + DAYS.wednesday.blurb + '</small></button>' +
      '</div>' +
      '<p class="gn-found">Endings found: ' + found + ' / ' + ENDING_COUNT + '</p>';
  }

  function renderEvent() {
    var ev = g.ev;
    setActors(ev);
    renderMeters();
    var html = '<h2>' + esc(ev.title) + '</h2><p>' + esc(ev.text) + '</p><div class="gn-choices">';
    ev.choices.forEach(function (c, i) {
      html += '<button class="gn-btn" data-key="' + (i + 1) + '" data-choice="' + i + '">' + esc(c.label) + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</button>';
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
    var chips = (r.mini ? '<span class="gn-chip ' + (r.mini.win ? 'good">MINI-GAME WON' : 'bad">MINI-GAME LOST') + '</span>' : '') +
      chip('READY', r.p, true) + chip('VIBES', r.v, true);
    if (r.mins > ROUND_MIN) chips += '<span class="gn-chip bad">+' + (r.mins - ROUND_MIN) + ' MIN LOST</span>';
    if (r.d) chips += '<span class="gn-chip neutral">KICK-OFF +' + r.d + ' MIN</span>';
    elCard.innerHTML =
      '<h2>' + esc(g.ev.title) + '</h2>' +
      (r.mini && r.mini.note ? '<p class="gn-note">' + esc(r.mini.note) + '</p>' : '') +
      '<p>' + esc(r.msg) + '</p>' +
      '<p>' + esc(r.trees) + '</p>' +
      '<div class="gn-chips">' + chips + '</div>' +
      '<button class="gn-btn gn-go" data-next="1">CONTINUE</button>';
    floatDelta(elVibes.parentNode, r.v);
    floatDelta(elHp.parentNode, r.p);
    var b = elCard.querySelector('[data-next]');
    if (b) b.focus();
  }

  function floatDelta(anchor, val) {
    if (!val) return;
    var s = document.createElement('span');
    s.className = 'gn-float ' + (val > 0 ? 'good' : 'bad');
    s.textContent = (val > 0 ? '+' : '') + val;
    anchor.appendChild(s);
    window.setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 1300);
  }

  var VERDICT = {
    win: ['MORK IS IN', function () {
      return 'Mork joins at ' + fmtClock(g.clock) + ', headset on, phone in another room. Nothing gets through. Tom takes credit for the whole evening.';
    }],
    late: ['MORK, ARRIVING LATE', function () {
      return "He joins at 8:40, shattered, and plays like a monk. By 9:15 he's asleep with the controller in his hand. Tom plays on and calls it 'his best work'.";
    }],
    noshow: ['NO MORK', function () {
      return 'No reply, no message. Mork is asleep on a sofa somewhere, and probably happier for it. You and Tom play as a pair while Tom explains trees for three hours. See you ' + g.day.next + '.';
    }],
    rage: ["TOM COULDN'T WAIT", function () {
      return "The mood collapsed. Tom, far too wound up, started without Mork, then spent three hours apologising to a man who was asleep and not remotely upset.";
    }]
  };

  function renderEnd() {
    var v = VERDICT[g.ending], st = g.stats;
    setActors(null);
    renderMeters();
    var found = recordEnding(g.ending).length;
    var lines = [
      'Trees felled by Tom: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'Tom took nothing. Either a saint, or <b>very good</b>.'
        : st.steals < 3 ? "Tom 'looked after' <b>" + st.steals + '</b> thing' + (st.steals === 1 ? '' : 's') + '. Probably fine.'
        : "Tom 'looked after' <b>" + st.steals + '</b> things. Chance he is robbing you: <b>non-zero</b>.',
      "Where Tom's been: <b>unconfirmed</b> (retreat, or heist)",
      st.maybes === 0 ? "Mork never said 'maybe'. <b>He knew.</b>" : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>. Very Don.' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>',
      st.easy === 0 ? 'Don decided things. <b>Out of character.</b>' : "Don was 'easy' about it <b>" + st.easy + '</b> time' + (st.easy === 1 ? '' : 's')
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

  function resolve(outcome, mini) {
    g.result = applyEffects(outcome);
    g.result.mini = mini || null;
    g.phase = 'result';
    renderResult();
  }

  function choose(i) {
    var c = g.ev.choices[i];
    if (!c) return;
    if (c.game) { startMini(c); return; }
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

  // ---------- mini-games ----------
  // Each one draws itself into the card, calls done(win, note) once, and
  // returns a cleanup function that stops its timers.

  var mini = null;
  function $(id) { return document.getElementById(id); }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }

  function startMini(choice) {
    var finished = false;
    mini = {};
    mini.cleanup = MINI[choice.game](function (win, note) {
      if (finished) return;
      finished = true;
      if (mini && mini.cleanup) mini.cleanup();
      mini = null;
      g.stats.miniPlayed++;
      if (win) g.stats.miniWon++;
      resolve(win ? choice.ok : choice.bad, { win: win, note: note || '' });
    });
  }

  // drains the #gn-time bar over ms, then calls onEnd
  function countdown(ms, onEnd) {
    var t0 = now(), raf, el = $('gn-time');
    (function tick() {
      var left = 1 - (now() - t0) / ms;
      if (el) el.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) { onEnd(); return; }
      raf = window.requestAnimationFrame(tick);
    })();
    return function () { window.cancelAnimationFrame(raf); };
  }

  var MINI = {};

  // Timber! — tap CHOP enough times before the clock runs out
  MINI.timber = function (done) {
    var TAPS = 20, taps = 0, t0 = now();
    elCard.innerHTML =
      '<div class="gn-mini"><h2>TIMBER!</h2><p>Tap CHOP ' + TAPS + ' times before the tree wins.</p>' +
      '<div class="gn-bar gn-wide gn-timer"><i id="gn-time"></i></div>' +
      '<button class="gn-btn gn-big" id="gn-act">CHOP</button>' +
      '<div class="gn-bar gn-wide"><i id="gn-prog" style="width:0"></i></div>' +
      '<p id="gn-info">0 / ' + TAPS + '</p></div>';
    var btn = $('gn-act');
    btn.focus();
    btn.addEventListener('click', function () {
      taps++;
      $('gn-prog').style.width = Math.min(100, taps / TAPS * 100) + '%';
      $('gn-info').textContent = taps + ' / ' + TAPS;
      btn.classList.remove('hit');
      void btn.offsetWidth;
      btn.classList.add('hit');
      if (taps >= TAPS) done(true, 'Felled in ' + ((now() - t0) / 1000).toFixed(1) + ' seconds.');
    });
    return countdown(5000, function () { done(false, taps + ' / ' + TAPS + ' chops. The tree stands.'); });
  };

  // Catch him typing — stop a sweeping marker inside Mork's "typing…" window
  MINI.typing = function (done) {
    var hits = 0, misses = 0, pos = 0, dir = 1, speed = 0.75, zone, last = now(), raf, flashT;
    elCard.innerHTML =
      '<div class="gn-mini"><h2>CATCH HIM TYPING</h2>' +
      "<p>Mork's 'typing…' flickers on and off. Hit SEND while the marker is inside his window. Two hits and you have him; two misses and he's gone.</p>" +
      '<div class="gn-track" id="gn-track"><b id="gn-zone">typing…</b><i id="gn-mark"></i></div>' +
      '<p id="gn-info">Hits 0 · Misses 0</p>' +
      '<button class="gn-btn gn-big" id="gn-act">SEND</button></div>';
    var mark = $('gn-mark'), zoneEl = $('gn-zone'), track = $('gn-track'), btn = $('gn-act');
    function newZone() {
      var w = 0.24 - hits * 0.06;
      zone = { x: 0.04 + Math.random() * (0.92 - w), w: w };
      zoneEl.style.left = zone.x * 100 + '%';
      zoneEl.style.width = zone.w * 100 + '%';
    }
    newZone();
    (function tick() {
      var t = now(), dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      pos += dir * speed * dt;
      if (pos > 1) { pos = 1; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      mark.style.left = pos * 100 + '%';
      raf = window.requestAnimationFrame(tick);
    })();
    btn.focus();
    btn.addEventListener('click', function () {
      var hit = pos >= zone.x && pos <= zone.x + zone.w;
      if (hit) hits++; else misses++;
      track.className = 'gn-track ' + (hit ? 'hit' : 'miss');
      window.clearTimeout(flashT);
      flashT = window.setTimeout(function () { track.className = 'gn-track'; }, 300);
      $('gn-info').textContent = (hit ? 'Delivered! ' : 'He stopped typing. ') + 'Hits ' + hits + ' · Misses ' + misses;
      if (hits >= 2) { done(true, 'Both messages landed mid-typing. He felt seen.'); return; }
      if (misses >= 2) { done(false, "Both messages arrived while he wasn't looking."); return; }
      speed *= 1.35;
      newZone();
    });
    return function () { window.cancelAnimationFrame(raf); window.clearTimeout(flashT); };
  };

  // Grab it — reaction test against Tom's hands
  MINI.grab = function (done) {
    var shown = false, t0 = 0, waitT, loseT, LIMIT = 600;
    elCard.innerHTML =
      '<div class="gn-mini"><h2>GRAB IT</h2>' +
      "<p>The sword is about to drop again. Tap GRAB the moment it appears. Too early and Tom 'looks after it'.</p>" +
      '<div class="gn-arena" id="gn-arena"><span>WAIT FOR IT…</span></div>' +
      '<button class="gn-btn gn-big" id="gn-act">GRAB</button></div>';
    var arena = $('gn-arena'), btn = $('gn-act');
    btn.focus();
    waitT = window.setTimeout(function () {
      shown = true;
      t0 = now();
      arena.innerHTML = sprite(SWORD, 6);
      arena.classList.add('drop');
      loseT = window.setTimeout(function () { done(false, "Too slow. Tom's hand was already there. It's always already there."); }, LIMIT);
    }, 1200 + Math.random() * 2300);
    btn.addEventListener('click', function () {
      if (!shown) { done(false, 'Too early. Tom catches the sword, beams at you, and pockets it.'); return; }
      done(true, 'Grabbed in ' + Math.round(now() - t0) + ' ms. Tom applauds, sincerely.');
    });
    return function () { window.clearTimeout(waitT); window.clearTimeout(loseT); };
  };

  // Dishwasher dash — tap the plates before they go
  MINI.dishes = function (done) {
    var NEED = 10, MS = 9000, loaded = 0, spawnT, hideT = {}, t0 = now();
    var html = '<div class="gn-mini"><h2>DISHWASHER DASH</h2><p>Mork is on video, loading. Tap each dirty plate before it slides away. ' +
      NEED + ' plates and he is free.</p><div class="gn-bar gn-wide gn-timer"><i id="gn-time"></i></div><div class="gn-grid" id="gn-grid">';
    for (var i = 0; i < 9; i++) html += '<button type="button" class="gn-slot" data-slot="' + i + '" aria-label="Empty rack"></button>';
    elCard.innerHTML = html + '</div><p id="gn-info">0 / ' + NEED + ' plates</p></div>';
    var grid = $('gn-grid'), slots = grid.children;
    function clear(k) {
      window.clearTimeout(hideT[k]);
      slots[k].classList.remove('on');
      slots[k].setAttribute('aria-label', 'Empty rack');
    }
    function spawn() {
      var empty = [];
      for (var j = 0; j < slots.length; j++) if (!slots[j].classList.contains('on')) empty.push(j);
      if (empty.length) {
        var k = empty[Math.floor(Math.random() * empty.length)];
        slots[k].classList.add('on');
        slots[k].setAttribute('aria-label', 'Dirty plate');
        hideT[k] = window.setTimeout(function () { clear(k); }, 1150);
      }
      spawnT = window.setTimeout(spawn, 360 + Math.random() * 320);
    }
    grid.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.gn-slot') : null;
      if (!b || !b.classList.contains('on')) return;
      clear(+b.getAttribute('data-slot'));
      loaded++;
      $('gn-info').textContent = loaded + ' / ' + NEED + ' plates';
      if (loaded >= NEED) done(true, 'Loaded with ' + Math.max(0, (MS - (now() - t0)) / 1000).toFixed(1) + ' seconds to spare.');
    });
    spawn();
    var stop = countdown(MS, function () { done(false, loaded + ' / ' + NEED + ' plates. A pan remains. There is always a pan.'); });
    return function () {
      stop();
      window.clearTimeout(spawnT);
      Object.keys(hideT).forEach(function (k) { window.clearTimeout(hideT[k]); });
    };
  };

  // Breathe with Tom — hold to grow the circle, release inside the gold ring
  MINI.breathe = function (done) {
    var GROW = 2200, MAX = 1.08, LO = 0.66, HI = 0.86, good = 0, bad = 0, holding = false, t0 = 0, size = 0, raf;
    elCard.innerHTML =
      '<div class="gn-mini"><h2>BREATHE WITH TOM</h2>' +
      '<p>Hold the button to breathe in. Let go while the circle is inside the gold ring. Two good breaths and Tom is calm.</p>' +
      '<div class="gn-lung"><b></b><i id="gn-breath"></i></div>' +
      '<p id="gn-info">Good 0 · Bad 0</p>' +
      '<button type="button" class="gn-btn gn-big gn-hold" id="gn-act">HOLD</button></div>';
    var btn = $('gn-act'), circle = $('gn-breath');
    function draw() {
      circle.style.transform = 'translate(-50%, -50%) scale(' + size + ')';
      circle.className = holding ? (size >= LO && size <= HI ? 'grow in' : 'grow') : '';
    }
    function tick() {
      size = Math.min(MAX, (now() - t0) / GROW);
      draw();
      if (size >= MAX) { release(); return; }
      raf = window.requestAnimationFrame(tick);
    }
    function press() {
      if (holding) return;
      holding = true;
      t0 = now();
      btn.textContent = 'BREATHE IN…';
      raf = window.requestAnimationFrame(tick);
    }
    function release() {
      if (!holding) return;
      holding = false;
      window.cancelAnimationFrame(raf);
      var ok = size >= LO && size <= HI;
      if (ok) good++; else bad++;
      $('gn-info').textContent = (ok ? 'Lovely. ' : size < LO ? 'Too shallow. ' : 'Too much. Tom is now dizzy. ') + 'Good ' + good + ' · Bad ' + bad;
      btn.textContent = 'HOLD';
      size = 0;
      draw();
      if (good >= 2) done(true, 'Two slow breaths. Tom is, briefly, at peace.');
      else if (bad >= 2) done(false, 'Tom hyperventilates with joy.');
    }
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      press();
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) press();
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      release();
    });
    btn.focus();
    draw();
    return function () { window.cancelAnimationFrame(raf); };
  };

  elCard.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-day')) { g = newGame(t.getAttribute('data-day')); nextRound(); }
    else if (t.hasAttribute('data-choice')) choose(parseInt(t.getAttribute('data-choice'), 10));
    else if (t.hasAttribute('data-next')) nextRound();
    else if (t.hasAttribute('data-again')) { elCard.removeAttribute('data-ending'); renderIntro(); }
  });

  // number keys pick a choice
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || mini) return;
    var n = parseInt(e.key, 10);
    if (!(n >= 1)) return;
    var btns = elCard.querySelectorAll('.gn-choices .gn-btn');
    if (btns[n - 1]) { e.preventDefault(); btns[n - 1].click(); }
  });

  renderIntro();
})();
