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

Also: a task can be on several lists at once, and one priority scale is shared by all lists.

## Before you change anything

- Get the current files from the GitHub repository (clone it). Don't work from a copy in chat history; it may be out of date.
- Read DECISIONS.md. If a change would contradict a decision, say so and propose a new decision, instead of quietly working around it.

## Where things are

- `index.html` is the whole app. Its script has fixed sections, in this order: CONFIG, STORE (the only code that talks to Firebase), STATE & ACTIONS, RENDER, EVENTS, BOOT. Put new code in the matching section.
- `firebase-config.js` holds the owner's Firebase settings. Never edit or replace it.
- `firestore.rules` holds the database security rules. They only take effect once pasted into the Firebase console.
- `sw.js` is the offline support. Bump `VERSION` when you change its caching or file list.
- `manifest.webmanifest`, `icons/` and `fonts/` hold the home-screen details and the typeface.
- `tests/` holds the end-to-end checks. They are not part of the app.

## When you change something

- Record new or changed decisions in DECISIONS.md in the same change. Never renumber; supersede.
- Run `python3 tests/test_app.py` and add checks for new behaviour. It needs Python Playwright with Chromium, and npm for the real-SDK check.
- Hand back only the files you changed, with one line each on what changed. The owner uploads them to GitHub.
- If `firestore.rules` changed, tell the owner to paste it into Firebase console → Firestore Database → Rules and click Publish.
- If the data model changes, old documents must keep working (defaults on read, see D7), and "Restore backup" must still read old backups.
