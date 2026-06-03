/**
 * Pim Etiket — Icon library.
 * Lucide-inspired outline icons (1.6-2px stroke, 24px viewBox, currentColor).
 *
 * Kullanım:
 *   import { Icon } from "@/components/Icon";
 *   <Icon.Sparkle size={20} />
 *   <Icon.Truck size={16} className="text-pim-mercan" />
 */

interface IconProps {
  size?: number;
  className?: string;
}

const baseProps = (s: number) =>
  ({
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const);

const Sparkle = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 17l.8 2.4L22 20l-2.2.6L19 23l-.8-2.4L16 20l2.2-.6z" />
  </svg>
);

const Box = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
  </svg>
);

const Truck = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M14 18V6H3v12h2" />
    <path d="M21 18h-2" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
    <path d="M14 9h4l3 4v5h-2" />
  </svg>
);

const Bolt = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M13 2L3 14h7l-1 8 10-12h-7z" />
  </svg>
);

const Wallet = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0 0 4h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6" />
    <circle cx="17" cy="14" r="1.4" />
  </svg>
);

const Search = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

const Cart = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="9" cy="20" r="1.6" />
    <circle cx="18" cy="20" r="1.6" />
    <path d="M2 3h2l3.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6" />
  </svg>
);

const ChevR = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const Plus = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const Check = ({ size = 14, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="3" className={className}>
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const Info = ({ size = 14, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v0M12 11v6" />
  </svg>
);

const Star = ({ size = 16, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2l2.9 6.9L22 10l-5.4 4.7L18 22l-6-3.6L6 22l1.4-7.3L2 10l7.1-1.1z" />
  </svg>
);

const ArrowR = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Roll = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);

const Sticker = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M15.5 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h9l6-6V6a3 3 0 0 0-3-3z" />
    <path d="M15 21v-3a3 3 0 0 1 3-3h3" />
  </svg>
);

const ChatBubble = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1.4 3.5A8 8 0 0 1 21 12z" />
  </svg>
);

const Calendar = ({ size = 16, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

const Home = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const User = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

const Eye = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const X = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Cog = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const Doc = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="15" y2="17" />
  </svg>
);

const Tag = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <circle cx="7" cy="7" r="1.5" />
  </svg>
);

const Users = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const Refresh = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
  </svg>
);

const Menu = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

// Sefa 20 May v68 UX paket B: Düzenle (kalem) — sepet kartında
// "Düzenle" butonu için. Lucide pencil benzeri stilize.
const Edit = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

// Sefa 20 May v68 UX paket C: Trust rozetleri için Shield
const Shield = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.8" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

// Sefa 20 May v68 UX paket C: Tahmini teslimat için (paket)
const Package = ({ size = 20, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.8" className={className}>
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="M3.27 6.96 12 12.01l8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);

const Instagram = ({ size = 16, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

// Sefa Haz v69 — kritik UI ikon seti (ICON-DESIGN-SPEC.md uyumlu).
// Lock: SSL / 3D Secure / KVKK güven rozetleri (PaymentBadges, checkout, footer).
const Lock = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <rect x="4" y="10.5" width="16" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2.5" />
  </svg>
);

// Heart: favori / beğeni (ürün kartları, galeri).
const Heart = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7z" />
  </svg>
);

// Download: dosya/prova/rapor indirme (admin, profil).
const Download = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

// Upload: dosya/tasarım yükleme (editor, sipariş, admin).
const Upload = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </svg>
);

// ArrowL: geri / önceki (wizard, pagination). ArrowR'ın ayna eşi, aynı 2.0 stroke.
const ArrowL = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

// Sefa Haz v69 — orta + konfor set (ICON-DESIGN-SPEC.md uyumlu).
// Clock: teslimat süresi / sipariş timeline (kargo, sipariş detayı).
const Clock = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);

// Copy: kopyala (sipariş no, kupon, referans kodu).
const Copy = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// AlertCircle: uyarı / form doğrulama / stok bildirimi.
const AlertCircle = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.5v0" />
  </svg>
);

// Trash: sil (sepetten çıkar, admin tablo).
const Trash = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

// WhatsApp: destek + sosyal (footer, iletişim). Marka glyph, 2.0 stroke.
const WhatsApp = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="2" className={className}>
    <path d="M12 3a9 9 0 0 0-7.74 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
    <path d="M9.4 8.6c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .6.4l.6 1.5c.1.2 0 .4-.1.5l-.5.6c-.1.1-.1.3 0 .4.5 1 1.3 1.8 2.3 2.3.2.1.3 0 .4 0l.6-.6c.1-.1.3-.2.5-.1l1.5.7c.4.2.4.4.4.6 0 .5-.2 1-.6 1.3-.4.3-.9.5-1.4.4-1.7-.2-3.4-1.2-4.7-2.5s-2.3-3-2.5-4.7c0-.5.1-1 .3-1.4z" />
  </svg>
);

// Share: paylaş (sosyal, referral, tasarım).
const Share = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

// Print: yazdır (kargo etiketi, prova).
const Print = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="7" rx="1" />
  </svg>
);

// CreditCard: ödeme yöntemi (checkout, profil).
const CreditCard = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.6" className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
    <path d="M6 15h4" />
  </svg>
);

// Mail: e-posta / iletişim (footer, contact).
const Mail = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

// Phone: telefon destek (contact, admin).
const Phone = ({ size = 18, className }: IconProps) => (
  <svg {...baseProps(size)} strokeWidth="1.7" className={className}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const Icon = {
  Sparkle,
  Box,
  Truck,
  Bolt,
  Wallet,
  Search,
  Cart,
  ChevR,
  Plus,
  Check,
  Info,
  Star,
  ArrowR,
  Roll,
  Sticker,
  ChatBubble,
  Calendar,
  Home,
  User,
  Eye,
  EyeOff,
  X,
  Cog,
  Doc,
  Tag,
  Users,
  Refresh,
  Menu,
  Edit,
  Shield,
  Package,
  Instagram,
  Lock,
  Heart,
  Download,
  Upload,
  ArrowL,
  Clock,
  Copy,
  AlertCircle,
  Trash,
  WhatsApp,
  Share,
  Print,
  CreditCard,
  Mail,
  Phone,
};

export type IconName = keyof typeof Icon;
