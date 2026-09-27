// Alerts come from your calendar (D51): an item with a date goes into Google Calendar, or into any calendar as an
// .ics file, with its repeat rule and an alarm at its time (at 9:00 on the day when it has no time).
// A calendar event is a copy: changing the item later doesn't change the event.
import { dayOf, isoOf } from './format.js';
import { Repeat } from './repeat.js';

const pad = n => String(n).padStart(2, '0');
const compact = iso => iso.replaceAll('-', '');   // 2026-10-02 → 20261002

// When the event starts and ends, as calendar values. With a time it's an hour from then, on its first day;
// without one it's all day, from its start to its end (the end day is exclusive, so +1).
function when({ start, end, time }) {
  const first = start ?? end, last = end ?? start;
  if (!time) return { allDay: true, from: compact(first), to: compact(isoOf(dayOf(last) + 1)) };
  const [h, m] = time.split(':').map(Number), later = h * 60 + m + 60, day = dayOf(first) + Math.floor(later / 1440);
  return { allDay: false, from: `${compact(first)}T${pad(h)}${pad(m)}00`,
           to: `${compact(isoOf(day))}T${pad(Math.floor(later / 60) % 24)}${pad(later % 60)}00` };
}
const rule = item => item.repeat ? new Repeat(item.repeat).rule(dayOf(item.end ?? item.start)) : null;
const details = item => [item.notes, item.url].filter(Boolean).join('\n\n');

// Google Calendar's "new event" page, filled in (it adds the calendar's usual notification).
export function googleCalendarUrl(item) {
  const { from, to } = when(item), recur = rule(item);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: item.title, dates: `${from}/${to}`, details: details(item),
                                       ctz: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(recur && { recur: `RRULE:${recur}` }) });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// An .ics file (RFC 5545) that Apple Calendar, Outlook and most other calendars open, with an alarm.
export function icsFile(item) {
  const text = value => value.replace(/[\\;,]/g, c => `\\${c}`).replace(/\r?\n/g, '\\n');
  const fold = line => line.match(/.{1,60}/gu).join('\r\n ');   // long lines continue on the next, indented
  const { allDay, from, to } = when(item), recur = rule(item);
  const date = allDay ? ';VALUE=DATE' : '';   // a time without a zone is the device's own time
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Todo//EN', 'BEGIN:VEVENT', `UID:${item.id}@todo`, `DTSTAMP:${stamp}`,
    `DTSTART${date}:${from}`, `DTEND${date}:${to}`, ...(recur ? [`RRULE:${recur}`] : []), `SUMMARY:${text(item.title)}`,
    ...(details(item) ? [`DESCRIPTION:${text(details(item))}`] : []), ...(item.url ? [`URL:${item.url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(item.title)}`, `TRIGGER:${allDay ? 'PT9H' : 'PT0M'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
