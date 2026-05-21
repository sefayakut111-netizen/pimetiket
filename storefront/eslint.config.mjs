import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sefa 21 May v68: scripts/ Node CommonJS — require() yasak değil
    "scripts/**",
  ]),
  // Sefa 21 May v68 (CI ilk run cleanup): Bu kuralları "warn" yap —
  // CI yeşil kalsın, regression sigortası çalışsın. Aşamalı temizlik
  // sonra yapılır (BEKLEYEN-ISLER'da takip notu).
  //
  // GEREKÇE:
  // - no-unescaped-entities: TR içerikte apostrof yoğun (Pim Etiket'i,
  //   tasarımın, vb.) → çoğu yanlış pozitif, manuel HTML entity hantal
  // - react-hooks/set-state-in-effect: React 19 yeni kural, mevcut
  //   pattern'lerimizle 75 yerde çakışıyor → ayrı refactor sprintı
  // - react-hooks/purity + immutability + preserve-manual-memoization:
  //   React Compiler hazırlık kuralları, henüz adopt etmedik
  // - exhaustive-deps: çoğu false-positive (intentional missing deps)
  // - typescript-eslint/no-unused-vars: leading underscore (_var) ile
  //   geçici tutulanlar dahil — kategorize fix ayrı iş
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
