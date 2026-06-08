# Pim Etiket — E-posta Metinleri (toplu)

> Cowork (Claude) yazıyor, gruplar onaylandıkça buraya birikir. Sefa topluca alıp uygulayacak.
> Kurallar: `EPOSTA-YAZIM-BRIEF.md`. Format: Tür · Konu · Preheader · Gövde · CTA+rota · Görsel · Tetik · Not.
> Durum: ✅ onaylandı · ✍️ yazıldı (onay bekliyor)

---

## GRUP 1 — 🔴 Auth (en kritik, şu an generic default)

### 21 · E-posta Onay  ✍️
- **Tür:** Transactional · **Tetik:** Supabase Auth "Confirm signup" · **Görsel:** Yok
- **Konu:** E-posta adresini doğrula
- **Preheader:** Hesabını aktifleştirmek için tek bir adım kaldı.
- **Gövde:**
  > Merhaba,
  >
  > Pim Etiket hesabın için kaydını aldık. Hesabını kullanmaya başlamak için e-posta adresini doğrulaman yeterli.
  >
  > **[E-postamı doğrula]**
  >
  > Buton çalışmazsa bu bağlantıyı tarayıcına yapıştırabilirsin: `{{ .ConfirmationURL }}`
  >
  > Güvenliğin için bu bağlantı 24 saat içinde geçerliliğini yitirir. Bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin — hesabın güvende.
