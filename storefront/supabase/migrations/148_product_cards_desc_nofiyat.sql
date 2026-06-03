-- Migration 148: Etiket Sayfası kartlarından fiyat vurgusunu kaldır (özellik odaklı, tek satır)
update public.product_cards set desc_tr = 'Tek tabakada çok yuvarlak etiket'   where product_type='sticker' and key='yuvarlak-sayfa';
update public.product_cards set desc_tr = 'Tek tabakada çok kare etiket'       where product_type='sticker' and key='kare-sayfa';
update public.product_cards set desc_tr = 'Tek tabakada çok dikdörtgen etiket' where product_type='sticker' and key='dikdortgen-sayfa';
