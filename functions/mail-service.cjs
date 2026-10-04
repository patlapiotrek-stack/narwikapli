const HEAD_ADMINS = new Set(['patlapiotrek@gmail.com', 'baginskip13@gmail.com']);
const ADMIN_ROLES = new Set(['head_admin', 'admin', 'zarzad_sm']);
const TYPES = ['welcome', 'task', 'role', 'request', 'idea', 'event', 'announcement', 'problem', 'reminder', 'other'];
const DEFAULTS = Object.freeze({ enabled: false, mailbox: '', senderName: 'Narwik Promotion', host: 'smtp.mail.ovh.net', port: 465, notifications: {} });
const email = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const normalize = value => String(value || '').trim().toLowerCase();

function createMailService({ db, createTransport, getPassword, HttpError, now = Date.now, logError = () => {} }) {
    const fail = (code, message) => { throw new HttpError(code, message); };
    async function authorize(request, headOnly = false) {
        const token = request.auth?.token;
        if (!request.auth?.uid || !token?.email || token.email_verified !== true) fail('unauthenticated', 'Zaloguj się zweryfikowanym kontem.');
        const address = normalize(token.email);
        const roleDoc = await db.doc(`role_uzytkownikow/${address}`).get();
        const role = roleDoc.data()?.rola;
        if (role === 'blocked') fail('permission-denied', 'Konto jest zablokowane.');
        const head = HEAD_ADMINS.has(address) || role === 'head_admin';
        if (headOnly ? !head : !head && !ADMIN_ROLES.has(role)) fail('permission-denied', 'Brak uprawnień do obsługi poczty.');
        return { address, uid: request.auth.uid, head };
    }
    function cleanConfig(value) {
        if (!value || typeof value !== 'object') fail('invalid-argument', 'Nieprawidłowa konfiguracja.');
        const mailbox = normalize(value.mailbox), host = normalize(value.host), port = Number(value.port);
        const senderName = String(value.senderName || 'Narwik Promotion').trim();
        if (!email(mailbox)) fail('invalid-argument', 'Podaj poprawny adres skrzynki OVH.');
        if (host.length > 253 || !/^(?:ssl0\.ovh\.net|[a-z0-9-]+\.mail\.ovh\.(?:net|ca))$/.test(host)) fail('invalid-argument', 'Podaj serwer SMTP OVH wskazany w panelu skrzynki.');
        if (![465, 587].includes(port)) fail('invalid-argument', 'Dozwolone są porty 465 i 587.');
        if (senderName.length > 100 || /[\r\n]/.test(senderName)) fail('invalid-argument', 'Nazwa nadawcy jest nieprawidłowa.');
        const notifications = Object.fromEntries(TYPES.map(type => [type, value.notifications?.[type] !== false]));
        return { enabled: value.enabled === true, mailbox, host, port, senderName, notifications };
    }
    async function readConfig() {
        const snapshot = await db.doc('ustawienia/poczta_ovh').get();
        if (!snapshot.exists) return { ...DEFAULTS, notifications: {} };
        return cleanConfig(snapshot.data());
    }
    async function reserveQuota(uid) {
        const hour = Math.floor(now() / 3600000);
        const global = db.doc('poczta_limity/global');
        const user = db.doc(`poczta_limity/${uid}`);
        await db.runTransaction(async tx => {
            const globalDoc = await tx.get(global), userDoc = await tx.get(user);
            const globalCount = globalDoc.data()?.hour === hour ? globalDoc.data().count : 0;
            const userCount = userDoc.data()?.hour === hour ? userDoc.data().count : 0;
            if (globalCount >= 160 || userCount >= 80) fail('resource-exhausted', 'Osiągnięto godzinowy limit powiadomień. Spróbuj później.');
            tx.set(global, { hour, count: globalCount + 1 });
            tx.set(user, { hour, count: userCount + 1 });
        });
    }
    async function getConfig(request) {
        await authorize(request);
        return readConfig();
    }
    async function saveConfig(request) {
        const actor = await authorize(request, true);
        const config = cleanConfig(request.data);
        await db.doc('ustawienia/poczta_ovh').set({ ...config, updatedBy: actor.address, updatedAt: new Date(now()).toISOString() });
        return config;
    }
    async function send(request) {
        const actor = await authorize(request);
        const test = request.data?.test === true;
        if (test && !actor.head) fail('permission-denied', 'Test poczty jest dostępny dla głównego administratora.');
        const config = await readConfig();
        if (!config.mailbox) fail('failed-precondition', 'Zapisz najpierw ustawienia skrzynki OVH.');
        const type = test ? 'other' : request.data?.type;
        if (!TYPES.includes(type)) fail('invalid-argument', 'Nieprawidłowy rodzaj powiadomienia.');
        if (!test && (!config.enabled || config.notifications[type] === false)) return { sent: false };
        const recipient = test ? actor.address : normalize(request.data?.to);
        const subject = test ? 'Test poczty OVH — Narwik Promotion' : request.data?.subject;
        const message = test ? 'Połączenie aplikacji ze skrzynką OVH działa poprawnie.' : request.data?.message;
        if (!email(recipient) || typeof subject !== 'string' || !subject.trim() || subject.length > 200 || /[\r\n]/.test(subject)
            || typeof message !== 'string' || !message.trim() || message.length > 20000) fail('invalid-argument', 'Nieprawidłowy adres lub treść powiadomienia.');
        const recipientRole = await db.doc(`role_uzytkownikow/${recipient}`).get();
        if (recipientRole.data()?.rola === 'blocked') fail('permission-denied', 'Odbiorca ma zablokowane konto.');
        if (recipient !== actor.address && !HEAD_ADMINS.has(recipient)) {
            const person = await db.doc(`uzytkownicy/${recipient}`).get();
            const board = person.exists ? null : await db.collection('zarzad').where('email', '==', recipient).limit(1).get();
            if (!person.exists && board.empty) fail('permission-denied', 'Powiadomienia można wysyłać wyłącznie do członków zespołu.');
        }
        const password = getPassword();
        if (!password) fail('failed-precondition', 'Skonfiguruj hasło skrzynki w sekrecie OVH_SMTP_PASSWORD.');
        await reserveQuota(actor.uid);
        const transport = createTransport({ host: config.host, port: config.port, secure: config.port === 465, requireTLS: true,
            auth: { user: config.mailbox, pass: password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
        try {
            const result = await transport.sendMail({ from: { name: config.senderName, address: config.mailbox }, to: recipient,
                replyTo: actor.address, subject: subject.trim(), text: message, disableFileAccess: true, disableUrlAccess: true });
            if (!Array.isArray(result.accepted) || !result.accepted.some(address => normalize(address) === recipient)) fail('unavailable', 'Serwer OVH nie przyjął wiadomości.');
            return { sent: true };
        } catch (error) {
            logError({ code: error.code || 'SMTP_FAILURE' });
            fail('unavailable', 'Wysyłka przez OVH nie powiodła się. Sprawdź konfigurację i hasło skrzynki.');
        } finally { transport.close?.(); }
    }
    return { getConfig, saveConfig, send, cleanConfig, authorize, reserveQuota };
}
module.exports = { createMailService, DEFAULTS };
