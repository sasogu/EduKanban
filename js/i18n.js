// i18n minimal para EduKanban (ES / Valencià)
(function(){
  const TRANSLATIONS = {
    es: {
      language: 'Idioma',
      synchronization: 'Sincronización',
      administration: 'Administración',
      filter_by_tag: 'Filtrar por etiqueta:',
      reconnecting: 'Reconectando con Dropbox…',
      reconnected_retrying: 'Reconectado. Reintentando operación…',
      backup: 'Copia de seguridad',
      export_backup: 'Exportar copia',
      import_backup: 'Importar copia',
      backup_created: 'Copia creada',
      backup_restored: 'Copia restaurada',
      backup_invalid: 'Archivo de copia no válido',
      new_activity: 'Nueva Actividad',
      view_reminders: '⏰ Ver Recordatorios',
      view_archive: '🗄️ Ver Archivo',
      board: '📋 Tablero',
      history: '📅 Histórico',
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
      reuse_attachment: 'Reutilizar adjunto',
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
    },
    val: {
      language: 'Idioma',
      synchronization: 'Sincronització',
      administration: 'Administració',
      filter_by_tag: 'Filtrar per etiqueta:',
      reconnecting: 'Tornant a connectar amb Dropbox…',
      reconnected_retrying: 'Reconnectat. Reintentant operació…',
      backup: 'Còpia de seguretat',
      export_backup: 'Exportar còpia',
      import_backup: 'Importar còpia',
      backup_created: 'Còpia creada',
      backup_restored: 'Còpia restaurada',
      backup_invalid: 'Fitxer de còpia no vàlid',
      new_activity: 'Nova activitat',
      view_reminders: '⏰ Veure recordatoris',
      view_archive: '🗄️ Veure arxiu',
      board: '📋 Tauler',
      history: '📅 Històric',
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
      reuse_attachment: 'Reutilitzar adjunt',
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
    }
  };

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
  function i18nCategoryNames(){
    return {
      'en-preparacion': t('cat_en_preparacion'),
      'preparadas': t('cat_preparadas'),
      'en-proceso': t('cat_en_proceso'),
      'pendientes': t('cat_pendientes'),
      'archivadas': t('cat_archivadas')
    };
  }


  // Helpers de backup reutilizables en todas las páginas
  const LS_BACKUP = { categories: 'edukanban.categories', deleted: 'edukanban.deletedTasks' };
  function getNowStamp(){
    const d=new Date(); const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
  function safeToast(msg,type){ if (window.showToast) showToast(msg,type); else try{console.log(msg)}catch(_){}}
  function exportBackup(){
    try{
      const categories = JSON.parse(localStorage.getItem(LS_BACKUP.categories) || '{}');
      const deletedTasks = JSON.parse(localStorage.getItem(LS_BACKUP.deleted) || '[]');
      const payload = { app: 'EduKanban', version: '2.0.0', exportedAt: new Date().toISOString(), categories, deletedTasks };
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
      if (!data || typeof data !== 'object' || !data.categories) throw new Error('invalid');
      localStorage.setItem(LS_BACKUP.categories, JSON.stringify(data.categories));
      if (Array.isArray(data.deletedTasks)) localStorage.setItem(LS_BACKUP.deleted, JSON.stringify(data.deletedTasks));
      safeToast(t('backup_restored'));
      if (typeof window.renderTasks === 'function') window.renderTasks();
      if (typeof window.__rerenderArchive === 'function') window.__rerenderArchive();
      if (typeof window.__rerenderReminders === 'function') window.__rerenderReminders();
    }catch(e){ console.error('importBackup',e); safeToast(t('backup_invalid'),'error'); }
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
    if (filterTag && filterTag.options.length) {
      // Actualización diferida: renderTasks volverá a poblar con show_all
    }
    // Popup
    const nameInput = document.getElementById('popup-task-name');
    if (nameInput) nameInput.placeholder = t('placeholder_activity');
    const tagsInput = document.getElementById('popup-task-tags');
    if (tagsInput) tagsInput.placeholder = t('placeholder_tags');
    const filterLbl = document.getElementById('filter-tag-label');
    if (filterLbl) filterLbl.textContent = t('filter_by_tag');
    // Selector de categorías en el modal: traducir etiquetas
    const catSelect = document.getElementById('popup-task-category');
    if (catSelect && typeof i18nCategoryNames === 'function') {
      const names = i18nCategoryNames();
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
  window.i18n = { t, getLang, setLang, getLocale, i18nCategoryNames, applyI18nAll, exportBackup, importBackup };
})();
