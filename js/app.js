// =================================================================================
// GESTOR DE TAREAS - VERSIÓN FINAL REFACTORIZADA
// =================================================================================

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
const categories = {
    "en-preparacion": [],
    "preparadas": [],
    "en-proceso": [],
    "pendientes": [],
    "archivadas": []
};

// category names dependen del idioma (ver i18n.i18nCategoryNames)

// Claves de almacenamiento local específicas de EduKanban
const LS = {
  categories: 'edukanban.categories',
  deleted: 'edukanban.deletedTasks',
  token: 'edukanban.dropbox_access_token',
  lastSync: 'edukanban.lastSync',
  selectedFilterTag: 'edukanban.selectedFilterTag',
  visibleColumn: 'edukanban.visibleColumn', // compat: antes guardaba un string; ahora guarda JSON array
  notificationsEnabled: 'edukanban.notificationsEnabled',
  pendingDropboxAction: 'edukanban.pendingDropboxAction',
  lastReauthAt: 'edukanban.lastReauthAt'
};

const deletedTasks = JSON.parse(localStorage.getItem(LS.deleted) || '[]');
const DROPBOX_APP_KEY = 'dvvtedkibz396hq';
const DROPBOX_FILE_PATH = '/edukanban.json';
const DROPBOX_ATTACH_DIR = '/edukanban_attachments';
let accessToken = localStorage.getItem(LS.token);
let localLastSync = localStorage.getItem(LS.lastSync);
let syncInterval = null;
// Flujo de redirect dinámico; constante obsoleta tras rebranding
const DROPBOX_REDIRECT_URI = 'about:blank';

