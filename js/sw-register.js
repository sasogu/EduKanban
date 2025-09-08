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
    navigator.serviceWorker.register(swUrl)
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        requestVersion();
        navigator.serviceWorker.addEventListener('controllerchange', () => setTimeout(requestVersion, 300));
      })
      .catch(err => console.log('ServiceWorker registro fallido:', err));
  });
})();
