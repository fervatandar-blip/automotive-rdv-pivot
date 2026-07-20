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
    description: "We configure your profile and you start welcoming clients on your own schedule.",
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

      <main className="flex flex-1 flex-col items-center px-6 py-12 sm:px-12">
        <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="flex flex-col gap-10">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
                List your garage on RDV Pro.
              </h1>
              <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                Start with a free, personalized demo. No commitment, no
                credit card, just a walkthrough tailored to your specialty.
              </p>
            </div>

            <ol className="flex flex-col gap-6">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
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
          </div>

          <DemoLeadForm />
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
