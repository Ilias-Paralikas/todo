// The list and priority pickers, shared by the composer ('draft') and the editor ('editing'). The composer also
// picks Task or Project; the editor also has Move to.
import { PRIOS, SHOPPING_LIST } from '../config.js';
import { esc } from '../format.js';
import { prioColor, state } from '../state.js';
import { $ } from './dom.js';

function pickersHTML(pick, target) {
  const lists = state.lists.map(l => `<button type="button" class="chip" style="--c:${l.color}" data-act="pickList" data-for="${target}"
    data-list="${esc(l.id)}" aria-pressed="${pick.lists.includes(l.id)}">${esc(l.name)}</button>`).join('');
  const prios = PRIOS.map(p => `<button type="button" class="prio p${p.id}" style="--c:${prioColor(p.id)}" data-act="pickPrio" data-for="${target}"
    data-prio="${p.id}" aria-pressed="${pick.prio === p.id}"><span class="title">${p.label}</span></button>`).join('');
  const kinds = target !== 'draft' ? '' : `<div class="segmented" role="group" aria-label="Add as">${[['Task', false], ['Project', true]]
    .map(([label, project]) => `<button type="button" data-act="pickKind" data-for="draft" data-project="${project}"
      aria-pressed="${pick.project === project}">${label}</button>`).join('')}</div>`;   // add a project straight away (D41)
  const move = target !== 'editing' ? '' : `<select class="field move" aria-label="Move to another list">
    <option value="">Move to…</option>${state.lists.filter(l => l.id !== SHOPPING_LIST)
      .map(l => `<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('')}</select>`;   // D45
  return `<div class="chips" role="group" aria-label="Lists">${lists}</div>
    <div class="pick-row"><div class="prios" role="group" aria-label="Priority">${prios}</div>${kinds}${move}</div>`;
}

export function renderPickers() {
  $('#add-opts').innerHTML = pickersHTML(state.draft, 'draft');
  if (state.editing) $('#edit-opts').innerHTML = pickersHTML(state.editing, 'editing');
}
