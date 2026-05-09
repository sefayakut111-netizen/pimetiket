/**
 * iyzico SDK için minimal TypeScript tipler.
 *
 * Resmi iyzipay paketi CommonJS tabanlı ve type tanımı yok. Burada
 * KULLANDIĞIMIZ kısımları typed yapıyoruz; full coverage için iyzico
 * doc'una başvur:
 * https://dev.iyzipay.com/tr/api/checkout-form
 */

// ============================================================
// Common
// ============================================================

export type IyzicoLocale = "tr" | "en";

export type IyzicoCurrency = "TRY" | "USD" | "EUR" | "GBP" | "IRR" | "NOK" | "RUB" | "CHF";

export type IyzicoStatus = "success" | "failure";

export type IyzicoBasketItemType =
  | "PHYSICAL"
  | "VIRTUAL";

export type IyzicoCardFamily =
  | "Bonus"
  | "Axess"
  | "World"
  | "Maximum"
  | "Paraf"
  | "CardFinans"
  | "Advantage";

// ============================================================
// Buyer / Address
// ============================================================

export interface IyzicoBuyer {
  id: string;
  name: string;
  surname: string;
  gsmNumber?: string;
  email: string;
  identityNumber: string;        // TC kimlik (11 hane). Kurumsal için "11111111111"
  lastLoginDate?: string;        // "2026-05-09 12:00:00"
  registrationDate?: string;     // "2026-05-09 12:00:00"
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface IyzicoAddress {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

// ============================================================
// Basket item
// ============================================================

export interface IyzicoBasketItem {
  id: string;
  name: string;
  category1: string;
  category2?: string;
  itemType: IyzicoBasketItemType;
  /** Tutar (TL string, "199.99" formatı). Toplam = items[].price toplamı, paidPrice'a eşit olmalı */
  price: string;
}

// ============================================================
// CheckoutForm Initialize
// ============================================================

export interface IyzicoInitializeParams {
  locale?: IyzicoLocale;
  conversationId: string;        // bizim tarafımızda unique (orderId veya UUID)
  /** Sepet toplamı (KDV dahil), "199.99" string */
  price: string;
  /** Müşterinin ÖDEDİĞİ tutar (kupon/cüzdan düşülmüş). Çoğu durumda price ile aynı. */
  paidPrice: string;
  currency: IyzicoCurrency;
  basketId?: string;
  paymentGroup?: "PRODUCT" | "LISTING" | "SUBSCRIPTION";
  callbackUrl: string;           // bizim /odeme-sonuc callback URL'imiz
  enabledInstallments?: number[]; // [1,2,3,6,9,12]
  buyer: IyzicoBuyer;
  shippingAddress: IyzicoAddress;
  billingAddress: IyzicoAddress;
  basketItems: IyzicoBasketItem[];
}

export interface IyzicoInitializeResult {
  status: IyzicoStatus;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  locale: IyzicoLocale;
  systemTime: number;
  conversationId: string;
  /** Bu token retrieve'de kullanılır */
  token: string;
  /** Müşteriyi yönlendireceğimiz iyzico hosted form URL'i */
  paymentPageUrl: string;
  /** iframe için raw HTML — yerleşik kullanım */
  checkoutFormContent?: string;
  tokenExpireTime?: number;      // saniye
}

// ============================================================
// CheckoutForm Retrieve
// ============================================================

export interface IyzicoRetrieveParams {
  locale?: IyzicoLocale;
  conversationId: string;
  token: string;
}

export interface IyzicoRetrieveResult {
  status: IyzicoStatus;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  locale: IyzicoLocale;
  systemTime: number;
  conversationId: string;
  /** "SUCCESS" | "FAILURE" — paymentStatus farklı, dikkat */
  paymentStatus?: "SUCCESS" | "FAILURE" | "INIT_THREEDS" | "CALLBACK_THREEDS" | "BKM_POS_SELECTED";
  paymentId?: string;
  /** Toplamlar TL string */
  price?: string;
  paidPrice?: string;
  installment?: number;
  paymentItems?: Array<{
    itemId: string;
    paymentTransactionId: string;
    transactionStatus: number;
    price: string;
    paidPrice: string;
  }>;
  fraudStatus?: number;
  merchantCommissionRate?: number;
  iyziCommissionRateAmount?: number;
  iyziCommissionFee?: number;
  cardType?: string;
  cardAssociation?: string;
  cardFamily?: IyzicoCardFamily;
  binNumber?: string;
  lastFourDigits?: string;
  basketId?: string;
}

// ============================================================
// Refund
// ============================================================

export interface IyzicoRefundParams {
  locale?: IyzicoLocale;
  conversationId: string;
  paymentTransactionId: string;
  /** TL string */
  price: string;
  ip: string;
  currency: IyzicoCurrency;
}

export interface IyzicoRefundResult {
  status: IyzicoStatus;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  locale: IyzicoLocale;
  systemTime: number;
  conversationId: string;
  paymentId?: string;
  paymentTransactionId?: string;
  price?: string;
  currency?: IyzicoCurrency;
  hostReference?: string;
}

// ============================================================
// Cancel (full refund)
// ============================================================

export interface IyzicoCancelParams {
  locale?: IyzicoLocale;
  conversationId: string;
  paymentId: string;
  ip: string;
}

export interface IyzicoCancelResult {
  status: IyzicoStatus;
  errorCode?: string;
  errorMessage?: string;
  locale: IyzicoLocale;
  systemTime: number;
  conversationId: string;
  paymentId?: string;
  price?: string;
  currency?: IyzicoCurrency;
}

// ============================================================
// SDK shape (iyzipay package)
// ============================================================

interface IyzipayCallback<T> {
  (err: Error | null, result: T): void;
}

export interface IyzipayInstance {
  checkoutFormInitialize: {
    create: (
      params: IyzicoInitializeParams,
      cb: IyzipayCallback<IyzicoInitializeResult>
    ) => void;
  };
  checkoutForm: {
    retrieve: (
      params: IyzicoRetrieveParams,
      cb: IyzipayCallback<IyzicoRetrieveResult>
    ) => void;
  };
  refund: {
    create: (
      params: IyzicoRefundParams,
      cb: IyzipayCallback<IyzicoRefundResult>
    ) => void;
  };
  cancel: {
    create: (
      params: IyzicoCancelParams,
      cb: IyzipayCallback<IyzicoCancelResult>
    ) => void;
  };
}

export interface IyzipayConfig {
  apiKey: string;
  secretKey: string;
  uri: string;
}
