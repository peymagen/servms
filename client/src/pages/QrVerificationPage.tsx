import { useParams } from "react-router-dom";
import { useVerifyIdCardQuery } from "../api/idcardApi";
import { VENDOR_TYPE_LABELS } from "../types";
import styles from "./QrVerificationPage.module.css";

export default function QrVerificationPage() {
  const { code } = useParams<{ code: string }>();
  const { data: result, error: queryError, isFetching: isLoading } = useVerifyIdCardQuery(code ?? "", { skip: !code });
  const error = queryError ? "Verification failed" : null;

  const daysRemaining = result?.expiry_date
    ? Math.ceil((new Date(result.expiry_date).getTime() - Date.now()) / (1000 * 3600 * 24))
    : null;

  const isValid = result?.cards_status === "active" && result?.approval_status === "approved";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandName}>SERVMS</span>
          <span className={styles.brandSub}>South Eastern Railway</span>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.iconCircle}>
          <ShieldIcon />
        </div>
        <h1 className={styles.title}>Identity Verification Result</h1>
        <p className={styles.subtitle}>Authenticated through SERVMS Centralized Portal</p>

        {isLoading && <p className={styles.loading}>Verifying…</p>}
        {error && <div className={styles.errorCard}>{error}</div>}

        {result && (
          <div className={styles.resultGrid}>
            <div className={styles.photoCol}>
              <div className={styles.photo}>{result.full_name.charAt(0)}</div>
              <div className={styles.idLabel}>ID NUMBER</div>
              <div className={styles.idValue}>{result.id_number}</div>
            </div>

            <div className={styles.detailCol}>
              <div className={isValid ? styles.statusValid : styles.statusInvalid}>
                <div className={styles.statusLabel}>STATUS</div>
                <div className={styles.statusValue}>
                  {isValid ? "VALID" : result.approval_status !== "approved" ? "NOT ISSUED" : result.cards_status.toUpperCase()}
                </div>
                <div className={styles.lastChecked}>
                  Last Checked {result.last_checked_at ? new Date(result.last_checked_at).toLocaleString() : "—"}
                </div>
              </div>

              <div className={styles.infoCard}>
                <h2 className={styles.infoTitle}>Vendor Information</h2>
                <div className={styles.infoGrid}>
                  <InfoField label="Full Name" value={result.full_name} />
                  <InfoField label="Vendor Type" value={VENDOR_TYPE_LABELS[result.vendor_type]} />
                  <InfoField label="Contractor / Agency" value={result.contractor_name ?? "—"} />
                  <InfoField label="Assigned Unit" value={result.unit_name ?? result.station_name ?? "—"} />
                  <InfoField label="Aadhaar Number" value={result.aadhaar_number ?? "—"} />
                  <InfoField label="Address" value={result.address ?? "—"} />
                </div>
                <div className={styles.validityRow}>
                  <div>
                    <div className={styles.fieldLabel}>ID Card Validity</div>
                    <div>{result.expiry_date ? new Date(result.expiry_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Days Remaining</div>
                    <div className={styles.daysRemaining}>{daysRemaining ?? "—"} Days</div>
                  </div>
                </div>
              </div>

              <div className={styles.stepsCard}>
                <h2 className={styles.infoTitle}>Verification Step</h2>
                <StepRow label="Police Verification" completed={result.police_verification_status === "verified"} />
                <StepRow label="Medical Verification" completed={result.medical_verification_status === "verified"} />
              </div>

              <div className={styles.infoCard}>
                <h2 className={styles.infoTitle}>Issuing Authority</h2>
                <div className={styles.infoGrid}>
                  <InfoField label="Authority Name" value={result.issuing_authority_name ?? "—"} />
                  <InfoField label="Designation" value={result.issuing_authority_designation ?? "—"} />
                  <InfoField label="Digital Signature" value={result.signature_applied ? "Applied ✓" : "Not applied"} />
                  <InfoField label="Issue Date" value={result.issued_date ? new Date(result.issued_date).toLocaleDateString() : "—"} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <p>Government of India — Ministry of Railways</p>
        <p className={styles.footerFine}>
          This verification result is generated in real time. Unauthorized use of this ID or system
          is a punishable offense under the Indian Railways Act.
        </p>
      </footer>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValue}>{value}</div>
    </div>
  );
}

function StepRow({ label, completed }: { label: string; completed: boolean }) {
  return (
    <div className={styles.stepRow}>
      <span>{label}</span>
      <span className={completed ? styles.stepDone : styles.stepPending}>
        {completed ? "✓ Completed" : "Pending"}
      </span>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z"
        stroke="white"
        strokeWidth="1.8"
      />
      <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}
