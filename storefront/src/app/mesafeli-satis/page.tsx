import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Mesafeli Satış Sözleşmesi",
  description:
    "Pim Etiket üzerinden verilen siparişler için Mesafeli Satış Sözleşmesi.",
  alternates: { canonical: "/mesafeli-satis" },
};

export default function MesafeliSatisPage() {
  return (
    <LegalLayout
      title="Mesafeli Satış Sözleşmesi"
      lastUpdated="8 Mayıs 2026"
      currentPath="/mesafeli-satis"
    >
      <p>
        İşbu Mesafeli Satış Sözleşmesi (&ldquo;Sözleşme&rdquo;), 6502 sayılı
        Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
        Yönetmeliği uyarınca düzenlenmiştir. ALICI ve SATICI arasında elektronik
        ortamda kurulmuş olup, ALICI&rsquo;nın siparişi onaylamasıyla yürürlüğe
        girer.
      </p>

      <h2>1. Taraflar</h2>
      <p>
        <strong>SATICI:</strong> SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED
        ŞİRKETİ (&ldquo;Pim Etiket&rdquo;)
        <br />
        Vergi Dairesi / No: Doğanbey Vergi Dairesi / 7580607612
        <br />
        Mersis No: 0758060761200001
        <br />
        Ticaret Sicil No: 493212
        <br />
        Ana Faaliyet: 464903 — Kırtasiye Ürünleri Toptan Ticareti
        <br />
        Tebligat Adresi: Workinton Ankara Söğütözü, Beştepeler Mah. Nergis
        Sok. No:7/2 ViaFlat İş Merkezi Ofis: 27-28, 06510 Çankaya/Ankara
        <br />
        E-posta: <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>
        <br />
        Web: <a href="https://pimetiket.com">pimetiket.com</a>
      </p>
      <p>
        <strong>ALICI:</strong> Sipariş aşamasında verdiği ad-soyad, adres,
        e-posta ve telefon bilgileriyle pimetiket.com&rsquo;a kayıt olan ve
        sipariş geçen kişi.
      </p>

      <h2>2. Sözleşmenin Konusu</h2>
      <p>
        İşbu Sözleşme&rsquo;nin konusu, ALICI&rsquo;nın
        <strong> pimetiket.com</strong> üzerinden elektronik ortamda sipariş
        verdiği, niteliği ve satış fiyatı sipariş özetinde belirtilen{" "}
        <strong>kişiye özel olarak hazırlanan etiket / sticker</strong>{" "}
        ürünlerinin satışı ve tesliminin koşullarını düzenlemektir.
      </p>

      <h2>3. Sözleşme Konusu Ürün</h2>
      <ul>
        <li>
          Ürün açıklaması, malzeme, kaplama, ölçü, adet, sarım yönü ve
          özelleştirme detayları sipariş onayında belirtilir.
        </li>
        <li>
          Toplam fiyat (KDV dahil) sipariş onayı anında ALICI&rsquo;ya
          gösterilir; sözleşmenin esaslı unsurudur.
        </li>
        <li>
          Tahmini teslim süresi: ürünler 5 (beş) iş günü içinde kargoya
          verilir, kargo süresi şehre göre 1-3 iş günü sürer. Üretim süresi
          ALICI&rsquo;nın tasarım dosyasını yüklemesinden sonra başlar.
        </li>
      </ul>

      <h2>4. Genel Hükümler</h2>
      <ul>
        <li>
          ALICI, sipariş onayından önce ürünün özelliklerini, fiyatını,
          ödeme şeklini ve teslim koşullarını okuduğunu ve onayladığını
          beyan eder.
        </li>
        <li>
          ALICI, ödeme sonrası <strong>3 (üç) gün</strong> içinde tasarım
          dosyasını sisteme yüklemek zorundadır. Süre içinde dosya
          yüklenmezse SATICI siparişi tek taraflı iptal etme ve ödenen
          tutarı iade etme hakkını saklı tutar.
        </li>
        <li>
          AI destekli otomatik kalite kontrolü ve operatör manuel kontrolü
          sonrasında dosya uygun bulunmazsa, ALICI&rsquo;ya düzeltme talebi
          iletilir. Düzeltilmiş dosya yüklenmediği takdirde sipariş işleme
          alınmaz.
        </li>
      </ul>

      <h2>5. Ödeme</h2>
      <p>
        Ödemeler kredi/banka kartı ile 3D Secure üzerinden tahsil edilir.
        Sipariş onayı anında tahsil edilen tutar, ürün üretim ve teslim
        sürecinin başlamasının koşuludur.
      </p>

      <h2>6. Teslimat</h2>
      <p>
        Ürünler Pim Etiket&rsquo;in anlaşmalı kargo firmaları (Yurtiçi Kargo,
        Aras Kargo, MNG Kargo) aracılığıyla ALICI&rsquo;nın sipariş aşamasında
        belirttiği teslimat adresine gönderilir. Kargo süresi takip numarası
        ile ALICI tarafından izlenir; takip linki sipariş paneline ve
        e-postaya iletilir.
      </p>

      <h2>7. Cayma Hakkı</h2>
      <p>
        Mesafeli Sözleşmeler Yönetmeliği&rsquo;nin{" "}
        <strong>15. maddesi 1. fıkrası (b) bendi</strong> uyarınca,
        &ldquo;tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda
        hazırlanan&rdquo; ürünlerde tüketici cayma hakkını kullanamaz. Pim
        Etiket üzerinden verilen tüm siparişler ALICI&rsquo;nın tasarımına ve
        seçimlerine göre üretildiği için bu kapsama girer ve{" "}
        <strong>cayma hakkı bulunmamaktadır</strong>. Ayrıntılar{" "}
        <a href="/cayma-hakki">/cayma-hakki</a> sayfasındadır.
      </p>

      <h2>8. Ayıplı Ürün</h2>
      <p>
        Üretim hatası, baskı bozukluğu, kargo hasarı veya sipariş edilen
        ürün özelliklerinden farklı ürün gönderilmesi durumlarında
        ALICI&rsquo;nın yasal hakları saklıdır. Bu tür durumlarda 7 gün
        içinde fotoğraflı bildirim ile SATICI&rsquo;ya başvurulması halinde
        ürün ücretsiz yeniden üretilir veya ödenen tutar iade edilir.
      </p>

      <h2>9. Telif Hakları ve Fikri Mülkiyet</h2>
      <p>
        ALICI, yüklediği tasarım dosyalarının (PDF, AI, EPS, PNG, JPG vb.)
        telif sahibi olduğunu veya bu dosyaları üretimde kullanma yetkisinin
        bulunduğunu taahhüt eder. Üçüncü kişilere ait fikri ve sınai mülkiyet
        haklarını (telif, marka, patent, tasarım) ihlal eden içerikler için
        SATICI <strong>hiçbir sorumluluk kabul etmez</strong>.
      </p>
      <p>
        Bu tür ihlaller nedeniyle SATICI&rsquo;ya gelen üçüncü kişi
        taleplerinden, hukuki süreçlerden ve maddi-manevi zararlardan
        tamamen ALICI sorumludur. SATICI, açık bir ihlal tespit etmesi
        halinde siparişi reddetme veya iptal etme hakkını saklı tutar; bu
        durumda ödenen tutar 7 iş günü içinde iade edilir.
      </p>
      <p>
        ALICI tarafından yüklenen tasarımlar yalnızca sipariş edilen
        ürünün üretiminde kullanılır. SATICI bu dosyaları üçüncü kişilerle
        paylaşmaz, başka müşterilere ürettirmez ve kendi pazarlama
        materyallerinde ALICI&rsquo;nın yazılı izni olmadan kullanmaz.
      </p>
      <p>
        Pim Etiket&rsquo;in marka ismi, logosu, &ldquo;Pim&rdquo; karakteri
        ve site içeriği SATICI&rsquo;nın fikri mülkiyetidir; ALICI tarafından
        çoğaltılamaz, ticari amaçla kullanılamaz.
      </p>

      <h2>10. Mücbir Sebep</h2>
      <p>
        Doğal afet, savaş, grev, kamu otoritesi kararları, kargo firması
        kaynaklı gecikmeler gibi tarafların kontrolü dışındaki olaylar
        nedeniyle gecikme yaşandığında SATICI sorumlu tutulamaz.
      </p>

      <h2>11. Yetkili Mahkeme</h2>
      <p>
        İşbu Sözleşme&rsquo;den doğacak uyuşmazlıklarda, Gümrük ve Ticaret
        Bakanlığı&rsquo;nın belirlediği parasal sınırlar çerçevesinde
        Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.
      </p>

      <h2>12. Yürürlük</h2>
      <p>
        ALICI&rsquo;nın elektronik ortamda &ldquo;Sözleşmeyi okudum,
        anladım, kabul ediyorum&rdquo; kutusunu işaretleyip ödeme adımını
        tamamlamasıyla işbu Sözleşme yürürlüğe girer.
      </p>
    </LegalLayout>
  );
}
