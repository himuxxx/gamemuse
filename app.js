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
// Main 52-square loop, clockwise, starting at the Red start square (6,1).
var PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]
];
// Absolute indices that are safe (start squares + classic star squares).
var SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
var START = [0, 26]; // Red starts at PATH[0], Yellow at PATH[26]
// Home columns: 5 coloured squares, then the centre (finished).
var HOME = [
  [[7,1],[7,2],[7,3],[7,4],[7,5]],
  [[7,13],[7,12],[7,11],[7,10],[7,9]]
];
var YARD = [
  [[1,1],[1,4],[4,1],[4,4]],       // Red yard (top-left)
  [[10,10],[10,13],[13,10],[13,13]] // Yellow yard (bottom-right)
];
var PLAYER_NAMES = ['Red', 'Yellow'];
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
  m.className = 'message' + (isError ? ' error' : '');
}
function updateUserbar() {
  var s = getSession(), info = el('userInfo'), badge = el('balanceBadge'), logout = el('logoutBtn');
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
  if (r < 6 && c < 6) return 'cell red';
  if (r > 8 && c > 8) return 'cell yellow';
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return 'cell center';
  if (r === 7 && c >= 1 && c <= 5) return 'cell red-home';
  if (r === 7 && c >= 9 && c <= 13) return 'cell yellow-home';
  for (var i = 0; i < PATH.length; i++) {
    if (PATH[i][0] === r && PATH[i][1] === c) {
      if (r === 6 && c === 1) return 'cell red';
      if (r === 8 && c === 13) return 'cell yellow';
      return 'cell' + (SAFE.indexOf(i) >= 0 ? ' safe' : '');
    }
  }
  return 'cell';
}
function renderBoard() {
  var board = el('board'); board.innerHTML = '';
  for (var r = 0; r < 15; r++) {
    for (var c = 0; c < 15; c++) {
      var d = document.createElement('div');
      d.className = cellClass(r, c);
      var idx = -1;
      for (var i = 0; i < PATH.length; i++) if (PATH[i][0] === r && PATH[i][1] === c) idx = i;
      if (idx >= 0 && SAFE.indexOf(idx) >= 0) d.textContent = '★';
      if (r === 7 && c === 7) d.textContent = '🏠';
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
  for (var pl = 0; pl < 2; pl++) {
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
      var humanTurn = game.mode === 'practice' || game.turn === 0;
      var movable = humanTurn && game.rolled && game.turn === item.pl && canMove(item.pl, item.t, game.dice);
      d.className = 'token ' + (item.pl === 0 ? 'red' : 'yellow') + (movable ? ' movable' : '') +
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

// ---------- Game flow ----------
function startGame(mode) {
  if (mode === 'stake') {
    var user = currentUser();
    if (!user) { showMsg('Log in first to play a stake match.', true); return; }
    if (user.balance < 10) { showMsg('Not enough coins for a stake match. You need at least 10 coins.', true); return; }
    user.balance -= 10;
    addHistory(user, { result: 'Stake match started', note: '-10 coins entry vs Computer', change: -10 });
    // addHistory already saved the user; refresh the local copy.
    user = currentUser();
  }
  game = {
    mode: mode,
    players: [{ tokens: [-1, -1, -1, -1] }, { tokens: [-1, -1, -1, -1] }],
    turn: 0, dice: null, rolled: false
  };
  el('rollBtn').disabled = false;
  renderTokens(); updateStakeLabel(); updateUserbar();
  setTurnLabel(mode === 'stake' ? 'Stake match started — Red (you) to roll.' : 'Practice started — Red (Player 1) to roll.');
  el('gameMessage').textContent = 'Roll the dice. A 6 lets a token leave home, and also gives an extra roll.';
  if (mode === 'stake') showMsg('Stake match started: 10 coins deducted. Winner gets 15 coins, 5 coins go to system commission.', false);
}
function rollDice() {
  if (!game || game.rolled) return;
  if (game.mode === 'stake' && game.turn === 1) return; // computer rolls itself
  var diceEl = el('dice');
  diceEl.classList.remove('rolling'); void diceEl.offsetWidth; diceEl.classList.add('rolling');
  var value = Math.floor(Math.random() * 6) + 1;
  setTimeout(function () {
    if (!game) return;
    game.dice = value; game.rolled = true;
    diceEl.className = 'dice show-' + value;
    var moves = movableTokens(game.turn, value);
    if (moves.length === 0) {
      setTurnLabel(PLAYER_NAMES[game.turn] + ' rolled ' + value + ' — no move possible. Turn passes.');
      renderTokens();
      setTimeout(function () { if (game) { game.rolled = false; game.turn = 1 - game.turn; afterTurnChange(); } }, 900);
    } else {
      setTurnLabel(PLAYER_NAMES[game.turn] + ' rolled ' + value + ' — click a highlighted token to move it.');
      renderTokens();
      if (game.mode === 'stake' && game.turn === 1) setTimeout(computerMove, 700);
    }
  }, 450);
}
function afterTurnChange() {
  if (!game) return;
  setTurnLabel(PLAYER_NAMES[game.turn] + ' to roll.');
  el('rollBtn').disabled = (game.mode === 'stake' && game.turn === 1);
  renderTokens();
  if (game.mode === 'stake' && game.turn === 1) setTimeout(function () { if (game) rollDiceComputer(); }, 600);
}
function rollDiceComputer() {
  if (!game || game.rolled || game.turn !== 1) return;
  var diceEl = el('dice');
  diceEl.classList.remove('rolling'); void diceEl.offsetWidth; diceEl.classList.add('rolling');
  var value = Math.floor(Math.random() * 6) + 1;
  setTimeout(function () {
    if (!game) return;
    game.dice = value; game.rolled = true;
    diceEl.className = 'dice show-' + value;
    var moves = movableTokens(1, value);
    if (moves.length === 0) {
      setTurnLabel('Computer rolled ' + value + ' — no move. Your turn.');
      setTimeout(function () { if (game) { game.rolled = false; game.turn = 0; afterTurnChange(); } }, 900);
    } else {
      setTurnLabel('Computer rolled ' + value + '.');
      renderTokens();
      setTimeout(computerMove, 700);
    }
  }, 450);
}
function computerMove() {
  if (!game || !game.rolled || game.turn !== 1) return;
  var moves = movableTokens(1, game.dice);
  if (!moves.length) return;
  // Simple AI, in priority order: finish > capture > leave home > move furthest.
  var best = moves[0], bestScore = -1;
  moves.forEach(function (t) {
    var p = game.players[1].tokens[t];
    var score = 0;
    var next = p === -1 ? 0 : p + game.dice;
    if (next === 56) score += 100;
    if (next <= 50) {
      var abs = absoluteIndex(1, next);
      if (SAFE.indexOf(abs) < 0) {
        for (var i = 0; i < 4; i++) {
          var op = game.players[0].tokens[i];
          if (op >= 0 && op <= 50 && absoluteIndex(0, op) === abs) score += 50;
        }
      }
    }
    if (p === -1) score += 20;
    score += next;
    if (score > bestScore) { bestScore = score; best = t; }
  });
  doMove(1, best);
}
function doMove(player, tokenIdx) {
  if (!game || !game.rolled || game.turn !== player) return;
  if (!canMove(player, tokenIdx, game.dice)) return;
  var p = game.players[player].tokens[tokenIdx];
  var next = p === -1 ? 0 : p + game.dice;
  var captured = false;
  if (next <= 50) {
    var abs = absoluteIndex(player, next);
    if (SAFE.indexOf(abs) < 0) {
      var opp = 1 - player;
      for (var i = 0; i < 4; i++) {
        var op = game.players[opp].tokens[i];
        if (op >= 0 && op <= 50 && absoluteIndex(opp, op) === abs) {
          game.players[opp].tokens[i] = -1; captured = true;
        }
      }
    }
  }
  game.players[player].tokens[tokenIdx] = next;
  renderTokens();
  var finished = game.players[player].tokens.every(function (v) { return v === 56; });
  if (finished) { finishGame(player); return; }
  var extra = game.dice === 6 || captured;
  setTurnLabel(PLAYER_NAMES[player] + ' moved token ' + (tokenIdx + 1) + (captured ? ' and captured an opponent!' : '') + (extra ? ' Extra roll.' : ''));
  game.rolled = false;
  if (!extra) game.turn = 1 - player;
  afterTurnChange();
}
function finishGame(winner) {
  var mode = game.mode;
  var winnerName = mode === 'stake' ? (winner === 0 ? 'You (Red)' : 'Computer (Yellow)') : PLAYER_NAMES[winner];
  setTurnLabel('🏆 ' + winnerName + ' won!');
  el('gameMessage').textContent = winnerName + ' brought all 4 tokens home first.';
  el('rollBtn').disabled = true;
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
  el('stakeBtn').onclick = function () { startGame('stake'); };
  el('practiceBtn').onclick = function () { startGame('practice'); };
  el('resetBtn').onclick = function () {
    if (game && game.mode === 'stake') {
      el('gameMessage').textContent = 'Board restarted. Note: a stake entry already paid is not refunded by restarting.';
    }
    game = null; el('rollBtn').disabled = true; renderTokens(); updateStakeLabel();
    setTurnLabel('Board cleared. Start a new match.');
  };
  el('rollBtn').onclick = rollDice;
  el('dice').className = 'dice show-1';
  updateUserbar();
});

/* =====================================================================
   Added in the ultra upgrade: game-select navigation, Daba (chess) and
   Bead 16-16 Guti. The original Ludo, login, admin and coin code above
   is untouched. All stake matches share: entry 10, winner 15,
   commission 5, blocked below 10, no refund on mid-match restart.
   ===================================================================== */

// ---------- Shared stake helpers (Chess / Guti) ----------
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
  ['homeView', 'ludoView', 'chessView', 'gutiView'].forEach(function (v) { el(v).hidden = (v !== id); });
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
  el('chessStatus').textContent = inChk ? 'Check! The side to move must get out of check.'
    : 'Click a piece of the side to move to see its legal moves, then click a highlighted square.';
  if (st.mode === 'stake' && st.turn === 'b' && !st.over) setTimeout(chessComputerMove, 600);
}
function chessFinish(winnerColor, reason) {
  var st = chessState; if (!st) return;
  st.over = true;
  var winnerText = st.mode === 'stake' ? (winnerColor === 'w' ? 'You (White)' : 'Computer (Black)')
    : (winnerColor === 'w' ? 'White' : 'Black');
  el('chessTurn').textContent = '🏆 ' + winnerText + ' won by ' + reason + '!';
  el('chessStatus').textContent = winnerText + ' won by ' + reason + '. Start a new match to play again.';
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
  el('chessStatus').textContent = 'Stalemate — no legal move and not in check, so the game is a draw.';
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
  el('chessStatus').textContent = 'Click a White piece to see its legal moves, then click a highlighted square.';
  chessRender();
}
function chessReset() {
  if (chessState && chessState.stakeActive)
    el('chessStatus').textContent = 'Board restarted. Note: a stake entry already paid is not refunded by restarting.';
  chessState = null;
  el('chessStakeLabel').textContent = 'No active stake';
  el('chessTurn').textContent = 'Board cleared. Start a new match.';
  chessRender();
}

// =====================================================================
// BEAD 16-16 GUTI (simplified traditional-style version — see README)
// 7x7 points. Placement: 16 beads each, alternating. Movement: one step
// to a neighbouring empty point (8 directions). Capture: one jump over a
// neighbouring opponent bead to the empty point behind it, per turn.
// =====================================================================
var GUTI_DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
var gutiState = null;
function gutiCount(color) {
  var n = 0;
  if (!gutiState) return 0;
  for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) if (gutiState.grid[r][c] === color) n++;
  return n;
}
function gutiInBounds(r, c) { return r >= 0 && r < 7 && c >= 0 && c < 7; }
function gutiMovesFrom(grid, r, c) {
  var color = grid[r][c]; if (!color) return [];
  var opp = color === 'R' ? 'B' : 'R', out = [];
  GUTI_DIRS.forEach(function (d) {
    var r1 = r + d[0], c1 = c + d[1];
    if (!gutiInBounds(r1, c1)) return;
    if (!grid[r1][c1]) out.push({ to: [r1, c1], capture: null });
    else if (grid[r1][c1] === opp) {
      var r2 = r + 2 * d[0], c2 = c + 2 * d[1];
      if (gutiInBounds(r2, c2) && !grid[r2][c2]) out.push({ to: [r2, c2], capture: [r1, c1] });
    }
  });
  return out;
}
function gutiHasMove(grid, color) {
  for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++)
    if (grid[r][c] === color && gutiMovesFrom(grid, r, c).length) return true;
  return false;
}
function gutiRender() {
  var wrap = el('gutiBoard'); wrap.innerHTML = '';
  var grid = gutiState ? gutiState.grid : null;
  var legalMap = {};
  if (gutiState && gutiState.selected) {
    gutiState.legal.forEach(function (m) { legalMap[m.to[0] + ',' + m.to[1]] = m; });
  }
  for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) {
    (function (r, c) {
      var d = document.createElement('div');
      d.className = 'guti-point';
      if (gutiState && gutiState.selected && gutiState.selected[0] === r && gutiState.selected[1] === c) d.className += ' selected';
      if (legalMap[r + ',' + c]) d.className += ' legal';
      if (grid && grid[r][c]) {
        var b = document.createElement('div');
        b.className = 'guti-bead ' + (grid[r][c] === 'R' ? 'red' : 'blue');
        d.appendChild(b);
      }
      d.onclick = function () { gutiClick(r, c); };
      wrap.appendChild(d);
    })(r, c);
  }
  if (gutiState) {
    el('gutiCaptured').textContent = 'Red: ' + gutiCount('R') + ' beads on board · Blue: ' + gutiCount('B') +
      ' beads on board · Captured — Red took ' + gutiState.capturedByR + ', Blue took ' + gutiState.capturedByB;
    el('gutiPhase').textContent = 'Phase: ' + (gutiState.phase === 'place'
      ? 'Placement — Red placed ' + gutiState.placed.R + '/16, Blue placed ' + gutiState.placed.B + '/16'
      : 'Movement & capture');
  }
}
function gutiHumanTurn() {
  if (!gutiState || gutiState.over) return false;
  if (gutiState.mode === 'practice') return true;
  return gutiState.turn === 'R';
}
function gutiClick(r, c) {
  if (!gutiState || gutiState.over || !gutiHumanTurn()) return;
  var st = gutiState;
  if (st.phase === 'place') {
    if (st.grid[r][c]) return;
    gutiPlace(st.turn, r, c);
    return;
  }
  if (st.selected) {
    var found = null;
    st.legal.forEach(function (m) {
      if (m.to[0] === r && m.to[1] === c) found = m;
    });
    if (found) { gutiDoMove(found); return; }
  }
  if (st.grid[r][c] === st.turn) {
    st.selected = [r, c];
    st.legal = gutiMovesFrom(st.grid, r, c);
  } else { st.selected = null; st.legal = []; }
  gutiRender();
}
function gutiPlace(color, r, c) {
  var st = gutiState; if (!st || st.grid[r][c]) return;
  st.grid[r][c] = color; st.placed[color]++;
  if (st.placed.R >= 16 && st.placed.B >= 16) {
    st.phase = 'move'; st.turn = 'R';
    el('gutiStatus').textContent = 'All beads placed! Movement phase: click your bead, then a highlighted point. Jump over an opponent bead to capture it.';
  } else {
    st.turn = color === 'R' ? 'B' : 'R';
  }
  gutiAfterPlacementOrMove();
}
function gutiDoMove(move) {
  var st = gutiState; if (!st || !st.selected) return;
  var mover = st.turn, from = st.selected;
  st.grid[from[0]][from[1]] = null;
  st.grid[move.to[0]][move.to[1]] = mover;
  if (move.capture) {
    st.grid[move.capture[0]][move.capture[1]] = null;
    if (mover === 'R') st.capturedByR++; else st.capturedByB++;
  }
  st.selected = null; st.legal = [];
  var opp = mover === 'R' ? 'B' : 'R';
  if (gutiCount(opp) === 0) { gutiFinish(mover); return; }
  st.turn = opp;
  gutiAfterPlacementOrMove();
}
function gutiAfterPlacementOrMove() {
  var st = gutiState; if (!st) return;
  gutiRender();
  if (st.over) return;
  var turnName = st.mode === 'stake' ? (st.turn === 'R' ? 'Your turn (Red)' : 'Computer (Blue) thinking…')
    : (st.turn === 'R' ? 'Red to move' : 'Blue to move');
  if (st.phase === 'move' && !gutiHasMove(st.grid, st.turn)) {
    gutiFinish(st.turn === 'R' ? 'B' : 'R');
    return;
  }
  el('gutiTurn').textContent = (st.phase === 'place' ? 'Placement — ' : 'Movement — ') + turnName + '.';
  if (st.mode === 'stake' && st.turn === 'B' && !st.over) setTimeout(gutiComputerMove, 600);
}
function gutiFinish(winnerColor) {
  var st = gutiState; if (!st) return;
  st.over = true; gutiRender();
  var winnerText = st.mode === 'stake' ? (winnerColor === 'R' ? 'You (Red)' : 'Computer (Blue)')
    : (winnerColor === 'R' ? 'Red' : 'Blue');
  el('gutiTurn').textContent = '🏆 ' + winnerText + ' won!';
  el('gutiStatus').textContent = winnerText + ' won the Guti match. Start a new match to play again.';
  if (st.mode === 'stake' && st.stakeActive) {
    settleStakeGame('Bead 16-16 Guti', winnerColor === 'R');
    st.stakeActive = false;
  } else if (st.mode === 'practice') {
    recordPracticeGame('Bead 16-16 Guti', winnerText);
  }
  el('gutiStakeLabel').textContent = 'Match finished — start a new match to play again.';
}
function gutiComputerMove() {
  var st = gutiState; if (!st || st.over || st.turn !== 'B') return;
  if (st.phase === 'place') {
    var empties = [];
    for (var r = 0; r < 7; r++) for (var c = 0; c < 7; c++) if (!st.grid[r][c]) empties.push([r, c]);
    if (!empties.length) return;
    var pick = empties[Math.floor(Math.random() * empties.length)];
    gutiPlace('B', pick[0], pick[1]);
    return;
  }
  // Prefer a capture, otherwise a random legal move.
  var options = [];
  for (var rr = 0; rr < 7; rr++) for (var cc = 0; cc < 7; cc++) {
    if (st.grid[rr][cc] === 'B') {
      gutiMovesFrom(st.grid, rr, cc).forEach(function (m) { options.push({ from: [rr, cc], move: m }); });
    }
  }
  if (!options.length) return;
  var captures = options.filter(function (o) { return o.move.capture; });
  var chosen = (captures.length ? captures : options)[Math.floor(Math.random() * (captures.length ? captures.length : options.length))];
  st.selected = chosen.from; st.legal = [chosen.move];
  gutiDoMove(chosen.move);
}
function gutiStart(mode) {
  var stakeActive = false;
  if (mode === 'stake') {
    if (!stakeStartForGame('Bead 16-16 Guti')) return;
    stakeActive = true;
  }
  gutiState = {
    grid: (function () { var g = []; for (var i = 0; i < 7; i++) g.push([null, null, null, null, null, null, null]); return g; })(),
    phase: 'place', placed: { R: 0, B: 0 }, turn: 'R', mode: mode, stakeActive: stakeActive,
    selected: null, legal: [], over: false, capturedByR: 0, capturedByB: 0
  };
  el('gutiStakeLabel').textContent = mode === 'stake' ? 'Stake match — 10 coins paid, winner gets 15, commission 5' : 'No active stake';
  el('gutiTurn').textContent = mode === 'stake' ? 'Stake match started — placement, your turn (Red).' : 'Practice started — placement, Red to place.';
  el('gutiStatus').textContent = 'Placement: click an empty point to place a bead. Each side places 16 beads.';
  gutiRender();
}
function gutiReset() {
  if (gutiState && gutiState.stakeActive)
    el('gutiStatus').textContent = 'Board restarted. Note: a stake entry already paid is not refunded by restarting.';
  gutiState = null;
  el('gutiStakeLabel').textContent = 'No active stake';
  el('gutiTurn').textContent = 'Board cleared. Start a new match.';
  el('gutiPhase').textContent = 'Phase: —';
  gutiRender();
}

// ---------- Wire up navigation + new games ----------
document.addEventListener('DOMContentLoaded', function () {
  el('playLudoBtn').onclick = function () { showView('ludoView'); };
  el('playChessBtn').onclick = function () { showView('chessView'); };
  el('playGutiBtn').onclick = function () { showView('gutiView'); };
  el('backFromLudo').onclick = function () { showView('homeView'); };
  el('backFromChess').onclick = function () { showView('homeView'); };
  el('backFromGuti').onclick = function () { showView('homeView'); };
  el('chessStakeBtn').onclick = function () { chessStart('stake'); };
  el('chessPracticeBtn').onclick = function () { chessStart('practice'); };
  el('chessResetBtn').onclick = chessReset;
  el('gutiStakeBtn').onclick = function () { gutiStart('stake'); };
  el('gutiPracticeBtn').onclick = function () { gutiStart('practice'); };
  el('gutiResetBtn').onclick = gutiReset;
  chessRender();
  gutiRender();
});
