// Resolves the theme before first paint. Angular bootstraps a moment later, and
// without this a dark-mode user gets a white flash on every reload.
//
// A separate file rather than an inline <script> so the Content-Security-Policy
// can stay `script-src 'self'` with no 'unsafe-inline' and no hash to keep in
// sync — a stale hash would fail silently, bringing the flash back.
// It's still render-blocking in <head>, so it runs before paint either way.
(function () {
  try {
    var stored = localStorage.getItem('ludoteca.theme');
    var dark =
      stored === 'dark' ||
      ((!stored || stored === 'system') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    // Private mode or blocked storage: fall back to light rather than crash.
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
