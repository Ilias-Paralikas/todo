// What the app knows right now. The data parts are replaced by each snapshot (D15); the rest is this device's view.
import { DEFAULT_PRIO, PRIOS } from './config.js';
import { ItemSet } from './models.js';

export const local = {   // per-device settings, not synced (D25)
  get: key => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch {} },
};
const readSet = key => { try { return new Set(JSON.parse(local.get(key)) ?? []); } catch { return new Set(); } };

export const state = {
  user: null,
  items: new ItemSet(),   // every task and project, from the latest snapshot
  lists: [],              // list definitions, in tab order (D9)
  loaded: false,          // first task snapshot has arrived
  listsLoaded: false,     // lists are known (from the on-device copy or the server)
  offline: false,         // snapshots have come from the on-device copy for 3+ seconds (D18)
  queued: false,          // local changes the server hasn't confirmed yet
  view: local.get('view') || 'all',   // checked once the lists are known (D25)
  show: ['tasks', 'projects'].includes(local.get('show')) ? local.get('show') : 'all',   // lists show everything, tasks or projects (D42)
  project: null,          // the id in the URL, #p=<id> (D32)
  expanded: readSet('expanded'),   // projects and sub-projects open in the lists, per device (D25, D32, D44)
  draft: null,            // composer picks: { lists, prio, project }
  editing: null,          // task editor: { id, lists, prio }
  listsDraft: null,       // lists editor: working copy of state.lists
  picking: null,          // lists editor: the row whose color grid is open (D35)
  prioColors: PRIOS.map(p => p.color),   // from settings/app, synced (D39)
};

export const listById = id => state.lists.find(list => list.id === id);
export const prioColor = id => state.prioColors[id - 1];
// The project whose page is open (D32). A link to something inside a project shows that project's page,
// because sub-projects open in place (D44).
export const pageProject = () => { const item = state.project && state.items.get(state.project)?.top; return item?.hasPage ? item : null; };
export const freshDraft = () => ({ lists: state.project || state.view === 'all' ? [] : [state.view], prio: DEFAULT_PRIO, project: false });
state.draft = freshDraft();
