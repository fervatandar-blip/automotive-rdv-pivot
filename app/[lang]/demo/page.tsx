import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DemoLeadForm } from "./demo-lead-form";

export default async function DemoPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.demo;

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
              {d.forDrivers}
            </Link>
            <Link
              href={`/${lang}/demo`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {d.forGarages}
            </Link>
            <a
              href="#lead-form"
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {d.contact}
            </a>
          </nav>

          <div className="flex items-center gap-4 text-sm font-medium">
            <LanguageSwitcher lang={lang} />
            <Link
              href={`/${lang}/login`}
              className="text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              {d.logIn}
            </Link>
            <a
              href="#lead-form"
              className="rounded-full bg-brand-600 px-4 py-2 text-white transition-colors hover:bg-brand-700"
            >
              {d.bookADemo}
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12 sm:px-12">
        <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div className="flex flex-col gap-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-black sm:text-5xl dark:text-zinc-50">
                {d.heroTitle}
              </h1>
              <p className="mt-6 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
                {d.heroSubtitle}
              </p>
            </div>

            <ol className="flex flex-col gap-6">
              {d.steps.map((step, index) => (
                <li key={step.title} className="relative flex gap-4">
                  {index < d.steps.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-4 top-8 -bottom-6 w-px bg-black/[.08] dark:bg-white/[.145]"
                    />
                  )}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
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

            <span className="inline-flex w-fit items-center rounded-full border border-brand-600/20 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-950 dark:text-brand-400">
              {d.badge}
            </span>
          </div>

          <div id="lead-form">
            <DemoLeadForm dictionary={d.leadForm} />
          </div>
        </div>

        <div className="mt-24 grid w-full max-w-5xl gap-6 sm:grid-cols-2">
          {d.benefits.map((benefit) => (
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
