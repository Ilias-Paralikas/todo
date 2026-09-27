// Sign-in and the two live snapshots, tasks and settings (D15). Every change reaches the screen through here.
import { actions } from './actions.js';
import { DEFAULT_LISTS, PRIOS } from './config.js';
import { isColor } from './format.js';
import { ItemSet, listFields } from './models.js';
import { listById, state } from './state.js';
import { store } from './store.js';
import { explain, show, toast } from './views/dom.js';
import { renderPickers } from './views/pickers.js';
import { render } from './views/render.js';

let unwatch = null, offlineTimer, pruned = false;

export function onUser(user) {
  unwatch?.();
  Object.assign(state, { user, items: new ItemSet(), lists: [], loaded: false, listsLoaded: false, offline: false });
  unwatch = user ? store.watch(onTasks, onSettings, err => toast(explain(err))) : null;
  show(user ? 'main' : 'login');
  render();
  renderPickers();
}

export function signOut() {   // stop listening first, so the listeners don't report the lost access
  unwatch?.();
  unwatch = null;
  store.signOut();
}

function onTasks(docs, meta) {
  Object.assign(state, { items: new ItemSet(docs), loaded: true, queued: meta.hasPendingWrites });
  clearTimeout(offlineTimer);
  if (meta.fromCache) {   // every start begins from the on-device copy, so wait before calling it offline (D18)
    offlineTimer = setTimeout(() => { state.offline = true; render(); }, 3000);
  } else {
    state.offline = false;
    if (!pruned) { pruned = true; actions.prune(); }
  }
  render();
}

function onSettings(settings, meta) {
  if (!settings) {   // nothing saved yet. Only the server can say so; the on-device copy may just be empty (D10)
    if (!meta.fromCache) store.saveSettings({ lists: DEFAULT_LISTS });
    return;
  }
  state.lists = (Array.isArray(settings.lists) ? settings.lists : []).map(listFields);
  state.prioColors = PRIOS.map((p, i) => isColor(settings.prioColors?.[i]) ? settings.prioColors[i] : p.color);
  state.listsLoaded = true;
  if (state.view !== 'all' && !listById(state.view)) return actions.setView('all');   // its list was deleted (D25)
  render();
  renderPickers();
}
