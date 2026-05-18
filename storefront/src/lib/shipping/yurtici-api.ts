/**
 * Yurtiçi Kargo SOAP API Client — TypeScript wrapper.
 *
 * Sefa 18 May v68 (Migration 052 + cron poll):
 * Yurtiçi'nin SOAP servisinden tracking durumu sorgular ve normalize eder.
 *
 * Endpoint (Yurtiçi standart):
 *   http://webservices.yurticikargo.com:8080/KOPSWebServices/...
 *
 * Auth: username + password (her request'te SOAP body içinde)
 *   - YURTICI_USERNAME
 *   - YURTICI_PASSWORD
 *   - YURTICI_LANGUAGE (TR/EN, default TR)
 *
 * DRY_RUN: env'ler set değilse sahte yanıt döner, log basar.
 *
 * Referans implementasyonlar:
 *   - github.com/oboratav/yk-proxy (Python REST proxy)
 *   - github.com/umitkatmer/yurtici-kargo-takip-api-php-class (PHP)
 *   - github.com/quardianwolf/yurtici-kargo-react (TS create shipment)
 */

const YURTICI_USERNAME = process.env.YURTICI_USERNAME;
const YURTICI_PASSWORD = process.env.YURTICI_PASSWORD;
const YURTICI_LANGUAGE = process.env.YURTICI_LANGUAGE ?? "TR";

// Yurtiçi standart SOAP endpoint'leri (Sefa'nın API anlaşması sonrası
// kendisi farklı bir URL verirse YURTICI_ENDPOINT env'i override eder)
const TRACKING_ENDPOINT =
  process.env.YURTICI_TRACKING_ENDPOINT ??
  "http://webservices.yurticikargo.com:8080/KOPSWebServices/ShippingOrderDispatcherServices";

/** API credentials set edilmemişse sahte yanıt dön. */
export const IS_YURTICI_DRY_RUN =
  !YURTICI_USERNAME ||
  !YURTICI_PASSWORD ||
  process.env.YURTICI_DRY_RUN === "true";

// ============================================================
// Tipler
// ============================================================

export type NormalizedShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

export interface ShipmentStatusEvent {
  status: NormalizedShipmentStatus;
  rawStatusCode: string;
  description: string;
  location: string | null;
  eventTime: Date;
}

export interface YurticiQueryResult {
  success: boolean;
  trackingNumber: string;
  /** Mevcut durum kodu (en güncel) */
  currentStatus: NormalizedShipmentStatus | null;
  /** Teslim tarihi (delivered ise) */
  deliveredAt: Date | null;
  /** Tüm event'ler (chronological) */
  events: ShipmentStatusEvent[];
  /** Hata mesajı (success=false ise) */
  error?: string;
  /** Ham API payload (debug) */
  raw?: unknown;
  dryRun: boolean;
}

// ============================================================
// Status normalization
// ============================================================
/**
 * Yurtiçi'nin döndüğü ham status kodlarını/text'lerini Pim Etiket'in
 * normalized status'üne çevirir. Yurtiçi resmi dokümanı kapsamlı bir
 * kod listesi vermediği için bilinen değerleri eşliyoruz; bilinmeyen
 * için "in_transit" fallback (kullanıcı için "Yolda" görünür).
 *
 * Bilinen kodlar (yk-proxy ve PHP kütüphanelerinden):
 *   - "İslem Bekliyor" / "İşleme Alındı" → created
 *   - "Şubeye Geldi" / "Aktarmada" / "Transferde" → in_transit
 *   - "Şubeden Çıktı" / "Dağıtıma Çıktı" → out_for_delivery
 *   - "Teslim Edildi" / "Alıcısına Teslim" → delivered
 *   - "Teslim Edilemedi" / "Adres Bulunamadı" → failed
 *   - "İade Edildi" / "Gönderici İadesi" → returned
 *   - "İptal" → cancelled
 */
