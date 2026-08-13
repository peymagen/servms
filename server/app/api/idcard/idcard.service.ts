import { pool } from "../../common/services/sql.service";
import { type RowDataPacket, type ResultSetHeader } from "mysql2";
import fs from "fs";
import path from "path";
import { renderIdCardPdf, buildQrText } from "./idcard.pdf";
import { type CardExpirySource, type CardTemplate, type IQrPayload } from "./idcard.dto";

const FE_BASE_URL = process.env.FE_BASE_URL ?? "http://localhost:5173";
const PDF_DIR = path.join(process.cwd(), "uploads", "idcards");

const VENDOR_TYPE_LABELS: Record<string, string> = {
  train_tsv: "Train TSV",
  station_pf: "Station PF",
  station_stall: "Station Stall",
  station_others: "Station Others",
};

const ensurePdfDir = () => {
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
};

// ─── GET ALL ID CARDS (WITH VENDOR INFO) ────────────────────────────────────────
export const getIdCards = async (filters: {
  search?: string;
  division_id?: number;
  approval_status?: string;
  limit?: number;
  offset?: number;
}) => {
  const limit = Number.isInteger(filters.limit) ? (filters.limit as number) : 10;
  const offset = Number.isInteger(filters.offset) ? (filters.offset as number) : 0;
  const params: any[] = [];

  const whereClauses = ["v.status = 1"];
  if (filters.search) {
    whereClauses.push("(v.full_name LIKE ? OR v.vendor_code LIKE ? OR ic.id_number LIKE ?)");
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.division_id) {
    whereClauses.push("v.division_id = ?");
    params.push(filters.division_id);
  }
  if (filters.approval_status) {
    whereClauses.push("ic.approval_status = ?");
    params.push(filters.approval_status);
  }
  const whereSql = `WHERE ${whereClauses.join(" AND ")}`;

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM vendors v LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id ${whereSql}`,
    params
  );
  const total = countRows[0]?.total ?? 0;

  const query = `
    SELECT
      v.id as vendor_id, v.vendor_code, v.full_name, v.vendor_type, v.profile_image, v.blood_group,
      v.address, v.aadhaar_number,
      v.validity_start, v.validity_end, v.police_verification_status, v.medical_verification_status,
      v.police_verification_valid_till, v.medical_verification_valid_till,
      c.company_name as contractor_name, c.primary_contact_mobile as contractor_mobile,
      u.unit_name, st.station_name, d.division_name,
      ic.id, ic.template, ic.id_number, ic.issued_date, ic.cards_status,
      ic.approval_status, ic.requested_by, ic.requested_at, ic.approved_by, ic.approved_at,
      ic.expiry_source, ic.expiry_date, ic.signature_applied, ic.pdf_path, ic.last_checked_at,
      reqUser.full_name as requested_by_name, appUser.full_name as approved_by_name,
      appUser.designation as approved_by_designation
    FROM vendors v
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations st ON st.id = v.station_id
    LEFT JOIN divisions d ON d.id = v.division_id
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN vendor_id_cards ic ON ic.vendor_id = v.id
    LEFT JOIN users reqUser ON reqUser.id = ic.requested_by
    LEFT JOIN users appUser ON appUser.id = ic.approved_by
    ${whereSql}
    ORDER BY v.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, params);
  return { total, rows };
};

const getCardRow = async (vendorId: string): Promise<RowDataPacket | null> => {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT * FROM vendor_id_cards WHERE vendor_id = ?", [vendorId]);
  return rows[0] ?? null;
};

