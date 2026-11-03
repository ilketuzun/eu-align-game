// Rehearsal for the EU-ALign game: checks the database rules and simulates many phones.
//
//   node rehearsal.mjs                 rules checks, then 100 simulated players (about 2 minutes)
//   node rehearsal.mjs --rules         rules checks only (a few seconds)
//   node rehearsal.mjs --load          load test only
//   node rehearsal.mjs --players=50    number of simulated players (default 100)
//   node rehearsal.mjs --questions=10  answers per player (default: all questions, up to MAX_QUESTIONS)
//   node rehearsal.mjs --pace=0.3      answer faster than a human (1 = realistic, 2 to 6 seconds each)
//   node rehearsal.mjs --seed          create demo questions if you haven't built the real ones yet
//   node rehearsal.mjs --keep          don't erase the simulated players at the end
//
// Run it BEFORE the event only: it erases all players when it finishes, and it refuses to run if real players are in the game.
// To try it on your own computer without touching Firebase, start the emulator first:
//   firebase emulators:exec --only database "node rehearsal/rehearsal.mjs --seed"

import fs from "node:fs";
import { initializeApp, deleteApp } from "firebase/app";
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, remove, onValue, serverTimestamp } from "firebase/database";

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const N = Math.max(1, +(args.players ?? 100));
const PACE = +(args.pace ?? 1);
const SEED = !!args.seed, KEEP = !!args.keep, RULES_ONLY = !!args.rules, LOAD_ONLY = !!args.load;

// Read the Firebase settings and scoring from the game itself, so they can't drift apart.
const html = fs.readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
const CFG = new Function("return " + html.match(/const CFG = (\{[^}]*\});/)[1])();
const num = (name, d) => { const m = html.match(new RegExp("const " + name + " = (\\d+)")); return m ? +m[1] : d; };
const POINTS = num("POINTS", 100), SPEED_MAX = num("SPEED_MAX", 50), TIME = num("TIME", 15), MAX_QUESTIONS = num("MAX_QUESTIONS", 20);
const streakBonus = s => s >= 10 ? 100 : s >= 5 ? 50 : s >= 3 ? 25 : 0;
const EMU = process.env.FIREBASE_DATABASE_EMULATOR_HOST; // set automatically by "firebase emulators:exec"

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const pct = (a, p) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
const denied = e => String(e?.code || e?.message || e).toUpperCase().includes("PERMISSION_DENIED");
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT " + label)), ms))]);
const apps = [];
function open(name) {
  const app = initializeApp(CFG, name); apps.push(app);
  const db = getDatabase(app);
  if (EMU) { const [h, p] = EMU.split(":"); connectDatabaseEmulator(db, h, +p); }
  return db;
}
let failed = 0;
const report = (ok, label, extra = "") => { console.log((ok ? "PASS  " : "FAIL  ") + label + (!ok && extra ? "  -> " + extra : "")); if (!ok) failed++; };
async function finish(code) { for (const a of apps) await deleteApp(a).catch(() => {}); process.exit(code); }

console.log(`Database: ${CFG.databaseURL}${EMU ? "  (local emulator " + EMU + ")" : ""}`);
const admin = open("main");

// Safety: never touch a game that has real players in it.
const existing = (await get(ref(admin, "players"))).val() || {};
const real = Object.values(existing).filter(p => !String(p.name).startsWith("Rehearsal"));
if (real.length) { console.log(`Stopped: ${real.length} real players are in the game, and this script erases all players when it ends. Only run it before the event.`); await finish(1); }

// Questions
let qs = (await get(ref(admin, "game/questions"))).val(), seeded = false;
if (!qs && SEED) {
  const names = Array.from({ length: 40 }, (_, i) => `Demo Person${i + 1}`);
  const questions = names.slice(0, 30).map((n, i) => { const others = names.filter(x => x !== n).sort(() => Math.random() - .5).slice(0, 3); const o = [n, ...others].sort(() => Math.random() - .5); return { f: `Demo fun fact number ${i + 1}`, o, a: o.indexOf(n) }; });
  await set(ref(admin, "game"), { questions, guests: names, open: true });
  qs = questions; seeded = true; console.log("Created 30 demo questions (they are removed at the end).");
}
if (!qs) { console.log("There are no questions in the database yet. Build them from the host panel first, or add --seed to use demo questions."); await finish(1); }
qs = Array.isArray(qs) ? qs : Object.values(qs);
console.log(`${qs.length} questions in the game.`);

