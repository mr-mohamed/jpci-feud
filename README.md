# JPCI Teachers Family Feud – game files

Two screens, one game:
- **host.html**  – the control computer (reveal answers, strikes, scores, Fast Money, game editor)
- **board.html** – the projector / big screen
- **index.html** – start page with buttons for both

## Put it online (GitHub Pages – free)
1. Create a GitHub account → **New repository** (e.g. `jpci-feud`, Public).
2. **Add file → Upload files**: drag in EVERYTHING from this folder (index.html, host.html, board.html,
   feud.js, logo.png, game.json, and the whole `sounds` folder). Commit.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save.**
4. After ~1 minute your game is at `https://YOUR-USERNAME.github.io/jpci-feud/`

Google Sites cannot host these files itself. You can put a button/link on a Google Site that points to the
GitHub Pages address above (open it in its own tab so sound and fullscreen work).

## Game day
1. Host computer: open `…/host.html`. A 4-letter **room code** shows at the top.
2. Board computer: open `…/board.html`, type the code (or use the host's “Copy board link”).
3. Click once on the board page (turns on sound), press **F** for fullscreen. The dot at the bottom turns green when connected.
4. Run the game from the host page. Keys: **1–9** reveal an answer, **X** strike.

If the school network blocks the connection between computers, use the host's **“Open board in this computer”**
button and drag that second window onto the projector (works with no internet at all).

## Offline (no internet) – two PCs
1. Install Python 3 on the host PC (python.org). Both PCs must be on the same network (same router/Wi-Fi, or a cable between them).
2. Host PC: double-click `start-offline.bat` (Mac: `start-offline.command`). It prints two addresses.
3. Host PC: open `http://localhost:8000/host.html`. Board PC: open the printed `http://<host-ip>:8000/board.html`. No room code needed.
4. If Windows asks about the firewall, allow Python on private networks.

**One PC:** open `host.html`, click “Open board in this computer”, drag that window to the projector. Works fully offline, even straight from the files.

## Board & host extras
- The board always has 8 answer slots (empty ones stay blank) and Fast Money has 5 rows, so it never resizes. The editor caps at 8 answers / 5 Fast Money questions.
- Round total is above the board, team scores are in the bottom corners, strikes sit between them.
- Fast Money: answers type out letter by letter; points reveal plays a ding, or the buzzer for 0.
- Fast Money Player 2: **🔁 Repeat beep** plays a double beep (it turns red when the answer matches Player 1's).
- **Hide Player 1 answers on board** turns on automatically when you select Player 2; only the running total stays visible. Click it again to show them.
- Keep answers to about 20 characters; longer ones shrink to fit.
- Host button **🔉 Fade out music** fades intro/round/win music on the board.
- Fast Money reveals use `sounds/fm-reveal.mp3`. Strikes use `strike-x.png`.

## Changing questions
Host page → **✎ Edit game**. Add/remove/reorder rounds, answers, points, multipliers and Fast Money questions.
“Scale points to 100” fixes the totals. Import/export uses the same JSON format as famf.app.
Edits are saved in that browser (use **Download .json** to keep a copy / move to another computer).
To change the built-in starter game for everyone, replace the game inside `feud.js` (or load game.json in the editor).

## Sounds
`sounds/intro.mp3` (title screen / “Play intro music”), `round-start.mp3` (each new round / Fast Money),
`good-answer.mp3` (answer reveals), `fm-reveal.mp3` (Fast Money answers), `fm-repeat.mp3` (Fast Money repeated answer), `wrong-buzzer.mp3` (strikes and timer end),
`win.mp3` (bank awarded and 200+ Fast Money / final scores). Swap any file with the same name to change it.
