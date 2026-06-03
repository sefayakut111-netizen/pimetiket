-- Migration 147: Sticker ürün kartı açıklamalarını tek satıra kısalt (grid hizalama)
update public.product_cards set desc_tr = 'Saydam zemin, arka plan görünür'   where product_type='sticker' and key='clear';
update public.product_cards set desc_tr = 'Gökkuşağı yansımalı, premium'       where product_type='sticker' and key='holo';
update public.product_cards set desc_tr = 'Kendi kartında, tek tek soyulur'    where product_type='sticker' and key='kartli';
update public.product_cards set desc_tr = 'Tek tabakada çok adet'              where product_type='sticker' and key='sheet';
update public.product_cards set desc_tr = 'Yuvarlak, sticker fiyatına'         where product_type='sticker' and key='yuvarlak-sayfa';
update public.product_cards set desc_tr = 'Kare, sticker fiyatına'             where product_type='sticker' and key='kare-sayfa';
update public.product_cards set desc_tr = 'Dikdörtgen, sticker fiyatına'       where product_type='sticker' and key='dikdortgen-sayfa';
update public.product_cards set desc_tr = 'Gökkuşağı yansımalı tabaka'         where product_type='sticker' and key='hologram-sayfa';
update public.product_cards set desc_tr = 'Parıltılı dokulu tabaka'            where product_type='sticker' and key='simli-sayfa';
