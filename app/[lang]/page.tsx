import Link from "next/link";
import { Search, ShieldCheck, Zap } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AnimatedLogo } from "@/components/animated-logo";
import { resolveLocale } from "@/lib/i18n/config";

const features = [
  {
    icon: Search,
    title: "Search & compare",
    description:
      "Filter garages by brand, specialty, EV capability, and price, and see them on a map before you choose.",
    emphasized: false,
  },
  {
    icon: ShieldCheck,
    title: "Verified garages",
    description:
      "Every garage completes a document verification process, and real client ratings & reviews are right on their profile.",
    emphasized: false,
  },
  {
    icon: Zap,
    title: "Book instantly",
    description:
      "See real-time availability and lock in a time in a couple of taps — no phone calls, no waiting to hear back.",
    emphasized: true,
  },
];

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-black">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-[32rem] w-[32rem] rounded-full bg-brand-600/[.06] blur-3xl dark:bg-brand-500/[.08]"
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-6 sm:px-12">
          <Link href={`/${lang}`}>
            <AnimatedLogo size={48} />
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

        <main className="flex flex-1 flex-col px-6 py-16 sm:px-12">
          <div className="mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex flex-col items-start text-left">
              <h1 className="max-w-xl text-4xl font-black tracking-tighter text-black sm:text-5xl lg:text-6xl dark:text-zinc-50">
                Find a trusted garage in Luxembourg.
              </h1>
              <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                RDV connects car owners with verified garages &mdash; search,
                compare, and book online in a few taps.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href={`/${lang}/garages`}
                  className="flex h-12 items-center justify-center rounded-full bg-brand-600 px-8 text-base font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                >
                  Find a garage
                </Link>
                <Link
                  href={`/${lang}/demo`}
                  className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-8 text-base font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  List your garage
                </Link>
              </div>
            </div>

            <div className="relative hidden items-center justify-center lg:flex">
              <div
                aria-hidden
                className="absolute h-64 w-64 rounded-full bg-brand-600/10 blur-3xl dark:bg-brand-500/10"
              />
              <div
                aria-hidden
                className="absolute h-40 w-px rotate-45 bg-brand-600/20 dark:bg-brand-500/30"
              />
              <div
                aria-hidden
                className="absolute h-40 w-px -rotate-45 bg-brand-600/20 dark:bg-brand-500/30"
              />
              <AnimatedLogo size={160} className="relative z-10" />
            </div>
          </div>

          <div className="mx-auto mt-24 grid w-full max-w-6xl gap-6 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={
                    feature.emphasized
                      ? "rounded-xl border border-brand-600/20 bg-brand-50 p-6 text-left dark:border-brand-500/30 dark:bg-brand-950"
                      : "rounded-xl border border-black/[.08] bg-white p-6 text-left dark:border-white/[.145] dark:bg-zinc-950"
                  }
                >
                  <div
                    className={
                      feature.emphasized
                        ? "flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white"
                        : "flex h-10 w-10 items-center justify-center rounded-lg bg-black/[.04] text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300"
                    }
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-black dark:text-zinc-50">
                    {feature.title}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
