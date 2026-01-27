// =================================================================================
// GESTOR DE TAREAS -- VERSIÓN FINAL REFACTORIZADA
// =================================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
const categories = {
    "en-preparacion": [],
    "preparadas": [],
    "en-proceso": [],
    "pendientes": [],
    "archivadas": []
};

const DEFAULT_CATEGORY_NAMES = {
    "en-preparacion": "En preparación",
    "preparadas": "Preparadas",
    "en-proceso": "En proceso",
    "pendientes": "Pendientes",
    "archivadas": "Archivadas"
};

const CATEGORY_KEYS = ["en-preparacion", "preparadas", "en-proceso", "pendientes", "archivadas"];

// category names dependen del idioma (ver i18n.i18nCategoryNames)

// Claves de almacenamiento local específicas de EduKanban
const LS = {
  categories: 'edukanban.categories',
  deleted: 'edukanban.deletedTasks',
  token: 'edukanban.dropbox_access_token',
  lastSync: 'edukanban.lastSync',
  nextcloudConfig: 'edukanban.nextcloudConfig',
  nextcloudLastSync: 'edukanban.nextcloudLastSync',
  selectedFilterTag: 'edukanban.selectedFilterTag',
  searchQuery: 'edukanban.searchQuery',
  visibleColumn: 'edukanban.visibleColumn', // compat: antes guardaba un string; ahora guarda JSON array
  notificationsEnabled: 'edukanban.notificationsEnabled',
  pendingDropboxAction: 'edukanban.pendingDropboxAction',
  lastReauthAt: 'edukanban.lastReauthAt',
  mediaLoop: 'edukanban.mediaLoop',
  mediaLoopAB: 'edukanban.mediaLoopAB',
  mediaPitchPref: 'edukanban.mediaPitchPref',
  categoryNames: 'edukanban.categoryNameOverrides'
};

const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');
const DROPBOX_APP_KEY = 'dvvtedkibz396hq';
const DROPBOX_FILE_PATH = '/edukanban.json';
const DROPBOX_ATTACH_DIR = '/edukanban_attachments';
const NEXTCLOUD_FILE_NAME = 'edukanban.json';
const NEXTCLOUD_ATTACH_DIR = 'edukanban_attachments';
const NEXTCLOUD_DEFAULT_FOLDER = '/Apps/EduKanban';
let accessToken = localStorage.getItem(LS.token);
let localLastSync = localStorage.getItem(LS.lastSync);
let nextcloudConfig = loadNextcloudConfig();
let nextcloudLastSync = localStorage.getItem(LS.nextcloudLastSync);
let syncInterval = null;
// Flujo de redirect dinámico; constante obsoleta tras rebranding
const DROPBOX_REDIRECT_URI = 'about:blank';

function encodeUtf8ToBase64(str) {
    try {
        const bytes = new TextEncoder().encode(str || '');
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        return btoa(binary);
    } catch (_) {
        try { return btoa(unescape(encodeURIComponent(str || ''))); } catch (__){ return ''; }
    }
}
function decodeBase64ToUtf8(b64) {
    if (!b64) return '';
    try {
        const binary = atob(b64);
        const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch (_) {
        try { return decodeURIComponent(escape(atob(b64))); } catch (__){ return ''; }
    }
}

function loadNextcloudConfig() {
    try {
        const raw = localStorage.getItem(LS.nextcloudConfig);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const baseUrl = (parsed.baseUrl || '').trim().replace(/\/+$/, '');
        const username = (parsed.username || '').trim();
        const folder = (parsed.folder || '').trim();
        const password = decodeBase64ToUtf8(parsed.password || '');
        return {
            baseUrl,
            username,
            password,
            folder,
            savedAt: parsed.savedAt || null,
            resolvedBaseUrl: parsed.resolvedBaseUrl || null
        };
    } catch (_) {
        return null;
    }
}

function persistNextcloudConfig(config) {
    if (!config) return;
    const baseUrl = (config.baseUrl || '').trim().replace(/\/+$/, '');
    const username = (config.username || '').trim();
    const folder = (config.folder || '').trim();
    const password = config.password || '';
    const payload = {
        baseUrl,
        username,
        folder,
        resolvedBaseUrl: config.resolvedBaseUrl || null,
        password: encodeUtf8ToBase64(password),
        savedAt: new Date().toISOString()
    };
    try { localStorage.setItem(LS.nextcloudConfig, JSON.stringify(payload)); } catch (_) {}
    nextcloudConfig = { baseUrl, username, folder, password, resolvedBaseUrl: config.resolvedBaseUrl || null, savedAt: payload.savedAt };
}

function clearNextcloudConfig() {
    try { localStorage.removeItem(LS.nextcloudConfig); } catch (_) {}
    try { localStorage.removeItem(LS.nextcloudLastSync); } catch (_) {}
    nextcloudConfig = null;
    nextcloudLastSync = null;
}

function isNextcloudConfigured() {
    return !!(nextcloudConfig && nextcloudConfig.baseUrl && nextcloudConfig.username && (nextcloudConfig.password || '').length);
}

function getNextcloudRootSegments(conf) {
    const folder = (conf && conf.folder) ? conf.folder : NEXTCLOUD_DEFAULT_FOLDER;
    return folder
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);
}

function nextcloudPathToSegments(path) {
    if (!path) return [];
    return String(path)
        .split('/')
        .map(part => part.trim())
        .filter(Boolean);
}

function buildNextcloudRelativePath(...parts) {
    const segments = [];
    parts.forEach(part => {
        if (!part) return;
        const list = Array.isArray(part) ? part : String(part).split('/');
        list.forEach(item => {
            const trimmed = String(item || '').trim();
            if (trimmed) segments.push(trimmed);
        });
    });
    return '/' + segments.join('/');
}

function buildNextcloudUrl(conf, ...segments) {
    const base = getResolvedNextcloudBase(conf);
    if (!base) return '';
    const extra = [];
    segments.forEach(seg => {
        if (!seg) return;
        const parts = Array.isArray(seg) ? seg : String(seg).split('/');
        parts.forEach(part => {
            const trimmed = String(part || '').trim();
            if (trimmed) extra.push(encodeURIComponent(trimmed.replace(/\/+$/, '').replace(/^\/+/, '')));
        });
    });
    const suffix = extra.length ? '/' + extra.join('/') : '';
    return `${base}${suffix}`;
}

function makeNextcloudAuthHeader(conf) {
    if (!conf) return '';
    const token = encodeUtf8ToBase64(`${conf.username}:${conf.password || ''}`);
    return `Basic ${token}`;
}

function formatDateTimeForLocale(isoString) {
    if (!isoString) return '';
    try {
        const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : (navigator.language || 'es-ES');
        const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
        return formatter.format(new Date(isoString));
    } catch (_) {
        try { return new Date(isoString).toLocaleString(); } catch (__){ return isoString; }
    }
}

function setNextcloudStatus(message, tone = 'info') {
    const statusEl = document.getElementById('nextcloud-status');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.remove('status-success', 'status-error', 'status-warning');
    if (tone === 'success') statusEl.classList.add('status-success');
    else if (tone === 'error') statusEl.classList.add('status-error');
    else if (tone === 'warning') statusEl.classList.add('status-warning');
}

function getResolvedNextcloudBase(conf) {
    if (!conf) return '';
    const explicit = conf.resolvedBaseUrl && conf.resolvedBaseUrl.trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const base = (conf.baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return '';
    if (/remote\.php\/dav/i.test(base)) return base;
    if (conf.username) {
        const userSegment = encodeURIComponent(conf.username);
        return `${base}/remote.php/dav/files/${userSegment}`;
    }
    return base;
}

function updateNextcloudFormFromConfig(options = {}) {
    const conf = nextcloudConfig;
    const keepPassword = !!options.keepPasswordField;
    const urlInput = document.getElementById('nextcloud-url');
    if (urlInput) urlInput.value = conf ? conf.baseUrl || '' : '';
    const userInput = document.getElementById('nextcloud-username');
    if (userInput) userInput.value = conf ? conf.username || '' : '';
    const folderInput = document.getElementById('nextcloud-folder');
    if (folderInput) folderInput.value = conf ? (conf.folder || '') : NEXTCLOUD_DEFAULT_FOLDER;
    const passwordInput = document.getElementById('nextcloud-password');
    if (passwordInput && !keepPassword) passwordInput.value = '';
    const syncBtn = document.getElementById('nextcloud-sync');
    if (syncBtn) syncBtn.style.display = isNextcloudConfigured() ? 'inline-flex' : 'none';
    const disconnectBtn = document.getElementById('nextcloud-disconnect');
    if (disconnectBtn) disconnectBtn.style.display = isNextcloudConfigured() ? 'inline-flex' : 'none';
    const saveBtn = document.getElementById('nextcloud-save');
    if (saveBtn) saveBtn.disabled = false;

    if (!isNextcloudConfigured()) {
        const idleMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_idle') : 'Introduce la URL, usuario y token de Nextcloud para sincronizar.';
        setNextcloudStatus(idleMsg, 'info');
    } else if (nextcloudLastSync) {
        const last = formatDateTimeForLocale(nextcloudLastSync);
        const prefix = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_synced_prefix') : 'Última sincronización: ';
        setNextcloudStatus(`${prefix}${last}`, 'success');
    } else {
        const savedMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_ready') : 'Ajustes guardados. Ejecuta sincronización para empezar.';
        setNextcloudStatus(savedMsg, 'info');
    }
}

// Preferencias locales de bucle por adjunto (no se sincronizan)
let __mediaLoopPrefs = {};
try { __mediaLoopPrefs = JSON.parse(localStorage.getItem(LS.mediaLoop) || '{}') || {}; } catch (_) { __mediaLoopPrefs = {}; }
function getMediaLoopPref(attId) {
    try { return !!__mediaLoopPrefs[attId]; } catch (_) { return false; }
}
function setMediaLoopPref(attId, value) {
    try {
        __mediaLoopPrefs[attId] = !!value;
        localStorage.setItem(LS.mediaLoop, JSON.stringify(__mediaLoopPrefs));
    } catch (_) {}
}

// Preferencias locales de bucle A–B por adjunto
let __mediaABPrefs = {};
try { __mediaABPrefs = JSON.parse(localStorage.getItem(LS.mediaLoopAB) || '{}') || {}; } catch (_) { __mediaABPrefs = {}; }
function getMediaABPref(attId) {
    try {
        const v = __mediaABPrefs[attId] || {};
        const a = Number.isFinite(v.a) ? Number(v.a) : null;
        const b = Number.isFinite(v.b) ? Number(v.b) : null;
        const enabled = !!v.enabled;
        return { a, b, enabled };
    } catch (_) { return { a: null, b: null, enabled: false }; }
}
function setMediaABPref(attId, patch) {
    try {
        const cur = getMediaABPref(attId);
        const next = {
            a: (patch && ('a' in patch)) ? (Number.isFinite(patch.a) ? Number(patch.a) : null) : cur.a,
            b: (patch && ('b' in patch)) ? (Number.isFinite(patch.b) ? Number(patch.b) : null) : cur.b,
            enabled: (patch && ('enabled' in patch)) ? !!patch.enabled : cur.enabled
        };
        __mediaABPrefs[attId] = next;
        localStorage.setItem(LS.mediaLoopAB, JSON.stringify(__mediaABPrefs));
        return next;
    } catch (_) { return getMediaABPref(attId); }
}

// --- FUNCIONES DE UTILIDAD ---
function generateUUID() { return crypto.randomUUID(); }
// Adjuntos seleccionados para nuevas tareas (reutilización en modo "Añadir")
let pendingReusedAttachments = [];

// Controla si audio y video mantienen el tono al cambiar la velocidad.
const MEDIA_PITCH_PROPS = ['preservesPitch', 'mozPreservesPitch', 'webkitPreservesPitch'];
const MEDIA_RATE_MIN = 0.25;
const MEDIA_RATE_MAX = 3.0;
const MEDIA_RATE_STEP = 0.05;
let mediaPitchObserver = null;
let __mediaPreservePitch = (() => {
    try { return localStorage.getItem(LS.mediaPitchPref) === '1'; } catch (_) { return false; }
})();

function isMediaPitchPreserved() {
    return !!__mediaPreservePitch;
}
function setMediaPitchPreserved(value) {
    __mediaPreservePitch = !!value;
    try { localStorage.setItem(LS.mediaPitchPref, __mediaPreservePitch ? '1' : '0'); } catch (_) {}
}

function ensureMediaPitchFollowsRate(mediaEl) {
    try {
        if (!mediaEl) return;
        const shouldPreserve = isMediaPitchPreserved();
        for (const prop of MEDIA_PITCH_PROPS) {
            if (prop in mediaEl) {
                mediaEl[prop] = shouldPreserve;
            }
        }
    } catch (_) {}
}
function bindPitchPersistence(mediaEl) {
    try {
        ensureMediaPitchFollowsRate(mediaEl);
        if (!mediaEl || mediaEl.dataset.pitchLockBound === '1') return;
        const reapply = () => ensureMediaPitchFollowsRate(mediaEl);
        mediaEl.addEventListener('ratechange', reapply);
        mediaEl.addEventListener('loadedmetadata', reapply);
        mediaEl.addEventListener('play', reapply);
        mediaEl.dataset.pitchLockBound = '1';
    } catch (_) {}
}
function bindPitchForNodeAndChildren(root) {
    try {
        if (!root) return;
        if (root.tagName) {
            const tag = root.tagName.toLowerCase();
            if (tag === 'audio' || tag === 'video') bindPitchPersistence(root);
        }
        if (root.querySelectorAll) root.querySelectorAll('audio,video').forEach(bindPitchPersistence);
    } catch (_) {}
}

function clampMediaPlaybackRate(value) {
    const num = Number.isFinite(value) ? Number(value) : 1;
    return Math.min(MEDIA_RATE_MAX, Math.max(MEDIA_RATE_MIN, num));
}
function quantizeMediaPlaybackRate(value) {
    try {
        const clamped = clampMediaPlaybackRate(value);
        const steps = Math.round(clamped / MEDIA_RATE_STEP);
        const quantized = steps * MEDIA_RATE_STEP;
        return Number(quantized.toFixed(2));
    } catch (_) {
        return clampMediaPlaybackRate(value);
    }
}
function animateMediaPlaybackRate(mediaEl, targetRate, onUpdate) {
    try {
        if (!mediaEl) return;
        const finalRate = quantizeMediaPlaybackRate(targetRate);
        bindPitchPersistence(mediaEl);
        const startRate = clampMediaPlaybackRate(mediaEl.playbackRate || 1);
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
        const caf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null;
        if (!raf || Math.abs(finalRate - startRate) < 0.004) {
            mediaEl.playbackRate = finalRate;
            ensureMediaPitchFollowsRate(mediaEl);
            if (typeof onUpdate === 'function') onUpdate(mediaEl.playbackRate || finalRate);
            return;
        }
        if (mediaEl.__rateTweenId && caf) {
            caf(mediaEl.__rateTweenId);
        }
        mediaEl.__rateTweenId = null;
        let startTime = null;
        const duration = 200;
        const step = (now) => {
            if (startTime === null) startTime = now;
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            const nextRate = startRate + (finalRate - startRate) * eased;
            mediaEl.playbackRate = clampMediaPlaybackRate(nextRate);
            ensureMediaPitchFollowsRate(mediaEl);
            if (typeof onUpdate === 'function') onUpdate(mediaEl.playbackRate);
            if (progress < 1) {
                mediaEl.__rateTweenId = raf(step);
            } else {
                mediaEl.playbackRate = finalRate;
                ensureMediaPitchFollowsRate(mediaEl);
                if (typeof onUpdate === 'function') onUpdate(mediaEl.playbackRate);
                mediaEl.__rateTweenId = null;
            }
        };
        mediaEl.__rateTweenId = raf(step);
    } catch (_) {}
}
function adjustMediaPlaybackRate(mediaEl, delta, onUpdate) {
    try {
        if (!mediaEl) return;
        const current = clampMediaPlaybackRate(mediaEl.playbackRate || 1);
        const target = quantizeMediaPlaybackRate(current + delta);
        animateMediaPlaybackRate(mediaEl, target, onUpdate);
    } catch (_) {}
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { if (document.body.contains(toast)) document.body.removeChild(toast); }, 500);
    }, 3000);
}

function showReconnectIndicator(text) {
    try {
        let el = document.getElementById('reconnect-indicator');
        if (!el) {
            el = document.createElement('div');
            el.id = 'reconnect-indicator';
            document.body.appendChild(el);
        }
        el.textContent = text || ((window.i18n&&i18n.t)?i18n.t('reconnecting'):'Reconectando con Dropbox…');
    } catch (_) {}
}
function hideReconnectIndicator() {
    const el = document.getElementById('reconnect-indicator');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// Modal de confirmación personalizado (Promise-based)
function showConfirm(message, acceptLabel = 'Aceptar', cancelLabel = 'Cancelar') {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const acceptBtn = document.getElementById('confirm-accept');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!modal || !msgEl || !acceptBtn || !cancelBtn) {
        // Fallback de seguridad si el modal no existe
        return Promise.resolve(window.confirm(message));
    }

    msgEl.textContent = message;
    acceptBtn.textContent = acceptLabel;
    cancelBtn.textContent = cancelLabel;
    modal.style.display = 'flex';

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.style.display = 'none';
            acceptBtn.removeEventListener('click', onAccept);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
        };
        const onAccept = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const onBackdrop = (e) => { if (e.target === modal) { cleanup(); resolve(false); } };
        const onKey = (e) => {
            if (e.key === 'Escape') { cleanup(); resolve(false); }
            if (e.key === 'Enter') { cleanup(); resolve(true); }
        };

        acceptBtn.addEventListener('click', onAccept);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);

        // Intentar enfocar el botón de aceptar para rapidez
        setTimeout(() => acceptBtn.focus(), 0);
    });
}

