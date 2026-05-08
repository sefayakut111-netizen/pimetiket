import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "AI QC kuyruğu" };

export default function AdminAiQcLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
