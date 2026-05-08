import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Kullanım Şartları",
  description: "Pim Etiket platformunu kullanmaya ilişkin genel şartlar ve koşullar.",
  alternates: { canonical: "/sartlar" },
};

export default function SartlarPage() {
  return (
    <LegalLayout
      title="Kullanım Şartları"
      lastUpdated="8 Mayıs 2026"
      currentPath="/sartlar"
    >
      <p>
        İşbu Kullanım Şartları, pimetiket.com web sitesinin (&ldquo;Site&rdquo;)
        ziyaret edilmesi ve hizmetlerinden yararlanılması ile ilgili kuralları
        düzenler. Sitenin herhangi bir bölümünü kullanarak bu şartları kabul
        etmiş sayılırsınız.
      </p>

      <h2>1. Hizmet Kapsamı</h2>
      <p>
        Pim Etiket, kullanıcılarına dijital baskı (rulo etiket ve sticker)
        siparişi verme, dosya yükleme, AI destekli kalite kontrolü, prova
        onayı ve fason ortaklar üzerinden üretim ile teslim hizmetleri sunar.
      </p>

      <h2>2. Hesap Açma ve Sorumluluk</h2>
      <ul>
        <li>
          Site&rsquo;de hesap açmak için 18 yaşını doldurmuş olmanız gerekir
        </li>
        <li>
          Verdiğiniz bilgilerin doğru ve güncel olduğunu beyan edersiniz
        </li>
        <li>
          Hesap güvenliği (şifre koruması) sizin sorumluluğunuzdadır
        </li>
        <li>
          Hesabınız üzerinden gerçekleştirilen işlemlerden siz sorumlusunuz
        </li>
      </ul>

      <h2>3. İçerik ve Telif Hakları</h2>
      <h3>Site içerikleri</h3>
      <p>
        Site&rsquo;de yer alan tüm görseller, metinler, logolar (Pim mascot
        dahil), tasarımlar ve yazılımlar Pim Etiket&rsquo;e aittir veya
        lisanslıdır. İzinsiz kopyalanması, çoğaltılması veya kullanılması
        yasaktır.
      </p>

      <h3>Yüklediğiniz tasarımlar</h3>
      <ul>
        <li>
          Yüklediğiniz tasarımın <strong>fikri mülkiyet hakkına sahip
          olduğunuzu</strong> veya kullanım izninizi aldığınızı beyan edersiniz
        </li>
        <li>
          Tasarımınızda 3. taraf marka, logo veya telif hakkıyla korunan içerik
          bulunmadığını beyan edersiniz
        </li>
        <li>
          Aksinin tespit edilmesi halinde sipariş tek taraflı iptal edilir;
          oluşacak hukuki sorumluluk size aittir
        </li>
        <li>
          Tasarımınız sadece sipariş edilen ürünün üretiminde kullanılır;
          başka bir amaçla kullanılmaz, 3. kişilerle paylaşılmaz
        </li>
      </ul>

      <h2>4. Yasaklı İçerik</h2>
      <p>
        Aşağıdaki içerikleri taşıyan tasarımlar reddedilir ve sipariş
        iptal edilir:
      </p>
      <ul>
        <li>Yasalara, kamu düzenine ve genel ahlaka aykırı içerik</li>
        <li>3. tarafların telif hakkı veya marka haklarını ihlal eden içerik</li>
        <li>Şiddet, nefret söylemi, cinsel içerik teşvik eden materyal</li>
        <li>Yanıltıcı tıbbi veya bilimsel iddialar</li>
        <li>Yasaklı ürünlerin tanıtımını yapan içerik</li>
      </ul>
      <p>
        AI destekli ön kontrol ve operatör manuel kontrolü bu kuralların
        uygulanmasını sağlar; nihai red yetkisi Pim Etiket&rsquo;tedir.
      </p>

      <h2>5. Sorumluluk Sınırları</h2>
      <ul>
        <li>
          Sitenin kesintisiz çalışacağı garanti edilmez. Bakım, güncelleme
          veya teknik aksaklıklar nedeniyle hizmet kesintileri oluşabilir.
        </li>
        <li>
          AI destekli kalite kontrolü <strong>yardımcı niteliktedir</strong>;
          tasarımın baskı kalitesi ve içeriği nihai sorumluluğu sizdedir.
        </li>
        <li>
          Mücbir sebep, kargo gecikmeleri, fason ortak kaynaklı gecikmeler
          için doğrudan sorumluluk üstlenilmez. Detaylar{" "}
          <a href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</a>nde.
        </li>
      </ul>

      <h2>6. Hesap Askıya Alma ve Fesih</h2>
      <p>
        Aşağıdaki durumlarda hesap askıya alınabilir veya silinebilir:
      </p>
      <ul>
        <li>İşbu şartlara aykırı kullanım</li>
        <li>Yanıltıcı veya sahte bilgi sağlanması</li>
        <li>Site veya diğer kullanıcılara yönelik kötü niyetli faaliyet</li>
        <li>Yasal kurum kararı</li>
      </ul>
      <p>
        Kullanıcı olarak siz de hesabınızı istediğiniz zaman silebilirsiniz.
        Hesap silme talebiniz <a href="/iletisim">iletişim</a> kanallarından
        iletilebilir.
      </p>

      <h2>7. Değişiklikler</h2>
      <p>
        İşbu şartlar Pim Etiket tarafından zaman zaman güncellenebilir.
        Önemli değişiklikler kayıtlı kullanıcılara e-posta ile bildirilir.
        Site&rsquo;yi kullanmaya devam etmeniz güncel şartları kabul ettiğiniz
        anlamına gelir.
      </p>

      <h2>8. Yetkili Mahkeme ve Hukuk</h2>
      <p>
        İşbu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Doğacak
        uyuşmazlıklarda, tüketici işlemleri için Tüketici Hakem Heyetleri
        ve Tüketici Mahkemeleri; ticari uyuşmazlıklarda Bursa Mahkemeleri ve
        İcra Daireleri yetkilidir.
      </p>

      <h2>9. İletişim</h2>
      <p>
        İşbu şartlarla ilgili sorularınız için{" "}
        <a href="/iletisim">iletişim</a> sayfasını kullanabilirsiniz.
      </p>
    </LegalLayout>
  );
}