function convertirEnlaces(texto) {
    // Escapar HTML y luego convertir URLs en enlaces seguros o embeds de YouTube
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const escapeHTML = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const escaped = typeof texto === 'string' ? escapeHTML(texto) : '';

    const toEmbed = (rawUrl) => {
        try {
            // Quitar entidades HTML del texto escapado para poder parsear la URL
            const decodedUrl = rawUrl.replace(/&amp;/g, '&');
            const u = new URL(decodedUrl);
            const host = u.hostname.replace(/^www\./, '').toLowerCase();
            const isYtHost = (h) => (
                h === 'youtube.com' || h === 'youtube-nocookie.com' || h === 'youtu.be' || h === 'music.youtube.com'
            );
            if (!isYtHost(host)) return null;

            const validId = (s, min = 6) => /^[A-Za-z0-9_-]+$/.test(s || '') && (s || '').length >= min;
            const parseStartSeconds = (urlObj) => {
                try {
                    const raw = urlObj.searchParams.get('t') || urlObj.searchParams.get('start') || '';
                    if (!raw) return 0;
                    if (/^\d+$/.test(raw)) return Math.max(0, parseInt(raw, 10));
                    const m = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
                    if (m) {
                        const h = parseInt(m[1] || '0', 10) || 0;
                        const mn = parseInt(m[2] || '0', 10) || 0;
                        const s = parseInt(m[3] || '0', 10) || 0;
                        return Math.max(0, h * 3600 + mn * 60 + s);
                    }
                    const n = parseInt(raw, 10);
                    return isNaN(n) ? 0 : Math.max(0, n);
                } catch { return 0; }
            };

            // IDs posibles
            const listId = u.searchParams.get('list') || '';
            let videoId = '';
            if (host === 'youtu.be') {
                videoId = (u.pathname || '/').slice(1);
            } else {
                if (u.pathname.startsWith('/watch')) videoId = u.searchParams.get('v') || '';
                else if (u.pathname.startsWith('/shorts/')) videoId = u.pathname.split('/')[2] || '';
                else if (u.pathname.startsWith('/embed/')) videoId = u.pathname.split('/')[2] || '';
            }
            const startSec = parseStartSeconds(u);

            let embedUrl = '';
            if (validId(listId, 10) && validId(videoId)) {
                // Playlist con vídeo concreto (respeta tiempo)
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?list=${encodeURIComponent(listId)}&rel=0&modestbranding=1${startSec ? `&start=${startSec}` : ''}`;
            } else if (validId(listId, 10)) {
                // Solo playlist (sin tiempo)
                embedUrl = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(listId)}&rel=0&modestbranding=1`;
            } else if (validId(videoId)) {
                // Vídeo individual (respeta tiempo)
                embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1${startSec ? `&start=${startSec}` : ''}`;
            } else {
                return null;
            }

            const iframe = `<div class="yt-embed"><iframe src="${embedUrl}" title="YouTube embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>`;
            // Incluir también un enlace accesible como fallback
            const safeHref = encodeURI(decodedUrl);
            const link = `<div class="yt-link"><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHTML(decodedUrl)}</a></div>`;
            return iframe + link;
        } catch (_) { return null; }
    };

    return escaped.replace(urlRegex, function(url) {
        const embed = toEmbed(url);
        if (embed) return embed;
        const safeHref = encodeURI(url.replace(/&amp;/g, '&'));
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHTML(url.replace(/&amp;/g, '&'))}</a>`;
    });
}

// --- GESTIÓN DE DATOS LOCALES ---
function sanitizeCategoryName(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function getLocalCategoryNameOverrides() {
    try {
        const raw = localStorage.getItem(LS.categoryNames);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        const out = {};
        CATEGORY_KEYS.forEach(key => {
            const val = sanitizeCategoryName(parsed && parsed[key]);
            if (val) out[key] = val;
        });
        return out;
    } catch (_) {
        return {};
    }
}

function getCategoryNames() {
    const base = Object.assign({}, DEFAULT_CATEGORY_NAMES);
    if (window.i18n && typeof i18n.getEffectiveCategoryNames === 'function') {
        return Object.assign(base, i18n.getEffectiveCategoryNames());
    }
    return Object.assign(base, getLocalCategoryNameOverrides());
}

function setCategoryNameOverride(key, value) {
    if (!CATEGORY_KEYS.includes(key)) return;
    const sanitized = sanitizeCategoryName(value);
    if (window.i18n && typeof i18n.setCategoryNameOverrides === 'function') {
        const payload = {}; payload[key] = sanitized;
        i18n.setCategoryNameOverrides(payload);
    } else {
        const current = getLocalCategoryNameOverrides();
        if (sanitized) current[key] = sanitized;
        else delete current[key];
        try {
            if (Object.keys(current).length) localStorage.setItem(LS.categoryNames, JSON.stringify(current));
            else localStorage.removeItem(LS.categoryNames);
        } catch (_) {}
    }
    renderTasks();
}

function resetCategoryNameOverrides() {
    if (window.i18n && typeof i18n.resetCategoryNameOverrides === 'function') {
        i18n.resetCategoryNameOverrides();
    } else {
        try { localStorage.removeItem(LS.categoryNames); } catch (_) {}
    }
    renderTasks();
}

function setupCategoryNameAdminControls() {
    const group = document.getElementById('category-names-group');
    if (!group) return null;
    const inputs = Array.from(group.querySelectorAll('input[data-category-key]'));
    const resetBtn = document.getElementById('category-names-reset');
    const lastApplied = new Map();

    const applyValues = () => {
        const names = getCategoryNames();
        inputs.forEach(input => {
            const key = input.dataset.categoryKey;
            if (!key) return;
            const value = names[key] || DEFAULT_CATEGORY_NAMES[key] || '';
            input.value = value;
            lastApplied.set(key, sanitizeCategoryName(value));
        });
    };

    applyValues();

    inputs.forEach(input => {
        const key = input.dataset.categoryKey;
        if (!key) return;
        const applyChange = () => {
            const trimmed = sanitizeCategoryName(input.value);
            if (trimmed === lastApplied.get(key)) return;
            lastApplied.set(key, trimmed);
            setCategoryNameOverride(key, trimmed);
            const latest = getCategoryNames();
            if (latest[key]) input.value = latest[key];
        };
        input.addEventListener('input', applyChange);
        input.addEventListener('change', applyChange);
        input.addEventListener('blur', () => {
            const names = getCategoryNames();
            if (names[key]) input.value = names[key];
        });
    });

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetCategoryNameOverrides();
            applyValues();
        });
    }

    return { applyValues };
}

function saveCategoriesToLocalStorage() { localStorage.setItem(LS.categories, JSON.stringify(categories)); }
function normalizeCategoryKey(key) {
    const map = {
        'bandeja-de-entrada': 'en-preparacion',
        'prioritaria': 'preparadas',
        'proximas': 'en-proceso',
        'algun-dia': 'pendientes',
        // Nuevas claves se mapean a sí mismas
        'en-preparacion': 'en-preparacion',
        'preparadas': 'preparadas',
        'en-proceso': 'en-proceso',
        'pendientes': 'pendientes',
        'archivadas': 'archivadas'
    };
    return map[key] || key;
}

function migrateCategoryKeysObject(obj) {
    const target = { 'en-preparacion': [], 'preparadas': [], 'en-proceso': [], 'pendientes': [], 'archivadas': [] };
    try {
        for (const k in obj) {
            const nk = normalizeCategoryKey(k);
            if (!Array.isArray(obj[k])) continue;
            if (!Array.isArray(target[nk])) target[nk] = [];
            target[nk] = target[nk].concat(obj[k]);
        }
    } catch (_) {}
    return target;
}

function loadCategoriesFromLocalStorage() {
    const stored = localStorage.getItem(LS.categories);
    if (stored) {
        const raw = JSON.parse(stored);
        const migrated = migrateCategoryKeysObject(raw);
        Object.keys(categories).forEach(k => { categories[k] = Array.isArray(migrated[k]) ? migrated[k] : []; });
        // Guardar de vuelta en nuevo formato
        localStorage.setItem(LS.categories, JSON.stringify(categories));
    }
}
function migrateOldTasks() {
    let needsSave = false;
    for (const category in categories) {
        categories[category].forEach(task => {
            if (!task.id) { task.id = generateUUID(); needsSave = true; }
            if (!task.lastModified) { task.lastModified = new Date().toISOString(); needsSave = true; }
            if (!Array.isArray(task.attachments)) { task.attachments = []; needsSave = true; }
            // Añadir historial de realizados si no existe
            if (!Array.isArray(task.doneHistory)) { task.doneHistory = []; needsSave = true; }
            if (Array.isArray(task.attachments)) {
                task.attachments.forEach(att => {
                    if (att && typeof att === 'object') {
                        if (!('dropboxPath' in att)) att.dropboxPath = att.dropboxPath || null;
                        if (!('uploadedAt' in att)) att.uploadedAt = att.uploadedAt || null;
                        if (!('nextcloudPath' in att)) { att.nextcloudPath = null; needsSave = true; }
                        if (!('nextcloudUploadedAt' in att)) { att.nextcloudUploadedAt = null; needsSave = true; }
                    }
                });
            }
        });
    }
    if (needsSave) { console.log('🔧 Migrando tareas antiguas.'); saveCategoriesToLocalStorage(); }
}

// --- IndexedDB para adjuntos ---
let __attDBPromise = null;
function openAttachmentsDB() {
    if (__attDBPromise) return __attDBPromise;
    __attDBPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('edukanban.attachments', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('files')) {
                db.createObjectStore('files');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return __attDBPromise;
}
async function putAttachmentBlob(id, blob) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(blob, id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}
async function getAttachmentBlob(id) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const req = tx.objectStore('files').get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}
async function deleteAttachmentBlob(id) {
    const db = await openAttachmentsDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

function isImageType(mime) { return typeof mime === 'string' && mime.startsWith('image/'); }
function isPdfAttachment(att) {
    try {
        const n = (att && att.name || '').toLowerCase();
        const t = (att && att.type || '').toLowerCase();
        return t.includes('pdf') || n.endsWith('.pdf');
    } catch (_) { return false; }
}

function isAudioAttachment(att) {
    try {
        const n = (att && att.name || '').toLowerCase();
        const t = (att && att.type || '').toLowerCase();
        if (t.startsWith('audio/')) return true;
        return n.endsWith('.mp3') || n.endsWith('.wav') || n.endsWith('.ogg') || n.endsWith('.m4a') || n.endsWith('.aac') || n.endsWith('.flac') || n.endsWith('.weba');
    } catch (_) { return false; }
}

function isVideoAttachment(att) {
    try {
        const n = (att && att.name || '').toLowerCase();
        const t = (att && att.type || '').toLowerCase();
        if (t.startsWith('video/')) return true;
        return n.endsWith('.mp4') || n.endsWith('.m4v') || n.endsWith('.mov') || n.endsWith('.webm') || n.endsWith('.ogv') || n.endsWith('.mkv');
    } catch (_) { return false; }
}

// Intentar abrir un PDF de forma compatible (iOS/Android/desktop)
function getCurrentBasePath() {
    const path = window.location.pathname || '/';
    const i = path.lastIndexOf('/');
    return i >= 0 ? path.slice(0, i + 1) : '/';
}

async function registerTempPdfUrl(blob) {
    try {
        if (!('caches' in window)) return '';
        const token = (Math.random().toString(36).slice(2)) + Date.now();
        const basePath = getCurrentBasePath();
        const relPath = basePath + '__pdf__/' + token + '.pdf';
        const absUrl = new URL(relPath, window.location.origin).toString();
        const headers = new Headers({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
        const resp = new Response(blob, { status: 200, headers });
        const cache = await caches.open('edukanban-runtime');
        await cache.put(absUrl, resp);
        return absUrl;
    } catch (_) { return ''; }
}

function openPdfBlobInNewTab(blob) {
    try {
        // Abrir visor de inmediato para cumplir con el gesto del usuario
        const viewerHref = new URL(getCurrentBasePath() + 'pdf-viewer.html', window.location.origin).toString();
        const popup = window.open(viewerHref, '_blank');
        const blobUrl = URL.createObjectURL(blob);
        // Preparar también una URL HTTP servida por el SW desde la caché
        registerTempPdfUrl(blob).then((httpUrl) => {
            try { if (httpUrl && popup) popup.postMessage({ type: 'OPEN_PDF_URL', url: httpUrl }, '*'); } catch (_) {}
        });
        if (popup) {
            // Intentos de enviar la URL blob
            const trySendUrl = () => { try { popup.postMessage({ type: 'OPEN_PDF_URL', url: blobUrl }, '*'); } catch (_) {} };
            setTimeout(trySendUrl, 200);
            setTimeout(trySendUrl, 1000);
            // También preparar data URL como último recurso y enviarla cuando esté lista
            let dataReady = false; let dataVal = '';
            const r = new FileReader();
            r.onloadend = () => { dataReady = true; dataVal = String(r.result || ''); try { popup.postMessage({ type: 'OPEN_PDF_DATA', dataUrl: dataVal }, '*'); } catch (_) {} };
            try { r.readAsDataURL(blob); } catch (_) {}
            // Handshake: si el visor avisa que está listo, reenviar lo que tengamos
            const onMsg = (ev) => {
                try {
                    if (ev && ev.data && ev.data.type === 'PDF_VIEWER_READY') {
                        trySendUrl();
                        if (dataReady && dataVal) { try { popup.postMessage({ type: 'OPEN_PDF_DATA', dataUrl: dataVal }, '*'); } catch (_) {} }
                        window.removeEventListener('message', onMsg);
                    }
                } catch (_) {}
            };
            window.addEventListener('message', onMsg);
            return;
        }
        // Si la ventana se bloquea, abrir en la misma pestaña como último recurso con blob URL
        window.location.href = viewerHref + '?u=' + encodeURIComponent(blobUrl);
    } catch (_) {
        try { const r = new FileReader(); r.onloadend = () => window.location.href = String(r.result); r.readAsDataURL(blob); } catch (__) {}
    }
}

function preferredFileName(att) {
    const name = (att && att.name) ? String(att.name) : '';
    if (name && /\.[A-Za-z0-9]+$/.test(name)) return name;
    const t = (att && att.type || '').toLowerCase();
    const base = name || 'archivo';
    if (t.includes('pdf')) return base.replace(/\.$/, '') + '.pdf';
    if (t.includes('jpeg') || t.includes('jpg')) return base.replace(/\.$/, '') + '.jpg';
    if (t.includes('png')) return base.replace(/\.$/, '') + '.png';
    if (t.includes('webp')) return base.replace(/\.$/, '') + '.webp';
    if (t.includes('zip')) return base.replace(/\.$/, '') + '.zip';
    return base;
}

// --- Detección básica por firma (magic numbers) ---
function detectFromBytes(bytes) {
    const startsWith = (...sig) => sig.every((v, i) => bytes[i] === v);
    // PDF: %PDF-
    if (startsWith(0x25, 0x50, 0x44, 0x46, 0x2D)) return { mime: 'application/pdf', ext: 'pdf', isImage: false };
    // PNG
    if (startsWith(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) return { mime: 'image/png', ext: 'png', isImage: true };
    // JPEG
    if (startsWith(0xFF, 0xD8, 0xFF)) return { mime: 'image/jpeg', ext: 'jpg', isImage: true };
    // GIF
    if (startsWith(0x47, 0x49, 0x46, 0x38)) return { mime: 'image/gif', ext: 'gif', isImage: true };
    // WEBP: RIFF....WEBP
    if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
        return { mime: 'image/webp', ext: 'webp', isImage: true };
    }
    return { mime: '', ext: '', isImage: false };
}

async function sniffMimeFromBlob(blob) {
    try {
        const buf = await blob.slice(0, 16).arrayBuffer();
        const bytes = new Uint8Array(buf);
        return detectFromBytes(bytes);
    } catch (_) { return { mime: '', ext: '', isImage: false }; }
}

async function prepareAttachmentsFromFiles(fileList) {
    const files = Array.from(fileList || []);
    const metas = [];
    for (const f of files) {
        const id = generateUUID();
        await putAttachmentBlob(id, f);
        let detected = { mime: '', ext: '', isImage: false };
        try { detected = await sniffMimeFromBlob(f); } catch (_) {}
        const type = (f.type && f.type !== 'application/octet-stream') ? f.type : (detected.mime || 'application/octet-stream');
        let name = f.name || 'archivo';
        if (!/\.[A-Za-z0-9]+$/.test(name) && detected.ext) name = name.replace(/\.$/, '') + '.' + detected.ext;
        const isImg = isImageType(type) || detected.isImage;
        metas.push({
            id,
            name,
            type,
            size: f.size || 0,
            isImage: isImg,
            dropboxPath: null,
            uploadedAt: null,
            nextcloudPath: null,
            nextcloudUploadedAt: null,
            lastModified: new Date().toISOString()
        });
    }
    return metas;
}

// --- LÓGICA DE MANIPULACIÓN DE TAREAS (CORREGIDA CON IDs) ---
function findTask(taskId) {
    for (const category in categories) {
        const taskIndex = categories[category].findIndex(t => t.id === taskId);
        if (taskIndex > -1) return { task: categories[category][taskIndex], category, taskIndex };
    }
    return null;
}

function addTask(category, taskName, tags = [], reminderAt = null) {
    const now = new Date().toISOString();
    const newTask = {
        id: generateUUID(),
        task: taskName,
        completed: false,
        lastModified: now,
        sortModifiedAt: now,
        tags: tags,
        reminderAt: reminderAt, // ISO string o null
        reminderDone: false,
        triggerScheduledAt: null,
        attachments: [],
        orderCode: '', // Orden manual A..Z
        doneHistory: [] // Historial de realizados
    };
    categories[category].push(newTask);
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

async function removeTask(taskId) {
    const taskData = findTask(taskId);
    if (!taskData) return;

    const taskTitle = (taskData.task && taskData.task.task) ? taskData.task.task : '';
    const msg = (window.i18n && i18n.t) ? i18n.t('confirm_delete_activity', { title: taskTitle }) : (taskTitle ? `¿Estás seguro de que quieres eliminar la actividad "${taskTitle}"?` : '¿Estás seguro de que quieres eliminar esta actividad?');
    const confirmed = await showConfirm(msg, 'Eliminar', 'Cancelar');
    if (!confirmed) return;

    const [removedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
    deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });
    localStorage.setItem(LS.deleted, JSON.stringify(deletedTasks));
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

function toggleTaskCompletion(taskId) {
    const taskData = findTask(taskId);
    if (taskData) {
        const { task } = taskData;
        // Nuevo: marcar como realizado sin archivar, guardando historial
        const prevSort = task.sortModifiedAt || task.lastModified || new Date(0).toISOString();
        task.doneHistory = Array.isArray(task.doneHistory) ? task.doneHistory : [];
        task.doneHistory.push(new Date().toISOString());
        task.lastModified = new Date().toISOString();
        // Mantener el orden visual: no tocar la clave de ordenación
        task.sortModifiedAt = prevSort;
        task.reminderDone = true;
        saveCategoriesToLocalStorage();
        renderTasks();
        showToast((window.i18n&&i18n.t)?i18n.t('marked_done'):'Actividad marcada como realizada');
        if (accessToken) syncToDropbox(false);
        if (isNextcloudConfigured()) syncToNextcloud(false);
    }
}

// Alias más explícito para UI
function markTaskDone(taskId) {
    toggleTaskCompletion(taskId);
}

// Archivar/desarchivar mediante checkbox en la tarjeta
function toggleTaskArchived(taskId) {
    const data = findTask(taskId);
    if (!data) return;
    const { task, category, taskIndex } = data;
    const now = new Date().toISOString();
    if (category !== 'archivadas') {
        // Mover a Archivadas
        const [movedTask] = categories[category].splice(taskIndex, 1);
        movedTask.completed = true;
        movedTask.archivedOn = now;
        movedTask.reminderDone = true;
        movedTask.lastModified = now;
        movedTask.sortModifiedAt = now;
        categories['archivadas'].push(movedTask);
    } else {
        // Desarchivar a En preparación
        const [movedTask] = categories[category].splice(taskIndex, 1);
        movedTask.completed = false;
        delete movedTask.archivedOn;
        movedTask.lastModified = now;
        movedTask.sortModifiedAt = now;
        categories['en-preparacion'].push(movedTask);
    }
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

function moveTask(taskId, newCategory) {
    const taskData = findTask(taskId);
    if (taskData && categories[newCategory]) {
        const [task] = categories[taskData.category].splice(taskData.taskIndex, 1);
        const now = new Date().toISOString();
        task.lastModified = now;
        task.sortModifiedAt = now;
        // Gestionar metadatos de archivado al mover entre categorías
        if (newCategory === 'archivadas') {
            task.completed = true;
            task.archivedOn = new Date().toISOString();
            task.reminderDone = true;
        } else if (taskData.category === 'archivadas' && newCategory !== 'archivadas') {
            task.completed = false;
            delete task.archivedOn;
        }
        categories[newCategory].push(task);
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
        if (isNextcloudConfigured()) syncToNextcloud(false);
    }
}

// --- ORDEN MANUAL A..Z ---
function setTaskOrder(taskId, code) {
    const data = findTask(taskId);
    if (!data) return;
    const { task } = data;
    task.orderCode = (code || '').toUpperCase();
    const now = new Date().toISOString();
    task.lastModified = now;
    task.sortModifiedAt = now;
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

// --- DIVIDIR TAREA POR ETIQUETAS ---
async function splitTaskByTags(taskId) {
    const data = findTask(taskId);
    if (!data) return;
    const { task, category } = data;
    const tags = Array.isArray(task.tags) ? Array.from(new Set(task.tags.filter(t => typeof t === 'string' && t.trim().length))) : [];
    if (tags.length <= 1) {
        showToast((window.i18n&&i18n.t)?i18n.t('split_single_error'):'La actividad ya tiene una sola etiqueta.', 'error');
        return;
    }

    const msg = (window.i18n && i18n.t)
        ? i18n.t('confirm_split_tags')
        : 'Se crearán copias, una por etiqueta. ¿Continuar?';
    const confirmed = await showConfirm(msg, (window.i18n&&i18n.t)?i18n.t('split'):'Dividir', (window.i18n&&i18n.t)?i18n.t('cancel'):'Cancelar');
    if (!confirmed) return;

    // Mantener la primera etiqueta en la tarea original
    const firstTag = tags[0];
    task.tags = [firstTag];
    const now = new Date().toISOString();
    task.lastModified = now;
    task.sortModifiedAt = now;

    // Crear copias para las demás etiquetas
    const extraTags = tags.slice(1);
    const clones = extraTags.map(tg => ({
        id: generateUUID(),
        task: task.task,
        completed: !!task.completed,
        lastModified: now,
        sortModifiedAt: now,
        tags: [tg],
        reminderAt: task.reminderAt || null,
        reminderDone: false,
        triggerScheduledAt: null,
        attachments: Array.isArray(task.attachments) ? task.attachments.slice() : [],
        orderCode: (task.orderCode || '').toUpperCase()
    }));

    // Insertar clones justo después de la tarea original para mantener el orden
    categories[category].splice(data.taskIndex + 1, 0, ...clones);
    saveCategoriesToLocalStorage();
    renderTasks();
    showToast((window.i18n&&i18n.t)?i18n.t('split_done'):'Actividad dividida por etiquetas.');
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

// --- EDICIÓN DE TAREAS ---
function updateTask(taskId, newName, newCategory, newTags = [], newReminderAt = null) {
    const data = findTask(taskId);
    if (!data) return;
    const { task, category } = data;
    task.task = newName;
    task.tags = Array.isArray(newTags) ? newTags : [];
    // Orden manual (si existe en el formulario)
    try {
        const orderInput = document.getElementById('popup-task-order');
        if (orderInput) task.orderCode = (orderInput.value || '').toUpperCase();
    } catch (_) {}
    // Actualizar recordatorio
    task.reminderAt = newReminderAt || null;
    // Si se cambia la fecha, reiniciar el estado de disparo y reprogramar
    task.reminderDone = false;
    task.triggerScheduledAt = null;
    const now = new Date().toISOString();
    task.lastModified = now;
    task.sortModifiedAt = now;
    if (newCategory && newCategory !== category && categories[newCategory]) {
        categories[category].splice(data.taskIndex, 1);
        // Gestionar metadatos de archivado si cambia la categoría desde el editor
        if (newCategory === 'archivadas') {
            task.completed = true;
            task.archivedOn = new Date().toISOString();
        } else if (category === 'archivadas' && newCategory !== 'archivadas') {
            task.completed = false;
            delete task.archivedOn;
        }
        categories[newCategory].push(task);
    }
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
    if (isNextcloudConfigured()) syncToNextcloud(false);
}

function openEditTask(taskId) {
    const data = findTask(taskId);
    if (!data) return;
    const popup = document.getElementById('popup-tarea');
    const form = document.getElementById('popup-task-form');
    const taskNameInput = document.getElementById('popup-task-name');
    const categorySelect = document.getElementById('popup-task-category');
    const tagsInput = document.getElementById('popup-task-tags');
    const reminderInput = document.getElementById('popup-task-reminder');
    const orderInput = document.getElementById('popup-task-order');
    const attList = document.getElementById('popup-existing-attachments');
    const reuseToggle = document.getElementById('popup-attach-reuse-toggle');
    const reusePanel = document.getElementById('popup-attach-reuse-panel');
    if (!popup || !form || !taskNameInput || !categorySelect || !tagsInput) return;

    // Prefill
    taskNameInput.value = data.task.task || '';
    categorySelect.value = data.category;
    tagsInput.value = (data.task.tags || []).join(', ');
    if (reminderInput) {
        // Convertir ISO a valor datetime-local (sin zona, formato YYYY-MM-DDTHH:mm)
        const iso = data.task.reminderAt || '';
        if (iso) {
            const d = new Date(iso);
            const pad = n => String(n).padStart(2, '0');
            const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            reminderInput.value = local;
        } else {
            reminderInput.value = '';
        }
    }
    if (orderInput) orderInput.value = (data.task.orderCode || '').toUpperCase();

    // Switch form to edit mode
    form.dataset.mode = 'edit';
    form.dataset.editingId = taskId;
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = (window.i18n && i18n.t) ? i18n.t('save') : 'Guardar';

    popup.style.display = 'flex';
    taskNameInput.focus();
    updateTagDatalist();
    renderTagSuggestions();

    // Limpiar cualquier selección pendiente al entrar en edición
    pendingReusedAttachments = [];

    // Renderizar adjuntos existentes en el modal
    if (attList) {
        renderPopupAttachments(data.task);
    }
    if (reuseToggle && reusePanel) {
        // Mostrar el botón solo en modo edición
        reuseToggle.style.display = 'inline-block';
        reuseToggle.textContent = '🔁 ' + ((window.i18n&&i18n.t)?i18n.t('reuse_attachment'):'Reutilizar adjunto');
        reuseToggle.onclick = () => {
            reusePanel.style.display = reusePanel.style.display === 'none' ? 'block' : 'none';
            if (reusePanel.style.display === 'block') renderReusePanel(data.task.id);
        };
    }
}

function resetPopupFormMode() {
    const form = document.getElementById('popup-task-form');
    if (!form) return;
    form.dataset.mode = 'add';
    form.dataset.editingId = '';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = (window.i18n && i18n.t) ? i18n.t('add') : 'Añadir';
    // Limpia valores del formulario para evitar que aparezcan datos de la última edición
    try {
        const nameInput = document.getElementById('popup-task-name');
        const categorySelect = document.getElementById('popup-task-category');
        const tagsInput = document.getElementById('popup-task-tags');
        const reminderInput = document.getElementById('popup-task-reminder');
        const orderInput = document.getElementById('popup-task-order');
        const filesInput = document.getElementById('popup-task-attachments');
        if (nameInput) nameInput.value = '';
        // Mantén la categoría seleccionada actual o resetea a la primera opción si se desea
        // if (categorySelect) categorySelect.selectedIndex = 0;
        if (tagsInput) tagsInput.value = '';
        if (reminderInput) reminderInput.value = '';
        if (orderInput) orderInput.value = '';
        if (filesInput) filesInput.value = '';
    } catch (_) {}
    // Reinicia estado de reutilización de adjuntos en modo añadir
    pendingReusedAttachments = [];
    const attList = document.getElementById('popup-existing-attachments');
    if (attList) attList.innerHTML = '';
    const reusePanel = document.getElementById('popup-attach-reuse-panel');
    if (reusePanel) reusePanel.style.display = 'none', reusePanel.innerHTML = '';
}

function iterAllAttachments(cb) {
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const t of tasks) {
            (t.attachments||[]).forEach(att => cb(att, t, cat));
        }
    }
}
function collectReuseCatalog() {
    const map = new Map();
    iterAllAttachments((att, t) => {
        const key = att.dropboxPath || att.nextcloudPath || `${att.name}|${att.type}|${att.size}`;
        if (!map.has(key)) map.set(key, { att, fromTaskId: t.id, key });
    });
    return Array.from(map.values());
}
async function addExistingAttachment(targetTaskId, source) {
    const data = findTask(targetTaskId);
    if (!data) return;
    const { task } = data;
    const srcAtt = source.att;
    const newId = generateUUID();
    // Copiar blob local si existe
    try {
        const blob = await ensureAttachmentBlob(srcAtt);
        if (blob) await putAttachmentBlob(newId, blob);
    } catch (_) {}
    const newAtt = {
        id: newId,
        name: srcAtt.name,
        type: srcAtt.type,
        size: srcAtt.size || 0,
        isImage: !!srcAtt.isImage,
        dropboxPath: srcAtt.dropboxPath || null,
        uploadedAt: srcAtt.uploadedAt || null,
        nextcloudPath: srcAtt.nextcloudPath || null,
        nextcloudUploadedAt: srcAtt.nextcloudUploadedAt || null,
        lastModified: new Date().toISOString()
    };
    task.attachments = Array.isArray(task.attachments) ? task.attachments : [];
    task.attachments.push(newAtt);
    task.lastModified = new Date().toISOString();
    saveCategoriesToLocalStorage();
    renderPopupAttachments(task);
    renderTasks();
}

// Reutilización en modo "Añadir": acumula adjuntos seleccionados
async function addExistingToPending(source) {
    try {
        const srcAtt = source.att;
        const newId = generateUUID();
        const blob = await ensureAttachmentBlob(srcAtt);
        if (blob) await putAttachmentBlob(newId, blob);
        const newAtt = {
            id: newId,
            name: srcAtt.name,
            type: srcAtt.type,
            size: srcAtt.size || 0,
            isImage: !!srcAtt.isImage,
            dropboxPath: srcAtt.dropboxPath || null,
            uploadedAt: srcAtt.uploadedAt || null,
            nextcloudPath: srcAtt.nextcloudPath || null,
            nextcloudUploadedAt: srcAtt.nextcloudUploadedAt || null,
            lastModified: new Date().toISOString()
        };
        pendingReusedAttachments.push(newAtt);
        showToast((window.i18n&&i18n.t)?i18n.t('add'):'Añadido');
        renderPendingAttachments();
    } catch (e) {
        console.warn('addExistingToPending', e);
        showToast('No se pudo añadir el adjunto', 'error');
    }
}

function renderPendingAttachments() {
    try {
        const form = document.getElementById('popup-task-form');
        if (!form || form.dataset.mode !== 'add') return;
        const container = document.getElementById('popup-existing-attachments');
        if (!container) return;
        container.classList.add('popup-attachments');
        const list = Array.isArray(pendingReusedAttachments) ? pendingReusedAttachments : [];
        if (!list.length) { container.innerHTML = ''; return; }
        container.innerHTML = list.map(att => {
            const label = att.name || 'archivo';
            const img = att.isImage ? `<img class="attachment-img" data-att-id="${att.id}" alt="${label}">` : '';
            const audio = (!att.isImage && isAudioAttachment(att)) ? `<div class="attachment-audio-wrap"><audio class="attachment-audio" controls data-att-id="${att.id}"></audio><div class="media-controls"><button type="button" class="audio-restart" data-att-id="${att.id}" title="Inicio">⏮</button><button type="button" class="audio-loop-toggle" data-att-id="${att.id}" aria-pressed="false" title="Bucle">🔁</button><span class="audio-speed"><button type="button" class="audio-speed-down" data-att-id="${att.id}" title="Más lento">−</button><span class="audio-speed-label" data-att-id="${att.id}">1x</span><button type="button" class="audio-speed-up" data-att-id="${att.id}" title="Más rápido">+</button></span><span class="ab-controls"><button type="button" class="audio-ab-a" data-att-id="${att.id}" title="Marcar punto A">A</button><button type="button" class="audio-ab-b" data-att-id="${att.id}" title="Marcar punto B">B</button><button type="button" class="audio-ab-toggle" data-att-id="${att.id}" aria-pressed="false" title="Bucle A–B">A–B</button><button type="button" class="audio-ab-clear" data-att-id="${att.id}" title="Limpiar A–B">✖</button></span></div></div>` : '';
            const video = (!att.isImage && !isAudioAttachment(att) && isVideoAttachment(att)) ? `<div class="attachment-video-wrap"><video class="attachment-video" controls data-att-id="${att.id}"></video><div class="media-controls"><button type="button" class="video-restart" data-att-id="${att.id}" title="Inicio">⏮</button><button type="button" class="video-loop-toggle" data-att-id="${att.id}" aria-pressed="false" title="Bucle">🔁</button><span class="video-speed"><button type="button" class="video-speed-down" data-att-id="${att.id}" title="Más lento">−</button><span class="video-speed-label" data-att-id="${att.id}">1x</span><button type="button" class="video-speed-up" data-att-id="${att.id}" title="Más rápido">+</button></span><span class="ab-controls"><button type="button" class="video-ab-a" data-att-id="${att.id}" title="Marcar punto A">A</button><button type="button" class="video-ab-b" data-att-id="${att.id}" title="Marcar punto B">B</button><button type="button" class="video-ab-toggle" data-att-id="${att.id}" aria-pressed="false" title="Bucle A–B">A–B</button><button type="button" class="video-ab-clear" data-att-id="${att.id}" title="Limpiar A–B">✖</button></span></div></div>` : '';
            const link = (!att.isImage && !isAudioAttachment(att) && !isVideoAttachment(att)) ? `<a class="attachment-file" data-att-id="${att.id}" href="#" title="${label}">📎 ${label}</a>` : '';
            const dl = (!att.isImage && !isAudioAttachment(att) && !isVideoAttachment(att)) ? `<a class="attachment-dl" data-att-id="${att.id}" href="#" title="Descargar">⬇️</a>` : '';
            return `<div class="attachment-row" data-att-id="${att.id}">${img}${audio}${video}${link}${dl}</div>`;
        }).join('');
        (async () => {
            for (const att of list) {
                const imgEl = container.querySelector(`img.attachment-img[data-att-id="${att.id}"]`);
                const aEl = container.querySelector(`a.attachment-file[data-att-id="${att.id}"]`);
                const audioEl = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                const videoEl = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                if (audioEl) bindPitchPersistence(audioEl);
                if (videoEl) bindPitchPersistence(videoEl);
                let url = null;
                const blob = await ensureAttachmentBlob(att);
                if (imgEl && blob) imgEl.src = URL.createObjectURL(blob);
                if (audioEl && blob && !audioEl.src) audioEl.src = URL.createObjectURL(blob);
                if (videoEl && blob && !videoEl.src) {
                    videoEl.src = URL.createObjectURL(blob);
                    try { videoEl.controls = true; } catch (_) {}
                }
                if (!url && blob) url = URL.createObjectURL(blob);
                const restartBtn = container.querySelector(`button.audio-restart[data-att-id="${att.id}"]`);
                if (restartBtn && !restartBtn.dataset.bound) {
                    restartBtn.addEventListener('click', () => {
                        const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                        if (el) {
                            const wasPlaying = !el.paused;
                            el.currentTime = 0;
                            if (wasPlaying) { try { el.play(); } catch (_) {} }
                        }
                    });
                    restartBtn.dataset.bound = '1';
                }
                // Toggle bucle audio
                const aLoopBtn = container.querySelector(`button.audio-loop-toggle[data-att-id="${att.id}"]`);
                if (aLoopBtn && audioEl && !aLoopBtn.dataset.bound) {
                    const apply = () => {
                        const on = getMediaLoopPref(att.id);
                        audioEl.loop = !!on;
                        if (on) audioEl.setAttribute('loop', ''); else audioEl.removeAttribute('loop');
                        aLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                        aLoopBtn.classList.toggle('active', !!on);
                    };
                    if (!audioEl.dataset.loopBound) {
                        audioEl.addEventListener('ended', () => {
                            if (getMediaLoopPref(att.id)) {
                                try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                            }
                        });
                        audioEl.dataset.loopBound = '1';
                    }
                    apply();
                    aLoopBtn.addEventListener('click', () => {
                        const next = !getMediaLoopPref(att.id);
                        setMediaLoopPref(att.id, next);
                        apply();
                        if (next && (audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration - 0.05))) {
                            try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    aLoopBtn.dataset.bound = '1';
                }
                // Bucle A–B audio
                const aSetBtn = container.querySelector(`button.audio-ab-a[data-att-id="${att.id}"]`);
                const bSetBtn = container.querySelector(`button.audio-ab-b[data-att-id="${att.id}"]`);
                const abToggleBtn = container.querySelector(`button.audio-ab-toggle[data-att-id="${att.id}"]`);
                const abClearBtn = container.querySelector(`button.audio-ab-clear[data-att-id="${att.id}"]`);
                if (audioEl && abToggleBtn && !abToggleBtn.dataset.bound) {
                    const fmt = (s)=>{
                        if (!Number.isFinite(s)) return '';
                        const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=Math.floor(s%60);
                        const pad=n=>String(n).padStart(2,'0');
                        return h>0? `${h}:${pad(m)}:${pad(sc)}` : `${m}:${pad(sc)}`;
                    };
                    const applyAB = () => {
                        const st = getMediaABPref(att.id);
                        abToggleBtn.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
                        abToggleBtn.classList.toggle('active', !!st.enabled);
                        if (st.enabled) { audioEl.removeAttribute('loop'); audioEl.loop = false; }
                        if (aSetBtn) {
                            const marked = Number.isFinite(st.a);
                            aSetBtn.classList.toggle('marked', marked);
                            aSetBtn.setAttribute('aria-pressed', marked ? 'true' : 'false');
                            aSetBtn.title = marked ? `Punto A (${fmt(st.a)})` : 'Marcar punto A';
                        }
                        if (bSetBtn) {
                            const marked = Number.isFinite(st.b);
                            bSetBtn.classList.toggle('marked', marked);
                            bSetBtn.setAttribute('aria-pressed', marked ? 'true' : 'false');
                            bSetBtn.title = marked ? `Punto B (${fmt(st.b)})` : 'Marcar punto B';
                        }
                    };
                    if (!audioEl.dataset.abBound) {
                        audioEl.addEventListener('timeupdate', () => {
                            const st = getMediaABPref(att.id);
                            if (!st.enabled || !(Number.isFinite(st.a) && Number.isFinite(st.b)) || st.b <= st.a) return;
                            const t = audioEl.currentTime || 0;
                            if (t >= st.b - 0.03) {
                                try { audioEl.currentTime = st.a; if (!audioEl.paused) audioEl.play().catch(()=>{}); } catch(_) {}
                            } else if (t < st.a - 0.03) {
                                try { audioEl.currentTime = st.a; } catch(_) {}
                            }
                        });
                        audioEl.dataset.abBound = '1';
                    }
                    applyAB();
                    abToggleBtn.addEventListener('click', () => {
                        const st = getMediaABPref(att.id);
                        let { a, b } = st;
                        if (!Number.isFinite(a)) a = 0;
                        if (!Number.isFinite(b)) b = Number.isFinite(audioEl.duration) ? audioEl.duration : (a + 1);
                        if (b <= a) b = a + 0.1;
                        setMediaABPref(att.id, { a, b, enabled: !st.enabled });
                        // Desactivar bucle simple al activar A–B
                        if (!st.enabled) {
                            setMediaLoopPref(att.id, false);
                            const btn = container.querySelector(`button.audio-loop-toggle[data-att-id="${att.id}"]`);
                            if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('active'); }
                            audioEl.removeAttribute('loop'); audioEl.loop = false;
                        }
                        applyAB();
                    });
                    if (aSetBtn) aSetBtn.addEventListener('click', () => {
                        const t = audioEl.currentTime || 0;
                        const st = getMediaABPref(att.id);
                        let b = st.b;
                        if (Number.isFinite(b) && b <= t) {
                            b = Number.isFinite(audioEl.duration) ? audioEl.duration : (t + 0.1);
                        }
                        setMediaABPref(att.id, { a: t, b });
                        applyAB();
                    });
                    if (bSetBtn) bSetBtn.addEventListener('click', () => {
                        const t = audioEl.currentTime || 0;
                        const st = getMediaABPref(att.id);
                        let a = st.a;
                        if (!Number.isFinite(a) || a >= t) a = Math.max(0, (t - 0.1));
                        setMediaABPref(att.id, { a, b: t });
                        applyAB();
                    });
                    if (abClearBtn) abClearBtn.addEventListener('click', () => {
                        setMediaABPref(att.id, { a: null, b: null, enabled: false });
                        applyAB();
                    });
                    abToggleBtn.dataset.bound = '1';
                }
                const vRestartBtn = container.querySelector(`button.video-restart[data-att-id="${att.id}"]`);
                if (vRestartBtn && !vRestartBtn.dataset.bound) {
                    vRestartBtn.addEventListener('click', () => {
                        const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                        if (el) {
                            const wasPlaying = !el.paused;
                            el.currentTime = 0;
                            if (wasPlaying) { try { el.play(); } catch (_) {} }
                        }
                    });
                    vRestartBtn.dataset.bound = '1';
                }
                // Toggle bucle vídeo
                const vLoopBtn = container.querySelector(`button.video-loop-toggle[data-att-id="${att.id}"]`);
                if (vLoopBtn && videoEl && !vLoopBtn.dataset.bound) {
                    const apply = () => {
                        const on = getMediaLoopPref(att.id);
                        videoEl.loop = !!on;
                        if (on) videoEl.setAttribute('loop', ''); else videoEl.removeAttribute('loop');
                        vLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                        vLoopBtn.classList.toggle('active', !!on);
                    };
                    if (!videoEl.dataset.loopBound) {
                        videoEl.addEventListener('ended', () => {
                            if (getMediaLoopPref(att.id)) {
                                try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                            }
                        });
                        videoEl.dataset.loopBound = '1';
                    }
                    apply();
                    vLoopBtn.addEventListener('click', () => {
                        const next = !getMediaLoopPref(att.id);
                        setMediaLoopPref(att.id, next);
                        apply();
                        if (next && (videoEl.ended || (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05))) {
                            try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    vLoopBtn.dataset.bound = '1';
                }
                // Bucle A–B vídeo
                const vaSetBtn = container.querySelector(`button.video-ab-a[data-att-id="${att.id}"]`);
                const vbSetBtn = container.querySelector(`button.video-ab-b[data-att-id="${att.id}"]`);
                const vabToggleBtn = container.querySelector(`button.video-ab-toggle[data-att-id="${att.id}"]`);
                const vabClearBtn = container.querySelector(`button.video-ab-clear[data-att-id="${att.id}"]`);
                if (videoEl && vabToggleBtn && !vabToggleBtn.dataset.bound) {
                    const fmt = (s)=>{
                        if (!Number.isFinite(s)) return '';
                        const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=Math.floor(s%60);
                        const pad=n=>String(n).padStart(2,'0');
                        return h>0? `${h}:${pad(m)}:${pad(sc)}` : `${m}:${pad(sc)}`;
                    };
                    const applyABv = () => {
                        const st = getMediaABPref(att.id);
                        vabToggleBtn.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
                        vabToggleBtn.classList.toggle('active', !!st.enabled);
                        if (st.enabled) { videoEl.removeAttribute('loop'); videoEl.loop = false; }
                        if (vaSetBtn) {
                            const marked = Number.isFinite(st.a);
                            vaSetBtn.classList.toggle('marked', marked);
                            vaSetBtn.setAttribute('aria-pressed', marked ? 'true' : 'false');
                            vaSetBtn.title = marked ? `Punto A (${fmt(st.a)})` : 'Marcar punto A';
                        }
                        if (vbSetBtn) {
                            const marked = Number.isFinite(st.b);
                            vbSetBtn.classList.toggle('marked', marked);
                            vbSetBtn.setAttribute('aria-pressed', marked ? 'true' : 'false');
                            vbSetBtn.title = marked ? `Punto B (${fmt(st.b)})` : 'Marcar punto B';
                        }
                    };
                    if (!videoEl.dataset.abBound) {
                        videoEl.addEventListener('timeupdate', () => {
                            const st = getMediaABPref(att.id);
                            if (!st.enabled || !(Number.isFinite(st.a) && Number.isFinite(st.b)) || st.b <= st.a) return;
                            const t = videoEl.currentTime || 0;
                            if (t >= st.b - 0.03) {
                                try { videoEl.currentTime = st.a; if (!videoEl.paused) videoEl.play().catch(()=>{}); } catch(_) {}
                            } else if (t < st.a - 0.03) {
                                try { videoEl.currentTime = st.a; } catch(_) {}
                            }
                        });
                        videoEl.dataset.abBound = '1';
                    }
                    applyABv();
                    vabToggleBtn.addEventListener('click', () => {
                        const st = getMediaABPref(att.id);
                        let { a, b } = st;
                        if (!Number.isFinite(a)) a = 0;
                        if (!Number.isFinite(b)) b = Number.isFinite(videoEl.duration) ? videoEl.duration : (a + 1);
                        if (b <= a) b = a + 0.1;
                        setMediaABPref(att.id, { a, b, enabled: !st.enabled });
                        if (!st.enabled) {
                            setMediaLoopPref(att.id, false);
                            const btn = container.querySelector(`button.video-loop-toggle[data-att-id="${att.id}"]`);
                            if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('active'); }
                            videoEl.removeAttribute('loop'); videoEl.loop = false;
                        }
                        applyABv();
                    });
                    if (vaSetBtn) vaSetBtn.addEventListener('click', () => {
                        const t = videoEl.currentTime || 0;
                        const st = getMediaABPref(att.id);
                        let b = st.b;
                        if (Number.isFinite(b) && b <= t) b = Number.isFinite(videoEl.duration) ? videoEl.duration : (t + 0.1);
                        setMediaABPref(att.id, { a: t, b });
                        applyABv();
                    });
                    if (vbSetBtn) vbSetBtn.addEventListener('click', () => {
                        const t = videoEl.currentTime || 0;
                        const st = getMediaABPref(att.id);
                        let a = st.a;
                        if (!Number.isFinite(a) || a >= t) a = Math.max(0, (t - 0.1));
                        setMediaABPref(att.id, { a, b: t });
                        applyABv();
                    });
                    if (vabClearBtn) vabClearBtn.addEventListener('click', () => {
                        setMediaABPref(att.id, { a: null, b: null, enabled: false });
                        applyABv();
                    });
                    vabToggleBtn.dataset.bound = '1';
                }
                // velocidad −/+
                const speedDownBtn = container.querySelector(`button.audio-speed-down[data-att-id="${att.id}"]`);
                const speedUpBtn = container.querySelector(`button.audio-speed-up[data-att-id="${att.id}"]`);
                const speedLabel = container.querySelector(`span.audio-speed-label[data-att-id="${att.id}"]`);
                const updateSpeedLabel = () => { try { if (audioEl && speedLabel) speedLabel.textContent = `${(audioEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
                if (audioEl) updateSpeedLabel();
                if (speedDownBtn && !speedDownBtn.dataset.bound) {
                    speedDownBtn.addEventListener('click', () => {
                        const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                        if (!el) return;
                        adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateSpeedLabel());
                    });
                    speedDownBtn.dataset.bound = '1';
                }
                if (speedUpBtn && !speedUpBtn.dataset.bound) {
                    speedUpBtn.addEventListener('click', () => {
                        const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                        if (!el) return;
                        adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateSpeedLabel());
                    });
                    speedUpBtn.dataset.bound = '1';
                }
                // Vídeo: velocidad −/+
                const vSpeedDownBtn = container.querySelector(`button.video-speed-down[data-att-id="${att.id}"]`);
                const vSpeedUpBtn = container.querySelector(`button.video-speed-up[data-att-id="${att.id}"]`);
                const vSpeedLabel = container.querySelector(`span.video-speed-label[data-att-id="${att.id}"]`);
                const updateVSpeedLabel = () => { try { const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`); if (el && vSpeedLabel) vSpeedLabel.textContent = `${(el.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
                if (videoEl) updateVSpeedLabel();
                if (vSpeedDownBtn && !vSpeedDownBtn.dataset.bound) {
                    vSpeedDownBtn.addEventListener('click', () => {
                        const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                        if (!el) return;
                        adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateVSpeedLabel());
                    });
                    vSpeedDownBtn.dataset.bound = '1';
                }
                if (vSpeedUpBtn && !vSpeedUpBtn.dataset.bound) {
                    vSpeedUpBtn.addEventListener('click', () => {
                        const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                        if (!el) return;
                        adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateVSpeedLabel());
                    });
                    vSpeedUpBtn.dataset.bound = '1';
                }
                if (aEl && url) {
                    aEl.href = url;
                    if (isPdfAttachment(att)) {
                        aEl.target = '_blank';
                        aEl.rel = 'noopener noreferrer';
                        aEl.removeAttribute('download');
                        // Fallback para navegadores que no renderizan blob: PDF correctamente
                        if (!aEl.dataset.pdfHandler) {
                            aEl.addEventListener('click', (e) => { try { e.preventDefault(); openPdfBlobInNewTab(blob); } catch (_) {} });
                            aEl.dataset.pdfHandler = '1';
                        }
                    } else {
                        aEl.download = preferredFileName(att);
                        aEl.removeAttribute('target');
                    }
                }
                const dlEl = container.querySelector(`a.attachment-dl[data-att-id="${att.id}"]`);
                if (dlEl && url) {
                    dlEl.href = url;
                    dlEl.setAttribute('download', preferredFileName(att));
                }
            }
        })();
    } catch (_) {}
}
function renderReusePanel(targetTaskId) {
    const panel = document.getElementById('popup-attach-reuse-panel');
    if (!panel) return;
    const items = collectReuseCatalog();
    if (!items.length) { panel.innerHTML = `<div>${(window.i18n&&i18n.t)?i18n.t('no_items'):'No hay elementos'}</div>`; return; }

    // Controles de filtrado
    panel.innerHTML = '';
    const controls = document.createElement('div');
    controls.className = 'reuse-controls';
    const filterInput = document.createElement('input');
    filterInput.type = 'text';
    filterInput.placeholder = (window.i18n&&i18n.t)? (i18n.t('filter_attachments') || 'Filtrar adjuntos…') : 'Filtrar adjuntos…';
    filterInput.setAttribute('aria-label', (window.i18n&&i18n.t)? (i18n.t('filter_attachments_label') || 'Filtrar adjuntos') : 'Filtrar adjuntos');
    controls.appendChild(filterInput);
    panel.appendChild(controls);

    const grid = document.createElement('div');
    grid.className = 'reuse-grid';
    panel.appendChild(grid);

    const renderList = (query) => {
        const q = (query || '').toLowerCase();
        grid.innerHTML = '';
        items
          .filter(it => {
              const n = (it.att && it.att.name) ? it.att.name.toLowerCase() : '';
              return !q || n.includes(q);
          })
          .forEach(item => {
            const att = item.att;
            const div = document.createElement('div');
            div.className = 'reuse-item';
            const name = document.createElement('div');
            name.className = 'name';
            name.textContent = att.name || '(archivo)';
            const thumb = document.createElement(att.isImage ? 'img' : 'div');
            if (att.isImage) { thumb.className = 'thumb'; thumb.alt = att.name || ''; }
            else { thumb.textContent = '📎'; thumb.style.fontSize = '40px'; thumb.style.textAlign = 'center'; }
            const actions = document.createElement('div'); actions.className = 'actions';
            const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = (window.i18n&&i18n.t)?i18n.t('add_this'):'Añadir';
            btn.onclick = () => {
                if (targetTaskId) addExistingAttachment(targetTaskId, item); else addExistingToPending(item);
            };
            actions.appendChild(btn);
            div.appendChild(thumb); div.appendChild(name); div.appendChild(actions);
            grid.appendChild(div);
            // hidratar miniatura si es imagen
            if (att.isImage) {
                ensureAttachmentBlob(att).then(blob => { if (blob) thumb.src = URL.createObjectURL(blob); });
            }
          });
    };

    // Render inicial y manejador de filtro
    renderList('');
    filterInput.addEventListener('input', (e) => renderList(e.target.value || ''));
}

