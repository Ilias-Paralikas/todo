// The dialogs: the item editor, the lists editor and the priority color grid.
import { PALETTE, PRIOS, SHOPPING_LIST } from '../config.js';
import { esc, lastDoneText } from '../format.js';
import { prioColor, state } from '../state.js';
import { $ } from './dom.js';
import { fillFields } from './fields.js';
import { renderPickers } from './pickers.js';

export function openEditor(id) {
  const item = state.items.get(id);
  if (!item) return;
  state.editing = { id, lists: [...item.lists], prio: item.prio };
  $('#edit-heading').textContent = `Edit ${item.noun}`;
  $('#edit-title').value = item.title;
  $('#edit-notes').value = item.notes;
  $('#edit-notes').hidden = !item.hasDescription;              // projects have a description (D32)
  fillFields('edit', item);
  $('#edit-last').hidden = !(item.repeating && item.lastDone);   // D50
  $('#edit-last').textContent = item.lastDone ? lastDoneText(item.lastDone) : '';
  $('#make-project').hidden = !item.canBecomeProject;          // tasks and subtasks (D41)
  renderPickers();
  $('#editor').showModal();
  $('#edit-opts .chip, #edit-opts .prio').focus();   // a button, not the text field, so phones don't pop up the keyboard
}

export function openListsEditor() {
  state.listsDraft = state.lists.map(list => ({ ...list }));
  state.picking = null;
  $('#lists-editor').showModal();
  addDraftList();   // "+" means add: start with an empty row. Blank rows are dropped on save (D9)
}

export function renderListsEditor() {
  const last = state.listsDraft.length - 1;
  $('#lists-rows').innerHTML = state.listsDraft.map((list, i) => `<li class="list-row">
    <button type="button" class="swatch" style="--c:${list.color}" data-act="pickColor" data-i="${i}" aria-label="Change color" aria-expanded="${state.picking === i}"></button>
    <input class="field" data-i="${i}" value="${esc(list.name)}" placeholder="New list" aria-label="List name" maxlength="40" autocomplete="off" enterkeyhint="done">
    <button type="button" class="icon-btn" data-act="moveList" data-i="${i}" data-by="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="icon-btn" data-act="moveList" data-i="${i}" data-by="1" aria-label="Move down" ${i === last ? 'disabled' : ''}>↓</button>
    <button type="button" class="icon-btn" data-act="dropList" data-i="${i}" aria-label="Delete list" ${list.id === SHOPPING_LIST ? 'disabled' : ''}>×</button>
    ${state.picking === i ? `<div class="colors" role="group" aria-label="Colors">${colorButtons(list.color, `data-act="setColor" data-i="${i}"`)}</div>` : ''}
  </li>`).join('');
}

export function addDraftList() {
  const used = state.listsDraft.map(list => list.color);
  const color = PALETTE.find(c => !used.includes(c)) ?? PALETTE[used.length % PALETTE.length];
  state.listsDraft.push({ id: crypto.randomUUID().slice(0, 8), name: '', color });
  renderListsEditor();
  $('#lists-rows li:last-child input').focus();
}

export function openPrioEditor(id) {   // a priority's label opens its color grid (D39)
  $('#prio-heading').textContent = `${PRIOS[id - 1].label} priority color`;
  $('#prio-colors').innerHTML = colorButtons(prioColor(id), `data-act="setPrioColor" data-prio="${id}"`);
  $('#prio-editor').showModal();
  ($('#prio-colors [aria-pressed="true"]') ?? $('#prio-colors button')).focus();
}

// One button per PALETTE color, for a list (D35) or a priority (D39). attrs says what a tap does.
const colorButtons = (picked, attrs) => PALETTE.map((color, n) => `<button type="button" style="--c:${color}" ${attrs}
  data-color="${color}" aria-label="Color ${n + 1}" aria-pressed="${color === picked}"></button>`).join('');
