document.addEventListener('DOMContentLoaded', function() {
    const LS = {
        categories: 'edukanban.categories',
        deleted: 'edukanban.deletedTasks',
        token: 'edukanban.dropbox_access_token',
        selectedArchiveFilterTag: 'edukanban.selectedArchiveFilterTag'
    };
    const archiveContainer = document.getElementById('archive-container');
    const filterSelect = document.getElementById('archive-filter-tag');

    const NEXTCLOUD_KEYS = {
        config: 'edukanban.nextcloudConfig'
    };
    const NEXTCLOUD_DEFAULT_FOLDER = '/Apps/EduKanban';
    const NEXTCLOUD_FILE_NAME = 'edukanban.json';

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

    function getNextcloudRootSegments(conf) {
        const folder = (conf && conf.folder) ? conf.folder : NEXTCLOUD_DEFAULT_FOLDER;
        return folder.split('/').map(part => part.trim()).filter(Boolean);
    }

    function nextcloudPathToSegments(path) {
        return String(path || '').split('/').map(part => part.trim()).filter(Boolean);
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

    async function ensureNextcloudFolder(conf, segments) {
        if (!isNextcloudConfigured(conf)) return false;
        const parts = Array.isArray(segments) ? segments.slice() : nextcloudPathToSegments(segments);
        if (!parts.length) return true;
        const auth = makeNextcloudAuthHeader(conf);
        const built = [];
        for (const segment of parts) {
            const clean = String(segment || '').trim();
            if (!clean) continue;
            built.push(clean);
            const url = buildNextcloudUrl(conf, built);
            try {
                const res = await fetch(url, {
                    method: 'MKCOL',
                    headers: { 'Authorization': auth }
                });
                if (res.status === 201 || res.status === 405 || res.status === 409) continue;
                if (!res.ok && res.status !== 412) return false;
            } catch (err) {
                console.warn('ensureNextcloudFolder', err);
                return false;
            }
        }
        return true;
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

    function escapeAttr(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
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
                return `<div class="attachment-audio-wrap"><audio class="attachment-audio" data-att-id="${attId}" controls preload="metadata"></audio></div>`;
            }
            if (isVideoAttachment(att)) {
                return `<div class="attachment-video-wrap"><video class="attachment-video" data-att-id="${attId}" controls preload="metadata"></video></div>`;
            }
            const extra = isPdfAttachment(att) ? ` <a class="attachment-dl" data-att-id="${attId}" href="#" title="Descargar">⬇️</a>` : '';
            return `<span class="attachment-wrap"><a class="attachment-file" data-att-id="${attId}" href="#" title="${safeName}">📎 ${safeName}</a>${extra}</span>`;
        });
        return `<div class="attachments">${items.join('')}</div>`;
    }

    async function hydrateArchivedAttachments(taskEl, task) {
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

            const ensureMediaSrc = (mediaEl, type, mediaUrl, hasBlob) => {
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
                    ensureMediaSrc(audioEl, 'audio', url, !!blob);
                } else {
                    const span = document.createElement('span');
                    span.textContent = 'Audio no disponible';
                    if (audioEl.parentElement) audioEl.parentElement.replaceWith(span);
                }
            }

            if (videoEl) {
                if (url) {
                    ensureMediaSrc(videoEl, 'video', url, !!blob);
                    try { videoEl.setAttribute('playsinline', ''); } catch (_) {}
                } else {
                    const span = document.createElement('span');
                    span.textContent = 'Vídeo no disponible';
                    if (videoEl.parentElement) videoEl.parentElement.replaceWith(span);
                }
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

    function formatArchivedDate(task) {
        const iso = task.archivedOn || task.lastModified;
        if (!iso) return '';
        try {
            const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
            return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) {
            return iso;
        }
    }

    function getArchiveTags(tasks) {
        const s = new Set();
        tasks.forEach(t => Array.isArray(t.tags) && t.tags.forEach(tag => s.add(tag)));
        return Array.from(s).sort();
    }

    function updateArchiveFilterDropdown(currentValue, tasks) {
        if (!filterSelect) return;
        const tags = getArchiveTags(tasks);
        let html = '<option value="">Mostrar todo</option>';
        const hasCurrent = currentValue && tags.includes(currentValue);
        const rendered = hasCurrent ? tags : [currentValue, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);
        html += rendered.map(t => `<option value="${t}">${t}</option>`).join('');
        filterSelect.innerHTML = html;
        filterSelect.value = currentValue || '';
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
        for(const k in obj){const nk=normalizeKey(k);if(Array.isArray(obj[k])){t[nk]=(t[nk]||[]).concat(obj[k]);}}
        return t;
    }

    function renderArchivedTasks() {
        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const allCategories = migrateObj(raw);
        try { localStorage.setItem(LS.categories, JSON.stringify(allCategories)); } catch(_) {}
        const archivedTasks = allCategories['archivadas'] || [];
        const currentFilter = (filterSelect?.value || localStorage.getItem(LS.selectedArchiveFilterTag) || '');
        // Orden estable: más recientes primero por archivedOn (si existe) o lastModified
        let view = archivedTasks.slice().sort((a, b) => {
            const aTime = new Date(a.archivedOn || a.lastModified || 0).getTime();
            const bTime = new Date(b.archivedOn || b.lastModified || 0).getTime();
            return bTime - aTime;
        });

        // Filtrado por etiqueta si aplica
        if (currentFilter) {
            view = view.filter(t => Array.isArray(t.tags) && t.tags.includes(currentFilter));
        }

        cleanupObjectUrls();
        archiveContainer.innerHTML = '';

        if (view.length === 0) {
            archiveContainer.innerHTML = `<p>${(window.i18n&&i18n.t)?i18n.t('no_archived'):'No hay actividades archivadas.'}</p>`;
            // Aún actualizar el dropdown según las tareas originales
            updateArchiveFilterDropdown(currentFilter, archivedTasks);
            return;
        }

        view.forEach(taskObj => {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'task';
            const unarchiveTxt = (window.i18n&&i18n.t)?i18n.t('unarchive'):'Desarchivar';
            const deletePermTxt = (window.i18n&&i18n.t)?i18n.t('delete_permanently'):'Eliminar Permanentemente';
            const editTxt = (window.i18n&&i18n.t)?i18n.t('edit'):'Editar';
            const attachmentsHtml = renderAttachmentsHtml(taskObj);
            taskDiv.innerHTML = `
                <input type="checkbox" ${taskObj.completed ? 'checked' : ''} disabled>
                <span class="${taskObj.completed ? 'completed' : ''}">${convertirEnlaces(taskObj.task)}
                    ${taskObj.tags && taskObj.tags.length ? `<small class="tags">${taskObj.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                    ${attachmentsHtml}
                </span>
                <small class="archived-meta">Archivada: ${formatArchivedDate(taskObj)}</small>
                <button type="button" class="edit-btn" onclick="openEditTask('${taskObj.id}')">${editTxt}</button>
                <button type="button" onclick="unarchiveTask('${taskObj.id}')">${unarchiveTxt}</button>
                <button type="button" onclick="deletePermanently('${taskObj.id}')">${deletePermTxt}</button>
            `;
            archiveContainer.appendChild(taskDiv);
            hydrateArchivedAttachments(taskDiv, taskObj);
        });

        // Actualizar dropdown tras render
        updateArchiveFilterDropdown(currentFilter, archivedTasks);
    }

    // FUNCIÓN DE ELIMINACIÓN CORREGIDA
    window.deletePermanently = function(taskId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta actividad permanentemente? Esta acción no se puede deshacer.')) {
            // Cargar ambos, categorías y tareas eliminadas
            const allCategories = JSON.parse(localStorage.getItem(LS.categories) || '{}');
            const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');

            if (allCategories['archivadas']) {
                const taskIndex = allCategories['archivadas'].findIndex(t => t.id === taskId);
                
                if (taskIndex > -1) {
                    // 1. Eliminar la tarea de la lista de archivadas
                    const [removedTask] = allCategories['archivadas'].splice(taskIndex, 1);
                    
                    // 2. AÑADIR LA TAREA A LA LISTA DE ELIMINADAS (¡LA CLAVE!)
                    deletedTasks.push({ ...removedTask, deletedOn: new Date().toISOString() });

                    // 3. Guardar ambos cambios en localStorage
                    localStorage.setItem(LS.categories, JSON.stringify(allCategories));
                    localStorage.setItem(LS.deleted, JSON.stringify(deletedTasks));
                    
                    // 4. Volver a renderizar la vista
                    renderArchivedTasks();
                    // 5. Intentar sincronizar con los servicios conectados
                    syncCloudFromArchive();
                }
            }
        }
    }

    // Desarchivar: mover a Bandeja de Entrada y marcar como no completada
    window.unarchiveTask = function(taskId) {
        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const allCategories = migrateObj(raw);
        const archived = allCategories['archivadas'];
        if (!Array.isArray(archived)) return;
        const idx = archived.findIndex(t => t.id === taskId);
        if (idx === -1) return;
        const [task] = archived.splice(idx, 1);
        task.completed = false;
        task.lastModified = new Date().toISOString();
        // Limpiar metadato de archivado al desarchivar
        if (task.archivedOn) delete task.archivedOn;
        if (!Array.isArray(allCategories['en-preparacion'])) {
            allCategories['en-preparacion'] = [];
        }
        allCategories['en-preparacion'].push(task);
        localStorage.setItem(LS.categories, JSON.stringify(allCategories));
        renderArchivedTasks();
        // Intentar sincronizar con los servicios conectados
        syncCloudFromArchive();
    }

    // Cargar las tareas al iniciar
    renderArchivedTasks();
    if (window.i18n && i18n.applyI18nAll) {
        window.__rerenderArchive = renderArchivedTasks;
        i18n.applyI18nAll();
    }

    // Gestionar cambios en el filtro
    filterSelect?.addEventListener('change', (e) => {
        try { localStorage.setItem(LS.selectedArchiveFilterTag, e.target.value || ''); } catch (_) {}
        renderArchivedTasks();
    });

    // Sincronización básica a Dropbox desde la vista de archivo
    async function syncToDropboxFromArchive() {
        const token = localStorage.getItem(LS.token);
        if (!token) return;
        try {
            const categories = JSON.parse(localStorage.getItem(LS.categories) || '{}');
            const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');
            const payload = { categories, deletedTasks, lastSync: new Date().toISOString() };
            const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({ path: '/edukanban.json', mode: 'overwrite' })
                },
                body: JSON.stringify(payload, null, 2)
            });
            if (res.status === 401) {
                // Token inválido; limpiar para que index gestione reconexión
                localStorage.removeItem('dropbox_access_token');
                console.warn('Dropbox: token inválido al sincronizar desde archivo.');
            } else if (!res.ok) {
                const t = await res.text();
                console.warn('Dropbox: error de subida desde archivo:', res.status, t);
            }
        } catch (err) {
            console.warn('Dropbox: fallo de red en sync desde archivo:', err);
        }
    }

    async function syncToNextcloudFromArchive() {
        const conf = loadNextcloudConfig();
        if (!isNextcloudConfigured(conf)) return;
        try {
            const categories = JSON.parse(localStorage.getItem(LS.categories) || '{}');
            const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');
            const rootSegments = getNextcloudRootSegments(conf);
            await ensureNextcloudFolder(conf, rootSegments);
            const url = buildNextcloudUrl(conf, rootSegments.concat([NEXTCLOUD_FILE_NAME]));
            const payload = { categories, deletedTasks, lastSync: new Date().toISOString() };
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': makeNextcloudAuthHeader(conf),
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(payload, null, 2)
            });
            if (!res.ok) {
                let body = '';
                try { body = await res.text(); } catch (_) {}
                console.warn('Nextcloud: error subida desde archivo:', res.status, body);
            }
        } catch (err) {
            console.warn('Nextcloud: fallo de red en sync desde archivo:', err);
        }
    }

    function syncCloudFromArchive() {
        syncToDropboxFromArchive();
        syncToNextcloudFromArchive();
    }
});