export function normalizeYurticiStatus(
  raw: string
): NormalizedShipmentStatus {
  const t = (raw ?? "").toLowerCase().trim();
  if (!t) return "in_transit";

  // delivered
  if (
    t.includes("teslim edildi") ||
    t.includes("alıcısına teslim") ||
    t.includes("alicisina teslim") ||
    t.includes("teslim alındı") ||
    t === "t"
  ) {
    return "delivered";
  }

  // failed
  if (
    t.includes("teslim edilemedi") ||
    t.includes("adres bulunamadı") ||
    t.includes("adres bulunamadi") ||
    t.includes("alıcı bulunamadı") ||
    t.includes("alici bulunamadi")
  ) {
    return "failed";
  }

  // returned
  if (
    t.includes("iade edildi") ||
    t.includes("gönderici iadesi") ||
    t.includes("gonderici iadesi") ||
    t === "i"
  ) {
    return "returned";
  }

  // cancelled
  if (t.includes("iptal")) {
    return "cancelled";
  }

  // out_for_delivery
  if (
    t.includes("dağıtıma çıktı") ||
    t.includes("dagitima cikti") ||
    t.includes("kurye") ||
    t.includes("şubeden çıktı") ||
    t.includes("subeden cikti")
  ) {
    return "out_for_delivery";
  }

  // picked_up
  if (
    t.includes("kargo alındı") ||
    t.includes("kargo alindi") ||
    t.includes("yüklendi") ||
    t.includes("yuklendi")
  ) {
    return "picked_up";
  }

  // created
  if (
    t.includes("işleme alındı") ||
    t.includes("isleme alindi") ||
    t.includes("kayıt oluştu") ||
    t.includes("barkod")
  ) {
    return "created";
  }

  // Default: in_transit (transferde, şubede, yolda, vb)
  return "in_transit";
}

