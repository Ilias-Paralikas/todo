// Every change to the data goes through here. The screen updates only from snapshots, our own writes
// included (D15): action → store → snapshot → render(). A few actions change only this device's view.
import { DONE_TTL_DAYS } from './config.js';
import { datesText, moved, today } from './format.js';
import { fields, listFields } from './models.js';
import { Repeat } from './repeat.js';
import { closeProject, openProject } from './router.js';
import { freshDraft, listById, local, pageProject, state } from './state.js';
import { store } from './store.js';
import { download, toast } from './views/dom.js';
import { renderPickers } from './views/pickers.js';
import { render } from './views/render.js';

function create(title, data) {   // a new item; fields() fills in the rest (D49)
  title = title.trim();
  if (!title) return false;
  store.add(fields({ ...data, title, created: Date.now() }));
  return true;
}
// A repeating item's dates go on its first occurrence, or today's when it has none (D50).
const scheduled = values => values.repeat ? { ...values, ...new Repeat(values.repeat).align(values, today()) } : values;

export const actions = {
  setView(view) {
    state.view = view;
    local.set('view', view);
    if (state.project) return closeProject();
    state.draft = freshDraft();
    render();
    renderPickers();
  },
  setShow(show) { state.show = show; local.set('show', show); render(); },   // D42
  toggleSide() {   // D48
    state.sideHidden = !state.sideHidden;
    local.set('side', state.sideHidden ? 'hidden' : 'shown');
    render();
  },
  expand(id, open = !state.expanded.has(id)) {   // a project's arrow, or tapping a sub-project (D32, D44)
    open ? state.expanded.add(id) : state.expanded.delete(id);
    local.set('expanded', JSON.stringify([...state.expanded].filter(kept => state.items.get(kept))));
    render();
  },
  add(title, extras) {   // from the composer, into the open list or project. extras: readFields() in views/fields.js
    const { lists, prio, project } = state.draft;
    if (!create(title, { lists, prio, project, parent: pageProject()?.id ?? null, ...scheduled(extras) })) return false;
    state.draft = freshDraft();
    return true;
  },
  addTo(parent, title) { return create(title, { parent }); },   // from the field inside a sub-project (D44)
  toggle(id) {   // the item decides: done, or on to its next date if it repeats (models.js, D50)
    const item = state.items.get(id);
    if (!item) return;
    const patches = item.ticked();
    store.patchMany(patches);
    if (item.repeating && !item.done) toast(`Done. Next: ${datesText({ ...item, ...patches[0] })}`);
  },
  save(id, { title, notes, lists, prio, price, start, end, url, time, repeat }) {   // returns what was saved, or false
    title = title.trim();
    if (!title) return false;
    const dates = scheduled({ start, end, repeat });
    const saved = { title, notes, lists, prio, price, url, time, repeat: Repeat.fields(repeat), start: dates.start, end: dates.end };
    store.patch(id, saved);
    return saved;
  },
  makeProject(id) {   // a top-level task opens as a project page; a subtask becomes a sub-project, open in place (D41, D44)
    const item = state.items.get(id);
    if (!item) return;
    store.patch(id, { project: true });
    item.parentProject ? actions.expand(id, true) : openProject(id);
  },
  remove(id) {   // a project goes with everything inside it (D41)
    const item = state.items.get(id);
    if (item) store.removeMany([item, ...item.contents].map(inner => inner.id));
  },
  setPrioColor(id, color) {   // D39
    const prioColors = [...state.prioColors];
    prioColors[id - 1] = color;
    store.saveSettings({ prioColors });
  },
  saveLists(draft) {   // D9, D11
    const before = new Map(state.lists.map(list => [list.id, list]));
    const lists = draft.map(list => ({ ...list, name: list.name.trim() || before.get(list.id)?.name || '' }))
      .filter(list => list.name);   // a blank new list isn't created; a blanked old one keeps its name
    const gone = state.lists.filter(list => !lists.some(kept => kept.id === list.id));
    if (gone.length && !confirm(`Delete ${gone.map(list => `"${list.name}"`).join(', ')}? `
      + 'Their tasks stay in All and in any other lists they are on.')) return false;
    store.saveSettings({ lists });
    return true;
  },
  moveList(id, target, after) {   // dragged before or after another list (D46)
    const from = state.lists.findIndex(list => list.id === id), at = state.lists.findIndex(list => list.id === target);
    if (from < 0 || at < 0 || id === target) return;
    const to = at + (after ? 1 : 0) - (from < at ? 1 : 0);   // its place once it has left its old one
    if (to !== from) store.saveSettings({ lists: moved(state.lists, from, to) });
  },
  prune() {   // D13
    const cutoff = Date.now() - DONE_TTL_DAYS * 864e5;
    const old = state.items.all.filter(item => item.done && item.doneAt && item.doneAt < cutoff);
    if (old.length) store.removeMany(old.map(item => item.id));
  },
  backup() {   // D20. Items turn into exactly their stored fields (models.js).
    const data = { app: 'todo', exportedAt: new Date().toISOString(), lists: state.lists, tasks: state.items.all };
    download(`todo-backup-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data, null, 1), 'application/json');
  },
  restore(data) {   // merge: adds missing lists, writes tasks by id, deletes nothing (D20)
    if (!state.listsLoaded) return toast('Your lists are still loading. Try again in a moment.');
    const tasks = (Array.isArray(data?.tasks) ? data.tasks : [])
      .filter(t => typeof t?.id === 'string' && /^[^/]+$/.test(t.id) && typeof t.title === 'string').map(t => ({ id: t.id, ...fields(t) }));
    const lists = (Array.isArray(data?.lists) ? data.lists : [])
      .filter(l => typeof l?.id === 'string' && l.id !== 'all' && typeof l.name === 'string').map(listFields);
    if (!tasks.length && !lists.length) return toast("That file isn't a Todo backup.");
    if (!confirm(`Restore ${tasks.length} tasks and ${lists.length} lists from this backup? `
      + 'Tasks with the same id are replaced. Nothing is deleted.')) return;
    store.saveSettings({ lists: [...state.lists, ...lists.filter(list => !listById(list.id))] });
    store.putMany(tasks);
    toast(`Restored ${tasks.length} tasks and ${lists.length} lists.`);
  },
};
