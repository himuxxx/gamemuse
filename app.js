/* =====================================================================
   Ludo Arena — single-file game logic (no backend, no build step)
   ---------------------------------------------------------------------
   Storage (browser localStorage only, per device/browser):
     ludo_users_v1   : [{ username, password, balance, history[], createdAt }]
     ludo_session_v1 : { username, isAdmin } | null
     ludo_meta_v1    : { commission }
   NOTE: passwords are stored in plain text in this prototype on purpose
   for simplicity. Do NOT use a real password here, and do NOT use this
   for real money. Virtual coins only.
   ===================================================================== */

// ---------- Board geometry ----------
// Main 52-square loop, clockwise, starting at the Yellow start square (6,1).
var PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
];
// Absolute indices that are safe (start squares + classic star squares).
var SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
// Starts are spaced 13 squares apart on the 52-square loop, matching SAFE
// (0, 13, 26, 39): Yellow 0 -> (6,1), Green 13 -> (1,8), Red 26 -> (8,13),
// Blue 39 -> (13,6). Each player's progress-50 square is adjacent to its
// home column entry: Yellow (7,0)->(7,1), Green (0,7)->(1,7),
// Red (7,14)->(7,13), Blue (14,7)->(13,7). Hence these home columns.
var START = [0, 13, 26, 39];
// Home columns: 5 coloured squares, then the centre (finished), in
// canonical order Yellow, Green, Red, Blue.
var HOME = [
  [[7,1],[7,2],[7,3],[7,4],[7,5]],
  [[1,7],[2,7],[3,7],[4,7],[5,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9]],
  [[13,7],[12,7],[11,7],[10,7],[9,7]]
];
var YARD = [
  [[1,1],[1,4],[4,1],[4,4]],         // Yellow yard (top-left)
  [[1,10],[1,13],[4,10],[4,13]],     // Green yard (top-right)
  [[10,10],[10,13],[13,10],[13,13]], // Red yard (bottom-right)
  [[10,1],[10,4],[13,1],[13,4]]      // Blue yard (bottom-left)
];
var PLAYER_NAMES = ['Yellow', 'Green', 'Red', 'Blue'];
var PLAYER_CSS = ['yellow', 'green', 'red', 'blue'];
var CENTRE = [7, 7];

// ---------- Storage helpers ----------
function load(key, fallback) {
  try { var v = JSON.parse(localStorage.getItem(key)); return v === null ? fallback : v; }
  catch (e) { return fallback; }
}
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getUsers() { return load('ludo_users_v1', []); }
function saveUsers(u) { save('ludo_users_v1', u); }
function getMeta() { return load('ludo_meta_v1', { commission: 0 }); }
function saveMeta(m) { save('ludo_meta_v1', m); }
function getSession() { return load('ludo_session_v1', null); }
function saveSession(s) { save('ludo_session_v1', s); }
function currentUser() {
  var s = getSession();
  if (!s || s.isAdmin) return null;
  var users = getUsers();
  for (var i = 0; i < users.length; i++) if (users[i].username === s.username) return users[i];
  return null;
}
function updateUser(user) {
  var users = getUsers();
  for (var i = 0; i < users.length; i++) if (users[i].username === user.username) users[i] = user;
  saveUsers(users);
}
function addHistory(user, entry) {
  entry.date = new Date().toLocaleString();
  user.history = user.history || [];
  user.history.unshift(entry);
  updateUser(user);
}

// ---------- DOM ----------
function el(id) { return document.getElementById(id); }
function showMsg(text, isError) {
  var m = el('authMessage'); m.hidden = false; m.textContent = text;
  if (!getSession()) el('authCard').hidden = false; // compact panel: open it so the message is seen
  m.className = 'message' + (isError ? ' error' : '');
}
function updateUserbar() {
  var s = getSession(), info = el('userInfo'), badge = el('balanceBadge'), logout = el('logoutBtn');
  var authToggle = el('authToggleBtn'), adminLink = el('adminLinkBtn');
  if (authToggle) authToggle.hidden = !!s;
  if (adminLink) adminLink.hidden = !(s && s.isAdmin);
  // Compact login: hide the dropdown once logged in; it starts hidden in HTML.
  if (s) el('authCard').hidden = true;
  if (s && s.isAdmin) {
    info.textContent = 'Logged in as ADMIN';
    badge.hidden = true; logout.hidden = false;
  } else if (s) {
    var u = currentUser();
    info.textContent = u ? ('Logged in as ' + u.username) : 'Not logged in';
    if (u) { el('balanceValue').textContent = u.balance; badge.hidden = false; }
    logout.hidden = false;
  } else {
    info.textContent = 'Not logged in'; badge.hidden = true; logout.hidden = true;
  }
  var hist = el('historyBox');
  var u2 = currentUser();
  if (u2) {
    hist.hidden = false;
    el('historyList').innerHTML = (u2.history || []).slice(0, 20).map(function (h) {
      return '<li><strong>' + h.result + '</strong> — ' + h.note + ' <span class="muted">(' + h.date + ')</span></li>';
    }).join('') || '<li>No matches yet.</li>';
  } else { hist.hidden = true; }
  el('adminCard').hidden = !(s && s.isAdmin);
  if (s && s.isAdmin) renderAdmin();
}

// ---------- Admin ----------
function renderAdmin() {
  el('commissionValue').textContent = getMeta().commission;
  var users = getUsers();
  el('adminUsers').innerHTML = users.map(function (u) {
    var safe = u.username.replace(/"/g, '');
    return '<tr><td>' + safe + '</td><td>🪙 ' + u.balance + '</td><td>' + (u.history || []).length + '</td>' +
      '<td><input type="number" min="1" value="10" id="adj-' + safe + '" style="width:70px">' +
      ' <button class="btn small" onclick="adjustCoins(\'' + safe + '\', true)">Add</button>' +
      ' <button class="btn small" onclick="adjustCoins(\'' + safe + '\', false)">Remove</button></td></tr>';
  }).join('') || '<tr><td colspan="4">No users yet in this browser.</td></tr>';
  var all = [];
  users.forEach(function (u) { (u.history || []).forEach(function (h) { all.push(u.username + ': ' + h.result + ' — ' + h.note + ' (' + h.date + ')'); }); });
  el('adminHistory').innerHTML = all.slice(0, 50).map(function (t) { return '<li>' + t + '</li>'; }).join('') || '<li>No matches yet.</li>';
}
function adjustCoins(username, isAdd) {
  var input = el('adj-' + username);
  var amt = parseInt(input ? input.value : '0', 10);
  if (!amt || amt <= 0) { alert('Enter an amount greater than 0.'); return; }
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === username) {
      if (!isAdd && users[i].balance < amt) { alert('That user does not have that many coins.'); return; }
      users[i].balance += isAdd ? amt : -amt;
      users[i].history = users[i].history || [];
      users[i].history.unshift({ date: new Date().toLocaleString(), result: isAdd ? 'Admin credit' : 'Admin debit', note: (isAdd ? '+' : '-') + amt + ' coins by admin', change: isAdd ? amt : -amt });
    }
  }
  saveUsers(users); updateUserbar();
}

