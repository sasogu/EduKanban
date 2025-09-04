// i18n minimal para EduKanban (ES / Valencià)
(function(){
  const TRANSLATIONS = {
    es: {
      language: 'Idioma',
      synchronization: 'Sincronización',
      new_activity: 'Nueva Actividad',
      view_reminders: '⏰ Ver Recordatorios',
      view_archive: '🗄️ Ver Archivo',
      connect_dropbox: 'Conectar con Dropbox',
      sync_dropbox: 'Sincronizar',
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
    },
    val: {
      language: 'Idioma',
      synchronization: 'Sincronització',
      new_activity: 'Nova activitat',
      view_reminders: '⏰ Veure recordatoris',
      view_archive: '🗄️ Veure arxiu',
      connect_dropbox: 'Connectar amb Dropbox',
      sync_dropbox: 'Sincronitzar',
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
    }
  };

  function getLang(){
    const l = localStorage.getItem('lang');
    if (l) return l;
    const nav = (navigator.language || 'ca').toLowerCase();
    if (nav.startsWith('ca')) return 'val';
    if (nav.startsWith('es')) return 'es';
    return 'val'; // Valencià por defecto
  }
  function setLang(l){ try { localStorage.setItem('lang', l); } catch(_){} }
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
  function i18nCategoryNames(){
    return {
      'en-preparacion': t('cat_en_preparacion'),
      'preparadas': t('cat_preparadas'),
      'en-proceso': t('cat_en_proceso'),
      'pendientes': t('cat_pendientes'),
      'archivadas': t('cat_archivadas')
    };
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
    // Cabecera de sincronización
    const syncLabel = document.querySelector('#sync-group h3');
    if (syncLabel) syncLabel.textContent = t('synchronization');
    // Botones comunes si existen
    const btnNew = document.getElementById('abrir-popup-tarea');
    if (btnNew) btnNew.textContent = '➕ ' + t('new_activity');
    const aRem = document.querySelector('a[href="recordatorios.html"]');
    if (aRem) aRem.textContent = t('view_reminders');
    const aArc = document.querySelector('a[href="archivo.html"]');
    if (aArc) aArc.textContent = t('view_archive');
    const btnLogin = document.getElementById('dropbox-login');
    if (btnLogin) btnLogin.textContent = t('connect_dropbox');
    const btnSync = document.getElementById('dropbox-sync');
    if (btnSync) btnSync.textContent = t('sync_dropbox');
    // Filtros
    const filterTag = document.getElementById('filter-tag');
    if (filterTag && filterTag.options.length) {
      // Actualización diferida: renderTasks volverá a poblar con show_all
    }
    // Popup
    const nameInput = document.getElementById('popup-task-name');
    if (nameInput) nameInput.placeholder = t('placeholder_activity');
    const tagsInput = document.getElementById('popup-task-tags');
    if (tagsInput) tagsInput.placeholder = t('placeholder_tags');
    const remLabel = document.querySelector('label[for="popup-task-reminder"]');
    if (remLabel) remLabel.textContent = t('reminder_label');
    // Confirm modal
    const confirmMsg = document.getElementById('confirm-message');
    if (confirmMsg) confirmMsg.textContent = t('confirm_generic');
    const confirmAccept = document.getElementById('confirm-accept');
    if (confirmAccept) confirmAccept.textContent = t('delete');
    const confirmCancel = document.getElementById('confirm-cancel');
    if (confirmCancel) confirmCancel.textContent = t('cancel');
    // Enlaces de retorno
    document.querySelectorAll('a[href="index.html"]').forEach(a => a.textContent = t('back_to_app'));
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
  window.i18n = { t, getLang, setLang, getLocale, i18nCategoryNames, applyI18nAll };
})();
