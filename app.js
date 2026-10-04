import { escapeHtml, jsAttribute, safeUrl, safeColor, validateFile, nextMonth, preferences } from "./security.js?v=20260913-chat-cache-2";
const urlAttribute = value => escapeHtml(safeUrl(value));
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, getDoc, setDoc, onSnapshot as firebaseOnSnapshot, arrayUnion, arrayRemove, writeBatch, runTransaction } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

// ==========================================
// 1. INICJALIZACJA FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA-c_naXkvipteC7SworQqpdeeyUfNvE-E",
    authDomain: "narwikpromotionapp.firebaseapp.com",
    projectId: "narwikpromotionapp",
    storageBucket: "narwikpromotionapp.firebasestorage.app",
    messagingSenderId: "538678849790",
    appId: "1:538678849790:web:a317bf47b26f1d093075af",
    measurementId: "G-X5V5KP4DH6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const onSnapshot = (q, next, onError) => firebaseOnSnapshot(q, snapshot => {
    try { next(snapshot); } catch (error) { window.reportError(error); }
}, error => onError ? onError(error) : window.reportError(error));
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// ==========================================
// 2. ZMIENNE GLOBALNE
// ==========================================
window.currentUserEmail = null;
window.currentRole = "user";
const HEAD_ADMINS = Object.freeze(['patlapiotrek@gmail.com', 'baginskip13@gmail.com']);
const isConfiguredHead = email => HEAD_ADMINS.includes(String(email || '').toLowerCase().trim());
window.SUPER_ADMIN = HEAD_ADMINS[0];
window.wszystkieOsobyMap = new Map();
window.konwersacjeMap = new Map();

window.editZarzadId = null; window.editGaleriaId = null; window.editWydarzenieId = null; window.editZadanieId = null; window.editOgloszenieId = null;
window.editKompendiumId = null; window.editZapotrzebowanieId = null; window.editPomyslId = null;
window.currentChatEmail = null; window.unsubscribeChat = null; window.unsubKonwersacje = null; window.unsubPowiadomienia = null; window.unsubUsersPresence = null; window.typingTimeout = null; window.presenceInterval = null;
window.currentReplyTo = null; window.startX = 0; window.currX = 0;
window.currentCalDate = nextMonth(new Date(), 0);

window.isSoftAdminGlobal = false;
window.isHardAdminGlobal = false;
window.emailJsConfig = { enabled: false, serviceId: '', templateId: '', publicKey: '', notifications: {} };
const EMAIL_NOTIFICATION_TYPES = Object.freeze({
    welcome: 'Nowe konto / powitanie', task: 'Nowe zadanie', role: 'Zmiana roli', request: 'Nowe zapotrzebowanie',
    idea: 'Nowy pomysł', event: 'Nowe wydarzenie', announcement: 'Ogłoszenie', problem: 'Zgłoszenie problemu', reminder: 'Przypomnienie'
});
window.emailJsNotificationType = subject => {
    const value = String(subject || '').toLowerCase();
    if (value.includes('witaj') || value.includes('konto')) return 'welcome';
    if (value.includes('zadanie')) return 'task';
    if (value.includes('rola') || value.includes('uprawnienia')) return 'role';
    if (value.includes('zapotrzebowanie')) return 'request';
    if (value.includes('pomysł')) return 'idea';
    if (value.includes('wydarzenie')) return 'event';
    if (value.includes('ogłoszenie')) return 'announcement';
    if (value.includes('problem')) return 'problem';
    if (value.includes('przypomnienie')) return 'reminder';
    return 'other';
};

// ==========================================
// 3. LOGIKA PWA (ZAINSTALUJ APLIKACJĘ)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (!isStandalone && window.innerWidth < 768 && !preferences.get('pwa_dismissed')) {
        const prompt = document.getElementById('pwa-prompt');
        const desc = document.getElementById('pwa-desc');
        if (prompt && desc) {
            if (isIos) {
                desc.innerHTML = `Stuknij przycisk <b>Udostępnij</b> (kwadrat ze strzałką) na dole ekranu, a następnie wybierz <b>"Do ekranu początkowego"</b>.`;
            } else {
                desc.innerHTML = `Stuknij menu (trzy kropki) w rogu przeglądarki i wybierz <b>"Dodaj do ekranu głównego"</b>.`;
            }
            setTimeout(() => prompt.style.display = 'block', 2000);
        }
    }
});

window.zamknijPwaPrompt = () => {
    preferences.set('pwa_dismissed', '1');
    document.getElementById('pwa-prompt').style.display = 'none';
};

// ==========================================
// 4. BEZPIECZNE FUNKCJE POMOCNICZE
// ==========================================
window.getPersonNameText = (e) => { if(!e) return 'Brak'; if(window.wszystkieOsobyMap.has(e)){ const d=window.wszystkieOsobyMap.get(e); if(d.name&&d.name!=="Zarejestrowany Użytkownik") return d.name; } const n=e.split('@')[0]; return n.charAt(0).toUpperCase()+n.slice(1); };
window.getPersonAvatar = (e) => {
    const custom = window.wszystkieOsobyMap.has(e) ? safeUrl(window.wszystkieOsobyMap.get(e)?.avatarUrl || '') : '';
    return custom || `https://ui-avatars.com/api/?name=${encodeURIComponent(window.getPersonNameText(e))}&background=0284c7&color=fff&rounded=true`;
};
window.getConvId = (a, b) => [a, b].sort().join('_');
const dateToMillis = value => {
    if (value && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value && Number.isFinite(Number(value.seconds))) return Number(value.seconds) * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
    return new Date(value ?? 0).getTime();
};
const messageSortMillis = message => {
    const explicit = Number(message?.sortAt);
    return Number.isFinite(explicit) ? explicit : dateToMillis(message?.czas ?? message?.createdAt ?? message?.timestamp);
};
// Plain text by design. Callers decide how to style the label.
window.getStatusTxt = (la) => {
    if (!la) return 'Offline';
    const stamp = dateToMillis(la);
    if (!Number.isFinite(stamp)) return 'Offline';
    const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
    if (minutes < 1) return 'Aktywny/a przed chwilą';
    if (minutes < 60) return `Aktywny/a ${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Aktywny/a ${hours} godz. temu`;
    return `Aktywny/a ${Math.floor(hours / 24)} dni temu`;
};

window.zapiszDoDziennika = async (akcja) => {
    try { await addDoc(collection(db, "dziennik"), { akcja: akcja, kto: window.currentUserEmail, data: new Date().toISOString() }); } catch(e) { window.reportError(e); }
};

// ==========================================
// 5. FUNKCJE UI (ALERTY I MODALE)
// ==========================================
window.pokazCustomAlert = (w, t='info') => {
    const o = document.createElement('div'); o.className = 'custom-alert-overlay';
    let iconHTML = '<i class="fas fa-info-circle custom-alert-icon" style="color:var(--primary);"></i>'; let btnClass = 'custom-alert-btn custom-alert-btn-primary';
    if(t === 'error') { iconHTML = '<i class="fas fa-exclamation-circle custom-alert-icon" style="color:var(--danger);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-danger'; }
    else if(t === 'success') { iconHTML = '<i class="fas fa-check-circle custom-alert-icon" style="color:var(--success);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-success'; }
    o.innerHTML = `<div class="custom-alert-box">${iconHTML}<div class="custom-alert-text">${escapeHtml(w)}</div><button class="${escapeHtml(btnClass)}" onclick="const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300);">Zrozumiałem</button></div>`;
    document.body.appendChild(o); requestAnimationFrame(() => { requestAnimationFrame(() => { o.classList.add('show'); }); });
};

window.pokazCustomConfirm = (w, cb, t='danger') => {
    const o = document.createElement('div'); o.className = 'custom-alert-overlay';
    let iconHTML = '<i class="fas fa-question-circle custom-alert-icon" style="color:var(--primary);"></i>'; let btnClass = 'custom-alert-btn custom-alert-btn-primary';
    if(t === 'danger') { iconHTML = '<i class="fas fa-exclamation-triangle custom-alert-icon" style="color:var(--danger);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-danger'; }
    else if(t === 'success') { iconHTML = '<i class="fas fa-check-circle custom-alert-icon" style="color:var(--success);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-success'; }
    o.innerHTML = `<div class="custom-alert-box">${iconHTML}<div class="custom-alert-text">${escapeHtml(w)}</div><div class="custom-confirm-row"><button class="custom-alert-btn custom-confirm-btn-cancel" onclick="const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300);">Anuluj</button><button class="${escapeHtml(btnClass)}" id="cc-ok-btn">Potwierdzam</button></div></div>`;
    document.body.appendChild(o); requestAnimationFrame(() => { requestAnimationFrame(() => { o.classList.add('show'); }); });
    o.querySelector('#cc-ok-btn').addEventListener('click', function() { const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300); Promise.resolve().then(cb).catch(window.reportError); }, { once: true });
};

window.pokazLoading = () => { const l = document.getElementById('loading-screen'); if(l){ l.style.visibility='visible'; l.style.opacity='1'; } };
window.ukryjLoading = () => { const l = document.getElementById('loading-screen'); if(l){ l.style.opacity='0'; setTimeout(()=>l.style.visibility='hidden', 400); } };

window.zmienMotyw = (themeName) => { if (!['light','dark','pink','mint','forest','sunset','lavender','cyberpunk'].includes(themeName)) themeName = 'light'; document.documentElement.setAttribute('data-theme', themeName); preferences.set('user_theme', themeName); if(window.currentUserEmail) { updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { theme: themeName }).catch(()=>{}); } };
window.otworzProfil = async (io = false) => {
    const m = document.getElementById('modal-profile'); if(!m) return;
    document.getElementById('profile-file').value = '';
    const title = document.getElementById('profile-modal-title'), desc = document.getElementById('profile-modal-desc');
    if(io){ if(title) title.innerHTML = '<i class="fas fa-rocket"></i> Witaj w Zespole!'; if(desc) desc.textContent = "Uzupełnij profil na start."; }
    else{ if(title) title.innerHTML = '<i class="fas fa-user-edit"></i> Ustawienia'; if(desc) desc.textContent = "Zaktualizuj swoje dane lub zmień motyw."; }

    if(window.currentUserEmail && window.wszystkieOsobyMap.has(window.currentUserEmail)){
        const md = window.wszystkieOsobyMap.get(window.currentUserEmail);
        document.getElementById('profile-name').value = md.name !== "Zarejestrowany Użytkownik" ? md.name : "";
        document.getElementById('profile-phone').value = md.phone || "";
        document.getElementById('profile-bio').value = md.bio || "";
        document.getElementById('profile-preview-img').src = safeUrl(md.avatarUrl) || window.getPersonAvatar(window.currentUserEmail);
        const sel = document.getElementById('theme-selector'); if(sel) sel.value = preferences.get('user_theme') || 'light';
    }
    m.style.display = 'flex';
};

window.podgladZdjeciaProfilu = (event) => { const f = event.target.files[0]; if(f){ try { validateFile(f, true); } catch (e) { event.target.value = ''; return window.reportError(e); } const r = new FileReader(); r.onload = e => document.getElementById('profile-preview-img').src = e.target.result; r.readAsDataURL(f); } };
window.usunZdjecieProfilu = async () => { try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { avatarUrl: "" }); document.getElementById('profile-preview-img').src = window.getPersonAvatar(window.currentUserEmail); window.pokazCustomAlert("Zdjęcie usunięte!", "success"); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } };

