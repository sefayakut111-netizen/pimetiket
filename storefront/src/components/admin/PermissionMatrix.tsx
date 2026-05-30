"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/cn";
import {
  ADMIN_MODULE_ROWS,
  PERMISSION_ACTIONS,
  type RolePreset,
} from "@/lib/admin-role-presets";
import type { AdminModule } from "@/lib/admin-rbac";

interface PermissionMatrixProps {
  preset: RolePreset;
  className?: string;
}

export function PermissionMatrix({ preset, className }: PermissionMatrixProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded-xl border border-gri-200 bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gri-50 transition-colors rounded-xl"
      >
        <div>
          <div className="text-[13px] font-semibold text-lacivert">
            Gelişmiş izinler
          </div>
          <div className="text-[11.5px] text-gri-600 mt-0.5">
            {ADMIN_MODULE_ROWS.length} modül × {PERMISSION_ACTIONS.length} aksiyon
            — {preset.label} preset
          </div>
        </div>
        <Icon.ChevR
          size={18}
          className={cn(
            "text-gri-500 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-gri-200 overflow-x-auto">
          <table className="min-w-full text-[11.5px]">
            <thead className="bg-gri-50 text-gri-600 uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-semibold sticky left-0 bg-gri-50 z-10 min-w-[160px]">
                  Modül
                </th>
                {PERMISSION_ACTIONS.map((a) => (
                  <th
                    key={a.key}
                    className="px-2 py-2 text-center font-semibold whitespace-nowrap"
                    title={a.label}
                  >
                    {a.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ADMIN_MODULE_ROWS.map(({ id, label }) => {
                const row = preset.permissions[id as AdminModule];
                const anyGranted = PERMISSION_ACTIONS.some((a) => row[a.key]);
                if (!anyGranted) return null;
                return (
                  <tr
                    key={id}
                    className="border-t border-gri-100 hover:bg-gri-50/80"
                  >
                    <td className="px-3 py-1.5 font-medium text-lacivert sticky left-0 bg-white z-10">
                      {label}
                    </td>
                    {PERMISSION_ACTIONS.map((a) => (
                      <td key={a.key} className="px-2 py-1.5 text-center">
                        <span
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded",
                            row[a.key]
                              ? "bg-yesil-soft text-yesil-koyu"
                              : "bg-gri-100 text-gri-400"
                          )}
                          title={`${label} — ${a.label}`}
                        >
                          {row[a.key] ? (
                            <Icon.Check size={12} />
                          ) : (
                            <span className="text-[10px]">·</span>
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-gri-500 border-t border-gri-100">
            Yetkiler{" "}
            <code className="text-[10px]">admin_role_permissions</code> tablosundan
            rol bazlı uygulanır. Preset{" "}
            <strong>{preset.adminRole}</strong> rolünü atar.
          </p>
        </div>
      )}
    </div>
  );
}
