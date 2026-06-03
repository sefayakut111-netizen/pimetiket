/** Aktif fason ataması — kapasite sayımı ve UI filtreleri (tek kaynak) */
export const ACTIVE_ASSIGNMENT_STATUS_LIST = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
  "issue",
] as const;

export type ActiveAssignmentStatus =
  (typeof ACTIVE_ASSIGNMENT_STATUS_LIST)[number];

export const ACTIVE_ASSIGNMENT_STATUSES = new Set<string>(
  ACTIVE_ASSIGNMENT_STATUS_LIST
);