- **CTA:** "E-postamı doğrula" → `{{ .ConfirmationURL }}`
- **Not:** Supabase şablonu (dashboard'da özelleştirilecek), değişken `{{ .ConfirmationURL }}`.

### 22 · Şifre Sıfırlama  ✍️
- **Tür:** Transactional · **Tetik:** Supabase Auth "Reset password" · **Görsel:** Yok
- **Konu:** Şifre sıfırlama isteğin
- **Preheader:** Yeni şifreni belirlemen için güvenli bağlantı.
- **Gövde:**
  > Merhaba,
  >
  > Pim Etiket hesabının şifresini sıfırlamak için bir istek aldık. Yeni şifreni belirlemek için:
  >
  > **[Şifremi sıfırla]**
  >
  > Buton çalışmazsa: `{{ .ConfirmationURL }}`
  >
  > Bu bağlantı güvenliğin için 60 dakika içinde geçerliliğini yitirir ve yalnız bir kez kullanılabilir. Bu isteği sen yapmadıysan endişelenme — şifren değişmez, bu e-postayı görmezden gelebilirsin. Yine de hesabından şüpheleniyorsan bize ulaş.
- **CTA:** "Şifremi sıfırla" → `{{ .ConfirmationURL }}` · yardım: `https://pimetiket.com/destek`
- **Not:** Supabase şablonu, değişken `{{ .ConfirmationURL }}`.

### 23 · Üyelik Hoşgeldin  ✍️
- **Tür:** Transactional (pazarlama YOK — bülten ayrı) · **Tetik:** E-posta onaylanınca (Resend) · **Görsel:** İsteğe bağlı küçük hoşgeldin görseli (karar bekliyor)
- **Konu:** Hoş geldin — hesabın hazır 🎉
- **Preheader:** İlk tasarımını birkaç dakikada baskıya hazır hâle getir.
- **Gövde:**
  > Merhaba {customerName},
  >
  > Aramıza hoş geldin! Hesabın hazır. Bundan sonra siparişlerini, prova onaylarını ve kargo durumunu hep buradan takip edebilirsin.
  >
  > Başlamak çok kolay: tasarımını yükle ya da hazır şablonlardan seç, 60 saniyede fiyatını gör.
  >
  > **[İlk siparişini oluştur]**
  >
  > Aklına takılan olursa sağ alttaki Pim'e sorabilir ya da bize yazabilirsin. Hangi e-postaları alacağını dilediğin zaman bildirim tercihlerinden yönetebilirsin.
- **CTA:** "İlk siparişini oluştur" → `https://pimetiket.com/sticker` · yan linkler: `/iletisim`, `/bildirim-tercihleri`
- **Not:** İçine kampanya/indirim YOK (yoksa ticari iletiye döner, İYS onayı gerekir).

---
## GRUP 2 — 🔴 İade akışı (24-27)

> Hepsi transactional, görselsiz. Değişkenler: {customerName}, {orderId}, {refundAmount}, {reason}, {refundTarget} (kart/IBAN son hane). Rotalar: `/iadelerim`, `/iade-talep`, `/destek`.

### 24 · İade Talebi Alındı  ✍️
- **Tür:** Transactional · **Tetik:** İade talebi oluşturuldu · **Görsel:** Yok
- **Konu:** İade talebini aldık — {orderId}
- **Preheader:** Talebini inceliyoruz, kısa sürede döneceğiz.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin için iade talebini aldık. Ekibimiz talebini inceliyor; sonucu en kısa sürede e-posta ile bildireceğiz.
  >
  > **[Talebimi görüntüle]**
  >
  > Sürecin neresinde olduğunu istediğin an buradan takip edebilirsin. Eklemek istediğin bir not ya da görsel varsa destek üzerinden iletebilirsin.
- **CTA:** "Talebimi görüntüle" → `https://pimetiket.com/iadelerim` · yardım: `/destek`
- **Not:** Süre taahhüdü vermedim ("en kısa sürede") — net gün vaadi operasyona bağlı.

### 25 · İade Onaylandı  ✍️
- **Tür:** Transactional · **Tetik:** İade onaylandı · **Görsel:** Yok
- **Konu:** İaden onaylandı — {orderId}
- **Preheader:** Sıradaki adımları aşağıda özetledik.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin için iade talebin onaylandı. Sıradaki adımlar:
  >
  > - Ürünün geri gönderilmesi gerekiyorsa, kargo yönergelerini talebinin detayında bulacaksın.
  > - Ürün bize ulaşıp kontrol edildikten sonra para iaden başlatılır.
  > - Para iadesi tamamlanınca ayrıca bilgilendireceğiz.
  >
  > **[İade adımlarımı gör]**
  >
  > Sorun olursa buradayız.
- **CTA:** "İade adımlarımı gör" → `https://pimetiket.com/iadelerim` · yardım: `/destek`
- **Not:** "Geri gönderim gerekiyorsa" koşullu yazıldı — bazı iadelerde ürün iadesi istenmez.

### 26 · İade Reddedildi  ✍️
- **Tür:** Transactional · **Tetik:** İade reddedildi · **Görsel:** Yok
- **Konu:** İade talebin hakkında — {orderId}
- **Preheader:** Talebini değerlendirdik; detaylar e-postada.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin için iade talebini dikkatle değerlendirdik. Maalesef bu talebi şu gerekçeyle sonuçlandıramadık:
  >
  > **{reason}**
  >
  > Kişiye özel üretilen baskı ürünlerinde iade koşulları, baskı hatası ve hasar durumları dışında sınırlı olabiliyor — ayrıntılar iade-değişim politikamızda.
  >
  > Kararın hatalı olduğunu düşünüyorsan ya da eklemek istediğin bir şey varsa lütfen bize yaz; birlikte bakalım.
  >
  > **[Destekle iletişime geç]**
- **CTA:** "Destekle iletişime geç" → `https://pimetiket.com/destek` · politika: `/iade-degisim-politikasi`
- **Not:** Ton empatik + kapı açık; {reason} operatör girişi. Suçlayıcı dil yok.

### 27 · Para İadesi Yapıldı  ✍️
- **Tür:** Transactional · **Tetik:** Para iadesi tamamlandı · **Görsel:** Yok
- **Konu:** Para iaden yapıldı — {orderId}
- **Preheader:** {refundAmount} hesabına geri gönderildi.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin için **{refundAmount}** tutarındaki para iadeni gerçekleştirdik. Tutar, ödemeyi yaptığın {refundTarget} hesabına gönderildi.
  >
  > Bankana bağlı olarak hesabına yansıması birkaç iş günü sürebilir. Süreç beklenenden uzarsa ya da bir uyumsuzluk görürsen bize yaz, hemen bakalım.
  >
  > **[İade kaydımı gör]**
  >
  > Tekrar görüşmek dileğiyle.
- **CTA:** "İade kaydımı gör" → `https://pimetiket.com/iadelerim` · yardım: `/destek`
- **Not:** "Birkaç iş günü" banka kaynaklı gecikme için dürüst beklenti yönetimi.

---
## GRUP 3 — 🔴 İptal / Ödeme (28-29)

> Transactional, görselsiz. Değişkenler: {customerName}, {orderId}, {reason}, {refundNote}.

### 28 · Sipariş İptali  ✍️
- **Tür:** Transactional · **Tetik:** Sipariş iptal edildi (müşteri ya da operatör) · **Görsel:** Yok
- **Konu:** Siparişin iptal edildi — {orderId}
- **Preheader:** İptal detaylarını ve varsa iade bilgisini ekledik.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin iptal edildi. {reason}
  >
  > {refundNote}
  >
  > Yeniden sipariş vermek istersen tasarımın hâlâ hesabında — birkaç tıkla baskıya gönderebilirsin.
  >
  > **[Yeni sipariş oluştur]**
  >
  > Bir yanlışlık olduğunu düşünüyorsan ya da yardıma ihtiyacın olursa bize yaz, hemen bakalım.
- **CTA:** "Yeni sipariş oluştur" → `https://pimetiket.com/sticker` · yardım: `/destek` · siparişler: `/siparislerim`
- **Not — {reason} AI ile üretilecek (Sefa kararı, 6 Haz):** Sistemde müşteriye dönük iptal-sebebi alanı YOK (müşteri iptali = sabit "customer_cancel"; operatör iptali = iç audit `note`). Çözüm: **Pim AI**, iptal kaynağını + operatör iç notunu/bağlamı alıp müşteriye uygun, kibar, tek cümlelik sebebi yazar ve {reason}'a basar.
  - Fallback (AI/sebep yoksa): müşteri iptalinde "Talebin üzerine siparişin iptal edildi.", operatör iptalinde "Siparişin iptal edildi." (sebep cümlesi atlanır).
  - {refundNote}: ödeme alındıysa "İaden otomatik başlatıldı; tamamlanınca ayrıca bilgilendireceğiz.", alınmadıysa boş.
  - ⚙️ Uygulama görevi (Claude Code): iptal anında Pim AI'dan "müşteriye uygun iptal sebebi" üreten adım + e-postaya geçirme. Brief'e işlendi.

### 29 · Ödeme Başarısız  ✍️
- **Tür:** Transactional · **Tetik:** Ödeme alınamadı/yarım kaldı · **Görsel:** Yok
- **Konu:** Ödemen tamamlanamadı — siparişin seni bekliyor
- **Preheader:** Hesabından bir tahsilat yapılmadı; tek tıkla tekrar deneyebilirsin.
- **Gövde:**
  > Merhaba {customerName},
  >
  > Siparişini tamamlamaya çalıştın ama ödeme adımı sonuçlanmadı. Merak etme — **hesabından herhangi bir tahsilat yapılmadı** ve sepetin olduğu gibi duruyor.
  >
  > Bu çoğu zaman bankanın 3D Secure onayı, bağlantı kopması ya da kart limiti gibi geçici bir nedenden olur. Tekrar denemek genelde yeterli oluyor:
  >
  > **[Ödemeyi tamamla]**
  >
  > Sorun devam ederse farklı bir kart deneyebilir ya da bize yazabilirsin — adım adım yardımcı oluruz.
- **CTA:** "Ödemeyi tamamla" → `https://pimetiket.com/sepet` · yardım: `/destek`
- **Not:** Opsiyonel e-posta (listende öyle işaretli). Suçlayıcı değil, "tahsilat yapılmadı" güveni öne çıkar. Belirli banka/kart hatası adı verilmez.

---
## GRUP 5 — İlişki (10, 11, 14) — TİCARİ İLETİ

> ⚠️ Hepsi ticari ileti: İYS onayı + abonelikten-çık ZORUNLU (base footer token'lı unsubscribe basar). Yalnız onaylı listeye gider; suppression'a takılırsa gönderilmez.

### 10 · Yorum Daveti  ✍️
- **Tür:** Ticari ileti · **Tetik:** Teslimden ~3 gün sonra · **Görsel:** Küçük ürün thumbnail (opsiyonel) · **AI:** 🟡 opsiyonel — alınan ürüne atıf
- **Konu:** {orderProductShort} nasıl oldu? 30 saniyen var mı?
- **Preheader:** Deneyimini paylaş, küçük bir teşekkürü hak et.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin eline ulaşalı birkaç gün oldu. Nasıl gittiğini gerçekten merak ediyoruz — baskı, malzeme, kargo... aklında ne varsa.
  >
  > Kısa bir yorum bırakırsan hem bize yol gösterirsin hem de bir sonraki siparişinde kullanabileceğin küçük bir indirim kuponu hediye edelim.
  >
  > **[Deneyimimi paylaş]**
  >
  > İki dakikanı bile almaz, söz.
- **CTA:** "Deneyimimi paylaş" → `https://pimetiket.com/yorum-yaz/{orderId}`
- **Not:** Kupon = yorum sonrası tek seferlik (sefaRules'ta izinli). {orderProductShort}: AI/sistem en belirgin ürünü yazar; yoksa "siparişin".

### 11 · Terk Sepet  ✍️
- **Tür:** Ticari ileti · **Tetik:** Sepet 1-3 gün tamamlanmadı · **Görsel:** Sepetteki ürün görseli (opsiyonel) · **AI:** 🟡 opsiyonel — sepet ürününe atıf
- **Konu:** Sepetinde tasarımın seni bekliyor
- **Preheader:** Kaldığın yerden devam et — birkaç tık kaldı.
- **Gövde:**
  > Merhaba {customerName},
  >
  > Sepetinde tamamlanmayı bekleyen bir tasarımın var. İstersen kaldığın yerden devam edebilir, 60 saniyede siparişini verebilirsin.
  >
  > **[Sepetime dön]**
  >
  > Malzeme ya da fiyat konusunda kararsızsan Pim'e sorabilir ya da bize yazabilirsin — seçmene yardımcı oluruz.
- **CTA:** "Sepetime dön" → `https://pimetiket.com/sepet` · yardım: `/destek`
- **Not:** İndirim baskısı yok (sade hatırlatma). İndirim eklemek istersen ayrı karar — yine ticari ileti kapsamında.

### 14 · Newsletter Hoşgeldin  ✍️
- **Tür:** Ticari ileti (bülten) · **Tetik:** Bülten kaydı sonrası · **Görsel:** Opsiyonel sıcak görsel · **AI:** 🔴 hayır (sabit)
- **Konu:** Pim'in Defteri'ne hoş geldin
- **Preheader:** Ayda 1-2 e-posta; spam yok, satış baskısı yok.
- **Gövde:**
  > Merhaba,
  >
  > Pim'in Defteri'ne kaydolduğun için teşekkürler! Bundan sonra ayda 1-2 e-posta ile yeni rehberleri, malzeme ipuçlarını ve işine yarayacak fikirleri ilk senle paylaşacağız.
  >
  > Spam yok, satış baskısı yok — sözümüz. Beklerken son yazılarımıza göz atabilirsin:
  >
  > **[Rehberleri keşfet]**
  >
  > İstediğin an, her e-postanın altındaki bağlantıdan abonelikten çıkabilirsin.
- **CTA:** "Rehberleri keşfet" → `https://pimetiket.com/blog`
- **Not:** Mevcut blog newsletter vaadiyle ("Ayda 1-2 e-posta. Spam yok, satış baskısı yok.") birebir uyumlu.

---
## GRUP 4 — Müşteri transactional akışı (1-9) — mevcut şablonların cilası

> Hepsi transactional (izinsiz, unsubscribe yok). Değişkenler: {customerName}, {orderId}, {items}, {total}, {trackingNumber}, {carrierName}, {trackingUrl}, {estimatedDelivery}.

### 1 · Sipariş Onayı  ✍️
- **Tür:** Transactional · **Tetik:** Ödeme alındı · **Görsel:** Küçük ürün thumbnail (opsiyonel) · **AI:** 🔴 hayır
- **Konu:** Siparişin alındı — {orderId}
- **Preheader:** Ödemeni aldık; sıradaki adımı aşağıda özetledik.
- **Gövde:**
  > Merhaba {customerName},
  >
  > Teşekkürler — {orderId} numaralı siparişin alındı ve ödemen başarıyla tahsil edildi.
  >
  > **Sipariş özeti:** {items} · Toplam: {total}
  >
  > Sıradaki adım: tasarım dosyanı henüz yüklemediysen yüklemen gerekiyor; yüklediysen ekibimiz baskı öncesi kontrole alıyor.
  >
  > **[Siparişimi görüntüle]**
  >
  > Her aşamada seni e-posta ile bilgilendireceğiz.
- **CTA:** "Siparişimi görüntüle" → `https://pimetiket.com/siparis/{orderId}`

### 2 · Tasarım Yükleme Hatırlatma  ✍️
- **Tür:** Transactional · **Tetik:** Sipariş var, dosya yüklenmedi (cron, ~24s) · **Görsel:** Yok · **AI:** 🔴 hayır
- **Konu:** Tasarımını bekliyoruz — {orderId}
- **Preheader:** Baskıya başlamak için tek eksik dosyan.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin hazır, ama baskıya başlayabilmemiz için tasarım dosyana ihtiyacımız var. Dosyanı yükler yüklemez sürecini başlatıyoruz.
  >
  > **[Tasarımımı yükle]**
  >
  > Dosya hazırlarken takıldıysan (ölçü, çözünürlük, kesim payı) Pim'e sorabilir ya da bize yazabilirsin.
- **CTA:** "Tasarımımı yükle" → `https://pimetiket.com/siparis/{orderId}` · yardım: `/destek`

### 3 · Prova Hazır  ✍️
- **Tür:** Transactional · **Tetik:** Prova hazırlandı · **Görsel:** Prova önizleme görseli (ZORUNLU) · **AI:** 🔴 hayır
- **Konu:** Provan hazır — onayını bekliyoruz, {orderId}
- **Preheader:** Baskıdan önce son söz sende.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişinin baskı provası hazır. Operatörümüz baktı, AI ön kontrolden geçti — şimdi sıra sende. Aşağıdan provanı incele; her şey yolundaysa onayla, biz de baskıya geçelim.
  >
  > **[Provamı incele ve onayla]**
  >
  > Değişiklik istersen aynı sayfadan iletebilirsin. Onayladığın hâliyle basılır, o yüzden bir kez daha göz atmanda fayda var.
- **CTA:** "Provamı incele ve onayla" → `https://pimetiket.com/onay/{orderId}`

### 4 · Prova Hatırlatma  ✍️
- **Tür:** Transactional · **Tetik:** Prova 24+ saattir onay bekliyor (cron) · **Görsel:** Prova önizleme (opsiyonel) · **AI:** 🔴 hayır
- **Konu:** Provan onayını bekliyor — {orderId}
- **Preheader:** Onaylar onaylamaz baskıya geçiyoruz.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişinin provası onayını bekliyor. Sen onaylamadan baskıya geçmiyoruz — siparişin beklemede kalmasın istedik, hatırlatalım dedik.
  >
  > **[Provamı onayla]**
  >
  > Bir sorun ya da değişiklik varsa aynı sayfadan iletebilir, istersen bize yazabilirsin.
- **CTA:** "Provamı onayla" → `https://pimetiket.com/onay/{orderId}` · yardım: `/destek`

### 5 · QC Uyarı  ✍️
- **Tür:** Transactional · **Tetik:** AI QC sorun işaretledi (DPI/bleed/font) · **Görsel:** Sorunlu alanı gösteren önizleme (varsa) · **AI:** 🟢 EVET — {qcIssue} müşteri diline çevrilir
- **Konu:** Dosyanda düzeltilmesi gereken bir nokta var — {orderId}
- **Preheader:** Baskı kalitesi için kısa bir kontrol.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişinin dosyasını baskı öncesi kontrol ettik ve baskı kalitesini etkileyebilecek bir nokta fark ettik:
  >
  > **{qcIssue}**  ← *(AI: tespiti sade, çözüm önerili tek-iki cümleye çevirir; ör. "Logonun çözünürlüğü 300 DPI altında, baskıda bulanık çıkabilir — daha yüksek çözünürlüklü bir dosya yükleyebilirsin.")*
  >
  > Düzeltilmiş dosyanı yükleyebilir ya da mevcut hâliyle devam etmek istersen bize bildirebilirsin — kararı sen ver.
  >
  > **[Dosyamı güncelle]**
  >
  > Emin değilsen yardımcı olalım; yaz yeter.
- **CTA:** "Dosyamı güncelle" → `https://pimetiket.com/siparis/{orderId}` · yardım: `/destek`
- **Not:** AI yalnız mevcut QC tespitini ifade eder, uydurmaz; tespit yoksa fallback: "Dosyanda baskı kalitesini etkileyebilecek bir nokta var, birlikte bakalım."

### 6 · QC Red  ✍️
- **Tür:** Transactional · **Tetik:** Tasarım baskıya uygun değil (red) · **Görsel:** Yok/opsiyonel · **AI:** 🟢 EVET — gerekçe + yönlendirme müşteri diline
- **Konu:** Dosyan baskıya hazır değil — birlikte çözelim, {orderId}
- **Preheader:** Düzeltmek için ne gerektiğini açıkladık.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişinin dosyasını baskıya hazırlarken şu nedenle olduğu gibi basamayacağımızı gördük:
  >
  > **{qcReason}**  ← *(AI: teknik redni anlaşılır, suçlamasız gerekçe + somut çözüm adımına çevirir)*
  >
  > İyi haber: çoğu durum kolayca çözülür. Düzeltilmiş dosyanı yükleyebilirsin; nasıl hazırlayacağından emin değilsen adım adım yardımcı oluruz.
  >
  > **[Yeni dosya yükle]**
  >
  > Takılırsan bize yaz — bu işi birlikte yola koyarız.
- **CTA:** "Yeni dosya yükle" → `https://pimetiket.com/siparis/{orderId}` · yardım: `/destek`
- **Not:** Fallback: "Dosyan mevcut hâliyle baskıya uygun değil; düzeltmek için bize ulaş."

### 7 · Kargo Durumu  ✍️
- **Tür:** Transactional · **Tetik:** Üretim/sevkiyat aşaması güncellendi · **Görsel:** Yok · **AI:** 🔴 hayır
- **Konu:** Siparişin yolda ilerliyor — {orderId}
- **Preheader:** Üretim ve kargo aşamasındaki son durum.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişinde güncelleme var: **{statusText}**. Süreç ilerledikçe seni bilgilendirmeye devam edeceğiz; kargoya verildiğinde takip numaranı da paylaşacağız.
  >
  > **[Siparişimi takip et]**
- **CTA:** "Siparişimi takip et" → `https://pimetiket.com/siparis/{orderId}`
- **Not:** {statusText} duruma göre sabit ifade (AI değil): "üretimde", "baskısı tamamlandı, paketleniyor" vb.

### 8 · Kargo Takip  ✍️
- **Tür:** Transactional · **Tetik:** Kargoya verildi · **Görsel:** Yok · **AI:** 🔴 hayır
- **Konu:** Siparişin kargoda — takip no içeride, {orderId}
- **Preheader:** {carrierName} · tahmini teslim {estimatedDelivery}.
- **Gövde:**
  > Merhaba {customerName},
  >
  > Güzel haber — {orderId} numaralı siparişin kargoya verildi! 🎉
  >
  > **Kargo:** {carrierName}
  > **Takip no:** {trackingNumber}
  > **Tahmini teslim:** {estimatedDelivery}
  >
  > **[Kargomu takip et]**
  >
  > Teslimde bir sorun olursa bize hemen yaz.
- **CTA:** "Kargomu takip et" → `{trackingUrl}` (yoksa `/siparis/{orderId}`)

### 9 · Teslim Bildirimi  ✍️
- **Tür:** Transactional · **Tetik:** Kargo teslim edildi · **Görsel:** Yok · **AI:** 🔴 hayır
- **Konu:** Siparişin teslim edildi — {orderId}
- **Preheader:** Eline ulaştı mı? Bir şey olursa buradayız.
- **Gövde:**
  > Merhaba {customerName},
  >
  > {orderId} numaralı siparişin teslim edildi — umarız beğenirsin! Bir sorun (hasar, eksik, baskı hatası) görürsen lütfen vakit kaybetmeden bize ulaş; hızlıca çözelim.
  >
  > **[Siparişimi gör]**
  >
  > Keyifli kullanımlar!
- **CTA:** "Siparişimi gör" → `https://pimetiket.com/siparis/{orderId}` · sorun: `/destek`
- **Not:** Yorum daveti AYRI (10 numara, ~3 gün sonra) — buraya yorum CTA'sı koymadım, teslim anı sade kalsın.

---
## GRUP 6 — Operasyon / Admin / Fason (15-20)

> İç bildirimler. Alıcı: admin (ADMIN_NOTIFICATION_EMAIL) ya da fason partner (/fason/{token}). Admin'e operasyonel/kısa ton; fason partnere **"siz"**. Görselsiz. KVKK: iç yazışma, unsubscribe yok.

### 15 · Yeni Sipariş (Admin)  ✍️
- **Tür:** İç bildirim (admin) · **Tetik:** Yeni ödeme alındı · **AI:** 🔴 hayır
- **Konu:** Yeni sipariş — {orderId} · {total}
- **Gövde:**
  > Yeni sipariş geldi.
  >
  > **No:** {orderId} · **Tutar:** {total} · **Müşteri:** {customerName}
  > **Ürünler:** {items}
  > **Durum:** {status} (ör. tasarım bekleniyor / prova bekleniyor)
  >
  > **[Siparişi aç]**
- **CTA:** "Siparişi aç" → `https://pimetiket.com/admin/siparisler` (veya sipariş detayı)

### 16 · Günlük Özet (Admin)  ✍️
- **Tür:** İç bildirim (admin) · **Tetik:** Günlük cron (sabah) · **AI:** 🟢 EVET — rakamları doğal dille özetler
- **Konu:** Günlük özet — {date}
- **Gövde:**
  > Günaydın. Dünün özeti:
  >
  > **{aiSummary}**  ← *(AI: sipariş sayısı, ciro, bekleyen prova/QC kuyruğu, kargo, dikkat gerektiren işleri doğal ve kısa bir brifing olarak yazar; ör. "12 sipariş, 8.940 ₺ ciro. 3 prova onay bekliyor, 1 sipariş 2 gündür dosya bekliyor — bunlara bakmak iyi olur.")*
  >
  > **[Panele git]**
- **CTA:** "Panele git" → `https://pimetiket.com/admin`
- **Not:** AI yalnız gerçek rakamları özetler, uydurmaz. Fallback: ham sayı listesi (sipariş/ciro/kuyruk).

### 17 · Destek Talebi (Admin)  ✍️
- **Tür:** İç bildirim (admin) · **Tetik:** Yeni destek talebi · **AI:** 🔴 hayır
- **Konu:** Yeni destek talebi — {ticketId}
- **Gövde:**
  > Yeni destek talebi açıldı.
  >
  > **Talep:** {ticketId} · **Müşteri:** {customerName} · **Konu:** {subject}
  > {messagePreview}
  >
  > **[Talebi yanıtla]**
- **CTA:** "Talebi yanıtla" → `https://pimetiket.com/admin/destek`

### 18 · Fason Durum  ✍️
- **Tür:** İç bildirim (fason partner) · **Tetik:** Atanan iş durumu güncellendi / yeni atama · **AI:** 🔴 hayır
- **Konu:** İş güncellemesi — {orderId}
- **Gövde:**
  > Merhaba,
  >
  > Size atanan {orderId} numaralı iş için güncel durum: **{statusText}**. Detayları ve baskı dosyalarını güvenli portal bağlantınızdan görebilirsiniz.
  >
  > **[İşi görüntüle]**
  >
  > Sorularınız için bizimle iletişime geçebilirsiniz.
- **CTA:** "İşi görüntüle" → `https://pimetiket.com/fason/{token}`
- **Not:** Partnere "siz" dili. Token'lı güvenli portal linki.

### 19 · Fason İptal  ✍️
- **Tür:** İç bildirim (fason partner) · **Tetik:** Fason ataması iptal edildi · **AI:** 🔴 hayır
- **Konu:** İş ataması iptal edildi — {orderId}
- **Gövde:**
  > Merhaba,
  >
  > {orderId} numaralı işin atamasının iptal edildiğini bildirmek isteriz. Bu iş için herhangi bir işlem yapmanıza gerek yok.
  >
  > İlginiz için teşekkür ederiz; yeni işlerde tekrar birlikte çalışmayı dileriz.
  >
  > **[Panelimi aç]**
- **CTA:** "Panelimi aç" → `https://pimetiket.com/fason/{token}`

### 20 · Otomatik İade Bildirimi (Admin)  ✍️
- **Tür:** İç bildirim (admin) · **Tetik:** Prova onaylanmadı → sistem otomatik iade başlattı · **AI:** 🔴 hayır
- **Konu:** Otomatik iade yapıldı — {orderId}
- **Gövde:**
  > Bilgi: {orderId} numaralı sipariş için prova süresi onaysız doldu ve sistem otomatik iade başlattı.
  >
  > **No:** {orderId} · **Tutar:** {refundAmount} · **Müşteri:** {customerName}
  >
  > Müşteriye iade bildirimi otomatik gönderildi (bkz. 27 Para İadesi). Gerekirse manuel inceleyebilirsin.
  >
  > **[Siparişi incele]**
- **CTA:** "Siparişi incele" → `https://pimetiket.com/admin/siparisler`
- **Not:** Bu admin'e bilgi; müşteri tarafı 27 (Para İadesi) + gerekiyorsa 28 (İptal) ile yürür.

---

## DURUM ÖZETİ
✅ **Sefa okudu ve onayladı (6 Haz 2026).** Metinler hazır — uygulama Claude Code'a devredildi (`CLAUDE-GOREV-EPOSTA-SISTEMI.md`).
✍️ Yazıldı: **29/29** (Grup 1 auth · 2 iade · 3 iptal/ödeme · 4 müşteri akışı · 5 ilişki · 6 admin/fason).
Sıradaki fasıllar: **(1)** Sefa toplu gözden geçirme/onay · **(2)** görselleştirme (prova/kargo/hoşgeldin thumbnail'leri, base layout) · **(3)** uygulama (Claude Code: Supabase auth şablonları + Resend şablon güncelleme + AI sebep/QC/özet adımları).
