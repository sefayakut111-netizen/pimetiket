import { LegalLayout } from "@/components/legal/LegalLayout";
import { legalPageMetadata } from "@/lib/seo/legal-metadata";

export const metadata = legalPageMetadata(
  "Gizlilik Politikası",
  "Pim Etiket'in gizlilik politikası ve kişisel veri işleme prensipleri.",
  "/gizlilik"
);

export default function GizlilikPage() {
  return (
    <LegalLayout
      title="Gizlilik Politikası"
      lastUpdated="8 Mayıs 2026"
      currentPath="/gizlilik"
    >
      <p>
        İşbu Gizlilik Politikası, pimetiket.com&rsquo;u ziyaret eden veya
        hizmetlerimizden yararlanan kullanıcıların kişisel verilerinin nasıl
        toplandığını, kullanıldığını ve korunduğunu açıklar.{" "}
        <a href="/kvkk">KVKK Aydınlatma Metni</a> bu politikanın hukuki
        uzantısıdır.
      </p>

      <h2>1. Topladığımız Bilgiler</h2>
      <p>İki kategori veri toplarız:</p>
      <ul>
        <li>
          <strong>Senin verdiğin</strong>: hesap kaydı, sipariş, iletişim
          formu doldururken paylaştığın bilgiler
        </li>
        <li>
          <strong>Otomatik toplanan</strong>: IP adresi, tarayıcı, cihaz tipi,
          sayfa görüntülemeleri (analitik amaçlı)
        </li>
      </ul>

      <h2>2. Bu Bilgileri Nasıl Kullanırız</h2>
      <ul>
        <li>Sipariş aldığınız ürün/hizmeti sağlamak</li>
        <li>Müşteri destek taleplerinizi yanıtlamak</li>
        <li>Site güvenliğini sağlamak ve dolandırıcılığı önlemek</li>
        <li>Yasal yükümlülüklerimizi yerine getirmek</li>
        <li>İzin verdiyseniz pazarlama iletişimi göndermek</li>
      </ul>

      <h2>3. Çerez Kullanımı</h2>
      <p>
        Sitemiz oturum yönetimi, sepet hatırlama ve analitik amaçlı
        çerezler kullanır. Detaylar{" "}
        <a href="/cerez">Çerez Politikası</a>nda yer alır.
      </p>

      <h2 id="4-uretim-ortaklarimiz">4. Baskı Üretim Ortaklarımız</h2>
      <p>
        Pim Etiket <strong>anlaşmalı baskı atölyeleriyle</strong> çalışır
        (sektörde &ldquo;fason üretim&rdquo; olarak bilinen model)
        &mdash; sipariş ettiğin ürünlerin baskı işlemini İstanbul ve
        Ankara&rsquo;daki üretim ortaklarımız yapar. Bu ortaklarımıza şu
        verilerin aktarılır:
      </p>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gri-300">
              <th className="text-left py-2 pr-4 font-semibold">Veri</th>
              <th className="text-left py-2 font-semibold">Neden</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Ad soyad</td>
              <td className="py-2">Kargo etiketinde gerekli</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Adres + telefon</td>
              <td className="py-2">Kargo teslimatı için zorunlu</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Tasarım dosyası</td>
              <td className="py-2">Üretimde kullanılır</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Sipariş detayları</td>
              <td className="py-2">Ürünü doğru üretmek için</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>Önemli güvenceler:</strong>
      </p>
      <ul>
        <li>
          Üretim ortaklarımız sadece <strong>senin siparişin</strong>{" "}
          için bu verileri kullanabilir. Başka müşteriye ürettiremez,
          sosyal medyada yayımlayamaz, portfolyo olarak gösteremez.
        </li>
        <li>
          <strong>Üretim bittikten en geç 30 gün sonra</strong> elindeki
          tüm verileri ve tasarım dosyasını silmek/imha etmek zorundadır.
        </li>
        <li>
          <strong>
            Tasarım dosyaların şifreli ve süre sınırlı bağlantılar (signed
            URL) ile gönderilir.
          </strong>{" "}
          İlgili sipariş bittiğinde bu bağlantı kendiliğinden geçersiz olur.
        </li>
        <li>
          Tüm üretim ortaklarımızla{" "}
          <strong>veri işleyici sözleşmemiz</strong> vardır; ihlal halinde
          Pim Etiket sorumlu kılınır ve ortağa rücu eder.
        </li>
      </ul>
      <p>
        Üretim ortağımıza aktarılan verilerinin durumu hakkında bilgi
        almak veya başvuru yapmak için{" "}
        <a href="/iletisim">iletişim sayfası</a> üzerinden bize
        ulaşabilirsin. Doğrudan üretim ortağına yapılan başvurular bize
        iletilir.
      </p>

      <h2>5. Diğer Üçüncü Taraf Hizmetler</h2>
      <p>
        Aşağıdaki hizmetler kullanıcı bilgilerini işleyebilir:
      </p>
      <ul>
        <li>
          <strong>Ödeme aracı kuruluşu</strong>: PayTR Ödeme Hizmetleri A.Ş.
          (BDDK lisanslı, PCI-DSS sertifikalı). Kart bilgilerin doğrudan
          PayTR&rsquo;ye iletilir; Pim Etiket bu verileri saklamaz, görmez.
        </li>
        <li>
          <strong>Kargo firmaları</strong>: Yurtiçi Kargo, Aras Kargo, MNG
          Kargo. Sipariş kargoya verildiğinde ad-soyad, teslimat adresi ve
          telefon bilgileri seçilen kargo firması ile paylaşılır.
        </li>
        <li>
          <strong>Veritabanı & Auth altyapısı</strong>: Supabase (AWS Frankfurt
          eu-central-1 — KVKK ile uyumlu AB veri merkezi).
        </li>
        <li>
          <strong>Hosting altyapısı</strong>: Vercel (CDN ve fonksiyon
          işleme; AB ve global edge node&rsquo;lar).
        </li>
        <li>
          <strong>E-posta gönderim</strong>: Google Workspace
          (info@pimetiket.com gelen kutusu) ve Resend Inc. (ABD —
          transactional sipariş/iade/hatırlatma bildirimleri için aktif).
        </li>
        <li>
          <strong>Yapay zeka asistanı</strong>: OpenAI API (Pim sohbet için
          GPT-4o / GPT-4o-mini). Sohbet içerikleri OpenAI&rsquo;ye iletilir
          ancak model eğitiminde kullanılmaz (API tier kuralı).
        </li>
        <li>
          <strong>Web analitik</strong>: Google Analytics 4 ve/veya PostHog —
          yalnızca KVKK çerez izni verildiğinde aktive edilir.
        </li>
      </ul>

      <h2>6. Güvenlik</h2>
      <p>
        Verileriniz endüstri standardı önlemlerle korunur:
      </p>
      <ul>
        <li>Tüm trafik HTTPS (TLS 1.3) üzerinden şifrelenir</li>
        <li>Şifreler bcrypt ile hash&rsquo;lenir, ham olarak saklanmaz</li>
        <li>3D Secure ödeme akışı; kart bilgileriniz Pim Etiket sunucularında saklanmaz</li>
        <li>Veritabanı erişimi sıkı yetkilendirme + audit log</li>
        <li>Düzenli yedekleme ve felaket kurtarma planı</li>
      </ul>

      <h2>7. Çocukların Gizliliği</h2>
      <p>
        Pim Etiket 18 yaş altı kişilere yönelik bir hizmet sunmaz. 18 yaş
        altı bir kişiden bilerek veri toplanmaz; fark ettiğimizde derhal
        sileriz.
      </p>

      <h2>8. Politika Değişiklikleri</h2>
      <p>
        İşbu politika güncellenebilir; önemli değişiklikler için kayıtlı
        kullanıcılarımıza e-posta ile bildirim gönderilir. Sayfanın üst
        kısmındaki &ldquo;Son güncelleme&rdquo; tarihinden son revizyonu
        takip edebilirsiniz.
      </p>

      <h2>9. İletişim</h2>
      <p>
        Gizlilik politikamızla ilgili sorularınız için{" "}
        <a href="/iletisim">iletişim</a> sayfası üzerinden bize ulaşabilirsiniz.
      </p>
    </LegalLayout>
  );
}
