import type { PricebookSnapshot } from "@/lib/pricing-pricebook-types";

/** Deterministik mini-matris — pricebook lookup testleri */
export const MINI_PRICEbook_SNAPSHOT: PricebookSnapshot = {
  axes: { width: [30, 50], height: [30, 50], qty: [1000, 2000] },
  matrices: {
    kuse: {
      meta: {
        id: "kuse",
        material_key: "kuse",
        display_name: "Kuşe",
        active: true,
        version: 1,
      },
      cells: {
        "30:30:1000": 0.1,
        "50:30:1000": 0.11,
        "30:50:1000": 0.12,
        "50:50:1000": 0.13,
        "30:30:2000": 0.09,
        "50:30:2000": 0.1,
        "30:50:2000": 0.11,
        "50:50:2000": 0.12,
      },
    },
    inactive_mat: {
      meta: {
        id: "inactive_mat",
        material_key: "inactive_mat",
        display_name: "Inactive",
        active: false,
        version: 1,
      },
      cells: { "30:30:1000": 0.05 },
    },
  },
  markup_pct: 50,
};
