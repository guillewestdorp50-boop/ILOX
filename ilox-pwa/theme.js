(() => {
  'use strict';
  const KEY = 'west-vill-theme';
  const root = document.documentElement;

  function apply(mode) {
    const day = mode === 'day';
    document.body.classList.toggle('theme-day', day);
    root.style.colorScheme = day ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', day ? '#f3f6fa' : '#101e35');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.textContent = day ? '☾ Noche' : '☀ Día';
      button.setAttribute('aria-label', day ? 'Activar modo nocturno' : 'Activar modo diurno');
      button.setAttribute('aria-pressed', String(day));
    });
  }

  let saved = 'night';
  try { saved = localStorage.getItem(KEY) || 'night'; } catch (_) {}
  apply(saved);

  // Delegación: el botón sigue funcionando aunque el contenido de la pantalla cambie.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    const next = document.body.classList.contains('theme-day') ? 'night' : 'day';
    try { localStorage.setItem(KEY, next); } catch (_) {}
    apply(next);
  });
})();