async function renderPopupAttachments(task) {
    const container = document.getElementById('popup-existing-attachments');
    if (!container) return;
    const form = document.getElementById('popup-task-form');
    const showMediaControls = !(form && form.dataset.mode === 'edit');
    container.classList.add('popup-attachments');
    const list = Array.isArray(task.attachments) ? task.attachments : [];
    if (!list.length) { container.innerHTML = ''; return; }
    // Construir markup
    container.innerHTML = list.map(att => {
        const label = att.name || 'archivo';
        const img = att.isImage ? `<img class=\"attachment-img\" data-att-id=\"${att.id}\" alt=\"${label}\">` : '';
        const audioControls = showMediaControls ? `<div class=\"media-controls\"><button type=\"button\" class=\"audio-restart\" data-att-id=\"${att.id}\" title=\"Inicio\">⏮</button><button type=\"button\" class=\"audio-loop-toggle\" data-att-id=\"${att.id}\" aria-pressed=\"false\" title=\"Bucle\">🔁</button><span class=\"audio-speed\"><button type=\"button\" class=\"audio-speed-down\" data-att-id=\"${att.id}\" title=\"Más lento\">−</button><span class=\"audio-speed-label\" data-att-id=\"${att.id}\">1x</span><button type=\"button\" class=\"audio-speed-up\" data-att-id=\"${att.id}\" title=\"Más rápido\">+</button></span><span class=\"ab-controls\"><button type=\"button\" class=\"audio-ab-a\" data-att-id=\"${att.id}\" title=\"Marcar punto A\">A</button><button type=\"button\" class=\"audio-ab-b\" data-att-id=\"${att.id}\" title=\"Marcar punto B\">B</button><button type=\"button\" class=\"audio-ab-toggle\" data-att-id=\"${att.id}\" aria-pressed=\"false\" title=\"Bucle A–B\">A–B</button><button type=\"button\" class=\"audio-ab-clear\" data-att-id=\"${att.id}\" title=\"Limpiar A–B\">✖</button></span></div>` : '';
        const audio = (!att.isImage && isAudioAttachment(att)) ? `<div class=\"attachment-audio-wrap\"><audio class=\"attachment-audio\" controls data-att-id=\"${att.id}\"></audio>${audioControls}</div>` : '';
        const videoControls = showMediaControls ? `<div class=\"media-controls\"><button type=\"button\" class=\"video-restart\" data-att-id=\"${att.id}\" title=\"Inicio\">⏮</button><button type=\"button\" class=\"video-loop-toggle\" data-att-id=\"${att.id}\" aria-pressed=\"false\" title=\"Bucle\">🔁</button><span class=\"video-speed\"><button type=\"button\" class=\"video-speed-down\" data-att-id=\"${att.id}\" title=\"Más lento\">−</button><span class=\"video-speed-label\" data-att-id=\"${att.id}\">1x</span><button type=\"button\" class=\"video-speed-up\" data-att-id=\"${att.id}\" title=\"Más rápido\">+</button></span><span class=\"ab-controls\"><button type=\"button\" class=\"video-ab-a\" data-att-id=\"${att.id}\" title=\"Marcar punto A\">A</button><button type=\"button\" class=\"video-ab-b\" data-att-id=\"${att.id}\" title=\"Marcar punto B\">B</button><button type=\"button\" class=\"video-ab-toggle\" data-att-id=\"${att.id}\" aria-pressed=\"false\" title=\"Bucle A–B\">A–B</button><button type=\"button\" class=\"video-ab-clear\" data-att-id=\"${att.id}\" title=\"Limpiar A–B\">✖</button></span></div>` : '';
        const video = (!att.isImage && !isAudioAttachment(att) && isVideoAttachment(att)) ? `<div class=\"attachment-video-wrap\"><video class=\"attachment-video\" controls data-att-id=\"${att.id}\"></video>${videoControls}</div>` : '';
        const link = (!att.isImage && !isAudioAttachment(att) && !isVideoAttachment(att)) ? `<a class=\"attachment-file\" data-att-id=\"${att.id}\" href=\"#\" title=\"${label}\">📎 ${label}</a>` : '';
        const dl = (!att.isImage && !isAudioAttachment(att) && !isVideoAttachment(att)) ? `<a class=\"attachment-dl\" data-att-id=\"${att.id}\" href=\"#\" title=\"Descargar\">⬇️</a>` : '';
        const del = `<button type=\"button\" class=\"attachment-remove\" data-att-id=\"${att.id}\">${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}</button>`;
        return `<div class=\"attachment-row\" data-att-id=\"${att.id}\">${img}${audio}${video}${link}${dl}${del}</div>`;
    }).join('');
    // Hidratar blobs/enlaces
    for (const att of list) {
        const imgEl = container.querySelector(`img.attachment-img[data-att-id="${att.id}"]`);
        const aEl = container.querySelector(`a.attachment-file[data-att-id="${att.id}"]`);
        const audioEl = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
        const videoEl = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
        if (audioEl) bindPitchPersistence(audioEl);
        if (videoEl) bindPitchPersistence(videoEl);
        let url = null;
        const blob = await ensureAttachmentBlob(att);
        if (imgEl && blob) imgEl.src = URL.createObjectURL(blob);
        if (audioEl && blob && !audioEl.src) audioEl.src = URL.createObjectURL(blob);
        if (videoEl && blob && !videoEl.src) {
            videoEl.src = URL.createObjectURL(blob);
            try { videoEl.controls = true; } catch (_) {}
        }
        if (!url && blob) url = URL.createObjectURL(blob);
        if (showMediaControls) {
            const restartBtn = container.querySelector(`button.audio-restart[data-att-id="${att.id}"]`);
            if (restartBtn && !restartBtn.dataset.bound) {
                restartBtn.addEventListener('click', () => {
                    const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (el) {
                        const wasPlaying = !el.paused;
                        el.currentTime = 0;
                        if (wasPlaying) { try { el.play(); } catch (_) {} }
                    }
                });
                restartBtn.dataset.bound = '1';
            }
            // Toggle bucle audio
            const aLoopBtn = container.querySelector(`button.audio-loop-toggle[data-att-id="${att.id}"]`);
            if (aLoopBtn && audioEl && !aLoopBtn.dataset.bound) {
                const apply = () => {
                    const on = getMediaLoopPref(att.id);
                    audioEl.loop = !!on;
                    if (on) audioEl.setAttribute('loop', ''); else audioEl.removeAttribute('loop');
                    aLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                    aLoopBtn.classList.toggle('active', !!on);
                };
                if (!audioEl.dataset.loopBound) {
                    audioEl.addEventListener('ended', () => {
                        if (getMediaLoopPref(att.id)) {
                            try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    audioEl.dataset.loopBound = '1';
                }
                apply();
                aLoopBtn.addEventListener('click', () => {
                    const next = !getMediaLoopPref(att.id);
                    setMediaLoopPref(att.id, next);
                    apply();
                    if (next && (audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration - 0.05))) {
                        try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                    }
                });
                aLoopBtn.dataset.bound = '1';
            }
            const vRestartBtn = container.querySelector(`button.video-restart[data-att-id="${att.id}"]`);
            if (vRestartBtn && !vRestartBtn.dataset.bound) {
                vRestartBtn.addEventListener('click', () => {
                    const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (el) {
                        const wasPlaying = !el.paused;
                        el.currentTime = 0;
                        if (wasPlaying) { try { el.play(); } catch (_) {} }
                    }
                });
                vRestartBtn.dataset.bound = '1';
            }
            // Toggle bucle vídeo
            const vLoopBtn = container.querySelector(`button.video-loop-toggle[data-att-id="${att.id}"]`);
            if (vLoopBtn && videoEl && !vLoopBtn.dataset.bound) {
                const apply = () => {
                    const on = getMediaLoopPref(att.id);
                    videoEl.loop = !!on;
                    if (on) videoEl.setAttribute('loop', ''); else videoEl.removeAttribute('loop');
                    vLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                    vLoopBtn.classList.toggle('active', !!on);
                };
                if (!videoEl.dataset.loopBound) {
                    videoEl.addEventListener('ended', () => {
                        if (getMediaLoopPref(att.id)) {
                            try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    videoEl.dataset.loopBound = '1';
                }
                apply();
                vLoopBtn.addEventListener('click', () => {
                    const next = !getMediaLoopPref(att.id);
                    setMediaLoopPref(att.id, next);
                    apply();
                    if (next && (videoEl.ended || (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05))) {
                        try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                    }
                });
                vLoopBtn.dataset.bound = '1';
            }
            // Controles de velocidad (− / +)
            const speedDownBtn = container.querySelector(`button.audio-speed-down[data-att-id="${att.id}"]`);
            const speedUpBtn = container.querySelector(`button.audio-speed-up[data-att-id="${att.id}"]`);
            const speedLabel = container.querySelector(`span.audio-speed-label[data-att-id="${att.id}"]`);
            const updateSpeedLabel = () => { try { if (audioEl && speedLabel) speedLabel.textContent = `${(audioEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
            if (audioEl) updateSpeedLabel();
            if (speedDownBtn && !speedDownBtn.dataset.bound) {
                speedDownBtn.addEventListener('click', () => {
                    const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateSpeedLabel());
                });
                speedDownBtn.dataset.bound = '1';
            }
            if (speedUpBtn && !speedUpBtn.dataset.bound) {
                speedUpBtn.addEventListener('click', () => {
                    const el = container.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateSpeedLabel());
                });
                speedUpBtn.dataset.bound = '1';
            }
            // Controles de velocidad para vídeo
            const vSpeedDownBtn = container.querySelector(`button.video-speed-down[data-att-id="${att.id}"]`);
            const vSpeedUpBtn = container.querySelector(`button.video-speed-up[data-att-id="${att.id}"]`);
            const vSpeedLabel = container.querySelector(`span.video-speed-label[data-att-id="${att.id}"]`);
            const updateVSpeedLabel = () => { try { if (videoEl && vSpeedLabel) vSpeedLabel.textContent = `${(videoEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
            if (videoEl) updateVSpeedLabel();
            if (vSpeedDownBtn && !vSpeedDownBtn.dataset.bound) {
                vSpeedDownBtn.addEventListener('click', () => {
                    const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateVSpeedLabel());
                });
                vSpeedDownBtn.dataset.bound = '1';
            }
            if (vSpeedUpBtn && !vSpeedUpBtn.dataset.bound) {
                vSpeedUpBtn.addEventListener('click', () => {
                    const el = container.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateVSpeedLabel());
                });
                vSpeedUpBtn.dataset.bound = '1';
            }
        }
        if (aEl && url) {
            aEl.href = url;
            if (isPdfAttachment(att)) {
                aEl.target = '_blank';
                aEl.rel = 'noopener noreferrer';
                aEl.removeAttribute('download');
            } else {
                aEl.download = preferredFileName(att);
                aEl.removeAttribute('target');
            }
        }
        const dlEl = container.querySelector(`a.attachment-dl[data-att-id="${att.id}"]`);
        if (dlEl && url) {
            dlEl.href = url;
            dlEl.setAttribute('download', preferredFileName(att));
        }
    }
    // Delegar eliminación
    container.querySelectorAll('.attachment-remove').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const attId = btn.getAttribute('data-att-id');
            const title = (window.i18n&&i18n.t)?i18n.t('confirm_delete_attachment'):'¿Eliminar este adjunto?';
            const ok = await showConfirm(title, (window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar', (window.i18n&&i18n.t)?i18n.t('cancel'):'Cancelar');
            if (!ok) return;
            await removeAttachment(task.id, attId);
            renderPopupAttachments(task); // refrescar lista tras borrar
        });
        btn.dataset.bound = '1';
    });
}

function normalizeSearchValue(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function taskMatchesSearch(task, searchNorm) {
    if (!searchNorm) return true;
    const parts = [];
    if (task && task.task) parts.push(task.task);
    if (Array.isArray(task.tags) && task.tags.length) parts.push(task.tags.join(' '));
    if (Array.isArray(task.attachments) && task.attachments.length) {
        parts.push(task.attachments.map(att => att && att.name ? att.name : '').join(' '));
    }
    const haystack = normalizeSearchValue(parts.join(' '));
    return haystack.includes(searchNorm);
}

// --- RENDERIZADO EN EL DOM (SIN BOTÓN DE ELIMINAR) ---
function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    const filterTagSelect = document.getElementById('filter-tag');
    const filterSearchInput = document.getElementById('filter-search');
    const filterColumnSelect = document.getElementById('filter-column');
    const filterColumnGroup = document.getElementById('filter-column-group');
    // Permitir cargar app.js en vistas sin tablero
    if (!taskContainer) {
        try {
            if (typeof window.__rerenderResources === 'function') window.__rerenderResources();
        } catch (_) {}
        return;
    }
    const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
    // Mantener filtro activo: tomar el valor actual o el guardado en localStorage
    let filterTag = '';
    if (filterTagSelect) {
        filterTag = filterTagSelect.value || localStorage.getItem(LS.selectedFilterTag) || '';
    } else {
        filterTag = localStorage.getItem(LS.selectedFilterTag) || '';
    }
    let searchQuery = '';
    if (filterSearchInput) {
        searchQuery = filterSearchInput.value || localStorage.getItem(LS.searchQuery) || '';
        if (!filterSearchInput.value && searchQuery) filterSearchInput.value = searchQuery;
    } else {
        searchQuery = localStorage.getItem(LS.searchQuery) || '';
    }
    const searchNorm = normalizeSearchValue(searchQuery);
    // Columns: ahora puede ser múltiple. Si LS guarda string antiguo, lo convertimos a array.
    let filterColumns = [];
    if (filterColumnSelect) {
        filterColumns = Array.from(filterColumnSelect.selectedOptions || [])
            .map(o => o.value)
            .filter(v => v);
        if (!filterColumns.length) {
            // Fallback a LS si el select aún no tiene selección inicial
            const raw = localStorage.getItem(LS.visibleColumn) || '';
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) filterColumns = arr.filter(v => v);
                else if (typeof raw === 'string' && raw) filterColumns = [raw];
            } catch (_) {
                if (raw) filterColumns = [raw];
            }
        }
    } else if (filterColumnGroup) {
        const checked = Array.from(filterColumnGroup.querySelectorAll('input[type="checkbox"]:checked'))
            .map(i => i.dataset.col)
            .filter(Boolean);
        if (checked.length) {
            filterColumns = checked;
        } else {
            const raw = localStorage.getItem(LS.visibleColumn) || '';
            try {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) filterColumns = arr.filter(v => v);
                else if (typeof raw === 'string' && raw) filterColumns = [raw];
            } catch (_) {
                if (raw) filterColumns = [raw];
            }
        }
    } else {
        const raw = localStorage.getItem(LS.visibleColumn) || '';
        try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) filterColumns = arr.filter(v => v);
            else if (typeof raw === 'string' && raw) filterColumns = [raw];
        } catch (_) {
            if (raw) filterColumns = [raw];
        }
    }
    taskContainer.innerHTML = '';
    // Ajustar layout según número de columnas seleccionadas
    taskContainer.classList.remove('single-column', 'two-columns', 'three-columns');
    if (filterColumns.length === 1) {
        taskContainer.classList.add('single-column');
    } else if (filterColumns.length === 2) {
        taskContainer.classList.add('two-columns');
    } else if (filterColumns.length === 3) {
        taskContainer.classList.add('three-columns');
    }

    const catNames = getCategoryNames();
    // Generador de opciones A..Z para selects
    const buildOrderOptions = (selected) => {
        const opts = [''].concat(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)));
        const selUp = (selected || '').toUpperCase();
        return opts.map(code => {
            const label = code || '—';
            const sel = (selUp === code) ? ' selected' : '';
            const val = code;
            return `<option value="${val}"${sel}>${label}</option>`;
        }).join('');
    };

    // Comparador: orderCode (A..Z) luego sortModifiedAt/lastModified desc
    const cmpTasks = (a, b) => {
        const A = (a.orderCode || '').toUpperCase();
        const B = (b.orderCode || '').toUpperCase();
        const aHas = A.length > 0; const bHas = B.length > 0;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
            if (A < B) return -1;
            if (A > B) return 1;
        }
        const ta = new Date(a.sortModifiedAt || a.lastModified || 0).getTime();
        const tb = new Date(b.sortModifiedAt || b.lastModified || 0).getTime();
        return tb - ta;
    };

    for (const [category, tasks] of Object.entries(categories)) {
        if (category === 'archivadas') continue;
        if (filterColumns.length && !filterColumns.includes(category)) continue;
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category';

        // Filtrar tareas por etiqueta seleccionada
        let filteredTasks = filterTag
            ? tasks.filter(task => task.tags && task.tags.includes(filterTag))
            : tasks;
        if (searchNorm) {
            filteredTasks = filteredTasks.filter(task => taskMatchesSearch(task, searchNorm));
        }
        filteredTasks = filteredTasks.slice().sort(cmpTasks);

        let tasksHTML = filteredTasks.map(task => {
            const doneCount = Array.isArray(task.doneHistory) ? task.doneHistory.length : 0;
            const lastDone = doneCount ? new Date(task.doneHistory[doneCount - 1]).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
            const doneMeta = doneCount ? `<small class="done-meta">✔️ ${doneCount} ${(window.i18n&&i18n.t)?i18n.t('times'):'veces'}${lastDone ? ` • ${(window.i18n&&i18n.t)?i18n.t('last'):'Última'}: ${lastDone}` : ''}</small>` : '';
            const tagsHtml = (task.tags && task.tags.length)
                ? `<small class="tags">${task.tags.map(t => '<span class="tag-chip in-task">#'+t+'</span>').join(' ')}</small>`
                : '';
            const reminderHtml = task.reminderAt
                ? `<small class="reminder-meta">⏰ ${new Date(task.reminderAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</small>`
                : '';
            const attachmentsHtml = (task.attachments && task.attachments.length)
                ? `<div class="attachments">${task.attachments.map(att => {
                    if (att.isImage) {
                        return '<img class="attachment-img" alt="'+(att.name||'')+'" data-att-id="'+att.id+'" />';
                    } else if (isAudioAttachment(att)) {
                        return '<div class="attachment-audio-wrap"><audio class="attachment-audio" controls data-att-id="'+att.id+'"></audio><div class="media-controls"><button type="button" class="audio-restart" data-att-id="'+att.id+'" title="Inicio">⏮</button><button type="button" class="audio-loop-toggle" data-att-id="'+att.id+'" aria-pressed="false" title="Bucle">🔁</button><span class="audio-speed"><button type="button" class="audio-speed-down" data-att-id="'+att.id+'" title="Más lento">−</button><span class="audio-speed-label" data-att-id="'+att.id+'">1x</span><button type="button" class="audio-speed-up" data-att-id="'+att.id+'" title="Más rápido">+</button></span><span class="ab-controls"><button type="button" class="audio-ab-a" data-att-id="'+att.id+'" title="Marcar punto A">A</button><button type="button" class="audio-ab-b" data-att-id="'+att.id+'" title="Marcar punto B">B</button><button type="button" class="audio-ab-toggle" data-att-id="'+att.id+'" aria-pressed="false" title="Bucle A–B">A–B</button><button type="button" class="audio-ab-clear" data-att-id="'+att.id+'" title="Limpiar A–B">✖</button></span></div></div>';
                    } else if (isVideoAttachment(att)) {
                        return '<div class="attachment-video-wrap"><video class="attachment-video" controls data-att-id="'+att.id+'"></video><div class="media-controls"><button type="button" class="video-restart" data-att-id="'+att.id+'" title="Inicio">⏮</button><button type="button" class="video-loop-toggle" data-att-id="'+att.id+'" aria-pressed="false" title="Bucle">🔁</button><span class="video-speed"><button type="button" class="video-speed-down" data-att-id="'+att.id+'" title="Más lento">−</button><span class="video-speed-label" data-att-id="'+att.id+'">1x</span><button type="button" class="video-speed-up" data-att-id="'+att.id+'" title="Más rápido">+</button></span><span class="ab-controls"><button type="button" class="video-ab-a" data-att-id="'+att.id+'" title="Marcar punto A">A</button><button type="button" class="video-ab-b" data-att-id="'+att.id+'" title="Marcar punto B">B</button><button type="button" class="video-ab-toggle" data-att-id="'+att.id+'" aria-pressed="false" title="Bucle A–B">A–B</button><button type="button" class="video-ab-clear" data-att-id="'+att.id+'" title="Limpiar A–B">✖</button></span></div></div>';
                    } else {
                        const extra = isPdfAttachment(att) ? ' <a class="attachment-dl" href="#" data-att-id="'+att.id+'" title="Descargar">⬇️</a>' : '';
                        return '<span class="attachment-wrap"><a class="attachment-file" href="#" data-att-id="'+att.id+'" title="'+(att.name||'')+'">📎 '+(att.name||'')+'</a>'+extra+'</span>';
                    }
                }).join('')}</div>`
                : '';

            const moveOptions = Object.keys(catNames)
                .filter(c => c !== category)
                .map(c => '<option value="'+c+'">'+catNames[c]+'</option>')
                .join('');

            return `
            <div class="task ${task.completed ? 'completed' : ''}" draggable="true" data-id="${task.id}">
                <div class="task-main">
                    <input type="checkbox" aria-label="${(window.i18n&&i18n.t)?i18n.t('archive'):'Archivar'}" title="${(window.i18n&&i18n.t)?i18n.t('archive'):'Archivar'}" onchange="toggleTaskArchived('${task.id}')">
                    <span>
                        ${convertirEnlaces(task.task)}
                        ${tagsHtml}
                        ${reminderHtml}
                        ${doneMeta}
                        ${attachmentsHtml}
                    </span>
                </div>
                <div class="task-actions">
                    <select class="order-select" aria-label="Orden (A–Z)" title="Orden (A–Z)" onchange="setTaskOrder('${task.id}', this.value)">
                        ${buildOrderOptions(task.orderCode)}
                    </select>
                    <select aria-label="${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'}" onchange="moveTask('${task.id}', this.value)">
                        <option value="" disabled selected>${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'}</option>
                        ${moveOptions}
                    </select>
                    <button class="done-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('mark_done'):'Marcar realizado'}" title="${(window.i18n&&i18n.t)?i18n.t('mark_done'):'Marcar realizado'}" onclick="markTaskDone('${task.id}')">✔️ <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('done'):'Hecho'}</span></button>
                    <button class="edit-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'}" onclick="openEditTask('${task.id}')">✏️ <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'}</span></button>
                    ${task.tags && task.tags.length > 1 ? `<button class="split-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('split_by_tags'):'Dividir por etiquetas'}" title="${(window.i18n&&i18n.t)?i18n.t('split_by_tags'):'Dividir por etiquetas'}" onclick="splitTaskByTags('${task.id}')">🔀 <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('split'):'Dividir'}</span></button>` : ''}
                    <button class="delete-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}" onclick="removeTask('${task.id}')">🗑️ <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}</span></button>
                </div>
            </div>`;
        }).join('');

        categoryDiv.innerHTML = `<h3>${catNames[category]}</h3><div class="task-list">${tasksHTML}</div>`;
        // Añadir manejadores de DnD a cada categoría renderizada
        categoryDiv.addEventListener('dragover', function(e) {
            e.preventDefault();
            categoryDiv.classList.add('drag-over');
        });
        categoryDiv.addEventListener('dragleave', function() {
            categoryDiv.classList.remove('drag-over');
        });
        categoryDiv.addEventListener('drop', function(e) {
            e.preventDefault();
            categoryDiv.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newCategory = Object.keys(catNames).find(
                key => categoryDiv.querySelector('h3').textContent === catNames[key]
            );
            if (taskId && newCategory) moveTask(taskId, newCategory);
        });
        taskContainer.appendChild(categoryDiv);
        hydrateAttachmentsForCategory(filteredTasks, categoryDiv);
    }

    // Columna virtual: Histórico (se muestra solo si está seleccionada explícitamente)
    const wantsHistorico = Array.isArray(filterColumns) && filterColumns.includes('historico');
    if (wantsHistorico) {
        const histDiv = document.createElement('div');
        histDiv.className = 'category';
        const histTitle = (window.i18n && i18n.t) ? i18n.t('history') : 'Histórico';
        histDiv.innerHTML = `<h3>${histTitle}</h3><div class="task-list"></div>`;
        const listEl = histDiv.querySelector('.task-list');
        const groups = collectHistoryGroupsLimited(filterTag, 4); // tablero: mostrar solo 4 días recientes
        if (!groups.length) {
            const empty = document.createElement('div');
            empty.className = 'task';
            empty.innerHTML = `<span>${(window.i18n&&i18n.t)?(i18n.t('no_history')||'No hay histórico disponible.'):'No hay histórico disponible.'}</span>`;
            listEl.appendChild(empty);
        } else {
            groups.forEach(g => {
                const h = document.createElement('h4');
                h.textContent = g.dateHuman;
                h.style.margin = '8px 0 6px';
                listEl.appendChild(h);
                g.items.forEach(it => {
                    const div = document.createElement('div');
                    div.className = 'task';
                    const tags = (it.task.tags||[]);
                    div.innerHTML = `
                        <span>${convertirEnlaces(it.task.task)}
                          ${tags.length ? `<small class=\"tags\">${tags.map(t => '<span class=\"tag-chip in-task\">#'+t+'</span>').join(' ')}</small>` : ''}
                          <small class=\"done-meta\">✔️ ${it.count} ${(window.i18n&&i18n.t)?i18n.t('times'):'veces'} • ${it.lastHuman}</small>
                        </span>
                    `;
                    listEl.appendChild(div);
                });
            });
            const more = document.createElement('div');
            more.style.marginTop = '8px';
            const histLabel = (window.i18n && i18n.t) ? i18n.t('history') : 'Histórico';
            more.innerHTML = `<a href="historico.html" class="attachment-file" style="display:inline-block">${histLabel} →</a>`;
            listEl.appendChild(more);
        }
        taskContainer.appendChild(histDiv);
    }

    // Actualiza filtros (conservando selección) y autocompletado en cada render
    updateTagFilterDropdown(filterTag);
    updateColumnFilterDropdown(filterColumns, catNames);
    refreshCategorySelectOptions(catNames);
    updateTagDatalist();
}

// Handler global para el arrastre
window.onDragStart = function(event, taskId) {
    event.dataTransfer.setData('text/plain', taskId);
};

async function ensureAttachmentBlob(att) {
    let blob = await getAttachmentBlob(att.id);
    // Corregir tipo para PDFs si el blob existe pero no tiene application/pdf
    if (blob && isPdfAttachment(att) && blob.type !== 'application/pdf') {
        try {
            blob = new Blob([blob], { type: 'application/pdf' });
            await putAttachmentBlob(att.id, blob);
        } catch (_) {}
    }
    if (!blob && accessToken && att.dropboxPath) {
        try {
            const res = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: att.dropboxPath })
                }
            });
            if (res.ok) {
                const raw = await res.blob();
                const desiredType = isPdfAttachment(att) ? 'application/pdf' : (att.type || raw.type || 'application/octet-stream');
                blob = new Blob([raw], { type: desiredType });
                await putAttachmentBlob(att.id, blob);
            }
        } catch (e) { console.warn('download attachment failed', e); }
    }
    if (!blob && isNextcloudConfigured() && att.nextcloudPath) {
        try {
            const raw = await downloadNextcloudAttachment(att.nextcloudPath);
            if (raw) {
                const desiredType = isPdfAttachment(att) ? 'application/pdf' : (att.type || raw.type || 'application/octet-stream');
                blob = new Blob([raw], { type: desiredType });
                await putAttachmentBlob(att.id, blob);
            }
        } catch (e) { console.warn('download nextcloud attachment failed', e); }
    }
    return blob;
}

async function getDropboxTemporaryLink(path) {
    try {
        const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        if (res.ok) {
            const data = await res.json();
            return data && data.link;
        }
    } catch (e) { console.warn('temp link error', e); }
    return null;
}

function hydrateAttachmentsForCategory(tasks, rootEl) {
    const map = new Map(tasks.map(t => [t.id, t]));
    rootEl.querySelectorAll('[data-id]').forEach(async taskEl => {
        const id = taskEl.getAttribute('data-id');
        const t = map.get(id);
        if (!t || !Array.isArray(t.attachments)) return;
        for (const att of t.attachments) {
            const imgEl = taskEl.querySelector(`img.attachment-img[data-att-id="${att.id}"]`);
            const aEl = taskEl.querySelector(`a.attachment-file[data-att-id="${att.id}"]`);
            const audioEl = taskEl.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
            const videoEl = taskEl.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
            if (audioEl) bindPitchPersistence(audioEl);
            if (videoEl) bindPitchPersistence(videoEl);
            const dlEl = taskEl.querySelector(`a.attachment-dl[data-att-id="${att.id}"]`);
            if (imgEl && !imgEl.src) {
                const blob = await ensureAttachmentBlob(att);
                if (blob) imgEl.src = URL.createObjectURL(blob);
                if (imgEl && !imgEl.dataset.lbBound) {
                    imgEl.addEventListener('click', () => openImageLightbox(imgEl.src, imgEl.alt));
                    imgEl.dataset.lbBound = '1';
                }
            }
            if (audioEl && !audioEl.src) {
                const blob = await ensureAttachmentBlob(att);
                if (blob) audioEl.src = URL.createObjectURL(blob);
            }
            if (videoEl && !videoEl.src) {
                const blob = await ensureAttachmentBlob(att);
                if (blob) {
                    videoEl.src = URL.createObjectURL(blob);
                    try { videoEl.controls = true; } catch (_) {}
                }
            }
            const restartBtn = taskEl.querySelector(`button.audio-restart[data-att-id="${att.id}"]`);
            if (restartBtn && !restartBtn.dataset.bound) {
                restartBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (el) {
                        const wasPlaying = !el.paused;
                        el.currentTime = 0;
                        if (wasPlaying) { try { el.play(); } catch (_) {} }
                    }
                });
                restartBtn.dataset.bound = '1';
            }
            // Toggle bucle audio en tarjeta
            const aLoopBtn = taskEl.querySelector(`button.audio-loop-toggle[data-att-id="${att.id}"]`);
            if (aLoopBtn && audioEl && !aLoopBtn.dataset.bound) {
                const apply = () => {
                    const on = getMediaLoopPref(att.id);
                    audioEl.loop = !!on;
                    if (on) audioEl.setAttribute('loop', ''); else audioEl.removeAttribute('loop');
                    aLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                    aLoopBtn.classList.toggle('active', !!on);
                };
                if (!audioEl.dataset.loopBound) {
                    audioEl.addEventListener('ended', () => {
                        if (getMediaLoopPref(att.id)) {
                            try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    audioEl.dataset.loopBound = '1';
                }
                apply();
                aLoopBtn.addEventListener('click', () => {
                    const next = !getMediaLoopPref(att.id);
                    setMediaLoopPref(att.id, next);
                    apply();
                    if (next && (audioEl.ended || (audioEl.duration && audioEl.currentTime >= audioEl.duration - 0.05))) {
                        try { audioEl.currentTime = 0; audioEl.play().catch(()=>{}); } catch(_) {}
                    }
                });
                aLoopBtn.dataset.bound = '1';
            }
            const vRestartBtn = taskEl.querySelector(`button.video-restart[data-att-id="${att.id}"]`);
            if (vRestartBtn && !vRestartBtn.dataset.bound) {
                vRestartBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (el) {
                        const wasPlaying = !el.paused;
                        el.currentTime = 0;
                        if (wasPlaying) { try { el.play(); } catch (_) {} }
                    }
                });
                vRestartBtn.dataset.bound = '1';
            }
            // Toggle bucle vídeo en tarjeta
            const vLoopBtn = taskEl.querySelector(`button.video-loop-toggle[data-att-id="${att.id}"]`);
            if (vLoopBtn && videoEl && !vLoopBtn.dataset.bound) {
                const apply = () => {
                    const on = getMediaLoopPref(att.id);
                    videoEl.loop = !!on;
                    if (on) videoEl.setAttribute('loop', ''); else videoEl.removeAttribute('loop');
                    vLoopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
                    vLoopBtn.classList.toggle('active', !!on);
                };
                if (!videoEl.dataset.loopBound) {
                    videoEl.addEventListener('ended', () => {
                        if (getMediaLoopPref(att.id)) {
                            try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                        }
                    });
                    videoEl.dataset.loopBound = '1';
                }
                apply();
                vLoopBtn.addEventListener('click', () => {
                    const next = !getMediaLoopPref(att.id);
                    setMediaLoopPref(att.id, next);
                    apply();
                    if (next && (videoEl.ended || (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.05))) {
                        try { videoEl.currentTime = 0; videoEl.play().catch(()=>{}); } catch(_) {}
                    }
                });
                vLoopBtn.dataset.bound = '1';
            }
            // Controles de velocidad en tarjetas
            const speedDownBtn = taskEl.querySelector(`button.audio-speed-down[data-att-id="${att.id}"]`);
            const speedUpBtn = taskEl.querySelector(`button.audio-speed-up[data-att-id="${att.id}"]`);
            const speedLabel = taskEl.querySelector(`span.audio-speed-label[data-att-id="${att.id}"]`);
            const updateSpeedLabel = () => { try { if (audioEl && speedLabel) speedLabel.textContent = `${(audioEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
            if (audioEl) updateSpeedLabel();
            if (speedDownBtn && !speedDownBtn.dataset.bound) {
                speedDownBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateSpeedLabel());
                });
                speedDownBtn.dataset.bound = '1';
            }
            if (speedUpBtn && !speedUpBtn.dataset.bound) {
                speedUpBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`audio.attachment-audio[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateSpeedLabel());
                });
                speedUpBtn.dataset.bound = '1';
            }
            // Bucle A–B audio (en tarjeta)
            const aSetBtn = taskEl.querySelector(`button.audio-ab-a[data-att-id="${att.id}"]`);
            const bSetBtn = taskEl.querySelector(`button.audio-ab-b[data-att-id="${att.id}"]`);
            const abToggleBtn = taskEl.querySelector(`button.audio-ab-toggle[data-att-id="${att.id}"]`);
            const abClearBtn = taskEl.querySelector(`button.audio-ab-clear[data-att-id="${att.id}"]`);
            if (audioEl && abToggleBtn && !abToggleBtn.dataset.bound) {
                const fmt = (s)=>{
                    if (!Number.isFinite(s)) return '';
                    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=Math.floor(s%60);
                    const pad=n=>String(n).padStart(2,'0');
                    return h>0? `${h}:${pad(m)}:${pad(sc)}` : `${m}:${pad(sc)}`;
                };
                const applyAB = () => {
                    const st = getMediaABPref(att.id);
                    abToggleBtn.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
                    abToggleBtn.classList.toggle('active', !!st.enabled);
                    if (st.enabled) { audioEl.removeAttribute('loop'); audioEl.loop = false; }
                    if (aSetBtn) {
                        const marked = Number.isFinite(st.a);
                        aSetBtn.classList.toggle('marked', marked);
                        aSetBtn.title = marked ? `Punto A (${fmt(st.a)})` : 'Marcar punto A';
                    }
                    if (bSetBtn) {
                        const marked = Number.isFinite(st.b);
                        bSetBtn.classList.toggle('marked', marked);
                        bSetBtn.title = marked ? `Punto B (${fmt(st.b)})` : 'Marcar punto B';
                    }
                };
                if (!audioEl.dataset.abBound) {
                    audioEl.addEventListener('timeupdate', () => {
                        const st = getMediaABPref(att.id);
                        if (!st.enabled || !(Number.isFinite(st.a) && Number.isFinite(st.b)) || st.b <= st.a) return;
                        const t = audioEl.currentTime || 0;
                        if (t >= st.b - 0.03) {
                            try { audioEl.currentTime = st.a; if (!audioEl.paused) audioEl.play().catch(()=>{}); } catch(_) {}
                        } else if (t < st.a - 0.03) {
                            try { audioEl.currentTime = st.a; } catch(_) {}
                        }
                    });
                    audioEl.dataset.abBound = '1';
                }
                applyAB();
                abToggleBtn.addEventListener('click', () => {
                    const st = getMediaABPref(att.id);
                    let { a, b } = st;
                    if (!Number.isFinite(a)) a = 0;
                    if (!Number.isFinite(b)) b = Number.isFinite(audioEl.duration) ? audioEl.duration : (a + 1);
                    if (b <= a) b = a + 0.1;
                    setMediaABPref(att.id, { a, b, enabled: !st.enabled });
                    if (!st.enabled) {
                        setMediaLoopPref(att.id, false);
                        const btn = taskEl.querySelector(`button.audio-loop-toggle[data-att-id="${att.id}"]`);
                        if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('active'); }
                        audioEl.removeAttribute('loop'); audioEl.loop = false;
                    }
                    applyAB();
                });
                    if (aSetBtn) aSetBtn.addEventListener('click', () => {
                        const t = audioEl.currentTime || 0;
                    const st = getMediaABPref(att.id);
                    let b = st.b;
                    if (Number.isFinite(b) && b <= t) b = Number.isFinite(audioEl.duration) ? audioEl.duration : (t + 0.1);
                        setMediaABPref(att.id, { a: t, b });
                        applyAB();
                    });
                    if (bSetBtn) bSetBtn.addEventListener('click', () => {
                        const t = audioEl.currentTime || 0;
                    const st = getMediaABPref(att.id);
                    let a = st.a;
                    if (!Number.isFinite(a) || a >= t) a = Math.max(0, (t - 0.1));
                        setMediaABPref(att.id, { a, b: t });
                        applyAB();
                    });
                if (abClearBtn) abClearBtn.addEventListener('click', () => {
                    setMediaABPref(att.id, { a: null, b: null, enabled: false });
                    applyAB();
                });
                abToggleBtn.dataset.bound = '1';
            }
            // Controles de velocidad en tarjetas para vídeo
            const vSpeedDownBtn = taskEl.querySelector(`button.video-speed-down[data-att-id="${att.id}"]`);
            const vSpeedUpBtn = taskEl.querySelector(`button.video-speed-up[data-att-id="${att.id}"]`);
            const vSpeedLabel = taskEl.querySelector(`span.video-speed-label[data-att-id="${att.id}"]`);
            const updateVSpeedLabel = () => { try { if (videoEl && vSpeedLabel) vSpeedLabel.textContent = `${(videoEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`; } catch(_){} };
            if (videoEl) updateVSpeedLabel();
            if (vSpeedDownBtn && !vSpeedDownBtn.dataset.bound) {
                vSpeedDownBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, -MEDIA_RATE_STEP, () => updateVSpeedLabel());
                });
                vSpeedDownBtn.dataset.bound = '1';
            }
            if (vSpeedUpBtn && !vSpeedUpBtn.dataset.bound) {
                vSpeedUpBtn.addEventListener('click', () => {
                    const el = taskEl.querySelector(`video.attachment-video[data-att-id="${att.id}"]`);
                    if (!el) return;
                    adjustMediaPlaybackRate(el, MEDIA_RATE_STEP, () => updateVSpeedLabel());
                });
                vSpeedUpBtn.dataset.bound = '1';
            }
            // Bucle A–B vídeo (en tarjeta)
            const vaSetBtn = taskEl.querySelector(`button.video-ab-a[data-att-id="${att.id}"]`);
            const vbSetBtn = taskEl.querySelector(`button.video-ab-b[data-att-id="${att.id}"]`);
            const vabToggleBtn = taskEl.querySelector(`button.video-ab-toggle[data-att-id="${att.id}"]`);
            const vabClearBtn = taskEl.querySelector(`button.video-ab-clear[data-att-id="${att.id}"]`);
            if (videoEl && vabToggleBtn && !vabToggleBtn.dataset.bound) {
                const fmt = (s)=>{
                    if (!Number.isFinite(s)) return '';
                    const h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sc=Math.floor(s%60);
                    const pad=n=>String(n).padStart(2,'0');
                    return h>0? `${h}:${pad(m)}:${pad(sc)}` : `${m}:${pad(sc)}`;
                };
                const applyABv = () => {
                    const st = getMediaABPref(att.id);
                    vabToggleBtn.setAttribute('aria-pressed', st.enabled ? 'true' : 'false');
                    vabToggleBtn.classList.toggle('active', !!st.enabled);
                    if (st.enabled) { videoEl.removeAttribute('loop'); videoEl.loop = false; }
                    if (vaSetBtn) {
                        const marked = Number.isFinite(st.a);
                        vaSetBtn.classList.toggle('marked', marked);
                        vaSetBtn.title = marked ? `Punto A (${fmt(st.a)})` : 'Marcar punto A';
                    }
                    if (vbSetBtn) {
                        const marked = Number.isFinite(st.b);
                        vbSetBtn.classList.toggle('marked', marked);
                        vbSetBtn.title = marked ? `Punto B (${fmt(st.b)})` : 'Marcar punto B';
                    }
                };
                if (!videoEl.dataset.abBound) {
                    videoEl.addEventListener('timeupdate', () => {
                        const st = getMediaABPref(att.id);
                        if (!st.enabled || !(Number.isFinite(st.a) && Number.isFinite(st.b)) || st.b <= st.a) return;
                        const t = videoEl.currentTime || 0;
                        if (t >= st.b - 0.03) {
                            try { videoEl.currentTime = st.a; if (!videoEl.paused) videoEl.play().catch(()=>{}); } catch(_) {}
                        } else if (t < st.a - 0.03) {
                            try { videoEl.currentTime = st.a; } catch(_) {}
                        }
                    });
                    videoEl.dataset.abBound = '1';
                }
                applyABv();
                vabToggleBtn.addEventListener('click', () => {
                    const st = getMediaABPref(att.id);
                    let { a, b } = st;
                    if (!Number.isFinite(a)) a = 0;
                    if (!Number.isFinite(b)) b = Number.isFinite(videoEl.duration) ? videoEl.duration : (a + 1);
                    if (b <= a) b = a + 0.1;
                    setMediaABPref(att.id, { a, b, enabled: !st.enabled });
                    if (!st.enabled) {
                        setMediaLoopPref(att.id, false);
                        const btn = taskEl.querySelector(`button.video-loop-toggle[data-att-id="${att.id}"]`);
                        if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.classList.remove('active'); }
                        videoEl.removeAttribute('loop'); videoEl.loop = false;
                    }
                    applyABv();
                });
                    if (vaSetBtn) vaSetBtn.addEventListener('click', () => {
                        const t = videoEl.currentTime || 0;
                    const st = getMediaABPref(att.id);
                    let b = st.b;
                    if (Number.isFinite(b) && b <= t) b = Number.isFinite(videoEl.duration) ? videoEl.duration : (t + 0.1);
                        setMediaABPref(att.id, { a: t, b });
                        applyABv();
                    });
                    if (vbSetBtn) vbSetBtn.addEventListener('click', () => {
                        const t = videoEl.currentTime || 0;
                    const st = getMediaABPref(att.id);
                    let a = st.a;
                    if (!Number.isFinite(a) || a >= t) a = Math.max(0, (t - 0.1));
                        setMediaABPref(att.id, { a, b: t });
                        applyABv();
                    });
                if (vabClearBtn) vabClearBtn.addEventListener('click', () => {
                    setMediaABPref(att.id, { a: null, b: null, enabled: false });
                    applyABv();
                });
                vabToggleBtn.dataset.bound = '1';
            }
            if (aEl && aEl.getAttribute('href') === '#') {
                const blob = await ensureAttachmentBlob(att);
                if (blob) aEl.href = URL.createObjectURL(blob);
                if (isPdfAttachment(att)) {
                    aEl.target = '_blank';
                    aEl.rel = 'noopener noreferrer';
                    aEl.removeAttribute('download');
                    // Fallback para navegadores que no renderizan blob: PDF correctamente
                    if (blob && !aEl.dataset.pdfHandler) {
                        aEl.addEventListener('click', (e) => { try { e.preventDefault(); openPdfBlobInNewTab(blob); } catch (_) {} });
                        aEl.dataset.pdfHandler = '1';
                    }
                } else {
                    aEl.download = preferredFileName(att);
                    aEl.removeAttribute('target');
                }
            }
            if (dlEl && dlEl.getAttribute('href') === '#') {
                const blob = await ensureAttachmentBlob(att);
                if (blob) dlEl.href = URL.createObjectURL(blob);
                dlEl.setAttribute('download', preferredFileName(att));
            }
            // eliminación de adjuntos solo desde el modal de edición
        }
    });
}

async function removeAttachment(taskId, attachmentId) {
    const data = findTask(taskId);
    if (!data) return;
    const { task } = data;
    if (!Array.isArray(task.attachments)) return;
    const idx = task.attachments.findIndex(a => a.id === attachmentId);
    if (idx === -1) return;
    const att = task.attachments[idx];
    // borrar blob local
    try { await deleteAttachmentBlob(att.id); } catch (_) {}
    // borrar en Dropbox si procede (solo si ninguna otra tarea lo usa)
    if (accessToken && att.dropboxPath) {
        let refs = 0;
        iterAllAttachments((a)=>{ if (a.dropboxPath === att.dropboxPath) refs++; });
        if (refs <= 1) {
            try { await deleteDropboxFile(att.dropboxPath); } catch (_) {}
        }
    }
    if (isNextcloudConfigured() && att.nextcloudPath) {
        let refs = 0;
        iterAllAttachments((a)=>{ if (a.nextcloudPath === att.nextcloudPath) refs++; });
        if (refs <= 1) {
            try { await deleteNextcloudFile(att.nextcloudPath); } catch (_) {}
        }
    }
    task.attachments.splice(idx, 1);
    const now = new Date().toISOString();
    task.lastModified = now;
    task.sortModifiedAt = now;
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) {
        try { performFullSync(); } catch (_) { syncToDropbox(false); }
    }
    if (isNextcloudConfigured()) {
        try { performNextcloudFullSync(false); } catch (_) { syncToNextcloud(false); }
    }
    showToast((window.i18n&&i18n.t)?i18n.t('attachment_removed'):'Adjunto eliminado');
}

function openImageLightbox(src, alt) {
    try {
        const box = document.getElementById('image-lightbox');
        const img = document.getElementById('image-lightbox-img');
        if (!box || !img) return;
        img.src = src;
        img.alt = alt || '';
        box.style.display = 'flex';
    } catch (_) {}
}
function closeImageLightbox() {
    const box = document.getElementById('image-lightbox');
    const img = document.getElementById('image-lightbox-img');
    if (box) box.style.display = 'none';
    if (img) img.src = '';
}

// --- UTILIDADES DE ETIQUETAS (VISIBLES GLOBALMENTE) ---
function getAllTags() {
    const tagsSet = new Set();
    Object.values(categories).forEach(tasks => {
        tasks.forEach(task => {
            if (task.tags && Array.isArray(task.tags)) {
                task.tags.forEach(tag => tagsSet.add(tag));
            }
        });
    });
    return Array.from(tagsSet).sort();
}

function updateTagFilterDropdown(currentValue = '') {
    const filterTagSelect = document.getElementById('filter-tag');
    if (!filterTagSelect) return;
    const tags = getAllTags();

    // Construir opciones con "Mostrar todo" al principio
    const showAll = (window.i18n && i18n.t) ? i18n.t('show_all') : 'Mostrar todo';
    let optionsHtml = `<option value="">${showAll}</option>`;

    // Si hay un valor actual que ya no existe en las etiquetas, añadirlo para conservar selección
    const hasCurrent = currentValue && tags.includes(currentValue);
    const renderedTags = hasCurrent ? tags : [currentValue, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);

    optionsHtml += renderedTags.map(tag => `<option value="${tag}">${tag}</option>`).join('');

    filterTagSelect.innerHTML = optionsHtml;
    // Restaurar selección previa
    filterTagSelect.value = currentValue || '';
}

// Filtro de columnas: mostrar solo una o todas
function updateColumnFilterDropdown(currentValues = [], catNames = null) {
    const select = document.getElementById('filter-column');
    const group = document.getElementById('filter-column-group');
    if (!select && !group) return;
    const names = Object.assign(
        {},
        DEFAULT_CATEGORY_NAMES,
        (catNames || ((window.i18n && i18n.getEffectiveCategoryNames) ? i18n.getEffectiveCategoryNames() : {})),
        { 'historico': (window.i18n && i18n.t) ? i18n.t('history') : 'Histórico' }
    );
    const showAll = (window.i18n && i18n.t) ? i18n.t('show_all') : 'Todas';
    const selectedSet = new Set(Array.isArray(currentValues) ? currentValues : (currentValues ? [currentValues] : []));
    let options = `<option value=""${selectedSet.size===0 ? ' selected' : ''}>${showAll}</option>`;
    // Orden fijo: En preparación, Preparadas, En proceso, Pendientes, Histórico (virtual)
    const keys = ['en-preparacion','preparadas','en-proceso','pendientes','historico'];
    if (group) {
        const html = keys.map(k => `
            <label style="display:inline-flex; align-items:center; gap:6px; margin-right:10px;">
              <input type="checkbox" data-col="${k}" ${selectedSet.has(k) ? 'checked' : ''}>
              <span>${names[k]}</span>
            </label>
        `).join('');
        group.innerHTML = html;
        return;
    }
    // Conservar selección aunque el nombre cambie
    options += keys.map(k => `<option value="${k}"${selectedSet.has(k) ? ' selected' : ''}>${names[k]}</option>`).join('');
    select.innerHTML = options;
    // Para selects múltiples, no usar select.value; las opciones ya marcan selected
}

// Autocompletado para input de etiquetas (datalist)
function updateTagDatalist() {
    const datalist = document.getElementById('all-tags-list');
    if (!datalist) return;
    const tags = getAllTags();
    datalist.innerHTML = tags.map(t => `<option value="${t}"></option>`).join('');
}

function refreshCategorySelectOptions(names = null) {
    const select = document.getElementById('popup-task-category');
    if (!select) return;
    const current = select.value;
    const catNames = names || getCategoryNames();
    Array.from(select.options).forEach(opt => {
        const key = opt && opt.value;
        if (key && catNames[key]) opt.textContent = catNames[key];
    });
    if (current) select.value = current;
}

// --- HISTÓRICO EN TABLERO (columna virtual) ---
function __localDateStr(iso) {
    try { const d = new Date(iso); if (isNaN(d)) return ''; const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; } catch(_) { return ''; }
}
function collectHistoryGroupsLimited(filterTag = '', maxDays = 7, maxPerDay = 10) {
    try {
        const byDate = new Map();
        for (const tasks of Object.values(categories)) {
            for (const t of tasks) {
                if (filterTag && (!Array.isArray(t.tags) || !t.tags.includes(filterTag))) continue;
                const hist = Array.isArray(t.doneHistory) ? t.doneHistory : [];
                for (const ts of hist) {
                    const ds = __localDateStr(ts);
                    if (!ds) continue;
                    if (!byDate.has(ds)) byDate.set(ds, new Map());
                    const perTask = byDate.get(ds);
                    const arr = perTask.get(t.id) || [];
                    arr.push(ts);
                    perTask.set(t.id, arr);
                }
            }
        }
        const dates = Array.from(byDate.keys()).sort().reverse().slice(0, Math.max(1, maxDays));
        const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
        const out = [];
        for (const ds of dates) {
            const perTask = byDate.get(ds);
            const items = [];
            perTask.forEach((arr, taskId) => {
                let found = null;
                for (const tasks of Object.values(categories)) {
                    const t = tasks.find(x => x.id === taskId);
                    if (t) { found = t; break; }
                }
                if (!found) return;
                const sorted = arr.slice().sort((a,b)=> new Date(b) - new Date(a));
                const last = sorted[0];
                const lastHuman = new Date(last).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                items.push({ task: found, count: arr.length, last, lastHuman });
            });
            items.sort((a,b)=> new Date(b.last) - new Date(a.last));
            out.push({ date: ds, dateHuman: new Date(ds).toLocaleDateString(locale, { dateStyle: 'full' }), items: items.slice(0, Math.max(1, maxPerDay)) });
        }
        return out;
    } catch (e) { console.warn('collectHistoryGroupsLimited error', e); return []; }
}

// Chips de sugerencias bajo el input de etiquetas
function renderTagSuggestions() {
    const container = document.getElementById('tag-suggestions');
    const tagsInput = document.getElementById('popup-task-tags');
    if (!container || !tagsInput) return;
    const all = getAllTags();
    const current = new Set(parseTagsInputValue(tagsInput.value));
    container.innerHTML = all.map(tag => {
        const sel = current.has(tag) ? 'selected' : '';
        return `<span class="tag-chip ${sel}" data-tag="${tag}">#${tag}</span>`;
    }).join('');
    container.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const tag = chip.dataset.tag;
            toggleTagInInput(tag);
            renderTagSuggestions();
        });
    });
}

function parseTagsInputValue(value) {
    return value.split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)
        .filter((v, i, a) => a.indexOf(v) === i);
}

