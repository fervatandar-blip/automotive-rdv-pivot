import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cancelMechanicInvite, removeMechanic } from "@/app/actions/staff";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { InviteMechanicForm } from "./invite-form";

type StaffRow = {
  profile_id: string;
  profiles: { full_name: string; email: string } | null;
};

type InviteRow = {
  id: string;
  email: string;
  expires_at: string;
};

export default async function GarageStaffPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageStaff;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const [{ data: staff }, { data: invites }] = await Promise.all([
    supabase
      .from("garage_staff")
      .select("profile_id, profiles(full_name, email)")
      .eq("garage_id", garage.id),
    // Only the email the owner typed is shown for a pending invite -- never
    // anything from a matching account, which the garage has no right to
    // see until the invite is accepted.
    supabase
      .from("garage_invites")
      .select("id, email, expires_at")
      .eq("garage_id", garage.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const inviteRows = (invites ?? []) as InviteRow[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; {d.backToDashboard}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name} &mdash; {d.staffSuffix}
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <InviteMechanicForm dictionary={d.inviteForm} />

        {inviteRows.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.pendingInvites}
            </h2>
            {inviteRows.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-black/[.12] bg-white p-4 dark:border-white/[.2] dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-black dark:text-zinc-50">
                    {invite.email}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {d.awaitingAcceptance}{" "}
                    {d.expiresOn.replace(
                      "{date}",
                      new Date(invite.expires_at).toLocaleDateString(dateLocale, {
                        timeZone: APP_TIME_ZONE,
                        day: "numeric",
                        month: "short",
                      })
                    )}
                  </p>
                </div>
                <form action={cancelMechanicInvite}>
                  <input type="hidden" name="lang" value={lang} />
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    {d.cancelInvite}
                  </button>
                </form>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {d.teamMembers}
          </h2>
          {staffRows.length > 0 ? (
            staffRows.map((row) => (
              <div
                key={row.profile_id}
                className="flex items-center justify-between gap-4 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-black dark:text-zinc-50">
                    {row.profiles?.full_name ?? d.mechanicFallback}
                  </p>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
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
                    className="shrink-0 rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    {d.remove}
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noMechanicsYet}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
