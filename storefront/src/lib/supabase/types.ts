/**
 * Supabase Database types — el yazımı (initial schema).
 *
 * NOT: Migration'lar yazıldıktan sonra `supabase gen types typescript` ile
 * otomatik regenerate edilecek. Şimdilik manuel + migration SQL ile uyumlu.
 *
 * Tablolar:
 *   - profiles: auth.users 1:1 (display_name, phone)
 *   - addresses: kullanıcı adres defteri
 *   - cart_items: aktif sepet (auth varsa)
 *   - orders: sipariş header
 *   - order_items: sipariş satırları
 *   - wallet_transactions: cüzdan işlemleri (gelecek)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string; // auth.users.id
          display_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
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
        Update: {
          id?: string;
          user_id?: string;
          label?: string | null;
          name?: string;
          addr?: string;
          city?: string;
          phone?: string;
          is_default?: boolean;
          created_at?: string;
        };
      };
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
          cut: string | null;
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
          cut?: string | null;
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
      orders: {
        Row: {
          id: string;
          user_id: string;
          status:
            | "paid"
            | "qc_pending"
            | "qc_flagged"
            | "operator_review"
            | "proof_pending"
            | "in_production"
            | "shipped"
            | "delivered"
            | "cancelled";
          subtotal: number;
          shipping: number;
          total: number;
          /** JSON snapshot — adres + fatura + ödeme */
          address: Json;
          invoice: Json;
          payment: Json;
          estimated_delivery: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // PE-2026-XXXX
          user_id: string;
          status?: Database["public"]["Tables"]["orders"]["Row"]["status"];
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
          /** Tüm konfigürasyon JSON snapshot'ı (cart_items mirror) */
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
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          /** Pozitif yatırım, negatif harcama (TL) */
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
