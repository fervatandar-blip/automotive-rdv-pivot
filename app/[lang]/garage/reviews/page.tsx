import { notFound } from "next/navigation";
import { requireGarageMember } from "@/lib/dal";
import { REVIEWS_ENABLED } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { StarRating } from "@/components/star-rating";
import { averageRating, formatRating } from "@/lib/ratings";
import { APP_TIME_ZONE } from "@/lib/timezone";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  appointments: { services: { name: string } | null } | null;
};

function formatDate(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function GarageReviewsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  // Reviews are off for launch (lib/features.ts).
  if (!REVIEWS_ENABLED) notFound();
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageReviews;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, comment, created_at, profiles(full_name), appointments(services(name))"
    )
    .eq("garage_id", garage.id)
    .order("created_at", { ascending: false });

  const rows = (reviews ?? []) as unknown as ReviewRow[];
  const ratings = rows.map((review) => review.rating);
  const average = averageRating(ratings);
  const roundedAverage = average !== null ? Math.round(average) : 0;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.title}
        </h1>

        <div className="rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-6">
          <p className="text-sm font-medium text-ink-muted">
            {d.overallRating}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <StarRating
              rating={roundedAverage}
              label={dictionary.common.ratingOutOf.replace("{rating}", String(roundedAverage))}
              size="md"
            />
            <span className="text-sm text-ink-muted">
              {formatRating(ratings, d.noReviewsYet)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rows.length > 0 ? (
            rows.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">
                    {review.profiles?.full_name ?? d.clientFallback}
                  </span>
                  <StarRating
                    rating={review.rating}
                    label={dictionary.common.ratingOutOf.replace("{rating}", String(review.rating))}
                  />
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {review.comment ?? d.noCommentLeft}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  {review.appointments?.services?.name ?? d.serviceFallback}{" "}
<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />{formatDate(review.created_at, dateLocale)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-muted">
              {d.noReviewsYetBody}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
