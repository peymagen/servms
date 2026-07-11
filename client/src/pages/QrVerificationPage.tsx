import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import styles from "./QrVerificationPage.module.css";

interface VerifyResult {
  vendor_code: string;
  full_name: string;
  vendor_type: string;
  validity_start: string | null;
  validity_end: string | null;
  police_verification_status: string;
  medical_fitness_status: string;
  aadhar_linked: number | boolean;
  contractor_name: string | null;
  unit_name: string | null;
  station_name: string | null;
  id_number: string;
  cards_status: "active" | "pending" | "expired";
  last_checked_at: string | null;
}

export default function QrVerificationPage() {
  const { code } = useParams<{ code: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    api
      .get<VerifyResult>(`/idcards/verify/${encodeURIComponent(code)}`)
      .then(setResult)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Verification failed"))
      .finally(() => setIsLoading(false));
  }, [code]);

  const daysRemaining = result?.validity_end
    ? Math.ceil((new Date(result.validity_end).getTime() - Date.now()) / (1000 * 3600 * 24))
    : null;

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
              <div className={styles.idLabel}>EMPLOYEE ID</div>
              <div className={styles.idValue}>{result.vendor_code}</div>
            </div>

            <div className={styles.detailCol}>
              <div
                className={
                  result.cards_status === "active" ? styles.statusValid : styles.statusInvalid
                }
              >
                <div className={styles.statusLabel}>STATUS</div>
                <div className={styles.statusValue}>
                  {result.cards_status === "active" ? "VALID" : result.cards_status.toUpperCase()}
                </div>
                <div className={styles.lastChecked}>
                  Last Checked{" "}
                  {result.last_checked_at ? new Date(result.last_checked_at).toLocaleString() : "—"}
                </div>
              </div>

              <div className={styles.infoCard}>
                <h2 className={styles.infoTitle}>Vendor Information</h2>
                <div className={styles.infoGrid}>
                  <InfoField label="Full Name" value={result.full_name} />
                  <InfoField label="Vendor Type" value={result.vendor_type} />
                  <InfoField label="Contractor / Agency" value={result.contractor_name ?? "—"} />
                  <InfoField label="Assigned Unit" value={result.unit_name ?? result.station_name ?? "—"} />
                </div>
                <div className={styles.validityRow}>
                  <div>
                    <div className={styles.fieldLabel}>Validity Period</div>
                    <div>
                      {result.validity_start ? new Date(result.validity_start).toLocaleDateString() : "—"} —{" "}
                      {result.validity_end ? new Date(result.validity_end).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Days Remaining</div>
                    <div className={styles.daysRemaining}>{daysRemaining ?? "—"} Days</div>
                  </div>
                </div>
              </div>

              <div className={styles.stepsCard}>
                <h2 className={styles.infoTitle}>Verification Step</h2>
                <StepRow
                  label="Police Verification (PVR)"
                  completed={result.police_verification_status === "completed"}
                />
                <StepRow
                  label="Medical Fitness Certificate"
                  completed={result.medical_fitness_status === "completed"}
                />
                <StepRow label="Aadhar Linking" completed={Boolean(result.aadhar_linked)} />
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