// ─── ISSUE REQUEST (Vendor → Issue Request step) ────────────────────────────────
export const requestIdCard = async (
  vendorId: string,
  data: { template: CardTemplate; expiry_source: CardExpirySource },
  userId: number
) => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>("SELECT * FROM vendors WHERE id = ? AND status = 1", [
    vendorId,
  ]);
  const vendor = vendorRows[0];
  if (!vendor) throw new Error("Vendor not found");

  const validTill =
    data.expiry_source === "medical" ? vendor.medical_verification_valid_till : vendor.police_verification_valid_till;
  if (!validTill) {
    throw new Error(
      `Cannot use ${data.expiry_source === "medical" ? "medical" : "police verification"} expiry — no valid-till date on file`
    );
  }

  const existing = await getCardRow(vendorId);
  if (existing) {
    await pool.execute(
      `UPDATE vendor_id_cards SET
        template = ?, approval_status = 'pending_approval', requested_by = ?, requested_at = NOW(),
        approved_by = NULL, approved_at = NULL, rejection_reason = NULL,
        expiry_source = ?, expiry_date = ?
       WHERE vendor_id = ?`,
      [data.template, userId, data.expiry_source, validTill, vendorId]
    );
    return { vendor_id: Number(vendorId), id_number: existing.id_number, requested: true };
  }

  const idNumber = `CRIS-ID-${vendor.vendor_code.replace(/\D/g, "")}`;
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO vendor_id_cards
      (vendor_id, template, id_number, cards_status, approval_status, requested_by, requested_at, expiry_source, expiry_date)
     VALUES (?, ?, ?, 'pending', 'pending_approval', ?, NOW(), ?, ?)`,
    [vendorId, data.template, idNumber, userId, data.expiry_source, validTill]
  );

  return { id: result.insertId, vendor_id: Number(vendorId), id_number: idNumber, requested: true };
};

const fetchVendorForCard = async (vendorId: string): Promise<RowDataPacket | null> => {
  const [vendorRows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.*, c.company_name as contractor_name, c.primary_contact_mobile as contractor_mobile,
            u.unit_name, st.station_name, d.division_name
     FROM vendors v
     LEFT JOIN contractors c ON c.id = v.contractor_id
     LEFT JOIN units u ON u.id = v.unit_id
     LEFT JOIN stations st ON st.id = v.station_id
     LEFT JOIN divisions d ON d.id = v.division_id
     WHERE v.id = ?`,
    [vendorId]
  );
  return vendorRows[0] ?? null;
};

interface CardApprover {
  full_name: string;
  designation: string | null;
  card_signing_authority_designation?: string | null;
  signature_path: string | null;
}

// The dedicated signing-authority designation (captured on the user record when
// card_signing_authority is granted) takes precedence over the person's generic
// job `designation` for anything printed/encoded as the card's signing authority —
// falls back to `designation` only for pre-existing rows from before this field existed.
const authorityDesignationOf = (approver: CardApprover | undefined): string | null =>
  approver?.card_signing_authority_designation ?? approver?.designation ?? null;

// Shared by the approval flow and later on-demand re-renders (e.g. downloading the
// other ID card format), so both always encode the same vendor/QR data.
const buildCardPayload = (
  vendor: RowDataPacket,
  card: RowDataPacket,
  approver: CardApprover | undefined,
  issuedDate: string | null
): { data: import("./idcard.pdf").IdCardRenderData; qrPayload: IQrPayload } => {
  const verificationUrl = `${FE_BASE_URL}/verify/${card.id_number}`;
  const qrPayload: IQrPayload = {
    vendor_name: vendor.full_name,
    address: vendor.address,
    aadhaar: vendor.aadhaar_number,
    pvr_validity: vendor.police_verification_valid_till,
    medical_validity: vendor.medical_verification_valid_till,
    vendor_type: VENDOR_TYPE_LABELS[vendor.vendor_type] ?? vendor.vendor_type,
    contractor: vendor.contractor_name,
    unit: vendor.unit_name,
    id_card_validity: card.expiry_date,
    issuing_authority_name: approver?.full_name ?? null,
    issuing_authority_designation: authorityDesignationOf(approver),
    card_number: card.id_number,
    card_status: "active",
    verification_url: verificationUrl,
    blood_group: vendor.blood_group,
    // Printed as the card's department line — fixed to "Commercial Department"
    // rather than the vendor's division name (division still drives everything
    // else division-scoped; this is purely the card's printed department label).
    department: "Commercial Department",
    contractor_mobile: vendor.contractor_mobile,
    contract_valid_from: vendor.validity_start,
    contract_valid_to: vendor.validity_end,
    date_of_issue: issuedDate,
  };

  const data = {
    fullName: vendor.full_name,
    vendorCode: vendor.vendor_code,
    vendorTypeLabel: VENDOR_TYPE_LABELS[vendor.vendor_type] ?? vendor.vendor_type,
    contractorName: vendor.contractor_name,
    contractorMobile: vendor.contractor_mobile,
    unitName: vendor.unit_name,
    stationName: vendor.station_name,
    divisionName: vendor.division_name,
    department: "Commercial Department",
    bloodGroup: vendor.blood_group,
    aadhaarNumber: vendor.aadhaar_number,
    photoPath: vendor.profile_image,
    vendorSignaturePath: vendor.signature_path,
    cardNumber: card.id_number,
    cardStatus: "active",
    contractValidFrom: vendor.validity_start,
    contractValidTo: vendor.validity_end,
    issuedDate,
    expiryDate: card.expiry_date ? new Date(card.expiry_date).toISOString().split("T")[0] : null,
    signingAuthorityName: approver?.full_name ?? null,
    signingAuthorityDesignation: authorityDesignationOf(approver),
    signaturePath: approver?.signature_path ?? null,
  };

  return { data, qrPayload };
};

