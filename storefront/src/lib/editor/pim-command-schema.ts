/**
 * Pim editör komut whitelist — Zod discriminated union.
 * @see docs/PIM-EDITOR-KOMUT-SPEC.md
 */
import { z } from "zod";
import { EDITOR_MAX_MM, EDITOR_MIN_MM } from "@/lib/editor/coords";

const mm = z.number().min(EDITOR_MIN_MM).max(EDITOR_MAX_MM);
const offsetMm = z.number().min(-2).max(5);
const smoothness = z.number().min(0).max(100);

export const PimEditorCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_size"),
    widthMm: mm.optional(),
    heightMm: mm.optional(),
  }),
  z.object({
    action: z.literal("set_cut_offset"),
    offsetMm,
  }),
  z.object({
    action: z.literal("set_smoothness"),
    smoothness,
  }),
  z.object({
    action: z.literal("apply_auto_cut"),
    mode: z.enum(["contour", "hull"]),
  }),
  z.object({
    action: z.literal("apply_shape_cut"),
    shape: z.enum(["circle", "rect"]),
    cornerRadiusMm: z.number().min(0).max(50).optional(),
  }),
  z.object({
    action: z.literal("apply_template"),
    templateId: z.string().min(1).max(64),
  }),
  z.object({
    action: z.literal("toggle_layer"),
    layer: z.enum(["cut", "bleed", "safe", "white"]),
    on: z.boolean(),
  }),
  z.object({
    action: z.literal("remove_background"),
  }),
  z.object({
    action: z.literal("fit_view"),
    mode: z.enum(["contain", "center", "cover"]).default("contain"),
  }),
  z.object({
    action: z.literal("center_blade"),
  }),
  z.object({
    action: z.literal("set_size_from_reference"),
    referenceKey: z.string().min(1).max(128).optional(),
    estimatedWidthMm: mm.optional(),
    estimatedHeightMm: mm.optional(),
    confidence: z.number().min(0).max(1).optional(),
    isEstimate: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("clarify"),
    question: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().min(1).max(500),
  }),
]);

export type PimEditorCommand = z.infer<typeof PimEditorCommandSchema>;

export const PimCommandRequestSchema = z.object({
  /** Doğal dil (LLM Faz 1+) veya doğrudan komut */
  message: z.string().min(1).max(2000).optional(),
  command: PimEditorCommandSchema.optional(),
  product: z.enum(["sticker", "etiket"]).optional(),
});

export type PimCommandRequest = z.infer<typeof PimCommandRequestSchema>;
