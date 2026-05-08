import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Giriş yap veya kayıt ol",
  description: "Pim Etiket hesabınla siparişlerini takip et.",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
