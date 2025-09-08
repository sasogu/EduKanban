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
    navigator.serviceWorker.register('service-worker.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        requestVersion();
        navigator.serviceWorker.addEventListener('controllerchange', () => setTimeout(requestVersion, 300));
      })
      .catch(err => console.log('ServiceWorker registro fallido:', err));
  });
})();
