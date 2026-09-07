# Writer Cup V8 · Unsaved Score Protection

Upload these files to the main GitHub repository folder, replacing files with the same names:

## Required live-app files

- `app.js`
- `index.html`
- `sw.js`

All three are required. `index.html` and `sw.js` advance the installed-app cache so phones and Macs receive the updated `app.js`.

## Recommended supporting files

- `test-v6.js`
- `test-v8-save.js`
- `V8_CHANGELOG.md`

The supporting files do not affect live scores or tournament data. They keep the automated checks and release record aligned with the app.

No Supabase migration, score reset or course reset is included.

After Vercel finishes deploying, fully close and reopen the app once on each test device. Enter several scores without saving, wait briefly or move up and down the score screen, and confirm every entered value remains present.
