import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    // Pim Etiket özel modülleri (G adımı iskelet — service custom logic
    // sonraki commit'lerde dolacak; data modelleri hazır)
    {
      resolve: "./src/modules/label-config",
    },
    {
      resolve: "./src/modules/pricing-engine",
    },
    {
      resolve: "./src/modules/qc-pipeline",
    },
    {
      resolve: "./src/modules/proof",
    },
    {
      resolve: "./src/modules/fason-routing",
    },
    {
      resolve: "./src/modules/file-upload",
    },
  ],
});