// ---------- Board rendering ----------
function cellClass(r, c) {
  // Four 6x6 homes: Yellow TL, Green TR, Blue BL, Red BR.
  if (r < 6 && c < 6) return (r >= 1 && r <= 4 && c >= 1 && c <= 4) ? 'cell white-home' : 'cell home-yellow';
  if (r < 6 && c > 8) return (r >= 1 && r <= 4 && c >= 10 && c <= 13) ? 'cell white-home' : 'cell home-green';
  if (r > 8 && c < 6) return (r >= 10 && r <= 13 && c >= 1 && c <= 4) ? 'cell white-home' : 'cell home-blue';
  if (r > 8 && c > 8) return (r >= 10 && r <= 13 && c >= 10 && c <= 13) ? 'cell white-home' : 'cell home-red';
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return 'cell centre';
  // Home columns (middle line of each arm, towards the centre).
  if (r === 7 && c >= 1 && c <= 5) return 'cell path-yellow';
  if (r === 7 && c >= 9 && c <= 13) return 'cell path-red';
  if (c === 7 && r >= 1 && r <= 5) return 'cell path-green';
  if (c === 7 && r >= 9 && r <= 13) return 'cell path-blue';
  // Start squares (coloured, with arrows in renderBoard).
  if (r === 6 && c === 1) return 'cell path-yellow start-arrow';
  if (r === 1 && c === 8) return 'cell path-green start-arrow';
  if (r === 8 && c === 13) return 'cell path-red start-arrow';
  if (r === 13 && c === 6) return 'cell path-blue start-arrow';
  for (var i = 0; i < PATH.length; i++) {
    if (PATH[i][0] === r && PATH[i][1] === c) return 'cell' + (SAFE.indexOf(i) >= 0 ? ' safe' : '');
  }
  return 'cell';
}
function cellBackground(r, c) {
  if (r < 6 && c < 6) return (r >= 1 && r <= 4 && c >= 1 && c <= 4) ? '#ffffff' : '#facc15';
  if (r < 6 && c > 8) return (r >= 1 && r <= 4 && c >= 10 && c <= 13) ? '#ffffff' : '#22c55e';
  if (r > 8 && c < 6) return (r >= 10 && r <= 13 && c >= 1 && c <= 4) ? '#ffffff' : '#2563eb';
  if (r > 8 && c > 8) return (r >= 10 && r <= 13 && c >= 10 && c <= 13) ? '#ffffff' : '#ef4444';
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return '#ffffff';
  if (r === 7 && c >= 1 && c <= 5) return '#facc15';
  if (r === 7 && c >= 9 && c <= 13) return '#ef4444';
  if (c === 7 && r >= 1 && r <= 5) return '#22c55e';
  if (c === 7 && r >= 9 && r <= 13) return '#2563eb';
  if (r === 6 && c === 1) return '#facc15';
  if (r === 1 && c === 8) return '#22c55e';
  if (r === 8 && c === 13) return '#ef4444';
  if (r === 13 && c === 6) return '#2563eb';
  return '#ffffff';
}
function renderBoard() {
  var board = el('board'); board.innerHTML = '';
  for (var r = 0; r < 15; r++) {
    for (var c = 0; c < 15; c++) {
      var d = document.createElement('div');
      d.className = cellClass(r, c);
      d.style.background = cellBackground(r, c);
      d.style.border = '1px solid #111827';
      var idx = -1;
      for (var i = 0; i < PATH.length; i++) if (PATH[i][0] === r && PATH[i][1] === c) idx = i;
      var startArrows = {'6,1': '→', '1,8': '↓', '8,13': '←', '13,6': '↑'};
      if (startArrows[r + ',' + c]) d.textContent = startArrows[r + ',' + c];
      else if (idx >= 0 && SAFE.indexOf(idx) >= 0) { d.textContent = '★'; d.style.color = '#0f766e'; }
      board.appendChild(d);
    }
  }
}

// ---------- Game state ----------
var game = null;
var computerTimer = null;

function tokenCoord(player, tokenIdx) {
  var p = game.players[player].tokens[tokenIdx];
  if (p === -1) return YARD[player][tokenIdx];
  if (p <= 50) return PATH[(START[player] + p) % 52];
  if (p <= 55) return HOME[player][p - 51];
  return CENTRE;
}
function absoluteIndex(player, progress) {
  if (progress < 0 || progress > 50) return -1;
  return (START[player] + progress) % 52;
}
function canMove(player, tokenIdx, dice) {
  var p = game.players[player].tokens[tokenIdx];
  if (p === -1) return dice === 6;
  if (p >= 56) return false;
  return p + dice <= 56; // exact roll required to finish
}
function movableTokens(player, dice) {
  var out = [];
  for (var i = 0; i < 4; i++) if (canMove(player, i, dice)) out.push(i);
  return out;
}
function renderTokens() {
  var layer = el('tokensLayer'); layer.innerHTML = '';
  if (!game) return;
  // Group tokens by square so stacked tokens are offset, not hidden.
  var groups = {};
  for (var ai = 0; ai < game.active.length; ai++) {
    var pl = game.active[ai];
    for (var t = 0; t < 4; t++) {
      var coord = tokenCoord(pl, t);
      var key = coord[0] + ',' + coord[1];
      (groups[key] = groups[key] || []).push({ pl: pl, t: t, coord: coord });
    }
  }
  Object.keys(groups).forEach(function (key) {
    var list = groups[key];
    list.forEach(function (item, j) {
      var coord = item.coord;
      var offset = (j - (list.length - 1) / 2) * 1.6;
      var d = document.createElement('div');
      // Movable highlight is only for a human turn (computer moves itself).
      var humanTurn = game.mode === 'practice' || ludoTurnId() === 0;
      var movable = humanTurn && game.rolled && ludoTurnId() === item.pl && canMove(item.pl, item.t, game.dice);
      d.className = 'token ' + PLAYER_CSS[item.pl] + (movable ? ' movable' : '') +
        (game.players[item.pl].tokens[item.t] === 56 ? ' finished' : '');
      d.style.left = ((coord[1] + 0.5) / 15 * 100 + offset) + '%';
      d.style.top = ((coord[0] + 0.5) / 15 * 100 + offset) + '%';
      d.textContent = item.t + 1;
      d.title = PLAYER_NAMES[item.pl] + ' token ' + (item.t + 1);
      if (movable) d.onclick = function () { doMove(item.pl, item.t); };
      layer.appendChild(d);
    });
  });
}
function setTurnLabel(text) { el('turnLabel').textContent = text; }
function updateStakeLabel() {
  el('stakeLabel').textContent = game && game.mode === 'stake' ? 'Stake match — 10 coins paid, winner gets 15, commission 5' : 'No active stake';
}



// ---------- Real game feel: WebAudio sounds (no files) + vibration ----------
var soundOn = true, audioCtx = null;
function getAudio() {
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
  return audioCtx;
}
function playTone(freq, dur, type, vol) {
  if (!soundOn) return;
  var ctx = getAudio(); if (!ctx) return;
  try {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function playDiceRattle() { if (!soundOn) return; [0, 90, 180].forEach(function (d, i) { setTimeout(function () { playTone(180 + i * 60, 0.08, 'square', 0.05); }, d); }); vibrate(30); }
function playStep() { playTone(520, 0.06, 'triangle', 0.08); }
function playCapture() { playTone(700, 0.12, 'sawtooth', 0.08); setTimeout(function () { playTone(300, 0.18, 'sawtooth', 0.08); }, 80); vibrate(60); }
function playWin() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { playTone(f, 0.25, 'triangle', 0.12); }, i * 130); }); vibrate([80, 60, 80, 60, 120]); }

