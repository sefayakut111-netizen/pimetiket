-- Sefa 17 May v34: 5 sahte yorumu güncelle (cümle düzeltmeleri)
-- WHERE filtreleri eski cümlenin unique parçasından eşleşir → idempotent.

-- 1) Cam şişe → Firmamız zeytinyağı
update public.reviews
set body = 'Firmamız için zeytinyağı şişelerinde kullanılmak üzere etiket bastırdık, gayet başarılıydı. Yeni sezonda da inşallah görüşürüz.'
where body like '%Cam şişede zeytinyağı için şeffaf etiket%';

-- 2) Laptop kapağı → Şirket arkadaşları hologram
update public.reviews
set body = 'Şirkette çalışan arkadaşlarıma dağıtmak için eğlenceli hologram sticker''lar yaptırdım. 10 numara :)'
where body like '%Laptop kapağına yapıştırmak için 50 adet%';

-- 3) Doğum günü holografik
update public.reviews
set body = 'Doğum günü için holografik sticker bastırdık. Çocuklar bayıldı — ışıkta renkleri dönüyor. WhatsApp destek de çok hızlıydı.'
where body like '%holografik sticker. Çocuklar çok beğendi%';

-- 4) Kargo paketleri → Kargo ağzı
update public.reviews
set body = 'Kargolarımın ağzını kapatmak için baskılı şeffaf sticker yaptırdım. Malzeme de baskı da kaliteli, ama üretim süresini biraz daha kısaltalım :)'
where body like '%Kargo paketlerimi mühürlemek için yuvarlak şeffaf%';

-- 5) Krem şişe soft touch → Krem kavanoz
update public.reviews
set body = 'Krem kavanozumuz için etiket yaptırdık, gayet memnun kaldık. Kalite ve hizmette sorun yoktu. Teşekkürler.'
where body like '%Krem şişelerimiz için soft touch%';

-- Doğrulama
select display_name, rating, left(body, 80) as kisa
from public.reviews
where status = 'published' and show_on_homepage = true
order by created_at desc;
