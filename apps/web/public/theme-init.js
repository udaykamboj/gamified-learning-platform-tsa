// Runs synchronously in <head>, before <body> paints, so the resolved
// Appearance (Light / Dark / System) is applied without a flash of the wrong
// theme. Same reason and same mechanism as dir-init.js.
//
// The storage key and class contract are mirrored in
// components/Contexts/ThemeContext.tsx — update both together.
(function () {
  var KEY = 'starlab-appearance';
  var pref = 'system';
  try {
    var stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
  } catch { /* storage unavailable: follow the OS */ }

  var dark = pref === 'dark';
  if (pref === 'system') {
    try { dark = window.matchMedia('(prefers-color-scheme: dark)').matches } catch { dark = false }
  }

  var root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
