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

**D7. Task fields.** *Superseded by D31.* `title` (string), `lists` (list ids), `prio` (1, 2 or 3), `done` (bool), `created` and `doneAt` (milliseconds from the device clock; `doneAt` is null while open). Missing fields get defaults when read (`toTask`), so documents from older versions or typed into the console still work. Why the device clock: it works offline and sorts immediately, while a server timestamp stays empty until the write reaches the server.

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

**D21. Priority is shown as type weight.** *Superseded by D34.* High is bold with a highlighter mark, Normal is regular, Low is light and grey. Why: readable at a glance, and a list that is half highlighter makes priority inflation obvious.

**D22. A task row shows the other lists** the task is on, not the one being viewed. In All it shows all of them.

**D23. The new-task field adds to the open list with Normal priority.** List and priority pickers appear once you start typing, and reset after each add.

**D24. Ticking a task shows the tick at once, then moves the task after 350 ms**, so you see what happened.

**D25. Per-device settings** (which list is open) live in localStorage and are not synced. If the open list no longer exists, the app switches to All.

**D26. All user text goes through `esc()`** before it is put into HTML. List colors must be `#rrggbb` (`toList`) because they go into style attributes.

**D27. Typeface: Atkinson Hyperlegible Next**, self-hosted in fonts/ with its license (SIL Open Font License), subset to Latin, variable weight 200–800. Why: it is designed for legibility at a glance, its weight range carries D21, and there are no third-party font requests.

**D28. List tabs wrap instead of scrolling sideways**, so every list and its open count stay in sight. The + for adding or editing lists follows the last tab. Tabs reserve their bold width, so switching lists doesn't shift the layout. *Superseded by D36.*

## Process

**D29. tests/test_app.py checks the behaviour above** in headless Chromium. It uses a stand-in Firebase (tests/fake-firebase/) for the flows, and the real Firebase SDK (from npm) up to the network. Run it before handing back a change, and add checks for new behaviour. The app never needs the tests to run.

**D30. firebase.json holds the Firebase setup for the Firebase CLI:** the Firestore location (`eur3`, Europe multi-region) and edition (Standard), the rules file, and Email/Password as the only sign-in provider (D3). `firebase deploy --only firestore:rules,auth --project <projectId from firebase-config.js>` applies it; on a new project it also enables the Firestore API and creates the database in that location. Pasting firestore.rules into the console (README, step 5) still works. Why: the owner prefers command-line setup to web consoles, and the file records choices otherwise visible only in the console. The CLI is a deploy tool, not part of the app (D2). The file is public on GitHub Pages like everything else, which is fine: it holds no secrets (D4).

## Projects, prices and display

**D31. Task fields** (supersedes D7). *Superseded by D37.* `title` (string), `lists` (list ids), `prio` (1, 2 or 3), `done` (bool), `created` and `doneAt` (milliseconds from the device clock; `doneAt` is null while open), `project` (bool), `notes` (string: a project's description), `parent` (a subtask's project id, else null) and `price` (whole euro cents, or null). Missing or invalid fields get defaults when read (`toTask`), so documents and backups from older versions, or typed into the console, still work. Why the device clock: it works offline and sorts immediately, while a server timestamp stays empty until the write reaches the server. Why cents: totals add up exactly.