function setTagsInputFromArray(arr) {
    const tagsInput = document.getElementById('popup-task-tags');
    if (!tagsInput) return;
    const unique = Array.from(new Set(arr.map(t => t.trim()).filter(Boolean)));
    tagsInput.value = unique.join(', ');
}

function toggleTagInInput(tag) {
    const tagsInput = document.getElementById('popup-task-tags');
    if (!tagsInput) return;
    const list = parseTagsInputValue(tagsInput.value);
    const idx = list.indexOf(tag);
    if (idx === -1) list.push(tag); else list.splice(idx, 1);
    setTagsInputFromArray(list);
}

// --- LÓGICA DE SINCRONIZACIÓN CON DROPBOX (CORREGIDA CON FUSIÓN) ---
function updateDropboxButtons() {
    const loginBtn = document.getElementById('dropbox-login');
    const syncBtn = document.getElementById('dropbox-sync');
    if (!loginBtn || !syncBtn) return;
    if (accessToken) {
        loginBtn.style.display = 'none';
        syncBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        syncBtn.style.display = 'none';
    }
}

// Compatibilidad: en algunos flujos se invoca este helper; si no existe, dejar como no-op
function showReconnectDropboxBtn() { /* no-op: el botón de login ya queda visible al expirar */ }


// Muestra/Oculta todo el bloque de sincronización si no hay conexión
function updateSyncGroupVisibility() {
    const headerGroup = document.getElementById('sync-group');
    const modalGroup = document.getElementById('sync-group-modal');
    const online = navigator.onLine;
    if (headerGroup) headerGroup.style.display = online ? '' : 'none';
    if (modalGroup) modalGroup.style.display = online ? '' : 'none';
    if (online) {
        updateDropboxButtons();
        updateNextcloudFormFromConfig({ keepPasswordField: true });
    }
}


