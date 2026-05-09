// OpenNext Cloudflare config
// https://opennext.js.org/cloudflare/config
//
// Pim Etiket — Cloudflare Pages adapter konfigürasyonu.
// Default config Next.js 16 için yeterli; ileride incremental cache (R2)
// veya tag cache (D1) eklemek istersen buradan.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Incremental Static Regeneration cache — şimdilik in-memory (default).
  // Production'da R2 veya KV önerilir; trafik artınca açarız.
  // incrementalCache: r2IncrementalCache,
});
