# Writer Cup V8 · Active Score Entry Stability Fix

Upload these files to the main GitHub repository folder, replacing files with the same names.

## Required live-app files

- `app.js`
- `index.html`
- `sw.js`

All three are required. The cache version is now `v8-final-3`, ensuring installed phones and Macs receive the stability fix.

## Recommended supporting files

- `test-v6.js`
- `test-v8-save.js`
- `V8_CHANGELOG.md`

No Supabase migration or database reset is included. Current test scores and course settings are unaffected by uploading these files.

After Vercel finishes deploying, fully close and reopen the app once. Enter several scores on one hole, pause for longer than ten seconds while continuing to tap, and confirm the screen and player controls remain stationary until Save is pressed.
