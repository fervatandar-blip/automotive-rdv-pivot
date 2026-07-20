import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/config";

const features = [
  {
    title: "Search & compare",
    description:
      "Filter garages by brand, specialty, EV capability, and price, and see them on a map before you choose.",
  },
  {
    title: "Verified garages",
    description:
      "Every garage completes a document verification process, and real client ratings & reviews are right on their profile.",
  },
  {
    title: "Book & pay online",
    description:
      "Pick a time, pay securely at booking, and get a PDF invoice automatically once the work is done.",
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
        <Image
          src="/logo.png"
          alt="RDV"
          width={40}
          height={40}
          className="rounded-lg"
          priority
        />
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

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center sm:px-12">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          Find a trusted garage in Luxembourg.
        </h1>
        <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          RDV connects car owners with verified garages &mdash; search,
          compare, and book online in a few taps.
        </p>
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href={`/${lang}/garages`}
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
