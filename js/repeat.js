// How an item repeats (D50): every n days, weeks (on chosen weekdays) or months. Stored on the item as
// `repeat: { every, unit, days }`; this class works out its dates, its wording and its calendar rule.
// Days are whole days since 1970 (format.js); weekdays count from Monday = 0.
import { dayIn, dayOf, isoOf, monthOf, weekdayName, weekdayOf as weekday } from './format.js';

const UNITS = ['day', 'week', 'month'];
const monday = day => day - weekday(day);

export class Repeat {
  // The stored form, or null when raw isn't a valid rule. Missing or odd parts get defaults (D49).
  static fields(raw) {
    if (!UNITS.includes(raw?.unit)) return null;
    const every = Number.isInteger(raw.every) && raw.every >= 1 && raw.every <= 99 ? raw.every : 1;
    const days = raw.unit !== 'week' || !Array.isArray(raw.days) ? []
      : [...new Set(raw.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    return { every, unit: raw.unit, days };
  }

  constructor(stored) { Object.assign(this, Repeat.fields(stored)); }

  #weekdays(anchor) { return this.days.length ? this.days : [weekday(anchor)]; }   // no days picked: its date's weekday

  // The first occurrence after `base`, in the rhythm set by `anchor` (the date it's for now).
  after(anchor, base) {
    if (this.unit === 'day') return anchor + (Math.floor((base - anchor) / this.every) + 1) * this.every;
    if (this.unit === 'week') {
      const days = this.#weekdays(anchor);
      for (let d = base + 1; ; d++) {
        if (days.includes(weekday(d)) && ((monday(d) - monday(anchor)) / 7) % this.every === 0) return d;
      }
    }
    const { year, month, date } = monthOf(anchor);
    for (let k = this.every; ; k += this.every) { const d = dayIn(year, month + k, date); if (d > base) return d; }
  }

  // Its first occurrence on or after `from` (a weekly rule may move a date forward to one of its weekdays).
  first(from) {
    if (this.unit !== 'week') return from;
    const days = this.#weekdays(from);
    for (let d = from; ; d++) if (days.includes(weekday(d))) return d;
  }

  // Dates for a new or edited item: moved to its first occurrence, or starting today when it has none.
  align({ start, end }, today) {
    const due = end ?? start;
    if (!due) return { start: null, end: isoOf(this.first(today)) };
    return shift({ start, end }, this.first(dayOf(due)) - dayOf(due));
  }

  // Dates after ticking it: the next occurrence after both its date and today, so a late workout doesn't pile up (D50).
  next({ start, end }, today) {
    if (!(end ?? start)) return { start: null, end: isoOf(this.after(today, today)) };   // no date yet (typed into the console)
    const anchor = dayOf(end ?? start);
    return shift({ start, end }, this.after(anchor, Math.max(anchor, today)) - anchor);
  }

  get text() {   // "Daily", "Mon, Wed, Fri", "Every 2 weeks: Tue", "Monthly"…
    const names = this.days.map(d => weekdayName(d)).join(', ');
    const unit = { day: ['Daily', 'days'], week: [names || 'Weekly', 'weeks'], month: ['Monthly', 'months'] }[this.unit];
    return this.every === 1 ? unit[0] : `Every ${this.every} ${unit[1]}${names ? `: ${names}` : ''}`;
  }

  rule(anchor) {   // the calendar's RRULE (RFC 5545) for an item whose date is `anchor`
    const byDay = this.unit === 'week' ? `;BYDAY=${this.#weekdays(anchor).map(d => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][d]).join(',')}` : '';
    return `FREQ=${{ day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY' }[this.unit]};INTERVAL=${this.every}${byDay}`;
  }
}

const shift = ({ start, end }, by) => ({ start: start && isoOf(dayOf(start) + by), end: end && isoOf(dayOf(end) + by) });
