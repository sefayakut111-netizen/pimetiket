# Denetçi cron'ları geçici durduruldu (4 Tem 2026)

Sefa kararı: otomatik denetçi (auditor) cron'ları geçici olarak duraklatıldı. Route dosyaları silinmedi; yalnızca `vercel.json` `crons` dizisinden tetikleyiciler kaldırıldı.

Sefa **"başlat"** deyince aşağıdaki 11 giriş `vercel.json` `crons` dizisine geri eklenecek.

```json
{ "path": "/api/cron/auditors/security",        "schedule": "0 1 * * *"  },
{ "path": "/api/cron/auditors/finance",         "schedule": "0 6 * * *"  },
{ "path": "/api/cron/auditors/workflow",        "schedule": "0 5 * * *"  },
{ "path": "/api/cron/auditors/compliance",      "schedule": "30 10 * * *" },
{ "path": "/api/cron/auditors/ai_cost",         "schedule": "30 9 * * *"  },
{ "path": "/api/cron/auditors/data_hygiene",    "schedule": "0 3 * * 0"  },
{ "path": "/api/cron/auditors/customer_health", "schedule": "0 10 * * 1" },
{ "path": "/api/cron/auditors/seo",             "schedule": "0 11 * * 3" },
{ "path": "/api/cron/auditors/brand",           "schedule": "0 14 * * 5" },
{ "path": "/api/cron/auditors/daily-digest",    "schedule": "0 8 * * *"  },
{ "path": "/api/cron/app-health",               "schedule": "0 6 * * *"  }
```
