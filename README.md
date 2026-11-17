# Local Hits

A client-side neighbourhood field guide for food, nightlife and sights. It opens immediately with 15 edited Toronto entries. Search a city, landmark, neighbourhood or postcode, or use device location to explore elsewhere.

![Local Hits on desktop and mobile](docs/preview.webp)

## Develop

Use Node 24 and pnpm 12.21.0. With Node 24's Corepack available, run `corepack enable pnpm` once to use the version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Run `pnpm test` for regression tests, `pnpm build` for type checking and the production build, and `pnpm preview` to inspect the built site.

## Deploy to Cloudflare Pages

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/). Go to **Workers & Pages → Create application → Pages → Connect to Git**.
2. Choose **GitHub**, authorize access to **arnavp103/local-hits**, select the repository and begin setup.
3. Use the following build settings. The repository’s `.node-version` selects Node 24. Set the pnpm build variable for production and preview builds.

   | Setting | Value |
   | --- | --- |
   | Project name | `local-hits` |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |
   | Root directory | Leave blank (repository root) |
   | Build environment variable | `PNPM_VERSION=12.21.0` |

4. Click **Save and Deploy**. Open the HTTPS URL Cloudflare shows when the build succeeds. Try a category and **Use my location** to check the published site.
5. Future pushes to `main` deploy to production. Pull requests from other branches in the repository get preview deployments by default.

The checked-in `wrangler.jsonc` identifies the Pages project and its static output. Pages builds and uploads the files through the GitHub integration. No application secrets or locally installed deployment CLI are required.

[Cloudflare Pages Git setup](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Build image versions](https://developers.cloudflare.com/pages/configuration/build-image/) · [Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

## How nearby discovery works

- The opening Toronto edition is static. Its distances are measured from Berczy Park. Each entry in `src/toronto.json` has coordinates, an article, category tags, a short explanation and a field note.
- Place search uses Photon and OpenStreetMap. Searches are submitted explicitly. The browser asks for location permission only after the visitor presses the location button.
- An area search asks English Wikipedia for up to 60 geocoded pages within 5 km, then fetches introductions in batches of 20. Each batch becomes available as it arrives. Results are merged by article, with Toronto editorial entries taking precedence.
- Live categories are inferred from the article title, short description and introduction. Unclassified pages remain under All. Former venues with evidence of a surviving landmark appear under Sights. Coverage and venue status depend on the source article.
- Visitors can switch tabs instantly. Distances are straight-line measurements with a country-based default unit and a manual override. Raw device coordinates and searches are used for lookup and are not persisted by the app.
- The public lookup services can be slow or unavailable. Existing entries stay usable and visitors can retry failed Wikipedia lookups.

[Follow-up on restaurants mentioned inside other articles](https://github.com/arnavp103/local-hits/issues/1)

## Sources

Inspired by [Ed Jefferson’s Localpedia](https://edjefferson.com/localpedia/). Wikipedia extracts retain their article attribution and [CC BY-SA licence](https://creativecommons.org/licenses/by-sa/4.0/). Individual photograph credits and licences are available in the guide and in `src/credits.json`. Local WOFF2 fonts include their SIL Open Font Licences in `public/fonts/`. The repository MIT licence applies to the application code.