async function validateToken() {
    if (!accessToken) return false;
    
    try {
        const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                // 'Content-Type' no es necesario si el body es null
            },
            body: null // ¡ESTA ES LA CORRECCIÓN CLAVE! La API espera un cuerpo nulo.
        });
        
        console.log('🧪 Status de validación:', response.status);
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token válido para usuario:', userData.name.display_name);
            return true;
        } else {
            const errorData = await response.text();
            console.log('❌ Token inválido:', response.status, errorData);
            return false;
        }
    } catch (error) {
        console.error('💥 Error de red al validar token:', error);
        return false;
    }
}

// --- REAUTENTICACIÓN AUTOMÁTICA CON DROPBOX ---
function getDropboxRedirectUri() {
    const baseUrl = window.location.origin;
    const cleanPath = window.location.pathname.split('?')[0].split('#')[0];
    if (cleanPath.endsWith('index.html')) return baseUrl + cleanPath.replace(/index\.html$/, '');
    if (cleanPath === '/' || cleanPath === '') return baseUrl + '/';
    return baseUrl + cleanPath;
}

function startDropboxAuth() {
    const redirectUri = getDropboxRedirectUri();
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${DROPBOX_APP_KEY}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
}

function scheduleDropboxReauth(reason = '') {
    try {
        if (!navigator.onLine) return;
        const key = LS.lastReauthAt;
        const now = Date.now();
        const last = parseInt(localStorage.getItem(key) || '0', 10);
        // Evitar bucles: al menos 60s entre reauths
        if (isFinite(last) && now - last < 60000) return;
        localStorage.setItem(key, String(now));
        try {
            const kind = (reason || '').indexOf('upload') !== -1 ? 'upload' : 'download';
            localStorage.setItem(LS.pendingDropboxAction, kind);
        } catch (_) {}
        showReconnectIndicator((window.i18n && i18n.t) ? i18n.t('reconnecting') : 'Reconectando con Dropbox…');
        setTimeout(startDropboxAuth, 1200);
    } catch (_) {
        // Fallback directo
        setTimeout(startDropboxAuth, 1200);
    }
}

