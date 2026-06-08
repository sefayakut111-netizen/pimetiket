import { notFound } from "next/navigation";
import { ENABLE_STUDIO_EDITOR } from "@/lib/sticker-feature-flags";
import StudioEditorClient from "./StudioEditorClient";

export default function StudioPage() {
  if (!ENABLE_STUDIO_EDITOR) {
    notFound();
  }

  return <StudioEditorClient />;
}
