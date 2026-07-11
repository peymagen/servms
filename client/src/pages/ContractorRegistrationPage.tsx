import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { getDivisions } from "../api/masters";
import { useAuth } from "../context/AuthContext";
import type { Division } from "../types";
import styles from "./ContractorRegistrationPage.module.css";

export default function ContractorRegistrationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [primaryContactName, setPrimaryContactName] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [licenseValidityDate, setLicenseValidityDate] = useState("");
  const [annualFee, setAnnualFee] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDivisions().then(setDivisions).catch(() => {});
  }, []);

  const divisionId = useMemo(() => {
    if (user?.role_name === "admin" && user.division_id) return user.division_id;
    return divisions[0]?.id;
  }, [user, divisions]);

  const applicationScore = useMemo(() => {
    const fields = [
      companyName,
      primaryContactName,
      registeredAddress,
      panNumber,
      gstin,
      licenseValidityDate,
      annualFee,
      officialEmail,
      mobileNumber,
    ];
    const filled = fields.filter((f) => f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [
    companyName,
    primaryContactName,
    registeredAddress,
    panNumber,
    gstin,
    licenseValidityDate,
    annualFee,
    officialEmail,
    mobileNumber,
  ]);

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!divisionId) {
      setError("No division available to assign this contractor to.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("company_name", companyName);
      if (primaryContactName) formData.append("primary_contact_name", primaryContactName);
      if (mobileNumber) formData.append("primary_contact_mobile", mobileNumber);
      if (officialEmail) formData.append("official_email", officialEmail);
      if (registeredAddress) formData.append("registered_address", registeredAddress);
      if (panNumber) formData.append("pan_number", panNumber);
      if (gstin) formData.append("gstin", gstin);
      if (licenseValidityDate) formData.append("license_validity_date", licenseValidityDate);
      if (annualFee) formData.append("annual_registration_fee", annualFee);
      formData.append("division_id", String(divisionId));
      if (logoFile) formData.append("logo_image", logoFile);

      await api.post("/contractors", formData, true);
      navigate("/contractors");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to submit registration");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className={styles.breadcrumb}>
        Contractor Management <span>&gt;</span> <strong>Registration Form</strong>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.accentBar} /> Enterprise Identity
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Contractor/Company Name">
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex Logistics Solutions"
                  required
                />
              </Field>
              <Field label="Primary Contact Person">
                <input
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  placeholder="Name of Authorized Signatory"
                />
              </Field>
            </div>
            <Field label="Registered Office Address">
              <textarea
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                placeholder="Complete building, street, city, and state details…"
              />
            </Field>
          </section>

          <section className={styles.logoCard}>
            <label className={styles.logoUpload}>
              <input type="file" accept="image/*" onChange={handleLogoChange} hidden />
              {logoPreview ? (
                <img src={logoPreview} alt="Company logo preview" className={styles.logoPreview} />
              ) : (
                <CameraIcon />
              )}
            </label>
            <div className={styles.logoTitle}>Upload Company Logo</div>
            <div className={styles.logoHint}>PNG, JPG up to 5MB. 400×400px recommended.</div>
          </section>

          <section className={`${styles.card} ${styles.spanAll}`}>
            <h2 className={styles.cardTitle}>
              <span className={styles.accentBar} /> Tax &amp; Statutory Compliance
            </h2>
            <div className={styles.fieldRow4}>
              <Field label="PAN Number" hint="Must follow standard PAN format">
                <input
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </Field>
              <Field label="GST Identification (GSTIN)">
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                />
              </Field>
              <Field label="License Validity">
                <input
                  type="date"
                  value={licenseValidityDate}
                  onChange={(e) => setLicenseValidityDate(e.target.value)}
                />
              </Field>
              <Field label="Annual Registration Fee (₹)">
                <input
                  type="number"
                  min="0"
                  value={annualFee}
                  onChange={(e) => setAnnualFee(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <span className={styles.accentBar} /> Communication Channels
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Official Email Address">
                <div className={styles.inputWithIcon}>
                  <MailIcon />
                  <input
                    type="email"
                    value={officialEmail}
                    onChange={(e) => setOfficialEmail(e.target.value)}
                    placeholder="admin@apexlogistics.com"
                  />
                </div>
              </Field>
              <Field label="Mobile Number">
                <input
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91 9876543210"
                />
              </Field>
            </div>
          </section>

          <aside className={styles.filingCard}>
            <div className={styles.filingTitle}>
              <InfoIcon /> Filing Guidance
            </div>
            <p className={styles.filingBody}>
              Please ensure all documents uploaded are clear and match the PAN/GST database
              records. Inaccurate information may lead to rejection of the registration request
              and penalties under Indian Railways vendor policies.
            </p>
            <ul className={styles.filingList}>
              <li>PAN must be an individual or firm type</li>
              <li>License validity must exceed 6 months</li>
            </ul>
            <div className={styles.scoreRow}>
              <span>Application Score</span>
              <span>{applicationScore}%</span>
            </div>
            <div className={styles.scoreTrack}>
              <div className={styles.scoreFill} style={{ width: `${applicationScore}%` }} />
            </div>
          </aside>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate("/contractors")}
          >
            Cancel &amp; Discard
          </button>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Registration ▷"}
          </button>
        </div>
      </form>

      <p className={styles.footer}>
        © 2026 South Eastern Railway - SERVMS Portal. All Rights Reserved.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 8a2 2 0 0 1 2-2h1.2l.8-1.5A1.5 1.5 0 0 1 9.32 3.7h5.36a1.5 1.5 0 0 1 1.32.8L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}
