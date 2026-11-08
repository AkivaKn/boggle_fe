# Games FE — Forehead Charades, Word Grid & The Money Ladder

One React SPA serving **every game** from one endpoint. Built with React,
TypeScript, Vite and Tailwind CSS.

## Routes

| Path | Screen |
|---|---|
| `/` | The lobby — pick a game |
| `/forehead-charades` | Forehead Charades (client-only pass-the-phone) |
| `/money-ladder` | The Money Ladder |
| `/word-grid` | Word Grid |

Unknown paths fall back to the lobby, so a stale bookmark never lands on a
blank screen. Navigation is client-side (History API + `popstate`), so moving
between games never reloads the document.

## Structure

```
src/App.tsx                      the hub: lobby + route switch
src/router.ts                    top-level routes + Forehead Charades sub-routes
src/games/BoggleApp.tsx          Word Grid
src/games/boggleApi.ts           Word Grid's REST/WS client
src/games/components_boggle/     Word Grid's components
src/games/millionaire/           The Money Ladder (app, api client, components)
src/games/headsup/               Forehead Charades (client-only; no API calls)
src/index.css                    the shared design system (Stage palette + tokens)
```

Each game keeps its own state namespace (Word Grid persists its room under
`roomId`/`roomCode`, The Money Ladder under its own keys, Forehead Charades
under `foreheadCharades.*`), so they can never collide in one browser.

## Backend

The two server-backed games talk to the **one** API in the sibling `boggle`
repo, on their own route trees:

- Word Grid → `/api/boggle/*`, `/ws/boggle/*`
- The Money Ladder → `/api/millionaire/*`, `/ws/millionaire/*`
- Forehead Charades → **no backend**: decks, scoring and tilt run entirely in
  the browser; custom decks and the last setup live in localStorage.

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
`/money-ladder` and `/forehead-charades` work as direct links and survive a
refresh inside a game.

## Content & trademarks

The display names and built-in Forehead Charades decks are original. The quiz
game's question corpus is separate data, unchanged by the branding pass.
