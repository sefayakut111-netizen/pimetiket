/**
 * i18n types — Pim Etiket için TR/EN dil sistemi.
 *
 * Şu an aktif: tr (default), en
 * Gelecek dilleri buraya eklemek için: Locale union'ına ekle +
 * translations/ klasörüne yeni dosya.
 */

export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

export const LOCALE_LABELS: Record<Locale, string> = {
  tr: "Türkçe",
  en: "English",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  tr: "🇹🇷",
  en: "🇬🇧",
};

/**
 * Translation dictionary tipi — TR'den otomatik üretilir.
 * Çevirisi yapılan tüm anahtarlar tr.ts'te tanımlı olmak zorunda;
 * en.ts aynı yapıyı taşımalı (TS hatırlatır).
 */
export type TranslationDict = {
  // ====== Common ======
  common: {
    cancel: string;
    save: string;
    confirm: string;
    delete: string;
    edit: string;
    back: string;
    next: string;
    loading: string;
    search: string;
    add: string;
    remove: string;
    detail: string;
    close: string;
    submit: string;
    yes: string;
    no: string;
  };
  // ====== Nav ======
  nav: {
    home: string;
    etiket: string;
    sticker: string;
    gallery: string;
    blog: string;
    dashboard: string;
    about: string;
    contact: string;
    cart: string;
    login: string;
    logout: string;
    profile: string;
    orders: string;
    addresses: string;
    notifications: string;
    returns: string;
  };
  // ====== Home ======
  home: {
    eyebrow: string;
    h1Brand: string;
    h1Idea: string;
    heroDescription: string;
    ctaEtiket: string;
    ctaSticker: string;
    socialProof: string;
    aiPill: string;
    deliveryPill: string;
    pillar1Title: string;
    pillar1Desc: string;
    pillar2Title: string;
    pillar2Desc: string;
    pillar3Title: string;
    pillar3Desc: string;
    productEtiketSub: string;
    productStickerSub: string;
    productPriceLabel: string;
    productConfigure: string;
    productFrom: string;
    howItWorksEyebrow: string;
    howItWorksTitle: string;
    step1: string;
    step1Desc: string;
    step2: string;
    step2Desc: string;
    step3: string;
    step3Desc: string;
    step4: string;
    step4Desc: string;
    faqEyebrow: string;
    faqTitle: string;
    faqHelp: string;
    faqAll: string;
    bottomCtaTitle: string;
    bottomCtaDesc: string;
    bottomCtaPrimary: string;
    bottomCtaSecondary: string;
  };
  // ====== Configurator (sticker + etiket ortak) ======
  config: {
    breadcrumb: string;
    materialTitle: string;
    coatingTitle: string;
    finishTitle: string;
    sizeTitle: string;
    qtyTitle: string;
    customizationTitle: string;
    addToCart: string;
    cartAdded: string;
    deliveryEstimate: string;
    livePreview: string;
    quickSize: string;
    suggested: string;
    popular: string;
    selected: string;
    savings: string;
  };
  sticker: {
    pageTitle: string;
    pageSubtitle: string;
    pillStart: string;
    cutTypeTitle: string;
    cutTypeHint: string;
    cutTabaka: string;
    cutTabakaDesc: string;
    cutDieCut: string;
    cutDieCutDesc: string;
    shapeTitle: string;
    shapeHintDieCut: string;
    shapeHintTabaka: string;
    shapeSquare: string;
    shapeCircle: string;
    shapeCustom: string;
    shapeContour: string;
    cornerTitle: string;
    cornerSharp: string;
    cornerSharpDesc: string;
    cornerSoft: string;
    cornerSoftDesc: string;
  };
  etiket: {
    pageTitle: string;
    pageSubtitle: string;
    sizeHint: string;
    qtyHint: string;
    windingTitle: string;
    windingHint: string;
    windingOuter: string;
    windingInner: string;
  };
  // ====== Cart + Checkout ======
  cart: {
    title: string;
    empty: string;
    emptyDesc: string;
    itemsInCart: (n: number) => string;
    subtotal: string;
    shipping: string;
    free: string;
    total: string;
    vatIncluded: string;
    proceedToCheckout: string;
    continueShopping: string;
    freeShippingHint: (remaining: string) => string;
    summary: string;
  };
  checkout: {
    eyebrow: string;
    title: string;
    stepAddress: string;
    stepInvoice: string;
    stepPayment: string;
    deliveryAddress: string;
    invoiceInfo: string;
    cardInfo: string;
    saved: string;
    addNewAddress: string;
    individual: string;
    individualDesc: string;
    corporate: string;
    corporateDesc: string;
    tcKimlik: string;
    vkn: string;
    companyName: string;
    taxOffice: string;
    cardName: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
    accept: string;
    payNow: (amount: string) => string;
    processing: string;
  };
  orderSuccess: {
    success: string;
    orderReceived: string;
    orderNumber: string;
    emailSent: string;
    summaryLabel: string;
    estimatedDelivery: string;
    nextStepsTitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    orderDetail: string;
    backToPanel: string;
  };
  // ====== Auth ======
  auth: {
    eyebrow: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    kvkkAccept: string;
    sendLink: string;
    sending: string;
    or: string;
    googleContinue: string;
    autoCreateNote: string;
    helpText: string;
    helpLink: string;
    linkSentTitle: string;
    linkSentDesc: string;
    linkSentSpam: string;
    linkSentDifferent: string;
    notReady: string;
    notReadyDesc: string;
  };
  // ====== Footer ======
  footer: {
    tagline: string;
    newsletterEyebrow: string;
    newsletterTitle: string;
    newsletterDesc: string;
    newsletterPlaceholder: string;
    newsletterSubscribe: string;
    newsletterSuccess: string;
    newsletterSuccessDesc: string;
    groupProduct: string;
    groupCompany: string;
    groupSupport: string;
    groupAccount: string;
    copyright: string;
  };
};
