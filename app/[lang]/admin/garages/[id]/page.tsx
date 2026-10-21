import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import {
  reviewDocument,
  setGarageStatus,
  setVerificationLevel,
} from "@/app/actions/documents";

const STATUS_BADGE_CLASSNAME: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  approved:
    "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  rejected: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
};

const VERIFICATION_LEVELS = [
  "basic",
  "verified",
  "ev_certified",
  "trusted_partner",
];

type DocRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  status: string;
  notes: string | null;
};

export default async function AdminGarageDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: garageId } = await params;
  const lang = resolveLocale(rawLang);
  await requireSuperAdmin(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.adminGarageDetail;
  const supabase = await createClient();

  const { data: garage } = await supabase
    .from("garages")
    .select("*")
    .eq("id", garageId)
    .single();

  if (!garage) {
    notFound();
  }

  const { data: documents } = await supabase
    .from("garage_documents")
    .select("id, document_type, file_name, file_path, status, notes")
    .eq("garage_id", garageId);

  const byType = new Map<string, DocRow>();
  for (const doc of (documents ?? []) as DocRow[]) {
    byType.set(doc.document_type, doc);
  }

  // One batched Storage call instead of one sequential round-trip per
  // document -- createSignedUrls preserves input order, so results line up
  // with docsToSign by index.
  const docsToSign = Array.from(byType.values());
  const signedUrls = new Map<string, string>();
  if (docsToSign.length > 0) {
    const { data: signedUrlResults } = await supabase.storage
      .from("garage-documents")
      .createSignedUrls(
        docsToSign.map((doc) => doc.file_path),
        60 * 10
      );

    signedUrlResults?.forEach((result, index) => {
      if (result.signedUrl) {
        signedUrls.set(docsToSign[index].document_type, result.signedUrl);
      }
    });
  }

  function statusLabel(status: string) {
    return d.statusLabels[status as keyof typeof d.statusLabels] ?? status;
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/admin/garages`}
              className="text-sm font-medium underline"
            >
              &larr; {d.backToAllGarages}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {garage.city ?? d.noCitySet} &middot; {garage.email ?? d.noEmail}
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASSNAME[garage.status] ?? ""}`}
            >
              {statusLabel(garage.status)}
            </span>

            <form action={setGarageStatus} className="flex gap-2">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="garageId" value={garage.id} />
              <input type="hidden" name="status" value="approved" />
              <button
                type="submit"
                className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                {d.approveGarage}
              </button>
            </form>
            <form action={setGarageStatus} className="flex gap-2">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="garageId" value={garage.id} />
              <input type="hidden" name="status" value="rejected" />
              <button
                type="submit"
                className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                {d.rejectGarage}
              </button>
            </form>
          </div>

          <form action={setVerificationLevel} className="flex items-center gap-2">
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="garageId" value={garage.id} />
            <label htmlFor="verificationLevel" className="text-sm font-medium">
              {d.verificationLevel}
            </label>
            <select
              id="verificationLevel"
              name="verificationLevel"
              defaultValue={garage.verification_level}
              className="rounded-md border border-black/[.08] px-3 py-1.5 text-sm dark:border-white/[.145] dark:bg-black"
            >
              {VERIFICATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.save}
            </button>
          </form>
        </div>

        {DOCUMENT_CATEGORIES.map((category) => (
          <div key={category.key} className="flex flex-col gap-3">
            <h2 className="font-semibold text-black dark:text-zinc-50">
              {category.label}
            </h2>

            <div className="flex flex-col gap-2">
              {category.documentTypes.map((type) => {
                const doc = byType.get(type.key);

                return (
                  <div
                    key={type.key}
                    className="flex flex-col gap-2 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black dark:text-zinc-50">
                        {type.label}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {doc ? (
                          <>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSNAME[doc.status] ?? ""}`}
                            >
                              {statusLabel(doc.status)}
                            </span>
                            {signedUrls.has(type.key) && (
                              <a
                                href={signedUrls.get(type.key)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium underline text-zinc-600 dark:text-zinc-400"
                              >
                                {doc.file_name}
                              </a>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-zinc-400 dark:text-zinc-600">
                            {d.notUploaded}
                          </span>
                        )}
                      </div>
                    </div>

                    {doc && doc.status === "pending" && (
                      <div className="flex shrink-0 gap-2">
                        <form action={reviewDocument}>
                          <input type="hidden" name="lang" value={lang} />
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="garageId" value={garage.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button
                            type="submit"
                            className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                          >
                            {d.approve}
                          </button>
                        </form>
                        <form action={reviewDocument} className="flex gap-1">
                          <input type="hidden" name="lang" value={lang} />
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="garageId" value={garage.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <input
                            type="text"
                            name="notes"
                            placeholder={d.reasonPlaceholder}
                            className="w-32 rounded-md border border-black/[.08] px-2 py-1 text-xs dark:border-white/[.145] dark:bg-black"
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                          >
                            {d.reject}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
