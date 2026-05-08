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
};

export type IconName = keyof typeof Icon;
