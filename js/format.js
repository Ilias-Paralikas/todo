// Small helpers for text, money, dates and arrays. Pure functions: no state, no page.

export const moved = (array, from, to) => { const out = [...array]; out.splice(to, 0, ...out.splice(from, 1)); return out; };   // a copy, one entry moved

export const esc = value => String(value).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);   // all user text goes through this (D26)
export const isDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value);   // a calendar date, as <input type="date"> gives it
export const isColor = value => /^#[0-9a-f]{6}$/i.test(value);    // colors go into style attributes, so only #rrggbb (D26)

export const euros = cents => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'EUR' });
// "4,50", "€4.50" or "4" → 450 (whole cents, D37); blank → null; anything else → NaN.
export const parsePrice = text => {
  const s = text.replace(/[€\s]/g, '').replace(',', '.');
  return !s ? null : /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) : NaN;
};

// "example.com/page" or "https://…" → a full http(s) address (D40); blank → null; anything else → false.
export const parseUrl = text => {
  const s = text.trim(), typed = /^[a-z][a-z\d+.-]*:/i.test(s);
  if (!s) return null;
  try { const url = new URL(typed ? s : `https://${s}`); return /^https?:$/.test(url.protocol) && (typed || url.hostname.includes('.')) ? url.href : false; }
  catch { return false; }
};
export const hostOf = url => new URL(url).hostname.replace(/^www\./, '');

// Dates are whole days since 1970, so they mean the same day in every time zone (D37).
export const DAY = 864e5;
export const isTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);   // a time of day, as <input type="time"> gives it
export const dayOf = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
export const isoOf = day => new Date(day * DAY).toISOString().slice(0, 10);
export const today = () => { const now = new Date(); return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY; };
export const fmtDay = (day, options) => new Date(day * DAY).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
export const weekdayOf = day => (day + 3) % 7;   // Monday = 0, as 1 January 1970 was a Thursday
export const weekdayName = (i, style = 'short') => fmtDay(4 + i, { weekday: style });   // 5 January 1970 was a Monday
export const monthOf = day => { const d = new Date(day * DAY); return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() }; };
// That date of that month, or the month's last day if it's shorter (31 → 28 February). The month may run past 11.
export const dayIn = (year, month, date) => Date.UTC(year, month, Math.min(date, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())) / DAY;
export const lastDoneText = ms => `Last done ${new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`;   // D50
const dateText = (iso, extra) => fmtDay(dayOf(iso), { ...extra, day: 'numeric', month: 'short',
                                                     ...(iso.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }) });
const shortDate = iso => dateText(iso);                                  // "3 Oct"
export const dayLabel = iso => dateText(iso, { weekday: 'short' });     // "Fri 3 Oct", on a date field (D52)
// "3 Oct – 10 Oct", "From 3 Oct", "Due 10 Oct" (D38). A time goes with the first date: "Due 10 Oct, 18:00" (D49).
export const datesText = ({ start, end, time }) => {
  const at = time ? `, ${time}` : '';
  return start && end ? (start === end ? `${shortDate(start)}${at}` : `${shortDate(start)}${at} – ${shortDate(end)}`)
    : start ? `From ${shortDate(start)}${at}` : `Due ${shortDate(end)}${at}`;
};
