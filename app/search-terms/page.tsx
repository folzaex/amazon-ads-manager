import { getAmazonConnections } from "@/lib/supabaseAdmin";
import SearchTermsPage from "@/components/SearchTermsPage";

export const dynamic = "force-dynamic";

export default async function SearchTermsRoute({searchParams}:{searchParams:{profileId?:string}}) {
  let profiles: Awaited<ReturnType<typeof getAmazonConnections>> = [];
  try { profiles = await getAmazonConnections(); } catch {}
  return <SearchTermsPage profiles={profiles} initialProfileId={searchParams.profileId || ""} />;
}