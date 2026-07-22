import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { averageRating, formatRating } from "@/lib/ratings";

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
  appointments: { services: { name: string } | null } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
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
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Reviews
        </h1>

        <div className="rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Overall rating
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-semibold text-black dark:text-zinc-50">
              {"★".repeat(roundedAverage)}
              {"☆".repeat(5 - roundedAverage)}
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatRating(ratings)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {rows.length > 0 ? (
            rows.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black dark:text-zinc-50">
                    {review.profiles?.full_name ?? "Client"}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {review.comment ?? "No comment left"}
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                  {review.appointments?.services?.name ?? "Service"} &middot;{" "}
                  {formatDate(review.created_at)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No reviews yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
