# EU-ALign Christmas game

Online "Who said it?" quiz for the EU-ALign end-of-year event: Wednesday 9 December 2026, 18:30 to 23:00, Son de la Terre by Artflux, 15 Quai de Montebello, 75005 Paris. About 100 colleagues play on their own phones after scanning a QR code; the scoreboard is projected on a computer.

The owner is not a developer. Explain things in plain language, one step at a time, and run commands yourself whenever you can instead of asking her to. Ask before anything that changes the live game or costs money.

## How the game works
- One file, `docs/index.html` (HTML, CSS and JavaScript, Firebase loaded from a CDN). No build step.
- Three views, chosen by the address: `/` players, `/?v=board` projector scoreboard (QR code in the corner), `/?v=host` host panel (PIN in `HOST_PIN`; the repo is public, so never write the PIN in docs).
- Free play: each player answers at their own pace, in their own shuffled order, up to `MAX_QUESTIONS` (20) picked at random from the list, and never gets their own fun fact. 100 points per right answer, up to 50 more for speed (fades over 15 s), plus a streak bonus (+25 from 3 in a row, +50 from 5, +100 from 10). Ranking is live; the host can show a winners podium (it also closes the game).
- If Firebase refuses a connection because the plan's limit is reached, players see a "come back in 30 minutes" message and the page tries again every minute. Their score and progress are kept.
- Host panel: paste the Google Sheet (Name, Surname, Coming, Fun Fact; only "Coming" guests count), build the questions, close/reopen, show the winners, erase players.
- Look: taken from the event poster (near-black, gold glitter, Playfair Display + Montserrat). Colours are tokens at the top of the CSS. The logo is embedded in `LOGO`.

## Firebase
- Project `eu-align-christmas-game`, Realtime Database in europe-west1. The page is NOT on Firebase Hosting: it is served by GitHub Pages from the `main` branch, `/docs` folder, at `https://<github-user>.github.io/eu-align-game/`. Firebase is used only for the database.
- The web config in `index.html` is public by design (it only identifies the project). Access is controlled by `database.rules.json`.
- Data: `game` = `{questions: [{f, o: [4 names], a}], guests: [names], open, podium}`; `players/<id>` = `{name, score, n, c, streak, own, t}`.

## The database rules (`database.rules.json`)
- Everything locks itself on 11 Dec 2026 00:00 Paris time (timestamp `1796943600000`, in both rules files). Change it in both if the event moves.
- A player may only join with score 0, then add one answer at a time: n +1, score +250 at most, never down, at least 800 ms apart (server time), name and `own` frozen, no unknown fields. `game` accepts only well-formed questions and boolean `open`/`podium`.
- Honest limits: there are no user accounts, so anyone who can open the page can still use the host panel (the PIN is visible in the page source), and a determined person could cheat within these bounds. Fine for a company party. `database.rules.open.json` is an emergency fallback that only has the time limit.
- If you change what a player record contains, the scoring constants (`POINTS`, `SPEED_MAX`, `streakBonus`, `MAX_QUESTIONS`), or the answer flow, update the rules and `rehearsal/rehearsal.mjs` together, then run the rehearsal.

## Commands
- First publish: `gh auth login` (browser sign-in is hers), then `gh repo create eu-align-game --public --source=. --push`, then `gh api -X POST repos/<owner>/eu-align-game/pages -f "source[branch]=main" -f "source[path]=/docs"`. The site appears 1 to 2 minutes later; browsers may cache it up to about 10 minutes.
- Update the site: commit and `git push`; Pages redeploys by itself. Avoid last-minute edits because of the cache.
- Database rules only: `firebase deploy --only database` (first time: `firebase login`).
- Preview locally: `cd docs && python3 -m http.server 8000`, then open http://localhost:8000. It talks to the REAL database, so erase test players afterwards.
- Rehearsal (before the event only, it erases all players when done and refuses to run if real players exist): `cd rehearsal && npm install && node rehearsal.mjs`. Options are listed at the top of the file. Use `--rules` for a 10-second check of the rules.
- Custom domain (optional, she must buy it): add `docs/CNAME` with the domain, set it in Settings → Pages, and give her the DNS records to enter at her registrar.

## Before the event
1. Upgrade the Firebase project to the Blaze plan. The free Spark plan allows only 100 simultaneous connections in total (players, projector and host all count). Usage for this event is tiny, far inside the free monthly quotas. Set a budget alert in Google Cloud Billing.
2. `firebase deploy --only database`, make sure the Pages site is live, then run the full rehearsal.
3. Open the host panel, paste the real sheet, build the questions, play a round on a real phone, then "Erase players and scores".
4. On the day: open `/?v=board` on the projector in full screen; show the QR code; at the end press "Show the winners".

## Rules of the road
- Keep it one file with no build step; the owner edits and re-uploads it by hand if needed.
- Respect reduced-motion; keep text readable on small phones (test at 360 px wide) and on a projector.
- Never commit secrets or the guest spreadsheet (the repo is public; the Firebase web config is public by design); don't add tracking or analytics.
- After any change to `index.html`, check the script parses, play a round in a browser, and run `node rehearsal/rehearsal.mjs --rules`.
