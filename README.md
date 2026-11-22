# Games FE — Forehead Charades, Truth or Dare, Word Grid & The Money Ladder

One React SPA serving **every game** from one endpoint. Built with React,
TypeScript, Vite and Tailwind CSS.

## Routes

| Path | Screen |
|---|---|
| `/` | The lobby — pick a game |
| `/forehead-charades` | Forehead Charades (client-only pass-the-phone) |
| `/truth-or-dare` | Truth or Dare (client-only pass-the-phone) |
| `/money-ladder` | The Money Ladder |
| `/word-grid` | Word Grid |

Truth or Dare uses display-name sub-routes:
`/truth-or-dare/setup`, `/truth-or-dare/how-to-play` and
`/truth-or-dare/game`.

Unknown top-level paths fall back to the lobby, so a stale bookmark never
lands on a blank screen. Navigation is client-side (History API + `popstate`),
so moving between games never reloads the document.

## Truth or Dare

Truth or Dare is a 2–12 player pass-the-phone game with three content packs:

- **PG** — all ages, silly and harmless.
- **Spicy** — 15+, cheeky and flirty.
- **NSFW** — 18+, adult themes with an age check.

Any combination of packs can be selected. The game merges them into one pool
and shows the source pack on every prompt. Each pack ships 60 truths and 60
dares; prompts do not repeat until the merged pool is exhausted. There is no
scoring or timer, and every prompt can be swapped or skipped with no penalty.
The last player list and pack selection are remembered, but NSFW is
re-confirmed on each new setup.

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
src/index.css                    the shared design system (Stage palette + tokens)
```

Each game keeps its own state namespace (Word Grid persists its room under
`roomId`/`roomCode`, The Money Ladder under its own keys, Forehead Charades
under `foreheadCharades.*`, Truth or Dare under `truthOrDare.*`), so they can
never collide in one browser.

## Backend

The two server-backed games talk to the **one** API in the sibling `boggle`
repo, on their own route trees:

- Word Grid → `/api/boggle/*`, `/ws/boggle/*`
- The Money Ladder → `/api/millionaire/*`, `/ws/millionaire/*`
- Forehead Charades → **no backend**: decks, scoring and tilt run entirely in
  the browser; custom decks and the last setup live in localStorage.
- Truth or Dare → **no backend**: prompts, players, turn order and pack
  selection run entirely in the browser; the last setup lives in localStorage.

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
`public/_redirects` supplies the SPA history fallback, so `/word-grid`,
`/money-ladder`, `/forehead-charades` and `/truth-or-dare` work as direct links
and survive a refresh inside a game.

## Content & trademarks

The display names and built-in Forehead Charades decks are original. The quiz
game's question corpus is separate data, unchanged by the branding pass. Truth
or Dare ships 360 original prompts across PG, Spicy and NSFW packs; the packs
can be combined and the NSFW pack is age-gated on each new setup session.
