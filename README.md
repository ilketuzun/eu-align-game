# EU-ALign game: start here

This folder is the whole game. The page lives in `docs/index.html` and is published for free with **GitHub Pages**. The database (scores, questions) stays in Firebase.

## Put it online (no developer skills needed)
1. Create a free account on github.com.
2. Click **New repository**. Name it `eu-align-game`, choose **Public**, and create it.
3. Click **uploading an existing file**, drag in everything from this unzipped folder (the `docs` folder with `index.html` is the essential part), and click **Commit changes**.
4. Open **Settings → Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch `main`, folder `/docs`, then **Save**. (If there is no `/docs` option, upload `index.html` into the repository root and choose `/ (root)`.)
5. Wait 1 to 2 minutes. Your game is at `https://YOUR-USERNAME.github.io/eu-align-game/`
   - players: that address
   - projector: add `?v=board`
   - host panel: add `?v=host`

To update the game later, replace `docs/index.html` in the repository (Add file → Upload files). Changes take 1 to 10 minutes to show because of caching, so do not edit at the last minute.

## With Claude Code (optional)
Open this folder in Claude Code (it reads `CLAUDE.md` by itself) and paste:

> Create a public GitHub repository called eu-align-game from this folder, turn on GitHub Pages from the main branch /docs folder, and deploy the database rules to Firebase. I'm not a developer, so tell me in plain language when I need to click something in the browser. Then run the rehearsal and tell me if anything failed.

## Before the event: do not skip this
The free Firebase plan allows only **100 simultaneous connections** in total, and each player, the projector and your host panel each use one. With about 100 guests you need the **Blaze** plan (pay as you go). This event's usage is tiny and stays inside the free monthly quotas, but set a budget alert too. In the Firebase console, click "Upgrade" next to the plan name at the bottom of the left menu.

## Good to know
- The repository is public (required for free GitHub Pages), so the code is visible, including the host PIN. Change `HOST_PIN` in `docs/index.html` to something you like before publishing.
- A custom domain (like `quiz.yourcompany.com`) is optional. You would have to buy it; once you have, GitHub Pages can use it (Settings → Pages → Custom domain) and Claude Code can walk you through the DNS settings.
- Never put the guest spreadsheet in the repository. You paste it in the host panel on the day.

## Event-day checklist
1. Host panel (`?v=host`): paste your Google Sheet, press "Build the questions".
2. Play one round on your phone, then press "Erase players and scores".
3. Projector: open `?v=board` in full screen. The QR code is in the corner.
4. At the end: press "Show the winners".

## What's in this folder
- `docs/index.html`: the game (one file). `docs/.nojekyll` tells GitHub to serve it as is.
- `database.rules.json`: who can write what in the database (locks itself on 11 December 2026). Deploy with `firebase deploy --only database`, or paste it in the Firebase console (Realtime Database → Rules).
- `database.rules.open.json`: emergency fallback with only the time limit.
- `firebase.json`, `.firebaserc`: Firebase settings (database rules and local emulator only; no Firebase Hosting).
- `rehearsal/`: the 100-player test.
- `CLAUDE.md`: notes for Claude Code.
