import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { getContractorsLite, getDivisions, getStations } from "../api/masters";
import type { Contractor, Division, Station, Unit, Vendor } from "../types";
import styles from "./VendorRegistrationPage.module.css";

const STEPS = ["Personal Details", "Deployment", "Verification", "Documents", "Submit"];

export default function VendorRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — Personal Details
  const [fullName, setFullName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 2 — Deployment
  const [vendorType, setVendorType] = useState<Vendor["vendor_type"]>("stationary");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [validityStart, setValidityStart] = useState("");
  const [validityEnd, setValidityEnd] = useState("");

  // Step 3 — Verification
  const [pvrNumber, setPvrNumber] = useState("");
  const [pvrDate, setPvrDate] = useState("");
  const [aadharLinked, setAadharLinked] = useState(false);

  // Step 4 — Documents
  const [medicalDoc, setMedicalDoc] = useState<File | null>(null);

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getDivisions().then(setDivisions).catch(() => {});
    getContractorsLite().then(setContractors).catch(() => {});
    api
      .get<{ total: number; rows: Unit[] }>("/units?limit=200")
      .then((res) => setUnits(res.rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    getStations(divisionId || undefined).then(setStations).catch(() => {});
  }, [divisionId]);

  const filteredUnits = useMemo(
    () => (stationId ? units.filter((u) => u.station_id === stationId) : units),
    [units, stationId]
  );

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function goNext() {
    setError(null);
    if (step === 1 && (!fullName || !mobile)) {
      setError("Full name and mobile number are required.");
      return;
    }
    if (step === 2 && (!divisionId || !stationId || !contractorId || !unitId)) {
      setError("Division, station, contractor, and unit are all required.");
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      if (fatherName) formData.append("father_name", fatherName);
      if (dob) formData.append("date_of_birth", dob);
      if (aadhaar) formData.append("aadhaar_number", aadhaar);
      formData.append("mobile_number", mobile);
      if (email) formData.append("email", email);
      formData.append("vendor_type", vendorType);
      formData.append("division_id", String(divisionId));
      formData.append("station_id", String(stationId));
      formData.append("contractor_id", String(contractorId));
      formData.append("unit_id", String(unitId));
      if (validityStart) formData.append("validity_start", validityStart);
      if (validityEnd) formData.append("validity_end", validityEnd);
      if (pvrNumber) formData.append("police_verification_number", pvrNumber);
      if (pvrDate) formData.append("police_verification_date", pvrDate);
      if (pvrNumber) formData.append("police_verification_status", "completed");
      formData.append("aadhar_linked", aadharLinked ? "1" : "0");
      if (photoFile) formData.append("profile_image", photoFile);
      if (medicalDoc) {
        formData.append("medical_doc", medicalDoc);
        formData.append("medical_fitness_status", "completed");
      }

      await api.post("/vendors", formData, true);
      navigate("/vendors");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to onboard vendor");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className={styles.breadcrumb}>
        Vendor Management <span>&gt;</span> <strong>Registration</strong>
      </div>

      <div className={styles.stepper}>
        {STEPS.map((label, i) => {
          const num = i + 1;
          const state = num === step ? "active" : num < step ? "done" : "pending";
          return (
            <div key={label} className={styles.stepItem}>
              <div className={`${styles.stepCircle} ${styles[state]}`}>
                {state === "done" ? "✓" : num}
              </div>
              <span className={state === "active" ? styles.stepLabelActive : styles.stepLabel}>
                {label}
              </span>
              {num < STEPS.length && <div className={styles.stepLine} />}
            </div>
          );
        })}
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {step === 1 && (
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <PersonIcon /> Personal Information
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Full Name (As per Aadhaar)">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter vendor's full name"
                  required
                />
              </Field>
              <Field label="Father's Name">
                <input
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Enter father's name"
                />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Date of Birth">
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </Field>
              <Field label="Aadhaar Number">
                <input
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))}
                  placeholder="0000 0000 0000"
                  maxLength={12}
                />
              </Field>
            </div>
          </section>

          <section className={styles.photoCard}>
            <div className={styles.photoCardTitle}>Profile Image</div>
            <label className={styles.photoUpload}>
              <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
              {photoPreview ? (
                <img src={photoPreview} alt="Vendor preview" className={styles.photoPreview} />
              ) : (
                <CameraIcon />
              )}
            </label>
            <div className={styles.photoLabel}>Upload Photo</div>
            <div className={styles.photoHint}>
              Use a clear, front-facing portrait with a neutral background. Max size 2MB
              (JPG/PNG).
            </div>
          </section>

          <section className={`${styles.card} ${styles.spanAll}`}>
            <h2 className={styles.cardTitle}>
              <PhoneIcon /> Contact Details
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Mobile Number">
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 00000 00000"
                  required
                />
              </Field>
              <Field label="Email Address (Optional)">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
            </div>
          </section>
        </div>
      )}

      {step === 2 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <BriefcaseIcon /> Deployment
          </h2>
          <div className={styles.fieldRow}>
            <Field label="Vendor Type">
              <select value={vendorType} onChange={(e) => setVendorType(e.target.value as Vendor["vendor_type"])}>
                <option value="stationary">Stationary Vendor</option>
                <option value="statutory">Statutory Vendor</option>
              </select>
            </Field>
            <Field label="Division">
              <select
                value={divisionId}
                onChange={(e) => {
                  setDivisionId(e.target.value ? Number(e.target.value) : "");
                  setStationId("");
                }}
                required
              >
                <option value="">Select division</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.division_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className={styles.fieldRow}>
            <Field label="Station">
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Select station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.station_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contractor / Agency">
              <select
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Select contractor</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className={styles.fieldRow}>
            <Field label="Platform Unit / Stall">
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Select unit</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Validity Start">
              <input type="date" value={validityStart} onChange={(e) => setValidityStart(e.target.value)} />
            </Field>
          </div>
          <div className={styles.fieldRow}>
            <Field label="Validity End">
              <input type="date" value={validityEnd} onChange={(e) => setValidityEnd(e.target.value)} />
            </Field>
            <div />
          </div>
        </section>
      )}

      {step === 3 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <ShieldIcon /> Police Verification
          </h2>
          <div className={styles.fieldRow}>
            <Field label="PVR Number">
              <input
                value={pvrNumber}
                onChange={(e) => setPvrNumber(e.target.value)}
                placeholder="e.g. PVR/KGP/2026/1029"
              />
            </Field>
            <Field label="Date of Issue">
              <input type="date" value={pvrDate} onChange={(e) => setPvrDate(e.target.value)} />
            </Field>
          </div>
          <label className={styles.toggleRow}>
            <input
              type="checkbox"
              checked={aadharLinked}
              onChange={(e) => setAadharLinked(e.target.checked)}
            />
            Aadhaar is linked and verified
          </label>
        </section>
      )}

      {step === 4 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <DocIcon /> Medical Fitness Certificate
          </h2>
          <p className={styles.cardSubtitle}>
            Upload a signed medical fitness certificate from a registered railway medical
            officer or authorized practitioner.
          </p>
          <label className={styles.dropzone}>
            <input
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => setMedicalDoc(e.target.files?.[0] ?? null)}
            />
            <UploadIcon />
            <div className={styles.dropzoneTitle}>
              {medicalDoc ? medicalDoc.name : "Click to upload or drag and drop"}
            </div>
            <div className={styles.dropzoneHint}>PDF, JPG up to 5MB</div>
          </label>
        </section>
      )}

      {step === 5 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Review &amp; Submit</h2>
          <div className={styles.reviewGrid}>
            <ReviewItem label="Full Name" value={fullName || "—"} />
            <ReviewItem label="Mobile Number" value={mobile || "—"} />
            <ReviewItem label="Aadhaar Number" value={aadhaar || "—"} />
            <ReviewItem
              label="Division"
              value={divisions.find((d) => d.id === divisionId)?.division_name ?? "—"}
            />
            <ReviewItem
              label="Station"
              value={stations.find((s) => s.id === stationId)?.station_name ?? "—"}
            />
            <ReviewItem
              label="Contractor"
              value={contractors.find((c) => c.id === contractorId)?.company_name ?? "—"}
            />
            <ReviewItem label="PVR Number" value={pvrNumber || "—"} />
            <ReviewItem label="Medical Document" value={medicalDoc?.name ?? "Not uploaded"} />
          </div>
        </section>
      )}

      <div className={styles.actions}>
        {step > 1 && (
          <button type="button" className={styles.backBtn} onClick={goBack}>
            ← Back
          </button>
        )}
        <button type="button" className={styles.draftBtn} onClick={() => navigate("/vendors")}>
          Save Draft
        </button>
        {step < 5 ? (
          <button type="button" className={styles.nextBtn} onClick={goNext}>
            Next Step →
          </button>
        ) : (
          <button type="button" className={styles.nextBtn} onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit Registration"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={styles.reviewLabel}>{label}</div>
      <div className={styles.reviewValue}>{value}</div>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2C10.5 19 5 13.5 4 5.5a2 2 0 0 1 2-2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="7" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M7 18a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 8.5a4 4 0 0 1 .8 7.9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 21v-8M9 15l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