// ---------- Per-player dice ----------
// One dice per active player, labelled only by the coloured ball dot.
// Only the current player's dice is clickable and rolls; the others stay
// dimmed and keep showing their last roll (1 initially). Each dice unit
// is ONE flat dice-face element that looks 3D (see below). No WebGL
// canvas and no preserve-3d cube, so a face can never go black.
var lastLudoActive = [0, 2]; // default 2-player dice before any match starts
function ludoTurnId() { return game ? game.active[game.turnPos] : null; }
// NOTE: there is deliberately NO small final-face readout any more.
// Each active player shows exactly ONE dice (the large 3D cube) plus
// the coloured ball dot. The settled cube face itself is the result,
// and the stage bar's 'Rolled: X' text states it.
// One-screen stage toggle: while a match is active the setup text and
// mode buttons are hidden (CSS) and the stage fits the viewport, so the
// board and dice are visible without page scrolling; roll by clicking
// the current player's dice (there is no Roll button any more).
function setLudoMatchActive(on) {
  var v = el('ludoView'); if (v) v.classList.toggle('match-active', !!on);
  if (document.body) document.body.classList.toggle('ludo-active', !!on);
}
// ---------- Per-player dice: FLAT, guaranteed-visible dice face ----------
// Why the Three.js cube was removed: in screenshots/previews (and on
// some devices) its WebGL top face failed to render for faces 2-5,
// face 6 showed 1 pip, and the previous player's dice vanished unless
// its last roll was 1. A DOM face cannot do that: it is always a
// white rounded face with a real grid of black pip spans, so the pip
// count in the DOM is always the rolled number, and the face is
// always visible (inactive dice are only dimmed to opacity 0.68).
// The face LOOKS 3D via a highlight gradient, dark rim, inner shadow,
// drop shadow and a podium shadow ellipse, plus a small fixed
// perspective tilt (rotateX/rotateY on a single flat element —
// NOT a preserve-3d cube, NOT a WebGL canvas, NO backface-visibility).
var DICE_PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
}; // [row, col], 1-indexed, pip count always equals the value
var flatDiceTimers = {}; // canonical -> interval id, cleared on settle
function setDiceFace(faceEl, value) {
  faceEl.innerHTML = '';
  DICE_PIPS[value].forEach(function (p) {
    var sp = document.createElement('span');
    sp.style.gridRow = p[0]; sp.style.gridColumn = p[1];
    faceEl.appendChild(sp);
  });
  faceEl.setAttribute('data-value', value);
  faceEl.setAttribute('data-pips', DICE_PIPS[value].length);
}
function createFlatDice(canonical, last) {
  var wrap = document.createElement('div'); wrap.className = 'flat-dice-slot';
  var shadow = document.createElement('div'); shadow.className = 'dice-podium';
  wrap.appendChild(shadow);
  var face = document.createElement('div'); face.className = 'flat-dice-face';
  face.id = 'diceFace-' + canonical;
  setDiceFace(face, last);
  wrap.appendChild(face);
  return wrap;
}
function renderPlayerDice() {
  // Dice are distributed into four fixed corner slots, not a tray above
  // the board: top strip Yellow(0, left) + Green(1, right), bottom strip
  // Blue(3, left) + Red(2, right) — each colour's home corner. Inactive
  // slots are emptied and hidden with visibility (not display:none), so
  // 2-player games show only Yellow + Red without the other slots
  // shifting position.
  var stage = el('ludoStage');
  if (stage) { stage.classList.remove('count-2', 'count-4'); }
  var active = game ? game.active : lastLudoActive;
  if (stage) stage.classList.add('count-' + active.length);
  for (var canonical = 0; canonical < 4; canonical++) {
    var slot = el('diceSlot-' + canonical); if (!slot) continue;
    slot.innerHTML = '';
    if (active.indexOf(canonical) < 0) { slot.classList.add('empty'); continue; }
    slot.classList.remove('empty');
    var last = game && game.lastRolls ? (game.lastRolls[canonical] || 1) : 1;
    var isCurrent = game && ludoTurnId() === canonical;
    var unit = document.createElement('div');
    unit.className = 'player-dice' + (isCurrent ? ' active' : '');
    unit.setAttribute('data-player', canonical);
    // Dice-click to roll: ONLY the current player's dice is clickable
    // and triggers rollDice() (which itself guards against double rolls,
    // a pending token move, and the computer's turn in stake mode).
    // Non-current dice get no handler and do nothing when clicked.
    if (isCurrent) { unit.onclick = rollDice; unit.title = 'Click to roll'; }
    unit.appendChild(createFlatDice(canonical, last));
    var label = document.createElement('div'); label.className = 'player-dice-label';
    label.setAttribute('aria-label', PLAYER_NAMES[canonical] + ' dice');
    label.innerHTML = '<i class="dot ' + PLAYER_CSS[canonical] + '"></i>';
    unit.appendChild(label);
    slot.appendChild(unit);
  }
}
function setPlayerDiceResult(canonical, v) {
  if (game) game.lastRolls[canonical] = v;
  var dr = el('diceResult'); if (dr) dr.textContent = 'Rolled: ' + v + ' — ' + PLAYER_NAMES[canonical];
}
function animatePlayerDiceRoll(canonical, value, done) {
  playDiceRattle();
  var face = el('diceFace-' + canonical);
  if (!face) { setPlayerDiceResult(canonical, value); if (done) done(); return; }
  if (flatDiceTimers[canonical]) { clearInterval(flatDiceTimers[canonical]); delete flatDiceTimers[canonical]; }
  // Tumble in 2D only: cycle random pip faces every ~80ms for ~900ms
  // with a small rotate/bounce (never edge-on, never hidden), then
  // settle on the EXACT rolled face and stop. The settled face is a
  // real pip grid, so its count equals the rolled number by construction.
  var steps = 0;
  var timer = setInterval(function () {
    if (!game) { clearInterval(timer); delete flatDiceTimers[canonical]; return; }
    steps++;
    var r = Math.floor(Math.random() * 6) + 1;
    setDiceFace(face, r);
    var rot = (Math.random() * 24 - 12).toFixed(1);
    var dy = (-Math.random() * 6).toFixed(1);
    var sc = (1 + Math.random() * 0.08).toFixed(2);
    face.style.transform = 'rotateX(6deg) rotateY(-8deg) rotateZ(' + rot + 'deg) translateY(' + dy + 'px) scale(' + sc + ')';
    if (steps >= 11) {
      clearInterval(timer); delete flatDiceTimers[canonical];
      setDiceFace(face, value);
      face.style.transform = ''; // back to the CSS base tilt, fully visible
      if (!game) return; // restarted mid-tumble: do not write a stale Rolled label
      setPlayerDiceResult(canonical, value);
      setTimeout(done, 200);
    }
  }, 80);
  flatDiceTimers[canonical] = timer;
}

// ---------- Game flow ----------

