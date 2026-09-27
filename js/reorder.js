// Drag a list above or below another to reorder the lists (D46). It uses the browser's own drag and drop:
// a mouse on a computer, and a long press on phones and tablets that support it. The lists editor's arrows still work.
import { actions } from './actions.js';
import { $ } from './views/dom.js';

export function listenForListDrags() {
  const tabs = $('#tabs');
  let dragged = null;   // the id of the list being dragged
  const unmark = () => { for (const tab of tabs.querySelectorAll('.drop-before, .drop-after')) tab.classList.remove('drop-before', 'drop-after'); };
  const spot = event => {   // the list under the pointer, and whether the dragged one would go after it
    const tab = event.target.closest?.('.tab[draggable="true"]');
    if (!tab || tab.dataset.view === dragged) return null;
    const box = tab.getBoundingClientRect(), column = getComputedStyle(tabs).flexDirection === 'column';   // sidebar, or top bar on phones
    return { tab, after: column ? event.clientY > box.top + box.height / 2 : event.clientX > box.left + box.width / 2 };
  };

  tabs.addEventListener('dragstart', event => {
    const tab = event.target.closest('.tab[draggable="true"]');
    if (!tab) return;
    dragged = tab.dataset.view;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', tab.textContent.trim());   // some browsers only start a drag that carries data
    tab.classList.add('dragging');
  });
  tabs.addEventListener('dragover', event => {
    const at = dragged && spot(event);
    unmark();
    if (!at) return;
    event.preventDefault();   // allows the drop here
    at.tab.classList.add(at.after ? 'drop-after' : 'drop-before');
  });
  tabs.addEventListener('dragleave', event => { if (!tabs.contains(event.relatedTarget)) unmark(); });
  tabs.addEventListener('drop', event => {
    const at = dragged && spot(event);
    if (!at) return;
    event.preventDefault();
    actions.moveList(dragged, at.tab.dataset.view, at.after);
    dragged = null;
  });
  tabs.addEventListener('dragend', event => {
    dragged = null;
    unmark();
    event.target.classList?.remove('dragging');
  });
}
