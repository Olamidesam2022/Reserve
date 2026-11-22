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
- `npm run format` formats project files with Prettier.
- `npm run contrast` checks the main text and background color token pairs for WCAG AA contrast.

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
- `src/ui/` React application and styles, with reusable components in `components/` and effects in `hooks/`.
- `public/` app logos and static assets.

## How scoring works

Each pool champion receives a **hold value from 0 to 100**. Higher values mean it is more valuable to keep the champion in reserve. The score combines four normalized signals:

- **Scarcity (40%)**: `1 / strong options remaining`, where strong means comfort 3 or higher. A champion that is the last strong option contributes the most.
- **Comfort (30%)**: the team’s comfort rating divided by 5.
- **Flexibility (20%)**: the share of possible role flexibility beyond a single role.
- **Games remaining (10%)**: games still to be played, including the current game, divided by the series length.

The result is rounded to the nearest whole number. Scores of 65 or higher recommend **HOLD**; scores of 35 or lower recommend **SPEND**; scores in between are **NEUTRAL**. The pool list includes a brief reason for each score, such as a last strong option, comfort rating, or flex value. Tuning weights and thresholds live together in `src/engine/config.ts`.

The series simulator projects the complete planned series from Game 1. The app does not record prior game winners, so it cannot condition that projection on an in-progress series score.
