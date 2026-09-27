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
export const dayOf = iso => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY;
export const today = () => { const now = new Date(); return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY; };
export const fmtDay = (day, options) => new Date(day * DAY).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
const shortDate = iso => fmtDay(dayOf(iso), { day: 'numeric', month: 'short',
                                              ...(iso.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }) });
export const datesText = ({ start, end }) => start && end ? (start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`)
  : start ? `From ${shortDate(start)}` : `Due ${shortDate(end)}`;   // D38
