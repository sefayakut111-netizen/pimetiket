export interface AdminCustomerRow {
  user_id: string;
  email: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  registered_at: string;
  banned_until: string | null;
  display_name: string | null;
  phone: string | null;
  invoice_type: "individual" | "corporate" | null;
  order_count: number;
  active_orders: number;
  total_revenue: number;
  avg_order: number;
  last_order_at: string | null;
  last_order_id: string | null;
  first_order_at: string | null;
  total_loyalty_granted: number;
  has_2fa: boolean;
  tags: string[];
  notes_count: number;
  marketing_subscribed: boolean;
}

export interface AdminCustomerWithSegment extends AdminCustomerRow {
  segment: "vip" | "repeat" | "new" | "risk" | "lost" | "no_order";
}
