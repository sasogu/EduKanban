// i18n minimal para EduKanban (ES / Valencià)
(function(){
  const CATEGORY_OVERRIDES_KEY = 'edukanban.categoryNameOverrides';
  const DEFAULT_CATEGORY_NAMES = {
    'en-preparacion': 'En preparación',
    'preparadas': 'Preparadas',
    'en-proceso': 'En proceso',
    'pendientes': 'Pendientes',
    'archivadas': 'Archivadas'
  };
  const CATEGORY_KEYS = Object.keys(DEFAULT_CATEGORY_NAMES);

  const TRANSLATIONS = {
    es: {
      language: 'Idioma',
      synchronization: 'Sincronización',
      administration: 'Administración',
      filter_by_tag: 'Filtrar por etiqueta:',
      search_label: 'Buscar:',
      search_placeholder: 'Buscar actividades... o usa tag:, cat:, has:attachment',
      reconnecting: 'Reconectando con Dropbox…',
      reconnected_retrying: 'Reconectado. Reintentando operación…',
      backup: 'Copia de seguridad',
      export_backup: 'Exportar copia',
      import_backup: 'Importar copia',
      keep_pitch_on: '🎼 Mantener tono: Sí',
      keep_pitch_off: '🎼 Mantener tono: No',
      backup_created: 'Copia creada',
      backup_restored: 'Copia restaurada',
      backup_invalid: 'Archivo de copia no válido',
      backup_import_confirm_title: 'La importación reemplazará los datos locales actuales.',
      backup_import_confirm_summary: 'Resumen de la copia:',
      backup_import_confirm_current: 'Estado actual:',
      backup_import_confirm_apply: 'Importar',
      backup_schema_unsupported: 'La copia usa una versión de esquema no compatible.',
      backup_invalid_structure: 'La copia no tiene la estructura esperada.',
      new_activity: 'Nueva Actividad',
      view_reminders: '⏰ Ver Recordatorios',
      view_archive: '🗄️ Ver Archivo',
      board: '📋 Tablero',
      resources: '📚 Recursos',
      history: '📅 Histórico',
      connect_dropbox: 'Conectar con Dropbox',
      sync_dropbox: 'Sincronizar',
      dropbox_helper: 'Sincroniza automáticamente tus datos mediante OAuth.',
      nextcloud_section_title: 'Nextcloud (WebDAV)',
      nextcloud_helper: 'Introduce la URL de tu servidor, usuario y contraseña o token de aplicación.',
      nextcloud_url_label: 'URL de Nextcloud',
      nextcloud_username_label: 'Usuario',
      nextcloud_password_label: 'Contraseña o token de aplicación',
      nextcloud_folder_label: 'Carpeta (opcional)',
      nextcloud_save_settings: 'Guardar ajustes',
      nextcloud_sync_button: 'Sincronizar',
      nextcloud_disconnect: 'Desconectar',
      nextcloud_status_idle: 'Introduce la URL, usuario y token de Nextcloud para sincronizar.',
      nextcloud_status_ready: 'Ajustes guardados. Ejecuta sincronización para empezar.',
      nextcloud_status_synced_prefix: 'Última sincronización: ',
      nextcloud_status_missing_fields: 'Indica la URL y el usuario de Nextcloud.',
      nextcloud_status_missing_password: 'Introduce una contraseña o token de aplicación.',
      nextcloud_status_testing: 'Comprobando credenciales…',
      nextcloud_status_invalid: 'Credenciales inválidas. Revisa usuario y token.',
      nextcloud_status_error_generic: 'Se produjo un error al comunicar con Nextcloud.',
      nextcloud_status_error_network: 'Error de red al contactar con Nextcloud.',
      nextcloud_save_success: '✅ Ajustes de Nextcloud guardados',
      nextcloud_save_failed: '❌ No se pudo validar Nextcloud',
      nextcloud_confirm_disconnect: '¿Seguro que quieres eliminar la conexión con Nextcloud?',
      nextcloud_disconnected: 'Conexión con Nextcloud eliminada',
      nextcloud_syncing: 'Sincronizando con Nextcloud…',
      nextcloud_sync_complete: '✅ Sincronización con Nextcloud completada',
      toast_nextcloud_uploaded: '✅ Datos subidos a Nextcloud',
      toast_nextcloud_error_upload: '❌ Error al subir datos a Nextcloud',
      toast_nextcloud_downloaded: '📥 Datos descargados desde Nextcloud',
      toast_nextcloud_error_download: '❌ Error al descargar datos de Nextcloud',
      toast_nextcloud_sync_failed: '❌ Error al sincronizar con Nextcloud',
      sync_no_providers: 'No hay servicios de sincronización configurados.',
      show_all: 'Mostrar todo',
      placeholder_activity: 'Nueva actividad',
      placeholder_tags: 'Etiquetas (separadas por comas)',
      reminder_label: 'Recordatorio (fecha y hora)',
      add: 'Añadir',
      save: 'Guardar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      move: 'Mover',
      edit: 'Editar',
      reuse_attachment: 'Reutilizar adjunto',
      filter_attachments: 'Filtrar adjuntos…',
      filter_attachments_label: 'Filtrar adjuntos',
      add_this: 'Añadir',
      attachments_existing: 'Adjuntos existentes',
      no_items: 'No hay elementos',
      delete_attachment: 'Eliminar adjunto',
      confirm_delete_attachment: '¿Eliminar este adjunto?',
      attachment_removed: 'Adjunto eliminado',
      split: 'Dividir',
      split_by_tags: 'Dividir por etiquetas',
      split_single_error: 'La actividad ya tiene una sola etiqueta.',
      confirm_split_tags: 'Se crearán copias, una por etiqueta. ¿Continuar?',
      split_done: 'Actividad dividida por etiquetas.',
      confirm_generic: '¿Confirmas esta acción?',
      confirm_delete_activity: (title)=> title ? `¿Estás seguro de que quieres eliminar la actividad "${title}"?` : '¿Estás seguro de que quieres eliminar esta actividad?',
      error_activity_required: 'Por favor, ingresa un nombre de actividad.',
      notification_title: 'Recordatorio de actividad',
      toast_dropbox_uploaded: '✅ Actividades subidas a Dropbox',
      dropbox_expired: '⚠️ Tu sesión de Dropbox ha caducado. Vuelve a conectar.',
      back_to_app: 'Volver a EduKanban',
      no_reminders: 'No hay actividades con recordatorio programado.',
      overdue: 'Vencidos',
      upcoming: 'Próximos',
      no_archived: 'No hay actividades archivadas.',
      unarchive: 'Desarchivar',
      delete_permanently: 'Eliminar Permanentemente',
      // Categorías
      cat_en_preparacion: 'En preparación',
      cat_preparadas: 'Preparadas',
      cat_en_proceso: 'En proceso',
      cat_pendientes: 'Pendientes',
      cat_archivadas: 'Archivadas',
      column_names: 'Nombres de columnas',
      reset_column_names: 'Restaurar nombres por defecto',
    },
    val: {
      language: 'Idioma',
      synchronization: 'Sincronització',
      administration: 'Administració',
      filter_by_tag: 'Filtrar per etiqueta:',
      search_label: 'Cercar:',
      search_placeholder: 'Cercar activitats... o usa tag:, cat:, has:attachment',
      reconnecting: 'Tornant a connectar amb Dropbox…',
      reconnected_retrying: 'Reconnectat. Reintentant operació…',
      backup: 'Còpia de seguretat',
      export_backup: 'Exportar còpia',
      import_backup: 'Importar còpia',
      keep_pitch_on: '🎼 Mantindre to: Sí',
      keep_pitch_off: '🎼 Mantindre to: No',
      backup_created: 'Còpia creada',
      backup_restored: 'Còpia restaurada',
      backup_invalid: 'Fitxer de còpia no vàlid',
      backup_import_confirm_title: 'La importació substituirà les dades locals actuals.',
      backup_import_confirm_summary: 'Resum de la còpia:',
      backup_import_confirm_current: 'Estat actual:',
      backup_import_confirm_apply: 'Importar',
      backup_schema_unsupported: 'La còpia usa una versió d esquema no compatible.',
      backup_invalid_structure: 'La còpia no té l estructura esperada.',
      new_activity: 'Nova activitat',
      view_reminders: '⏰ Veure recordatoris',
      view_archive: '🗄️ Veure arxiu',
      board: '📋 Tauler',
      resources: '📚 Recursos',
      history: '📅 Històric',
      connect_dropbox: 'Connectar amb Dropbox',
      sync_dropbox: 'Sincronitzar',
      dropbox_helper: 'Sincronitza automàticament les teues dades mitjançant OAuth.',
      nextcloud_section_title: 'Nextcloud (WebDAV)',
      nextcloud_helper: 'Introdueix la URL del servidor, l\'usuari i la contrasenya o token d\'aplicació.',
      nextcloud_url_label: 'URL de Nextcloud',
      nextcloud_username_label: 'Usuari',
      nextcloud_password_label: 'Contrasenya o token d\'aplicació',
      nextcloud_folder_label: 'Carpeta (opcional)',
      nextcloud_save_settings: 'Guardar ajustos',
      nextcloud_sync_button: 'Sincronitzar',
      nextcloud_disconnect: 'Desconnectar',
      nextcloud_status_idle: 'Introdueix la URL, usuari i token de Nextcloud per a sincronitzar.',
      nextcloud_status_ready: 'Ajustos guardats. Executa la sincronització per a començar.',
      nextcloud_status_synced_prefix: 'Última sincronització: ',
      nextcloud_status_missing_fields: 'Indica la URL i l\'usuari de Nextcloud.',
      nextcloud_status_missing_password: 'Introdueix una contrasenya o token d\'aplicació.',
      nextcloud_status_testing: 'Comprovant credencials…',
      nextcloud_status_invalid: 'Credencials invàlides. Revisa usuari i token.',
      nextcloud_status_error_generic: 'S\'ha produït un error en comunicar amb Nextcloud.',
      nextcloud_status_error_network: 'Error de xarxa en contactar amb Nextcloud.',
      nextcloud_save_success: '✅ Ajustos de Nextcloud guardats',
      nextcloud_save_failed: '❌ No s\'ha pogut validar Nextcloud',
      nextcloud_confirm_disconnect: 'Segur que vols eliminar la connexió amb Nextcloud?',
      nextcloud_disconnected: 'Connexió amb Nextcloud eliminada',
      nextcloud_syncing: 'Sincronitzant amb Nextcloud…',
      nextcloud_sync_complete: '✅ Sincronització amb Nextcloud completada',
      toast_nextcloud_uploaded: '✅ Dades pujades a Nextcloud',
      toast_nextcloud_error_upload: '❌ Error en pujar dades a Nextcloud',
      toast_nextcloud_downloaded: '📥 Dades descarregades des de Nextcloud',
      toast_nextcloud_error_download: '❌ Error en descarregar dades de Nextcloud',
      toast_nextcloud_sync_failed: '❌ Error en sincronitzar amb Nextcloud',
      sync_no_providers: 'No hi ha serveis de sincronització configurats.',
      show_all: 'Mostrar tot',
      placeholder_activity: 'Nova activitat',
      placeholder_tags: 'Etiquetes (separades per comes)',
      reminder_label: 'Recordatori (data i hora)',
      add: 'Afegir',
      save: 'Guardar',
      cancel: 'Cancel·lar',
      delete: 'Eliminar',
      move: 'Moure',
      edit: 'Editar',
      reuse_attachment: 'Reutilitzar adjunt',
      filter_attachments: 'Filtrar adjunts…',
      filter_attachments_label: 'Filtrar adjunts',
      add_this: 'Afegir',
      attachments_existing: 'Adjunts existents',
      no_items: 'No hi ha elements',
      delete_attachment: 'Eliminar adjunt',
      confirm_delete_attachment: 'Voleu eliminar este adjunt?',
      attachment_removed: 'Adjunt eliminat',
      split: 'Dividir',
      split_by_tags: 'Dividir per etiquetes',
      split_single_error: "L'activitat ja té una sola etiqueta.",
      confirm_split_tags: 'Es crearan còpies, una per etiqueta. Continuar?',
      split_done: 'Activitat dividida per etiquetes.',
      confirm_generic: 'Confirmeu esta acció?',
      confirm_delete_activity: (title)=> title ? `Segur que voleu eliminar l'activitat "${title}"?` : 'Segur que voleu eliminar esta activitat?',
      error_activity_required: 'Introduïu un nom d\'activitat.',
      notification_title: 'Recordatori d\'activitat',
      toast_dropbox_uploaded: '✅ Activitats pujades a Dropbox',
      dropbox_expired: '⚠️ La sessió de Dropbox ha caducat. Torneu a connectar.',
      back_to_app: 'Tornar a EduKanban',
      no_reminders: 'No hi ha activitats amb recordatori programat.',
      overdue: 'Vençuts',
      upcoming: 'Pròxims',
      no_archived: 'No hi ha activitats arxivades.',
      unarchive: 'Desarxivar',
      delete_permanently: 'Eliminar permanentment',
      // Categorías
      cat_en_preparacion: 'En preparació',
      cat_preparadas: 'Preparades',
      cat_en_proceso: 'En procés',
      cat_pendientes: 'Pendents',
      cat_archivadas: 'Arxivades',
      column_names: 'Noms de columnes',
      reset_column_names: 'Restablir noms per defecte',
    }
  };

  function sanitizeCategoryName(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function readCategoryOverrides() {
    try {
      const raw = localStorage.getItem(CATEGORY_OVERRIDES_KEY);
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

  function writeCategoryOverrides(overrides) {
    try {
      const clean = {};
      CATEGORY_KEYS.forEach(key => {
        const val = sanitizeCategoryName(overrides && overrides[key]);
        if (val) clean[key] = val;
      });
      if (Object.keys(clean).length === 0) {
        localStorage.removeItem(CATEGORY_OVERRIDES_KEY);
      } else {
        localStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(clean));
      }
    } catch (_) {}
  }

  function getLang(){
    const l = localStorage.getItem('edukanban.lang');
    if (l) return l;
    const nav = (navigator.language || 'ca').toLowerCase();
    if (nav.startsWith('ca')) return 'val';
    if (nav.startsWith('es')) return 'es';
    return 'val'; // Valencià por defecto
  }
  function setLang(l){ try { localStorage.setItem('edukanban.lang', l); } catch(_){} }
  function getLocale(){
    const l = getLang();
    if (l === 'val') return 'ca-ES';
    return 'es-ES';
  }
  function t(key, params){
    const lang = getLang();
    const pack = TRANSLATIONS[lang] || TRANSLATIONS.es;
    const v = pack[key];
    if (typeof v === 'function') return v(params && params.title);
    return v || key;
  }
  function getTranslatedCategoryNames(){
    return {
      'en-preparacion': t('cat_en_preparacion'),
      'preparadas': t('cat_preparadas'),
      'en-proceso': t('cat_en_proceso'),
      'pendientes': t('cat_pendientes'),
      'archivadas': t('cat_archivadas')
    };
  }

  function getCategoryNameOverrides(){
    return readCategoryOverrides();
  }

  function setCategoryNameOverrides(partial){
    const current = readCategoryOverrides();
    const next = Object.assign({}, current, partial);
    // Eliminar claves con valor vacío para volver al valor por defecto / idioma
    Object.keys(next).forEach(key => {
      if (!sanitizeCategoryName(next[key])) delete next[key];
    });
    writeCategoryOverrides(next);
  }

  function resetCategoryNameOverrides(){
    writeCategoryOverrides({});
  }

  function getEffectiveCategoryNames(){
    return Object.assign({}, DEFAULT_CATEGORY_NAMES, getTranslatedCategoryNames(), getCategoryNameOverrides());
  }

  function i18nCategoryNames(){
    return getEffectiveCategoryNames();
  }


  // Helpers de backup reutilizables en todas las páginas
  const LS_BACKUP = { categories: 'edukanban.categories', deleted: 'edukanban.deletedTasks' };
  const BACKUP_SCHEMA_VERSION = 1;
  const BACKUP_APP_NAME = 'EduKanban';
  function getNowStamp(){
    const d=new Date(); const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
  function safeToast(msg,type){ if (window.showToast) showToast(msg,type); else try{console.log(msg)}catch(_){}}
  function getDefaultCategoriesShape(){
    return {
      'en-preparacion': [],
      'preparadas': [],
      'en-proceso': [],
      'pendientes': [],
      'archivadas': []
    };
  }
  function cloneCategoriesShape(input){
    const base = getDefaultCategoriesShape();
    try{
      if (!input || typeof input !== 'object') return base;
      for (const key of Object.keys(base)) {
        base[key] = Array.isArray(input[key]) ? input[key] : [];
      }
    }catch(_){}
    return base;
  }
  function countTasksInCategories(categories){
    try{
      return Object.values(cloneCategoriesShape(categories)).reduce((sum, list) => sum + list.length, 0);
    }catch(_){ return 0; }
  }
  function getBackupSummaryLines(data){
    const categories = cloneCategoriesShape(data && data.categories);
    const deletedTasks = Array.isArray(data && data.deletedTasks) ? data.deletedTasks : [];
    const schemaVersion = Number.isFinite(Number(data && data.schemaVersion)) ? Number(data.schemaVersion) : 0;
    const version = (data && data.version) ? String(data.version) : 'desconocida';
    const exportedAt = (data && data.exportedAt) ? String(data.exportedAt) : 'desconocida';
    return [
      `- app: ${data && data.app ? data.app : 'desconocida'}`,
      `- schemaVersion: ${schemaVersion || 'desconocida'}`,
      `- version: ${version}`,
      `- exportedAt: ${exportedAt}`,
      `- tareas activas: ${countTasksInCategories(categories)}`,
      `- tareas eliminadas: ${deletedTasks.length}`
    ];
  }
  function getCurrentLocalBackupSummaryLines(){
    try{
      return getBackupSummaryLines({
        app: BACKUP_APP_NAME,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        version: 'local',
        exportedAt: new Date().toISOString(),
        categories: JSON.parse(localStorage.getItem(LS_BACKUP.categories) || '{}'),
        deletedTasks: JSON.parse(localStorage.getItem(LS_BACKUP.deleted) || '[]')
      });
    }catch(_){
      return [];
    }
  }
  function validateBackupPayload(data){
    if (!data || typeof data !== 'object') return { ok: false, error: 'invalid-structure' };
    if (data.app && String(data.app) !== BACKUP_APP_NAME) return { ok: false, error: 'invalid-structure' };
    const hasLegacyVersion = typeof data.version === 'string' && data.version.length > 0;
    const schemaVersion = Number.isFinite(Number(data.schemaVersion)) ? Number(data.schemaVersion) : (hasLegacyVersion ? 1 : 0);
    if (!schemaVersion || schemaVersion > BACKUP_SCHEMA_VERSION) return { ok: false, error: 'unsupported-schema' };
    if (!data.categories || typeof data.categories !== 'object' || Array.isArray(data.categories)) return { ok: false, error: 'invalid-structure' };
    const normalizedCategories = cloneCategoriesShape(data.categories);
    const deletedTasks = Array.isArray(data.deletedTasks) ? data.deletedTasks : [];
    return {
      ok: true,
      payload: {
        app: BACKUP_APP_NAME,
        schemaVersion,
        version: typeof data.version === 'string' && data.version ? data.version : '2.0.0',
        exportedAt: typeof data.exportedAt === 'string' && data.exportedAt ? data.exportedAt : null,
        categories: normalizedCategories,
        deletedTasks
      }
    };
  }
  async function confirmBackupImport(data){
    const lines = [
      t('backup_import_confirm_title'),
      '',
      t('backup_import_confirm_summary'),
      ...getBackupSummaryLines(data),
      '',
      t('backup_import_confirm_current'),
      ...getCurrentLocalBackupSummaryLines()
    ];
    if (typeof window.showConfirm === 'function') {
      return await window.showConfirm(lines.join('\n'), t('backup_import_confirm_apply'), t('cancel'));
    }
    return window.confirm(lines.join('\n'));
  }
  function exportBackup(){
    try{
      const categories = JSON.parse(localStorage.getItem(LS_BACKUP.categories) || '{}');
      const deletedTasks = JSON.parse(localStorage.getItem(LS_BACKUP.deleted) || '[]');
      const payload = {
        app: BACKUP_APP_NAME,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        categories: cloneCategoriesShape(categories),
        deletedTasks: Array.isArray(deletedTasks) ? deletedTasks : []
      };
      const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`edukanban-backup-${getNowStamp()}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      safeToast(t('backup_created'));
    }catch(e){ console.error('exportBackup',e); safeToast('Error exportando','error'); }
  }
  async function importBackup(file){
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      const validated = validateBackupPayload(data);
      if (!validated.ok) throw new Error(validated.error);
      const accept = await confirmBackupImport(validated.payload);
      if (!accept) return;
      localStorage.setItem(LS_BACKUP.categories, JSON.stringify(validated.payload.categories));
      localStorage.setItem(LS_BACKUP.deleted, JSON.stringify(validated.payload.deletedTasks));
      safeToast(t('backup_restored'));
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.__rerenderArchive === 'function') window.__rerenderArchive();
      if (typeof window.__rerenderReminders === 'function') window.__rerenderReminders();
    }catch(e){
      console.error('importBackup',e);
      if (e && e.message === 'unsupported-schema') safeToast(t('backup_schema_unsupported'),'error');
      else if (e && e.message === 'invalid-structure') safeToast(t('backup_invalid_structure'),'error');
      else safeToast(t('backup_invalid'),'error');
    }
  }
  function applyI18nCommon(){
    // Selector de idioma si existe
    const sel = document.getElementById('lang-select');
    if (sel) {
      sel.value = getLang();
      sel.onchange = () => { setLang(sel.value); applyI18nAll(); };
      const label = document.querySelector('#lang-group h3');
      if (label) label.textContent = t('language');
    }
    const colGroupLabel = document.querySelector('#category-names-group h3');
    if (colGroupLabel) colGroupLabel.textContent = t('column_names');
    const resetBtn = document.getElementById('category-names-reset');
    if (resetBtn) resetBtn.textContent = t('reset_column_names');
    if (typeof window.__updateCategoryNameInputs === 'function') {
      window.__updateCategoryNameInputs();
    }
    // Cabecera de sincronización
    const syncLabel = document.querySelector('#sync-group h3');
    if (syncLabel) syncLabel.textContent = t('synchronization');
    const syncModalLabel = document.querySelector('#sync-group-modal h3');
    if (syncModalLabel) syncModalLabel.textContent = t('synchronization');
    // Botones comunes si existen
    const btnNew = document.getElementById('abrir-popup-tarea');
    if (btnNew) { btnNew.textContent = '➕ ' + t('new_activity'); btnNew.title = t('new_activity'); }
    const aRem = document.querySelector('a[href="recordatorios.html"]');
    if (aRem) { aRem.textContent = t('view_reminders'); aRem.title = t('view_reminders'); }
    const aArc = document.querySelector('a[href="archivo.html"]');
    if (aArc) { aArc.textContent = t('view_archive'); aArc.title = t('view_archive'); }
    // Tabs (si existen)
    const tabBoard = document.querySelector('nav.main-nav a.tab[href="index.html"]');
    if (tabBoard) { tabBoard.textContent = t('board'); tabBoard.title = t('board'); }
    const tabResources = document.querySelector('nav.main-nav a.tab[href="recursos.html"]');
    if (tabResources) { tabResources.textContent = t('resources'); tabResources.title = t('resources'); }
    const tabHist = document.querySelector('nav.main-nav a.tab[href="historico.html"]');
    if (tabHist) { tabHist.textContent = t('history'); tabHist.title = t('history'); }
    const tabRem = document.querySelector('nav.main-nav a.tab[href="recordatorios.html"]');
    if (tabRem) { tabRem.textContent = t('view_reminders'); tabRem.title = t('view_reminders'); }
    const tabArc = document.querySelector('nav.main-nav a.tab[href="archivo.html"]');
    if (tabArc) { tabArc.textContent = t('view_archive'); tabArc.title = t('view_archive'); }
    const tabAdmin = document.querySelector('nav.main-nav a.tab[href^="index.html?admin"]');
    if (tabAdmin) { tabAdmin.textContent = '⚙️ ' + t('administration'); tabAdmin.title = t('administration'); }
    const btnLogin = document.getElementById('dropbox-login');
    if (btnLogin) btnLogin.textContent = t('connect_dropbox');
    const btnSync = document.getElementById('dropbox-sync');
    if (btnSync) btnSync.textContent = t('sync_dropbox');
    const dropboxHelper = document.querySelector('#dropbox-sync-section .sync-helper');
    if (dropboxHelper) dropboxHelper.textContent = t('dropbox_helper');
    const nextcloudTitle = document.querySelector('#nextcloud-sync-section h4');
    if (nextcloudTitle) nextcloudTitle.textContent = t('nextcloud_section_title');
    const nextcloudHelper = document.querySelector('#nextcloud-sync-section .sync-helper');
    if (nextcloudHelper) nextcloudHelper.textContent = t('nextcloud_helper');
    const ncUrlLabel = document.querySelector('label[for="nextcloud-url"]');
    if (ncUrlLabel) ncUrlLabel.textContent = t('nextcloud_url_label');
    const ncUserLabel = document.querySelector('label[for="nextcloud-username"]');
    if (ncUserLabel) ncUserLabel.textContent = t('nextcloud_username_label');
    const ncPassLabel = document.querySelector('label[for="nextcloud-password"]');
    if (ncPassLabel) ncPassLabel.textContent = t('nextcloud_password_label');
    const ncFolderLabel = document.querySelector('label[for="nextcloud-folder"]');
    if (ncFolderLabel) ncFolderLabel.textContent = t('nextcloud_folder_label');
    const ncSaveBtn = document.getElementById('nextcloud-save');
    if (ncSaveBtn) ncSaveBtn.textContent = t('nextcloud_save_settings');
    const ncSyncBtn = document.getElementById('nextcloud-sync');
    if (ncSyncBtn) ncSyncBtn.textContent = t('nextcloud_sync_button');
    const ncDisconnectBtn = document.getElementById('nextcloud-disconnect');
    if (ncDisconnectBtn) ncDisconnectBtn.textContent = t('nextcloud_disconnect');
    if (typeof updateNextcloudFormFromConfig === 'function') updateNextcloudFormFromConfig({ keepPasswordField: true });
    const btnAdmin = document.getElementById('open-admin');
    if (btnAdmin) { btnAdmin.textContent = '⚙️ ' + t('administration'); btnAdmin.title = t('administration'); }
    // Backup section
    const backupLabel = document.querySelector('#backup-group h3');
    if (backupLabel) backupLabel.textContent = t('backup');
    const be = document.getElementById('backup-export');
    if (be) be.textContent = '📤 ' + t('export_backup');
    const bi = document.getElementById('backup-import');
    if (bi) bi.textContent = '📥 ' + t('import_backup');
    // Filtros
    const filterTag = document.getElementById('filter-tag');
    if (filterTag && filterTag.tagName === 'SELECT' && filterTag.options.length) {
      // Actualización diferida: renderTasks volverá a poblar con show_all
    }
    // Popup
    const nameInput = document.getElementById('popup-task-name');
    if (nameInput) nameInput.placeholder = t('placeholder_activity');
    const tagsInput = document.getElementById('popup-task-tags');
    if (tagsInput) tagsInput.placeholder = t('placeholder_tags');
    const filterLbl = document.getElementById('filter-tag-label');
    if (filterLbl) filterLbl.textContent = t('filter_by_tag');
    const searchLbl = document.getElementById('filter-search-label');
    if (searchLbl) searchLbl.textContent = t('search_label');
    const searchInput = document.getElementById('filter-search');
    if (searchInput) searchInput.placeholder = t('search_placeholder');
    // Selector de categorías en el modal: traducir etiquetas
    const catSelect = document.getElementById('popup-task-category');
    if (catSelect && typeof getEffectiveCategoryNames === 'function') {
      const names = getEffectiveCategoryNames();
      Array.from(catSelect.options).forEach(opt => {
        const key = opt && opt.value;
        if (key && names[key]) opt.textContent = names[key];
      });
    }
    const remLabel = document.querySelector('label[for="popup-task-reminder"]');
    if (remLabel) remLabel.textContent = t('reminder_label');
    // Confirm modal
    const confirmMsg = document.getElementById('confirm-message');
    if (confirmMsg) confirmMsg.textContent = t('confirm_generic');
    const confirmAccept = document.getElementById('confirm-accept');
    if (confirmAccept) confirmAccept.textContent = t('delete');
    const confirmCancel = document.getElementById('confirm-cancel');
    if (confirmCancel) confirmCancel.textContent = t('cancel');
    // Admin modal labels y handlers
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) {
      const title = adminModal.querySelector('h2');
      if (title) title.textContent = t('administration');
      const closeBtn = document.getElementById('admin-close');
      if (closeBtn) closeBtn.textContent = t('save');
            const openAdmin = document.getElementById('open-admin');
      if (openAdmin) openAdmin.onclick = ()=> { adminModal.style.display = 'flex'; };
      if (closeBtn) closeBtn.onclick = ()=> { adminModal.style.display = 'none'; };
      adminModal.onclick = (e)=>{ if (e.target === adminModal) adminModal.style.display = 'none'; };

      // Handlers de backup
      const fileInput = document.getElementById('backup-file-input');
      if (be) be.onclick = () => (window.i18n && i18n.exportBackup) ? i18n.exportBackup() : null;
      if (bi) bi.onclick = () => fileInput && fileInput.click();
      if (fileInput) fileInput.onchange = (e)=> { const f=e.target.files&&e.target.files[0]; if (f && window.i18n && i18n.importBackup) i18n.importBackup(f); e.target.value=''; };
    }
    // Enlaces de retorno
    document.querySelectorAll('a[href="index.html"]').forEach(a => { if (!a.classList.contains('tab')) a.textContent = t('back_to_app'); });
  }

  function applyI18nAll(){
    applyI18nCommon();
    // Forzar rerender de listas/categorías si app.js está cargado
    if (typeof window.renderTasks === 'function') {
      window.renderTasks();
    }
    // Vistas secundarias aportan su propio render
    if (typeof window.__rerenderArchive === 'function') window.__rerenderArchive();
    if (typeof window.__rerenderReminders === 'function') window.__rerenderReminders();
  }

  // Exponer API global
  window.i18n = {
    t,
    getLang,
    setLang,
    getLocale,
    i18nCategoryNames,
    applyI18nAll,
    exportBackup,
    importBackup,
    getTranslatedCategoryNames,
    getCategoryNameOverrides,
    setCategoryNameOverrides,
    resetCategoryNameOverrides,
    getEffectiveCategoryNames,
    DEFAULT_CATEGORY_NAMES,
    CATEGORY_KEYS
  };
})();
