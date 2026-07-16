import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { removeMechanic } from "@/app/actions/staff";
import { InviteMechanicForm } from "./invite-form";

type StaffRow = {
  profile_id: string;
  profiles: { full_name: string; email: string } | null;
};

export default async function GarageStaffPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("garage_staff")
    .select("profile_id, profiles(full_name, email)")
    .eq("garage_id", garage.id);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name} &mdash; staff
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <InviteMechanicForm />

        <div className="flex flex-col gap-4">
          {staff && staff.length > 0 ? (
            (staff as unknown as StaffRow[]).map((row) => (
              <div
                key={row.profile_id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {row.profiles?.full_name ?? "Mécanicien"}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {row.profiles?.email}
                  </p>
                </div>
                <form action={removeMechanic}>
                  <input type="hidden" name="lang" value={lang} />
                  <input
                    type="hidden"
                    name="profileId"
                    value={row.profile_id}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No mécaniciens yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
