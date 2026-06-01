/**
 * Next.js Instrumentation — Sentry hook'u.
 * Server start ve edge start sırasında çağrılır.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    if (
      process.env.NODE_ENV === "production" &&
      process.env.PAYTR_TEST_MODE !== "0"
    ) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureMessage(
        "PAYTR_TEST_MODE production'da explicit 0 değil — Vercel env doğrula",
        { level: "warning", tags: { scope: "paytr.config" } }
      );
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
