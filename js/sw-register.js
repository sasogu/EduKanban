(() => {
  if (!('serviceWorker' in navigator)) return;

  const updateFooter = (v) => {
    const el = document.getElementById('sw-version');
    if (el) el.textContent = v || '';
  };
  // Mostrar estado inicial
  updateFooter('…');

  // Escuchar mensajes desde el SW lo antes posible
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SW_VERSION') updateFooter(e.data.version);
  });

  const requestVersion = () => {
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'GET_SW_VERSION' });
      }
    } catch (_) {}
  };

  window.addEventListener('load', () => {
    const p = window.location.pathname || '/';
    const i = p.lastIndexOf('/');
    const base = i >= 0 ? p.slice(0, i + 1) : '/';
    const swUrl = base + 'service-worker.js';
    let refreshing = false;
    navigator.serviceWorker.register(swUrl)
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        requestVersion();
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Solicitar versión y forzar recarga una sola vez cuando cambie el SW
          setTimeout(requestVersion, 200);
          if (refreshing) return;
          refreshing = true;
          setTimeout(() => { try { window.location.reload(); } catch (_) {} }, 300);
        });
      })
      .catch(err => console.log('ServiceWorker registro fallido:', err));
  });
})();
