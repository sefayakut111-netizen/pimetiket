# Geliştirme ve debug script'leri

Bu klasördeki dosyalar production runtime'da kullanılmaz. Local troubleshooting,
migration test ve bir kerelik repair işlemleri içindir.

Kullanım örneği:

```bash
node scripts/dev/debug-order-events.mjs <order-id>
```

Production deploy bu klasörü etkilemez (Vercel build'e dahil değil).
