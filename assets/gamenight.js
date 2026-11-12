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
  var WIN_READY = 52;           // readiness needed at kick-off for Mork to be on time
  var LATE_READY = 30;          // enough to turn up late and fall asleep on the controller
  var ENDINGS_KEY = 'is-mork-coming-endings';
  var ENDING_COUNT = 5;
  var PLAYER_KEY = 'where-is-mork-player';

  var DAYS = {
    sunday: { name: 'Sunday', next: 'Wednesday', blurb: 'Family dinner, then baths. Mork is a hostage until 7.', workWeight: 1 },
    wednesday: { name: 'Wednesday', next: 'Sunday', blurb: 'Work is overrunning. Mork is a hostage until it stops.', workWeight: 2 },
    birthday: { name: "Tom's birthday", next: 'Sunday', blurb: { don: 'Tom has been waiting for this since his last birthday. Everything is about Tom.', tom: "It's your birthday. Everything is about you, as it should be." }, workWeight: 1, special: true, tomBoost: 2.5, vibes: 15, hint: 'Get Mork online once' },
    launch: { name: 'Launch night', next: 'Wednesday', blurb: { don: "Tom's game goes live tonight. Tom is calm in the way a kettle is calm.", tom: 'Your game goes live tonight. You are calm in the way a kettle is calm.' }, workWeight: 1, special: true, tomBoost: 2, vibes: 5, hint: 'Find 3 endings' }
  };
  var DAY_ORDER = ['sunday', 'wednesday', 'birthday', 'launch'];

  // a random wrinkle for every night: nudges the starting numbers and event odds
  var COMPS = [
    { name: 'A quiet night', blurb: 'Nothing is wrong. Be suspicious.', ready: 4, vibes: 6, boost: {} },
    { name: 'The kid has a cold', blurb: "Mork is on tissue duty, and it's all anyone wants to talk about.", ready: -4, boost: { bedtime: 3, dinner: 2, kidsasleep: 0.3 } },
    { name: { don: "Tom hasn't slept", tom: "You haven't slept" }, blurb: { don: 'Tom has been awake since Monday. He has plans.', tom: 'You have been awake since Monday. You have plans.' }, boost: { calm: 3, sermon: 3, tomgame: 3, stream: 2 } },
    { name: { don: 'Tom feels generous', tom: 'You feel generous' }, blurb: 'Everything is a gift. Count the gifts.', boost: { generous: 4, steal: 3, inventory: 3, tomloan: 3 } },
    { name: "Don's wifi is a rumour", blurb: { don: 'Your connection is held together by hope.', tom: "Don's connection is held together by hope." }, boost: { update: 6 } },
    { name: 'Mork has a deadline', blurb: "A report is due. Mork will say 'one hour'.", ready: -6, boost: { work: 3, boss: 3, voicenote: 3 } },
    { name: { don: 'Tom is back from "away"', tom: 'You are back from "away"' }, blurb: { don: 'Three weeks gone, and he is feeling chatty.', tom: 'Three weeks gone, and you are feeling chatty.' }, boost: { tomback: 6, tomgone: 3, tommum: 4, tomalibi: 4 } }
  ];

  var BADGES = [
    { id: 'in', name: 'He Came', desc: 'Get Mork online on time.', test: function (g) { return g.ending === 'win'; } },
    { id: 'late', name: 'Better Late', desc: 'Mork shows up, then falls asleep.', test: function (g) { return g.ending === 'late'; } },
    { id: 'ghost', name: 'Seen at 11:48', desc: 'No Mork at all.', test: function (g) { return g.ending === 'noshow'; } },
    { id: 'heist', name: 'A Very Good Retreat', desc: 'As Don, let Tom leave the party with your things.', test: function (g) { return g.ending === 'heist' && g.player === 'don'; } },
    { id: 'mastermind', name: 'Mastermind (Alleged)', desc: "As Tom, leave the party with everyone's things.", test: function (g) { return g.ending === 'heist' && g.player === 'tom'; } },
    { id: 'saint', name: 'Saint Tom', desc: 'As Tom, get Mork online without looking after a single thing.', test: function (g) { return g.player === 'tom' && g.ending === 'win' && g.stats.steals === 0; } },
    { id: 'rage', name: 'Too Excited', desc: 'Tom can no longer wait.', test: function (g) { return g.ending === 'rage'; } },
    { id: 'mini3', name: 'Mini-Game Menace', desc: 'Win three mini-games in one night.', test: function (g) { return g.stats.miniWon >= 3; } },
    { id: 'easy3', name: 'Chief Easy Officer', desc: "As Don, be 'easy' about three things in one night.", test: function (g) { return g.player === 'don' && g.stats.easy >= 3; } },
    { id: 'forest', name: 'Forest Management', desc: 'Tom fells 25 trees in a night.', test: function (g) { return g.stats.trees >= 25; } },
    { id: 'decisive', name: 'Suspiciously Decisive', desc: "As Don, win without once being 'easy'.", test: function (g) { return g.player === 'don' && g.ending === 'win' && g.stats.easy === 0; } },
    { id: 'early', name: 'Early Doors', desc: 'Get Mork online before 7:15 PM.', test: function (g) { return g.ending === 'win' && g.clock <= 19 * 60 + 15; } },
    { id: 'mum', name: 'Hi Boys!', desc: "Meet Tom's mum.", test: function (g) { return !!g.seen.tommum; } },
    { id: 'plus', name: 'Nicest Man Alive', desc: 'Give or get a gift from Tom.', test: function (g) { return !!g.seen.generous; } },
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

  var EVENTS = [
    // ----- openers -----
    { id: 'ping', first: true, as: 'don', who: ['don', 'tom'],
      title: '5:30 PM. The group chat',
      chat: [['sys', 'Game Night. 5:30 PM'], ['tom', "Hello my friends!! I've been online since 2. Tonight is going to be special."], ['tom', 'Who is in??']],
      text: "Two hours to kick-off. Mork hasn't been seen since breakfast.",
      choices: [
        { label: 'Send the casual invite', say: "7:30 as usual. You in?", p: 8, v: 2,
          re: [['tom', "In. I was in before you asked."], ['mork', '👍']], msg: "Mork reacted to Tom's message, not yours. Close enough." },
        { label: 'Let Tom write it', say: 'Tom, you do it.', p: -2, v: 8, set: 'gathering',
          re: [['tom', 'Brothers. Tonight we gather. Not for the game, but for what the game means. 7:30. Bring snacks and an open heart.'], ['mork', 'is this a cult']],
          msg: 'Mork will need time to process that. Tom also cc\'d someone. You don\'t see who.' }
      ] },
    { id: 'ping_t', first: true, as: 'tom', who: ['tom', 'don'],
      title: '5:30 PM. The group chat',
      chat: [['sys', 'Game Night. 5:30 PM'], ['sys', 'Tom is online for the first time in 3 weeks'], ['don', 'oh hello'], ['don', 'look who it is']],
      text: "You've been online since two. You've been 'away' for three weeks. Two hours to get Mork here, and your friends are owed a very good night.",
      choices: [
        { label: 'Write a short, normal invite', say: '7:30 tonight lads. Normal game. Normal night.', p: 8, v: 2,
          re: [['don', 'normal from you is worrying'], ['mork', '👍']], msg: 'Mork reacted. Don is suspicious. Both are good signs.' },
        { label: 'Write what you feel', say: 'Brothers. Tonight we gather. Not for the game, but for what the game means. 7:30. Bring snacks and an open heart.', p: -2, v: 8, set: 'gathering',
          re: [['mork', 'is this a cult'], ['don', "i'm easy"]], msg: "Mork will need time to process that. You also cc'd his work address. For reach." }
      ] },

    // ----- Mork's evening, roughly in order -----
    { id: 'seen', who: ['mork'], when: [0, 30],
      title: 'Mork has read it',
      chat: [['sys', '✓✓ Seen by Mork']],
      text: "Nothing else. That's normal for him. It isn't a yes.",
      choices: [
        { label: 'Wait', p: 2, v: 0, easy: { don: 1 }, msg: 'You wait. The two ticks stare back at you.' },
        { label: 'Send a gif', say: '[gif: man in a headset, nodding slowly]', p: 5, v: 4, re: [['mork', '😂']], msg: "One laughing emoji. For Mork, that's progress." },
        { label: "Catch him while he's typing", sub: 'Mini-game: timing', game: 'typing',
          ok: { p: 12, v: 4, re: [['mork', 'ok yeah go on then']], msg: "Four words. From Mork, that's a speech." },
          bad: { p: 0, v: -3, re: [['sys', 'Mork is typing…'], ['sys', '(stopped)']], msg: 'Probably a work email.' } }
      ] },
    { id: 'work', who: ['mork'], work: true, when: [0, 45],
      title: 'Mork is stuck at work',
      chat: [['mork', 'just finishing something']],
      text: 'He said the same thing an hour ago.',
      choices: [
        { label: 'Offer to push kick-off to 8:00', say: 'Mate, we can do 8 if you need it.', p: 12, v: -3, d: 30, next: { don: 'prepare', tom: 'prepare_t' },
          re: { don: [['tom', '8 is perfect. I need the time to prepare.']], tom: [['don', "8's fine. i'm easy"]] },
          msg: { don: "He doesn't say what for.", tom: 'Thirty extra minutes. You know exactly what to do with them.' } },
        { label: "Tell him we'll hold his seat", say: "No rush. Seat's yours.", p: 6, v: 3, re: [['mork', 'cheers mate']] }
      ] },
    { id: 'boss', who: ['mork'], work: true, when: [0, 45],
      title: 'The boss walks past',
      chat: [['mork', 'boss just walked past'], ['mork', 'pretending to work'], ['mork', '🫡']],
      choices: [
        { label: 'Go quiet', say: '(silence)', p: 8, v: 0, re: [['mork', '…ta']], msg: 'The boss walks on. Mork breathes.' },
        { label: 'Send a meme to cover for him', sub: 'Risky', risk: 0.5, say: '[meme: this is fine]',
          ok: { p: 10, v: 6, re: [['mork', 'he saw it. he laughed. he wants a copy']], msg: 'Mork is now the office comedian.' },
          bad: { p: -4, v: -4, re: [['mork', 'he saw it. we are having a meeting about it tomorrow']], msg: 'Not the meme he needed.' } }
      ] },
    { id: 'voicenote', who: ['mork'], when: [30, 75],
      title: 'A voice note from the train',
      chat: [['mork', '🎤 Voice message (4:12)']],
      text: 'Mork has never sent a voice note in his life. He must be on the train.',
      choices: [
        { label: 'Listen to all of it', p: 8, v: 4, t: 15, msg: "Mostly him walking. At 3:50 he says 'see you at half seven'. That's the whole thing." },
        { label: "Send 'tl;dr?'", say: 'tl;dr?', p: 4, v: -2, re: [['mork', 'tl;dr: yes']] }
      ] },
    { id: 'dinner', who: ['mork'], when: [45, 90],
      title: 'Dinner for one small person',
      chat: [['mork', '[photo: a plate of chicken dippers]']],
      text: "He's home. No caption. You know a cry for help when you see one.",
      choices: [
        { label: 'Suggest takeaway', say: 'Just get a pizza in, mate.', p: 8, v: -2, re: [['mork', 'ordered. 25 mins']], msg: 'Sorted in under a minute. The man gets things done.' },
        { label: 'Leave him to it', p: 2, v: 2, msg: 'Dinner gets made eventually. Nobody speaks.' }
      ] },
    { id: 'pizza', who: ['don', 'tom', 'mork'], when: [45, 90],
      title: 'Order Mork a pizza',
      chat: [['pal', { don: "Can we send a pizza to Mork's door? Is that allowed?", tom: 'can we send mork a pizza? is that allowed' }]],
      text: 'Not strictly allowed. Not strictly forbidden.',
      choices: [
        { label: 'Order one for Mork', p: 8, v: 8, re: [['mork', '{ME}.'], ['mork', '(thank you)']], msg: 'His kid loves you for ten minutes. Mork loves you for longer.' },
        { label: 'Pizza for the whole chat', p: 4, v: 12, t: 15, msg: 'Three pizzas, three doors, one order. Rare teamwork.' }
      ] },
    { id: 'partner', who: ['mork'], when: [60, 105],
      title: 'The dishwasher clause',
      chat: [['mork', "can play once the dishwasher's done"], ['mork', 'the dishwasher is never done']],
      choices: [
        { label: 'Help him load it over video', sub: 'Mini-game: tap the plates', game: 'dishes',
          ok: { p: 14, v: 5, re: [['mork', 'right. ten minutes']], msg: "He shuts the door like he's closing a vault." },
          bad: { p: 4, v: -2, t: 15, re: [['mork', 'still going']], msg: 'You can hear the cutlery drawer from here.' } },
        { label: 'Remind him nothing gets through once he is in', say: "Once you're in, nothing gets you. Phone in a drawer.", p: 5, v: 4,
          re: [['mork', '…true actually']] },
        { label: 'Tell him to leave it', say: 'Leave it, mate.', p: 10, v: -6, re: [['mork', 'tomorrow-me is going to hate you']] }
      ] },
    { id: 'headset', who: ['mork'], when: [60, 999],
      title: 'Where is the headset',
      chat: [['mork', "can't find my headset"], ['mork', 'looked everywhere']],
      text: "He's looking for it. That means he's coming.",
      choices: [
        { label: "Suggest the kid's toy box", say: 'Check the toy box.', p: 10, v: 2, re: [['mork', 'found it. how did you know']], msg: "You didn't. It's just where everything ends up." },
        { label: 'Suggest earbuds', say: 'Just use earbuds.', p: 4, v: 0, re: [['mork', 'one of them is chewed']], msg: 'Technically a solution.' }
      ] },
    { id: 'bedtime', who: ['mork', 'tom'], when: [75, 999],
      title: 'Bedtime story',
      chat: [['mork', "kid wants one more story. i've read this one six times this week"]],
      choices: [
        { label: { don: 'Get Tom to read it on a call', tom: 'Offer to read it on a call' }, say: { don: 'Tom, can you do the voices?', tom: 'Put me on speaker. I do voices.' }, set: 'kidname', p: 4, v: 8,
          re: { don: [['tom', 'Gather round, little one…'], ['mork', "he's actually brilliant at this"]], tom: [['me', 'Gather round, little one…'], ['mork', "ok you're actually brilliant at this"]] },
          msg: { don: "The kid asks for Tom again. Tom promises to 'remember his name'.", tom: 'The kid asks for you again. You promise to remember his name. You write it on your hand.' } },
        { label: 'Tell him to read the short one', say: 'Read the short one.', p: 8, v: -3, t: 15, re: [['mork', 'there is no short one {me}']], msg: 'There is a short one.' }
      ] },
    { id: 'kidsasleep', who: ['mork'], lucky: true, when: [90, 999],
      title: 'The kid is asleep',
      chat: [['mork', 'kid is ASLEEP'], ['mork', 'do not speak to me. on my way']],
      choices: [
        { label: 'Send nothing. Hold your breath.', p: 25, v: 8, re: [['sys', '{pal} is typing…'], ['sys', '(stopped)']],
          msg: { don: 'Even Tom stays quiet.', tom: 'Even you stay quiet. It takes everything you have.' } }
      ] },
    { id: 'maybe', who: ['mork'],
      title: "Mork says 'maybe'",
      chat: [['mork', 'maybe']],
      text: 'His maybes come good about 40% of the time. The rest he falls asleep.',
      choices: [
        { label: 'Accept the maybe', say: "Maybe's fine.", p: 3, v: 0, maybes: 1, msg: 'You pencil him in. Very light pencil.' },
        { label: 'Send a beer emoji', say: '🍺', p: 6, v: 3, maybes: 1, re: [['mork', '🍺'], ['mork', 'ok maybe is a yes']] }
      ] },
    { id: 'newgame', who: ['mork', 'tom'], when: [45, 999],
      title: 'Mork wants a different game',
      chat: [['mork', 'what about something different tonight'], ['mork', 'something calmer. a farming one']],
      text: { don: 'Tom is typing…', tom: 'Every bone in your body wants to say trees.' },
      choices: [
        { label: "Back Mork's idea", say: { don: 'Farming sounds nice, actually.', tom: 'Farming involves trees. I accept.' }, p: 10, v: { don: -6, tom: -2 },
          re: { don: [['tom', 'Farming involves trees.'], ['tom', 'I accept.']], tom: [['don', 'growth'], ['mork', 'thank you tom']] },
          msg: { don: 'Tom accepts, slowly, like a man signing a contract.', tom: 'You accept, slowly, like a man signing a contract.' } },
        { label: 'Back tradition', say: "Same as always. It's tradition.", p: -4, v: 6, re: [['mork', 'fine. same as always']], msg: 'Mork gives in. He always does.' }
      ] },

    // ----- Don's side -----
    { id: 'easy', as: 'don', who: ['don'],
      title: 'What time are we starting?',
      chat: [['mork', 'whenever'], ['tom', 'NOW']],
      text: 'Both are waiting for you.',
      choices: [
        { label: "Say you're easy", say: "I'm easy.", p: 2, v: -2, t: 15, easy: 1, msg: 'Fifteen minutes pass. Nobody picks a time.' },
        { label: 'Say 7:30', say: '7:30. Like always.', p: 8, v: -2, re: [['tom', '…who are you and what have you done with Don']] }
      ] },
    { id: 'easy_t', as: 'tom', who: ['tom', 'don'],
      title: 'What time are we starting?',
      chat: [['mork', 'whenever'], ['don', "i'm easy"]],
      text: 'Both are waiting for you. Neither will decide anything.',
      choices: [
        { label: 'Say NOW', say: 'NOW.', p: -2, v: 6, re: [['mork', 'i am holding a child, tom']], msg: 'You say NOW three more times, for emphasis.' },
        { label: 'Say 7:30. Calmly.', say: '7:30. Like always. Calmly.', p: 8, v: -2, re: [['don', '…who are you and what have you done with Tom']] }
      ] },
    { id: 'update', who: ['don'],
      title: 'The update',
      chat: [['sys', { don: 'PS5: system update required (38 GB)', tom: "Don's PS5: system update required (38 GB)" }], ['sys', 'Estimated time: 2 hours 40 minutes']],
      text: { don: "Your console. Of course it's your console.", tom: "Don's console. Of course it's Don's console." },
      choices: [
        { label: { don: 'Restart the console', tom: 'Tell Don to restart it' }, sub: 'Risky', risk: 0.5, say: { tom: 'Turn it off and on again, Don.' },
          ok: { p: 6, v: 4, re: [['sys', 'Update complete']], msg: 'It works. Nobody knows why.' },
          bad: { p: 0, v: -3, t: 15, re: [['sys', 'Update required (38 GB)']], msg: 'Back to the start.' } },
        { label: 'Blame the router', say: "It's the router.", p: 0, v: 3, re: { don: [['tom', "It's always the router"]], tom: [['don', 'yeah. router.']] },
          msg: { don: 'Tom blames the router for most things.', tom: "You blame the router for most things. It's never let you down." } }
      ] },

    // ----- Tom, seen by Don -----
    { id: 'calm', as: 'don', who: ['tom'],
      title: 'Tom is far too excited',
      chat: [['tom', 'TONIGHT IS GOING TO BE THE BEST NIGHT IN HISTORY'], ['tom', 'I made a playlist. And a banner.']],
      choices: [
        { label: 'Calm Tom down', sub: 'Mini-game: hold and release', game: 'breathe',
          ok: { p: 2, v: 10, set: 'banner', re: [['tom', "…you're right. Breathe."]], msg: "He folds the banner up carefully. 'For later.'" },
          bad: { p: 0, v: 1, re: [['tom', 'warming up!!']], msg: 'Tom breathes very fast and very keenly.' } },
        { label: 'Let him run with it', p: -4, v: -6, re: [['tom', 'A SPEECH:']], msg: 'It is about destiny.' }
      ] },
    { id: 'sermon', as: 'don', who: ['tom'],
      title: 'Tom has called a meeting',
      chat: [['tom', 'Brothers. A thought.'], ['tom', 'What if the game is a metaphor?']],
      text: 'Nobody asked for a meeting.',
      choices: [
        { label: 'Hear him out', say: 'Go on then.', p: -2, v: 6, t: 15, msg: "Forty minutes later you're agreeing with him, somehow." },
        { label: 'Ask him to chop something instead', say: 'Go chop something, mate.', p: 2, v: 4, re: [['tom', '…yes. Trees. Always trees.']] }
      ] },
    { id: 'tomgame', as: 'don', who: ['tom'],
      title: 'Tom has made a game',
      chat: [['tom', "Little thing. I've made a game. It's about friendship."], ['tom', 'Playtest it?']],
      text: "It's 800 MB and has one level: a forest.",
      choices: [
        { label: 'Playtest it', say: 'Send me the build.', p: -2, v: 8, t: 15, re: [['tom', 'Be honest. Be kind. Be honest.']], msg: "It's a tree-chopping game. It's good. That's the worst part." },
        { label: 'Not now', say: 'After the match, mate.', p: 4, v: -2, re: [['tom', 'Of course. Of course.']], msg: 'He says it three times, quieter each time.' }
      ] },
    { id: 'stream', as: 'don', who: ['tom'],
      title: 'Tom is live',
      chat: [['tom', 'going live!! 🔴'], ['sys', 'Viewers: 1']],
      text: 'The one viewer is his mum.',
      choices: [
        { label: 'Join the stream', p: 0, v: 8, re: [['tom', 'Welcome Don!! Chat, say hi to Don!'], ['sys', "Tom's mum: hi Don"]] },
        { label: 'Mute it', p: 2, v: -2, msg: 'You mute it. Tom can tell.' }
      ] },
    { id: 'chop', as: 'don', who: ['tom'], chop: true,
      title: 'Tom is chopping trees',
      chat: [['tom', 'found a really good forest. back soon!']],
      text: "He's logged in early and is chopping alone in the game. Been at it since two.",
      choices: [
        { label: 'Join him', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, msg: 'Two grown men, one tree, total silence. Best part of the night.' },
          bad: { p: 0, v: 3, msg: "Tom out-chops you and says nothing. He doesn't need to." } },
        { label: 'Leave him to it', p: 0, v: 2, easy: 1, msg: "You're relaxed about it. The tree isn't." }
      ] },
    { id: 'generous', as: 'don', who: ['tom', 'mork'],
      title: "Tom paid for Mork's PS Plus",
      chat: [['tom', 'Mork is now on PS Plus for a year. You are welcome.'], ['tom', "No no, don't thank me"]],
      text: "Tom is one of the nicest people alive. There's also a non-zero chance this isn't what it looks like.",
      choices: [
        { label: 'Thank him', say: 'Tom. Mate. That is incredibly kind.', set: 'login', p: 8, v: 8,
          re: [['tom', "Anything for my friends. Quick thing: what's Mork's login? For the renewal."]] },
        { label: 'Ask what the catch is', say: "What's the catch?", p: 2, v: -2, steals: 1,
          re: [['tom', 'No catch!'], ['tom', "Gift card. Don't ask where from."]] }
      ] },
    { id: 'steal', as: 'don', who: ['tom'],
      title: 'That sword was yours',
      chat: [['sys', 'Legendary Sword picked up by DON'], ['sys', "Legendary Sword is now in TOM's inventory"], ['tom', 'Safekeeping :)']],
      choices: [
        { label: 'Let it slide', say: 'Fine, keep it.', set: 'swords', p: 3, v: 3, steals: 1, easy: 1,
          re: [['tom', 'Here. Three smaller swords. As an apology.']], msg: "It isn't even." },
        { label: 'Grab it back', sub: 'Mini-game: reaction', game: 'grab',
          ok: { p: 10, v: 2, re: [['tom', "Of course!! It's yours!"]], msg: 'Almost too thrilled for you.' },
          bad: { p: 0, v: -8, t: 15, steals: 1, re: [['tom', 'Thank you for the sword!! ❤️']], msg: "He hugs you and is gone. You're not sure who won." } }
      ] },
    { id: 'inventory', as: 'don', who: ['tom', 'mork'],
      title: "Tom is 'looking after' Mork's stuff",
      chat: [['tom', "Don't worry about Mork's things. I'm looking after them."], ['tom', 'All forty items. Perfectly safe.']],
      text: "Mork hasn't noticed.",
      choices: [
        { label: 'Trust Tom', say: 'Cheers Tom.', p: 2, v: 4, steals: 1, easy: 1, re: [['tom', '❤️']], msg: "You think about it longer than you'd like." },
        { label: 'Ask for a list', say: 'Send me a list.', p: 6, v: -4, re: [['tom', '[inventory.xlsx]']], msg: "Very thorough. Doesn't add up." }
      ] },
    { id: 'tomback', as: 'don', who: ['tom'], when: [0, 45],
      title: 'Tom is back',
      chat: [['tom', 'Hey all! Back!'], ['tom', 'Was on a retreat.']],
      text: "Three weeks. No messages. He's online with a tan, a new watch and a calm you don't trust.",
      choices: [
        { label: 'Ask where he really was', say: 'Where were you, really?', p: 0, v: -4, re: [['tom', 'A retreat.'], ['tom', 'A very good retreat.']], msg: 'The watch is from a shop in Geneva.' },
        { label: "Don't ask", say: 'Good to have you back.', p: 2, v: 4, easy: 1, msg: "It's most of why you're still friends." }
      ] },
    { id: 'tomgone', as: 'don', who: ['tom'],
      title: 'Tom has gone quiet',
      chat: [['sys', 'Tom: last seen 4 minutes ago']],
      text: "It's been 20 minutes. This has happened before. Last time it lasted three weeks.",
      choices: [
        { label: 'Wait. He always comes back', p: 2, v: 0, t: 15, easy: 1, re: [['tom', 'sorry, signal']], msg: 'There was no signal for all of Tuesday.' },
        { label: "Ask if he's ok", say: 'you ok?', p: 0, v: 3, re: [['tom', 'Fine. Away.']], msg: "He doesn't say from what, or to where." }
      ] },
    { id: 'tomloan', as: 'don', who: ['tom'],
      title: 'Tom needs a quick favour',
      chat: [['tom', 'Quick question. Can you lend me £40 until the retreat?'], ['tom', "I'll pay you back with interest. In logs."]],
      choices: [
        { label: 'Lend it', say: 'Go on then.', p: 0, v: 4, steals: 1, next: 'loanrepay' },
        { label: "Say you're skint", say: "I'm skint, mate.", p: 2, v: -1, re: [['tom', 'Understood. Respect.'], ['tom', '(what about Mork)']], msg: 'Mork is about to have a very long evening.' }
      ] },
    { id: 'poll', as: 'don', who: ['tom'],
      title: 'Tom has started a poll',
      chat: [['tom', 'Poll: what shall we play first?'], ['sys', '1. Chopping trees   2. Wood   3. Forestry']],
      text: 'All the options are trees.',
      choices: [
        { label: 'Vote for chopping trees', p: 2, v: 6, re: [['tom', 'The people have spoken. And the people are right.']] },
        { label: 'Vote for wood', p: 2, v: 6, re: [['tom', '…wood. You understand me.']] },
        { label: 'Suggest a different game', say: 'Could we play something else?', p: 6, v: -8, re: [['tom', '…']], msg: 'The silence lasts about a hundred years.' }
      ] },
    { id: 'tommum', as: 'don', who: ['tom'],
      title: "Tom's mum has joined the chat",
      chat: [['sys', "Tom's mum joined the chat"], ['mum', 'Hi boys!'], ['mum', 'Is Tom with you? He told me he was going to Lisbon.']],
      choices: [
        { label: "Say he's here", say: "He's here! Chopping trees.", p: 2, v: 4, re: [['mum', 'Oh good. Tell him the neighbour has asked about the watch.']], msg: 'Tom has left the chat. Not for long.' },
        { label: "Say you haven't seen him", say: "Haven't seen him in weeks.", p: 0, v: -2, re: [['mum', 'Typical.']] }
      ] },
    { id: 'tomalibi', as: 'don', who: ['tom'],
      title: 'Tom has an alibi',
      chat: [['tom', 'Just so you know, I was at home all last Thursday.'], ['tom', 'Alone. Watching a documentary.']],
      text: 'Nobody asked.',
      choices: [
        { label: "Say 'nobody asked'", say: 'Nobody asked, Tom.', p: 2, v: -2, re: [['tom', 'Good. That is good.']] },
        { label: "Say 'okay'", say: 'Okay.', p: 2, v: 2, re: [['tom', 'Thank you. That is all I wanted.'], ['tom', 'A nature one.']], msg: 'You now have an alibi you did not request.' }
      ] },
    { id: 'tomcook', as: 'don', who: ['tom'],
      title: 'Tom is cooking for everyone',
      chat: [['tom', "Cooking for everyone tonight. Recipe's below."], ['sys', "[Tom's recipe: bread, butter, faith]"]],
      text: 'You are all in different houses. The food will not reach anyone.',
      choices: [
        { label: 'Cook along', say: "I'll cook along.", p: 0, v: 8, t: 15, re: [['tom', 'Beautiful. Now add the faith.']] },
        { label: 'Order a curry', say: "I'm ordering a curry.", p: 4, v: -2, re: [['tom', 'A curry can be a kind of faith.']] }
      ] },

    // ----- Tom's side -----
    { id: 'calm_t', as: 'tom', who: ['tom'],
      title: 'You are far too excited',
      chat: [['me', 'TONIGHT IS GOING TO BE THE BEST NIGHT IN HISTORY'], ['me', 'I made a playlist. And a banner.'], ['don', 'mate']],
      text: 'Your heart is going like a woodpecker.',
      choices: [
        { label: 'Breathe', sub: 'Mini-game: hold and release', game: 'breathe',
          ok: { p: 2, v: 10, set: 'banner', re: [['don', 'better']], msg: 'You fold the banner up carefully. For later.' },
          bad: { p: 0, v: 1, re: [['don', 'are you breathing into the mic']], msg: 'You breathe very fast and very keenly.' } },
        { label: 'Make a speech', say: 'A SPEECH:', p: -4, v: -6, re: [['don', '(muted)']], msg: 'It is about destiny. Don has muted you. Mork never unmuted you.' }
      ] },
    { id: 'sermon_t', as: 'tom', who: ['tom'],
      title: 'You have had a thought',
      chat: [['me', 'Brothers. A thought.'], ['me', 'What if the game is a metaphor?']],
      text: 'Nobody asked for a meeting. Don has put the kettle on.',
      choices: [
        { label: 'Explain the metaphor', p: -2, v: 6, t: 15, re: [['don', '…ok that was actually deep']], msg: 'Forty minutes. You lose Don around minute twelve, then win him back.' },
        { label: 'Go chop something instead', p: 2, v: 4, re: [['don', 'good call']], msg: 'Trees. Always trees.' }
      ] },
    { id: 'tomgame_t', as: 'tom', who: ['tom', 'don'],
      title: 'You have made a game',
      chat: [['me', "Little thing. I've made a game. It's about friendship."], ['don', 'is it about trees']],
      text: "It's 800 MB and has one level: a forest.",
      choices: [
        { label: 'Send Don the build', say: 'Be honest. Be kind. Be honest.', p: -2, v: 8, t: 15, re: [['don', "it's good. why is it good"]], msg: 'Don is playtesting. Mork is not. Priorities.' },
        { label: 'Save it for after', say: 'After the match.', p: 4, v: -2, msg: "You save it for after. It's harder than it looks." }
      ] },
    { id: 'stream_t', as: 'tom', who: ['tom'],
      title: 'You are live',
      chat: [['me', 'going live!! 🔴'], ['sys', 'Viewers: 1']],
      text: 'The one viewer is your mum.',
      choices: [
        { label: 'Wave to chat', p: 0, v: 8, re: [['sys', "Tom's mum: hi love"], ['don', "hi tom's mum"]], msg: 'Two viewers now. A record.' },
        { label: 'End the stream', p: 2, v: -2, msg: 'Your mum leaves a sad face.' }
      ] },
    { id: 'chop_t', as: 'tom', who: ['tom'], chop: true,
      title: 'One more tree',
      chat: [['sys', 'You have been chopping since 2:00 PM'], ['don', 'you coming back?']],
      text: "You've found a really good forest. Just one more tree.",
      choices: [
        { label: 'One more tree', sub: 'Mini-game: Timber!', game: 'timber',
          ok: { p: 4, v: 12, msg: 'Felled. Don turns up and chops alongside you in silence. Best part of the night.' },
          bad: { p: 0, v: 3, msg: 'The tree wins. You respect the tree.' } },
        { label: 'Log off and focus', p: 2, v: 2, msg: 'The forest will wait. Forests are good at that.' }
      ] },
    { id: 'generous_t', as: 'tom', who: ['tom', 'mork'],
      title: 'A gift card',
      chat: [['sys', 'You have a £60 gift card'], ['sys', "Origin: don't ask"]],
      text: "You're one of the nicest people alive. Mork has no PS Plus.",
      choices: [
        { label: 'Buy Mork a year of PS Plus', say: 'Mork is now on PS Plus for a year. You are welcome.', set: 'login', p: 8, v: 8,
          re: [['mork', 'tom. mate. thank you'], ['don', 'where did the card come from']], msg: "You'll just need his login. For the renewal." },
        { label: 'Keep it for the retreat', p: 0, v: -2, steals: 1, msg: 'The retreat has expenses.' }
      ] },
    { id: 'steal_t', as: 'tom', who: ['tom', 'don'],
      title: 'A Legendary Sword drops',
      chat: [['sys', 'Legendary Sword dropped near DON']],
      text: "Don's closer. You're faster.",
      choices: [
        { label: 'Look after it', say: 'Safekeeping :)', set: 'swords', p: 3, v: 3, steals: 1,
          re: [['don', '…fine. keep it']], msg: "You give him three smaller swords as an apology. They're Mork's." },
        { label: 'Grab it first', sub: 'Mini-game: reaction', game: 'grab',
          ok: { p: 2, v: 2, steals: 1, re: [['don', 'how are you that fast']], msg: 'Yours. Safekeeping.' },
          bad: { p: 4, v: 4, re: [['don', 'got it!']], msg: 'Don has it. You feel a strange, clean feeling.' } },
        { label: 'Let Don have it', p: 6, v: 4, re: [['don', 'oh. thanks?']], msg: "He's confused. You're confused. It feels nice." }
      ] },
    { id: 'inventory_t', as: 'tom', who: ['tom', 'mork'],
      title: "Mork's things",
      chat: [['mork', 'inventory full. can someone hold some stuff']],
      text: 'All forty items. Mork trusts you completely.',
      choices: [
        { label: 'Look after them', say: 'Leave it with me.', p: 4, v: 4, steals: 1, re: [['mork', 'legend']], msg: 'Forty items. Perfectly safe.' },
        { label: 'Suggest Don holds them', say: 'Don should hold them.', p: 2, v: 2, re: [['don', 'i can hold some'], ['don', "i'm easy"]], msg: 'You feel a twinge. You call it growth.' }
      ] },
    { id: 'tomback_t', as: 'tom', who: ['tom', 'don'], when: [0, 45],
      title: 'So where were you?',
      chat: [['don', 'so where were you'], ['mork', 'yeah where were you']],
      text: 'Three weeks. A tan. A new watch. They have noticed the watch.',
      choices: [
        { label: "Say 'a retreat'", say: 'A retreat.', p: 2, v: 2, re: [['don', 'a retreat.'], ['me', 'A very good retreat.']], msg: 'Nobody pushes it. That is why they are your friends.' },
        { label: 'Change the subject', say: 'Anyway! Mork, how is the little one?', p: 6, v: 0, re: [['mork', 'asleep in an hour if god is kind']], msg: 'Smooth. Don writes something down.' }
      ] },
    { id: 'tomgone_t', as: 'tom', who: ['tom'],
      title: 'Geneva is calling',
      chat: [['sys', 'Missed call: +41']],
      text: "Switzerland. You'd rather not take it in front of the boys.",
      choices: [
        { label: 'Step away for a bit', p: 2, v: -2, t: 15, re: [['don', 'tom?'], ['don', 'he does this']], msg: 'You come back with a new calm and no explanation.' },
        { label: 'Decline the call', p: 0, v: 4, msg: 'It rings again. You decline again. Tonight is for friends.' }
      ] },
    { id: 'tomloan_t', as: 'tom', who: ['tom', 'don'],
      title: 'You need a quick favour',
      text: "The retreat wants a deposit. You're £40 short.",
      choices: [
        { label: 'Ask Don', say: 'Quick one. £40 until the retreat? Pay you back in logs.', p: 0, v: 4, steals: 1, next: 'loanrepay_t', re: [['don', 'go on then']] },
        { label: 'Let it go', p: 2, v: 2, msg: 'You skip the deposit. The retreat will understand. It has before.' }
      ] },
    { id: 'poll_t', as: 'tom', who: ['tom'],
      title: 'Start a poll',
      text: 'What shall we play first? You get to write the options.',
      choices: [
        { label: 'Trees, wood, forestry', say: 'Poll: what shall we play first? 1. Chopping trees 2. Wood 3. Forestry', p: 2, v: 6, re: [['don', "i'm easy"]], msg: 'The people have spoken. And the people are right.' },
        { label: 'Add a non-tree option', say: 'Poll: 1. Chopping trees 2. Wood 3. Something Mork likes', p: 6, v: -2, re: [['mork', 'option 3 please']], msg: 'It hurts. It is the right thing.' }
      ] },
    { id: 'tommum_t', as: 'tom', who: ['tom'],
      title: 'Your mum has joined the chat',
      chat: [['sys', "Tom's mum joined the chat"], ['mum', 'Hi boys!'], ['mum', 'Tom, I thought you were in Lisbon?']],
      choices: [
        { label: "Say you're back", say: "I'm back, Mum!", p: 2, v: 4, re: [['mum', 'Oh good. The neighbour has asked about the watch.']], msg: 'You leave the chat. Not for long.' },
        { label: 'Pretend to be Don', say: "It's Don, Mrs T. Haven't seen him.", p: 0, v: -2, re: [['mum', 'Tom, I can see your name.']] }
      ] },
    { id: 'tomcook_t', as: 'tom', who: ['tom'],
      title: 'Cooking for everyone',
      chat: [['me', "Cooking for everyone tonight. Recipe's below."], ['sys', '[recipe: bread, butter, faith]']],
      text: 'You are all in different houses. Nobody will get any food.',
      choices: [
        { label: 'Talk them through it', p: 0, v: 8, t: 15, re: [['don', 'added the faith']] },
        { label: 'Order everyone a curry instead', p: 6, v: 4, re: [['mork', 'DID SOMEONE SEND A CURRY TO MY HOUSE']], msg: "You're not sure how you paid. Neither is your bank." }
      ] },

    // ----- scenes: reached through a `next` from another choice -----
    { id: 'loanrepay', scene: true, as: 'don', who: ['tom'],
      title: 'Tom has repaid you',
      chat: [['tom', 'Repaid!'], ['sys', 'Tom sent you 12 Logs']],
      text: "That's… a fair exchange?",
      choices: [
        { label: 'Accept the logs', p: 0, v: 6, re: [['tom', 'I knew you were a good egg.']] },
        { label: 'Ask for the £40', say: 'The £40, Tom.', p: 2, v: -4, re: [['tom', "Money is just logs that haven't grown up yet."]] }
      ] },
    { id: 'loanrepay_t', scene: true, as: 'tom', who: ['tom', 'don'],
      title: 'Paying Don back',
      text: 'You owe Don £40. You have a lot of logs.',
      choices: [
        { label: 'Send 12 logs', say: '[sent 12 Logs]', p: 0, v: 6, re: [['don', '…that is a fair exchange?']], msg: 'Money is just logs that have grown up.' },
        { label: 'Send the actual £40', p: 2, v: 2, re: [['don', 'wait, actual money?'], ['don', 'are you ok']], msg: 'You are fine. It was a strange feeling.' }
      ] },
    { id: 'prepare', scene: true, as: 'don', who: ['tom'],
      title: 'Tom has prepared',
      chat: [['tom', "I've prepared a presentation."], ['sys', 'Slide 1 of 47']],
      text: 'It is about the evening ahead.',
      choices: [
        { label: 'Sit through it', p: 6, v: 6, t: 15, re: [['tom', 'Slide 12 is the important one.']], msg: 'Slide 12 is a picture of a tree.' },
        { label: 'Skip to the end', say: 'Skip to the last slide.', p: 2, v: -2, re: [['tom', 'The last slide is also a tree.']] }
      ] },
    { id: 'prepare_t', scene: true, as: 'tom', who: ['tom', 'don'],
      title: 'You have prepared',
      chat: [['me', "I've prepared a presentation."], ['sys', 'Slide 1 of 47']],
      text: 'Forty-seven slides. Don has gone very quiet.',
      choices: [
        { label: 'Present all 47', p: 6, v: 6, t: 15, re: [['don', 'slide 12 was a tree']], msg: 'Slide 12 is the important one.' },
        { label: 'Skip to the last slide', p: 2, v: -2, re: [['don', 'also a tree']], msg: 'The last slide is also a tree. It ties it together.' }
      ] },

    // ----- callbacks: these only show up once an earlier choice has set the flag -----
    { id: 'gathering', req: 'gathering', as: 'don', who: ['mork', 'tom'],
      title: 'The Gathering went wide',
      chat: [['mork', 'tom emailed my boss'], ['mork', 'subject line: DESTINY'], ['mork', 'he replied all']],
      text: "'The Gathering' has 41 recipients.",
      choices: [
        { label: 'Ask Tom to recall it', say: 'Tom. Recall the email.', p: 6, v: -2, re: [['tom', 'Recalling would be a betrayal of the message.']], msg: 'It cannot be recalled.' },
        { label: "Tell Mork it's an honour", say: 'Honestly, your boss being invited is an honour.', p: 2, v: 4, re: [['mork', 'he asked if he can come']], msg: 'You now have a plus-one problem.' }
      ] },
    { id: 'gathering_t', req: 'gathering', as: 'tom', who: ['mork', 'tom'],
      title: 'The Gathering went wide',
      chat: [['mork', 'tom emailed my boss'], ['mork', 'subject line: DESTINY'], ['mork', 'he replied all']],
      text: "'The Gathering' now has 41 recipients. You only meant to reach 40.",
      choices: [
        { label: 'Recall the email', p: 6, v: -2, msg: 'It cannot be recalled. Some messages are meant to travel.' },
        { label: 'Welcome the boss properly', say: 'Your boss is welcome. All are welcome.', p: 2, v: 4, re: [['mork', 'he asked if he can bring his son']], msg: 'The Gathering grows.' }
      ] },
    { id: 'banner', req: 'banner', as: 'don', who: ['tom'],
      title: 'The banner',
      chat: [['tom', "It's time for the banner."]],
      text: 'The folded banner returns.',
      choices: [
        { label: 'Let him unfurl it', p: -2, v: 8, re: [['mork', "…it says WELCOME MORK. that's actually nice"]], msg: 'The banner is eleven feet long.' },
        { label: 'Ask him to wait for Mork', say: 'Save it for when Mork is in.', p: 4, v: 4, re: [['tom', 'Patience. That is the lesson.']] }
      ] },
    { id: 'banner_t', req: 'banner', as: 'tom', who: ['tom'],
      title: 'The banner',
      text: 'The folded banner is still on your desk. It has been looking at you.',
      choices: [
        { label: 'Unfurl it on camera', p: -2, v: 8, re: [['mork', "…it says WELCOME MORK. that's actually nice"]], msg: 'Eleven feet. Every letter hand-painted.' },
        { label: 'Save it for when Mork is in', p: 4, v: 4, msg: 'Patience. That is the lesson.' }
      ] },
    { id: 'kidpic', req: 'kidname', as: 'don', who: ['mork', 'tom'],
      title: 'A picture from the kid',
      chat: [['mork', 'kid drew a picture'], ['mork', "it's Tom. with an axe. says it's 'Uncle Tom, the tree man'"]],
      choices: [
        { label: 'Show Tom', say: '[photo: a stick man with a very large axe]', p: 6, v: 10, re: [['tom', "I'm going to cry."]], msg: 'Tom is quiet for six whole minutes.' },
        { label: 'Keep it quiet', p: 4, v: 0, msg: "You don't want to be responsible for what Tom does next." }
      ] },
    { id: 'kidpic_t', req: 'kidname', as: 'tom', who: ['mork', 'tom'],
      title: 'A picture from the kid',
      chat: [['mork', 'kid drew a picture'], ['mork', "it's you. with an axe. says it's 'Uncle Tom, the tree man'"]],
      choices: [
        { label: 'Cry', say: "I'm going to cry.", p: 6, v: 10, re: [['don', 'he is crying']], msg: 'You are quiet for six whole minutes.' },
        { label: 'Ask for a copy', say: 'Can I get a copy? For the retreat.', p: 4, v: 4, re: [['mork', 'sure. why does the retreat need it']] }
      ] },
    { id: 'smallswords', req: 'swords', as: 'don', who: ['tom', 'mork'],
      title: 'About those swords',
      chat: [['mork', 'where did my three swords go'], ['tom', "I don't know. Don, did you get any?"]],
      text: "The smaller swords. He gave you Mork's.",
      choices: [
        { label: 'Say nothing', p: 4, v: 4, steals: 1, msg: 'You say nothing. This makes you part of it.' },
        { label: 'Give them back', say: "I think I've got them, sorry.", p: 6, v: -2, re: [['mork', 'ok. thanks']], msg: 'Tom does not comment, but he writes something down.' }
      ] },
    { id: 'smallswords_t', req: 'swords', as: 'tom', who: ['tom', 'mork'],
      title: 'About those swords',
      chat: [['mork', 'where did my three swords go'], ['don', 'tom?']],
      text: "You gave Don three of Mork's swords. Don is looking at you.",
      choices: [
        { label: 'Ask Don', say: "I don't know. Don, did you get any?", p: 4, v: 4, steals: 1, msg: 'Don goes quiet. That makes him part of it.' },
        { label: 'Own up', say: 'Mork. Mate. That was me. Here.', p: 6, v: -2, re: [['mork', 'ok. thanks']], msg: 'Mork does not even mind. That is somehow worse.' }
      ] },
    { id: 'login', req: 'login', who: ['mork', 'tom'],
      title: 'A sign-in alert',
      chat: [['sys', "New sign-in on Mork's account: Geneva, Switzerland"], ['mork', 'why is someone logging in from switzerland']],
      text: { don: 'The renewal check.', tom: 'The renewal check. You did say you needed his login.' },
      choices: [
        { label: 'Blame the VPN', say: "That'll be a VPN thing.", p: 4, v: 2, re: { don: [['tom', 'VPN. Definitely.']], tom: [['don', 'vpn. definitely.']] },
          msg: { tom: 'Don backs you up. He has no idea why.' } },
        { label: { don: 'Ask Tom nicely', tom: 'Come clean' }, say: { don: 'Tom. Mate.', tom: "That's me. Renewal thing. I'll log out." }, p: 8, v: -2, steals: { don: 1 },
          re: { don: [['tom', "Fine. It's a shared account now. In spirit."]], tom: [['mork', 'oh. ok. thanks tom']] }, msg: { tom: 'You log out. Mostly.' } }
      ] },

    // ----- special nights -----
    { id: 'cake', only: 'birthday', as: 'don', who: ['tom'],
      title: 'Tom has ordered himself a cake',
      chat: [['tom', 'Quick announcement.'], ['tom', "I've ordered myself a cake."], ['sys', "[photo: a cake with Tom's face on it]"]],
      text: "It's a very good likeness.",
      choices: [
        { label: 'Sing happy birthday', p: -2, v: 10, t: 15, re: [['tom', 'Louder. Mork can hear us from here.']] },
        { label: 'Ask who paid', say: 'Who paid for that?', p: 2, v: -2, steals: 1, re: [['tom', 'A friend. A very generous friend.']], msg: 'It is not clear which friend.' }
      ] },
    { id: 'cake_t', only: 'birthday', as: 'tom', who: ['tom'],
      title: 'You have ordered yourself a cake',
      chat: [['me', 'Quick announcement.'], ['me', "I've ordered myself a cake."], ['sys', '[photo: a cake with your face on it]']],
      text: "It's a very good likeness.",
      choices: [
        { label: 'Ask for a song', say: 'Louder. Mork can hear us from here.', p: -2, v: 10, t: 15, re: [['don', 'happy birthday to youuu'], ['mork', '(singing quietly at bath time)']] },
        { label: 'Eat it on camera', p: 2, v: 2, msg: 'You start with the ear.' }
      ] },
    { id: 'toast', only: 'birthday', as: 'don', who: ['tom'],
      title: 'Tom has a toast',
      chat: [['tom', 'A toast.'], ['tom', 'To the nicest man who has ever lived.'], ['tom', 'I will not say who.']],
      choices: [
        { label: 'Raise a glass', p: 0, v: 8, t: 15, msg: 'You raise a glass. He cries. It takes a while.' },
        { label: 'Heckle gently', say: 'We know, Tom.', p: 4, v: -2, re: [['tom', 'The heckler is also my friend.']] }
      ] },
    { id: 'toast_t', only: 'birthday', as: 'tom', who: ['tom'],
      title: 'A toast',
      text: "It's your birthday. You have prepared a toast.",
      choices: [
        { label: 'Toast the nicest man who ever lived', say: 'To the nicest man who has ever lived. I will not say who.', p: 0, v: 8, t: 15, re: [['don', 'we know, tom']], msg: 'You cry. It takes a while.' },
        { label: 'Toast your friends', say: 'To Don and Mork. My best friends. Equally. Mostly.', p: 4, v: 6, re: [['mork', 'cheers tom']] }
      ] },
    { id: 'wish', only: 'birthday', who: ['tom', 'mork'],
      title: { don: 'Tom is making a wish', tom: 'Make a wish' },
      chat: { don: [['tom', 'Everyone make a wish.'], ['tom', 'Mine is a secret.'], ['tom', 'It involves the Geneva thing.']], tom: [['me', 'Everyone make a wish.'], ['don', "is yours the geneva thing"]] },
      choices: [
        { label: 'Wish for Mork to show up', p: 12, v: 4, re: [['mork', 'why did my phone just light up']], msg: 'Wishes work if you do the other 80%.' },
        { label: { don: 'Wish for a quiet night', tom: 'Wish the Geneva thing away' }, p: 4, v: 6,
          msg: { don: 'You wish for a quiet night. You have the wrong friends for that.', tom: 'It does not go away. But it was nice to wish.' } }
      ] },
    { id: 'bug', only: 'launch', as: 'don', who: ['tom'],
      title: "Tom's game has a bug",
      chat: [['tom', 'Small thing.'], ['tom', 'The trees cannot be chopped.']],
      text: "It's a tree-chopping game. That's the whole game.",
      choices: [
        { label: 'Report the bug', say: 'The trees need to be choppable, Tom.', p: 2, v: 4, re: [['tom', 'The trees are choosing not to be.']] },
        { label: 'Call it a feature', say: "It's a feature. The trees have rights.", p: -2, v: 10, re: [['tom', '…the trees have rights.']], msg: "This may be Tom's best idea yet." }
      ] },
    { id: 'bug_t', only: 'launch', as: 'tom', who: ['tom', 'don'],
      title: 'Your game has a bug',
      chat: [['don', 'tom the trees cannot be chopped']],
      text: "It's a tree-chopping game. That's the whole game.",
      choices: [
        { label: 'Patch it live', sub: 'Risky', risk: 0.5,
          ok: { p: 4, v: 8, re: [['don', 'IT CHOPS']], msg: 'Version 1.0.1. The trees fall.' },
          bad: { p: 0, v: -4, t: 15, re: [['don', 'now the trees chop you']], msg: 'Version 1.0.2 is going to be a long night.' } },
        { label: 'Call it a feature', say: "It's a feature. The trees have rights.", p: -2, v: 10, re: [['don', '…the trees have rights.']], msg: 'This may be your best idea yet.' }
      ] },
    { id: 'reviews', only: 'launch', as: 'don', who: ['tom'],
      title: 'The first review',
      chat: [['sys', '★★★★★ "Best game ever made. My friend Tom made it." (user: TomsOtherAccount)']],
      choices: [
        { label: 'Say nothing', p: 2, v: 4, easy: 1, msg: 'You say nothing. Everyone is on the same page.' },
        { label: 'Point it out', say: "That's your other account, Tom.", p: 4, v: -4, re: [['tom', 'It is my friend. He is also called Tom.']] }
      ] },
    { id: 'reviews_t', only: 'launch', as: 'tom', who: ['tom', 'don'],
      title: 'The first review',
      chat: [['sys', '★★★★★ "Best game ever made. My friend Tom made it." (user: TomsOtherAccount)'], ['don', 'tom']],
      choices: [
        { label: 'Say it is a different Tom', say: 'Different Tom.', p: 2, v: 4, re: [['don', 'sure']] },
        { label: 'Leave another review', say: '[★★★★★ "Agree with Tom." (user: TomsThirdAccount)]', p: 0, v: 6, msg: 'A 5.0 rating from three reviewers, all of them you.' }
      ] },
    { id: 'crash', only: 'launch', who: ['tom', 'don'],
      title: 'The servers are down',
      chat: { don: [['tom', 'The servers are down.'], ['tom', 'The servers are your console, Don.'], ['tom', 'Is it plugged in?']],
        tom: [['don', "game won't load"], ['sys', "Server status: Don's console"]] },
      text: { tom: 'You are hosting the launch on Don\'s PS5. It seemed fine at the time.' },
      choices: [
        { label: { don: 'Restart', tom: 'Ask Don to restart it' }, sub: 'Risky', risk: 0.5, say: { tom: 'Don. Is it plugged in?' },
          ok: { p: 6, v: 8, re: { don: [['tom', 'IT LIVES']], tom: [['don', 'it lives']] }, msg: 'It lives.' },
          bad: { p: 0, v: -4, t: 15, re: { don: [['tom', 'I am not angry. I am a tree. I am calm.']], tom: [['me', 'I am not angry. I am a tree. I am calm.']] }, msg: 'It does not live.' } },
        { label: 'Blame the router', say: "It's the router.", p: 0, v: 3, re: { don: [['tom', "It's always the router."]], tom: [['don', 'yeah. router.']] } }
      ] },

    // ----- last call: the final fifteen minutes, picked by how close Mork is -----
    { id: 'last_hi', final: 'hi', who: ['mork'],
      title: 'Fifteen minutes to go',
      chat: [['mork', 'putting the kid down. then headset']],
      text: "He's close. The only thing that can go wrong now is you.",
      choices: [
        { label: 'Say nothing. Absolutely nothing.', p: 6, v: 4, msg: { don: 'The hardest thing you have done all night, and you are famously easy.', tom: 'The hardest thing you have ever done. You sit on your hands.' } },
        { label: 'Send one last ping', sub: 'Risky', risk: 0.6, say: 'ready when you are 👀',
          ok: { p: 12, v: 4, re: [['mork', 'ok ok coming']], msg: 'He was coming anyway. Now he knows you care.' },
          bad: { p: -10, v: -2, re: [['mork', 'the ping woke the kid']], msg: 'You know what you did.' } }
      ] },
    { id: 'last_mid', final: 'mid', who: ['mork', 'don', 'tom'],
      title: 'Fifteen minutes to go',
      chat: [['mork', 'nearly. one more story']],
      text: "He's close, but not close enough. One last push.",
      choices: [
        { label: 'Ring him', sub: 'Risky', risk: 0.5, say: '📞 Calling Mork…',
          ok: { p: 16, v: 2, re: [['mork', 'picked up. kid asleep. coming']], msg: 'The ringtone did not wake the kid. A small miracle.' },
          bad: { p: -4, v: -4, re: [['mork', '{ME}.'], ['mork', 'the KID.']], msg: 'The ringtone woke the kid. Story number two begins.' } },
        { label: 'Promise him an easy night', say: 'Two games and bed. Promise.', p: 8, v: 2, re: [['mork', 'two games. you promise']] },
        { label: { don: 'Get Tom to sing the kid to sleep', tom: 'Sing the kid to sleep' }, p: 10, v: 4, t: 0,
          re: { don: [['tom', '🎤 Voice message (6:30)'], ['mork', '…it worked. who is this man']], tom: [['me', '🎤 Voice message (6:30)'], ['mork', '…it worked. who are you']] },
          msg: { don: 'Tom has a voice like warm bread. Nobody knew.', tom: 'You have a voice like warm bread. You knew.' } }
      ] },
    { id: 'last_lo', final: 'lo', who: ['mork'],
      title: 'Fifteen minutes to go',
      chat: [['sys', 'Mork: last seen a while ago']],
      text: 'It would take a miracle. You have exactly one emoji left.',
      choices: [
        { label: 'Send the beer emoji', sub: 'Long shot', risk: 0.3, say: '🍺',
          ok: { p: 30, v: 8, re: [['mork', '🍺'], ['mork', 'fine. FINE. coming']], msg: 'A miracle, in emoji form.' },
          bad: { p: 2, v: -2, re: [['sys', '✓ Delivered']], msg: 'Delivered. Not seen. Not tonight.' } },
        { label: 'Accept it gracefully', p: 0, v: 6, easy: { don: 1 },
          msg: { don: "You're easy about it. Genuinely, this time.", tom: 'You set up a two-player forest instead. Don says he is easy.' } }
      ] }
  ];

  // a line at the top of the next card whenever Mork's evening moves on
  var BRIDGES = {
    commute: ["Mork has left the office, and he's still replying. Good sign.", 'Mork has left the office. Allegedly.'],
    home: ['Mork is home. Dinner, bath, and one eye on the chat.', 'Mork is home and has vanished into dinner and bath time.'],
    bedtime: ['Bedtime. If the story is short, Mork is yours.', "Bedtime, and Mork's last message was a while ago."],
    late: ['Past half seven. The new kick-off is the only one that counts.', 'Past half seven. The new kick-off is the only one that counts.']
  };

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
  // what goes through Tom's head, when you are Tom
  var TOM_SECRETS = [
    'Your phone buzzes. A number from Geneva. You let it ring.',
    "Your mum texts: 'The neighbour asked about the watch again.'",
    "You check the retreat's website. It is still just a photo of a beach.",
    'Somebody in Lisbon has liked every one of your photos from 2019.',
    "You remember the name of Mork's kid. You write it down this time.",
    'You count your inventory. It is more than it was this morning.'
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
    return t.replace(/\{me\}/g, nameOf(player)).replace(/\{ME\}/g, player.toUpperCase()).replace(/\{pal\}/g, nameOf(palOf(player)));
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
    return { dayKey: dayKey, day: day, comp: comp, player: player, clock: START, leaveAt: START + WINDOW_MIN, shifts: 0, round: 0, phase0: 'work', bridge: '',
      progress: clamp(comp.ready || 0, 0, 100), vibes: 40 + (day.vibes || 0) + (comp.vibes || 0), pool: [], queue: [], seen: {}, ev: null, phase: 'event', result: null, ending: null, started: false,
      flags: {}, flagAt: {}, stats: { trees: 0, steals: 0, maybes: 0, easy: 0, lostMin: 0, miniPlayed: 0, miniWon: 0 } };
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
      // a callback needs its flag, and at least one other card in between
      if (e.req && !(g.flags[e.req] && g.round > g.flagAt[e.req] + 1)) return false;
      if (strict && e.when && (m < e.when[0] || m > e.when[1])) return false;
      return true;
    }
    function fresh() {
      g.pool = EVENTS.filter(function (e) {
        return !e.scene && !e.first && !e.final && forPlayer(e) && (!e.only || e.only === g.dayKey);
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
    'NEARLY THERE?': ['Two minutes. Actually two, this time.', 'Headset is on. Kid is not asleep.'],
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
    var tomText = g && g.ending ? (g.ending === 'rage' ? 'TOO EXCITED' : g.ending === 'heist' ? 'AWAY' : 'CHOPPING') : 'BACK FROM A "RETREAT"';
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
      intro: "Kick-off is 7:30. The chat pings at 5:30. Tom is online for the first time in three weeks. He's one of the nicest men alive, and there's a non-zero chance he's robbing you. Mork is the busiest man you know, but once he's online nothing gets through: no calls, no work, no interruptions. Getting him there is the hard part. You're Don. You're easy." },
    tom: { tag: 'Nicest man alive. Allegedly.',
      intro: "Kick-off is 7:30. The chat pings at 5:30. You're Tom, back from three weeks on a 'retreat' with a tan and a watch nobody asked about. You love these boys. You'd do anything for them, and you've been looking after a few of their things. Mork is the busiest man you know, and once he's online nothing gets through. Getting him there is the hard part. Try not to get too excited. Try not to 'look after' too much." }
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
      "<li>'Looking after' things that belong to other people</li>" +
      '<li>Unlicensed tree felling</li>' +
      '<li>A watch from Geneva. Do not ask about the watch.</li></ul>' +
      "<p>Side effects may include a sudden tan, saying 'safekeeping' out loud, and missed calls from +41 numbers. " +
      "Interpol has been told it's a different Tom. Players with a heart condition, a valuable inventory, or a mum who thinks they're in Lisbon " +
      'should speak to a friend before going on. The friend will be Don. Don is easy.</p>' +
      '<p class="gn-found">By going on you agree that anything you are holding is now being looked after.</p>' +
      '<div class="gn-choices"><button class="gn-btn gn-alt" data-key="1" data-cw="yes">I ACCEPT THE RISKS<small>Become Tom. There is no undoing the tan.</small></button>' +
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
  function msgHtml(m) {
    var n = speaker(m[0]);
    return '<div class="' + msgClass(m[0]) + '">' + (n ? '<b>' + n + '</b>' : '') + '<span>' + esc(m[1]) + '</span></div>';
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
    var narr = (ev.first ? 'Tonight: ' + txt(g.comp.name) + '. ' + txt(g.comp.blurb) + ' ' : '') + txt(ev.text);
    var html = '<h2>' + esc(txt(ev.title)) + '</h2>' + (g.bridge ? '<p class="gn-bridge">' + esc(g.bridge) + '</p>' : '') +
      '<div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (narr ? '<p class="gn-nar">' + esc(narr) + '</p>' : '') + '<div class="gn-choices">';
    ev.choices.forEach(function (c, i) {
      html += '<button class="gn-btn" data-key="' + (i + 1) + '" data-choice="' + i + '">' + esc(txt(c.label)) + (c.sub ? '<small>' + esc(txt(c.sub)) + '</small>' : '') + '</button>';
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
    var chips = (r.mini ? '<span class="gn-chip ' + (r.mini.win ? 'good">MINI-GAME WON' : 'bad">MINI-GAME LOST') + '</span>' : '') +
      chip('READY', r.p, true) + chip('VIBES', r.v, true);
    if (r.mins > ROUND_MIN) chips += '<span class="gn-chip bad">+' + (r.mins - ROUND_MIN) + ' MIN LOST</span>';
    if (r.d) chips += '<span class="gn-chip neutral">KICK-OFF +' + r.d + ' MIN</span>';
    elCard.innerHTML =
      '<h2>' + esc(txt(g.ev.title)) + '</h2>' +
      (r.mini && r.mini.note ? '<p class="gn-note">' + esc(r.mini.note) + '</p>' : '') +
      '<div class="gn-chat" id="gn-chat"></div><div class="gn-after pending">' +
      (r.msg ? '<p class="gn-nar">' + esc(r.msg) + '</p>' : '') +
      '<p class="gn-aside">' + esc(r.trees) + '</p>' +
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
        ? 'No reply, no message. Mork is asleep on a sofa somewhere, and probably happier for it. You and Don play as a pair. You explain trees for three hours. Don says he is easy about it. See you ' + g.day.next + '.'
        : 'No reply, no message. Mork is asleep on a sofa somewhere, and probably happier for it. You and Tom play as a pair while Tom explains trees for three hours. See you ' + g.day.next + '.';
    }],
    heist: ['TOM HAS LEFT THE PARTY', function () {
      if (g.player === 'tom') {
        return "Around eight, you set your status to 'Away'. Your inventory is heavier. Don's is lighter. So is Mork's. " +
          (g.morkIn ? 'Mork is online and has noticed nothing. ' : '') + "The last thing you post is a photo of a beach. See you in about three weeks. 'A retreat,' you'll say.";
      }
      return "Around eight, Tom's status changes to 'Away'. Your inventory is lighter. So is Mork's. The last message in the chat is a photo of a beach. " +
        (g.morkIn ? 'Mork is online and has noticed nothing. ' : '') + "He'll be back in about three weeks with a tan. 'A retreat,' he'll say.";
    }],
    rage: ["TOM COULDN'T WAIT", function () {
      return g.player === 'tom'
        ? "The mood collapsed. You were far too wound up, started without Mork, then spent three hours apologising to a man who was asleep and not remotely upset."
        : "The mood collapsed. Tom, far too wound up, started without Mork, then spent three hours apologising to a man who was asleep and not remotely upset.";
    }]
  };

  // the night's loose ends, tied off from the callbacks you set up
  function epilogue() {
    var out = [], f = g.flags, tom = g.player === 'tom';
    if (f.banner) out.push(g.ending === 'win' ? 'The WELCOME MORK banner stays up all night.' : 'The WELCOME MORK banner is folded up again. For next time.');
    if (f.kidname) out.push(tom ? "Mork's kid now calls you 'the tree man'. You have never been happier." : "Mork's kid now calls Tom 'the tree man'. Tom has never been happier.");
    if (f.login) out.push("Mork's account is still signed in from Geneva.");
    if (f.gathering) out.push("Mork's boss has replied-all again. He wants to know about snacks.");
    if (f.swords) out.push('Nobody has asked about the three swords. Yet.');
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
    g.shareText = ['WHERE\'S MORK? ' + g.day.name + ' (as ' + nameOf(g.player) + ')', v[0], fmtClock(g.clock) + '  \ud83c\udf32 ' + st.trees + '  \ud83c\udf92 ' + st.steals + '  \ud83c\udfae ' + st.miniWon + '/' + st.miniPlayed,
      'Score ' + score, 'https://dpt106.github.io/game-night/'].join('\n');
    var rows = g.player === 'tom' ? [
      'Tonight: <b>' + txt(g.comp.name) + '</b>',
      'Trees you felled: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'You looked after nothing. A saint. <b>Genuinely.</b>'
        : st.steals < 3 ? "You 'looked after' <b>" + st.steals + '</b> thing' + (st.steals === 1 ? '' : 's') + '. For safekeeping.'
        : "You 'looked after' <b>" + st.steals + '</b> things. Interpol has been notified (<b>different Tom</b>).',
      'Where you were: <b>a retreat</b> (it was a retreat)',
      st.maybes === 0 ? "Mork never said 'maybe'. <b>He knew.</b>" : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>. Very unlike you.' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>'
    ] : [
      'Tonight: <b>' + txt(g.comp.name) + '</b>',
      'Trees felled by Tom: <b>' + st.trees + '</b>',
      st.steals === 0 ? 'Tom took nothing. Either a saint, or <b>very good</b>.'
        : st.steals < 3 ? "Tom 'looked after' <b>" + st.steals + '</b> thing' + (st.steals === 1 ? '' : 's') + '. Probably fine.'
        : "Tom 'looked after' <b>" + st.steals + '</b> things. Chance he is robbing you: <b>non-zero</b>.',
      "Where Tom's been: <b>unconfirmed</b> (retreat, or heist)",
      st.maybes === 0 ? "Mork never said 'maybe'. <b>He knew.</b>" : "Mork said 'maybe' <b>" + st.maybes + '</b> time' + (st.maybes === 1 ? '' : 's'),
      st.miniPlayed === 0 ? 'Mini-games played: <b>none</b>. Very Don.' : 'Mini-games won: <b>' + st.miniWon + ' / ' + st.miniPlayed + '</b>',
      st.easy === 0 ? 'Don decided things. <b>Out of character.</b>' : "Don was 'easy' about it <b>" + st.easy + '</b> time' + (st.easy === 1 ? '' : 's')
    ];
    var rank = g.player === 'tom'
      ? (g.ending === 'heist' ? 'A mastermind (alleged)' : g.ending === 'win' && st.steals === 0 ? 'Nicest man alive. Confirmed.' : st.miniWon >= 3 ? 'Mini-game menace' :
        g.ending === 'win' ? 'Host of the year' : g.ending === 'rage' ? 'Too excited' : 'Still lovely')
      : (g.ending === 'heist' ? "Tom's accomplice (unwitting)" : st.miniWon >= 3 ? 'Mini-game menace' : st.easy >= 3 ? 'Chief Easy Officer' :
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
    var trees = 1 + Math.floor(Math.random() * 4);
    g.stats.trees += trees;
    var tom = g.player === 'tom', asides = tom ? TOM_SECRETS : TOM_RUMOURS;
    var aside = tom ? 'Meanwhile, you fell ' + trees + ' tree' + (trees === 1 ? '' : 's') + ' in another window.'
      : 'Meanwhile, Tom fells ' + trees + ' tree' + (trees === 1 ? '' : 's') + ' in the game.';
    if (Math.random() < 0.2) aside = asides[Math.floor(Math.random() * asides.length)];
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
      (g.player === 'tom' ? "<p>The sword is about to drop. Tap GRAB the moment it appears. Too early and Don gets there first.</p>"
        : "<p>The sword is about to drop again. Tap GRAB the moment it appears. Too early and Tom 'looks after it'.</p>") +
      '<div class="gn-arena" id="gn-arena"><span>WAIT FOR IT…</span></div>' +
      '<button class="gn-btn gn-big" id="gn-act">GRAB</button></div>';
    var arena = $('gn-arena'), btn = $('gn-act');
    btn.focus();
    waitT = window.setTimeout(function () {
      shown = true;
      t0 = now();
      arena.innerHTML = sprite(SWORD, 6);
      arena.classList.add('drop');
      loseT = window.setTimeout(function () { done(false, g.player === 'tom' ? 'Too slow. Don picks it up without even looking.' : "Too slow. Tom's hand was already there. It's always already there."); }, LIMIT);
    }, 1200 + Math.random() * 2300);
    btn.addEventListener('click', function () {
      if (!shown) { done(false, g.player === 'tom' ? 'Too early. You grab thin air. Don picks it up, puzzled.' : 'Too early. Tom catches the sword, beams at you, and pockets it.'); return; }
      done(true, 'Grabbed in ' + Math.round(now() - t0) + ' ms. ' + (g.player === 'tom' ? 'Don applauds, unsure why.' : 'Tom applauds, sincerely.'));
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
      '<div class="gn-mini"><h2>' + (g.player === 'tom' ? 'BREATHE, TOM' : 'BREATHE WITH TOM') + '</h2>' +
      '<p>Hold the button to breathe in. Let go while the circle is inside the gold ring. Two good breaths and ' + (g.player === 'tom' ? 'you are' : 'Tom is') + ' calm.</p>' +
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
      $('gn-info').textContent = (ok ? 'Lovely. ' : size < LO ? 'Too shallow. ' : g.player === 'tom' ? 'Too much. You are now dizzy. ' : 'Too much. Tom is now dizzy. ') + 'Good ' + good + ' · Bad ' + bad;
      btn.textContent = 'HOLD';
      size = 0;
      draw();
      var tom = g.player === 'tom';
      if (good >= 2) done(true, tom ? 'Two slow breaths. You are, briefly, at peace.' : 'Two slow breaths. Tom is, briefly, at peace.');
      else if (bad >= 2) done(false, tom ? 'You hyperventilate with joy.' : 'Tom hyperventilates with joy.');
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
    else if (t.hasAttribute('data-day')) { g = newGame(t.getAttribute('data-day')); setHint('TONIGHT: ' + txt(g.comp.name).toUpperCase()); sfx('click'); nextRound(); }
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
