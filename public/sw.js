self.addEventListener('install', (e) => {
  console.log('[Service Worker] Installed');
});

// Cet événement est OBLIGATOIRE pour que Chrome propose le bouton "Installer"
self.addEventListener('fetch', (e) => {
  // Laisse le navigateur faire la requête normale
});
