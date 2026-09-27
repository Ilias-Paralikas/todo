// The dates, price and link fields. The composer ('add') and the editor ('edit') share them, so they look and
// behave the same: start and end side by side, then the price and the link (D47).
import { $ } from './dom.js';

const fieldsHTML = form => `
  <div class="dates">
    <label class="when"><span>Start</span><input id="${form}-start" class="field" type="date"></label>
    <label class="when"><span>End</span><input id="${form}-end" class="field" type="date"></label>
  </div>
  <div class="extras">
    <input id="${form}-price" class="field price" placeholder="Price in €" aria-label="Price in euros" inputmode="decimal" autocomplete="off" enterkeyhint="done" maxlength="12">
    <input id="${form}-url" class="field link-field" inputmode="url" placeholder="Link (optional)" aria-label="Link" autocomplete="off" enterkeyhint="done" maxlength="2000">
  </div>`;

export function renderFields() {   // once, at start-up, into each <div data-fields="add|edit">
  for (const form of ['add', 'edit']) $(`[data-fields="${form}"]`).innerHTML = fieldsHTML(form);
}
