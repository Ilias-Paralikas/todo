// The app's own calendar for Start and End (D52). It opens under a form's two date fields. The month shown looks
// as usual; the days before and after it, from the neighbouring months, stay visible in grey and can be picked
// too, so every week is whole. Weeks start on Monday. Today is marked, and the days from Start to End are shaded.
// A date field is a button whose value is the date as YYYY-MM-DD ('' for none), like a date input's.
import { dayIn, dayLabel, dayOf, fmtDay, isoOf, monthOf, today, weekdayName, weekdayOf } from '../format.js';

const KEYS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export class DatePicker {
  #fields; #panel; #target = null; #focus = 0;   // the date buttons by name; the calendar; the field being picked; the focused day

  constructor(fields, panel) {
    this.#fields = fields;
    this.#panel = panel;
    for (const [name, button] of Object.entries(fields)) {
      button.addEventListener('click', () => this.#target === name ? this.close() : this.open(name));
    }
    panel.addEventListener('click', event => {
      const el = event.target.closest('button');
      if (el?.dataset.day) this.#pick(el.dataset.day);
      else if (el?.dataset.months) {
        this.#move(this.#shifted(Number(el.dataset.months)), false);
        this.#panel.querySelector(`[data-months="${el.dataset.months}"]`).focus();   // it was redrawn
      }
      else if (el?.dataset.set) this.#pick(el.dataset.set === 'today' ? isoOf(today()) : '');
    });
    panel.addEventListener('keydown', event => this.#key(event));
    document.addEventListener('click', event => {   // a click anywhere else closes it
      const path = event.composedPath();
      if (this.#target && !path.includes(panel) && !Object.values(fields).some(button => path.includes(button))) this.close();
    });
  }

  set(name, iso) {   // show a field's date, or none
    const button = this.#fields[name];
    button.value = iso ?? '';
    button.textContent = iso ? dayLabel(iso) : 'Pick a date';
    button.classList.toggle('unset', !iso);
  }

  open(name) {   // on the field's date, else the other field's, else today
    this.#target = name;
    const value = this.#fields[name].value || Object.values(this.#fields).find(button => button.value)?.value;
    this.#focus = value ? dayOf(value) : today();
    this.#panel.setAttribute('aria-label', `Pick the ${name} date`);
    this.#panel.hidden = false;
    for (const [other, button] of Object.entries(this.#fields)) button.setAttribute('aria-expanded', other === name);
    this.#move(this.#focus, true);
  }

  close() {
    this.#target = null;
    this.#panel.hidden = true;
    for (const button of Object.values(this.#fields)) button.setAttribute('aria-expanded', false);
  }

  #shifted(months) {   // the same date, that many months on (or back)
    const { year, month, date } = monthOf(this.#focus);
    return dayIn(year, month + months, date);
  }

  #move(day, focus) {   // show the month with `day` in it, and put the keyboard on that day
    this.#focus = day;
    this.#render();
    if (focus) this.#panel.querySelector('.day[tabindex="0"]').focus();
  }

  #render() {
    const { year, month } = monthOf(this.#focus), first = dayIn(year, month, 1), from = first - weekdayOf(first);
    const day = name => this.#fields[name].value ? dayOf(this.#fields[name].value) : null;
    const picked = day(this.#target), start = day('start'), end = day('end'), now = today();
    const cells = Array.from({ length: 42 }, (_, i) => from + i).map(d => {   // six whole weeks
      const cls = [monthOf(d).month !== month && 'other', d === now && 'today', d === picked && 'picked',
                   d !== picked && (d === start || d === end) && 'bound', start !== null && end !== null && d > start && d < end && 'between'];
      return `<button type="button" class="day ${cls.filter(Boolean).join(' ')}" data-day="${isoOf(d)}" tabindex="${d === this.#focus ? 0 : -1}"
        aria-label="${fmtDay(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}" aria-pressed="${d === picked}">${monthOf(d).date}</button>`;
    }).join('');
    this.#panel.innerHTML = `<div class="dp-head">
        <button type="button" data-months="-1" aria-label="Previous month">‹</button>
        <span aria-live="polite">${fmtDay(first, { month: 'long', year: 'numeric' })}</span>
        <button type="button" data-months="1" aria-label="Next month">›</button>
      </div>
      <div class="dp-grid" data-month="${isoOf(first).slice(0, 7)}">
        ${[0, 1, 2, 3, 4, 5, 6].map(d => `<abbr title="${weekdayName(d, 'long')}">${weekdayName(d, 'narrow')}</abbr>`).join('')}${cells}
      </div>
      <div class="dp-foot"><button type="button" data-set="today">Today</button><button type="button" data-set="clear">Clear</button></div>`;
  }

  #pick(iso) {
    const button = this.#fields[this.#target];
    this.set(this.#target, iso);
    this.close();
    button.focus();
    button.dispatchEvent(new Event('input', { bubbles: true }));   // the form hears it like a typed field
  }

  #key(event) {   // arrows move by a day or a week, Page Up and Down by a month, Escape closes
    if (event.key === 'Escape') {
      event.preventDefault();   // also keeps the editor open
      const button = this.#fields[this.#target];
      this.close();
      button.focus();
    } else if (event.target.dataset.day && (event.key in KEYS || event.key === 'PageUp' || event.key === 'PageDown')) {
      event.preventDefault();
      this.#move(event.key in KEYS ? this.#focus + KEYS[event.key] : this.#shifted(event.key === 'PageDown' ? 1 : -1), true);
    }
  }
}
