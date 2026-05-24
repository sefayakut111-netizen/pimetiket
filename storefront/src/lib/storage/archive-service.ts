/**
 * Archive Service — Bir müşterinin tüm sıcak verisini R2'ye taşır.
 *
 * Sefa 18 May v68 (R2 cold storage paketi):
 * Postgres → R2 transfer pipeline. Tasarım dosyaları Supabase Storage'tan
 * indirilip R2'ye yüklenir. Tüm tablo kayıtları için archive_status='cold'.
 *
 * KULLANIM:
 *   const result = await archiveCustomer(userId, "3 ay hareketsizlik");
 *   if (result.success) { ... }
 *
 * GÜVENLİK:
 *   - DRY_RUN modunda gerçek yazma yapmaz (r2-client otomatik handle eder)
 *   - Race condition: status 'archiving' iken cron tekrar yakalamaz
 *   - Rollback: hata olursa 'hot'a geri alır + failed_archive audit
 *
 * Sistemde HENÜZ olmayan tablolar (graceful skip):
 *   - pim_conversations / pim_memory → atlanır
 */

import { createClient } from "@supabase/supabase-js";
import {
  uploadToR2Archive,
  r2KeyBuilders,
  IS_ARCHIVE_DRY_RUN,
} from "./r2-client";

export interface ArchiveResult {
  userId: string;
  success: boolean;
  dryRun: boolean;
  itemsArchived: {
    profile: boolean;
    orders: number;
    orderEvents: number;
    designFiles: number;
    reviews: number;
    returns: number;
  };
  totalBytes: number;
  errors: string[];
}

function makeServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "[archive-service] NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY env eksik"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Bir kullanıcının tüm sıcak verisini R2'ye taşır.
 *
 * @param userId — taşınacak müşteri UUID
 * @param reason — audit log için sebep (örn "3 ay hareketsizlik", "Sefa manuel")
 */
