// Rows of tasks and projects, in priority groups. Each row asks its item what it does (models.js).
import { PRIOS } from '../config.js';
import { datesText, esc, hostOf, lastDoneText } from '../format.js';
import { listById, pageProject, prioColor, state } from '../state.js';

// Open items by priority, each group under a labelled line (D34); tap the label to recolor it (D39).
export const groupsHTML = items => PRIOS.map(p => {
  const group = items.filter(item => item.prio === p.id);
  return group.length ? `<li class="group" style="--c:${prioColor(p.id)}"><button class="group-name" data-act="prioColor" data-prio="${p.id}"
    title="Change the color of ${p.label}">${p.label}</button></li>${group.map(item => rowHTML(item)).join('')}` : '';
}).join('');

// Tapping the text does what the item says (item.opens): edit it, open its page, or expand it in place.
export function rowHTML(item, inside = false) {   // inside: shown under the project it is in
  const id = esc(item.id), open = item.expandable && state.expanded.has(item.id);
  const expands = item.opens === 'expand' ? ` aria-expanded="${open}"` : '';
  return `<li class="task p${item.prio}${item.done ? ' done' : ''}">
    <button class="check" role="checkbox" aria-checked="${item.done}" aria-label="${esc(item.title)}" data-act="toggle" data-id="${id}"></button>
    <div class="col">
      <div class="line">
        <button class="body" data-act="${item.opens}" data-id="${id}"${expands}><span class="title">${esc(item.title)}</span>${tagsHTML(item, inside)}</button>
        ${item.url ? linkHTML(item.url) : ''}${item.aside && `<span class="aside">${esc(item.aside)}</span>`}
        ${item.expandable ? `<button class="expand" data-act="expand" data-id="${id}" aria-expanded="${open}" aria-label="What's in ${esc(item.title)}"></button>` : ''}
      </div>
      ${open ? unfoldedHTML(item) : ''}
    </div>
  </li>`;
}

// Under an expanded project, its open items. A sub-project opens here instead of on a page, so it
// also shows its description, its done items and a field that adds to it, with its Edit button (D44).
function unfoldedHTML(item) {
  const rows = item.unfolded.map(child => rowHTML(child, true)).join('');
  if (item.opens !== 'expand') return `<ul class="subs">${rows}</ul>`;
  const id = esc(item.id), label = `Add to ${esc(item.title)}`;
  return `<div class="unfolded">
    ${item.notes ? `<p class="notes">${esc(item.notes)}</p>` : ''}${rows ? `<ul class="subs">${rows}</ul>` : ''}
    <form class="sub-add" data-parent="${id}">
      <input class="field" placeholder="${label}" aria-label="${label}" autocomplete="off" enterkeyhint="done" maxlength="300">
      <button type="button" class="link" data-act="edit" data-id="${id}">Edit</button>
    </form>
  </div>`;
}

// The *other* lists it's on (D22); on its own in a list, the project it is in (D32); its dates (D38) and repeat (D50).
export function tagsHTML(item, inside = false) {
  const page = pageProject(), parent = !inside && !page && item.parentProject;
  const tags = item.lists.filter(id => page || id !== state.view).map(listById).filter(Boolean)
    .map(list => `<span class="tag" style="--c:${list.color}">${esc(list.name)}</span>`);
  if (parent) tags.unshift(`<span class="tag in">${esc(parent.title)}</span>`);
  if (item.start || item.end) tags.push(`<span class="tag date">${datesText(item)}</span>`);
  if (item.repeating) tags.push(`<span class="tag repeat"${item.lastDone ? ` title="${lastDoneText(item.lastDone)}"` : ''}>↻ ${esc(item.repeating.text)}</span>`);   // D50
  return tags.length ? `<span class="tags">${tags.join('')}</span>` : '';
}

// An item's web address, opened in a new tab (D40). Only http(s) addresses are ever stored, so no javascript: links.
export const linkHTML = url => `<a class="url" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${esc(hostOf(url))} ↗</a>`;
