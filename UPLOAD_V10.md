# Writer Cup V10 upload

Upload the files in this package into the main `benwriter/writer-cup-2026` repository, preserving the folders. Replace files with the same names.

The Supabase V10 migration has already been applied to the connected project. Do not run it again.

## Upload these files

- `index.html`, `app.js`, `styles.css`, `config.js`, `data.js`, `manifest.json`, `sw.js`
- `newcup.html`, `newcup.js`
- `postcup.html`, `postcup.js`, `postcup-model.js`, `postcup.css`
- `api/round-report.js`, `vercel.json`
- `assets/writer-cup-generic.svg`, `assets/icon-192.png`, `assets/icon-512.png`

The API file is intentionally a retired endpoint. It prevents an old Captain’s Desk request from generating a report after V10 is deployed.

## After upload

Vercel should redeploy automatically. Refresh the app fully on the phone and Mac. The active event will still be the completed 2026 Cup. Use More → Tournament → Event Setup to create the next Cup after the next venue and date are known.

Do not create a new Cup during this upload check. The existing 2026 scorecard and archive must remain untouched.
