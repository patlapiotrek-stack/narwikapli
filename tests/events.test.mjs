import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeEvents, renderCalendar, renderEventDetails, validEventDate, localDateKey } from '../events.js';

test('today and upcoming dates are selected in local time; tasks and past events are excluded', () => {
    const today = new Date(2026, 9, 4, 0, 15);
    const events = [{ id: 'today', nazwa: 'Spotkanie', start: '2026-10-04' }, { id: 'task', nazwa: '[ZADANIE] Test', start: '2026-10-04' }, { id: 'past', nazwa: 'Stare', start: '2026-10-03' }, { id: 'future2', nazwa: 'Drugie', start: '2026-10-06' }, { id: 'future1', nazwa: 'Pierwsze', start: '2026-10-05' }, { id: 'no-date', nazwa: 'Bez daty', start: 'Brak daty' }];
    const result = homeEvents(events, today);
    assert.deepEqual(result.current.map(event => event.id), ['today']);
    assert.deepEqual(result.upcoming.map(event => event.id), ['future1', 'future2']);
    assert.equal(localDateKey(today), '2026-10-04');
    assert.equal(validEventDate('2026-02-30'), false);
});
test('calendar caps visible event chips, counts extra events and escapes untrusted titles', () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ id: String(i), start: '2026-10-04', nazwa: '<img src=x onerror=alert(1)>', color: 'red;position:fixed' }));
    const html = renderCalendar(events, new Date(2026, 9, 1));
    assert.equal((html.match(/class="cal-event"/g) || []).length, 2);
    assert.ok(html.includes('+6 więcej'));
    assert.ok(html.includes('&lt;img'));
    assert.equal(html.includes('background:red'), false);
    assert.equal((html.match(/class="cal-cell(?: today)?"/g) || []).length, 31);
});
test('read-only details preserve text while escaping description and participant names', () => {
    const html = renderEventDetails({ nazwa: '<script>alert(1)</script>', start: '2026-10-04', opis: 'A\nB<img src=x>', osoby: ['user'] }, () => 'Name <b>unsafe</b>');
    assert.ok(html.includes('A\nB&lt;img'));
    assert.ok(html.includes('Name &lt;b&gt;unsafe&lt;/b&gt;'));
    assert.equal(html.includes('<script>'), false);
});
