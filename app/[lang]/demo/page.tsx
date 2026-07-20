import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/config";
import { DemoLeadForm } from "./demo-lead-form";

const BENEFITS = [
  {
    title: "Get discovered by local clients",
    description:
      "Show up in search and on the map when car owners near you are looking for a garage.",
  },
  {
    title: "Manage bookings in one place",
    description:
      "A calendar built for a garage floor — confirm, reschedule, assign to a mechanic, done.",
  },
  {
    title: "Get paid automatically",
    description:
      "Clients pay online at booking. Funds settle straight to your account via Stripe — no chasing invoices.",
  },
  {
    title: "Build trust with verification",
    description:
      "A document verification process and real client reviews on your profile set you apart.",
  },
];

const STEPS = [
  {
    title: "Book a demo",
    description: "Tell us a bit about your garage and pick a time that works.",
  },
  {
    title: "We set up your account",
    description:
      "Our team provisions your garage profile, services, and payments during the call.",
  },
  {
    title: "Start taking bookings",
    description: "Go live and start receiving and managing bookings from day one.",
  },
];

export default async function DemoPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-6 sm:px-12">
        <Link href={`/${lang}`}>
          <Image
            src="/logo.png"
            alt="RDV"
            width={40}
            height={40}
            className="rounded-lg"
            priority
          />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <LanguageSwitcher lang={lang} />
          <Link
            href={`/${lang}/login`}
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log in
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-16 sm:px-12">
        <div className="flex flex-col items-center text-center">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
            Grow your garage with RDV.
          </h1>
          <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Join the marketplace connecting Luxembourg car owners with trusted
            garages. Book a short demo and we&apos;ll set your account up for
            you.
          </p>
          <a
            href="#book-a-demo"
            className="mt-10 flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Book a demo
          </a>
        </div>

        <div className="mt-24 grid w-full max-w-4xl gap-6 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-xl border border-black/[.08] bg-white p-6 text-left dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                {benefit.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-24 flex w-full max-w-4xl flex-col gap-8">
          <h2 className="text-center text-2xl font-semibold text-black dark:text-zinc-50">
            How it works
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="flex flex-col gap-2 text-left">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-500">
                  Step {index + 1}
                </span>
                <h3 className="text-base font-semibold text-black dark:text-zinc-50">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          id="book-a-demo"
          className="mt-24 flex w-full max-w-md scroll-mt-12 flex-col gap-6"
        >
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Book a demo
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Tell us about your garage and we&apos;ll be in touch to set up a
              short call.
            </p>
          </div>
          <DemoLeadForm />
        </div>
      </main>
    </div>
  );
}
