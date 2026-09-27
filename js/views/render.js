// Draws the main screen from state: the lists, then the open list or project page (D15).
import { esc, euros } from '../format.js';
import { byDoneAt, byPriority } from '../models.js';
import { listById, pageProject, state } from '../state.js';
import { $ } from './dom.js';
import { projectHeadHTML } from './project.js';
import { groupsHTML, rowHTML } from './rows.js';

export function render() {
  keepFocus(() => {
    renderTabs();
    renderItems();
  });
  $('#status').hidden = !state.offline;
  $('#status').textContent = state.queued ? 'Offline. Your changes will sync when you reconnect.' : 'Offline. Showing your last synced list.';
  $('#who').textContent = state.user?.email ? `Signed in as ${state.user.email}` : '';
}

function renderTabs() {   // each list with its color and open count, then the + (D9, D36)
  $('#tabs').innerHTML = [{ id: 'all', name: 'All', color: 'var(--ink)' }, ...state.lists].map(list => {
    const n = state.items.rowsIn(list.id).filter(item => !item.done && item.matches(state.show)).length;
    return `<button class="tab" data-act="view" data-view="${esc(list.id)}" style="--c:${list.color}" ${list.id === state.view ? 'aria-current="page"' : ''}>
      <span class="dot"></span><span class="tab-name" data-text="${esc(list.name)}">${esc(list.name)}</span>${n ? `<span class="count">${n}</span>` : ''}</button>`;
  }).join('') + (state.listsLoaded ? `<button class="tab-add" data-act="editLists" aria-label="Add or edit lists" title="Add or edit lists">
      +<span class="add-label">New list</span></button>` : '');
}

function renderItems() {   // the open list's rows, or the open project's items
  const current = listById(state.view), project = pageProject();
  $('#heading').textContent = current?.name ?? 'All';   // shown on wide screens, where the lists are a sidebar (D36)
  $('.toolbar').hidden = Boolean(project);   // lists only: a project page has its own header
  for (const button of $('#show').children) button.setAttribute('aria-pressed', button.dataset.show === state.show);
  $('#add-title').placeholder = project ? 'Add a subtask' : current ? `Add to ${current.name}` : 'Add a task';
  $('#project-head').hidden = !project;
  if (project) $('#project-head').innerHTML = projectHeadHTML(project);

  const shown = project ? project.children : state.items.rowsIn(state.view).filter(item => item.matches(state.show));
  const todo = shown.filter(item => !item.done).sort(byPriority);
  const done = shown.filter(item => item.done).sort(byDoneAt);
  $('#list').innerHTML = !state.loaded ? '' : todo.length ? groupsHTML(todo) : `<li class="empty">${project ? 'No subtasks yet. Add one above.'
    : state.show !== 'all' ? `No ${state.show} ${current ? `in ${esc(current.name)}` : 'here'}.`
    : `${current ? `Nothing in ${esc(current.name)}.` : 'Nothing to do.'} Add a task above.`}</li>`;
  const priced = [...todo, ...todo.flatMap(item => item.openChildren)].filter(item => item.price !== null);
  $('#total').hidden = !priced.length;   // D33
  $('#total').textContent = `Total ${euros(priced.reduce((sum, item) => sum + item.price, 0))}`;
  $('#done-box').hidden = !done.length;
  $('#done-summary').textContent = `Done (${done.length})`;
  $('#done-list').innerHTML = done.map(item => rowHTML(item)).join('');
}

// Drawing replaces the rows, so put focus back where it was: on the same row button, or in the same
// add field inside a sub-project, with what was typed in it (D44).
function keepFocus(draw) {
  const el = document.activeElement, form = el?.closest('.sub-add');
  const selector = form ? `.sub-add[data-parent="${CSS.escape(form.dataset.parent)}"] input`
    : el?.matches('.body, .expand') ? `.${el.classList[0]}[data-id="${CSS.escape(el.dataset.id)}"]` : null;
  draw();
  const again = selector && document.querySelector(selector);
  if (!again || again === el) return;
  if (form) again.value = el.value;
  again.focus({ preventScroll: true });
}
