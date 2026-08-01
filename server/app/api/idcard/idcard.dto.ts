export type CardTemplate = "template_a" | "template_b";
export type CardApprovalStatus = "draft" | "pending_approval" | "approved" | "rejected";
export type CardExpirySource = "medical" | "police_verification";

export interface IIdCardRequest {
  template: CardTemplate;
  expiry_source: CardExpirySource;
}

// The full set of fields the QR payload must carry, per UAT — a scanner (or the
// public verification page) can render the whole card without a network round
// trip, in addition to the verification_url for online lookup.
export interface IQrPayload {
  vendor_name: string;
  address: string | null;
  aadhaar: string | null;
  pvr_validity: string | null;
  medical_validity: string | null;
  vendor_type: string;
  contractor: string | null;
  unit: string | null;
  id_card_validity: string | null;
  issuing_authority_name: string | null;
  issuing_authority_designation: string | null;
  card_number: string;
  card_status: string;
  verification_url: string;
  blood_group: string | null;
  department: string | null;
  contractor_mobile: string | null;
  contract_valid_from: string | null;
  contract_valid_to: string | null;
  date_of_issue: string | null;
}
