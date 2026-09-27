# Working on this repo

This is the owner's personal to-do app. AI agents make most of its changes, so these instructions are for you. Read DECISIONS.md before changing anything.

## The owner's requirements

Every change must keep meeting all of them.

1. Works on laptop and phone, away from home, and syncs automatically.
2. The code stays clean, compact and easy for an agent to read. The owner makes changes through agents.
3. No paid domain and no server to keep alive. Prefer managed free services, even at some cost to customizability.
4. Important decisions and design choices are recorded in DECISIONS.md.
5. As few dependencies as possible, and nothing tied to a subscription or account that could change and break the app (Claude included).
6. No code for the owner: new lists, sections or anything similar are added with a button in the app, never by editing code or asking an LLM.
7. The code is modular. Each kind of thing has its own class, and kinds that overlap share a parent class (tasks, subtasks, projects and sub-projects all extend `Item`). Each file does one job. Reuse existing code, a parent class or a shared helper, instead of writing a second version of it. Never put the whole app in one file.

Also: a task can be on several lists at once, and one priority scale is shared by all lists. A task can grow into a project with its own page, a description and subtasks. Subtasks can be projects too; these open in place, inside their project. To buy collects everything with a price, from every list and project.

## Before you change anything

- Get the current files from the GitHub repository (clone it). Don't work from a copy in chat history; it may be out of date.
- Read DECISIONS.md. If a change would contradict a decision, say so and propose a new decision, instead of quietly working around it.

## Where things are

- `index.html` is the page's markup only. It loads the styles from `css/` and the code from `js/main.js`.
- `js/` is the app, as ES modules the browser loads directly (no build step, D2, D43):
  - `config.js` fixed settings: default lists, colors, priorities, the Firebase SDK version.
  - `format.js` pure helpers for text, prices, links and dates, including `esc()` (D26).
  - `models.js` the classes: `Item`, `Task` → `Subtask`, `Project` → `SubProject`, and `ItemSet`, which builds them from the database and knows how they nest.
  - `repeat.js` the `Repeat` class: how an item repeats, its next date and its calendar rule. `calendar.js` Google Calendar links and .ics files (alerts).
  - `store.js` the only code that talks to Firebase.
  - `state.js` what the app knows right now. `actions.js` every change to the data. `sync.js` sign-in and the live snapshots.
  - `router.js` project pages in the address. `events.js` clicks and forms. `reorder.js` dragging lists into a new order. `main.js` start-up.
  - `views/` builds the HTML: `render.js` the screen, `rows.js` task rows, `project.js` a project page's header, `gantt.js` the timeline, `pickers.js` the list and priority pickers, `editors.js` the dialogs, `fields.js` the dates, price and link fields shared by the composer and the editor, `dom.js` small page helpers.
- `css/` holds the styles: `base.css` (colors, fields, buttons, messages), `layout.css`, `items.css` (composer, rows, project page), `gantt.css`, `dialogs.css`.
- Behaviour that differs between tasks, subtasks, projects and sub-projects goes in their class in `js/models.js`, as a getter or method the subclass overrides. Everywhere else, ask the item (`item.opens`, `item.aside`) instead of checking what kind it is.
- A new file goes in its folder and is imported where it's used. Add it to `SHELL` in `sw.js`, and a new module also to the `modulepreload` links in `index.html`, so it works offline and loads without delay. The tests check both lists.
- `firebase-config.js` holds the owner's Firebase settings. Never edit or replace it.
- `firestore.rules` holds the database security rules. They only take effect once pasted into the Firebase console.
- `sw.js` is the offline support. It lists every file the app needs; bump `VERSION` when you change that list or its caching.
- `manifest.webmanifest`, `icons/` and `fonts/` hold the home-screen details and the typeface.
- `tests/` holds the end-to-end checks. They are not part of the app.

## When you change something

- Record new or changed decisions in DECISIONS.md in the same change. Never renumber; supersede.
- Run `python3 tests/test_app.py` and add checks for new behaviour. It needs Python Playwright with Chromium, and npm for the real-SDK check.
- Hand back only the files you changed, with one line each on what changed. The owner uploads them to GitHub.
- If `firestore.rules` changed, tell the owner to paste it into Firebase console → Firestore Database → Rules and click Publish.
- If the data model changes, old documents must keep working (defaults on read, see D49), and "Restore backup" must still read old backups.
