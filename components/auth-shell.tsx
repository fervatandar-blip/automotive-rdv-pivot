import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Check, Clock, LogIn } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicensePlate } from "@/components/license-plate";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

/**
 * The frame every sign-in, sign-up and password page shares: a dark brand
 * panel (lg and up) that says what RDV does for this audience, with a
 * small, faithful piece of the real product -- and the form on the canvas,
 * no card around it.
 */
export function AuthShell({
  lang,
  dictionary,
  audience = "client",
  children,
}: {
  lang: Locale;
  dictionary: Dictionary;
  // Who the page is for: drivers or workshops. Changes the panel only.
  audience?: "client" | "workshop";
  children: ReactNode;
}) {
  const panel = dictionary.auth.panel;
  const copy = audience === "workshop" ? panel.workshop : panel.client;

  return (
    <div className="flex flex-1 bg-canvas">
      <aside className="relative hidden w-[44%] max-w-xl shrink-0 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex xl:p-12">
        <Link href={`/${lang}`} aria-label="RDV" className="self-start">
          <BrandLogo size={34} inverted />
        </Link>

        <div className="flex flex-col gap-8">
          <h2 className="max-w-md font-display text-3xl font-bold leading-tight tracking-[-0.02em] xl:text-4xl">
            {copy.title}
          </h2>
          <ul className="flex flex-col gap-3.5">
            {copy.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-white/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Check aria-hidden className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
          {audience === "workshop" ? (
            <WorkshopSnippet dictionary={dictionary} />
          ) : (
            <ClientSnippet dictionary={dictionary} />
          )}
        </div>

        <p className="text-xs text-white/40">© {new Date().getFullYear()} RDV, Luxembourg</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/${lang}`} className="lg:hidden" aria-label="RDV">
            <BrandMark size={32} />
          </Link>
          <Link
            href={`/${lang}`}
            className="hidden items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink lg:inline-flex"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            {panel.backHome}
          </Link>
          <LanguageSwitcher lang={lang} />
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[25rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** An upcoming appointment, as clients see it on their Overview. */
function ClientSnippet({ dictionary }: { dictionary: Dictionary }) {
  const p = dictionary.auth.panel;
  return (
    <div aria-hidden className="flex max-w-sm select-none items-center gap-4 rounded-2xl bg-white p-4 text-zinc-900 shadow-2xl shadow-black/40">
      <div className="flex min-w-16 flex-col items-center rounded-xl bg-brand-50 px-3 py-2 text-brand-700">
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{p.previewWeekday}</span>
        <span className="font-display text-2xl font-bold leading-none tracking-[-0.02em]">4</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{p.previewMonth}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-base font-bold tracking-[-0.02em]">{p.previewService}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-500">
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
          {/* Comma inside the first span: the flex gap would otherwise sit before it. */}
          <span className="tabular-nums">10:30,</span>
          <span className="truncate">{p.previewWorkshop}</span>
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {dictionary.clientDashboard.statusConfirmed}
      </span>
    </div>
  );
}

/** A card from the workshop job board. */
function WorkshopSnippet({ dictionary }: { dictionary: Dictionary }) {
  const p = dictionary.auth.panel;
  const d = dictionary.garageDashboard;
  return (
    <div aria-hidden className="flex max-w-xs select-none flex-col gap-3 rounded-2xl bg-white p-4 text-zinc-900 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 text-sm font-bold tabular-nums">
        <Clock className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
        08:30
      </div>
      <div>
        <p className="font-display text-[15px] font-bold tracking-[-0.02em]">{p.previewService}</p>
        <p className="mt-1">
          <LicensePlate plate="LU 4411" label={d.plateLabel} />
        </p>
      </div>
      <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold">
        <LogIn className="h-4 w-4" strokeWidth={2} />
        {d.actionCheckIn}
      </span>
    </div>
  );
}