window.zapiszProfil = async () => {
    const f = document.getElementById('profile-file')?.files[0], n = document.getElementById('profile-name')?.value.trim(), p = document.getElementById('profile-phone')?.value.trim(), b = document.getElementById('profile-bio')?.value.trim();
    if (f) { try { validateFile(f, true); } catch (e) { return window.reportError(e); } }
    if(!n) return window.pokazCustomAlert("Imię jest wymagane!", "error");
    window.pokazLoading();
    try {
        const ur = doc(db, "uzytkownicy", window.currentUserEmail); let au = window.wszystkieOsobyMap.get(window.currentUserEmail)?.avatarUrl || "";
        if(f){ const ir = ref(storage, 'avatars/'+auth.currentUser.uid+'/'+crypto.randomUUID()); await uploadBytes(ir, f); au = await getDownloadURL(ir); }
        await updateDoc(ur, { imieNazwisko: n, telefon: p, opis: b, avatarUrl: au });
        document.getElementById('modal-profile').style.display = 'none'; window.pokazCustomAlert("Zaktualizowano profil!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); } window.ukryjLoading();
};

window.bezpieczneWylogowanie = async () => {
    if(auth.currentUser) {
        window.pokazLoading();
        try { await window.updatePresence(false); await signOut(auth); window.location.reload(); } catch(e) { window.pokazCustomAlert("Błąd wylogowania", "error"); window.ukryjLoading(); }
    }
};

window.otworzProsbeUsuniecia = () => { document.getElementById('modal-profile').style.display='none'; document.getElementById('delete-reason').value=''; document.getElementById('modal-delete-account').style.display='flex'; };
window.wyslijProsbeUsuniecia = async () => {
    const powod = document.getElementById('delete-reason')?.value.trim(); if(!powod) return window.pokazCustomAlert("Podaj powód opuszczenia zespołu.", "error");
    try { await addDoc(collection(db, "prosby_usuniecie"), { email: window.currentUserEmail, imie: window.getPersonNameText(window.currentUserEmail), powod: powod, data: new Date().toISOString() }); document.getElementById('modal-delete-account').style.display = 'none'; window.pokazCustomAlert("Prośba wysłana do Head Admina.", "success"); window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "🚨 Prośba o usunięcie konta", `${window.getPersonNameText(window.currentUserEmail)} chce usunąć konto.`); } catch(e) { window.reportError(e); }
};
window.zatwierdzUsuniecieKonta = async (reqId, uEmail) => { window.pokazCustomConfirm(`Na pewno zablokować dostęp i usunąć profil ${uEmail}? Zostanie on zablokowany.`, async () => { try { window.zapiszDoDziennika(`Usunięto konto: ${uEmail}`); const batch = writeBatch(db); batch.set(doc(db, "role_uzytkownikow", uEmail), { email: uEmail, rola: "blocked" }); batch.delete(doc(db, "uzytkownicy", uEmail)); batch.delete(doc(db, "prosby_usuniecie", reqId)); await batch.commit(); window.pokazCustomAlert("Profil usunięty, dostęp zablokowany. Historia aktywności pozostaje w systemie.", "success"); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };

// EMAILE
window.wyslijPowiadomienieWAppce = async (odbiorcaEmail, tytul, tresc) => {
    const recipients = odbiorcaEmail === window.SUPER_ADMIN ? HEAD_ADMINS : [odbiorcaEmail];
    await Promise.all(recipients.map(odbiorca => addDoc(collection(db, "powiadomienia"), {
        nadawca: window.currentUserEmail, odbiorca, tytul, tresc, czas: new Date().toISOString(), odczytane: false
    })));
};

window.oznaczWszystkiePowiadomieniaJakoOdczytane = async () => {
    const q = query(collection(db, "powiadomienia"), where("odbiorca", "==", window.currentUserEmail));
    const snapshots = await getDocs(q);
    await Promise.all(snapshots.docs.filter(d => !d.data().odczytane).map(d => updateDoc(d.ref, { odczytane: true })));
    document.getElementById('modal-notifications').style.display = 'none';
};

window.wczytajKonfiguracjeEmail = async () => {
    try {
        const snapshot = await getDoc(doc(db, 'ustawienia', 'emailjs'));
        if (snapshot.exists()) window.emailJsConfig = { ...window.emailJsConfig, ...snapshot.data(), notifications: snapshot.data().notifications || {} };
    } catch (error) {
        // Konfiguracja EmailJS jest opcjonalna i nie może blokować logowania.
        if (error?.code === 'permission-denied') console.warn('Konfiguracja EmailJS jest niedostępna; e-maile pozostają wyłączone.');
        else window.reportError(error, 'konfiguracja EmailJS');
    }
    const options = document.getElementById('emailjs-notification-options');
    if (options) options.innerHTML = Object.entries(EMAIL_NOTIFICATION_TYPES).map(([key, label]) => `<label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" data-email-type="${key}" style="width:18px!important;height:18px!important;margin:0;"> ${label}</label>`).join('');
    const enabled = document.getElementById('emailjs-enabled'); if (enabled) enabled.checked = window.emailJsConfig.enabled === true;
    const service = document.getElementById('emailjs-service-id'); if (service) service.value = window.emailJsConfig.serviceId || '';
    const template = document.getElementById('emailjs-template-id'); if (template) template.value = window.emailJsConfig.templateId || '';
    const key = document.getElementById('emailjs-public-key'); if (key) key.value = window.emailJsConfig.publicKey || '';
    options?.querySelectorAll('[data-email-type]').forEach(el => { el.checked = window.emailJsConfig.notifications?.[el.dataset.emailType] !== false; });
};

// Jednorazowa, idempotentna migracja starych ról zapisanych pod losowymi ID.
// Wykonuje ją wyłącznie główny administrator; stare dokumenty pozostają jako kopia.
window.migrujStareRole = async () => {
    if (!isConfiguredHead(window.currentUserEmail)) return;
    try {
        const snapshot = await getDocs(collection(db, 'role_uzytkownikow'));
        const validRoles = new Set(['user', 'moderator', 'social_media', 'admin', 'zarzad_sm', 'blocked']);
        const emailPattern = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
        const pendingByEmail = new Map();
        for (const legacy of snapshot.docs) {
            const data = legacy.data();
            const email = String(data.email || '').toLowerCase().trim();
            const role = String(data.rola || 'user');
            if (!emailPattern.test(email) || !validRoles.has(role) || isConfiguredHead(email) || legacy.id === email) continue;
            const target = doc(db, 'role_uzytkownikow', email);
            const existing = await getDoc(target);
            if (!existing.exists() && !pendingByEmail.has(email)) pendingByEmail.set(email, { ref: target, data: { email, rola: role } });
        }
        const pending = [...pendingByEmail.values()];
        if (pending.length) {
            const batch = writeBatch(db);
            pending.forEach(item => batch.set(item.ref, item.data));
            await batch.commit();
            console.info(`Zmigrowano ${pending.length} starych ról do identyfikatorów e-mail.`);
        }
    } catch (error) {
        console.warn('Automatyczna migracja ról nie została wykonana:', error);
    }
};
window.zapiszKonfiguracjeEmail = async () => {
    if (window.currentRole !== 'head_admin') return window.reportError(new Error('Tylko główny administrator może zmieniać konfigurację e-maili.'));
    const serviceId = document.getElementById('emailjs-service-id')?.value.trim();
    const templateId = document.getElementById('emailjs-template-id')?.value.trim();
    const publicKey = document.getElementById('emailjs-public-key')?.value.trim();
    if (serviceId.length > 200 || templateId.length > 200 || publicKey.length > 300) return window.reportError(new Error('Konfiguracja EmailJS jest za długa.'));
    const notifications = {};
    document.querySelectorAll('[data-email-type]').forEach(el => { notifications[el.dataset.emailType] = el.checked; });
    try {
        const config = { enabled: document.getElementById('emailjs-enabled')?.checked === true, serviceId, templateId, publicKey, notifications, updatedBy: window.currentUserEmail, updatedAt: new Date().toISOString() };
        await setDoc(doc(db, 'ustawienia', 'emailjs'), config, { merge: true });
        window.emailJsConfig = config;
        document.getElementById('emailjs-status').textContent = 'Zapisano konfigurację.';
        window.pokazCustomAlert('Konfiguracja e-maili zapisana.', 'success');
    } catch (error) { window.reportError(error); }
};
window.wyslijPowiadomienieEmail = async (odbiorca, temat, wiadomosc, typ = window.emailJsNotificationType(temat)) => {
    const config = window.emailJsConfig;
    if (!config.enabled || !config.serviceId || !config.templateId || !config.publicKey || config.notifications?.[typ] === false) return false;
    if (!window.isHardAdminGlobal || !window.currentUserEmail) return false;
    if (!window.emailjs?.send) return window.reportError(new Error('EmailJS nie został załadowany. Odśwież aplikację.'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(odbiorca || ''))) return false;
    try {
        return await window.emailjs.send(config.serviceId, config.templateId, { to_email: odbiorca, subject: temat, message: wiadomosc, from_email: window.currentUserEmail }, config.publicKey);
    } catch (error) { window.reportError(new Error('Wysyłka e-maila nie powiodła się.')); return false; }
};
window.testujEmailJS = async () => {
    const recipient = window.currentUserEmail;
    if (!recipient) return window.reportError(new Error('Zaloguj się jako administrator.'));
    const result = await window.wyslijPowiadomienieEmail(recipient, 'Test konfiguracji EmailJS', 'To jest test konfiguracji powiadomień aplikacji.', 'other');
    if (result) window.pokazCustomAlert('Wysłano wiadomość testową na Twój adres.', 'success');
    else window.reportError(new Error('Test nie został wysłany. Włącz EmailJS globalnie i rodzaj „inne” lub użyj „Wyślij test” po zapisaniu konfiguracji.'));
};

window.wyslijPrzypomnienie = async (eventId) => {
    try {
        const d = await getDoc(doc(db, "wydarzenia", eventId)); if(!d.exists()) return; const x = d.data();
        if(!x.osoby || x.osoby.length === 0) { window.pokazCustomAlert("Brak przypisanych osób.", "error"); return; }
        window.pokazCustomAlert("Wysyłam przypomnienia w aplikacji...", "info");
        for(let e of x.osoby) { await window.wyslijPowiadomienieWAppce(e, `🔔 PRZYPOMNIENIE: ${x.nazwa}`, `Przypominamy o wydarzeniu: ${x.nazwa}.\nKiedy: ${x.start}\nGdzie: ${x.lokacja || 'Brak'}`); }
        window.zapiszDoDziennika(`Wysłano przypomnienie w aplikacji o wydarzeniu: ${x.nazwa}`);
        window.pokazCustomAlert("Przypomnienia wysłano w aplikacji.", "success");
    } catch(err) { window.pokazCustomAlert("Błąd: " + err.message, "error"); }
};

window.wyslijOgloszenieGlobalne = async () => {
    const ty = document.getElementById('edit-ogl-tytul')?.value.trim(), tr = document.getElementById('edit-ogl-tresc')?.value.trim();
    if(!ty || !tr) return window.pokazCustomAlert("Wypełnij tytuł i treść ogłoszenia!", "error");
    window.pokazLoading();
    try {
        await addDoc(collection(db, "ogloszenia_globalne"), { tytul: ty, tresc: tr, autor: window.currentUserEmail, data: new Date().toISOString() });
        const snaps = await getDocs(collection(db, "uzytkownicy")); let recipients = []; snaps.forEach(d => recipients.push(d.data().email));
        for(let e of recipients) { window.wyslijPowiadomienieWAppce(e, `📢 ${ty}`, tr); }
        window.zapiszDoDziennika(`Nadano ogłoszenie: ${ty}`);
        document.getElementById('modal-ogloszenie').style.display = 'none'; document.getElementById('edit-ogl-tytul').value = ''; document.getElementById('edit-ogl-tresc').value = ''; window.pokazCustomAlert("Ogłoszenie dodane!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.pokazCustomAlert("Błąd: " + e.message, "error"); } window.ukryjLoading();
};
window.usunOgloszenie = async (id) => { window.pokazCustomConfirm("Usunąć to ogłoszenie z tablicy?", async () => { try { await deleteDoc(doc(db, "ogloszenia_globalne", id)); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };
window.otworzEdycjeOgloszenia = async (id, ty, tr) => { window.editOgloszenieId = id; document.getElementById('edit-ogl-tytul').value = decodeURIComponent(ty); document.getElementById('edit-ogl-tresc').value = decodeURIComponent(tr); document.getElementById('modal-ogloszenie').style.display = 'flex'; };
window.zapiszEdytowaneOgloszenie = async () => { if (!window.editOgloszenieId) return window.wyslijOgloszenieGlobalne(); const ty = document.getElementById('edit-ogl-tytul').value.trim(), tr = document.getElementById('edit-ogl-tresc').value.trim(); if(!ty || !tr) return window.pokazCustomAlert("Wypełnij pola!", "error"); document.getElementById('modal-ogloszenie').style.display = 'none'; try { await updateDoc(doc(db, "ogloszenia_globalne", window.editOgloszenieId), { tytul: ty, tresc: tr }); window.editOgloszenieId = null; window.pokazCustomAlert("Ogłoszenie zaktualizowane.", "success"); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } };

// NAWIGACJA
window.przelaczStrone = (pageId) => {
    const pages = document.querySelectorAll('.page'); pages.forEach(p => p.style.display = 'none'); document.getElementById(pageId).style.display = 'block';
    const navLinks = document.querySelectorAll('.bottom-nav a'); navLinks.forEach(l => l.classList.remove('active'));
    let matchingNav = document.querySelector(`.bottom-nav a[data-target="${pageId}"]`);
    if(matchingNav) matchingNav.classList.add('active'); else { const menuNav = document.querySelector(`.bottom-nav a[data-target="page-menu"]`); if(menuNav) menuNav.classList.add('active'); }
    window.scrollTo(0,0);
};
document.querySelectorAll('.bottom-nav a').forEach(k => { k.addEventListener('click', e => { e.preventDefault(); window.przelaczStrone(k.getAttribute('data-target')); }); });

window.userIsOnline = user => {
    if (!user?.online) return false;
    if (!user.lastActive) return true;
    const age = Date.now() - dateToMillis(user.lastActive);
    return Number.isFinite(age) && age < 3 * 60 * 1000;
};
// Chat uses plain text presence labels so status text can never become markup.
window.getPresenceLabel = user => {
    if (window.userIsOnline(user)) return 'Aktywny/a teraz';
    const raw = user?.lastActive;
    if (!raw) return 'Offline';
    const stamp = dateToMillis(raw);
    if (!Number.isFinite(stamp)) return 'Offline';
    const minutes = Math.max(0, Math.floor((Date.now() - stamp) / 60000));
    if (minutes < 1) return 'Aktywny/a przed chwilą';
    if (minutes < 60) return `Aktywny/a ${minutes} min temu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Aktywny/a ${hours} godz. temu`;
    const days = Math.floor(hours / 24);
    return `Aktywny/a ${days} dni temu`;
};
window.updatePresence = async (isOnline) => { if(!window.currentUserEmail) return; try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { online: isOnline, lastActive: new Date().toISOString() }); } catch(e) { if (e?.code !== 'permission-denied') window.reportError(e, 'status aktywności'); } };
window.przewinChatNaDol = () => { setTimeout(() => { const c = document.getElementById('chat-messages-container'); if (c) c.scrollTop = c.scrollHeight; }, 80); };
window.autokorektaKordynator = value => String(value || '').replace(/\bPiotrek\b/gi, 'Pan Kordynator');
window.autokorygujChat = input => {
    if (!input) return;
    const before = input.value, start = input.selectionStart, end = input.selectionEnd;
    const after = window.autokorektaKordynator(before);
    if (after !== before) {
        input.value = after;
        const delta = after.length - before.length;
        input.setSelectionRange(Math.max(0, start + delta), Math.max(0, end + delta));
    }
    window.ustawPisanie(input.value);
};
window.dopasujWysokoscCzatu = input => {
    if (!input) return;
    input.style.height = 'auto';
    const maxHeight = parseFloat(getComputedStyle(input).maxHeight) || 120;
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
};
window.ustawPisanie = value => {
    if (!window.currentUserEmail || !window.currentChatEmail) return;
    const cid = window.getConvId(window.currentUserEmail, window.currentChatEmail);
    clearTimeout(window.typingTimeout);
    updateDoc(doc(db, 'konwersacje', cid), { ktoPisze: value.trim() ? window.currentUserEmail : null }).catch(() => {});
    if (value.trim()) window.typingTimeout = setTimeout(() => updateDoc(doc(db, 'konwersacje', cid), { ktoPisze: null }).catch(() => {}), 1600);
};
window.addEventListener("beforeunload", () => window.updatePresence(false));
document.addEventListener("visibilitychange", () => { if(auth.currentUser) window.updatePresence(document.visibilityState === 'visible'); });

// ==========================================
// 6. OBSŁUGA CRUD (EDYCJA, ZAPIS, USUWANIE) ORAZ ISKRY
// ==========================================



window.zarzadzajIskrami = async () => {
    const email = document.getElementById('iskry-user-select').value;
    const amtStr = document.getElementById('iskry-amount').value;
    const pow = document.getElementById('iskry-reason').value.trim();

    if(!email || !amtStr || !pow) return window.pokazCustomAlert("Wypełnij wszystkie pola (Użytkownik, Ilość, Powód)!", "error");
    const amt = Number(amtStr);
    if(!Number.isSafeInteger(amt) || amt === 0 || Math.abs(amt) > 10000) return window.pokazCustomAlert("Ilość musi być poprawną liczbą!", "error");

    window.pokazLoading();
    try {
        await runTransaction(db, async tx => {
            const userRef = doc(db, "uzytkownicy", email);
            const user = await tx.get(userRef);
            if (!user.exists()) throw new Error("Nie znaleziono użytkownika.");
            const balance = Number(user.data().punkty || 0) + amt;
            if (!Number.isSafeInteger(balance)) throw new Error("Nieprawidłowe saldo.");
            tx.update(userRef, { punkty: balance });
            tx.set(doc(collection(db, "iskry_historia")), {
                kto: window.currentUserEmail, komu: email, ilosc: amt, powod: pow, data: new Date().toISOString()
            });
        });
        window.zapiszDoDziennika(`Operacja na Iskrach: ${amt > 0 ? '+' : ''}${amt} dla ${email} (${pow})`);
        window.wyslijPowiadomienieWAppce(email, "⚡ Aktualizacja Iskier", `Twoje saldo Iskier zmieniło się o: ${amt > 0 ? '+' : ''}${amt}. Powód: ${pow}`);

        document.getElementById('iskry-amount').value = '';
        document.getElementById('iskry-reason').value = '';
        window.pokazCustomAlert("Operacja na Iskrach wykonana pomyślnie!", "success");
        window.pobierzWszystko(false);
    } catch(e) {
        window.pokazCustomAlert("Błąd: " + e.message, "error");
    }
    window.ukryjLoading();
};

window.otworzModalaWiedzy = () => { window.editKompendiumId = null; document.getElementById('wiedza-tytul').value = ''; document.getElementById('wiedza-tresc').value = ''; document.getElementById('modal-wiedza').style.display = 'flex'; };
window.zapiszKompendium = async () => {
    const ty = document.getElementById('wiedza-tytul').value.trim(), tr = document.getElementById('wiedza-tresc').value.trim();
    if(!ty || !tr) return window.pokazCustomAlert("Wypełnij pola!", "error");
    document.getElementById('modal-wiedza').style.display = 'none'; window.pokazLoading();
    try {
        if(window.editKompendiumId) { await updateDoc(doc(db, "kompendium", window.editKompendiumId), { tytul: ty, tresc: tr }); window.editKompendiumId = null; }
        else { await addDoc(collection(db, "kompendium"), { tytul: ty, tresc: tr, autor: window.currentUserEmail, data: new Date().toISOString() }); }
        window.pobierzWszystko(false); window.pokazCustomAlert("Zapisano wpis w kompendium.", "success");
    } catch(e) { window.reportError(e); } window.ukryjLoading();
};
window.usunKompendium = (id) => { window.pokazCustomConfirm("Usunąć ten wpis z bazy wiedzy?", async () => { try { await deleteDoc(doc(db, "kompendium", id)); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };
window.otworzEdycjeKompendium = (id, ty, tr) => { window.editKompendiumId = id; document.getElementById('wiedza-tytul').value = decodeURIComponent(ty); document.getElementById('wiedza-tresc').value = decodeURIComponent(tr); document.getElementById('modal-wiedza').style.display = 'flex'; };

window.otworzModalaZapotrzebowania = () => { window.editZapotrzebowanieId = null; document.getElementById('zap-nazwa').value = ''; document.getElementById('zap-opis').value = ''; document.getElementById('modal-zapotrzebowanie').style.display = 'flex'; };
window.zapiszZapotrzebowanie = async () => {
    const naz = document.getElementById('zap-nazwa').value.trim(), op = document.getElementById('zap-opis').value.trim();
    if(!naz) return window.pokazCustomAlert("Podaj nazwę!", "error");
    document.getElementById('modal-zapotrzebowanie').style.display='none'; window.pokazLoading();
    try {
        if(window.editZapotrzebowanieId) { await updateDoc(doc(db, "zapotrzebowania", window.editZapotrzebowanieId), { nazwa: naz, opis: op }); window.editZapotrzebowanieId = null; }
        else {
            await addDoc(collection(db, "zapotrzebowania"), { nazwa: naz, opis: op, zglasza: window.currentUserEmail, status: "Oczekuje", data: new Date().toISOString() });
            window.wyslijPowiadomienieEmail(window.SUPER_ADMIN, "Nowe Zapotrzebowanie", `${window.getPersonNameText(window.currentUserEmail)} dodał zapotrzebowanie: ${naz}\nOpis: ${op}`);
            window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "Nowe zapotrzebowanie", `Zgłoszono: ${naz}`);
        }
        window.pokazCustomAlert("Zapisano zapotrzebowanie!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); } window.ukryjLoading();
};
window.usunZapotrzebowanie = (id) => { window.pokazCustomConfirm("Usunąć zapotrzebowanie?", async () => { try { await deleteDoc(doc(db, "zapotrzebowania", id)); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };
window.otworzEdycjeZapotrzebowanie = (id, naz, op) => { window.editZapotrzebowanieId = id; document.getElementById('zap-nazwa').value = decodeURIComponent(naz); document.getElementById('zap-opis').value = decodeURIComponent(op); document.getElementById('modal-zapotrzebowanie').style.display = 'flex'; };
window.zrealizujZapotrzebowanie = async (id) => { window.pokazCustomConfirm("Oznaczyć jako zrealizowane?", async () => { try { await updateDoc(doc(db, "zapotrzebowania", id), { status: "Zrealizowano" }); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'success'); };

window.otworzModalaPomyslu = () => { window.editPomyslId = null; document.getElementById('pom-tytul').value = ''; document.getElementById('pom-opis').value = ''; document.getElementById('modal-pomysl').style.display = 'flex'; };
window.zapiszPomysl = async () => {
    const ty = document.getElementById('pom-tytul').value.trim(), op = document.getElementById('pom-opis').value.trim();
    if(!ty) return window.pokazCustomAlert("Podaj tytuł pomysłu!", "error");
    document.getElementById('modal-pomysl').style.display='none'; window.pokazLoading();
    try {
        if(window.editPomyslId) { await updateDoc(doc(db, "pomysly", window.editPomyslId), { tytul: ty, opis: op }); window.editPomyslId = null; }
        else {
            await addDoc(collection(db, "pomysly"), { tytul: ty, opis: op, zglasza: window.currentUserEmail, upvotes: [], downvotes: [], data: new Date().toISOString() });

            window.wyslijPowiadomienieEmail(window.SUPER_ADMIN, "Nowy Pomysł", `${window.getPersonNameText(window.currentUserEmail)} dodał pomysł na rozwój aplikacji: ${ty}\nOpis: ${op}`);
            window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "Nowy pomysł", `Zgłoszono: ${ty}`);
        }
        window.pokazCustomAlert("Zapisano pomysł!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); } window.ukryjLoading();
};
window.usunPomysl = (id) => { window.pokazCustomConfirm("Usunąć ten pomysł?", async () => { try { await deleteDoc(doc(db, "pomysly", id)); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };
window.otworzEdycjePomysla = (id, ty, op) => { window.editPomyslId = id; document.getElementById('pom-tytul').value = decodeURIComponent(ty); document.getElementById('pom-opis').value = decodeURIComponent(op); document.getElementById('modal-pomysl').style.display = 'flex'; };
window.glosujPomysl = async (id, typ) => {
    try {
        const refD = doc(db, "pomysly", id); const sn = await getDoc(refD); if(!sn.exists()) return;
        const dat = sn.data(); let ups = dat.upvotes || [], dws = dat.downvotes || [];
        if(typ === 'up') { if(ups.includes(window.currentUserEmail)) return; await updateDoc(refD, { upvotes: arrayUnion(window.currentUserEmail), downvotes: arrayRemove(window.currentUserEmail) });  }
        else { if(dws.includes(window.currentUserEmail)) return; await updateDoc(refD, { downvotes: arrayUnion(window.currentUserEmail), upvotes: arrayRemove(window.currentUserEmail) }); }
        window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); }
};

window.zapiszPlik = async () => {
    const fi = document.getElementById('plik-file'), files = fi.files, d = document.getElementById('plik-desc')?.value;
    try { validateFile(files[0]); } catch (e) { return window.reportError(e); }
    if(files.length === 0) return window.pokazCustomAlert("Wybierz plik!", "error");
    document.getElementById('modal-plik').style.display = 'none'; window.pokazLoading();
    try {
        const f = files[0]; const ir = ref(storage, 'pliki/'+auth.currentUser.uid+'/'+crypto.randomUUID());
        await uploadBytes(ir, f); const u = await getDownloadURL(ir);
        await addDoc(collection(db, "pliki"), { url: u, storagePath: ir.fullPath, nazwa: f.name, desc: d || f.name, wgral: window.currentUserEmail, dodano: new Date().toISOString() });
        document.getElementById('plik-desc').value = ''; fi.value = ''; window.pokazCustomAlert("Wgrano plik!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.pokazCustomAlert("Błąd", "error"); } window.ukryjLoading();
};
window.usunPlik = (id) => { window.pokazCustomConfirm("Usunąć ten plik bezpowrotnie?", async () => { try { await removeStoredDocument("pliki", id); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }, 'danger'); };

window.zapiszZadanie = async () => {
    if (!window.isSoftAdminGlobal) return window.pokazCustomAlert("Brak uprawnień do dodawania zadań.", "error");

    const t = document.getElementById('task-title')?.value.trim(), d = document.getElementById('task-desc')?.value, a = document.getElementById('task-assigned')?.value;
    if(!t||!a) return window.pokazCustomAlert("Podaj nazwę i przypisz osobę!", "error");
    document.getElementById('modal-task').style.display = 'none';
    try {
        if(window.editZadanieId) { await updateDoc(doc(db, "wydarzenia", window.editZadanieId), { nazwa: "[ZADANIE] " + t, opis: d, osoby: [a] }); window.editZadanieId = null; }
        else {
            await addDoc(collection(db, "wydarzenia"), { nazwa: "[ZADANIE] " + t, opis: d, start: "Oczekuje", lokacja: "Panel Zadań", osoby: [a], status: "Oczekuje", przypomnienieWyslane: false, odczytane: false, checkpoints: [] });
            window.wyslijPowiadomienieWAppce(a, "Nowe Zadanie 📝", `Otrzymałeś nowe zadanie: ${t}`);
            window.wyslijPowiadomienieEmail(a, "Masz nowe zadanie", `Otrzymałeś nowe zadanie od administratora. Zaloguj się do aplikacji, aby sprawdzić szczegóły w panelu Zadań.`);
        }
        document.getElementById('task-title').value = ''; document.getElementById('task-desc').value = ''; document.getElementById('task-assigned').value = '';
        window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); }
};

window.zapiszCzlonka = async () => {
    const n = document.getElementById('bm-name')?.value, r = document.getElementById('bm-role')?.value, e = document.getElementById('bm-email')?.value, c = document.getElementById('bm-contact')?.value || "";
    if(!n||!e) return window.pokazCustomAlert("Imię i Email są wymagane!", "error");
    document.getElementById('modal-board').style.display = 'none';
    try {
        if(window.editZarzadId) { await updateDoc(doc(db, "zarzad", window.editZarzadId), { name: n, role: r, email: e, contact: c }); window.editZarzadId = null; } else await addDoc(collection(db, "zarzad"), { name: n, role: r, email: e, contact: c });
        document.getElementById('bm-name').value = ''; document.getElementById('bm-role').value = ''; document.getElementById('bm-email').value = ''; if(document.getElementById('bm-contact')) document.getElementById('bm-contact').value = '';
        window.pobierzWszystko(false);
    } catch(er) { window.reportError(er); }
};
window.zapiszGalerie = async () => {
    const fi = document.getElementById('gal-file'), files = fi.files, d = document.getElementById('gal-desc')?.value;
    try { if (files.length > 10) throw new Error('Wybierz maksymalnie 10 zdjęć.'); Array.from(files).forEach(f => validateFile(f, true)); } catch (e) { return window.reportError(e); }
    if(files.length === 0 && !window.editGaleriaId) return window.pokazCustomAlert("Wybierz zdjęcie!", "error");
    document.getElementById('modal-gallery').style.display = 'none'; window.pokazLoading();
    try {
        if(window.editGaleriaId) {
            if(files.length > 0){ const ir = ref(storage, 'galeria/'+auth.currentUser.uid+'/'+crypto.randomUUID()); await uploadBytes(ir, files[0]); const u = await getDownloadURL(ir); await updateDoc(doc(db, "galeria", window.editGaleriaId), { url: u, storagePath: ir.fullPath, desc: d }); }
            else await updateDoc(doc(db, "galeria", window.editGaleriaId), { desc: d });
            window.editGaleriaId = null;
        } else {
            for(let i=0; i<files.length; i++) { const ir = ref(storage, 'galeria/'+auth.currentUser.uid+'/'+crypto.randomUUID()); await uploadBytes(ir, files[i]); const u = await getDownloadURL(ir); await addDoc(collection(db, "galeria"), { url: u, storagePath: ir.fullPath, desc: d || `Zdjęcie ${i+1}`, dodano: new Date().toISOString() }); }
        }
        document.getElementById('gal-desc').value = ''; fi.value = ''; window.pokazCustomAlert("Zapisano!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.reportError(e); } window.ukryjLoading();
};

window.zapiszRole = async () => {
    const m = document.getElementById('new-user-email')?.value, r = document.getElementById('new-user-role')?.value;
    if(!m) return window.pokazCustomAlert("Wpisz email!", "error");
    const e = m.toLowerCase().trim();
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e) || !['user','moderator','social_media','admin','zarzad_sm'].includes(r)) return window.reportError(new Error('Podaj poprawny e-mail i rolę.'));
    if (!isConfiguredHead(window.currentUserEmail) && ['admin', 'zarzad_sm'].includes(r)) return window.reportError(new Error('Role Administrator i Zarząd Social Media może nadawać tylko główny administrator.'));
    try {
        await setDoc(doc(db, "role_uzytkownikow", e), { email: e, rola: r });
        window.zapiszDoDziennika(`Nadano rolę: ${r} dla ${e}`);
        window.wyslijPowiadomienieWAppce(e, "Zmieniono uprawnienia 🛡️", `Administrator nadał Ci rolę: ${r.toUpperCase()}`);
        window.wyslijPowiadomienieEmail(e, "Nowa rola w aplikacji", `Twoja rola w zespole to teraz: ${r.toUpperCase()}`);
        window.pokazCustomAlert(`Sukces! Nadano rolę.`, "success"); document.getElementById('new-user-email').value = '';
    } catch(er) { window.reportError(er); }
};

window.zatwierdzProsbeDostepu = async (id, email, role) => {
    if (!window.isHardAdminGlobal) return window.reportError(new Error('Tylko administrator może rozpatrywać prośby o dostęp.'));
    const normalized = String(email || '').toLowerCase().trim();
    if (!['user','moderator','social_media','admin','zarzad_sm'].includes(role)) return window.reportError(new Error('Nieprawidłowa rola.'));
    if (!isConfiguredHead(window.currentUserEmail) && ['admin','zarzad_sm'].includes(role)) return window.reportError(new Error('Podwyższone role może nadawać tylko główny administrator.'));
    try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'role_uzytkownikow', normalized), { email: normalized, rola: role });
        batch.update(doc(db, 'prosby_dostepu', id), { status: 'approved', rola: role, reviewedBy: window.currentUserEmail, reviewedAt: new Date().toISOString() });
        await batch.commit();
        // E-mail jest dodatkiem do akceptacji: jego błąd nie cofa nadanej roli.
        await window.wyslijPowiadomienieEmail(
            normalized,
            'Dostęp przyznany do Narwik Promotion',
            `Administrator zaakceptował Twój dostęp i nadał rolę: ${role}. Otwórz aplikację: https://narwikpromotionapp.web.app`,
            'role'
        );
        window.pokazCustomAlert(`Przyznano rolę ${role} dla ${normalized}.`, 'success');
        window.pobierzWszystko(false);
    } catch (error) { window.reportError(error, 'akceptowanie prośby o dostęp'); }
};
window.odrzucProsbeDostepu = async id => {
    if (!window.isHardAdminGlobal) return window.reportError(new Error('Tylko administrator może rozpatrywać prośby o dostęp.'));
    try {
        await updateDoc(doc(db, 'prosby_dostepu', id), { status: 'rejected', reviewedBy: window.currentUserEmail, reviewedAt: new Date().toISOString() });
        window.pobierzWszystko(false);
    } catch (error) { window.reportError(error, 'odrzucanie prośby o dostęp'); }
};

window.usunElement = (k, id) => { window.pokazCustomConfirm("Usunąć bezpowrotnie?", async () => { try { if (k === "galeria" || k === "pliki") await removeStoredDocument(k, id); else await deleteDoc(doc(db, k, id)); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } }); };
window.otworzEdycjeZarzad = (id, n, r, e, c) => { window.editZarzadId = id; document.getElementById('bm-name').value = decodeURIComponent(n); document.getElementById('bm-role').value = decodeURIComponent(r); document.getElementById('bm-email').value = decodeURIComponent(e); if(document.getElementById('bm-contact')) document.getElementById('bm-contact').value = decodeURIComponent(c); document.getElementById('modal-board').style.display = 'flex'; };
window.otworzEdycjeGaleria = (id, d) => { window.editGaleriaId = id; document.getElementById('gal-desc').value = decodeURIComponent(d); document.getElementById('gal-file').value = ''; document.getElementById('modal-gallery').style.display = 'flex'; };
window.otworzEdycjeWydarzenie = (id, n, s, l, o, oe) => { window.editWydarzenieId = id; document.getElementById('ev-title').value = decodeURIComponent(n); if(document.getElementById('ev-start')) document.getElementById('ev-start').value = decodeURIComponent(s); document.getElementById('ev-location').value = decodeURIComponent(l); if(document.getElementById('ev-desc')) document.getElementById('ev-desc').value = decodeURIComponent(o); const pe = JSON.parse(decodeURIComponent(oe)); document.querySelectorAll('.event-user-cb').forEach(c => { c.checked = pe.includes(c.value); }); document.getElementById('modal-event').style.display = 'flex'; };
window.otworzEdycjeZadanie = (id, n, o, oe) => { window.editZadanieId = id; document.getElementById('task-title').value = decodeURIComponent(n).replace('[ZADANIE] ',''); if(document.getElementById('task-desc')) document.getElementById('task-desc').value = decodeURIComponent(o); const os = JSON.parse(decodeURIComponent(oe)); if(document.getElementById('task-assigned')) document.getElementById('task-assigned').value = os.length > 0 ? os[0] : ''; document.getElementById('modal-task').style.display = 'flex'; };
window.otworzZdjecie = u => { document.getElementById('full-image').src = safeUrl(u); document.getElementById('image-viewer').style.display = 'flex'; };

window.otworzZglosProblem = (id, n) => {
    window.currentProblemZadanieId = id; window.currentProblemZadanieNazwa = n;
    document.getElementById('problem-desc').value = ''; document.getElementById('modal-problem').style.display = 'flex';
};

window.wyslijZgloszenieProblemu = async () => { const p = document.getElementById('problem-desc')?.value.trim(); if(!p){ window.pokazCustomAlert("Podaj powód!", "error"); return; } try { window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, `⚠️ Problem`, `Zgłasza: ${window.getPersonNameText(window.currentUserEmail)}.\nPowód: ${p}`); document.getElementById('modal-problem').style.display = 'none'; window.pokazCustomAlert("Wysłano.", "success"); } catch(e) { window.reportError(e); } };
window.dodajCheckpoint = async (id, k) => { const i = document.getElementById(`cp-input-${k}-${id}`); if(!i || !i.value.trim()){ window.pokazCustomAlert("Wpisz treść!", "error"); return; } const t = i.value.trim(); try { const r = doc(db, "wydarzenia", id), s = await getDoc(r); if(s.exists()){ const d = s.data(), c = d.checkpoints || []; await updateDoc(r, { checkpoints: arrayUnion({ text: t, autor: window.currentUserEmail, data: new Date().toLocaleString('pl-PL') }) }); i.value = ''; window.pobierzWszystko(false); } } catch(e) { window.reportError(e); } };
window.oznaczJakoPrzeczytane = async id => { try { await updateDoc(doc(db, "wydarzenia", id), { odczytane: true }); window.pobierzWszystko(false); } catch(e) { window.reportError(e); } };
window.zmienStatusZadania = (id, ns, tytul='') => {
    if (ns === 'Wykonane') ns = 'Do zatwierdzenia';
    window.pokazCustomConfirm(ns === 'Do zatwierdzenia' ? "Zgłosić zadanie do zatwierdzenia przez administratora?" : (ns === 'W trakcie' ? "Przenieść do 'W trakcie'?" : "Cofnąć/Odrzucić?"), async () => {
        try {
            await updateDoc(doc(db, "wydarzenia", id), { status: ns, start: ns });
            if(ns === 'Do zatwierdzenia') { window.zapiszDoDziennika(`Zgłoszono zadanie do zatwierdzenia: ${tytul}`); }
            window.pobierzWszystko(false);
        } catch(e) { window.reportError(e); }
    }, ns === 'Do zatwierdzenia' ? 'success' : (ns === 'W trakcie' ? 'info' : 'danger'));
};

window.zatwierdzZadanie = async (id, tytul = '') => {
    if (!window.isHardAdminGlobal) return window.reportError(new Error('Tylko administrator może zatwierdzać zadania.'));
    let recipientEmail = '';
    try {
        await runTransaction(db, async tx => {
            const taskRef = doc(db, 'wydarzenia', id);
            const taskSnap = await tx.get(taskRef);
            if (!taskSnap.exists() || taskSnap.data().status !== 'Do zatwierdzenia') throw new Error('To zadanie nie oczekuje już na zatwierdzenie.');
            const task = taskSnap.data(), recipient = task.osoby?.[0];
            recipientEmail = recipient || '';
            if (!recipient) throw new Error('Zadanie nie ma przypisanej osoby.');
            const userRef = doc(db, 'uzytkownicy', recipient), userSnap = await tx.get(userRef);
            if (!userSnap.exists()) throw new Error('Nie znaleziono przypisanej osoby.');
            const points = Number(userSnap.data().punkty || 0) + 10;
            if (!Number.isSafeInteger(points)) throw new Error('Nieprawidłowe saldo punktów.');
            tx.update(taskRef, { status: 'Wykonane', start: 'Wykonane', punktyPrzyznane: true, zatwierdzonePrzez: window.currentUserEmail, zatwierdzoneDnia: new Date().toISOString() });
            tx.update(userRef, { punkty: points });
            tx.set(doc(collection(db, 'iskry_historia')), { kto: window.currentUserEmail, komu: recipient, ilosc: 10, powod: `Zatwierdzenie zadania: ${tytul}`, zadanieId: id, data: new Date().toISOString() });
        });
        await window.wyslijPowiadomienieWAppce(recipientEmail, 'Zadanie zatwierdzone', `Zatwierdzono: ${tytul}. Przyznano 10 Iskier.`);
        window.pokazCustomAlert('Zadanie zatwierdzone. Przyznano 10 Iskier.', 'success');
        window.pobierzWszystko(false);
    } catch (error) { window.reportError(error); }
};

// ==========================================
// 7. CZAT (LOGIKA WYSZUKIWANIA I WIADOMOŚCI)
// ==========================================
window.ts = e => { window.startX = e.touches[0].clientX; window.currX = window.startX; };
window.tm = (e, el) => { window.currX = e.touches[0].clientX; let df = window.currX - window.startX; if(df > 0 && df <= 80) el.style.transform = `translateX(${df}px)`; };
window.te = (e, el, txt) => { let df = window.currX - window.startX; el.style.transform = 'translateX(0)'; if(df > 50){ window.currentReplyTo = txt; document.getElementById('reply-text').textContent = txt; document.getElementById('reply-box').style.display = 'block'; } window.currX = 0; window.startX = 0; };
window.anulujOdpowiedz = () => { window.currentReplyTo = null; document.getElementById('reply-box').style.display = 'none'; };
const decodeChatValue = value => {
    const raw = String(value ?? '');
    try { return decodeURIComponent(raw); } catch { return raw; }
};
window.otworzChatZ = (e, i, a) => {
    window.currentChatEmail = e;
    const person = window.wszystkieOsobyMap.get(e) || {};
    document.getElementById('chat-header-name').textContent = decodeChatValue(i);
    document.getElementById('chat-header-avatar').src = safeUrl(a) || window.getPersonAvatar(e);
    document.getElementById('chat-header-online').style.display = window.userIsOnline(person) ? 'block' : 'none';
    document.getElementById('chat-header-status').textContent = window.getPresenceLabel(person);
    document.getElementById('modal-chat-view').style.display = 'flex';
    document.getElementById('chat-messages-container').innerHTML = '<div style="text-align:center;padding:40px;"><div class="modern-spinner" style="margin:auto;"></div></div>';
    const cid = window.getConvId(window.currentUserEmail, e);
    if (window.konwersacjeMap.get(cid)?.unreadBy === window.currentUserEmail) updateDoc(doc(db, "konwersacje", cid), { unreadBy: null }).catch(window.reportError);
    window.uruchomNasluchChatu(window.currentUserEmail, e, cid); window.anulujOdpowiedz();
};
window.zamknijChat = () => { clearTimeout(window.typingTimeout); document.getElementById('modal-chat-view').style.display = 'none'; if(window.currentChatEmail){ const cid = window.getConvId(window.currentUserEmail, window.currentChatEmail); updateDoc(doc(db, "konwersacje", cid), { ktoPisze: null }).catch(()=>{}); } window.currentChatEmail = null; const input = document.getElementById('chat-input-text'); if (input) { input.value = ''; window.dopasujWysokoscCzatu(input); } window.anulujOdpowiedz(); if(window.unsubscribeChat){ window.unsubscribeChat(); window.unsubscribeChat = null; } };
window.wyslijWiadomosc = async () => {
    const input = document.getElementById('chat-input-text');
    const rawText = input.value.trim(), text = window.autokorektaKordynator(rawText), recipient = window.currentChatEmail, reply = window.currentReplyTo;
    if (!text || !recipient || !window.currentUserEmail) return;
    if (text !== rawText) input.value = text;
    if (text.length > 4000) return window.reportError(new Error('Wiadomość może mieć maksymalnie 4000 znaków.'));
    try {
        const time = new Date().toISOString(), sortAt = Date.now(), me = window.currentUserEmail;
        const batch = writeBatch(db);
        batch.set(doc(collection(db, "wiadomosci")), {
            nadawca: me, odbiorca: recipient, uczestnicy: [me, recipient], tekst: text, czas: time, sortAt, replyTo: reply
        });
        // Preserve the original participant order for existing conversations.
        const id = window.getConvId(me, recipient);
        const participants = window.konwersacjeMap.get(id)?.uczestnicy || [me, recipient];
        batch.set(doc(db, "konwersacje", id), {
            uczestnicy: participants, lastMsg: text, lastSender: me, timestamp: time, unreadBy: recipient, ktoPisze: null
        }, { merge: true });
        await batch.commit();
        if (window.currentChatEmail === recipient && input.value.trim() === text) {
            input.value = ''; window.dopasujWysokoscCzatu(input); window.anulujOdpowiedz();
        }
        await window.wyslijPowiadomienieWAppce(recipient, "Nowa wiadomość", `Masz wiadomość od: ${window.getPersonNameText(me)}`);
    } catch (error) { window.reportError(error); }
};

// Nasłuch wiadomości toleruje niekompletne stare dokumenty i zawsze przeprowadza
// treść przez bezpieczne helpery zanim trafi do DOM.
window.uruchomNasluchChatu = (me, er, cid) => {
    if (window.unsubscribeChat) window.unsubscribeChat();
    const messagesRef = collection(db, 'wiadomosci');
    const messagesQuery = query(messagesRef, where('uczestnicy', 'array-contains', me));
    window.unsubscribeChat = onSnapshot(messagesQuery, snapshot => {
        const messages = [];
        snapshot.forEach(item => {
            const message = { ...(item.data() || {}), _id: item.id };
            if (Array.isArray(message.uczestnicy) && message.uczestnicy.includes(er)) messages.push(message);
        });
        messages.sort((a, b) => {
            const difference = messageSortMillis(a) - messageSortMillis(b);
            return difference || String(a._id).localeCompare(String(b._id));
        });
        let markup = '';
        messages.forEach(message => {
            const sent = message.nadawca === me;
            const avatar = sent ? window.getPersonAvatar(me) : window.getPersonAvatar(er);
            const messageMillis = message.czas ? dateToMillis(message.czas) : NaN;
            const date = Number.isFinite(messageMillis) ? new Date(messageMillis) : null;
            const time = date && Number.isFinite(date.getTime())
                ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
                : '';
            const reply = message.replyTo ? `<div class="chat-reply-preview">${escapeHtml(message.replyTo)}</div>` : '';
            const text = escapeHtml(message.tekst || '');
            const touch = `ontouchstart="window.ts(event)" ontouchmove="window.tm(event, this)" ontouchend="window.te(event, this, '${jsAttribute(message.tekst || '')}')"`;
            if (sent) {
                markup += `<div class="chat-row sent msg-animated" ${touch}><div class="chat-message-stack"><div class="chat-bubble chat-sent">${reply}${text}</div><div class="chat-meta"><span>${escapeHtml(time)}</span><span aria-label="Wysłano">✓</span></div></div></div>`;
            } else {
                markup += `<div class="chat-row received msg-animated" ${touch}><img class="chat-message-avatar" src="${urlAttribute(avatar)}" alt=""><div class="chat-message-stack"><div class="chat-bubble chat-received">${reply}${text}</div><div class="chat-meta"><span>${escapeHtml(time)}</span></div></div></div>`;
            }
        });
        const container = document.getElementById('chat-messages-container');
        if (!container) return;
        const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
        container.innerHTML = markup || '<div class="chat-empty-state"><i class="far fa-comments"></i><b>Tu zaczyna się rozmowa</b><span>Napisz pierwszą wiadomość.</span></div>';
        if (markup && wasAtBottom) window.przewinChatNaDol();
        const conversation = window.konwersacjeMap.get(cid);
        const typing = document.getElementById('chat-typing-indicator');
        if (typing) typing.style.display = conversation?.ktoPisze === er ? 'flex' : 'none';
    }, error => {
        const container = document.getElementById('chat-messages-container');
        if (container) container.innerHTML = '<div class="chat-empty-state chat-error-state"><i class="fas fa-triangle-exclamation"></i><b>Nie udało się wczytać wiadomości</b><span>Odśwież aplikację i spróbuj ponownie.</span></div>';
        window.reportError(error, 'wiadomości');
    });
};

window.szukajNaCzacie = (v) => {
    const query = String(v || '').toLowerCase().trim();
    document.querySelectorAll('#chat-users-list .user-chat-item').forEach(item => {
        const name = item.querySelector('.chat-list-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
};

window.renderChatList = () => {
    let cl = [];
    window.wszystkieOsobyMap.forEach(o => {
        if(o.email === window.currentUserEmail) return;
        const ci = window.getPersonNameText(o.email), av = window.getPersonAvatar(o.email), cid = window.getConvId(window.currentUserEmail, o.email), cd = window.konwersacjeMap.get(cid);
        const ur = cd && cd.unreadBy === window.currentUserEmail, lm = cd && cd.lastMsg ? cd.lastMsg : 'Rozpocznij czat', ts = cd && cd.timestamp ? dateToMillis(cd.timestamp) : 0;
        cl.push({ e: o.email, ci, av, ur, lm, ts, on: window.userIsOnline(o), la: o.lastActive, person: o });
    });
    cl.sort((a, b) => b.ts - a.ts);
    let h = '';
    cl.forEach(x => {
        const fw = x.ur ? '800' : '500', c = x.ur ? 'var(--text-main)' : 'var(--text-muted)';
        const od = x.on ? `<div class="online-dot"></div>` : '';
        const ui = x.ur ? `<span class="chat-unread-badge" aria-label="Nowa wiadomość">1</span>` : '';
        h += `<div class="user-chat-item" role="button" tabindex="0" data-chat-email="${escapeHtml(x.e)}" data-chat-name="${escapeHtml(x.ci)}" data-chat-avatar="${escapeHtml(x.av)}"><div class="chat-avatar-wrap"><img src="${urlAttribute(x.av)}" alt="">${od}</div><div class="chat-list-main"><div class="chat-list-top"><h4 class="chat-list-name" style="font-weight:${escapeHtml(fw)};">${escapeHtml(x.ci)}</h4>${ui}</div><p class="chat-list-preview" style="color:${escapeHtml(c)};font-weight:${escapeHtml(fw)};">${escapeHtml(x.lm)}</p><p class="chat-list-status">${escapeHtml(window.getPresenceLabel(x.person))}</p></div></div>`;
    });
    const clc = document.getElementById('chat-users-list');
    if (!clc) return;
    clc.innerHTML = h || '<p style="text-align:center;color:var(--text-muted);">Brak osób w systemie.</p>';
    if (!clc.dataset.chatEventsBound) {
        const openFromItem = item => window.otworzChatZ(item.dataset.chatEmail, item.dataset.chatName, item.dataset.chatAvatar);
        clc.addEventListener('click', event => {
            const item = event.target.closest('[data-chat-email]');
            if (item) openFromItem(item);
        });
        clc.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const item = event.target.closest('[data-chat-email]');
            if (item) { event.preventDefault(); openFromItem(item); }
        });
        clc.dataset.chatEventsBound = '1';
    }
};

// ==========================================
// 8. GENERATOR KALENDARZA (SIATKA)
// ==========================================
window.zmienMiesiacKalendarza = (przesuniecie) => {
    window.currentCalDate = nextMonth(window.currentCalDate, przesuniecie);
    window.pobierzWszystko(false);
};

window.rysujSiatkeKalendarza = (wydarzeniaZBazy) => {
    const grid = document.getElementById('cal-grid');
    const title = document.getElementById('cal-month-title');
    if(!grid || !title) return;

    const rok = window.currentCalDate.getFullYear();
    const miesiac = window.currentCalDate.getMonth();

    const nazwyMiesiecy = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
    title.textContent = `${nazwyMiesiecy[miesiac]} ${rok}`;

    grid.innerHTML = '';

    const pierwszyDzien = new Date(rok, miesiac, 1).getDay();
    let pusteDniNaPoczatku = pierwszyDzien === 0 ? 6 : pierwszyDzien - 1;
    const dniWMiesiacu = new Date(rok, miesiac + 1, 0).getDate();

    for (let i = 0; i < pusteDniNaPoczatku; i++) {
        grid.innerHTML += `<div class="cal-cell cal-cell-empty"></div>`;
    }

    const dzisiaj = new Date();
    for (let dzien = 1; dzien <= dniWMiesiacu; dzien++) {
        const aktualnaDataString = `${rok}-${String(miesiac + 1).padStart(2, '0')}-${String(dzien).padStart(2, '0')}`;

        let klasaDzisiaj = '';
        if(rok === dzisiaj.getFullYear() && miesiac === dzisiaj.getMonth() && dzien === dzisiaj.getDate()) {
            klasaDzisiaj = 'today';
        }

        let wydHtml = '';
        wydarzeniaZBazy.forEach(w => {
            if(!String(w.nazwa || '').startsWith('[ZADANIE]') && w.start === aktualnaDataString) {
                const color = safeColor(w.color);
                wydHtml += `<div class="cal-event" style="background:${escapeHtml(color)}" title="${escapeHtml(w.nazwa)}">${escapeHtml(w.nazwa)}</div>`;
            }
        });

        grid.innerHTML += `
            <div class="cal-cell ${escapeHtml(klasaDzisiaj)}" onclick="window.otworzWydarzenieDlaDaty('${jsAttribute(aktualnaDataString)}')">
                <div class="cal-cell-date">${escapeHtml(dzien)}</div>
                ${wydHtml}
            </div>
        `;
    }
};

// ==========================================
// 9. GŁÓWNY SILNIK (POBIERANIE DANYCH)
// ==========================================
let refreshGeneration = 0;
window.pobierzWszystko = async function(cl = false) {
    const generation = ++refreshGeneration;
    const refreshUser = window.currentUserEmail;
    if (!refreshUser) return;
    let pH = '';
    let zH = ''; let bzH = ''; let gH = ''; let kH = ''; let zH2 = ''; let aW = '';
    let lW = 0, lZ = 0, wD = 0;

    const isHeadAdmin = window.currentRole === 'head_admin' || isConfiguredHead(window.currentUserEmail);
    const isHardAdmin = isHeadAdmin || window.currentRole === 'admin' || window.currentRole === 'zarzad_sm';
    let ub = 0;

    try {
        const [uS, zS, gS, eS, pS, zapS, oglS, prS, dostepS, komS, plikS, dzS, iskS] = await Promise.all([
            getDocs(query(collection(db, "uzytkownicy"), orderBy("ostatnieLogowanie", "desc"))),
            getDocs(collection(db, "zarzad")),
            getDocs(query(collection(db, "galeria"), orderBy("dodano", "desc"))),
            getDocs(collection(db, "wydarzenia")),
            getDocs(collection(db, "pomysly")),
            getDocs(collection(db, "zapotrzebowania")),
            getDocs(collection(db, "ogloszenia_globalne")),
            isHeadAdmin ? getDocs(collection(db, "prosby_usuniecie")) : Promise.resolve({docs:[]}),
            isHardAdmin ? getDocs(collection(db, "prosby_dostepu")) : Promise.resolve({docs:[]}),
            getDocs(collection(db, "kompendium")),
            getDocs(collection(db, "pliki")),
            isHeadAdmin ? getDocs(query(collection(db, "dziennik"), orderBy("data", "desc"))) : Promise.resolve({docs:[]}),
            isHardAdmin ? getDocs(collection(db, "iskry_historia")) : Promise.resolve({docs:[]})
        ]);

        if (generation !== refreshGeneration || refreshUser !== window.currentUserEmail) return;
        window.wszystkieOsobyMap.clear();
        ub = uS.docs ? uS.docs.length : 0;
        let rankArr = [];
        if(uS.forEach) { uS.forEach(d => {
            const u = d.data();
            window.wszystkieOsobyMap.set(u.email, { email: u.email, name: u.imieNazwisko || "Zarejestrowany Użytkownik", role: "", avatarUrl: u.avatarUrl || "", bio: u.opis || "", phone: u.telefon || "", online: u.online || false, lastActive: u.lastActive || null });
            rankArr.push({ email: u.email, name: u.imieNazwisko || u.email, punkty: u.punkty || 0, av: u.avatarUrl || window.getPersonAvatar(u.email) });
        }); }
        if(window.currentUserEmail){ const ha = document.getElementById('header-avatar'); if(ha) ha.src = window.getPersonAvatar(window.currentUserEmail); }

        if(window.currentUserEmail) {
            const myRank = rankArr.find(r => r.email === window.currentUserEmail);
            if(myRank) {
                const uic = document.getElementById('user-iskry-count');
                if(uic) uic.textContent = myRank.punkty;
            }
        }

        rankArr.sort((a,b) => b.punkty - a.punkty);
        let rankH = '';
        rankArr.forEach((x, i) => {
            let m = ''; if(i===0) m='🥇'; else if(i===1) m='🥈'; else if(i===2) m='🥉'; else m=`#${i+1}`;
            rankH += `<div class="card" style="padding:15px;display:flex;align-items:center;gap:15px;"><div style="font-size:24px;font-weight:800;color:var(--text-muted);width:30px;text-align:center;">${escapeHtml(m)}</div><img src="${urlAttribute(x.av)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><h4 style="margin:0;font-size:15px;">${escapeHtml(x.name)}</h4></div><div style="font-size:18px;font-weight:800;color:var(--warning);">${escapeHtml(x.punkty)} ⚡</div></div>`;
        });
        const rankL = document.getElementById('ranking-lista'); if(rankL) rankL.innerHTML = rankH;

        if(isHardAdmin) {
            let iskArr = [];
            if(iskS && iskS.forEach) { iskS.forEach(d => { iskArr.push(d.data()); }); }
            iskArr.sort((a,b) => new Date(b.data) - new Date(a.data));
            let iskH = '';
            iskArr.forEach(x => {
                const dataI = new Date(x.data).toLocaleString('pl-PL');
                const amtColor = x.ilosc > 0 ? 'var(--success)' : 'var(--danger)';
                const amtSign = x.ilosc > 0 ? '+' : '';
                iskH += `<div style="padding:8px 0; border-bottom:1px solid var(--border-color);"><b style="color:var(--primary);">${escapeHtml(window.getPersonNameText(x.kto))}</b> ➔ <b style="color:var(--text-main);">${escapeHtml(window.getPersonNameText(x.komu))}</b> <span style="color:${escapeHtml(amtColor)};font-weight:bold;margin-left:5px;">${escapeHtml(amtSign)}${escapeHtml(x.ilosc)} ⚡</span><br><span style="font-size:11px;color:var(--text-muted);">Powód: ${escapeHtml(x.powod)}</span><br><span style="color:var(--text-muted);font-size:10px;">${escapeHtml(dataI)}</span></div>`;
            });
            const iskList = document.getElementById('iskry-historia-lista'); if(iskList) iskList.innerHTML = iskH || '<p style="text-align:center;color:var(--text-muted);">Brak historii operacji.</p>';
        }

        if(zS.forEach) {
            zS.forEach(d => {
                const x = d.data(), id = d.id, ip = window.wszystkieOsobyMap.get(x.email) || {};
                window.wszystkieOsobyMap.set(x.email, { email: x.email, name: ip.name && ip.name !== "Zarejestrowany Użytkownik" ? ip.name : x.name, role: x.role, avatarUrl: ip.avatarUrl || "", bio: ip.bio || "", phone: x.contact || ip.phone || "", online: ip.online || false, lastActive: ip.lastActive || null });
                const o = window.wszystkieOsobyMap.get(x.email);
                const encName = encodeURIComponent(o.name || ''); const encRole = encodeURIComponent(o.role || ''); const encEmail = encodeURIComponent(o.email || ''); const encContact = encodeURIComponent(o.phone || '');
                const ab = isHardAdmin ? `<div style="display:flex;gap:15px;margin-top:15px;font-size:20px;border-top:1px solid var(--border-color);padding-top:12px;"><span onclick="window.otworzEdycjeZarzad('${jsAttribute(id)}','${jsAttribute(encName)}', '${jsAttribute(encRole)}', '${jsAttribute(encEmail)}', '${jsAttribute(encContact)}')" style="cursor:pointer;color:var(--primary);">✏️</span><span onclick="window.usunElement('zarzad','${jsAttribute(id)}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>` : '';
                const activeNow = window.userIsOnline(o);
                const stZ = isHardAdmin ? `<p style="margin:4px 0;font-size:12px;">${activeNow ? '<span style="color:var(--success);font-weight:bold;">🟢 Aktywny/a teraz</span>' : `🕒 ${escapeHtml(window.getStatusTxt(o.lastActive))}`}</p>` : '';
                const ep = isHardAdmin ? `<p style="margin:4px 0;color:var(--text-muted);font-size:13px;word-break:break-all;">📧 ${escapeHtml(o.email)}</p>${stZ}` : '';
                const pp = o.phone ? `<p style="margin:6px 0;color:var(--text-muted);font-size:14px;">📞 ${escapeHtml(o.phone)}</p>` : '';
                const od = o.online ? `<div class="online-dot"></div>` : '';
                const ih = `<div style="position:relative"><img src="${urlAttribute(window.getPersonAvatar(o.email))}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);margin-bottom:10px;">${od}</div>`;
                zH += `<div class="board-card" style="padding:18px;display:flex;flex-direction:column;align-items:center;text-align:center;">${ih}<div style="width:100%;"><h3 style="margin:0 0 6px 0;font-size:18px;color:var(--text-main);">${escapeHtml(o.name)}</h3><p style="margin:0 0 12px 0;font-weight:700;color:var(--primary);">${escapeHtml(o.role)}</p>${o.bio ? `<p style="font-size:13px;color:var(--text-muted);font-style:italic;">"${escapeHtml(o.bio)}"</p>` : ''}${ep}${pp}${ab}</div></div>`;
            });
        }
        const zc = document.getElementById('zarzad-lista'); if(zc) zc.innerHTML = zH;

        window.wszystkieOsobyMap.forEach(o => {
            const encName = window.getPersonNameText(o.email);
            const btnMsg = o.email !== window.currentUserEmail ? `<button onclick="window.otworzChatZ('${jsAttribute(o.email)}', '${jsAttribute(encName)}','${jsAttribute(window.getPersonAvatar(o.email))}')" style="background:var(--primary);color:#fff;padding:8px 15px;border-radius:20px;font-size:12px;font-weight:bold;min-height:auto;"><i class="fas fa-comment"></i> Napisz</button>` : `<span style="font-size:12px;color:var(--text-muted);">To Ty</span>`;
            const roleTxt = o.role ? `<span style="color:var(--primary);font-size:11px;font-weight:bold;display:block;">${escapeHtml(o.role)}</span>` : '';
            bzH += `<div class="user-chat-item" style="cursor:default;"><img src="${urlAttribute(window.getPersonAvatar(o.email))}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;"> <div style="flex:1;"><h4 style="margin:0;font-size:15px;color:var(--text-main);">${escapeHtml(window.getPersonNameText(o.email))}</h4>${roleTxt}<p style="margin:2px 0 0 0;font-size:11px;color:var(--text-muted);">${escapeHtml(o.email)}</p></div> ${btnMsg} </div>`;
        });
        const zl = document.getElementById('zespol-lista'); if(zl) zl.innerHTML = bzH;

        let so = '<option value="">-- Wybierz osobę z listy --</option>', ch = '';
        window.wszystkieOsobyMap.forEach(o => {
            const ci = window.getPersonNameText(o.email), dn = o.role ? `${ci} (${o.role})` : ci;
            let st = dn; if(isHardAdmin) st += ` | ${o.email}`;
            so += `<option value="${escapeHtml(o.email)}">${escapeHtml(st)}</option>`;
            const de = isHardAdmin ? `<span style="font-size:11px;color:var(--text-muted);display:block;white-space:normal;word-break:break-all;">${escapeHtml(o.email)}</span>` : '';
            ch += `<label class="custom-checkbox-card" style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;"><input type="checkbox" class="event-user-cb" value="${escapeHtml(o.email)}" style="width:20px!important;height:20px!important;margin:0;"><div style="display:flex;flex-direction:column;min-width:0;"><b style="color:var(--text-main);font-size:14px;">${escapeHtml(dn)}</b>${de}</div></label>`;
        });

        const iuSelect = document.getElementById('iskry-user-select');
        if(iuSelect) iuSelect.innerHTML = so;

        const ta = document.getElementById('task-assigned'); if(ta) ta.innerHTML = so;
        const eu = document.getElementById('event-users-list'); if(eu) eu.innerHTML = ch;

        window.renderChatList();

        let galeriaArr = [];
        if(gS.forEach) { gS.forEach(d => { galeriaArr.push({...d.data(), id: d.id}); }); }
        galeriaArr.sort((a,b) => new Date(b.dodano) - new Date(a.dodano));
        galeriaArr.forEach(x => {
            const sd = x.desc ? encodeURIComponent(x.desc) : '';
            const ab = isHardAdmin ? `<div style="display:flex;gap:20px;margin-top:12px;font-size:22px;justify-content:center;border-top:1px solid var(--border-color);padding-top:12px;"><span onclick="window.otworzEdycjeGaleria('${jsAttribute(x.id)}','${jsAttribute(sd)}')" style="cursor:pointer;color:var(--primary);">✏️</span><span onclick="window.usunElement('galeria','${jsAttribute(x.id)}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>` : '';
            gH += `<div class="card" style="padding:12px;margin-bottom:0;"><img src="${urlAttribute(x.url)}" style="width:100%;border-radius:10px;cursor:zoom-in;object-fit:cover;height:140px;" onclick="window.otworzZdjecie('${jsAttribute(x.url)}')"><p style="font-size:14px;margin:12px 0 4px 0;text-align:center;font-weight:600;color:var(--text-main);">${escapeHtml(x.desc)}</p>${ab}</div>`;
        });
        const galL = document.getElementById('galeria-lista'); if(galL) galL.innerHTML = gH;

        aW = `<h4 style="margin-top:30px;margin-bottom:12px;color:var(--text-main);font-size:16px;font-weight:700;"><i class="fas fa-calendar-check" style="color:var(--primary);"></i> Nadchodzące spotkania</h4>`;
        const dz = new Date(); dz.setHours(0,0,0,0);

        let wydArr = [];
        if(eS.forEach) { eS.forEach(d => { wydArr.push({...d.data(), id: d.id}); }); }

        window.rysujSiatkeKalendarza(wydArr);

        let kTodo='', kProg='', kReview='', kDone='', cT=0, cP=0, cR=0, cD=0;
        wydArr.sort((a,b) => { if(a.start === "Oczekuje" || a.start==="W trakcie" || a.start==="Wykonane") return -1; if(b.start === "Oczekuje") return 1; return new Date(a.start) - new Date(b.start); });

        wydArr.forEach(x => {
            const id = x.id, it = String(x.nazwa || '').startsWith('[ZADANIE]');
            const eNazwa = encodeURIComponent(x.nazwa || ''); const eStart = encodeURIComponent(x.start || ''); const eLokacja = encodeURIComponent(x.lokacja || ''); const eOpis = encodeURIComponent(x.opis || ''); const soArr = encodeURIComponent(JSON.stringify(x.osoby || []));
            const sn = x.nazwa;
            const dO = x.opis ? `<div style="margin:10px 0;font-size:14px;color:var(--text-muted);background:var(--bg-body);padding:12px;border-radius:8px;border-left:3px solid var(--primary);word-break:break-word;">${escapeHtml(x.opis)}</div>` : '';
            const iaMe = window.currentUserEmail && x.osoby && x.osoby.includes(window.currentUserEmail);

            if(it){ if(iaMe) lZ++; } else {
                lW++;
                if(x.start !== "Brak daty" && x.start !== "Do zrobienia" && x.start !== "Oczekuje" && x.start !== "W trakcie" && x.start !== "Wykonane"){
                    const dw = new Date(x.start);
                    if(!isNaN(dw.getTime()) && dw >= dz && wD < 3){
                        const evColor = safeColor(x.color);
                        aW += `<div class="board-card" style="padding:14px;margin-bottom:10px;font-size:14px;border-left:4px solid ${escapeHtml(evColor)};display:flex;align-items:center;gap:10px;"><div style="background:var(--border-color);color:var(--primary);padding:8px 12px;border-radius:8px;font-weight:bold;font-size:13px;">${escapeHtml(x.start)}</div><div style="font-weight:600;color:var(--text-main);">${escapeHtml(x.nazwa)}</div></div>`; wD++;
                    }
                }
            }

            let ab = '';
            if(isHardAdmin){
                ab += `<div style="display:flex;gap:20px;margin-top:15px;font-size:20px;padding-top:12px;border-top:1px solid var(--border-color);">`;
                if(it) ab += `<span onclick="window.otworzEdycjeZadanie('${jsAttribute(id)}','${jsAttribute(eNazwa)}','${jsAttribute(eOpis)}','${jsAttribute(soArr)}')" style="cursor:pointer;color:var(--primary);">✏️</span>`;
                else ab += `<span onclick="window.otworzEdycjeWydarzenie('${jsAttribute(id)}','${jsAttribute(eNazwa)}','${jsAttribute(eStart)}','${jsAttribute(eLokacja)}','${jsAttribute(eOpis)}','${jsAttribute(soArr)}')" style="cursor:pointer;color:var(--primary);">✏️</span>`;
                ab += `<span onclick="window.usunElement('wydarzenia','${jsAttribute(id)}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>`;
            }

            let btnReminder = ''; if(!it && isHardAdmin) { btnReminder = `<button onclick="window.wyslijPrzypomnienie('${jsAttribute(id)}')" style="background:var(--warning); color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; margin-top:10px; width:100%;"><i class="fas fa-bell"></i> Wyślij przypomnienie</button>`; }

            if(it){
                const cn = x.nazwa.replace('[ZADANIE]','').trim(), pr = x.osoby && x.osoby.length > 0 ? x.osoby[0] : null, pw = pr ? window.getPersonNameText(pr) : 'Brak', sz = x.status || "Oczekuje";
                let ks = "var(--danger)"; if(sz === "Wykonane") ks = "var(--success)"; else if(sz === "W trakcie") ks = "var(--warning)"; else if(sz === "Do zatwierdzenia") ks = "var(--primary)";

                let ai = ''; if(isHardAdmin) ai = `<div style="margin:10px 0;font-size:13px;color:var(--text-muted);background:var(--bg-body);padding:8px;border-radius:6px;display:flex;align-items:center;">Dla: <b style="color:var(--text-main); margin-left:4px; margin-right:4px;">${escapeHtml(pw)}</b> <span style="font-size:11px;">(${escapeHtml(pr)})</span></div>`;

                const cp = x.checkpoints || []; let cl = '';
                if(cp.length > 0){
                    cl = `<div style="margin:15px 0;padding:12px;background:var(--bg-body);border-radius:8px;border:1px solid var(--border-color);"><h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Postępy:</h4><ul style="margin:0;padding-left:15px;font-size:14px;color:var(--text-main);display:flex;flex-direction:column;gap:8px;">`;
                    cp.forEach(c => { cl += `<li style="word-break:break-word;"><b>${escapeHtml(window.getPersonNameText(c.autor))}</b> <span style="color:var(--text-muted);font-size:12px;">(${escapeHtml(c.data)})</span><br>${escapeHtml(c.text)}</li>`; }); cl += `</ul></div>`;
                }

                let cpZ = '';
                if(isHardAdmin || iaMe){ cpZ = `<div style="margin-top:15px;display:flex;gap:8px;width:100%;"><input type="text" id="cp-input-zadania-${escapeHtml(id)}" placeholder="Dodaj krok..." style="flex:1;padding:10px !important;margin:0;"><button onclick="window.dodajCheckpoint('${jsAttribute(id)}','zadania')" style="background:var(--primary);color:#fff;border:none;padding:0 20px;font-weight:bold;margin:0;min-height:auto;">Dodaj</button></div>`; }
                let pb = ''; if(iaMe) pb = `<button onclick="window.otworzZglosProblem('${jsAttribute(id)}','${jsAttribute(sn)}')" style="margin-top:15px;width:100%;background:var(--bg-body);color:var(--danger);border:1px dashed var(--danger);padding:8px;font-weight:bold;font-size:12px;box-shadow:none;min-height:auto;"><i class="fas fa-exclamation-triangle"></i> Zgłoś problem</button>`;

                let akcjeKanban = '';
                if(iaMe || isHardAdmin) {
                    if(sz === "Oczekuje") akcjeKanban = `<button onclick="window.zmienStatusZadania('${jsAttribute(id)}','W trakcie','${jsAttribute(sn)}')" style="width:100%;background:var(--warning);padding:8px;font-size:12px;min-height:auto;"><i class="fas fa-play"></i> Zacznij robić</button>`;
                    else if(sz === "W trakcie") akcjeKanban = `<div style="display:flex;gap:5px;"><button onclick="window.zmienStatusZadania('${jsAttribute(id)}','Oczekuje','${jsAttribute(sn)}')" style="flex:1;background:var(--border-color);color:var(--text-main);padding:8px;font-size:12px;box-shadow:none;min-height:auto;">Cofnij</button><button onclick="window.zmienStatusZadania('${jsAttribute(id)}','Do zatwierdzenia','${jsAttribute(sn)}')" style="flex:2;background:var(--success);padding:8px;font-size:12px;min-height:auto;"><i class="fas fa-check"></i> Zgłoś wykonanie</button></div>`;
                    else if(sz === "Do zatwierdzenia" && isHardAdmin) akcjeKanban = `<button onclick="window.zatwierdzZadanie('${jsAttribute(id)}','${jsAttribute(sn)}')" style="width:100%;background:var(--success);padding:8px;font-size:12px;min-height:auto;"><i class="fas fa-check-double"></i> Zatwierdź i przyznaj 10 Iskier</button>`;
                }

                let kCard = `<div class="card" style="padding:15px;margin-bottom:0;border-left:4px solid ${escapeHtml(ks)};"><h3 style="margin:0 0 8px 0;color:var(--text-main);font-size:16px;">${escapeHtml(cn)}</h3>${dO}${ai}${cl}${cpZ}${pb}<div style="margin-top:15px;">${akcjeKanban}</div>${ab}</div>`;

                if (iaMe && sz !== 'Wykonane') {
                    pH += `<div class="card" style="text-align:left"><h3>${escapeHtml(cn)}</h3><p>${escapeHtml(sz)}</p><button onclick="window.przelaczStrone('page-zadania')">Przejdź do zadań</button></div>`;
                }
                if(sz === "Oczekuje") { kTodo += kCard; cT++; }
                else if(sz === "W trakcie") { kProg += kCard; cP++; }
                else if(sz === "Do zatwierdzenia") { kReview += kCard; cR++; }
                else { kDone += kCard; cD++; }

            } else {
                let lp = ''; if(x.osoby && x.osoby.length > 0){ let im = x.osoby.map(e => window.getPersonNameText(e)).join(', '); lp = `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);background:var(--bg-body);padding:8px;border-radius:6px;border:1px dashed var(--border-color);">Dla: <b style="color:var(--text-main);">${escapeHtml(im)}</b></div>`; }
                const evColor2 = safeColor(x.color);
                kH += `<div class="task-card" style="padding:20px; border-left: 4px solid ${escapeHtml(evColor2)}"><h3 style="margin:0 0 8px 0;color:var(--text-main);font-size:18px;">${escapeHtml(x.nazwa)}</h3>${dO}<div style="display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--text-muted);font-size:14px;background:var(--bg-body);padding:10px;border-radius:8px;"><i class="fas fa-calendar-day" style="color:var(--primary);"></i> <b style="color:var(--text-main);">${escapeHtml(x.start)}</b> | <i class="fas fa-map-marker-alt" style="color:var(--danger);"></i> ${escapeHtml(x.lokacja)}</div>${lp}${btnReminder}${ab}</div>`;
            }
        });

        const kl = document.getElementById('kalendarz-lista'); if(kl) kl.innerHTML = kH || '<p style="text-align:center;color:var(--text-muted);">Brak wydarzeń</p>';

        const kbT = document.getElementById('kb-list-todo'); if(kbT) kbT.innerHTML = kTodo || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Brak zadań</div>';
        const kbP = document.getElementById('kb-list-prog'); if(kbP) kbP.innerHTML = kProg || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Pusto</div>';
        const kbR = document.getElementById('kb-list-review'); if(kbR) kbR.innerHTML = kReview || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Brak zgłoszeń</div>';
        const kbD = document.getElementById('kb-list-done'); if(kbD) kbD.innerHTML = kDone || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Brak gotowych</div>';
        if(document.getElementById('kb-count-todo')) document.getElementById('kb-count-todo').textContent = cT;
        if(document.getElementById('kb-count-prog')) document.getElementById('kb-count-prog').textContent = cP;
        if(document.getElementById('kb-count-review')) document.getElementById('kb-count-review').textContent = cR;
        if(document.getElementById('kb-count-done')) document.getElementById('kb-count-done').textContent = cD;

        let plikH = ''; let plikArr = [];
        if(plikS && plikS.forEach) { plikS.forEach(d => { plikArr.push({...d.data(), id: d.id}); }); }
        plikArr.sort((a,b) => new Date(b.dodano) - new Date(a.dodano));
        plikArr.forEach(x => {
            const canEdit = (x.wgral === window.currentUserEmail || isHardAdmin);
            const ab = canEdit ? `<button onclick="window.usunPlik('${jsAttribute(x.id)}')" style="background:transparent;color:var(--danger);border:none;padding:5px;box-shadow:none;min-height:auto;"><i class="fas fa-trash"></i></button>` : '';
            plikH += `<div class="card" style="padding:15px;display:flex;align-items:center;gap:15px;"><i class="fas fa-file-alt" style="font-size:30px;color:var(--primary);"></i><div style="flex:1;min-width:0;"><h4 style="margin:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(x.desc)}</h4><span style="font-size:11px;color:var(--text-muted);">Dodał: ${escapeHtml(window.getPersonNameText(x.wgral))}</span></div><a href="${urlAttribute(x.url)}" target="_blank" rel="noopener noreferrer" style="background:var(--bg-body);color:var(--primary);padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;"><i class="fas fa-download"></i></a>${ab}</div>`;
        });
        const plL = document.getElementById('pliki-lista'); if(plL) plL.innerHTML = plikH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Dysk jest pusty.</p>';

        let komH = ''; let komArr = [];
        if(komS && komS.forEach) { komS.forEach(d => { komArr.push({...d.data(), id: d.id}); }); }
        komArr.sort((a,b) => new Date(a.data) - new Date(b.data));
        komArr.forEach(x => {
            const canEdit = (x.autor === window.currentUserEmail || isHardAdmin);
            const eTy = encodeURIComponent(x.tytul || ''); const eTr = encodeURIComponent(x.tresc || '');
            let ab = canEdit ? `<div style="display:flex;gap:15px;margin-top:10px;border-top:1px solid var(--border-color);padding-top:10px;"><button onclick="window.otworzEdycjeKompendium('${jsAttribute(x.id)}', '${jsAttribute(eTy)}','${jsAttribute(eTr)}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunKompendium('${jsAttribute(x.id)}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            komH += `<details class="card"><summary><i class="fas fa-bookmark" style="color:var(--primary);margin-right:8px;"></i> ${escapeHtml(x.tytul)}</summary><div style="padding:15px; border-top:1px solid var(--border-color); font-size:14px; color:var(--text-muted); white-space: pre-wrap;">${escapeHtml(x.tresc)}${ab}</div></details>`;
        });
        const wL = document.getElementById('wiedza-lista'); if(wL) wL.innerHTML = komH;

        let pmH = ''; let pomArr = [];
        if(pS && pS.forEach) { pS.forEach(d => { pomArr.push({...d.data(), id: d.id}); }); }
        pomArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        pomArr.forEach(x => {
            const ups = x.upvotes || [], dws = x.downvotes || [];
            const upActive = ups.includes(window.currentUserEmail) ? 'var(--primary)' : 'var(--text-muted)';
            const dwActive = dws.includes(window.currentUserEmail) ? 'var(--danger)' : 'var(--text-muted)';
            const canEdit = (x.zglasza === window.currentUserEmail || isHardAdmin);
            const eTy = encodeURIComponent(x.tytul || ''); const eOp = encodeURIComponent(x.opis || '');
            let editBtns = canEdit ? `<div style="display:flex;gap:10px;margin-top:10px;"><button onclick="window.otworzEdycjePomysla('${jsAttribute(x.id)}', '${jsAttribute(eTy)}','${jsAttribute(eOp)}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunPomysl('${jsAttribute(x.id)}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            pmH += `<div class="card" style="padding:15px;"><h4 style="margin:0 0 5px 0;">${escapeHtml(x.tytul)}</h4><p style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);">${escapeHtml(x.opis)}</p><div style="font-size:11px;color:var(--text-muted);margin-bottom:15px;">Zgłosił(a): ${escapeHtml(window.getPersonNameText(x.zglasza))}</div><div style="display:flex;gap:15px;"><button onclick="window.glosujPomysl('${jsAttribute(x.id)}','up')" style="background:transparent;color:${escapeHtml(upActive)};border:1px solid ${escapeHtml(upActive)};padding:6px 15px;box-shadow:none;min-height:auto;"><i class="fas fa-thumbs-up"></i> ${escapeHtml(ups.length)}</button><button onclick="window.glosujPomysl('${jsAttribute(x.id)}','down')" style="background:transparent;color:${escapeHtml(dwActive)};border:1px solid ${escapeHtml(dwActive)};padding:6px 15px;box-shadow:none;min-height:auto;"><i class="fas fa-thumbs-down"></i> ${escapeHtml(dws.length)}</button></div>${editBtns}</div>`;
        });
        const pml = document.getElementById('pomysly-lista'); if(pml) pml.innerHTML = pmH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Brak pomysłów. Bądź pierwszy!</p>';

        let zapH = ''; let zapArr = [];
        if(zapS && zapS.forEach) { zapS.forEach(d => { zapArr.push({...d.data(), id: d.id}); }); }
        zapArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        zapArr.forEach(x => {
            let stCol = x.status === 'Oczekuje' ? 'var(--warning)' : 'var(--success)';
            let btnAdmin = (x.status === 'Oczekuje' && isHardAdmin) ? `<button onclick="window.zrealizujZapotrzebowanie('${jsAttribute(x.id)}')" style="width:100%;margin-top:10px;padding:8px;background:var(--success);font-weight:bold;min-height:auto;"><i class="fas fa-check"></i> Oznacz jako Zrealizowane</button>` : '';
            const canEdit = (x.zglasza === window.currentUserEmail || isHardAdmin);
            const eNaz = encodeURIComponent(x.nazwa || ''); const eOp = encodeURIComponent(x.opis || '');
            let editBtns = canEdit ? `<div style="display:flex;gap:10px;margin-top:10px;"><button onclick="window.otworzEdycjeZapotrzebowanie('${jsAttribute(x.id)}', '${jsAttribute(eNaz)}','${jsAttribute(eOp)}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunZapotrzebowanie('${jsAttribute(x.id)}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            zapH += `<div class="card" style="padding:15px; border-left: 4px solid ${escapeHtml(stCol)}"><h4 style="margin:0 0 5px 0;">${escapeHtml(x.nazwa)}</h4><p style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);">${escapeHtml(x.opis)}</p><div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;"><span>Od: ${escapeHtml(window.getPersonNameText(x.zglasza))}</span><span style="color:${escapeHtml(stCol)};font-weight:bold;">${escapeHtml(x.status)}</span></div>${btnAdmin}${editBtns}</div>`;
        });
        const zl1 = document.getElementById('zapotrzebowania-lista'); if(zl1) zl1.innerHTML = zapH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Wszystko mamy! Brak zapotrzebowań.</p>';

        let oglH = ''; let oglArr = [];
        if(oglS && oglS.forEach) { oglS.forEach(d => { oglArr.push({...d.data(), id: d.id}); }); }
        oglArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        oglArr.forEach(x => {
            const dataO = new Date(x.data).toLocaleDateString('pl-PL');
            const eTy = encodeURIComponent(x.tytul || ''); const eTr = encodeURIComponent(x.tresc || '');
            const ab = isHardAdmin ? `<div style="display:flex; gap:10px; margin-top:10px; border-top:1px solid var(--border-color); padding-top:10px;"><button onclick="window.otworzEdycjeOgloszenia('${jsAttribute(x.id)}', '${jsAttribute(eTy)}','${jsAttribute(eTr)}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunOgloszenie('${jsAttribute(x.id)}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            oglH += `<div class="board-card" style="padding:15px; background:linear-gradient(to right, var(--bg-body), var(--bg-card)); border:1px solid var(--primary);"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><i class="fas fa-bullhorn" style="color:var(--primary);font-size:20px;"></i><h3 style="margin:0;color:var(--primary);font-size:16px;">${escapeHtml(x.tytul)}</h3></div><p style="margin:0 0 10px 0;font-size:14px;color:var(--text-main);">${escapeHtml(x.tresc)}</p><div style="font-size:11px;color:var(--text-muted);">Nadawca: <b>${escapeHtml(x.autor)}</b> • ${escapeHtml(dataO)}</div>${ab}</div>`;
        });
        const oglL = document.getElementById('globalne-ogloszenia'); if(oglL) oglL.innerHTML = oglH;

        if (isHardAdmin) {
            let accessHtml = '';
            if (dostepS && dostepS.forEach) dostepS.forEach(d => {
                const x = d.data(), id = d.id, email = String(x.email || '').toLowerCase();
                if (x.status !== 'pending' || !email) return;
                const roleOptions = isHeadAdmin
                    ? [['user','Użytkownik'],['moderator','Moderator'],['social_media','Social Media'],['admin','Administrator'],['zarzad_sm','Zarząd Social Media']]
                    : [['user','Użytkownik'],['moderator','Moderator'],['social_media','Social Media']];
                const options = roleOptions.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
                accessHtml += `<div class="card" style="padding:12px;border:1px solid var(--primary);"><b>${escapeHtml(email)}</b><p style="margin:5px 0 10px;font-size:12px;color:var(--text-muted);">Prośba z ${escapeHtml(x.requestedAt || '')}</p><div style="display:flex;gap:8px;"><select style="margin:0;flex:1;">${options}</select><button onclick="window.zatwierdzProsbeDostepu('${jsAttribute(id)}','${jsAttribute(email)}',this.parentElement.querySelector('select').value)" style="background:var(--success);padding:8px;min-height:auto;">Akceptuj</button><button onclick="window.odrzucProsbeDostepu('${jsAttribute(id)}')" style="background:var(--danger);padding:8px;min-height:auto;">Odrzuć</button></div></div>`;
            });
            const accessList = document.getElementById('prosby-dostepu-lista'); if (accessList) accessList.innerHTML = accessHtml || '<p style="color:var(--text-muted);font-size:13px;">Brak oczekujących próśb.</p>';
        }

        if(isHeadAdmin) {
            let prH = '';
            if(prS && prS.forEach) {
                prS.forEach(d => {
                    const x = d.data();
                    prH += `<div class="card" style="padding:12px; border:1px solid var(--danger);"><h4 style="margin:0 0 5px 0;color:var(--danger);">${escapeHtml(x.imie)} (${escapeHtml(x.email)})</h4><p style="margin:0 0 10px 0;font-size:13px;"><b>Powód:</b> ${escapeHtml(x.powod)}</p><button onclick="window.zatwierdzUsuniecieKonta('${jsAttribute(d.id)}', '${jsAttribute(x.email)}')" style="width:100%;background:var(--danger);padding:8px;font-weight:bold;min-height:auto;"><i class="fas fa-trash"></i> Zablokuj dostęp i usuń profil</button></div>`;
                });
            }
            const pUl = document.getElementById('prosby-usuniecie-lista'); if(pUl) pUl.innerHTML = prH || '<p style="color:var(--text-muted);font-size:13px;">Brak próśb o usunięcie.</p>';

            let dzH = ''; let dzArr = [];
            if(dzS && dzS.forEach) { dzS.forEach(d => { dzArr.push({...d.data(), id: d.id}); }); }
            dzArr.sort((a,b) => new Date(b.data) - new Date(a.data));
            dzArr.forEach(x => {
                const dataDz = new Date(x.data).toLocaleString('pl-PL');
                dzH += `<div style="padding:6px 0; border-bottom:1px solid var(--border-color);"><b style="color:var(--primary);">${escapeHtml(x.kto)}</b> <span style="color:var(--text-main);">${escapeHtml(x.akcja)}</span> <br><span style="color:var(--text-muted);font-size:10px;">${escapeHtml(dataDz)}</span></div>`;
            });
            const dzList = document.getElementById('dziennik-lista'); if(dzList) dzList.innerHTML = dzH || '<p style="text-align:center;color:var(--text-muted);">Brak zdarzeń.</p>';
        }

        const pc = document.getElementById('pulpit-lista');
        if(pc){
            if(!pH && window.currentUserEmail) pH = `<div class="board-card" style="padding:20px;text-align:center;border:2px solid var(--success);background:transparent;"><i class="fas fa-check-circle" style="font-size:30px;color:var(--success);margin-bottom:10px;"></i><h3 style="color:var(--success);margin:0;">Wszystko na bieżąco!</h3><p style="color:var(--text-muted);font-size:14px;">Brak oczekujących zadań.</p></div>`;
            if(wD === 0) aW += `<p style="font-size:14px;color:var(--text-muted);padding:10px;">Brak zaplanowanych wydarzeń na najbliższe dni.</p>`;
            pc.innerHTML = pH + aW;
        }

        const sE = document.getElementById('stat-events'); if(sE) sE.textContent = lW;
        const sT = document.getElementById('stat-tasks'); if(sT) sT.textContent = lZ;
        const sU = document.getElementById('stat-users'); if(sU) sU.textContent = ub;

    } catch(e) { window.reportError(e, 'pobieranie danych aplikacji'); } finally { if(cl) window.ukryjLoading(); }
};

// ==========================================
// 10. INICJALIZACJA LOGOWANIA FIREBASE
// ==========================================
onAuthStateChanged(auth, async u => {
    window.pokazLoading();
    window.isHardAdminGlobal = false; window.isSoftAdminGlobal = false; window.currentRole = "user";
    try {
    if(u){
        if (!u.email || !u.emailVerified) throw new Error("Wymagany zweryfikowany adres e-mail.");
        window.currentUserEmail = u.email.toLowerCase().trim();
        if (!HEAD_ADMINS.includes(window.currentUserEmail)) {
            const access = await getDoc(doc(db, "role_uzytkownikow", window.currentUserEmail));
            if (!access.exists() || !['user','moderator','social_media','admin','zarzad_sm'].includes(access.data().rola)) {
                if (access.exists() && access.data().rola === 'blocked') throw new Error("Dostęp do zespołu został zablokowany.");
                const requestRef = doc(db, 'prosby_dostepu', window.currentUserEmail);
                const request = await getDoc(requestRef);
                if (!request.exists() || request.data().status === 'rejected') await setDoc(requestRef, { email: window.currentUserEmail, status: 'pending', requestedAt: new Date().toISOString() }, { merge: true });
                throw new Error(request.exists()
                    && request.data().status === 'pending' ? "Prośba o dostęp oczekuje na decyzję administratora."
                    : "Wysłano prośbę o dostęp. Administrator musi nadać Ci rolę.");
            }
        }
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';

        let needsOnboarding = false;
        try {
            const ur = doc(db, "uzytkownicy", window.currentUserEmail), ud = await getDoc(ur);
            if(!ud.exists()){
                await setDoc(ur, { email: window.currentUserEmail, dataPierwszegoLogowania: new Date(), ostatnieLogowanie: new Date(), imieNazwisko: "", telefon: "", opis: "", avatarUrl: "", online: true, theme: 'light', punkty: 0 });
                needsOnboarding = true;
                window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "Nowy użytkownik!", `Email: ${window.currentUserEmail} założył konto.`);
                window.wyslijPowiadomienieEmail(window.currentUserEmail, "Witaj w zespole Narwik Promotion!", "Konto zostało utworzone.");
                window.zapiszDoDziennika(`Rejestracja nowego konta: ${window.currentUserEmail}`);
            } else {
                const data = ud.data();
                if(data.theme) window.zmienMotyw(data.theme);
                try {
                    const profilePatch = { ostatnieLogowanie: new Date(), online: true };
                    for (const [field, fallback] of [['imieNazwisko', ''], ['telefon', ''], ['opis', ''], ['avatarUrl', ''], ['theme', 'light']]) {
                        if (!(field in data)) profilePatch[field] = fallback;
                    }
                    await updateDoc(ur, profilePatch);
                } catch (profileError) {
                    // Stary profil nie może zablokować dostępu do aplikacji; zapis obecności jest pomocniczy.
                    if (profileError?.code === 'permission-denied') console.warn('Nie udało się zaktualizować obecności starego profilu. Dostęp pozostaje aktywny.');
                    else throw profileError;
                }
            }
        } catch(e) { throw e; }

        await window.migrujStareRole();
        window.currentRole = "user";
        if(isConfiguredHead(window.currentUserEmail)) { window.currentRole = "head_admin"; }
        else {
            const roleDoc = await getDoc(doc(db, "role_uzytkownikow", window.currentUserEmail));
            window.currentRole = roleDoc.exists() ? roleDoc.data().rola : "user";
        }

        const isHeadAdmin = (window.currentRole === 'head_admin' || isConfiguredHead(window.currentUserEmail));
        const isHardAdmin = (isHeadAdmin || window.currentRole === 'admin' || window.currentRole === 'zarzad_sm');
        const isSoftAdmin = (isHardAdmin || window.currentRole === 'moderator' || window.currentRole === 'social_media');

        // EXPORT UPRAWNIEŃ DLA BLOKAD
        window.isSoftAdminGlobal = isSoftAdmin;
        window.isHardAdminGlobal = isHardAdmin;
        clearInterval(window.presenceInterval);
        window.presenceInterval = setInterval(() => {
            window.updatePresence(true);
            window.renderChatList();
            if (window.currentChatEmail) {
                const person = window.wszystkieOsobyMap.get(window.currentChatEmail) || {};
                const status = document.getElementById('chat-header-status');
                const online = document.getElementById('chat-header-online');
                if (status) status.textContent = window.getPresenceLabel(person);
                if (online) online.style.display = window.userIsOnline(person) ? 'block' : 'none';
            }
        }, 60000);
        await window.wczytajKonfiguracjeEmail();

        document.querySelectorAll('.head-admin-only').forEach(el => el.style.display = isHeadAdmin ? 'flex' : 'none');
        document.querySelectorAll('.hard-admin-only').forEach(el => el.style.display = isHardAdmin ? 'flex' : 'none');
        document.querySelectorAll('.soft-admin-only').forEach(el => el.style.display = isSoftAdmin ? 'flex' : 'none');
        document.getElementById('header-avatar').style.display = 'block';

        if(window.unsubKonwersacje) window.unsubKonwersacje();
        window.unsubKonwersacje = onSnapshot(query(collection(db, "konwersacje"), where("uczestnicy", "array-contains", window.currentUserEmail)), s => {
            window.konwersacjeMap.clear(); let hasUnread = false; s.forEach(d => { const x = d.data(); window.konwersacjeMap.set(d.id, x); if(x.unreadBy === window.currentUserEmail) hasUnread = true; });
            document.getElementById('chat-badge').style.display = hasUnread ? 'block' : 'none'; window.renderChatList();
        });

        if (window.unsubUsersPresence) window.unsubUsersPresence();
        window.unsubUsersPresence = onSnapshot(collection(db, 'uzytkownicy'), snapshot => {
            snapshot.forEach(item => {
                const data = item.data() || {};
                const email = String(data.email || item.id || '').toLowerCase().trim();
                if (!email) return;
                const previous = window.wszystkieOsobyMap.get(email) || {};
                window.wszystkieOsobyMap.set(email, {
                    ...previous,
                    email,
                    name: data.imieNazwisko || previous.name || 'Zarejestrowany Użytkownik',
                    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : (previous.avatarUrl || ''),
                    online: typeof data.online === 'boolean' ? data.online : Boolean(previous.online),
                    lastActive: data.lastActive || previous.lastActive || null
                });
            });
            window.renderChatList();
            if (window.currentChatEmail) {
                const person = window.wszystkieOsobyMap.get(window.currentChatEmail) || {};
                const status = document.getElementById('chat-header-status');
                const online = document.getElementById('chat-header-online');
                if (status) status.textContent = window.getPresenceLabel(person);
                if (online) online.style.display = window.userIsOnline(person) ? 'block' : 'none';
            }
        }, error => { if (error?.code !== 'permission-denied') window.reportError(error, 'statusów aktywności'); });

        if(window.unsubPowiadomienia) window.unsubPowiadomienia();
        window.unsubPowiadomienia = onSnapshot(query(collection(db, "powiadomienia"), where("odbiorca", "==", window.currentUserEmail)), s => {
            let notifs = []; s.forEach(d => notifs.push({ ...d.data(), id: d.id }));
            notifs.sort((a, b) => new Date(b.czas) - new Date(a.czas));
            let notifHtml = ''; let unreadCount = 0;
            notifs.forEach(n => {
                if(!n.odczytane) unreadCount++;
                const bg = n.odczytane ? 'var(--bg-card)' : 'var(--bg-body)';
                const border = n.odczytane ? '1px solid var(--border-color)' : '1px solid var(--primary)';
                const dataCzasu = new Date(n.czas);
                notifHtml += `<div style="background:${escapeHtml(bg)}; border:${escapeHtml(border)}; padding:12px; border-radius:12px; margin-bottom:10px;"><h4 style="margin:0 0 5px 0; font-size:14px; color:var(--text-main);">${escapeHtml(n.tytul)}</h4><p style="margin:0 0 5px 0; font-size:13px; color:var(--text-muted);">${escapeHtml(n.tresc)}</p><p style="font-size:11px">Od: ${escapeHtml(n.nadawca || "Wpis archiwalny")}</p><span style="font-size:10px; color:var(--text-muted);">${escapeHtml(dataCzasu.toLocaleString('pl-PL'))}</span></div>`;
            });
            const badge = document.getElementById('main-notif-badge');
            if(badge) { if(unreadCount > 0) { badge.style.display = 'flex'; badge.textContent = unreadCount; } else badge.style.display = 'none'; }
            const listContainer = document.getElementById('notifications-list');
            if(listContainer) listContainer.innerHTML = notifHtml || '<p style="text-align:center;color:var(--text-muted);">Brak nowych powiadomień.</p>';
        });

        await window.pobierzWszystko(true);
        if(needsOnboarding) window.otworzProfil(true);

    } else {
        ++refreshGeneration;
        window.currentUserEmail = null; window.currentRole = "user";
        window.isSoftAdminGlobal = false; window.isHardAdminGlobal = false;
        clearInterval(window.presenceInterval); window.presenceInterval = null;
        if (window.unsubscribeChat) { window.unsubscribeChat(); window.unsubscribeChat = null; }
        clearTimeout(window.typingTimeout);
        window.currentChatEmail = null; window.currentReplyTo = null;
        window.wszystkieOsobyMap.clear(); window.konwersacjeMap.clear();
        document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
        if(window.unsubKonwersacje) { window.unsubKonwersacje(); window.unsubKonwersacje = null; }
        if(window.unsubPowiadomienia) { window.unsubPowiadomienia(); window.unsubPowiadomienia = null; }
        if(window.unsubUsersPresence) { window.unsubUsersPresence(); window.unsubUsersPresence = null; }
        document.getElementById('app-content').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex';
        window.ukryjLoading();
    }
    } catch (e) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        window.reportError(e, 'logowanie lub dostęp do danych');
        await signOut(auth).catch(console.error);
    } finally { window.ukryjLoading(); }
});

window.rozpocznijLogowanie = async () => {
    const btn = document.getElementById('login-btn-main'); if(btn.disabled) return;
    const r = document.getElementById('remember-me').checked; btn.disabled = true; btn.innerHTML = "⏳ Logowanie...";
    // Uruchom popup natychmiast po kliknięciu. Oczekiwanie na setPersistence
    // wcześniej powodowało utratę gestu użytkownika i blokadę popupu.
    const persistencePromise = setPersistence(auth, r ? browserLocalPersistence : browserSessionPersistence);
    try {
        await signInWithPopup(auth, provider);
        await persistencePromise;
    } catch(e) {
        await persistencePromise.catch(() => {});
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment' || e.code === 'auth/web-storage-unsupported') {
            // Przekierowanie działa także wtedy, gdy przeglądarka blokuje popupy.
            try { await signInWithRedirect(auth, provider); return; }
            catch (redirectError) { window.pokazCustomAlert('Nie udało się rozpocząć logowania Google. Otwórz aplikację w zwykłej karcie przeglądarki.', 'error'); }
        } else if(e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
            window.pokazCustomAlert("Błąd logowania: " + e.message, "error");
        }
    } finally { btn.disabled = false; btn.innerHTML = '<i class="fab fa-google" style="font-size:20px;"></i> Zaloguj przez Google'; }
};

window.otworzWydarzenieDlaDaty = (dataStr) => {
    if (!window.isSoftAdminGlobal) {
        window.pokazCustomAlert("Tylko moderatorzy i administratorzy mogą dodawać wydarzenia.", "error");
        return;
    }

    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('ev-start').value = dataStr;
    document.getElementById('ev-title').value = '';
    document.getElementById('ev-desc').value = '';
    document.getElementById('ev-location').value = '';
    window.editWydarzenieId = null;
    document.querySelectorAll('.event-user-cb').forEach(cb => cb.checked = false);
    document.getElementById('modal-event').style.display = 'flex';
};

window.wybierzKolorWydarzenia = (element) => {
    document.querySelectorAll('.color-dot').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    if (navigator.vibrate) navigator.vibrate(20);
};

window.zapiszWydarzeniePro = async () => {
    if (!window.isSoftAdminGlobal) return window.pokazCustomAlert("Brak uprawnień.", "error");

    const btn = document.getElementById('btn-save-event');
    const t = document.getElementById('ev-title')?.value.trim(),
          d = document.getElementById('ev-desc')?.value,
          l = document.getElementById('ev-location')?.value,
          s = document.getElementById('ev-start')?.value || "Brak daty";

    if(!t) return window.pokazCustomAlert("Podaj nazwę wydarzenia!", "error");

    const oldBtnHtml = btn.innerHTML;
    btn.innerHTML = '<div class="modern-spinner" style="width:20px;height:20px;border-width:3px;margin:0;"></div> Zapisuję...';
    btn.style.pointerEvents = 'none';

    const activeColorDot = document.querySelector('.color-dot.active');
    const kolor = activeColorDot ? `var(--${activeColorDot.getAttribute('data-color')})` : 'var(--primary)';
    const c = document.querySelectorAll('.event-user-cb:checked'), os = Array.from(c).map(x => x.value);

    try {
        if(window.editWydarzenieId) {
            await updateDoc(doc(db, "wydarzenia", window.editWydarzenieId), { nazwa: t, opis: d, start: s, lokacja: l, osoby: os, color: kolor });
            window.editWydarzenieId = null;
        } else {
            await addDoc(collection(db, "wydarzenia"), { nazwa: t, opis: d, start: s, lokacja: l, osoby: os, color: kolor, status: "Oczekuje", przypomnienieWyslane: false });
            os.forEach(em => window.wyslijPowiadomienieWAppce(em, "Nowe Wydarzenie", `Zostałeś przydzielony do: ${t}`));
        }

        document.getElementById('modal-event').style.display = 'none';
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        window.pokazCustomAlert("Zapisano pomyślnie!", "success");
        window.pobierzWszystko(false);
    } catch(e) {
        window.pokazCustomAlert("Wystąpił błąd podczas zapisu.", "error");
    } finally {
        btn.innerHTML = oldBtnHtml;
        btn.style.pointerEvents = 'auto';
    }
};


// A fresh form must never retain the ID of a previously edited document.
window.otworzNowyFormularz = type => {
    const forms = {
        event: ['editWydarzenieId','ev-title','ev-desc','ev-location','ev-start'],
        task: ['editZadanieId','task-title','task-desc','task-assigned'],
        gallery: ['editGaleriaId','gal-file','gal-desc'],
        board: ['editZarzadId','bm-name','bm-role','bm-email','bm-contact'],
        ogloszenie: ['editOgloszenieId','edit-ogl-tytul','edit-ogl-tresc']
    };
    const fields = forms[type];
    if (!fields) return;
    window[fields[0]] = null;
    fields.slice(1).forEach(id => document.getElementById(id).value = '');
    if (type === 'event') {
        document.querySelectorAll('.event-user-cb').forEach(el => el.checked = false);
        document.querySelectorAll('.color-dot').forEach(el => el.classList.toggle('active',el.dataset.color === 'primary'));
    }
    document.getElementById('modal-' + type).style.display = 'flex';
};

// These checks improve feedback; Firestore and Storage rules enforce authorization.
const actionLevels = {
    zapiszRole:'hard', zatwierdzUsuniecieKonta:'head', zarzadzajIskrami:'hard',
    zapiszCzlonka:'hard', zapiszGalerie:'hard', usunElement:'hard',
    wyslijOgloszenieGlobalne:'hard', zapiszEdytowaneOgloszenie:'hard', usunOgloszenie:'hard',
    wyslijPrzypomnienie:'hard', zrealizujZapotrzebowanie:'hard', zatwierdzZadanie:'hard',
    zapiszWydarzeniePro:'soft', zapiszZadanie:'soft'
};
for (const [name, level] of Object.entries(actionLevels)) {
    const action = window[name];
    window[name] = (...args) => {
        const allowed = level === 'head' ? (window.currentRole === 'head_admin' || isConfiguredHead(window.currentUserEmail))
            : level === 'hard' ? (window.isHardAdminGlobal || isConfiguredHead(window.currentUserEmail)) : window.isSoftAdminGlobal;
        if (!auth.currentUser || !allowed) return window.reportError(new Error('Brak uprawnień do tej operacji.'));
        return action(...args);
    };
}
const pendingActions = new Set();
for (const name of ['zapiszProfil','zapiszRole','zapiszCzlonka','zapiszGalerie','zapiszPlik','zapiszZadanie',
    'zapiszWydarzeniePro','zapiszKompendium','zapiszZapotrzebowanie','zapiszPomysl','zarzadzajIskrami',
    'wyslijWiadomosc','zapiszEdytowaneOgloszenie','wyslijOgloszenieGlobalne','oznaczWszystkiePowiadomieniaJakoOdczytane','zatwierdzZadanie']) {
    const action = window[name];
    window[name] = async (...args) => {
        if (pendingActions.has(name)) return;
        if (!auth.currentUser || !window.currentUserEmail) return window.reportError(new Error('Zaloguj się ponownie.'));
        if (!navigator.onLine) return window.reportError(new Error('Brak połączenia. Zapisz zmiany po odzyskaniu sieci.'));
        pendingActions.add(name);
        try { return await action(...args); }
        catch (error) { window.reportError(error); }
        finally { pendingActions.delete(name); }
    };
}


async function removeStoredDocument(name, id) {
    const record = doc(db, name, id), snapshot = await getDoc(record);
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    const objectRef = ref(storage, data.storagePath || safeUrl(data.url));
    if (objectRef.bucket !== firebaseConfig.storageBucket || !objectRef.fullPath.startsWith(name + '/')) {
        throw new Error('Nieprawidłowa lokalizacja pliku. Zgłoś ten wpis administratorowi.');
    }
    try { await deleteObject(objectRef); }
    catch (error) { if (error.code !== 'storage/object-not-found') throw error; }
    await deleteDoc(record);
}
