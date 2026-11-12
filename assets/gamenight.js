/* Where's Mork? — the two hours between the 17:30 ping and the 19:30 kick-off.
   Play as Don (easy, decides nothing) or Tom (nicest man alive, possibly a
   thief). Get the busiest man in the group online before the session starts
   and keep the vibes up. Once Mork is in he is fully locked in, so the whole
   fight is the lead-up. Mork's evening runs in order (work, train, dinner,
   bedtime), the last fifteen minutes are a final push, earlier choices come
   back later, some launch mini-games, and the gang on the sofa can be poked.
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
  var WIN_READY = 64;           // readiness needed at kick-off for Mork to be on time
  var LATE_READY = 42;          // enough to turn up late and fall asleep on the controller
  var ENDINGS_KEY = 'is-mork-coming-endings';
  var ENDING_COUNT = 5;
  var PLAYER_KEY = 'where-is-mork-player';

  var DAYS = {
    sunday: { name: 'Sunday', next: 'Wednesday', blurb: 'Family dinner, then baths. Mork is a hostage until 7.', workWeight: 1 },
    wednesday: { name: 'Wednesday', next: 'Sunday', blurb: 'Work is overrunning. Mork is a hostage until it stops.', workWeight: 2 },
    birthday: { name: "Tom's birthday", next: 'Sunday', blurb: { don: 'Tom has been waiting for this since his last birthday. Everything is about Tom.', tom: "It's your birthday. Everything is about you, as it should be." }, workWeight: 1, special: true, tomBoost: 2.5, vibes: 15, hint: 'Get Mork online once' },
    launch: { name: 'Launch night', next: 'Wednesday', blurb: { don: "Tom's game goes live tonight. Tom is calm in the way a kettle is calm.", tom: "Your game goes live tonight. You're calm in the way a kettle is calm." }, workWeight: 1, special: true, tomBoost: 2, vibes: 5, hint: 'Find 3 endings' }
  };
  var DAY_ORDER = ['sunday', 'wednesday', 'birthday', 'launch'];

  // a random wrinkle for every night: nudges the starting numbers and event odds
  var COMPS = [
    { name: 'A quiet night', blurb: "Nothing's gone wrong yet. Be suspicious.", ready: 4, vibes: 6, boost: {} },
    { name: 'The little one has a cold', blurb: "Mork's on tissue duty tonight.", ready: -4, boost: { bedtime: 3, dinner: 2, kidsasleep: 0.3 } },
    { name: 'Golf has moved', blurb: { don: "Mork's kid has a golf lesson at a new time. Mork found out at 5.", tom: "Mork's kid has a golf lesson at a new time. Mork found out at 5." }, ready: -4, boost: { golf: 6, cantmake: 2 } },
    { name: { don: "Tom's been busy", tom: "You've been busy" }, blurb: { don: "Tom's been working on something. He'd love your thoughts.", tom: "You've been working on something. You'd love their thoughts." }, boost: { calm: 3, tomgame: 4, stream: 3 } },
    { name: { don: "Tom's short this month", tom: "You're short this month" }, blurb: { don: 'Tom has a few small favours to ask.', tom: 'You have a few small favours to ask.' }, boost: { lend: 4, gift: 3, loot: 3, orange: 3, belts: 3, tomloan: 4 } },
    { name: 'The council have written', blurb: { don: "Tom's had a letter about his trees.", tom: "You've had a letter about your trees." }, boost: { council: 6, chop: 3 } },
    { name: "Don's wifi is a rumour", blurb: { don: 'Your connection is held together by hope.', tom: "Don's connection is held together by hope." }, boost: { update: 6 } },
    { name: 'Mork has a deadline', blurb: "There's a report due. Mork will say 'one hour'.", ready: -6, boost: { presentation: 4, boss: 3, voicenote: 3 } },
    { name: { don: 'Tom is back', tom: "You're back" }, blurb: { don: "Tom's in a chatty mood after his time away.", tom: "You're in a chatty mood after your time away." }, boost: { tomback: 6, tomgone: 3, tommum: 4 } }
  ];
  // the game you're all on at the moment, until you get bored of it
  var GAMES = {
    borderlands: { name: 'Borderlands' },
    satisfactory: { name: 'Satisfactory' },
    bigwalk: { name: 'Big Walk' }
  };
  var GAME_ORDER = ['borderlands', 'satisfactory', 'bigwalk'];

  var BADGES = [
    { id: 'in', name: 'He Came', desc: 'Get Mork online on time.', test: function (g) { return g.ending === 'win'; } },
    { id: 'late', name: 'Better Late', desc: 'Mork shows up, then falls asleep.', test: function (g) { return g.ending === 'late'; } },
    { id: 'ghost', name: 'Seen at 11:48', desc: 'No Mork at all.', test: function (g) { return g.ending === 'noshow'; } },
    { id: 'heist', name: 'Gaming This Eve?', desc: 'As Don, lend Tom enough that he goes quiet for a while.', test: function (g) { return g.ending === 'heist' && g.player === 'don'; } },
    { id: 'mastermind', name: 'Mastermind (Alleged)', desc: 'As Tom, end the night with very full pockets.', test: function (g) { return g.ending === 'heist' && g.player === 'tom'; } },
    { id: 'saint', name: 'Saint Tom', desc: 'As Tom, get Mork online without borrowing a single thing.', test: function (g) { return g.player === 'tom' && g.ending === 'win' && g.stats.steals === 0; } },
    { id: 'rage', name: 'Too Excited', desc: 'Tom can no longer wait.', test: function (g) { return g.ending === 'rage'; } },
    { id: 'mini3', name: 'Mini-Game Menace', desc: 'Win three mini-games in one night.', test: function (g) { return g.stats.miniWon >= 3; } },
    { id: 'easy3', name: 'Chief Easy Officer', desc: "As Don, be 'easy' about three things in one night.", test: function (g) { return g.player === 'don' && g.stats.easy >= 3; } },
    { id: 'forest', name: 'Preservation Order', desc: 'Tom takes down 3 trees in one night.', test: function (g) { return g.stats.trees >= 3; } },
    { id: 'decisive', name: 'Suspiciously Decisive', desc: "As Don, win without once being 'easy'.", test: function (g) { return g.player === 'don' && g.ending === 'win' && g.stats.easy === 0; } },
    { id: 'early', name: 'Early Doors', desc: 'Get Mork online before 7:15 PM.', test: function (g) { return g.ending === 'win' && g.clock <= 19 * 60 + 15; } },
    { id: 'mum', name: 'Hi Boys!', desc: "Meet Tom's mum.", test: function (g) { return !!g.seen.tommum; } },
    { id: 'plus', name: 'Nicest Man Alive', desc: 'See Tom send Mork a present.', test: function (g) { return !!g.seen.gift; } },
    { id: 'lastcall', name: 'Last Orders', desc: 'Win on the final fifteen minutes.', test: function (g) { return g.ending === 'win' && !!g.clutch; } },
    { id: 'bday', name: 'Many Happy Returns', desc: "Play Tom's birthday.", test: function (g) { return g.dayKey === 'birthday'; } },
    { id: 'launch', name: 'Day One Patch', desc: 'Play launch night.', test: function (g) { return g.dayKey === 'launch'; } },
    { id: 'twosides', name: 'Both Sides of the Sofa', desc: 'Get Mork online as Don and as Tom.', test: function (g, wins) { return wins.indexOf('as-don') > -1 && wins.indexOf('as-tom') > -1; } },
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
  // ('sys' for notifications, 'me' for the player, 'pal' for the other friend
  // on the sofa), `text` is a short dry aside to the player.
  // A choice has a `label` (the action), an optional `say` (the message the
  // player actually sends) and its outcome: p = Mork readiness, v = vibes,
  // t = extra minutes lost, d = kick-off pushed back, counters (steals, maybes,
  // easy), `re` = the replies that come back, `msg` = the aside, and `set` =
  // a flag that makes a later callback event possible (`req`).
  // A choice can carry ok/bad outcomes instead, decided by luck (`risk`) or a
  // mini-game (`game`).
  //
  // Who you play changes the story:
  //   as: 'don' | 'tom'      the event only happens when playing that character
  //   { don: x, tom: y }     any field can be split by who you are playing
  //   {me} {pal} {ME}        the player's / the other friend's name in any text
  // Tom's own version of an event has the same id plus '_t', so a night's
  // wrinkles (COMPS) boost both.
  //   when: [from, to]       minutes after 5:30 when the event can happen, so
  //                          Mork's evening runs work → commute → dinner → bed

  // Voices: Mork writes proper, considerate sentences (with an &), replies
  // late and explains what's keeping him. Don is lowercase and replies with
  // gifs. Tom texts short and friendly, and is lovely about everything.
  // Things lent to Tom have a way of turning up on eBay. Nobody ever says so.
  //   game: 'borderlands' | 'satisfactory' | 'bigwalk'   only on that game's nights
  var EVENTS = [
    // ----- openers -----
    { id: 'ping', first: true, as: 'don', who: ['don', 'tom'],
      title: '5:30 PM. The group chat',
      chat: [['sys', 'Game Night · 5:30 PM'], ['tom', 'Gaming this eve?']],
      text: "It's the first anyone has heard from Tom in three weeks. Nobody mentions it.",
      choices: [
        { label: 'Reply with a gif', say: '[gif: OKIDAY]', p: 6, v: 4, next: 'morkreply',
          re: [['react', '❤️ 1'], ['sys', '✓✓ Seen by Mork']] },
        { label: 'Ask Tom to do a proper invite', say: 'tom do a proper invite', p: -2, v: 8, set: 'gathering', next: 'morkreply',
          re: [['tom', "Done! Sent it to everyone in my contacts so nobody's left out ❤️"]] }
      ] },
    { id: 'ping_t', first: true, as: 'tom', who: ['tom', 'don'],
      title: '5:30 PM. The group chat',
      chat: [['sys', 'Game Night · 5:30 PM']],
      text: "You haven't posted in three weeks. There's no need to go into that.",
      choices: [
        { label: 'Gaming this eve?', say: 'Gaming this eve?', p: 6, v: 4, next: 'morkreply',
          re: [['don', '[gif: OKIDAY]'], ['sys', '✓✓ Seen by Mork']] },
        { label: 'Send a proper invite to everyone', say: "Game night, 7:30! Sent it round to everyone in my contacts so nobody's left out ❤️", p: -2, v: 8, set: 'gathering', next: 'morkreply',
          re: [['don', '[gif: OKIDAY]']] }
      ] },

    // ----- Mork's evening, roughly in order -----
    { id: 'morkreply', scene: true, who: ['mork'],
      title: 'Mork has replied',
      chat: [['mork', "Sorry, only just seen this. I'll try, I've still got some work to finish & it's my turn to do bedtime. Should be ok for 7:30 though"], ['react', '👍 2']],
      choices: [
        { label: 'Thumbs up and leave him to it', p: 6, v: 2, easy: { don: 1 } },
        { label: 'Offer to start at 8 instead', say: { don: 'we can do 8 if that helps', tom: 'We can do 8 if that helps!' }, p: 10, v: -3, d: 30,
          re: [['mork', "That would really help actually, thank you"], ['pal', { don: "8 it is. Gives me time to finish a tree", tom: 'fine by me' }]] }
      ] },
    { id: 'seen', who: ['mork'], when: [15, 45],
      title: 'Still nothing from Mork',
      chat: [['sys', '✓✓ Seen by Mork']],
      choices: [
        { label: 'Leave it', p: 2, v: 0, easy: { don: 1 }, msg: 'He reads everything. He answers when he can.' },
        { label: 'Send a gif', say: '[gif: man in a headset, nodding slowly]', p: 5, v: 4, re: [['mork', '😂']] },
        { label: "Catch him while he's typing", sub: 'Mini-game: timing', game: 'typing',
          ok: { p: 12, v: 4, re: [['mork', 'Go on then, I should be able to make it']] },
          bad: { p: 0, v: -3, re: [['sys', 'Mork is typing…'], ['sys', '(stopped)']] } }
      ] },
    { id: 'presentation', who: ['mork'], work: true, when: [0, 60],
      title: 'The presentation',
      chat: [['mork', "Sorry lads, I've got a presentation to finish for tomorrow"], ['mork', 'Should be done by 7 if it behaves']],
      choices: [
        { label: 'Offer to proofread it', say: { don: "send it over, i'll proofread", tom: "Send it over! I'll have a look" }, p: 4, v: 4,
          re: [['mork', "That's kind, but it's 60 slides on quarterly forecasting"], ['pal', { don: "I've done one with 47 slides. Happy to share tips", tom: 'good luck with that' }]] },
        { label: 'Tell him no rush', say: { don: "no rush, we'll be on whenever", tom: "No rush! We'll be on whenever" }, p: 8, v: 2, re: [['mork', 'Cheers, appreciate it']] }
      ] },
    { id: 'boss', who: ['mork'], work: true, when: [0, 45],
      title: 'Still at the office',
      chat: [['mork', 'Boss has just come over for "a quick chat"'], ['mork', "So that's 20 minutes gone"]],
      choices: [
        { label: 'Go quiet and let him escape', p: 8, v: 0, re: [['mork', "Ok, he's gone. Heading off now"]] },
        { label: 'Send a meme to keep his spirits up', sub: 'Risky', risk: 0.5, say: '[meme: this is fine]',
          ok: { p: 10, v: 6, re: [['mork', 'He saw it over my shoulder & laughed. Now he wants a copy']] },
          bad: { p: -4, v: -4, re: [['mork', "He saw it over my shoulder. I've now got a meeting about it tomorrow"]] } }
      ] },
    { id: 'voicenote', who: ['mork'], when: [30, 75],
      title: 'A voice note from the train',
      chat: [['mork', '🎤 Voice message (4:12)']],
      text: "Mork doesn't send voice notes. He must have his hands full.",
      choices: [
        { label: 'Listen to all of it', p: 8, v: 4, t: 15, msg: "Four minutes of a station announcement, then 'see you at half seven'." },
        { label: "Send 'tl;dr?'", say: 'tl;dr?', p: 4, v: -2, re: [['mork', 'Yes']] }
      ] },
    { id: 'golf', who: ['mork'], when: [30, 90],
      title: 'Golf has moved',
      chat: [['mork', "The little one's golf lesson has moved to 7 tonight"], ['mork', "So I'm on taxi duty. Back by 8 at the latest, sorry"]],
      choices: [
        { label: 'Push kick-off to 8', say: { don: 'no worries, 8 then', tom: 'No worries! 8 then' }, p: 10, v: -2, d: 30, re: [['mork', 'Thank you, sorry about this']] },
        { label: 'Ask if he can play from the car park', say: { don: 'can you play from the car park', tom: 'Can you play from the car park?' }, p: 4, v: 6,
          re: [['mork', "I've thought about it more than I'd like to admit"]] }
      ] },
    { id: 'dinner', who: ['mork'], when: [45, 90],
      title: 'Dinner',
      chat: [['mork', "Home. Just need to sort tea & then I'm all yours"], ['mork', '[photo: a plate of chicken dippers]']],
      choices: [
        { label: 'Suggest a takeaway', say: 'just get a pizza in', p: 8, v: -2, re: [['mork', 'Good shout. Ordered, 25 mins']] },
        { label: 'Leave him to it', p: 2, v: 2, re: [['mork', 'Right, all done. Just bath time to go']] }
      ] },
    { id: 'pizza', who: ['don', 'tom', 'mork'], when: [45, 90],
      title: 'Send Mork a pizza?',
      chat: [['pal', { don: 'Should we send Mork a pizza?', tom: 'should we send mork a pizza' }]],
      choices: [
        { label: 'Order one to his door', p: 8, v: 8, re: [['mork', "{me}! Thank you, that's really kind"]] },
        { label: 'Pizza for everyone', p: 4, v: 12, t: 15, msg: 'Three pizzas, three houses, one order.' }
      ] },
    { id: 'partner', who: ['mork'], when: [60, 105],
      title: 'The dishwasher',
      chat: [['mork', "Can play once I've put the dishwasher on & tidied up"], ['mork', 'The dishwasher never gets put on']],
      choices: [
        { label: 'Help him load it over video', sub: 'Mini-game: load the dishwasher', game: 'dishes',
          ok: { p: 14, v: 5, re: [['mork', 'Right, done. Ten minutes']] },
          bad: { p: 4, v: -2, t: 15, re: [['mork', 'Still going…']] } },
        { label: "Remind him nothing can reach him once he's on", say: "once you're on, phone in a drawer and nobody can get you", p: 5, v: 4,
          re: [['mork', "That's a fair point actually"]] },
        { label: 'Tell him to leave it', say: 'just leave it', p: 10, v: -6, re: [['mork', 'Ok, but tomorrow morning me is going to hate you']] }
      ] },
    { id: 'headset', who: ['mork'], when: [60, 999],
      title: 'Where is the headset',
      chat: [['mork', "Can't find my headset anywhere"], ['mork', "I've looked everywhere"]],
      choices: [
        { label: "Suggest the kid's toy box", say: 'check the toy box', p: 10, v: 2, re: [['mork', 'Found it. How did you know?']] },
        { label: 'Suggest earbuds', say: 'just use earbuds', p: 4, v: 0, re: [['mork', 'One of them has been chewed']] },
        { label: { don: 'Ask if Tom borrowed it', tom: "Say you haven't seen it" }, say: { don: 'did you lend it to tom', tom: "Haven't seen it! Has anyone checked eBay? 😂" }, p: 2, v: 4,
          re: { don: [['tom', "I've got my own now! Don lent me his ❤️"]], tom: [['don', '…'], ['mork', 'Found it, it was in the toy box']] } }
      ] },
    { id: 'bedtime', who: ['mork', 'tom'], when: [75, 999],
      title: 'Bedtime story',
      chat: [['mork', 'He wants one more story'], ['mork', "I've read this one six times this week"]],
      choices: [
        { label: { don: 'Get Tom to read it over a call', tom: 'Offer to read it over a call' }, say: { don: 'tom, can you do the voices?', tom: 'Put me on speaker, I do voices' }, set: 'kidname', p: 4, v: 8,
          re: { don: [['tom', 'Gather round…'], ['mork', "He's actually really good at this"]], tom: [['me', 'Gather round…'], ['mork', "Ok, you're actually really good at this"]] },
          msg: { don: 'Tom does every voice. The little one asks for him again tomorrow.', tom: 'You do every voice. The little one asks for you again tomorrow.' } },
        { label: 'Tell him to read the short one', say: 'read the short one', p: 8, v: -3, t: 15, re: [['mork', 'There is no short one, {me}']] }
      ] },
    { id: 'kidsasleep', who: ['mork'], lucky: true, when: [90, 999],
      title: 'He is asleep',
      chat: [['mork', "He's asleep!"], ['mork', 'Nobody say anything. On my way']],
      choices: [
        { label: "Say nothing. Don't even breathe.", p: 25, v: 8, re: [['sys', '{pal} is typing…'], ['sys', '(stopped)']] }
      ] },
    { id: 'maybe', who: ['mork'],
      title: "Mork says 'maybe'",
      chat: [['mork', 'Maybe. Depends how bedtime goes']],
      choices: [
        { label: 'Take the maybe', say: 'maybe works', p: 3, v: 0, maybes: 1 },
        { label: 'Send a beer emoji', say: '🍺', p: 6, v: 3, maybes: 1, re: [['mork', 'Go on then, maybe is a yes']] }
      ] },
    { id: 'cantmake', who: ['mork'], when: [60, 100],
      title: 'Bad news from Mork',
      chat: [['mork', "Lads, I'm really sorry, I don't think I'm going to make it tonight"], ['mork', 'Should be good for Sunday & next Wednesday though']],
      choices: [
        { label: 'Talk him round', sub: 'Risky', risk: 0.5, say: 'go on, just a couple of games. no pressure',
          ok: { p: 16, v: 2, re: [['mork', 'Go on then. A couple of games']] },
          bad: { p: -10, v: -2, re: [['mork', "I really can't tonight, sorry. Sunday though"], ['react', '👍 2']] } },
        { label: 'Say no worries', say: { don: 'no worries mate, sunday then', tom: 'No worries at all! Sunday ❤️' }, p: -6, v: 6,
          re: [['mork', "Thanks for understanding. I'll try & pop on later if I can"], ['react', '👍 2']] }
      ] },
    { id: 'moveon', who: ['mork', 'tom', 'don'], when: [30, 999],
      title: 'Are we still doing {game}?',
      chat: [['mork', "Are we still doing {game}? I've not been on since Wednesday & I've forgotten everything"]],
      choices: [
        { label: 'Stick with it', say: { don: 'yeah still {game}', tom: 'Still {game}! I can catch you up' }, p: 6, v: 2,
          re: { don: [['tom', "I've been on every night. I'll catch you up"]], tom: [['mork', 'Thanks Tom']] } },
        { label: 'Suggest something new', say: { don: 'could start something new?', tom: 'Could start something new?' }, p: -2, v: 6,
          re: { don: [['tom', "I've got a list"], ['tom', 'Item one is a game I made']], tom: [['don', "is it the one you made"], ['mork', 'Is it the tree one?']] } }
      ] },

    // ----- tonight's game -----
    { id: 'loot', game: 'borderlands', as: 'don', who: ['tom'],
      title: 'A legendary drops',
      chat: [['sys', 'DON found: Legendary Shotgun'], ['sys', 'TOM picked up: Legendary Shotgun'], ['tom', "I'll hold onto it for you"]],
      choices: [
        { label: 'Let it go', say: 'fine, keep it', set: 'swords', p: 3, v: 3, steals: 1, easy: 1,
          re: [['tom', 'You\'re a gent. Have these instead'], ['sys', 'TOM dropped: 3 white pistols']] },
        { label: 'Scramble for the loot', sub: 'Mini-game: loot scramble', game: 'grab',
          ok: { p: 10, v: 2, re: [['tom', "Nice! That one's yours"]] },
          bad: { p: 0, v: -8, t: 15, steals: 1, re: [['tom', 'Got it! Holding onto it for you ❤️']] } }
      ] },
    { id: 'loot_t', game: 'borderlands', as: 'tom', who: ['tom', 'don'],
      title: 'A legendary drops',
      chat: [['sys', 'Legendary Shotgun dropped near DON']],
      text: "Don's closer. You're quicker.",
      choices: [
        { label: 'Hold onto it for him', say: "I'll hold onto it for you", set: 'swords', p: 3, v: 3, steals: 1,
          re: [['don', '…ok'], ['sys', 'TOM dropped: 3 white pistols']] },
        { label: 'Scramble for it', sub: 'Mini-game: loot scramble', game: 'grab',
          ok: { p: 2, v: 2, steals: 1, re: [['don', 'how are you that fast']] },
          bad: { p: 4, v: 4, re: [['don', 'got it!']] } },
        { label: 'Let Don have it', p: 6, v: 4, re: [['don', 'oh. thanks?']] }
      ] },
    { id: 'orange', game: 'borderlands', as: 'don', who: ['tom', 'mork'],
      title: "Mork's gear",
      chat: [['tom', "Mork's not on yet, so I'm keeping his gear safe"], ['tom', 'Took everything orange, just in case']],
      choices: [
        { label: 'Leave it with Tom', say: 'cheers tom', p: 2, v: 4, steals: 1, easy: 1, re: [['tom', '❤️']] },
        { label: 'Ask him to put it back', say: 'maybe put it back before he logs on', p: 6, v: -4, re: [['tom', 'Of course!'], ['sys', 'TOM returned: 1 item']] }
      ] },
    { id: 'orange_t', game: 'borderlands', as: 'tom', who: ['tom', 'mork'],
      title: "Mork's gear",
      chat: [['mork', "I'll be on soon. Can someone mind my stuff, my bank's full"]],
      choices: [
        { label: 'Offer to keep it safe', say: "I'll keep it safe! Just the orange stuff", p: 4, v: 4, steals: 1, re: [['mork', 'Legend, thanks']] },
        { label: 'Suggest Don does it', say: 'Don, can you mind it?', p: 2, v: 2, re: [['don', 'yeah go on']] }
      ] },
    { id: 'belts', game: 'satisfactory', as: 'don', who: ['tom'],
      title: 'Where are the belts?',
      chat: [['sys', 'Storage: Conveyor Belt ×0'], ['tom', 'Borrowed a few belts! Will bring them back']],
      text: 'You had four hundred.',
      choices: [
        { label: 'Let him keep them', p: 2, v: 4, steals: 1, easy: 1, re: [['tom', "You won't regret it"]] },
        { label: 'Ask where they went', say: 'where did they go', p: 4, v: 2, re: [['tom', 'Somewhere beautiful'], ['sys', "[screenshot: Tom's factory. It's huge. It's mostly your belts]"]] }
      ] },
    { id: 'belts_t', game: 'satisfactory', as: 'tom', who: ['tom', 'don'],
      title: "Don's belts",
      chat: [['sys', 'DON storage: Conveyor Belt ×400']],
      text: "Your factory needs belts, and Don isn't on yet.",
      choices: [
        { label: 'Borrow a few', say: 'Borrowed a few belts! Will bring them back', p: 2, v: 4, steals: 1, re: [['don', 'how many is a few'], ['me', 'Some']] },
        { label: 'Wait and ask him', say: 'Don, could I borrow some belts?', p: 4, v: 2, re: [['don', 'yeah course']] }
      ] },
    { id: 'power', game: 'satisfactory', who: ['don', 'tom'],
      title: 'Power failure',
      chat: [['sys', 'POWER FAILURE: fuse blown'], ['pal', { don: 'Sorry! Plugged something in', tom: 'sorry. plugged something in' }]],
      choices: [
        { label: 'Take charge of the power', sub: 'Mini-game: keep the lights on', game: 'power',
          ok: { p: 6, v: 8, re: [['sys', 'Power restored'], ['pal', { don: "You're a natural", tom: 'nice one' }]] },
          bad: { p: 0, v: -4, t: 15, re: [['sys', 'POWER FAILURE: fuse blown']] } },
        { label: 'Build more coal generators', p: 2, v: 2, re: [['pal', { don: 'More coal! Love it', tom: 'more coal' }]] }
      ] },
    { id: 'wander', game: 'bigwalk', who: ['tom', 'don'],
      title: { don: 'Where has Tom gone?', tom: 'You know a shortcut' },
      chat: { don: [['tom', 'I know a shortcut'], ['sys', 'Tom is very far away']], tom: [['me', 'I know a shortcut'], ['don', 'tom no']] },
      choices: [
        { label: { don: 'Go and find him', tom: 'Take the shortcut' }, sub: 'Mini-game: hot and cold', game: 'shout',
          ok: { p: 4, v: 10, re: { don: [['tom', 'There you are! Look at this view']], tom: [['don', 'there you are'], ['don', 'how did you get up there']] } },
          bad: { p: 0, v: -4, t: 15, re: { don: [['sys', 'Tom is no longer visible']], tom: [['don', "we've finished the walk. where are you"]] } } },
        { label: { don: 'Walk on without him', tom: 'Stick with Don' }, p: 2, v: 2, easy: { don: 1 },
          re: { don: [['sys', "Tom's last message: 'brb'"]], tom: [['don', 'cheers']] } }
      ] },

    // ----- Don's side -----
    { id: 'easy', as: 'don', who: ['don'],
      title: 'What time are we starting?',
      chat: [['mork', "Whenever suits, I'll fit in"], ['tom', 'Now?']],
      text: "They're both waiting on you.",
      choices: [
        { label: "Say you're easy", say: "i'm easy", p: 2, v: -2, t: 15, easy: 1, msg: 'Fifteen minutes go by and nobody picks a time.' },
        { label: 'Say 7:30', say: '7:30, same as always', p: 8, v: -2, re: [['tom', "Look at you, making decisions"]] }
      ] },
    { id: 'easy_t', as: 'tom', who: ['tom', 'don'],
      title: 'What time are we starting?',
      chat: [['mork', "Whenever suits, I'll fit in"], ['don', '[gif: man shrugging]']],
      text: 'Nobody is going to decide this but you.',
      choices: [
        { label: 'Say now', say: 'Now?', p: -2, v: 6, re: [['mork', "I'm literally holding a child, Tom"]] },
        { label: 'Say 7:30', say: '7:30, same as always', p: 8, v: -2, re: [['don', '[gif: OKIDAY]']] }
      ] },
    { id: 'update', who: ['don'],
      title: 'The update',
      chat: [['sys', { don: 'PS5: system update required (38 GB)', tom: "Don's PS5: system update required (38 GB)" }], ['sys', 'Estimated time: 2 hours 40 minutes']],
      choices: [
        { label: { don: 'Restart the console', tom: 'Tell Don to restart it' }, sub: 'Risky', risk: 0.5, say: { tom: 'Turn it off and on again?' },
          ok: { p: 6, v: 4, re: [['sys', 'Update complete']] },
          bad: { p: 0, v: -3, t: 15, re: [['sys', 'Update required (38 GB)']] } },
        { label: 'Blame the router', say: "it's the router", p: 0, v: 3, re: { don: [['tom', "It's always the router"]], tom: [['don', 'yeah probably the router']] } }
      ] },
    { id: 'lend', as: 'don', who: ['tom'],
      title: 'Tom needs a favour',
      chat: [['tom', "Random one. Has anyone got an old headset they're not using? Mine's packed in"], ['tom', "I'll post it back, obviously"]],
      choices: [
        { label: 'Post him your spare', say: 'go on, i\'ll post mine tomorrow', set: 'ebay', p: 2, v: 6, steals: 1, re: [['tom', "You're a legend. I'll look after it ❤️"]] },
        { label: 'Say you need it', say: 'using mine sorry mate', p: 2, v: -2, re: [['tom', 'No worries at all!'], ['tom', 'Mork?']] }
      ] },
    { id: 'lend_t', as: 'tom', who: ['tom', 'don'],
      title: 'Your headset has packed in',
      text: "Don's always got spares, and he's very kind.",
      choices: [
        { label: 'Ask the group', say: "Random one. Has anyone got an old headset they're not using? I'll post it back, obviously", set: 'ebay', p: 2, v: 6, steals: 1,
          re: [['don', "yeah i've got a spare. i'll post it tomorrow"], ['me', "You're a legend ❤️"]] },
        { label: 'Use the laptop mic', p: 2, v: -2, re: [['don', 'you sound like you are in a bin']] }
      ] },
    { id: 'gift', as: 'don', who: ['tom', 'mork'],
      title: 'A present for Mork',
      chat: [['tom', "Mork, I've posted you a controller! Saw yours was on its last legs"], ['mork', "Tom, that's really kind of you, thank you"], ['mork', "[photo: a PS5 controller with a little 'D' sticker on the back]"]],
      choices: [
        { label: 'Say nothing', p: 6, v: 6, easy: 1 },
        { label: 'Ask where he got it', say: "where'd you get that one", p: 2, v: -2, steals: 1, re: [['tom', 'Had a spare!'], ['tom', '❤️']] }
      ] },
    { id: 'gift_t', as: 'tom', who: ['tom', 'mork'],
      title: 'A present for Mork',
      text: "Mork's controller is on its last legs, and you happen to have a spare. It has a little 'D' sticker on the back.",
      choices: [
        { label: 'Post it to Mork', say: "Mork, I've posted you a controller! Saw yours was on its last legs", p: 8, v: 8, re: [['mork', "Tom, that's really kind of you, thank you"], ['don', 'where did you get a spare']] },
        { label: 'Peel the sticker off first, then post it', say: "Mork, I've posted you a controller! Saw yours was on its last legs", p: 6, v: 6, re: [['mork', "Tom, that's really kind of you, thank you"]] }
      ] },
    { id: 'ebay', req: 'ebay', as: 'don', who: ['tom'],
      title: 'eBay',
      chat: [['sys', 'eBay · New listing near you'], ['sys', "'Gaming headset, lightly used, a bit of wear on the left ear. £35'"]],
      text: 'Your spare had a bit of wear on the left ear.',
      choices: [
        { label: 'Close the app', p: 4, v: 4, steals: 1, easy: 1 },
        { label: 'Bid on it', sub: 'Mini-game: auction', game: 'auction',
          ok: { p: 4, v: 8, re: [['tom', 'Ooh, what did you win?']] },
          bad: { p: 2, v: -2, steals: 1, re: [['tom', 'Did you get anything nice on eBay?']] } },
        { label: "Ask Tom how the headset's working out", say: "how's the headset working out", p: 4, v: 2, re: [['tom', 'Brilliant! Honestly, game changer ❤️'], ['tom', 'Why?']] }
      ] },
    { id: 'ebay_t', req: 'ebay', as: 'tom', who: ['tom', 'don'],
      title: 'eBay',
      chat: [['sys', "eBay · Someone is watching your listing: 'Gaming headset, lightly used'"], ['don', "how's the headset working out"]],
      choices: [
        { label: 'Say it is brilliant', say: 'Brilliant! Honestly, game changer ❤️', p: 4, v: 4, steals: 1 },
        { label: 'Ask why', say: 'Why?', p: 2, v: 2, re: [['don', 'no reason']] }
      ] },

    // ----- Tom, seen by Don -----
    { id: 'chop', as: 'don', who: ['tom'], chop: true,
      title: 'Tom is in the garden',
      chat: [['tom', 'Two mins, just finishing a tree'], ['tom', '[photo: a stump, lit by a phone torch]']],
      text: "It's dark.",
      choices: [
        { label: 'Talk him through it on video', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, re: [['tom', 'It missed the shed!!']] },
          bad: { p: 0, v: 3, re: [['tom', 'It did not miss the shed']] } },
        { label: 'Tell him to leave it till Saturday', say: "it'll still be there saturday", p: 2, v: 2, easy: 1, re: [['tom', "That's what I said about the last nine"]] }
      ] },
    { id: 'council', as: 'don', who: ['tom'],
      title: 'A letter from the council',
      chat: [['tom', 'Small thing'], ['tom', "The council have sent me a letter about my trees"], ['tom', "Something about a 'preservation order'"]],
      choices: [
        { label: "Ask how many trees he's got left", say: 'how many have you got left', p: 2, v: 6, re: [['tom', 'Define "left"']] },
        { label: 'Tell him to frame it', say: 'frame it', p: 2, v: 4, re: [['tom', 'Already have ❤️']] }
      ] },
    { id: 'calm', as: 'don', who: ['tom'],
      title: 'Tom is excited',
      chat: [['tom', "SO excited for tonight. Haven't played in ages"], ['tom', "I've made a banner"]],
      choices: [
        { label: 'Calm Tom down', sub: 'Mini-game: breathing', game: 'breathe',
          ok: { p: 2, v: 10, set: 'banner', re: [['tom', 'Ok. Breathing. Saving the banner for later']] },
          bad: { p: 0, v: 1, re: [['tom', 'I AM SO CALM']] } },
        { label: 'Let him run with it', p: -4, v: -6, re: [['tom', 'Right, a quick speech'], ['sys', 'Tom is typing… (4 minutes)']] }
      ] },
    { id: 'tomgame', as: 'don', who: ['tom'],
      title: "Tom's new build",
      chat: [['tom', "Little thing. I've been working on a game. Would love a playtest"], ['tom', "It's about a man clearing his garden"]],
      choices: [
        { label: 'Playtest it', say: 'go on, send it over', p: -2, v: 8, t: 15, re: [['tom', 'Be honest. But be kind'], ['tom', 'But be honest']], msg: "It's a game about chopping down trees, and annoyingly it's really good." },
        { label: 'After the match', say: 'after the match yeah?', p: 4, v: -2, re: [['tom', 'Of course!'], ['tom', 'Of course']] }
      ] },
    { id: 'stream', as: 'don', who: ['tom'],
      title: 'Tom is live',
      chat: [['tom', 'Streaming some dev work 🔴'], ['sys', 'Viewers: 1']],
      text: 'The one viewer is his mum.',
      choices: [
        { label: 'Join the stream', p: 0, v: 8, re: [['tom', "Don's here! Say hi to Don"], ['sys', "Tom's mum: hello Don x"]] },
        { label: 'Mute it', p: 2, v: -2, re: [['tom', 'Did the stream cut out for anyone else?']] }
      ] },
    { id: 'tomback', as: 'don', who: ['tom', 'mork'], when: [0, 45],
      title: 'Where has Tom been?',
      chat: [['mork', 'Tom! Where have you been?'], ['tom', 'Around!']],
      choices: [
        { label: "Don't ask", say: '[gif: OKIDAY]', p: 2, v: 4, easy: 1 },
        { label: 'Ask what "around" means', say: 'around where', p: 0, v: -2, re: [['tom', 'Garden mostly'], ['tom', 'Bit of eBay']] }
      ] },
    { id: 'tomgone', as: 'don', who: ['tom'],
      title: 'Tom has gone quiet',
      chat: [['sys', 'Tom · last seen 20 minutes ago']],
      text: 'Last time this happened, it was three weeks.',
      choices: [
        { label: 'Wait. He always comes back', p: 2, v: 0, t: 15, easy: 1, re: [['tom', 'Sorry! Was in the garden']] },
        { label: "Ask if he's alright", say: 'you alright?', p: 0, v: 3, re: [['tom', 'All good! Back in a bit']] }
      ] },
    { id: 'tomloan', as: 'don', who: ['tom'],
      title: 'A quick favour',
      chat: [['tom', 'Quick one, could anyone lend me £40 till payday?'], ['tom', "Happy to pay you back in firewood. I've got loads"]],
      choices: [
        { label: 'Lend it', say: 'go on then', p: 0, v: 4, steals: 1, next: 'loanrepay' },
        { label: "Say you're skint", say: "i'm skint mate sorry", p: 2, v: -1, re: [['tom', 'No worries at all!'], ['tom', 'Mork?']] }
      ] },
    { id: 'poll', as: 'don', who: ['tom'],
      title: 'Tom has started a poll',
      chat: [['tom', 'POLL: what should we play next?'], ['sys', '1. {game}  ·  2. Something new  ·  3. A game I made']],
      choices: [
        { label: 'Vote for his game', p: 2, v: 8, re: [['tom', '❤️']] },
        { label: 'Vote to stick with {game}', p: 6, v: -2, re: [['tom', 'Democracy ❤️'], ['sys', 'Tom voted for option 3 four times']] }
      ] },
    { id: 'tommum', as: 'don', who: ['tom'],
      title: "Tom's mum has joined the chat",
      chat: [['sys', "Tom's mum joined the chat"], ['mum', 'Hello boys!'], ['mum', "Is Tom with you? There's a man here asking about a parcel"]],
      choices: [
        { label: "Say he's here", say: "he's here!", p: 2, v: 4, re: [['sys', 'Tom left the chat'], ['sys', 'Tom joined the chat']] },
        { label: "Say you haven't seen him", say: "haven't seen him", p: 0, v: -2, re: [['mum', 'Typical']] }
      ] },

    // ----- Tom's side -----
    { id: 'chop_t', as: 'tom', who: ['tom'], chop: true,
      title: 'One more tree',
      chat: [['don', 'you coming on?']],
      text: "It's dark, but there's one tree left by the shed and it's been looking at you.",
      choices: [
        { label: 'Finish it by torchlight', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, re: [['me', 'It missed the shed!!'], ['don', '[gif: man slow clapping]']] },
          bad: { p: 0, v: 3, re: [['me', 'It did not miss the shed']] } },
        { label: 'Leave it till Saturday', say: 'Coming! Tree can wait', p: 2, v: 2, re: [['don', 'that tree is living on borrowed time']] }
      ] },
    { id: 'council_t', as: 'tom', who: ['tom'],
      title: 'A letter from the council',
      text: "It's about your trees. It uses the words 'preservation order'. Three of the trees it mentions are now firewood.",
      choices: [
        { label: 'Tell the lads', say: 'Small thing, the council have written to me about my trees', p: 2, v: 6, re: [['don', 'how many have you got left'], ['me', 'Define "left"']] },
        { label: 'Put it in the drawer', p: 2, v: 2, msg: 'It goes in with the other three.' }
      ] },
    { id: 'calm_t', as: 'tom', who: ['tom'],
      title: "You're excited",
      chat: [['me', "SO excited for tonight. Haven't played in ages"], ['me', "I've made a banner"], ['don', 'mate']],
      choices: [
        { label: 'Breathe', sub: 'Mini-game: breathing', game: 'breathe',
          ok: { p: 2, v: 10, set: 'banner', re: [['me', 'Ok. Saving the banner for later']] },
          bad: { p: 0, v: 1, re: [['me', 'I AM SO CALM']] } },
        { label: 'Write a quick speech', p: -4, v: -6, re: [['sys', 'Tom is typing… (4 minutes)'], ['don', 'oh no']] }
      ] },
    { id: 'tomgame_t', as: 'tom', who: ['tom', 'don'],
      title: 'Your new build',
      text: "Your game about a man clearing his garden is nearly ready. It's based on nobody in particular.",
      choices: [
        { label: 'Ask Don to playtest it', say: "Little thing. I've been working on a game. Would love a playtest", p: -2, v: 8, t: 15, re: [['don', "it's good. why is it good"]] },
        { label: 'Save it for after', p: 4, v: -2, re: [['me', 'Got something to show you all later ❤️'], ['don', 'is it trees']] }
      ] },
    { id: 'stream_t', as: 'tom', who: ['tom'],
      title: "You're live",
      chat: [['me', 'Streaming some dev work 🔴'], ['sys', 'Viewers: 1']],
      text: 'The one viewer is your mum.',
      choices: [
        { label: 'Wave to chat', p: 0, v: 8, re: [['sys', "Tom's mum: hello love x"], ['don', "hi tom's mum"]] },
        { label: 'End the stream', p: 2, v: -2, re: [['sys', "Tom's mum: oh x"]] }
      ] },
    { id: 'tomback_t', as: 'tom', who: ['tom', 'mork'], when: [0, 45],
      title: 'Where have you been?',
      chat: [['mork', 'Tom! Where have you been?']],
      choices: [
        { label: "Say 'around'", say: 'Around!', p: 2, v: 4, re: [['don', '[gif: OKIDAY]']] },
        { label: 'Say the garden', say: 'Garden mostly! Bit of eBay', p: 4, v: 2, re: [['mork', 'Fair enough']] }
      ] },
    { id: 'tomgone_t', as: 'tom', who: ['tom'],
      title: 'Something to sort out',
      chat: [['sys', 'eBay · Your item has sold! Please post within 2 days']],
      choices: [
        { label: 'Pop out to wrap it', p: 2, v: -2, t: 15, re: [['don', 'tom?'], ['don', 'he does this']] },
        { label: 'Post it tomorrow', p: 0, v: 4, re: [['don', 'who are you messaging']] }
      ] },
    { id: 'tomloan_t', as: 'tom', who: ['tom', 'don'],
      title: 'A bit short',
      text: "Payday is a week away, and you've got a lot of firewood.",
      choices: [
        { label: 'Ask the lads', say: "Quick one, could anyone lend me £40 till payday? Happy to pay you back in firewood", p: 0, v: 4, steals: 1, next: 'loanrepay_t', re: [['don', 'go on then']] },
        { label: 'Leave it', p: 2, v: 2 }
      ] },
    { id: 'poll_t', as: 'tom', who: ['tom'],
      title: 'Start a poll',
      text: 'What should you all play next? You get to write the options.',
      choices: [
        { label: 'Include your own game', say: 'POLL: what next? 1. {game} 2. Something new 3. A game I made', p: 2, v: 6, re: [['don', '3 i guess'], ['mork', '3 is fine']] },
        { label: 'Keep it fair', say: 'POLL: what next? 1. {game} 2. Something new', p: 6, v: -2, re: [['mork', '1 please']] }
      ] },
    { id: 'tommum_t', as: 'tom', who: ['tom'],
      title: 'Your mum has joined the chat',
      chat: [['sys', "Tom's mum joined the chat"], ['mum', 'Hello boys!'], ['mum', "Tom, there's a man at the door asking about a parcel"]],
      choices: [
        { label: "Say you'll be right down", say: "Coming, Mum!", p: 2, v: 4, re: [['don', '…']] },
        { label: 'Leave the chat', p: 0, v: -2, re: [['sys', 'Tom left the chat'], ['sys', 'Tom joined the chat']] }
      ] },

    // ----- scenes: reached through a `next` from another choice -----
    { id: 'loanrepay', scene: true, as: 'don', who: ['tom'],
      title: 'Tom has paid you back',
      chat: [['tom', 'Paid you back!'], ['sys', '[photo: a large sack of logs on your doorstep]'], ['tom', 'Postage was £38 but honestly worth it']],
      choices: [
        { label: 'Thank him', say: 'cheers tom', p: 0, v: 6, re: [['tom', '❤️']] },
        { label: 'Ask about the £40', say: 'tom. the £40', p: 2, v: -4, re: [['tom', 'That IS the £40']] }
      ] },
    { id: 'loanrepay_t', scene: true, as: 'tom', who: ['tom', 'don'],
      title: 'Paying Don back',
      text: 'You owe Don £40.',
      choices: [
        { label: 'Post him some logs', say: 'Paid you back! Check your doorstep', p: 0, v: 6, re: [['don', 'why is there a sack of logs on my doorstep']] },
        { label: 'Send the actual £40', p: 2, v: 2, re: [['don', 'wait, actual money?'], ['don', 'are you ok']] }
      ] },
    { id: 'prepare', scene: true, as: 'don', who: ['tom'],
      title: 'Tom has prepared',
      chat: [['tom', "Since we've got an extra half hour, I've done a little presentation"], ['sys', 'Slide 1 of 47']],
      choices: [
        { label: 'Sit through it', p: 6, v: 6, t: 15, re: [['tom', 'Slide 12 is the important one']], msg: 'Slide 12 is a photo of his garden. Before.' },
        { label: 'Skip to the end', say: 'skip to the end?', p: 2, v: -2, re: [['tom', 'Last slide is the garden after']] }
      ] },
    { id: 'prepare_t', scene: true, as: 'tom', who: ['tom', 'don'],
      title: 'An extra half hour',
      text: "Thirty spare minutes, and you've got 47 slides about your garden.",
      choices: [
        { label: 'Present all 47', p: 6, v: 6, t: 15, re: [['don', 'slide 12 was just a tree']] },
        { label: 'Just show before and after', p: 2, v: -2, re: [['don', 'where did all the trees go']] }
      ] },

    // ----- callbacks: these only show up once an earlier choice has set the flag -----
    { id: 'gathering', req: 'gathering', who: ['mork', 'tom'],
      title: 'The invite went wide',
      chat: [['mork', "Tom, you've sent the invite to my work email"], ['mork', 'My boss has replied all'], ['mork', 'He wants to know if he should bring anything']],
      choices: [
        { label: { don: 'Tell Mork it\'s an honour', tom: 'Welcome the boss' }, say: { don: 'honestly, an honour', tom: 'All are welcome! Tell him to bring snacks' }, p: 2, v: 4, re: [['mork', "He's asking if he can bring his son"]] },
        { label: { don: 'Ask Tom to recall it', tom: 'Recall the email' }, say: { don: 'tom can you recall it', tom: "I'll recall it" }, p: 6, v: -2, re: [['sys', 'Recall failed: 41 recipients']] }
      ] },
    { id: 'banner', req: 'banner', who: ['tom'],
      title: 'The banner',
      chat: { don: [['tom', "I think it's time for the banner"]], tom: [] },
      text: { tom: 'The banner is still rolled up on your desk.' },
      choices: [
        { label: { don: 'Let him unroll it', tom: 'Unroll it on camera' }, p: -2, v: 8, re: [['mork', "It says WELCOME BACK TOM. That's… nice"]] },
        { label: 'Save it for when Mork is in', p: 4, v: 4 }
      ] },
    { id: 'kidpic', req: 'kidname', who: ['mork', 'tom'],
      title: 'A picture from the little one',
      chat: [['mork', 'The little one has drawn a picture of Tom'], ['mork', "[photo: a stick man with a very big axe, surrounded by stumps]"]],
      choices: [
        { label: { don: 'Show Tom', tom: 'Say you love it' }, say: { don: 'tom have you seen this', tom: "I love it. Can I have it for the fridge?" }, p: 6, v: 10, re: { don: [['tom', "I'm going to cry"]], tom: [['don', "he's crying"]] } },
        { label: 'Ask about the stumps', say: { don: 'why are there so many stumps', tom: 'Why are there so many stumps?' }, p: 4, v: 4, re: [['mork', "He says that's your garden"]] }
      ] },
    { id: 'smallswords', req: 'swords', who: ['tom', 'mork'],
      title: 'About that shotgun',
      chat: { don: [['mork', 'Has anyone seen a legendary shotgun? It was in my bank'], ['tom', 'No idea! Don, have you?']], tom: [['mork', 'Has anyone seen a legendary shotgun? It was in my bank'], ['don', 'tom?']] },
      choices: [
        { label: { don: 'Say nothing', tom: 'Ask Don' }, say: { tom: 'No idea! Don, have you?' }, p: 4, v: 4, steals: 1, re: { don: [], tom: [['don', '…']] } },
        { label: { don: 'Look in your inventory', tom: 'Have a look in yours' }, p: 6, v: -2, re: [['sys', 'Found: 3 white pistols']] }
      ] },

    // ----- special nights -----
    { id: 'cake', only: 'birthday', who: ['tom'],
      title: { don: 'Tom has ordered a cake', tom: 'Cake' },
      chat: { don: [['tom', "Quick one. I've ordered myself a birthday cake"], ['tom', "Mork, I put it on your Deliveroo, hope that's ok"]], tom: [] },
      text: { tom: "It's your birthday, and Mork's Deliveroo account is still logged in on your phone." },
      choices: [
        { label: { don: 'Sing happy birthday', tom: 'Order the big one' }, say: { tom: "I've ordered myself a cake! Mork, I put it on your Deliveroo, hope that's ok" }, p: -2, v: 10, t: 15,
          re: { don: [['mork', "It's fine. Happy birthday Tom"]], tom: [['mork', "It's fine. Happy birthday Tom"], ['don', 'happy birthday tom']] } },
        { label: { don: 'Ask what kind', tom: 'Pay for it yourself' }, say: { don: 'what kind', tom: 'Actually, I\'ll get this one' }, p: 2, v: 2,
          re: { don: [['tom', "The biggest one. It's Mork's birthday present to me"]], tom: [['don', 'are you feeling ok']] } }
      ] },
    { id: 'toast', only: 'birthday', who: ['tom'],
      title: 'A toast',
      chat: { don: [['tom', 'A toast. To my best friends'], ['tom', 'The kindest, most generous men I know'], ['tom', 'Never once said no to me']], tom: [] },
      text: { tom: "It's your birthday, and these are the kindest, most generous men you know." },
      choices: [
        { label: { don: 'Raise a glass', tom: 'Toast your friends' }, say: { tom: 'A toast. To the kindest, most generous men I know. Never once said no to me' }, p: 0, v: 8, t: 15, re: { don: [['mork', 'Cheers Tom']], tom: [['mork', 'Cheers Tom'], ['don', 'cheers']] } },
        { label: { don: 'Say "never once?"', tom: 'Keep it short' }, say: { don: 'never once?', tom: 'Cheers lads' }, p: 4, v: -2, re: { don: [['tom', 'Not once ❤️']], tom: [['don', 'cheers tom']] } }
      ] },
    { id: 'wish', only: 'birthday', who: ['tom', 'mork'],
      title: 'Make a wish',
      chat: { don: [['tom', "Everyone make a wish! Mine's about the council"]], tom: [['me', 'Everyone make a wish!']] },
      choices: [
        { label: 'Wish for Mork to show up', p: 12, v: 4, re: [['mork', 'Why has my phone just lit up?']] },
        { label: { don: 'Wish for a quiet night', tom: 'Wish the council would drop it' }, p: 4, v: 6 }
      ] },
    { id: 'bug', only: 'launch', who: ['tom', 'don'],
      title: { don: "Tom's game has a bug", tom: 'Your game has a bug' },
      chat: { don: [['tom', 'Small thing'], ['tom', "The trees can't be chopped down"]], tom: [['don', "tom the trees can't be chopped down"]] },
      text: "It's a game about chopping down trees.",
      choices: [
        { label: { don: 'Report it', tom: 'Patch it live' }, sub: { tom: 'Risky' }, risk: { tom: 0.5 }, say: { don: 'you need to fix that' },
          p: 2, v: 4, re: { don: [['tom', "It's realistic. The council won't let you"]] },
          ok: { p: 4, v: 8, re: [['don', 'IT CHOPS']] }, bad: { p: 0, v: -4, t: 15, re: [['don', 'now the trees chop you']] } },
        { label: 'Call it a feature', say: { don: "it's a feature. preservation order", tom: "It's a feature. Preservation order" }, p: -2, v: 10, re: { don: [['tom', '…that\'s actually quite good']], tom: [['don', '…that\'s actually quite good']] } }
      ] },
    { id: 'reviews', only: 'launch', who: ['tom', 'don'],
      title: 'The first review',
      chat: [['sys', '★★★★★ "Best game I have ever played. Very realistic garden." (verified purchase: tom_dev_uk)']],
      choices: [
        { label: { don: 'Say nothing', tom: 'Say nothing' }, p: 2, v: 4, easy: { don: 1 } },
        { label: { don: 'Point it out', tom: 'Leave another one' }, say: { don: "tom that's you", tom: '[★★★★★ "Agree with the last review." (verified purchase: tom_dev_uk_2)]' }, p: 4, v: { don: -4, tom: 6 },
          re: { don: [['tom', "It's a verified purchase though"]], tom: [['don', 'tom']] } }
      ] },
    { id: 'crash', only: 'launch', who: ['tom', 'don'],
      title: 'The servers are down',
      chat: { don: [['tom', 'Servers are down!'], ['tom', 'The server is your PS5, Don'], ['tom', 'Is it plugged in?']], tom: [['don', "game won't load"], ['sys', "Server status: Don's PS5"]] },
      choices: [
        { label: { don: 'Restart it', tom: 'Ask Don to restart it' }, sub: 'Risky', risk: 0.5, say: { tom: 'Don, is it plugged in?' },
          ok: { p: 6, v: 8, re: [['pal', { don: "It's alive!", tom: 'it lives' }]] },
          bad: { p: 0, v: -4, t: 15, re: [['sys', 'Server status: still Don\'s PS5']] } },
        { label: 'Blame the router', say: "it's the router", p: 0, v: 3, re: [['pal', { don: "It's always the router", tom: 'yeah probably the router' }]] }
      ] },

    // ----- last call: the final fifteen minutes, picked by how close Mork is -----
    { id: 'last_hi', final: 'hi', who: ['mork'],
      title: 'Fifteen minutes to go',
      chat: [['mork', "Just putting him down, then I'll grab my headset"]],
      text: "He's nearly there. Don't mess it up.",
      choices: [
        { label: 'Say nothing at all', p: 6, v: 4 },
        { label: 'Send one last message', sub: 'Risky', risk: 0.6, say: 'ready when you are 👀',
          ok: { p: 12, v: 4, re: [['mork', 'Ok, coming now']] },
          bad: { p: -10, v: -2, re: [['mork', 'Your message woke him up 😩']] } }
      ] },
    { id: 'last_mid', final: 'mid', who: ['mork', 'don', 'tom'],
      title: 'Fifteen minutes to go',
      chat: [['mork', 'Nearly there, he wants one more story']],
      choices: [
        { label: 'Ring him', sub: 'Risky', risk: 0.5, say: '📞 Calling Mork…',
          ok: { p: 16, v: 2, re: [['mork', "Had it on silent. He's asleep, coming now"]] },
          bad: { p: -4, v: -4, re: [['mork', "{me}, you've woken him up"]] } },
        { label: 'Promise him an easy night', say: 'two games then bed, promise', p: 8, v: 2, re: [['mork', 'Two games. You promise?']] },
        { label: { don: 'Get Tom to sing him to sleep', tom: 'Sing him to sleep' }, p: 10, v: 4,
          re: { don: [['tom', '🎤 Voice message (6:30)'], ['mork', "It worked, he's out like a light. Who is this man?"]], tom: [['me', '🎤 Voice message (6:30)'], ['mork', "It worked, he's out like a light. Thank you Tom"]] } }
      ] },
    { id: 'last_lo', final: 'lo', who: ['mork'],
      title: 'Fifteen minutes to go',
      chat: [['sys', 'Mork · last seen an hour ago']],
      text: 'It would take a miracle.',
      choices: [
        { label: 'Send a beer emoji', sub: 'Long shot', risk: 0.3, say: '🍺',
          ok: { p: 30, v: 8, re: [['mork', '🍺'], ['mork', 'Go on then. Give me 10 mins']] },
          bad: { p: 2, v: -2, re: [['sys', '✓ Delivered']] } },
        { label: 'Let it go', p: 0, v: 6, easy: { don: 1 }, re: [['mork', "Sorry lads, not tonight. Sunday though"], ['react', '👍 2']] }
      ] }
  ];

  // a line at the top of the next card whenever Mork's evening moves on
  var BRIDGES = {
    commute: ["Mork's left work, and he's still replying.", 'Mork has left work. Probably.'],
    home: ["Mork's home. Tea, bath, and one eye on the chat.", "Mork's home, and he's vanished into tea and bath time."],
    bedtime: ["Bedtime at Mork's. If it's a short story, he's yours.", "Bedtime at Mork's, and nothing from him for a while."],
    late: ["Half seven's been and gone. The new kick-off is the one that counts.", "Half seven's been and gone. The new kick-off is the one that counts."]
  };

  // the little things you notice about Tom, and don't mention
  var TOM_RUMOURS = [
    'Meanwhile, a seller twelve miles from Tom lists a PS5 controller with a little sticker on the back.',
    "Meanwhile, Tom posts a photo of a new chainsaw. He doesn't say where it came from.",
    "Meanwhile, Tom's garden is down to two trees.",
    'Meanwhile, Tom changes his profile picture to a stump.',
    "Meanwhile, Tom asks if anyone's using their Borderlands season pass code.",
    'Meanwhile, an eBay seller near Tom gets another five stars: "Quick postage, would buy again."'
  ];
  // the little things that cross Tom's mind, when you are Tom
  var TOM_SECRETS = [
    'Meanwhile, an eBay buyer leaves you five stars: "Quick postage, would buy again."',
    "Meanwhile, next door asks if you've seen their ladder.",
    'Meanwhile, the garden is down to two trees. They look nervous.',
    'Meanwhile, someone makes an offer on the headset.',
    "Meanwhile, you remember the little one's name. You write it down this time.",
    'Meanwhile, the council send a follow-up letter. You add it to the drawer.'
  ];

  // ---------- state ----------

  var g = null;
  var player = 'don';
  try { if (localStorage.getItem(PLAYER_KEY) === 'tom') player = 'tom'; } catch (e) { /* ignore */ }
  function palOf(who) { return who === 'tom' ? 'don' : 'tom'; }
  function nameOf(id) { return id.charAt(0).toUpperCase() + id.slice(1); }

  // a field that may be split by who you are playing: { don: x, tom: y }
  function pv(x) {
    if (x && typeof x === 'object' && !Array.isArray(x) && ('don' in x || 'tom' in x)) return x[player];
    return x;
  }
  // a text with {me} / {ME} / {pal} in it
  function fill(t) {
    if (typeof t !== 'string') return t;
    return t.replace(/\{game\}/g, g ? GAMES[g.game].name : '').replace(/\{me\}/g, nameOf(player)).replace(/\{ME\}/g, player.toUpperCase()).replace(/\{pal\}/g, nameOf(palOf(player)));
  }
  function txt(x) { var v = pv(x); return v == null ? '' : fill(v); }
  // chat lines with 'me' / 'pal' turned into real people
  function lines(list) {
    return (pv(list) || []).map(function (m) {
      var who = m[0] === 'me' ? player : m[0] === 'pal' ? palOf(player) : m[0];
      return [who, txt(m[1])];
    });
  }
  // a choice or outcome with every split field settled for this player
  function settle(o) {
    var out = {};
    Object.keys(o || {}).forEach(function (k) { out[k] = pv(o[k]); });
    return out;
  }
  function baseId(e) { return e.id.replace(/_t$/, ''); }

  function newGame(dayKey) {
    var day = DAYS[dayKey], comp = COMPS[Math.floor(Math.random() * COMPS.length)];
    var game = GAME_ORDER[Math.floor(Math.random() * GAME_ORDER.length)];
    return { dayKey: dayKey, day: day, comp: comp, game: game, player: player, clock: START, leaveAt: START + WINDOW_MIN, shifts: 0, round: 0, phase0: 'work', bridge: '',
      progress: clamp(comp.ready || 0, 0, 100), vibes: 40 + (day.vibes || 0) + (comp.vibes || 0), pool: [], queue: [], seen: {}, ev: null, phase: 'event', result: null, ending: null, started: false,
      flags: {}, flagAt: {}, usedAsides: {}, stats: { trees: 0, steals: 0, maybes: 0, easy: 0, lostMin: 0, miniPlayed: 0, miniWon: 0 } };
  }

  function fmtClock(m) {
    var h = Math.floor(m / 60) % 24, mm = m % 60, ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function byId(id) { return EVENTS.filter(function (e) { return e.id === id; })[0]; }
  function forPlayer(e) { return !e.as || e.as === g.player; }

  function pickEvent() {
    var m = g.clock - START;
    if (!g.started) {
      g.started = true;
      return EVENTS.filter(function (e) { return e.first && forPlayer(e); })[0];
    }
    // the last round before kick-off is always the final push
    if (g.clock + ROUND_MIN >= g.leaveAt && !g.finalDone) {
      g.finalDone = true;
      var band = g.progress >= WIN_READY ? 'hi' : g.progress >= LATE_READY ? 'mid' : 'lo';
      return EVENTS.filter(function (e) { return e.final === band; })[0];
    }
    while (g.queue.length) {
      var qe = byId(g.queue.shift());
      if (!qe || !forPlayer(qe)) continue;
      var qi = g.pool.indexOf(qe.id);
      if (qi > -1) g.pool.splice(qi, 1);
      return qe;
    }
    function ok(e, strict) {
      if (e.scene || e.first || e.final || !forPlayer(e)) return false;
      if (e.only && e.only !== g.dayKey) return false;
      if (e.game && e.game !== g.game) return false;
      // a callback needs its flag, and at least one other card in between
      if (e.req && !(g.flags[e.req] && g.round > g.flagAt[e.req] + 1)) return false;
      if (strict && e.when && (m < e.when[0] || m > e.when[1])) return false;
      return true;
    }
    function fresh() {
      g.pool = EVENTS.filter(function (e) {
        return !e.scene && !e.first && !e.final && forPlayer(e) && (!e.only || e.only === g.dayKey) && (!e.game || e.game === g.game);
      }).map(function (e) { return e.id; });
    }
    if (!g.pool.length) fresh();
    var cand = g.pool.map(byId).filter(function (e) { return ok(e, true); });
    if (!cand.length) { fresh(); cand = g.pool.map(byId).filter(function (e) { return ok(e, true); }); }
    if (!cand.length) cand = g.pool.map(byId).filter(function (e) { return ok(e, false); });
    var weights = cand.map(function (e) {
      var w = e.lucky ? 0.5 : 1;
      if (e.work) w *= g.day.workWeight;
      if (e.when) w *= 1.6; // Mork's evening is the spine of the night
      if (e.game) w *= 2.5; // and the game you're on should come up
      if (e.req || e.only) w *= 4; // callbacks and special-night events should actually land
      if (g.comp.boost[baseId(e)] !== undefined) w *= g.comp.boost[baseId(e)];
      if (g.day.tomBoost && e.who.indexOf('tom') > -1) w *= g.day.tomBoost;
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total, i = 0;
    while (i < cand.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    g.pool.splice(g.pool.indexOf(cand[i].id), 1);
    return cand[i];
  }

  // which part of Mork's evening we're in
  function eveningPhase(clock) {
    var m = clock - START;
    if (m >= WINDOW_MIN) return 'late';
    if (m >= 90) return 'bedtime';
    if (m >= 60) return 'home';
    if (m >= 30) return 'commute';
    return 'work';
  }

  // where Mork is, as the evening wears on
  function morkStatus() {
    if (g && g.ending === 'win') return 'ONLINE';
    if (g && g.ending === 'late') return 'ASLEEP, PAD IN HAND';
    if (g && g.ending === 'noshow') return 'ASLEEP';
    return { work: 'STILL AT WORK', commute: 'COMMUTING', home: 'DINNER + BATHS', bedtime: 'BEDTIME', late: 'NEARLY THERE?' }[eveningPhase(g ? g.clock : START)];
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
    don: ["i'm easy", 'whatever you lot want', 'honestly, any time is fine', '*sips drink*', "don't look at me, i'm just here", 'half seven-ish. or not. easy'],
    tom: ['Two mins, just finishing a tree', 'Has anyone got a spare controller? Asking for me', "You're both my best friends. Equally. Mostly.",
      "I'll hold onto that for you ❤️", 'Gaming this eve?', "The council can't prove anything", 'Did anyone want this? No? I\'ll hang onto it']
  };
  var MORK_QUIPS = {
    'STILL AT WORK': ['on a call. typing one-handed', "two minutes (it's never two minutes)", "can't talk. spreadsheet"],
    'COMMUTING': ['on the train. signal is a rumour', 'nearly home. ish'],
    'DINNER + BATHS': ['chicken dipper situation', 'someone is wearing the bath', 'hands full. literally'],
    'BEDTIME': ["one more story then i'm yours", "shh. he's nearly off", 'there is no short one'],
    'NEARLY THERE?': ['two minutes. actually two this time', "headset's on. kid is not asleep"],
    'ONLINE': ['…', '(headset on, can\'t hear you)', 'locked in. do not speak'],
    'ASLEEP, PAD IN HAND': ['zzz…', '*presses X in his sleep*'],
    'ASLEEP': ['zzz…', '(seen 11:48 PM)']
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
    var tomText = g && g.ending ? (g.ending === 'rage' ? 'TOO EXCITED' : g.ending === 'heist' ? 'GONE QUIET' : 'IN THE GARDEN') : 'BACK AFTER 3 WEEKS';
    ['don', 'tom'].forEach(function (id) {
      couchEls[id].classList.toggle('you', id === player);
      couchEls[id].querySelector('span').textContent = CHARS[id].name + (id === player ? ' (YOU)' : '');
    });
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
    couchEls.don.querySelector('.gn-tally').textContent = st && g.player === 'don' ? 'EASY x' + st.easy : '';
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
      var d = DAYS[k], bk = bestKey(k), bt = best[bk] ? ' · BEST ' + best[bk] : '';
      if (!unlocked(k)) return '<button class="gn-btn gn-locked" disabled>LOCKED<small>' + d.hint + '</small></button>';
      return '<button class="gn-btn" data-key="' + (i + 1) + '" data-day="' + k + '">' + d.name.toUpperCase() + bt + '<small>' + esc(txt(d.blurb)) + '</small></button>';
    }).join('');
    var picker = ['don', 'tom'].map(function (id) {
      return '<button type="button" class="gn-pick' + (id === player ? ' on' : '') + '" data-player="' + id + '" aria-pressed="' + (id === player) + '">' +
        sprite(CHARS[id].rows, 4) + '<b>' + CHARS[id].name + '</b><small>' + PLAYERS[id].tag + '</small></button>';
    }).join('');
    var badgeList = BADGES.map(function (bd) {
      var has = earned.indexOf(bd.id) > -1;
      return '<li class="' + (has ? 'got' : '') + '">' + (has ? '<b>' + bd.name + '</b> ' : '??? ') + bd.desc + '</li>';
    }).join('');
    elCard.innerHTML =
      '<h2>WHERE\'S MORK?</h2>' +
      '<p>' + PLAYERS[player].intro + '</p>' +
      '<div class="gn-who" role="group" aria-label="Play as">' + picker + '</div>' +
      '<div class="gn-choices">' + buttons + '</div>' +
      '<details class="gn-badges"><summary>Badges: ' + earned.length + ' / ' + BADGES.length + '</summary><ul>' + badgeList + '</ul></details>' +
      '<p class="gn-found">Endings found: ' + found + ' / ' + ENDING_COUNT + '. Tom never forgets a favour. Poke the gang on the sofa any time.</p>';
  }

  var PLAYERS = {
    don: { tag: 'Easy. Decides nothing.',
      intro: "Kick-off's at 7:30, and the group chat wakes up at 5:30. Tom has just popped up for the first time in three weeks, as if nothing happened. He's one of the nicest men alive, and things do have a habit of going missing around him. Mork is the busiest man you know, but once he's online nothing gets through: no calls, no work, no interruptions. Getting him there is the hard part. You're Don, and you're easy." },
    tom: { tag: 'Nicest man alive. Allegedly.',
      intro: "Kick-off's at 7:30, and the group chat wakes up at 5:30. You're Tom: game developer, owner of a garden that used to have trees in it, and back after three weeks of total silence. You love these lads, and they're always so kind about lending you things. Mork is the busiest man you know, and once he's online nothing gets through, so getting him there is the hard part. Try not to get too excited, and try not to borrow too much." }
  };
  function bestKey(day) { return player === 'don' ? day : 'tom-' + day; }

  // a word of caution before anyone plays as Tom
  function renderWarning() {
    elCard.innerHTML =
      '<div class="gn-cw"><h2>⚠ CONTENT WARNING ⚠</h2>' +
      '<p><b>You are about to play as Tom</b>, one of the darkest and most depraved individuals ever to own a PlayStation.</p>' +
      '<p>This game contains scenes of:</p><ul>' +
      '<li>Extreme, sustained niceness</li>' +
      '<li>Unexplained absences of up to three weeks</li>' +
      "<li>Borrowing things and 'posting them back, obviously'</li>" +
      '<li>Tree felling in direct defiance of the local council</li>' +
      '<li>Very fast postage</li></ul>' +
      "<p>Side effects may include saying 'I'll hold onto it for you', 100% positive eBay feedback, and a garden full of stumps. " +
      'Players with a valuable inventory, a spare controller, or trees should speak to a friend before going on. The friend will be Don. Don is easy.</p>' +
      '<p class="gn-found">By going on you agree that anything you lend Tom will be posted back, obviously.</p>' +
      '<div class="gn-choices"><button class="gn-btn gn-alt" data-key="1" data-cw="yes">I ACCEPT THE RISKS<small>Become Tom. Gaming this eve?</small></button>' +
      '<button class="gn-btn" data-key="2" data-cw="no">TAKE ME BACK TO DON<small>Safe. Easy. Decides nothing.</small></button></div></div>';
    elCard.scrollTop = 0;
    var b = elCard.querySelector('[data-cw="no"]');
    if (b) b.focus({ preventScroll: true });
  }

  var reveal = null;
  function cancelReveal() { if (reveal) { reveal.stop(); reveal = null; } }

  function speaker(who) {
    if (who === 'sys') return '';
    if (who === player) return 'You';
    if (who === 'mum') return player === 'tom' ? 'Mum' : "Tom's mum";
    return nameOf(who);
  }
  function msgClass(who) { return 'gn-msg gn-msg-' + who + (who === player ? ' gn-me' : ''); }
  function bodyHtml(t) {
    var media = /^\[(gif|photo|meme): (.+)\]$/.exec(t);
    if (media) return '<span class="gn-media"><i>' + media[1].toUpperCase() + '</i>' + esc(media[2]) + '</span>';
    return '<span>' + esc(t) + '</span>';
  }
  function msgHtml(m) {
    var n = speaker(m[0]);
    return '<div class="' + msgClass(m[0]) + '">' + (n ? '<b>' + n + '</b>' : '') + bodyHtml(m[1]) + '</div>';
  }
  // add one line to the chat box; a 'react' line sticks to the message above it
  function addMsg(box, m) {
    if (m[0] === 'react') {
      var last = box.lastElementChild;
      if (last) { last.classList.add('has-react'); last.insertAdjacentHTML('beforeend', '<em class="gn-react">' + esc(m[1]) + '</em>'); return; }
    }
    box.insertAdjacentHTML('beforeend', msgHtml(m));
  }
  function typingHtml(who) {
    return '<div class="' + msgClass(who) + ' gn-typing"><b>' + speaker(who) + '</b><span><i></i><i></i><i></i></span></div>';
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
      for (; i < list.length; i++) addMsg(box, list[i]);
      reveal = null;
      done();
    }
    function step() {
      drop();
      if (i >= list.length) { end(); return; }
      var m = list[i], sys = m[0] === 'sys' || m[0] === 'react';
      if (!sys) { box.insertAdjacentHTML('beforeend', typingHtml(m[0])); typing = box.lastChild; scroll(); }
      timer = window.setTimeout(function () {
        drop();
        addMsg(box, m);
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
    var narr = (ev.first ? "Tonight's game: " + GAMES[g.game].name + '. ' + txt(g.comp.blurb) + ' ' : '') + txt(ev.text);
    var html = '<h2>' + esc(txt(ev.title)) + '</h2>' + (g.bridge ? '<p class="gn-bridge">' + esc(g.bridge) + '</p>' : '') +
      '<div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (narr ? '<p class="gn-nar">' + esc(narr) + '</p>' : '') + '<div class="gn-choices">';
    ev.choices.forEach(function (c, i) {
      html += '<button class="gn-btn" data-key="' + (i + 1) + '" data-choice="' + i + '">' + esc(txt(c.label)) + (txt(c.sub) ? '<small>' + esc(txt(c.sub)) + '</small>' : '') + '</button>';
    });
    elCard.innerHTML = html + '</div></div>';
    elCard.scrollTop = 0;
    afterChat($('gn-chat'), lines(ev.chat), function () { elCard.scrollTop = elCard.scrollHeight; });
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
    var chips = (r.mini ? '<span class="gn-chip ' + (r.mini.great ? 'good">PERFECT' : r.mini.win ? 'good">MINI-GAME WON' : 'bad">MINI-GAME LOST') + '</span>' : '') +
      chip('READY', r.p, true) + chip('VIBES', r.v, true);
    if (r.mins > ROUND_MIN) chips += '<span class="gn-chip bad">+' + (r.mins - ROUND_MIN) + ' MIN LOST</span>';
    if (r.d) chips += '<span class="gn-chip neutral">KICK-OFF +' + r.d + ' MIN</span>';
    elCard.innerHTML =
      '<h2>' + esc(txt(g.ev.title)) + '</h2>' +
      (r.mini && r.mini.note ? '<p class="gn-note">' + esc(r.mini.note) + '</p>' : '') +
      '<div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (r.msg ? '<p class="gn-nar">' + esc(r.msg) + '</p>' : '') +
      (r.trees ? '<p class="gn-aside">' + esc(r.trees) + '</p>' : '') +
      '<div class="gn-chips">' + chips + '</div>' +
      '<button class="gn-btn gn-go" data-next="1">CONTINUE</button></div>';
    elCard.scrollTop = 0;
    afterChat($('gn-chat'), (r.say ? [[player, r.say]] : []).concat(r.re || []), function () {
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

  // the endings, from whichever side of the sofa you're on
  var VERDICT = {
    win: ['MORK IS IN', function () {
      return 'Mork joins at ' + fmtClock(g.clock) + ', headset on, phone in another room. Nothing gets through. ' +
        (g.player === 'tom' ? "You take credit for the whole evening, and for once you've earned it." : 'Tom takes credit for the whole evening.');
    }],
    late: ['MORK, ARRIVING LATE', function () {
      var t = fmtClock(g.leaveAt + 70), z = fmtClock(g.leaveAt + 105);
      return g.player === 'tom'
        ? 'He joins at ' + t + ', shattered, and plays like a monk. By ' + z + " he's asleep with the controller in his hand. You play on very quietly so you don't wake him, and call it your best work."
        : 'He joins at ' + t + ', shattered, and plays like a monk. By ' + z + " he's asleep with the controller in his hand. Tom plays on and calls it 'his best work'.";
    }],
    noshow: ['NO MORK', function () {
      return g.player === 'tom'
        ? "Mork's last message was 'Sorry lads, Sunday though 👍'. You and Don play as a pair, and you show him photos of the garden for three hours. See you " + g.day.next + '.'
        : "Mork's last message was 'Sorry lads, Sunday though 👍'. You and Tom play as a pair, and Tom shows you photos of his garden for three hours. See you " + g.day.next + '.';
    }],
    heist: ['TOM HAS GONE QUIET', function () {
      if (g.player === 'tom') {
        return "Around eight you go quiet. You've got a lot of parcels to post. " + (g.morkIn ? 'Mork is online and plays on happily. ' : '') +
          "In three weeks or so you'll pop back up with 'Gaming this eve?', and everyone will be lovely about it.";
      }
      return "Around eight, Tom goes quiet. " + (g.morkIn ? 'Mork is online and plays on happily. ' : '') +
        "Over the next few days, a few things that look a lot like yours turn up on eBay. In three weeks or so, Tom will pop back up with 'Gaming this eve?'";
    }],
    rage: ["TOM COULDN'T WAIT", function () {
      return g.player === 'tom'
        ? "The mood fell apart. You got far too wound up, started without Mork, and then spent three hours apologising to a man who was asleep and not remotely bothered."
        : "The mood fell apart. Tom got far too wound up, started without Mork, and then spent three hours apologising to a man who was asleep and not remotely bothered.";
    }]
  };

  // the night's loose ends, tied off from the callbacks you set up
  function epilogue() {
    var out = [], f = g.flags, tom = g.player === 'tom';
    if (f.banner) out.push(g.ending === 'win' ? 'The WELCOME BACK TOM banner stays up all night.' : 'The WELCOME BACK TOM banner goes back in the drawer with the council letters.');
    if (f.kidname) out.push(tom ? "Mork's little one now asks for 'the tree man' at bedtime." : "Mork's little one now asks for Tom at bedtime. Tom is thrilled.");
    if (f.ebay) out.push(tom ? 'The headset listing has three watchers.' : 'Tom says the headset is a game changer.');
    if (f.gathering) out.push("Mork's boss has replied-all again. He wants to know about snacks.");
    if (f.swords) out.push('Nobody has mentioned the legendary shotgun since.');
    return out.slice(0, 2);
  }

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
    if (g.ending === 'win') {
      [g.dayKey, 'as-' + g.player].forEach(function (k) { if (wonDays.indexOf(k) === -1) wonDays.push(k); });
      saveJSON(WINS_KEY, wonDays);
    }
    var earned = loadJSON(BADGES_KEY, []), fresh = [];
    BADGES.forEach(function (bd) {
      if (earned.indexOf(bd.id) === -1 && bd.test(g, wonDays, found)) { earned.push(bd.id); fresh.push(bd); }
    });
    if (fresh.length) saveJSON(BADGES_KEY, earned);
    var score = scoreOf(), bk = bestKey(g.dayKey), best = loadJSON(BEST_KEY, {}), isBest = !best[bk] || score > best[bk];
    if (isBest) { best[bk] = score; saveJSON(BEST_KEY, best); }
    g.shareText = ['WHERE\'S MORK? ' + g.day.name + ', ' + GAMES[g.game].name + ' (as ' + nameOf(g.player) + ')', v[0], fmtClock(g.clock) + '  \ud83c\udf32 ' + st.trees + '  \ud83c\udf92 ' + st.steals + '  \ud83c\udfae ' + st.miniWon + '/' + st.miniPlayed,
      'Score ' + score, 'https://dpt106.github.io/game-night/'].join('\n');
    var rows = g.player === 'tom' ? [
      'Tonight: <b>' + GAMES[g.game].name + '</b> · ' + txt(g.comp.name),
      'Trees you took down tonight: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'Things the lads lent you: <b>none</b>. Maybe next time.' : 'Things the lads lent you: <b>' + st.steals + '</b>. So kind.',
      'Your eBay feedback: <b>100% positive</b>',
      st.maybes === 0 ? "Mork never said 'maybe'." : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>'
    ] : [
      'Tonight: <b>' + GAMES[g.game].name + '</b> · ' + txt(g.comp.name),
      "Trees down in Tom's garden tonight: <b>" + st.trees + '</b>',
      st.steals === 0 ? 'Things lent to Tom: <b>none</b>. He seemed a bit disappointed.' : 'Things lent to Tom: <b>' + st.steals + '</b>',
      'New eBay listings near Tom: <b>' + st.steals + '</b>',
      st.maybes === 0 ? "Mork never said 'maybe'." : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>. Very Don.' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>',
      st.easy === 0 ? 'Times you said you were easy: <b>none</b>. Out of character.' : "Times you said you were easy: <b>" + st.easy + '</b>'
    ];
    var rank = g.player === 'tom'
      ? (g.ending === 'heist' ? 'Top-rated eBay seller' : g.ending === 'win' && st.steals === 0 ? 'Nicest man alive. Genuinely.' : st.miniWon >= 3 ? 'Mini-game menace' :
        g.ending === 'win' ? 'Host of the year' : g.ending === 'rage' ? 'Too excited' : 'Still lovely')
      : (g.ending === 'heist' ? 'Very generous friend' : st.miniWon >= 3 ? 'Mini-game menace' : st.easy >= 3 ? 'Chief Easy Officer' :
        g.ending === 'win' && st.easy === 0 ? 'Decisive. Suspiciously.' : g.ending === 'win' ? 'Reasonably chill' : g.ending === 'rage' ? 'Tom wrangler (failed)' : 'Easy');
    rows.push(nameOf(g.player) + ' is now: <b>' + rank + '</b>');
    var epi = epilogue();
    elCard.setAttribute('data-ending', g.ending);
    elCard.innerHTML =
      '<h2>' + v[0] + '</h2><p>' + v[1]() + '</p>' +
      (epi.length ? '<p class="gn-epi">' + esc(epi.join(' ')) + '</p>' : '') +
      '<p class="gn-score">SCORE <b>' + score + '</b>' + (isBest ? ' <span class="gn-new">NEW BEST</span>' : ' · BEST ' + best[bk]) + '</p>' +
      (fresh.length ? '<div class="gn-chips">' + fresh.map(function (bd) { return '<span class="gn-chip good" title="' + bd.desc + '">NEW BADGE: ' + bd.name.toUpperCase() + '</span>'; }).join('') + '</div>' : '') +
      '<ul class="gn-stats">' + rows.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' +
      '<div class="gn-choices"><button class="gn-btn gn-go" data-again="1">PLAY AGAIN</button>' +
      '<button class="gn-btn gn-go gn-alt" data-copy="1">COPY RESULT</button></div>' +
      '<p class="gn-found">Endings found: ' + found.length + ' / ' + ENDING_COUNT + ' · Badges: ' + earned.length + ' / ' + BADGES.length + '</p>';
    sfx(g.ending === 'win' ? 'win' : g.ending === 'late' ? 'good' : 'lose');
    elCard.scrollTop = 0;
    var b = elCard.querySelector('[data-again]');
    if (b) b.focus({ preventScroll: true });
  }

  // ---------- game flow ----------

  function applyEffects(raw) {
    var o = settle(raw);
    var p = (o.p || 0) + BASE_READY, v = (o.v || 0) + BASE_VIBES, mins = ROUND_MIN + (o.t || 0);
    g.progress = clamp(g.progress + p, 0, 100);
    g.vibes = clamp(g.vibes + v, 0, 100);
    g.clock += mins;
    // whatever happens, the last fifteen minutes always get played
    if (!g.finalDone) g.clock = Math.min(g.clock, g.leaveAt - ROUND_MIN);
    if (o.d && g.shifts < 2) { g.leaveAt += o.d; g.shifts++; }
    if (o.set && !g.flags[o.set]) { g.flags[o.set] = 1; g.flagAt[o.set] = g.round; }
    if (o.next) g.queue.push(o.next);
    g.stats.steals += o.steals || 0;
    g.stats.maybes += o.maybes || 0;
    g.stats.easy += o.easy || 0;
    g.stats.lostMin += o.t || 0;
    var tom = g.player === 'tom', asides = tom ? TOM_SECRETS : TOM_RUMOURS, roll = Math.random(), aside = '';
    if (roll < 0.18 && !g.lastTree) {
      g.stats.trees++;
      aside = tom ? 'Meanwhile, you nip out to the garden. Another tree comes down.' : "Meanwhile, somewhere in Tom's garden, another tree comes down.";
    } else if (roll < 0.45) {
      // never the same line twice, and nothing about the headset until there is one
      var left = asides.filter(function (a) { return !g.usedAsides[a] && (g.flags.ebay || !/headset/.test(a)); });
      if (left.length) { aside = left[Math.floor(Math.random() * left.length)]; g.usedAsides[aside] = 1; }
    }
    g.lastTree = /tree comes down/.test(aside);
    return { p: p, v: v, d: o.d || 0, mins: mins, msg: txt(o.msg), re: lines(o.re), trees: aside };
  }

  function resolve(outcome, mini, say) {
    var before = g.progress;
    g.result = applyEffects(outcome);
    if (g.ev.final && before < WIN_READY && g.progress >= WIN_READY) g.clutch = true;
    g.result.say = txt(say);
    g.result.mini = mini || null;
    g.phase = 'result';
    renderResult();
  }

  function choose(i) {
    if (!g.ev.choices[i]) return;
    var c = settle(g.ev.choices[i]);
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
    // say so when Mork's evening has moved on since the last card
    var ph = eveningPhase(g.clock);
    g.bridge = '';
    if (ph !== g.phase0 && BRIDGES[ph]) g.bridge = fmtClock(g.clock) + '. ' + BRIDGES[ph][g.progress >= 35 ? 0 : 1];
    g.phase0 = ph;
    g.ev = pickEvent();
    g.round++;
    g.seen[g.ev.id] = 1;
    g.seen[baseId(g.ev)] = 1;
    g.phase = 'event';
    renderEvent();
  }

  // ---------- mini-games ----------
  // Each game has a title, its rules, and play(box, done). play draws the game
  // into box, calls done(win, note, great) once, and returns a cleanup
  // function that stops its timers. Every game opens on a rules card with a
  // START button, so nobody's caught out. A great win is worth a bit extra.

  var mini = null;
  function $(id) { return document.getElementById(id); }
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }
  function asTom() { return g.player === 'tom'; }
  function palName() { return nameOf(palOf(g.player)); }

  function startMini(choice) {
    var spec = MINI[choice.game], finished = false;
    mini = { cleanup: null };
    elCard.innerHTML = '<div class="gn-mini"><h2>' + spec.title() + '</h2><div class="gn-rules">' + spec.rules() + '</div>' +
      '<button type="button" class="gn-btn gn-go gn-big" id="gn-start">START</button></div>';
    elCard.scrollTop = 0;
    var go = $('gn-start');
    go.focus();
    go.addEventListener('click', function () {
      elCard.innerHTML = '<div class="gn-mini" id="gn-play"></div>';
      var stop = spec.play($('gn-play'), function (win, note, great) {
        if (finished) return;
        finished = true;
        if (mini && mini.cleanup) mini.cleanup();
        mini = null;
        g.stats.miniPlayed++;
        if (win) g.stats.miniWon++;
        var out = settle(win ? choice.ok : choice.bad);
        if (win && great) { out.p = (out.p || 0) + 4; out.v = (out.v || 0) + 4; }
        resolve(out, { win: win, great: !!(win && great), note: note || '' }, choice.say);
      });
      if (mini) mini.cleanup = stop;
      else if (stop) stop();
    });
  }

  var TIMER = '<div class="gn-bar gn-wide gn-timer"><i id="gn-time"></i></div>';

  // drains the #gn-time bar over ms, then calls onEnd
  function countdown(ms, onEnd) {
    var t0 = now(), raf, el = $('gn-time'), stopped = false;
    (function tick() {
      if (stopped) return;
      var left = 1 - (now() - t0) / ms;
      if (el) el.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) { onEnd(); return; }
      raf = window.requestAnimationFrame(tick);
    })();
    return function () { stopped = true; window.cancelAnimationFrame(raf); };
  }
  function timeLeft(t0, ms) { return Math.max(0, ms - (now() - t0)); }
  // a looping animation frame with a time step in seconds
  function frames(fn) {
    var last = now(), raf, stopped = false;
    (function tick() {
      if (stopped) return;
      var t = now(), dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      fn(dt, t);
      raf = window.requestAnimationFrame(tick);
    })();
    return function () { stopped = true; window.cancelAnimationFrame(raf); };
  }

  var MINI = {};

  // ----- Catch him typing: send while he's typing, never while the boss is looking -----
  MINI.typing = {
    title: function () { return 'CATCH HIM TYPING'; },
    rules: function () {
      return "<p>Mork's typing comes and goes. Hit SEND while the marker is in the green <b>typing…</b> window.</p>" +
        "<p>Never send while it's in the red <b>BOSS</b> window. His boss is reading over his shoulder.</p>" +
        "<p>Three good sends and he's yours. Three mistakes and he's gone.</p>";
    },
    play: function (box, done) {
      var hits = 0, bad = 0, pos = 0, dir = 1, speed = 0.55, green, red, flashT;
      box.innerHTML = '<h2>CATCH HIM TYPING</h2>' + TIMER +
        '<div class="gn-track" id="gn-track"><b class="ok" id="gn-zone">typing…</b><b class="boss" id="gn-boss">BOSS</b><i id="gn-mark"></i></div>' +
        '<p id="gn-info">Sent 0 / 3 · Mistakes 0 / 3</p><button type="button" class="gn-btn gn-big" id="gn-act">SEND</button>';
      var mark = $('gn-mark'), zoneEl = $('gn-zone'), bossEl = $('gn-boss'), track = $('gn-track'), btn = $('gn-act');
      function place(el, z) {
        el.style.display = z ? '' : 'none';
        if (z) { el.style.left = z.x * 100 + '%'; el.style.width = z.w * 100 + '%'; }
      }
      function layout() {
        var w = 0.22 - hits * 0.04;
        green = { x: 0.03 + Math.random() * (0.94 - w), w: w };
        red = null;
        if (hits > 0 || Math.random() < 0.5) {
          // the boss sits somewhere that doesn't overlap the green window
          var rw = 0.16 + hits * 0.04, x, tries = 0;
          do { x = 0.02 + Math.random() * (0.96 - rw); tries++; } while (tries < 30 && x < green.x + green.w + 0.03 && x + rw > green.x - 0.03);
          if (tries < 30) red = { x: x, w: rw };
        }
        place(zoneEl, green);
        place(bossEl, red);
      }
      function inside(z) { return !!z && pos >= z.x && pos <= z.x + z.w; }
      layout();
      var stopFrames = frames(function (dt) {
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; }
        if (pos < 0) { pos = 0; dir = 1; }
        mark.style.left = pos * 100 + '%';
      });
      btn.focus();
      btn.addEventListener('click', function () {
        var good = inside(green), msg;
        if (good) { hits++; msg = 'Delivered while he was typing. '; }
        else if (inside(red)) { bad++; msg = 'The boss saw that. '; }
        else { bad++; msg = "He'd stopped typing. "; }
        track.className = 'gn-track ' + (good ? 'hit' : 'miss');
        window.clearTimeout(flashT);
        flashT = window.setTimeout(function () { track.className = 'gn-track'; }, 300);
        $('gn-info').textContent = msg + 'Sent ' + hits + ' / 3 · Mistakes ' + bad + ' / 3';
        if (hits >= 3) { done(true, bad ? 'Three messages landed. He replied to all of them, properly.' : 'Three for three. Mork replies with a whole paragraph.', bad === 0); return; }
        if (bad >= 3) { done(false, "He's gone into a meeting. He'll reply properly in about an hour."); return; }
        speed *= 1.2;
        layout();
      });
      var stop = countdown(20000, function () { done(false, 'Out of time. Mork: "Sorry, only just seen this"'); });
      return function () { stop(); stopFrames(); window.clearTimeout(flashT); };
    }
  };

  // ----- Load the dishwasher: plates, mugs, the pan, and not the bear -----
  MINI.dishes = {
    title: function () { return 'LOAD THE DISHWASHER'; },
    rules: function () {
      return '<p>Mork is on video, loading the dishwasher. Tap things to load them before they slide away.</p>' +
        "<p>🍽️ and ☕ take one tap. 🍳 takes three. It's the pan.</p>" +
        "<p>Don't tap 🧸. That belongs to the little one.</p>" +
        '<p>Load 22 before the timer runs out. Three mistakes and he gives up.</p>';
    },
    play: function (box, done) {
      var NEED = 22, MS = 16000, loaded = 0, bad = 0, spawnT, items = {}, t0 = now();
      var KINDS = [
        { k: 'plate', e: '🍽️', taps: 1, life: 1300, w: 5 },
        { k: 'mug', e: '☕', taps: 1, life: 950, w: 3 },
        { k: 'pan', e: '🍳', taps: 3, life: 2600, w: 2, worth: 3 },
        { k: 'toy', e: '🧸', taps: 0, life: 1400, w: 3 }
      ];
      var html = '<h2>LOAD THE DISHWASHER</h2>' + TIMER + '<div class="gn-grid gn-grid4" id="gn-grid">';
      for (var i = 0; i < 12; i++) html += '<button type="button" class="gn-slot" data-slot="' + i + '" aria-label="Empty rack"></button>';
      box.innerHTML = html + '</div><p id="gn-info">Loaded 0 / ' + NEED + ' · Mistakes 0 / 3</p>';
      var slots = $('gn-grid').children;
      function info(extra) { $('gn-info').textContent = (extra || '') + 'Loaded ' + Math.min(loaded, NEED) + ' / ' + NEED + ' · Mistakes ' + bad + ' / 3'; }
      function clear(k) {
        if (items[k]) { window.clearTimeout(items[k].t); delete items[k]; }
        slots[k].className = 'gn-slot';
        slots[k].innerHTML = '';
        slots[k].setAttribute('aria-label', 'Empty rack');
      }
      function draw(k) {
        var it = items[k];
        slots[k].innerHTML = it.kind.e + (it.kind.taps > 1 ? '<small>' + it.left + '</small>' : '');
      }
      function spawn() {
        var empty = [];
        for (var j = 0; j < slots.length; j++) if (!items[j]) empty.push(j);
        if (empty.length) {
          var k = pickOne(empty), total = 0, r, kind;
          KINDS.forEach(function (x) { total += x.w; });
          r = Math.random() * total;
          for (var n = 0; n < KINDS.length; n++) { r -= KINDS[n].w; if (r < 0) { kind = KINDS[n]; break; } }
          kind = kind || KINDS[0];
          items[k] = { kind: kind, left: kind.taps, t: window.setTimeout(function () { clear(k); }, kind.life) };
          slots[k].className = 'gn-slot on gn-' + kind.k;
          slots[k].setAttribute('aria-label', kind.k === 'toy' ? 'Teddy bear' : kind.k);
          draw(k);
        }
        var hurry = Math.min(160, (now() - t0) / 60);
        spawnT = window.setTimeout(spawn, 420 + Math.random() * 300 - hurry);
      }
      $('gn-grid').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.gn-slot') : null;
        if (!b) return;
        var k = +b.getAttribute('data-slot'), it = items[k];
        if (!it) return;
        if (it.kind.k === 'toy') {
          bad++;
          clear(k);
          info("That's the bear. ");
          if (bad >= 3) done(false, "Three mistakes. Mork is sitting on the kitchen floor holding the bear.");
          return;
        }
        it.left--;
        if (it.left > 0) { draw(k); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); return; }
        loaded += it.kind.worth || 1;
        clear(k);
        info();
        if (loaded >= NEED) {
          var spare = timeLeft(t0, MS) / 1000;
          done(true, 'Loaded with ' + spare.toFixed(1) + ' seconds to spare.' + (bad === 0 ? ' Not a single bear.' : ''), bad === 0 && spare >= 3);
        }
      });
      spawn();
      var stop = countdown(MS, function () { done(false, Math.min(loaded, NEED) + ' / ' + NEED + '. A pan remains. There is always a pan.'); });
      return function () {
        stop();
        window.clearTimeout(spawnT);
        Object.keys(items).forEach(function (k) { window.clearTimeout(items[k].t); });
      };
    }
  };

  // ----- Loot scramble: grab the good stuff before Tom "holds onto it for you" -----
  var RARITY = [
    { k: 'white', n: 'White', v: 1, w: 40 }, { k: 'green', n: 'Green', v: 2, w: 28 }, { k: 'blue', n: 'Blue', v: 3, w: 18 },
    { k: 'purple', n: 'Purple', v: 5, w: 10 }, { k: 'orange', n: 'Legendary', v: 10, w: 6 }
  ];
  MINI.grab = {
    title: function () { return 'LOOT SCRAMBLE'; },
    rules: function () {
      var key = RARITY.map(function (r) { return '<span class="gn-r-' + r.k + '">' + r.n + ' ' + r.v + '</span>'; }).join(' ');
      return asTom()
        ? "<p>A chest has burst and Don's right next to it. Don is not very quick.</p><p>Tap loot to grab it. Better loot is worth more: " + key + '</p><p>Don goes for the best thing on screen, eventually. Finish with more than him.</p>'
        : '<p>A chest has burst. Loot is raining down, and Tom is very quick.</p><p>Tap loot to grab it before he does. Better loot is worth more: ' + key + "</p><p>Tom always goes for the best thing on screen. Finish with more than him.</p>";
    },
    play: function (box, done) {
      var MS = 15000, mine = 0, theirs = 0, myOrange = 0, items = {}, spawnT;
      var rival = asTom() ? { name: 'Don', delay: 700 } : { name: 'Tom', delay: 450 };
      var html = '<h2>LOOT SCRAMBLE</h2>' + TIMER + '<div class="gn-grid gn-loot" id="gn-grid">';
      for (var i = 0; i < 9; i++) html += '<button type="button" class="gn-slot" data-slot="' + i + '" aria-label="Empty"></button>';
      box.innerHTML = html + '</div><p class="gn-tally2" id="gn-score"></p><p id="gn-info">&nbsp;</p>';
      var slots = $('gn-grid').children;
      function score() { $('gn-score').innerHTML = '<b>You</b> ' + mine + ' · <b>' + rival.name + '</b> ' + theirs; }
      function clear(k) {
        if (items[k]) { window.clearTimeout(items[k].t); delete items[k]; }
        slots[k].className = 'gn-slot';
        slots[k].textContent = '';
        slots[k].setAttribute('aria-label', 'Empty');
      }
      function spawn() {
        var empty = [];
        for (var j = 0; j < slots.length; j++) if (!items[j]) empty.push(j);
        if (empty.length) {
          var k = pickOne(empty), r = Math.random() * 102, rar = RARITY[0];
          for (var n = 0; n < RARITY.length; n++) { r -= RARITY[n].w; if (r < 0) { rar = RARITY[n]; break; } }
          items[k] = { rar: rar, t: window.setTimeout(function () { clear(k); }, 1700) };
          claim(k, items[k]);
          slots[k].className = 'gn-slot on gn-r-' + rar.k;
          slots[k].textContent = rar.v;
          slots[k].setAttribute('aria-label', rar.n + ', worth ' + rar.v);
        }
        spawnT = window.setTimeout(spawn, 170 + Math.random() * 130);
      }
      // the rival goes for anything good the moment it lands: always the legendaries, rarely the whites
      var CHANCE = { white: 0.3, green: 0.55, blue: 0.8, purple: 1, orange: 1 }, rivalTs = [];
      function claim(k, it) {
        if (Math.random() > CHANCE[it.rar.k] * (asTom() ? 0.8 : 1)) return;
        var wait = rival.delay * (0.7 + Math.random() * 0.6) * (it.rar.k === 'orange' ? 0.8 : 1);
        rivalTs.push(window.setTimeout(function () {
          if (items[k] !== it) return;
          theirs += it.rar.v;
          clear(k);
          slots[k].classList.add('taken');
          window.setTimeout(function () { slots[k].classList.remove('taken'); }, 250);
          if (it.rar.k === 'orange') $('gn-info').textContent = asTom() ? 'Don: oh nice' : "Tom: I'll hold onto that for you";
          score();
        }, wait));
      }
      $('gn-grid').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.gn-slot') : null;
        if (!b) return;
        var k = +b.getAttribute('data-slot'), it = items[k];
        if (!it) return;
        mine += it.rar.v;
        if (it.rar.k === 'orange') { myOrange++; $('gn-info').textContent = 'Legendary! Yours.'; }
        clear(k);
        score();
      });
      score();
      spawn();
      var stop = countdown(MS, function () {
        var win = mine > theirs, great = win && myOrange >= 2;
        var note = asTom()
          ? (win ? 'You ' + mine + ', Don ' + theirs + ". Don says he's easy about it." : 'Don ' + theirs + ', you ' + mine + ". Don's quicker than he looks.")
          : (win ? 'You ' + mine + ', Tom ' + theirs + (great ? '. Two legendaries! Tom offers to hold onto them for you.' : '. Tom says well done, and means it.') : 'Tom ' + theirs + ', you ' + mine + ". He'll hold onto it all for you.");
        done(win, note, great);
      });
      return function () {
        stop();
        window.clearTimeout(spawnT);
        rivalTs.forEach(function (t) { window.clearTimeout(t); });
        Object.keys(items).forEach(function (k) { window.clearTimeout(items[k].t); });
      };
    }
  };

  // ----- Timber: cut the notch, then drop it on the lawn -----
  MINI.timber = {
    title: function () { return 'TIMBER!'; },
    rules: function () {
      return '<p>Two steps. First, CHOP 15 times to cut the notch before the timer runs out. The faster you chop, the steadier the tree.</p>' +
        '<p>Then the tree starts to sway. Hit TIMBER while it leans over the <b>lawn</b>. Not the shed. Not next door.</p>';
    },
    play: function (box, done) {
      var TAPS = 15, taps = 0, stopSway = null, stopTimer, t0 = now();
      box.innerHTML = '<h2>TIMBER!</h2>' + TIMER +
        '<div class="gn-yard"><span class="gn-tree" id="gn-tree">🌳</span></div>' +
        '<div class="gn-bar gn-wide"><i id="gn-prog" style="width:0"></i></div>' +
        '<p id="gn-info">Notch: 0 / ' + TAPS + '</p><button type="button" class="gn-btn gn-big" id="gn-act">CHOP</button>';
      var btn = $('gn-act'), tree = $('gn-tree');
      btn.focus();
      function fell() {
        stopTimer();
        var left = timeLeft(t0, 6000) / 6000, speed = 0.45 + (1 - left) * 0.9, phase = 0, pos = 0.5;
        box.innerHTML = '<h2>TIMBER!</h2>' + TIMER +
          '<div class="gn-yard"><span class="gn-tree" id="gn-tree">🌳</span></div>' +
          '<div class="gn-strip"><span class="shed">SHED</span><span class="lawn">LAWN</span><span class="fence">NEXT DOOR</span><i id="gn-mark"></i></div>' +
          "<p id=\"gn-info\">It's going… wait for the lawn.</p><button type=\"button\" class=\"gn-btn gn-big\" id=\"gn-act\">TIMBER!</button>";
        var mark = $('gn-mark'), t2 = $('gn-tree'), b2 = $('gn-act');
        b2.focus();
        stopSway = frames(function (dt) {
          phase += dt * speed * Math.PI;
          pos = 0.5 + 0.5 * Math.sin(phase);
          mark.style.left = pos * 100 + '%';
          t2.style.transform = 'rotate(' + ((pos - 0.5) * 70) + 'deg)';
        });
        b2.addEventListener('click', function () {
          if (pos < 0.35) done(false, 'It did not miss the shed.');
          else if (pos > 0.62) done(false, 'Next door would like a word.');
          else {
            var great = Math.abs(pos - 0.485) < 0.05;
            done(true, great ? 'Dead centre of the lawn. Somewhere, a council officer weeps.' : 'Down on the lawn. It missed the shed!', great);
          }
        });
        stopTimer = countdown(6000, function () { done(false, 'You waited too long. It fell by itself, onto the shed.'); });
      }
      btn.addEventListener('click', function () {
        taps++;
        $('gn-prog').style.width = Math.min(100, taps / TAPS * 100) + '%';
        $('gn-info').textContent = 'Notch: ' + taps + ' / ' + TAPS;
        tree.style.transform = 'rotate(' + (taps % 2 ? 3 : -3) + 'deg)';
        btn.classList.remove('hit');
        void btn.offsetWidth;
        btn.classList.add('hit');
        if (taps === TAPS) fell();
      });
      stopTimer = countdown(6000, function () { done(false, taps + ' / ' + TAPS + ' chops. The tree stands. It looks smug.'); });
      return function () { stopTimer(); if (stopSway) stopSway(); };
    }
  };

  // ----- Breathe: bring the hype down before Tom does a speech -----
  var HYPE_LINES = ["I've made a SECOND banner", 'Should I do a speech?', 'What if we all wore matching headsets', "I've ordered a smoke machine", 'Is it 7:30 yet?', 'I AM SO CALM', "I've written us a theme tune"];
  MINI.breathe = {
    title: function () { return asTom() ? 'BREATHE, TOM' : 'BREATHE WITH TOM'; },
    rules: function () {
      return '<p>' + (asTom() ? "You're" : "Tom's") + ' getting more excited by the second. Watch the HYPE meter.</p>' +
        '<p>Hold the button to breathe in, and let go while the circle is inside the gold ring. The ring moves every breath.</p>' +
        '<p>Three good breaths and ' + (asTom() ? "you're" : "he's") + ' calm. If HYPE fills up, ' + (asTom() ? "you're" : "he's") + ' off.</p>';
    },
    play: function (box, done) {
      var GROW = 2200, MAX = 1.1, good = 0, bad = 0, holding = false, held0 = 0, size = 0, hype = 30, lo, hi, nextLine = 2.5, over = false;
      box.innerHTML = '<h2>' + this.title() + '</h2>' +
        '<p class="gn-meter2">HYPE <span class="gn-bar gn-hype"><i id="gn-hype"></i></span></p>' +
        '<p class="gn-hypeline" id="gn-line">&nbsp;</p>' +
        '<div class="gn-lung gn-lung2" id="gn-lung"><b id="gn-ring"></b><i id="gn-breath"></i></div>' +
        '<p id="gn-info">Good 0 / 3 · Bad ' + bad + '</p>' +
        '<button type="button" class="gn-btn gn-big gn-hold" id="gn-act">HOLD</button>';
      var btn = $('gn-act'), circle = $('gn-breath'), ring = $('gn-ring'), lung = $('gn-lung');
      function newRing() {
        lo = 0.32 + Math.random() * 0.42;
        hi = lo + 0.2 - good * 0.03;
        var px = lung.offsetWidth || 130;
        ring.style.width = ring.style.height = hi * 100 + '%';
        ring.style.borderWidth = Math.max(4, (hi - lo) * px / 2) + 'px';
      }
      function draw() {
        circle.style.transform = 'translate(-50%, -50%) scale(' + size + ')';
        circle.className = holding ? (size >= lo && size <= hi ? 'grow in' : 'grow') : '';
        $('gn-hype').style.width = Math.min(100, hype) + '%';
      }
      function finish(win, note, great) { if (over) return; over = true; done(win, note, great); }
      newRing();
      var stopFrames = frames(function (dt) {
        hype += dt * 9;
        nextLine -= dt;
        if (nextLine <= 0) {
          nextLine = 2.2 + Math.random() * 1.2;
          hype += 6;
          $('gn-line').textContent = (asTom() ? 'You: ' : 'Tom: ') + pickOne(HYPE_LINES);
        }
        if (holding) {
          size = Math.min(MAX, (now() - held0) / GROW);
          if (size >= MAX) release();
        }
        draw();
        if (hype >= 100) finish(false, 'Too late. ' + (asTom() ? "You've" : "Tom's") + ' started the speech.');
      });
      function press() {
        if (holding || over) return;
        holding = true;
        held0 = now();
        btn.textContent = 'BREATHE IN…';
      }
      function release() {
        if (!holding) return;
        holding = false;
        var ok = size >= lo && size <= hi;
        if (ok) { good++; hype = Math.max(0, hype - 28); } else { bad++; hype += 12; }
        $('gn-info').textContent = (ok ? 'Lovely. ' : size < lo ? 'Too shallow. ' : 'Too much. ') + 'Good ' + good + ' / 3 · Bad ' + bad;
        btn.textContent = 'HOLD';
        size = 0;
        if (good >= 3) { finish(true, asTom() ? 'Three slow breaths. You are, briefly, at peace.' : 'Three slow breaths. Tom is, briefly, at peace.', bad === 0); return; }
        newRing();
        draw();
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
      return function () { stopFrames(); };
    }
  };

  // ----- Where's Tom: hot and cold on a Big Walk -----
  MINI.shout = {
    title: function () { return asTom() ? 'FIND DON' : "WHERE'S TOM?"; },
    rules: function () {
      return asTom()
        ? "<p>The shortcut didn't work and you've lost Don. Walk with the arrows. After every step Don shouts back, and the louder he is, the closer you are.</p><p>You've only got a few steps to spare.</p>"
        : "<p>Tom took a shortcut, and now he's somewhere out on the hills. Walk with the arrows. After every step he shouts back, and the louder he is, the closer you are.</p><p>You've only got a few steps to spare.</p>";
    },
    play: function (box, done) {
      var N = 6, me = { x: 0, y: 5 }, target, steps = 0, lastD, seen = {}, keyH;
      do { target = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; }
      while (Math.abs(target.x - me.x) + Math.abs(target.y - me.y) < 4 || Math.abs(target.x - me.x) + Math.abs(target.y - me.y) > 7);
      var best = Math.abs(target.x - me.x) + Math.abs(target.y - me.y), STEPS = best + 3;
      var html = '<h2>' + this.title() + '</h2><div class="gn-map" id="gn-map">';
      for (var i = 0; i < N * N; i++) html += '<i></i>';
      box.innerHTML = html + '</div><p class="gn-shout" id="gn-shout">&nbsp;</p><p id="gn-info">Steps left: ' + STEPS + '</p>' +
        '<div class="gn-pad"><button type="button" class="gn-btn" data-move="0,-1" aria-label="North">↑</button>' +
        '<button type="button" class="gn-btn" data-move="-1,0" aria-label="West">←</button>' +
        '<button type="button" class="gn-btn" data-move="1,0" aria-label="East">→</button>' +
        '<button type="button" class="gn-btn" data-move="0,1" aria-label="South">↓</button></div>';
      var cells = $('gn-map').children, who = asTom() ? 'Don' : 'Tom';
      function dist() { return Math.abs(target.x - me.x) + Math.abs(target.y - me.y); }
      function draw() {
        for (var j = 0; j < cells.length; j++) cells[j].className = seen[j] ? 'seen' : '';
        cells[me.y * N + me.x].className = 'me';
      }
      function shout(d) {
        var lines = asTom()
          ? ['', 'oh hi', 'over here!', 'over here', '(faint) …over here', '(very faint) …tom?', '(silence)']
          : ['', 'Oh hi! Found a really good bit', 'OVER HERE!', 'Over here!', '(faint) …over here…', '(very faint) …found a good bit…', '(silence)'];
        var trend = lastD === undefined ? '' : d < lastD ? '  (louder)' : d > lastD ? '  (quieter)' : '  (same)';
        $('gn-shout').textContent = who + ': ' + lines[Math.min(6, d)] + trend;
      }
      function move(dx, dy) {
        var nx = me.x + dx, ny = me.y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) return;
        seen[me.y * N + me.x] = 1;
        me = { x: nx, y: ny };
        steps++;
        var d = dist();
        draw();
        shout(d);
        lastD = d;
        $('gn-info').textContent = 'Steps left: ' + (STEPS - steps);
        if (d === 0) {
          cells[me.y * N + me.x].className = 'found';
          done(true, asTom() ? "Found Don. He's been sitting on a rock the whole time." : "Found him. He's found a really good bit.", steps <= best + 1);
        } else if (steps >= STEPS) {
          done(false, asTom() ? 'Still lost. Don sends you a pin. It is of a very different hill.' : "No sign of him. Tom's last message: 'brb'");
        }
      }
      box.querySelector('.gn-pad').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-move]') : null;
        if (!b) return;
        var m = b.getAttribute('data-move').split(',');
        move(+m[0], +m[1]);
      });
      keyH = function (e) {
        var k = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
        if (k) { e.preventDefault(); move(k[0], k[1]); }
      };
      document.addEventListener('keydown', keyH);
      draw();
      shout(dist());
      lastD = dist();
      box.querySelector('[data-move]').focus();
      return function () { document.removeEventListener('keydown', keyH); };
    }
  };

  // ----- Outbid: buy your own headset back off eBay -----
  MINI.auction = {
    title: function () { return 'OUTBID'; },
    rules: function () {
      return "<p>Your old headset is up on eBay, and you'd quite like it back.</p>" +
        "<p>Bid with the buttons. Your budget is £40. There's one other bidder, 'a buyer near you', and they love a last-second bid.</p>" +
        '<p>Be the top bidder when the timer hits zero.</p>';
    },
    play: function (box, done) {
      var MS = 15000, t0 = now(), price = 18, leading = false, rivalMax = 30 + Math.floor(Math.random() * 9), rivalT, sniped = false, log = [];
      box.innerHTML = '<h2>OUTBID</h2>' + TIMER +
        "<p class=\"gn-lot\">'Gaming headset, lightly used, a bit of wear on the left ear'</p>" +
        '<p class="gn-price" id="gn-price">£18</p><p id="gn-lead">No bids yet</p>' +
        '<div class="gn-pad2"><button type="button" class="gn-btn" id="gn-b1">BID +£1</button><button type="button" class="gn-btn" id="gn-b5">BID +£5</button></div>' +
        '<ul class="gn-log" id="gn-log"></ul>';
      function draw() {
        $('gn-price').textContent = '£' + price;
        $('gn-lead').textContent = leading ? "You're the top bidder" : log.length ? "Top bidder: 'a buyer near you'" : 'No bids yet';
        $('gn-lead').className = leading ? 'good' : '';
        $('gn-log').innerHTML = log.slice(-3).reverse().map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
        $('gn-b1').disabled = price + 1 > 40;
        $('gn-b5').disabled = price + 5 > 40;
      }
      function rivalBid() {
        rivalT = 0;
        if (!leading || price >= rivalMax || timeLeft(t0, MS) < 350) return;
        price = Math.min(rivalMax, price + 1 + Math.floor(Math.random() * 3));
        leading = false;
        log.push("a buyer near you bid £" + price);
        draw();
      }
      function bid(inc) {
        if (price + inc > 40) return;
        price += inc;
        leading = true;
        log.push('you bid £' + price);
        draw();
        window.clearTimeout(rivalT);
        // early on they only sometimes answer; near the end they always do
        var left = timeLeft(t0, MS);
        if (left > 4000 && Math.random() < 0.5) { rivalT = 0; return; }
        rivalT = window.setTimeout(rivalBid, left > 4000 ? 700 + Math.random() * 900 : 250 + Math.random() * 300);
      }
      $('gn-b1').addEventListener('click', function () { bid(1); });
      $('gn-b5').addEventListener('click', function () { bid(5); });
      // the snipe: if you're winning a second from the end, they bid
      var snipeT = window.setTimeout(function () { sniped = true; if (leading) rivalBid(); }, MS - 1000);
      draw();
      $('gn-b1').focus();
      var stop = countdown(MS, function () {
        if (leading) done(true, price <= 30 ? 'Yours for £' + price + '. The seller leaves you lovely feedback.' : 'Yours for £' + price + '. Postage is £4.99. The seller is very quick.', price <= 30);
        else done(false, log.length ? "Sold to 'a buyer near you' for £" + price + '.' : 'No bids. It sells to someone else for £18.');
      });
      return function () { stop(); window.clearTimeout(rivalT); window.clearTimeout(snipeT); };
    }
  };

  // ----- Keep the lights on: juggle the factory while Tom plugs things in -----
  var SPIKES = ['a Space Elevator', 'his own factory', 'the Christmas lights', 'a Particle Accelerator', 'a second Space Elevator', 'something he found'];
  MINI.power = {
    title: function () { return 'KEEP THE LIGHTS ON'; },
    rules: function () {
      return '<p>Your factory runs on 100 MW, and ' + palName() + ' keeps plugging things in.</p>' +
        '<p>Tap machines to switch them on and off. Running machines make parts. Go over 100 MW for more than a moment and the fuse blows.</p>' +
        '<p>Make 300 parts in 20 seconds. Two blown fuses and the night is over.</p>';
    },
    play: function (box, done) {
      var MS = 20000, CAP = 100, parts = 0, fuses = 0, over = 0, spike = 0, spikeLeft = 0, nextSpike = 2.5, dark = 0, ended = false;
      var M = [{ n: 'Smelter', mw: 20, on: true }, { n: 'Constructor', mw: 15, on: true }, { n: 'Assembler', mw: 30, on: true }, { n: 'Foundry', mw: 35, on: false }, { n: 'Refinery', mw: 40, on: false }];
      var html = '<h2>KEEP THE LIGHTS ON</h2>' + TIMER +
        '<p class="gn-meter2">POWER <span class="gn-bar gn-power"><i id="gn-load"></i></span> <span id="gn-mw"></span></p>' +
        '<p class="gn-hypeline" id="gn-line">&nbsp;</p><div class="gn-machines" id="gn-machines">';
      M.forEach(function (m, i) { html += '<button type="button" class="gn-btn gn-mach" data-m="' + i + '">' + m.n + '<small>' + m.mw + ' MW</small></button>'; });
      box.innerHTML = html + '</div><p id="gn-info">Parts 0 / 300 · Fuses 0 / 2</p>';
      var btns = $('gn-machines').children;
      function usage() { return M.reduce(function (a, m) { return a + (m.on ? m.mw : 0); }, 0) + spike; }
      function draw() {
        var u = usage();
        M.forEach(function (m, i) { btns[i].classList.toggle('on', m.on); btns[i].setAttribute('aria-pressed', m.on ? 'true' : 'false'); });
        $('gn-load').style.width = Math.min(100, u / CAP * 100) + '%';
        $('gn-load').className = u > CAP ? 'hot' : '';
        $('gn-mw').textContent = u + ' / ' + CAP + ' MW';
        $('gn-info').textContent = 'Parts ' + Math.floor(parts) + ' / 300 · Fuses ' + fuses + ' / 2';
      }
      function finish(win, note, great) { if (ended) return; ended = true; done(win, note, great); }
      $('gn-machines').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-m]') : null;
        if (!b || dark > 0) return;
        var m = M[+b.getAttribute('data-m')];
        m.on = !m.on;
        draw();
      });
      var stopFrames = frames(function (dt) {
        if (dark > 0) { dark -= dt; if (dark <= 0) $('gn-line').textContent = 'Power restored.'; return; }
        nextSpike -= dt;
        if (spikeLeft > 0) { spikeLeft -= dt; if (spikeLeft <= 0) { spike = 0; $('gn-line').textContent = palName() + ' unplugged it.'; } }
        else if (nextSpike <= 0) {
          spike = 25 + Math.floor(Math.random() * 25);
          spikeLeft = 2.5 + Math.random();
          nextSpike = spikeLeft + 1.5 + Math.random() * 2;
          $('gn-line').textContent = palName() + ' plugged in ' + pickOne(SPIKES) + ' (+' + spike + ' MW)';
        }
        var u = usage();
        if (u > CAP) {
          over += dt;
          if (over > 0.7) {
            fuses++;
            over = 0;
            spike = 0;
            spikeLeft = 0;
            M.forEach(function (m) { m.on = false; });
            dark = 1.5;
            $('gn-line').textContent = 'POWER FAILURE: fuse blown';
            if (fuses >= 2) { draw(); finish(false, 'The fuse blew twice. ' + palName() + ': ' + (asTom() ? "'sorry. plugged something in'" : "'Sorry! Plugged something in'")); return; }
          }
        } else {
          over = 0;
          parts += M.reduce(function (a, m) { return a + (m.on ? m.mw : 0); }, 0) / 3.6 * dt;
        }
        draw();
        if (parts >= 300) finish(true, fuses ? '300 parts. The lights only went out once.' : 'Not a single flicker. ' + palName() + ' unplugs his Space Elevator, impressed.', fuses === 0);
      });
      draw();
      btns[0].focus();
      var stop = countdown(MS, function () { finish(false, 'Only ' + Math.floor(parts) + ' parts. The factory sulks.'); });
      return function () { stop(); stopFrames(); };
    }
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
    if (t.hasAttribute('data-player') || t.hasAttribute('data-cw')) {
      var pick = t.getAttribute('data-player') || (t.getAttribute('data-cw') === 'yes' ? 'tom' : 'don');
      // switching to Tom needs a signature first
      if (pick === 'tom' && player !== 'tom' && !t.hasAttribute('data-cw')) { sfx('bad'); renderWarning(); return; }
      player = pick;
      try { localStorage.setItem(PLAYER_KEY, player); } catch (err) { /* ignore */ }
      sfx(t.getAttribute('data-cw') === 'yes' ? 'lose' : 'click');
      renderIntro();
      var picked = elCard.querySelector('[data-player="' + player + '"]');
      if (picked) picked.focus({ preventScroll: true });
    }
    else if (t.hasAttribute('data-day')) { g = newGame(t.getAttribute('data-day')); setHint('TONIGHT: ' + GAMES[g.game].name.toUpperCase()); sfx('click'); nextRound(); }
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