// FUNCIÓN DE FUSIÓN CORREGIDA Y MÁS ROBUSTA
function mergeTasks(localCategories, remoteCategories, deletedIdsSet) {
    const tasksById = new Map();

    const processCategory = (categoriesObject) => {
        for (const categoryName in categoriesObject) {
            for (const task of categoriesObject[categoryName]) {
                // Ignorar tareas eliminadas
                if (deletedIdsSet.has(task.id)) continue;
                const existing = tasksById.get(task.id);
                if (!existing || new Date(task.lastModified) > new Date(existing.lastModified)) {
                    const normalized = normalizeCategoryKey(categoryName);
                    tasksById.set(task.id, { ...task, category: normalized });
                }
            }
        }
    };

    processCategory(localCategories);
    processCategory(remoteCategories);

    const mergedCategories = { "en-preparacion": [], "preparadas": [], "en-proceso": [], "pendientes": [], "archivadas": [] };
    for (const task of tasksById.values()) {
        const targetCat = normalizeCategoryKey(task.category);
        if (mergedCategories[targetCat]) {
            const { category, ...finalTask } = task;
            mergedCategories[targetCat].push(finalTask);
        }
    }
    // Orden determinista: orderCode (A..Z) primero, luego sortModifiedAt/lastModified desc
    const cmp = (a, b) => {
        const A = (a.orderCode || '').toUpperCase();
        const B = (b.orderCode || '').toUpperCase();
        const aHas = A.length > 0; const bHas = B.length > 0;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
            if (A < B) return -1;
            if (A > B) return 1;
        }
        const ta = new Date(a.sortModifiedAt || a.lastModified || 0).getTime();
        const tb = new Date(b.sortModifiedAt || b.lastModified || 0).getTime();
        return tb - ta;
    };
    Object.keys(mergedCategories).forEach(cat => { mergedCategories[cat].sort(cmp); });
    return mergedCategories;
}

function mergeDeletedTasks(localDeleted, remoteDeleted) {
    const deletedById = new Map();
    localDeleted.forEach(t => deletedById.set(t.id, t));
    remoteDeleted.forEach(t => deletedById.set(t.id, t));
    return Array.from(deletedById.values());
}

async function syncToDropbox(showAlert = true) {
    if (!accessToken) return false;
    try {
        // 1) Subir primero los adjuntos pendientes para que el JSON ya incluya dropboxPath
        const attachmentsUpdated = await uploadPendingAttachmentsToDropbox();

        // 2) Subir JSON de categorías con metadatos actualizados
        const data = { categories, deletedTasks, lastSync: new Date().toISOString() };
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_FILE_PATH, mode: 'overwrite' })
            },
            body: JSON.stringify(data, null, 2)
        });
        if (response.status === 401) {
            accessToken = null;
            localStorage.removeItem(LS.token);
            updateDropboxButtons();
            try { localStorage.setItem(LS.pendingDropboxAction, 'upload'); } catch (e) {}
            showReconnectIndicator((window.i18n&&i18n.t)?i18n.t('reconnecting'):'Reconectando con Dropbox…');
            scheduleDropboxReauth('upload-401');
            return false;
        }
        if (response.ok) {
            const metadata = await response.json();
            localLastSync = metadata.server_modified;
            localStorage.setItem(LS.lastSync, localLastSync);
            if (showAlert) showToast((window.i18n && i18n.t) ? i18n.t('toast_dropbox_uploaded') : '✅ Actividades subidas a Dropbox');
            return true;
        }
    } catch (e) { console.error('Error en syncToDropbox', e); }
    return false;
}

async function syncFromDropbox(force = false) {
    if (!accessToken) return false;
    try {
        // Consultar metadata únicamente del archivo de EduKanban
        let meta = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: DROPBOX_FILE_PATH })
        });
        if (meta.status === 401) {
            accessToken = null;
            localStorage.removeItem(LS.token);
            updateDropboxButtons();
            try { localStorage.setItem(LS.pendingDropboxAction, 'download'); } catch (e) {}
            showReconnectIndicator((window.i18n&&i18n.t)?i18n.t('reconnecting'):'Reconectando con Dropbox…');
            scheduleDropboxReauth('meta-401');
            return false;
        }
        if (!meta.ok) return meta.status === 409 ? await syncToDropbox(false) : false;
        const remoteMeta = await meta.json();
        if (force || !localLastSync || new Date(remoteMeta.server_modified) > new Date(localLastSync)) {
            // Descargar desde el archivo de EduKanban
            let res = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Dropbox-API-Arg': JSON.stringify({ path: DROPBOX_FILE_PATH }) }
            });
            if (res.status === 401) {
                accessToken = null;
                localStorage.removeItem(LS.token);
                updateDropboxButtons();
                try { localStorage.setItem(LS.pendingDropboxAction, 'download'); } catch (e) {}
                showReconnectIndicator((window.i18n&&i18n.t)?i18n.t('reconnecting'):'Reconectando con Dropbox…');
                scheduleDropboxReauth('download-401');
                return false;
            }
            if (res.ok) {
                const remoteData = await res.json();
                if (remoteData.categories) {
                    // 1. Fusionar eliminados
                    const remoteDeleted = remoteData.deletedTasks || [];
                    const mergedDeletedList = mergeDeletedTasks(deletedTasks, remoteDeleted);
                    const deletedIdsSet = new Set(mergedDeletedList.map(t => t.id));
                    // 2. Fusionar categorías ignorando eliminados
                    const mergedCategories = mergeTasks(categories, remoteData.categories, deletedIdsSet);
                    Object.assign(categories, mergedCategories);
                    deletedTasks.length = 0;
                    Array.prototype.push.apply(deletedTasks, mergedDeletedList);
                    saveCategoriesToLocalStorage();
                    localStorage.setItem(LS.deleted, JSON.stringify(deletedTasks));
                    renderTasks();
                    localLastSync = remoteMeta.server_modified;
                    localStorage.setItem(LS.lastSync, localLastSync);
                    return true;
                }
            }
        }
    } catch (e) { console.error('Error en syncFromDropbox', e); }
    return false;
}

