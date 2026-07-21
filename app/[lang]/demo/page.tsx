import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/config";
import { DemoLeadForm } from "./demo-lead-form";

const STEPS = [
  {
    title: "Fill in the form",
    description: "Share a few details about your garage — it takes less than a minute.",
  },
  {
    title: "Get a free demo",
    description: "A member of our team will walk you through the platform, tailored to your specialty.",
  },
  {
    title: "Go live when you're ready",
    description: "We'll configure your profile so you can start welcoming clients on your schedule.",
  },
];

const BENEFITS = [
  {
    title: "Expand your local reach",
    description:
      "Be discovered by car owners across Luxembourg actively searching for a trusted garage near them.",
  },
  {
    title: "Streamlined scheduling",
    description:
      "A calendar built for a garage floor — confirmations, rescheduling, and staff assignment, all in one place.",
  },
  {
    title: "Automated digital workflow",
    description:
      "From the first request to the completed job, RDV Pro automates the busywork so your team can focus on the work itself.",
  },
  {
    title: "Stand out with verification",
    description:
      "A document verification process and genuine client reviews on your profile establish credibility from day one.",
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
      <header className="border-b border-gray-100 px-6 dark:border-white/[.145]">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-6">
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
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link
              href={`/${lang}`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              For drivers
            </Link>
            <Link
              href={`/${lang}/demo`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              For garages
            </Link>
            <a
              href="#lead-form"
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-4 text-sm font-medium">
            <LanguageSwitcher lang={lang} />
            <Link
              href={`/${lang}/login`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Log in
            </Link>
            <a
              href="#lead-form"
              className="rounded-full bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12 sm:px-12">
        <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="flex flex-col gap-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-black sm:text-5xl dark:text-zinc-50">
                Grow your garage business with RDV Pro.
              </h1>
              <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                Start with a free, personalized demo. No commitment, no
                credit card, just a walkthrough tailored to your specialty.
              </p>
            </div>

            <ol className="flex flex-col gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  {index < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-4 top-8 -bottom-6 w-px bg-black/[.08] dark:bg-white/[.145]"
                    />
                  )}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold text-black dark:text-zinc-50">
                      {step.title}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <span className="inline-flex w-fit items-center rounded-full border border-blue-600/20 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-950 dark:text-blue-400">
              Now onboarding garages across Luxembourg
            </span>
          </div>

          <div id="lead-form">
            <DemoLeadForm />
          </div>
        </div>

        <div className="mt-24 grid w-full max-w-5xl gap-6 sm:grid-cols-2">
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
      </main>
    </div>
  );
}
