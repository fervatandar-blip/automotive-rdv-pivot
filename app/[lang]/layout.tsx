import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import { locales, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Two faces, wired to Tailwind in globals.css: IBM Plex Sans for all UI
// text (font-sans; numbers use tabular-nums so times line up) and Archivo,
// semi-expanded through its width axis, for headings (font-display): a wide
// grotesque in the spirit of car badges and dashboards. latin-ext covers
// the accents in French and Luxembourgish names.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Variable font with the width axis; globals.css sets the width.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

// Pages below set a plain title ("Mes véhicules"); the template brands it.
// The homepage shares this segment, so it gets the full default title.
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { meta } = await getDictionary(resolveLocale(lang));
  return {
    title: { default: meta.siteTitle, template: "%s · RDV" },
    description: meta.siteDescription,
  };
}

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);

  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT adds the `dark` class
    // before React hydrates, so <html>'s class differs from the server's.
    <html
      lang={lang}
      className={`${plexSans.variable} ${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
