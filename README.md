# Todo

Your to-do lists on laptop and phone. A task can be on several lists at once, one priority scale covers all of them, and you add or change lists with the + after them. It works offline and syncs when you reconnect.

It runs as static files on GitHub Pages, with Firebase's free plan for sign-in and data: no domain, no server, no subscription. Setup takes 30 to 45 minutes, once.

## What's in here

| File | What it is |
|---|---|
| `index.html` | The page itself |
| `js/`, `css/` | The app's code and styles, one file per job |
| `firebase-config.js` | Your Firebase project settings (step 2) |
| `firestore.rules` | Who may read and write your data (step 5) |
| `sw.js` | Lets the app open without a connection |
| `manifest.webmanifest`, `icons/` | Name and icon for the home screen |
| `fonts/` | The typeface and its license |
| `AGENTS.md`, `DECISIONS.md` | Instructions for AI agents, and why things are built this way |
| `tests/` | Automated checks used when changing the code. The app doesn't need them |

## Setup

### 1. Create a Firebase project

Go to [console.firebase.google.com](https://console.firebase.google.com), sign in with a Google account and create a project (any name, for example "todo"). You don't need Google Analytics, so turn it off. New projects are on the free Spark plan. Never add a billing account: without one, going over a free limit stops the app until the limit resets instead of charging you.

### 2. Connect the app to the project

On the project's overview page, add a Web app (the `</>` icon). Give it any nickname, leave Firebase Hosting unticked, and register it. Firebase then shows a block that starts with `const firebaseConfig = {`. Open `firebase-config.js` and replace the placeholder `{ ... }` with the one from that block. You can find it again later under Project settings → General → Your apps.

### 3. Turn on sign-in and create your account

Open Build → Authentication and click Get started. Under Sign-in method, enable Email/Password (leave "Email link" off). Under Users, click Add user and enter your email and a strong password. Then copy the User UID from the users table.

### 4. Create the database

Open Build → Firestore Database and click Create database. If you're asked for an edition, choose Standard. Pick a location near you (it can't be changed later) and start in production mode.

### 5. Lock the database to your account

In `firestore.rules`, replace `OWNER_UID` with the UID from step 3 (keep the quotes). Then open Firestore Database → Rules in the console, replace everything there with the file's contents, and click Publish.

### 6. Put the app online

On GitHub, create a new repository named `todo`. Make it Public, because GitHub Pages on a free account needs that. Only the code becomes public; your tasks stay in Firebase, locked by step 5. On the new repository's page, click "uploading an existing file", drag in everything from this folder (folders included), and click Commit changes.

Then open Settings → Pages. Under Build and deployment, choose Source: Deploy from a branch, Branch: `main`, folder `/ (root)`, and click Save. After a minute or two the app is live at `https://YOUR-USERNAME.github.io/todo/`.

### 7. Open it on your devices

Open the link on each device and sign in. On a phone, also add it to the home screen: on iPhone, Safari's Share button → Add to Home Screen; on Android, Chrome's menu → Add to home screen or Install app. The home-screen app keeps its own storage, so sign in once more inside it. Your four starting lists appear after the first sign-in.

Offline use: once a device has opened the app twice while online, it also opens without a connection. Changes you make offline sync when you're back online.

## Everyday use

- **Add a task** in the field at the top. It goes into the open list. To also put it on other lists, change its priority, or give it a price, start and end dates or a link, use the options below the field before adding. Each list shows its High, Normal and Low tasks in separate groups.
- **Complete a task** by tapping its circle. Tap the text to edit it, change its lists, priority, price, dates or link, or delete it. A link shows as the site's name with ↗; tap it to open the page.
- **Projects** are for things with several steps. Open a task and tap **Make it a project**, or choose **Project** under the field when adding. Tapping a project opens its own page, with a description (**Edit**) and its subtasks; add subtasks there. A project can contain projects too, as deep as you like. Tapping one of those sub-projects opens it right where it is, instead of on a page of its own: you see its description and everything in it, and a field that adds to it, with its **Edit** button next to it. Tap it again to close it. In a list, the arrow next to a project shows what's inside, and you can tick things off right there. Completing a project completes everything inside it; deleting it deletes everything inside it.
- **Everything / Tasks / Projects** next to the list's name shows only single tasks or only projects, in every list. Each device remembers your choice.
- **Timeline**: give a project's subtasks start and end dates, and its page shows them as a Gantt chart, with a line for today. Tap a bar to edit that subtask.
- **Priority colors**: tap **High**, **Normal** or **Low** above a group of tasks to pick its color. It colors those labels, the priority buttons and the timeline bars, on all your devices.
- **Prices**: typing a price also puts the task on **To buy**, so everything you need to buy, from every list and project, ends up there. Each list shows the total of its open tasks with a price.
- **Add a list** with the + after the lists (**New list** in the sidebar on a computer). The same screen renames lists (edit the name), recolors them (tap the dot, then a color), reorders them (arrows) and deletes them (×). Deleting a list never deletes its tasks. To buy can't be deleted, because it collects everything with a price.
- **Done** keeps completed tasks for 30 days, then deletes them.
- **Download backup** (at the bottom) saves all lists and tasks to a file. The app doesn't back itself up, so do this now and then. **Restore backup** reads such a file back in; it adds and replaces, but never deletes.

## Changing the app

Ask Claude, or any coding agent, for the change. It should fetch the current code from your GitHub repository, follow `AGENTS.md`, and give you only the files that changed. Upload those to the repository (Add file → Upload files → Commit changes). Each device picks up the new version the next time it opens the app while online.

Never replace `firebase-config.js` with a copy from an agent. If `firestore.rules` changed, also paste it into Firebase console → Firestore Database → Rules and click Publish.

## If something's wrong

- **"Wrong email or password."** Check the account under Authentication → Users. You can reset the password there.
- **"The database refused access."** The rules from step 5 aren't published, or the UID in them doesn't match your account.
- **"Add your Firebase settings to firebase-config.js."** Step 2 isn't done, or the file wasn't uploaded.
- **"Couldn't load Firebase."** This device hasn't saved a copy of the app yet. Open it once while online.
- **An update doesn't show.** Close the app and open it again while online. On a laptop, Ctrl+Shift+R (Cmd+Shift+R on a Mac) reloads everything.

## Moving to another Firebase project

If your Google account or Firebase's free plan ever changes, you can move without touching code. Download a backup, then do setup steps 1 to 5 in a new project and upload the new `firebase-config.js`. Sign in, and use Restore backup.