// --- FUNCIONES DE UTILIDAD ---
function generateUUID() { return crypto.randomUUID(); }
// Adjuntos seleccionados para nuevas tareas (reutilización en modo "Añadir")
let pendingReusedAttachments = [];

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
    // Escapar HTML y luego convertir URLs en enlaces seguros
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const escapeHTML = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escaped = typeof texto === 'string' ? escapeHTML(texto) : '';
    return escaped.replace(urlRegex, function(url) {
        const safeHref = encodeURI(url);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`;
    });
}

// --- GESTIÓN DE DATOS LOCALES ---
function getCategoryNames() {
    if (window.i18n && typeof i18n.i18nCategoryNames === 'function') {
        return i18n.i18nCategoryNames();
    }
    return {
        'en-preparacion': 'En preparación',
        'preparadas': 'Preparadas',
        'en-proceso': 'En proceso',
        'pendientes': 'Pendientes',
        'archivadas': 'Archivadas'
    };
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
    const newTask = {
        id: generateUUID(),
        task: taskName,
        completed: false,
        lastModified: new Date().toISOString(),
        tags: tags,
        reminderAt: reminderAt, // ISO string o null
        reminderDone: false,
        triggerScheduledAt: null,
        attachments: []
    };
    categories[category].push(newTask);
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) syncToDropbox(false);
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
}

function toggleTaskCompletion(taskId) {
    const taskData = findTask(taskId);
    if (taskData) {
        const { task } = taskData;
        task.completed = !task.completed;
        task.lastModified = new Date().toISOString();
        if (task.completed && taskData.category !== 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            movedTask.archivedOn = new Date().toISOString();
            movedTask.reminderDone = true;
            categories['archivadas'].push(movedTask);
        } else if (!task.completed && taskData.category === 'archivadas') {
            const [movedTask] = categories[taskData.category].splice(taskData.taskIndex, 1);
            delete movedTask.archivedOn;
            categories['en-preparacion'].push(movedTask);
        }
        saveCategoriesToLocalStorage();
        renderTasks();
        if (accessToken) syncToDropbox(false);
    }
}

function moveTask(taskId, newCategory) {
    const taskData = findTask(taskId);
    if (taskData && categories[newCategory]) {
        const [task] = categories[taskData.category].splice(taskData.taskIndex, 1);
        task.lastModified = new Date().toISOString();
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
    }
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
    task.lastModified = new Date().toISOString();

    // Crear copias para las demás etiquetas
    const extraTags = tags.slice(1);
    const clones = extraTags.map(tg => ({
        id: generateUUID(),
        task: task.task,
        completed: !!task.completed,
        lastModified: new Date().toISOString(),
        tags: [tg],
        reminderAt: task.reminderAt || null,
        reminderDone: false,
        triggerScheduledAt: null,
        attachments: Array.isArray(task.attachments) ? task.attachments.slice() : []
    }));

    // Insertar clones justo después de la tarea original para mantener el orden
    categories[category].splice(data.taskIndex + 1, 0, ...clones);
    saveCategoriesToLocalStorage();
    renderTasks();
    showToast((window.i18n&&i18n.t)?i18n.t('split_done'):'Actividad dividida por etiquetas.');
    if (accessToken) syncToDropbox(false);
}

// --- EDICIÓN DE TAREAS ---
function updateTask(taskId, newName, newCategory, newTags = [], newReminderAt = null) {
    const data = findTask(taskId);
    if (!data) return;
    const { task, category } = data;
    task.task = newName;
    task.tags = Array.isArray(newTags) ? newTags : [];
    // Actualizar recordatorio
    task.reminderAt = newReminderAt || null;
    // Si se cambia la fecha, reiniciar el estado de disparo y reprogramar
    task.reminderDone = false;
    task.triggerScheduledAt = null;
    task.lastModified = new Date().toISOString();
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
        const key = att.dropboxPath || `${att.name}|${att.type}|${att.size}`;
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
            const link = att.isImage ? '' : `<a class="attachment-file" data-att-id="${att.id}" href="#" title="${label}">📎 ${label}</a>`;
            const dl = !att.isImage ? `<a class="attachment-dl" data-att-id="${att.id}" href="#" title="Descargar">⬇️</a>` : '';
            return `<div class="attachment-row" data-att-id="${att.id}">${img}${link}${dl}</div>`;
        }).join('');
        (async () => {
            for (const att of list) {
                const imgEl = container.querySelector(`img.attachment-img[data-att-id="${att.id}"]`);
                const aEl = container.querySelector(`a.attachment-file[data-att-id="${att.id}"]`);
                let url = null;
                const blob = await ensureAttachmentBlob(att);
                if (imgEl && blob) imgEl.src = URL.createObjectURL(blob);
                if (!url && blob) url = URL.createObjectURL(blob);
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
    const grid = document.createElement('div');
    grid.className = 'reuse-grid';
    panel.innerHTML = '';
    panel.appendChild(grid);
    items.forEach(item => {
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
}

async function renderPopupAttachments(task) {
    const container = document.getElementById('popup-existing-attachments');
    if (!container) return;
    container.classList.add('popup-attachments');
    const list = Array.isArray(task.attachments) ? task.attachments : [];
    if (!list.length) { container.innerHTML = ''; return; }
    // Construir markup
    container.innerHTML = list.map(att => {
        const label = att.name || 'archivo';
        const img = att.isImage ? `<img class="attachment-img" data-att-id="${att.id}" alt="${label}">` : '';
        const link = att.isImage ? '' : `<a class="attachment-file" data-att-id="${att.id}" href="#" title="${label}">📎 ${label}</a>`;
        const dl = !att.isImage ? `<a class="attachment-dl" data-att-id="${att.id}" href="#" title="Descargar">⬇️</a>` : '';
        const del = `<button type="button" class="attachment-remove" data-att-id="${att.id}">${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}</button>`;
        return `<div class="attachment-row" data-att-id="${att.id}">${img}${link}${dl}${del}</div>`;
    }).join('');
    // Hidratar blobs/enlaces
    for (const att of list) {
        const imgEl = container.querySelector(`img.attachment-img[data-att-id="${att.id}"]`);
        const aEl = container.querySelector(`a.attachment-file[data-att-id="${att.id}"]`);
        let url = null;
        const blob = await ensureAttachmentBlob(att);
        if (imgEl && blob) imgEl.src = URL.createObjectURL(blob);
        if (!url && blob) url = URL.createObjectURL(blob);
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

// --- RENDERIZADO EN EL DOM (SIN BOTÓN DE ELIMINAR) ---
function renderTasks() {
    const taskContainer = document.getElementById('task-container');
    const filterTagSelect = document.getElementById('filter-tag');
    const filterColumnSelect = document.getElementById('filter-column');
    const filterColumnGroup = document.getElementById('filter-column-group');
    const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
    // Mantener filtro activo: tomar el valor actual o el guardado en localStorage
    let filterTag = '';
    if (filterTagSelect) {
        filterTag = filterTagSelect.value || localStorage.getItem(LS.selectedFilterTag) || '';
    } else {
        filterTag = localStorage.getItem(LS.selectedFilterTag) || '';
    }
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

    const catNames = (window.i18n && i18n.i18nCategoryNames) ? i18n.i18nCategoryNames() : {
      'en-preparacion':'En preparación','preparadas':'Preparadas','en-proceso':'En proceso','pendientes':'Pendientes','archivadas':'Archivadas'
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

        let tasksHTML = filteredTasks.map(task => `
            <div class="task ${task.completed ? 'completed' : ''}" draggable="true" data-id="${task.id}">
                <div class="task-main">
                    <input type="checkbox" onchange="toggleTaskCompletion('${task.id}')" ${task.completed ? 'checked' : ''}>
                    <span>
                        ${convertirEnlaces(task.task)}
                        ${task.tags && task.tags.length ? `<small class="tags">${task.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                        ${task.reminderAt ? `<small class=\"reminder-meta\">⏰ ${new Date(task.reminderAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</small>` : ''}
                        ${task.attachments && task.attachments.length ? `
                          <div class="attachments">${task.attachments.map(att => {
                            if (att.isImage) {
                              return `<img class="attachment-img" alt="${att.name}" data-att-id="${att.id}" />`;
                            } else {
                              const extra = isPdfAttachment(att) ? ` <a class=\"attachment-dl\" href=\"#\" data-att-id=\"${att.id}\" title=\"Descargar\">⬇️</a>` : '';
                              return `<span class=\"attachment-wrap\"><a class=\"attachment-file\" href=\"#\" data-att-id=\"${att.id}\" title=\"${att.name}\">📎 ${att.name}</a>${extra}</span>`;
                            }
                          }).join('')}</div>` : ''}
                    </span>
                </div>
                <div class="task-actions">
                    <select aria-label="${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'}" onchange="moveTask('${task.id}', this.value)">
                        <option value="" disabled selected>${(window.i18n&&i18n.t)?i18n.t('move'):'Mover'}</option>
                        ${Object.keys(catNames).filter(c => c !== category).map(c => `<option value="${c}">${catNames[c]}</option>`).join('')}
                    </select>
                    <button class="edit-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'}" onclick="openEditTask('${task.id}')">✏️ <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('edit'):'Editar'}</span></button>
                    ${task.tags && task.tags.length > 1 ? `<button class=\"split-btn\" aria-label=\"${(window.i18n&&i18n.t)?i18n.t('split_by_tags'):'Dividir por etiquetas'}\" title=\"${(window.i18n&&i18n.t)?i18n.t('split_by_tags'):'Dividir por etiquetas'}\" onclick=\"splitTaskByTags('${task.id}')\">🔀 <span class=\"btn-label\">${(window.i18n&&i18n.t)?i18n.t('split'):'Dividir'}</span></button>` : ''}
                    <button class="delete-btn" aria-label="${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'} actividad" title="${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}" onclick="removeTask('${task.id}')">🗑️ <span class="btn-label">${(window.i18n&&i18n.t)?i18n.t('delete'):'Eliminar'}</span></button>
                </div>
            </div>
        `).join('');

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

    // Actualiza filtros (conservando selección) y autocompletado en cada render
    updateTagFilterDropdown(filterTag);
    updateColumnFilterDropdown(filterColumns, catNames);
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
            const dlEl = taskEl.querySelector(`a.attachment-dl[data-att-id="${att.id}"]`);
            if (imgEl && !imgEl.src) {
                const blob = await ensureAttachmentBlob(att);
                if (blob) imgEl.src = URL.createObjectURL(blob);
                if (imgEl && !imgEl.dataset.lbBound) {
                    imgEl.addEventListener('click', () => openImageLightbox(imgEl.src, imgEl.alt));
                    imgEl.dataset.lbBound = '1';
                }
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
    task.attachments.splice(idx, 1);
    task.lastModified = new Date().toISOString();
    saveCategoriesToLocalStorage();
    renderTasks();
    if (accessToken) {
        try { performFullSync(); } catch (_) { syncToDropbox(false); }
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
    const names = catNames || ((window.i18n && i18n.i18nCategoryNames) ? i18n.i18nCategoryNames() : {
        'en-preparacion':'En preparación','preparadas':'Preparadas','en-proceso':'En proceso','pendientes':'Pendientes','archivadas':'Archivadas'
    });
    const showAll = (window.i18n && i18n.t) ? i18n.t('show_all') : 'Todas';
    const selectedSet = new Set(Array.isArray(currentValues) ? currentValues : (currentValues ? [currentValues] : []));
    let options = `<option value=""${selectedSet.size===0 ? ' selected' : ''}>${showAll}</option>`;
    // Orden fijo: En preparación, Preparadas, En proceso, Pendientes
    const keys = ['en-preparacion','preparadas','en-proceso','pendientes'];
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
    if (online) updateDropboxButtons();
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
    // Orden determinista por lastModified (más recientes primero)
    Object.keys(mergedCategories).forEach(cat => {
        mergedCategories[cat].sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));
    });
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
    console.log('🔄 Iniciando sincronización completa...');
    showToast('Sincronizando...');
    const downloaded = await syncFromDropbox(true);
    if (downloaded) {
        const uploaded = await syncToDropbox(false);
        if (uploaded) showToast('✅ Sincronización completada.');
        else showToast('❌ Error al subir datos.', 'error');
    } else {
        showToast('❌ Error al descargar datos.', 'error');
    }
}

function startAutoSyncPolling() {
    if (syncInterval) clearInterval(syncInterval);
    syncInterval = setInterval(() => syncFromDropbox(), 30000);
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

    // Lógica del Popup
    const popup = document.getElementById('popup-tarea');
    const abrirPopupBtn = document.getElementById('abrir-popup-tarea');
    const cancelarPopupBtn = document.getElementById('cancelar-popup');
    const popupForm = document.getElementById('popup-task-form');
    const taskNameInput = document.getElementById('popup-task-name');
    const categorySelect = document.getElementById('popup-task-category');
    const tagsInput = document.getElementById('popup-task-tags');
    const reminderInput = document.getElementById('popup-task-reminder');

    if (abrirPopupBtn) abrirPopupBtn.addEventListener('click', () => {
        resetPopupFormMode();
        popup.style.display = 'flex';
        document.getElementById('popup-task-name').focus();
        updateTagDatalist();
        renderTagSuggestions();
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
    window.addEventListener('click', (e) => { if (e.target == popup) popup.style.display = 'none'; });
    if (popupForm) {
        popupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            let nombre = taskNameInput.value.trim();
            const categoria = categorySelect.value;
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
                }
                updateTask(editingId, nombre, categoria, tags, reminderAt);
                // Si se han añadido adjuntos, realizar una sincronización completa para subirlos primero
                if (hadNewAtts && accessToken) {
                    try { performFullSync(); } catch(_) {}
                }
            } else {
                addTask(categoria, nombre, tags, reminderAt);
                // anexar adjuntos a la última tarea creada en la categoría
                const arr = categories[categoria];
                const t = arr[arr.length - 1];
                const toAttach = (newAttachments || []).concat(pendingReusedAttachments || []);
                t.attachments = (t.attachments || []).concat(toAttach);
                pendingReusedAttachments = [];
                saveCategoriesToLocalStorage();
                renderTasks();
                if (accessToken) {
                    // Si hay adjuntos, hacer sync completa (subir adjuntos primero, luego JSON)
                    if (toAttach.length > 0) {
                        try { performFullSync(); } catch(_) { syncToDropbox(false); }
                    } else {
                        syncToDropbox(false);
                    }
                }
            }

            taskNameInput.value = '';
            tagsInput.value = '';
            if (reminderInput) reminderInput.value = '';
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
                popup.style.display = 'flex';
                const input = document.getElementById('popup-task-name');
                if (input) input.focus();
            }
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
    if (openAdmin && adminModal) openAdmin.addEventListener('click', ()=> { adminModal.style.display = 'flex'; });
    if (closeAdmin && adminModal) closeAdmin.addEventListener('click', ()=> { adminModal.style.display = 'none'; });
    if (adminModal) adminModal.addEventListener('click', (e)=>{ if (e.target === adminModal) adminModal.style.display = 'none'; });
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
