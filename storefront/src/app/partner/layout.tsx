import type { Metadata } from "next";
import { PartnerShell } from "@/components/layout/PartnerShell";

export const metadata: Metadata = {
  title: "Partner paneli",
  robots: { index: false, follow: false },
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PartnerShell>{children}</PartnerShell>;
}
