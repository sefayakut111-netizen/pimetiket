import { StickerHubSchema } from "@/components/seo/StickerHubSchema";
import { getPublishedReviewStats } from "@/lib/reviews-server";
import StickerGridPage from "./StickerPageClient";

export default async function StickerPage() {
  const reviewStats = await getPublishedReviewStats();
  return (
    <>
      <StickerHubSchema />
      <StickerGridPage reviewStats={reviewStats} />
    </>
  );
}