async function performFullSync() {
    const hasDropbox = !!accessToken;
    const hasNextcloud = isNextcloudConfigured();
    if (!hasDropbox && !hasNextcloud) {
        const msg = (window.i18n && i18n.t) ? i18n.t('sync_no_providers') : 'No hay servicios de sincronización configurados.';
        showToast(msg, 'error');
        return false;
    }
    console.log('🔄 Iniciando sincronización completa...');
    showToast('Sincronizando...');
    let success = true;

    if (hasDropbox) {
        const downloaded = await syncFromDropbox(true);
        if (downloaded) {
            const uploaded = await syncToDropbox(false);
            if (!uploaded) {
                showToast('❌ Error al subir datos.', 'error');
                success = false;
            }
        } else {
            showToast('❌ Error al descargar datos.', 'error');
            success = false;
        }
    }

    if (hasNextcloud) {
        const nextcloudOk = await performNextcloudFullSync(false);
        if (!nextcloudOk) {
            const err = (window.i18n && i18n.t) ? i18n.t('toast_nextcloud_sync_failed') : '❌ Error al sincronizar con Nextcloud';
            showToast(err, 'error');
            success = false;
        }
    }

    if (success) {
        showToast('✅ Sincronización completada.');
    }
    return success;
}

function startAutoSyncPolling() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => {
        if (accessToken) syncFromDropbox();
        if (isNextcloudConfigured()) syncFromNextcloud();
    }, 30000);
    console.log('🔄 Sondeo de sincronización automática iniciado.');
}
function stopAutoSyncPolling() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; console.log('🛑 Sondeo detenido.'); }
}

async function ensureDropboxFolder(path) {
    try {
        const res = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, autorename: false })
        });
        if (res.ok || res.status === 409) return true; // 409: ya existe
    } catch (e) { console.warn('ensureDropboxFolder', e); }
    return false;
}

async function uploadPendingAttachmentsToDropbox() {
    if (!accessToken) return false;
    let updatedAny = false;
    await ensureDropboxFolder(DROPBOX_ATTACH_DIR);
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const t of tasks) {
            if (!t.attachments) continue;
            for (const att of t.attachments) {
                if (att.dropboxPath && att.uploadedAt) continue; // ya subido
                const blob = await getAttachmentBlob(att.id);
                if (!blob) continue;
                const safeName = (att.name || att.id).replace(/[^A-Za-z0-9._-]/g, '_');
                const path = `${DROPBOX_ATTACH_DIR}/${att.id}-${safeName}`;
                try {
                    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/octet-stream',
                            'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite' })
                        },
                        body: blob
                    });
                    if (res.ok) {
                        att.dropboxPath = path;
                        att.uploadedAt = new Date().toISOString();
                        t.lastModified = new Date().toISOString();
                        saveCategoriesToLocalStorage();
                        updatedAny = true;
                    }
                } catch (e) { console.warn('upload attachment', e); }
            }
        }
    }
    return updatedAny;
}

async function deleteDropboxFile(path) {
    if (!accessToken || !path) return false;
    try {
        const res = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
        return res.ok;
    } catch (e) { console.warn('delete dropbox file', e); return false; }
}

async function ensureNextcloudFolder(conf, segments) {
    if (!conf) return false;
    const parts = Array.isArray(segments) ? segments.slice() : nextcloudPathToSegments(segments);
    if (!parts.length) return true;
    const auth = makeNextcloudAuthHeader(conf);
    let built = [];
    for (const seg of parts) {
        const clean = String(seg || '').trim();
        if (!clean) continue;
        built.push(clean);
        const url = buildNextcloudUrl(conf, built);
        try {
            const res = await fetch(url, {
                method: 'MKCOL',
                headers: { 'Authorization': auth }
            });
            if (res.status === 201 || res.status === 405 || res.status === 409 || res.status === 301 || res.status === 302) continue;
            if (!res.ok && res.status !== 412) {
                console.warn('ensureNextcloudFolder', res.status, url);
                return false;
            }
        } catch (e) {
            console.warn('ensureNextcloudFolder error', e);
            return false;
        }
    }
    return true;
}

async function uploadPendingAttachmentsToNextcloud() {
    if (!isNextcloudConfigured()) return false;
    const conf = nextcloudConfig;
    const auth = makeNextcloudAuthHeader(conf);
    const rootParts = getNextcloudRootSegments(conf);
    const attachParts = rootParts.concat([NEXTCLOUD_ATTACH_DIR]);
    await ensureNextcloudFolder(conf, rootParts);
    await ensureNextcloudFolder(conf, attachParts);

    let updatedAny = false;
    for (const [, tasks] of Object.entries(categories)) {
        for (const t of tasks) {
            if (!Array.isArray(t.attachments)) continue;
            for (const att of t.attachments) {
                if (att.nextcloudPath && att.nextcloudUploadedAt) continue;
                const blob = await getAttachmentBlob(att.id);
                if (!blob) continue;
                const safeName = (att.name || att.id).replace(/[^A-Za-z0-9._-]/g, '_');
                const filename = `${att.id}-${safeName}`;
                const relativeSegments = attachParts.concat([filename]);
                const url = buildNextcloudUrl(conf, relativeSegments);
                try {
                    const res = await fetch(url, {
                        method: 'PUT',
                        headers: {
                            'Authorization': auth,
                            'Content-Type': blob.type || 'application/octet-stream'
                        },
                        body: blob
                    });
                    if (res.ok || res.status === 201 || res.status === 204) {
                        att.nextcloudPath = buildNextcloudRelativePath(relativeSegments);
                        att.nextcloudUploadedAt = new Date().toISOString();
                        t.lastModified = new Date().toISOString();
                        saveCategoriesToLocalStorage();
                        updatedAny = true;
                    } else {
                        console.warn('upload nextcloud attachment', res.status, url);
                    }
                } catch (e) {
                    console.warn('upload nextcloud attachment error', e);
                }
            }
        }
    }
    return updatedAny;
}

async function deleteNextcloudFile(relativePath) {
    if (!isNextcloudConfigured() || !relativePath) return false;
    const conf = nextcloudConfig;
    const segments = nextcloudPathToSegments(relativePath);
    if (!segments.length) return false;
    const url = buildNextcloudUrl(conf, segments);
    try {
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': makeNextcloudAuthHeader(conf) }
        });
        return res.ok || res.status === 404;
    } catch (e) {
        console.warn('delete nextcloud file', e);
        return false;
    }
}

async function downloadNextcloudAttachment(relativePath) {
    if (!isNextcloudConfigured() || !relativePath) return null;
    const conf = nextcloudConfig;
    const segments = nextcloudPathToSegments(relativePath);
    if (!segments.length) return null;
    const url = buildNextcloudUrl(conf, segments);
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': makeNextcloudAuthHeader(conf),
                'Cache-Control': 'no-cache'
            }
        });
        if (res.ok) return await res.blob();
    } catch (e) {
        console.warn('download nextcloud attachment error', e);
    }
    return null;
}

async function testNextcloudConnection(conf) {
    if (!conf || !conf.baseUrl || !conf.username) return { ok: false, error: 'invalid-input' };
    const base = (conf.baseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return { ok: false, error: 'invalid-input' };
    const auth = makeNextcloudAuthHeader(conf);
    const userSegment = encodeURIComponent(conf.username);
    const candidates = [];
    if (/remote\.php\/dav/i.test(base)) {
        candidates.push(base);
        if (!base.endsWith(`/${userSegment}`)) candidates.push(`${base}/${userSegment}`);
    } else {
        candidates.push(`${base}/remote.php/dav/files/${userSegment}`);
        candidates.push(`${base}/${userSegment}`);
        candidates.push(base);
    }
    const body = '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>';
    let unauthorized = false;
    for (const candidate of candidates) {
        const clean = candidate.replace(/\/+$/, '');
        if (!clean) continue;
        try {
            const res = await fetch(clean, {
                method: 'PROPFIND',
                headers: {
                    'Authorization': auth,
                    'Depth': '0',
                    'Content-Type': 'application/xml; charset=utf-8'
                },
                body
            });
            if (res.status === 401 || res.status === 403) {
                unauthorized = true;
                continue;
            }
            if (res.ok || res.status === 207) {
                return { ok: true, resolvedBaseUrl: clean };
            }
        } catch (e) {
            console.warn('testNextcloudConnection', e);
        }
    }
    if (unauthorized) return { ok: false, error: 'unauthorized' };
    return { ok: false, error: 'not-found' };
}

async function syncToNextcloud(showAlert = true) {
    if (!isNextcloudConfigured()) {
        if (showAlert) {
            const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_idle') : 'Configura Nextcloud antes de sincronizar.';
            showToast(msg, 'error');
        }
        return false;
    }
    const conf = nextcloudConfig;
    try {
        const rootParts = getNextcloudRootSegments(conf);
        await ensureNextcloudFolder(conf, rootParts);
        await uploadPendingAttachmentsToNextcloud();

        const payload = { categories, deletedTasks, lastSync: new Date().toISOString() };
        const fileSegments = rootParts.concat([NEXTCLOUD_FILE_NAME]);
        const url = buildNextcloudUrl(conf, fileSegments);
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': makeNextcloudAuthHeader(conf),
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload, null, 2)
        });
        if (res.status === 401 || res.status === 403) {
            const invalid = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_invalid') : 'Credenciales inválidas. Revisa usuario y token.';
            setNextcloudStatus(invalid, 'error');
            if (showAlert) showToast(invalid, 'error');
            return false;
        }
        if (res.ok || res.status === 201 || res.status === 204) {
            nextcloudLastSync = new Date().toISOString();
            try { localStorage.setItem(LS.nextcloudLastSync, nextcloudLastSync); } catch (_) {}
            const lastMsg = formatDateTimeForLocale(nextcloudLastSync);
        const prefix = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_synced_prefix') : 'Última sincronización: ';
        setNextcloudStatus(`${prefix}${lastMsg}`, 'success');
            if (showAlert) {
                const msg = (window.i18n && i18n.t) ? i18n.t('toast_nextcloud_uploaded') : '✅ Datos subidos a Nextcloud';
                showToast(msg);
            }
            return true;
        }
        const generic = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_generic') : `Error ${res.status} al subir datos.`;
        setNextcloudStatus(generic, 'error');
    } catch (e) {
        console.error('syncToNextcloud', e);
        const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_network') : 'Error de red al contactar con Nextcloud.';
        setNextcloudStatus(msg, 'error');
    }
    if (showAlert) {
        const msg = (window.i18n && i18n.t) ? i18n.t('toast_nextcloud_error_upload') : '❌ Error al subir datos a Nextcloud';
        showToast(msg, 'error');
    }
    return false;
}

async function syncFromNextcloud(force = false, showAlert = false) {
    if (!isNextcloudConfigured()) return false;
    const conf = nextcloudConfig;
    const rootParts = getNextcloudRootSegments(conf);
    const fileSegments = rootParts.concat([NEXTCLOUD_FILE_NAME]);
    const url = buildNextcloudUrl(conf, fileSegments);
    let remoteModifiedIso = null;
    try {
        const headRes = await fetch(url, { method: 'HEAD', headers: { 'Authorization': makeNextcloudAuthHeader(conf) } });
        if (headRes.status === 401 || headRes.status === 403) {
            const invalid = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_invalid') : 'Credenciales inválidas. Revisa usuario y token.';
            setNextcloudStatus(invalid, 'error');
            if (showAlert) showToast(invalid, 'error');
            return false;
        }
        if (headRes.status === 404) {
            return await syncToNextcloud(showAlert);
        }
        if (headRes.ok) {
            const remoteModified = headRes.headers.get('Last-Modified');
            if (remoteModified) remoteModifiedIso = new Date(remoteModified).toISOString();
            if (!force && nextcloudLastSync && remoteModifiedIso) {
                if (new Date(remoteModifiedIso) <= new Date(nextcloudLastSync)) return false;
            }
        }
    } catch (e) {
        console.warn('HEAD nextcloud falló', e);
    }
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': makeNextcloudAuthHeader(conf),
                'Cache-Control': 'no-cache'
            }
        });
        if (res.status === 401 || res.status === 403) {
            const invalid = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_invalid') : 'Credenciales inválidas. Revisa usuario y token.';
            setNextcloudStatus(invalid, 'error');
            if (showAlert) showToast(invalid, 'error');
            return false;
        }
        if (res.status === 404) {
            return await syncToNextcloud(showAlert);
        }
        if (!res.ok) {
            const generic = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_generic') : `Error ${res.status} al descargar datos.`;
            setNextcloudStatus(generic, 'error');
            if (showAlert) showToast(generic, 'error');
            return false;
        }
        const remoteData = await res.json();
        if (remoteData && remoteData.categories) {
            const remoteDeleted = Array.isArray(remoteData.deletedTasks) ? remoteData.deletedTasks : [];
            const mergedDeleted = mergeDeletedTasks(deletedTasks, remoteDeleted);
            const deletedIdsSet = new Set(mergedDeleted.map(t => t.id));
            const mergedCategories = mergeTasks(categories, remoteData.categories, deletedIdsSet);
            Object.assign(categories, mergedCategories);
            deletedTasks.length = 0;
            Array.prototype.push.apply(deletedTasks, mergedDeleted);
            saveCategoriesToLocalStorage();
            localStorage.setItem(LS.deleted, JSON.stringify(deletedTasks));
            renderTasks();
            nextcloudLastSync = remoteModifiedIso || new Date().toISOString();
            try { localStorage.setItem(LS.nextcloudLastSync, nextcloudLastSync); } catch (_) {}
            const lastMsg = formatDateTimeForLocale(nextcloudLastSync);
            const prefix = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_synced_prefix') : 'Última sincronización: ';
            setNextcloudStatus(`${prefix}${lastMsg}`, 'success');
            if (showAlert) {
                const okMsg = (window.i18n && i18n.t) ? i18n.t('toast_nextcloud_downloaded') : '📥 Datos descargados desde Nextcloud';
                showToast(okMsg);
            }
            return true;
        }
    } catch (e) {
        console.error('syncFromNextcloud', e);
        const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_network') : 'Error de red al contactar con Nextcloud.';
        setNextcloudStatus(msg, 'error');
        if (showAlert) showToast(msg, 'error');
    }
    return false;
}

async function performNextcloudFullSync(showNotifications = true) {
    if (!isNextcloudConfigured()) {
        const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_idle') : 'Configura Nextcloud antes de sincronizar.';
        setNextcloudStatus(msg, 'warning');
        if (showNotifications) showToast(msg, 'error');
        return false;
    }
    if (showNotifications) {
        const syncing = (window.i18n && i18n.t) ? i18n.t('nextcloud_syncing') : 'Sincronizando con Nextcloud…';
        showToast(syncing);
    }
    const downloaded = await syncFromNextcloud(true, showNotifications);
    if (!downloaded) {
        if (showNotifications) {
            const err = (window.i18n && i18n.t) ? i18n.t('toast_nextcloud_error_download') : '❌ Error al descargar datos de Nextcloud';
            showToast(err, 'error');
        }
        return false;
    }
    const uploaded = await syncToNextcloud(showNotifications);
    if (uploaded) {
        if (showNotifications) {
            const done = (window.i18n && i18n.t) ? i18n.t('nextcloud_sync_complete') : '✅ Sincronización con Nextcloud completada';
            showToast(done);
        }
        return true;
    }
    return false;
}

function handleAuthCallback() {
    // Verificar solo en hash (más seguro): access_token viene en el fragmento
    const hash = window.location.hash.substring(1);
    
    console.log('🔍 Hash:', hash);
    
    let newToken = null;
    if (hash) {
        const hashParams = new URLSearchParams(hash);
        newToken = hashParams.get('access_token');
    }
    
    console.log('🎫 Nuevo token encontrado:', newToken ? 'Sí' : 'No');
    
    if (newToken) {
        console.log('💾 Guardando token...');
        localStorage.setItem(LS.token, newToken);
        accessToken = newToken;
        
        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        updateDropboxButtons();
        showToast('✅ Conectado con Dropbox correctamente');
        
        // Intentar sincronizar con más delay
        setTimeout(() => {
            console.log('🔄 Intentando primera sincronización...');
            try {
                const pending = localStorage.getItem(LS.pendingDropboxAction) || '';
                if (pending) {
                    showReconnectIndicator((window.i18n&&i18n.t)?i18n.t('reconnected_retrying'):'Reconectado. Reintentando operación…');
                }
                if (pending === 'upload') {
                    syncToDropbox(false).then(() => { hideReconnectIndicator(); localStorage.removeItem(LS.pendingDropboxAction); });
                } else if (pending === 'download') {
                    syncFromDropbox(true).then(() => { hideReconnectIndicator(); localStorage.removeItem(LS.pendingDropboxAction); });
                } else {
                    syncFromDropbox();
                }
            } catch (e) { console.warn('retry after auth failed', e); syncFromDropbox(); }
        }, 2000); // Aumentado a 2 segundos
    } else {
        updateDropboxButtons();
        if (accessToken) {
            console.log('🔄 Token existente encontrado, validando...');
            // Validar con delay
            setTimeout(() => {
                validateToken().then(valid => {
                    if (valid) {
                        syncFromDropbox();
                    } else {
            console.log('❌ Token existente no válido, reautenticando...');
                        scheduleDropboxReauth('validate-false');
                    }
                });
            }, 1000);
        }
    }
}

