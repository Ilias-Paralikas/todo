// What is on your lists, as classes (D43). Every item is a task or a project; inside a project it is a
// subtask or a sub-project. What differs between them lives here, as a getter or method a subclass
// overrides, so the rest of the code asks an item (item.opens, item.aside, …) instead of checking its kind.
//
//   Item ─┬─ Task ──── Subtask        Subtask and SubProject also share Nested:
//         └─ Project ─ SubProject     what everything inside a project has in common.
import { DEFAULT_PRIO, PALETTE, PRIOS } from './config.js';
import { dayOf, euros, isColor, isDay } from './format.js';

// A stored item's fields, with defaults for missing or malformed ones (D37), so documents and backups from
// older versions, or typed into the console, still work. Exactly these fields are stored.
const text = value => typeof value === 'string' ? value : '';
export const fields = raw => ({
  title: text(raw.title),
  lists: Array.isArray(raw.lists) ? raw.lists.filter(id => typeof id === 'string') : [],
  prio: PRIOS.some(p => p.id === raw.prio) ? raw.prio : DEFAULT_PRIO,
  done: raw.done === true,
  created: Number.isFinite(raw.created) ? raw.created : 0,
  doneAt: Number.isFinite(raw.doneAt) ? raw.doneAt : null,
  project: raw.project === true,
  notes: text(raw.notes),
  parent: text(raw.parent) || null,
  price: Number.isInteger(raw.price) && raw.price >= 0 ? raw.price : null,
  start: isDay(raw.start) ? raw.start : null,
  end: isDay(raw.end) ? raw.end : null,
  url: typeof raw.url === 'string' && /^https?:\/\/\S+$/i.test(raw.url) ? raw.url : null,
});
// A list definition (D9). Its color goes into style attributes, so only #rrggbb (D26).
export const listFields = raw => ({ id: String(raw.id), name: String(raw.name ?? ''), color: isColor(raw.color) ? raw.color : PALETTE[0] });

export const byPriority = (a, b) => a.prio - b.prio || b.created - a.created;   // D12
export const byDoneAt = (a, b) => b.doneAt - a.doneAt;                          // most recently done first

export class Item {
  #set;   // the ItemSet it belongs to, which knows how items nest. Private, so it stays out of backups.
  constructor(id, data, set) {
    Object.assign(this, { id, ...data });   // own properties are exactly the stored fields
    this.#set = set;
  }
  get parentProject() { return this.#set.parentOf(this); }          // the project it is in, or null
  get children() { return this.#set.childrenOf(this); }             // what is directly inside it (nothing, for a task)
  get openChildren() { return this.children.filter(child => !child.done).sort(byPriority); }
  get doneChildren() { return this.children.filter(child => child.done).sort(byDoneAt); }
  get contents() { return this.children.flatMap(child => [child, ...child.contents]); }   // everything inside it, at every level
  get top() { return this.parentProject?.top ?? this; }             // the top-level item it is in, or itself
  get hasPage() { return this.opens === 'open'; }
  get expandable() { return false; }                                // has an arrow in a list
  get hasDescription() { return false; }
  get canBecomeProject() { return false; }
  get aside() { return this.price === null ? '' : euros(this.price); }   // the note at the end of its row
  get ownSpan() {   // its own dates as whole days, or null (D38). A single date is a one-day span.
    return this.start || this.end ? { from: dayOf(this.start ?? this.end), to: dayOf(this.end ?? this.start) } : null;
  }
  get span() { return this.ownSpan; }                               // where it sits on a timeline
  isOn(list) { return list === 'all' || this.lists.includes(list); }
  isRowIn(list) { return this.isOn(list); }                         // shown as a row of its own in that list
  matches(show) { return show === 'all' || show === `${this.kind}s`; }   // the Everything / Tasks / Projects filter (D42)
}

export class Task extends Item {   // a single action
  get noun() { return 'task'; }
  get kind() { return 'task'; }
  get opens() { return 'edit'; }                 // tapping it opens the editor
  get canBecomeProject() { return true; }       // "Make it a project" (D32, D41)
}

export class Project extends Item {   // a description, and items inside it: subtasks and sub-projects (D32, D41)
  get noun() { return 'project'; }
  get kind() { return 'project'; }
  get opens() { return 'open'; }                 // its own page, #p=<id>
  get hasDescription() { return true; }
  get unfolded() { return this.openChildren; }  // what shows under it when expanded
  get expandable() { return !this.done && this.openChildren.length > 0; }
  get aside() {   // progress: done / all
    const n = this.children.length;
    return n ? `${n - this.openChildren.length}/${n}` : 'Project';
  }
  get span() {   // without dates of its own, a project spans the dated things inside it (D41)
    const inner = this.contents.map(item => item.ownSpan).filter(Boolean);
    return this.ownSpan ?? (inner.length ? { from: Math.min(...inner.map(s => s.from)), to: Math.max(...inner.map(s => s.to)) } : null);
  }
}

// What subtasks and sub-projects share: they live inside a project.
const Nested = Base => class extends Base {
  isRowIn(list) { return super.isRowIn(list) && !this.parentProject.isOn(list); }   // otherwise it shows inside its project (D32)
};

export class Subtask extends Nested(Task) {
  get noun() { return 'subtask'; }
}

export class SubProject extends Nested(Project) {   // opens in place, inside its project, never on a page of its own (D44)
  get noun() { return 'sub-project'; }
  get opens() { return 'expand'; }
  get expandable() { return true; }             // even when empty: it holds its description and an add field
  get unfolded() { return [...this.openChildren, ...this.doneChildren]; }   // done items too, struck through
}

const classFor = (project, nested) => project ? (nested ? SubProject : Project) : (nested ? Subtask : Task);

// The id of the project an item is in (D41): none if its parent is missing or not a project, or if following parents loops back.
function projectOf(id, data, all) {
  if (!all.get(data.parent)?.project) return null;
  for (let up = data.parent, seen = new Set([id]); up; up = all.get(up)?.parent) {
    if (seen.has(up)) return null;
    seen.add(up);
  }
  return data.parent;
}

export class ItemSet {   // every item from one snapshot, each as the class its fields call for, and how they nest
  #byId; #parents = new Map(); #children = new Map();
  constructor(docs = []) {
    const all = new Map(docs.map(doc => [doc.id, fields(doc)]));
    const parentIds = new Map([...all].map(([id, data]) => [id, projectOf(id, data, all)]));
    this.all = [...all].map(([id, data]) => new (classFor(data.project, parentIds.get(id) !== null))(id, data, this));
    this.#byId = new Map(this.all.map(item => [item.id, item]));
    for (const item of this.all) {
      const parent = this.#byId.get(parentIds.get(item.id));
      if (!parent) continue;
      this.#parents.set(item, parent);
      this.#children.set(parent, [...this.childrenOf(parent), item]);
    }
  }
  get(id) { return this.#byId.get(id); }
  parentOf(item) { return this.#parents.get(item) ?? null; }
  childrenOf(item) { return [...(this.#children.get(item) ?? [])]; }
  rowsIn(list) { return this.all.filter(item => item.isRowIn(list)); }   // a list's rows (D32)
}
