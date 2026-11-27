# Games FE — Forehead Charades, Truth or Dare, Out of Line, Misclue, Word Grid & The Money Ladder

One React SPA serving **every game** from one endpoint. Built with React,
TypeScript, Vite and Tailwind CSS.

## Routes

| Path | Screen |
|---|---|
| `/` | The lobby — pick a game |
| `/forehead-charades` | Forehead Charades (client-only pass-the-phone) |
| `/truth-or-dare` | Truth or Dare (client-only pass-the-phone) |
| `/out-of-line` | Out of Line (multiplayer judge-and-submit cards) |
| `/misclue` | Misclue (social deduction, party pass-the-phone or solo vs AI) |
| `/money-ladder` | The Money Ladder |
| `/word-grid` | Word Grid |

Truth or Dare uses display-name sub-routes:
`/truth-or-dare/setup`, `/truth-or-dare/how-to-play` and
`/truth-or-dare/game`.

Out of Line uses `/out-of-line/how-to-play` and
`/out-of-line/room/:code`.

Misclue uses `/misclue/how-to-play` and `/misclue/play`.

Unknown top-level paths fall back to the lobby, so a stale bookmark never
lands on a blank screen. Navigation is client-side (History API + `popstate`),
so moving between games never reloads the document.

## Out of Line

Out of Line is a 3–12 player online, judge-and-submit party game. One device
per player, 7-card hands, and a judge who rotates every round. Prompts can be
pick-1 or pick-2; submissions stay anonymous until the reveal, and the winner
scores a point. Rooms support reconnect, host force-advance, and rematch.
Players can join by room code or by scanning the lobby QR code/share link.

The base 15+ deck is always on. Group Chat, Work Mode, Bad Decisions,
Deadpan Doom, and Family Gathering are optional 15+ decks, and After Hours is
an optional 18+ suggestive deck behind one age confirmation at room
creation/join. Current decks: House (100 prompts / 310 answers), Group Chat
(40/110), Work Mode (40/110), Bad Decisions (40/110), Deadpan Doom (40/110),
Family Gathering (40/110), After Hours 18+ (40/110).

## Truth or Dare

Truth or Dare is a 2–12 player pass-the-phone game with three content packs:

- **PG** — all ages, silly and harmless.
- **Spicy** — 15+, cheeky and flirty.
- **NSFW** — 18+, adult themes with an age check.

Any combination of packs can be selected. The game merges them into one pool
and shows the source pack on every prompt. Each pack ships 60 truths and 60
dares; prompts do not repeat until the merged pool is exhausted. There is no
scoring or timer, and every prompt can be swapped or skipped. Optional Drinking
mode adds drink-involving dares and a per-prompt forfeit amount; in
Drinking mode there is no Swap prompt. The last setup is remembered, but
NSFW/Drinking 18+ confirmation is required on each new setup.

## Misclue

Misclue is a secret-word social deduction game with two modes:

- **Party Mode** — pass-the-phone, humans only, verbal clues and discussion.
- **Solo Mode** — 1 human vs randomly picked AI characters; the human types clues and votes, AI turns are resolved through the backend.

Roles are **Natives** (same word), **Tourists** (similar word), and **Drifter** (no word, gets one guess if eliminated). Party Mode is fully client-side; Solo Mode calls `POST /api/misclue/ai/turn`.

## Word Grid

Word Grid is the multiplayer Boggle-style game. Players can create a room, copy
the room code/link, or scan the lobby QR code to join on another device.

## Structure

```
src/App.tsx                      the hub: lobby + route switch
src/router.ts                    top-level routes + game sub-routes
src/games/BoggleApp.tsx          Word Grid
src/games/boggleApi.ts           Word Grid's REST/WS client
src/games/components_boggle/     Word Grid's components
src/games/millionaire/           The Money Ladder (app, api client, components)
src/games/headsup/               Forehead Charades (client-only; no API calls)
src/games/truthordare/           Truth or Dare (client-only; no API calls)
src/games/outofline/             Out of Line (multiplayer; REST + WS)
src/games/misclue/               Misclue (local party mode + solo AI mode)
src/index.css                    the shared design system (Stage palette + tokens)
```

Each game keeps its own state namespace (Word Grid persists its room under
`roomId`/`roomCode`, The Money Ladder under its own keys, Forehead Charades
under `foreheadCharades.*`, Truth or Dare under `truthOrDare.*`, Out of Line
under `outofline.*`, Misclue under `misclue.state.v1`), so they can never collide
in one browser.

## Backend

The server-backed games talk to the **one** API in the sibling `boggle`
repo, on their own route trees:

- Word Grid → `/api/boggle/*`, `/ws/boggle/*`
- The Money Ladder → `/api/millionaire/*`, `/ws/millionaire/*`
- Out of Line → `/api/out-of-line/*`, `/ws/out-of-line/*`
- Misclue (Solo Mode) → `/api/misclue/ai/turn` (OpenRouter-backed AI turns)
- Forehead Charades → **no backend**: decks, scoring and tilt run entirely in
  the browser; custom decks and the last setup live in localStorage.
- Truth or Dare → **no backend**: prompts, players, turn order and pack
  selection run entirely in the browser; the last setup lives in localStorage.
- Misclue (Party Mode) → **no backend**: pass-the-phone local play.

Set `VITE_API_URL` to the API origin (the devcontainer sets it to
`http://localhost:8080`). It must be an origin the API's `ALLOWED_ORIGINS`
list includes — the WebSocket upgrade is origin-checked.

## Setup

```sh
npm install
npm run dev     # hub on http://localhost:5173
npm run build   # -> dist/
npm run lint
```

## Deployment

The build command is `npm run build`, with `dist/` as the publish directory.
`public/_redirects` supplies the SPA history fallback, so game routes including
`/out-of-line/room/:code` and `/misclue` work as direct links and survive a refresh.

## Content & trademarks

The display names and built-in Forehead Charades decks are original. The quiz
game's question corpus is separate data, unchanged by the branding pass. Truth
or Dare ships 360 original prompts across PG, Spicy and NSFW packs, plus
optional drinking prompts in Drinking mode; the packs can be combined and
NSFW/Drinking 18+ access is gated on each new setup session.
