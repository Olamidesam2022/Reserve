# Reserve

![Reserve](public/logo.svg)

Reserve helps League of Legends coaches plan Fearless Draft series. It tracks planned picks across games, locks champions used in earlier games, and provides comfort-pool depth, warnings, and simulation tools for comparing plans.

## Run locally

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
```

Plan data is stored in browser localStorage. Champion artwork and names use Riot Data Dragon when it is available; the app can still display its bundled champion names offline.

## Scripts

- `npm run dev` starts the Vite development server.
- `npm test` runs the Vitest suite.
- `npm run typecheck` checks TypeScript projects.
- `npm run build` typechecks and creates a production build in `dist/`.

## CSV import format

The CSV importer expects these headers:

```csv
playerId,role,championId,championName,comfort,isFlex
mid-1,Mid,Ahri,Ahri,5,false
```

Each row records one champion comfort rating for one player and role. Roles are `Top`, `Jungle`, `Mid`, `Bot`, and `Support`; comfort is a number from 0 to 5. `playerId`, `role`, `championId`, and `comfort` are used by the importer. `championName` and `isFlex` are accepted as descriptive columns but are not used to build the pool. Rows with missing required values or comfort outside 0–5 are skipped. A player with multiple champions in a role has one row per champion.

## Folder structure

- `src/engine/` series rules, validation, simulation, and engine tests.
- `src/data/` bundled example pools and CSV/manual pool parsers.
- `src/storage/` local plan persistence.
- `src/ui/` React application and styles.
- `public/` app logos and static assets.

## How scoring works

The champion reserve score and its weights are being refined as part of the engine update. This section will describe the final hold value and recommendation rules after that change.
