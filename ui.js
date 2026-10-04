// This script also runs when the Firebase module cannot load.
(() => {
    const banner = document.createElement('div');
    banner.id = 'connection-status';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    document.body.appendChild(banner);
    const updateConnection = () => {
        banner.hidden = navigator.onLine;
        banner.textContent = 'Brak połączenia. Sprawdź sieć przed zapisaniem zmian.';
    };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
    window.reportError = (error, context = '') => {
        console.error(context ? `${context}:` : 'Operacja nie powiodła się:', error);
        const message = error?.code === 'permission-denied'
            ? `Brak uprawnień${context ? ` (${context})` : ''}. Jeśli dostęp został zmieniony, wyloguj się i zaloguj ponownie.`
            : error?.code === 'unavailable' ? 'Serwer jest niedostępny. Spróbuj ponownie po odzyskaniu połączenia.'
            : error?.message || 'Operacja nie powiodła się. Spróbuj ponownie.';
        if (window.pokazCustomAlert && !document.querySelector('.custom-alert-overlay')) {
            window.pokazCustomAlert(message, 'error');
        } else {
            banner.hidden = false;
            banner.textContent = message;
        }
    };
    window.addEventListener('unhandledrejection', event => window.reportError(event.reason));
    document.querySelectorAll('input[type="text"], input[type="email"]').forEach(el => el.maxLength = 300);
    document.querySelectorAll('textarea').forEach(el => el.maxLength = 10000);
    document.getElementById('chat-input-text').maxLength = 4000;
    document.querySelectorAll('.modal-content').forEach(el => {
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        const heading = el.querySelector('h3');
        if (heading) el.setAttribute('aria-label', heading.textContent.trim());
    });
    setTimeout(() => {
        if (!window.rozpocznijLogowanie) {
            const loading = document.getElementById('loading-screen');
            if (loading) { loading.style.visibility = 'hidden'; loading.style.opacity = '0'; }
            window.reportError(new Error('Nie udało się uruchomić aplikacji. Sprawdź połączenie i odśwież stronę.'));
        }
    }, 15000);
})();
