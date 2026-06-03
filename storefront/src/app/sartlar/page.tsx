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
        onayı ve anlaşmalı üretim ortakları üzerinden üretim ile teslim hizmetleri sunar.
      </p>

      <h2>2. Hesap Açma ve Sorumluluk</h2>
      <ul>
        <li>
          Site&rsquo;de hesap açmak için 18 yaşını doldurmuş olmanız gerekir
        </li>
        <li>
          Verdiğin bilgilerin doğru ve güncel olduğunu beyan edersin
        </li>
        <li>
          Hesap güvenliği (şifre koruması) senin sorumluluğundadır
        </li>
        <li>
          Hesabın üzerinden gerçekleştirilen işlemlerden sen sorumlusun
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
        AI destekli ön kontrol ve Sefa&rsquo;nın manuel incelemesi bu
        kuralların uygulanmasını sağlar; nihai red yetkisi Pim
        Etiket&rsquo;tedir.
      </p>

      <h2>5. Fikri Mülkiyet ve Kopyalama Yasağı</h2>
      <p>
        <strong>pimetiket.com</strong> sitesinde yer alan tüm içerik —
        kaynak kod, tasarımlar, görseller, metinler, ürün konfigüratörü,
        fiyat motoru algoritmaları, AI prompt&apos;ları, &ldquo;Pim
        Etiket&rdquo; marka adı ve karga maskotu dahil — 5846 sayılı{" "}
        <strong>Fikir ve Sanat Eserleri Kanunu (FSEK)</strong> ve 6769
        sayılı <strong>Sınai Mülkiyet Kanunu</strong> kapsamında Pim
        Etiket (Sefa Yakut)&rsquo;ün münhasır mülkiyetindedir.
      </p>
      <p>Aşağıdaki davranışlar kesinlikle yasaktır:</p>
      <ul>
        <li>
          <strong>Otomatik veri toplama (scraping)</strong>: bot, crawler,
          spider veya benzeri otomatik araçlarla sitenin içeriğini, ürün
          listesini, fiyat bilgilerini veya kullanıcı verilerini toplamak.
        </li>
        <li>
          <strong>Tersine mühendislik</strong>: Frontend veya backend
          kodlarını çözmek, decompile etmek, kopyalamak veya türev eser
          üretmek.
        </li>
        <li>
          <strong>İçerik yeniden yayınlama</strong>: Yazılı izin
          alınmaksızın içeriğin (metin, görsel, kod) tamamını veya bir
          kısmını başka bir mecrada kullanmak, dağıtmak, çoğaltmak.
        </li>
        <li>
          <strong>Marka taklidi</strong>: &ldquo;Pim Etiket&rdquo; adı,
          karga logosu, mercan-lacivert renk paleti veya benzeri ayırt
          edici işaretleri kullanarak müşterileri yanıltacak benzer site
          oluşturmak.
        </li>
        <li>
          <strong>API kötüye kullanım</strong>: Rate limit&rsquo;leri
          aşmak, çoklu hesapla otomatik çağrı yapmak, paylaşılan
          kapasiteyi tüketmek.
        </li>
      </ul>
      <p>
        Bu maddelerin ihlali halinde Pim Etiket; (a) hesabınızı askıya
        alma, (b) IP adresinizi engelleme, (c) FSEK m.71 ve TBK m.49
        kapsamında <strong>tazminat davası</strong>, (d) yetkili
        otoritelere bildirimde bulunma haklarını saklı tutar. Meşru
        akademik araştırma veya basın haberi için yazılı izin almak
        üzere{" "}
        <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>{" "}
        adresine başvurabilirsiniz.
      </p>

      <h2>6. Sorumluluk Sınırları</h2>
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
          Mücbir sebep, kargo gecikmeleri, üretim ortağı kaynaklı gecikmeler
          için doğrudan sorumluluk üstlenilmez. Detaylar{" "}
          <a href="/mesafeli-satis">Mesafeli Satış Sözleşmesi</a>nde.
        </li>
      </ul>

      <h2>7. Hesap Askıya Alma ve Fesih</h2>
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
        iletilebilir. Silme talebinden sonra <strong>48 saatlik geri alma
        süresi</strong> tanınır — bu süre içinde tekrar giriş yaparsanız
        hesap silinmez (Sefa 21 May v68: KVKK metniyle eşitlendi).
      </p>

      <h2>8. Değişiklikler</h2>
      <p>
        İşbu şartlar Pim Etiket tarafından zaman zaman güncellenebilir.
        Önemli değişiklikler kayıtlı kullanıcılara e-posta ile bildirilir.
        Site&rsquo;yi kullanmaya devam etmeniz güncel şartları kabul ettiğiniz
        anlamına gelir.
      </p>

      <h2>9. Yetkili Mahkeme ve Hukuk</h2>
      <p>
        İşbu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Doğacak
        uyuşmazlıklarda, tüketici işlemleri için Gümrük ve Ticaret
        Bakanlığı'nca belirlenen parasal sınırlar dahilinde Tüketici Hakem
        Heyetleri ve Tüketici Mahkemeleri; ticari uyuşmazlıklarda
        SATICI'nın merkezinin bulunduğu yer (Ankara) Mahkemeleri ve İcra
        Daireleri yetkilidir.
      </p>

      <h2>10. İletişim</h2>
      <p>
        İşbu şartlarla ilgili sorularını{" "}
        <a href="/iletisim">iletişim</a> sayfasından iletebilirsin.
      </p>
    </LegalLayout>
  );
}
