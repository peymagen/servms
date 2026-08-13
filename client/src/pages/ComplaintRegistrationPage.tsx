import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateComplaintMutation, useGetComplaintSubtypesQuery, useGetComplaintTypesQuery } from "../api/complaintApi";
import { useGetUnitsLiteQuery, useGetDivisionsQuery, useGetStationsQuery } from "../api/mastersApi";
import { useGetTrainsQuery } from "../api/trainApi";
import type { Complaint } from "../types";
import styles from "./ComplaintRegistrationPage.module.css";

type Source = "railmadad" | "cpgrams" | "manual";

const PRIORITIES: Array<{ value: Complaint["priority"]; label: string; icon: ReactNode }> = [
  { value: "low", label: "Low", icon: <ExclaimIcon /> },
  { value: "medium", label: "Medium", icon: <WarnIcon /> },
  { value: "high", label: "High", icon: <StarIcon /> },
];

export default function ComplaintRegistrationPage() {
  const navigate = useNavigate();
  const { data: units = [] } = useGetUnitsLiteQuery();
  const { data: divisions = [] } = useGetDivisionsQuery();
  const [createComplaint, { isLoading: isSubmitting }] = useCreateComplaintMutation();

  const [source, setSource] = useState<Source>("manual");
  const [portalRegNo, setPortalRegNo] = useState("");
  const [dakRefNo, setDakRefNo] = useState("");
  const [eofficeNo, setEofficeNo] = useState("");
  const [railMadadRefNo, setRailMadadRefNo] = useState("");

  const [divisionId, setDivisionId] = useState<number | "">("");
  const { data: stations = [] } = useGetStationsQuery(divisionId || undefined);
  const { data: trainsResult } = useGetTrainsQuery({ division_id: divisionId || undefined, limit: 500 });
  const trains = trainsResult?.rows ?? [];
  const [trainId, setTrainId] = useState<number | "">("");
  const [stationId, setStationId] = useState<number | "">("");

  const [unitId, setUnitId] = useState<number | "">("");

  const { data: types = [] } = useGetComplaintTypesQuery();
  const [typeId, setTypeId] = useState<number | "">("");
  const { data: subtypes = [] } = useGetComplaintSubtypesQuery({ typeId: typeId || 0 }, { skip: !typeId });
  const [subtypeId, setSubtypeId] = useState<number | "">("");

  useEffect(() => {
    setSubtypeId("");
  }, [typeId]);

  const [complainantName, setComplainantName] = useState("");
  const [complainantMobile, setComplainantMobile] = useState("");
  const [complainantEmail, setComplainantEmail] = useState("");

  const [description, setDescription] = useState("");
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [occurrenceTime, setOccurrenceTime] = useState("");
  const [priority, setPriority] = useState<Complaint["priority"]>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const referenceLabel = useMemo(
    () =>
      source === "cpgrams"
        ? "Portal Registration Number"
        : source === "railmadad"
        ? "RailMadad Reference Number"
        : "Manual Dak / E-Office Reference",
    [source]
  );

  function handleFilesSelected(selected: FileList | null) {
    if (!selected) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!typeId || !subtypeId) {
      setError("Complaint Type and Sub-Type are required");
      return;
    }
    if (source === "cpgrams" && !portalRegNo.trim()) {
      setError("Portal Registration Number is required for CPGRAMS complaints");
      return;
    }
    if (source === "railmadad" && !railMadadRefNo.trim()) {
      setError("RailMadad Reference Number is required for RailMadad complaints");
      return;
    }

    try {
      await createComplaint({
        complaint_source: source,
        portal_registration_number: source === "cpgrams" ? portalRegNo : undefined,
        manual_dak_reference_number: source === "manual" ? dakRefNo || undefined : undefined,
        eoffice_computer_number: source === "manual" ? eofficeNo || undefined : undefined,
        complaint_ref_no: source === "railmadad" ? railMadadRefNo : undefined,
        unit_id: Number(unitId),
        division_id: divisionId || undefined,
        train_id: trainId || undefined,
        station_id: stationId || undefined,
        complaint_type_id: Number(typeId),
        complaint_subtype_id: Number(subtypeId),
        description,
        complainant_name: complainantName || undefined,
        complainant_mobile: complainantMobile || undefined,
        complainant_email: complainantEmail || undefined,
        occurrence_date: occurrenceDate || undefined,
        occurrence_time: occurrenceTime || undefined,
        priority,
        evidence: files.length > 0 ? files : undefined,
      }).unwrap();
      navigate("/complaints");
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Unable to register complaint");
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Complaint Registration</h1>
            <p className={styles.subtitle}>
              Register a CPGRAMS, Manual, or single RailMadad complaint. RailMadad complaints can also be
              registered in bulk via Excel import.
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => navigate("/complaints")}>
              ✕ Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "▤ Submit Complaint"}
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <InfoIcon /> Complaint Source
            </h2>
            <div className={styles.priorityRow}>
              {(["manual", "cpgrams", "railmadad"] as Source[]).map((s) => (
                <button
                  type="button"
                  key={s}
                  className={source === s ? styles.priorityTileActive : styles.priorityTile}
                  onClick={() => setSource(s)}
                >
                  <span>{s === "manual" ? "Manual Complaint" : s === "cpgrams" ? "CPGRAMS" : "RailMadad"}</span>
                </button>
              ))}
            </div>
            <div className={styles.fieldRow} style={{ marginTop: 16 }}>
              {source === "cpgrams" ? (
                <Field label="Portal Registration Number">
                  <div className={styles.inputWithIcon}>
                    <input value={portalRegNo} onChange={(e) => setPortalRegNo(e.target.value)} required />
                  </div>
                </Field>
              ) : source === "railmadad" ? (
                <Field label="RailMadad Reference Number">
                  <div className={styles.inputWithIcon}>
                    <input value={railMadadRefNo} onChange={(e) => setRailMadadRefNo(e.target.value)} required />
                  </div>
                </Field>
              ) : (
                <>
                  <Field label="Manual Dak Reference Number">
                    <div className={styles.inputWithIcon}>
                      <input value={dakRefNo} onChange={(e) => setDakRefNo(e.target.value)} />
                    </div>
                  </Field>
                  <Field label="E-Office Computer Number">
                    <div className={styles.inputWithIcon}>
                      <input value={eofficeNo} onChange={(e) => setEofficeNo(e.target.value)} />
                    </div>
                  </Field>
                </>
              )}
            </div>
          </section>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Location</h2>
            <Field label="Division">
              <div className={styles.inputWithIcon}>
                <select
                  value={divisionId}
                  onChange={(e) => {
                    setDivisionId(e.target.value ? Number(e.target.value) : "");
                    setTrainId("");
                    setStationId("");
                  }}
                >
                  <option value="">Select Division</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.division_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Train (if applicable)">
              <div className={styles.inputWithIcon}>
                <select value={trainId} onChange={(e) => setTrainId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.train_number} — {t.train_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Station (if applicable)">
              <div className={styles.inputWithIcon}>
                <select value={stationId} onChange={(e) => setStationId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— None —</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.station_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </aside>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <CategoryIcon /> Complaint Classification
            </h2>
            <div className={styles.fieldRow}>
              <Field label="Complaint Type">
                <div className={styles.inputWithIcon}>
                  <select value={typeId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Select Type</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Complaint Sub-Type">
                <div className={styles.inputWithIcon}>
                  <select
                    value={subtypeId}
                    onChange={(e) => setSubtypeId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!typeId}
                    required
                  >
                    <option value="">{typeId ? "Select Sub-Type" : "Select Type first"}</option>
                    {subtypes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <Field label="Concerned Unit">
              <div className={styles.inputWithIcon}>
                <PinIcon />
                <select value={unitId} onChange={(e) => setUnitId(e.target.value ? Number(e.target.value) : "")} required>
                  <option value="">e.g. Shalimar Station, Platform 2</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name} — {u.station_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Detailed Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide a clear and concise description of the incident, including specific details that can aid in investigation…"
                required
              />
            </Field>
          </section>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Complainant Details</h2>
            <Field label="Complainant Name">
              <div className={styles.inputWithIcon}>
                <input value={complainantName} onChange={(e) => setComplainantName(e.target.value)} />
              </div>
            </Field>
            <Field label="Mobile Number">
              <div className={styles.inputWithIcon}>
                <input value={complainantMobile} onChange={(e) => setComplainantMobile(e.target.value)} />
              </div>
            </Field>
            <Field label="Email">
              <div className={styles.inputWithIcon}>
                <input type="email" value={complainantEmail} onChange={(e) => setComplainantEmail(e.target.value)} />
              </div>
            </Field>
          </aside>

          <aside className={styles.card}>
            <h2 className={styles.cardTitle}>Incident Parameters</h2>
            <Field label="Occurrence Date">
              <div className={styles.inputWithIcon}>
                <CalendarIcon />
                <input type="date" value={occurrenceDate} onChange={(e) => setOccurrenceDate(e.target.value)} />
              </div>
            </Field>
            <Field label="Occurrence Time">
              <div className={styles.inputWithIcon}>
                <ClockIcon />
                <input type="time" value={occurrenceTime} onChange={(e) => setOccurrenceTime(e.target.value)} />
              </div>
            </Field>
            <span className={styles.fieldLabel}>Priority Level</span>
            <div className={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  className={priority === p.value ? styles.priorityTileActive : styles.priorityTile}
                  onClick={() => setPriority(p.value)}
                >
                  {p.icon}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ClipIcon /> Evidence &amp; Documentation
            </h2>
            <label className={styles.dropzone}>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                hidden
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <CloudUploadIcon />
              <div className={styles.dropzoneTitle}>Click to upload or drag and drop</div>
              <div className={styles.dropzoneHint}>PNG, JPG or PDF (Multiple files supported)</div>
            </label>
            {files.length > 0 && (
              <div className={styles.thumbRow}>
                {files.map((file, i) => (
                  <div key={i} className={styles.thumb}>
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                    ) : (
                      <span className={styles.thumbFile}>{file.name.slice(0, 10)}</span>
                    )}
                  </div>
                ))}
                <label className={styles.thumbAdd}>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    hidden
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  +
                </label>
              </div>
            )}
          </section>
        </div>
      </form>

      <p className={styles.footer}>
        {referenceLabel}: used to de-duplicate complaints of the same source · SECURE TRANSACTION ENCRYPTED VIA
        RAILWAY INTRANET NODES
      </p>
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

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ExclaimIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 6v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8A2 2 0 0 1 19.4 20H4.6a2 2 0 0 1-1.7-3l7.4-12.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M12 9.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v6M12 16v6M2 12h6M16 12h6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M19.1 4.9l-4.2 4.2M9.1 14.9l-4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 12.5 15 5.5a3.2 3.2 0 0 1 4.5 4.5l-8.5 8.5a5 5 0 1 1-7-7l8-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <path d="M7 18a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 8.5a4 4 0 0 1 .8 7.9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 21v-8M9 15l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
