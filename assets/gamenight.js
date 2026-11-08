/* Where's Mork? — the two hours between the 17:30 ping and the 19:30 kick-off.
   You are Don. Get the busiest man in the group online before the session
   starts, keep the vibes up, and try not to be the one who decides anything.
   Once Mork is in he is fully locked in, so the whole fight is the lead-up.
   Events are group-chat messages, earlier choices come back later, some launch mini-games, and the gang on the sofa can be poked.
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
  var WIN_READY = 52;           // readiness needed at kick-off for Mork to be on time
  var LATE_READY = 30;          // enough to turn up late and fall asleep on the controller
  var ENDINGS_KEY = 'is-mork-coming-endings';
  var ENDING_COUNT = 5;

  var DAYS = {
    sunday: { name: 'Sunday', next: 'Wednesday', blurb: 'Family dinner, then baths. Mork is a hostage until 7.', workWeight: 1 },
    wednesday: { name: 'Wednesday', next: 'Sunday', blurb: 'Work is overrunning. Mork is a hostage until it stops.', workWeight: 2 },
    birthday: { name: "Tom's birthday", next: 'Sunday', blurb: 'Tom has been waiting for this since his last birthday. Everything is about Tom.', workWeight: 1, special: true, tomBoost: 2.5, vibes: 15, hint: 'Get Mork online once' },
    launch: { name: 'Launch night', next: 'Wednesday', blurb: "Tom's game goes live tonight. Tom is calm in the way a kettle is calm.", workWeight: 1, special: true, tomBoost: 2, vibes: 5, hint: 'Find 3 endings' }
  };
  var DAY_ORDER = ['sunday', 'wednesday', 'birthday', 'launch'];

  // a random wrinkle for every night: nudges the starting numbers and event odds
  var COMPS = [
    { name: 'A quiet night', blurb: 'Nothing is wrong. Be suspicious.', ready: 4, vibes: 6, boost: {} },
    { name: 'The kid has a cold', blurb: "Mork is on tissue duty, and it's all anyone wants to talk about.", ready: -4, boost: { bedtime: 3, dinner: 2, kidsasleep: 0.3 } },
    { name: "Tom hasn't slept", blurb: 'Tom has been awake since Monday. He has plans.', boost: { calm: 3, sermon: 3, tomgame: 3, stream: 2 } },
    { name: 'Tom feels generous', blurb: 'Everything is a gift. Count the gifts.', boost: { generous: 4, steal: 3, inventory: 3, tomloan: 3 } },
    { name: "Don's wifi is a rumour", blurb: 'Your connection is held together by hope.', boost: { update: 6 } },
    { name: 'Mork has a deadline', blurb: "A report is due. Mork will say 'one hour'.", ready: -6, boost: { work: 3, boss: 3, voicenote: 3 } },
    { name: 'Tom is back from "away"', blurb: 'Three weeks gone, and he is feeling chatty.', boost: { tomback: 6, tomgone: 3, tommum: 4, tomalibi: 4 } }
  ];

  var BADGES = [
    { id: 'in', name: 'He Came', desc: 'Get Mork online on time.', test: function (g) { return g.ending === 'win'; } },
    { id: 'late', name: 'Better Late', desc: 'Mork shows up, then falls asleep.', test: function (g) { return g.ending === 'late'; } },
    { id: 'ghost', name: 'Seen at 11:48', desc: 'No Mork at all.', test: function (g) { return g.ending === 'noshow'; } },
    { id: 'heist', name: 'A Very Good Retreat', desc: 'Let Tom leave the party with your things.', test: function (g) { return g.ending === 'heist'; } },
    { id: 'rage', name: 'Too Excited', desc: 'Tom can no longer wait.', test: function (g) { return g.ending === 'rage'; } },
    { id: 'mini3', name: 'Mini-Game Menace', desc: 'Win three mini-games in one night.', test: function (g) { return g.stats.miniWon >= 3; } },
    { id: 'easy3', name: 'Chief Easy Officer', desc: "Be 'easy' about three things in one night.", test: function (g) { return g.stats.easy >= 3; } },
    { id: 'forest', name: 'Forest Management', desc: 'Tom fells 25 trees in a night.', test: function (g) { return g.stats.trees >= 25; } },
    { id: 'decisive', name: 'Suspiciously Decisive', desc: "Win without once being 'easy'.", test: function (g) { return g.ending === 'win' && g.stats.easy === 0; } },
    { id: 'early', name: 'Early Doors', desc: 'Get Mork online before 7:15 PM.', test: function (g) { return g.ending === 'win' && g.clock <= 19 * 60 + 15; } },
    { id: 'mum', name: 'Hi Boys!', desc: "Meet Tom's mum.", test: function (g) { return !!g.seen.tommum; } },
    { id: 'plus', name: 'Nicest Man Alive', desc: 'Receive a gift from Tom.', test: function (g) { return !!g.seen.generous; } },
    { id: 'bday', name: 'Many Happy Returns', desc: "Play Tom's birthday.", test: function (g) { return g.dayKey === 'birthday'; } },
    { id: 'launch', name: 'Day One Patch', desc: 'Play launch night.', test: function (g) { return g.dayKey === 'launch'; } },
    { id: 'both', name: 'Every Day Is Game Day', desc: 'Win on a Sunday and a Wednesday.', test: function (g, wins) { return wins.indexOf('sunday') > -1 && wins.indexOf('wednesday') > -1; } },
    { id: 'all', name: 'Completionist', desc: 'Find all five endings.', test: function (g, wins, ends) { return ends.length >= ENDING_COUNT; } }
  ];
  var BADGES_KEY = 'where-is-mork-badges', WINS_KEY = 'where-is-mork-wins', BEST_KEY = 'where-is-mork-best', SFX_KEY = 'where-is-mork-sfx';
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
  // An event is a bit of group chat: `chat` is a list of [who, text] messages
  // ('sys' for notifications), `text` is a short dry aside from Don.
  // A choice has a `label` (the action), an optional `say` (the message Don
  // actually sends) and its outcome: p = Mork readiness, v = vibes,
  // t = extra minutes lost, d = kick-off pushed back, counters (steals, maybes,
  // easy), `re` = the replies that come back, `msg` = Don's aside, and `set` =
  // a flag that makes a later callback event possible (`req`).
  // A choice can carry ok/bad outcomes instead, decided by luck (`risk`) or a
  // mini-game (`game`).

  var EVENTS = [
    { id: 'ping', first: true, who: ['don', 'tom'],
      title: '5:30 PM. The group chat',
      chat: [['sys', 'Game Night. 5:30 PM'], ['tom', "Hello my friends!! I've been online since 2. Tonight is going to be special."], ['tom', 'Who is in??']],
      text: "Two hours to kick-off. Mork hasn't been seen since breakfast.",
      choices: [
        { label: 'Send the casual invite', say: "7:30 as usual. You in?", p: 8, v: 2,
          re: [['tom', "In. I was in before you asked."], ['mork', '👍']], msg: "Mork reacted to Tom's message, not yours. Close enough." },
        { label: 'Let Tom write it', say: 'Tom, you do it.', p: -2, v: 8, set: 'gathering',
          re: [['tom', 'Brothers. Tonight we gather. Not for the game, but for what the game means. 7:30. Bring snacks and an open heart.'], ['mork', 'is this a cult']],
          msg: 'Mork will need time to process that.' }
      ] },
    { id: 'seen', who: ['mork'],
      title: 'Mork has read it',
      chat: [['sys', '✓✓ Seen by Mork, 5:41 PM']],
      text: "Nothing else. That's normal for him. It isn't a yes.",
      choices: [
        { label: 'Wait', p: 2, v: 0, easy: 1, msg: 'You wait. The two ticks stare back at you.' },
        { label: 'Send a gif', say: '[gif: man in a headset, nodding slowly]', p: 5, v: 4, re: [['mork', '😂']], msg: "One laughing emoji. For Mork, that's progress." },
        { label: "Catch him while he's typing", sub: 'Mini-game: timing', game: 'typing',
          ok: { p: 12, v: 4, re: [['mork', 'ok yeah go on then']], msg: "Four words. From Mork, that's a speech." },
          bad: { p: 0, v: -3, re: [['sys', 'Mork is typing…'], ['sys', '(stopped)']], msg: 'Probably a work email.' } }
      ] },
    { id: 'work', who: ['mork'], work: true,
      title: 'Mork is stuck at work',
      chat: [['mork', 'just finishing something']],
      text: "It's 5:50. He said the same at 5:15.",
      choices: [
        { label: 'Offer to push kick-off to 8:00', say: 'Mate, we can do 8 if you need it.', p: 12, v: -3, d: 30, next: 'prepare',
          re: [['tom', '8 is perfect. I need the time to prepare.']], msg: "He doesn't say what for." },
        { label: "Tell him we'll hold his seat", say: "No rush. Seat's yours.", p: 6, v: 3, re: [['mork', 'cheers mate']] }
      ] },
    { id: 'boss', who: ['mork'], work: true,
      title: 'The boss walks past',
      chat: [['mork', 'boss just walked past'], ['mork', 'pretending to work'], ['mork', '🫡']],
      choices: [
        { label: 'Go quiet', say: '(silence)', p: 8, v: 0, re: [['mork', '…ta']], msg: 'The boss walks on. Mork breathes.' },
        { label: 'Send a meme to cover for him', sub: 'Risky', risk: 0.5, say: '[meme: this is fine]',
          ok: { p: 10, v: 6, re: [['mork', 'he saw it. he laughed. he wants a copy']], msg: 'Mork is now the office comedian.' },
          bad: { p: -4, v: -4, re: [['mork', 'he saw it. we are having a meeting about it tomorrow']], msg: 'Not the meme he needed.' } }
      ] },
    { id: 'dinner', who: ['mork'],
      title: "Dinner for one small person",
      chat: [['mork', '[photo: a plate of chicken dippers]']],
      text: "No caption. You know a cry for help when you see one.",
      choices: [
        { label: 'Suggest takeaway', say: 'Just get a pizza in, mate.', p: 8, v: -2, re: [['mork', 'ordered. 25 mins']], msg: 'Sorted in under a minute. The man gets things done.' },
        { label: 'Leave him to it', p: 2, v: 2, msg: 'Dinner gets made eventually. Nobody speaks.' }
      ] },
    { id: 'bedtime', who: ['mork', 'tom'],
      title: 'Bedtime story',
      chat: [['mork', "kid wants one more story. i've read this one six times this week"]],
      choices: [
        { label: 'Tom offers to read it on a call', say: 'Tom, can you do the voices?', set: 'kidname', p: 4, v: 8,
          re: [['tom', 'Gather round, little one…'], ['mork', "he's actually brilliant at this"]], msg: "The kid asks for Tom again. Tom promises to 'remember his name'." },
        { label: 'Tell him to read the short one', say: 'Read the short one.', p: 8, v: -3, t: 15, re: [['mork', 'there is no short one Don']], msg: 'There is a short one.' }
      ] },
    { id: 'partner', who: ['mork'],
      title: 'The dishwasher clause',
      chat: [['mork', "can play once the dishwasher's done"], ['mork', "the dishwasher is never done"]],
      choices: [
        { label: 'Help him load it over video', sub: 'Mini-game: tap the plates', game: 'dishes',
          ok: { p: 14, v: 5, re: [['mork', 'right. ten minutes']], msg: "He shuts the door like he's closing a vault." },
          bad: { p: 4, v: -2, t: 15, re: [['mork', 'still going']], msg: 'You can hear the cutlery drawer from here.' } },
        { label: 'Remind him nothing gets through once he is in', say: "Once you're in, nothing gets you. Phone in a drawer.", p: 5, v: 4,
          re: [['mork', '…true actually']] },
        { label: 'Tell him to leave it', say: 'Leave it, mate.', p: 10, v: -6, re: [['mork', 'tomorrow-me is going to hate you']] }
      ] },
    { id: 'headset', who: ['mork'],
      title: 'Where is the headset',
      chat: [['mork', "can't find my headset"], ['mork', 'looked everywhere']],
      choices: [
        { label: 'Suggest the kid\'s toy box', say: "Check the toy box.", p: 10, v: 2, re: [['mork', "found it. how did you know"]], msg: "You didn't. It's just where everything ends up." },
        { label: 'Suggest earbuds', say: 'Just use earbuds.', p: 4, v: 0, re: [['mork', 'one of them is chewed']], msg: 'Technically a solution.' }
      ] },
    { id: 'voicenote', who: ['mork'],
      title: 'A voice note from Mork',
      chat: [['mork', '🎤 Voice message (4:12)']],
      text: 'Mork has never sent a voice note in his life.',
      choices: [
        { label: 'Listen to all of it', p: 8, v: 4, t: 15, msg: "Mostly him walking. At 3:50 he says 'see you at half seven'. That's the whole thing." },
        { label: "Send 'tl;dr?'", say: 'tl;dr?', p: 4, v: -2, re: [['mork', 'tl;dr: yes']] }
      ] },
    { id: 'easy', who: ['don'],
      title: 'What time are we starting?',
      chat: [['mork', 'whenever'], ['tom', 'NOW']],
      text: 'Both are waiting for Don.',
      choices: [
        { label: "Say you're easy", say: "I'm easy.", p: 2, v: -2, t: 15, easy: 1, msg: 'Fifteen minutes pass. Nobody picks a time.' },
        { label: 'Say 7:30', say: '7:30. Like always.', p: 8, v: -2, re: [['tom', "…who are you and what have you done with Don"]] }
      ] },
    { id: 'maybe', who: ['mork'],
      title: "Mork says 'maybe'",
      chat: [['mork', 'maybe']],
      text: "His maybes come good about 40% of the time. The rest he falls asleep.",
      choices: [
        { label: 'Accept the maybe', say: "Maybe's fine.", p: 3, v: 0, maybes: 1, msg: 'You pencil him in. Very light pencil.' },
        { label: 'Send a beer emoji', say: '🍺', p: 6, v: 3, maybes: 1, re: [['mork', '🍺'], ['mork', 'ok maybe is a yes']] }
      ] },
    { id: 'update', who: ['don'],
      title: 'The update',
      chat: [['sys', 'PS5: system update required (38 GB)'], ['sys', 'Estimated time: 2 hours 40 minutes']],
      text: "Your console. Of course it's your console.",
      choices: [
        { label: 'Restart the console', sub: 'Risky', risk: 0.5,
          ok: { p: 6, v: 4, re: [['sys', 'Update complete']], msg: 'It works. Nobody knows why.' },
          bad: { p: 0, v: -3, t: 15, re: [['sys', 'Update required (38 GB)']], msg: 'Back to the start.' } },
        { label: 'Blame the router', say: "It's the router.", p: 0, v: 3, re: [['tom', "It's always the router"]], msg: 'Tom blames the router for most things.' }
      ] },
    { id: 'calm', who: ['tom'],
      title: 'Tom is far too excited',
      chat: [['tom', 'TONIGHT IS GOING TO BE THE BEST NIGHT IN HISTORY'], ['tom', 'I made a playlist. And a banner.']],
      choices: [
        { label: 'Calm Tom down', sub: 'Mini-game: hold and release', game: 'breathe',
          ok: { p: 2, v: 10, set: 'banner', re: [['tom', "…you're right. Breathe."]], msg: "He folds the banner up carefully. 'For later.'" },
          bad: { p: 0, v: 1, re: [['tom', 'warming up!!']], msg: 'Tom breathes very fast and very keenly.' } },
        { label: 'Let him run with it', p: -4, v: -6, re: [['tom', 'A SPEECH:']], msg: 'It is about destiny.' }
      ] },
    { id: 'sermon', who: ['tom'],
      title: 'Tom has called a meeting',
      chat: [['tom', 'Brothers. A thought.'], ['tom', 'What if the game is a metaphor?']],
      text: 'Nobody asked for a meeting.',
      choices: [
        { label: 'Hear him out', say: 'Go on then.', p: -2, v: 6, t: 15, msg: "Forty minutes later you're agreeing with him, somehow." },
        { label: 'Ask him to chop something instead', say: 'Go chop something, mate.', p: 2, v: 4, re: [['tom', '…yes. Trees. Always trees.']] }
      ] },
    { id: 'tomgame', who: ['tom'],
      title: 'Tom has made a game',
      chat: [['tom', "Little thing. I've made a game. It's about friendship."], ['tom', 'Playtest it?']],
      text: "It's 800 MB and has one level: a forest.",
      choices: [
        { label: 'Playtest it', say: 'Send me the build.', p: -2, v: 8, t: 15, re: [['tom', 'Be honest. Be kind. Be honest.']], msg: "It's a tree-chopping game. It's good. That's the worst part." },
        { label: 'Not now', say: 'After the match, mate.', p: 4, v: -2, re: [['tom', 'Of course. Of course.']], msg: 'He says it three times, quieter each time.' }
      ] },
    { id: 'stream', who: ['tom'],
      title: 'Tom is live',
      chat: [['tom', 'going live!! 🔴'], ['sys', 'Viewers: 1']],
      text: 'The one viewer is his mum.',
      choices: [
        { label: 'Join the stream', p: 0, v: 8, re: [['tom', 'Welcome Don!! Chat, say hi to Don!'], ['sys', 'Tom\'s mum: hi Don']] },
        { label: 'Mute it', p: 2, v: -2, msg: 'You mute it. Tom can tell.' }
      ] },
    { id: 'chop', who: ['tom'], chop: true,
      title: 'Tom is chopping trees',
      chat: [['tom', 'found a really good forest. back soon!']],
      text: "He's logged in early and is chopping alone in the game. Been at it since two.",
      choices: [
        { label: 'Join him', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, msg: 'Two grown men, one tree, total silence. Best part of the night.' },
          bad: { p: 0, v: 3, msg: "Tom out-chops you and says nothing. He doesn't need to." } },
        { label: 'Leave him to it', p: 0, v: 2, easy: 1, msg: "You're relaxed about it. The tree isn't." }
      ] },
    { id: 'generous', who: ['tom', 'mork'],
      title: "Tom paid for Mork's PS Plus",
      chat: [['tom', 'Mork is now on PS Plus for a year. You are welcome.'], ['tom', "No no, don't thank me"]],
      text: "Tom is one of the nicest people alive. There's also a non-zero chance this isn't what it looks like.",
      choices: [
        { label: 'Thank him', say: 'Tom. Mate. That is incredibly kind.', set: 'login', p: 8, v: 8,
          re: [['tom', "Anything for my friends. Quick thing: what's Mork's login? For the renewal."]] },
        { label: 'Ask what the catch is', say: "What's the catch?", p: 2, v: -2, steals: 1,
          re: [['tom', 'No catch!'], ['tom', "Gift card. Don't ask where from."]] }
      ] },
    { id: 'steal', who: ['tom'],
      title: 'That sword was yours',
      chat: [['sys', 'Legendary Sword picked up by DON'], ['sys', "Legendary Sword is now in TOM's inventory"], ['tom', 'Safekeeping :)']],
      choices: [
        { label: 'Let it slide', say: 'Fine, keep it.', set: 'swords', p: 3, v: 3, steals: 1, easy: 1,
          re: [['tom', 'Here. Three smaller swords. As an apology.']], msg: "It isn't even." },
        { label: 'Grab it back', sub: 'Mini-game: reaction', game: 'grab',
          ok: { p: 10, v: 2, re: [['tom', "Of course!! It's yours!"]], msg: 'Almost too thrilled for you.' },
          bad: { p: 0, v: -8, t: 15, steals: 1, re: [['tom', 'Thank you for the sword!! ❤️']], msg: "He hugs you and is gone. You're not sure who won." } }
      ] },
    { id: 'inventory', who: ['tom', 'mork'],
      title: "Tom is 'looking after' Mork's stuff",
      chat: [["tom", "Don't worry about Mork's things. I'm looking after them."], ['tom', 'All forty items. Perfectly safe.']],
      text: "Mork hasn't noticed.",
      choices: [
        { label: 'Trust Tom', say: 'Cheers Tom.', p: 2, v: 4, steals: 1, easy: 1, re: [['tom', '❤️']], msg: "You think about it longer than you'd like." },
        { label: 'Ask for a list', say: 'Send me a list.', p: 6, v: -4, re: [['tom', '[inventory.xlsx]']], msg: "Very thorough. Doesn't add up." }
      ] },
    { id: 'pizza', who: ['don', 'tom', 'mork'],
      title: 'Order Mork a pizza',
      chat: [['tom', "Can we send a pizza to Mork's door? Is that allowed?"]],
      text: 'Not strictly allowed. Not strictly forbidden.',
      choices: [
        { label: 'Order one for Mork', p: 8, v: 8, re: [['mork', 'DON.'], ['mork', '(thank you)']], msg: 'His kid loves you for ten minutes. Mork loves you for longer.' },
        { label: 'Pizza for the whole chat', p: 4, v: 12, t: 15, msg: 'Three pizzas, three doors, one order. Rare teamwork.' }
      ] },
    { id: 'kidsasleep', who: ['mork'], lucky: true,
      title: 'The kid is asleep',
      chat: [['mork', 'kid is ASLEEP'], ['mork', 'do not speak to me. on my way']],
      choices: [
        { label: 'Send nothing. Hold your breath.', p: 25, v: 8, re: [['sys', 'Tom is typing…'], ['sys', '(stopped)']], msg: 'Even Tom stays quiet.' }
      ] },
    { id: 'tomback', who: ['tom'],
      title: 'Tom is back',
      chat: [['tom', 'Hey all! Back!'], ['tom', 'Was on a retreat.']],
      text: "Three weeks. No messages. He's online with a tan, a new watch and a calm you don't trust.",
      choices: [
        { label: 'Ask where he really was', say: 'Where were you, really?', p: 0, v: -4, re: [['tom', 'A retreat.'], ['tom', 'A very good retreat.']], msg: 'The watch is from a shop in Geneva.' },
        { label: "Don't ask", say: 'Good to have you back.', p: 2, v: 4, easy: 1, msg: "It's most of why you're still friends." }
      ] },
    { id: 'tomgone', who: ['tom'],
      title: 'Tom has gone quiet',
      chat: [['sys', 'Tom: last seen 4 minutes ago']],
      text: "It's been 20 minutes. This has happened before. Last time it lasted three weeks.",
      choices: [
        { label: 'Wait. He always comes back', p: 2, v: 0, t: 15, easy: 1, re: [['tom', 'sorry, signal']], msg: 'There was no signal for all of Tuesday.' },
        { label: "Ask if he's ok", say: 'you ok?', p: 0, v: 3, re: [['tom', 'Fine. Away.']], msg: "He doesn't say from what, or to where." }
      ] },

    // callbacks: these only show up once an earlier choice has set the flag
    { id: 'banner', req: 'banner', who: ['tom'],
      title: 'The banner',
      chat: [['tom', "It's time for the banner."]],
      text: 'The folded banner returns.',
      choices: [
        { label: 'Let him unfurl it', p: -2, v: 8, re: [['mork', "…it says WELCOME MORK. that's actually nice"]], msg: 'The banner is eleven feet long.' },
        { label: 'Ask him to wait for Mork', say: 'Save it for when Mork is in.', p: 4, v: 4, re: [['tom', 'Patience. That is the lesson.']] }
      ] },
    { id: 'kidpic', req: 'kidname', who: ['mork', 'tom'],
      title: 'A picture from the kid',
      chat: [['mork', 'kid drew a picture'], ['mork', "it's Tom. with an axe. says it's 'Uncle Tom, the tree man'"]],
      choices: [
        { label: 'Show Tom', say: '[photo: a stick man with a very large axe]', p: 6, v: 10, re: [['tom', "I'm going to cry."]], msg: 'Tom is quiet for six whole minutes.' },
        { label: 'Keep it quiet', p: 4, v: 0, msg: "You don't want to be responsible for what Tom does next." }
      ] },
    { id: 'smallswords', req: 'swords', who: ['tom', 'mork'],
      title: 'About those swords',
      chat: [['mork', 'where did my three swords go'], ['tom', "I don't know. Don, did you get any?"]],
      text: "The smaller swords. He gave you Mork's.",
      choices: [
        { label: 'Say nothing', p: 4, v: 4, steals: 1, msg: "You say nothing. This makes you part of it." },
        { label: 'Give them back', say: "I think I've got them, sorry.", p: 6, v: -2, re: [['mork', 'ok. thanks']], msg: "Tom does not comment, but he writes something down." }
      ] },
    { id: 'login', req: 'login', who: ['mork', 'tom'],
      title: 'A sign-in alert',
      chat: [['sys', "New sign-in on Mork's account: Geneva, Switzerland"], ['mork', 'why is someone logging in from switzerland']],
      text: "The renewal check.",
      choices: [
        { label: 'Blame the VPN', say: "That'll be a VPN thing.", p: 4, v: 2, re: [['tom', 'VPN. Definitely.']] },
        { label: 'Ask Tom nicely', say: 'Tom. Mate.', p: 8, v: -2, steals: 1, re: [['tom', "Fine. It's a shared account now. In spirit."]] }
      ] },
    { id: 'tomloan', who: ['tom'],
      title: 'Tom needs a quick favour',
      chat: [['tom', 'Quick question. Can you lend me £40 until the retreat?'], ['tom', "I'll pay you back with interest. In logs."]],
      choices: [
        { label: 'Lend it', say: 'Go on then.', p: 0, v: 4, steals: 1, next: 'loanrepay' },
        { label: "Say you're skint", say: "I'm skint, mate.", p: 2, v: -1, re: [['tom', 'Understood. Respect.'], ['tom', '(what about Mork)']], msg: 'Mork is about to have a very long evening.' }
      ] },
    { id: 'poll', who: ['tom'],
      title: 'Tom has started a poll',
      chat: [['tom', 'Poll: what shall we play first?'], ['sys', '1. Chopping trees   2. Wood   3. Forestry']],
      text: 'All the options are trees.',
      choices: [
        { label: 'Vote for chopping trees', p: 2, v: 6, re: [['tom', 'The people have spoken. And the people are right.']] },
        { label: 'Vote for wood', p: 2, v: 6, re: [['tom', '…wood. You understand me.']] },
        { label: 'Suggest a different game', say: 'Could we play something else?', p: 6, v: -8, re: [['tom', '…']], msg: 'The silence lasts about a hundred years.' }
      ] },
    { id: 'tommum', who: ['tom'],
      title: "Tom's mum has joined the chat",
      chat: [['sys', "Tom's mum joined the chat"], ['mum', 'Hi boys!'], ['mum', 'Is Tom with you? He told me he was going to Lisbon.']],
      choices: [
        { label: "Say he's here", say: "He's here! Chopping trees.", p: 2, v: 4, re: [['mum', 'Oh good. Tell him the neighbour has asked about the watch.']], msg: 'Tom has left the chat. Not for long.' },
        { label: "Say you haven't seen him", say: "Haven't seen him in weeks.", p: 0, v: -2, re: [['mum', 'Typical.']] }
      ] },
    { id: 'newgame', who: ['mork', 'tom'],
      title: 'Mork wants a different game',
      chat: [['mork', 'what about something different tonight'], ['mork', 'something calmer. a farming one']],
      text: 'Tom is typing…',
      choices: [
        { label: "Back Mork's idea", say: 'Farming sounds nice, actually.', p: 10, v: -6, re: [['tom', 'Farming involves trees.'], ['tom', 'I accept.']], msg: 'Tom accepts, slowly, like a man signing a contract.' },
        { label: "Back Tom's idea", say: "Same as always. It's tradition.", p: -4, v: 6, re: [['mork', 'fine. same as always']], msg: 'Mork gives in. He always does.' }
      ] },
    { id: 'tomalibi', who: ['tom'],
      title: 'Tom has an alibi',
      chat: [['tom', 'Just so you know, I was at home all last Thursday.'], ['tom', 'Alone. Watching a documentary.']],
      text: 'Nobody asked.',
      choices: [
        { label: "Say 'nobody asked'", say: 'Nobody asked, Tom.', p: 2, v: -2, re: [['tom', 'Good. That is good.']] },
        { label: "Say 'okay'", say: 'Okay.', p: 2, v: 2, re: [['tom', 'Thank you. That is all I wanted.'], ['tom', 'A nature one.']], msg: 'You now have an alibi you did not request.' }
      ] },
    { id: 'tomcook', who: ['tom'],
      title: 'Tom is cooking for everyone',
      chat: [["tom", "Cooking for everyone tonight. Recipe's below."], ['sys', "[Tom's recipe: bread, butter, faith]"]],
      text: 'You are all in different houses. The food will not reach anyone.',
      choices: [
        { label: 'Cook along', say: "I'll cook along.", p: 0, v: 8, t: 15, re: [['tom', 'Beautiful. Now add the faith.']] },
        { label: 'Order a curry', say: "I'm ordering a curry.", p: 4, v: -2, re: [['tom', 'A curry can be a kind of faith.']] }
      ] },

    // scenes: reached through a `next` from another choice
    { id: 'loanrepay', scene: true, who: ['tom'],
      title: 'Tom has repaid you',
      chat: [['tom', 'Repaid!'], ['sys', 'Tom sent you 12 Logs']],
      text: "That's… a fair exchange?",
      choices: [
        { label: 'Accept the logs', p: 0, v: 6, re: [['tom', 'I knew you were a good egg.']] },
        { label: 'Ask for the £40', say: 'The £40, Tom.', p: 2, v: -4, re: [['tom', 'Money is just logs that haven\'t grown up yet.']] }
      ] },
    { id: 'prepare', scene: true, who: ['tom'],
      title: 'Tom has prepared',
      chat: [['tom', "I've prepared a presentation."], ['sys', 'Slide 1 of 47']],
      text: 'It is about the evening ahead.',
      choices: [
        { label: 'Sit through it', p: 6, v: 6, t: 15, re: [['tom', 'Slide 12 is the important one.']], msg: 'Slide 12 is a picture of a tree.' },
        { label: 'Skip to the end', say: 'Skip to the last slide.', p: 2, v: -2, re: [['tom', 'The last slide is also a tree.']] }
      ] },

    // callbacks from earlier choices
    { id: 'gathering', req: 'gathering', who: ['mork', 'tom'],
      title: 'The Gathering went wide',
      chat: [['mork', 'tom emailed my boss'], ['mork', 'subject line: DESTINY'], ['mork', 'he replied all']],
      text: "'The Gathering' has 41 recipients.",
      choices: [
        { label: 'Ask Tom to recall it', say: 'Tom. Recall the email.', p: 6, v: -2, re: [['tom', 'Recalling would be a betrayal of the message.']], msg: 'It cannot be recalled.' },
        { label: "Tell Mork it's an honour", say: "Honestly, your boss being invited is an honour.", p: 2, v: 4, re: [['mork', 'he asked if he can come']], msg: 'You now have a plus-one problem.' }
      ] },

    // special nights
    { id: 'cake', only: 'birthday', who: ['tom'],
      title: 'Tom has ordered himself a cake',
      chat: [['tom', 'Quick announcement.'], ['tom', "I've ordered myself a cake."], ['sys', "[photo: a cake with Tom's face on it]"]],
      text: "It's a very good likeness.",
      choices: [
        { label: 'Sing happy birthday', p: -2, v: 10, t: 15, re: [['tom', 'Louder. Mork can hear us from here.']] },
        { label: 'Ask who paid', say: 'Who paid for that?', p: 2, v: -2, steals: 1, re: [['tom', 'A friend. A very generous friend.']], msg: 'It is not clear which friend.' }
      ] },
    { id: 'toast', only: 'birthday', who: ['tom'],
      title: 'Tom has a toast',
      chat: [['tom', 'A toast.'], ['tom', 'To the nicest man who has ever lived.'], ['tom', 'I will not say who.']],
      choices: [
        { label: 'Raise a glass', p: 0, v: 8, t: 15, msg: 'You raise a glass. He cries. It takes a while.' },
        { label: 'Heckle gently', say: 'We know, Tom.', p: 4, v: -2, re: [['tom', 'The heckler is also my friend.']] }
      ] },
    { id: 'wish', only: 'birthday', who: ['tom', 'mork'],
      title: 'Tom is making a wish',
      chat: [['tom', 'Everyone make a wish.'], ['tom', 'Mine is a secret.'], ['tom', 'It involves the Geneva thing.']],
      choices: [
        { label: 'Wish for Mork to show up', p: 12, v: 4, re: [['mork', 'why did my phone just light up']], msg: 'Wishes work if you do the other 80%.' },
        { label: 'Wish for a quiet night', p: 4, v: 6, msg: 'You wish for a quiet night. You have the wrong friends for that.' }
      ] },
    { id: 'bug', only: 'launch', who: ['tom'],
      title: "Tom's game has a bug",
      chat: [['tom', 'Small thing.'], ['tom', 'The trees cannot be chopped.']],
      text: "It's a tree-chopping game. That's the whole game.",
      choices: [
        { label: 'Report the bug', say: 'The trees need to be choppable, Tom.', p: 2, v: 4, re: [['tom', 'The trees are choosing not to be.']] },
        { label: 'Call it a feature', say: "It's a feature. The trees have rights.", p: -2, v: 10, re: [['tom', '…the trees have rights.']], msg: 'This may be Tom\'s best idea yet.' }
      ] },
    { id: 'reviews', only: 'launch', who: ['tom'],
      title: 'The first review',
      chat: [['sys', '★★★★★ "Best game ever made. My friend Tom made it." (user: TomsOtherAccount)']],
      choices: [
        { label: 'Say nothing', p: 2, v: 4, easy: 1, msg: 'You say nothing. Everyone is on the same page.' },
        { label: 'Point it out', say: "That's your other account, Tom.", p: 4, v: -4, re: [['tom', 'It is my friend. He is also called Tom.']] }
      ] },
    { id: 'crash', only: 'launch', who: ['tom', 'don'],
      title: 'The servers are down',
      chat: [['tom', 'The servers are down.'], ['tom', 'The servers are your console, Don.'], ['tom', 'Is it plugged in?']],
      choices: [
        { label: 'Restart', sub: 'Risky', risk: 0.5,
          ok: { p: 6, v: 8, re: [['tom', 'IT LIVES']], msg: 'It lives.' },
          bad: { p: 0, v: -4, t: 15, re: [['tom', 'I am not angry. I am a tree. I am calm.']], msg: 'It does not live.' } },
        { label: 'Blame the router', say: "It's the router.", p: 0, v: 3, re: [['tom', "It's always the router."]] }
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
    var day = DAYS[dayKey], comp = COMPS[Math.floor(Math.random() * COMPS.length)];
    return { dayKey: dayKey, day: day, comp: comp, clock: START, leaveAt: START + WINDOW_MIN, shifts: 0,
      progress: clamp(comp.ready || 0, 0, 100), vibes: 40 + (day.vibes || 0) + (comp.vibes || 0), pool: [], queue: [], seen: {}, ev: null, phase: 'event', result: null, ending: null, started: false,
      flags: {}, stats: { trees: 0, steals: 0, maybes: 0, easy: 0, lostMin: 0, miniPlayed: 0, miniWon: 0 } };
  }

  function fmtClock(m) {
    var h = Math.floor(m / 60) % 24, mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function pickEvent() {
    if (!g.started) { g.started = true; return EVENTS.filter(function (e) { return e.first; })[0]; }
    function byId(id) { return EVENTS.filter(function (e) { return e.id === id; })[0]; }
    function ok(e) { return !e.scene && (!e.req || g.flags[e.req]) && (!e.only || e.only === g.dayKey); }
    if (g.queue.length) {
      var qe = byId(g.queue.shift()), qi = g.pool.indexOf(qe.id);
      if (qi > -1) g.pool.splice(qi, 1);
      return qe;
    }
    var cand = g.pool.map(byId).filter(ok);
    if (!cand.length) {
      g.pool = EVENTS.filter(function (e) { return !e.first; }).map(function (e) { return e.id; });
      cand = g.pool.map(byId).filter(ok);
    }
    var weights = cand.map(function (e) {
      var w = e.lucky ? 0.5 : 1;
      if (e.work) w *= g.day.workWeight;
      if (e.req || e.only) w *= 4; // callbacks and special-night events should actually land
      if (g.comp.boost[e.id] !== undefined) w *= g.comp.boost[e.id];
      if (g.day.tomBoost && e.who.indexOf('tom') > -1) w *= g.day.tomBoost;
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total, i = 0;
    while (i < cand.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    g.pool.splice(g.pool.indexOf(cand[i].id), 1);
    return cand[i];
  }

  // where Mork is, as the evening wears on
  function morkStatus() {
    if (g && g.ending === 'win') return 'ONLINE';
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

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
  }
  function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
  function unlocked(dayKey) {
    if (dayKey === 'birthday') return endingsFound().indexOf('win') > -1;
    if (dayKey === 'launch') return endingsFound().length >= 3;
    return true;
  }

  // ---------- sound (tiny synth, off by default) ----------

  var sfxOn = false, ac = null;
  try { sfxOn = localStorage.getItem(SFX_KEY) === '1'; } catch (e) { /* ignore */ }
  function tone(freq, dur, type, vol, delay) {
    if (!sfxOn) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = ac || new AC();
      if (ac.state === 'suspended' && ac.resume) ac.resume();
      var o = ac.createOscillator(), gain = ac.createGain(), t0 = ac.currentTime + (delay || 0);
      o.type = type || 'square';
      o.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.04, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gain);
      gain.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  var SFX = {
    pop: function () { tone(880, 0.05); },
    click: function () { tone(520, 0.05); },
    good: function () { tone(523, 0.09); tone(659, 0.09, 0, 0, 0.09); tone(784, 0.14, 0, 0, 0.18); },
    bad: function () { tone(330, 0.12, 'sawtooth'); tone(220, 0.22, 'sawtooth', 0.04, 0.12); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.16, 'square', 0.05, i * 0.13); }); },
    lose: function () { [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.06, i * 0.16); }); }
  };
  function sfx(name) { if (sfxOn && SFX[name]) SFX[name](); }

  // ---------- rendering ----------

  root.innerHTML =
    '<div class="gn">' +
      '<div class="gn-top">' +
        '<div class="gn-clock" id="gn-clock"></div>' +
        '<button type="button" class="gn-snd" id="gn-snd" aria-pressed="false"></button>' +
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
    d.innerHTML = sprite(CHARS[id].rows, 6) + '<span>' + CHARS[id].name + '</span><small></small><i class="gn-tally"></i><em class="gn-say" aria-live="polite"></em>';
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
    'ONLINE': ['…', '(headset on, cannot hear you)', 'Locked in. Do not speak.'],
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
    if (!g) setHint('');
  }
  function setHint(text) {
    var h = document.getElementById('gn-hint');
    if (!h) return;
    h.textContent = text;
    h.style.display = text ? '' : 'none';
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

  function renderTallies() {
    var st = g ? g.stats : null;
    couchEls.don.querySelector('.gn-tally').textContent = st ? "EASY x" + st.easy : '';
    couchEls.tom.querySelector('.gn-tally').textContent = st ? '\ud83c\udf32 ' + st.trees + '  \ud83c\udf92 ' + st.steals : '';
    couchEls.tom.querySelector('.gn-tally').classList.toggle('hot', !!st && st.steals >= 3);
    couchEls.mork.querySelector('.gn-tally').textContent = st ? "MAYBE x" + st.maybes : '';
  }
  function renderSnd() {
    var b = document.getElementById('gn-snd');
    b.textContent = sfxOn ? 'SOUND ON' : 'SOUND OFF';
    b.setAttribute('aria-pressed', sfxOn ? 'true' : 'false');
  }
  document.getElementById('gn-snd').addEventListener('click', function () {
    sfxOn = !sfxOn;
    try { localStorage.setItem(SFX_KEY, sfxOn ? '1' : '0'); } catch (e) { /* ignore */ }
    renderSnd();
    sfx('good');
  });
  renderSnd();

  function renderMeters() {
    setStatus();
    renderTallies();
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
    cancelReveal();
    g = null;
    setActors(null);
    renderMeters();
    setHint(pokes.don + pokes.tom + pokes.mork ? '' : 'TAP SOMEONE ON THE SOFA');
    var found = endingsFound().length, earned = loadJSON(BADGES_KEY, []), best = loadJSON(BEST_KEY, {});
    var buttons = DAY_ORDER.map(function (k, i) {
      var d = DAYS[k], bt = best[k] ? ' · BEST ' + best[k] : '';
      if (!unlocked(k)) return '<button class="gn-btn gn-locked" disabled>LOCKED<small>' + d.hint + '</small></button>';
      return '<button class="gn-btn" data-key="' + (i + 1) + '" data-day="' + k + '">' + d.name.toUpperCase() + bt + '<small>' + d.blurb + '</small></button>';
    }).join('');
    var badgeList = BADGES.map(function (bd) {
      var has = earned.indexOf(bd.id) > -1;
      return '<li class="' + (has ? 'got' : '') + '">' + (has ? '<b>' + bd.name + '</b> ' : '??? ') + bd.desc + '</li>';
    }).join('');
    elCard.innerHTML =
      '<h2>WHERE\'S MORK?</h2>' +
      "<p>Kick-off is 7:30. The chat pings at 5:30. Tom is online for the first time in three weeks. He's one of the nicest men alive, and there's a non-zero chance he's robbing you. Mork is the busiest man you know, but once he's online nothing gets through: no calls, no work, no interruptions. Getting him there is the hard part. You're Don. You're easy.</p>" +
      '<div class="gn-choices">' + buttons + '</div>' +
      '<details class="gn-badges"><summary>Badges: ' + earned.length + ' / ' + BADGES.length + '</summary><ul>' + badgeList + '</ul></details>' +
      '<p class="gn-found">Endings found: ' + found + ' / ' + ENDING_COUNT + '. Tom never forgets a favour. Poke the gang on the sofa any time.</p>';
  }

  var reveal = null;
  function cancelReveal() { if (reveal) { reveal.stop(); reveal = null; } }

  var NAMES = { don: 'Don', tom: 'Tom', mork: 'Mork', mum: "Tom's mum", sys: '' };
  function msgHtml(m) {
    return '<div class="gn-msg gn-msg-' + m[0] + '">' + (NAMES[m[0]] ? '<b>' + NAMES[m[0]] + '</b>' : '') + '<span>' + esc(m[1]) + '</span></div>';
  }
  function typingHtml(who) {
    return '<div class="gn-msg gn-msg-' + who + ' gn-typing"><b>' + NAMES[who] + '</b><span><i></i><i></i><i></i></span></div>';
  }
  // messages arrive one at a time with a typing indicator; any tap or key skips ahead
  function revealChat(box, list, done) {
    cancelReveal();
    var i = 0, timer = 0, typing = null, over = false;
    function drop() { if (typing && typing.parentNode) typing.parentNode.removeChild(typing); typing = null; }
    function scroll() { elCard.scrollTop = elCard.scrollHeight; }
    function end() {
      if (over) return;
      over = true;
      window.clearTimeout(timer);
      drop();
      for (; i < list.length; i++) box.insertAdjacentHTML('beforeend', msgHtml(list[i]));
      reveal = null;
      done();
    }
    function step() {
      drop();
      if (i >= list.length) { end(); return; }
      var m = list[i], sys = m[0] === 'sys';
      if (!sys) { box.insertAdjacentHTML('beforeend', typingHtml(m[0])); typing = box.lastChild; scroll(); }
      timer = window.setTimeout(function () {
        drop();
        box.insertAdjacentHTML('beforeend', msgHtml(m));
        i++;
        sfx('pop');
        scroll();
        timer = window.setTimeout(step, 220);
      }, sys ? 280 : 380 + Math.min(1000, m[1].length * 14));
    }
    if (REDUCED || !list.length) { end(); return; }
    reveal = { skip: end, stop: function () { over = true; window.clearTimeout(timer); } };
    step();
  }
  function afterChat(box, list, cb) {
    var after = elCard.querySelector('.gn-after');
    revealChat(box, list, function () {
      if (after) after.classList.remove('pending');
      cb();
    });
  }

  function renderEvent() {
    var ev = g.ev;
    setActors(ev);
    renderMeters();
    var narr = (ev.first ? 'Tonight: ' + g.comp.name + '. ' + g.comp.blurb + ' ' : '') + (ev.text || '');
    var html = '<h2>' + esc(ev.title) + '</h2><div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (narr ? '<p class="gn-nar">' + esc(narr) + '</p>' : '') + '<div class="gn-choices">';
    ev.choices.forEach(function (c, i) {
      html += '<button class="gn-btn" data-key="' + (i + 1) + '" data-choice="' + i + '">' + esc(c.label) + (c.sub ? '<small>' + esc(c.sub) + '</small>' : '') + '</button>';
    });
    elCard.innerHTML = html + '</div></div>';
    elCard.scrollTop = 0;
    afterChat($('gn-chat'), ev.chat || [], function () { elCard.scrollTop = elCard.scrollHeight; });
  }

  function chip(label, val, goodWhenPositive) {
    if (!val) return '';
    var good = goodWhenPositive ? val > 0 : val < 0;
    return '<span class="gn-chip ' + (good ? 'good' : 'bad') + '">' + label + ' ' + (val > 0 ? '+' : '') + val + '</span>';
  }

  function flash(who, cls) {
    who.forEach(function (id) {
      var el = couchEls[id];
      el.classList.remove('poked', 'ring');
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(function () { el.classList.remove(cls); }, 900);
    });
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
      '<div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (r.msg ? '<p class="gn-nar">' + esc(r.msg) + '</p>' : '') +
      '<p class="gn-aside">' + esc(r.trees) + '</p>' +
      '<div class="gn-chips">' + chips + '</div>' +
      '<button class="gn-btn gn-go" data-next="1">CONTINUE</button></div>';
    elCard.scrollTop = 0;
    afterChat($('gn-chat'), (r.say ? [['don', r.say]] : []).concat(r.re || []), function () {
      floatDelta(elVibes.parentNode, r.v);
      floatDelta(elHp.parentNode, r.p);
      var net = r.p + r.v;
      flash(g.ev.who, net >= 4 ? 'poked' : net < 0 ? 'ring' : 'poked');
      sfx(net >= 6 ? 'good' : net < 0 ? 'bad' : 'click');
      elCard.scrollTop = elCard.scrollHeight;
      var b = elCard.querySelector('[data-next]');
      if (b) b.focus({ preventScroll: true });
    });
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
    heist: ['TOM HAS LEFT THE PARTY', function () {
      return "Around eight, Tom's status changes to 'Away'. Your inventory is lighter. So is Mork's. The last message in the chat is a photo of a beach. " +
        (g.morkIn ? 'Mork is online and has noticed nothing. ' : '') + "He'll be back in about three weeks with a tan. 'A retreat,' he'll say.";
    }],
    rage: ["TOM COULDN'T WAIT", function () {
      return "The mood collapsed. Tom, far too wound up, started without Mork, then spent three hours apologising to a man who was asleep and not remotely upset.";
    }]
  };

  function scoreOf() {
    var base = g.ending === 'win' ? 50 : g.ending === 'late' ? 20 : 0;
    return base + Math.round(g.progress) + Math.round(g.vibes / 2) + g.stats.miniWon * 5 + (g.ending === 'heist' ? -10 : 0);
  }

  function renderEnd() {
    cancelReveal();
    var v = VERDICT[g.ending], st = g.stats;
    setActors(null);
    renderMeters();
    var found = recordEnding(g.ending);
    var wonDays = loadJSON(WINS_KEY, []);
    if (g.ending === 'win' && wonDays.indexOf(g.dayKey) === -1) { wonDays.push(g.dayKey); saveJSON(WINS_KEY, wonDays); }
    var earned = loadJSON(BADGES_KEY, []), fresh = [];
    BADGES.forEach(function (bd) {
      if (earned.indexOf(bd.id) === -1 && bd.test(g, wonDays, found)) { earned.push(bd.id); fresh.push(bd); }
    });
    if (fresh.length) saveJSON(BADGES_KEY, earned);
    var score = scoreOf(), best = loadJSON(BEST_KEY, {}), isBest = !best[g.dayKey] || score > best[g.dayKey];
    if (isBest) { best[g.dayKey] = score; saveJSON(BEST_KEY, best); }
    g.shareText = ['WHERE\'S MORK? ' + g.day.name, v[0], fmtClock(g.clock) + '  \ud83c\udf32 ' + st.trees + '  \ud83c\udf92 ' + st.steals + '  \ud83c\udfae ' + st.miniWon + '/' + st.miniPlayed,
      'Score ' + score, 'https://dpt106.github.io/game-night/'].join('\n');
    var lines = [
      'Tonight: <b>' + g.comp.name + '</b>',
      'Trees felled by Tom: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'Tom took nothing. Either a saint, or <b>very good</b>.'
        : st.steals < 3 ? "Tom 'looked after' <b>" + st.steals + '</b> thing' + (st.steals === 1 ? '' : 's') + '. Probably fine.'
        : "Tom 'looked after' <b>" + st.steals + '</b> things. Chance he is robbing you: <b>non-zero</b>.',
      "Where Tom's been: <b>unconfirmed</b> (retreat, or heist)",
      st.maybes === 0 ? "Mork never said 'maybe'. <b>He knew.</b>" : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>. Very Don.' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>',
      st.easy === 0 ? 'Don decided things. <b>Out of character.</b>' : "Don was 'easy' about it <b>" + st.easy + '</b> time' + (st.easy === 1 ? '' : 's')
    ];
    var rank = g.ending === 'heist' ? "Tom's accomplice (unwitting)" : st.miniWon >= 3 ? 'Mini-game menace' : st.easy >= 3 ? 'Chief Easy Officer' :
      g.ending === 'win' && st.easy === 0 ? 'Decisive. Suspiciously.' : g.ending === 'win' ? 'Reasonably chill' : g.ending === 'rage' ? 'Tom wrangler (failed)' : 'Easy';
    lines.push('Don is now: <b>' + rank + '</b>');
    elCard.setAttribute('data-ending', g.ending);
    elCard.innerHTML =
      '<h2>' + v[0] + '</h2><p>' + v[1]() + '</p>' +
      '<p class="gn-score">SCORE <b>' + score + '</b>' + (isBest ? ' <span class="gn-new">NEW BEST</span>' : ' · BEST ' + best[g.dayKey]) + '</p>' +
      (fresh.length ? '<div class="gn-chips">' + fresh.map(function (bd) { return '<span class="gn-chip good" title="' + bd.desc + '">NEW BADGE: ' + bd.name.toUpperCase() + '</span>'; }).join('') + '</div>' : '') +
      '<ul class="gn-stats">' + lines.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
      '<div class="gn-choices"><button class="gn-btn gn-go" data-again="1">PLAY AGAIN</button>' +
      '<button class="gn-btn gn-go gn-alt" data-copy="1">COPY RESULT</button></div>' +
      '<p class="gn-found">Endings found: ' + found.length + ' / ' + ENDING_COUNT + ' · Badges: ' + earned.length + ' / ' + BADGES.length + '</p>';
    sfx(g.ending === 'win' ? 'win' : g.ending === 'late' ? 'good' : 'lose');
    elCard.scrollTop = 0;
    var b = elCard.querySelector('[data-again]');
    if (b) b.focus({ preventScroll: true });
  }

  // ---------- game flow ----------

  function applyEffects(o) {
    var p = (o.p || 0) + BASE_READY, v = (o.v || 0) + BASE_VIBES, mins = ROUND_MIN + (o.t || 0);
    g.progress = clamp(g.progress + p, 0, 100);
    g.vibes = clamp(g.vibes + v, 0, 100);
    g.clock += mins;
    if (o.d && g.shifts < 2) { g.leaveAt += o.d; g.shifts++; }
    if (o.set) g.flags[o.set] = 1;
    if (o.next) g.queue.push(o.next);
    g.stats.steals += o.steals || 0;
    g.stats.maybes += o.maybes || 0;
    g.stats.easy += o.easy || 0;
    g.stats.lostMin += o.t || 0;
    var trees = 1 + Math.floor(Math.random() * 4);
    g.stats.trees += trees;
    var aside = 'Meanwhile, Tom fells ' + trees + ' tree' + (trees === 1 ? '' : 's') + ' in the game.';
    if (Math.random() < 0.2) aside = TOM_RUMOURS[Math.floor(Math.random() * TOM_RUMOURS.length)];
    return { p: p, v: v, d: o.d || 0, mins: mins, msg: o.msg, re: o.re, trees: aside };
  }

  function resolve(outcome, mini, say) {
    g.result = applyEffects(outcome);
    g.result.say = say || '';
    g.result.mini = mini || null;
    g.phase = 'result';
    renderResult();
  }

  function choose(i) {
    var c = g.ev.choices[i];
    if (!c) return;
    if (c.game) { startMini(c); return; }
    if (c.risk) { resolve(Math.random() < c.risk ? c.ok : c.bad, null, c.say); return; }
    resolve(c, null, c.say);
  }

  function nextRound() {
    function finish(key) {
      g.morkIn = g.progress >= WIN_READY;
      g.ending = g.stats.steals >= 3 && key !== 'rage' ? 'heist' : key;
      renderEnd();
    }
    if (g.progress >= 100) { finish('win'); return; }
    if (g.vibes <= 0) { finish('rage'); return; }
    if (g.clock >= g.leaveAt) {
      finish(g.progress >= WIN_READY ? 'win' : g.progress >= LATE_READY ? 'late' : 'noshow');
      return;
    }
    g.ev = pickEvent();
    g.seen[g.ev.id] = 1;
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
      resolve(win ? choice.ok : choice.bad, { win: win, note: note || '' }, choice.say);
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

  function copyResult(btn) {
    var text = g && g.shareText;
    if (!text) return;
    function ok() { btn.textContent = 'COPIED!'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, function () { window.prompt('Copy your result:', text); });
    else window.prompt('Copy your result:', text);
  }

  elCard.addEventListener('click', function (e) {
    if (reveal) { reveal.skip(); return; }
    var t = e.target.closest ? e.target.closest('button') : null;
    if (!t) return;
    if (t.hasAttribute('data-day')) { g = newGame(t.getAttribute('data-day')); setHint('TONIGHT: ' + g.comp.name.toUpperCase()); sfx('click'); nextRound(); }
    else if (t.hasAttribute('data-copy')) copyResult(t);
    else if (t.hasAttribute('data-choice')) choose(parseInt(t.getAttribute('data-choice'), 10));
    else if (t.hasAttribute('data-next')) nextRound();
    else if (t.hasAttribute('data-again')) { elCard.removeAttribute('data-ending'); renderIntro(); }
  });

  // number keys pick a choice
  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || mini) return;
    if (reveal && (e.key === ' ' || e.key === 'Enter' || e.key >= '1' && e.key <= '9')) { e.preventDefault(); reveal.skip(); return; }
    var n = parseInt(e.key, 10);
    if (!(n >= 1)) return;
    var btns = elCard.querySelectorAll('.gn-choices .gn-btn');
    if (btns[n - 1]) { e.preventDefault(); btns[n - 1].click(); }
  });

  renderIntro();
})();
