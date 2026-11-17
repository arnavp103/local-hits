# Local Hits

A client-side neighbourhood field guide for food, nightlife and sights. It works worldwide, with extra editorial coverage in Toronto. Search a city, landmark, neighbourhood or postcode, or use device location to explore elsewhere.

![Local Hits on desktop and mobile](docs/preview.webp)

## Develop

Use Node 24 and pnpm 12.21.0. With Node 24's Corepack available, run `corepack enable pnpm` once to use the version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm test` for regression tests, `pnpm build` for type checking and the production build, and `pnpm preview` to inspect the built site.

## Deploy on Cloudflare Workers

1. In the Cloudflare dashboard, open **Workers & Pages**, create a Worker from a Git repository, and select **arnavp103/local-hits**.
2. On **Set up your application**, use project name `local-hits` and build command `pnpm build`. Keep the default deploy command `npx wrangler deploy` and preview command `npx wrangler preview`. Leave preview builds enabled for pull requests.
3. Keep the build variables empty. The pnpm lockfile selects pnpm, `package.json` pins its version, and `.node-version` selects Node 24. The `npx` commands launch Cloudflare’s CLI.
4. Click **Deploy**. Open the URL Cloudflare displays and try the Food tab and **Use my location**. Use `main` as the production branch for subsequent builds.

Wrangler serves the Vite output in `dist/` through Workers Static Assets. The app runs in the browser.

[Workers build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [Build tool versions](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)

## How nearby discovery works

- Toronto includes 15 static editorial entries. Their distances are measured from the visitor’s chosen starting point. Each entry in `src/toronto.json` has coordinates, an article, category tags, a short explanation and a field note.
- Place search uses Photon and OpenStreetMap. After two characters, a debounced autocomplete offers matching places. Use the arrow keys and Enter or tap a suggestion. The browser asks for location permission only after the visitor presses the location button.
- An area search asks English Wikipedia for up to 60 geocoded pages within an estimated 30-minute walk (1.92 km straight-line at 4.8 km/h, allowing 25% extra distance for street layout), then fetches introductions in batches of 20. Each batch becomes available as it arrives. Results are merged by article, with Toronto editorial entries taking precedence.
- Live categories are inferred from the article title, short description and introduction. Unclassified pages remain under All. Former venues with evidence of a surviving landmark appear under Sights. Coverage and venue status depend on the source article.
- Visitors can switch tabs instantly. Cards show estimated walking minutes and straight-line distances with a country-based default unit and a manual override. Raw device coordinates and searches are used for lookup and are not persisted by the app.
- The public lookup services can be slow or unavailable. Existing entries stay usable and visitors can retry failed Wikipedia lookups.

[Follow-up on restaurants mentioned inside other articles](https://github.com/arnavp103/local-hits/issues/1)

## Sources

Inspired by [Ed Jefferson’s Localpedia](https://edjefferson.com/localpedia/). Wikipedia extracts retain their article attribution and [CC BY-SA licence](https://creativecommons.org/licenses/by-sa/4.0/). Individual photograph credits and licences are available in the guide and in `src/credits.json`. Local WOFF2 fonts include their SIL Open Font Licences in `public/fonts/`. The repository MIT licence applies to the application code.
