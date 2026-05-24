/**
 * Dış servis HTTP / AI çağrı timeout sabitleri (ms).
 * API entegrasyon denetimi (May 2026) sonrası merkezi tanım.
 */

export const PAYTR_HTTP_TIMEOUT_MS = 15_000;
export const NETGSM_HTTP_TIMEOUT_MS = 10_000;
export const YURTICI_HTTP_TIMEOUT_MS = 20_000;
export const UPSTASH_HTTP_TIMEOUT_MS = 5_000;

/** GPT-4o vision — büyük görsel + structured output */
export const OPENAI_VISION_TIMEOUT_MS = 45_000;
/** Streaming chat — daha uzun pencere */
export const OPENAI_CHAT_TIMEOUT_MS = 90_000;
/** gpt-4o-mini kısa metin */
export const OPENAI_MINI_TIMEOUT_MS = 30_000;
