# Decisions

Why this app is built the way it is. Read it before changing anything; AGENTS.md explains how to work on the repo.

Rules for this file:
- One entry per decision: what, then why.
- Never renumber or delete an entry; code comments point to these numbers. To change a decision, add a new entry and mark the old one "Superseded by Dn".
- Update this file in the same change as the code it describes.

## Hosting and accounts

**D1. Hosting.** Static files on GitHub Pages (public repository, free plan); data and sign-in on Firebase's free Spark plan (Firestore and Authentication). Why: no paid domain, no server to keep alive, nothing tied to a subscription. The owner rejected hosting on claude.ai because a cancelled subscription would take the app and its data with it. The public repository exposes code only, never data.

**D2. No build step, framework or npm.** Plain HTML, CSS and JavaScript. The Firebase JS SDK loads as ES modules from Google's CDN (www.gstatic.com) at a pinned version (`SDK` in index.html). Why: the repository is exactly what runs, there is nothing to install or keep updated, and an agent can read the whole app in one file. To upgrade Firebase, change the version in `SDK` and run the tests.

**D3. Sign-in is email and password**, for one account created by hand in the Firebase console. The app has no sign-up screen. Why: Google sign-in from a github.io page needs a cross-site redirect or popup to firebaseapp.com. Firebase's own docs say the redirect flow breaks in browsers that block third-party storage, and popups are unreliable on phones and home-screen apps. Email and password is a direct API call from our own page.

**D4. The security boundary is firestore.rules.** Only the owner's UID can read or write, and only under `users/{uid}`. The values in firebase-config.js are public by design (every visitor's browser sees them): they identify the project and grant nothing on their own.

**D5. Firebase settings live in firebase-config.js**, separate from index.html. Code changes never touch it, so replacing index.html can't break the owner's connection.

## Data

**D6. Paths.** `users/{uid}/tasks/{taskId}`, one document per task, and `users/{uid}/settings/app` for settings synced across devices (today only the lists). Why one document per task: two devices editing different tasks never overwrite each other.

**D7. Task fields.** `title` (string), `lists` (list ids), `prio` (1, 2 or 3), `done` (bool), `created` and `doneAt` (milliseconds from the device clock; `doneAt` is null while open). Missing fields get defaults when read (`toTask`), so documents from older versions or typed into the console still work. Why the device clock: it works offline and sorts immediately, while a server timestamp stays empty until the write reaches the server.

**D8. Lists are tags, not folders.** A list is a filter: the tasks whose `lists` include its id. A task on several lists is one record, so completing or editing it anywhere changes it everywhere. A task with no list appears only in All.

**D9. Lists are data, not code.** The owner adds, renames, recolors, reorders and deletes them in the app (the + after the tabs). They are stored in order as `settings/app.lists = [{ id, name, color }]`. Ids are random and never change; names can. Colors come from `PALETTE`. In the lists editor a blank name means "no change": a new list without a name isn't created, and an existing list keeps its old name. Why: owner requirement 6 in AGENTS.md. New sections are added with a button, without code or an LLM.

**D10. The default lists** (Work, Hobbies, Gym, To buy) are written only when the server confirms that `settings/app` doesn't exist, never on the word of the on-device copy. Why: a new device that starts offline has an empty copy, and writing defaults then would overwrite the real lists once it syncs.

**D11. Deleting a list keeps its tasks.** Their list ids stay in the data (unknown ids are ignored), so the tasks remain in All and in their other lists, and restoring a backup brings the list back with its tasks. Saving a lists edit that removes lists asks for confirmation first.

**D12. Priority has three fixed levels** shared by every list: 1 High, 2 Normal (the default), 3 Low (`PRIOS`). Every list sorts by priority, then newest first. So each list is a slice of one global order, and a task you just added is visible without scrolling. The levels are code, not settings: editable levels would add screens for little gain.

**D13. Completed tasks are deleted 30 days after completion** (`DONE_TTL_DAYS`), once per session, after the first snapshot confirmed by the server. Why: when the app starts after a break of more than 30 minutes, Firestore bills one read per document in the collection. Keeping the collection small keeps daily use far below the free 50,000 reads a day.

