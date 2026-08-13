import type { ReactNode } from "react";
import { ASSET_BASE } from "../../store/apiSlice";
import type { CardTemplate, IdCard } from "../../types";
import { ID_CARD_TEMPLATES } from "../../config/idCardTemplates";
import styles from "./VendorIdCardPreview.module.css";

interface VendorIdCardPreviewProps {
  template: CardTemplate;
  card: IdCard;
  qrDataUrl: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return "XXXX-XXXX-XXXX";
  const digits = aadhaar.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "X");
  return `XXXX-XXXX-${last4}`;
}

const STRIP_LETTERS = "ON CONTRACT".replace(/\s/g, "").split("");

// Mirrors the server's renderIdCardPdf layout (server/app/api/idcard/idcard.pdf.ts) so
// what the user sees here matches the PDF they download — driven by the same template
// registry, so a new format only needs a new config entry to render correctly.
export default function VendorIdCardPreview({ template, card, qrDataUrl }: VendorIdCardPreviewProps) {
  const tpl = ID_CARD_TEMPLATES.find((t) => t.id === template) ?? ID_CARD_TEMPLATES[0];
  const headerSubtitle =
    tpl.headerSubtitleKind === "idNumber" ? `ID Card No. ${card.id_number ?? "—"}` : "Commercial Department";

  return (
    <div className={styles.wrap}>
      <Face strip={tpl.hasSideStrip}>
        <div className={styles.headerTitle}>{tpl.headerTitle}</div>
        <div className={styles.headerSubtitle}>{headerSubtitle}</div>

        {card.profile_image ? (
          <img className={styles.photo} src={`${ASSET_BASE}${card.profile_image}`} alt={card.full_name} />
        ) : (
          <div className={styles.photo} />
        )}

        <div className={styles.sigLine} />
        <div className={styles.caption}>Signature of card holder</div>

        <div className={styles.name}>Name: {card.full_name}</div>

        {tpl.frontSignatureKind === "dual" ? (
          <>
            <div className={styles.sigLine} style={{ marginTop: 18 }} />
            <div className={styles.caption}>(Signature)</div>
            <div className={styles.caption}>{card.approved_by_designation ?? "Designation of Issuing Authority"}</div>
          </>
        ) : (
          <div className={styles.issuingAuthority}>
            <div className={styles.caption}>Issuing Authority</div>
            {card.approved_by_name && <div className={styles.captionStrong}>{card.approved_by_name}</div>}
          </div>
        )}
      </Face>

      <Face strip={tpl.hasSideStrip}>
        <div className={styles.backTop}>
          {qrDataUrl && <img className={styles.qr} src={qrDataUrl} alt="Vendor QR code" />}
          <div className={styles.bloodBox}>
            <span className={styles.bloodValue}>{card.blood_group ?? "—"}</span>
            <span className={styles.bloodLabel}>Blood Group</span>
          </div>
        </div>

        <div className={styles.department}>Commercial Department</div>
        <div className={styles.mobile}>{card.contractor_mobile ?? "—"}</div>

        {tpl.backInfoKind === "contractor" ? (
          <div className={styles.backLines}>
            <div>Name of Contractor: {card.contractor_name ?? "—"}</div>
            <div>
              Validity of Contract: {formatDate(card.validity_start)} To {formatDate(card.validity_end)}
            </div>
            <div>Date of Issue: {formatDate(card.issued_date)}</div>
            <div>Validity: 01 year from the date of issue</div>
          </div>
        ) : (
          <>
            <div className={styles.masked}>{maskAadhaar(card.aadhaar_number)}</div>
            <div className={styles.divider} />
            <div className={styles.instructionTitle}>Instruction</div>
          </>
        )}

        <div className={styles.instruction}>
          Please surrender to issuing authority on completion/termination of contractual services.
        </div>

        <div className={styles.cardNo}>Card No: {card.id_number}</div>
      </Face>
    </div>
  );
}

function Face({ strip, children }: { strip: boolean; children: ReactNode }) {
  return (
    <div className={styles.face}>
      {strip && (
        <div className={styles.strip}>
          {STRIP_LETTERS.map((letter, i) => (
            <span key={i}>{letter}</span>
          ))}
        </div>
      )}
      <div className={styles.faceBody}>{children}</div>
    </div>
  );
}
