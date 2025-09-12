document.addEventListener('DOMContentLoaded', function() {
  const LS = {
    categories: 'edukanban.categories',
    selectedHistoryTag: 'edukanban.selectedHistoryTag',
    selectedHistoryDate: 'edukanban.selectedHistoryDate'
  };

  const dateInput = document.getElementById('history-date');
  const tagSelect = document.getElementById('history-tag');
  const container = document.getElementById('history-container');
  const latestBtn = document.getElementById('history-latest');
  const summaryEl = document.getElementById('history-summary');

  function normalizeKey(k) {
    const m = {
      'bandeja-de-entrada': 'en-preparacion',
      'prioritaria': 'preparadas',
      'proximas': 'en-proceso',
      'algun-dia': 'pendientes',
      'en-preparacion': 'en-preparacion',
      'preparadas': 'preparadas',
      'en-proceso': 'en-proceso',
      'pendientes': 'pendientes',
      'archivadas': 'archivadas'
    };
    return m[k] || k;
  }
  function migrateObj(obj) {
    const t = { 'en-preparacion': [], 'preparadas': [], 'en-proceso': [], 'pendientes': [], 'archivadas': [] };
    for (const k in obj) {
      const nk = normalizeKey(k);
      if (Array.isArray(obj[k])) t[nk] = (t[nk] || []).concat(obj[k]);
    }
    return t;
  }

  function getAllCategories() {
    const raw = JSON.parse(localStorage.getItem(LS.categories) || '{}');
    const migrated = migrateObj(raw);
    try { localStorage.setItem(LS.categories, JSON.stringify(migrated)); } catch(_) {}
    return migrated;
  }

  function allTasks() {
    const cats = getAllCategories();
    return Object.values(cats).flat();
  }

  function localDateStr(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    } catch (_) { return ''; }
  }

  function collectHistoryDates() {
    const set = new Set();
    allTasks().forEach(t => {
      const hist = Array.isArray(t.doneHistory) ? t.doneHistory : [];
      hist.forEach(h => { const ds = localDateStr(h); if (ds) set.add(ds); });
    });
    return Array.from(set).sort(); // asc
  }

  function getAllTags() {
    const s = new Set();
    allTasks().forEach(t => Array.isArray(t.tags) && t.tags.forEach(tag => s.add(tag)));
    return Array.from(s).sort();
  }

  function updateTagSelect(current = '') {
    const tags = getAllTags();
    let html = '<option value="">Todas</option>';
    const hasCurrent = current && tags.includes(current);
    const rendered = hasCurrent ? tags : [current, ...tags].filter((v, i, a) => v && a.indexOf(v) === i);
    html += rendered.map(t => `<option value="${t}">${t}</option>`).join('');
    tagSelect.innerHTML = html;
    tagSelect.value = current || '';
  }

  function tasksDoneOnDate(dateStr, filterTag = '') {
    const res = [];
    allTasks().forEach(t => {
      const hist = Array.isArray(t.doneHistory) ? t.doneHistory : [];
      // contar cuántas veces ese día
      const times = hist.filter(h => localDateStr(h) === dateStr);
      if (times.length === 0) return;
      if (filterTag && (!Array.isArray(t.tags) || !t.tags.includes(filterTag))) return;
      const lastTs = times[times.length - 1];
      res.push({ task: t, count: times.length, last: lastTs });
    });
    // ordenar por hora de último realizado desc
    res.sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
    return res;
  }

  // Agrupa por fecha (más reciente primero) y aplica filtro de etiqueta
  function groupByDate(filterTag = '') {
    const dates = collectHistoryDates();
    dates.sort((a, b) => a.localeCompare(b));
    dates.reverse();
    return dates.map(ds => ({ date: ds, items: tasksDoneOnDate(ds, filterTag) }))
                .filter(g => g.items.length > 0);
  }

  function render() {
    const d = dateInput.value;
    const tag = tagSelect.value || '';
    const locale = (window.i18n && i18n.getLocale) ? i18n.getLocale() : 'es-ES';
    container.innerHTML = '';
    if (!d) {
      const groups = groupByDate(tag);
      if (!groups.length) {
        summaryEl.textContent = 'No hay actividades realizadas con el filtro actual.';
        return;
      }
      const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
      summaryEl.textContent = `${totalItems} actividades en ${groups.length} días${tag ? ' • #' + tag : ''}`;
      groups.forEach(g => {
        const h = document.createElement('h3');
        h.className = 'history-date';
        h.textContent = new Date(g.date).toLocaleDateString(locale, { dateStyle: 'full' });
        const meta = document.createElement('div');
        meta.className = 'history-meta';
        meta.textContent = `${g.items.length} actividades`;
        container.appendChild(h);
        container.appendChild(meta);
        g.items.forEach(({ task, count, last }) => {
          const div = document.createElement('div');
          div.className = 'task';
          const tags = Array.isArray(task.tags) ? task.tags : [];
          const lastStr = new Date(last).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
          div.innerHTML = `
            <span>${escapeHTML(task.task)}
              ${tags.length ? `<small class=\"tags\">${tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
              <small class=\"done-meta\">✔️ ${count} veces • última: ${lastStr}</small>
            </span>
          `;
          container.appendChild(div);
        });
      });
      return;
    }
    const items = tasksDoneOnDate(d, tag);
    if (items.length === 0) {
      summaryEl.textContent = 'No hay actividades realizadas en esa fecha con el filtro actual.';
      return;
    }
    summaryEl.textContent = `${items.length} actividades realizadas el ${new Date(d).toLocaleDateString(locale)}${tag ? ' • #' + tag : ''}`;
    items.forEach(({ task, count, last }) => {
      const div = document.createElement('div');
      div.className = 'task';
      const tags = Array.isArray(task.tags) ? task.tags : [];
      const lastStr = new Date(last).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      div.innerHTML = `
        <span>${escapeHTML(task.task)}
          ${tags.length ? `<small class=\"tags\">${tags.map(t => `<span class=\"tag-chip in-task\">#${t}</span>`).join(' ')}</small>` : ''}
          <small class=\"done-meta\">✔️ ${count} veces • última: ${lastStr}</small>
        </span>
      `;
      container.appendChild(div);
    });
  }

  function escapeHTML(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Inicialización
  const dates = collectHistoryDates();
  // valor inicial: usar el guardado; si no hay, mostrar todo desglosado
  const savedDate = localStorage.getItem(LS.selectedHistoryDate) || '';
  const initialDate = savedDate;
  if (initialDate) dateInput.value = initialDate;
  updateTagSelect(localStorage.getItem(LS.selectedHistoryTag) || '');
  render();

  // Eventos
  dateInput.addEventListener('change', () => {
    try { localStorage.setItem(LS.selectedHistoryDate, dateInput.value || ''); } catch(_) {}
    render();
  });
  tagSelect.addEventListener('change', () => {
    try { localStorage.setItem(LS.selectedHistoryTag, tagSelect.value || ''); } catch(_) {}
    render();
  });
  latestBtn.addEventListener('click', () => {
    const ds = collectHistoryDates();
    if (!ds.length) return;
    dateInput.value = ds[ds.length - 1];
    try { localStorage.setItem(LS.selectedHistoryDate, dateInput.value || ''); } catch(_) {}
    render();
  });
});
