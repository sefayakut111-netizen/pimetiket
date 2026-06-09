import { LegalLayout } from "@/components/legal/LegalLayout";
import { ManageCookiesButton } from "@/components/ManageCookiesButton";
import { legalPageMetadata } from "@/lib/seo/legal-metadata";

export const metadata = legalPageMetadata(
  "Çerez Politikası",
  "Pim Etiket'te kullanılan çerezler, amaçları ve tarayıcı tercihleri.",
  "/cerez"
);

export default function CerezPage() {
  return (
    <LegalLayout
      title="Çerez Politikası"
      lastUpdated="10 Mayıs 2026"
      currentPath="/cerez"
    >
      <div className="not-prose mb-6 p-4 rounded-lg bg-pim-mercan-tint/40 ring-1 ring-pim-mercan-soft">
        <p className="text-[14px] text-lacivert mb-3">
          Mevcut tercihlerini gözden geçirmek veya değiştirmek istersen:
        </p>
        <ManageCookiesButton className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-pim-mercan text-white text-[14px] font-semibold hover:bg-pim-mercan-koyu transition-colors">
          🍪 Çerez tercihlerimi yönet
        </ManageCookiesButton>
      </div>

      <p>
        Pim Etiket olarak, sitemizin işlevselliğini sağlamak, deneyiminizi
        iyileştirmek ve site kullanım istatistiklerini analiz etmek için
        çerezler kullanıyoruz. Bu sayfa hangi çerezleri neden kullandığımızı
        ve nasıl kontrol edebileceğinizi açıklar.
      </p>

      <h2>Çerez Nedir?</h2>
      <p>
        Çerez (cookie), ziyaret ettiğiniz web siteleri tarafından tarayıcınıza
        kaydedilen küçük metin dosyalarıdır. Bir sonraki ziyaretinizde sitenin
        sizi tanımasını, tercihlerinizi hatırlamasını sağlar.
      </p>

      <h2>Kullandığımız Çerez Kategorileri</h2>

      <h3>1. Zorunlu Çerezler</h3>
      <p>
        Site temel işlevleri için gereklidir; reddedilemez. Bu olmadan site
        çalışmaz.
      </p>
      <ul>
        <li>
          <strong>Oturum yönetimi</strong>: kullanıcı girişinizi sürdürür
        </li>
        <li>
          <strong>Sepet</strong>: ürünleri sepetinizde tutmak için
        </li>
        <li>
          <strong>CSRF token</strong>: form gönderimlerinizi güvenli kılmak için
        </li>
      </ul>

      <h3>2. Tercih Çerezleri</h3>
      <p>
        Site tercihlerinizi hatırlar. Reddedebilirsiniz ama deneyiminiz
        düşebilir.
      </p>
      <ul>
        <li>Konfigüratör son seçimleri (yenilenince hatırlatma)</li>
        <li>Yardım balonları okundu işaretleri</li>
      </ul>

      <h3>3. Analitik Çerezler</h3>
      <p>
        Sitenin nasıl kullanıldığını anlamak için anonim istatistikler toplar.
        Reddedebilirsiniz.
      </p>
      <ul>
        <li>
          <strong>PostHog veya GA4</strong>: hangi sayfalar ziyaret ediliyor,
          kullanıcılar nereden geliyor, hangi cihazlarda görülüyor
        </li>
      </ul>

      <h3>4. Pazarlama Çerezleri</h3>
      <p>
        Şu an pazarlama çerezleri kullanılmaz. İleride kullanılırsa açık
        rıza alınır.
      </p>

      <h2>Çerezleri Nasıl Kontrol Edersiniz?</h2>
      <ul>
        <li>
          <strong>Tarayıcı ayarları</strong>: Tarayıcınızın gizlilik
          ayarlarından çerezleri reddedebilir, mevcut çerezleri silebilirsiniz
        </li>
        <li>
          <strong>Site içi</strong>: İlk ziyaret çerez bandı üzerinden
          analitik/tercih çerezlerini reddedebilirsiniz (zorunlu çerezler
          dışında)
        </li>
        <li>
          <strong>Tarayıcı eklentileri</strong>: uBlock Origin, Privacy Badger,
          Ghostery gibi araçlar çerez yönetimini kolaylaştırır
        </li>
      </ul>

      <h2>Çerez Süreleri</h2>
      <ul>
        <li>
          <strong>Oturum çerezleri</strong>: tarayıcı kapanınca silinir
        </li>
        <li>
          <strong>Kalıcı çerezler</strong>: en fazla 1 yıl
        </li>
      </ul>

      <h2>Üçüncü Taraf Çerezler</h2>
      <p>
        Aşağıdaki üçüncü taraf hizmetler kendi çerezlerini ayarlayabilir:
      </p>
      <ul>
        <li>
          <strong>PostHog / GA4</strong> — kullanım analizi
        </li>
        <li>
          <strong>3D Secure ödeme sayfası</strong> — banka tarafından kullanıcı
          doğrulama
        </li>
      </ul>

      <h2>Politika Güncellemeleri</h2>
      <p>
        Çerez kullanımımız değişirse bu sayfa güncellenir. Kayıtlı
        kullanıcılarımıza önemli değişiklikler e-posta ile bildirilir.
      </p>

      <h2>İletişim</h2>
      <p>
        Çerez politikamızla ilgili sorularınız için{" "}
        <a href="/iletisim">iletişim</a> sayfası üzerinden bize yazabilirsiniz.
      </p>
    </LegalLayout>
  );
}
