import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "garage-documents";

export async function purgeGarageDocuments(garageId: string) {
  const admin = createAdminClient();

  const { data: documents } = await admin
    .from("garage_documents")
    .select("id, file_path")
    .eq("garage_id", garageId);

  if (!documents || documents.length === 0) return 0;

  await admin.storage.from(BUCKET).remove(documents.map((doc) => doc.file_path));
  await admin.from("garage_documents").delete().eq("garage_id", garageId);

  return documents.length;
}
