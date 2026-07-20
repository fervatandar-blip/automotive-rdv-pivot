import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
  processAccountDeletion,
} from "@/lib/account-deletion";
import { purgeGarageDocuments } from "@/lib/document-retention";

const REJECTED_GARAGE_DOCUMENT_RETENTION_DAYS = 90;

export async function runRetentionSweep() {
  const admin = createAdminClient();

  // 1. Account-deletion requests past their grace period -- the automatic
  // half of the self-service flow built last pass (which shipped a manual
  // admin trigger and deferred automatic processing to this sweep).
  const graceCutoff = new Date(
    Date.now() - ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: dueDeletions } = await admin
    .from("profiles")
    .select("id")
    .not("deletion_requested_at", "is", null)
    .lte("deletion_requested_at", graceCutoff)
    .is("deleted_at", null);

  for (const profile of dueDeletions ?? []) {
    await processAccountDeletion(profile.id);
  }

  // 2. Rejected garages whose uploaded documents have sat untouched past
  // the retention window -- no ongoing purpose once an application is
  // permanently declined and the applicant hasn't come back.
  const documentCutoff = new Date(
    Date.now() -
      REJECTED_GARAGE_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: rejectedGarages } = await admin
    .from("garages")
    .select("id")
    .eq("status", "rejected");

  let staleDocumentGarages = 0;
  for (const garage of rejectedGarages ?? []) {
    const { data: documents } = await admin
      .from("garage_documents")
      .select("reviewed_at, uploaded_at")
      .eq("garage_id", garage.id);

    if (!documents || documents.length === 0) continue;

    const mostRecent = documents.reduce((latest, doc) => {
      const timestamp = doc.reviewed_at ?? doc.uploaded_at;
      return timestamp > latest ? timestamp : latest;
    }, documents[0].reviewed_at ?? documents[0].uploaded_at);

    if (mostRecent < documentCutoff) {
      await purgeGarageDocuments(garage.id);
      staleDocumentGarages += 1;
    }
  }

  // 3. Waitlist entries for dates that have already passed -- no
  // notification or booking purpose survives the date itself.
  const today = new Date().toISOString().slice(0, 10);
  const { data: expiredWaitlist } = await admin
    .from("waitlist")
    .delete()
    .lt("date", today)
    .select("id");

  return {
    accountDeletionsProcessed: dueDeletions?.length ?? 0,
    staleDocumentGarages,
    expiredWaitlistEntries: expiredWaitlist?.length ?? 0,
  };
}
