// Document vocabulary from docs/ONBOARDING RDV.pdf's garage verification
// checklist (sections 1-5, 7). Keys here must match the `document_type`
// check constraint in supabase/migrations/0005_garage_documents.sql.

export type DocumentCategory =
  | "business_legal"
  | "operational"
  | "insurance"
  | "technical"
  | "banking"
  | "premium";

export const DOCUMENT_CATEGORIES: {
  key: DocumentCategory;
  label: string;
  description: string;
  documentTypes: { key: string; label: string }[];
}[] = [
  {
    key: "business_legal",
    label: "1. Business & Legal Identification",
    description: "These confirm the garage legally exists.",
    documentTypes: [
      { key: "company_registration", label: "Company registration certificate (LBR - Extrait RCS)" },
      { key: "business_authorization", label: "Business authorization (Autorisation d'établissement)" },
      { key: "vat_certificate", label: "VAT number / TVA certificate" },
      { key: "articles_of_incorporation", label: "Articles of incorporation (Extrait RBE)" },
      { key: "proof_of_address", label: "Proof of business address (Contrat de bail)" },
      { key: "owner_id_document", label: "Identity document of owner or legal representative" },
    ],
  },
  {
    key: "operational",
    label: "2. Operational Verification",
    description: "These confirm the garage is operational and legitimate.",
    documentTypes: [
      { key: "exterior_photos", label: "Garage exterior photos" },
      { key: "interior_photos", label: "Workshop interior photos" },
      { key: "reception_photos", label: "Reception/customer area photos" },
      { key: "logo_branding", label: "Company logo and branding assets" },
    ],
  },
  {
    key: "insurance",
    label: "3. Insurance & Compliance",
    description: "Important for trust and liability management.",
    documentTypes: [
      { key: "liability_insurance", label: "Professional liability insurance" },
      { key: "workshop_insurance", label: "Garage/workshop insurance certificate" },
      { key: "employee_liability_coverage", label: "Employee liability coverage (if applicable)" },
      { key: "environmental_compliance", label: "Environmental compliance certificates (optional)" },
      { key: "health_safety_compliance", label: "Health & safety compliance documentation (optional)" },
    ],
  },
  {
    key: "technical",
    label: "4. Technical Capability Verification",
    description: "",
    documentTypes: [
      { key: "technician_certifications", label: "Technician certifications" },
      { key: "ev_certifications", label: "EV/high-voltage certifications" },
      { key: "manufacturer_accreditations", label: "Manufacturer accreditations" },
      { key: "diagnostic_equipment_proof", label: "Diagnostic equipment proof" },
      { key: "obd_compatibility_proof", label: "OBD/diagnostic system compatibility" },
      { key: "battery_servicing_proof", label: "Battery servicing capability proof" },
      { key: "paint_booth_insurance", label: "Painting booth pictures and proof of insurance" },
    ],
  },
  {
    key: "banking",
    label: "5. Banking & Payment Information",
    description: "Needed for payouts and subscriptions.",
    documentTypes: [{ key: "iban_certificate", label: "IBAN / bank account certificate" }],
  },
  {
    key: "premium",
    label: '7. Optional "Trusted Garage" / Premium Verification',
    description: "For higher visibility and trust ranking.",
    documentTypes: [
      { key: "years_in_operation_proof", label: "Years in operation proof" },
      { key: "customer_references", label: "Customer references/testimonials" },
      { key: "manufacturer_partnerships", label: "Manufacturer partnerships" },
      { key: "fleet_servicing_references", label: "Fleet servicing references" },
      { key: "iso_certifications", label: "ISO certifications" },
      { key: "ev_specialization_proof", label: "EV specialization proof" },
      { key: "warranty_provider_partnerships", label: "Warranty provider partnerships" },
    ],
  },
];

export const ALL_DOCUMENT_TYPES = new Set(
  DOCUMENT_CATEGORIES.flatMap((category) =>
    category.documentTypes.map((type) => type.key)
  )
);

export function categoryForDocumentType(documentType: string): DocumentCategory | null {
  for (const category of DOCUMENT_CATEGORIES) {
    if (category.documentTypes.some((type) => type.key === documentType)) {
      return category.key;
    }
  }
  return null;
}
