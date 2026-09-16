# V8 weather timing fix

Upload app.js, index.html and sw.js together to the repository root, replacing their existing versions. Commit and allow Vercel to deploy, then refresh the app online. If an installed app still looks old, close and reopen it.

The weather now uses the same 7am tournament start as the countdown. It unlocks seven days before tee-off and automatically rechecks while Home is visible or when returning to the app. Automatic checks do not redraw the Score page. Forecast requests still depend on internet access and the weather provider.

No database changes or reset required. Existing local content updates are retained, including departure/breakfast details and AMPOL.

The test files are supporting checks and are not loaded by the app. They may also be uploaded.
