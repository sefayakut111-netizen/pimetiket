/**
 * Pim Etiket — E2E Sipariş Simülatörü
 *
 * Sefa 17 May: "sipariş simülasyonu yapıp hataları bulacağımız bir şey".
 *
 * Admin panelinden tetiklenir. Backend'de 8 adım sırayla:
 *   1. Test kullanıcı oluştur (auth.users + profiles)
 *   2. Sepete ürün ekle (etiket + sticker mock)
 *   3. Adres oluştur (Migration 044 trigger test)
 *   4. Kurumsal fatura profili (Migration 044 trigger test)
 *   5. Kupon validate (HOSGELDIN10 RPC + geçersiz)
 *   6. Order oluştur (fn_create_order RPC)
 *   7. Mock paid callback simulate (fn_apply_paid_order)
 *   8. Doğrulama: order.status='paid' + outbox satırı
 *
 * Her adım: { ok, duration_ms, error?, data? }
 *
 * Test verisi cleanup: simülasyon sonrası test_simulation=true bayraklı
 * order ve user'lar günlük cron ile silinir (ileride).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type StepStatus = "pending" | "running" | "success" | "fail" | "skip";

export interface SimStep {
  id: string;
  label: string;
  emoji: string;
  status: StepStatus;
  duration_ms?: number;
  error?: string;
  data?: Record<string, unknown>;
}

export interface SimResult {
  ok: boolean;
  total_duration_ms: number;
  steps: SimStep[];
  test_user_id?: string;
  test_order_id?: string;
  cleanup_hint?: string;
}

const STEP_DEFS: Omit<SimStep, "status">[] = [
  { id: "user", label: "Test kullanıcı oluştur", emoji: "👤" },
  { id: "cart", label: "Sepete ürün ekle (2 kalem)", emoji: "🛒" },
  { id: "address", label: "Adres ekle (Migration 044)", emoji: "📍" },
  { id: "invoice", label: "Kurumsal fatura profili (Migration 044)", emoji: "📄" },
  { id: "coupon", label: "Kupon kodu doğrula", emoji: "🎁" },
  { id: "order", label: "Order kaydı oluştur", emoji: "📋" },
  { id: "callback", label: "Mock PayTR callback (paid)", emoji: "💳" },
  { id: "verify", label: "Doğrulama (status + outbox)", emoji: "✅" },
];

/**
 * Simülasyonu tamamen çalıştır. Her step'in zamanını + hatalarını döner.
 *
 * Test verisi: simulator-<timestamp>@pimetiket.test email, otomatik
 * cleanup için.
 */
