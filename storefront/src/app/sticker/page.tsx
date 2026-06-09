import { StickerHubSchema } from "@/components/seo/StickerHubSchema";
import StickerGridPage from "./StickerPageClient";

export default function StickerPage() {
  return (
    <>
      <StickerHubSchema />
      <StickerGridPage />
    </>
  );
}
