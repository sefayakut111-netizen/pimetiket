-- Revize seed — admin@pimetiket.com (veya en son admin) user'ına bağlar
do $$
declare
  v_user_id uuid;
  v_user_email text;
  v_order_id text := 'PE-2026-TEST5';
  v_item_a uuid := gen_random_uuid();
  v_item_b uuid := gen_random_uuid();
  v_item_c uuid := gen_random_uuid();
  v_item_d uuid := gen_random_uuid();
  v_item_e uuid := gen_random_uuid();
  v_df_a uuid := gen_random_uuid();
  v_df_b1 uuid := gen_random_uuid();
  v_df_b2 uuid := gen_random_uuid();
  v_df_b3 uuid := gen_random_uuid();
  v_df_c uuid := gen_random_uuid();
  v_df_d uuid := gen_random_uuid();
  v_df_e uuid := gen_random_uuid();
begin
  select p.id, u.email into v_user_id, v_user_email
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.role = 'admin'
  order by u.last_sign_in_at desc nulls last
  limit 1;

  if v_user_id is null then
    select id, email into v_user_id, v_user_email from auth.users order by created_at desc limit 1;
  end if;
  if v_user_id is null then
    raise exception 'auth.users bos';
  end if;

  raise notice 'User: % (%)', v_user_email, v_user_id;

  delete from cutline_designs where order_id = v_order_id;
  delete from design_files where order_id = v_order_id;
  delete from order_events where order_id = v_order_id;
  delete from order_items where order_id = v_order_id;
  delete from orders where id = v_order_id;

  insert into orders (id, user_id, status, subtotal, shipping, total, address, invoice, payment, created_at)
  values (v_order_id, v_user_id, 'proof_pending', 8500.00, 0, 8500.00,
    jsonb_build_object('name','Test Musteri','addr','Test Mah.','city','Istanbul','phone','+905551112233'),
    jsonb_build_object('type','individual'),
    jsonb_build_object('method','card','is_test_seed',true,'paid_at', (now() - interval '90 minutes')::text),
    now() - interval '2 hours');

  insert into order_items (id, order_id, product, title, config, width, height, qty, unit, total, meta, proof_status) values
  (v_item_a, v_order_id, 'sticker','Sticker - Bal Etiketi','Daire 60x60mm',60,60,500,2.40,1200.00,
   jsonb_build_object('material','vinil','shape','circle','designCount',1),'pending'),
  (v_item_b, v_order_id, 'etiket','Etiket - Kozmetik (3 tasarim)','Dikdortgen 50x80mm',50,80,3000,1.20,3600.00,
   jsonb_build_object('material','transparan','shape','rect','designCount',3),'pending'),
  (v_item_c, v_order_id, 'sticker','Sticker - Marka Logo','Kare 45x45mm',45,45,300,5.50,1650.00,
   jsonb_build_object('material','holo','shape','square','designCount',1),'viewed'),
  (v_item_d, v_order_id, 'etiket','Etiket - Premium Sarap','Oval 70x100mm',70,100,500,2.80,1400.00,
   jsonb_build_object('material','simli','shape','oval','designCount',1),'edited'),
  (v_item_e, v_order_id, 'sticker','Sticker - El Yapimi Sabun','Ozel 80x60mm',80,60,250,2.60,650.00,
   jsonb_build_object('material','vinil','shape','ozel','designCount',1),'approved');

  update order_items set proof_approved_at = now() - interval '30 minutes' where id = v_item_e;

  insert into design_files (id, order_id, order_item_id, user_id, storage_path, original_name, size_bytes, mime_type, version, status) values
  (v_df_a, v_order_id, v_item_a, v_user_id, v_order_id||'/'||v_df_a||'.png', 'bal-etiketi.png', 512000, 'image/png', 1, 'qc_passed'),
  (v_df_b1, v_order_id, v_item_b, v_user_id, v_order_id||'/'||v_df_b1||'.pdf','kozmetik-krem.pdf',1200000,'application/pdf',1,'qc_passed'),
  (v_df_b2, v_order_id, v_item_b, v_user_id, v_order_id||'/'||v_df_b2||'.pdf','kozmetik-sampuan.pdf',1100000,'application/pdf',2,'qc_passed'),
  (v_df_b3, v_order_id, v_item_b, v_user_id, v_order_id||'/'||v_df_b3||'.pdf','kozmetik-tonik.pdf',980000,'application/pdf',3,'qc_passed'),
  (v_df_c, v_order_id, v_item_c, v_user_id, v_order_id||'/'||v_df_c||'.png', 'marka-logo.png', 380000, 'image/png', 1, 'qc_passed'),
  (v_df_d, v_order_id, v_item_d, v_user_id, v_order_id||'/'||v_df_d||'.ai',  'premium-sarap.ai', 2400000,'application/illustrator',1,'qc_passed'),
  (v_df_e, v_order_id, v_item_e, v_user_id, v_order_id||'/'||v_df_e||'.psd', 'el-yapimi.psd', 3100000,'image/vnd.adobe.photoshop',1,'approved');

  insert into cutline_designs (order_id, order_item_id, design_file_id, user_id, svg_url, preview_png_url, source, mode, offset_mm, smoothness, dpi, width_mm, height_mm, pim_feedback, pim_severity, status, material_type, white_plan_mode, white_plan_path_count, has_custom_white_plan, tier, detected_cut_contour_names, created_at)
  values (v_order_id, v_item_c, v_df_c, v_user_id,
    'customer-cutlines/'||v_order_id||'/'||v_item_c||'/auto.svg', null,
    'raster','contour',2.0,0,300,45.0,45.0,
    'Yuksek kaliteli holografik tasarim. Bicak temiz uretildi, baskiya hazir.',
    'ok','auto_generated','holographic','smart',12,false,'standard','[]'::jsonb,
    now() - interval '15 minutes');

  insert into cutline_designs (order_id, order_item_id, design_file_id, user_id, svg_url, preview_png_url, source, mode, offset_mm, smoothness, dpi, width_mm, height_mm, pim_feedback, pim_severity, status, material_type, white_plan_mode, white_plan_path_count, has_custom_white_plan, tier, detected_cut_contour_names, created_at)
  values (v_order_id, v_item_d, v_df_d, v_user_id,
    'customer-cutlines/'||v_order_id||'/'||v_item_d||'/draft.svg', null,
    'vector-with-cutline','contour',3.0,5,300,70.0,100.0,
    'Vektorel dosyada CutContour spot color tespit edildi.',
    'ok','draft','metallic','full',8,true,'pro','["CutContour","Diecut"]'::jsonb,
    now() - interval '20 minutes');

  insert into cutline_designs (order_id, order_item_id, design_file_id, user_id, svg_url, preview_png_url, source, mode, offset_mm, smoothness, dpi, width_mm, height_mm, pim_feedback, pim_severity, status, approved_at, material_type, white_plan_mode, white_plan_path_count, has_custom_white_plan, tier, detected_cut_contour_names, created_at)
  values (v_order_id, v_item_e, v_df_e, v_user_id,
    'customer-cutlines/'||v_order_id||'/'||v_item_e||'/approved.svg', null,
    'psd','contour',2.5,10,300,80.0,60.0,
    'PSD katmanli dosya - siluet tespit + 2.5mm offset.',
    'ok','approved', now() - interval '25 minutes',
    'paper','off',0,false,'standard','[]'::jsonb,
    now() - interval '45 minutes');

  raise notice 'OK % user=% (%)', v_order_id, v_user_email, v_user_id;
end $$;
