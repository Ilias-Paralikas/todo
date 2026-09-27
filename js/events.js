// Clicks and forms. Buttons say what they do with data-act="…"; each name is a handler in `clicks`.
import { actions } from './actions.js';
import { SHOPPING_LIST } from './config.js';
import { parsePrice, parseUrl } from './format.js';
import { closeProject, openProject, route } from './router.js';
import { listById, state } from './state.js';
import { signOut } from './sync.js';
import { store } from './store.js';
import { $, explain, toast } from './views/dom.js';
import { addDraftList, openEditor, openListsEditor, openPrioEditor, renderListsEditor } from './views/editors.js';
import { renderPickers } from './views/pickers.js';

const insideOf = id => state.items.get(id)?.contents ?? [];

const clicks = {
  view: el => actions.setView(el.dataset.view),
  toggle: el => {   // show the tick first, then move the item (D24)
    const ticking = el.getAttribute('aria-checked') !== 'true', open = insideOf(el.dataset.id).filter(item => !item.done).length;
    if (ticking && open && !confirm(`Complete this project and the ${open} open item${open > 1 ? 's' : ''} in it?`)) return;
    el.setAttribute('aria-checked', ticking);
    setTimeout(() => actions.toggle(el.dataset.id), 350);
  },
  edit: el => openEditor(el.dataset.id),
  open: el => openProject(el.dataset.id),
  expand: el => actions.expand(el.dataset.id),
  back: () => closeProject(),
  show: el => actions.setShow(el.dataset.show),
  pickKind: el => {   // add as a task or a project (D41)
    state.draft.project = el.dataset.project === 'true';
    pressOnly(el);
  },
  pickList: el => {
    const pick = state[el.dataset.for], id = el.dataset.list;
    pick.lists = pick.lists.includes(id) ? pick.lists.filter(l => l !== id) : [...pick.lists, id];
    el.setAttribute('aria-pressed', pick.lists.includes(id));
    keepTyping(el);
  },
  pickPrio: el => {
    state[el.dataset.for].prio = Number(el.dataset.prio);
    pressOnly(el);
  },
  makeProject: () => { const { id } = state.editing; $('#editor').close(); actions.makeProject(id); },
  deleteTask: () => {
    const n = insideOf(state.editing.id).length;
    if (!confirm(`Delete "${$('#edit-title').value}"${n ? ` and the ${n} item${n > 1 ? 's' : ''} in it` : ''}?`)) return;
    actions.remove(state.editing.id);
    $('#editor').close();
  },
  close: el => el.closest('dialog').close(),
  editLists: () => openListsEditor(),
  addList: () => addDraftList(),
  pickColor: el => {   // open or close this list's color grid (D35)
    const i = Number(el.dataset.i);
    state.picking = state.picking === i ? null : i;
    renderListsEditor();
    const row = $('#lists-rows').children[i];
    (row.querySelector('.colors [aria-pressed="true"]') ?? row.querySelector('.colors button') ?? row.querySelector('.swatch')).focus();
  },
  setColor: el => {
    const i = Number(el.dataset.i);
    state.listsDraft[i].color = el.dataset.color;
    state.picking = null;
    renderListsEditor();
    $('#lists-rows').children[i].querySelector('.swatch').focus();
  },
  moveList: el => {
    const i = Number(el.dataset.i), j = i + Number(el.dataset.by), rows = state.listsDraft;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    state.picking = null;
    renderListsEditor();
    const row = $('#lists-rows').children[j];   // keep focus on the moved list
    (row.querySelector(`[data-by="${el.dataset.by}"]:enabled`) ?? row.querySelector('.swatch')).focus();
  },
  dropList: el => { state.listsDraft.splice(Number(el.dataset.i), 1); state.picking = null; renderListsEditor(); },
  prioColor: el => openPrioEditor(Number(el.dataset.prio)),   // D39
  setPrioColor: el => { actions.setPrioColor(Number(el.dataset.prio), el.dataset.color); $('#prio-editor').close(); },
  backup: () => actions.backup(),
  restore: () => $('#restore-file').click(),
  signout: () => signOut(),
};

