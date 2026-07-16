"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageOwner, requireSuperAdmin } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { ALL_DOCUMENT_TYPES, categoryForDocumentType } from "@/lib/documents";

const BUCKET = "garage-documents";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function uploadDocument(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  const documentType = formData.get("documentType");
  const file = formData.get("file");

  if (typeof documentType !== "string" || !ALL_DOCUMENT_TYPES.has(documentType)) {
    return;
  }
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const category = categoryForDocumentType(documentType);
  if (!category) return;

  const supabase = await createClient();
  const path = `${garage.id}/${category}/${documentType}`;

  // Clear any prior upload for this slot before writing the new one, so
  // storage and the DB row stay in lockstep and status resets to pending.
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase
    .from("garage_documents")
    .delete()
    .eq("garage_id", garage.id)
    .eq("document_type", documentType);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    return;
  }

  await supabase.from("garage_documents").insert({
    garage_id: garage.id,
    category,
    document_type: documentType,
    file_path: path,
    file_name: file.name,
  });

  revalidateLocalizedPath("/garage/documents");
}

export async function reviewDocument(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const profile = await requireSuperAdmin(lang);

  const documentId = formData.get("documentId");
  const decision = formData.get("decision");
  const notes = formData.get("notes");
  const garageId = formData.get("garageId");

  if (typeof documentId !== "string" || !documentId) return;
  if (decision !== "approved" && decision !== "rejected") return;

  const supabase = await createClient();
  await supabase
    .from("garage_documents")
    .update({
      status: decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    })
    .eq("id", documentId);

  if (typeof garageId === "string" && garageId) {
    revalidateLocalizedPath(`/admin/garages/${garageId}`);
  }
}

export async function setGarageStatus(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);

  const garageId = formData.get("garageId");
  const status = formData.get("status");

  if (typeof garageId !== "string" || !garageId) return;
  if (status !== "approved" && status !== "rejected" && status !== "pending") return;

  const supabase = await createClient();
  await supabase.from("garages").update({ status }).eq("id", garageId);

  revalidateLocalizedPath(`/admin/garages/${garageId}`);
  revalidateLocalizedPath("/admin/garages");
  revalidateLocalizedPath("/garages");
  revalidateLocalizedPath("/dashboard");
}

export async function setVerificationLevel(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);

  const garageId = formData.get("garageId");
  const level = formData.get("verificationLevel");
  const validLevels = ["basic", "verified", "ev_certified", "trusted_partner"];

  if (typeof garageId !== "string" || !garageId) return;
  if (typeof level !== "string" || !validLevels.includes(level)) return;

  const supabase = await createClient();
  await supabase
    .from("garages")
    .update({ verification_level: level })
    .eq("id", garageId);

  revalidateLocalizedPath(`/admin/garages/${garageId}`);
}
