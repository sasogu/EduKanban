document.addEventListener('DOMContentLoaded', function() {
    const LS = {
        categories: 'edukanban.categories',
        token: 'edukanban.dropbox_access_token',
        deleted: 'edukanban.deletedTasks',
        selectedFilterTag: 'edukanban.selectedFilterTag',
        searchQuery: 'edukanban.searchQuery',
        tagFilterMode: 'edukanban.tagFilterMode'
    };
    const container = document.getElementById('resources-container');
    if (!container) return;
    const filterTagSelect = document.getElementById('filter-tag');
    const filterSearchInput = document.getElementById('filter-search');
    const filterTagModeSelect = document.getElementById('filter-tag-mode');

    const NEXTCLOUD_KEYS = { config: 'edukanban.nextcloudConfig' };
    const CATEGORY_OVERRIDES_KEY = 'edukanban.categoryNameOverrides';
    const DEFAULT_CATEGORY_NAMES = (window.i18n && i18n.DEFAULT_CATEGORY_NAMES) ? i18n.DEFAULT_CATEGORY_NAMES : {
        'en-preparacion': 'En preparación',
        'preparadas': 'Preparadas',
        'en-proceso': 'En proceso',
        'pendientes': 'Pendientes',
        'archivadas': 'Archivadas'
    };

    function decodeBase64ToUtf8(b64) {
        if (!b64) return '';
        try {
            const binary = atob(b64);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            return new TextDecoder().decode(bytes);
        } catch (_) {
            try { return decodeURIComponent(escape(atob(b64))); } catch(__) { return ''; }
        }
    }

    function loadNextcloudConfig() {
        try {
            const raw = localStorage.getItem(NEXTCLOUD_KEYS.config);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const baseUrl = (parsed.baseUrl || '').trim().replace(/\/+$/, '');
            const username = (parsed.username || '').trim();
            const folder = (parsed.folder || '').trim();
            const password = decodeBase64ToUtf8(parsed.password || '');
            const resolvedBaseUrl = (parsed.resolvedBaseUrl || '').trim();
            if (!baseUrl || !username || !password) return null;
            return { baseUrl, username, password, folder, resolvedBaseUrl: resolvedBaseUrl || null };
        } catch (err) {
            console.warn('loadNextcloudConfig', err);
            return null;
        }
    }

    function isNextcloudConfigured(conf) {
        return !!(conf && conf.baseUrl && conf.username && conf.password);
    }

    function makeNextcloudAuthHeader(conf) {
        if (!conf) return '';
        try {
            const token = btoa(String.fromCharCode(...new TextEncoder().encode(`${conf.username}:${conf.password}`)));
            return `Basic ${token}`;
        } catch (_) {
            const fallback = btoa(unescape(encodeURIComponent(`${conf.username}:${conf.password}`)));
            return `Basic ${fallback}`;
        }
    }

    function getResolvedNextcloudBase(conf) {
        if (!conf) return '';
        const explicit = conf.resolvedBaseUrl && conf.resolvedBaseUrl.trim();
        if (explicit) return explicit.replace(/\/+$/, '');
        const base = (conf.baseUrl || '').trim().replace(/\/+$/, '');
        if (!base) return '';
        if (/remote\.php\/dav/i.test(base)) return base;
        if (conf.username) {
            return `${base}/remote.php/dav/files/${encodeURIComponent(conf.username)}`;
        }
        return base;
    }

    function nextcloudPathToSegments(path) {
        return String(path || '').split('/').map(part => part.trim()).filter(Boolean);
    }

    function buildNextcloudUrl(conf, segments = []) {
        const basePath = getResolvedNextcloudBase(conf);
        if (!basePath) return '';
        const extra = [];
        (Array.isArray(segments) ? segments : [segments]).forEach(seg => {
            const pieces = Array.isArray(seg) ? seg : String(seg).split('/');
            pieces.forEach(piece => {
                const trimmed = String(piece || '').trim();
                if (trimmed) extra.push(encodeURIComponent(trimmed));
            });
        });
        return extra.length ? `${basePath}/${extra.join('/')}` : basePath;
    }

    function sanitizeName(value) {
        if (typeof value !== 'string') return '';
        return value.replace(/\s+/g, ' ').trim().slice(0, 80);
    }

    function getLocalOverrides() {
        try {
            const raw = localStorage.getItem(CATEGORY_OVERRIDES_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            const out = {};
            Object.keys(DEFAULT_CATEGORY_NAMES).forEach(key => {
                const val = sanitizeName(parsed && parsed[key]);
                if (val) out[key] = val;
            });
            return out;
        } catch (_) {
            return {};
        }
    }

    function getCategoryNames() {
        if (window.i18n && typeof i18n.getEffectiveCategoryNames === 'function') {
            return i18n.getEffectiveCategoryNames();
        }
        return Object.assign({}, DEFAULT_CATEGORY_NAMES, getLocalOverrides());
    }

    function escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;');
    }

    function isImageType(mime) {
        return typeof mime === 'string' && mime.startsWith('image/');
    }

    function isPdfAttachment(att) {
        try {
            const name = (att && att.name || '').toLowerCase();
            const type = (att && att.type || '').toLowerCase();
            return type.includes('pdf') || name.endsWith('.pdf');
        } catch (_) {
            return false;
        }
    }

    function isImageAttachment(att) {
        try {
            if (att && att.isImage) return true;
            const type = (att && att.type) ? att.type.toLowerCase() : '';
            const name = (att && att.name) ? att.name.toLowerCase() : '';
            return isImageType(type) || /\.(png|jpe?g|gif|bmp|webp|svg)$/.test(name);
        } catch (_) {
            return false;
        }
    }

    function isAudioAttachment(att) {
        try {
            const name = (att && att.name || '').toLowerCase();
            const type = (att && att.type || '').toLowerCase();
            if (type.startsWith('audio/')) return true;
            return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.weba'].some(ext => name.endsWith(ext));
        } catch (_) {
            return false;
        }
    }

    function isVideoAttachment(att) {
        try {
            const name = (att && att.name || '').toLowerCase();
            const type = (att && att.type || '').toLowerCase();
            if (type.startsWith('video/')) return true;
            return ['.mp4', '.m4v', '.mov', '.webm', '.ogv', '.mkv'].some(ext => name.endsWith(ext));
        } catch (_) {
            return false;
        }
    }

    let __attDBPromise = null;
    const activeObjectUrls = new Set();

    function trackObjectUrl(url) {
        if (url) activeObjectUrls.add(url);
    }

    function cleanupObjectUrls() {
        activeObjectUrls.forEach(url => {
            try { URL.revokeObjectURL(url); } catch (_) {}
        });
        activeObjectUrls.clear();
    }

    function openAttachmentsDB() {
        if (__attDBPromise) return __attDBPromise;
        __attDBPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('edukanban.attachments', 1);
            req.onupgradeneeded = (event) => {
                const db = event.target.result;
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
        try {
            const db = await openAttachmentsDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('files', 'readwrite');
                tx.objectStore('files').put(blob, id);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('putAttachmentBlob', err);
            return false;
        }
    }

    async function getAttachmentBlob(id) {
        try {
            const db = await openAttachmentsDB();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('files', 'readonly');
                const req = tx.objectStore('files').get(id);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (err) {
            console.warn('getAttachmentBlob', err);
            return null;
        }
    }

    function getCurrentBasePath() {
        const path = window.location.pathname || '/';
        const idx = path.lastIndexOf('/');
        return idx >= 0 ? path.slice(0, idx + 1) : '/';
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
        } catch (_) {
            return '';
        }
    }

    async function ensureAttachmentBlob(att) {
        if (!att || !att.id) return null;
        try {
            let blob = await getAttachmentBlob(att.id);
            if (blob && isPdfAttachment(att) && blob.type !== 'application/pdf') {
                blob = new Blob([blob], { type: 'application/pdf' });
                await putAttachmentBlob(att.id, blob);
            }
            if (blob) return blob;
        } catch (err) {
            console.warn('ensureAttachmentBlob cache', err);
        }

        const token = localStorage.getItem(LS.token);
        if (token && att.dropboxPath) {
            try {
                const res = await fetch('https://content.dropboxapi.com/2/files/download', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Dropbox-API-Arg': JSON.stringify({ path: att.dropboxPath })
                    }
                });
                if (res.ok) {
                    const raw = await res.blob();
                    const desiredType = isPdfAttachment(att) ? 'application/pdf' : (att.type || raw.type || 'application/octet-stream');
                    const blob = new Blob([raw], { type: desiredType });
                    await putAttachmentBlob(att.id, blob);
                    return blob;
                }
            } catch (err) {
                console.warn('ensureAttachmentBlob dropbox', err);
            }
        }

        const ncConf = loadNextcloudConfig();
        if (isNextcloudConfigured(ncConf) && att.nextcloudPath) {
            const url = buildNextcloudUrl(ncConf, nextcloudPathToSegments(att.nextcloudPath));
            try {
                const res = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': makeNextcloudAuthHeader(ncConf),
                        'Cache-Control': 'no-cache'
                    }
                });
                if (res.ok) {
                    const raw = await res.blob();
                    const desiredType = isPdfAttachment(att) ? 'application/pdf' : (att.type || raw.type || 'application/octet-stream');
                    const blob = new Blob([raw], { type: desiredType });
                    await putAttachmentBlob(att.id, blob);
                    return blob;
                }
            } catch (err) {
                console.warn('ensureAttachmentBlob nextcloud', err);
            }
        }
        return null;
    }

    async function getDropboxTemporaryLink(path) {
        const token = localStorage.getItem(LS.token);
        if (!token || !path) return null;
        try {
            const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path })
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data && data.link;
        } catch (err) {
            console.warn('temporary link error', err);
            return null;
        }
    }

    async function getAttachmentUrl(att) {
        const blob = await ensureAttachmentBlob(att);
        if (blob) {
            const url = URL.createObjectURL(blob);
            trackObjectUrl(url);
            return { url, blob };
        }
        const remoteUrl = await getDropboxTemporaryLink(att.dropboxPath);
        return remoteUrl ? { url: remoteUrl, blob: null } : { url: '', blob: null };
    }

    async function openPdfAttachment(att) {
        const result = await getAttachmentUrl(att);
        if (!result.url) return;
        if (result.blob) {
            const viewerHref = new URL(getCurrentBasePath() + 'pdf-viewer.html', window.location.origin).toString();
            const popup = window.open(viewerHref, '_blank');
            const blobUrl = result.url;
            if (popup) {
                const trySend = () => { try { popup.postMessage({ type: 'OPEN_PDF_URL', url: blobUrl }, '*'); } catch (_) {} };
                setTimeout(trySend, 200);
                setTimeout(trySend, 1000);
            } else {
                window.open(blobUrl, '_blank');
            }
            if (result.blob) {
                registerTempPdfUrl(result.blob).then((httpUrl) => {
                    if (httpUrl && popup) {
                        try { popup.postMessage({ type: 'OPEN_PDF_URL', url: httpUrl }, '*'); } catch (_) {}
                    }
                });
            }
            return;
        }
        window.open(result.url, '_blank');
    }

    function renderAttachmentsHtml(task) {
        const attachments = Array.isArray(task.attachments) ? task.attachments : [];
        if (!attachments.length) return '';
        const items = attachments.map(att => {
            const attId = escapeAttr(att.id || '');
            const safeName = escapeAttr(att.name || 'archivo');
            if (isImageAttachment(att)) {
                return `<img class="attachment-img" data-att-id="${attId}" alt="${safeName}">`;
            }
            if (isAudioAttachment(att)) {
                return `<div class="attachment-audio-wrap"><audio class="attachment-audio" data-att-id="${attId}" controls preload="metadata"></audio><div class="media-controls"><span class="audio-speed"><button type="button" class="audio-speed-down" data-att-id="${attId}" title="Más lento">−</button><span class="audio-speed-label" data-att-id="${attId}">1x</span><button type="button" class="audio-speed-up" data-att-id="${attId}" title="Más rápido">+</button></span></div></div>`;
            }
            if (isVideoAttachment(att)) {
                return `<div class="attachment-video-wrap"><video class="attachment-video" data-att-id="${attId}" controls preload="metadata"></video><div class="media-controls"><span class="video-speed"><button type="button" class="video-speed-down" data-att-id="${attId}" title="Más lento">−</button><span class="video-speed-label" data-att-id="${attId}">1x</span><button type="button" class="video-speed-up" data-att-id="${attId}" title="Más rápido">+</button></span></div></div>`;
            }
            const extra = isPdfAttachment(att) ? ` <a class="attachment-dl" data-att-id="${attId}" href="#" title="Descargar">⬇️</a>` : '';
            return `<span class="attachment-wrap"><a class="attachment-file" data-att-id="${attId}" href="#" title="${safeName}">📎 ${safeName}</a>${extra}</span>`;
        });
        return `<div class="attachments">${items.join('')}</div>`;
    }

    async function hydrateResourceAttachments(taskEl, task) {
        const attachments = Array.isArray(task.attachments) ? task.attachments : [];
        if (!attachments.length) return;
        for (const att of attachments) {
            const selectorId = att.id ? att.id.replace(/"/g, '\\"') : '';
            const idSel = `[data-att-id="${selectorId}"]`;
            const imgEl = taskEl.querySelector(`img.attachment-img${idSel}`);
            const audioEl = taskEl.querySelector(`audio.attachment-audio${idSel}`);
            const videoEl = taskEl.querySelector(`video.attachment-video${idSel}`);
            const fileEl = taskEl.querySelector(`a.attachment-file${idSel}`);
            const dlEl = taskEl.querySelector(`a.attachment-dl${idSel}`);

            if (!imgEl && !audioEl && !videoEl && !fileEl && !dlEl) continue;

            const { url, blob } = await getAttachmentUrl(att);
            const unavailableMsg = 'Adjunto no disponible';

            const ensureMediaSrc = (mediaEl, mediaUrl, hasBlob) => {
                if (!mediaEl || !mediaUrl) return;
                mediaEl.pause?.();
                if (!hasBlob) {
                    try { mediaEl.crossOrigin = mediaEl.crossOrigin || 'anonymous'; } catch (_) {}
                    try { mediaEl.setAttribute('crossorigin', 'anonymous'); } catch (_) {}
                }
                mediaEl.removeAttribute('src');
                mediaEl.innerHTML = '';
                if (att && att.type) {
                    try {
                        const srcEl = document.createElement('source');
                        srcEl.src = mediaUrl;
                        srcEl.type = att.type;
                        if (!hasBlob) srcEl.setAttribute('crossorigin', 'anonymous');
                        mediaEl.appendChild(srcEl);
                    } catch (_) {}
                    mediaEl.setAttribute('data-mime', att.type);
                }
                mediaEl.src = mediaUrl;
                mediaEl.controls = true;
                mediaEl.preload = 'metadata';
                mediaEl.style.display = 'block';
                try { mediaEl.load(); } catch (_) {}
                if (!mediaEl.dataset.errBound) {
                    mediaEl.addEventListener('error', () => {
                        console.warn('Archivo media load error', att && att.id, mediaEl.error);
                    }, { once: true });
                    mediaEl.dataset.errBound = '1';
                }
            };

            if (imgEl) {
                if (url) {
                    imgEl.src = url;
                    imgEl.style.cursor = 'zoom-in';
                    if (!imgEl.dataset.bound) {
                        imgEl.addEventListener('click', () => window.open(url, '_blank'));
                        imgEl.dataset.bound = '1';
                    }
                } else {
                    const span = document.createElement('span');
                    span.textContent = unavailableMsg;
                    imgEl.replaceWith(span);
                }
            }

            if (audioEl) {
                if (url) {
                    ensureMediaSrc(audioEl, url, !!blob);
                    if (typeof window.bindPitchPersistence === 'function') {
                        window.bindPitchPersistence(audioEl);
                    }
                } else {
                    const span = document.createElement('span');
                    span.textContent = 'Audio no disponible';
                    if (audioEl.parentElement) audioEl.parentElement.replaceWith(span);
                }
            }

            if (videoEl) {
                if (url) {
                    ensureMediaSrc(videoEl, url, !!blob);
                    try { videoEl.setAttribute('playsinline', ''); } catch (_) {}
                    if (typeof window.bindPitchPersistence === 'function') {
                        window.bindPitchPersistence(videoEl);
                    }
                } else {
                    const span = document.createElement('span');
                    span.textContent = 'Vídeo no disponible';
                    if (videoEl.parentElement) videoEl.parentElement.replaceWith(span);
                }
            }

            const speedDownBtn = taskEl.querySelector(`button.audio-speed-down${idSel}`);
            const speedUpBtn = taskEl.querySelector(`button.audio-speed-up${idSel}`);
            const speedLabel = taskEl.querySelector(`span.audio-speed-label${idSel}`);
            const updateSpeedLabel = () => {
                try {
                    if (audioEl && speedLabel) {
                        speedLabel.textContent = `${(audioEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`;
                    }
                } catch (_) {}
            };
            if (audioEl) {
                updateSpeedLabel();
                if (!audioEl.dataset.speedLabelBound) {
                    audioEl.addEventListener('ratechange', updateSpeedLabel);
                    audioEl.dataset.speedLabelBound = '1';
                }
            }
            if (speedDownBtn && !speedDownBtn.dataset.bound) {
                speedDownBtn.addEventListener('click', () => {
                    if (!audioEl || typeof window.adjustMediaPlaybackRate !== 'function') return;
                    const step = Number(window.MEDIA_RATE_STEP) || 0.05;
                    window.adjustMediaPlaybackRate(audioEl, -step, updateSpeedLabel);
                });
                speedDownBtn.dataset.bound = '1';
            }
            if (speedUpBtn && !speedUpBtn.dataset.bound) {
                speedUpBtn.addEventListener('click', () => {
                    if (!audioEl || typeof window.adjustMediaPlaybackRate !== 'function') return;
                    const step = Number(window.MEDIA_RATE_STEP) || 0.05;
                    window.adjustMediaPlaybackRate(audioEl, step, updateSpeedLabel);
                });
                speedUpBtn.dataset.bound = '1';
            }

            const vSpeedDownBtn = taskEl.querySelector(`button.video-speed-down${idSel}`);
            const vSpeedUpBtn = taskEl.querySelector(`button.video-speed-up${idSel}`);
            const vSpeedLabel = taskEl.querySelector(`span.video-speed-label${idSel}`);
            const updateVideoSpeedLabel = () => {
                try {
                    if (videoEl && vSpeedLabel) {
                        vSpeedLabel.textContent = `${(videoEl.playbackRate || 1).toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}x`;
                    }
                } catch (_) {}
            };
            if (videoEl) {
                updateVideoSpeedLabel();
                if (!videoEl.dataset.speedLabelBound) {
                    videoEl.addEventListener('ratechange', updateVideoSpeedLabel);
                    videoEl.dataset.speedLabelBound = '1';
                }
            }
            if (vSpeedDownBtn && !vSpeedDownBtn.dataset.bound) {
                vSpeedDownBtn.addEventListener('click', () => {
                    if (!videoEl || typeof window.adjustMediaPlaybackRate !== 'function') return;
                    const step = Number(window.MEDIA_RATE_STEP) || 0.05;
                    window.adjustMediaPlaybackRate(videoEl, -step, updateVideoSpeedLabel);
                });
                vSpeedDownBtn.dataset.bound = '1';
            }
            if (vSpeedUpBtn && !vSpeedUpBtn.dataset.bound) {
                vSpeedUpBtn.addEventListener('click', () => {
                    if (!videoEl || typeof window.adjustMediaPlaybackRate !== 'function') return;
                    const step = Number(window.MEDIA_RATE_STEP) || 0.05;
                    window.adjustMediaPlaybackRate(videoEl, step, updateVideoSpeedLabel);
                });
                vSpeedUpBtn.dataset.bound = '1';
            }

            if (fileEl) {
                if (url) {
                    fileEl.href = url;
                    fileEl.target = '_blank';
                    if (blob) {
                        fileEl.download = att.name || 'archivo';
                    }
                } else {
                    fileEl.removeAttribute('href');
                    fileEl.classList.add('disabled');
                    fileEl.title = unavailableMsg + ' sin conexión';
                }
                if (!fileEl.dataset.bound) {
                    if (isPdfAttachment(att)) {
                        fileEl.addEventListener('click', async (e) => {
                            e.preventDefault();
                            await openPdfAttachment(att);
                        });
                    }
                    fileEl.dataset.bound = '1';
                }
            }

            if (dlEl) {
                if (url) {
                    dlEl.href = url;
                    dlEl.target = '_blank';
                    if (blob) dlEl.download = att.name || 'archivo';
                } else {
                    dlEl.removeAttribute('href');
                    dlEl.classList.add('disabled');
                    dlEl.title = unavailableMsg + ' sin conexión';
                }
                if (!dlEl.dataset.bound && isPdfAttachment(att)) {
                    dlEl.addEventListener('click', async (e) => {
                        e.preventDefault();
                        const result = await getAttachmentUrl(att);
                        if (!result.url) return;
                        const a = document.createElement('a');
                        a.href = result.url;
                        if (result.blob) {
                            a.download = att.name || 'archivo.pdf';
                        } else {
                            a.target = '_blank';
                        }
                        a.click();
                    });
                    dlEl.dataset.bound = '1';
                }
            }
        }
    }

    window.addEventListener('beforeunload', cleanupObjectUrls);

    function convertirEnlaces(texto) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return texto.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    function formatDateTime(iso) {
        if (!iso) return '';
        try {
            const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
            return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) {
            return iso;
        }
    }

    function normalizeKey(k){
        const m={
            'bandeja-de-entrada':'en-preparacion',
            'prioritaria':'preparadas',
            'proximas':'en-proceso',
            'algun-dia':'pendientes',
            'en-preparacion':'en-preparacion',
            'preparadas':'preparadas',
            'en-proceso':'en-proceso',
            'pendientes':'pendientes',
            'archivadas':'archivadas'
        };return m[k]||k;
    }

    function migrateObj(obj){
        const t={'en-preparacion':[],'preparadas':[],'en-proceso':[],'pendientes':[],'archivadas':[]};
        for(const k in obj){
            const nk=normalizeKey(k);
            if(Array.isArray(obj[k])){t[nk]=(t[nk]||[]).concat(obj[k]);}
        }
        return t;
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
            parts.push(task.attachments.map(att => (att && att.name) ? att.name : '').join(' '));
        }
        const haystack = normalizeSearchValue(parts.join(' '));
        return haystack.includes(searchNorm);
    }

    function readSelectedTagsFromStorage() {
        const raw = localStorage.getItem(LS.selectedFilterTag);
        if (!raw) return [];
        const trimmed = String(raw).trim();

        // Nuevo formato: JSON array
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map(String).map(s => s.trim()).filter(Boolean);
                }
            } catch (_) {
                // fallback abajo
            }
        }

        // Legacy: string
        return trimmed ? [trimmed] : [];
    }

    function persistSelectedTagsToStorage(selectedTags) {
        const clean = Array.isArray(selectedTags)
            ? [...new Set(selectedTags.map(String).map(s => s.trim()).filter(Boolean))]
            : [];
        try {
            localStorage.setItem(LS.selectedFilterTag, JSON.stringify(clean));
        } catch (_) {}
    }

    function getTagFilterMode() {
        const mode = localStorage.getItem(LS.tagFilterMode);
        return mode === 'and' ? 'and' : 'or';
    }

    function setTagFilterMode(mode) {
        try { localStorage.setItem(LS.tagFilterMode, mode === 'and' ? 'and' : 'or'); } catch (_) {}
    }

    function getAllTagsFromCategories(allCategories) {
        const tagsSet = new Set();
        Object.values(allCategories).forEach(tasks => {
            if (!Array.isArray(tasks)) return;
            tasks.forEach(task => {
                if (task && Array.isArray(task.tags)) {
                    task.tags.forEach(tag => tagsSet.add(tag));
                }
            });
        });
        return Array.from(tagsSet).sort();
    }

    function renderTagFilterCheckboxes(allTags) {
        // En recursos, #filter-tag es un contenedor (div) dentro de <details id="tag-filter">
        const host = document.getElementById('filter-tag');
        if (!host) return;

        const searchInput = document.getElementById('filter-tag-search');
        const clearBtn = document.getElementById('filter-tag-clear');
        const countEl = document.getElementById('tag-filter-count');

        const selected = new Set(readSelectedTagsFromStorage());
        const q = (searchInput?.value || '').trim().toLowerCase();

        const visible = (Array.isArray(allTags) ? allTags : []).filter(t => {
            const s = String(t || '');
            return s && (!q || s.toLowerCase().includes(q));
        });

        host.innerHTML = '';
        for (const tag of visible) {
            const safe = String(tag)
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9\-]/g, '')
                .toLowerCase();
            const id = `tag-${safe}`;

            const label = document.createElement('label');
            label.className = 'tag-filter-item';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = tag;
            cb.id = id;
            cb.checked = selected.has(tag);

            const text = document.createElement('span');
            text.className = 'tag-filter-text';
            text.textContent = tag;

            label.appendChild(cb);
            label.appendChild(text);
            host.appendChild(label);
        }

        if (countEl) countEl.textContent = selected.size ? `(${selected.size})` : '';

        // Bindings (idempotentes)
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = '1';
            searchInput.addEventListener('input', () => {
                renderTagFilterCheckboxes(allTags);
            });
        }

        if (clearBtn && !clearBtn.dataset.bound) {
            clearBtn.dataset.bound = '1';
            clearBtn.addEventListener('click', () => {
                persistSelectedTagsToStorage([]);
                if (searchInput) searchInput.value = '';
                renderTagFilterCheckboxes(allTags);
                renderResources();
            });
        }

        if (!host.dataset.bound) {
            host.dataset.bound = '1';
            host.addEventListener('change', (e) => {
                const t = e.target;
                if (!(t instanceof HTMLInputElement) || t.type !== 'checkbox') return;
                const next = new Set(readSelectedTagsFromStorage());
                if (t.checked) next.add(t.value);
                else next.delete(t.value);
                persistSelectedTagsToStorage(Array.from(next));
                renderTagFilterCheckboxes(allTags);
                renderResources();
            });
        }
    }

    function updateTagFilterDropdown(allCategories, currentValue = '') {
        // Compat: si alguien reintroduce un <select>, mantenemos la función.
        if (!filterTagSelect || filterTagSelect.tagName !== 'SELECT') return;
        const tags = getAllTagsFromCategories(allCategories);
        const showAll = (window.i18n && i18n.t) ? i18n.t('show_all') : 'Mostrar todo';
        const hasCurrent = currentValue && tags.includes(currentValue);
        const renderedTags = hasCurrent ? tags : [currentValue, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);
        filterTagSelect.innerHTML = [
            `<option value="">${showAll}</option>`,
            ...renderedTags.map(tag => `<option value="${tag}">${tag}</option>`)
        ].join('');
        filterTagSelect.value = currentValue || '';
    }

    function buildOrderOptions(selected) {
        const opts = [''].concat(Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)));
        const selUp = (selected || '').toUpperCase();
        return opts.map(code => {
            const label = code || '—';
            const sel = (selUp === code) ? ' selected' : '';
            return `<option value="${code}"${sel}>${label}</option>`;
        }).join('');
    }

    function compareTasksByOrder(a, b) {
        const A = (a.orderCode || '').toUpperCase();
        const B = (b.orderCode || '').toUpperCase();
        const aHas = A.length > 0;
        const bHas = B.length > 0;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
            if (A < B) return -1;
            if (A > B) return 1;
        }
        const ta = new Date(a.sortModifiedAt || a.lastModified || 0).getTime();
        const tb = new Date(b.sortModifiedAt || b.lastModified || 0).getTime();
        return tb - ta;
    }

    function findTaskInCategories(allCategories, taskId) {
        for (const category of Object.keys(allCategories)) {
            const list = allCategories[category];
            if (!Array.isArray(list)) continue;
            const taskIndex = list.findIndex(t => t && t.id === taskId);
            if (taskIndex > -1) {
                return { category, taskIndex, task: list[taskIndex] };
            }
        }
        return null;
    }

    function saveAllCategories(allCategories) {
        try { localStorage.setItem(LS.categories, JSON.stringify(allCategories)); } catch (_) {}
    }

    function setResourceTaskOrder(taskId, code) {
        // Si la función global del tablero está disponible, reutilizarla para
        // mantener sincronizado el estado en memoria de app.js y localStorage.
        if (typeof window.setTaskOrder === 'function') {
            try {
                window.setTaskOrder(taskId, code);
                renderResources();
                return;
            } catch (_) {}
        }

        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const allCategories = migrateObj(raw);
        const data = findTaskInCategories(allCategories, taskId);
        if (!data || !data.task) return;
        const normalized = String(code || '').trim().toUpperCase();
        data.task.orderCode = /^[A-Z]$/.test(normalized) ? normalized : '';
        const now = new Date().toISOString();
        data.task.lastModified = now;
        data.task.sortModifiedAt = now;
        saveAllCategories(allCategories);
        renderResources();
        if (typeof window.syncToDropbox === 'function') {
            try { window.syncToDropbox(false); } catch (_) {}
        }
        if (typeof window.syncToNextcloud === 'function') {
            try { window.syncToNextcloud(false); } catch (_) {}
        }
    }

    function removeTaskFromResources(taskId) {
        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const allCategories = migrateObj(raw);
        const data = findTaskInCategories(allCategories, taskId);
        if (!data) return;
        const title = data.task && data.task.task ? data.task.task : '';
        const msg = (window.i18n && i18n.t)
            ? i18n.t('confirm_delete_activity', { title })
            : (title ? `¿Estás seguro de que quieres eliminar la actividad "${title}"?` : '¿Estás seguro de que quieres eliminar esta actividad?');
        if (!window.confirm(msg)) return;
        const [removedTask] = allCategories[data.category].splice(data.taskIndex, 1);
        try {
            const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');
            deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });
            localStorage.setItem(LS.deleted, JSON.stringify(deletedTasks));
        } catch (_) {}
        saveAllCategories(allCategories);
        renderResources();
    }

    function openResourcesEditModal(taskId) {
        // Preferir el modal estándar compartido (app.js) si está disponible
        if (typeof window.openEditTask === 'function') {
            window.openEditTask(taskId);
            return;
        }
        try { console.warn('openEditTask no disponible en esta vista'); } catch (_) {}
    }

    function renderResources() {
        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const allCategories = migrateObj(raw);
        try { localStorage.setItem(LS.categories, JSON.stringify(allCategories)); } catch(_) {}
        const categoryNames = getCategoryNames();
        const selectedTags = readSelectedTagsFromStorage();
        const tagMode = getTagFilterMode();
        let searchQuery = '';
        if (filterSearchInput) {
            searchQuery = filterSearchInput.value || localStorage.getItem(LS.searchQuery) || '';
            if (!filterSearchInput.value && searchQuery) filterSearchInput.value = searchQuery;
        } else {
            searchQuery = localStorage.getItem(LS.searchQuery) || '';
        }
        const searchNorm = normalizeSearchValue(searchQuery);
        const allTags = getAllTagsFromCategories(allCategories);
        renderTagFilterCheckboxes(allTags);

        // Si seguimos teniendo <select> (por compat), lo mantenemos sincronizado con legacy
        if (filterTagSelect && filterTagSelect.tagName === 'SELECT') {
            const legacy = localStorage.getItem(LS.selectedFilterTag) || '';
            updateTagFilterDropdown(allCategories, legacy);
        }
        const items = [];
        for (const [cat, list] of Object.entries(allCategories)) {
            if (!Array.isArray(list)) continue;
            for (const t of list) {
                items.push({ task: t, category: cat });
            }
        }
        items.sort((a, b) => compareTasksByOrder(a.task, b.task));

        let filteredItems = items;
        if (selectedTags.length) {
            filteredItems = filteredItems.filter(({ task }) => {
                const tags = Array.isArray(task.tags) ? task.tags : [];
                if (tagMode === 'and') return selectedTags.every(t => tags.includes(t));
                return selectedTags.some(t => tags.includes(t));
            });
        }
        if (searchNorm) {
            filteredItems = filteredItems.filter(({ task }) => taskMatchesSearch(task, searchNorm));
        }

        cleanupObjectUrls();
        container.innerHTML = '';

        if (!filteredItems.length) {
            const emptyMsg = (window.i18n && i18n.t) ? i18n.t('no_items') : 'No hay elementos';
            container.innerHTML = `<p>${emptyMsg}</p>`;
            return;
        }

        filteredItems.forEach(({ task, category }) => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task resource-item';
            const tagsHtml = (task.tags && task.tags.length)
                ? `<small class="tags">${task.tags.map(t => `<span class="tag-chip in-task">#${t}</span>`).join(' ')}</small>`
                : '';
            const reminderHtml = task.reminderAt
                ? `<small class="reminder-meta">⏰ ${formatDateTime(task.reminderAt)}</small>`
                : '';
            const attachmentsHtml = renderAttachmentsHtml(task);
            const catLabel = categoryNames[category] || category;
            const editTxt = (window.i18n && i18n.t) ? i18n.t('edit') : 'Editar';
            const deleteTxt = (window.i18n && i18n.t) ? i18n.t('delete') : 'Eliminar';
            taskDiv.innerHTML = `
                <div class="task-main">
                    <span>
                        ${convertirEnlaces(task.task || '')}
                        ${tagsHtml}
                        ${reminderHtml}
                        ${attachmentsHtml}
                        <small class="resource-meta"><span class="category-chip">${catLabel}</span>${formatDateTime(task.lastModified)}</small>
                    </span>
                </div>
                <div class="task-actions resource-actions">
                    <select class="order-select resource-order" data-task-id="${task.id}" aria-label="Orden (A–Z)" title="Orden (A–Z)">
                        ${buildOrderOptions(task.orderCode)}
                    </select>
                    <button type="button" class="edit-btn resource-edit" data-task-id="${task.id}" title="${editTxt}" aria-label="${editTxt}">✏️ <span class="btn-label">${editTxt}</span></button>
                    <button type="button" class="delete-btn resource-delete" data-task-id="${task.id}" title="${deleteTxt}" aria-label="${deleteTxt}">🗑️ <span class="btn-label">${deleteTxt}</span></button>
                </div>
            `;
            container.appendChild(taskDiv);
            hydrateResourceAttachments(taskDiv, task);
        });
    }

    // Rehidratar modo OR/AND (si existe el selector)
    if (filterTagModeSelect) {
        filterTagModeSelect.value = getTagFilterMode();
        filterTagModeSelect.addEventListener('change', () => {
            setTagFilterMode(filterTagModeSelect.value);
            renderResources();
        });
    }

    if (filterTagSelect && filterTagSelect.tagName === 'SELECT') {
        filterTagSelect.addEventListener('change', (e) => {
            try { localStorage.setItem(LS.selectedFilterTag, e.target.value || ''); } catch (_) {}
            renderResources();
        });
    }
    if (filterSearchInput) {
        filterSearchInput.addEventListener('input', (e) => {
            try { localStorage.setItem(LS.searchQuery, e.target.value || ''); } catch (_) {}
            renderResources();
        });
    }
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.resource-edit');
        if (editBtn && editBtn.dataset.taskId) {
            openResourcesEditModal(editBtn.dataset.taskId);
            return;
        }
        const deleteBtn = e.target.closest('.resource-delete');
        if (deleteBtn && deleteBtn.dataset.taskId) {
            removeTaskFromResources(deleteBtn.dataset.taskId);
        }
    });
    container.addEventListener('change', (e) => {
        const orderSelect = e.target.closest('.resource-order');
        if (orderSelect && orderSelect.dataset.taskId) {
            setResourceTaskOrder(orderSelect.dataset.taskId, orderSelect.value);
        }
    });

    renderResources();
    if (window.i18n && i18n.applyI18nAll) {
        window.__rerenderResources = renderResources;
        i18n.applyI18nAll();
    }
});
