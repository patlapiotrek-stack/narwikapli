import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, getDoc, setDoc, onSnapshot, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

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
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' }); 

// ==========================================
// 2. ZMIENNE GLOBALNE
// ==========================================
window.currentUserEmail = null;
window.currentRole = "user";
window.SUPER_ADMIN = 'patlapiotrek@gmail.com', 'baginskip13@gmail.com';
window.wszystkieOsobyMap = new Map();
window.konwersacjeMap = new Map();

window.editZarzadId = null; window.editGaleriaId = null; window.editWydarzenieId = null; window.editZadanieId = null; window.editOgloszenieId = null;
window.editKompendiumId = null; window.editZapotrzebowanieId = null; window.editPomyslId = null;
window.currentChatEmail = null; window.unsubscribeChat = null; window.unsubKonwersacje = null; window.unsubPowiadomienia = null; window.typingTimeout = null;
window.currentReplyTo = null; window.startX = 0; window.currX = 0;
window.currentCalDate = new Date(); 

window.isSoftAdminGlobal = false;
window.isHardAdminGlobal = false;

// ==========================================
// 3. LOGIKA PWA (ZAINSTALUJ APLIKACJĘ)
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    if (!isStandalone && window.innerWidth < 768 && !localStorage.getItem('pwa_dismissed')) {
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
    localStorage.setItem('pwa_dismissed', '1');
    document.getElementById('pwa-prompt').style.display = 'none';
};

// ==========================================
// 4. BEZPIECZNE FUNKCJE POMOCNICZE
// ==========================================
window.getPersonNameText = (e) => { if(!e) return 'Brak'; if(window.wszystkieOsobyMap.has(e)){ const d=window.wszystkieOsobyMap.get(e); if(d.name&&d.name!=="Zarejestrowany Użytkownik") return d.name; } const n=e.split('@')[0]; return n.charAt(0).toUpperCase()+n.slice(1); };
window.getPersonAvatar = (e) => { if(window.wszystkieOsobyMap.has(e)&&window.wszystkieOsobyMap.get(e).avatarUrl) return window.wszystkieOsobyMap.get(e).avatarUrl; return `https://ui-avatars.com/api/?name=${encodeURIComponent(window.getPersonNameText(e))}&background=0284c7&color=fff&rounded=true`; };
window.getConvId = (a, b) => [a, b].sort().join('_');
window.getStatusTxt = (la) => {
    if(!la) return '<span style="color:var(--text-muted);font-size:11px;">Offline</span>';
    const m = Math.floor((Date.now() - new Date(la)) / 60000);
    if(m < 1) return '<span style="color:var(--text-muted);font-size:11px;">Aktywny/a przed chwilą</span>';
    if(m < 60) return `<span style="color:var(--text-muted);font-size:11px;">Aktywny/a ${m} min temu</span>`;
    const h = Math.floor(m / 60);
    if(h < 24) return `<span style="color:var(--text-muted);font-size:11px;">Aktywny/a ${h} godz. temu</span>`;
    return `<span style="color:var(--text-muted);font-size:11px;">Aktywny/a ${Math.floor(h / 24)} dni temu</span>`;
};

window.zapiszDoDziennika = async (akcja) => {
    try { await addDoc(collection(db, "dziennik"), { akcja: akcja, kto: window.getPersonNameText(window.currentUserEmail), data: new Date().toISOString() }); } catch(e){}
};

// ==========================================
// 5. FUNKCJE UI (ALERTY I MODALE)
// ==========================================
window.pokazCustomAlert = (w, t='info') => {
    const o = document.createElement('div'); o.className = 'custom-alert-overlay';
    let iconHTML = '<i class="fas fa-info-circle custom-alert-icon" style="color:var(--primary);"></i>'; let btnClass = 'custom-alert-btn custom-alert-btn-primary';
    if(t === 'error') { iconHTML = '<i class="fas fa-exclamation-circle custom-alert-icon" style="color:var(--danger);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-danger'; }
    else if(t === 'success') { iconHTML = '<i class="fas fa-check-circle custom-alert-icon" style="color:var(--success);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-success'; }
    o.innerHTML = `<div class="custom-alert-box">${iconHTML}<div class="custom-alert-text">${w}</div><button class="${btnClass}" onclick="const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300);">Zrozumiałem</button></div>`;
    document.body.appendChild(o); requestAnimationFrame(() => { requestAnimationFrame(() => { o.classList.add('show'); }); });
};

window.pokazCustomConfirm = (w, cb, t='danger') => {
    const o = document.createElement('div'); o.className = 'custom-alert-overlay';
    let iconHTML = '<i class="fas fa-question-circle custom-alert-icon" style="color:var(--primary);"></i>'; let btnClass = 'custom-alert-btn custom-alert-btn-primary';
    if(t === 'danger') { iconHTML = '<i class="fas fa-exclamation-triangle custom-alert-icon" style="color:var(--danger);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-danger'; }
    else if(t === 'success') { iconHTML = '<i class="fas fa-check-circle custom-alert-icon" style="color:var(--success);"></i>'; btnClass = 'custom-alert-btn custom-alert-btn-success'; }
    o.innerHTML = `<div class="custom-alert-box">${iconHTML}<div class="custom-alert-text">${w}</div><div class="custom-confirm-row"><button class="custom-alert-btn custom-confirm-btn-cancel" onclick="const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300);">Anuluj</button><button class="${btnClass}" id="cc-ok-btn">Potwierdzam</button></div></div>`;
    document.body.appendChild(o); requestAnimationFrame(() => { requestAnimationFrame(() => { o.classList.add('show'); }); });
    document.getElementById('cc-ok-btn').addEventListener('click', function() { const ov = this.closest('.custom-alert-overlay'); ov.classList.remove('show'); setTimeout(() => ov.remove(), 300); cb(); });
};

window.pokazLoading = () => { const l = document.getElementById('loading-screen'); if(l){ l.style.visibility='visible'; l.style.opacity='1'; } };
window.ukryjLoading = () => { const l = document.getElementById('loading-screen'); if(l){ l.style.opacity='0'; setTimeout(()=>l.style.visibility='hidden', 400); } };

window.zmienMotyw = (themeName) => { document.documentElement.setAttribute('data-theme', themeName); localStorage.setItem('user_theme', themeName); if(window.currentUserEmail) { updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { theme: themeName }).catch(()=>{}); } };
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
        document.getElementById('profile-preview-img').src = md.avatarUrl || window.getPersonAvatar(window.currentUserEmail);
        const sel = document.getElementById('theme-selector'); if(sel) sel.value = localStorage.getItem('user_theme') || 'light';
    }
    m.style.display = 'flex';
};

window.podgladZdjeciaProfilu = (event) => { const f = event.target.files[0]; if(f){ const r = new FileReader(); r.onload = e => document.getElementById('profile-preview-img').src = e.target.result; r.readAsDataURL(f); } };
window.usunZdjecieProfilu = async () => { try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { avatarUrl: "" }); document.getElementById('profile-preview-img').src = window.getPersonAvatar(window.currentUserEmail); window.pokazCustomAlert("Zdjęcie usunięte!", "success"); window.pobierzWszystko(false); } catch(e) {} };

window.zapiszProfil = async () => {
    const f = document.getElementById('profile-file')?.files[0], n = document.getElementById('profile-name')?.value.trim(), p = document.getElementById('profile-phone')?.value.trim(), b = document.getElementById('profile-bio')?.value.trim();
    if(!n) return window.pokazCustomAlert("Imię jest wymagane!", "error");
    window.pokazLoading();
    try {
        const ur = doc(db, "uzytkownicy", window.currentUserEmail); let au = window.wszystkieOsobyMap.get(window.currentUserEmail)?.avatarUrl || "";
        if(f){ const ir = ref(storage, 'avatars/'+window.currentUserEmail+'_'+Date.now()); await uploadBytes(ir, f); au = await getDownloadURL(ir); }
        await updateDoc(ur, { imieNazwisko: n, telefon: p, opis: b, avatarUrl: au });
        document.getElementById('modal-profile').style.display = 'none'; window.pokazCustomAlert("Zaktualizowano profil!", "success"); window.pobierzWszystko(false);
    } catch(e) {} window.ukryjLoading();
};

window.bezpieczneWylogowanie = async () => {
    if(auth.currentUser) {
        window.pokazLoading();
        try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { online: false, lastActive: new Date().toISOString() }); await signOut(auth); window.location.reload(); } catch(e) { window.pokazCustomAlert("Błąd wylogowania", "error"); window.ukryjLoading(); }
    }
};

window.otworzProsbeUsuniecia = () => { document.getElementById('modal-profile').style.display='none'; document.getElementById('delete-reason').value=''; document.getElementById('modal-delete-account').style.display='flex'; };
window.wyslijProsbeUsuniecia = async () => {
    const powod = document.getElementById('delete-reason')?.value.trim(); if(!powod) return window.pokazCustomAlert("Podaj powód opuszczenia zespołu.", "error");
    try { await addDoc(collection(db, "prosby_usuniecie"), { email: window.currentUserEmail, imie: window.getPersonNameText(window.currentUserEmail), powod: powod, data: new Date().toISOString() }); document.getElementById('modal-delete-account').style.display = 'none'; window.pokazCustomAlert("Prośba wysłana do Head Admina.", "success"); window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "🚨 Prośba o usunięcie konta", `${window.getPersonNameText(window.currentUserEmail)} chce usunąć konto.`); } catch(e) {}
};
window.zatwierdzUsuniecieKonta = async (reqId, uEmail) => { window.pokazCustomConfirm(`Na pewno usunąć z bazy ${uEmail}? Zostanie on zablokowany.`, async () => { try { window.zapiszDoDziennika(`Usunięto konto: ${uEmail}`); await deleteDoc(doc(db, "uzytkownicy", uEmail)); await deleteDoc(doc(db, "prosby_usuniecie", reqId)); window.pokazCustomAlert("Konto usunięte z bazy danych.", "success"); window.pobierzWszystko(false); } catch(e) {} }, 'danger'); };

