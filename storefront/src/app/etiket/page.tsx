import { EtiketHubSchema } from "@/components/seo/EtiketHubSchema";
import { getPublishedReviewStats } from "@/lib/reviews-server";
import EtiketGridPage from "./EtiketPageClient";

export default async function EtiketPage() {
  const reviewStats = await getPublishedReviewStats();
  return (
    <>
      <EtiketHubSchema />
      <EtiketGridPage reviewStats={reviewStats} />
    </>
  );
}