// ============================================================
// SOAP Request Builders
// ============================================================
function buildQuerySoapBody(trackingNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:ws="http://ws.kops.yk.com/">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:queryShippingOrderDetail>
      <wsUserName>${escapeXml(YURTICI_USERNAME!)}</wsUserName>
      <wsPassword>${escapeXml(YURTICI_PASSWORD!)}</wsPassword>
      <wsLanguage>${escapeXml(YURTICI_LANGUAGE)}</wsLanguage>
      <keys>${escapeXml(trackingNumber)}</keys>
      <keyType>0</keyType>
      <addHistoricalData>true</addHistoricalData>
      <onlyTracking>false</onlyTracking>
    </ws:queryShippingOrderDetail>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================
// XML Parser (basit, çünkü hafif istiyoruz)
// ============================================================
function extractTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function parseYurticiResponse(
  xml: string,
  trackingNumber: string
): YurticiQueryResult {
  // Yurtiçi response yapısı (yk-proxy referansı):
  //   <return><shippingDeliveryItemDetailVO>...</...></return>
  // İçinde:
  //   <operationCode>
  //   <operationMessage>
  //   <shippingDeliveryDetailVO>
  //     <jobName>
  //     <unitName>
  //     <operationDate>
  //     ... her bir status event için bir VO

  const events: ShipmentStatusEvent[] = [];
  const eventBlocks = extractAllTags(xml, "shippingDeliveryDetailVO");

  for (const block of eventBlocks) {
    const jobName = extractTag(block, "jobName") ?? "";
    const unitName = extractTag(block, "unitName");
    const operationDate = extractTag(block, "operationDate");
    const operationCode = extractTag(block, "operationCode") ?? "";

    if (!jobName || !operationDate) continue;

    // operationDate genellikle "2026-05-18 14:32:55" formatında
    let eventTime: Date;
    try {
      eventTime = new Date(operationDate.replace(" ", "T") + "+03:00");
      if (isNaN(eventTime.getTime())) {
        eventTime = new Date(operationDate);
      }
    } catch {
      eventTime = new Date();
    }

    events.push({
      status: normalizeYurticiStatus(jobName),
      rawStatusCode: operationCode,
      description: jobName,
      location: unitName,
      eventTime,
    });
  }

  events.sort((a, b) => a.eventTime.getTime() - b.eventTime.getTime());

  const last = events[events.length - 1];
  const deliveredEvent = events.find((e) => e.status === "delivered");

  return {
    success: events.length > 0,
    trackingNumber,
    currentStatus: last?.status ?? null,
    deliveredAt: deliveredEvent ? deliveredEvent.eventTime : null,
    events,
  } as YurticiQueryResult;
}

// ============================================================
// Public API
// ============================================================

/**
 * Bir kargo takip numarası için Yurtiçi'den durum sorgu.
 * DRY_RUN modunda sahte event'ler döndürür.
 */
export async function queryYurticiShipment(
  trackingNumber: string
): Promise<YurticiQueryResult> {
  if (!trackingNumber || trackingNumber.trim().length === 0) {
    return {
      success: false,
      trackingNumber,
      currentStatus: null,
      deliveredAt: null,
      events: [],
      error: "Tracking number boş",
      dryRun: IS_YURTICI_DRY_RUN,
    };
  }

  // DRY_RUN: fake data dön
  if (IS_YURTICI_DRY_RUN) {
    console.log(
      `[yurtici:DRY_RUN] query trackingNumber="${trackingNumber}"`
    );
    const now = Date.now();
    const fakeEvents: ShipmentStatusEvent[] = [
      {
        status: "created",
        rawStatusCode: "DR",
        description: "[DRY_RUN] Kargo işleme alındı",
        location: "İstanbul Aktarma Merkezi",
        eventTime: new Date(now - 6 * 3600 * 1000),
      },
      {
        status: "in_transit",
        rawStatusCode: "DR",
        description: "[DRY_RUN] Şubeye geldi",
        location: "Ümraniye Şubesi",
        eventTime: new Date(now - 2 * 3600 * 1000),
      },
    ];
    return {
      success: true,
      trackingNumber,
      currentStatus: "in_transit",
      deliveredAt: null,
      events: fakeEvents,
      raw: { dryRun: true },
      dryRun: true,
    };
  }

  // Gerçek SOAP çağrısı
  try {
    const body = buildQuerySoapBody(trackingNumber);
    const response = await fetch(TRACKING_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPAction: "queryShippingOrderDetail",
        Accept: "text/xml",
      },
      body,
    });

    const xml = await response.text();

    if (!response.ok) {
      return {
        success: false,
        trackingNumber,
        currentStatus: null,
        deliveredAt: null,
        events: [],
        error: `HTTP ${response.status}: ${xml.substring(0, 200)}`,
        dryRun: false,
      };
    }

    // SOAP fault kontrolü
    const fault = extractTag(xml, "faultstring") ?? extractTag(xml, "Fault");
    if (fault) {
      return {
        success: false,
        trackingNumber,
        currentStatus: null,
        deliveredAt: null,
        events: [],
        error: `SOAP Fault: ${fault}`,
        raw: xml,
        dryRun: false,
      };
    }

    // operationCode kontrolü (Yurtiçi'nin success/error indikatörü)
    const opCode = extractTag(xml, "operationCode");
    const opMsg = extractTag(xml, "operationMessage");
    if (opCode && opCode !== "0" && opCode !== "00") {
      return {
        success: false,
        trackingNumber,
        currentStatus: null,
        deliveredAt: null,
        events: [],
        error: `Yurtiçi error ${opCode}: ${opMsg ?? "bilinmeyen"}`,
        raw: xml,
        dryRun: false,
      };
    }

    const result = parseYurticiResponse(xml, trackingNumber);
    return { ...result, raw: xml, dryRun: false };
  } catch (err) {
    return {
      success: false,
      trackingNumber,
      currentStatus: null,
      deliveredAt: null,
      events: [],
      error: `Network/parse hatası: ${(err as Error).message}`,
      dryRun: false,
    };
  }
}

/**
 * Debug helper — env durumunu raporlar.
 */
export function getYurticiConfig(): {
  hasCredentials: boolean;
  isDryRun: boolean;
  endpoint: string;
  language: string;
} {
  return {
    hasCredentials: !!YURTICI_USERNAME && !!YURTICI_PASSWORD,
    isDryRun: IS_YURTICI_DRY_RUN,
    endpoint: TRACKING_ENDPOINT,
    language: YURTICI_LANGUAGE,
  };
}
