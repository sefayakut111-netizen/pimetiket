import { LegalLayout } from "@/components/legal/LegalLayout";
import { legalPageMetadata } from "@/lib/seo/legal-metadata";
import { PIM_PRODUCTION_BUSINESS_DAYS } from "@/lib/pim/site-facts";

export const metadata = legalPageMetadata(
  "Ön Bilgilendirme Formu",
  "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca tüketiciye sunulan zorunlu ön bilgilendirme.",
  "/on-bilgilendirme"
);

export default function OnBilgilendirmePage() {
  return (
    <LegalLayout
      title="Ön Bilgilendirme Formu"
      lastUpdated="10 Mayıs 2026"
      currentPath="/on-bilgilendirme"
    >
      <p>
        İşbu Ön Bilgilendirme Formu, 6502 sayılı Tüketicinin Korunması Hakkında
        Kanun ve Mesafeli Sözleşmeler Yönetmeliği&rsquo;nin{" "}
        <strong>5. maddesi</strong> uyarınca, ALICI&rsquo;nın siparişe ilişkin
        sözleşme ve ödemenin esaslı unsurları hakkında, sipariş onayından önce
        bilgilendirilmesi amacıyla düzenlenmiştir. ALICI, ödeme aşamasındaki
        kutucuğu işaretleyerek işbu formu ve Mesafeli Satış
        Sözleşmesi&rsquo;ni okuduğunu, anladığını ve kabul ettiğini beyan eder.
      </p>

      <h2>1. Satıcı Bilgileri</h2>
      <ul>
        <li>
          <strong>Ünvan:</strong> SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED
          ŞİRKETİ (&ldquo;Pim Etiket&rdquo;)
        </li>
        <li>
          <strong>Vergi Dairesi / No:</strong> Doğanbey Vergi Dairesi /
          7580607612
        </li>
        <li>
          <strong>Mersis No:</strong> 0758060761200001
        </li>
        <li>
          <strong>Ticaret Sicil No:</strong> 493212
        </li>
        <li>
          <strong>Ana Faaliyet:</strong> 464903 — Kırtasiye Ürünleri Toptan
          Ticareti
        </li>
        <li>
          <strong>Adres:</strong> Workinton Ankara Söğütözü, Beştepeler Mah.
          Nergis Sok. No:7/2 ViaFlat İş Merkezi Ofis: 27-28, 06510
          Çankaya/Ankara
        </li>
        <li>
          <strong>Telefon:</strong> [Sefa tarafından eklenecek — Workinton ofis hattı]
        </li>
        <li>
          <strong>E-posta:</strong>{" "}
          <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>
        </li>
        <li>
          <strong>Web sitesi:</strong>{" "}
          <a href="https://pimetiket.com">pimetiket.com</a>
        </li>
        <li>
          <strong>Şikayet ve iletişim:</strong>{" "}
          <a href="/iletisim">/iletisim</a>
        </li>
      </ul>
      {/* Sefa 21 May v68 (UX denetim P3 #15): "Şirket ünvanı değişiklik
          sürecindedir" notu kullanıcıya gösterilmemeli — iç doküman olarak
          kalmalı. Resmi ünvan kesinleştiğinde buradan kaldırıldı. */}

      <h2>2. Sözleşme Konusu Mal/Hizmet ve Temel Nitelikleri</h2>
      <p>
        Sözleşmenin konusu, ALICI&rsquo;nın pimetiket.com üzerinden, kendi
        tasarımı veya konfigürasyonu ile sipariş ettiği{" "}
        <strong>kişiye özel olarak üretilen etiket ve sticker</strong>{" "}
        ürünlerinin satışıdır. Ürünlere ait;
      </p>
      <ul>
        <li>Malzeme (kraft, beyaz kuşe, transparan, sticker, vb.)</li>
        <li>Kaplama (mat, parlak, metalik)</li>
        <li>Ölçü (mm × mm) ve adet</li>
        <li>Sarım yönü (rulo siparişlerinde)</li>
        <li>ALICI tarafından yüklenen tasarım dosyası</li>
      </ul>
      <p>
        gibi tüm temel nitelikler, ürün konfigüratörü ve sipariş özet ekranı
        üzerinden ALICI&rsquo;nın onayına sunulur.
      </p>

      <h2>3. Toplam Fiyat ve Vergiler</h2>
      <ul>
        <li>
          Sipariş özetinde gösterilen toplam tutar,{" "}
          <strong>tüm vergiler (KDV %20) dahil</strong> Türk Lirası (₺)
          cinsindendir.
        </li>
        <li>
          ALICI&rsquo;dan sipariş onayı sırasında bu tutar dışında ek bir bedel
          talep edilmez.
        </li>
        <li>
          Kargo bedeli — varsa — sepet/ödeme adımında ayrıca gösterilir;
          sipariş tutarına göre ücretsiz kargo eşiği uygulanabilir.
        </li>
        <li>
          Fiyat ve özelliklerin kesinleşmesi, ALICI&rsquo;nın siparişi
          onaylayıp ödemeyi tamamlamasıyla gerçekleşir.
        </li>
      </ul>

      <h2>4. Ödeme Şekli ve Bilgileri</h2>
      <ul>
        <li>
          Ödeme; <strong>kredi kartı veya banka kartı ile 3D Secure</strong>{" "}
          (yetkilendirilmiş ödeme kuruluşu PayTR Ödeme Hizmetleri A.Ş.
          altyapısı) üzerinden alınır.
        </li>
        <li>
          Kart bilgileri PayTR&rsquo;nin PCI-DSS sertifikalı güvenli sayfasında
          işlenir; Pim Etiket bu bilgileri saklamaz, görmez.
        </li>
        <li>Tek çekim ve banka taksit seçenekleri sunulabilir.</li>
        <li>
          Sipariş onayı, ödemenin başarılı şekilde tahsil edilmesiyle birlikte
          oluşur.
        </li>
      </ul>

      <h2>5. Teslimat ve Süresi</h2>
      <ul>
        <li>
          Ürün, ALICI&rsquo;nın sipariş aşamasında belirttiği teslimat adresine
          anlaşmalı kargo firması (örn. Aras Kargo / Yurtiçi Kargo / MNG)
          aracılığıyla gönderilir.
        </li>
        <li>
          <strong>Tahmini teslim süresi (tasarım onayından sonra, iş günü):</strong>
          <ul>
            <li>
              <strong>Sticker siparişleri</strong>: en geç{" "}
              <strong>
                {PIM_PRODUCTION_BUSINESS_DAYS.sticker} (üç) iş günü
              </strong>{" "}
              içinde kargoya verilir.
            </li>
            <li>
              <strong>Tabaka etiket siparişleri</strong>: en geç{" "}
              <strong>
                {PIM_PRODUCTION_BUSINESS_DAYS.tabaka} (beş) iş günü
              </strong>{" "}
              içinde kargoya verilir.
            </li>
            <li>
              <strong>Rulo etiket siparişleri</strong>: en geç{" "}
              <strong>
                {PIM_PRODUCTION_BUSINESS_DAYS.rulo} (on) iş günü
              </strong>{" "}
              içinde kargoya verilir.
            </li>
          </ul>
          Kargonun ALICI&rsquo;ya ulaşması teslim adresine göre 1-3 iş günü
          sürebilir. Süre, ALICI&rsquo;nın tasarım dosyasını yüklemesinden
          ve kalite kontrolünden geçtikten sonra başlar.
        </li>
        <li>
          ALICI&rsquo;nın 3 (üç) iş günü içinde tasarım dosyasını
          yüklememesi halinde sipariş tek taraflı iptal edilir; ödenen tutar
          ALICI&rsquo;ya iade edilir.
        </li>
        <li>
          Yasal teslimat süresi en geç 30 (otuz) gündür; bu sürenin aşılması
          halinde ALICI sözleşmeyi feshedebilir, ödediği tutarı iade alabilir.
        </li>
      </ul>

      <h2>6. Cayma Hakkının Bulunmadığı Hususu</h2>
      <p>
        <strong>
          Pim Etiket üzerinden verilen tüm siparişler ALICI&rsquo;nın istek ve
          kişisel ihtiyaçlarına göre, kendisi tarafından sağlanan tasarım ve
          özellikler doğrultusunda münhasıran üretildiğinden,
        </strong>{" "}
        Mesafeli Sözleşmeler Yönetmeliği&rsquo;nin{" "}
        <strong>15. maddesi 1. fıkrası (b) bendi</strong> uyarınca{" "}
        <strong>tüketici cayma hakkını kullanamaz</strong>. Bu durum sipariş
        özetinde ve sözleşmenin yürürlüğe girmesi öncesinde ALICI&rsquo;ya
        açıkça bildirilir.
      </p>
      <p>
        Bu istisna; ürünün ayıplı, hatalı veya sipariş edilenden farklı çıkması
        halindeki <strong>yasal ayıplı mal hükümlerini etkilemez</strong>;
        ALICI&rsquo;nın bu çerçevedeki hakları saklıdır (bkz. madde 7).
      </p>

      <h2>7. Ayıplı Mal ve İade Koşulları</h2>
      <ul>
        <li>
          Üretim hatası, baskı bozukluğu, kargo hasarı veya sipariş edilen
          özelliklerden farklı ürün gönderimi durumlarında ALICI, teslim
          tarihinden itibaren <strong>7 (yedi) gün</strong> içinde fotoğraflı
          bildirim ile <a href="/iletisim">iletisim</a> kanallarımızdan
          başvurarak;
        </li>
        <li>Ücretsiz yeniden üretim, veya</li>
        <li>Ödenen tutarın iadesi</li>
        <li>
          haklarından birini seçebilir. Ayrıntılı koşullar{" "}
          <a href="/iade-degisim-politikasi">İade & Değişim Politikası</a>{" "}
          sayfasındadır.
        </li>
      </ul>

      <h2>8. Şikayet ve Uyuşmazlık Çözüm Mercileri</h2>
      <p>
        ALICI, sözleşmeden doğan uyuşmazlıklarda; Gümrük ve Ticaret
        Bakanlığı&rsquo;nın her yıl belirlediği parasal sınırlar dahilinde
        ikametgahının veya mal/hizmeti satın aldığı yerin{" "}
        <strong>Tüketici Hakem Heyeti&rsquo;ne</strong>, parasal sınırın
        üzerindeki uyuşmazlıklarda ise <strong>Tüketici Mahkemesi&rsquo;ne</strong>{" "}
        başvurabilir.
      </p>
      <p>
        Şikayetlerinizi öncelikle{" "}
        <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>{" "}
        adresine veya <a href="/iletisim">/iletisim</a> sayfasındaki kanallarımıza
        iletebilirsiniz; tarafımıza ulaşan başvurular en geç 15 gün içinde
        yanıtlanır.
      </p>

      <h2>9. Kişisel Verilerin Korunması</h2>
      <p>
        ALICI&rsquo;nın sipariş, ödeme, teslimat ve iletişim sürecinde
        verdiği kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması
        Kanunu kapsamında işlenir. Aydınlatma metni{" "}
        <a href="/kvkk">/kvkk</a>, gizlilik uygulamaları{" "}
        <a href="/gizlilik">/gizlilik</a>, çerez kullanımı{" "}
        <a href="/cerez">/cerez</a> sayfalarında detaylıca açıklanmıştır.
      </p>

      <h2>10. Sözleşme Süresi ve Yürürlük</h2>
      <p>
        İşbu ön bilgilendirme formu, ALICI&rsquo;nın sipariş ve ödeme
        akışındaki onay kutucuklarını işaretleyip ödeme adımını
        tamamlamasıyla birlikte; aynı anda yürürlüğe girecek olan{" "}
        <a href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</a>&rsquo;nin
        ayrılmaz parçası niteliğindedir. Sözleşme, ürünlerin teslimi ve
        karşılıklı yükümlülüklerin yerine getirilmesi ile sona erer.
      </p>

      <h2>11. Yasal Dayanak</h2>
      <ul>
        <li>6502 sayılı Tüketicinin Korunması Hakkında Kanun</li>
        <li>Mesafeli Sözleşmeler Yönetmeliği (R.G. 27.11.2014/29188)</li>
        <li>6698 sayılı Kişisel Verilerin Korunması Kanunu</li>
        <li>5651 sayılı İnternet Ortamında Yapılan Yayınlar Kanunu</li>
      </ul>
    </LegalLayout>
  );
}
