/* APP Ventas — Service Worker (mínimo y seguro)
   - NO cachea Supabase ni requests dinámicos
   - Solo deja al navegador comportarse normal
   - Permite "instalable" (PWA) sin riesgos de loops
*/

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No interceptamos fetch (evita romper auth / RLS / sesiones)