function startGame(mode, playerCount) {
  var wb0 = el('winBanner'); if (wb0) wb0.hidden = true;
  var count = (mode === 'practice' && playerCount === 4) ? 4 : 2;
  var active = (count === 4) ? [0, 1, 2, 3] : [0, 2];
  lastLudoActive = active;
  if (mode === 'stake') {
    var user = currentUser();
    if (!user) { showMsg('Log in first to play a stake match.', true); return; }
    if (user.balance < 10) { showMsg('Not enough coins for a stake match. You need at least 10 coins.', true); return; }
    user.balance -= 10;
    addHistory(user, { result: 'Stake match started', note: '-10 coins entry vs Computer', change: -10 });
    // addHistory already saved the user; refresh the local copy.
    user = currentUser();
  }
  setLudoMatchActive(true);
  game = {
    mode: mode,
    playerCount: count,
    active: active,
    players: [{ tokens: [-1, -1, -1, -1] }, { tokens: [-1, -1, -1, -1] }, { tokens: [-1, -1, -1, -1] }, { tokens: [-1, -1, -1, -1] }],
    turnPos: 0, dice: null, rolled: false,
    lastRolls: {}
  };
  active.forEach(function (id) { game.lastRolls[id] = 1; });
  // Reset the Rolled display to its initial state on every new match:
  // without this, a previous game's 'Rolled: 5' stayed visible before
  // any roll in the new game, even though all dice now show 1.
  var dr0 = el('diceResult'); if (dr0) dr0.textContent = 'Roll to start';
  renderPlayerDice(); renderTokens(); updateStakeLabel(); updateUserbar();
  setTurnLabel(mode === 'stake' ? 'Stake match started — Yellow (you) to roll.' : (count === 4 ? 'Practice started — Yellow (Player 1) to roll. 4 players: Yellow, Green, Red, Blue.' : 'Practice started — Yellow (Player 1) to roll.'));
  el('gameMessage').textContent = 'Roll the dice. A 6 lets a token leave home, and also gives an extra roll.';
  if (mode === 'stake') showMsg('Stake match started: 10 coins deducted. Winner gets 15 coins, 5 coins go to system commission.', false);
}
function rollDice() {
  if (!game || game.rolled) return;
  var turnId = ludoTurnId();
  if (game.mode === 'stake' && turnId !== 0) return; // computer rolls itself
  game.rolled = true; // lock out double rolls during the tumble
  var value = Math.floor(Math.random() * 6) + 1;
  animatePlayerDiceRoll(turnId, value, function () {
    if (!game) return;
    game.dice = value;
    var moves = movableTokens(turnId, value);
    if (moves.length === 0) {
      setTurnLabel(PLAYER_NAMES[turnId] + ' rolled ' + value + ' — no move possible. Turn passes.');
      renderTokens();
      setTimeout(function () { if (game) { game.rolled = false; game.turnPos = (game.turnPos + 1) % game.active.length; afterTurnChange(); } }, 900);
    } else {
      setTurnLabel(PLAYER_NAMES[turnId] + ' rolled ' + value + ' — click a highlighted token to move it.');
      renderTokens();
    }
  });
}
function afterTurnChange() {
  if (!game) return;
  var turnId = ludoTurnId();
  setTurnLabel(PLAYER_NAMES[turnId] + ' to roll.');
  renderPlayerDice(); renderTokens();
  if (game.mode === 'stake' && turnId === 2) setTimeout(function () { if (game) rollDiceComputer(); }, 600);
}
function rollDiceComputer() {
  if (!game || game.rolled || ludoTurnId() !== 2) return;
  game.rolled = true;
  var value = Math.floor(Math.random() * 6) + 1;
  animatePlayerDiceRoll(2, value, function () {
    if (!game) return;
    game.dice = value;
    var moves = movableTokens(2, value);
    if (moves.length === 0) {
      setTurnLabel('Computer rolled ' + value + ' — no move. Your turn.');
      setTimeout(function () { if (game) { game.rolled = false; game.turnPos = (game.turnPos + 1) % game.active.length; afterTurnChange(); } }, 900);
    } else {
      setTurnLabel('Computer rolled ' + value + '.');
      renderTokens();
      setTimeout(computerMove, 700);
    }
  });
}
// ---------- Computer AI (stake mode, Red) ----------
// Human-like scoring over EVERY legal move, from the resulting position.
// The old AI only pushed the furthest token, so with 3 tokens out it kept
// moving the same one. This version weighs finish, capture, danger,
// escape, leaving home, spreading tokens and progress — with a small
// random jitter, so it is not perfectly predictable and never always
// picks the first move on a tie. Only legal moves are evaluated (no
// deep search), so it stays fast.
function capturedByMove(player, tokenIdx, dice) {
  var p = game.players[player].tokens[tokenIdx];
  var next = p === -1 ? 0 : p + dice;
  var out = [];
  if (next > 50) return out;
  var abs = absoluteIndex(player, next);
  if (SAFE.indexOf(abs) >= 0) return out;
  game.active.forEach(function (opp) {
    if (opp === player) return;
    for (var i = 0; i < 4; i++) {
      var op = game.players[opp].tokens[i];
      if (op >= 0 && op <= 50 && absoluteIndex(opp, op) === abs) out.push({ player: opp, token: i });
    }
  });
  return out;
}
// True if a token sitting at `progress` (loop only) could be captured by
// an active opponent rolling 1-6 next turn. Safe squares, home columns,
// the centre, and squares stacked with an own token are not in danger.
// `removed` lists opponent tokens already captured by the move being
// scored, so they cannot threaten the landing square.
function tokenInDanger(player, tokenIdx, progress, removed) {
  if (progress < 0 || progress > 50) return false; // yard, home column, centre
  var abs = absoluteIndex(player, progress);
  if (SAFE.indexOf(abs) >= 0) return false;
  // Stacked with an own token counts as safe for scoring purposes.
  for (var s = 0; s < 4; s++) {
    if (s !== tokenIdx && game.players[player].tokens[s] === progress) return false;
  }
  for (var a = 0; a < game.active.length; a++) {
    var opp = game.active[a];
    if (opp === player) continue;
    for (var i = 0; i < 4; i++) {
      if (removed && removed.some(function (c) { return c.player === opp && c.token === i; })) continue;
      var op = game.players[opp].tokens[i];
      if (op < 0 || op > 50) continue;
      var dist = (abs - absoluteIndex(opp, op) + 52) % 52;
      if (dist >= 1 && dist <= 6) return true;
    }
  }
  return false;
}
// Score one legal move. `ctx` is precomputed in computerMove: whether any
// legal move finishes or captures, and whether any out token is in danger.
// Scores (jitter excluded): finish 1000, capture 400 + captured-token
// value (near-finish 150 / mid 80 / low 40), escape from danger to a safe
// square/home/stacked 300, leave home 180 (+60 spread bonus when nothing
// is in danger and no finish/capture is on offer), home-column entry 120,
// stacked landing 120, danger landing -220 (non-capture moves only),
// leader penalty -100 when another out token trails by 12+, lagging-token
// bonus +80 when the moved token trails the leader by 12+, progress
// +0.4 per progress step. Jitter is +0..30.
function scoreComputerMove(player, tokenIdx, dice, ctx) {
  var p = game.players[player].tokens[tokenIdx];
  var next = p === -1 ? 0 : p + dice;
  var score = 0;
  if (next === 56) return 1000 + Math.random() * 30; // finish: highest, no danger possible
  var captured = capturedByMove(player, tokenIdx, dice);
  var inDangerNow = p >= 0 && p <= 50 && tokenInDanger(player, tokenIdx, p, []);
  var landsSafe = (next >= 51) || (next <= 50 && SAFE.indexOf(absoluteIndex(player, next)) >= 0) ||
    game.players[player].tokens.some(function (v, i) { return i !== tokenIdx && v === next; });
  if (captured.length) {
    score += 400;
    captured.forEach(function (c) {
      var op = game.players[c.player].tokens[c.token];
      score += op >= 40 ? 150 : (op >= 20 ? 80 : 40); // high-value / near-finish victim counts more
    });
    // A capture that lands in immediate danger is worth much less,
    // unless the victim was high-value / near-finish.
    if (tokenInDanger(player, tokenIdx, next, captured)) {
      var highValue = captured.some(function (c) { return game.players[c.player].tokens[c.token] >= 40; });
      score += highValue ? -100 : -250;
    }
  } else {
    // Escape: a token currently in danger reaching safety.
    if (inDangerNow && landsSafe) score += 300;
    // Avoid leaving a single token vulnerable on a non-safe square.
    if (next <= 50 && !landsSafe && tokenInDanger(player, tokenIdx, next, [])) score -= 220;
  }
  if (p === -1) {
    score += 180; // leave home with a 6: spread tokens instead of pushing one
    if (!ctx.hasCapture && !ctx.hasFinish && !ctx.anyInDanger) score += 60;
  }
  if (next >= 51 && next <= 55) score += 120; // entering the home column
  if (next <= 50 && !captured.length && game.players[player].tokens.some(function (v, i) { return i !== tokenIdx && v === next; })) score += 120; // stacking up
  // Spread / balance: do not keep pushing the same leading token while
  // others trail far behind; reward a lagging token when scores are close.
  var out = game.players[player].tokens.filter(function (v) { return v >= 0 && v < 56; });
  var leader = out.length ? Math.max.apply(null, out) : 0;
  if (p >= 0 && p === leader && out.some(function (v) { return leader - v >= 12; })) score -= 100;
  if (p >= 0 && leader - p >= 12) score += 80;
  score += next * 0.4; // progress: small, never outweighs safety/capture/finish
  score += Math.random() * 30; // tie-break jitter: not perfectly predictable
  return score;
}
function computerMove() {
  if (!game || !game.rolled || ludoTurnId() !== 2) return;
  var moves = movableTokens(2, game.dice);
  if (!moves.length) return;
  var ctx = { hasFinish: false, hasCapture: false, anyInDanger: false };
  moves.forEach(function (t) {
    var p = game.players[2].tokens[t];
    if (p !== -1 && p + game.dice === 56) ctx.hasFinish = true;
    if (capturedByMove(2, t, game.dice).length) ctx.hasCapture = true;
    if (p >= 0 && p <= 50 && tokenInDanger(2, t, p, [])) ctx.anyInDanger = true;
  });
  var best = moves[0], bestScore = -Infinity;
  moves.forEach(function (t) {
    var score = scoreComputerMove(2, t, game.dice, ctx);
    if (score > bestScore) { bestScore = score; best = t; }
  });
  doMove(2, best);
}
function doMove(player, tokenIdx) {
  if (!game || !game.rolled || ludoTurnId() !== player || game.animating) return;
  if (!canMove(player, tokenIdx, game.dice)) return;
  var p = game.players[player].tokens[tokenIdx];
  var next = p === -1 ? 0 : p + game.dice;
  var stepCount = p === -1 ? 1 : (next - p);
  // Capture is decided from the FINAL square only, before animating.
  var capturedIdx = [];
  if (next <= 50) {
    var abs = absoluteIndex(player, next);
    if (SAFE.indexOf(abs) < 0) {
      game.active.forEach(function (opp) {
        if (opp === player) return;
        for (var i = 0; i < 4; i++) {
          var op = game.players[opp].tokens[i];
          if (op >= 0 && op <= 50 && absoluteIndex(opp, op) === abs) capturedIdx.push({ player: opp, token: i });
        }
      });
    }
  }
  game.animating = true;
  var step = 0;
  (function stepFn() {
    if (!game) return;
    step++;
    game.players[player].tokens[tokenIdx] = (p === -1) ? 0 : (p + step);
    playStep();
    renderTokens();
    if (step < stepCount) { setTimeout(stepFn, 170); return; }
    capturedIdx.forEach(function (c) { game.players[c.player].tokens[c.token] = -1; });
    if (capturedIdx.length) playCapture();
    var captured = capturedIdx.length > 0;
    renderTokens();
    var finished = game.players[player].tokens.every(function (v) { return v === 56; });
    game.animating = false;
    if (finished) { finishGame(player); return; }
    var extra = game.dice === 6 || captured;
    setTurnLabel(PLAYER_NAMES[player] + ' moved token ' + (tokenIdx + 1) + (captured ? ' and captured an opponent!' : '') + (extra ? ' Extra roll.' : ''));
    game.rolled = false;
    if (!extra) game.turnPos = (game.turnPos + 1) % game.active.length;
    afterTurnChange();
  })();
}
function finishGame(winner) {
  var mode = game.mode;
  var winnerName = mode === 'stake' ? (winner === 0 ? 'You (Yellow)' : 'Computer (Red)') : PLAYER_NAMES[winner];
  setTurnLabel('🏆 ' + winnerName + ' won!');
  playWin();
  var wb = el('winBanner'); if (wb) { wb.hidden = false; wb.textContent = '🏆 ' + winnerName + ' won!'; }
  var bw = el('ludoBoardWrap'); if (bw) { bw.classList.add('win-celebrate'); setTimeout(function () { bw.classList.remove('win-celebrate'); }, 2600); }
  el('gameMessage').textContent = winnerName + ' brought all 4 tokens home first.';
  renderTokens();
  var meta = getMeta();
  if (mode === 'stake') {
    meta.commission += 5; // 5 coins from every completed stake match's 20-coin pot
    saveMeta(meta);
    var user = currentUser();
    if (user) {
      if (winner === 0) {
        user.balance += 15;
        addHistory(user, { result: 'Stake match — WON', note: '+15 coins (entry 10 paid, commission 5 to system)', change: 15 });
      } else {
        addHistory(user, { result: 'Stake match — LOST', note: '-10 coins entry lost (winner gets 15, commission 5 to system)', change: 0 });
      }
    }
  } else {
    var u = currentUser();
    if (u) addHistory(u, { result: 'Practice match', note: PLAYER_NAMES[winner] + ' won — no coins changed', change: 0 });
  }
  updateStakeLabel(); updateUserbar();
  game = null; // board stays visible; start a new match with the buttons above
  el('stakeLabel').textContent = 'Match finished — start a new match to play again.';
}

