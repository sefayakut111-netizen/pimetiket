import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Gizlilik Politikası",
  description:
    "Pim Etiket'in gizlilik politikası ve kişisel veri işleme prensipleri.",
  alternates: { canonical: "/gizlilik" },
};

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
          <strong>Sizin verdiğiniz</strong>: hesap kaydı, sipariş, iletişim
          formu doldururken paylaştığınız bilgiler
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

      <h2>4. Üçüncü Taraf Hizmetler</h2>
      <p>
        Aşağıdaki hizmetler kullanıcı bilgileriniz işleyebilir:
      </p>
      <ul>
        <li>
          <strong>Ödeme aracı kuruluşu</strong>: [Sefa not: iyzico/ParamPOS]
        </li>
        <li>
          <strong>Kargo firması</strong>: [Sefa not]
        </li>
        <li>
          <strong>e-Fatura sağlayıcısı</strong>: [Sefa not]
        </li>
        <li>
          <strong>Web analitik</strong>: PostHog veya Google Analytics 4
          (anonim bot)
        </li>
        <li>
          <strong>E-posta gönderim</strong>: [Sefa not: Resend/Mailgun]
        </li>
      </ul>

      <h2>5. Güvenlik</h2>
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

      <h2>6. Çocukların Gizliliği</h2>
      <p>
        Pim Etiket 18 yaş altı kişilere yönelik bir hizmet sunmaz. 18 yaş
        altı bir kişiden bilerek veri toplanmaz; fark ettiğimizde derhal
        sileriz.
      </p>

      <h2>7. Politika Değişiklikleri</h2>
      <p>
        İşbu politika güncellenebilir; önemli değişiklikler için kayıtlı
        kullanıcılarımıza e-posta ile bildirim gönderilir. Sayfanın üst
        kısmındaki &ldquo;Son güncelleme&rdquo; tarihinden son revizyonu
        takip edebilirsiniz.
      </p>

      <h2>8. İletişim</h2>
      <p>
        Gizlilik politikamızla ilgili sorularınız için{" "}
        <a href="/iletisim">iletişim</a> sayfası üzerinden bize ulaşabilirsiniz.
      </p>
    </LegalLayout>
  );
}
