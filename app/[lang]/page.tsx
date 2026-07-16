import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/config";

const features = [
  {
    title: "For clients",
    description:
      "Browse providers, compare services, and book a time that works for you in a few taps.",
  },
  {
    title: "For providers",
    description:
      "List your services, set your availability, and let clients book directly onto your calendar.",
  },
  {
    title: "Stay in sync",
    description:
      "Every booking updates in real time, so both sides always know what's confirmed.",
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
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between px-6 py-6 sm:px-12">
        <span className="text-lg font-semibold tracking-tight text-black dark:text-zinc-50">
          RDV
        </span>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <LanguageSwitcher lang={lang} />
          <Link
            href={`/${lang}/login`}
            className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log in
          </Link>
          <Link
            href={`/${lang}/signup`}
            className="rounded-full bg-foreground px-4 py-2 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:px-12">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          Book appointments, simply.
        </h1>
        <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          RDV connects clients with providers for fast, reliable scheduling
          &mdash; no phone tag required.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href={`/${lang}/signup`}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Get started
          </Link>
          <Link
            href={`/${lang}/login`}
            className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-8 text-base font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Log in
          </Link>
        </div>

        <div className="mt-24 grid w-full max-w-4xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-black/[.08] bg-white p-6 text-left dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h2 className="text-base font-semibold text-black dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
