import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Prova kuyruğu" };

export default function AdminProvaLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
