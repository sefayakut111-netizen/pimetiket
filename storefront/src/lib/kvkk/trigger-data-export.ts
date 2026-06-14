/**
 * KVKK data export cron endpoint'ini fire-and-forget tetikler (Hobby yedek + anlık).
 */

import "server-only";

export async function triggerDataExportProcess(): Promise<void> {
  try {
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://pimetiket.com";
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return;
    }
    await fetch(`${siteUrl}/api/cron/process-data-export`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.warn(
      "[kvkk/trigger-data-export] cron trigger failed (will run on schedule):",
      err instanceof Error ? err.message : err
    );
  }
}