// ---------- Auth wiring ----------
document.addEventListener('DOMContentLoaded', function () {
  renderBoard();
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.onclick = function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      el('loginForm').hidden = tab.dataset.tab !== 'login';
      el('signupForm').hidden = tab.dataset.tab !== 'signup';
    };
  });
  el('loginForm').onsubmit = function (e) {
    e.preventDefault();
    var name = el('loginUser').value.trim(), pass = el('loginPass').value;
    if (name === 'admin' && pass === 'admin123') {
      saveSession({ username: 'admin', isAdmin: true });
      showMsg('Welcome, admin. The admin panel is below.'); updateUserbar(); return;
    }
    var user = getUsers().find(function (u) { return u.username === name; });
    if (!user || user.password !== pass) { showMsg('Wrong username or password.', true); return; }
    saveSession({ username: name, isAdmin: false });
    showMsg('Welcome back, ' + name + '! Balance: ' + user.balance + ' coins.'); updateUserbar();
  };
  el('signupForm').onsubmit = function (e) {
    e.preventDefault();
    var name = el('signupUser').value.trim(), pass = el('signupPass').value;
    if (!name || !pass) { showMsg('Choose a username and password.', true); return; }
    if (name === 'admin') { showMsg('That username is reserved for admin.', true); return; }
    if (getUsers().some(function (u) { return u.username === name; })) { showMsg('That username is already taken in this browser.', true); return; }
    var users = getUsers();
    users.push({ username: name, password: pass, balance: 100, history: [], createdAt: new Date().toISOString() });
    saveUsers(users); saveSession({ username: name, isAdmin: false });
    showMsg('Account created! You start with 100 virtual coins.'); updateUserbar();
  };
  el('logoutBtn').onclick = function () { saveSession(null); showMsg('Logged out. Your account is still saved in this browser.'); updateUserbar(); };
  if (el('authToggleBtn')) el('authToggleBtn').onclick = function () { el('authCard').hidden = !el('authCard').hidden; };
  if (el('adminLinkBtn')) el('adminLinkBtn').onclick = function () { document.getElementById('adminCard').scrollIntoView({ behavior: 'smooth' }); };
  el('stakeBtn').onclick = function () { startGame('stake', 2); };
  el('practiceBtn').onclick = function () { startGame('practice', 2); };
  if (el('practice4Btn')) el('practice4Btn').onclick = function () { startGame('practice', 4); };
  el('resetBtn').onclick = function () {
    if (game && game.mode === 'stake') {
      el('gameMessage').textContent = 'Board restarted. Note: a stake entry already paid is not refunded by restarting.';
    }
    game = null; setLudoMatchActive(false); renderTokens(); renderPlayerDice(); updateStakeLabel();
    var drR = el('diceResult'); if (drR) drR.textContent = 'Roll to start';
    setTurnLabel('Board cleared. Start a new match.');
  };
  var st = el('soundToggleBtn'); if (st) st.onclick = function () { soundOn = !soundOn; st.textContent = soundOn ? 'Sound on' : 'Sound off'; };
  renderPlayerDice();
  updateUserbar();
});

