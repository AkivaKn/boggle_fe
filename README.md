# Games FE — the hub for Boggle & Millionaire

One React SPA serving **every game** from one endpoint. Built with React,
TypeScript, Vite and Tailwind CSS.

## Routes

| Path | Screen |
|---|---|
| `/` | The lobby — pick a game |
| `/boggle` | Boggle |
| `/millionaire` | Millionaire |

Unknown paths fall back to the lobby, so a stale bookmark never lands on a
blank screen. Navigation is client-side (History API + `popstate`), so moving
between games never reloads the document.

## Structure

```
src/App.tsx                      the hub: lobby + route switch
src/router.ts                    the three routes (hand-rolled on purpose —
                                 no router dependency for three routes)
src/games/BoggleApp.tsx          Boggle
src/games/boggleApi.ts           Boggle's REST/WS client
src/games/components_boggle/     Boggle's components
src/games/millionaire/           Millionaire (app, api client, components)
src/index.css                    the shared design system (Stage palette + tokens)
```

Each game keeps its own state namespace (Boggle persists its room under
`roomId`/`roomCode`, Millionaire under its own keys), so the two can never
collide in one browser.

## Backend

Both games talk to the **one** API in the sibling `boggle` repo, on their own
route trees:

- Boggle → `/api/boggle/*`, `/ws/boggle/*`
- Millionaire → `/api/millionaire/*`, `/ws/millionaire/*`

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

The build command (`npm run build`) and publish dir (`dist/`) are unchanged
from when this repo served Boggle alone. `public/_redirects` supplies the SPA
history fallback, so `/boggle` and `/millionaire` work as direct links and
survive a refresh inside a game.