export async function archiveCustomer(
  userId: string,
  reason: string
): Promise<ArchiveResult> {
  const supabase = makeServiceClient();

  const result: ArchiveResult = {
    userId,
    success: false,
    dryRun: IS_ARCHIVE_DRY_RUN,
    itemsArchived: {
      profile: false,
      orders: 0,
      orderEvents: 0,
      designFiles: 0,
      reviews: 0,
      returns: 0,
    },
    totalBytes: 0,
    errors: [],
  };

  try {
    // ─────────────────────────────────────────────────────────
    // 1. Status'u 'archiving' yap (race condition koruması)
    // ─────────────────────────────────────────────────────────
    if (!IS_ARCHIVE_DRY_RUN) {
      const { error: lockErr } = await supabase
        .from("profiles")
        .update({ archive_status: "archiving" })
        .eq("id", userId);
      if (lockErr) {
        result.errors.push(`Lock failed: ${lockErr.message}`);
        return result;
      }
    }

    // ─────────────────────────────────────────────────────────
    // 2. Profil snapshot
    // ─────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profile) {
      const key = r2KeyBuilders.customerSnapshot(userId);
      const body = JSON.stringify(profile, null, 2);
      const r = await uploadToR2Archive({
        key,
        body,
        contentType: "application/json",
      });
      if (r.success) {
        result.itemsArchived.profile = true;
        result.totalBytes += r.size ?? body.length;
      } else {
        result.errors.push(`Profile upload: ${r.error}`);
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. Siparişler + order_events
    // ─────────────────────────────────────────────────────────
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId);

    for (const order of orders ?? []) {
      // Order JSON
      const orderKey = r2KeyBuilders.orderDetails(userId, order.id);
      const orderBody = JSON.stringify(order, null, 2);
      const r1 = await uploadToR2Archive({
        key: orderKey,
        body: orderBody,
        contentType: "application/json",
      });
      if (r1.success) {
        result.itemsArchived.orders++;
        result.totalBytes += r1.size ?? orderBody.length;
      }

      // Order events
      const { data: events } = await supabase
        .from("order_events")
        .select("*")
        .eq("order_id", order.id);
      if (events?.length) {
        const eventsKey = r2KeyBuilders.orderEvents(userId, order.id);
        const eventsBody = JSON.stringify(events, null, 2);
        const r2 = await uploadToR2Archive({
          key: eventsKey,
          body: eventsBody,
          contentType: "application/json",
        });
        if (r2.success) {
          result.itemsArchived.orderEvents += events.length;
          result.totalBytes += r2.size ?? eventsBody.length;
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 4. Tasarım dosyaları — Supabase Storage → R2
    // ─────────────────────────────────────────────────────────
    const { data: designFiles } = await supabase
      .from("design_files")
      .select("*")
      .eq("user_id", userId)
      .eq("archive_status", "hot");

    for (const df of designFiles ?? []) {
      try {
        if (!df.storage_path) {
          result.errors.push(`Design file ${df.id}: no storage_path`);
          continue;
        }

        let buffer: Buffer;

        if (IS_ARCHIVE_DRY_RUN) {
          // Dry-run: gerçek indirme yapma, placeholder buffer kullan
          buffer = Buffer.from(
            JSON.stringify({ dryRun: true, designFileId: df.id })
          );
        } else {
          // Supabase Storage'dan indir
          const { data: fileBlob, error: dlErr } = await supabase.storage
            .from("designs")
            .download(df.storage_path);

          if (dlErr || !fileBlob) {
            result.errors.push(
              `Design file ${df.id} download failed: ${dlErr?.message ?? "no blob"}`
            );
            continue;
          }

          buffer = Buffer.from(await fileBlob.arrayBuffer());
        }

        const r2Key = r2KeyBuilders.designFile(
          userId,
          df.order_id ?? "no-order",
          df.version ?? 1,
          df.original_name ?? `file-${df.id}`
        );

        const upload = await uploadToR2Archive({
          key: r2Key,
          body: buffer,
          contentType: df.mime_type ?? "application/octet-stream",
          metadata: {
            "design-file-id": String(df.id),
            "user-id": userId,
            "original-name": df.original_name ?? "",
          },
        });

        if (!upload.success) {
          result.errors.push(`Design file ${df.id} upload: ${upload.error}`);
          continue;
        }

        if (!IS_ARCHIVE_DRY_RUN) {
          // Postgres'i güncelle
          await supabase
            .from("design_files")
            .update({
              archive_status: "cold",
              archive_path: r2Key,
              archive_size_bytes: buffer.length,
              archived_at: new Date().toISOString(),
            })
            .eq("id", df.id);

          // Supabase Storage'dan sil (yer açmak için)
          if (df.storage_path) {
            await supabase.storage.from("designs").remove([df.storage_path]);
          }
        }

        result.itemsArchived.designFiles++;
        result.totalBytes += buffer.length;
      } catch (err) {
        result.errors.push(`Design file ${df.id}: ${(err as Error).message}`);
      }
    }

    // ─────────────────────────────────────────────────────────
    // 5. Yorumlar
    // ─────────────────────────────────────────────────────────
    const { data: reviews } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId);
    if (reviews?.length) {
      const key = r2KeyBuilders.reviewSnapshot(userId);
      const body = JSON.stringify(reviews, null, 2);
      const r = await uploadToR2Archive({
        key,
        body,
        contentType: "application/json",
      });
      if (r.success) {
        result.itemsArchived.reviews = reviews.length;
        result.totalBytes += r.size ?? body.length;

        if (!IS_ARCHIVE_DRY_RUN) {
          await supabase
            .from("reviews")
            .update({
              archive_status: "cold",
              archive_path: key,
              archived_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 6. İadeler
    // ─────────────────────────────────────────────────────────
    const { data: returns } = await supabase
      .from("returns")
      .select("*")
      .eq("user_id", userId);
    if (returns?.length) {
      const key = r2KeyBuilders.returnSnapshot(userId);
      const body = JSON.stringify(returns, null, 2);
      const r = await uploadToR2Archive({
        key,
        body,
        contentType: "application/json",
      });
      if (r.success) {
        result.itemsArchived.returns = returns.length;
        result.totalBytes += r.size ?? body.length;

        if (!IS_ARCHIVE_DRY_RUN) {
          await supabase
            .from("returns")
            .update({
              archive_status: "cold",
              archive_path: key,
              archived_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 7. Profil + Orders status'unu 'cold' yap
    // ─────────────────────────────────────────────────────────
    if (!IS_ARCHIVE_DRY_RUN) {
      await supabase
        .from("profiles")
        .update({
          archive_status: "cold",
          archived_at: new Date().toISOString(),
          archive_path: r2KeyBuilders.customerSnapshot(userId),
        })
        .eq("id", userId);

      await supabase
        .from("orders")
        .update({
          archive_status: "cold",
          archived_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    // ─────────────────────────────────────────────────────────
    // 8. Audit log
    // ─────────────────────────────────────────────────────────
    if (!IS_ARCHIVE_DRY_RUN) {
      await supabase.from("archive_events").insert({
        event_type: "archived_to_cold",
        resource_type: "customer_bundle",
        resource_id: userId,
        user_id: userId,
        actor_type: "system",
        archive_path: r2KeyBuilders.customerPrefix(userId),
        size_bytes: result.totalBytes,
        reason,
        metadata: { items_archived: result.itemsArchived },
      });
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (err) {
    result.errors.push((err as Error).message);

    // Rollback: status'u 'hot'a al
    if (!IS_ARCHIVE_DRY_RUN) {
      await supabase
        .from("profiles")
        .update({ archive_status: "hot" })
        .eq("id", userId);

      await supabase.from("archive_events").insert({
        event_type: "failed_archive",
        resource_type: "customer_bundle",
        resource_id: userId,
        user_id: userId,
        actor_type: "system",
        reason,
        metadata: {
          error: (err as Error).message,
          partial: result.itemsArchived,
        },
      });
    }

    return result;
  }
}
