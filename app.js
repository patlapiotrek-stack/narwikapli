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
window.SUPER_ADMIN = 'patlapiotrek@gmail.com';
window.wszystkieOsobyMap = new Map();
window.konwersacjeMap = new Map();

window.editZarzadId = null; window.editGaleriaId = null; window.editWydarzenieId = null; window.editZadanieId = null; window.editOgloszenieId = null;
window.editKompendiumId = null; window.editZapotrzebowanieId = null; window.editPomyslId = null;
window.currentChatEmail = null; window.unsubscribeChat = null; window.unsubKonwersacje = null; window.unsubPowiadomienia = null; window.typingTimeout = null;
window.currentReplyTo = null; window.startX = 0; window.currX = 0;
window.currentCalDate = new Date(); 

window.isSoftAdminGlobal = false;
window.isHardAdminGlobal = false;
window.isHeadAdminGlobal = false;

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
// 4. BEZPIECZNE FUNKCJE POMOCNICZE I DZIENNIK
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
    try { 
        await addDoc(collection(db, "dziennik"), { 
            akcja: akcja, 
            kto: window.getPersonNameText(window.currentUserEmail), 
            email: window.currentUserEmail,
            data: new Date().toISOString() 
        }); 
    } catch(e){}
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
window.usunZdjecieProfilu = async () => { try { await updateDoc(doc(db, "uzytkownicy", window.currentUserEmail), { avatarUrl: "" }); document.getElementById('profile-preview-img').src = window.getPersonAvatar(window.currentUserEmail); window.pokazCustomAlert("Zdjęcie usunięte!", "success"); window.zapiszDoDziennika("Usunięto własne zdjęcie profilowe"); window.pobierzWszystko(false); } catch(e) {} };

