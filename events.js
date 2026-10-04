import { escapeHtml, safeColor } from './security.js?v=20261004-calendar-ovh';

export const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const isMeeting = event => !String(event.nazwa || '').startsWith('[ZADANIE]');
export function validEventDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = value.split('-').map(Number);
    return localDateKey(new Date(year, month - 1, day)) === value;
}
export const eventsForDay = (events, day) => events.filter(event => isMeeting(event) && event.start === day);
export const formatEventDate = value => validEventDate(value)
    ? new Date(`${value}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Termin do ustalenia';

export function renderCalendar(events, month, today = new Date()) {
    const year = month.getFullYear(), monthIndex = month.getMonth();
    const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const days = new Date(year, monthIndex + 1, 0).getDate();
    let html = '<div class="cal-cell cal-cell-empty" aria-hidden="true"></div>'.repeat(offset);
    for (let day = 1; day <= days; day++) {
        const date = localDateKey(new Date(year, monthIndex, day));
        const meetings = eventsForDay(events, date);
        const chips = meetings.slice(0, 2).map(event => `<button type="button" class="cal-event" data-event-id="${escapeHtml(event.id)}" style="background:${escapeHtml(safeColor(event.color))}" title="${escapeHtml(event.nazwa)}" aria-label="Szczegóły: ${escapeHtml(event.nazwa)}">${escapeHtml(event.nazwa)}</button>`).join('');
        const more = meetings.length > 2 ? `<button type="button" class="cal-more" data-calendar-day="${date}" aria-label="Wszystkie wydarzenia: ${escapeHtml(formatEventDate(date))}">+${meetings.length - 2} więcej</button>` : '';
        html += `<div class="cal-cell${date === localDateKey(today) ? ' today' : ''}" data-calendar-day="${date}"><button type="button" class="cal-cell-date" data-calendar-day="${date}" aria-label="${escapeHtml(formatEventDate(date))}, wydarzeń: ${meetings.length}"${date === localDateKey(today) ? ' aria-current="date"' : ''}>${day}</button>${chips}${more}</div>`;
    }
    return html;
}

export function homeEvents(events, today = new Date()) {
    const day = localDateKey(today);
    const meetings = events.filter(event => isMeeting(event) && validEventDate(event.start));
    return { current: meetings.filter(event => event.start === day), upcoming: meetings.filter(event => event.start > day).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3) };
}

export function renderHomeEvents(events, today = new Date()) {
    const { current, upcoming } = homeEvents(events, today);
    const card = (event, active) => `<button type="button" class="board-card home-event" data-event-id="${escapeHtml(event.id)}" style="border-left-color:${escapeHtml(safeColor(event.color))}"><span class="home-event-date">${active ? 'Dziś' : escapeHtml(formatEventDate(event.start))}</span><span class="home-event-main"><strong>${escapeHtml(event.nazwa)}</strong><span>${escapeHtml(event.lokacja || 'Miejsce do ustalenia')}</span></span><span class="home-event-open">Szczegóły <i class="fas fa-chevron-right" aria-hidden="true"></i></span></button>`;
    return `<section class="home-events"><h4>Dziś — trwające wydarzenia</h4>${current.map(event => card(event, true)).join('') || '<p class="event-empty">Brak wydarzeń na dziś.</p>'}<h4>Nadchodzące spotkania</h4>${upcoming.map(event => card(event, false)).join('') || '<p class="event-empty">Brak zaplanowanych spotkań.</p>'}</section>`;
}

export function renderEventDetails(event, personName = email => email) {
    const people = Array.isArray(event.osoby) ? event.osoby : [];
    return `<article class="event-detail" style="border-left-color:${escapeHtml(safeColor(event.color))}"><h4>${escapeHtml(event.nazwa || 'Wydarzenie')}</h4><dl><div><dt>Data</dt><dd>${escapeHtml(formatEventDate(event.start))}</dd></div><div><dt>Miejsce</dt><dd>${escapeHtml(event.lokacja || 'Miejsce do ustalenia')}</dd></div><div><dt>Uczestnicy</dt><dd>${escapeHtml(people.length ? people.map(personName).join(', ') : 'Wszyscy członkowie zespołu')}</dd></div></dl><h5>Opis i szczegóły</h5><p class="event-detail-description">${escapeHtml(event.opis || 'Brak dodatkowego opisu.')}</p></article>`;
}
