import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateVendorMutation } from "../api/vendorApi";
import { useGetContractorsLiteQuery, useGetDivisionsQuery, useGetStationsQuery, useGetUnitsLiteQuery } from "../api/mastersApi";
import { BLOOD_GROUPS, VENDOR_TYPE_LABELS, type VendorType, type VerificationStatus } from "../types";
import styles from "./VendorRegistrationPage.module.css";

const STEPS = ["Personal Details", "Deployment", "Verification", "Documents", "Submit"];
const ALLOWED_DOC_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_DOC_SIZE = 5 * 1024 * 1024;

function validateDocFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
    return "Only PDF, JPG, and PNG files are supported.";
  }
  if (file.size > MAX_DOC_SIZE) {
    return "File is too large. Maximum size is 5MB.";
  }
  return null;
}

export default function VendorRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — Personal Details
  const [fullName, setFullName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [dob, setDob] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Step 2 — Deployment
  const [vendorType, setVendorType] = useState<VendorType>("station_others");
  const [divisionId, setDivisionId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");
  const [contractorId, setContractorId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [validityStart, setValidityStart] = useState("");
  const [validityEnd, setValidityEnd] = useState("");

  // Step 3 — Verification
  const [policeStatus, setPoliceStatus] = useState<VerificationStatus>("pending");
  const [policeNumber, setPoliceNumber] = useState("");
  const [policeIssueDate, setPoliceIssueDate] = useState("");
  const [policeValidTill, setPoliceValidTill] = useState("");
  const [policeRemarks, setPoliceRemarks] = useState("");
  const [medicalStatus, setMedicalStatus] = useState<VerificationStatus>("pending");
  const [medicalNumber, setMedicalNumber] = useState("");
  const [medicalIssueDate, setMedicalIssueDate] = useState("");
  const [medicalValidTill, setMedicalValidTill] = useState("");
  const [medicalRemarks, setMedicalRemarks] = useState("");

  // Step 4 — Documents
  const [aadhaarDoc, setAadhaarDoc] = useState<File | null>(null);
  const [medicalDoc, setMedicalDoc] = useState<File | null>(null);
  const [policeDoc, setPoliceDoc] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);

  const { data: divisions = [] } = useGetDivisionsQuery();
  const { data: contractors = [] } = useGetContractorsLiteQuery();
  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: stations = [] } = useGetStationsQuery(divisionId || undefined);
  const [createVendor, { isLoading: isSubmitting }] = useCreateVendorMutation();

  useEffect(() => {
    // Reset immediately so a division with no stations doesn't briefly show the
    // previous division's stations (which would wrongly make Station look required).
    setStationId("");
  }, [divisionId]);

  // Some divisions (e.g. Chakradharpur) have no stations configured at all — Station
  // is only mandatory when the selected division actually has stations to choose from.
  const stationRequired = stations.length > 0;

  const filteredUnits = useMemo(() => {
    if (stationId) return units.filter((u) => u.station_id === stationId);
    if (divisionId) return units.filter((u) => u.division_id === divisionId);
    return units;
  }, [units, stationId, divisionId]);

  // A division with no stations (e.g. Chakradharpur) also has no units, since every
  // unit belongs to a station. Unit is only mandatory when at least one is available.
  const unitRequired = divisionId !== "" ? filteredUnits.length > 0 : true;

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleSignatureChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSignatureFile(file);
    setSignaturePreview(file ? URL.createObjectURL(file) : null);
  }

  function handleDocChange(file: File | null, setter: (f: File | null) => void) {
    if (file) {
      const validationError = validateDocFile(file);
      if (validationError) {
        setError(validationError);
        setter(null);
        return;
      }
    }
    setError(null);
    setter(file);
  }

  function goNext() {
    setError(null);
    if (step === 1 && (!fullName || !mobile || !address)) {
      setError("Full name, mobile number, and address are required.");
      return;
    }
    if (step === 2) {
      const missing = [
        { label: "Division", ok: Boolean(divisionId) },
        { label: "Station", ok: !stationRequired || Boolean(stationId) },
        { label: "Contractor", ok: Boolean(contractorId) },
        { label: "Unit", ok: !unitRequired || Boolean(unitId) },
      ]
        .filter((f) => !f.ok)
        .map((f) => f.label);

      if (missing.length > 0) {
        setError(`${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required.`);
        return;
      }
    }
    if (step === 3) {
      if (!policeNumber.trim() || !medicalNumber.trim()) {
        setError("Police Verification Number and Medical Fitness Certificate Number are required.");
        return;
      }
      if (policeValidTill && policeIssueDate && policeValidTill < policeIssueDate) {
        setError("Police verification valid till date cannot be before the issue date.");
        return;
      }
      if (medicalValidTill && medicalIssueDate && medicalValidTill < medicalIssueDate) {
        setError("Medical verification valid till date cannot be before the issue date.");
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    setError(null);
    try {
      await createVendor({
        full_name: fullName,
        father_name: fatherName || undefined,
        date_of_birth: dob || undefined,
        aadhaar_number: aadhaar || undefined,
        mobile_number: mobile,
        address: address || undefined,
        blood_group: bloodGroup || undefined,
        vendor_type: vendorType,
        division_id: divisionId ? Number(divisionId) : undefined,
        station_id: stationId ? Number(stationId) : undefined,
        contractor_id: contractorId ? Number(contractorId) : undefined,
        unit_id: unitId ? Number(unitId) : undefined,
        validity_start: validityStart || undefined,
        validity_end: validityEnd || undefined,
        police_verification_status: policeStatus,
        police_verification_number: policeNumber,
        police_verification_issue_date: policeIssueDate || undefined,
        police_verification_valid_till: policeValidTill || undefined,
        police_verification_remarks: policeRemarks || undefined,
        medical_verification_status: medicalStatus,
        medical_verification_number: medicalNumber,
        medical_verification_issue_date: medicalIssueDate || undefined,
        medical_verification_valid_till: medicalValidTill || undefined,
        medical_verification_remarks: medicalRemarks || undefined,
        profile_image: photoFile ?? undefined,
        signature: signatureFile ?? undefined,
        aadhaar_document: aadhaarDoc ?? undefined,
        medical_verification_document: medicalDoc ?? undefined,
        police_verification_document: policeDoc ?? undefined,
      }).unwrap();
      navigate("/vendors");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to onboard vendor");
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
            <div className={styles.fieldRow}>
              <Field label="Blood Group">
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </Field>
              <div />
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
            <div className={styles.photoCardTitle} style={{ marginTop: 16 }}>
              Signature
            </div>
            <label className={styles.photoUpload}>
              <input type="file" accept="image/*" onChange={handleSignatureChange} hidden />
              {signaturePreview ? (
                <img src={signaturePreview} alt="Signature preview" className={styles.photoPreview} />
              ) : (
                <DocIcon />
              )}
            </label>
            <div className={styles.photoLabel}>Upload Signature</div>
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
              <Field label="Address">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter current residential address"
                  required
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
              <select value={vendorType} onChange={(e) => setVendorType(e.target.value as VendorType)}>
                {Object.entries(VENDOR_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
            <Field label={stationRequired ? "Station" : "Station (optional)"}>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}
                required={stationRequired}
                disabled={divisionId !== "" && stations.length === 0}
              >
                <option value="">{stationRequired ? "Select station" : "No station required"}</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.station_name}
                  </option>
                ))}
              </select>
              {divisionId !== "" && !stationRequired && (
                <span className={styles.dropzoneHint}>
                  No stations are configured for this division — station selection is not required.
                </span>
              )}
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
            <Field label={unitRequired ? "Platform Unit / Stall" : "Platform Unit / Stall (optional)"}>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")}
                required={unitRequired}
                disabled={divisionId !== "" && filteredUnits.length === 0}
              >
                <option value="">{unitRequired ? "Select unit" : "No unit available for this division"}</option>
                {filteredUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
              {divisionId !== "" && !unitRequired && (
                <span className={styles.dropzoneHint}>
                  No platform units are configured for this division — unit selection is not required.
                </span>
              )}
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
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr 1fr" }}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ShieldIcon /> Police Verification
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Verification Status">
                <select
                  value={policeStatus}
                  onChange={(e) => setPoliceStatus(e.target.value as VerificationStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Issue Date">
                <input type="date" value={policeIssueDate} onChange={(e) => setPoliceIssueDate(e.target.value)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Police Verification Number">
                <input
                  value={policeNumber}
                  onChange={(e) => setPoliceNumber(e.target.value)}
                  placeholder="e.g. PVR/KGP/2026/1029"
                  required
                />
              </Field>
              <Field label="Valid Till Date">
                <input type="date" value={policeValidTill} onChange={(e) => setPoliceValidTill(e.target.value)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Remarks (optional)">
                <input
                  value={policeRemarks}
                  onChange={(e) => setPoliceRemarks(e.target.value)}
                  placeholder="Additional notes"
                />
              </Field>
              <div />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <DocIcon /> Medical Verification
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Verification Status">
                <select
                  value={medicalStatus}
                  onChange={(e) => setMedicalStatus(e.target.value as VerificationStatus)}
                >
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </Field>
              <Field label="Issue Date">
                <input type="date" value={medicalIssueDate} onChange={(e) => setMedicalIssueDate(e.target.value)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Medical Fitness Certificate Number">
                <input
                  value={medicalNumber}
                  onChange={(e) => setMedicalNumber(e.target.value)}
                  placeholder="e.g. MFC/KGP/2026/1029"
                  required
                />
              </Field>
              <Field label="Valid Till Date">
                <input type="date" value={medicalValidTill} onChange={(e) => setMedicalValidTill(e.target.value)} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Remarks (optional)">
                <input
                  value={medicalRemarks}
                  onChange={(e) => setMedicalRemarks(e.target.value)}
                  placeholder="Additional notes"
                />
              </Field>
              <div />
            </div>
          </section>
        </div>
      )}

      {step === 4 && (
        <div className={styles.grid} style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <DocIcon /> Aadhaar Document
            </h2>
            <label className={styles.dropzone}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                hidden
                onChange={(e) => handleDocChange(e.target.files?.[0] ?? null, setAadhaarDoc)}
              />
              <UploadIcon />
              <div className={styles.dropzoneTitle}>
                {aadhaarDoc ? aadhaarDoc.name : "Click to upload or drag and drop"}
              </div>
              <div className={styles.dropzoneHint}>PDF, JPG, PNG up to 5MB</div>
            </label>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <DocIcon /> Medical Verification Document
            </h2>
            <label className={styles.dropzone}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                hidden
                onChange={(e) => handleDocChange(e.target.files?.[0] ?? null, setMedicalDoc)}
              />
              <UploadIcon />
              <div className={styles.dropzoneTitle}>
                {medicalDoc ? medicalDoc.name : "Click to upload or drag and drop"}
              </div>
              <div className={styles.dropzoneHint}>PDF, JPG, PNG up to 5MB</div>
            </label>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ShieldIcon /> Police Verification Document
            </h2>
            <label className={styles.dropzone}>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                hidden
                onChange={(e) => handleDocChange(e.target.files?.[0] ?? null, setPoliceDoc)}
              />
              <UploadIcon />
              <div className={styles.dropzoneTitle}>
                {policeDoc ? policeDoc.name : "Click to upload or drag and drop"}
              </div>
              <div className={styles.dropzoneHint}>PDF, JPG, PNG up to 5MB</div>
            </label>
          </section>
        </div>
      )}

      {step === 5 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Review &amp; Submit</h2>
          <div className={styles.reviewGrid}>
            <ReviewItem label="Full Name" value={fullName || "—"} />
            <ReviewItem label="Mobile Number" value={mobile || "—"} />
            <ReviewItem label="Address" value={address || "—"} />
            <ReviewItem label="Aadhaar Number" value={aadhaar || "—"} />
            <ReviewItem label="Blood Group" value={bloodGroup || "—"} />
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
            <ReviewItem label="Police Verification" value={policeStatus} />
            <ReviewItem label="Police Verification Number" value={policeNumber || "—"} />
            <ReviewItem label="Medical Verification" value={medicalStatus} />
            <ReviewItem label="Medical Fitness Certificate Number" value={medicalNumber || "—"} />
            <ReviewItem label="Aadhaar Document" value={aadhaarDoc?.name ?? "Not uploaded"} />
            <ReviewItem label="Medical Document" value={medicalDoc?.name ?? "Not uploaded"} />
            <ReviewItem label="Police Document" value={policeDoc?.name ?? "Not uploaded"} />
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
