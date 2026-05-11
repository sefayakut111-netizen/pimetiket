# KVKK AYDINLATMA METNİ — Fason Aktarım Güncellemesi

> ⚠️ **AVUKAT ONAYI BEKLİYOR** · `/kvkk` ve `/gizlilik` sayfalarına eklenecek bölüm taslakları.
> **Tarih:** 11 Mayıs 2026 · **Versiyon:** Taslak 1.0

---

## 1) `/kvkk` Sayfasına Eklenecek Bölüm

### "Verilerin Aktarıldığı Üçüncü Kişiler" Bölümüne (mevcut bölüm varsa) Eklenecek

```markdown
### Üretim Ortakları (Fason İşletmeler)

Sipariş ettiğiniz baskı ürününün üretimi için anlaşmalı **fason
üretim ortaklarımıza** aşağıdaki verileriniz aktarılır:

- Ad soyad (kargo etiketi için)
- Teslimat adresi ve telefon (kargo için)
- Sipariş detayları (ölçü, malzeme, adet, kesim tipi)
- Yüklediğiniz tasarım dosyası (üretim için)

Aktarım amacı: Sipariş edilen ürünün üretiminin gerçekleştirilmesi
ve kargolanması (KVKK m.5/2-c "sözleşmenin ifası").

**Yasal dayanak:** KVKK m.8/2-a — Açık rıza aranmaksızın aktarım,
sözleşmenin ifası için zorunlu olduğunda.

**Veri işleyen statüsü:** Fason ortaklarımız KVKK m.3/1-ı uyarınca
"veri işleyen" sıfatına sahiptir; bizimle imzalı veri işleyici
sözleşmesi olmadan veri aktarımı yapılmaz.

**Sözleşmesel güvenceler:** Tüm fason ortaklarımız ile:
- Sadece ilgili sipariş için kullanım taahhüdü
- Üretim sonrası en fazla 30 gün içinde imha yükümlülüğü
- Başkasına aktarım yasağı
- Çalışan gizlilik taahhütleri
- Veri ihlali halinde 24 saat içinde bildirim
yükümlülüklerini içeren bağlayıcı sözleşmeler imzalanmıştır.

**Yurt dışı aktarım YAPILMAZ.** Tüm fason ortaklarımız Türkiye
sınırları içinde faaliyet gösterir.
```

---

## 2) `/gizlilik` Sayfasına Eklenecek Bölüm

Mevcut "Verilerinizi Kimlerle Paylaşıyoruz" bölümüne aşağıdaki madde eklenir:

```markdown
### 4. Fason Üretim Ortaklarımız

Pim Etiket fason üretim modeliyle çalışır — yani sipariş ettiğiniz
ürünlerin baskı işlemini İstanbul ve Ankara'daki anlaşmalı baskı
atölyeleri yapar. Bu fason ortaklarımıza şu verileriniz aktarılır:

| Veri | Neden |
|---|---|
| Ad soyad | Kargo etiketinde gerekli |
| Adres + telefon | Kargo teslimatı için zorunlu |
| Tasarım dosyası | Üretimde kullanılır |
| Sipariş detayları | Ürünü doğru üretmek için |

**Önemli güvenceler:**

- Fason ortaklarımız sadece **sizin siparişiniz** için bu verileri
  kullanabilir. Başka müşteriye ürettiremez, sosyal medyada
  yayımlayamaz, portfolyo olarak gösteremez.
- **Üretim bittikten en geç 30 gün sonra** elindeki tüm verileri
  ve tasarım dosyasını silmek/imha etmek zorundadır.
- **Tasarım dosyalarınız şifreli ve süre sınırlı bağlantılar
  (signed URL) ile gönderilir.** İlgili sipariş bittiğinde
  bu bağlantı kendiliğinden geçersiz olur.
- Tüm fason'larımızla **veri işleyici sözleşmemiz** vardır;
  ihlal halinde Pim Etiket sorumlu kılınır ve fason'a rücu eder.

Fason ortağımıza aktarılan verilerinizin durumu hakkında bilgi
almak veya başvuru yapmak için **kvkk@pimetiket.com** adresinden
bize ulaşabilirsiniz. Doğrudan fason'a yapılan başvurular bize
iletilir.
```

---

## 3) Müşteri Aydınlatma Metni — Sipariş Aşamasında Gösterilecek

`/odeme` sayfasında, telif checkbox'ından önce, küçük açıklayıcı not olarak:

```markdown
> 🏭 **Üretim bilgisi:** Pim Etiket fason üretim modeliyle çalışır.
> Tasarımın ve kargo bilgilerin anlaşmalı baskı atölyemize aktarılır;
> sadece sipariş kapsamında kullanılır, 30 gün sonra imha edilir.
> [Detay → /gizlilik]
```

---

## 4) Mevcut /kvkk Bölümleri ile Tutarlılık Kontrolü

Mevcut `/kvkk` sayfasında ŞU bilgilerin GÜNCEL olması gerekir:

- ✅ "Verilerin işlenme amaçları" — sipariş ifası eklenmiş olmalı
- ✅ "Kişisel veri saklama süresi" — üretim için 30 gün, vergi için 5 yıl
- ✅ "Kim olarak işleniyor" — Veri Sorumlusu Sefa Yakut Ltd. Şti.
- ⚠️ "Aktarılan üçüncü kişiler" — FASON ortakları eklenmeli (yeni)
- ⚠️ "Yurt dışı aktarım" — YAPILMAZ ifadesi belirgin olmalı
- ⚠️ "Veri işleyici sözleşmeleri" — bağlayıcı sözleşme imzalandığı ifadesi

---

> **AVUKAT İÇİN NOT:**
>
> 1. Eklenecek metinler mevcut KVKK aydınlatma metniyle çakışıyor mu kontrol edilmeli.
> 2. Açık rıza alınması gerekiyor mu, yoksa m.8/2-a (sözleşmenin ifası) yeterli mi?
> 3. Fason'lar yurt içinde — yurt dışı aktarım maddeleri yazıldıysa "YAPILMAZ" netleşmeli.
> 4. VERBİS muafiyeti durumu netleşince aydınlatma metnine yansıyabilir.
> 5. KVKK Kurulu'nun ilgili kararları (özellikle 2019/10 veri ihlali bildirimi) uyum kontrol edilmeli.
