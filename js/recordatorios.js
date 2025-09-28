document.addEventListener('DOMContentLoaded', function() {
    const LS = {
        categories: 'edukanban.categories',
        deleted: 'edukanban.deletedTasks',
        token: 'edukanban.dropbox_access_token'
    };
    const container = document.getElementById('reminder-container');

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
        const parts = Array.isArray(segments) ? segments.slice() : getNextcloudRootSegments(conf);
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
    const CATEGORY_OVERRIDES_KEY = 'edukanban.categoryNameOverrides';
    const DEFAULT_CATEGORY_NAMES = (window.i18n && i18n.DEFAULT_CATEGORY_NAMES) ? i18n.DEFAULT_CATEGORY_NAMES : {
        'en-preparacion': 'En preparación',
        'preparadas': 'Preparadas',
        'en-proceso': 'En proceso',
        'pendientes': 'Pendientes',
        'archivadas': 'Archivadas'
    };

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

    function convertirEnlaces(texto) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return texto.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        });
    }

    function formatDate(iso) {
        try {
            const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
            return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_) { return iso || ''; }
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
    function render() {
        const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const all = migrateObj(raw);
        try { localStorage.setItem(LS.categories, JSON.stringify(all)); } catch(_) {}
        const categoryNames = (window.i18n && typeof i18n.getEffectiveCategoryNames === 'function')
            ? i18n.getEffectiveCategoryNames()
            : Object.assign({}, DEFAULT_CATEGORY_NAMES, getLocalOverrides());
        const items = [];
        for (const [cat, list] of Object.entries(all)) {
            if (!Array.isArray(list)) continue;
            if (cat === 'archivadas') continue; // ignorar archivo
            for (const t of list) {
                if (!t || !t.reminderAt) continue;
                // opcional: ignorar completadas
                if (t.completed) continue;
                items.push({
                    id: t.id,
                    task: t.task,
                    tags: t.tags || [],
                    reminderAt: t.reminderAt,
                    category: cat,
                    categoryName: categoryNames[cat] || cat
                });
            }
        }
        // Separar vencidos y próximos
        const now = Date.now();
        const overdue = [];
        const upcoming = [];
        for (const it of items) {
            const ts = Date.parse(it.reminderAt);
            if (!isNaN(ts) && ts <= now) overdue.push(it); else upcoming.push(it);
        }
        overdue.sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));
        upcoming.sort((a, b) => new Date(a.reminderAt) - new Date(b.reminderAt));

        container.innerHTML = '';
        if (overdue.length === 0 && upcoming.length === 0) {
            container.innerHTML = `<p>${(window.i18n&&i18n.t)?i18n.t('no_reminders'):'No hay actividades con recordatorio programado.'}</p>`;
            return;
        }

        const renderList = (list, title, extraClass = '') => {
            if (list.length === 0) return;
            const section = document.createElement('section');
            section.className = `category ${extraClass}`.trim();
            section.innerHTML = `<h3>${title}</h3>`;
            list.forEach(it => {
                const el = document.createElement('div');
                el.className = 'task';
                el.innerHTML = `
                    <div class="task-main">
                        <input type="checkbox" aria-label="Completar y archivar" onclick="completeAndArchive('${it.id}')">
                        <span>
                            ${convertirEnlaces(it.task)}
                            ${it.tags.length ? `<small class=\"tags\">${it.tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
                            <small class="reminder-meta">⏰ ${formatDate(it.reminderAt)} — ${it.categoryName}</small>
                        </span>
                    </div>
                `;
                section.appendChild(el);
            });
            container.appendChild(section);
        };

        renderList(overdue, (window.i18n&&i18n.t)?i18n.t('overdue'):'Vencidos', 'overdue');
        renderList(upcoming, (window.i18n&&i18n.t)?i18n.t('upcoming'):'Próximos');
    }

    render();

    if (window.i18n && i18n.applyI18nAll) {
        window.__rerenderReminders = render;
        i18n.applyI18nAll();
    }

    // Completar y archivar tarea desde esta vista
    window.completeAndArchive = function(taskId) {
        const all = JSON.parse(localStorage.getItem(LS.categories) || '{}');
        const cats = ['en-preparacion', 'preparadas', 'en-proceso', 'pendientes', 'archivadas'];
        cats.forEach(c => { if (!Array.isArray(all[c])) all[c] = []; });

        // Buscar en no-archivadas
        let foundCat = null, idx = -1;
        for (const c of cats) {
            if (c === 'archivadas') continue;
            const i = all[c].findIndex(t => t && t.id === taskId);
            if (i > -1) { foundCat = c; idx = i; break; }
        }
        if (foundCat == null) return;

        const [task] = all[foundCat].splice(idx, 1);
        task.completed = true;
        task.archivedOn = new Date().toISOString();
        task.lastModified = new Date().toISOString();
        if (!Array.isArray(all['archivadas'])) all['archivadas'] = [];
        all['archivadas'].push(task);

        localStorage.setItem(LS.categories, JSON.stringify(all));
        render();
        // Intentar sincronizar con los servicios conectados
        syncCloudFromReminders();
    }

    async function syncToDropboxFromReminders() {
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
            if (!res.ok) {
                if (res.status === 401) localStorage.removeItem('dropbox_access_token');
                try { console.warn('Dropbox: error subida desde recordatorios:', res.status, await res.text()); } catch {}
            }
        } catch (err) {
            console.warn('Dropbox: fallo de red en sync desde recordatorios:', err);
        }
    }

    async function syncToNextcloudFromReminders() {
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
                try { console.warn('Nextcloud: error subida desde recordatorios:', res.status, await res.text()); } catch (_) {}
            }
        } catch (err) {
            console.warn('Nextcloud: fallo de red en sync desde recordatorios:', err);
        }
    }

    function syncCloudFromReminders() {
        syncToDropboxFromReminders();
        syncToNextcloudFromReminders();
    }
});