window.zapiszProfil = async () => {
    const f = document.getElementById('profile-file')?.files[0], n = document.getElementById('profile-name')?.value.trim(), p = document.getElementById('profile-phone')?.value.trim(), b = document.getElementById('profile-bio')?.value.trim();
    if(!n) return window.pokazCustomAlert("Imię jest wymagane!", "error");
    window.pokazLoading();
    try {
        const ur = doc(db, "uzytkownicy", window.currentUserEmail); let au = window.wszystkieOsobyMap.get(window.currentUserEmail)?.avatarUrl || "";
        if(f){ const ir = ref(storage, 'avatars/'+window.currentUserEmail+'_'+Date.now()); await uploadBytes(ir, f); au = await getDownloadURL(ir); }
        await updateDoc(ur, { imieNazwisko: n, telefon: p, opis: b, avatarUrl: au });
        window.zapiszDoDziennika("Zaktualizowano swój profil ustawień");
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
    try { await addDoc(collection(db, "prosby_usuniecie"), { email: window.currentUserEmail, imie: window.getPersonNameText(window.currentUserEmail), powod: powod, data: new Date().toISOString() }); document.getElementById('modal-delete-account').style.display = 'none'; window.pokazCustomAlert("Prośba wysłana do Head Admina.", "success"); window.zapiszDoDziennika("Wysłano prośbę o usunięcie konta z bazy"); window.wyslijPowiadomienieWAppce(window.SUPER_ADMIN, "🚨 Prośba o usunięcie konta", `${window.getPersonNameText(window.currentUserEmail)} chce usunąć konto.`); } catch(e) {}
};
window.zatwierdzUsuniecieKonta = async (reqId, uEmail) => { window.pokazCustomConfirm(`Na pewno usunąć z bazy ${uEmail}? Zostanie on zablokowany.`, async () => { try { window.zapiszDoDziennika(`Usunięto definitywnie konto użytkownika: ${uEmail}`); await deleteDoc(doc(db, "uzytkownicy", uEmail)); await deleteDoc(doc(db, "prosby_usuniecie", reqId)); window.pokazCustomAlert("Konto usunięte z bazy danych.", "success"); window.pobierzWszystko(false); } catch(e) {} }, 'danger'); };

// EMAILE & POWIADOMIENIA
window.wyslijPowiadomienieWAppce = async (odbiorcaEmail, tytul, tresc) => { try { await addDoc(collection(db, "powiadomienia"), { odbiorca: odbiorcaEmail, tytul: tytul, tresc: tresc, czas: new Date().toISOString(), odczytane: false }); } catch(e) {} };
window.oznaczWszystkiePowiadomieniaJakoOdczytane = async () => { document.getElementById('main-notif-badge').style.display = 'none'; document.getElementById('modal-notifications').style.display = 'none'; const q = query(collection(db, "powiadomienia"), where("odbiorca", "==", window.currentUserEmail), where("odczytane", "==", false)); const snaps = await getDocs(q); snaps.forEach(d => { updateDoc(doc(db, "powiadomienia", d.id), { odczytane: true }).catch(()=>{}); }); };
window.wyslijPowiadomienieEmail = async (odbiorca, temat, wiadomosc) => { const sID = "service_2d1gkzh", tID = "template_fh0mmxn", pKey = "X3aDbS7VNP0Beo7fC"; if(sID === "WPISZ_TU_SERVICE_ID") return; try { await emailjs.send(sID, tID, { to_email: odbiorca, subject: temat, message: wiadomosc }, pKey); } catch(err) { console.error("EmailJS błąd:", err); } };

window.wyslijPrzypomnienie = async (eventId) => {
    try {
        const d = await getDoc(doc(db, "wydarzenia", eventId)); if(!d.exists()) return; const x = d.data();
        if(!x.osoby || x.osoby.length === 0) { window.pokazCustomAlert("Brak przypisanych osób.", "error"); return; }
        window.pokazCustomAlert("Wysyłam przypomnienia e-mail...", "info");
        for(let e of x.osoby) { await window.wyslijPowiadomienieEmail(e, `🔔 PRZYPOMNIENIE: ${x.nazwa}`, `Przypominamy o wydarzeniu: ${x.nazwa}.\nKiedy: ${x.start}\nGdzie: ${x.lokacja || 'Brak'}`); }
        window.zapiszDoDziennika(`Wysłano przypomnienie e-mail o wydarzeniu: ${x.nazwa}`);
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
        window.zapiszDoDziennika(`Nadano nowe ogłoszenie globalne: ${ty}`);
        document.getElementById('ogl-tytul').value = ''; document.getElementById('ogl-tresc').value = ''; window.pokazCustomAlert("Ogłoszenie dodane!", "success"); window.pobierzWszystko(false);
    } catch(e) { window.pokazCustomAlert("Błąd: " + e.message, "error"); } window.ukryjLoading();
};
window.usunOgloszenie = async (id) => { window.pokazCustomConfirm("Usunąć to ogłoszenie z tablicy?", async () => { try { await deleteDoc(doc(db, "ogloszenia_globalne", id)); window.zapiszDoDziennika(`Usunięto ogłoszenie globalne`); window.pobierzWszystko(false); } catch(e){} }, 'danger'); };
window.otworzEdycjeOgloszenia = async (id, ty, tr) => { window.editOgloszenieId = id; document.getElementById('edit-ogl-tytul').value = decodeURIComponent(ty); document.getElementById('edit-ogl-tresc').value = decodeURIComponent(tr); document.getElementById('modal-ogloszenie').style.display = 'flex'; };
window.zapiszEdytowaneOgloszenie = async () => { const ty = document.getElementById('edit-ogl-tytul').value.trim(), tr = document.getElementById('edit-ogl-tresc').value.trim(); if(!ty || !tr) return window.pokazCustomAlert("Wypełnij pola!", "error"); document.getElementById('modal-ogloszenie').style.display = 'none'; try { await updateDoc(doc(db, "ogloszenia_globalne", window.editOgloszenieId), { tytul: ty, tresc: tr }); window.zapiszDoDziennika(`Zaktualizowano ogłoszenie globalne: ${ty}`); window.editOgloszenieId = null; window.pokazCustomAlert("Ogłoszenie zaktualizowane.", "success"); window.pobierzWszystko(false); } catch(e) {} };

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
            window.zapiszDoDziennika(`Automatycznie przyznano Iskry (${amount}) dla ${email}. Powód: ${pow}`);
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
        
        window.zapiszDoDziennika(`Ręczna operacja na Iskrach: ${amt > 0 ? '+' : ''}${amt} dla ${email} (${pow})`);
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
        window.zapiszDoDziennika(`Dodano/Zaktualizowano wpis w kompendium: ${ty}`);
        window.pobierzWszystko(false); window.pokazCustomAlert("Zapisano wpis w kompendium.", "success");
    } catch(e) {} window.ukryjLoading();
};
window.usunKompendium =