function pressOnly(el) {   // a one-of-several choice: press this button, release the others
  for (const button of el.parentElement.children) button.setAttribute('aria-pressed', button === el);
  keepTyping(el);
}
// On a computer, put focus back in the new-task field so Enter still adds. (On a phone that would reopen the keyboard.)
const keepTyping = el => { if (el.dataset.for === 'draft' && matchMedia('(pointer: fine)').matches) $('#add-title').focus(); };

function readExtras(form) {   // price, dates and link of the composer ('add') or the editor ('edit'); undefined after showing what's wrong
  const field = name => $(`#${form}-${name}`);
  const extras = { price: parsePrice(field('price').value), start: field('start').value || null, end: field('end').value || null,
                   url: parseUrl(field('url').value) };
  field('price').setCustomValidity(Number.isNaN(extras.price) ? 'Write the price as a number, like 4.50' : '');
  field('end').setCustomValidity(extras.start && extras.end && extras.end < extras.start ? 'The end is before the start' : '');
  field('url').setCustomValidity(extras.url === false ? 'Write a web address, like example.com/page' : '');
  return ['price', 'end', 'url'].every(name => field(name).reportValidity()) ? extras : undefined;
}

export function listen() {
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-act]');
    if (el) clicks[el.dataset.act](el);
  });
  addEventListener('hashchange', route);

  // The composer
  $('#add-title').addEventListener('input', event => $('#add').classList.toggle('typing', event.target.value.trim() !== ''));
  $('#add').addEventListener('submit', event => {
    event.preventDefault();
    const extras = readExtras('add');
    if (!extras || !actions.add($('#add-title').value, extras)) return;
    for (const name of ['title', 'price', 'start', 'end', 'url']) $(`#add-${name}`).value = '';
    $('#add').classList.remove('typing');
    renderPickers();
  });
  document.addEventListener('submit', event => {   // the field inside an open sub-project (D44)
    const form = event.target.closest('.sub-add');
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector('input'), title = input.value;
    input.value = '';   // before the snapshot redraws it
    if (!actions.addTo(form.dataset.parent, title)) input.value = title;
  });

  // Prices, dates and links (composer and editor), then the item editor
  for (const [field, target] of [['#add-price', 'draft'], ['#edit-price', 'editing']]) {
    let before = '';
    $(field).addEventListener('focus', event => { before = event.target.value.trim(); });
    $(field).addEventListener('input', event => {   // typing a price ticks To buy; untick it if you like (D33)
      const now = event.target.value.trim(), pick = state[target];
      event.target.setCustomValidity('');
      if (!before && now && listById(SHOPPING_LIST) && !pick.lists.includes(SHOPPING_LIST)) {
        pick.lists = [...pick.lists, SHOPPING_LIST];
        renderPickers();
      }
      before = now;
    });
  }
  for (const field of ['#add-end', '#add-url', '#edit-end', '#edit-url']) $(field).addEventListener('input', event => event.target.setCustomValidity(''));
  $('#edit-form').addEventListener('submit', event => {
    event.preventDefault();
    const extras = readExtras('edit');
    if (!extras) return;
    const { id, lists, prio } = state.editing;
    if (actions.save(id, { title: $('#edit-title').value, notes: $('#edit-notes').value, lists, prio, ...extras })) $('#editor').close();
  });
  $('#editor').addEventListener('close', () => { state.editing = null; });

  // The lists editor
  $('#lists-rows').addEventListener('input', event => { state.listsDraft[event.target.dataset.i].name = event.target.value; });
  $('#lists-form').addEventListener('submit', event => {
    event.preventDefault();
    if (actions.saveLists(state.listsDraft)) $('#lists-editor').close();
  });
  $('#lists-editor').addEventListener('close', () => { state.listsDraft = null; });

  // Backup and sign-in
  $('#restore-file').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';   // so picking the same file again still works
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast("That file isn't a Todo backup."); }
    actions.restore(data);
  });
  $('#login').addEventListener('submit', async event => {
    event.preventDefault();
    const { email, password } = event.target.elements, button = event.target.querySelector('button');
    $('#login-error').textContent = '';
    button.disabled = true;
    try { await store.signIn(email.value.trim(), password.value); }
    catch (err) { $('#login-error').textContent = explain(err); }
    finally { button.disabled = false; }
  });
}
