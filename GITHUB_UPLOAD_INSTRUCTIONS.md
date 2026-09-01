# Writer Cup 2026 — GitHub V6 Upload

This folder is the clean V6 frontend. It is intended to replace the legacy V5.1-era files in the GitHub repository root.

## Important

Upload the **contents of this folder** to the root of the GitHub repository, so GitHub shows files such as:

- `index.html`
- `app.js`
- `data.js`
- `styles.css`
- `config.js`
- `manifest.json`
- `sw.js`
- `assets/`
- `supabase/`

Do **not** upload this as a nested `writer-cup-2026-github-v6/` folder.

## GitHub web upload

1. Open the `benwriter/writer-cup-2026` repository.
2. Stay on the `main` branch.
3. Choose **Add file → Upload files**.
4. Drag the contents of this folder into the upload area.
5. GitHub should show the existing root files as replacements/changes.
6. Commit directly to `main` with a message such as: `Deploy clean Writer Cup V6 frontend`.
7. Wait for the connected Vercel deployment to finish.

## What the clean index should load

The V6 `index.html` loads only:

- Supabase JS
- `./config.js`
- `./data.js`
- `./app.js`

It must **not** contain any `writer-cup-v4`, `writer-cup-v5`, `v511`, `v512`, `v513`, or `v514` patch script URLs.

## After deployment

Open the production site in a completely new tab/window. Test:

1. Score tab opens.
2. Hole navigation: 13 → 14 → 15 and back again.
3. Hole 14 displays Aggregate Singles Stableford plus Longest Drive/randomiser.
4. Holes 7–12 show individual Stableford points and combined team totals.
5. Save a test hole, confirm it stays visible, then clear it.

The existing Supabase database is reused. Uploading these frontend files does not intentionally delete tournament data.