// EMAILE
window.wyslijPowiadomienieWAppce = async (odbiorcaEmail, tytul, tresc) => { try { await addDoc(collection(db, "powiadomienia"), { odbiorca: odbiorcaEmail, tytul: tytul, tresc: tresc, czas: new Date().toISOString(), odczytane: false }); } catch(e) {} };
window.oznaczWszystkiePowiadomieniaJakoOdczytane = async () => { document.getElementById('main-notif-badge').style.display = 'none'; document.getElementById('modal-notifications').style.display = 'none'; const q = query(collection(db, "powiadomienia"), where("odbiorca", "==", window.currentUserEmail), where("odczytane", "==", false)); const snaps = await getDocs(q); snaps.forEach(d => { updateDoc(doc(db, "powiadomienia", d.id), { odczytane: true }).catch(()=>{}); }); };
window.wyslijPowiadomienieEmail = async (odbiorca, temat, wiadomosc) => { const sID = "service_2d1gkzh", tID = "template_fh0mmxn", pKey = "X3aDbS7VNP0Beo7fC"; if(sID === "WPISZ_TU_SERVICE_ID") return; try { await emailjs.send(sID, tID, { to_email: odbiorca, subject: temat, message: wiadomosc }, pKey); } catch(err) { console.error("EmailJS błąd:", err); } };

window.wyslijPrzypomnienie = async (eventId) => {
    try {
        const d = await getDoc(doc(db, "wydarzenia", eventId)); if(!d.exists()) return; const x = d.data();
        if(!x.osoby || x.osoby.length === 0) { window.pokazCustomAlert("Brak przypisanych osób.", "error"); return; }
        window.pokazCustomAlert("Wysyłam przypomnienia e-mail...", "info");
        for(let e of x.osoby) { await window.wyslijPowiadomienieEmail(e, `🔔 PRZYPOMNIENIE: ${x.nazwa}`, `Przypominamy o wydarzeniu: ${x.nazwa}.\nKiedy: ${x.start}\nGdzie: ${x.lokacja || 'Brak'}`); }
        window.zapiszDoDziennika(`Wysłano przypomnienie o wydarzeniu: ${x.nazwa}`);
        window.pokazCustomAlert("Przypomnienia e-mail zostały rozesłane!", "success");
    } catch(err) { window.pokazCustomAlert("Błąd: " + err.message, "error"); }
};

