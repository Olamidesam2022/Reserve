# Reserve

![Reserve](public/logo.svg)

**Plan the series, not just the draft.** Reserve helps League of Legends coaches and analysts plan Fearless Draft series by treating champions as a series-wide resource.

## Run locally

Requires Node.js 20+. Install dependencies with `npm install`, then run `npm run dev`. Use `npm run typecheck`, `npm test`, and `npm run build` for checks.

All plan data stays in browser localStorage. There is no backend, database, or API key. Champion tiles use Riot Data Dragon when online and show their names when art is unavailable.

## CSV format

`playerId,role,championId,championName,comfort,isFlex` (one row per player/champion). Roles: Top, Jungle, Mid, Bot, Support. Comfort: 0–5.
# Reserve