async function rulesChecks() {
  console.log("\n== Rules checks: honest players get in, cheating is refused ==");
  const db = open("rules");
  const id = "rules" + Math.random().toString(36).slice(2, 8), P = ref(db, "players/" + id);
  const rec = { name: "Rehearsal rules", score: 0, n: 0, c: 0, streak: 0, own: -1, t: 0 };
  const accepted = async (label, fn) => { try { await withTimeout(fn(), 10000, label); report(true, label); } catch (e) { report(false, label, e.message); } };
  const refused = async (label, fn, undo) => {
    try { await withTimeout(fn(), 10000, label); report(false, label, "the write was ACCEPTED"); if (undo) await undo().catch(() => {}); }
    catch (e) { report(denied(e), label, e.message); }
  };
  await accepted("a normal player can join", () => set(P, rec));
  await set(ref(db, "players/" + id + "x"), { ...rec, name: "Rehearsal rules 2" });   // a second player, so the player list never empties
  await refused("jumping to a huge score is refused", () => update(P, { score: 99999, n: 1, c: 1, t: serverTimestamp() }));
  await refused("skipping two questions at once is refused", () => update(P, { n: 2, t: serverTimestamp() }));
  await refused("renaming a player is refused", () => update(P, { name: "Someone else" }));
  await refused("unknown fields are refused", () => update(P, { hack: 1 }));
  await accepted("a normal answer (+100) is accepted", () => update(P, { n: 1, c: 1, streak: 1, score: 100, t: serverTimestamp() }));
  await refused("a second answer within a second is refused", () => update(P, { n: 2, c: 2, streak: 2, score: 200, t: serverTimestamp() }));
  await sleep(1300);
  await accepted("the next answer a moment later is accepted", () => update(P, { n: 2, c: 2, streak: 2, score: 200, t: serverTimestamp() }));
  await refused("lowering a score is refused", () => update(P, { score: 0 }));
  await refused("deleting a single player is refused", () => remove(P));
  const orig = (await get(ref(db, "game/open"))).val();
  await refused("a wrong type in the game settings is refused", () => set(ref(db, "game/open"), "yes"), () => set(ref(db, "game/open"), orig ?? true));
  await refused("a malformed question is refused", () => set(ref(db, "game/questions/999"), { f: "x", o: ["a", "b"], a: 9 }), () => remove(ref(db, "game/questions/999")));
  await refused("writing anywhere else is refused", () => set(ref(db, "answers/x"), 1), () => remove(ref(db, "answers")));
}

async function loadTest() {
  const limit = Math.min(qs.length, MAX_QUESTIONS, +(args.questions ?? qs.length));
  console.log(`\n== Load test: ${N} players, each on its own connection, answering ${limit} questions ==`);
  const board = open("board"), pend = new Map(), lag = [], lat = [], errors = {};
  let events = 0, joined = 0, done = 0, writes = 0, mismatch = 0;
  onValue(ref(board, "players"), snap => {
    events++; const now = performance.now();
    for (const [id, p] of Object.entries(snap.val() || {})) { const q = pend.get(id); while (q && q.length && q[0].n <= p.n) lag.push(now - q.shift().t0); }
  });
  const bump = (k) => { errors[k] = (errors[k] || 0) + 1; };

  async function sim(i) {
    const db = open("p" + i), id = "rh" + i.toString(36) + Math.random().toString(36).slice(2, 8), P = ref(db, "players/" + id);
    const s = { score: 0, n: 0, c: 0, streak: 0 };
    try { await withTimeout(set(P, { name: `Rehearsal ${i + 1}`, score: 0, n: 0, c: 0, streak: 0, own: -1, t: 0 }), 20000, "join"); joined++; }
    catch (e) { bump("could not join: " + (denied(e) ? "refused by the rules" : e.message)); return; }
    pend.set(id, []);
    const mine = qs.map((_, k) => k).sort(() => Math.random() - .5).slice(0, limit);
    for (const _ of mine) {
      const think = Math.max(900, rnd(2000, 6000) * PACE);
      await sleep(think);
      const ok = Math.random() < 0.6;
      const speed = ok ? Math.max(0, Math.round(SPEED_MAX * (1 - think / 1000 / TIME))) : 0;
      s.streak = ok ? s.streak + 1 : 0; s.n++; s.c += ok ? 1 : 0;
      s.score += ok ? POINTS + speed + streakBonus(s.streak) : 0;
      const t0 = performance.now(); pend.get(id).push({ n: s.n, t0 });
      try {
        await withTimeout(update(ref(db), { [`players/${id}/n`]: s.n, [`players/${id}/score`]: s.score, [`players/${id}/streak`]: s.streak, [`players/${id}/c`]: s.c, [`players/${id}/t`]: serverTimestamp() }), 15000, "answer");
        lat.push(performance.now() - t0); writes++;
      } catch (e) { bump(denied(e) ? "an answer was refused by the rules" : e.message); return; }
    }
    done++;
    const final = (await get(P)).val();
    if (!final || final.score !== s.score || final.n !== s.n) mismatch++;
  }

  await Promise.all(Array.from({ length: N }, (_, i) => sleep(i * 120).then(() => sim(i))));   // phones arrive over a few seconds
  await sleep(1500);
  console.log(`Joined ${joined}/${N}, finished ${done}/${N}, ${writes} answers saved.`);
  report(joined === N, `all ${N} players connected`, `only ${joined} did. On the free Firebase plan the limit is 100 simultaneous connections in total, players, scoreboard and host included.`);
  report(Object.keys(errors).length === 0, "no answer was refused or failed", JSON.stringify(errors));
  report(mismatch === 0, "stored scores match what each player computed", mismatch + " differ");
  console.log(`Saving an answer: median ${Math.round(pct(lat, .5))} ms, 95% under ${Math.round(pct(lat, .95))} ms, slowest ${Math.round(Math.max(0, ...lat))} ms`);
  console.log(`Answer to projector: median ${Math.round(pct(lag, .5))} ms, 95% under ${Math.round(pct(lag, .95))} ms (${events} scoreboard updates received)`);
}

try {
  if (!LOAD_ONLY) await rulesChecks();
  if (!RULES_ONLY) await loadTest();
} finally {
  if (!KEEP) { await remove(ref(admin, "players")).catch(e => console.log("Could not erase the test players: " + e.message)); if (seeded) await remove(ref(admin, "game")).catch(() => {}); console.log("\nTest players erased." + (seeded ? " Demo questions removed." : "")); }
  else console.log("\nTest players kept (use the host panel's \"Erase players and scores\" before the event).");
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
await finish(failed ? 1 : 0);