/* =====================================================================
   Added in the ultra upgrade: game-select navigation, Daba (chess) and
   Daba (chess). The original Ludo, login, admin and coin code above
   is untouched. All stake matches share: entry 10, winner 15,
   commission 5, blocked below 10, no refund on mid-match restart.
   ===================================================================== */

// ---------- Shared stake helper (Daba) ----------
function stakeStartForGame(label) {
  var user = currentUser();
  if (!user) { showMsg('Log in first to play a stake match.', true); return false; }
  if (user.balance < 10) { showMsg('Not enough coins for a stake match. You need at least 10 coins.', true); return false; }
  user.balance -= 10;
  addHistory(user, { result: 'Stake match started', note: '-10 coins entry vs Computer (' + label + ')', change: -10 });
  updateUserbar();
  showMsg('Stake match started (' + label + '): 10 coins deducted. Winner gets 15 coins, 5 coins go to system commission.', false);
  return true;
}
function settleStakeGame(label, userWon) {
  var meta = getMeta(); meta.commission += 5; saveMeta(meta);
  var user = currentUser();
  if (user) {
    if (userWon) {
      user.balance += 15;
      addHistory(user, { result: 'Stake match — WON', note: '+15 coins (' + label + ': entry 10 paid, commission 5 to system)', change: 15 });
    } else {
      addHistory(user, { result: 'Stake match — LOST', note: '-10 coins entry lost (' + label + ': winner gets 15, commission 5 to system)', change: 0 });
    }
  }
  updateUserbar();
}
function recordPracticeGame(label, winnerText) {
  var u = currentUser();
  if (u) addHistory(u, { result: 'Practice match', note: label + ': ' + winnerText + ' won — no coins changed', change: 0 });
  updateUserbar();
}

// ---------- Navigation ----------
function showView(id) {
  ['homeView', 'ludoView', 'chessView'].forEach(function (v) { el(v).hidden = (v !== id); });
  if (id !== 'ludoView') setLudoMatchActive(false);
  window.scrollTo(0, 0);
}

// =====================================================================
// DABA (CHESS)
// Board: 8x8 array, null or 'wP'/'bK' etc. White moves up (row -1).
// =====================================================================
var CHESS_GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' };
var CHESS_GLYPH_B = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
var PIECE_VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
var chessState = null;

