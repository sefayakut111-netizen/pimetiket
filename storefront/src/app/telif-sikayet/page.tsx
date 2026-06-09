/**
 * /telif-sikayet — Telif/marka ihlali şikayet ve takedown notice sayfası.
 *
 * Sefa 18 May v68 (koruma): Avukat görüşmesi olmadan da kullanılabilir
 * self-service bildirim formu + DMCA benzeri hazır şikayet metni.
 *
 * Türkiye'de DMCA doğrudan uygulanmaz, ama 5846 FSEK + 5651 sayılı kanun
 * + 6698 KVKK kapsamında "erişim engelleme" prosedürü işliyor. Hosting
 * sağlayıcılarına şikayet için de bu metin standart format.
 */

import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui";
import { legalPageMetadata } from "@/lib/seo/legal-metadata";

export const metadata: Metadata = legalPageMetadata(
  "Telif Hakkı Şikayeti — Pim Etiket",
  "Pim Etiket telif hakkı veya marka ihlali bildirimi. FSEK + Sınai Mülkiyet Kanunu kapsamında takedown notice prosedürü.",
  "/telif-sikayet"
);

export default function TelifSikayetPage() {
  return (
    <main className="bg-gri-50 animate-fade-up py-8 pb-20">
      <div className="mx-auto max-w-[820px] px-6">
        <div className="mb-6">
          <Eyebrow>Hukuki</Eyebrow>
          <h1 className="mt-3 text-[28px] md:text-[40px] font-semibold tracking-tight">
            Telif Hakkı &amp; Marka İhlali Şikayeti
          </h1>
          <p className="mt-3 text-[14.5px] text-gri-700 leading-relaxed">
            Pim Etiket içeriklerinin (kod, görsel, metin, marka, logo,
            tasarım) izinsiz kullanımını veya kopyalanmasını fark
            ettiyseniz, aşağıdaki bilgileri{" "}
            <a
              href="mailto:info@pimetiket.com"
              className="text-pim-mercan font-semibold hover:underline"
            >
              info@pimetiket.com
            </a>{" "}
            adresine gönderin. 7 iş günü içinde yanıt veririz.
          </p>
        </div>

        <article className="prose prose-sm md:prose-base prose-pim max-w-none bg-white p-6 md:p-8 rounded-xl ring-1 ring-gri-200">
          <h2>Yasal Dayanak</h2>
          <ul>
            <li>
              <strong>5846 sayılı Fikir ve Sanat Eserleri Kanunu (FSEK)</strong>{" "}
              — eser sahibinin mali ve manevi hakları (m.13-25), tazminat
              talebi (m.68-71)
            </li>
            <li>
              <strong>6769 sayılı Sınai Mülkiyet Kanunu</strong> — marka
              tescil hakkı, taklit ve haksız rekabet (m.149-156)
            </li>
            <li>
              <strong>5651 sayılı İnternet Kanunu</strong> — içerik
              kaldırma talebi (m.9)
            </li>
            <li>
              <strong>6098 sayılı Türk Borçlar Kanunu m.49</strong> —
              haksız fiil tazminatı
            </li>
          </ul>

          <h2>Şikayet için Gerekli Bilgiler</h2>
          <p>
            Şikayetinizin işleme alınması için aşağıdaki bilgileri eksiksiz
            iletmeniz gerekir:
          </p>
          <ol>
            <li>
              <strong>İletişim bilgileriniz</strong>: Ad-soyad/unvan,
              e-posta, telefon, adres
            </li>
            <li>
              <strong>İhlal edilen içerik</strong>: Pim Etiket sitesinde
              yer alan ve telif/marka hakkını ihlal eden içeriğin tam URL
              veya ekran görüntüsü
            </li>
            <li>
              <strong>Hak iddianızın dayanağı</strong>: Eser sahipliği
              belgesi, marka tescil sertifikası (TÜRKPATENT), önceki
              yayınlanmış kopya, vb.
            </li>
            <li>
              <strong>İyi niyet beyanı</strong>: &ldquo;Bilgilerin doğru
              olduğunu, hak sahibi veya yetkilendirilmiş temsilcisi
              olduğumu beyan ederim&rdquo; ifadesi
            </li>
            <li>
              <strong>İmza</strong>: Fiziksel imza (PDF) veya elektronik
              imza
            </li>
          </ol>

          <h2>İncelememiz Sırasında</h2>
          <ul>
            <li>
              Şikayet 7 iş günü içinde incelenir; haklı bulunursa içerik{" "}
              <strong>24 saat içinde</strong> kaldırılır.
            </li>
            <li>
              İhtilaflı durumlarda taraflara karşı-bildirim hakkı tanınır
              (FSEK m.71).
            </li>
            <li>
              Sahte/kötüye kullanım amaçlı şikayetler hukuki yaptırıma
              tabidir (TBK m.49 + TCK m.267 iftira).
            </li>
          </ul>

          <h2>Tersine Senaryo: Pim Etiket İçeriği Başka Sitede</h2>
          <p>
            Bir kullanıcı veya rakip site bizim içeriğimizi (kod, görsel,
            tasarım, &ldquo;Pim Etiket&rdquo; markası, karga logosu)
            izinsiz kullanıyorsa, biz aşağıdaki yolları izleriz:
          </p>
          <ol>
            <li>
              İhlal eden tarafa <strong>cease and desist</strong>{" "}
              (durdurma ihtarı) e-postası
            </li>
            <li>
              Hosting sağlayıcısına (Cloudflare, Vercel, AWS vb.){" "}
              <strong>takedown notice</strong>
            </li>
            <li>
              Türkiye İnternet Geliştirme Kurulu (TİB) ve Sulh Hukuk
              Mahkemesi&rsquo;ne <strong>erişim engelleme</strong> talebi
              (5651 m.9)
            </li>
            <li>
              FSEK m.68 kapsamında <strong>3 katına kadar tazminat</strong>{" "}
              davası
            </li>
            <li>
              Marka taklidi varsa Sınai Mülkiyet Kanunu m.155 uyarınca{" "}
              <strong>hapis ve para cezası</strong> talebi
            </li>
          </ol>

          <h2>Hızlı İletişim</h2>
          <ul>
            <li>
              <strong>E-posta:</strong>{" "}
              <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>{" "}
              (telif/hukuki konular)
            </li>
            <li>
              <strong>Genel destek:</strong>{" "}
              <a href="mailto:info@pimetiket.com">info@pimetiket.com</a>
            </li>
            <li>
              <strong>Adres:</strong> Beştepeler Mah. Nergis Sok. No:7/2
              ViaFlat İş Merkezi Ofis:27-28, 06510 Çankaya/Ankara (SEFA YAKUT
              KIRTASİYE BASKI TİC. LTD. ŞTİ., Doğanbey VD 7580607612)
            </li>
          </ul>

          <p className="text-[12px] text-gri-500 mt-6 italic">
            Bu sayfa bilgilendirme amaçlıdır, avukatlık hizmeti değildir.
            Karmaşık ihtilaflarda mutlaka bir hukuk müşaviri ile çalışın.
          </p>
        </article>
      </div>
    </main>
  );
}
