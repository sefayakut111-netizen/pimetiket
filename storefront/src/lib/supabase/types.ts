/**
 * Supabase Database types — remote şemadan otomatik üretildi.
 *
 * Yeniden üretmek için:
 *   npm run supabase:types
 *
 * Kaynak: Supabase project ucmpwxnoaqjpzhijnxtp (migrations 001–089)
 * Son güncelleme: 2026-05-24
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          addr: string
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          addr: string
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          name: string
          phone: string
          user_id: string
        }
        Update: {
          addr?: string
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_role_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_update: boolean
          can_view: boolean
          module: string
          role: Database["public"]["Enums"]["admin_role_v2"]
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          module: string
          role: Database["public"]["Enums"]["admin_role_v2"]
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          module?: string
          role?: Database["public"]["Enums"]["admin_role_v2"]
        }
        Relationships: []
      }
      archive_events: {
        Row: {
          actor_id: string | null
          actor_type: string | null
          archive_path: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          reason: string | null
          resource_id: string
          resource_type: string
          size_bytes: number | null
          user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string | null
          archive_path?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          resource_id: string
          resource_type: string
          size_bytes?: number | null
          user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: string | null
          archive_path?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          reason?: string | null
          resource_id?: string
          resource_type?: string
          size_bytes?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          detail: Json | null
          id: string
          ip_address: unknown
          summary: string
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          ip_address?: unknown
          summary: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json | null
          id?: string
          ip_address?: unknown
          summary?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      auditor_action_log: {
        Row: {
          affected_ids: Json | null
          affected_rows: number | null
          created_at: string
          error: string | null
          executed_at: string
          executed_by: string | null
          external_call: Json | null
          id: string
          pending_action_id: string
          result: string
        }
        Insert: {
          affected_ids?: Json | null
          affected_rows?: number | null
          created_at?: string
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          external_call?: Json | null
          id?: string
          pending_action_id: string
          result: string
        }
        Update: {
          affected_ids?: Json | null
          affected_rows?: number | null
          created_at?: string
          error?: string | null
          executed_at?: string
          executed_by?: string | null
          external_call?: Json | null
          id?: string
          pending_action_id?: string
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditor_action_log_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "auditor_action_log_pending_action_id_fkey"
            columns: ["pending_action_id"]
            isOneToOne: false
            referencedRelation: "auditor_pending_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_findings: {
        Row: {
          auditor_name: string
          category: string
          created_at: string
          data: Json | null
          description: string
          id: string
          run_id: string
          severity: string
          suggested_action_description: string | null
          suggested_action_payload: Json | null
          suggested_action_type: string | null
          title: string
        }
        Insert: {
          auditor_name: string
          category: string
          created_at?: string
          data?: Json | null
          description: string
          id?: string
          run_id: string
          severity: string
          suggested_action_description?: string | null
          suggested_action_payload?: Json | null
          suggested_action_type?: string | null
          title: string
        }
        Update: {
          auditor_name?: string
          category?: string
          created_at?: string
          data?: Json | null
          description?: string
          id?: string
          run_id?: string
          severity?: string
          suggested_action_description?: string | null
          suggested_action_payload?: Json | null
          suggested_action_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditor_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "auditor_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditor_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_auditor_latest_runs"
            referencedColumns: ["latest_run_id"]
          },
        ]
      }
      auditor_pending_actions: {
        Row: {
          action_payload: Json
          action_type: string
          applied_at: string | null
          apply_error: string | null
          apply_result: Json | null
          auditor_name: string
          created_at: string
          description: string
          finding_id: string | null
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string
          severity: string
          snooze_until: string | null
          status: string
          title: string
        }
        Insert: {
          action_payload: Json
          action_type: string
          applied_at?: string | null
          apply_error?: string | null
          apply_result?: Json | null
          auditor_name: string
          created_at?: string
          description: string
          finding_id?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id: string
          severity: string
          snooze_until?: string | null
          status?: string
          title: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          applied_at?: string | null
          apply_error?: string | null
          apply_result?: Json | null
          auditor_name?: string
          created_at?: string
          description?: string
          finding_id?: string | null
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string
          severity?: string
          snooze_until?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "auditor_pending_actions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "auditor_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditor_pending_actions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "auditor_pending_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "auditor_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditor_pending_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "v_auditor_latest_runs"
            referencedColumns: ["latest_run_id"]
          },
        ]
      }
      auditor_runs: {
        Row: {
          auditor_name: string
          auditor_version: string
          created_at: string
          critical_count: number
          duration_ms: number | null
          error: string | null
          findings_count: number
          finished_at: string | null
          id: string
          info_count: number
          metrics_snapshot: Json | null
          started_at: string
          status: string
          summary: string | null
          summary_md: string | null
          trigger_type: string
          triggered_by: string | null
          warning_count: number
        }
        Insert: {
          auditor_name: string
          auditor_version?: string
          created_at?: string
          critical_count?: number
          duration_ms?: number | null
          error?: string | null
          findings_count?: number
          finished_at?: string | null
          id?: string
          info_count?: number
          metrics_snapshot?: Json | null
          started_at?: string
          status?: string
          summary?: string | null
          summary_md?: string | null
          trigger_type: string
          triggered_by?: string | null
          warning_count?: number
        }
        Update: {
          auditor_name?: string
          auditor_version?: string
          created_at?: string
          critical_count?: number
          duration_ms?: number | null
          error?: string | null
          findings_count?: number
          finished_at?: string | null
          id?: string
          info_count?: number
          metrics_snapshot?: Json | null
          started_at?: string
          status?: string
          summary?: string | null
          summary_md?: string | null
          trigger_type?: string
          triggered_by?: string | null
          warning_count?: number
        }
        Relationships: []
      }
      auth_failed_logins: {
        Row: {
          attempted_at: string
          email: string | null
          failure_reason: string | null
          id: number
          ip: unknown
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: number
          ip?: unknown
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string | null
          failure_reason?: string | null
          id?: number
          ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          added_at: string
          additional_designs: Json | null
          coating_id: string | null
          config: string
          core_size: number | null
          customization_id: string | null
          cut: string | null
          design_count: number | null
          design_file_name: string | null
          design_mime_type: string | null
          design_preview_url: string | null
          design_temp_id: string | null
          finish: string | null
          hediye_adet: number | null
          height: number
          id: string
          material: string | null
          material_id: string | null
          product: string
          qty: number
          roll_label_count: number | null
          shape: string | null
          soft_corners: boolean | null
          title: string
          total: number
          unit: number
          user_id: string
          width: number
          winding: number | null
        }
        Insert: {
          added_at?: string
          additional_designs?: Json | null
          coating_id?: string | null
          config: string
          core_size?: number | null
          customization_id?: string | null
          cut?: string | null
          design_count?: number | null
          design_file_name?: string | null
          design_mime_type?: string | null
          design_preview_url?: string | null
          design_temp_id?: string | null
          finish?: string | null
          hediye_adet?: number | null
          height: number
          id?: string
          material?: string | null
          material_id?: string | null
          product: string
          qty: number
          roll_label_count?: number | null
          shape?: string | null
          soft_corners?: boolean | null
          title: string
          total: number
          unit: number
          user_id: string
          width: number
          winding?: number | null
        }
        Update: {
          added_at?: string
          additional_designs?: Json | null
          coating_id?: string | null
          config?: string
          core_size?: number | null
          customization_id?: string | null
          cut?: string | null
          design_count?: number | null
          design_file_name?: string | null
          design_mime_type?: string | null
          design_preview_url?: string | null
          design_temp_id?: string | null
          finish?: string | null
          hediye_adet?: number | null
          height?: number
          id?: string
          material?: string | null
          material_id?: string | null
          product?: string
          qty?: number
          roll_label_count?: number | null
          shape?: string | null
          soft_corners?: boolean | null
          title?: string
          total?: number
          unit?: number
          user_id?: string
          width?: number
          winding?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_design_temp_id_fkey"
            columns: ["design_temp_id"]
            isOneToOne: false
            referencedRelation: "design_temp_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          discount_amount: number
          id: string
          order_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_amount: number
          id?: string
          order_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_amount?: number
          id?: string
          order_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          id: string
          slug: string
          title_tr: string
          title_en: string | null
          body_tr: string
          body_en: string | null
          excerpt_tr: string | null
          excerpt_en: string | null
          category: string
          cover_image_url: string | null
          author_name: string | null
          status: string
          read_minutes: number | null
          seo_title: string | null
          seo_description: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title_tr: string
          title_en?: string | null
          body_tr: string
          body_en?: string | null
          excerpt_tr?: string | null
          excerpt_en?: string | null
          category?: string
          cover_image_url?: string | null
          author_name?: string | null
          status?: string
          read_minutes?: number | null
          seo_title?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title_tr?: string
          title_en?: string | null
          body_tr?: string
          body_en?: string | null
          excerpt_tr?: string | null
          excerpt_en?: string | null
          category?: string
          cover_image_url?: string | null
          author_name?: string | null
          status?: string
          read_minutes?: number | null
          seo_title?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string | null
          guest_email: string | null
          guest_name: string | null
          subject: string
          message: string
          category: string
          status: string
          order_id: string | null
          admin_response: string | null
          admin_responded_by: string | null
          admin_responded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          subject: string
          message: string
          category?: string
          status?: string
          order_id?: string | null
          admin_response?: string | null
          admin_responded_by?: string | null
          admin_responded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          guest_email?: string | null
          guest_name?: string | null
          subject?: string
          message?: string
          category?: string
          status?: string
          order_id?: string | null
          admin_response?: string | null
          admin_responded_by?: string | null
          admin_responded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          id: string
          cron_name: string
          started_at: string
          finished_at: string | null
          status: string
          duration_ms: number | null
          summary: string | null
          error_message: string | null
          items_processed: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          cron_name: string
          started_at?: string
          finished_at?: string | null
          status?: string
          duration_ms?: number | null
          summary?: string | null
          error_message?: string | null
          items_processed?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          cron_name?: string
          started_at?: string
          finished_at?: string | null
          status?: string
          duration_ms?: number | null
          summary?: string | null
          error_message?: string | null
          items_processed?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      proof_validations: {
        Row: {
          id: string
          order_id: string
          order_item_id: string | null
          design_file_id: string | null
          rule_check_passed: boolean | null
          rule_issues: Json | null
          ai_validated: boolean | null
          ai_verdict: string | null
          ai_cutline: Json | null
          ai_white_layer: Json | null
          ai_suggestions: Json | null
          ai_pim_message: string | null
          ai_tokens_used: number | null
          ai_cost_usd: number | null
          auto_fixed: boolean | null
          fix_log: Json | null
          final_verdict: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          order_item_id?: string | null
          design_file_id?: string | null
          rule_check_passed?: boolean | null
          rule_issues?: Json | null
          ai_validated?: boolean | null
          ai_verdict?: string | null
          ai_cutline?: Json | null
          ai_white_layer?: Json | null
          ai_suggestions?: Json | null
          ai_pim_message?: string | null
          ai_tokens_used?: number | null
          ai_cost_usd?: number | null
          auto_fixed?: boolean | null
          fix_log?: Json | null
          final_verdict?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          order_item_id?: string | null
          design_file_id?: string | null
          rule_check_passed?: boolean | null
          rule_issues?: Json | null
          ai_validated?: boolean | null
          ai_verdict?: string | null
          ai_cutline?: Json | null
          ai_white_layer?: Json | null
          ai_suggestions?: Json | null
          ai_pim_message?: string | null
          ai_tokens_used?: number | null
          ai_cost_usd?: number | null
          auto_fixed?: boolean | null
          fix_log?: Json | null
          final_verdict?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_discount: number | null
          min_subtotal: number
          per_user_limit: number | null
          starts_at: string
          target_user_id: string | null
          total_uses_limit: number | null
          updated_at: string
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["coupon_kind"]
          max_discount?: number | null
          min_subtotal?: number
          per_user_limit?: number | null
          starts_at?: string
          target_user_id?: string | null
          total_uses_limit?: number | null
          updated_at?: string
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["coupon_kind"]
          max_discount?: number | null
          min_subtotal?: number
          per_user_limit?: number | null
          starts_at?: string
          target_user_id?: string | null
          total_uses_limit?: number | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "coupons_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_invoice_profiles: {
        Row: {
          company_address: string
          company_name: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          tax_office: string
          updated_at: string
          user_id: string
          vkn: string
        }
        Insert: {
          company_address: string
          company_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          tax_office: string
          updated_at?: string
          user_id: string
          vkn: string
        }
        Update: {
          company_address?: string
          company_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          tax_office?: string
          updated_at?: string
          user_id?: string
          vkn?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoice_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string
          author_name: string | null
          body: string
          created_at: string
          id: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          author_id: string
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          author_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cutline_designs: {
        Row: {
          approved_at: string | null
          created_at: string
          cutline_height_mm: number | null
          cutline_width_mm: number | null
          design_file_id: string | null
          detected_cut_contour_names: Json | null
          dpi: number | null
          has_custom_white_plan: boolean | null
          height_mm: number | null
          id: string
          material_type: string | null
          mode: string
          offset_mm: number | null
          order_id: string
          order_item_id: string
          pim_feedback: string | null
          pim_severity: string | null
          placement_json: Json | null
          preview_png_url: string | null
          smoothness: number | null
          source: string
          status: string
          svg_url: string
          tier: string | null
          updated_at: string
          user_id: string | null
          white_plan_mode: string | null
          white_plan_path_count: number | null
          width_mm: number | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          cutline_height_mm?: number | null
          cutline_width_mm?: number | null
          design_file_id?: string | null
          detected_cut_contour_names?: Json | null
          dpi?: number | null
          has_custom_white_plan?: boolean | null
          height_mm?: number | null
          id?: string
          material_type?: string | null
          mode: string
          offset_mm?: number | null
          order_id: string
          order_item_id: string
          pim_feedback?: string | null
          pim_severity?: string | null
          placement_json?: Json | null
          preview_png_url?: string | null
          smoothness?: number | null
          source: string
          status?: string
          svg_url: string
          tier?: string | null
          updated_at?: string
          user_id?: string | null
          white_plan_mode?: string | null
          white_plan_path_count?: number | null
          width_mm?: number | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          cutline_height_mm?: number | null
          cutline_width_mm?: number | null
          design_file_id?: string | null
          detected_cut_contour_names?: Json | null
          dpi?: number | null
          has_custom_white_plan?: boolean | null
          height_mm?: number | null
          id?: string
          material_type?: string | null
          mode?: string
          offset_mm?: number | null
          order_id?: string
          order_item_id?: string
          pim_feedback?: string | null
          pim_severity?: string | null
          placement_json?: Json | null
          preview_png_url?: string | null
          smoothness?: number | null
          source?: string
          status?: string
          svg_url?: string
          tier?: string | null
          updated_at?: string
          user_id?: string | null
          white_plan_mode?: string | null
          white_plan_path_count?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cutline_designs_design_file_id_fkey"
            columns: ["design_file_id"]
            isOneToOne: false
            referencedRelation: "design_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutline_designs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutline_designs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutline_designs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      design_files: {
        Row: {
          ai_check: Json | null
          approved_at: string | null
          approved_by: string | null
          archive_path: string | null
          archive_size_bytes: number | null
          archive_status: Database["public"]["Enums"]["archive_status"]
          archived_at: string | null
          checksum_verified: boolean | null
          deletion_due_at: string | null
          id: string
          last_used_at: string | null
          mime_type: string
          operator_note: string | null
          order_id: string
          order_item_id: string | null
          original_name: string
          reorder_count: number
          revised_at: string | null
          revised_by_partner_id: string | null
          sha256: string | null
          size_bytes: number
          status: Database["public"]["Enums"]["design_file_status"]
          storage_path: string
          storage_provider: Database["public"]["Enums"]["storage_provider"]
          updated_at: string
          uploaded_at: string
          user_id: string
          version: number
        }
        Insert: {
          ai_check?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size_bytes?: number | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          checksum_verified?: boolean | null
          deletion_due_at?: string | null
          id?: string
          last_used_at?: string | null
          mime_type: string
          operator_note?: string | null
          order_id: string
          order_item_id?: string | null
          original_name: string
          reorder_count?: number
          revised_at?: string | null
          revised_by_partner_id?: string | null
          sha256?: string | null
          size_bytes: number
          status?: Database["public"]["Enums"]["design_file_status"]
          storage_path: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          updated_at?: string
          uploaded_at?: string
          user_id: string
          version?: number
        }
        Update: {
          ai_check?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          archive_path?: string | null
          archive_size_bytes?: number | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          checksum_verified?: boolean | null
          deletion_due_at?: string | null
          id?: string
          last_used_at?: string | null
          mime_type?: string
          operator_note?: string | null
          order_id?: string
          order_item_id?: string | null
          original_name?: string
          reorder_count?: number
          revised_at?: string | null
          revised_by_partner_id?: string | null
          sha256?: string | null
          size_bytes?: number
          status?: Database["public"]["Enums"]["design_file_status"]
          storage_path?: string
          storage_provider?: Database["public"]["Enums"]["storage_provider"]
          updated_at?: string
          uploaded_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "design_files_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "design_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_files_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_files_revised_by_partner_id_fkey"
            columns: ["revised_by_partner_id"]
            isOneToOne: false
            referencedRelation: "fason_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_files_revised_by_partner_id_fkey"
            columns: ["revised_by_partner_id"]
            isOneToOne: false
            referencedRelation: "v_fason_performance"
            referencedColumns: ["fason_id"]
          },
          {
            foreignKeyName: "design_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      design_quality_checks: {
        Row: {
          agent_name: string
          agent_version: string
          analysis: Json | null
          cost_usd: number | null
          created_at: string
          design_file_id: string | null
          duration_ms: number | null
          error: string | null
          file_format: string | null
          findings: Json | null
          id: string
          model: string | null
          order_id: string | null
          print_height_mm: number | null
          print_width_mm: number | null
          product_type: string | null
          score: number | null
          tokens_used: number | null
          verdict: string
        }
        Insert: {
          agent_name?: string
          agent_version?: string
          analysis?: Json | null
          cost_usd?: number | null
          created_at?: string
          design_file_id?: string | null
          duration_ms?: number | null
          error?: string | null
          file_format?: string | null
          findings?: Json | null
          id?: string
          model?: string | null
          order_id?: string | null
          print_height_mm?: number | null
          print_width_mm?: number | null
          product_type?: string | null
          score?: number | null
          tokens_used?: number | null
          verdict: string
        }
        Update: {
          agent_name?: string
          agent_version?: string
          analysis?: Json | null
          cost_usd?: number | null
          created_at?: string
          design_file_id?: string | null
          duration_ms?: number | null
          error?: string | null
          file_format?: string | null
          findings?: Json | null
          id?: string
          model?: string | null
          order_id?: string | null
          print_height_mm?: number | null
          print_width_mm?: number | null
          product_type?: string | null
          score?: number | null
          tokens_used?: number | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_quality_checks_design_file_id_fkey"
            columns: ["design_file_id"]
            isOneToOne: false
            referencedRelation: "design_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_quality_checks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_temp_uploads: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          mime_type: string
          original_name: string
          promoted_to: string | null
          sha256: string | null
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          mime_type: string
          original_name: string
          promoted_to?: string | null
          sha256?: string | null
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          mime_type?: string
          original_name?: string
          promoted_to?: string | null
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_temp_uploads_promoted_to_fkey"
            columns: ["promoted_to"]
            isOneToOne: false
            referencedRelation: "design_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_temp_uploads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      email_subscribers: {
        Row: {
          consent_at: string
          consent_ip: unknown
          consent_ua: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          interests: string[]
          source: string
          subscribed: boolean
          unsubscribed_at: string | null
          updated_at: string
          welcome_sent_at: string | null
        }
        Insert: {
          consent_at?: string
          consent_ip?: unknown
          consent_ua?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          interests?: string[]
          source?: string
          subscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Update: {
          consent_at?: string
          consent_ip?: unknown
          consent_ua?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          interests?: string[]
          source?: string
          subscribed?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          welcome_sent_at?: string | null
        }
        Relationships: []
      }
      fason_access_tokens: {
        Row: {
          assignment_id: string
          created_at: string | null
          expires_at: string
          fason_partner_id: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token: string
          use_count: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          expires_at: string
          fason_partner_id: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token: string
          use_count?: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          expires_at?: string
          fason_partner_id?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fason_access_tokens_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fason_access_tokens_fason_partner_id_fkey"
            columns: ["fason_partner_id"]
            isOneToOne: false
            referencedRelation: "fason_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fason_access_tokens_fason_partner_id_fkey"
            columns: ["fason_partner_id"]
            isOneToOne: false
            referencedRelation: "v_fason_performance"
            referencedColumns: ["fason_id"]
          },
        ]
      }
      fason_link_access_log: {
        Row: {
          accessed_at: string | null
          action: string
          assignment_id: string
          id: string
          ip_address: string | null
          success: boolean | null
          token_id: string | null
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          action?: string
          assignment_id: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
          token_id?: string | null
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          action?: string
          assignment_id?: string
          id?: string
          ip_address?: string | null
          success?: boolean | null
          token_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fason_link_access_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fason_link_access_log_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "fason_access_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fason_mail_outbox: {
        Row: {
          assignment_id: string | null
          attempts: number
          bounced_at: string | null
          category: string | null
          clicked_at: string | null
          complaint_at: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          last_event: string | null
          last_event_at: string | null
          next_retry_at: string | null
          opened_at: string | null
          payload: Json
          resend_message_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          target_id: string | null
          target_type: string | null
          template_key: string
          to_email: string
          updated_at: string | null
        }
        Insert: {
          assignment_id?: string | null
          attempts?: number
          bounced_at?: string | null
          category?: string | null
          clicked_at?: string | null
          complaint_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          last_event?: string | null
          last_event_at?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          payload: Json
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          template_key: string
          to_email: string
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string | null
          attempts?: number
          bounced_at?: string | null
          category?: string | null
          clicked_at?: string | null
          complaint_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          last_event?: string | null
          last_event_at?: string | null
          next_retry_at?: string | null
          opened_at?: string | null
          payload?: Json
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          target_id?: string | null
          target_type?: string | null
          template_key?: string
          to_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fason_mail_outbox_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      fason_partners: {
        Row: {
          active: boolean
          address_line: string | null
          cached_score: number | null
          city: string | null
          contact_email: string
          contact_person: string | null
          contact_whatsapp: string | null
          contract_pdf_url: string | null
          contract_signed_at: string | null
          contract_uploaded_at: string | null
          created_at: string | null
          created_by: string | null
          default_lead_days: number
          express_lead_time_days: number | null
          iban: string | null
          id: string
          min_order_amount_try: number | null
          name: string
          notes: string | null
          notify_email_on_assign: boolean
          notify_sms_on_urgent: boolean
          payment_term: string | null
          score_updated_at: string | null
          short_name: string | null
          specialties: string[]
          status: string
          status_reason: string | null
          tax_number: string | null
          tax_office: string | null
          town: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          address_line?: string | null
          cached_score?: number | null
          city?: string | null
          contact_email: string
          contact_person?: string | null
          contact_whatsapp?: string | null
          contract_pdf_url?: string | null
          contract_signed_at?: string | null
          contract_uploaded_at?: string | null
          created_at?: string | null
          created_by?: string | null
          default_lead_days?: number
          express_lead_time_days?: number | null
          iban?: string | null
          id?: string
          min_order_amount_try?: number | null
          name: string
          notes?: string | null
          notify_email_on_assign?: boolean
          notify_sms_on_urgent?: boolean
          payment_term?: string | null
          score_updated_at?: string | null
          short_name?: string | null
          specialties?: string[]
          status?: string
          status_reason?: string | null
          tax_number?: string | null
          tax_office?: string | null
          town?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          address_line?: string | null
          cached_score?: number | null
          city?: string | null
          contact_email?: string
          contact_person?: string | null
          contact_whatsapp?: string | null
          contract_pdf_url?: string | null
          contract_signed_at?: string | null
          contract_uploaded_at?: string | null
          created_at?: string | null
          created_by?: string | null
          default_lead_days?: number
          express_lead_time_days?: number | null
          iban?: string | null
          id?: string
          min_order_amount_try?: number | null
          name?: string
          notes?: string | null
          notify_email_on_assign?: boolean
          notify_sms_on_urgent?: boolean
          payment_term?: string | null
          score_updated_at?: string | null
          short_name?: string | null
          specialties?: string[]
          status?: string
          status_reason?: string | null
          tax_number?: string | null
          tax_office?: string | null
          town?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fason_partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fason_partners_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          features: string | null
          id: string
          image_path: string
          is_published: boolean
          product_type: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          features?: string | null
          id?: string
          image_path: string
          is_published?: boolean
          product_type: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          features?: string | null
          id?: string
          image_path?: string
          is_published?: boolean
          product_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      kvkk_requests: {
        Row: {
          admin_note: string | null
          cancelled_at: string | null
          confirm_expires_at: string | null
          confirm_token: string | null
          confirmed_at: string | null
          created_at: string
          grace_period_until: string | null
          id: string
          kind: Database["public"]["Enums"]["kvkk_request_kind"]
          processed_at: string | null
          processed_by: string | null
          request_ip: unknown
          result_path: string | null
          scope: Json
          status: Database["public"]["Enums"]["kvkk_request_status"]
          updated_at: string
          user_agent: string | null
          user_id: string
          user_note: string | null
        }
        Insert: {
          admin_note?: string | null
          cancelled_at?: string | null
          confirm_expires_at?: string | null
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          grace_period_until?: string | null
          id?: string
          kind: Database["public"]["Enums"]["kvkk_request_kind"]
          processed_at?: string | null
          processed_by?: string | null
          request_ip?: unknown
          result_path?: string | null
          scope?: Json
          status?: Database["public"]["Enums"]["kvkk_request_status"]
          updated_at?: string
          user_agent?: string | null
          user_id: string
          user_note?: string | null
        }
        Update: {
          admin_note?: string | null
          cancelled_at?: string | null
          confirm_expires_at?: string | null
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          grace_period_until?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["kvkk_request_kind"]
          processed_at?: string | null
          processed_by?: string | null
          request_ip?: unknown
          result_path?: string | null
          scope?: Json
          status?: Database["public"]["Enums"]["kvkk_request_status"]
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kvkk_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "kvkk_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      loyalty_grants: {
        Row: {
          admin_id: string | null
          amount_try: number
          created_at: string
          id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount_try: number
          created_at?: string
          id?: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount_try?: number
          created_at?: string
          id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_grants_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "loyalty_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mail_suppressions: {
        Row: {
          blocked_categories: string[] | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          reason: string | null
          source_event_id: string | null
          source_message_id: string | null
          suppression_type: string
        }
        Insert: {
          blocked_categories?: string[] | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          reason?: string | null
          source_event_id?: string | null
          source_message_id?: string | null
          suppression_type: string
        }
        Update: {
          blocked_categories?: string[] | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          reason?: string | null
          source_event_id?: string | null
          source_message_id?: string | null
          suppression_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_suppressions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          blog_consent_at: string | null
          email_blog: boolean
          email_marketing: boolean
          email_order_updates: boolean
          email_proof_ready: boolean
          email_shipping_updates: boolean
          marketing_consent_at: string | null
          sms_delivery: boolean
          sms_proof_ready: boolean
          sms_urgent_order: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          blog_consent_at?: string | null
          email_blog?: boolean
          email_marketing?: boolean
          email_order_updates?: boolean
          email_proof_ready?: boolean
          email_shipping_updates?: boolean
          marketing_consent_at?: string | null
          sms_delivery?: boolean
          sms_proof_ready?: boolean
          sms_urgent_order?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          blog_consent_at?: string | null
          email_blog?: boolean
          email_marketing?: boolean
          email_order_updates?: boolean
          email_proof_ready?: boolean
          email_shipping_updates?: boolean
          marketing_consent_at?: string | null
          sms_delivery?: boolean
          sms_proof_ready?: boolean
          sms_urgent_order?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      order_assignments: {
        Row: {
          acknowledged_at: string | null
          actual_delivery: string | null
          assigned_at: string | null
          assigned_by: string | null
          cancelled_at: string | null
          created_at: string | null
          estimated_delivery: string | null
          fason_partner_id: string
          id: string
          in_production_at: string | null
          is_urgent: boolean
          issue_category: string | null
          issue_description: string | null
          issue_photo_path: string | null
          issue_reported_at: string | null
          notes: string | null
          order_id: string
          ready_at: string | null
          sent_at: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          tracking_company: string | null
          tracking_delivered_at: string | null
          tracking_last_polled_at: string | null
          tracking_number: string | null
          tracking_status: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          actual_delivery?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          estimated_delivery?: string | null
          fason_partner_id: string
          id?: string
          in_production_at?: string | null
          is_urgent?: boolean
          issue_category?: string | null
          issue_description?: string | null
          issue_photo_path?: string | null
          issue_reported_at?: string | null
          notes?: string | null
          order_id: string
          ready_at?: string | null
          sent_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          tracking_company?: string | null
          tracking_delivered_at?: string | null
          tracking_last_polled_at?: string | null
          tracking_number?: string | null
          tracking_status?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          actual_delivery?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          estimated_delivery?: string | null
          fason_partner_id?: string
          id?: string
          in_production_at?: string | null
          is_urgent?: boolean
          issue_category?: string | null
          issue_description?: string | null
          issue_photo_path?: string | null
          issue_reported_at?: string | null
          notes?: string | null
          order_id?: string
          ready_at?: string | null
          sent_at?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          tracking_company?: string | null
          tracking_delivered_at?: string | null
          tracking_last_polled_at?: string | null
          tracking_number?: string | null
          tracking_status?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_assignments_fason_partner_id_fkey"
            columns: ["fason_partner_id"]
            isOneToOne: false
            referencedRelation: "fason_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_assignments_fason_partner_id_fkey"
            columns: ["fason_partner_id"]
            isOneToOne: false
            referencedRelation: "v_fason_performance"
            referencedColumns: ["fason_id"]
          },
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          detail: Json | null
          event_type: string
          id: string
          order_id: string
          status_after: Database["public"]["Enums"]["order_status"] | null
          summary: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json | null
          event_type: string
          id?: string
          order_id: string
          status_after?: Database["public"]["Enums"]["order_status"] | null
          summary: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: Json | null
          event_type?: string
          id?: string
          order_id?: string
          status_after?: Database["public"]["Enums"]["order_status"] | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          config: string
          cutline_design_id: string | null
          height: number
          id: string
          meta: Json
          order_id: string
          partner_decided_at: string | null
          partner_decided_by: string | null
          partner_decision_note: string | null
          product: string
          proof_approved_at: string | null
          proof_edited_at: string | null
          proof_status: string
          proof_viewed_at: string | null
          print_ready_pdf_url: string | null
          qty: number
          reprint_source_order_id: string | null
          title: string
          total: number
          unit: number
          width: number
        }
        Insert: {
          config: string
          cutline_design_id?: string | null
          height: number
          id?: string
          meta?: Json
          order_id: string
          partner_decided_at?: string | null
          partner_decided_by?: string | null
          partner_decision_note?: string | null
          product: string
          proof_approved_at?: string | null
          proof_edited_at?: string | null
          proof_status?: string
          proof_viewed_at?: string | null
          print_ready_pdf_url?: string | null
          qty: number
          reprint_source_order_id?: string | null
          title: string
          total: number
          unit: number
          width: number
        }
        Update: {
          config?: string
          cutline_design_id?: string | null
          height?: number
          id?: string
          meta?: Json
          order_id?: string
          partner_decided_at?: string | null
          partner_decided_by?: string | null
          partner_decision_note?: string | null
          product?: string
          proof_approved_at?: string | null
          proof_edited_at?: string | null
          proof_status?: string
          proof_viewed_at?: string | null
          print_ready_pdf_url?: string | null
          qty?: number
          reprint_source_order_id?: string | null
          title?: string
          total?: number
          unit?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_cutline_design_id_fkey"
            columns: ["cutline_design_id"]
            isOneToOne: false
            referencedRelation: "cutline_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_partner_decided_by_fkey"
            columns: ["partner_decided_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "order_items_reprint_source_order_id_fkey"
            columns: ["reprint_source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: Json
          archive_path: string | null
          archive_status: Database["public"]["Enums"]["archive_status"]
          archived_at: string | null
          created_at: string
          estimated_delivery: string | null
          id: string
          invoice: Json
          is_manual: boolean
          payment: Json
          proof_storage_path: string | null
          proof_uploaded_at: string | null
          proof_uploaded_by: string | null
          shipping: number
          sla_proof_deadline: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: Json
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          created_at?: string
          estimated_delivery?: string | null
          id: string
          invoice: Json
          is_manual?: boolean
          payment: Json
          proof_storage_path?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          shipping?: number
          sla_proof_deadline?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: Json
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          invoice?: Json
          is_manual?: boolean
          payment?: Json
          proof_storage_path?: string | null
          proof_uploaded_at?: string | null
          proof_uploaded_by?: string | null
          shipping?: number
          sla_proof_deadline?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_proof_uploaded_by_fkey"
            columns: ["proof_uploaded_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      partner_capabilities: {
        Row: {
          capability_type: string
          capability_value: string
          created_at: string | null
          id: string
          is_verified: boolean
          partner_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          capability_type: string
          capability_value: string
          created_at?: string | null
          id?: string
          is_verified?: boolean
          partner_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          capability_type?: string
          capability_value?: string
          created_at?: string | null
          id?: string
          is_verified?: boolean
          partner_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_capabilities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "fason_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_capabilities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_fason_performance"
            referencedColumns: ["fason_id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          auto_notification: boolean | null
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string
          partner_id: string
          phone_e164: string
          role: string
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_notification?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name: string
          partner_id: string
          phone_e164: string
          role: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_notification?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          partner_id?: string
          phone_e164?: string
          role?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "fason_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "v_fason_performance"
            referencedColumns: ["fason_id"]
          },
          {
            foreignKeyName: "partner_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          card_amount: number
          consumed_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          iyzico_token: string | null
          order_id: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["payment_intent_status"]
          total_amount: number | null
          user_id: string
          wallet_amount: number
        }
        Insert: {
          card_amount: number
          consumed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id: string
          iyzico_token?: string | null
          order_id?: string | null
          snapshot: Json
          status?: Database["public"]["Enums"]["payment_intent_status"]
          total_amount?: number | null
          user_id: string
          wallet_amount?: number
        }
        Update: {
          card_amount?: number
          consumed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          iyzico_token?: string | null
          order_id?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["payment_intent_status"]
          total_amount?: number | null
          user_id?: string
          wallet_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          action: string
          amount: number
          card_masked: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          installment: number | null
          order_id: string
          psp_provider: string
          psp_raw: Json | null
          psp_transaction_id: string | null
          status: string
        }
        Insert: {
          action: string
          amount: number
          card_masked?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          installment?: number | null
          order_id: string
          psp_provider: string
          psp_raw?: Json | null
          psp_transaction_id?: string | null
          status: string
        }
        Update: {
          action?: string
          amount?: number
          card_masked?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          installment?: number | null
          order_id?: string
          psp_provider?: string
          psp_raw?: Json | null
          psp_transaction_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          draft_config: Json
          draft_updated_at: string
          draft_updated_by: string | null
          draft_updated_by_email: string | null
          live_config: Json
          live_published_at: string | null
          live_updated_at: string
          live_updated_by: string | null
          live_updated_by_email: string | null
          scope: string
        }
        Insert: {
          draft_config?: Json
          draft_updated_at?: string
          draft_updated_by?: string | null
          draft_updated_by_email?: string | null
          live_config?: Json
          live_published_at?: string | null
          live_updated_at?: string
          live_updated_by?: string | null
          live_updated_by_email?: string | null
          scope: string
        }
        Update: {
          draft_config?: Json
          draft_updated_at?: string
          draft_updated_by?: string | null
          draft_updated_by_email?: string | null
          live_config?: Json
          live_published_at?: string | null
          live_updated_at?: string
          live_updated_by?: string | null
          live_updated_by_email?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_draft_updated_by_fkey"
            columns: ["draft_updated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pricing_config_live_updated_by_fkey"
            columns: ["live_updated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pricing_config_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          config_snapshot: Json
          id: string
          note: string | null
          scope: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          config_snapshot: Json
          id?: string
          note?: string | null
          scope: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          config_snapshot?: Json
          id?: string
          note?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_config_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      partner_pricebook_axes: {
        Row: {
          axis: string
          created_at: string
          display_order: number
          id: string
          product_type: string
          value_mm: number
        }
        Insert: {
          axis: string
          created_at?: string
          display_order?: number
          id?: string
          product_type?: string
          value_mm: number
        }
        Update: {
          axis?: string
          created_at?: string
          display_order?: number
          id?: string
          product_type?: string
          value_mm?: number
        }
        Relationships: []
      }
      partner_pricebook_matrices: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          material_key: string
          product_type: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id?: string
          material_key: string
          product_type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          material_key?: string
          product_type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      partner_pricebook_cells: {
        Row: {
          height_mm: number
          matrix_id: string
          price_per_unit: number
          qty: number
          updated_at: string
          width_mm: number
        }
        Insert: {
          height_mm: number
          matrix_id: string
          price_per_unit: number
          qty: number
          updated_at?: string
          width_mm: number
        }
        Update: {
          height_mm?: number
          matrix_id?: string
          price_per_unit?: number
          qty?: number
          updated_at?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_pricebook_cells_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "partner_pricebook_matrices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_cards: {
        Row: {
          created_at: string
          desc_en: string
          desc_tr: string
          id: string
          image_src: string | null
          is_active: boolean
          key: string
          product_type: string
          query_params: Json
          sort_order: number
          svg_id: string | null
          title_en: string
          title_tr: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          desc_en: string
          desc_tr: string
          id?: string
          image_src?: string | null
          is_active?: boolean
          key: string
          product_type: string
          query_params?: Json
          sort_order?: number
          svg_id?: string | null
          title_en: string
          title_tr: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          desc_en?: string
          desc_tr?: string
          id?: string
          image_src?: string | null
          is_active?: boolean
          key?: string
          product_type?: string
          query_params?: Json
          sort_order?: number
          svg_id?: string | null
          title_en?: string
          title_tr?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role_v2"] | null
          archive_path: string | null
          archive_status: Database["public"]["Enums"]["archive_status"]
          archived_at: string | null
          company_name: string | null
          created_at: string
          display_name: string | null
          email_verified_at: string | null
          id: string
          invoice_format: string | null
          invoice_type: string | null
          locale: string | null
          phone: string | null
          referral_code: string | null
          referred_by_user_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          tax_office: string | null
          tc: string | null
          updated_at: string
          vip_since: string | null
          vkn: string | null
        }
        Insert: {
          admin_role?: Database["public"]["Enums"]["admin_role_v2"] | null
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_at?: string | null
          id: string
          invoice_format?: string | null
          invoice_type?: string | null
          locale?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tax_office?: string | null
          tc?: string | null
          updated_at?: string
          vip_since?: string | null
          vkn?: string | null
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role_v2"] | null
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          company_name?: string | null
          created_at?: string
          display_name?: string | null
          email_verified_at?: string | null
          id?: string
          invoice_format?: string | null
          invoice_type?: string | null
          locale?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          tax_office?: string | null
          tc?: string | null
          updated_at?: string
          vip_since?: string | null
          vkn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profiles_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      proof_help_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string
          order_item_id: string
          resolution_cutline_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id: string
          order_item_id: string
          resolution_cutline_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string
          order_item_id?: string
          resolution_cutline_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_help_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_help_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_help_requests_resolution_cutline_id_fkey"
            columns: ["resolution_cutline_id"]
            isOneToOne: false
            referencedRelation: "cutline_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_help_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "proof_help_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          referred_coupon_code: string | null
          referred_user_id: string
          referrer_coupon_code: string | null
          referrer_user_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referred_coupon_code?: string | null
          referred_user_id: string
          referrer_coupon_code?: string | null
          referrer_user_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          referred_coupon_code?: string | null
          referred_user_id?: string
          referrer_coupon_code?: string | null
          referrer_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      returns: {
        Row: {
          admin_note: string | null
          archive_path: string | null
          archive_status: Database["public"]["Enums"]["archive_status"]
          archived_at: string | null
          attachments: string[]
          created_at: string
          customer_email: string
          customer_name: string
          description: string
          id: string
          order_id: string
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount: number | null
          refund_payment_id: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          attachments?: string[]
          created_at?: string
          customer_email: string
          customer_name: string
          description: string
          id?: string
          order_id: string
          reason: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number | null
          refund_payment_id?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          attachments?: string[]
          created_at?: string
          customer_email?: string
          customer_name?: string
          description?: string
          id?: string
          order_id?: string
          reason?: Database["public"]["Enums"]["return_reason"]
          refund_amount?: number | null
          refund_payment_id?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_refund_payment_id_fkey"
            columns: ["refund_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      review_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          delivered_at: string
          email_clicked_at: string | null
          email_opened_at: string | null
          email_sent_at: string | null
          expires_at: string
          id: string
          in_app_dismissed_permanently: boolean
          in_app_dismissed_until: string | null
          in_app_shown_count: number
          last_in_app_shown_at: string | null
          order_id: string
          request_token: string
          review_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          delivered_at: string
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at: string
          id?: string
          in_app_dismissed_permanently?: boolean
          in_app_dismissed_until?: string | null
          in_app_shown_count?: number
          last_in_app_shown_at?: string | null
          order_id: string
          request_token?: string
          review_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          delivered_at?: string
          email_clicked_at?: string | null
          email_opened_at?: string | null
          email_sent_at?: string | null
          expires_at?: string
          id?: string
          in_app_dismissed_permanently?: boolean
          in_app_dismissed_until?: string | null
          in_app_shown_count?: number
          last_in_app_shown_at?: string | null
          order_id?: string
          request_token?: string
          review_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reviews: {
        Row: {
          archive_path: string | null
          archive_status: Database["public"]["Enums"]["archive_status"]
          archived_at: string | null
          body: string
          bonus_coupon_code: string | null
          cons: string | null
          created_at: string
          display_name: string | null
          featured: boolean
          helpful_count: number
          id: string
          is_demo_seed: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          order_id: string | null
          photos: Json
          product_type: string | null
          pros: string | null
          rating: number
          show_on_homepage: boolean
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          body: string
          bonus_coupon_code?: string | null
          cons?: string | null
          created_at?: string
          display_name?: string | null
          featured?: boolean
          helpful_count?: number
          id?: string
          is_demo_seed?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_id?: string | null
          photos?: Json
          product_type?: string | null
          pros?: string | null
          rating: number
          show_on_homepage?: boolean
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archive_path?: string | null
          archive_status?: Database["public"]["Enums"]["archive_status"]
          archived_at?: string | null
          body?: string
          bonus_coupon_code?: string | null
          cons?: string | null
          created_at?: string
          display_name?: string | null
          featured?: boolean
          helpful_count?: number
          id?: string
          is_demo_seed?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          order_id?: string | null
          photos?: Json
          product_type?: string | null
          pros?: string | null
          rating?: number
          show_on_homepage?: boolean
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      shipment_carriers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          display_name: string
          sort_order: number
          tracking_url_template: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          display_name: string
          sort_order?: number
          tracking_url_template?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          display_name?: string
          sort_order?: number
          tracking_url_template?: string | null
        }
        Relationships: []
      }
      shipment_status_events: {
        Row: {
          assignment_id: string | null
          created_at: string
          description: string | null
          event_time: string
          id: string
          location: string | null
          order_id: string
          polled_at: string
          raw_payload: Json | null
          raw_status_code: string | null
          status: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          event_time: string
          id?: string
          location?: string | null
          order_id: string
          polled_at?: string
          raw_payload?: Json | null
          raw_status_code?: string | null
          status: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          description?: string | null
          event_time?: string
          id?: string
          location?: string | null
          order_id?: string
          polled_at?: string
          raw_payload?: Json | null
          raw_status_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "order_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_status_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      site_images: {
        Row: {
          alt_text: string | null
          created_at: string
          height: number | null
          id: string
          is_active: boolean
          link_url: string | null
          mime_type: string | null
          size_bytes: number | null
          slot: string
          storage_path: string
          title: string | null
          updated_at: string
          updated_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          slot: string
          storage_path: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          slot?: string
          storage_path?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "site_images_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
      site_settings: {
        Row: {
          free_shipping_threshold: number
          id: number
          maintenance_message: string | null
          maintenance_mode: boolean
          max_order_total_try: number
          min_order_total_try: number
          min_subtotal_for_credit: number
          partner_auto_assign_enabled: boolean
          pricing_markup_pct: number
          referral_credit_try: number
          shipping_fee_try: number
          updated_at: string
          updated_by: string | null
          welcome_credit_try: number
        }
        Insert: {
          free_shipping_threshold?: number
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_order_total_try?: number
          min_order_total_try?: number
          min_subtotal_for_credit?: number
          partner_auto_assign_enabled?: boolean
          pricing_markup_pct?: number
          referral_credit_try?: number
          shipping_fee_try?: number
          updated_at?: string
          updated_by?: string | null
          welcome_credit_try?: number
        }
        Update: {
          free_shipping_threshold?: number
          id?: number
          maintenance_message?: string | null
          maintenance_mode?: boolean
          max_order_total_try?: number
          min_order_total_try?: number
          min_subtotal_for_credit?: number
          partner_auto_assign_enabled?: boolean
          pricing_markup_pct?: number
          referral_credit_try?: number
          shipping_fee_try?: number
          updated_at?: string
          updated_by?: string | null
          welcome_credit_try?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "v_admin_customers"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      v_admin_customers: {
        Row: {
          active_orders: number | null
          avg_order: number | null
          banned_until: string | null
          display_name: string | null
          email: string | null
          email_confirmed_at: string | null
          first_order_at: string | null
          has_2fa: boolean | null
          invoice_type: string | null
          last_order_at: string | null
          last_order_id: string | null
          last_sign_in_at: string | null
          marketing_subscribed: boolean | null
          notes_count: number | null
          order_count: number | null
          phone: string | null
          registered_at: string | null
          tags: string[] | null
          total_loyalty_granted: number | null
          total_revenue: number | null
          user_id: string | null
        }
        Relationships: []
      }
      v_auditor_latest_runs: {
        Row: {
          auditor_name: string | null
          critical_count: number | null
          duration_ms: number | null
          findings_count: number | null
          finished_at: string | null
          info_count: number | null
          latest_run_id: string | null
          started_at: string | null
          status: string | null
          summary: string | null
          warning_count: number | null
        }
        Relationships: []
      }
      v_auditor_pending_count: {
        Row: {
          critical_pending: number | null
          info_pending: number | null
          total_pending: number | null
          warning_pending: number | null
        }
        Relationships: []
      }
      v_customer_activity: {
        Row: {
          created_at: string | null
          detail: string | null
          emoji: string | null
          kind: string | null
          ref_id: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      v_fason_performance: {
        Row: {
          active: boolean | null
          avg_response_hours: number | null
          cancelled_count: number | null
          fason_id: string | null
          fason_name: string | null
          issue_count: number | null
          issue_rate: number | null
          last_assigned_at: string | null
          on_time_rate: number | null
          return_rate: number | null
          shipped_count: number | null
          total_assignments: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_admin_customer_360: { Args: { p_user_id: string }; Returns: Json }
      fn_anonymize_old_pim_conversations: { Args: never; Returns: number }
      fn_apply_coupon: {
        Args: {
          p_code: string
          p_order_id: string
          p_subtotal: number
          p_user_id: string
        }
        Returns: Json
      }
      fn_apply_referral_code: {
        Args: { p_new_user_id: string; p_referral_code: string }
        Returns: boolean
      }
      fn_assign_order_to_fason: {
        Args: {
          p_admin_user_id: string
          p_estimated_delivery: string
          p_fason_partner_id: string
          p_notes: string
          p_order_id: string
          p_token_days?: number
        }
        Returns: {
          assignment_id: string
          fason_token: string
          order_status_after: string
          order_status_before: string
        }[]
      }
      fn_auto_refund_stale_proofs: {
        Args: never
        Returns: {
          hours_since_proof: number
          order_id: string
        }[]
      }
      fn_cleanup_old_failed_logins: {
        Args: { p_days?: number }
        Returns: number
      }
      fn_cleanup_outbox_payload: { Args: never; Returns: number }
      fn_cleanup_temp_designs: { Args: never; Returns: number }
      fn_complete_referral: {
        Args: { p_referred_user_id: string }
        Returns: undefined
      }
      fn_consume_payment_intent: {
        Args: { p_intent_id: string; p_order_id: string; p_user_id: string }
        Returns: boolean
      }
      fn_count_legal_purge_candidates: {
        Args: never
        Returns: {
          candidate_count: number
          oldest_order_date: string
          warn_30day_count: number
        }[]
      }
      fn_create_manual_order: {
        Args: {
          p_address: Json
          p_estimated_delivery: string
          p_invoice: Json
          p_items: Json
          p_order_id: string
          p_payment: Json
          p_shipping: number
          p_subtotal: number
          p_total: number
        }
        Returns: string
      }
      fn_create_order: {
        Args: {
          p_address: Json
          p_estimated_delivery: string
          p_invoice: Json
          p_items: Json
          p_order_id: string
          p_payment: Json
          p_shipping: number
          p_subtotal: number
          p_total: number
          p_user_id: string
        }
        Returns: string
      }
      fn_create_partner_with_contacts: {
        Args: {
          p_admin_id: string
          p_capabilities: Json
          p_contacts: Json
          p_partner: Json
        }
        Returns: string
      }
      fn_enqueue_mail: {
        Args: {
          p_category?: string
          p_idempotency_key?: string
          p_payload: Json
          p_subject?: string
          p_target_id?: string
          p_target_type?: string
          p_template_key: string
          p_to_email: string
        }
        Returns: string
      }
      fn_finalize_paid_order: {
        Args: {
          p_estimated_delivery: string
          p_items: Json
          p_merchant_oid: string
          p_order_id: string
          p_payment_meta: Json
        }
        Returns: {
          order_id: string
          was_duplicate: boolean
        }[]
      }
      fn_finalize_proof: { Args: { p_order_id: string }; Returns: Json }
      fn_find_best_partner: {
        Args: {
          p_material: string
          p_order_amount?: number
          p_product_type: string
        }
        Returns: {
          cached_score: number
          default_lead_days: number
          partner_id: string
          partner_name: string
        }[]
      }
      fn_funnel_avg_durations: {
        Args: never
        Returns: {
          avg_seconds: number
          sample_count: number
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      fn_generate_fason_token: {
        Args: {
          p_assignment_id: string
          p_days?: number
          p_fason_partner_id: string
        }
        Returns: string
      }
      fn_generate_referral_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      fn_get_my_order_shipment: {
        Args: { p_order_id: string }
        Returns: {
          carrier_code: string
          carrier_label: string
          delivered_at: string
          has_shipment: boolean
          shipped_at: string
          status: string
          tracking_number: string
          tracking_url: string
        }[]
      }
      fn_get_my_shipment_timeline: {
        Args: { p_order_id: string }
        Returns: {
          description: string
          event_time: string
          location: string
          status: string
        }[]
      }
      fn_get_shipment_poll_candidates: {
        Args: { p_limit?: number; p_min_age_minutes?: number }
        Returns: {
          assignment_id: string
          last_polled_at: string
          order_id: string
          shipped_at: string
          tracking_company: string
          tracking_number: string
        }[]
      }
      fn_has_permission: {
        Args: { p_action: string; p_module: string }
        Returns: boolean
      }
      fn_is_suppressed: {
        Args: { p_category: string; p_email: string }
        Returns: boolean
      }
      fn_list_admin_roles: {
        Args: never
        Returns: {
          description: string
          label: string
          role: Database["public"]["Enums"]["admin_role_v2"]
        }[]
      }
      fn_list_carriers: {
        Args: never
        Returns: {
          code: string
          display_name: string
          has_template: boolean
        }[]
      }
      fn_log_audit: {
        Args: {
          p_action: Database["public"]["Enums"]["audit_action"]
          p_detail?: Json
          p_summary?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: string
      }
      fn_log_failed_login: {
        Args: {
          p_email: string
          p_ip: unknown
          p_reason?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      fn_map_item_to_capability: {
        Args: { p_meta: Json; p_product: string }
        Returns: {
          material: string
          product_type: string
        }[]
      }
      fn_mark_expired_designs_for_deletion: {
        Args: never
        Returns: {
          deletion_due_at: string
          design_id: string
          order_id: string
          storage_path: string
          user_id: string
        }[]
      }
      fn_order_has_design: { Args: { p_order_id: string }; Returns: boolean }
      fn_process_kvkk_deletion: {
        Args: { p_request_id: string }
        Returns: Json
      }
      fn_proof_summary: { Args: { p_order_id: string }; Returns: Json }
      fn_publish_pricing_config: {
        Args: { p_note?: string; p_scope: string }
        Returns: undefined
      }
      fn_purge_expired_designs: {
        Args: never
        Returns: {
          design_id: string
          order_id: string
          storage_path: string
          user_id: string
          was_archived: boolean
        }[]
      }
      fn_recent_failed_logins: {
        Args: { p_since: string; p_threshold?: number }
        Returns: {
          count: number
          email: string
          ip: string
        }[]
      }
      fn_record_suppression: {
        Args: {
          p_blocked_categories?: string[]
          p_email: string
          p_reason?: string
          p_source_event_id?: string
          p_source_message_id?: string
          p_type: string
        }
        Returns: string
      }
      fn_refresh_fason_scores: {
        Args: never
        Returns: {
          fason_id: string
          fason_name: string
          new_score: number
        }[]
      }
      fn_renew_design_retention: {
        Args: { p_source_order_id: string }
        Returns: number
      }
      fn_revert_pricing_config: {
        Args: { p_history_id: string; p_scope: string }
        Returns: undefined
      }
      fn_suggest_fason_partner: {
        Args: { p_specialty: string }
        Returns: {
          active_count: number
          cached_score: number
          fason_id: string
          fason_name: string
          reason: string
        }[]
      }
      fn_validate_coupon: {
        Args: { p_code: string; p_subtotal: number }
        Returns: Json
      }
      fn_validate_fason_token: {
        Args: { p_token: string }
        Returns: {
          assignment_id: string
          fason_partner_id: string
          is_valid: boolean
          order_id: string
          reason: string
        }[]
      }
      get_archive_candidates: {
        Args: { p_days_inactive?: number }
        Returns: {
          has_active_orders: boolean
          last_activity_at: string
          order_count: number
          user_id: string
        }[]
      }
      get_homepage_reviews: {
        Args: { p_limit?: number }
        Returns: {
          body: string
          created_at: string
          display_name: string
          featured: boolean
          id: string
          photos: Json
          product_type: string
          rating: number
        }[]
      }
      get_product_reviews: {
        Args: { p_limit?: number; p_product_type: string }
        Returns: {
          body: string
          created_at: string
          display_name: string
          featured: boolean
          id: string
          photos: Json
          rating: number
        }[]
      }
      is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_super_admin: { Args: { p_user_id?: string }; Returns: boolean }
    }
    Enums: {
      admin_role_v2:
        | "super_admin"
        | "operations"
        | "customer_service"
        | "production"
        | "content_editor"
      archive_status: "hot" | "archiving" | "cold" | "restoring" | "deleted"
      assignment_status:
        | "assigned"
        | "sent"
        | "acknowledged"
        | "in_production"
        | "ready"
        | "shipped"
        | "issue"
        | "cancelled"
      audit_action:
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
        | "profile.delete"
      coupon_kind: "percent" | "fixed" | "free_ship"
      design_file_status:
        | "uploaded"
        | "analyzing"
        | "qc_passed"
        | "qc_warned"
        | "qc_failed"
        | "approved"
        | "superseded"
      kvkk_request_kind:
        | "data_export"
        | "account_delete"
        | "partial_delete"
        | "correction"
        | "objection"
        | "restriction"
      kvkk_request_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "processing"
        | "completed"
        | "rejected"
      order_status:
        | "paid"
        | "awaiting_upload"
        | "qc_pending"
        | "qc_flagged"
        | "operator_review"
        | "proof_pending"
        | "proof_validating"
        | "proof_approved"
        | "in_production"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "proof_generating"
        | "fason_assigned"
        | "human_review"
        | "human_review_failed"
        | "ready_to_ship"
      payment_intent_status: "pending" | "consumed" | "failed" | "expired"
      return_reason:
        | "yanlis_urun"
        | "uretim_hatasi"
        | "kargo_hasari"
        | "kalite_problemi"
        | "diger"
      return_status: "pending" | "approved" | "rejected" | "refunded"
      review_status: "pending" | "published" | "rejected" | "hidden"
      storage_provider: "supabase" | "r2"
      user_role: "customer" | "staff" | "admin" | "partner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role_v2: [
        "super_admin",
        "operations",
        "customer_service",
        "production",
        "content_editor",
      ],
      archive_status: ["hot", "archiving", "cold", "restoring", "deleted"],
      assignment_status: [
        "assigned",
        "sent",
        "acknowledged",
        "in_production",
        "ready",
        "shipped",
        "issue",
        "cancelled",
      ],
      audit_action: [
        "order.status_change",
        "order.cancel",
        "order.refund",
        "return.approve",
        "return.reject",
        "return.refund",
        "coupon.create",
        "coupon.update",
        "coupon.delete",
        "review.approve",
        "review.reject",
        "review.delete",
        "staff.invite",
        "staff.remove",
        "staff.role_change",
        "settings.update",
        "design_file.approve",
        "design_file.reject",
        "auth.login",
        "auth.logout",
        "profile.delete",
      ],
      coupon_kind: ["percent", "fixed", "free_ship"],
      design_file_status: [
        "uploaded",
        "analyzing",
        "qc_passed",
        "qc_warned",
        "qc_failed",
        "approved",
        "superseded",
      ],
      kvkk_request_kind: [
        "data_export",
        "account_delete",
        "partial_delete",
        "correction",
        "objection",
        "restriction",
      ],
      kvkk_request_status: [
        "pending",
        "confirmed",
        "cancelled",
        "processing",
        "completed",
        "rejected",
      ],
      order_status: [
        "paid",
        "awaiting_upload",
        "qc_pending",
        "qc_flagged",
        "operator_review",
        "proof_pending",
        "proof_validating",
        "proof_approved",
        "in_production",
        "shipped",
        "delivered",
        "cancelled",
        "proof_generating",
        "fason_assigned",
        "human_review",
        "human_review_failed",
        "ready_to_ship",
      ],
      payment_intent_status: ["pending", "consumed", "failed", "expired"],
      return_reason: [
        "yanlis_urun",
        "uretim_hatasi",
        "kargo_hasari",
        "kalite_problemi",
        "diger",
      ],
      return_status: ["pending", "approved", "rejected", "refunded"],
      review_status: ["pending", "published", "rejected", "hidden"],
      storage_provider: ["supabase", "r2"],
      user_role: ["customer", "staff", "admin", "partner"],
    },
  },
} as const