window.wyslijOgloszenieGlobalne = async () => {
    const ty = document.getElementById('ogl-tytul')?.value.trim(), tr = document.getElementById('ogl-tresc')?.value.trim();
    if(!ty || !tr) return window.pokazCustomAlert("Wypełnij tytuł i treść ogłoszenia!", "error");
    window.pokazLoading();
    try {
        await addDoc(collection(db, "ogloszenia_globalne"), { tytul: ty, tresc: tr, autor: window.getPersonNameText(window.currentUserEmail), data: new Date().toISOString() });
        const snaps = await getDocs(collection(db, "uzytkownicy")); let recipients = []; snaps.forEach(d => recipients.push(d.data().email));
        for(let e of recipients) { window.wyslijPowiadomienieWAppce(e, `📢 ${ty}`, tr); }
        window.zapiszDoDziennika(`Nadano ogłoszenie: ${ty}`);
        document.getElementById('ogl-tytul').value = ''; document.getElementById('ogl-tresc').value = ''; window.pokazCustomAlert("Ogłoszenie dodane!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.pokazCustomAlert("Błąd: " + e.message, "error"); } window.ukryjLoading();
};
window.usunOgloszenie = async (id) => { window.pokazCustomConfirm("Usunąć to ogłoszenie z tablicy?", async () => { try { await deleteDoc(doc(db, "ogloszenia_globalne", id)); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };
window.otworzEdycjeOgloszenia = async (id, ty, tr) => { window.editOgloszenieId = id; document.getElementById('edit-ogl-tytul').value = decodeURIComponent(ty); document.getElementById('edit-ogl-tresc').value = decodeURIComponent(tr); document.getElementById('modal-ogloszenie').style.display = 'flex'; };
window.zapiszEdytowaneOgloszenie = async () => { const ty = document.getElementById('edit-ogl-tytul').value.trim(), tr = document.getElementById('edit-ogl-tresc').value.trim(); if(!ty || !tr) return window.pokazCustomAlert("Wypełnij pola!", "error"); document.getElementById('modal-ogloszenie').style.display = 'none'; try { await updateDoc(doc(db, "ogloszenia_globalne", window.editOgloszenieId), { tytul: ty, tresc: tr }); window.editOgloszenieId = null; window.pokazCustomAlert("Ogłoszenie zaktualizowane.", "success"); window.pobierzWszystko(false); } catch(e) {} };

// NAWIGACJA
window.przelaczStrone = (pageId) => { 
    const pages = document.querySelectorAll('.page'); pages.forEach(p => p.style.display = 'none'); document.getElementById(pageId).style.display = 'block'; 
    const navLinks = document.querySelectorAll('.bottom-nav a'); navLinks.forEach(l => l.classList.remove('active')); 
    let matchingNav = document.querySelector(`.bottom-nav a[data-target="${pageId}"]`); 
    if(matchingNav) matchingNav.classList.add('active'); else { const menuNav = document.querySelector(`.bottom-nav a[data-target="page-menu"]`); if(menuNav) menuNav.classList.add('active'); } 
    window.scrollTo(0,0); 
};
document.querySelectorAll('.bottom-nav a').forEach(k => { k.addEventListener('click', e => { e.preventDefault(); window.przelaczStrone(k.getAttribute('data-target')); }); });

window.updatePresence = async (isOnline) => { if(!window.currentUserEmail) return; try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { online: isOnline, lastActive: new Date().toISOString() }); } catch(e){} };
window.addEventListener("beforeunload", () => window.updatePresence(false));
document.addEventListener("visibilitychange", () => { if(auth.currentUser) window.updatePresence(document.visibilityState === 'visible'); });

// ==========================================
// 6. OBSŁUGA CRUD (EDYCJA, ZAPIS, USUWANIE) ORAZ ISKRY
// ==========================================

window.dodajPunkty = async (email, amount, pow = "Aktywność systemowa") => {
    try { 
        const ur = doc(db, "uzytkownicy", email); 
        const ud = await getDoc(ur); 
        if(ud.exists()) { 
            const obecne = ud.data().punkty || 0; 
            await updateDoc(ur, { punkty: obecne + amount }); 
            await addDoc(collection(db, "iskry_historia"), {
                kto: "System",
                komu: email,
                ilosc: amount,
                powod: pow,
                data: new Date().toISOString()
            });
        } 
    } catch(e) {}
};

window.zarzadzajIskrami = async () => {
    const email = document.getElementById('iskry-user-select').value;
    const amtStr = document.getElementById('iskry-amount').value;
    const pow = document.getElementById('iskry-reason').value.trim();
    
    if(!email || !amtStr || !pow) return window.pokazCustomAlert("Wypełnij wszystkie pola (Użytkownik, Ilość, Powód)!", "error");
    const amt = parseInt(amtStr);
    if(isNaN(amt)) return window.pokazCustomAlert("Ilość musi być poprawną liczbą!", "error");
    
    window.pokazLoading();
    try {
        const ur = doc(db, "uzytkownicy", email); 
        const ud = await getDoc(ur); 
        let obecne = 0;
        if(ud.exists()) { obecne = ud.data().punkty || 0; }
        
        await updateDoc(ur, { punkty: obecne + amt });
        
        await addDoc(collection(db, "iskry_historia"), {
            kto: window.currentUserEmail,
            komu: email,
            ilosc: amt,
            powod: pow,
            data: new Date().toISOString()
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
    } catch(e) {} window.ukryjLoading();
};
window.usunKompendium = (id) => { window.pokazCustomConfirm("Usunąć ten wpis z bazy wiedzy?", async () => { try { await deleteDoc(doc(db, "kompendium", id)); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };
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
    } catch(e) {} window.ukryjLoading();
};
window.usunZapotrzebowanie = (id) => { window.pokazCustomConfirm("Usunąć zapotrzebowanie?", async () => { try { await deleteDoc(doc(db, "zapotrzebowania", id)); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };
window.otworzEdycjeZapotrzebowanie = (id, naz, op) => { window.editZapotrzebowanieId = id; document.getElementById('zap-nazwa').value = decodeURIComponent(naz); document.getElementById('zap-opis').value = decodeURIComponent(op); document.getElementById('modal-zapotrzebowanie').style.display = 'flex'; };
window.zrealizujZapotrzebowanie = async (id) => { window.pokazCustomConfirm("Oznaczyć jako zrealizowane?", async () => { try { await updateDoc(doc(db, "zapotrzebowania", id), { status: "Zrealizowano" }); window.pobierzWszystko(false); } catch(e){} }, 'success'); };

window.otworzModalaPomyslu = () => { window.editPomyslId = null; document.getElementById('pom-tytul').value = ''; document.getElementById('pom-opis').value = ''; document.getElementById('modal-pomysl').style.display = 'flex'; };
window.zapiszPomysl = async () => {
    const ty = document.getElementById('pom-tytul').value.trim(), op = document.getElementById('pom-opis').value.trim();
    if(!ty) return window.pokazCustomAlert("Podaj tytuł pomysłu!", "error");
    document.getElementById('modal-pomysl').style.display='none'; window.pokazLoading();
    try {
        if(window.editPomyslId) { await updateDoc(doc(db, "pomysly", window.editPomyslId), { tytul: ty, opis: op }); window.editPomyslId = null; } 
        else { 
            await addDoc(collection(db, "pomysly"), { tytul: ty, opis: op, zglasza: window.currentUserEmail, upvotes: [], downvotes: [], data: new Date().toISOString() }); 
            window.dodajPunkty(window.currentUserEmail, 5, "Zgłoszenie nowego pomysłu"); 
            window.wyslijPowiadomienieEmail(window.SUPER_ADMIN, "Nowy Pomysł", `${window.getPersonNameText(window.currentUserEmail)} dodał pomysł na rozwój aplikacji: ${ty}\nOpis: ${op}`);
            window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "Nowy pomysł", `Zgłoszono: ${ty}`);
        }
        window.pokazCustomAlert("Zapisano pomysł!", "success"); window.pobierzWszystko(false);
    } catch(e) {} window.ukryjLoading();
};
window.usunPomysl = (id) => { window.pokazCustomConfirm("Usunąć ten pomysł?", async () => { try { await deleteDoc(doc(db, "pomysly", id)); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };
window.otworzEdycjePomysla = (id, ty, op) => { window.editPomyslId = id; document.getElementById('pom-tytul').value = decodeURIComponent(ty); document.getElementById('pom-opis').value = decodeURIComponent(op); document.getElementById('modal-pomysl').style.display = 'flex'; };
window.glosujPomysl = async (id, typ) => {
    try {
        const refD = doc(db, "pomysly", id); const sn = await getDoc(refD); if(!sn.exists()) return;
        const dat = sn.data(); let ups = dat.upvotes || [], dws = dat.downvotes || [];
        if(typ === 'up') { if(ups.includes(window.currentUserEmail)) return; await updateDoc(refD, { upvotes: arrayUnion(window.currentUserEmail), downvotes: arrayRemove(window.currentUserEmail) }); window.dodajPunkty(dat.zglasza, 1, "Polubienie pomysłu"); } 
        else { if(dws.includes(window.currentUserEmail)) return; await updateDoc(refD, { downvotes: arrayUnion(window.currentUserEmail), upvotes: arrayRemove(window.currentUserEmail) }); }
        window.pobierzWszystko(false);
    } catch(e) {}
};

window.zapiszPlik = async () => {
    const fi = document.getElementById('plik-file'), files = fi.files, d = document.getElementById('plik-desc')?.value;
    if(files.length === 0) return window.pokazCustomAlert("Wybierz plik!", "error");
    document.getElementById('modal-plik').style.display = 'none'; window.pokazLoading();
    try {
        const f = files[0]; const ir = ref(storage, 'pliki/'+f.name+Date.now()); 
        await uploadBytes(ir, f); const u = await getDownloadURL(ir);
        await addDoc(collection(db, "pliki"), { url: u, nazwa: f.name, desc: d || f.name, wgral: window.currentUserEmail, dodano: new Date().toISOString() });
        document.getElementById('plik-desc').value = ''; fi.value = ''; window.pokazCustomAlert("Wgrano plik!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.pokazCustomAlert("Błąd", "error"); } window.ukryjLoading();
};
window.usunPlik = (id) => { window.pokazCustomConfirm("Usunąć ten plik bezpowrotnie?", async () => { try { await deleteDoc(doc(db, "pliki", id)); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };

window.zapiszZadanie = async () => {
    if (!window.isSoftAdminGlobal) return window.pokazCustomAlert("Brak uprawnień do dodawania zadań.", "error");

    const t = document.getElementById('task-title')?.value, d = document.getElementById('task-desc')?.value, a = document.getElementById('task-assigned')?.value;
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
    } catch(e) {}
};

window.zapiszCzlonka = async () => {
    const n = document.getElementById('bm-name')?.value, r = document.getElementById('bm-role')?.value, e = document.getElementById('bm-email')?.value, c = document.getElementById('bm-contact')?.value || "";
    if(!n||!e) return window.pokazCustomAlert("Imię i Email są wymagane!", "error");
    document.getElementById('modal-board').style.display = 'none';
    try {
        if(window.editZarzadId) { await updateDoc(doc(db, "zarzad", window.editZarzadId), { name: n, role: r, email: e, contact: c }); window.editZarzadId = null; } else await addDoc(collection(db, "zarzad"), { name: n, role: r, email: e, contact: c });
        document.getElementById('bm-name').value = ''; document.getElementById('bm-role').value = ''; document.getElementById('bm-email').value = ''; if(document.getElementById('bm-contact')) document.getElementById('bm-contact').value = '';
        window.pobierzWszystko(false);
    } catch(er) {}
};
window.zapiszGalerie = async () => {
    const fi = document.getElementById('gal-file'), files = fi.files, d = document.getElementById('gal-desc')?.value;
    if(files.length === 0 && !window.editGaleriaId) return window.pokazCustomAlert("Wybierz zdjęcie!", "error");
    document.getElementById('modal-gallery').style.display = 'none'; window.pokazLoading();
    try {
        if(window.editGaleriaId) {
            if(files.length > 0){ const ir = ref(storage, 'galeria/'+files[0].name+Date.now()); await uploadBytes(ir, files[0]); const u = await getDownloadURL(ir); await updateDoc(doc(db, "galeria", window.editGaleriaId), { url: u, desc: d }); }
            else await updateDoc(doc(db, "galeria", window.editGaleriaId), { desc: d });
            window.editGaleriaId = null;
        } else {
            for(let i=0; i<files.length; i++) { const ir = ref(storage, 'galeria/'+files[i].name+Date.now()); await uploadBytes(ir, files[i]); const u = await getDownloadURL(ir); await addDoc(collection(db, "galeria"), { url: u, desc: d || `Zdjęcie ${i+1}`, dodano: new Date().toISOString() }); }
        }
        document.getElementById('gal-desc').value = ''; fi.value = ''; window.pokazCustomAlert("Zapisano!", "success"); window.pobierzWszystko(false);
    } catch(e) {} window.ukryjLoading();
};

window.zapiszRole = async () => {
    const m = document.getElementById('new-user-email')?.value, r = document.getElementById('new-user-role')?.value;
    if(!m) return window.pokazCustomAlert("Wpisz email!", "error");
    const e = m.toLowerCase().trim();
    try {
        await addDoc(collection(db, "role_uzytkownikow"), { email: e, rola: r });
        window.zapiszDoDziennika(`Nadano rolę: ${r} dla ${e}`);
        window.wyslijPowiadomienieWAppce(e, "Zmieniono uprawnienia 🛡️", `Administrator nadał Ci rolę: ${r.toUpperCase()}`);
        window.wyslijPowiadomienieEmail(e, "Nowa rola w aplikacji", `Twoja rola w zespole to teraz: ${r.toUpperCase()}`);
        window.pokazCustomAlert(`Sukces! Nadano rolę.`, "success"); document.getElementById('new-user-email').value = '';
    } catch(er) {}
};

window.usunElement = (k, id) => { window.pokazCustomConfirm("Usunąć bezpowrotnie?", async () => { try { await deleteDoc(doc(db, k, id)); window.pobierzWszystko(false); } catch(e){} }); };
window.otworzEdycjeZarzad = (id, n, r, e, c) => { window.editZarzadId = id; document.getElementById('bm-name').value = decodeURIComponent(n); document.getElementById('bm-role').value = decodeURIComponent(r); document.getElementById('bm-email').value = decodeURIComponent(e); if(document.getElementById('bm-contact')) document.getElementById('bm-contact').value = decodeURIComponent(c); document.getElementById('modal-board').style.display = 'flex'; };
window.otworzEdycjeGaleria = (id, d) => { window.editGaleriaId = id; document.getElementById('gal-desc').value = decodeURIComponent(d); document.getElementById('gal-file').value = ''; document.getElementById('modal-gallery').style.display = 'flex'; };
window.otworzEdycjeWydarzenie = (id, n, s, l, o, oe) => { window.editWydarzenieId = id; document.getElementById('ev-title').value = decodeURIComponent(n); if(document.getElementById('ev-start')) document.getElementById('ev-start').value = decodeURIComponent(s); document.getElementById('ev-location').value = decodeURIComponent(l); if(document.getElementById('ev-desc')) document.getElementById('ev-desc').value = decodeURIComponent(o); const pe = JSON.parse(decodeURIComponent(oe)); document.querySelectorAll('.event-user-cb').forEach(c => { c.checked = pe.includes(c.value); }); document.getElementById('modal-event').style.display = 'flex'; };
window.otworzEdycjeZadanie = (id, n, o, oe) => { window.editZadanieId = id; document.getElementById('task-title').value = decodeURIComponent(n).replace('[ZADANIE] ',''); if(document.getElementById('task-desc')) document.getElementById('task-desc').value = decodeURIComponent(o); const os = JSON.parse(decodeURIComponent(oe)); if(document.getElementById('task-assigned')) document.getElementById('task-assigned').value = os.length > 0 ? os[0] : ''; document.getElementById('modal-task').style.display = 'flex'; };
window.otworzZdjecie = u => { document.getElementById('full-image').src = u; document.getElementById('image-viewer').style.display = 'flex'; };

window.otworzZglosProblem = (id, n) => {
    window.currentProblemZadanieId = id; window.currentProblemZadanieNazwa = n;
    document.getElementById('problem-desc').value = ''; document.getElementById('modal-problem').style.display = 'flex';
};

window.wyslijZgloszenieProblemu = async () => { const p = document.getElementById('problem-desc')?.value.trim(); if(!p){ window.pokazCustomAlert("Podaj powód!", "error"); return; } try { window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, `⚠️ Problem`, `Zgłasza: ${window.getPersonNameText(window.currentUserEmail)}.\nPowód: ${p}`); document.getElementById('modal-problem').style.display = 'none'; window.pokazCustomAlert("Wysłano.", "success"); } catch(e) {} };
window.dodajCheckpoint = async (id, k) => { const i = document.getElementById(`cp-input-${k}-${id}`); if(!i || !i.value.trim()){ window.pokazCustomAlert("Wpisz treść!", "error"); return; } const t = i.value.trim(); try { const r = doc(db, "wydarzenia", id), s = await getDoc(r); if(s.exists()){ const d = s.data(), c = d.checkpoints || []; c.push({ text: t, autor: window.currentUserEmail || "Nieznany", data: new Date().toLocaleString('pl-PL') }); await updateDoc(r, { checkpoints: c }); i.value = ''; window.pobierzWszystko(false); } } catch(e) {} };
window.oznaczJakoPrzeczytane = async id => { try { await updateDoc(doc(db, "wydarzenia", id), { odczytane: true }); window.pobierzWszystko(false); } catch(e){} };
window.zmienStatusZadania = (id, ns, tytul='') => { 
    window.pokazCustomConfirm(ns === 'Wykonane' ? "Zakończyć zadanie? (+10 Iskier)" : (ns === 'W trakcie' ? "Przenieść do 'W trakcie'?" : "Cofnąć/Odrzucić?"), async () => { 
        try { 
            await updateDoc(doc(db, "wydarzenia", id), { status: ns, start: ns }); 
            if(ns === 'Wykonane') { window.dodajPunkty(window.currentUserEmail, 10, "Zakończenie zadania: " + tytul); window.zapiszDoDziennika(`Zakończono zadanie: ${tytul}`); }
            window.pobierzWszystko(false); 
        } catch(e){} 
    }, ns === 'Wykonane' ? 'success' : (ns === 'W trakcie' ? 'info' : 'danger')); 
};

// ==========================================
// 7. CZAT (LOGIKA WYSZUKIWANIA I WIADOMOŚCI)
// ==========================================
window.ts = e => { window.startX = e.touches[0].clientX; };
window.tm = (e, el) => { window.currX = e.touches[0].clientX; let df = window.currX - window.startX; if(df > 0 && df <= 80) el.style.transform = `translateX(${df}px)`; };
window.te = (e, el, txt) => { let df = window.currX - window.startX; el.style.transform = 'translateX(0)'; if(df > 50){ window.currentReplyTo = txt; document.getElementById('reply-text').textContent = txt; document.getElementById('reply-box').style.display = 'block'; } window.currX = 0; window.startX = 0; };
window.anulujOdpowiedz = () => { window.currentReplyTo = null; document.getElementById('reply-box').style.display = 'none'; };
window.otworzChatZ = (e, i, a) => { window.currentChatEmail = e; document.getElementById('chat-header-name').textContent = i; document.getElementById('chat-header-avatar').src = a; const co = window.wszystkieOsobyMap.get(e)?.online; document.getElementById('chat-header-online').style.display = co ? 'block' : 'none'; let r = 'Użytkownik'; if(window.wszystkieOsobyMap.has(e)) r = window.wszystkieOsobyMap.get(e).role || window.wszystkieOsobyMap.get(e).bio || 'Użytkownik'; document.getElementById('chat-header-role').textContent = r.substring(0,40); document.getElementById('modal-chat-view').style.display = 'flex'; document.getElementById('chat-messages-container').innerHTML = '<div style="text-align:center;padding:40px;"><div class="modern-spinner" style="margin:auto;"></div></div>'; const cid = window.getConvId(window.currentUserEmail, e); updateDoc(doc(db, "konwersacje", cid), { unreadBy: null }).catch(()=>{}); window.uruchomNasluchChatu(window.currentUserEmail, e, cid); window.anulujOdpowiedz(); };
window.zamknijChat = () => { document.getElementById('modal-chat-view').style.display = 'none'; if(window.currentChatEmail){ const cid = window.getConvId(window.currentUserEmail, window.currentChatEmail); updateDoc(doc(db, "konwersacje", cid), { ktoPisze: null }).catch(()=>{}); } window.currentChatEmail = null; if(window.unsubscribeChat){ window.unsubscribeChat(); window.unsubscribeChat = null; } };
window.wyslijWiadomosc = async () => { const i = document.getElementById('chat-input-text'), t = i.value.trim(), rep = window.currentReplyTo; if(!t || !window.currentChatEmail) return; i.value = ''; window.anulujOdpowiedz(); const cid = window.getConvId(window.currentUserEmail, window.currentChatEmail); try { const time = new Date().toISOString(); await addDoc(collection(db, "wiadomosci"), { nadawca: window.currentUserEmail, odbiorca: window.currentChatEmail, uczestnicy: [window.currentUserEmail, window.currentChatEmail], tekst: t, czas: time, replyTo: rep }); await setDoc(doc(db, "konwersacje", cid), { uczestnicy: [window.currentUserEmail, window.currentChatEmail], lastMsg: t, timestamp: time, unreadBy: window.currentChatEmail, ktoPisze: null }, { merge: true }); window.wyslijPowiadomienieWAppce(window.currentChatEmail, "Nowa wiadomość", `Masz wiadomość od: ${window.getPersonNameText(window.currentUserEmail)}`); } catch(e) {} };
window.uruchomNasluchChatu = (me, er, cid) => { if(window.unsubscribeChat) window.unsubscribeChat(); const wr = collection(db, "wiadomosci"), q = query(wr, where("uczestnicy", "array-contains", me)); window.unsubscribeChat = onSnapshot(q, s => { let msgs = []; s.forEach(d => msgs.push(d.data())); msgs.sort((a,b) => new Date(a.czas) - new Date(b.czas)); let cH = ''; msgs.forEach(m => { if(m.uczestnicy.includes(er)){ const c = m.nadawca === me, a = c ? window.getPersonAvatar(me) : window.getPersonAvatar(er); let ct = ''; if(m.czas){ const d = new Date(m.czas); ct = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; } let rh = m.replyTo ? `<div style="background:rgba(0,0,0,0.1);border-left:3px solid var(--primary);padding:4px 8px;margin-bottom:5px;border-radius:4px;font-size:12px;opacity:0.8;">${m.replyTo}</div>` : ''; if(c){ cH += `<div class="chat-row sent msg-animated" ontouchstart="window.ts(event)" ontouchmove="window.tm(event, this)" ontouchend="window.te(event, this, '${m.tekst.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')"><div style="display:flex;flex-direction:column;align-items:flex-end;max-width:100%;"><div class="chat-bubble chat-sent">${rh}${m.tekst}</div><span style="font-size:10px;color:var(--text-muted);margin-top:2px;">${ct}</span></div></div>`; } else { cH += `<div class="chat-row received msg-animated" ontouchstart="window.ts(event)" ontouchmove="window.tm(event, this)" ontouchend="window.te(event, this, '${m.tekst.replace(/'/g,"\\'").replace(/"/g,"&quot;")}')"><img src="${a}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-right:8px;margin-bottom:4px;flex-shrink:0;"><div style="display:flex;flex-direction:column;align-items:flex-start;max-width:100%;"><div class="chat-bubble chat-received">${rh}${m.tekst}</div><span style="font-size:10px;color:var(--text-muted);margin-top:2px;">${ct}</span></div></div>`; } } }); const cont = document.getElementById('chat-messages-container'); const wb = cont.scrollHeight - cont.scrollTop <= cont.clientHeight + 50; cont.innerHTML = cH || '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">Przesuń dymek by odpowiedzieć!</div>'; if(cH !== '' && wb) setTimeout(() => cont.scrollTop = cont.scrollHeight, 50); const kd = window.konwersacjeMap.get(cid); document.getElementById('chat-typing-indicator').style.display = (kd && kd.ktoPisze === er) ? 'flex' : 'none'; }); };
window.szukajNaCzacie = (v) => { const query = v.toLowerCase(); document.querySelectorAll('.user-chat-item').forEach(el => { const n = el.querySelector('h4').textContent.toLowerCase(); el.style.display = n.includes(query) ? 'flex' : 'none'; }); };

window.renderChatList = () => {
    let cl = [];
    window.wszystkieOsobyMap.forEach(o => {
        if(o.email === window.currentUserEmail) return;
        const ci = window.getPersonNameText(o.email), av = window.getPersonAvatar(o.email), cid = window.getConvId(window.currentUserEmail, o.email), cd = window.konwersacjeMap.get(cid);
        const ur = cd && cd.unreadBy === window.currentUserEmail, lm = cd && cd.lastMsg ? cd.lastMsg : 'Rozpocznij czat', ts = cd && cd.timestamp ? new Date(cd.timestamp).getTime() : 0;
        cl.push({ e: o.email, ci, av, ur, lm, ts, on: o.online, la: o.lastActive });
    });
    cl.sort((a, b) => b.ts - a.ts);
    let h = '';
    cl.forEach(x => {
        const fw = x.ur ? '800' : '500', c = x.ur ? 'var(--text-main)' : 'var(--text-muted)';
        const od = x.on ? `<div class="online-dot"></div>` : '';
        const st = x.on ? '<span style="color:var(--success);font-size:11px;font-weight:bold;">Aktywny/a teraz</span>' : window.getStatusTxt(x.la);
        const ui = x.ur ? `<div style="width:12px;height:12px;background:var(--danger);border-radius:50%;margin-left:auto;"></div>` : '';
        h += `<div class="user-chat-item" onclick="window.otworzChatZ('${x.e}','${x.ci.replace(/'/g,"\\'")}','${x.av}')"><div style="position:relative"><img src="${x.av}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">${od}</div><div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;justify-content:space-between;"><h4 style="margin:0 0 2px 0;font-size:16px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${fw};">${x.ci}</h4>${ui}</div><p style="margin:0 0 2px 0;font-size:13px;color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${fw};">${x.lm}</p>${st}</div></div>`;
    });
    const clc = document.getElementById('chat-users-list'); if(clc) clc.innerHTML = h || '<p style="text-align:center;color:var(--text-muted);">Brak osób w systemie.</p>';
};

// ==========================================
// 8. GENERATOR KALENDARZA (SIATKA)
// ==========================================
window.zmienMiesiacKalendarza = (przesuniecie) => {
    window.currentCalDate.setMonth(window.currentCalDate.getMonth() + przesuniecie);
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
            if(!w.nazwa.startsWith('[ZADANIE]') && w.start === aktualnaDataString) {
                const color = w.color || 'var(--primary)';
                wydHtml += `<div class="cal-event" style="background:${color}" title="${w.nazwa}">${w.nazwa}</div>`;
            }
        });

        grid.innerHTML += `
            <div class="cal-cell ${klasaDzisiaj}" onclick="window.otworzWydarzenieDlaDaty('${aktualnaDataString}')">
                <div class="cal-cell-date">${dzien}</div>
                ${wydHtml}
            </div>
        `;
    }
};

// ==========================================
// 9. GŁÓWNY SILNIK (POBIERANIE DANYCH)
// ==========================================
window.pobierzWszystko = async function(cl = false) {
    let pH = ''; 
    let zH = ''; let bzH = ''; let gH = ''; let kH = ''; let zH2 = ''; let aW = ''; 
    let lW = 0, lZ = 0, wD = 0;

    const isHeadAdmin = window.currentRole === 'head_admin';
    const isHardAdmin = isHeadAdmin || window.currentRole === 'admin' || window.currentRole === 'zarzad_sm';
    let ub = 0;
    
    try {
        window.wszystkieOsobyMap.clear();
        const [uS, zS, gS, eS, pS, zapS, oglS, prS, komS, plikS, dzS, iskS] = await Promise.all([
            getDocs(query(collection(db, "uzytkownicy"), orderBy("ostatnieLogowanie", "desc"))).catch(()=>({docs:[]})),
            getDocs(collection(db, "zarzad")).catch(()=>({docs:[]})),
            getDocs(query(collection(db, "galeria"), orderBy("dodano", "desc"))).catch(()=>({docs:[]})),
            getDocs(collection(db, "wydarzenia")).catch(()=>({docs:[]})),
            getDocs(collection(db, "pomysly")).catch(()=>({docs:[]})),
            getDocs(collection(db, "zapotrzebowania")).catch(()=>({docs:[]})),
            getDocs(collection(db, "ogloszenia_globalne")).catch(()=>({docs:[]})),
            isHeadAdmin ? getDocs(collection(db, "prosby_usuniecie")).catch(()=>({docs:[]})) : Promise.resolve({docs:[]}),
            getDocs(collection(db, "kompendium")).catch(()=>({docs:[]})),
            getDocs(collection(db, "pliki")).catch(()=>({docs:[]})),
            isHeadAdmin ? getDocs(query(collection(db, "dziennik"), orderBy("data", "desc"))).catch(()=>({docs:[]})) : Promise.resolve({docs:[]}),
            isHardAdmin ? getDocs(collection(db, "iskry_historia")).catch(()=>({docs:[]})) : Promise.resolve({docs:[]})
        ]);
        
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
            rankH += `<div class="card" style="padding:15px;display:flex;align-items:center;gap:15px;"><div style="font-size:24px;font-weight:800;color:var(--text-muted);width:30px;text-align:center;">${m}</div><img src="${x.av}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"><div style="flex:1;"><h4 style="margin:0;font-size:15px;">${x.name}</h4></div><div style="font-size:18px;font-weight:800;color:var(--warning);">${x.punkty} ⚡</div></div>`;
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
                iskH += `<div style="padding:8px 0; border-bottom:1px solid var(--border-color);"><b style="color:var(--primary);">${window.getPersonNameText(x.kto)}</b> ➔ <b style="color:var(--text-main);">${window.getPersonNameText(x.komu)}</b> <span style="color:${amtColor};font-weight:bold;margin-left:5px;">${amtSign}${x.ilosc} ⚡</span><br><span style="font-size:11px;color:var(--text-muted);">Powód: ${x.powod}</span><br><span style="color:var(--text-muted);font-size:10px;">${dataI}</span></div>`;
            });
            const iskList = document.getElementById('iskry-historia-lista'); if(iskList) iskList.innerHTML = iskH || '<p style="text-align:center;color:var(--text-muted);">Brak historii operacji.</p>';
        }

        if(zS.forEach) {
            zS.forEach(d => {
                const x = d.data(), id = d.id, ip = window.wszystkieOsobyMap.get(x.email) || {};
                window.wszystkieOsobyMap.set(x.email, { email: x.email, name: ip.name && ip.name !== "Zarejestrowany Użytkownik" ? ip.name : x.name, role: x.role, avatarUrl: ip.avatarUrl || "", bio: ip.bio || "", phone: x.contact || ip.phone || "", online: ip.online || false, lastActive: ip.lastActive || null });
                const o = window.wszystkieOsobyMap.get(x.email);
                const encName = encodeURIComponent(o.name || ''); const encRole = encodeURIComponent(o.role || ''); const encEmail = encodeURIComponent(o.email || ''); const encContact = encodeURIComponent(o.phone || '');
                const ab = isHardAdmin ? `<div style="display:flex;gap:15px;margin-top:15px;font-size:20px;border-top:1px solid var(--border-color);padding-top:12px;"><span onclick="window.otworzEdycjeZarzad('${id}','${encName}', '${encRole}', '${encEmail}', '${encContact}')" style="cursor:pointer;color:var(--primary);">✏️</span><span onclick="window.usunElement('zarzad','${id}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>` : '';
                const stZ = isHardAdmin ? `<p style="margin:4px 0;font-size:12px;">${o.online ? '<span style="color:var(--success);font-weight:bold;">🟢 Aktywny/a teraz</span>' : '🕒 ' + window.getStatusTxt(o.lastActive)}</p>` : '';
                const ep = isHardAdmin ? `<p style="margin:4px 0;color:var(--text-muted);font-size:13px;word-break:break-all;">📧 ${o.email}</p>${stZ}` : '';
                const pp = o.phone ? `<p style="margin:6px 0;color:var(--text-muted);font-size:14px;">📞 ${o.phone}</p>` : '';
                const od = o.online ? `<div class="online-dot"></div>` : '';
                const ih = `<div style="position:relative"><img src="${window.getPersonAvatar(o.email)}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);margin-bottom:10px;">${od}</div>`;
                zH += `<div class="board-card" style="padding:18px;display:flex;flex-direction:column;align-items:center;text-align:center;">${ih}<div style="width:100%;"><h3 style="margin:0 0 6px 0;font-size:18px;color:var(--text-main);">${o.name}</h3><p style="margin:0 0 12px 0;font-weight:700;color:var(--primary);">${o.role}</p>${o.bio ? `<p style="font-size:13px;color:var(--text-muted);font-style:italic;">"${o.bio}"</p>` : ''}${ep}${pp}${ab}</div></div>`;
            });
        }
        const zc = document.getElementById('zarzad-lista'); if(zc) zc.innerHTML = zH;
        
        window.wszystkieOsobyMap.forEach(o => {
            const encName = window.getPersonNameText(o.email).replace(/'/g,"\\'");
            const btnMsg = o.email !== window.currentUserEmail ? `<button onclick="window.otworzChatZ('${o.email}', '${encName}','${window.getPersonAvatar(o.email)}')" style="background:var(--primary);color:#fff;padding:8px 15px;border-radius:20px;font-size:12px;font-weight:bold;min-height:auto;"><i class="fas fa-comment"></i> Napisz</button>` : `<span style="font-size:12px;color:var(--text-muted);">To Ty</span>`;
            const roleTxt = o.role ? `<span style="color:var(--primary);font-size:11px;font-weight:bold;display:block;">${o.role}</span>` : '';
            bzH += `<div class="user-chat-item" style="cursor:default;"><img src="${window.getPersonAvatar(o.email)}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;"> <div style="flex:1;"><h4 style="margin:0;font-size:15px;color:var(--text-main);">${window.getPersonNameText(o.email)}</h4>${roleTxt}<p style="margin:2px 0 0 0;font-size:11px;color:var(--text-muted);">${o.email}</p></div> ${btnMsg} </div>`;
        });
        const zl = document.getElementById('zespol-lista'); if(zl) zl.innerHTML = bzH;

        let so = '<option value="">-- Wybierz osobę z listy --</option>', ch = '';
        window.wszystkieOsobyMap.forEach(o => {
            const ci = window.getPersonNameText(o.email), dn = o.role ? `${ci} (${o.role})` : ci;
            let st = dn; if(isHardAdmin) st += ` | ${o.email}`;
            so += `<option value="${o.email}">${st}</option>`;
            const de = isHardAdmin ? `<span style="font-size:11px;color:var(--text-muted);display:block;white-space:normal;word-break:break-all;">${o.email}</span>` : '';
            ch += `<label class="custom-checkbox-card" style="display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;"><input type="checkbox" class="event-user-cb" value="${o.email}" style="width:20px!important;height:20px!important;margin:0;"><div style="display:flex;flex-direction:column;min-width:0;"><b style="color:var(--text-main);font-size:14px;">${dn}</b>${de}</div></label>`;
        });
        
        const iuSelect = document.getElementById('iskry-user-select');
        if(iuSelect) iuSelect.innerHTML = so;

        const ta = document.getElementById('task-assigned'); if(ta) ta.innerHTML = so;
        const eu = document.getElementById('event-users-list'); if(eu) eu.innerHTML = ch;
        
        window.renderChatList();
        
        let galeriaArr = [];
        if(gS.forEach) { gS.forEach(d => { galeriaArr.push({id: d.id, ...d.data()}); }); }
        galeriaArr.sort((a,b) => new Date(b.dodano) - new Date(a.dodano));
        galeriaArr.forEach(x => {
            const sd = x.desc ? encodeURIComponent(x.desc) : '';
            const ab = isHardAdmin ? `<div style="display:flex;gap:20px;margin-top:12px;font-size:22px;justify-content:center;border-top:1px solid var(--border-color);padding-top:12px;"><span onclick="window.otworzEdycjeGaleria('${x.id}','${sd}')" style="cursor:pointer;color:var(--primary);">✏️</span><span onclick="window.usunElement('galeria','${x.id}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>` : '';
            gH += `<div class="card" style="padding:12px;margin-bottom:0;"><img src="${x.url}" style="width:100%;border-radius:10px;cursor:zoom-in;object-fit:cover;height:140px;" onclick="window.otworzZdjecie('${x.url}')"><p style="font-size:14px;margin:12px 0 4px 0;text-align:center;font-weight:600;color:var(--text-main);">${x.desc}</p>${ab}</div>`;
        });
        const galL = document.getElementById('galeria-lista'); if(galL) galL.innerHTML = gH;
        
        aW = `<h4 style="margin-top:30px;margin-bottom:12px;color:var(--text-main);font-size:16px;font-weight:700;"><i class="fas fa-calendar-check" style="color:var(--primary);"></i> Nadchodzące spotkania</h4>`;
        const dz = new Date(); dz.setHours(0,0,0,0);
        
        let wydArr = [];
        if(eS.forEach) { eS.forEach(d => { wydArr.push({id: d.id, ...d.data()}); }); }
        
        window.rysujSiatkeKalendarza(wydArr);

        let kTodo='', kProg='', kDone='', cT=0, cP=0, cD=0;
        wydArr.sort((a,b) => { if(a.start === "Oczekuje" || a.start==="W trakcie" || a.start==="Wykonane") return -1; if(b.start === "Oczekuje") return 1; return new Date(a.start) - new Date(b.start); });

        wydArr.forEach(x => {
            const id = x.id, it = x.nazwa.startsWith('[ZADANIE]');
            const eNazwa = encodeURIComponent(x.nazwa || ''); const eStart = encodeURIComponent(x.start || ''); const eLokacja = encodeURIComponent(x.lokacja || ''); const eOpis = encodeURIComponent(x.opis || ''); const soArr = encodeURIComponent(JSON.stringify(x.osoby || []));
            const sn = x.nazwa.replace(/'/g,"\\'").replace(/"/g,"&quot;");
            const dO = x.opis ? `<div style="margin:10px 0;font-size:14px;color:var(--text-muted);background:var(--bg-body);padding:12px;border-radius:8px;border-left:3px solid var(--primary);word-break:break-word;">${x.opis}</div>` : '';
            const iaMe = window.currentUserEmail && x.osoby && x.osoby.includes(window.currentUserEmail);
            
            if(it){ if(iaMe) lZ++; } else {
                lW++;
                if(x.start !== "Brak daty" && x.start !== "Do zrobienia" && x.start !== "Oczekuje" && x.start !== "W trakcie" && x.start !== "Wykonane"){
                    const dw = new Date(x.start);
                    if(!isNaN(dw.getTime()) && dw >= dz && wD < 3){
                        const evColor = x.color || 'var(--primary)';
                        aW += `<div class="board-card" style="padding:14px;margin-bottom:10px;font-size:14px;border-left:4px solid ${evColor};display:flex;align-items:center;gap:10px;"><div style="background:var(--border-color);color:var(--primary);padding:8px 12px;border-radius:8px;font-weight:bold;font-size:13px;">${x.start}</div><div style="font-weight:600;color:var(--text-main);">${x.nazwa}</div></div>`; wD++;
                    }
                }
            }
            
            let ab = '';
            if(isHardAdmin){
                ab += `<div style="display:flex;gap:20px;margin-top:15px;font-size:20px;padding-top:12px;border-top:1px solid var(--border-color);">`;
                if(it) ab += `<span onclick="window.otworzEdycjeZadanie('${id}','${eNazwa}','${eOpis}','${soArr}')" style="cursor:pointer;color:var(--primary);">✏️</span>`;
                else ab += `<span onclick="window.otworzEdycjeWydarzenie('${id}','${eNazwa}','${eStart}','${eLokacja}','${eOpis}','${soArr}')" style="cursor:pointer;color:var(--primary);">✏️</span>`;
                ab += `<span onclick="window.usunElement('wydarzenia','${id}')" style="cursor:pointer;color:var(--danger);">🗑️</span></div>`;
            }

            let btnReminder = ''; if(!it && isHardAdmin) { btnReminder = `<button onclick="window.wyslijPrzypomnienie('${id}')" style="background:var(--warning); color:#fff; border:none; padding:8px 12px; border-radius:8px; font-weight:bold; font-size:12px; cursor:pointer; margin-top:10px; width:100%;"><i class="fas fa-bell"></i> Wyślij przypomnienie e-mail</button>`; }
            
            if(it){
                const cn = x.nazwa.replace('[ZADANIE]','').trim(), pr = x.osoby && x.osoby.length > 0 ? x.osoby[0] : null, pw = pr ? window.getPersonNameText(pr) : 'Brak', sz = x.status || "Oczekuje";
                let ks = "var(--danger)"; if(sz === "Wykonane") ks = "var(--success)"; else if(sz === "W trakcie") ks = "var(--warning)";
                
                let ai = ''; if(isHardAdmin) ai = `<div style="margin:10px 0;font-size:13px;color:var(--text-muted);background:var(--bg-body);padding:8px;border-radius:6px;display:flex;align-items:center;">Dla: <b style="color:var(--text-main); margin-left:4px; margin-right:4px;">${pw}</b> <span style="font-size:11px;">(${pr})</span></div>`;
                
                const cp = x.checkpoints || []; let cl = '';
                if(cp.length > 0){
                    cl = `<div style="margin:15px 0;padding:12px;background:var(--bg-body);border-radius:8px;border:1px solid var(--border-color);"><h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Postępy:</h4><ul style="margin:0;padding-left:15px;font-size:14px;color:var(--text-main);display:flex;flex-direction:column;gap:8px;">`;
                    cp.forEach(c => { cl += `<li style="word-break:break-word;"><b>${window.getPersonNameText(c.autor)}</b> <span style="color:var(--text-muted);font-size:12px;">(${c.data})</span><br>${c.text}</li>`; }); cl += `</ul></div>`;
                }
                
                let cpZ = '';
                if(isHardAdmin || iaMe){ cpZ = `<div style="margin-top:15px;display:flex;gap:8px;width:100%;"><input type="text" id="cp-input-zadania-${id}" placeholder="Dodaj krok..." style="flex:1;padding:10px !important;margin:0;"><button onclick="window.dodajCheckpoint('${id}','zadania')" style="background:var(--primary);color:#fff;border:none;padding:0 20px;font-weight:bold;margin:0;min-height:auto;">Dodaj</button></div>`; }
                let pb = ''; if(iaMe) pb = `<button onclick="window.otworzZglosProblem('${id}','${sn}')" style="margin-top:15px;width:100%;background:var(--bg-body);color:var(--danger);border:1px dashed var(--danger);padding:8px;font-weight:bold;font-size:12px;box-shadow:none;min-height:auto;"><i class="fas fa-exclamation-triangle"></i> Zgłoś problem</button>`;
                
                let akcjeKanban = '';
                if(iaMe || isHardAdmin) {
                    if(sz === "Oczekuje") akcjeKanban = `<button onclick="window.zmienStatusZadania('${id}','W trakcie','${sn}')" style="width:100%;background:var(--warning);padding:8px;font-size:12px;min-height:auto;"><i class="fas fa-play"></i> Zacznij robić</button>`;
                    else if(sz === "W trakcie") akcjeKanban = `<div style="display:flex;gap:5px;"><button onclick="window.zmienStatusZadania('${id}','Oczekuje','${sn}')" style="flex:1;background:var(--border-color);color:var(--text-main);padding:8px;font-size:12px;box-shadow:none;min-height:auto;">Cofnij</button><button onclick="window.zmienStatusZadania('${id}','Wykonane','${sn}')" style="flex:2;background:var(--success);padding:8px;font-size:12px;min-height:auto;"><i class="fas fa-check"></i> Wykonano</button></div>`;
                }

                let kCard = `<div class="card" style="padding:15px;margin-bottom:0;border-left:4px solid ${ks};"><h3 style="margin:0 0 8px 0;color:var(--text-main);font-size:16px;">${cn}</h3>${dO}${ai}${cl}${cpZ}${pb}<div style="margin-top:15px;">${akcjeKanban}</div>${ab}</div>`;
                
                if(sz === "Oczekuje") { kTodo += kCard; cT++; }
                else if(sz === "W trakcie") { kProg += kCard; cP++; }
                else { kDone += kCard; cD++; }

            } else {
                let lp = ''; if(x.osoby && x.osoby.length > 0){ let im = x.osoby.map(e => window.getPersonNameText(e)).join(', '); lp = `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);background:var(--bg-body);padding:8px;border-radius:6px;border:1px dashed var(--border-color);">Dla: <b style="color:var(--text-main);">${im}</b></div>`; }
                const evColor2 = x.color || 'var(--primary)';
                kH += `<div class="task-card" style="padding:20px; border-left: 4px solid ${evColor2}"><h3 style="margin:0 0 8px 0;color:var(--text-main);font-size:18px;">${x.nazwa}</h3>${dO}<div style="display:flex;align-items:center;gap:8px;margin-top:10px;color:var(--text-muted);font-size:14px;background:var(--bg-body);padding:10px;border-radius:8px;"><i class="fas fa-calendar-day" style="color:var(--primary);"></i> <b style="color:var(--text-main);">${x.start}</b> | <i class="fas fa-map-marker-alt" style="color:var(--danger);"></i> ${x.lokacja}</div>${lp}${btnReminder}${ab}</div>`;
            }
        });
        
        const kl = document.getElementById('kalendarz-lista'); if(kl) kl.innerHTML = kH || '<p style="text-align:center;color:var(--text-muted);">Brak wydarzeń</p>';
        
        const kbT = document.getElementById('kb-list-todo'); if(kbT) kbT.innerHTML = kTodo || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Brak zadań</div>';
        const kbP = document.getElementById('kb-list-prog'); if(kbP) kbP.innerHTML = kProg || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Pusto</div>';
        const kbD = document.getElementById('kb-list-done'); if(kbD) kbD.innerHTML = kDone || '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:10px;">Brak gotowych</div>';
        if(document.getElementById('kb-count-todo')) document.getElementById('kb-count-todo').textContent = cT;
        if(document.getElementById('kb-count-prog')) document.getElementById('kb-count-prog').textContent = cP;
        if(document.getElementById('kb-count-done')) document.getElementById('kb-count-done').textContent = cD;

        let plikH = ''; let plikArr = [];
        if(plikS && plikS.forEach) { plikS.forEach(d => { plikArr.push({id: d.id, ...d.data()}); }); }
        plikArr.sort((a,b) => new Date(b.dodano) - new Date(a.dodano));
        plikArr.forEach(x => {
            const canEdit = (x.wgral === window.currentUserEmail || isHardAdmin);
            const ab = canEdit ? `<button onclick="window.usunPlik('${x.id}')" style="background:transparent;color:var(--danger);border:none;padding:5px;box-shadow:none;min-height:auto;"><i class="fas fa-trash"></i></button>` : '';
            plikH += `<div class="card" style="padding:15px;display:flex;align-items:center;gap:15px;"><i class="fas fa-file-alt" style="font-size:30px;color:var(--primary);"></i><div style="flex:1;min-width:0;"><h4 style="margin:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${x.desc}</h4><span style="font-size:11px;color:var(--text-muted);">Dodał: ${window.getPersonNameText(x.wgral)}</span></div><a href="${x.url}" target="_blank" style="background:var(--bg-body);color:var(--primary);padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:12px;"><i class="fas fa-download"></i></a>${ab}</div>`;
        });
        const plL = document.getElementById('pliki-lista'); if(plL) plL.innerHTML = plikH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Dysk jest pusty.</p>';

        let komH = ''; let komArr = [];
        if(komS && komS.forEach) { komS.forEach(d => { komArr.push({id: d.id, ...d.data()}); }); }
        komArr.sort((a,b) => new Date(a.data) - new Date(b.data));
        komArr.forEach(x => {
            const canEdit = (x.autor === window.currentUserEmail || isHardAdmin);
            const eTy = encodeURIComponent(x.tytul || ''); const eTr = encodeURIComponent(x.tresc || '');
            let ab = canEdit ? `<div style="display:flex;gap:15px;margin-top:10px;border-top:1px solid var(--border-color);padding-top:10px;"><button onclick="window.otworzEdycjeKompendium('${x.id}', '${eTy}','${eTr}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunKompendium('${x.id}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            komH += `<details class="card"><summary><i class="fas fa-bookmark" style="color:var(--primary);margin-right:8px;"></i> ${x.tytul}</summary><div style="padding:15px; border-top:1px solid var(--border-color); font-size:14px; color:var(--text-muted); white-space: pre-wrap;">${x.tresc}${ab}</div></details>`;
        });
        const wL = document.getElementById('wiedza-lista'); if(wL) wL.innerHTML = komH; 

        let pmH = ''; let pomArr = [];
        if(pS && pS.forEach) { pS.forEach(d => { pomArr.push({id: d.id, ...d.data()}); }); }
        pomArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        pomArr.forEach(x => {
            const ups = x.upvotes || [], dws = x.downvotes || [];
            const upActive = ups.includes(window.currentUserEmail) ? 'var(--primary)' : 'var(--text-muted)';
            const dwActive = dws.includes(window.currentUserEmail) ? 'var(--danger)' : 'var(--text-muted)';
            const canEdit = (x.zglasza === window.currentUserEmail || isHardAdmin);
            const eTy = encodeURIComponent(x.tytul || ''); const eOp = encodeURIComponent(x.opis || '');
            let editBtns = canEdit ? `<div style="display:flex;gap:10px;margin-top:10px;"><button onclick="window.otworzEdycjePomysla('${x.id}', '${eTy}','${eOp}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunPomysl('${x.id}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            pmH += `<div class="card" style="padding:15px;"><h4 style="margin:0 0 5px 0;">${x.tytul}</h4><p style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);">${x.opis}</p><div style="font-size:11px;color:var(--text-muted);margin-bottom:15px;">Zgłosił(a): ${window.getPersonNameText(x.zglasza)}</div><div style="display:flex;gap:15px;"><button onclick="window.glosujPomysl('${x.id}','up')" style="background:transparent;color:${upActive};border:1px solid ${upActive};padding:6px 15px;box-shadow:none;min-height:auto;"><i class="fas fa-thumbs-up"></i> ${ups.length}</button><button onclick="window.glosujPomysl('${x.id}','down')" style="background:transparent;color:${dwActive};border:1px solid ${dwActive};padding:6px 15px;box-shadow:none;min-height:auto;"><i class="fas fa-thumbs-down"></i> ${dws.length}</button></div>${editBtns}</div>`;
        });
        const pml = document.getElementById('pomysly-lista'); if(pml) pml.innerHTML = pmH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Brak pomysłów. Bądź pierwszy!</p>';

        let zapH = ''; let zapArr = [];
        if(zapS && zapS.forEach) { zapS.forEach(d => { zapArr.push({id: d.id, ...d.data()}); }); }
        zapArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        zapArr.forEach(x => {
            let stCol = x.status === 'Oczekuje' ? 'var(--warning)' : 'var(--success)';
            let btnAdmin = (x.status === 'Oczekuje' && isHardAdmin) ? `<button onclick="window.zrealizujZapotrzebowanie('${x.id}')" style="width:100%;margin-top:10px;padding:8px;background:var(--success);font-weight:bold;min-height:auto;"><i class="fas fa-check"></i> Oznacz jako Zrealizowane</button>` : '';
            const canEdit = (x.zglasza === window.currentUserEmail || isHardAdmin);
            const eNaz = encodeURIComponent(x.nazwa || ''); const eOp = encodeURIComponent(x.opis || '');
            let editBtns = canEdit ? `<div style="display:flex;gap:10px;margin-top:10px;"><button onclick="window.otworzEdycjeZapotrzebowanie('${x.id}', '${eNaz}','${eOp}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunZapotrzebowanie('${x.id}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:11px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            zapH += `<div class="card" style="padding:15px; border-left: 4px solid ${stCol}"><h4 style="margin:0 0 5px 0;">${x.nazwa}</h4><p style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);">${x.opis}</p><div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;"><span>Od: ${window.getPersonNameText(x.zglasza)}</span><span style="color:${stCol};font-weight:bold;">${x.status}</span></div>${btnAdmin}${editBtns}</div>`;
        });
        const zl1 = document.getElementById('zapotrzebowania-lista'); if(zl1) zl1.innerHTML = zapH || '<p style="text-align:center;color:var(--text-muted);font-size:13px;">Wszystko mamy! Brak zapotrzebowań.</p>';

        let oglH = ''; let oglArr = [];
        if(oglS && oglS.forEach) { oglS.forEach(d => { oglArr.push({id: d.id, ...d.data()}); }); }
        oglArr.sort((a,b) => new Date(b.data) - new Date(a.data));
        oglArr.forEach(x => {
            const dataO = new Date(x.data).toLocaleDateString('pl-PL');
            const eTy = encodeURIComponent(x.tytul || ''); const eTr = encodeURIComponent(x.tresc || '');
            const ab = isHardAdmin ? `<div style="display:flex; gap:10px; margin-top:10px; border-top:1px solid var(--border-color); padding-top:10px;"><button onclick="window.otworzEdycjeOgloszenia('${x.id}', '${eTy}','${eTr}')" style="flex:1;background:var(--bg-body);color:var(--primary);border:1px solid var(--primary);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Edytuj</button><button onclick="window.usunOgloszenie('${x.id}')" style="flex:1;background:var(--bg-body);color:var(--danger);border:1px solid var(--danger);font-size:12px;padding:6px;box-shadow:none;min-height:auto;">Usuń</button></div>` : '';
            oglH += `<div class="board-card" style="padding:15px; background:linear-gradient(to right, var(--bg-body), var(--bg-card)); border:1px solid var(--primary);"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><i class="fas fa-bullhorn" style="color:var(--primary);font-size:20px;"></i><h3 style="margin:0;color:var(--primary);font-size:16px;">${x.tytul}</h3></div><p style="margin:0 0 10px 0;font-size:14px;color:var(--text-main);">${x.tresc}</p><div style="font-size:11px;color:var(--text-muted);">Nadawca: <b>${x.autor}</b> • ${dataO}</div>${ab}</div>`;
        });
        const oglL = document.getElementById('globalne-ogloszenia'); if(oglL) oglL.innerHTML = oglH;

        if(isHeadAdmin) {
            let prH = '';
            if(prS && prS.forEach) {
                prS.forEach(d => {
                    const x = d.data();
                    prH += `<div class="card" style="padding:12px; border:1px solid var(--danger);"><h4 style="margin:0 0 5px 0;color:var(--danger);">${x.imie} (${x.email})</h4><p style="margin:0 0 10px 0;font-size:13px;"><b>Powód:</b> ${x.powod}</p><button onclick="window.zatwierdzUsuniecieKonta('${d.id}', '${x.email}')" style="width:100%;background:var(--danger);padding:8px;font-weight:bold;min-height:auto;"><i class="fas fa-trash"></i> Usuń definitywnie to konto</button></div>`;
                });
            }
            const pUl = document.getElementById('prosby-usuniecie-lista'); if(pUl) pUl.innerHTML = prH || '<p style="color:var(--text-muted);font-size:13px;">Brak próśb o usunięcie.</p>';
            
            let dzH = ''; let dzArr = [];
            if(dzS && dzS.forEach) { dzS.forEach(d => { dzArr.push({id: d.id, ...d.data()}); }); }
            dzArr.sort((a,b) => new Date(b.data) - new Date(a.data));
            dzArr.forEach(x => {
                const dataDz = new Date(x.data).toLocaleString('pl-PL');
                dzH += `<div style="padding:6px 0; border-bottom:1px solid var(--border-color);"><b style="color:var(--primary);">${x.kto}</b> <span style="color:var(--text-main);">${x.akcja}</span> <br><span style="color:var(--text-muted);font-size:10px;">${dataDz}</span></div>`;
            });
            const dzList = document.getElementById('dziennik-lista'); if(dzList) dzList.innerHTML = dzH || '<p style="text-align:center;color:var(--text-muted);">Brak zdarzeń.</p>';
        }

        const pc = document.getElementById('pulpit-lista');
        if(pc){
            if(cT===0 && cP===0 && window.currentUserEmail) pH = `<div class="board-card" style="padding:20px;text-align:center;border:2px solid var(--success);background:transparent;"><i class="fas fa-check-circle" style="font-size:30px;color:var(--success);margin-bottom:10px;"></i><h3 style="color:var(--success);margin:0;">Wszystko na bieżąco!</h3><p style="color:var(--text-muted);font-size:14px;">Brak oczekujących zadań.</p></div>`;
            if(wD === 0) aW += `<p style="font-size:14px;color:var(--text-muted);padding:10px;">Brak zaplanowanych wydarzeń na najbliższe dni.</p>`;
            pc.innerHTML = pH + aW;
        }
        
        const sE = document.getElementById('stat-events'); if(sE) sE.textContent = lW;
        const sT = document.getElementById('stat-tasks'); if(sT) sT.textContent = lZ;
        const sU = document.getElementById('stat-users'); if(sU) sU.textContent = ub;
        
    } catch(e) { console.error("Blad pobierania bazy danych: ", e); } finally { if(cl) window.ukryjLoading(); }
};

// ==========================================
// 10. INICJALIZACJA LOGOWANIA FIREBASE
// ==========================================
onAuthStateChanged(auth, async u => {
    window.pokazLoading();
    if(u){
        window.currentUserEmail = u.email.toLowerCase().trim();
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
                await updateDoc(ur, { ostatnieLogowanie: new Date(), online: true });
            }
        } catch(e) { console.error(e); }

        window.currentRole = "user";
        if(window.currentUserEmail === window.SUPER_ADMIN) { window.currentRole = "head_admin"; } 
        else {
            const q = query(collection(db, "role_uzytkownikow"), where("email", "==", window.currentUserEmail));
            const qs = await getDocs(q); qs.forEach(d => window.currentRole = d.data().rola); 
        }

        const isHeadAdmin = (window.currentRole === 'head_admin');
        const isHardAdmin = (isHeadAdmin || window.currentRole === 'admin' || window.currentRole === 'zarzad_sm');
        const isSoftAdmin = (isHardAdmin || window.currentRole === 'moderator' || window.currentRole === 'social_media');

        // EXPORT UPRAWNIEŃ DLA BLOKAD
        window.isSoftAdminGlobal = isSoftAdmin;
        window.isHardAdminGlobal = isHardAdmin;

        document.querySelectorAll('.head-admin-only').forEach(el => el.style.display = isHeadAdmin ? 'flex' : 'none');
        document.querySelectorAll('.hard-admin-only').forEach(el => el.style.display = isHardAdmin ? 'flex' : 'none');
        document.querySelectorAll('.soft-admin-only').forEach(el => el.style.display = isSoftAdmin ? 'flex' : 'none');
        document.getElementById('header-avatar').style.display = 'block';

        if(window.unsubKonwersacje) window.unsubKonwersacje();
        window.unsubKonwersacje = onSnapshot(query(collection(db, "konwersacje"), where("uczestnicy", "array-contains", window.currentUserEmail)), s => {
            let hasUnread = false; s.forEach(d => { const x = d.data(); window.konwersacjeMap.set(d.id, x); if(x.unreadBy === window.currentUserEmail) hasUnread = true; });
            document.getElementById('chat-badge').style.display = hasUnread ? 'block' : 'none'; window.renderChatList();
        });

        if(window.unsubPowiadomienia) window.unsubPowiadomienia();
        window.unsubPowiadomienia = onSnapshot(query(collection(db, "powiadomienia"), where("odbiorca", "==", window.currentUserEmail)), s => {
            let notifs = []; s.forEach(d => notifs.push({ id: d.id, ...d.data() }));
            notifs.sort((a, b) => new Date(b.czas) - new Date(a.czas));
            let notifHtml = ''; let unreadCount = 0;
            notifs.forEach(n => {
                if(!n.odczytane) unreadCount++;
                const bg = n.odczytane ? 'var(--bg-card)' : 'var(--bg-body)';
                const border = n.odczytane ? '1px solid var(--border-color)' : '1px solid var(--primary)';
                const dataCzasu = new Date(n.czas);
                notifHtml += `<div style="background:${bg}; border:${border}; padding:12px; border-radius:12px; margin-bottom:10px;"><h4 style="margin:0 0 5px 0; font-size:14px; color:var(--text-main);">${n.tytul}</h4><p style="margin:0 0 5px 0; font-size:13px; color:var(--text-muted);">${n.tresc}</p><span style="font-size:10px; color:var(--text-muted);">${dataCzasu.toLocaleString('pl-PL')}</span></div>`;
            });
            const badge = document.getElementById('main-notif-badge');
            if(badge) { if(unreadCount > 0) { badge.style.display = 'flex'; badge.textContent = unreadCount; } else badge.style.display = 'none'; }
            const listContainer = document.getElementById('notifications-list');
            if(listContainer) listContainer.innerHTML = notifHtml || '<p style="text-align:center;color:var(--text-muted);">Brak nowych powiadomień.</p>';
        });

        await window.pobierzWszystko(true);
        if(needsOnboarding) window.otworzProfil(true);

    } else {
        window.currentUserEmail = null; window.currentRole = "user";
        if(window.unsubKonwersacje) { window.unsubKonwersacje(); window.unsubKonwersacje = null; }
        if(window.unsubPowiadomienia) { window.unsubPowiadomienia(); window.unsubPowiadomienia = null; }
        document.getElementById('app-content').style.display = 'none'; document.getElementById('login-screen').style.display = 'flex';
        window.ukryjLoading();
    }
});

window.rozpocznijLogowanie = async () => {
    const btn = document.getElementById('login-btn-main'); if(btn.textContent.includes("Logowanie")) return; 
    const r = document.getElementById('remember-me').checked; btn.innerHTML = "⏳ Logowanie...";
    try { await setPersistence(auth, r ? browserLocalPersistence : browserSessionPersistence); await signInWithPopup(auth, provider); } 
    catch(e) { if(e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') window.pokazCustomAlert("Błąd logowania: " + e.message, "error"); btn.innerHTML = '<i class="fab fa-google" style="font-size:20px;"></i> Zaloguj przez Google'; }
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
    const t = document.getElementById('ev-title')?.value, 
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