**D32. Projects.** A task is a single action; a project is a task with `project: true`, a description and subtasks. Subtasks are ordinary task documents with `parent` set, so each has its own priority, lists and price, and two devices editing different subtasks never collide (D6). One level only: a project is never a subtask, and a subtask whose project is gone stands alone. "Make it a project" in the task editor upgrades a task (one way). Tapping a project opens its page (`#p=<id>` in the address, so the phone's back gesture returns to the list) with its description, its subtasks and a composer that adds subtasks. In a list, a project row shows how many subtasks are done and an arrow that expands its open subtasks under it, tickable there; which projects are expanded is per device (D25). A subtask appears as its own row in a list only when it is on that list and its project isn't (for example a priced subtask in To buy), tagged with its project's name; in All it always stays under its project. Completing a project completes its open subtasks, after a confirmation; deleting a project deletes its subtasks. Why: the owner separates single actions from projects that grow. Keeping subtasks in the same collection lets sync, backup, pruning (D13) and To buy work for them without special cases.

**D33. Prices and To buy.** Any task or subtask can have a price in euros: a field under the priority in the composer (on every page, All included) and in the editor. "4,50" and "4.50" both work; anything else is refused with a message. Typing a price also ticks To buy, the list with id `buy` (`SHOPPING_LIST`); the tick can be undone. Rows show their price, and a list or project page shows the total of its open priced tasks, including its projects' subtasks. To buy can be renamed but not deleted. Why: the owner wants everything to buy, from every list and project, collected in one place. It stays an ordinary list tag (D8) rather than a computed view, so there is one mechanism, and it shows the same on every device and in backups.

**D34. Priority groups** (supersedes D21). Open tasks are shown in groups, High, Normal and Low, each under a small label with a line; empty groups are left out. High titles are bolder and Low titles grey; there is no highlighter. Why: the owner found the highlighter hard to read.

**D35. List colors are picked from a grid.** Tapping a list's dot in the lists editor opens all 16 `PALETTE` colors under it; tapping one picks it and closes the grid. Why: stepping through the colors one tap at a time was impractical.

**D36. Layout and look** (supersedes D28). On screens 900px and wider, the lists are a full-height sidebar on the left (each with its color and open count, the + below them as "New list", the account links at its foot) and the tasks fill the rest of the window, under the open list's name as a heading. On phones the lists are tabs in a top bar that wrap instead of scrolling sideways, so every list and its count stay in sight and nothing is wider than the screen; tabs reserve their bold width, so switching lists doesn't shift the layout. The look is flat and neutral: white page, grey sidebar, thin lines between tasks, 4–6px corners, small circles, and one segmented control for priority. Why: the owner asked for a more professional, less rounded look that uses the whole screen on a computer.

## Dates, timelines, priority colors and links

**D37. Task fields** (supersedes D31). `title` (string), `lists` (list ids), `prio` (1, 2 or 3), `done` (bool), `created` and `doneAt` (milliseconds from the device clock; `doneAt` is null while open), `project` (bool), `notes` (string: a project's description), `parent` (a subtask's project id, else null), `price` (whole euro cents, or null), `start` and `end` (calendar dates as `YYYY-MM-DD`, or null) and `url` (an `http`/`https` address, or null). Missing or invalid fields get defaults when read (`toTask`), so documents and backups from older versions, or typed into the console, still work. Why the device clock: it works offline and sorts immediately, while a server timestamp stays empty until the write reaches the server. Why cents: totals add up exactly. Why plain calendar dates: a date means the same day on every device, whatever its time zone.

**D38. Dates and the project timeline.** Any task, project or subtask can have a start date, an end date, both or neither, set in the composer or the editor; an end before the start is refused with a message. Rows show them ("3 Oct – 10 Oct", "From 3 Oct", or "Due 10 Oct" for an end alone). A project's page shows a Gantt chart of its dated subtasks: one row each, sorted by start, a bar from start to end in the subtask's priority color (D39), faded when done; the project's own dates, if any, as a thin bar on top; a line for today; a legend when there is more than one priority. A single date is a one-day bar. The axis labels days, weeks (from Monday) or months to fit the span. Undated subtasks are counted under it, and the subtask list below is the full record. Tapping a name or bar opens that subtask. It is plain HTML and CSS, no chart library (D2), and fits a phone without sideways scrolling. Why: the owner plans projects over time and wants to see their parts laid out. Its colors follow the dataviz guidelines: the default priority colors pass the palette validator for every pair, light and dark.

**D39. Priority colors.** High, Normal and Low each have a color (defaults in `PRIOS`: red `#b5473a`, blue `#3b7dd8`, mustard `#b08a14`), stored for all devices as `settings/app.prioColors` next to the lists (D6). Tapping a priority's label in any list opens a grid of the `PALETTE` colors (D35). The color shows as the dot and line of the group labels, the dot in the priority picker and the bars of project timelines; task rows and text are never colored by priority. Why: the owner wanted the levels, not each task, to carry a color they choose.

**D40. Links.** Any task or project can have one web address, set in the composer or the editor. "example.com/page" gets `https://` added; anything that isn't an `http`/`https` address is refused with a message, so a link can never run code (`javascript:`). Rows and project pages show it as the site's name with ↗, opening in a new tab; it sits outside the row's button, so clicking it doesn't open the editor. Why: tasks often point to a page, and the owner had no way to keep one.
