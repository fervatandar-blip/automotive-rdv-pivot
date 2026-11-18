import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { summarizeWeeklyHours } from "@/lib/opening-hours";
import { ProfileEditor } from "./profile-editor";

const STATUS_STYLES: Record<string, string> = {
  approved:
    "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
  pending:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

export default async function GarageProfilePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);

  // The first-run wizard collects the profile and platform-terms consent
  // in one pass; until that's done there's nothing to edit here yet.
  if (!garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/onboarding`);
  }

  const dictionary = await getDictionary(lang);
  const p = dictionary.garageProfile;
  const supabase = await createClient();

  const { data: availability } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("garage_id", garage.id);

  const status = garage.status as "approved" | "pending" | "rejected";
  const statusLabel =
    status === "approved" ? p.statusApproved : status === "rejected" ? p.statusRejected : p.statusPending;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{p.title}</h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{p.subtitle}</p>
          {status === "approved" ? (
            <Link
              href={`/${lang}/garages/${garage.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium underline"
            >
              {p.viewPublicPage}
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {p.publicPageHidden}{" "}
              <Link href={`/${lang}/garage/documents`} className="font-medium underline">
                {p.verificationLink}
              </Link>
            </p>
          )}
        </header>

        <ProfileEditor
          lang={lang}
          p={p}
          d={dictionary.garageOnboarding}
          garage={garage}
          identityLocked={status === "approved"}
          weeklyHours={summarizeWeeklyHours(availability ?? [])}
        />
      </div>
    </div>
  );
}
