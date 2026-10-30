# Gaming Arena — Ludo, Daba (Chess) & Bead 16-16 Guti — Virtual Coins Only

A static, no-build-step gaming site. No backend, no database, no payment
code, no real money, no cashout. Everything runs in the visitor's browser.
Open the site, choose a game from the home screen, and play.

## What is inside

- **Login / Signup** — saved in the browser's `localStorage`.
  A user can log out and log back in later on the same device/browser and
  keep their balance and match history. Nothing is deleted by logging out.
  New users start with **100 virtual coins**.
- **Admin panel** — visible only after admin login (see below).
  Admin can see all local users, their balances, match history,
  the total virtual commission earned across **all games**, and add/remove
  coins for a user.
- **Game-select home screen** — Ludo, Daba (Chess), and Bead 16-16 Guti.
- **Ultra-realistic, CSS-only UI** — wood-grain board frames, felt/leather
  textures, 3D tokens and pieces, and a 3D animated dice for Ludo, all made
  with layered gradients, highlights and shadows. No external images, so
  the site still works offline and on Vercel. Responsive on mobile and PC,
  with large controls on mobile.

## The games

### Ludo — Red vs Yellow, 4 tokens each
- Need a **6** to leave home.
- Move around the board, capture opponent tokens (except on safe ★ squares),
  exact roll to finish, win when all 4 tokens reach home.
- A 6 or a capture gives an extra roll.
- Restyled to match the new UI; the rules and stake logic are unchanged.

### Daba (Chess) — White vs Black
Full playable chess:
- Only legal moves are offered (click a piece, then a highlighted square).
- Check, checkmate, and stalemate are detected.
- Castling (kingside and queenside), en passant captures, and pawn
  promotion (automatic to queen) are supported.
- You play White in a stake match; the computer plays Black.
- Computer AI: a simple opponent that prefers captures and giving check,
  otherwise picks a legal move at random.

### Bead 16-16 Guti — Red vs Blue, 16 beads each
A traditional-style bead capture game, in simple words:
1. **Placement:** take turns putting one bead on any empty point of the
   7×7 board. Each side places **16 beads**. Red places first.
2. **Movement:** after all beads are placed, take turns moving one bead
   one step to a neighbouring empty point — sideways, up/down, or diagonally.
3. **Capture by jumping:** jump straight over a neighbouring opponent bead
   (sideways, up/down, or diagonally) and land on the empty point just
   behind it. That opponent bead is removed. One jump per turn.
4. **Win:** capture all of your opponent's beads, or leave them with no
   legal move.
- You play Red in a stake match; the computer plays Blue.
- Computer AI: prefers a capturing jump, otherwise places/moves at random.
- The same rules are shown inside the Guti game screen.

#### Guti rule simplifications (please read)
This is a **simplified, playable version** of a traditional-style bead
game, **not an official tournament rulebook**:
- The board is a 7×7 grid of points (49 points, 32 beads placed).
- Only one jump per turn — no multi-jump chains.
- No forced-capture rule (you may move instead of capturing).
- No safe points and no special "home" or "mill" rules.
- A player who cannot move on their turn loses.

## Stake matches — the same system in every game

- **Stake match vs Computer** — entry **10 coins** deducted when the match starts.
  Winner gets **15 coins** credited, **5 coins** go to system commission
  (10 + 10 = 20 pot). If you lose, your 10 coins are lost.
  You cannot start a stake match with less than 10 coins.
  Restarting a board mid-match does **not** refund a stake already paid.
- **Practice match** — 2-player pass-and-play on the same device, no stake,
  no coins change.
- The admin panel's total commission counts completed stake matches from
  Ludo, Daba, and Guti together.
- One exception: a Daba match drawn by stalemate has no winner, so the
  10-coin entry is refunded and no commission is taken.

## Demo logins

- **Admin (demo only):** username `admin`, password `admin123`
- **Players:** sign up with any username/password of your choice.
  You start with 100 virtual coins.

> **Change the demo admin login before any public use.**
> Search `app.js` for `admin123` and change it, and remember this prototype
> stores passwords in plain text in the browser — do not use a real password
> here, and do not use this prototype for real money in any form.

## How to push to GitHub, then deploy on Vercel

You need a GitHub account and a Vercel account. No build command and
no environment variables are needed.

### 1. Push this folder to a new GitHub repo

From inside this folder (`ludo-gaming-site`), in a terminal:

```bash
git init
git add .
git commit -m "Gaming arena - virtual coins only"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

Replace `YOUR-USERNAME` and `YOUR-REPO-NAME` with your own.
If you already created the repo on GitHub, use its URL instead.
If Git asks you to sign in, sign in with your GitHub account.

### 2. Import it in Vercel and deploy

1. Go to https://vercel.com and sign in.
2. Click **Add New → Project**, then **Import** the GitHub repo you just pushed.
3. Leave the settings as they are:
   - **Framework Preset:** Other (or leave blank — this is plain HTML/CSS/JS)
   - **Build Command:** leave empty / none
   - **Output Directory:** leave empty / none
   - **Install Command:** leave empty / none
   - **Environment Variables:** none needed
4. Click **Deploy**.
5. Vercel will give you a public link, for example
   `https://your-repo-name.vercel.app`. Share that link to play.

To update the site later: edit the files, then run
`git add .`, `git commit -m "update"`, `git push` — Vercel redeploys automatically.

You can also test it locally without GitHub or Vercel, for example:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open http://localhost:8000 (or the port shown).

## Important limitation — please read this

**localStorage login is per-browser only.**

- An account created in Chrome on one phone will **not** appear in another
  phone, another browser, or after clearing that browser's site data.
- The admin panel likewise only sees users created in that same browser.
- This version is a **deployable prototype** to test the login, admin,
  balance, stake maths and gameplay.

For shared accounts across different devices — where any user can log in
from any phone and see the same balance — you need a database and a real
backend (for example a hosted app with user accounts stored on a server).
That is the next step after this prototype, not something this static
folder can do on its own.

## Files

- `index.html` — page structure, game-select home, login/signup, admin panel, all three game boards, dice
- `styles.css` — ultra-realistic CSS-only design: wood-grain frames, felt/leather gradients, 3D tokens and pieces, 3D dice, responsive layout
- `app.js` — login, admin, balance, stake system, Ludo rules, Daba (chess) rules + computer opponent, Guti rules + computer opponent
- `vercel.json` — static Vercel config (no build step)
- `.gitignore` — ignores OS files, `node_modules/`, logs

## Virtual coins only

Coins here are game points. They have no taka value, cannot be deposited
with real money, and cannot be cashed out. Do not add payment code to
this prototype.