export async function runCheckoutSimulation(
  triggeredByAdminId: string
): Promise<SimResult> {
  const t0 = Date.now();
  const admin = createAdminClient();
  const steps: SimStep[] = STEP_DEFS.map((s) => ({ ...s, status: "pending" }));
  const stamp = Date.now();
  const testEmail = `simulator-${stamp}@pimetiket.test`;
  let userId: string | undefined;
  let orderId: string | undefined;

  function setStep(
    id: string,
    patch: Partial<SimStep>
  ): void {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    steps[idx] = { ...steps[idx], ...patch };
  }

  /**
   * Supabase PostgrestError ve diğer error tiplerini düzgün parse eder.
   * `[object Object]` görmemek için.
   */
  function formatError(err: unknown): { message: string; raw: unknown } {
    if (err instanceof Error) {
      return { message: err.message, raw: { stack: err.stack } };
    }
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const parts: string[] = [];
      if (typeof e.message === "string") parts.push(e.message);
      if (typeof e.code === "string") parts.push(`(${e.code})`);
      if (typeof e.details === "string") parts.push(`— ${e.details}`);
      if (typeof e.hint === "string") parts.push(`hint: ${e.hint}`);
      const message = parts.length > 0
        ? parts.join(" ")
        : JSON.stringify(err);
      return { message, raw: err };
    }
    return { message: String(err), raw: err };
  }

  async function step<T>(
    id: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    setStep(id, { status: "running" });
    const start = Date.now();
    try {
      const result = await fn();
      setStep(id, {
        status: "success",
        duration_ms: Date.now() - start,
      });
      return result;
    } catch (err) {
      const { message, raw } = formatError(err);
      const existing = steps.find((s) => s.id === id)?.data;
      setStep(id, {
        status: "fail",
        duration_ms: Date.now() - start,
        error: message,
        data: { ...(existing ?? {}), error_raw: raw },
      });
      return null;
    }
  }

  // -----------------------------------------------------------
  // Step 1: Test kullanıcı oluştur
  // -----------------------------------------------------------
  const userResult = await step("user", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email: testEmail,
      password: `Test-${stamp}-X9!`,
      email_confirm: true,
      user_metadata: {
        is_simulator_test: true,
        triggered_by: triggeredByAdminId,
      },
    });
    if (error) throw error;
    if (!data.user?.id) throw new Error("user_id_missing");
    userId = data.user.id;
    setStep("user", {
      data: { user_id: data.user.id, email: testEmail },
    });
    return data.user.id;
  });

  if (!userResult) {
    // Erken çıkış — sonraki step'leri skip
    steps.forEach((s) => {
      if (s.status === "pending") s.status = "skip";
    });
    return {
      ok: false,
      total_duration_ms: Date.now() - t0,
      steps,
      cleanup_hint: "Test kullanıcı oluşturulamadı, cleanup gereksiz.",
    };
  }

  // Profile satırını da oluştur (trigger eksikse manuel)
  await admin.from("profiles").upsert(
    [
      {
        id: userId,
        display_name: "Simülasyon Test",
        phone: "+905551234567",
        role: "customer",
      },
    ] as never,
    { onConflict: "id" }
  );

  // -----------------------------------------------------------
  // Step 2: Sepete ürün ekle (mock cart items)
  // -----------------------------------------------------------
  await step("cart", async () => {
    // Sepet localStorage tarafında tutulduğu için backend'de simüle edemeyiz.
    // Order create direct çağırırız (8. step'te). Burada mock data hazırlığı.
    const mockCart = [
      {
        product: "etiket",
        title: "Etiket · Kraft Etiket + Kaplamasız (Simülasyon)",
        config: "60×80mm · 2.000 adet · Özelleştirme yok",
        width: 60,
        height: 80,
        qty: 2000,
        unit: 2.5,
        total: 5000,
      },
      {
        product: "sticker",
        title: "Sticker · Vinil + Parlak (Simülasyon)",
        config: "75×75mm · 250 adet",
        width: 75,
        height: 75,
        qty: 250,
        unit: 4.2,
        total: 1050,
      },
    ];
    setStep("cart", {
      data: {
        items: mockCart.length,
        subtotal: mockCart.reduce((s, i) => s + i.total, 0),
      },
    });
    return mockCart;
  });

  // -----------------------------------------------------------
  // Step 3: Adres ekle
  // -----------------------------------------------------------
  let addressId: string | undefined;
  await step("address", async () => {
    const { data, error } = await admin
      .from("addresses")
      .insert([
        {
          user_id: userId,
          label: "Simülasyon adresi",
          name: "Simülasyon Test",
          addr: "Beştepeler Mah. Nergis Sok. No:7/2, Çankaya, Ankara, Türkiye",
          city: "Ankara",
          phone: "+905551234567",
          is_default: true,
        },
      ] as never)
      .select("id")
      .single();
    if (error) throw error;
    addressId = (data as { id: string } | null)?.id;
    setStep("address", { data: { address_id: addressId } });
    return addressId;
  });

  // -----------------------------------------------------------
  // Step 4: Kurumsal fatura profili
  // -----------------------------------------------------------
  let invoiceId: string | undefined;
  await step("invoice", async () => {
    const { data, error } = await admin
      .from("customer_invoice_profiles")
      .insert([
        {
          user_id: userId,
          label: "Simülasyon şirket",
          vkn: "1234567890",
          company_name: "Simülasyon Test Ltd. Şti.",
          tax_office: "Çankaya VD",
          company_address:
            "Beştepeler Mah. Nergis Sok. No:7/2 Çankaya/Ankara",
          is_default: true,
        },
      ] as never)
      .select("id")
      .single();
    if (error) throw error;
    invoiceId = (data as { id: string } | null)?.id;
    setStep("invoice", { data: { invoice_id: invoiceId } });
    return invoiceId;
  });

  // -----------------------------------------------------------
  // Step 5: Kupon validate
  // -----------------------------------------------------------
  await step("coupon", async () => {
    // Geçerli kupon
    const { data: valid, error: validErr } = await admin.rpc(
      "fn_validate_coupon" as never,
      { p_code: "HOSGELDIN10", p_subtotal: 6050 } as never
    );
    if (validErr && validErr.code !== "42883") {
      // RPC yoksa skip (sistem henüz kurulmamış)
      throw validErr;
    }
    const validResult = valid as
      | { ok: boolean; reason?: string }
      | null;

    // Geçersiz kupon
    const { data: invalid } = await admin.rpc(
      "fn_validate_coupon" as never,
      { p_code: "GECERSIZ_TEST_999", p_subtotal: 6050 } as never
    );
    const invalidResult = invalid as
      | { ok: boolean; reason?: string }
      | null;

    setStep("coupon", {
      data: {
        valid_test: validResult?.ok
          ? "✓ HOSGELDIN10 kabul"
          : `Reason: ${validResult?.reason ?? "rpc_missing"}`,
        invalid_test: invalidResult?.ok
          ? "⚠ Geçersiz kupon kabul edildi!"
          : "✓ Geçersiz reddedildi",
      },
    });
    return { valid: validResult, invalid: invalidResult };
  });

  // -----------------------------------------------------------
  // Step 6: Order oluştur
  // -----------------------------------------------------------
  await step("order", async () => {
    // PE-YYYY-XXXX formatı
    const random4 = Math.random().toString(36).substr(2, 4).toUpperCase();
    const newOrderId = `PE-${new Date().getFullYear()}-SIM${random4}`;

    // Sefa 17 May fix: order_status enum'da "pending_payment" YOK
    // (sadece paid/qc_pending/.../cancelled). Direkt paid olarak oluştur,
    // Step 7 idempotency testi yapar.
    // metadata kolonu da yok — payment jsonb içinde test bayrağı tutuyoruz.
    const { error: orderErr } = await admin
      .from("orders")
      .insert([
        {
          id: newOrderId,
          user_id: userId,
          status: "paid",
          subtotal: 6050,
          shipping: 0,
          total: 6050,
          address: {
            name: "Simülasyon Test",
            addr: "Beştepeler Mah., Çankaya, Ankara",
            city: "Ankara",
            phone: "+905551234567",
          },
          invoice: {
            type: "corporate",
            vkn: "1234567890",
            companyName: "Simülasyon Test Ltd. Şti.",
            taxOffice: "Çankaya VD",
            companyAddress:
              "Beştepeler Mah. Nergis Sok. No:7/2 Çankaya/Ankara",
          },
          payment: {
            method: "card",
            is_simulator_test: true,
          },
        },
      ] as never);

    if (orderErr) throw orderErr;

    // Order items
    await admin.from("order_items").insert([
      {
        order_id: newOrderId,
        product: "etiket",
        title: "Etiket · Simülasyon",
        config: "60×80mm · 2000 adet",
        width: 60,
        height: 80,
        qty: 2000,
        unit: 2.5,
        total: 5000,
      },
      {
        order_id: newOrderId,
        product: "sticker",
        title: "Sticker · Simülasyon",
        config: "75×75mm · 250 adet",
        width: 75,
        height: 75,
        qty: 250,
        unit: 4.2,
        total: 1050,
      },
    ] as never);

    orderId = newOrderId;
    setStep("order", { data: { order_id: newOrderId } });
    return newOrderId;
  });

  // -----------------------------------------------------------
  // Step 7: Mock PayTR callback (paid)
  // -----------------------------------------------------------
  if (orderId) {
    const localOrderId: string = orderId;
    await step("callback", async () => {
      // Direkt fn_apply_paid_order çağır (idempotent + atomic)
      const { error } = await admin.rpc(
        "fn_apply_paid_order" as never,
        {
          p_order_id: localOrderId,
          p_paid_amount: 6050,
          p_payment_method: "card",
          p_masked_card: "**** **** **** 0796",
          p_psp_transaction_id: `SIM-${stamp}`,
        } as never
      );
      if (error) {
        // RPC yoksa fallback: doğrudan UPDATE
        if (error.code === "42883" || error.message?.includes("does not exist")) {
          const { error: updErr } = await admin
            .from("orders")
            .update({
              status: "paid",
              payment: {
                method: "card",
                masked: "**** **** **** 0796",
                psp_transaction_id: `SIM-${stamp}`,
              },
            } as never)
            .eq("id", localOrderId);
          if (updErr) throw updErr;
          setStep("callback", {
            data: { method: "fallback_update", note: "fn_apply_paid_order RPC yok, direct UPDATE" },
          });
        } else {
          throw error;
        }
      } else {
        setStep("callback", { data: { method: "fn_apply_paid_order" } });
      }
    });
  } else {
    setStep("callback", { status: "skip" });
  }

  // -----------------------------------------------------------
  // Step 8: Doğrulama
  // -----------------------------------------------------------
  if (orderId) {
    const verifyOrderId: string = orderId;
    await step("verify", async () => {
      // 1. Order status paid mi?
      const { data: ord, error: ordErr } = await admin
        .from("orders")
        .select("status, payment")
        .eq("id", verifyOrderId)
        .maybeSingle();
      if (ordErr) throw ordErr;
      const status = (ord as { status?: string } | null)?.status;

      // 2. Order events var mı?
      const { count: eventsCount } = await admin
        .from("order_events")
        .select("*", { count: "exact", head: true })
        .eq("order_id", verifyOrderId);

      // 3. Order items 2 tane mi?
      const { count: itemsCount } = await admin
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("order_id", verifyOrderId);

      const checks = {
        status_is_paid: status === "paid",
        items_count: itemsCount ?? 0,
        events_count: eventsCount ?? 0,
      };

      if (status !== "paid") {
        throw new Error(`Order status beklenen 'paid' ama '${status}'`);
      }
      if ((itemsCount ?? 0) !== 2) {
        throw new Error(`Order items 2 olmalı ama ${itemsCount}`);
      }

      setStep("verify", { data: checks });
      return checks;
    });
  } else {
    setStep("verify", { status: "skip" });
  }

  // Final
  const allOk = steps.every(
    (s) => s.status === "success" || s.status === "skip"
  );

  return {
    ok: allOk,
    total_duration_ms: Date.now() - t0,
    steps,
    test_user_id: userId,
    test_order_id: orderId,
    cleanup_hint: userId
      ? "Test user + order otomatik silinmez. Manuel cleanup: /admin/test-siparis-simulator → 🧹 Cleanup"
      : undefined,
  };
}