// ─── SUB ADMIN APPROVAL → AUTO SIGNATURE → QR → PDF ─────────────────────────────
// Super Admin HQ has complete control over every zone/division and can approve
// regardless of holding a personal Card Signing Authority credential — same
// break-glass bypass as the permission matrix (see permission.middleware.ts).
// If they have no signature_path on file, the card simply renders without a
// signature image (embedImage/loadImageBytes already tolerate a null path).
export const approveIdCard = async (
  vendorId: string,
  approverUserId: number,
  actorDivisionId?: number,
  actorRoleName?: string
) => {
  const [approverRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, full_name, designation, card_signing_authority_designation, signature_path, card_signing_authority FROM users WHERE id = ?",
    [approverUserId]
  );
  const approver = approverRows[0];
  const isSuperAdmin = actorRoleName === "super_admin_hq";
  if (!approver || (!approver.card_signing_authority && !isSuperAdmin)) {
    throw new Error("Only a designated Card Signing Authority can approve ID cards");
  }

  const card = await getCardRow(vendorId);
  if (!card) throw new Error("No ID card request found for this vendor");
  if (card.approval_status !== "pending_approval") {
    throw new Error(`Cannot approve a card in "${card.approval_status}" state`);
  }

  const vendor = await fetchVendorForCard(vendorId);
  if (!vendor) throw new Error("Vendor not found");
  // A division-scoped signing authority may only approve cards for vendors in their own division.
  if (actorDivisionId != null && vendor.division_id !== actorDivisionId) {
    throw new Error("You can only approve ID cards for vendors in your own division");
  }

  const issuedDate = new Date().toISOString().split("T")[0];
  const { data, qrPayload } = buildCardPayload(vendor, card, approver as CardApprover, issuedDate);

  const pdfBytes = await renderIdCardPdf(card.template, data, qrPayload);

  ensurePdfDir();
  const pdfFilename = `${card.id_number}.pdf`;
  fs.writeFileSync(path.join(PDF_DIR, pdfFilename), pdfBytes);
  const pdfPath = `/uploads/idcards/${pdfFilename}`;

  await pool.execute(
    `UPDATE vendor_id_cards SET
      approval_status = 'approved', approved_by = ?, approved_at = NOW(),
      cards_status = 'active', signature_applied = 1, qr_code_data = ?, pdf_path = ?,
      issued_date = ?, last_checked_at = NULL
     WHERE vendor_id = ?`,
    [approverUserId, buildQrText(qrPayload), pdfPath, issuedDate, vendorId]
  );

  return { vendor_id: Number(vendorId), id_number: card.id_number, pdf_path: pdfPath };
};

