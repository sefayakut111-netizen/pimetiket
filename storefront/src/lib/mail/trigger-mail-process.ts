/**
 * Mail outbox cron endpoint'ini fire-and-forget tetikler.
 * Atama RPC'si gibi enqueueMail dışı kuyruk insert'lerinden sonra kullanılır.
 */

import "server-only";

export async function triggerMailProcess(): Promise<void> {
  try {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return;
    }
    await fetch(`${siteUrl}/api/cron/process-mail-outbox`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.warn(
      "[mail/trigger] process trigger failed (will run on cron):",
      err instanceof Error ? err.message : err
    );
  }
}
