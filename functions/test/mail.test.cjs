const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMailService } = require('../mail-service.cjs');
class HttpError extends Error { constructor(code, message) { super(message); this.code = code; } }
const head = { uid: 'head', token: { email: 'patlapiotrek@gmail.com', email_verified: true } };
const config = { enabled: true, mailbox: 'notifications@example.org', senderName: 'Narwik Promotion', host: 'smtp.mail.ovh.net', port: 465, notifications: {} };
function setup(extra = {}) {
    const records = new Map(Object.entries({ 'ustawienia/poczta_ovh': config, 'uzytkownicy/member@example.org': {}, ...extra }));
    const snapshot = key => ({ exists: records.has(key), data: () => records.get(key) });
    const db = {
        doc: key => ({ key, get: async () => snapshot(key), set: async value => records.set(key, value) }),
        collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ empty: true }) }) }) }),
        runTransaction: async action => action({ get: async ref => snapshot(ref.key), set: (ref, value) => records.set(ref.key, value) })
    };
    const deliveries = [], options = [];
    const service = createMailService({ db, HttpError, now: () => 3600000,
        getPassword: () => 'test-secret', createTransport: value => { options.push(value); return { sendMail: async mail => { deliveries.push(mail); return { accepted: [mail.to] }; }, close() {} }; } });
    return { service, records, deliveries, options };
}
const request = data => ({ auth: head, data });
const notification = { to: 'member@example.org', subject: 'Nowe wydarzenie', message: 'Szczegóły spotkania', type: 'event' };
test('rejects unauthenticated, unverified, normal and blocked senders', async () => {
    const { service } = setup({ 'role_uzytkownikow/blocked@example.org': { rola: 'blocked' } });
    for (const auth of [undefined, { ...head, token: { ...head.token, email_verified: false } }, { uid: 'normal', token: { email: 'member@example.org', email_verified: true } }, { uid: 'blocked', token: { email: 'blocked@example.org', email_verified: true } }]) {
        await assert.rejects(service.send({ auth, data: notification }), error => ['unauthenticated', 'permission-denied'].includes(error.code));
    }
});
test('only head administrators can save SMTP settings or send a test', async () => {
    const { service } = setup({ 'role_uzytkownikow/admin@example.org': { rola: 'admin' } });
    const auth = { uid: 'admin', token: { email: 'admin@example.org', email_verified: true } };
    await assert.rejects(service.saveConfig({ auth, data: config }), { code: 'permission-denied' });
    await assert.rejects(service.send({ auth, data: { test: true } }), { code: 'permission-denied' });
});
test('does not send disabled notifications but allows head to test connection', async () => {
    const { service, deliveries } = setup({ 'ustawienia/poczta_ovh': { ...config, enabled: false } });
    assert.deepEqual(await service.send(request(notification)), { sent: false });
    assert.equal(deliveries.length, 0);
    assert.deepEqual(await service.send(request({ test: true })), { sent: true });
    assert.equal(deliveries[0].to, head.token.email);
});
test('uses fixed mailbox sender and authenticated reply-to, with encrypted SMTP', async () => {
    const { service, deliveries, options } = setup();
    assert.deepEqual(await service.send(request({ ...notification, from: 'attacker@example.org' })), { sent: true });
    assert.equal(deliveries[0].from.address, config.mailbox);
    assert.equal(deliveries[0].replyTo, head.token.email);
    assert.equal(options[0].secure, true);
    assert.equal(options[0].auth.pass, 'test-secret');
    const settings = await service.getConfig(request({}));
    assert.equal(JSON.stringify(settings).includes('test-secret'), false);
});
test('rejects external recipients, blocked recipients and injected mail headers', async () => {
    const { service, deliveries } = setup({ 'role_uzytkownikow/member@example.org': { rola: 'blocked' } });
    await assert.rejects(service.send(request(notification)), { code: 'permission-denied' });
    await assert.rejects(service.send(request({ ...notification, to: 'outsider@example.org' })), { code: 'permission-denied' });
    await assert.rejects(service.send(request({ ...notification, subject: 'Subject\r\nBcc: outsider@example.org' })), { code: 'invalid-argument' });
    assert.equal(deliveries.length, 0);
});
test('validates SMTP host, ports and strips client-supplied secret fields', () => {
    const { service } = setup();
    for (const value of [{ ...config, host: 'smtp.attacker.org' }, { ...config, port: 25 }, { ...config, senderName: 'bad\nname' }]) {
        assert.throws(() => service.cleanConfig(value), { code: 'invalid-argument' });
    }
    assert.equal(service.cleanConfig({ ...config, password: 'never-store' }).password, undefined);
    assert.equal(service.cleanConfig({ ...config, host: 'pro1.mail.ovh.net', port: 587 }).port, 587);
});
test('enforces notification category and hourly quota before SMTP delivery', async () => {
    const { service, records, deliveries } = setup({ 'ustawienia/poczta_ovh': { ...config, notifications: { event: false } } });
    assert.deepEqual(await service.send(request(notification)), { sent: false });
    records.set('ustawienia/poczta_ovh', config);
    records.set('poczta_limity/global', { hour: 1, count: 160 });
    await assert.rejects(service.send(request(notification)), { code: 'resource-exhausted' });
    assert.equal(deliveries.length, 0);
});
test('STARTTLS cannot be downgraded for port 587', async () => {
    const { service, options } = setup({ 'ustawienia/poczta_ovh': { ...config, port: 587 } });
    await service.send(request(notification));
    assert.equal(options[0].secure, false);
    assert.equal(options[0].requireTLS, true);
});
