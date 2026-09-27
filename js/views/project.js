// The top of a project's page (D32). Only top-level projects have one; sub-projects open in place (D44).
import { esc } from '../format.js';
import { listById, state } from '../state.js';
import { ganttHTML } from './gantt.js';
import { linkHTML, tagsHTML } from './rows.js';

export function projectHeadHTML(project) {
  const id = esc(project.id);
  return `<div class="crumb"><button data-act="back">← ${esc(listById(state.view)?.name ?? 'All')}</button>
      <button data-act="edit" data-id="${id}">Edit</button></div>
    <div class="task p${project.prio}${project.done ? ' done' : ''}">
      <button class="check" role="checkbox" aria-checked="${project.done}" aria-label="${esc(project.title)}" data-act="toggle" data-id="${id}"></button>
      <div class="col"><h1 class="title">${esc(project.title)}</h1>${tagsHTML(project)}</div>
    </div>
    ${project.notes ? `<p class="notes">${esc(project.notes)}</p>` : ''}${project.url ? `<p class="notes">${linkHTML(project.url)}</p>` : ''}
    ${ganttHTML(project)}`;
}
