import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata = {
  title: "Cayma Hakkı",
  description:
    "Pim Etiket'te dijital baskı ürünlerinde cayma hakkının kapsamı ve istisnaları.",
  alternates: { canonical: "/cayma-hakki" },
};

export default function CaymaHakkiPage() {
  return (
    <LegalLayout
      title="Cayma Hakkı"
      lastUpdated="8 Mayıs 2026"
      currentPath="/cayma-hakki"
    >
      <p>
        <strong>Önemli:</strong> Pim Etiket üzerinden verilen siparişler,
        ALICI&rsquo;nın tasarım dosyası ve konfigürasyon seçimleri (malzeme,
        kaplama, ölçü, adet, özelleştirme) doğrultusunda{" "}
        <strong>kişiye özel olarak üretilir</strong>.
      </p>

      <h2>Yasal Dayanak</h2>
      <p>
        6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli
        Sözleşmeler Yönetmeliği&rsquo;nin{" "}
        <strong>15. maddesi 1. fıkrası (b) bendi</strong>{" "}
        açıkça şu hükmü içerir:
      </p>
      <p>
        <em>
          &ldquo;Tüketicinin istekleri veya açıkça onun kişisel ihtiyaçları
          doğrultusunda hazırlanan, niteliği itibarıyla geri gönderilmeye
          elverişli olmayan veya çabuk bozulma tehlikesi olan ya da son
          kullanma tarihi geçme ihtimali olan malların teslimine ilişkin
          sözleşmelerde tüketici cayma hakkını kullanamaz.&rdquo;
        </em>
      </p>
      <p>
        Bu nedenle Pim Etiket üzerinden verilen siparişlerde{" "}
        <strong>14 günlük cayma hakkı bulunmamaktadır</strong>. ALICI, sipariş
        verirken bu durumu bildiğini ve kabul ettiğini beyan etmiş sayılır.
      </p>

      <h2>İptal Hakkı</h2>
      <p>
        Cayma hakkı yokluğu, sipariş iptali demek değildir. Aşağıdaki durumlarda
        ALICI siparişi iptal edebilir ve ödediği tutar iade edilir:
      </p>
      <ul>
        <li>
          <strong>Tasarım dosyası yüklemeden önce</strong>: Sipariş onayı
          sonrası dosya yüklenmediği sürece müşteri panelinden iptal
          edilebilir.
        </li>
        <li>
          <strong>Prova onayından önce</strong>: AI ve operatör kontrolü
          sonrası ALICI&rsquo;ya gönderilen prova&rsquo;yı onaylamadığı
          sürece sipariş iptal edilebilir.
        </li>
        <li>
          <strong>Üretim henüz başlamamışsa</strong>: Operatör manuel
          kontrolü tamamlanmamış siparişler iptal edilebilir.
        </li>
      </ul>
      <p>
        Prova onayı sonrası üretim aşamasına girmiş siparişler{" "}
        <strong>iptal edilemez</strong>; bu noktada SATICI fason ortağa
        ödeme yapmış olur.
      </p>

      <h2>Ayıplı Ürün ve Yasal Haklar</h2>
      <p>
        Cayma hakkı bulunmaması, ALICI&rsquo;nın 6502 sayılı Kanun&rsquo;dan
        doğan diğer haklarını etkilemez. Aşağıdaki durumlarda ALICI ücretsiz
        yenileme veya iade talep edebilir:
      </p>
      <ul>
        <li>Üretim hatası (renk farkı, baskı bozukluğu, ölçü hatası)</li>
        <li>Sipariş edilen ürün özelliklerinden farklı ürün gönderilmesi</li>
        <li>Kargo hasarı (kargo teslim alınmadan önce tutanak tutulmalı)</li>
      </ul>
      <p>
        Bu durumlarda ALICI, ürünü teslim aldığı tarihten itibaren{" "}
        <strong>7 gün</strong> içinde fotoğraflı bildirim ile{" "}
        <a href="/iletisim">iletişim</a> sayfasından SATICI&rsquo;ya
        başvurmalıdır.
      </p>

      <h2>İletişim</h2>
      <p>
        Cayma hakkı, iptal veya iade konusundaki sorularınız için{" "}
        <a href="/iletisim">iletişim</a> sayfası üzerinden bize ulaşabilirsiniz.
      </p>
    </LegalLayout>
  );
}