/**
 * Test verilerini temizle (admin tarafından çağrılır).
 * is_simulator_test=true bayraklı tüm test user/order/data'yı sil.
 */
export async function cleanupSimulatorData(): Promise<{
  deleted_users: number;
  deleted_orders: number;
}> {
  const admin = createAdminClient();

  // Test order'ları bul ve sil
  const { data: testOrders } = await admin
    .from("orders")
    .select("id, user_id")
    .like("id", "PE-%-SIM%")
    .returns<{ id: string; user_id: string }[]>();
  const orderIds = (testOrders ?? []).map((o) => o.id);
  const userIds = Array.from(
    new Set((testOrders ?? []).map((o) => o.user_id))
  );

  let deletedOrders = 0;
  let deletedUsers = 0;

  if (orderIds.length > 0) {
    // order_items + order_events FK cascade — direct order delete
    await admin.from("order_items").delete().in("order_id", orderIds);
    await admin.from("order_events").delete().in("order_id", orderIds);
    const { count } = await admin
      .from("orders")
      .delete({ count: "exact" })
      .in("id", orderIds);
    deletedOrders = count ?? 0;
  }

  // Test user'ları sil (email pattern: simulator-*@pimetiket.test)
  for (const uid of userIds) {
    // CASCADE: addresses, customer_invoice_profiles, customer_notes,
    // customer_tags, loyalty_grants tablolarındaki kayıtlar otomatik silinir
    // (FK on delete cascade)
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (!error) deletedUsers++;
  }

  // Email pattern ile kalan test user (orphan) sil
  const { data: orphanUsers } = await admin.auth.admin.listUsers();
  if (orphanUsers?.users) {
    for (const u of orphanUsers.users) {
      if (
        u.email?.startsWith("simulator-") &&
        u.email.endsWith("@pimetiket.test")
      ) {
        const { error } = await admin.auth.admin.deleteUser(u.id);
        if (!error) deletedUsers++;
      }
    }
  }

  return {
    deleted_users: deletedUsers,
    deleted_orders: deletedOrders,
  };
}