function chessInitialBoard() {
  var back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  var b = [];
  for (var r = 0; r < 8; r++) { b.push([null, null, null, null, null, null, null, null]); }
  for (var c = 0; c < 8; c++) {
    b[0][c] = 'b' + back[c]; b[1][c] = 'bP';
    b[6][c] = 'wP'; b[7][c] = 'w' + back[c];
  }
  return b;
}
function chessCloneBoard(board) { return board.map(function (row) { return row.slice(); }); }
function chessInBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function chessFindKing(board, color) {
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++)
    if (board[r][c] === color + 'K') return [r, c];
  return null;
}
function chessSquareAttacked(board, r, c, by) {
  var dr, dc, i, rr, cc, p;
  // Pawns: a white pawn attacks from one row below, a black pawn from above.
  var pr = by === 'w' ? r + 1 : r - 1;
  if (chessInBounds(pr, c - 1) && board[pr][c - 1] === by + 'P') return true;
  if (chessInBounds(pr, c + 1) && board[pr][c + 1] === by + 'P') return true;
  var knights = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (i = 0; i < knights.length; i++) {
    rr = r + knights[i][0]; cc = c + knights[i][1];
    if (chessInBounds(rr, cc) && board[rr][cc] === by + 'N') return true;
  }
  var kingDirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (i = 0; i < kingDirs.length; i++) {
    rr = r + kingDirs[i][0]; cc = c + kingDirs[i][1];
    if (chessInBounds(rr, cc) && board[rr][cc] === by + 'K') return true;
  }
  var sliders = [
    { dirs: [[-1, 0], [1, 0], [0, -1], [0, 1]], pieces: ['R', 'Q'] },
    { dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]], pieces: ['B', 'Q'] }
  ];
  for (var s = 0; s < sliders.length; s++) {
    for (var d = 0; d < sliders[s].dirs.length; d++) {
      dr = sliders[s].dirs[d][0]; dc = sliders[s].dirs[d][1]; rr = r + dr; cc = c + dc;
      while (chessInBounds(rr, cc)) {
        p = board[rr][cc];
        if (p) {
          if (p[0] === by && sliders[s].pieces.indexOf(p[1]) >= 0) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }
  }
  return false;
}
function chessInCheck(board, color) {
  var k = chessFindKing(board, color);
  if (!k) return false;
  return chessSquareAttacked(board, k[0], k[1], color === 'w' ? 'b' : 'w');
}
function chessPseudoMoves(board, r, c, st) {
  var piece = board[r][c]; if (!piece) return [];
  var color = piece[0], type = piece[1], moves = [];
  function push(r2, c2, extra) {
    if (!chessInBounds(r2, c2)) return;
    var t = board[r2][c2];
    if (t && t[0] === color) return;
    var m = { from: [r, c], to: [r2, c2] };
    if (extra) for (var k in extra) m[k] = extra[k];
    moves.push(m);
  }
  var dir, startRow, promoRow, i, rr, cc;
  if (type === 'P') {
    dir = color === 'w' ? -1 : 1; startRow = color === 'w' ? 6 : 1; promoRow = color === 'w' ? 0 : 7;
    if (!board[r + dir][c]) {
      push(r + dir, c, (r + dir === promoRow) ? { promotion: true } : null);
      if (r === startRow && !board[r + 2 * dir][c]) push(r + 2 * dir, c, { double: true });
    }
    [-1, 1].forEach(function (dc) {
      var c2 = c + dc, r2 = r + dir;
      if (!chessInBounds(r2, c2)) return;
      if (board[r2][c2] && board[r2][c2][0] !== color)
        push(r2, c2, (r2 === promoRow) ? { promotion: true } : null);
      if (st.enPassant && st.enPassant[0] === r2 && st.enPassant[1] === c2)
        push(r2, c2, { enPassant: true });
    });
  } else if (type === 'N' || type === 'K') {
    var steps = type === 'N'
      ? [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
      : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    steps.forEach(function (s) { push(r + s[0], c + s[1]); });
    if (type === 'K') {
      // Castling: king and rook unmoved, squares empty, king not in / through / into check.
      var row = color === 'w' ? 7 : 0, opp = color === 'w' ? 'b' : 'w';
      var ks = color === 'w' ? 'wK' : 'bK', qs = color === 'w' ? 'wQ' : 'bQ';
      if (st.castling[ks] && !board[row][5] && !board[row][6] && board[row][7] === color + 'R'
        && !chessSquareAttacked(board, row, 4, opp) && !chessSquareAttacked(board, row, 5, opp) && !chessSquareAttacked(board, row, 6, opp))
        moves.push({ from: [r, c], to: [row, 6], castling: 'K' });
      if (st.castling[qs] && !board[row][3] && !board[row][2] && !board[row][1] && board[row][0] === color + 'R'
        && !chessSquareAttacked(board, row, 4, opp) && !chessSquareAttacked(board, row, 3, opp) && !chessSquareAttacked(board, row, 2, opp))
        moves.push({ from: [r, c], to: [row, 2], castling: 'Q' });
    }
  } else {
    var dirs = [];
    if (type === 'B' || type === 'Q') dirs = dirs.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    if (type === 'R' || type === 'Q') dirs = dirs.concat([[-1, 0], [1, 0], [0, -1], [0, 1]]);
    dirs.forEach(function (d) {
      rr = r + d[0]; cc = c + d[1];
      while (chessInBounds(rr, cc)) {
        if (board[rr][cc] && board[rr][cc][0] === color) break;
        moves.push({ from: [r, c], to: [rr, cc] });
        if (board[rr][cc]) break;
        rr += d[0]; cc += d[1];
      }
    });
  }
  return moves;
}
function chessApplyToBoard(board, move, st) {
  var nb = chessCloneBoard(board);
  var piece = nb[move.from[0]][move.from[1]];
  nb[move.from[0]][move.from[1]] = null;
  if (move.enPassant) nb[move.from[0]][move.to[1]] = null;
  if (move.castling) {
    var row = move.from[0];
    if (move.castling === 'K') { nb[row][5] = nb[row][7]; nb[row][7] = null; }
    else { nb[row][3] = nb[row][0]; nb[row][0] = null; }
  }
  nb[move.to[0]][move.to[1]] = move.promotion ? piece[0] + 'Q' : piece;
  return nb;
}
function chessLegalMoves(board, color, st) {
  var out = [];
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    if (board[r][c] && board[r][c][0] === color) {
      chessPseudoMoves(board, r, c, st).forEach(function (m) {
        if (!chessInCheck(chessApplyToBoard(board, m, st), color)) out.push(m);
      });
    }
  }
  return out;
}
function chessUpdateCastling(st, move, capturedPiece) {
  var piece = st.board[move.from[0]][move.from[1]];
  if (piece === 'wK') { st.castling.wK = false; st.castling.wQ = false; }
  if (piece === 'bK') { st.castling.bK = false; st.castling.bQ = false; }
  if (piece === 'wR' && move.from[0] === 7 && move.from[1] === 0) st.castling.wQ = false;
  if (piece === 'wR' && move.from[0] === 7 && move.from[1] === 7) st.castling.wK = false;
  if (piece === 'bR' && move.from[0] === 0 && move.from[1] === 0) st.castling.bQ = false;
  if (piece === 'bR' && move.from[0] === 0 && move.from[1] === 7) st.castling.bK = false;
  if (capturedPiece === 'wR' && move.to[0] === 7 && move.to[1] === 0) st.castling.wQ = false;
  if (capturedPiece === 'wR' && move.to[0] === 7 && move.to[1] === 7) st.castling.wK = false;
  if (capturedPiece === 'bR' && move.to[0] === 0 && move.to[1] === 0) st.castling.bQ = false;
  if (capturedPiece === 'bR' && move.to[0] === 0 && move.to[1] === 7) st.castling.bK = false;
}
function chessRender() {
  var wrap = el('chessBoard'); wrap.innerHTML = '';
  var board = chessState ? chessState.board : chessInitialBoard();
  var legalByTarget = {};
  if (chessState && chessState.selected) {
    chessState.legal.forEach(function (m) { legalByTarget[m.to[0] + ',' + m.to[1]] = m; });
  }
  var checkKing = null;
  if (chessState && chessInCheck(board, chessState.turn)) checkKing = chessFindKing(board, chessState.turn);
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    (function (r, c) {
      var d = document.createElement('div');
      d.className = 'chess-square ' + (((r + c) % 2 === 0) ? 'light' : 'dark');
      if (chessState && chessState.selected && chessState.selected[0] === r && chessState.selected[1] === c) d.className += ' selected';
      if (legalByTarget[r + ',' + c]) d.className += board[r][c] ? ' legal-capture' : ' legal';
      if (checkKing && checkKing[0] === r && checkKing[1] === c) d.className += ' in-check';
      if (chessState && chessState.lastMoveTo && chessState.lastMoveTo[0] === r && chessState.lastMoveTo[1] === c) d.className += ' just-moved';
      var p = board[r][c];
      if (p) {
        var s = document.createElement('span');
        s.className = p[0] === 'w' ? 'piece-white' : 'piece-black';
        s.textContent = p[0] === 'w' ? CHESS_GLYPH[p[1]] : CHESS_GLYPH_B[p[1]];
        d.appendChild(s);
      }
      d.onclick = function () { chessClick(r, c); };
      wrap.appendChild(d);
    })(r, c);
  }
  if (chessState) {
    el('chessCaptured').textContent = 'Captured by White: ' + (chessState.capturedByWhite.join(' ') || '—') +
      '  ·  Captured by Black: ' + (chessState.capturedByBlack.join(' ') || '—');
  }
}
function chessHumanTurn() {
  if (!chessState || chessState.over) return false;
  if (chessState.mode === 'practice') return true;
  return chessState.turn === 'w';
}
function chessClick(r, c) {
  if (!chessState || chessState.over || !chessHumanTurn()) return;
  var board = chessState.board, piece = board[r][c];
  if (chessState.selected) {
    var found = null;
    chessState.legal.forEach(function (m) {
      if (m.from[0] === chessState.selected[0] && m.from[1] === chessState.selected[1] && m.to[0] === r && m.to[1] === c) found = m;
    });
    if (found) { chessDoMove(found); return; }
  }
  if (piece && piece[0] === chessState.turn) {
    chessState.selected = [r, c];
    chessState.legal = chessLegalMoves(board, chessState.turn, chessState)
      .filter(function (m) { return m.from[0] === r && m.from[1] === c; });
  } else {
    chessState.selected = null; chessState.legal = [];
  }
  chessRender();
}
function chessDoMove(move) {
  var st = chessState; if (!st) return;
  var mover = st.turn;
  var captured = st.board[move.to[0]][move.to[1]];
  if (move.enPassant) captured = st.board[move.from[0]][move.to[1]];
  if (captured) {
    var glyph = captured[0] === 'w' ? CHESS_GLYPH[captured[1]] : CHESS_GLYPH_B[captured[1]];
    if (mover === 'w') st.capturedByWhite.push(glyph); else st.capturedByBlack.push(glyph);
  }
  chessUpdateCastling(st, move, captured);
  st.board = chessApplyToBoard(st.board, move, st);
  // En passant target: only a double pawn push creates one.
  if (st.board[move.to[0]][move.to[1]][1] === 'P' && Math.abs(move.to[0] - move.from[0]) === 2)
    st.enPassant = [(move.from[0] + move.to[0]) / 2, move.from[1]];
  else st.enPassant = null;
  st.selected = null; st.legal = [];
  st.lastMoveTo = move.to;
  st.turn = mover === 'w' ? 'b' : 'w';
  chessAfterMove(mover);
}
function chessAfterMove(mover) {
  var st = chessState; if (!st) return;
  chessRender();
  var oppMoves = chessLegalMoves(st.board, st.turn, st);
  var inChk = chessInCheck(st.board, st.turn);
  var turnName = st.mode === 'stake' ? (st.turn === 'w' ? 'Your turn (White)' : 'Computer (Black) thinking…')
    : (st.turn === 'w' ? 'White to move' : 'Black to move');
  if (oppMoves.length === 0) {
    if (inChk) { chessFinish(mover, 'checkmate'); return; }
    chessDrawStalemate(); return;
  }
  el('chessTurn').textContent = turnName + (inChk ? ' — CHECK!' : '');
  // chessStatus element was removed from the UI (see index.html); check/
  // win/draw state is already shown in chessTurn, so nothing is lost.
  if (st.mode === 'stake' && st.turn === 'b' && !st.over) setTimeout(chessComputerMove, 600);
}
function chessFinish(winnerColor, reason) {
  var st = chessState; if (!st) return;
  st.over = true;
  var winnerText = st.mode === 'stake' ? (winnerColor === 'w' ? 'You (White)' : 'Computer (Black)')
    : (winnerColor === 'w' ? 'White' : 'Black');
  el('chessTurn').textContent = '🏆 ' + winnerText + ' won by ' + reason + '!';
  if (st.mode === 'stake' && st.stakeActive) {
    settleStakeGame('Daba (Chess)', winnerColor === 'w');
    st.stakeActive = false;
  } else if (st.mode === 'practice') {
    recordPracticeGame('Daba (Chess)', winnerText);
  }
  el('chessStakeLabel').textContent = 'Match finished — start a new match to play again.';
  chessRender();
}
function chessDrawStalemate() {
  var st = chessState; if (!st) return;
  st.over = true;
  el('chessTurn').textContent = '🤝 Draw by stalemate.';
  if (st.mode === 'stake' && st.stakeActive) {
    // A draw has no winner, so the 10-coin entry is refunded and no commission is taken.
    var user = currentUser();
    if (user) {
      user.balance += 10;
      addHistory(user, { result: 'Stake match — DRAW', note: '+10 coins entry refunded (Daba stalemate, no commission)', change: 10 });
    }
    st.stakeActive = false; updateUserbar();
  } else if (st.mode === 'practice') {
    recordPracticeGame('Daba (Chess)', 'Draw (stalemate)');
  }
  el('chessStakeLabel').textContent = 'Match finished — start a new match to play again.';
  chessRender();
}
function chessComputerMove() {
  var st = chessState; if (!st || st.over || st.turn !== 'b') return;
  var moves = chessLegalMoves(st.board, 'b', st);
  if (!moves.length) return;
  var best = moves[0], bestScore = -1e9;
  moves.forEach(function (m) {
    var score = Math.random() * 2;
    var target = st.board[m.to[0]][m.to[1]];
    if (m.enPassant) target = 'bP';
    if (target) score += PIECE_VALUE[target[1]] * 10;
    if (m.promotion) score += 9;
    var nb = chessApplyToBoard(st.board, m, st);
    if (chessInCheck(nb, 'w')) score += 5;
    if (score > bestScore) { bestScore = score; best = m; }
  });
  chessDoMove(best);
}
function chessStart(mode) {
  var stakeActive = false;
  if (mode === 'stake') {
    if (!stakeStartForGame('Daba (Chess)')) return;
    stakeActive = true;
  }
  chessState = {
    board: chessInitialBoard(), turn: 'w', mode: mode, stakeActive: stakeActive,
    castling: { wK: true, wQ: true, bK: true, bQ: true }, enPassant: null,
    selected: null, legal: [], over: false, capturedByWhite: [], capturedByBlack: []
  };
  el('chessStakeLabel').textContent = mode === 'stake' ? 'Stake match — 10 coins paid, winner gets 15, commission 5' : 'No active stake';
  el('chessTurn').textContent = mode === 'stake' ? 'Stake match started — your turn (White).' : 'Practice started — White to move.';
  chessRender();
}
function chessReset() {
  chessState = null;
  el('chessStakeLabel').textContent = 'No active stake';
  el('chessTurn').textContent = 'Board cleared. Start a new match.';
  chessRender();
}

// ---------- Wire up navigation + new games ----------
document.addEventListener('DOMContentLoaded', function () {
  el('playLudoBtn').onclick = function () { if (!game) setLudoMatchActive(false); showView('ludoView'); };
  el('playChessBtn').onclick = function () { showView('chessView'); };
  el('backFromLudo').onclick = function () { showView('homeView'); };
  el('backFromChess').onclick = function () { showView('homeView'); };
  el('chessStakeBtn').onclick = function () { chessStart('stake'); };
  el('chessPracticeBtn').onclick = function () { chessStart('practice'); };
  el('chessResetBtn').onclick = chessReset;
  chessRender();
});
