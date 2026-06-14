/**
 * KVKK tamamlanınca kullanıcı depolama izlerini siler.
 * Sipariş kayıtları (VUK 10 yıl) korunur — yalnızca fiziksel dosyalar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  deleteFromR2,
  listR2Objects,
  r2KeyBuilders,
} from "@/lib/storage/r2-client";
import {
  deleteR2Keys,
  isR2StorageKey,
  normalizeR2Key,
} from "@/lib/storage/purge-r2";

const DESIGNS_BUCKET = SUPABASE_STORAGE_BUCKETS.designs;
const PREVIEWS_BUCKET = SUPABASE_STORAGE_BUCKETS.designPreviews;

export interface KvkkStoragePurgeParams {
  admin: SupabaseClient;
  userId: string;
  kind: "account_delete" | "partial_delete";
  scope?: Record<string, unknown> | null;
  actorId: string;
  actorType: "admin" | "user" | "system";
  kvkkRequestId?: string;
  reason?: string;
}

export interface KvkkStoragePurgeResult {
  ok: boolean;
  error?: string;
  supabaseDeleted: number;
  supabaseErrors: number;
  r2Deleted: number;
  r2Errors: number;
}

interface PurgeScope {
  full: boolean;
  designs: boolean;
  orders: boolean;
  profile: boolean;
  reviews: boolean;
}

function resolvePurgeScope(
  kind: KvkkStoragePurgeParams["kind"],
  scope: Record<string, unknown> | null | undefined
): PurgeScope | null {
  if (kind === "account_delete") {
    return {
      full: true,
      designs: true,
      orders: true,
      profile: true,
      reviews: true,
    };
  }
  if (kind !== "partial_delete") return null;
  const s = scope ?? {};
  const designs = s.designs === true;
  const orders = s.orders === true;
  const profile = s.profile === true;
  const reviews = s.reviews === true;
  if (!designs && !orders && !profile && !reviews) return null;
  return {
    full: false,
    designs,
    orders,
    profile,
    reviews,
  };
}

export function shouldPurgeKvkkStorage(
  kind: string,
  scope: Record<string, unknown> | null | undefined
): boolean {
  if (kind === "account_delete") return true;
  if (kind === "partial_delete") {
    return resolvePurgeScope("partial_delete", scope) !== null;
  }
  return false;
}

async function listSupabaseFolder(
  admin: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    const { data, error } = await admin.storage.from(bucket).list(dir, {
      limit: 1000,
    });
    if (error || !data?.length) return;

    for (const item of data) {
      const path = dir ? `${dir}/${item.name}` : item.name;
      if (item.id === null) {
        await walk(path);
      } else {
        paths.push(path);
      }
    }
  }

  await walk(prefix);
  return paths;
}

async function logPurgeEvent(
  admin: SupabaseClient,
  params: {
    userId: string;
    actorId: string;
    actorType: string;
    resourceType: string;
    resourceId: string;
    archivePath?: string;
    reason: string;
    metadata: Record<string, unknown>;
    kvkkRequestId?: string;
  }
): Promise<void> {
  const { error } = await admin.from("archive_events").insert({
    event_type: "permanent_deleted",
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    user_id: params.userId,
    actor_id: params.actorId,
    actor_type: params.actorType,
    archive_path: params.archivePath ?? null,
    reason: params.reason,
    metadata: {
      ...params.metadata,
      kvkk_request_id: params.kvkkRequestId ?? null,
    },
  });
  if (error) {
    console.error("[kvkk/storage-purge] archive_events insert failed:", error);
    throw new Error(error.message);
  }
}

async function deleteSupabasePaths(
  admin: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await admin.storage.from(bucket).remove(batch);
    if (error) {
      console.error("[kvkk/storage-purge] supabase delete error:", bucket, error);
      errors += batch.length;
    } else {
      deleted += (data as { name: string }[])?.length ?? batch.length;
    }
  }

  return { deleted, errors };
}

async function deleteR2Prefix(
  prefix: string
): Promise<{ deleted: number; errors: number; keys: string[] }> {
  const keys = await listR2Objects(prefix);
  if (keys.length === 0) return { deleted: 0, errors: 0, keys: [] };
  const result = await deleteR2Keys(keys);
  return { deleted: result.deleted, errors: result.errors, keys };
}

export async function purgeKvkkUserStorage(
  params: KvkkStoragePurgeParams
): Promise<KvkkStoragePurgeResult> {
  const purgeScope = resolvePurgeScope(params.kind, params.scope);
  if (!purgeScope) {
    return {
      ok: true,
      supabaseDeleted: 0,
      supabaseErrors: 0,
      r2Deleted: 0,
      r2Errors: 0,
    };
  }

  const {
    admin,
    userId,
    actorId,
    actorType,
    kvkkRequestId,
    reason = "KVKK depolama temizliği",
  } = params;

  let supabaseDeleted = 0;
  let supabaseErrors = 0;
  let r2Deleted = 0;
  let r2Errors = 0;

  const { data: orderRows } = await admin
    .from("orders")
    .select("id")
    .eq("user_id", userId);
  const orderIds = (orderRows ?? []).map((r) => (r as { id: string }).id);

  // ---- Supabase: design_files.storage_path ----
  if (purgeScope.full || purgeScope.designs || purgeScope.orders) {
    const { data: fileRows } = await admin
      .from("design_files")
      .select("id, storage_path, archive_path")
      .eq("user_id", userId);

    const supabasePaths: string[] = [];
    const r2Keys: string[] = [];

    for (const row of fileRows ?? []) {
      const fr = row as {
        id: string;
        storage_path: string | null;
        archive_path: string | null;
      };
      if (fr.storage_path && !isR2StorageKey(fr.storage_path)) {
        supabasePaths.push(fr.storage_path);
      } else if (fr.storage_path && isR2StorageKey(fr.storage_path)) {
        r2Keys.push(normalizeR2Key(fr.storage_path));
      }
      if (fr.archive_path) r2Keys.push(normalizeR2Key(fr.archive_path));
    }

    if (supabasePaths.length > 0) {
      const r = await deleteSupabasePaths(admin, DESIGNS_BUCKET, supabasePaths);
      supabaseDeleted += r.deleted;
      supabaseErrors += r.errors;
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "design_files",
        resourceId: userId,
        archivePath: DESIGNS_BUCKET,
        reason,
        kvkkRequestId,
        metadata: {
          bucket: DESIGNS_BUCKET,
          paths_attempted: supabasePaths.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }

    if (r2Keys.length > 0) {
      const r = await deleteR2Keys(r2Keys);
      r2Deleted += r.deleted;
      r2Errors += r.errors;
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "design_files_r2",
        resourceId: userId,
        reason,
        kvkkRequestId,
        metadata: {
          keys_attempted: r2Keys.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- Supabase: designs/temp/{userId}/ ----
  if (purgeScope.full || purgeScope.designs) {
    const tempPaths = await listSupabaseFolder(
      admin,
      DESIGNS_BUCKET,
      `temp/${userId}`
    );
    if (tempPaths.length > 0) {
      const r = await deleteSupabasePaths(admin, DESIGNS_BUCKET, tempPaths);
      supabaseDeleted += r.deleted;
      supabaseErrors += r.errors;
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "design_temp",
        resourceId: userId,
        archivePath: `temp/${userId}/`,
        reason,
        kvkkRequestId,
        metadata: {
          bucket: DESIGNS_BUCKET,
          paths_attempted: tempPaths.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- Supabase: design-previews/{userId}/ ----
  if (purgeScope.full || purgeScope.designs) {
    const previewPaths = await listSupabaseFolder(
      admin,
      PREVIEWS_BUCKET,
      userId
    );
    if (previewPaths.length > 0) {
      const r = await deleteSupabasePaths(admin, PREVIEWS_BUCKET, previewPaths);
      supabaseDeleted += r.deleted;
      supabaseErrors += r.errors;
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "design_previews",
        resourceId: userId,
        archivePath: `${userId}/`,
        reason,
        kvkkRequestId,
        metadata: {
          bucket: PREVIEWS_BUCKET,
          paths_attempted: previewPaths.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- R2: customers/{userId}/ ----
  if (purgeScope.full || purgeScope.orders || purgeScope.designs) {
    const prefix = r2KeyBuilders.customerPrefix(userId);
    const r = await deleteR2Prefix(prefix);
    r2Deleted += r.deleted;
    r2Errors += r.errors;
    if (r.keys.length > 0) {
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "customer_bundle",
        resourceId: userId,
        archivePath: prefix,
        reason,
        kvkkRequestId,
        metadata: {
          prefix,
          keys_attempted: r.keys.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- R2: customers-hot/{userId}/ ----
  if (purgeScope.full || purgeScope.designs) {
    const prefix = `customers-hot/${userId}/`;
    const r = await deleteR2Prefix(prefix);
    r2Deleted += r.deleted;
    r2Errors += r.errors;
    if (r.keys.length > 0) {
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "customer_hot",
        resourceId: userId,
        archivePath: prefix,
        reason,
        kvkkRequestId,
        metadata: {
          prefix,
          keys_attempted: r.keys.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- R2: editor-drafts/{userId}/ ----
  if (purgeScope.full || purgeScope.designs) {
    const prefix = `editor-drafts/${userId}/`;
    const r = await deleteR2Prefix(prefix);
    r2Deleted += r.deleted;
    r2Errors += r.errors;
    if (r.keys.length > 0) {
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "editor_drafts",
        resourceId: userId,
        archivePath: prefix,
        reason,
        kvkkRequestId,
        metadata: {
          prefix,
          keys_attempted: r.keys.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- R2: exports/{userId}/ (KVKK data export bundles) ----
  if (purgeScope.full || purgeScope.profile) {
    const prefix = `exports/${userId}/`;
    const r = await deleteR2Prefix(prefix);
    r2Deleted += r.deleted;
    r2Errors += r.errors;
    if (r.keys.length > 0) {
      await logPurgeEvent(admin, {
        userId,
        actorId,
        actorType,
        resourceType: "data_export_bundle",
        resourceId: userId,
        archivePath: prefix,
        reason,
        kvkkRequestId,
        metadata: {
          prefix,
          keys_attempted: r.keys.length,
          deleted: r.deleted,
          errors: r.errors,
        },
      });
    }
  }

  // ---- R2: profile / reviews snapshots (partial) ----
  if (purgeScope.profile) {
    const key = r2KeyBuilders.customerSnapshot(userId);
    const r = await deleteFromR2(key);
    if (r.success) r2Deleted++;
    else r2Errors++;
    await logPurgeEvent(admin, {
      userId,
      actorId,
      actorType,
      resourceType: "profile_snapshot",
      resourceId: userId,
      archivePath: key,
      reason,
      kvkkRequestId,
      metadata: { key, success: r.success },
    });
  }

  if (purgeScope.reviews) {
    const key = r2KeyBuilders.reviewSnapshot(userId);
    const r = await deleteFromR2(key);
    if (r.success) r2Deleted++;
    else r2Errors++;
    await logPurgeEvent(admin, {
      userId,
      actorId,
      actorType,
      resourceType: "review_snapshot",
      resourceId: userId,
      archivePath: key,
      reason,
      kvkkRequestId,
      metadata: { key, success: r.success },
    });
  }

  // ---- Supabase: approvals/{orderId}/ (onay görseli dosyaları) ----
  if (
    orderIds.length > 0 &&
    (purgeScope.full || purgeScope.orders)
  ) {
    for (const orderId of orderIds) {
      const approvalPaths = await listSupabaseFolder(
        admin,
        DESIGNS_BUCKET,
        `approvals/${orderId}`
      );
      if (approvalPaths.length > 0) {
        const r = await deleteSupabasePaths(
          admin,
          DESIGNS_BUCKET,
          approvalPaths
        );
        supabaseDeleted += r.deleted;
        supabaseErrors += r.errors;
        await logPurgeEvent(admin, {
          userId,
          actorId,
          actorType,
          resourceType: "approval_assets",
          resourceId: userId,
          archivePath: `approvals/${orderId}/`,
          reason,
          kvkkRequestId,
          metadata: {
            bucket: DESIGNS_BUCKET,
            order_id: orderId,
            paths_attempted: approvalPaths.length,
            deleted: r.deleted,
            errors: r.errors,
          },
        });
      }
    }
  }

  // ---- R2: customer-cutlines/{orderId}/ + print/{orderId}/ ----
  if (
    orderIds.length > 0 &&
    (purgeScope.full || purgeScope.designs || purgeScope.orders)
  ) {
    for (const orderId of orderIds) {
      for (const prefix of [
        `customer-cutlines/${orderId}/`,
        `print/${orderId}/`,
      ]) {
        const r = await deleteR2Prefix(prefix);
        r2Deleted += r.deleted;
        r2Errors += r.errors;
        if (r.keys.length > 0) {
          await logPurgeEvent(admin, {
            userId,
            actorId,
            actorType,
            resourceType: prefix.startsWith("print/")
              ? "print_cache"
              : "cutline_cache",
            resourceId: userId,
            archivePath: prefix,
            reason,
            kvkkRequestId,
            metadata: {
              prefix,
              order_id: orderId,
              keys_attempted: r.keys.length,
              deleted: r.deleted,
              errors: r.errors,
            },
          });
        }
      }
    }

    // cutline_designs tablosundaki URL'ler (sipariş kaydı kalır)
    const { data: cutlineRows } = await admin
      .from("cutline_designs")
      .select("svg_url, preview_png_url")
      .in("order_id", orderIds);

    const extraCutlineKeys: string[] = [];
    for (const row of cutlineRows ?? []) {
      const cr = row as {
        svg_url: string | null;
        preview_png_url: string | null;
      };
      if (cr.svg_url) extraCutlineKeys.push(normalizeR2Key(cr.svg_url));
      if (cr.preview_png_url) {
        extraCutlineKeys.push(normalizeR2Key(cr.preview_png_url));
      }
    }
    if (extraCutlineKeys.length > 0) {
      const r = await deleteR2Keys(extraCutlineKeys);
      r2Deleted += r.deleted;
      r2Errors += r.errors;
    }
  }

  const hasErrors = supabaseErrors > 0 || r2Errors > 0;

  if (purgeScope.full) {
    await admin
      .from("profiles")
      .update({
        archive_status: "deleted",
        archive_path: null,
      })
      .eq("id", userId);
  }

  return {
    ok: !hasErrors,
    error: hasErrors
      ? `Depolama temizliği kısmen başarısız (supabase_errors=${supabaseErrors}, r2_errors=${r2Errors})`
      : undefined,
    supabaseDeleted,
    supabaseErrors,
    r2Deleted,
    r2Errors,
  };
}
