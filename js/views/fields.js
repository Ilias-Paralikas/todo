// The dates, time, repeat, price and link fields. The composer ('add') and the editor ('edit') share them, so they
// look and behave the same (D47): start and end side by side, then time and repeat, then price and link.
import { parsePrice, parseUrl, weekdayName } from '../format.js';
import { $ } from './dom.js';

const fieldsHTML = form => `
  <div class="pair">
    <label class="when"><span>Start</span><input id="${form}-start" class="field" type="date"></label>
    <label class="when"><span>End</span><input id="${form}-end" class="field" type="date"></label>
  </div>
  <div class="pair">
    <label class="when"><span>Time</span><input id="${form}-time" class="field" type="time"></label>
    <label class="when"><span>Repeat</span><select id="${form}-repeat" class="field">
      <option value="">Never</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
    </select></label>
  </div>
  <div id="${form}-rhythm" class="rhythm" hidden>
    <label class="every">Every <input id="${form}-every" class="field" type="number" min="1" max="99" value="1" inputmode="numeric"> <span id="${form}-unit"></span></label>
    <div id="${form}-days" class="days" role="group" aria-label="On these days">${[0, 1, 2, 3, 4, 5, 6].map(d =>
      `<label><input type="checkbox" value="${d}"><span>${weekdayName(d)}</span></label>`).join('')}</div>
  </div>
  ${form === 'edit' ? '<p id="edit-last" class="hint" hidden></p>' : ''}
  <div class="extras">
    <input id="${form}-price" class="field price" placeholder="Price in €" aria-label="Price in euros" inputmode="decimal" autocomplete="off" enterkeyhint="done" maxlength="12">
    <input id="${form}-url" class="field link-field" inputmode="url" placeholder="Link (optional)" aria-label="Link" autocomplete="off" enterkeyhint="done" maxlength="2000">
  </div>`;

const field = (form, name) => $(`#${form}-${name}`);
const CHECKED = ['price', 'end', 'url', 'time', 'every'];   // the fields that can refuse what's typed

export function renderFields() {   // once, at start-up, into each <div data-fields="add|edit">
  for (const form of ['add', 'edit']) {
    $(`[data-fields="${form}"]`).innerHTML = fieldsHTML(form);
    for (const name of ['repeat', 'every']) field(form, name).addEventListener('input', () => showRhythm(form));
    for (const name of CHECKED) field(form, name).addEventListener('input', event => event.target.setCustomValidity(''));
  }
}

function showRhythm(form) {   // "Every n weeks" and the weekdays, only when it repeats (D50)
  const unit = field(form, 'repeat').value;
  field(form, 'rhythm').hidden = !unit;
  field(form, 'days').hidden = unit !== 'week';
  field(form, 'unit').textContent = unit && `${unit}${Number(field(form, 'every').value) === 1 ? '' : 's'}`;
}

// What the fields say, or undefined after showing what's wrong.
export function readFields(form) {
  const f = name => field(form, name), unit = f('repeat').value, every = Number(f('every').value);
  const values = { price: parsePrice(f('price').value), start: f('start').value || null, end: f('end').value || null,
                   url: parseUrl(f('url').value), time: f('time').value || null,
                   repeat: unit ? { unit, every, days: [...f('days').querySelectorAll(':checked')].map(box => Number(box.value)) } : null };
  const problems = {
    price: Number.isNaN(values.price) && 'Write the price as a number, like 4.50',
    end: values.start && values.end && values.end < values.start && 'The end is before the start',
    url: values.url === false && 'Write a web address, like example.com/page',
    time: values.time && !values.start && !values.end && !unit && 'Pick a date for this time',
    every: unit && !(Number.isInteger(every) && every >= 1 && every <= 99) && 'Write a number from 1 to 99',
  };
  for (const name of CHECKED) f(name).setCustomValidity(problems[name] || '');
  return CHECKED.every(name => f(name).reportValidity()) ? values : undefined;
}

export function fillFields(form, item) {   // show an item's values (the editor), or none (after adding)
  const f = name => field(form, name), repeat = item.repeat;
  f('price').value = item.price == null ? '' : (item.price / 100).toFixed(2);
  for (const name of ['start', 'end', 'url', 'time']) f(name).value = item[name] ?? '';
  f('repeat').value = repeat?.unit ?? '';
  f('every').value = repeat?.every ?? 1;
  for (const box of f('days').querySelectorAll('input')) box.checked = Boolean(repeat?.days.includes(Number(box.value)));
  for (const name of CHECKED) f(name).setCustomValidity('');
  showRhythm(form);
}
export const clearFields = form => fillFields(form, {});
