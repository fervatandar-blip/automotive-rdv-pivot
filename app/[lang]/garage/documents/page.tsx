import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { DOCUMENT_CATEGORIES } from "@/lib/documents";
import { uploadDocument } from "@/app/actions/documents";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending review",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  approved: {
    label: "Approved",
    className:
      "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
  },
};

type DocRow = {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  status: string;
  notes: string | null;
};

export default async function GarageDocumentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const supabase = await createClient();

  const { data: documents } = await supabase
    .from("garage_documents")
    .select("id, document_type, file_name, file_path, status, notes")
    .eq("garage_id", garage.id);

  const byType = new Map<string, DocRow>();
  for (const doc of (documents ?? []) as DocRow[]) {
    byType.set(doc.document_type, doc);
  }

  const signedUrls = new Map<string, string>();
  for (const doc of byType.values()) {
    const { data } = await supabase.storage
      .from("garage-documents")
      .createSignedUrl(doc.file_path, 60 * 10);
    if (data?.signedUrl) signedUrls.set(doc.document_type, data.signedUrl);
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name} &mdash; verification documents
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Verification level:{" "}
              <span className="font-medium">{garage.verification_level}</span>
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {DOCUMENT_CATEGORIES.map((category) => (
          <div key={category.key} className="flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-black dark:text-zinc-50">
                {category.label}
              </h2>
              {category.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {category.description}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {category.documentTypes.map((type) => {
                const doc = byType.get(type.key);
                const badge = doc ? STATUS_BADGE[doc.status] : null;

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
                        {badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        {doc && signedUrls.has(type.key) && (
                          <a
                            href={signedUrls.get(type.key)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium underline text-zinc-600 dark:text-zinc-400"
                          >
                            {doc.file_name}
                          </a>
                        )}
                        {doc?.status === "rejected" && doc.notes && (
                          <span className="text-xs text-red-600">
                            {doc.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <form
                      action={uploadDocument}
                      className="flex shrink-0 items-center gap-2"
                    >
                      <input type="hidden" name="lang" value={lang} />
                      <input
                        type="hidden"
                        name="documentType"
                        value={type.key}
                      />
                      <input
                        type="file"
                        name="file"
                        required
                        className="w-40 text-xs text-zinc-600 file:mr-2 file:rounded-full file:border file:border-black/[.08] file:bg-white file:px-3 file:py-1 file:text-xs file:font-medium dark:text-zinc-400 dark:file:border-white/[.145] dark:file:bg-black"
                      />
                      <button
                        type="submit"
                        className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                      >
                        {doc ? "Replace" : "Upload"}
                      </button>
                    </form>
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
