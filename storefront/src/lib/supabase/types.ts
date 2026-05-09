/**
 * Supabase Database types — el yazımı (Migration 001-006).
 *
 * NOT: Migration'lar push edildikten sonra
 *      `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`
 *      ile otomatik regenerate edilebilir. Şimdilik manuel + migration SQL
 *      ile uyumlu tutuluyor.
 *
 * Tablolar (mig 001):
 *   - profiles: auth.users 1:1
 *   - addresses: kullanıcı adres defteri
 *   - cart_items: aktif sepet
 *   - orders, order_items
 *   - wallet_transactions
 *
 * Tablolar (mig 002):
 *   - profiles enrichment (invoice fields + locale + email_verified_at)
 *   - order_events (timeline)
 *   - payments (PSP tracking)
 *
 * Tablolar (mig 003):
 *   - returns
 *   - design_files
 *
 * Tablolar (mig 004):
 *   - notification_prefs
 *   - audit_log
 *
 * Tablolar (mig 005):
 *   - coupons
 *   - coupon_uses
 *   - reviews
 *
 * (mig 006: Storage policies, tablo yok)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// Enum types (Postgres enum'lardan üretildi)
// ============================================================

export type OrderStatus =
  | "paid"
  | "qc_pending"
  | "qc_flagged"
  | "operator_review"
  | "proof_pending"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type ReturnStatus = "pending" | "approved" | "rejected" | "refunded";

export type ReturnReason =
  | "yanlis_urun"
  | "uretim_hatasi"
  | "kargo_hasari"
  | "kalite_problemi"
  | "diger";

export type DesignFileStatus =
  | "uploaded"
  | "analyzing"
  | "qc_passed"
  | "qc_warned"
  | "qc_failed"
  | "approved"
  | "superseded";

export type CouponKind = "percent" | "fixed" | "free_ship";

export type ReviewStatus = "pending" | "published" | "rejected" | "hidden";

export type AuditAction =
  | "order.status_change"
  | "order.cancel"
  | "order.refund"
  | "return.approve"
  | "return.reject"
  | "return.refund"
  | "coupon.create"
  | "coupon.update"
  | "coupon.delete"
  | "review.approve"
  | "review.reject"
  | "review.delete"
  | "staff.invite"
  | "staff.remove"
  | "staff.role_change"
  | "settings.update"
  | "design_file.approve"
  | "design_file.reject"
  | "auth.login"
  | "auth.logout"
  | "profile.delete";

export type OrderEventType =
  | "created"
  | "paid"
  | "file_uploaded"
  | "qc_passed"
  | "qc_flagged"
  | "operator_reviewed"
  | "proof_generated"
  | "proof_approved"
  | "proof_rejected"
  | "production_started"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded"
  | "note_added";

export type PspProvider =
  | "iyzico"
  | "parampos"
  | "stripe"
  | "wallet"
  | "transfer";

export type PaymentAction =
  | "charge"
  | "refund"
  | "partial_refund"
  | "capture"
  | "void";

export type PaymentStatus = "pending" | "success" | "failed" | "cancelled";

// ============================================================
// Database
// ============================================================

export interface Database {
  public: {
    Tables: {
      // ---------- profiles (mig 001 + 002) ----------
      profiles: {
        Row: {
          id: string; // auth.users.id
          display_name: string | null;
          phone: string | null;
          // mig 002 — fatura
          invoice_type: "individual" | "corporate" | null;
          tc: string | null;
          vkn: string | null;
          company_name: string | null;
          tax_office: string | null;
          invoice_format: "earchive" | "einvoice" | null;
          locale: "tr" | "en" | null;
          email_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          phone?: string | null;
          invoice_type?: "individual" | "corporate" | null;
          tc?: string | null;
          vkn?: string | null;
          company_name?: string | null;
          tax_office?: string | null;
          invoice_format?: "earchive" | "einvoice" | null;
          locale?: "tr" | "en" | null;
          email_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      // ---------- addresses (mig 001) ----------
      addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string | null;
          name: string;
          addr: string;
          city: string;
          phone: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string | null;
          name: string;
          addr: string;
          city: string;
          phone: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
      };

      // ---------- cart_items (mig 001) ----------
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product: "sticker" | "etiket";
          title: string;
          config: string;
          width: number;
          height: number;
          qty: number;
          unit: number;
          total: number;
          shape: string | null;
          cut: "tabaka" | "diecut" | null;
          soft_corners: boolean | null;
          material: string | null;
          finish: string | null;
          hediye_adet: number | null;
          material_id: string | null;
          coating_id: string | null;
          customization_id: string | null;
          winding: number | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product: "sticker" | "etiket";
          title: string;
          config: string;
          width: number;
          height: number;
          qty: number;
          unit: number;
          total: number;
          shape?: string | null;
          cut?: "tabaka" | "diecut" | null;
          soft_corners?: boolean | null;
          material?: string | null;
          finish?: string | null;
          hediye_adet?: number | null;
          material_id?: string | null;
          coating_id?: string | null;
          customization_id?: string | null;
          winding?: number | null;
          added_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Insert"]>;
      };

      // ---------- orders (mig 001) ----------
      orders: {
        Row: {
          id: string;
          user_id: string;
          status: OrderStatus;
          subtotal: number;
          shipping: number;
          total: number;
          address: Json;
          invoice: Json;
          payment: Json;
          estimated_delivery: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          status?: OrderStatus;
          subtotal: number;
          shipping: number;
          total: number;
          address: Json;
          invoice: Json;
          payment: Json;
          estimated_delivery?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };

      // ---------- order_items (mig 001) ----------
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product: "sticker" | "etiket";
          title: string;
          config: string;
          width: number;
          height: number;
          qty: number;
          unit: number;
          total: number;
          meta: Json;
        };
        Insert: {
          id?: string;
          order_id: string;
          product: "sticker" | "etiket";
          title: string;
          config: string;
          width: number;
          height: number;
          qty: number;
          unit: number;
          total: number;
          meta?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };

      // ---------- wallet_transactions (mig 001) ----------
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          description: string;
          order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          description: string;
          order_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["wallet_transactions"]["Insert"]
        >;
      };

      // ---------- order_events (mig 002) ----------
      order_events: {
        Row: {
          id: string;
          order_id: string;
          event_type: OrderEventType;
          status_after: OrderStatus | null;
          actor_id: string | null;
          actor_role: "customer" | "admin" | "staff" | "system" | null;
          summary: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          event_type: OrderEventType;
          status_after?: OrderStatus | null;
          actor_id?: string | null;
          actor_role?: "customer" | "admin" | "staff" | "system" | null;
          summary: string;
          detail?: Json;
          created_at?: string;
        };
        Update: never; // append-only
      };

      // ---------- payments (mig 002) ----------
      payments: {
        Row: {
          id: string;
          order_id: string;
          psp_provider: PspProvider;
          psp_transaction_id: string | null;
          action: PaymentAction;
          amount: number;
          currency: string;
          status: PaymentStatus;
          idempotency_key: string | null;
          psp_raw: Json;
          card_masked: string | null;
          installment: number | null;
          failure_reason: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          psp_provider: PspProvider;
          psp_transaction_id?: string | null;
          action: PaymentAction;
          amount: number;
          currency?: string;
          status: PaymentStatus;
          idempotency_key?: string | null;
          psp_raw?: Json;
          card_masked?: string | null;
          installment?: number | null;
          failure_reason?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };

      // ---------- returns (mig 003) ----------
      returns: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          customer_name: string;
          customer_email: string;
          reason: ReturnReason;
          description: string;
          attachments: string[];
          status: ReturnStatus;
          admin_note: string | null;
          refund_amount: number | null;
          refund_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          customer_name: string;
          customer_email: string;
          reason: ReturnReason;
          description: string;
          attachments?: string[];
          status?: ReturnStatus;
          admin_note?: string | null;
          refund_amount?: number | null;
          refund_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["returns"]["Insert"]>;
      };

      // ---------- design_files (mig 003) ----------
      design_files: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          order_item_id: string | null;
          storage_path: string;
          original_name: string;
          size_bytes: number;
          mime_type: string;
          sha256: string | null;
          version: number;
          status: DesignFileStatus;
          ai_check: Json;
          operator_note: string | null;
          approved_at: string | null;
          approved_by: string | null;
          uploaded_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          order_item_id?: string | null;
          storage_path: string;
          original_name: string;
          size_bytes: number;
          mime_type: string;
          sha256?: string | null;
          version?: number;
          status?: DesignFileStatus;
          ai_check?: Json;
          operator_note?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          uploaded_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_files"]["Insert"]>;
      };

      // ---------- notification_prefs (mig 004) ----------
      notification_prefs: {
        Row: {
          user_id: string;
          email_order_updates: boolean;
          email_proof_ready: boolean;
          email_shipping_updates: boolean;
          email_marketing: boolean;
          email_blog: boolean;
          sms_urgent_order: boolean;
          sms_proof_ready: boolean;
          sms_delivery: boolean;
          marketing_consent_at: string | null;
          blog_consent_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_order_updates?: boolean;
          email_proof_ready?: boolean;
          email_shipping_updates?: boolean;
          email_marketing?: boolean;
          email_blog?: boolean;
          sms_urgent_order?: boolean;
          sms_proof_ready?: boolean;
          sms_delivery?: boolean;
          marketing_consent_at?: string | null;
          blog_consent_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notification_prefs"]["Insert"]
        >;
      };

      // ---------- audit_log (mig 004) ----------
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_email: string | null;
          actor_role: "customer" | "admin" | "staff" | "system" | null;
          action: AuditAction;
          target_type: string | null;
          target_id: string | null;
          summary: string;
          detail: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          actor_role?: "customer" | "admin" | "staff" | "system" | null;
          action: AuditAction;
          target_type?: string | null;
          target_id?: string | null;
          summary: string;
          detail?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: never; // append-only
      };

      // ---------- coupons (mig 005) ----------
      coupons: {
        Row: {
          id: string;
          code: string;
          kind: CouponKind;
          value: number;
          max_discount: number | null;
          min_subtotal: number;
          total_uses_limit: number | null;
          per_user_limit: number | null;
          starts_at: string;
          expires_at: string | null;
          description: string | null;
          is_active: boolean;
          created_at: string;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          kind: CouponKind;
          value: number;
          max_discount?: number | null;
          min_subtotal?: number;
          total_uses_limit?: number | null;
          per_user_limit?: number | null;
          starts_at?: string;
          expires_at?: string | null;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          created_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
      };

      // ---------- coupon_uses (mig 005) ----------
      coupon_uses: {
        Row: {
          id: string;
          coupon_id: string;
          user_id: string;
          order_id: string;
          discount_amount: number;
          used_at: string;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          user_id: string;
          order_id: string;
          discount_amount: number;
          used_at?: string;
        };
        Update: never;
      };

      // ---------- reviews (mig 005) ----------
      reviews: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          rating: number;
          title: string | null;
          body: string;
          pros: string | null;
          cons: string | null;
          status: ReviewStatus;
          moderation_note: string | null;
          moderated_at: string | null;
          moderated_by: string | null;
          helpful_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          rating: number;
          title?: string | null;
          body: string;
          pros?: string | null;
          cons?: string | null;
          status?: ReviewStatus;
          moderation_note?: string | null;
          moderated_at?: string | null;
          moderated_by?: string | null;
          helpful_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      fn_create_order: {
        Args: {
          p_order_id: string;
          p_user_id: string;
          p_subtotal: number;
          p_shipping: number;
          p_total: number;
          p_address: Json;
          p_invoice: Json;
          p_payment: Json;
          p_estimated_delivery: string | null;
          p_items: Json;
        };
        Returns: string;
      };
      fn_apply_coupon: {
        Args: {
          p_code: string;
          p_subtotal: number;
          p_user_id: string;
          p_order_id: string;
        };
        Returns: Json;
      };
      fn_validate_coupon: {
        Args: {
          p_code: string;
          p_subtotal: number;
        };
        Returns: Json;
      };
      fn_log_audit: {
        Args: {
          p_action: AuditAction;
          p_target_type?: string | null;
          p_target_id?: string | null;
          p_summary?: string;
          p_detail?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      order_status: OrderStatus;
      return_status: ReturnStatus;
      return_reason: ReturnReason;
      design_file_status: DesignFileStatus;
      coupon_kind: CouponKind;
      review_status: ReviewStatus;
      audit_action: AuditAction;
    };
  };
}