## Sync and offline

**D14. Writes are fire-and-forget:** never await them before updating the screen. Firestore applies a write to its on-device copy and notifies listeners at once, but the promise resolves only when the server confirms, so awaiting would freeze the app offline. Failures are caught in STORE and shown as a toast; Firestore undoes rejected writes itself.

**D15. Two listeners**, one on the tasks collection and one on `settings/app`, both with `includeMetadataChanges`. The screen is drawn only from snapshots (action → store → snapshot → render), so every device shows the same thing, including the one that made the change. Filtering and sorting happen in `render()`.

**D16. Firestore keeps an on-device copy** (`persistentLocalCache` in IndexedDB, with the multi-tab manager). Lists and tasks can be read offline, and writes queue until the connection returns.

**D17. A service worker (sw.js) lets the app open without a connection.** Our own files are network-first with a 3-second timeout: fresh when online, the saved copy when offline or slow. Firebase SDK files are cache-first, because their URL contains the version. Sign-in and database traffic is never intercepted. A device can start offline once it has opened the app twice while online. Bump `VERSION` in sw.js when changing its caching or file list.

**D18. The "Offline" notice appears only after snapshots have come from the on-device copy for 3 seconds.** Why: every start shows the saved copy for a moment before the server answers. Without the delay the notice would flash on every launch.

**D19. Conflicts: the last write wins per document** (Firestore's default), which is fine for one person. The whole lists array is one document, so if two devices save list edits at the same moment, the later save wins.

## Backup

**D20. Backup is a JSON download** of every list and task, ids included ("Download backup"). "Restore backup" merges: it adds missing lists, writes tasks by id (replacing a task with the same id) and deletes nothing. Why: the data must survive a Firebase account or plan change. Moving to a new Firebase project is setup (README) plus a restore, with no code.

## Interface

**D21. Priority is shown as type weight.** High is bold with a highlighter mark, Normal is regular, Low is light and grey. Why: readable at a glance, and a list that is half highlighter makes priority inflation obvious.

**D22. A task row shows the other lists** the task is on, not the one being viewed. In All it shows all of them.

**D23. The new-task field adds to the open list with Normal priority.** List and priority pickers appear once you start typing, and reset after each add.

**D24. Ticking a task shows the tick at once, then moves the task after 350 ms**, so you see what happened.

**D25. Per-device settings** (which list is open) live in localStorage and are not synced. If the open list no longer exists, the app switches to All.

**D26. All user text goes through `esc()`** before it is put into HTML. List colors must be `#rrggbb` (`toList`) because they go into style attributes.

**D27. Typeface: Atkinson Hyperlegible Next**, self-hosted in fonts/ with its license (SIL Open Font License), subset to Latin, variable weight 200–800. Why: it is designed for legibility at a glance, its weight range carries D21, and there are no third-party font requests.

**D28. List tabs wrap instead of scrolling sideways**, so every list and its open count stay in sight. The + for adding or editing lists follows the last tab. Tabs reserve their bold width, so switching lists doesn't shift the layout.

## Process

**D29. tests/test_app.py checks the behaviour above** in headless Chromium. It uses a stand-in Firebase (tests/fake-firebase/) for the flows, and the real Firebase SDK (from npm) up to the network. Run it before handing back a change, and add checks for new behaviour. The app never needs the tests to run.

**D30. firebase.json holds the Firebase setup for the Firebase CLI:** the Firestore location (`eur3`, Europe multi-region) and edition (Standard), the rules file, and Email/Password as the only sign-in provider (D3). `firebase deploy --only firestore:rules,auth --project <projectId from firebase-config.js>` applies it; on a new project it also enables the Firestore API and creates the database in that location. Pasting firestore.rules into the console (README, step 5) still works. Why: the owner prefers command-line setup to web consoles, and the file records choices otherwise visible only in the console. The CLI is a deploy tool, not part of the app (D2). The file is public on GitHub Pages like everything else, which is fine: it holds no secrets (D4).
