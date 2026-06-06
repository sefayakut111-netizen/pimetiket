/** Cron teslim hatırlatması — aktif üretim atamaları (issue/cancelled/shipped hariç) */
export const DEADLINE_REMINDER_STATUS_LIST = [
  "assigned",
  "sent",
  "acknowledged",
  "in_production",
  "ready",
] as const;
