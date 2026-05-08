import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Fason atölye" };

export default function AdminFasonLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
