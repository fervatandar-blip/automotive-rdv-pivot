import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link href={`/${lang}`} className="text-sm font-medium underline">
              &larr; Back
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Privacy Policy &amp; Terms of Service
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          RDV connects car owners with garages in Luxembourg for booking and
          paying for automotive services online. This page explains what
          data we collect, why, and the rights you have over it.
        </p>

        <Section title="What we collect">
          <p>
            <strong>Account data</strong> &mdash; your name, email address,
            and role (client, garage, mechanic). Passwords are handled
            entirely by our authentication provider and are never stored in
            our own database.
          </p>
          <p>
            <strong>Vehicle data</strong> &mdash; make, model, and year for
            vehicles you save to your account, used to speed up booking.
          </p>
          <p>
            <strong>Booking data</strong> &mdash; the garage, service, date,
            time, and status of each appointment, plus any messages you
            exchange with a garage about a booking.
          </p>
          <p>
            <strong>Payment data</strong> &mdash; payments are processed
            entirely by Stripe. We never see or store your card details;
            we retain the resulting invoice and transaction records (amount,
            date, commission) required to run the marketplace and meet legal
            obligations.
          </p>
          <p>
            <strong>Garage business data</strong> &mdash; for garage
            accounts: business name, address, VAT number, business
            registration number, and verification documents (business
            registration, insurance, certifications) uploaded for review.
          </p>
          <p>
            <strong>Location data</strong> &mdash; garage addresses and
            coordinates, used to show garages on a map and let clients
            search nearby.
          </p>
          <p>
            <strong>Device data</strong> &mdash; if you enable push
            notifications, a device token used to deliver them.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            We use a small number of processors to run the platform, each
            only receiving what they need to do their job: Stripe (payments
            and payouts), Google Maps (garage location display), Firebase
            Cloud Messaging (push notifications), Resend (transactional
            email), and Supabase (database, authentication, and file
            storage hosting). We do not sell personal data to anyone.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Invoices and payment records are retained as required by
            applicable Luxembourg commercial and tax law (commonly up to 10
            years), even after an account is closed, since we cannot
            selectively erase legally-required financial records. Other
            personal data &mdash; your profile, vehicles, messages, and
            device tokens &mdash; is kept only while your account is active.
          </p>
          <p>
            If a garage account is closed, its verification documents are
            deleted; the garage&apos;s past appointments, invoices, and
            reviews remain, since those records also belong in part to the
            clients who used that garage.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can access and update most of your own data directly in the
            app. You can request deletion of your account at any time from{" "}
            <Link href={`/${lang}/account`} className="underline">
              your account settings
            </Link>
            , which schedules your profile to be anonymized after a grace
            period during which you can cancel the request &mdash; financial
            records tied to your account are retained as described above and
            are not affected. You also have the right to object to or
            restrict certain processing, to receive a copy of your data, and
            to lodge a complaint with your national data protection
            authority (in Luxembourg, the CNPD).
          </p>
        </Section>

        <Section title="Booking terms">
          <p>
            Booking a service is a request sent to the garage; the garage
            confirms availability before your appointment is finalized.
            Payment is collected at the time of booking. Cancellation and
            refund terms are set by the individual garage and shown on their
            profile; contact the garage directly, or your platform
            administrator if a dispute can&apos;t be resolved directly.
          </p>
        </Section>
      </div>
    </div>
  );
}
