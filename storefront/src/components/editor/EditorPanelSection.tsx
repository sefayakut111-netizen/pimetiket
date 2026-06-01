import type { ReactNode } from "react";

export function EditorPanelSection({
  title,
  children,
  first,
}: {
  title: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section className={first ? "pb-4" : "border-t border-gri-100 py-4"}>
      <h2 className="text-[12px] font-semibold uppercase tracking-wide text-gri-600">
        {title}
      </h2>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}