export const rejectIdCard = async (
  vendorId: string,
  approverUserId: number,
  reason: string,
  actorDivisionId?: number
) => {
  const card = await getCardRow(vendorId);
  if (!card) throw new Error("No ID card request found for this vendor");
  if (card.approval_status !== "pending_approval") {
    throw new Error(`Cannot reject a card in "${card.approval_status}" state`);
  }
  if (actorDivisionId != null) {
    const [vendorRows] = await pool.execute<RowDataPacket[]>(
      "SELECT division_id FROM vendors WHERE id = ?",
      [vendorId]
    );
    if (vendorRows[0]?.division_id !== actorDivisionId) {
      throw new Error("You can only reject ID cards for vendors in your own division");
    }
  }
  await pool.execute(
    `UPDATE vendor_id_cards SET approval_status = 'rejected', approved_by = ?, approved_at = NOW(), rejection_reason = ? WHERE vendor_id = ?`,
    [approverUserId, reason, vendorId]
  );
  return { vendor_id: Number(vendorId), id_number: card.id_number };
};

const TEMPLATE_FILE_SUFFIX: Record<CardTemplate, string> = {
  template_a: "format1",
  template_b: "format2",
};

// Always re-renders on the fly rather than serving the file cached at approval time —
// that cache can go stale (e.g. an older QR payload format, or vendor data edited
// since approval), so every download reflects current data. Does not touch approval
// state or the stored file.
export const getIdCardPdf = async (
  vendorId: string,
  requestedTemplate?: CardTemplate
): Promise<{ bytes: Buffer | Uint8Array; filename: string } | null> => {
  const card = await getCardRow(vendorId);
  if (!card || card.approval_status !== "approved") return null;

  const template = requestedTemplate ?? (card.template as CardTemplate);

  const vendor = await fetchVendorForCard(vendorId);
  if (!vendor) return null;

  const [approverRows] = await pool.execute<RowDataPacket[]>(
    "SELECT full_name, designation, card_signing_authority_designation, signature_path FROM users WHERE id = ?",
    [card.approved_by]
  );
  const approver = approverRows[0] as CardApprover | undefined;

  const issuedDate = card.issued_date ? new Date(card.issued_date).toISOString().split("T")[0] : null;
  const { data, qrPayload } = buildCardPayload(vendor, card, approver, issuedDate);
  const bytes = await renderIdCardPdf(template, data, qrPayload);

  return { bytes, filename: `${card.id_number}-${TEMPLATE_FILE_SUFFIX[template]}.pdf` };
};

// ─── PUBLIC QR VERIFICATION (NO AUTH) ───────────────────────────────────────────
export const verifyIdCard = async (idNumberOrCode: string) => {
  const query = `
    SELECT
      v.vendor_code, v.full_name, v.vendor_type, v.address, v.aadhaar_number, v.blood_group,
      v.validity_start, v.validity_end,
      v.police_verification_status, v.police_verification_valid_till,
      v.medical_verification_status, v.medical_verification_valid_till,
      c.company_name as contractor_name,
      u.unit_name, st.station_name, d.division_name,
      ic.id_number, ic.template, ic.cards_status, ic.approval_status, ic.expiry_date,
      ic.signature_applied, ic.issued_date, ic.last_checked_at,
      appUser.full_name as issuing_authority_name,
      COALESCE(appUser.card_signing_authority_designation, appUser.designation) as issuing_authority_designation
    FROM vendor_id_cards ic
    JOIN vendors v ON v.id = ic.vendor_id
    LEFT JOIN contractors c ON c.id = v.contractor_id
    LEFT JOIN units u ON u.id = v.unit_id
    LEFT JOIN stations st ON st.id = v.station_id
    LEFT JOIN divisions d ON d.id = v.division_id
    LEFT JOIN users appUser ON appUser.id = ic.approved_by
    WHERE ic.id_number = ?
  `;
  const [rows] = await pool.execute<RowDataPacket[]>(query, [idNumberOrCode]);
  const card = rows[0];
  if (!card) {
    return null;
  }

  await pool.execute("UPDATE vendor_id_cards SET last_checked_at = NOW() WHERE id_number = ?", [card.id_number]);

  return card;
};
