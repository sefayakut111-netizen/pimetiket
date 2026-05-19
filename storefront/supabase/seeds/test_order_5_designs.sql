-- ============================================================
-- TEST SEED — 5 ürünlü çeşitli etiket siparişi
-- ============================================================
-- Sefa 19 May v68 (E2E test için):
-- D + A + B + C + E öbeklerinin tüm senaryolarını tek bir siparişte test eder.
--
-- 5 ürün, her biri farklı bir test sahnesi kapsar:
--   1. Sticker dairesel · kraft kağıt · cutline YOK
--      → Background auto-cutline (B1) tetiklenir, hidden iframe POC açılır.
--   2. Etiket dikdörtgen · şeffaf folyo · 3 TASARIM · hepsi cutline YOK
--      → Multi-design picker (C2) görünür, 3 ayrı iframe sırayla çalışır.
--   3. Sticker kare · holografik · cutline 'auto_generated'
--      → Preview hazır, müşteri direkt görür.
--   4. Etiket oval · metalize · cutline 'draft' (müşteri zaten düzenlemiş)
--      → "Düzenlendi" rozeti, "Bu ürünü onayla" butonu aktif.
--   5. Sticker özel kesim · kraft kağıt · cutline 'approved'
--      → "Onaylandı ✓" rozeti, no-op.
--
-- ============================================================
-- KULLANIM:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Bu dosyanın TAMAMINI yapıştır
--   3. Aşağıdaki user_id'yi kendi auth.users id'nle değiştir VEYA
--      "sefayakut111@gmail.com" satırını uyumlu bırak (otomatik bulur).
--   4. Run → /onay/PE-2026-TEST5 sayfasını aç
--
-- ROLLBACK:
--   delete from orders where id = 'PE-2026-TEST5';
--   (cascade ile order_items, design_files, cutline_designs hepsi silinir)
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_order_id text := 'PE-2026-TEST5';
  v_item_a uuid := gen_random_uuid();  -- Cutline YOK (auto test)
  v_item_b uuid := gen_random_uuid();  -- 3 tasarımlı multi-design
  v_item_c uuid := gen_random_uuid();  -- Cutline auto_generated
  v_item_d uuid := gen_random_uuid();  -- Cutline draft
  v_item_e uuid := gen_random_uuid();  -- Cutline approved
  v_df_a uuid := gen_random_uuid();
  v_df_b1 uuid := gen_random_uuid();
  v_df_b2 uuid := gen_random_uuid();
  v_df_b3 uuid := gen_random_uuid();
  v_df_c uuid := gen_random_uuid();
  v_df_d uuid := gen_random_uuid();
  v_df_e uuid := gen_random_uuid();
