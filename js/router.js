// Project pages live in the address, #p=<id>, so the phone's back gesture returns to the list (D32).
import { freshDraft, state } from './state.js';
import { renderPickers } from './views/pickers.js';
import { render } from './views/render.js';

export function route() {
  let id = null;
  try { id = decodeURIComponent(location.hash.match(/^#p=(.+)$/)?.[1] ?? '') || null; } catch {}
  state.project = id;
  state.draft = freshDraft();
  render();
  renderPickers();
  scrollTo(0, 0);
}

export function openProject(id) {   // each project page is a history entry that knows how deep it is
  history.pushState({ depth: (history.state?.depth ?? 0) + 1 }, '', `#p=${encodeURIComponent(id)}`);
  route();
}

export function closeProject() {   // back to the list
  const depth = history.state?.depth ?? 0;
  if (depth) return history.go(-depth);
  history.replaceState(null, '', location.pathname + location.search);
  route();
}
