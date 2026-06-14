import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_STORAGE_BUCKETS } from "@/lib/storage/buckets";
import {
  getSignedDownloadUrl,
} from "@/lib/storage/r2-client";
import {
  isR2StorageKey,
  normalizeR2Key,
} from "@/lib/storage/purge-r2";

/** AWS SigV4 presigner max — artırma */
export const EXPORT_TTL_SECONDS = 604800;

const DESIGNS_BUCKET = SUPABASE_STORAGE_BUCKETS.designs;

export interface UserExportData {
  profile: unknown;
  addresses: unknown[];
  invoice_profiles: unknown[];
  orders: unknown[];
  order_items: unknown[];
  order_events: unknown[];
  design_files: Array<{
    id: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
    version: number;
    created_at: string | null;
    download_url: string | null;
    url_expires_at: string | null;
  }>;
  returns: unknown[];
  reviews: unknown[];
  support_tickets: unknown[];
  proof_help_requests: unknown[];
  notification_prefs: unknown[];
  pim_conversations: unknown[];
  email_subscription: unknown[];
  coupon_uses: unknown[];
  exported_at: string;
}

export async function collectUserExportData(
  admin: SupabaseClient,
  userId: string,
  email: string | null | undefined
): Promise<UserExportData> {
  const urlExpiresAt = new Date(
    Date.now() + EXPORT_TTL_SECONDS * 1000
  ).toISOString();

  const { data: profile } = await admin
    .from("profiles")
    .select(
      "display_name,phone,company_name,tax_office,tc,vkn,email_verified_at,created_at"
    )
    .eq("id", userId)
    .maybeSingle();

  const { data: addresses } = await admin
    .from("addresses")
    .select("id,label,name,phone,addr,city,is_default,created_at")
    .eq("user_id", userId);

  const { data: invoiceProfiles } = await admin
    .from("customer_invoice_profiles")
    .select(
      "id,label,company_name,company_address,tax_office,vkn,is_default,created_at,updated_at"
    )
    .eq("user_id", userId);

  const { data: returns } = await admin
    .from("returns")
    .select(
      "id,order_id,reason,description,status,refund_amount,customer_name,customer_email,attachments,created_at,updated_at"
    )
    .eq("user_id", userId);

  const { data: reviews } = await admin
    .from("reviews")
    .select(
      "id,order_id,title,body,pros,cons,rating,display_name,product_type,status,photos,created_at,updated_at"
    )
    .eq("user_id", userId);

  const { data: supportTickets } = await admin
    .from("support_tickets")
    .select(
      "id,category,subject,message,status,priority,order_id,created_at,updated_at"
    )
    .eq("user_id", userId);

  const { data: proofHelp } = await admin
    .from("proof_help_requests")
    .select(
      "id,order_id,order_item_id,message,status,resolution_note,resolved_at,created_at"
    )
    .eq("user_id", userId);

  const { data: notificationPrefs } = await admin
    .from("notification_prefs")
    .select(
      "email_order_updates,email_proof_ready,email_shipping_updates,email_marketing,email_blog,sms_delivery,sms_proof_ready,sms_urgent_order,marketing_consent_at,blog_consent_at,updated_at"
    )
    .eq("user_id", userId);

  const { data: pimConversations } = await admin
    .from("pim_conversations")
    .select("display_name,history,facts,last_summary,created_at,updated_at")
    .eq("user_id", userId);

  const { data: couponUses } = await admin
    .from("coupon_uses")
    .select("id,coupon_id,order_id,discount_amount,used_at")
    .eq("user_id", userId);

  let emailSubscription: unknown[] = [];
  if (email) {
    const { data: subs } = await admin
      .from("email_subscribers")
      .select(
        "id,email,source,interests,subscribed,welcome_sent_at,consent_at,created_at,updated_at"
      )
      .eq("email", email.toLowerCase().trim())
      .is("deleted_at", null);
    emailSubscription = subs ?? [];
  }

  const { data: orders } = await admin
    .from("orders")
    .select(
      "id,status,created_at,updated_at,subtotal,shipping,total,paid_at,estimated_delivery,address,invoice,payment,is_manual,sla_proof_deadline"
    )
    .eq("user_id", userId);

  const orderIds = (orders ?? []).map((o) => (o as { id: string }).id);

  let orderItems: unknown[] = [];
  let orderEvents: unknown[] = [];
  if (orderIds.length > 0) {
    const { data: items } = await admin
      .from("order_items")
      .select(
        "id,order_id,product,title,qty,width,height,unit,total,config,meta,proof_status,proof_approved_at,proof_viewed_at,proof_edited_at,cutline_design_id,reprint_source_order_id"
      )
      .in("order_id", orderIds);
    orderItems = items ?? [];

    const { data: events } = await admin
      .from("order_events")
      .select(
        "id,order_id,event_type,summary,status_after,detail,created_at"
      )
      .in("order_id", orderIds);
    orderEvents = events ?? [];
  }

  const { data: designFileRows } = await admin
    .from("design_files")
    .select(
      "id,original_name,mime_type,size_bytes,version,created_at,storage_path,storage_provider"
    )
    .eq("user_id", userId);

  const design_files: UserExportData["design_files"] = [];
  for (const row of designFileRows ?? []) {
    const fr = row as {
      id: string;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      version: number;
      created_at: string | null;
      storage_path: string;
      storage_provider: string;
    };

    let downloadUrl: string | null = null;
    try {
      if (
        fr.storage_provider === "r2" ||
        isR2StorageKey(fr.storage_path)
      ) {
        downloadUrl = await getSignedDownloadUrl(
          normalizeR2Key(fr.storage_path),
          EXPORT_TTL_SECONDS,
          { downloadFilename: fr.original_name, contentType: fr.mime_type }
        );
      } else {
        const { data: signed } = await admin.storage
          .from(DESIGNS_BUCKET)
          .createSignedUrl(fr.storage_path, EXPORT_TTL_SECONDS);
        downloadUrl = signed?.signedUrl ?? null;
      }
    } catch (err) {
      console.warn(
        "[collect-export-data] signed url failed:",
        fr.id,
        err instanceof Error ? err.message : err
      );
    }

    design_files.push({
      id: fr.id,
      original_name: fr.original_name,
      mime_type: fr.mime_type,
      size_bytes: fr.size_bytes,
      version: fr.version,
      created_at: fr.created_at,
      download_url: downloadUrl,
      url_expires_at: downloadUrl ? urlExpiresAt : null,
    });
  }

  return {
    profile: profile ?? null,
    addresses: addresses ?? [],
    invoice_profiles: invoiceProfiles ?? [],
    orders: orders ?? [],
    order_items: orderItems,
    order_events: orderEvents,
    design_files,
    returns: returns ?? [],
    reviews: reviews ?? [],
    support_tickets: supportTickets ?? [],
    proof_help_requests: proofHelp ?? [],
    notification_prefs: notificationPrefs ?? [],
    pim_conversations: pimConversations ?? [],
    email_subscription: emailSubscription,
    coupon_uses: couponUses ?? [],
    exported_at: new Date().toISOString(),
  };
}