// --- INICIALIZACIÓN DE LA APLICACIÓN (ÚNICA Y CONSOLIDADA) ---
document.addEventListener('DOMContentLoaded', function() {
    loadCategoriesFromLocalStorage();
    migrateOldTasks();
    renderTasks();

    const setupMediaPitchObserver = () => {
        const target = document.body || document.documentElement;
        if (!target) return;
        bindPitchForNodeAndChildren(target);
        if (mediaPitchObserver || typeof MutationObserver === 'undefined') return;
        mediaPitchObserver = new MutationObserver((mutations) => {
            try {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (!node || (node.nodeType !== 1 && node.nodeType !== 11)) return;
                        bindPitchForNodeAndChildren(node);
                    });
                });
            } catch (_) {}
        });
        mediaPitchObserver.observe(target, { childList: true, subtree: true });
    };
    setupMediaPitchObserver();

    const pitchToggleBtn = document.getElementById('media-pitch-toggle');
    const refreshPitchToggleBtn = () => {
        if (!pitchToggleBtn) return;
        const preserve = isMediaPitchPreserved();
        let labelOn = '🎼 Mantener tono: Sí';
        let labelOff = '🎼 Mantener tono: No';
        if (window.i18n && i18n.t) {
            try {
                labelOn = i18n.t('keep_pitch_on') || labelOn;
                labelOff = i18n.t('keep_pitch_off') || labelOff;
            } catch (_) {}
        }
        pitchToggleBtn.textContent = preserve ? labelOn : labelOff;
        pitchToggleBtn.setAttribute('aria-pressed', preserve ? 'true' : 'false');
    };
    if (pitchToggleBtn) {
        refreshPitchToggleBtn();
        pitchToggleBtn.addEventListener('click', () => {
            const next = !isMediaPitchPreserved();
            setMediaPitchPreserved(next);
            refreshPitchToggleBtn();
            bindPitchForNodeAndChildren(document.body || document.documentElement);
        });
    }

    // Lógica del Popup
    const popup = document.getElementById('popup-tarea');
    const abrirPopupBtn = document.getElementById('abrir-popup-tarea');
    const cancelarPopupBtn = document.getElementById('cancelar-popup');
    const popupForm = document.getElementById('popup-task-form');
    const taskNameInput = document.getElementById('popup-task-name');
    const categorySelect = document.getElementById('popup-task-category');
    const tagsInput = document.getElementById('popup-task-tags');
    const reminderInput = document.getElementById('popup-task-reminder');
    const orderInput = document.getElementById('popup-task-order');
    const shortcutsBtn = document.getElementById('abrir-atajos');
    const shortcutsModal = document.getElementById('atajos-modal');
    const shortcutsCloseBtn = document.getElementById('atajos-cerrar');
    const categoryNameAdmin = setupCategoryNameAdminControls();
    if (categoryNameAdmin && categoryNameAdmin.applyValues) {
        window.__updateCategoryNameInputs = () => categoryNameAdmin.applyValues();
    }

    const nextcloudUrlInput = document.getElementById('nextcloud-url');
    const nextcloudUserInput = document.getElementById('nextcloud-username');
    const nextcloudPasswordInput = document.getElementById('nextcloud-password');
    const nextcloudFolderInput = document.getElementById('nextcloud-folder');
    const nextcloudSaveBtn = document.getElementById('nextcloud-save');
    const nextcloudSyncBtn = document.getElementById('nextcloud-sync');
    const nextcloudDisconnectBtn = document.getElementById('nextcloud-disconnect');

    updateNextcloudFormFromConfig();

    if (nextcloudSaveBtn) {
        nextcloudSaveBtn.addEventListener('click', async () => {
            const baseUrl = (nextcloudUrlInput?.value || '').trim().replace(/\/+$/, '');
            const username = (nextcloudUserInput?.value || '').trim();
            const folderRaw = (nextcloudFolderInput?.value || NEXTCLOUD_DEFAULT_FOLDER).trim();
            let password = nextcloudPasswordInput ? nextcloudPasswordInput.value : '';
            const folder = folderRaw || NEXTCLOUD_DEFAULT_FOLDER;

            if (!baseUrl || !username) {
                const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_missing_fields') : 'Indica la URL y el usuario de Nextcloud.';
                setNextcloudStatus(msg, 'warning');
                showToast(msg, 'error');
                return;
            }

            if (!password && nextcloudConfig && nextcloudConfig.baseUrl === baseUrl && nextcloudConfig.username === username) {
                password = nextcloudConfig.password || '';
            }

            if (!password) {
                const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_missing_password') : 'Introduce una contraseña o token de aplicación.';
                setNextcloudStatus(msg, 'warning');
                showToast(msg, 'error');
                return;
            }

            const candidate = { baseUrl, username, password, folder };
            const testingMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_testing') : 'Comprobando credenciales…';
            setNextcloudStatus(testingMsg, 'info');
            nextcloudSaveBtn.disabled = true;
            const validation = await testNextcloudConnection(candidate);
            if (validation && validation.ok) {
                candidate.resolvedBaseUrl = validation.resolvedBaseUrl;
                persistNextcloudConfig(candidate);
                try { await ensureNextcloudFolder(nextcloudConfig, getNextcloudRootSegments(nextcloudConfig)); } catch (_) {}
                updateNextcloudFormFromConfig();
                if (nextcloudPasswordInput) nextcloudPasswordInput.value = '';
                const okMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_save_success') : '✅ Ajustes de Nextcloud guardados';
                showToast(okMsg);
            } else {
                const errMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_save_failed') : '❌ No se pudo validar Nextcloud';
                let statusMsg;
                if (validation && validation.error === 'unauthorized') {
                    statusMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_invalid') : 'Credenciales inválidas. Revisa usuario y token.';
                } else if (validation && validation.error === 'not-found') {
                    statusMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_generic') : 'No se pudo localizar la ruta WebDAV indicada.';
                } else {
                    statusMsg = (window.i18n && i18n.t) ? i18n.t('nextcloud_status_error_network') : 'Error de red al contactar con el servidor WebDAV.';
                }
                setNextcloudStatus(statusMsg, 'error');
                showToast(errMsg, 'error');
            }
            nextcloudSaveBtn.disabled = false;
        });
    }
    if (nextcloudSyncBtn) {
        nextcloudSyncBtn.addEventListener('click', () => {
            performNextcloudFullSync(true);
        });
    }
    if (nextcloudDisconnectBtn) {
        nextcloudDisconnectBtn.addEventListener('click', async () => {
            const msg = (window.i18n && i18n.t) ? i18n.t('nextcloud_confirm_disconnect') : '¿Seguro que quieres eliminar la conexión con Nextcloud?';
            const accept = await showConfirm(msg, (window.i18n && i18n.t) ? i18n.t('delete') : 'Eliminar', (window.i18n && i18n.t) ? i18n.t('cancel') : 'Cancelar');
            if (!accept) return;
            clearNextcloudConfig();
            updateNextcloudFormFromConfig();
            if (nextcloudPasswordInput) nextcloudPasswordInput.value = '';
            const done = (window.i18n && i18n.t) ? i18n.t('nextcloud_disconnected') : 'Conexión con Nextcloud eliminada';
            showToast(done);
        });
    }

    const closeShortcutsModal = () => {
        if (!shortcutsModal) return;
        shortcutsModal.style.display = 'none';
        if (shortcutsBtn) shortcutsBtn.focus();
    };

    const openShortcutsModal = () => {
        if (!shortcutsModal) return;
        shortcutsModal.style.display = 'flex';
        const focusTarget = shortcutsCloseBtn || shortcutsModal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusTarget) focusTarget.focus();
    };

    if (abrirPopupBtn) abrirPopupBtn.addEventListener('click', () => {
        resetPopupFormMode();
        popup.style.display = 'flex';
        document.getElementById('popup-task-name').focus();
        updateTagDatalist();
        renderTagSuggestions();
        // Si hay una etiqueta filtrada, precargarla en el formulario de nueva tarea
        const tagsInput = document.getElementById('popup-task-tags');
        const filterTagSelect = document.getElementById('filter-tag');
        let activeFilterTag = '';
        if (filterTagSelect && filterTagSelect.value) {
            activeFilterTag = filterTagSelect.value;
        } else {
            try { activeFilterTag = localStorage.getItem(LS.selectedFilterTag) || ''; } catch (_) {}
        }
        if (tagsInput && activeFilterTag) {
            const current = parseTagsInputValue(tagsInput.value);
            if (!current.includes(activeFilterTag)) {
                current.push(activeFilterTag);
                setTagsInputFromArray(current);
                renderTagSuggestions();
            }
        }
        // En modo añadir, preparar reutilización
        pendingReusedAttachments = [];
        const reuseToggle = document.getElementById('popup-attach-reuse-toggle');
        const reusePanel = document.getElementById('popup-attach-reuse-panel');
        if (reuseToggle && reusePanel) {
            reuseToggle.style.display = 'inline-block';
            reuseToggle.textContent = '🔁 ' + ((window.i18n&&i18n.t)?i18n.t('reuse_attachment'):'Reutilizar adjunto');
            reusePanel.style.display = 'none';
            reusePanel.innerHTML = '';
            reuseToggle.onclick = () => {
                reusePanel.style.display = reusePanel.style.display === 'none' ? 'block' : 'none';
                if (reusePanel.style.display === 'block') renderReusePanel(null);
            };
        }
    });
    if (cancelarPopupBtn) cancelarPopupBtn.addEventListener('click', () => {
        resetPopupFormMode();
        popup.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target == popup) {
            resetPopupFormMode();
            popup.style.display = 'none';
        }
    });
    if (shortcutsBtn) shortcutsBtn.addEventListener('click', openShortcutsModal);
    if (shortcutsCloseBtn) shortcutsCloseBtn.addEventListener('click', closeShortcutsModal);
    if (shortcutsModal) {
        shortcutsModal.addEventListener('click', (e) => {
            if (e.target === shortcutsModal) closeShortcutsModal();
        });
    }
    if (popupForm) {
        popupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            let nombre = taskNameInput.value.trim();
            const categoria = categorySelect.value;
            const orderCode = (orderInput && orderInput.value) ? orderInput.value.toUpperCase() : '';
            let tags = tagsInput.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
            const filesInput = document.getElementById('popup-task-attachments');
            const newAttachments = await prepareAttachmentsFromFiles(filesInput?.files);
            // Recordatorio
            let reminderAt = null;
            if (reminderInput && reminderInput.value) {
                // Interpretar como hora local -> ISO
                const localStr = reminderInput.value; // YYYY-MM-DDTHH:mm
                const localDate = new Date(localStr);
                if (!isNaN(localDate.getTime())) {
                    reminderAt = localDate.toISOString();
                }
            }

            // Capturar hashtags del nombre como etiquetas adicionales y limpiar el nombre
            const hashtagRegex = /#([\p{L}\d_-]+)/gu;
            const extra = Array.from(nombre.matchAll(hashtagRegex)).map(m => m[1]);
            if (extra.length) {
                nombre = nombre.replace(/#[\p{L}\d_-]+/gu, '').replace(/\s{2,}/g, ' ').trim();
                tags = Array.from(new Set([...tags, ...extra]));
            }

            if (!nombre) {
                showToast('Por favor, ingresa un nombre de actividad.', 'error');
                return;
            }

            // Modo edición vs. alta
            const isEdit = popupForm.dataset.mode === 'edit';
            if (isEdit) {
                const editingId = popupForm.dataset.editingId;
                // anexar adjuntos nuevos a la tarea existente
                const data = findTask(editingId);
                const hadNewAtts = newAttachments && newAttachments.length > 0;
                if (data) {
                    data.task.attachments = (data.task.attachments || []).concat(newAttachments);
                    // actualizar orderCode si llegó algo en el formulario
                    if (typeof orderCode === 'string') data.task.orderCode = orderCode;
                }
                updateTask(editingId, nombre, categoria, tags, reminderAt);
                // Si se han añadido adjuntos, realizar una sincronización completa para subirlos primero
                const needsFullSync = hadNewAtts && (accessToken || isNextcloudConfigured());
                if (needsFullSync) {
                    try { performFullSync(); } catch(_) {}
                }
            } else {
                addTask(categoria, nombre, tags, reminderAt);
                // anexar adjuntos a la última tarea creada en la categoría
                const arr = categories[categoria];
                const t = arr[arr.length - 1];
                const toAttach = (newAttachments || []).concat(pendingReusedAttachments || []);
                t.attachments = (t.attachments || []).concat(toAttach);
                // asignar orderCode si se indicó
                if (typeof orderCode === 'string') t.orderCode = orderCode;
                pendingReusedAttachments = [];
                saveCategoriesToLocalStorage();
                renderTasks();
                const hasProvider = accessToken || isNextcloudConfigured();
                if (hasProvider) {
                    if (toAttach.length > 0) {
                        try { performFullSync(); } catch(_) {
                            if (accessToken) syncToDropbox(false);
                            if (isNextcloudConfigured()) syncToNextcloud(false);
                        }
                    } else {
                        if (accessToken) syncToDropbox(false);
                        if (isNextcloudConfigured()) syncToNextcloud(false);
                    }
                }
            }

            taskNameInput.value = '';
            tagsInput.value = '';
            if (reminderInput) reminderInput.value = '';
            if (orderInput) orderInput.value = '';
            if (filesInput) filesInput.value = '';
            resetPopupFormMode();
            popupForm.closest('.modal').style.display = 'none';
        });
        // Actualizar chips al teclear manualmente
        tagsInput.addEventListener('input', renderTagSuggestions);
    }

    // Lógica de Dropbox
    document.getElementById('dropbox-login')?.addEventListener('click', () => {
        const redirectUri = getDropboxRedirectUri();
        console.log('🔍 URL de redirección:', redirectUri);
        startDropboxAuth();
    });
    document.getElementById('dropbox-sync')?.addEventListener('click', performFullSync);

    // Lógica de Backup/Restore y Limpieza
    // ... (Aquí irían los listeners para backup-btn, restore-btn, etc., que ya tenías)

    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('¿Borrar todos los datos locales y cache?')) {
                localStorage.clear();
                if ('caches' in window) {
                    caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
                }
                showToast('Datos borrados. La página se recargará.');
                setTimeout(() => location.reload(), 1000);
            }
        });
    }

    // Atajo de teclado para añadir nueva tarea (Ctrl+N o Cmd+N)
    document.addEventListener('keydown', function(e) {
        // Solo activar si NO estamos en un input, textarea o select
        const tag = document.activeElement.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

        // Atajo: Alt+N (menos conflictivo y funciona en ambos navegadores)
        if (e.altKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const popup = document.getElementById('popup-tarea');
            if (popup) {
                resetPopupFormMode();
                popup.style.display = 'flex';
                const input = document.getElementById('popup-task-name');
                if (input) input.focus();
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        let handled = false;
        if (shortcutsModal && shortcutsModal.style.display === 'flex') {
            closeShortcutsModal();
            handled = true;
        }
        if (popup && popup.style.display === 'flex') {
            resetPopupFormMode();
            popup.style.display = 'none';
            handled = true;
        }
        if (handled) {
            e.preventDefault();
        }
    });

    // Iniciar el flujo de autenticación de Dropbox
    handleAuthCallback();

    // Cerrar lightbox al hacer click fuera o con Escape
    const lb = document.getElementById('image-lightbox');
    if (lb) {
        lb.addEventListener('click', (e)=>{ if (e.target === lb) closeImageLightbox(); });
        document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeImageLightbox(); });
    }

    document.getElementById('filter-tag')?.addEventListener('change', (e) => {
        try { localStorage.setItem(LS.selectedFilterTag, e.target.value || ''); } catch (_) {}
        renderTasks();
    });
    document.getElementById('filter-search')?.addEventListener('input', (e) => {
        try { localStorage.setItem(LS.searchQuery, e.target.value || ''); } catch (_) {}
        renderTasks();
    });
    document.getElementById('filter-column')?.addEventListener('change', (e) => {
        const sel = e.currentTarget;
        const values = Array.from(sel.selectedOptions || []).map(o => o.value).filter(v => v);
        try { localStorage.setItem(LS.visibleColumn, JSON.stringify(values)); } catch (_) {}
        renderTasks();
    });
    document.getElementById('filter-column-apply')?.addEventListener('click', () => {
        const group = document.getElementById('filter-column-group');
        if (!group) return;
        const values = Array.from(group.querySelectorAll('input[type="checkbox"]:checked'))
            .map(i => i.dataset.col)
            .filter(Boolean);
        try { localStorage.setItem(LS.visibleColumn, JSON.stringify(values)); } catch (_) {}
        renderTasks();
    });
    document.getElementById('filter-column-reset')?.addEventListener('click', () => {
        const group = document.getElementById('filter-column-group');
        if (group) Array.from(group.querySelectorAll('input[type="checkbox"]')).forEach(i => i.checked = false);
        try { localStorage.removeItem(LS.visibleColumn); } catch (_) {}
        renderTasks();
    });

    // Botón para habilitar notificaciones
    document.getElementById('enable-notifications')?.addEventListener('click', async () => {
        try {
            if (!('Notification' in window)) {
                showToast('Notificaciones no soportadas en este navegador', 'error');
                return;
            }
            let perm = Notification.permission;
            if (perm !== 'granted') {
                perm = await Notification.requestPermission();
            }
            if (perm === 'granted') {
                localStorage.setItem(LS.notificationsEnabled, 'true');
                showToast('Notificaciones habilitadas ✅');
            } else {
                localStorage.setItem(LS.notificationsEnabled, 'false');
                showToast('Permiso de notificaciones denegado', 'error');
            }
        } catch (e) {
            console.error('Error solicitando notificaciones', e);
            showToast('No se pudo solicitar notificaciones', 'error');
        }
    });

    // Drag & Drop para tareas
    document.addEventListener('dragstart', function(e) {
        const taskEl = e.target.closest?.('.task');
        if (taskEl && taskEl.dataset.id) {
            e.dataTransfer.setData('text/plain', taskEl.dataset.id);
        }
    });

    // No añadimos DnD de reordenación interna; el orden lo fija orderCode

    // Acceso rápido: si llega con ?quick=1 abrir directamente el popup de nueva tarea
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('quick')) {
            resetPopupFormMode();
            popup.style.display = 'flex';
            const input = document.getElementById('popup-task-name');
            if (input) input.focus();
            updateTagDatalist();
            renderTagSuggestions();
        }
        if (params.has('admin')) {
            const adminModal = document.getElementById('admin-modal');
            if (adminModal) adminModal.style.display = 'flex';
            if (categoryNameAdmin && categoryNameAdmin.applyValues) categoryNameAdmin.applyValues();
        }
    } catch (_) {}

    // getAllTags y updateTagFilterDropdown ahora son globales
    // Mostrar recordatorios vencidos al abrir la app
    checkDueRemindersAndAlertOnce();
    // Ajustar visibilidad de sincronización según conectividad
    updateSyncGroupVisibility();
    window.addEventListener('online', updateSyncGroupVisibility);
    window.addEventListener('offline', updateSyncGroupVisibility);

    // Aplicar idioma al cargar
    if (window.i18n && i18n.applyI18nAll) {
        i18n.applyI18nAll();
    }

    // Administración: abrir/cerrar modal
    const adminModal = document.getElementById('admin-modal');
    const openAdmin = document.getElementById('open-admin');
    const closeAdmin = document.getElementById('admin-close');
    if (openAdmin && adminModal) openAdmin.addEventListener('click', ()=> {
        adminModal.style.display = 'flex';
        if (categoryNameAdmin && categoryNameAdmin.applyValues) categoryNameAdmin.applyValues();
    });
    if (closeAdmin && adminModal) closeAdmin.addEventListener('click', ()=> { adminModal.style.display = 'none'; });
    if (adminModal) adminModal.addEventListener('click', (e)=>{ if (e.target === adminModal) adminModal.style.display = 'none'; });

    // ==========================
    // Atajos de velocidad media
    // ==========================
    // Mantener referencia al último <audio>/<video> activo (clic/foco)
    let lastActiveMediaEl = null;
    const setLastActiveMedia = (el) => { try { if (el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO')) lastActiveMediaEl = el; } catch (_) {} };
    document.addEventListener('focusin', (e) => {
        const t = e.target;
        if (t && (t.tagName === 'AUDIO' || t.tagName === 'VIDEO')) setLastActiveMedia(t);
    }, true);
    document.addEventListener('pointerdown', (e) => {
        const t = (e.target && (e.target.closest ? e.target.closest('audio,video') : null)) || null;
        if (t) setLastActiveMedia(t);
    }, true);

    // Actualiza todas las etiquetas de velocidad visibles para un medio
    const updateMediaSpeedLabels = (mediaEl) => {
        try {
            if (!mediaEl) return;
            const rate = (mediaEl.playbackRate || 1);
            const label = `${rate.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`;
            const attId = mediaEl.getAttribute('data-att-id') || '';
            if (!attId) return;
            if (mediaEl.tagName === 'AUDIO') {
                document.querySelectorAll(`span.audio-speed-label[data-att-id="${attId}"]`).forEach(el => el.textContent = label);
            } else if (mediaEl.tagName === 'VIDEO') {
                document.querySelectorAll(`span.video-speed-label[data-att-id="${attId}"]`).forEach(el => el.textContent = label);
            }
        } catch (_) {}
    };

    // Cambia la velocidad con paso progresivo (clamp 0.25–3.0)
    const nudgePlaybackRate = (mediaEl, delta) => {
        try {
            if (!mediaEl) return;
            adjustMediaPlaybackRate(mediaEl, delta, () => updateMediaSpeedLabels(mediaEl));
        } catch (_) {}
    };

    // Atajos:
    // - Alt+ArrowUp / Alt+ArrowDown: sube/baja el paso configurado para el último medio activo
    // - Cuando un <audio>/<video> tiene el foco: '.' sube y ',' baja el paso configurado
    document.addEventListener('keydown', (e) => {
        const activeTag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
        const isTypingTarget = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || (document.activeElement && document.activeElement.isContentEditable);

        // Determinar medio objetivo
        let targetMedia = null;
        if (document.activeElement && (document.activeElement.tagName === 'AUDIO' || document.activeElement.tagName === 'VIDEO')) {
            targetMedia = document.activeElement;
        } else {
            targetMedia = lastActiveMediaEl;
        }
        // Si no hay medio activo, salir para no interferir
        if (!targetMedia) return;

        // Atajos globales con Alt: no actuar cuando el usuario escribe en inputs
        if (e.altKey && !isTypingTarget) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                nudgePlaybackRate(targetMedia, +MEDIA_RATE_STEP);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                nudgePlaybackRate(targetMedia, -MEDIA_RATE_STEP);
            }
        }

        // Atajos locales cuando el medio tiene el foco: '.' y ','
        if (document.activeElement === targetMedia && !e.altKey && !e.ctrlKey && !e.metaKey) {
            if (e.key === '.') {
                e.preventDefault();
                nudgePlaybackRate(targetMedia, +MEDIA_RATE_STEP);
            } else if (e.key === ',') {
                e.preventDefault();
                nudgePlaybackRate(targetMedia, -MEDIA_RATE_STEP);
            }
        }
    });
});

// Muestra un popup con recordatorios vencidos al abrir
function checkDueRemindersAndAlertOnce() {
    const now = Date.now();
    const due = [];
    let needsSave = false;
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const task of tasks) {
            if (!task) continue;
            if (task.completed) continue;
            if (!task.reminderAt) continue;
            if (task.reminderDone) continue;
            const when = Date.parse(task.reminderAt);
            if (!isNaN(when) && when <= now) {
                const names = getCategoryNames();
                due.push({ title: task.task, category: names[cat] || cat });
                task.reminderDone = true;
                task.lastModified = new Date().toISOString();
                needsSave = true;
            }
        }
    }
    if (needsSave) saveCategoriesToLocalStorage();
    if (due.length > 0) {
        const lines = due.map(d => `• ${d.title} (${d.category})`).join('\n');
        alert(`Tienes ${due.length} recordatorio(s) vencido(s):\n\n${lines}`);
    }
}

// --- RECORDATORIOS ---
async function showLocalNotification(title, options = {}) {
    try {
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration && Notification.permission === 'granted') {
            return registration.showNotification(title, options);
        }
    } catch (_) {}
    if (Notification.permission === 'granted') {
        return new Notification(title, options);
    }
}

function checkDueReminders() {
    const enabled = localStorage.getItem(LS.notificationsEnabled) === 'true';
    // Si soporta triggers y hay permiso, delegamos en ellos y no hacemos polling
    if (enabled && supportsNotificationTriggers() && Notification.permission === 'granted') return;
    const now = Date.now();
    let needsSave = false;
    if (!enabled || !('Notification' in window)) return;

    for (const [cat, tasks] of Object.entries(categories)) {
        for (const task of tasks) {
            if (!task) continue;
            if (task.completed) continue;
            if (!task.reminderAt) continue;
            if (task.reminderDone) continue;
            const when = Date.parse(task.reminderAt);
            if (!isNaN(when) && when <= now) {
                const names = getCategoryNames();
                const body = `Categoría: ${names[cat] || cat}`;
                showLocalNotification((window.i18n&&i18n.t)?i18n.t('notification_title'):'Recordatorio de actividad', {
                    body: `${task.task}\n${body}`,
                    icon: 'icons/icon-192.png',
                    tag: `reminder-${task.id}`,
                    data: { taskId: task.id }
                });
                task.reminderDone = true;
                task.lastModified = new Date().toISOString();
                needsSave = true;
            }
        }
    }
    if (needsSave) {
        saveCategoriesToLocalStorage();
    }
}

let reminderInterval = null;
function startReminderPolling() {
    if (reminderInterval) clearInterval(reminderInterval);
    // Comprobar inmediatamente y luego cada 30 segundos
    checkDueReminders();
    reminderInterval = setInterval(checkDueReminders, 30000);
}

function supportsNotificationTriggers() {
    try {
        // showTrigger es parte de las opciones; TimestampTrigger expone el constructor
        return (
            'Notification' in window &&
            'showTrigger' in Notification.prototype &&
            typeof TimestampTrigger !== 'undefined'
        );
    } catch (_) { return false; }
}

async function tryScheduleTaskTrigger(task, categoryKey) {
    try {
        if (!task || !task.reminderAt) return;
        if (!supportsNotificationTriggers()) return;
        if (Notification.permission !== 'granted') return;
        const when = Date.parse(task.reminderAt);
        if (isNaN(when)) return;
        if (when <= Date.now() + 1000) return; // No programar pasado o inmediato
        if (task.triggerScheduledAt === task.reminderAt) return; // Ya programado
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) return;
        await reg.showNotification((window.i18n&&i18n.t)?i18n.t('notification_title'):'Recordatorio de actividad', {
            body: `${task.task}\nCategoría: ${(getCategoryNames()[categoryKey] || '')}`.trim(),
            tag: `reminder-${task.id}`,
            icon: 'icons/icon-192.png',
            showTrigger: new TimestampTrigger(when),
            data: { taskId: task.id, category: categoryKey }
        });
        task.triggerScheduledAt = task.reminderAt;
        saveCategoriesToLocalStorage();
    } catch (e) {
        console.warn('No se pudo programar trigger:', e);
    }
}

function schedulePendingTriggers() {
    if (!supportsNotificationTriggers()) return;
    if (Notification.permission !== 'granted') return;
    for (const [cat, tasks] of Object.entries(categories)) {
        for (const t of tasks) {
            if (!t || t.completed) continue;
            if (!t.reminderAt) continue;
            if (t.triggerScheduledAt === t.reminderAt) continue;
            tryScheduleTaskTrigger(t, cat);
        }
    }
}
