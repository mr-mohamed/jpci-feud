/* ============================================================
   JPCI Family Feud – shared code (used by host.html and board.html)
   - Game data format is the same as famf.app (settings / rounds /
     final_round / final_round_timers) so old JSON files still load.
   - Sync: PeerJS (WebRTC) between two computers using a room code,
     plus BroadcastChannel for two windows on the SAME computer.
   ============================================================ */
(function () {
  'use strict';

  var PEER_PREFIX = 'jpci-feud-';
  var LS_GAME = 'jpciFeud.game', LS_STATE = 'jpciFeud.state', LS_CODE = 'jpciFeud.code';

  var MAX_ANSWERS = 8, MAX_FM = 5;   // the board always has 8 answer slots and 5 Fast Money rows

  var DEFAULT_GAME = /*DEFAULT_GAME*/ {"settings": {"theme": "default", "title": "JPCI Family Feud"}, "rounds": [{"question": "Name something students blame when they fail a test:", "answers": [{"ans": "The Teacher", "pnt": 69}, {"ans": "Lack of Sleep", "pnt": 11}, {"ans": "Not Enough Time", "pnt": 10}, {"ans": "Not Studying", "pnt": 10}], "multiply": 1}, {"question": "Name something students always lose or leave behind in class:", "answers": [{"ans": "Pencil / Pen", "pnt": 66}, {"ans": "Water Bottle", "pnt": 16}, {"ans": "Phones / Chargers", "pnt": 13}, {"ans": "Textbook / Notebook", "pnt": 5}], "multiply": 2}, {"question": "Name something teachers complain about the most:", "answers": [{"ans": "Phones", "pnt": 33}, {"ans": "Noisy Students", "pnt": 31}, {"ans": "Students", "pnt": 14}, {"ans": "Not Doing Work", "pnt": 11}, {"ans": "Pay / Money", "pnt": 7}, {"ans": "Paperwork", "pnt": 4}], "multiply": 3}, {"question": "If there was a zombie apocalypse which classroom would be the best to hide in?", "answers": [{"ans": "Shop 4 (Essabhai)", "pnt": 26}, {"ans": "Auto Shop (Cole)", "pnt": 21}, {"ans": "S-6 Math Room", "pnt": 19}, {"ans": "Cooking Room", "pnt": 14}, {"ans": "S-5 Computer Tech", "pnt": 10}, {"ans": "Lecture Room", "pnt": 5}, {"ans": "French Room 121", "pnt": 5}], "multiply": 4}], "final_round": [{"question": "Name the best item in the snack program:", "answers": [["Apple Sauce", 21], ["Fruit / Oranges", 18], ["Yogurt", 14], ["Crackers", 14], ["Cheese Strings", 12], ["Muffin / Bread", 12], ["Granola Bars", 9]]}, {"question": "Name the best place to get lunch:", "answers": [["KFC", 25], ["Asian Gourmet", 19], ["Pizza", 18], ["Fortinos", 16], ["Tim Hortons", 12], ["Chipotle", 5], ["Lawrence Mall", 5]]}, {"question": "Name a common gift teachers receive from students:", "answers": [["Chocolate / Candy", 36], ["Gift Cards", 20], ["Apples", 12], ["Food", 9], ["Mugs", 9], ["Homework", 9], ["Cards / Letters", 5]]}, {"question": "Name something you would find on a teacher's desk:", "answers": [["Computer / Laptop", 28], ["Papers / Tests", 26], ["Pen / Pencil", 15], ["Stapler", 15], ["Apple", 6], ["Coffee", 5], ["Water Bottle", 5]]}, {"question": "Name an item a student brings to school every day but never uses:", "answers": [["Pencil / Pen", 27], ["Notebook / Textbook", 23], ["Ruler / Protractor", 17], ["Brain", 14], ["Student ID", 7], ["Chromebook", 6], ["Backpack / Bag", 6]]}], "final_round_timers": [20, 25]} /*END_DEFAULT_GAME*/;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function num(x, d) { var n = parseInt(x, 10); return isNaN(n) ? (d || 0) : n; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- game data ---------- */
  // Accepts famf-style JSON (or our own) and returns a clean game object.
  function normalizeGame(g) {
    if (!g || typeof g !== 'object') throw new Error('Not a JSON object');
    var out = {
      settings: Object.assign({ theme: 'default', title: 'Family Feud' }, g.settings || {}),
      rounds: [], final_round: [], final_round_timers: [20, 25]
    };
    (g.rounds || []).forEach(function (r) {
      out.rounds.push({
        question: String(r.question || ''),
        multiply: Math.max(1, num(r.multiply, 1)),
        answers: (r.answers || []).slice(0, MAX_ANSWERS).map(function (a) {
          if (Array.isArray(a)) return { ans: String(a[0]), pnt: num(a[1]) };
          return { ans: String(a.ans != null ? a.ans : a.answer || ''), pnt: num(a.pnt != null ? a.pnt : a.points) };
        })
      });
    });
    (g.final_round || []).slice(0, MAX_FM).forEach(function (r) {
      out.final_round.push({
        question: String(r.question || ''),
        answers: (r.answers || []).slice(0, MAX_ANSWERS).map(function (a) {
          if (Array.isArray(a)) return [String(a[0]), num(a[1])];
          return [String(a.ans != null ? a.ans : a.answer || ''), num(a.pnt != null ? a.pnt : a.points)];
        })
      });
    });
    if (Array.isArray(g.final_round_timers) && g.final_round_timers.length >= 2) {
      out.final_round_timers = [Math.max(5, num(g.final_round_timers[0], 20)), Math.max(5, num(g.final_round_timers[1], 25))];
    }
    return out;
  }
  function loadGame() {
    var s = lsGet(LS_GAME);
    if (s) { try { return normalizeGame(JSON.parse(s)); } catch (e) { /* fall through */ } }
    return normalizeGame(DEFAULT_GAME);
  }
  function saveGame(g) { lsSet(LS_GAME, JSON.stringify(g)); }

  /* ---------- state ---------- */
  function blankFM(game) {
    var n = game.final_round.length;
    function player() {
      var cells = [];
      for (var i = 0; i < n; i++) cells.push({ text: '', sel: -1, pts: 0, st: 0 });
      return { cells: cells };
    }
    return {
      players: [player(), player()],
      player: 0, hideP1: false,
      timer: { running: false, left: game.final_round_timers[0], dur: game.final_round_timers[0] }
    };
  }
  function newState(game, prev) {
    return {
      sid: Math.random().toString(36).slice(2, 8),
      v: prev ? prev.v + 1 : 0,
      game: game,
      teams: prev ? prev.teams : [{ name: 'Team 1', score: 0 }, { name: 'Team 2', score: 0 }],
      view: 'title', r: 0,
      revealed: [], strikes: 0, bank: 0, awarded: false, ctrl: null,
      fm: blankFM(game),
      ev: { n: 0, type: '', x: 0 }
    };
  }
  function loadState(game) {
    var s = lsGet(LS_STATE);
    if (s) {
      try {
        var st = JSON.parse(s);
        if (st && st.game && JSON.stringify(st.game) === JSON.stringify(game)) { st.sid = Math.random().toString(36).slice(2, 8); return st; }
      } catch (e) { /* ignore */ }
    }
    return newState(game, null);
  }
  function saveState(s) { lsSet(LS_STATE, JSON.stringify(s)); }

  function randomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = '';
    for (var i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }
  function getRoomCode() {
    var c = lsGet(LS_CODE);
    if (!c) { c = randomCode(); lsSet(LS_CODE, c); }
    return c;
  }
  function setRoomCode(c) { lsSet(LS_CODE, c); }

  /* ---------- sounds ---------- */
  // Uses the MP3 files in /sounds. Short beeps (tick, etc.) and a fallback are generated in the browser.
  var Snd = (function () {
    var ctx = null, unlocked = false, bank = {}, current = null;
    var FILES = {
      reveal: 'sounds/good-answer.mp3', fmans: 'sounds/fm-reveal.mp3', fmpts: 'sounds/good-answer.mp3', fmrep: 'sounds/fm-repeat.mp3',
      strike: 'sounds/wrong-buzzer.mp3', timeup: 'sounds/wrong-buzzer.mp3',
      award: 'sounds/win.mp3', win: 'sounds/win.mp3',
      intro: 'sounds/intro.mp3', round: 'sounds/round-start.mp3'
    };
    var LONG = { intro: 1, round: 1, award: 1, win: 1 };
    function enable() {
      unlocked = true;
      if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      Object.keys(FILES).forEach(function (k) {
        var f = FILES[k];
        if (!bank[f]) { try { var a = new Audio(f); a.preload = 'auto'; bank[f] = a; } catch (e) { /* ignore */ } }
      });
      return true;
    }
    function tone(f, t0, d, type, g, f2) {
      if (!ctx) return;
      var now = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, now + t0);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + t0 + d);
      gn.gain.setValueAtTime(0.0001, now + t0);
      gn.gain.exponentialRampToValueAtTime(g || 0.25, now + t0 + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + t0 + d);
      o.connect(gn); gn.connect(ctx.destination);
      o.start(now + t0); o.stop(now + t0 + d + 0.05);
    }
    function synth(type) {   // fallback beeps if an MP3 can't play
      if (!ctx || ctx.state !== 'running') return;
      switch (type) {
        case 'reveal': case 'fmpts': tone(880, 0, 0.15, 'sine', 0.3); tone(1320, 0.1, 0.45, 'sine', 0.3); break;
        case 'strike': case 'timeup': tone(160, 0, 0.9, 'sawtooth', 0.35, 100); break;
        case 'award': case 'win': case 'round': case 'intro': [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.13, 0.3, 'triangle', 0.3); }); break;
        case 'tick': tone(1100, 0, 0.05, 'square', 0.08); break;
        case 'fmans': tone(660, 0, 0.12, 'square', 0.12); break;
        case 'fmrep': tone(1000, 0, 0.07, 'square', 0.2); tone(1000, 0.14, 0.07, 'square', 0.2); break;
      }
    }
    function fadeOut(ms) {
      var a = current; if (!a) return; current = null;
      var v0 = a.volume, t0 = Date.now();
      var iv = setInterval(function () {
        var k = 1 - (Date.now() - t0) / ms;
        if (k <= 0) { clearInterval(iv); try { a.pause(); } catch (e) { /* ignore */ } }
        else { try { a.volume = Math.max(0, v0 * k); } catch (e) { /* ignore */ } }
      }, 50);
    }
    function stopLong() { if (current) { try { current.pause(); current.currentTime = 0; } catch (e) { /* ignore */ } current = null; } }
    function play(type) {
      if (!unlocked) return;
      var f = FILES[type];
      if (!f || !bank[f]) { synth(type); return; }
      if (LONG[type]) stopLong();
      var a = bank[f].cloneNode(); a.volume = 1;
      if (LONG[type]) current = a;
      var p = a.play();
      if (p && p.catch) p.catch(function () { synth(type); });
    }
    return { enable: enable, play: play, stop: stopLong, fadeOut: fadeOut, ready: function () { return unlocked; } };
  })();

  /* ---------- sync ---------- */
  // HOST side: broadcast state to boards.
  function startHostSync(code, getState, onStatus) {
    var conns = [], peer = null, peerState = 'connecting', bcSeen = 0, destroyed = false;
    var lan = false, lanInfo = null, lanBoards = 0, lanTried = false;
    var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('jpciFeud-' + code) : null;

    function status() {
      var open = conns.filter(function (c) { return c.open; }).length;
      var local = (Date.now() - bcSeen) < 8000 ? 1 : 0;
      onStatus({ peer: peerState, remote: open + lanBoards, local: local, lan: lan, lanInfo: lanInfo });
    }
    function lanPost(st) {
      fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st) }).catch(function () { });
    }
    function lanPing() {   // only works when the page is served by the offline server (server.py)
      if (lanTried && !lan) return;
      lanTried = true;
      try {
        fetch('api/ping', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
          if (j && j.ok) { var was = lan; lan = true; lanInfo = j; lanBoards = j.boards || 0; if (!was) lanPost(getState()); status(); }
        }).catch(function () { });
      } catch (e) { /* file:// */ }
    }
    if (bc) {
      bc.onmessage = function (e) {
        if (e.data && e.data.t === 'hello') { bcSeen = Date.now(); bc.postMessage({ t: 'state', s: getState() }); status(); }
      };
    }
    function startPeer() {
      if (destroyed) return;
      if (typeof Peer === 'undefined') { peerState = 'nolib'; status(); return; }
      try { peer = new Peer(PEER_PREFIX + code); } catch (e) { peerState = 'error'; status(); return; }
      peer.on('open', function () { peerState = 'ready'; status(); });
      peer.on('error', function (err) {
        if (err.type === 'unavailable-id') {            // old tab still registered – retry shortly
          peerState = 'retry'; status();
          try { peer.destroy(); } catch (e) { /* ignore */ }
          setTimeout(startPeer, 4000);
        } else { peerState = 'error'; status(); }
      });
      peer.on('disconnected', function () { peerState = 'connecting'; status(); try { peer.reconnect(); } catch (e) { /* ignore */ } });
      peer.on('connection', function (c) {
        conns.push(c);
        c.on('open', function () { c.send({ t: 'state', s: getState() }); status(); });
        c.on('close', function () { conns = conns.filter(function (x) { return x !== c; }); status(); });
        c.on('error', function () { });
      });
    }
    startPeer();
    lanPing();
    setInterval(function () { lanPing(); status(); }, 3000);
    return {
      send: function (s) {
        var m = { t: 'state', s: s };
        conns.forEach(function (c) { if (c.open) { try { c.send(m); } catch (e) { /* ignore */ } } });
        if (bc) bc.postMessage(m);
        if (lan) lanPost(s);
      }
    };
  }

  // BOARD side: receive state from host.
  function startBoardSync(code, onState, onStatus) {
    var peer = null, conn = null, lastSid = null, lastV = -1, got = false, bcOk = false;
    function apply(s) {
      if (!s) return;
      if (s.sid === lastSid && s.v <= lastV) return;
      lastSid = s.sid; lastV = s.v; got = true;
      onState(s); st();
    }
    var lanOn = false;
    function st() { onStatus({ connected: got, peerReady: !!(peer && peer.open), lan: lanOn }); }
    function startLan() {
      lanOn = true;
      var cid = Math.random().toString(36).slice(2), seq = -1;
      (function poll() {
        fetch('api/state?seq=' + seq + '&cid=' + cid, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
          seq = j.seq; if (j.state) apply(j.state); st(); poll();
        }).catch(function () { setTimeout(poll, 1500); });
      })();
    }
    try {
      fetch('api/ping', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.ok) startLan(); }).catch(function () { });
    } catch (e) { /* file:// */ }

    var bc = ('BroadcastChannel' in window) ? new BroadcastChannel('jpciFeud-' + code) : null;
    if (bc) {
      bc.onmessage = function (e) { if (e.data && e.data.t === 'state') { bcOk = true; apply(e.data.s); } };
      bc.postMessage({ t: 'hello' });
      setInterval(function () { bc.postMessage({ t: 'hello' }); }, 3000);
    }
    if (typeof Peer !== 'undefined') {
      var mkPeer = function () {
        peer = new Peer();
        peer.on('open', function () { st(); tryConn(); });
        peer.on('error', function () { /* the watchdog below keeps retrying */ });
        peer.on('disconnected', function () { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      };
      var tryConn = function () {
        if (!peer || !peer.open) return;
        if (conn && conn.open) return;
        try { if (conn) conn.close(); } catch (e) { /* ignore */ }
        conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('data', function (m) { if (m && m.t === 'state') apply(m.s); });
        conn.on('close', function () { got = bcOk; st(); });
        conn.on('error', function () { });
      };
      mkPeer();
      setInterval(tryConn, 3000);
      setInterval(function () { if (peer && peer.destroyed) mkPeer(); }, 5000);
    }
    st();
  }

  window.Feud = {
    esc: esc, clone: clone, num: num,
    DEFAULT_GAME: DEFAULT_GAME,
    normalizeGame: normalizeGame, loadGame: loadGame, saveGame: saveGame,
    newState: newState, loadState: loadState, saveState: saveState, blankFM: blankFM,
    getRoomCode: getRoomCode, setRoomCode: setRoomCode, randomCode: randomCode,
    Snd: Snd, startHostSync: startHostSync, startBoardSync: startBoardSync
  };
})();
