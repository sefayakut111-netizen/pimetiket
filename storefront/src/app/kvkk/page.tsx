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
        kapsamında veri sorumlusu sıfatıyla, kişisel verilerinin işlenme
        amaçları, hukuki dayanakları, paylaşılma esasları ve hakların
        hakkında seni aydınlatmak istiyoruz.
      </p>

      <h2>1. Veri Sorumlusu</h2>
      <p>
        <strong>
          SEFA YAKUT KIRTASİYE BASKI TİCARET LİMİTED ŞİRKETİ
        </strong>{" "}
        (&ldquo;Pim Etiket&rdquo;)
        <br />
        Vergi Dairesi / No: Doğanbey Vergi Dairesi / 7580607612
        <br />
        Mersis No: 0758060761200001 · Tic. Sicil No: 493212
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
          telefon, sipariş detayları ve tasarım dosyası (üretim için zorunlu —
          aşağıda detaylı açıklama)
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

      <h3 className="text-base font-semibold mt-5">
        5.1 Üretim Ortakları (Fason İşletmeler)
      </h3>
      <p>
        Sipariş ettiğin baskı ürününün üretimi için anlaşmalı{" "}
        <strong>fason üretim ortaklarımıza</strong> aşağıdaki verilerin
        aktarılır:
      </p>
      <ul>
        <li>Ad soyad (kargo etiketi için)</li>
        <li>Teslimat adresi ve telefon (kargo için)</li>
        <li>Sipariş detayları (ölçü, malzeme, adet, kesim tipi)</li>
        <li>Yüklediğin tasarım dosyası (üretim için)</li>
      </ul>
      <p>
        <strong>Aktarım amacı:</strong> Sipariş edilen ürünün üretiminin
        gerçekleştirilmesi ve kargolanması (KVKK m.5/2-c &mdash;
        &ldquo;sözleşmenin ifası&rdquo;).
      </p>
      <p>
        <strong>Yasal dayanak:</strong> KVKK m.8/2-a uyarınca, sözleşmenin
        ifası için zorunlu olduğunda açık rıza aranmaksızın aktarım yapılır.
      </p>
      <p>
        <strong>Veri işleyen statüsü:</strong> Fason ortaklarımız KVKK
        m.3/1-ı uyarınca &ldquo;veri işleyen&rdquo; sıfatına sahiptir;
        bizimle imzalı veri işleyici sözleşmesi olmadan veri aktarımı
        yapılmaz.
      </p>
      <p>
        <strong>Sözleşmesel güvenceler:</strong> Tüm fason ortaklarımızla:
      </p>
      <ul>
        <li>Sadece ilgili sipariş için kullanım taahhüdü</li>
        <li>Üretim sonrası en fazla 30 gün içinde imha yükümlülüğü</li>
        <li>Başkasına aktarım yasağı</li>
        <li>Çalışan gizlilik taahhütleri</li>
        <li>Veri ihlali halinde 24 saat içinde bildirim</li>
      </ul>
      <p>
        yükümlülüklerini içeren bağlayıcı sözleşmeler imzalanmıştır.
      </p>
      <p>
        <strong>Yurt dışı aktarım YAPILMAZ.</strong> Tüm fason ortaklarımız
        Türkiye sınırları içinde faaliyet gösterir.
      </p>

      <h3 className="text-base font-semibold mt-5">
        5.2 Ödeme Altyapısı (PayTR Ödeme Hizmetleri A.Ş.)
      </h3>
      <p>
        Ödeme bilgilerin (kart maskeli, fatura için TC veya VKN, fatura
        adresi) BDDK lisanslı, PCI-DSS sertifikalı PayTR Ödeme Hizmetleri
        A.Ş. üzerinden işlenir. Kart numarası Pim Etiket sunucularında
        saklanmaz, görmez. 3D Secure süreci tamamen PayTR tarafında
        yürütülür.
      </p>
      <ul>
        <li>
          <strong>Yer:</strong> Türkiye (PayTR Ödeme Hizmetleri A.Ş.)
        </li>
        <li>
          <strong>Hukuki sebep:</strong> KVKK m.5/2-c (sözleşmenin ifası
          için zorunlu) + 6493 Sayılı Ödeme Hizmetleri Kanunu
        </li>
        <li>
          <strong>Saklama:</strong> VUK kapsamında 10 yıl (fatura
          eşleştirmesi için)
        </li>
      </ul>

      <h3 className="text-base font-semibold mt-5">
        5.3 AI Sohbet Asistanı &ldquo;Pim&rdquo; (OpenAI &mdash; Yurt Dışı)
      </h3>
      <p>
        Site genelinde sağ altta açtığın <strong>Pim sohbet asistanı</strong>{" "}
        OpenAI Inc. (Amerika Birleşik Devletleri) altyapısını kullanır.
        Sohbet içerikleri (yazdığın mesajlar, kullanım bağlamı) işlenmek
        üzere ABD&rsquo;deki sunuculara aktarılır.
      </p>
      <ul>
        <li>
          <strong>Yer:</strong> ABD (OpenAI LLC)
        </li>
        <li>
          <strong>Hukuki sebep:</strong> KVKK m.9 &mdash; yurt dışı
          aktarım, <strong>açık rızana</strong> dayanır. Sohbeti
          başlatman bu rızayı verdiğin anlamına gelir.
        </li>
        <li>
          <strong>Saklama:</strong> 6 ay sonra anonimleştirilir, 24 ay
          sonra silinir
        </li>
        <li>
          <strong>Garanti:</strong> OpenAI API tier sözleşmesi uyarınca
          sohbet içerikleri{" "}
          <strong>model eğitiminde kullanılmaz</strong>.
        </li>
        <li>
          <strong>İstemiyorsan:</strong> Pim sohbeti açma. Sipariş süreci
          Pim olmadan da tamamen çalışır.
        </li>
      </ul>

      <h3 className="text-base font-semibold mt-5">
        5.4 E-posta Bildirim Altyapısı (Resend &mdash; Yurt Dışı)
      </h3>
      <p>
        Sipariş bildirim, prova hazır, kargo bilgisi gibi e-postaları{" "}
        <strong>Resend Inc. (ABD)</strong> altyapısı üzerinden iletiriz.
        E-postan ve adın bu hizmete aktarılır.
      </p>
      <ul>
        <li>
          <strong>Yer:</strong> ABD (Resend Inc.)
        </li>
        <li>
          <strong>Hukuki sebep:</strong> Sipariş bildirimleri için KVKK
          m.5/2-c (sözleşmenin ifası &mdash; zorunlu). Pazarlama
          bültenleri için <strong>ayrı açık rıza</strong> alınır.
        </li>
        <li>
          <strong>Bültenleri istemiyorsan:</strong> profil ayarlarından
          istediğin an kapatabilirsin.
        </li>
      </ul>

      <h3 className="text-base font-semibold mt-5">
        5.5 Bulut Barındırma (Supabase &mdash; Frankfurt / Vercel &mdash; ABD)
      </h3>
      <p>
        Site veritabanı, dosya depolama ve oturum yönetimi <strong>
        Supabase&rsquo;in Frankfurt (Almanya, eu-central-1) sunucularında
        </strong>{" "}
        tutulur &mdash; KVKK ile uyumlu AB veri merkezi.
        Web sunucu (HTML/JS gönderimi) ise <strong>Vercel&rsquo;in
        global edge ağında</strong> çalışır (ABD merkezli).
      </p>
      <ul>
        <li>
          <strong>Kalıcı veri:</strong> Frankfurt (AB), KVKK m.9 standart
          sözleşme uyumlu
        </li>
        <li>
          <strong>Geçici/cache veri:</strong> Vercel edge node&rsquo;ları
          (kişisel veri uzun süre tutulmaz, sayfa cache amaçlı)
        </li>
        <li>
          <strong>Hukuki sebep:</strong> KVKK m.5/2-c (sözleşmenin ifası)
          + meşru menfaat (site güvenliği, performans)
        </li>
      </ul>

      <h2>6. Saklama Süreleri</h2>
      <p>
        Verini ne kadar tutuyoruz, neden tutuyoruz, ne zaman ne oluyor &mdash;
        hepsi açık. Aşağıdaki süreler hukuki dayanak ve iş gerekçelerimizle
        belirlenmiştir.
      </p>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gri-300">
              <th className="text-left py-2 pr-4 font-semibold">Veri</th>
              <th className="text-left py-2 pr-4 font-semibold">Süre</th>
              <th className="text-left py-2 font-semibold">Yasal/iş dayanağı</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Sipariş ve fatura kayıtları</td>
              <td className="py-2 pr-4 font-semibold">10 yıl</td>
              <td className="py-2 text-gri-700">TTK m.82 + VUK m.253</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Müşteri hesabı + adres defteri</td>
              <td className="py-2 pr-4 font-semibold">Hesap aktif olduğu sürece</td>
              <td className="py-2 text-gri-700">KVKK m.5/2-c (sözleşme)</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">
                <strong>Tasarım dosyaları</strong> (yüklediğin PDF/PNG)
              </td>
              <td className="py-2 pr-4 font-semibold">
                Son baskıdan 24 ay sonra silinir
              </td>
              <td className="py-2 text-gri-700">
                KVKK m.5/2-c &mdash; sözleşmenin devamı (tekrar baskı için)
              </td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">
                Tasarım kimlik özeti (SHA-256 hash)
              </td>
              <td className="py-2 pr-4 font-semibold">10 yıl</td>
              <td className="py-2 text-gri-700">
                FSEK m.66 &mdash; telif ihlali davası kanıtı
              </td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">
                Versiyon geçmişi (V1, V2&hellip;)
              </td>
              <td className="py-2 pr-4 font-semibold">
                Son onaylı versiyon hariç 18 ay
              </td>
              <td className="py-2 text-gri-700">KVKK m.4 orantılılık</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Pim asistanı sohbet geçmişi</td>
              <td className="py-2 pr-4 font-semibold">
                6 ay anonimleştir, 24 ay sonra sil
              </td>
              <td className="py-2 text-gri-700">KVKK m.4 + m.7</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">Audit log (admin işlemleri)</td>
              <td className="py-2 pr-4 font-semibold">10 yıl</td>
              <td className="py-2 text-gri-700">KVKK m.12 (immutable)</td>
            </tr>
            <tr className="border-b border-gri-200">
              <td className="py-2 pr-4">İade ve fatura iptali kayıtları</td>
              <td className="py-2 pr-4 font-semibold">10 yıl</td>
              <td className="py-2 text-gri-700">VUK + TBK m.231</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Pazarlama izin kaydı</td>
              <td className="py-2 pr-4 font-semibold">İzin geri alınana kadar</td>
              <td className="py-2 text-gri-700">Açık rıza (KVKK m.5/1)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-base font-semibold mt-5">
        6.1 Tasarım dosyası saklama — neden 24 ay?
      </h3>
      <p>
        Tasarım dosyaların bizim için sözleşmenin devamı için zorunlu:
        <strong> &ldquo;Geçen yıl bastığım etiketten 5000 daha bas&rdquo;</strong>
        {" "}dediğinde dosyanın elimizde olması lazım. Bu yüzden son
        siparişinden itibaren 24 ay saklarız. Tekrar baskı verirsen sayaç
        sıfırlanır, yeniden 24 ay sayılır.
      </p>
      <p className="text-[12.5px] text-gri-700 italic">
        Örnek: 2026-01 baskı yaptın &rarr; 2028-01&apos;e kadar dosya
        durur. Eğer 2027-06&apos;da tekrar baskı verirsen &rarr; 2029-06&apos;ya
        kadar uzar.
      </p>

      <h3 className="text-base font-semibold mt-5">
        6.2 Silme vs anonimleştirme farkı
      </h3>
      <ul>
        <li>
          <strong>Silme:</strong> Veri ortadan kaldırılır, geri gelmez.
        </li>
        <li>
          <strong>Anonimleştirme:</strong> Kim olduğun bilgisi kopartılır;
          veri kalır ama artık seninle eşleşmez (KVKK m.28/1-b). İstatistik
          ve sistem iyileştirme için kullanılabilir, üzerinden seni bulamayız.
        </li>
      </ul>

      <h3 className="text-base font-semibold mt-5">
        6.3 Soğuk depoya taşıma
      </h3>
      <p>
        Aktif olarak işlem görmeyen tasarım dosyaları (12 ay+) erişimi
        yavaş ama güvenli arşive taşınır. Sen istediğinde birkaç saniye
        içinde geri çağrılır. Süre saymaz, devam eder.
      </p>

      <h3 className="text-base font-semibold mt-5">
        6.4 Hesap silme talebi
      </h3>
      <p>
        Hesabını silmek istediğinde:
      </p>
      <ul>
        <li>
          E-posta doğrulamasıyla talep onaylanır.
        </li>
        <li>
          <strong>48 saat geri alma süresi</strong> başlar &mdash; bu zaman
          içinde vazgeçebilirsin.
        </li>
        <li>
          Süre dolduğunda aktif veriler (sipariş geçmişi, tasarımlar,
          adresler, Pim sohbet) silinir.
        </li>
        <li>
          <strong>Fatura kayıtların VUK gereği 10 yıl kilitli arşivde</strong>{" "}
          durur &mdash; pazarlama, analiz veya AI eğitimi için kullanılmaz,
          süre dolunca otomatik silinir.
        </li>
        <li>
          Üretim ortağımıza önceden aktarılmış dosyalar en geç 30 gün
          içinde fason tarafından imha edilir (veri işleyici sözleşmesi
          gereği).
        </li>
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