begin
  -- ----------------------------------------------------------
  -- USER — Sefa'nın hesabı (veya değiştir)
  -- ----------------------------------------------------------
  select id into v_user_id from auth.users where email = 'sefayakut111@gmail.com' limit 1;
  if v_user_id is null then
    raise exception 'auth.users içinde sefayakut111@gmail.com bulunamadı. Email''i değiştir veya önce kayıt ol.';
  end if;

  -- ----------------------------------------------------------
  -- ORDER — temizle, yeniden oluştur (idempotent)
  -- ----------------------------------------------------------
  delete from orders where id = v_order_id;

  insert into orders (
    id, user_id, status, subtotal, shipping, total,
    address, invoice, payment, created_at, paid_at
  ) values (
    v_order_id, v_user_id,
    'proof_pending',  -- direkt proof_pending — müşteri hemen görür
    8500.00, 0, 8500.00,
    jsonb_build_object(
      'name', 'Test Müşteri',
      'addr', 'Test Mah., Test Sok. No:5',
      'city', 'İstanbul',
      'phone', '+905551112233'
    ),
    jsonb_build_object('type', 'individual'),
    jsonb_build_object('method', 'card', 'is_test_seed', true),
    now() - interval '2 hours',
    now() - interval '90 minutes'
  );

  -- ----------------------------------------------------------
  -- ORDER ITEMS — 5 farklı ürün
  -- ----------------------------------------------------------
  insert into order_items (id, order_id, product, title, config, width, height, qty, unit, total, meta, proof_status) values

  -- 1. Sticker dairesel — kraft kağıt — CUTLINE YOK (auto test)
  (v_item_a, v_order_id, 'sticker',
   'Sticker · Bal Etiketi (dairesel)',
   'Daire · 60×60mm · Die-cut',
   60, 60, 500, 2.40, 1200.00,
   jsonb_build_object('material', 'vinil', 'shape', 'circle', 'designCount', 1),
   'pending'),

  -- 2. Etiket dikdörtgen — ŞEFFAF FOLYO — 3 TASARIM (multi-design)
  (v_item_b, v_order_id, 'etiket',
   'Etiket · Kozmetik Serisi (3 tasarım)',
   'Dikdörtgen · 50×80mm · Tabaka',
   50, 80, 3000, 1.20, 3600.00,
   jsonb_build_object('material', 'transparan', 'shape', 'rect', 'designCount', 3),
   'pending'),

  -- 3. Sticker kare — HOLOGRAFIK — cutline auto_generated
  (v_item_c, v_order_id, 'sticker',
   'Sticker · Marka Logo (holografik)',
   'Kare · 45×45mm · Die-cut',
   45, 45, 300, 5.50, 1650.00,
   jsonb_build_object('material', 'holo', 'shape', 'square', 'designCount', 1),
   'viewed'),

  -- 4. Etiket oval — METALIZE — cutline draft (müşteri düzenlemiş)
  (v_item_d, v_order_id, 'etiket',
   'Etiket · Premium Şarap (oval)',
   'Oval · 70×100mm · Die-cut',
   70, 100, 500, 2.80, 1400.00,
   jsonb_build_object('material', 'simli', 'shape', 'oval', 'designCount', 1),
   'edited'),

  -- 5. Sticker özel kesim — KRAFT — cutline approved
  (v_item_e, v_order_id, 'sticker',
   'Sticker · El Yapımı Sabun (özel kesim)',
   'Özel · 80×60mm · Die-cut',
   80, 60, 250, 2.60, 650.00,
   jsonb_build_object('material', 'vinil', 'shape', 'ozel', 'designCount', 1),
   'approved');

  -- Item E için onay zamanı
  update order_items
    set proof_approved_at = now() - interval '30 minutes'
    where id = v_item_e;

  -- ----------------------------------------------------------
  -- DESIGN FILES — her item için tasarım dosyaları
  -- Storage path'ler fake (gerçek dosya yok) — UI metadata gösterimi yeterli.
  -- ----------------------------------------------------------

  -- Item A: 1 tasarım (cutline yok → auto akışı tetiklenecek)
  insert into design_files (id, order_id, order_item_id, user_id, storage_path, original_name, size_bytes, mime_type, version, status) values
  (v_df_a, v_order_id, v_item_a, v_user_id,
   v_order_id || '/' || v_df_a || '.png', 'bal-etiketi-v1.png', 512000, 'image/png', 1, 'qc_passed');

  -- Item B: 3 tasarım (multi-design)
  insert into design_files (id, order_id, order_item_id, user_id, storage_path, original_name, size_bytes, mime_type, version, status) values
  (v_df_b1, v_order_id, v_item_b, v_user_id,
   v_order_id || '/' || v_df_b1 || '.pdf', 'kozmetik-krem.pdf', 1200000, 'application/pdf', 1, 'qc_passed'),
  (v_df_b2, v_order_id, v_item_b, v_user_id,
   v_order_id || '/' || v_df_b2 || '.pdf', 'kozmetik-sampuan.pdf', 1100000, 'application/pdf', 1, 'qc_passed'),
  (v_df_b3, v_order_id, v_item_b, v_user_id,
   v_order_id || '/' || v_df_b3 || '.pdf', 'kozmetik-tonik.pdf', 980000, 'application/pdf', 1, 'qc_passed');

  -- Item C, D, E: 1 tasarım her biri
  insert into design_files (id, order_id, order_item_id, user_id, storage_path, original_name, size_bytes, mime_type, version, status) values
  (v_df_c, v_order_id, v_item_c, v_user_id,
   v_order_id || '/' || v_df_c || '.png', 'marka-logo.png', 380000, 'image/png', 1, 'qc_passed'),
  (v_df_d, v_order_id, v_item_d, v_user_id,
   v_order_id || '/' || v_df_d || '.ai', 'premium-sarap.ai', 2400000, 'application/illustrator', 1, 'qc_passed'),
  (v_df_e, v_order_id, v_item_e, v_user_id,
   v_order_id || '/' || v_df_e || '.psd', 'el-yapimi-sabun.psd', 3100000, 'image/vnd.adobe.photoshop', 1, 'approved');

  -- ----------------------------------------------------------
  -- CUTLINE DESIGNS — item C/D/E için var, A/B için YOK
  -- ----------------------------------------------------------

  -- Item C: auto_generated (POC arka planda üretmiş, müşteri henüz görmedi)
  insert into cutline_designs (
    order_id, order_item_id, design_file_id, user_id,
    svg_url, preview_png_url, source, mode,
    offset_mm, smoothness, dpi, width_mm, height_mm,
    pim_feedback, pim_severity, status,
    material_type, white_plan_mode, white_plan_path_count,
    has_custom_white_plan, tier, detected_cut_contour_names,
    created_at
  ) values (
    v_order_id, v_item_c, v_df_c, v_user_id,
    'customer-cutlines/' || v_order_id || '/' || v_item_c || '/auto.svg',
    null,  -- preview signed URL endpoint test ederken null → placeholder gösterir
    'raster', 'contour',
    2.0, 0, 300, 45.0, 45.0,
    'Yüksek kaliteli holografik tasarım. Bıçak temiz üretildi, baskıya hazır.',
    'ok', 'auto_generated',
    'holographic', 'smart', 12,
    false, 'standard', '[]'::jsonb,
    now() - interval '15 minutes'
  );

  -- Item D: draft (müşteri düzenlemiş — manuel kaydetmiş)
  insert into cutline_designs (
    order_id, order_item_id, design_file_id, user_id,
    svg_url, preview_png_url, source, mode,
    offset_mm, smoothness, dpi, width_mm, height_mm,
    pim_feedback, pim_severity, status,
    material_type, white_plan_mode, white_plan_path_count,
    has_custom_white_plan, tier, detected_cut_contour_names,
    created_at
  ) values (
    v_order_id, v_item_d, v_df_d, v_user_id,
    'customer-cutlines/' || v_order_id || '/' || v_item_d || '/draft.svg',
    null,
    'vector-with-cutline', 'contour',
    3.0, 5, 300, 70.0, 100.0,
    'Vektörel dosyada CutContour spot color tespit edildi — tasarımcının çizdiği bıçağı koruyoruz.',
    'ok', 'draft',
    'metallic', 'full', 8,
    true, 'pro', '["CutContour", "Diecut"]'::jsonb,
    now() - interval '20 minutes'
  );

  -- Item E: approved (zaten onaylanmış)
  insert into cutline_designs (
    order_id, order_item_id, design_file_id, user_id,
    svg_url, preview_png_url, source, mode,
    offset_mm, smoothness, dpi, width_mm, height_mm,
    pim_feedback, pim_severity, status, approved_at,
    material_type, white_plan_mode, white_plan_path_count,
    has_custom_white_plan, tier, detected_cut_contour_names,
    created_at
  ) values (
    v_order_id, v_item_e, v_df_e, v_user_id,
    'customer-cutlines/' || v_order_id || '/' || v_item_e || '/approved.svg',
    null,
    'psd', 'contour',
    2.5, 10, 300, 80.0, 60.0,
    'PSD katmanlı dosya — silüet tespit + 2.5mm offset, tertemiz çıktı.',
    'ok', 'approved', now() - interval '25 minutes',
    'paper', 'off', 0,
    false, 'standard', '[]'::jsonb,
    now() - interval '45 minutes'
  );

  -- ----------------------------------------------------------
  -- ORDER EVENTS — audit log
  -- ----------------------------------------------------------
  insert into order_events (order_id, event_type, status_after, actor_id, actor_role, summary, detail) values
  (v_order_id, 'order_created', 'paid', v_user_id, 'customer',
   'Test sipariş oluşturuldu (5 ürün)',
   jsonb_build_object('total', 8500.00, 'item_count', 5)),
  (v_order_id, 'proof_auto_generated', 'proof_pending', v_user_id, 'system',
   'Otomatik bıçak üretildi: Marka Logo',
   jsonb_build_object('item_id', v_item_c, 'tier', 'standard', 'auto', true)),
  (v_order_id, 'proof_item_edited', 'proof_pending', v_user_id, 'customer',
   'Müşteri bıçak çizgisini düzenledi: Premium Şarap',
   jsonb_build_object('item_id', v_item_d, 'mode', 'contour', 'tier', 'pro')),
  (v_order_id, 'proof_item_approved', 'proof_pending', v_user_id, 'customer',
   'Müşteri item onayladı: El Yapımı Sabun',
   jsonb_build_object('item_id', v_item_e));

  -- ----------------------------------------------------------
  raise notice '✓ Test sipariş oluşturuldu: %', v_order_id;
  raise notice '  → /onay/% sayfasını ziyaret et', v_order_id;
  raise notice '  Item A (auto-cutline test):  %', v_item_a;
  raise notice '  Item B (3 tasarım multi):    %', v_item_b;
  raise notice '  Item C (auto_generated):     %', v_item_c;
  raise notice '  Item D (draft):              %', v_item_d;
  raise notice '  Item E (approved):           %', v_item_e;
end $$;
