import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "6698 sayılı KVKK kapsamında Pim Etiket'in kişisel veri işleme aydınlatma metni.",
  alternates: { canonical: "/kvkk" },
};

export default function KvkkPage() {
  return (
    <LegalLayout
      title="KVKK Aydınlatma Metni"
      lastUpdated="8 Mayıs 2026"
      currentPath="/kvkk"
    >
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&ldquo;KVKK&rdquo;)
        kapsamında veri sorumlusu sıfatıyla, kişisel verilerinizin işlenme
        amaçları, hukuki dayanakları, paylaşılma esasları ve haklarınız
        hakkında sizleri aydınlatmak istiyoruz.
      </p>

      <h2>1. Veri Sorumlusu</h2>
      <p>
        <strong>
          SEFA YAKUT ETİKETBOX KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ
        </strong>{" "}
        (&ldquo;Pim Etiket&rdquo;)
        <br />
        Vergi Dairesi / No: Doğanbey Vergi Dairesi / 7580607612
        <br />
        Ana Faaliyet: 464903 — Kırtasiye Ürünleri Toptan Ticareti
        <br />
        Tebligat Adresi:{" "}
        <em>
          (Yeni iş yeri kayıt değişikliği sürecinde — adres güncellenecektir)
        </em>
        <br />
        E-posta: <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>
        <br />
        Web: <a href="https://pimetiket.com">pimetiket.com</a>
      </p>

      <h2>2. İşlenen Kişisel Veri Kategorileri</h2>
      <ul>
        <li>
          <strong>Kimlik bilgileri</strong>: ad-soyad, T.C. kimlik no
          (e-fatura için), vergi numarası (kurumsal müşteriler)
        </li>
        <li>
          <strong>İletişim bilgileri</strong>: e-posta, telefon, teslim ve
          fatura adresi
        </li>
        <li>
          <strong>Müşteri işlem bilgileri</strong>: sipariş geçmişi, ödeme
          kayıtları, fatura tipi tercihleri
        </li>
        <li>
          <strong>İşlem güvenliği</strong>: IP adresi, tarayıcı bilgileri,
          oturum kayıtları, cihaz ID
        </li>
        <li>
          <strong>Pazarlama</strong>: e-posta bültenleri açılma/tıklanma
          (yalnız onay verilirse)
        </li>
        <li>
          <strong>Görsel kayıtlar</strong>: Atölye ziyareti yapılırsa
          güvenlik kameralarınca kaydedilen görüntüler (atölyede yazılı
          olarak duyurulur)
        </li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Sipariş alımı, üretim ve teslim sürecinin yürütülmesi</li>
        <li>Yasal yükümlülüklerin yerine getirilmesi (e-fatura, vergi)</li>
        <li>Müşteri destek hizmetlerinin sağlanması</li>
        <li>Site güvenliği ve dolandırıcılık tespiti</li>
        <li>İzin verirseniz pazarlama iletişimi</li>
      </ul>

      <h2>4. Hukuki Sebep</h2>
      <p>
        Kişisel verileriniz KVKK&rsquo;nın 5. maddesinde belirtilen şu
        hukuki sebeplere dayanılarak işlenir:
      </p>
      <ul>
        <li>Sözleşmenin kurulması veya ifası için zorunlu olması (m.5/2-c)</li>
        <li>Hukuki yükümlülüğün yerine getirilmesi için zorunlu olması (m.5/2-ç)</li>
        <li>Meşru menfaat (site güvenliği, dolandırıcılık önleme) (m.5/2-f)</li>
        <li>Açık rızanız (pazarlama iletişimi için)</li>
      </ul>

      <h2>5. Aktarım</h2>
      <p>
        Kişisel verileriniz şu kategorideki taraflarla, yalnızca işlenme
        amaçlarıyla sınırlı olarak paylaşılır:
      </p>
      <ul>
        <li>
          <strong>Fason üretim ortakları</strong>: ad-soyad, teslim adresi,
          sipariş detayları (üretim için zorunlu)
        </li>
        <li>
          <strong>Kargo firması</strong>: ad-soyad, telefon, teslim adresi
        </li>
        <li>
          <strong>Ödeme aracı kuruluşları</strong>: 3D Secure süreci için
          gerekli kart bilgileri (Pim Etiket kart numarasını saklamaz)
        </li>
        <li>
          <strong>e-Fatura entegratörü</strong>: fatura zorunlu unsurları
        </li>
        <li>
          <strong>Yasal merciler</strong>: yetkili kamu kurum ve kuruluşlarının
          yasal taleplerine yanıt olarak
        </li>
      </ul>
      <p>
        Verileriniz <strong>3. kişilerle reklam/pazarlama amacıyla
        satılmaz veya paylaşılmaz</strong>.
      </p>

      <h2>6. Saklama Süreleri</h2>
      <ul>
        <li>Sipariş ve fatura kayıtları: yasal asgari 10 yıl (VUK)</li>
        <li>Müşteri hesabı (aktif): hesap silinmedikçe</li>
        <li>Hesap silindikten sonra: yasal yükümlülük süresi kadar</li>
        <li>Tasarım dosyaları: sipariş tamamlandıktan 90 gün sonra silinir</li>
      </ul>

      <h2>7. Haklarınız (KVKK m.11)</h2>
      <p>
        KVKK&rsquo;nın 11. maddesi uyarınca:
      </p>
      <ul>
        <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
        <li>İşlenmişse buna ilişkin bilgi talep etme</li>
        <li>İşlenme amacı ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
        <li>Yurt içinde/dışında aktarıldığı 3. kişileri öğrenme</li>
        <li>Eksik/yanlış işlenmişse düzeltilmesini isteme</li>
        <li>KVKK m.7&rsquo;de öngörülen koşullar çerçevesinde silinmesini/yok edilmesini isteme</li>
        <li>Yapılan işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
        <li>İşlenmenin münhasıran otomatik sistemlerle analizi sonucu aleyhinize bir sonuç ortaya çıkmasına itiraz etme</li>
        <li>Kanuna aykırı işlenmesi sebebiyle zarara uğraması halinde tazminini talep etme</li>
      </ul>

      <h2>8. Başvuru</h2>
      <p>
        Yukarıdaki haklarınızı kullanmak için <a href="/iletisim">iletişim</a>{" "}
        sayfasındaki kanallar üzerinden bize ulaşabilirsiniz. Başvurularınız
        en geç 30 gün içinde ücretsiz olarak sonuçlandırılır.
      </p>
    </LegalLayout>
  );
}
