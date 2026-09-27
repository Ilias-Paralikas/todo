// A project's timeline: a Gantt chart in plain HTML and CSS (D38).
import { PRIOS } from '../config.js';
import { DAY, esc, fmtDay, today, weekdayOf } from '../format.js';
import { prioColor } from '../state.js';

function ticksFor(min, max) {   // about six dates to label the timeline: days, weeks from Monday, or months
  const span = max - min, out = [];
  if (span <= 120) {
    const step = [1, 2, 7, 14, 28].find(s => span / s <= 7) ?? 28;
    for (let d = step < 7 ? min : min + (7 - weekdayOf(min)) % 7; d < max; d += step) out.push(d);   // weeks start on Monday
  } else {
    const first = new Date(min * DAY), every = Math.ceil(span / 30 / 7);
    for (let m = first.getUTCMonth() + 1, d; (d = Date.UTC(first.getUTCFullYear(), m, 1) / DAY) < max; m += every) out.push(d);
  }
  return out;
}

// The dated items inside a project, one bar each in its priority's color; a sub-project is one bar (D41).
export function ganttHTML(project) {
  const items = project.children;
  const rows = items.flatMap(item => { const span = item.span; return span ? [{ item, ...span }] : []; })
    .sort((a, b) => a.from - b.from || a.to - b.to);
  if (!rows.length) return '';
  const whole = project.ownSpan && { item: project, ...project.ownSpan }, all = whole ? [whole, ...rows] : rows;
  const min = Math.min(...all.map(r => r.from)), max = Math.max(min + 7, ...all.map(r => r.to + 1));
  const pct = day => `${((day - min) / (max - min) * 100).toFixed(2)}%`;
  const now = today(), showToday = now >= min && now < max;
  const prios = [...new Set(rows.map(r => r.item.prio))].sort();
  const legend = [...(prios.length > 1 ? prios.map(id => `<span style="--c:${prioColor(id)}">${PRIOS[id - 1].label}</span>`) : []),
                  ...(showToday ? ['<span class="today">Today</span>'] : [])];
  const label = max - min > 120 ? { month: 'short' } : { day: 'numeric', month: 'short' };
  const cls = r => r === whole ? ' whole' : `${r.item.kind === 'project' ? ' sub' : ''}${r.item.done ? ' done' : ''}`;
  const day = d => fmtDay(d, { day: 'numeric', month: 'short' });
  const hint = r => `${esc(r.item.title)}: ${r.from === r.to ? day(r.from) : `${day(r.from)} – ${day(r.to)}`}`;
  return `<section class="gantt" aria-label="Timeline">
    ${legend.length ? `<div class="g-legend">${legend.join('')}</div>` : ''}
    <div class="g-body">
      <div class="g-names">${all.map(r => `<button class="g-name${cls(r)}" data-act="edit" data-id="${esc(r.item.id)}" title="${hint(r)}">${esc(r.item.title)}</button>`).join('')}</div>
      <div class="g-plot">
        <div class="g-axis">${ticksFor(min, max).map(d => `<span style="left:${pct(d)}">${fmtDay(d, label)}</span>`).join('')}</div>
        ${ticksFor(min, max).map(d => `<i style="left:${pct(d)}"></i>`).join('')}${showToday ? `<i class="today" style="left:${pct(now)}" title="Today"></i>` : ''}
        ${all.map(r => `<div class="g-track"><button class="g-bar${cls(r)}" data-act="edit" data-id="${esc(r.item.id)}" tabindex="-1" aria-hidden="true"
          style="left:${pct(r.from)};width:${pct(min + r.to + 1 - r.from)};--c:${prioColor(r.item.prio)}" title="${hint(r)}"></button></div>`).join('')}
      </div>
    </div>
    ${rows.length < items.length ? `<p class="g-note">Subtasks without dates aren't on the timeline (${items.length - rows.length}).</p>` : ''}
  </section>`;
}
