/**
 * Instagram token helper — unit doğrulama.
 * Kullanım: npm run verify:instagram-token
 */
import {
  computeTokenExpiresAt,
  daysUntilIso,
  parseInstagramRefreshResponse,
  resolveInstagramTokenPriority,
} from "../src/lib/instagram/token-utils";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  // (a) DB > env önceliği
  const dbWins = resolveInstagramTokenPriority("db-token", "env-token");
  assert(dbWins.token === "db-token" && dbWins.source === "db", "DB öncelikli");
  const envFallback = resolveInstagramTokenPriority(null, "env-only");
  assert(
    envFallback.token === "env-only" && envFallback.source === "env",
    "env fallback"
  );
  const none = resolveInstagramTokenPriority("", undefined);
  assert(none.token === null && none.source === "none", "none when empty");
  console.log("[verify-instagram-token] priority OK");

  // (b) refresh response parse
  const good = parseInstagramRefreshResponse({
    access_token: "new-token",
    expires_in: 5_184_000,
  });
  assert(good?.accessToken === "new-token", "access_token parse");
  assert(good?.expiresIn === 5_184_000, "expires_in parse");
  assert(
    parseInstagramRefreshResponse({ access_token: "x" }) === null,
    "missing expires_in"
  );
  assert(
    parseInstagramRefreshResponse({ expires_in: 100 }) === null,
    "missing access_token"
  );
  console.log("[verify-instagram-token] refresh parse OK");

  // (c) expires_at hesabı
  const before = Date.now();
  const iso = computeTokenExpiresAt(3600);
  const after = Date.now() + 3600 * 1000;
  const parsed = new Date(iso).getTime();
  assert(parsed >= before + 3590 * 1000, "expires_at lower bound");
  assert(parsed <= after + 1000, "expires_at upper bound");
  const days = daysUntilIso(iso);
  assert(days !== null && days >= 0, "daysUntil future");
  console.log("[verify-instagram-token] expires calc OK");

  console.log("[verify-instagram-token] ALL OK");
}

main();
