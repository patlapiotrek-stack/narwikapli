// Values from Firestore must never become markup or executable attributes.
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Legacy handlers use single-quoted JS arguments inside double-quoted HTML attributes.
export const jsAttribute = value => escapeHtml(String(value ?? '')
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/\r/g, '\\r').replace(/\n/g, '\\n')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'));

export function safeUrl(value) {
    try {
        const url = new URL(String(value));
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
}

export const safeColor = value => /^var\(--(primary|danger|success|warning)\)$/.test(value) ? value : 'var(--primary)';

export function validateFile(file, imageOnly = false) {
    const images = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const documents = ['application/pdf', 'text/plain', 'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (!file || file.size <= 0 || file.size > (imageOnly ? 5 : 10) * 1024 * 1024) {
        throw new Error(`Plik musi mieć od 1 bajta do ${imageOnly ? 5 : 10} MB.`);
    }
    if (!(imageOnly ? images : [...images, ...documents]).includes(file.type)) {
        throw new Error('Niedozwolony format pliku. Użyj zdjęcia JPG/PNG/WebP/GIF, PDF, TXT, CSV lub dokumentu Office.');
    }
    return file;
}

export function nextMonth(date, offset) {
    return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

export const preferences = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing may disable storage. */ } }
};
