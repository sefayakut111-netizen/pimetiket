"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AdminPathLabelContextValue = {
  labels: Record<string, string>;
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
};

const AdminPathLabelContext = createContext<AdminPathLabelContextValue | null>(
  null
);

export function AdminPathLabelProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setLabel = useCallback((segment: string, label: string) => {
    setLabels((prev) =>
      prev[segment] === label ? prev : { ...prev, [segment]: label }
    );
  }, []);

  const clearLabel = useCallback((segment: string) => {
    setLabels((prev) => {
      if (!prev[segment]) return prev;
      const next = { ...prev };
      delete next[segment];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ labels, setLabel, clearLabel }),
    [labels, setLabel, clearLabel]
  );

  return (
    <AdminPathLabelContext.Provider value={value}>
      {children}
    </AdminPathLabelContext.Provider>
  );
}

export function useAdminPathLabels() {
  return useContext(AdminPathLabelContext);
}

/** Dinamik admin breadcrumb / topbar etiketi (ör. fason partner adı). */
export function useSetAdminPathLabel(
  segment: string,
  label: string | null | undefined
) {
  const ctx = useAdminPathLabels();
  const setLabel = ctx?.setLabel;
  const clearLabel = ctx?.clearLabel;

  useEffect(() => {
    if (!setLabel || !clearLabel || !label?.trim()) return;
    const trimmed = label.trim();
    setLabel(segment, trimmed);
    return () => clearLabel(segment);
    // setLabel/clearLabel useCallback ile sabit — ctx/labels deps DÖNGÜ yaratır
  }, [setLabel, clearLabel, segment, label]);
}
