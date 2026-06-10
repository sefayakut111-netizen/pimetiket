import { HomeFaqSchema } from "@/components/seo/HomeFaqSchema";
import { getPublishedReviewStats } from "@/lib/reviews-server";
import HomePage from "./HomePageClient";

export default async function Home() {
  const reviewStats = await getPublishedReviewStats();
  return (
    <>
      <HomeFaqSchema />
      <HomePage reviewStats={reviewStats} />
    </>
  );
}
